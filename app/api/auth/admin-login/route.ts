import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { createSession, sessionCookieOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const admin = await queryOne<{ username:string; password:string }>(
    `SELECT username, password FROM admins WHERE username = $1`,
    [username.trim()]
  )

  if (!admin || admin.password !== password.trim())
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  const token = await createSession({ role: 'admin', username: admin.username })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookieOptions(token))
  return res
}
