import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function requireAdmin(req: NextRequest) {
  const s = await getSession(req)
  return s?.role === 'admin' ? s : null
}

// GET /api/admin?resource=users|tokens|stalls|dashboard
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resource = req.nextUrl.searchParams.get('resource')

  if (resource === 'users') {
    const rows = await query(
      `SELECT id, uid, username, balance, blocked, created_at FROM users ORDER BY uid`
    )
    return NextResponse.json(rows)
  }

  if (resource === 'tokens') {
    const rows = await query(
      `SELECT id, token_no, stall_id, stall_name, username, items, total, status, created_at
       FROM tokens ORDER BY created_at DESC`
    )
    return NextResponse.json(rows)
  }

  if (resource === 'stalls') {
    const [stalls, items] = await Promise.all([
      query<{ stall_id:string; name:string }>(`SELECT stall_id, name FROM stalls ORDER BY stall_id`),
      query<{ stall_id:string; id:number; name:string; price:number }>(
        `SELECT stall_id, id, name, price FROM menu_items ORDER BY id`
      ),
    ])
    return NextResponse.json(stalls.map(s => ({
      ...s,
      menu_items: items.filter(i => i.stall_id === s.stall_id),
    })))
  }

  if (resource === 'dashboard') {
    // One round-trip for all stats using aggregates
    const [userStats, tokenStats, stallStats] = await Promise.all([
      queryOne<{ total_users:string; total_balance:string }>(
        `SELECT COUNT(*) as total_users, COALESCE(SUM(balance),0) as total_balance FROM users`
      ),
      queryOne<{ total_orders:string; total_revenue:string; pending:string; served:string }>(
        `SELECT COUNT(*) as total_orders,
                COALESCE(SUM(total),0) as total_revenue,
                COUNT(*) FILTER (WHERE status='Pending') as pending,
                COUNT(*) FILTER (WHERE status='Served') as served
         FROM tokens`
      ),
      query<{ stall_id:string; stall_name:string; revenue:string; orders:string; pending:string }>(
        `SELECT stall_id, stall_name,
                COALESCE(SUM(total),0) as revenue,
                COUNT(*) as orders,
                COUNT(*) FILTER (WHERE status='Pending') as pending
         FROM tokens GROUP BY stall_id, stall_name ORDER BY stall_id`
      ),
    ])

    const stalls: Record<string, { name:string; revenue:number; orders:number; pending:number }> = {}
    for (const s of stallStats) {
      stalls[s.stall_id] = {
        name:    s.stall_name,
        revenue: Number(s.revenue),
        orders:  Number(s.orders),
        pending: Number(s.pending),
      }
    }

    return NextResponse.json({
      totalUsers:   Number(userStats?.total_users   ?? 0),
      totalBalance: Number(userStats?.total_balance  ?? 0),
      totalOrders:  Number(tokenStats?.total_orders  ?? 0),
      totalRevenue: Number(tokenStats?.total_revenue ?? 0),
      pending:      Number(tokenStats?.pending       ?? 0),
      served:       Number(tokenStats?.served        ?? 0),
      stalls,
    })
  }

  return NextResponse.json({ error: 'Unknown resource' }, { status: 400 })
}

// POST /api/admin — actions: topup, set_balance, block, unblock, zero
export async function POST(req: NextRequest) {
  if (!await requireAdmin(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, username, amount, new_pin } = await req.json()

  if (action === 'topup') {
    const user = await queryOne<{ balance:number }>(`SELECT balance FROM users WHERE username=$1`, [username])
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const new_balance = Number(user.balance) + Number(amount)
    await query(`UPDATE users SET balance=$1 WHERE username=$2`, [new_balance, username])
    return NextResponse.json({ ok: true, new_balance })
  }

  if (action === 'set_balance') {
    await query(`UPDATE users SET balance=$1 WHERE username=$2`, [Number(amount), username])
    return NextResponse.json({ ok: true })
  }

  if (action === 'zero') {
    await query(`UPDATE users SET balance=0 WHERE username=$1`, [username])
    return NextResponse.json({ ok: true })
  }

  if (action === 'block') {
    await query(`UPDATE users SET blocked=true WHERE username=$1`, [username])
    return NextResponse.json({ ok: true })
  }

  if (action === 'unblock') {
    if (!new_pin || !/^\d{4}$/.test(new_pin))
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
    const pin_hash = await bcrypt.hash(new_pin, 10)
    await query(`UPDATE users SET blocked=false, pin_hash=$1 WHERE username=$2`, [pin_hash, username])
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
