import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { query } from '@/lib/db'

const STALLS = [
  {
    stall_id: 'S101', name: 'Tasty Bites', pin: '2134',
    menu: [
      { name: 'Burger', price: 80 },
      { name: 'Sandwich', price: 60 },
      { name: 'French Fries', price: 40 },
      { name: 'Cold Coffee', price: 50 },
    ],
  },
  {
    stall_id: 'S102', name: 'Spice Junction', pin: '1234',
    menu: [
      { name: 'Biryani', price: 120 },
      { name: 'Paneer Roll', price: 90 },
      { name: 'Lassi', price: 40 },
      { name: 'Gulab Jamun', price: 30 },
    ],
  },
  {
    stall_id: 'S103', name: 'Sweet Treats', pin: '4321',
    menu: [
      { name: 'Ice Cream', price: 50 },
      { name: 'Brownie', price: 60 },
      { name: 'Waffles', price: 80 },
      { name: 'Milkshake', price: 70 },
    ],
  },
]

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.SEED_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const results: string[] = []

  for (const stall of STALLS) {
    try {
      const pin_hash = await bcrypt.hash(stall.pin, 10)
      await query(
        `INSERT INTO stalls (stall_id, name, pin_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (stall_id) DO UPDATE SET name=$2, pin_hash=$3`,
        [stall.stall_id, stall.name, pin_hash]
      )
      await query(`DELETE FROM menu_items WHERE stall_id=$1`, [stall.stall_id])
      for (const item of stall.menu) {
        await query(
          `INSERT INTO menu_items (stall_id, name, price) VALUES ($1, $2, $3)`,
          [stall.stall_id, item.name, item.price]
        )
      }
      results.push(`✅ ${stall.name} (${stall.stall_id}) seeded with PIN ${stall.pin}`)
    } catch (e: any) {
      results.push(`❌ ${stall.stall_id} error: ${e.message}`)
    }
  }

  try {
    await query(
      `INSERT INTO admins (username, password) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password=$2`,
      ['Admin', 'Hello']
    )
    results.push('✅ Admin seeded (username: Admin, password: Hello)')
  } catch (e: any) {
    results.push(`❌ Admin error: ${e.message}`)
  }

  return NextResponse.json({ results })
}
