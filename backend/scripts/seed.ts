import 'dotenv/config';

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import { eq, and } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { users, quizzes, templates as templatesSchema, templateCategories } from '../src/db/schema.js';
import { QUIZZES, DEFAULT_QUIZ_ID } from '../src/db/seeds/quizzes.js';
import { templates as starterTemplates } from '../src/db/seeds/templates.js';

async function seed() {
  console.log('Seeding database...');

  // 1. Seed Template Categories
  const categoryMap: Record<string, string> = {}; // Name -> ID

  async function ensureCategory(name: string, parentId?: string): Promise<string> {
    const [inserted] = await db
      .insert(templateCategories)
      .values({ name, parentId })
      .onConflictDoUpdate({
        target: templateCategories.name,
        set: { parentId: parentId ?? null } // Update parent if it changed, otherwise just get ID
      })
      .returning({ id: templateCategories.id });
    
    return inserted.id;
  }

  for (const template of starterTemplates) {
    // Ensure parent category exists
    const parentId = await ensureCategory(template.category);
    // Ensure subcategory exists
    const subCategoryId = await ensureCategory(template.subcategory, parentId);
    categoryMap[`${template.category}:${template.subcategory}`] = subCategoryId;
  }

  // 2. Seed Templates (Idempotent by name)
  for (const template of starterTemplates) {
    const categoryKey = `${template.category}:${template.subcategory}`;
    const categoryId = categoryMap[categoryKey];

    if (!categoryId) {
      console.warn(`Skipping template "${template.name}": Category "${categoryKey}" not found in map.`);
      continue;
    }

    const existing = await db
      .select({ id: templatesSchema.id })
      .from(templatesSchema)
      .where(eq(templatesSchema.name, template.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(templatesSchema).values({
        name: template.name,
        description: template.description,
        categoryId: categoryId,
        questions: template.questions,
      });
      console.log(`Seeded template: ${template.name}`);
    } else {
      console.log(`Template already exists: ${template.name}`);
    }
  }

  // 3. Seed Test User
  const userRows = await db.insert(users).values({
    googleSub: 'test-user-sub-123',
    email: 'test@example.com',
    name: 'Test Host',
  }).onConflictDoUpdate({
    target: users.googleSub,
    set: { name: 'Test Host' },
  }).returning();

  const hostUser = userRows[0];
  console.log(`Test user: ${hostUser.id}`);

  const defaultQuiz = QUIZZES[DEFAULT_QUIZ_ID];

  // Idempotent: only insert if a quiz with this title doesn't exist for this owner.
  const existing = await db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.ownerUserId, hostUser.id), eq(quizzes.title, defaultQuiz.title)));

  if (existing.length === 0) {
    await db.insert(quizzes).values({
      ownerUserId: hostUser.id,
      title: defaultQuiz.title,
      questions: defaultQuiz.questions,
    });
    console.log(`Seeded quiz: ${defaultQuiz.title}`);
  } else {
    console.log(`Quiz already exists: ${defaultQuiz.title}`);
  }

  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
