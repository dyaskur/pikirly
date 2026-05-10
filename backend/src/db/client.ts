import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: config.DATABASE_SSL
    ? { rejectUnauthorized: false }
    : new URL(config.DATABASE_URL).searchParams.get('sslmode') === 'require'
      ? { rejectUnauthorized: false }
      : false,
});

export const db = drizzle(pool);
