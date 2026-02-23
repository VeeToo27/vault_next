import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  // Fetch stalls and their menu items in two queries, then join in JS
  // This avoids a complex lateral join and is easy to understand
  const [stalls, items] = await Promise.all([
    query<{ stall_id:string; name:string }>(`SELECT stall_id, name FROM stalls ORDER BY stall_id`),
    query<{ stall_id:string; id:number; name:string; price:number }>(
      `SELECT stall_id, id, name, price FROM menu_items ORDER BY id`
    ),
  ])

  const result = stalls.map(s => ({
    ...s,
    menu_items: items.filter(i => i.stall_id === s.stall_id),
  }))

  return NextResponse.json(result)
}
