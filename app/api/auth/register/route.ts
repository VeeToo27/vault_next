import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { queryOne, query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { username, pin } = await req.json()
  if (!username || !pin) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
  if (!/^[a-zA-Z0-9_]{3,}$/.test(username))
    return NextResponse.json({ error: 'Invalid username (letters, numbers, underscores, min 3 chars)' }, { status: 400 })

  // Check duplicate username
  const existing = await queryOne(`SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)`, [username.trim()])
  if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })

  // Generate sequential UID safely
  const countRow = await queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM users`)
  const uid = `UID_${String(Number(countRow?.count ?? 0) + 1).padStart(4, '0')}`

  const pin_hash = await bcrypt.hash(pin, 10)

  try {
    await query(
      `INSERT INTO users (uid, username, pin_hash, balance) VALUES ($1, $2, $3, 0)`,
      [uid, username.trim(), pin_hash]
    )
    return NextResponse.json({ ok: true, uid })
  } catch (e: any) {
    if (e.code === '23505') return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
