import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' 
    ? true // full verification in prod (hosted Postgres)
    : config.DATABASE_SSL 
      ? { rejectUnauthorized: false } // self-signed cert in local/staging dev only
      : false, // disabled for testcontainers/local
});

export const db = drizzle(pool);
