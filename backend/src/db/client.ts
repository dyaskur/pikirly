import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';

const parsed = new URL(config.DATABASE_URL);
const needsSsl = parsed.searchParams.get('sslmode');
parsed.searchParams.delete('sslmode');
const cleanUrl = parsed.toString();

const pool = new pg.Pool({
  connectionString: cleanUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool);
