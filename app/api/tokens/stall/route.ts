import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET — all tokens for this stall
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'stall_owner')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tokens = await query(
    `SELECT id, token_no, stall_id, stall_name, username, items, total, status, created_at
     FROM tokens WHERE stall_id = $1 ORDER BY token_no DESC`,
    [session.stall_id]
  )
  return NextResponse.json(tokens)
}

// PATCH — toggle token status (Pending ↔ Served)
export async function PATCH(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'stall_owner')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token_id, status } = await req.json()
  if (!token_id || !['Pending', 'Served'].includes(status))
    return NextResponse.json({ error: 'Invalid' }, { status: 400 })

  const updated = await queryOne<{ id:number; status:string }>(
    `UPDATE tokens SET status = $1
     WHERE id = $2 AND stall_id = $3
     RETURNING id, status`,
    [status, token_id, session.stall_id]
  )

  if (!updated) return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  return NextResponse.json(updated)
}
