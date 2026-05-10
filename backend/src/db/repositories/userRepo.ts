import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { users } from '../schema.js';

export const userRepo = {
  async findOrCreateByGoogleSub(sub: string, email: string, name: string) {
    console.log('userRepo: findOrCreateByGoogleSub', { sub, type: typeof sub });
    try {
      const existing = await db.select().from(users).where(eq(users.googleSub, sub));
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
