# Phase 10 — Admin Panel

**Status**: 🔜
**Depends on**: Phase 3 (templates already in DB), Phase 9 (production deploy + role enforcement matters more in prod)
**Goal**: Internal `/admin` UI for promoting users, curating the system template library, moderating user quizzes, and watching key metrics. Server enforces a single `admin` role; non-admins are 404'd.

## Why this phase

System templates are managed by a [backend/src/db/seeds/templates.ts](../../backend/src/db/seeds/templates.ts) seed script today — fine for bootstrap, awful for ongoing curation. AI usage is unmetered. Misbehaving user quizzes can't be removed without `psql`. This phase replaces those operational gaps with a guarded admin surface.

## Out of scope (intentional)

- Multi-tier roles (we ship two: `host`, `admin`)
- Per-resource ACLs / sharing
- Audit log search UI (we write the rows; the search is for a future phase)
- Billing / Stripe integration
- Email notifications from admin actions
- Bulk import/export of templates as files (use copy-from-quiz UI instead)
- I18n of the admin surface (English only for v1)

## Deliverables

### 1. Role column + middleware

In `backend/src/db/schema.ts` + new migration:

- [ ] Add `role: text('role').notNull().default('host')` to `users`. CHECK constraint enforces `role IN ('host', 'admin')`.
- [ ] Backfill all existing rows with `'host'` in the same migration.
- [ ] New CLI: `backend/scripts/promote-admin.ts` — usage `pnpm tsx scripts/promote-admin.ts <email>`; sets `role='admin'` for that user. Idempotent.

In `backend/src/auth/middleware.ts`:

- [ ] Add `verifyAdmin` middleware that runs after `verifyJwt` and rejects with 404 (not 403 — admin endpoints should be invisible to non-admins) when `req.user.role !== 'admin'`.

### 2. Admin REST routes

New file `backend/src/routes/admin.routes.ts`, all guarded by `verifyAdmin`:

- [ ] `GET /admin/metrics` → `{ activeGameCount, totalQuizCount, totalUserCount, recentAiCalls: { today: number, last7d: number } }`. Active games come from the in-memory `store.ts`; the rest are DB counts.
- [ ] `GET /admin/users?search=&offset=&limit=` → paginated `{ users: [{ id, email, name, role, createdAt }], total }`. Search matches `email` ILIKE.
- [ ] `PATCH /admin/users/:id` → body `{ role?: 'host' | 'admin' }`. Admin can demote another admin but cannot demote themselves (404 on self).
- [ ] `DELETE /admin/users/:id` → cascades to their quizzes (existing FK) + path progress (Phase 11 dependency, conditional).
- [ ] `GET /admin/quizzes?search=&ownerId=&offset=&limit=` → list any user's quizzes; surfaces title + owner email + created timestamp.
- [ ] `DELETE /admin/quizzes/:id` → hard-delete; write audit row.
- [ ] `POST /admin/quizzes/:id/clone-to-template` → body `{ categoryId, name?, description? }`. Copies the quiz's questions into a new `templates` row under that category.
- [ ] `GET /admin/categories`, `POST /admin/categories`, `PATCH /admin/categories/:id`, `DELETE /admin/categories/:id` → wraps existing `templateCategories` table.
- [ ] `POST /admin/templates`, `PATCH /admin/templates/:id`, `DELETE /admin/templates/:id` → CRUD on `templates`. Featured flag added in §3.
- [ ] `GET /admin/config` → `{ maintenanceMode: boolean, primaryAiProvider: 'straico' | 'openai' | 'openrouter' }`. `PATCH /admin/config` → set either. Persisted in a new single-row `app_config` table (or `system_settings` JSONB — pick JSONB, easier to extend).

### 3. Schema additions

In `backend/src/db/schema.ts` + new migration:

- [ ] `templates` gets `featured: boolean('featured').notNull().default(false)` and `featuredOrder: integer('featured_order')` (null = not featured). Featured ones float to the top of the picker, sorted by `featuredOrder ASC`.
- [ ] New table `audit_log`: `id`, `actor_user_id` (FK users), `action` text (e.g. `'delete_quiz'`, `'promote_admin'`), `target_type` text, `target_id` uuid nullable, `metadata` jsonb, `created_at`. Indexed on `(actor_user_id, created_at desc)`.
- [ ] New table `app_config`: single row keyed by id `'singleton'`; `value jsonb` holding `{ maintenanceMode, primaryAiProvider }`.
- [ ] New table `ai_usage`: `id`, `user_id`, `provider`, `tokens_in` int, `tokens_out` int, `latency_ms` int, `success` bool, `created_at`. Phase 3's AI route inserts a row per call (small wire-in change to `backend/src/services/ai/service.ts` — call site stays inside try/finally).

### 4. Maintenance mode enforcement

- [ ] In `createGame` ([backend/src/services/game/createGame.ts](../../backend/src/services/game/createGame.ts)), read `app_config.maintenanceMode`; if true, return `{ ok: false, error: 'maintenance_mode' }`.
- [ ] WS `create_game` handler surfaces this error verbatim; frontend shows a banner.
- [ ] Cached in-process for 5s to avoid a DB read per game creation.

### 5. AI provider override

- [ ] `aiService.generateQuestions` reads `app_config.primaryAiProvider` (cached 5s) and uses it as the first fallback-chain provider, overriding the env-set default. If unset, falls back to env.

### 6. Admin frontend

New route tree under `frontend/src/routes/admin/`:

- [ ] `/admin/+layout.svelte` — sidebar nav (Dashboard, Templates, Categories, Quizzes, Users, Settings); checks `user.role === 'admin'` on client, 404s if not (server-side enforcement is the real check)
- [ ] `/admin/+page.svelte` — dashboard tiles: 4 metric cards + a recent-activity strip pulled from `GET /admin/metrics` (poll every 30s)
- [ ] `/admin/templates/+page.svelte` — table with featured toggle + reorder; "+ New template" links to the slide editor in "template mode"
- [ ] `/admin/templates/[id]/+page.svelte` — edit a template; reuses [SlideEditor.svelte](../../frontend/src/lib/components/SlideEditor.svelte) (assuming [improvements-slide-rail-editor.md](improvements-slide-rail-editor.md) shipped; otherwise reuse [QuizEditor.svelte](../../frontend/src/lib/components/QuizEditor.svelte))
- [ ] `/admin/categories/+page.svelte` — flat tree edit
- [ ] `/admin/quizzes/+page.svelte` — search, paginate, "Clone to template" + Delete actions per row
- [ ] `/admin/users/+page.svelte` — search, paginate, promote/demote, delete
- [ ] `/admin/settings/+page.svelte` — maintenance mode toggle + AI provider override

### 7. Auth wiring

- [ ] OAuth callback already issues a JWT; extend it to include `role` claim. JWT payload type bumps to `{ sub, email, name, role }`.
- [ ] Existing routes that read `req.user` continue to work (`role` is optional in older paths).

## Files to touch

```
backend/
  src/db/schema.ts                                     # MODIFY: role, featured, audit_log, app_config, ai_usage
  src/db/migrations/00XX_admin_panel.sql               # NEW
  src/db/repositories/userRepo.ts                      # MODIFY: list/search/update/delete
  src/db/repositories/templateRepo.ts                  # MODIFY: featured ops
  src/db/repositories/auditRepo.ts                     # NEW
  src/db/repositories/appConfigRepo.ts                 # NEW
  src/db/repositories/aiUsageRepo.ts                   # NEW
  src/auth/middleware.ts                               # MODIFY: verifyAdmin
  src/auth/jwt.ts (or equivalent)                      # MODIFY: role claim
  src/routes/admin.routes.ts                           # NEW
  src/services/game/createGame.ts                      # MODIFY: maintenance-mode check
  src/services/ai/service.ts                           # MODIFY: provider override + usage logging
  scripts/promote-admin.ts                             # NEW

frontend/
  src/routes/admin/+layout.svelte                      # NEW
  src/routes/admin/+page.svelte                        # NEW
  src/routes/admin/templates/+page.svelte              # NEW
  src/routes/admin/templates/[id]/+page.svelte         # NEW
  src/routes/admin/categories/+page.svelte             # NEW
  src/routes/admin/quizzes/+page.svelte                # NEW
  src/routes/admin/users/+page.svelte                  # NEW
  src/routes/admin/settings/+page.svelte               # NEW
  src/lib/components/AdminTable.svelte                 # NEW — shared paginated table

CHANGELOG.md                                           # APPEND under [Unreleased]
```

## Tests

In `backend/src/routes/admin.routes.integration.test.ts` (new — Vitest + Fastify inject + Testcontainers):

- [ ] Non-admin gets 404 on every `/admin/*` route
- [ ] Admin can promote another user; the same admin cannot demote themselves (404)
- [ ] `DELETE /admin/quizzes/:id` removes the quiz and writes an audit row
- [ ] `POST /admin/quizzes/:id/clone-to-template` produces a template whose questions match the source quiz
- [ ] Maintenance mode toggle blocks `create_game` (test via the WS handler integration test, not just REST)
- [ ] `featured_order` ordering is respected on `GET /templates`

## Verification

1. `cd backend && pnpm tsc --noEmit && pnpm test`
2. `cd frontend && pnpm run check`
3. Promote your own user: `pnpm tsx backend/scripts/promote-admin.ts your-email@example.com` → log out / back in → `/admin` loads
4. Manual: create a category, create a template under it, mark it featured, host a game from templates — featured one is at the top
5. Manual: enable maintenance mode → try to create a game → blocked with banner; disable → game creates
6. Manual: flip AI provider override → trigger an AI generate → check `ai_usage` row records the chosen provider
7. CHANGELOG entry under `[Unreleased]` → **Added** / **Security**

## Acceptance criteria

- A non-admin hitting `/admin` or any `/admin/*` endpoint sees 404, not 403
- Admin can manage categories, templates, quizzes, users, and toggle maintenance mode + AI provider without editing the DB
- AI usage is recorded per call and visible on the dashboard
- Existing live multiplayer + standalone editor flows are unchanged
- Migration runs cleanly on a non-empty DB (existing rows backfilled with `role='host'`)

## Reference

- [docs/phases/03-templates-ai.md](03-templates-ai.md) — categories + templates schema this builds on
- [docs/phases/improvements-ai-hardening.md](improvements-ai-hardening.md) — the AI usage table here can feed its rate-limit accounting
- [docs/phases/improvements-slide-rail-editor.md](improvements-slide-rail-editor.md) — template editor reuses the slide editor
