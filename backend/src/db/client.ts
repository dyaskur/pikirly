import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';

// Support both ?sslmode=... in URL and DATABASE_SSL env var
const parsed = new URL(config.DATABASE_URL);
const sslInUrl = parsed.searchParams.get('sslmode');
const sslEnv = config.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // 5s max to connect
  statement_timeout: 10000,     // 10s max per query
  ssl: (sslInUrl || sslEnv) ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB-POOL] Unexpected error on idle client', err);
});

export const db = drizzle(pool);
