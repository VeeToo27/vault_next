import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { queryOne, query, transaction } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stall_id, stall_name, items, total, pin } = await req.json()
  if (!stall_id || !items || !total || !pin)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify PIN outside the transaction — bcrypt is slow, no need to hold a row lock
  const user = await queryOne<{ pin_hash: string; blocked: boolean }>(
    `SELECT pin_hash, blocked FROM users WHERE username = $1`,
    [session.username]
  )
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.blocked) return NextResponse.json({ error: 'Account blocked' }, { status: 403 })

  const pinOk = await bcrypt.compare(pin, user.pin_hash)
  if (!pinOk) return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 })

  try {
    const result = await transaction(async (q) => {
      // Lock only this user's row — all other users proceed in parallel
      const balRows = await q<{ balance: string }>(
        `SELECT balance FROM users WHERE username = $1 FOR UPDATE`,
        [session.username]
      )
      const balance = Number(balRows[0]?.balance ?? 0)
      if (balance < total) throw { code: 'INSUFFICIENT', balance }

      // Deduct balance
      await q(
        `UPDATE users SET balance = balance - $1 WHERE username = $2`,
        [total, session.username]
      )

      // Next token number for this stall
      const seqRows = await q<{ next_token: string }>(
        `SELECT COALESCE(MAX(token_no), 0) + 1 AS next_token FROM tokens WHERE stall_id = $1`,
        [stall_id]
      )
      const token_no = Number(seqRows[0].next_token)

      // Insert the order
      await q(
        `INSERT INTO tokens (token_no, stall_id, stall_name, username, items, total, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'Pending')`,
        [token_no, stall_id, stall_name, session.username, JSON.stringify(items), total]
      )

      return { token_no, new_balance: balance - total }
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { code?: string; balance?: number }
    if (e.code === 'INSUFFICIENT')
      return NextResponse.json({ error: 'Insufficient balance', balance: e.balance }, { status: 400 })
    console.error('place_order error:', err)
    return NextResponse.json({ error: 'Order failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tokens = await query(
    `SELECT id, token_no, stall_id, stall_name, username, items, total, status, created_at
     FROM tokens WHERE username = $1 ORDER BY created_at DESC`,
    [session.username]
  )
  return NextResponse.json(tokens)
}
