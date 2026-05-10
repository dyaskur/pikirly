import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';

// Support both ?sslmode=... in URL and DATABASE_SSL env var
const parsed = new URL(config.DATABASE_URL);
const sslInUrl = parsed.searchParams.get('sslmode');
const sslEnv = config.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';
const finalSsl = (sslInUrl || sslEnv) ? { rejectUnauthorized: false } : false;

console.log('[DB-INIT] Attempting connection to:', {
  host: parsed.hostname,
  port: parsed.port,
  database: parsed.pathname.slice(1),
  ssl: !!finalSsl
});

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased to 10s
  statement_timeout: 10000,
  ssl: finalSsl,
});

pool.on('error', (err) => {
  console.error('[DB-POOL] Fatal error on idle client:', err.message);
});

export const db = drizzle(pool);
// Export pool for health checks to get better error messages
export { pool };
