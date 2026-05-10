import { eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { users } from '../schema.js';

export const userRepo = {
  async findOrCreateByGoogleSub(sub: string, email: string, name: string) {
    console.log('[REPO-V2] findOrCreateByGoogleSub', { sub });
    try {
      // Use standard SQL CAST to force text comparison
      const existing = await db.select().from(users).where(sql`${users.googleSub} = cast(${sub} as text)`);
      if (existing[0]) return existing[0];
      
      const inserted = await db.insert(users).values({
        googleSub: sub,
        email,
        name,
      }).returning();
      return inserted[0];
    } catch (err) {
      console.error('userRepo Error:', err);
      throw err;
    }
  },

  async findById(id: string) {
    const res = await db.select().from(users).where(eq(users.id, id));
    return res[0] || null;
  }
};
