import { Pool } from 'pg'

// Single pool shared across all requests — this is the key to handling
// 3000 users. Instead of a new connection per request, all requests
// share a pool of 20 persistent connections via PgBouncer-style multiplexing.
// Railway + Supabase free tier supports this comfortably.

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set')

  return new Pool({
    connectionString,
    max: 20,              // max 20 simultaneous DB connections
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false }, // required for Supabase
  })
}

// In development, reuse pool across hot reloads to avoid exhausting connections
const pool = globalThis._pgPool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalThis._pgPool = pool

export { pool }

// Typed query helper
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(sql, params)
    return result.rows as T[]
  } finally {
    client.release()
  }
}

// Single-row helper — returns null if not found
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

// Transaction helper — runs multiple queries atomically
export async function transaction<T>(
  fn: (q: (sql: string, params?: unknown[]) => Promise<unknown[]>) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const q = (sql: string, params?: unknown[]) =>
      client.query(sql, params).then(r => r.rows)
    const result = await fn(q)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
