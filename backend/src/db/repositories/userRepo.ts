import { eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { users } from '../schema.js';

export const userRepo = {
  async findOrCreateByGoogleSub(sub: string, email: string, name: string) {
    const cleanSub = String(sub).trim();
    console.log('[REPO-V3] findOrCreateByGoogleSub', { sub: cleanSub });
    
    try {
      // Use raw SQL with explicit text binding to be 100% sure the driver doesn't try to parse it as a number
      const existing = await db.execute(sql`
        SELECT "id", "google_sub", "email", "name", "created_at" 
        FROM "users" 
        WHERE "google_sub" = ${cleanSub}::text
        LIMIT 1
      `);

      if (existing.rows.length > 0) {
        return existing.rows[0] as any;
      }
      
      const inserted = await db.insert(users).values({
        googleSub: cleanSub,
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
