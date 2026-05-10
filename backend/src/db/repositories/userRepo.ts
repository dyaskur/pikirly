import { eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { users } from '../schema.js';

export const userRepo = {
  async findOrCreateByGoogleSub(sub: string, email: string, name: string) {
    const cleanSub = String(sub).trim();
    console.log('[REPO-V5] findOrCreateByGoogleSub', { sub: cleanSub });
    
    try {
      // Use sql wrapper with explicit text cast in the query
      // This is safer than raw db.execute because it preserves Drizzle's pooling
      const existing = await db.select().from(users).where(sql`${users.googleSub} = ${cleanSub}::text`);
      
      if (existing[0]) {
        console.log('[REPO-V5] User found');
        return existing[0];
      }
      
      console.log('[REPO-V5] Creating new user...');
      const inserted = await db.insert(users).values({
        googleSub: cleanSub,
        email,
        name,
      }).returning();
      
      console.log('[REPO-V5] User created');
      return inserted[0];
    } catch (err) {
      console.error('[REPO-V5] Error:', err);
      throw err;
    }
  },

  async findById(id: string) {
    const res = await db.select().from(users).where(eq(users.id, id));
    return res[0] || null;
  }
};
