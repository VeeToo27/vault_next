import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await queryOne<{ balance: number }>(
    `SELECT balance FROM users WHERE username = $1`, [session.username]
  )
  if (!row) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ balance: row.balance })
}
