import { describe, it, expect } from 'vitest';
import { userRepo } from './userRepo.js';
import { db } from '../client.js';
import { users } from '../schema.js';
import { eq } from 'drizzle-orm';

describe('userRepo', () => {
  it('should find or create a user by google sub', async () => {
    const sub = `sub-${Date.now()}`;
    const email = `test-${Date.now()}@example.com`;
    const name = 'Test User';

    // First time, should create
    const user = await userRepo.findOrCreateByGoogleSub(sub, email, name);
    expect(user).toBeDefined();
    expect(user.googleSub).toBe(sub);
    expect(user.email).toBe(email);
    expect(user.name).toBe(name);

    // Second time, should find the existing
    const existing = await userRepo.findOrCreateByGoogleSub(sub, email, name);
    expect(existing.id).toBe(user.id);

    // Clean up
    await db.delete(users).where(eq(users.id, user.id));
  });

  it('should find user by id', async () => {
    const sub = `sub-id-${Date.now()}`;
    const created = await userRepo.findOrCreateByGoogleSub(sub, 'id@test.com', 'ID Test');
    
    const found = await userRepo.findById(created.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);

    // Clean up
    await db.delete(users).where(eq(users.id, created.id));
  });
});
