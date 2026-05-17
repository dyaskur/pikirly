import { eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { users } from '../schema.js';

export const userRepo = {
  async findOrCreateByGoogleSub(sub: string, email: string, name: string) {
    const cleanSub = String(sub).trim();

    // Use sql wrapper with explicit text cast in the query
    // This is safer than raw db.execute because it preserves Drizzle's pooling
    const existing = await db.select().from(users).where(sql`${users.googleSub} = ${cleanSub}::text`);

    if (existing[0]) {
      return existing[0];
    }

    const inserted = await db.insert(users).values({
      googleSub: cleanSub,
      email,
      name,
    }).returning();

    return inserted[0];
  },

  async findById(id: string) {
    const res = await db.select().from(users).where(eq(users.id, id));
    return res[0] || null;
  }
};
