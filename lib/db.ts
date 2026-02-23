import { Pool, PoolClient } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set')

  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: { rejectUnauthorized: false },
  })
}

const pool = globalThis._pgPool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalThis._pgPool = pool

export { pool }

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

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

// Transaction helper — typed inner query uses the same generic approach
export async function transaction<T>(
  fn: (q: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>
): Promise<T> {
  const client: PoolClient = await pool.connect()
  try {
    await client.query('BEGIN')

    const q = async <R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<R[]> => {
      const result = await client.query(sql, params)
      return result.rows as R[]
    }

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
