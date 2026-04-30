# Phase 2 — Postgres + Google OAuth + Quiz editor

**Status**: 🔜 Next
**Depends on**: Phase 1 done
**Goal**: A signed-in user creates a quiz in the editor, hosts a game from it, and the result is saved to Postgres.

## Why this phase

Phase 1 proves the gameplay loop. Phase 2 makes it real: hosts have accounts, users can author quizzes, and game history persists for future review. Tackles persistence, auth, and authoring together because the schema and routes overlap heavily.

## Out of scope (intentional)

- Multi-instance scaling (Redis) — see [deferred-redis.md](deferred-redis.md)
- Rich quiz editor (image upload, drag-reorder, themes) — Phase 3+ if ever
- Public quiz library / quiz sharing
- Player accounts (still anonymous nicknames)
- Email notifications
- Password-based auth (Google OAuth only)
- CSV/Kahoot import

## Deliverables

### 1. Database setup

- [ ] Add deps: `drizzle-orm`, `pg` (driver), `drizzle-kit` (dev)
- [ ] `backend/src/db/client.ts` — `pg.Pool` + Drizzle wrapper, max 10 connections, idle 30s
- [ ] `drizzle.config.ts` at backend root — points to schema + out dir
- [ ] `backend/.env` template documents `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `SESSION_SECRET`
- [ ] Scripts: `db:generate` (drizzle-kit generate), `db:migrate` (apply), `db:push` (dev convenience), `db:seed`

### 2. Schema + migrations (Drizzle)

Schema is the source of truth — defined in TS, migrations generated from it.

- [ ] `backend/src/db/schema.ts` defines all tables (users, quizzes, games, game_results) with Drizzle DSL
- [ ] `quizzes.questions` typed as `jsonb('questions').$type<Question[]>()` for end-to-end type safety
- [ ] `games.meeting_id` declared but nullable (reserved for Phase 4)
- [ ] Run `npm run db:generate` → outputs SQL files to `backend/src/db/migrations/`
- [ ] Commit generated migrations (don't rely on `db:push` in production)

### 3. Repositories (`backend/src/db/repositories/`)

Drizzle queries are typed from the schema — no separate `RowType` interfaces.

- [ ] `userRepo.ts` — `findOrCreateByGoogleSub(sub, email, name)`, `findById(id)`
- [ ] `quizRepo.ts` — `list(ownerId)`, `getById(id, ownerId)`, `create(ownerId, dto)`, `update(id, ownerId, dto)`, `remove(id, ownerId)`
- [ ] `gameRepo.ts` — `recordGame({ quizId, hostUserId, startedAt, endedAt, playerCount })`, `recordResults(gameId, results[])`

### 4. Google OAuth

- [ ] Add `@fastify/oauth2`, `@fastify/jwt`, `@fastify/cookie`
- [ ] Routes:
  - [ ] `GET /auth/google` → redirects to Google consent screen
  - [ ] `GET /auth/google/callback` → exchanges code for tokens, finds-or-creates user, issues JWT in HTTP-only cookie
  - [ ] `POST /auth/logout` → clears cookie
  - [ ] `GET /auth/me` → returns current user `{ id, email, name }` or 401
- [ ] `verifyJwt` Fastify hook attaches `req.user` to authenticated routes
- [ ] Frontend: "Sign in with Google" button on `/login`; redirects after callback

### 5. Quiz CRUD (REST)

All routes require auth (verifyJwt hook). All ownership-scoped (user can only touch their own quizzes).

- [ ] `GET /quizzes` → user's quizzes (id, title, questionCount, updatedAt)
- [ ] `GET /quizzes/:id` → full quiz (with questions JSONB)
- [ ] `POST /quizzes` → create; body validated with zod (rules in [data-model.md](../data-model.md))
- [ ] `PUT /quizzes/:id` → replace title + questions
- [ ] `DELETE /quizzes/:id` → soft delete OK; hard delete simpler
- [ ] All errors return `{ error: 'code', message: '...' }`

### 6. Wire game flow to DB

- [ ] `create_game` handler: read `quizId` from payload → `quizRepo.getById(quizId, hostUserId)` → load into `GameState`
- [ ] `endGame` lifecycle: call `gameRepo.recordGame(...)` and `gameRepo.recordResults(...)` async (don't block clients)
- [ ] On boot: optional dev seed script populates a test user + the existing hard-coded quiz from `data/quizzes.ts`
- [ ] Remove `data/quizzes.ts` from runtime path once seed exists

### 7. Frontend: host dashboard + editor

- [ ] `/login` page: "Sign in with Google" button; landing page redirects here when host CTA clicked and not authed
- [ ] `/host` (auth-required): list user's quizzes with rows showing title + question count + buttons `[Host]` `[Edit]` `[Delete]`; "Create new quiz" button
- [ ] `/host/quiz/new` and `/host/quiz/:id/edit`: editor form
  - Title input
  - Repeating question rows: text, 4 choice inputs, correct-choice radio, time-limit dropdown (10/15/20/30s)
  - "Add question" / "Remove" buttons
  - "Save" button → `POST` or `PUT`
- [ ] When clicking `[Host]` on a quiz, emit `create_game` with `quizId` instead of using default
- [ ] Auth state in a Svelte store; auto-fetch `/auth/me` on app boot

### 8. Update event contract

- [ ] Modify `create_game` payload type to include `quizId` (already optional today; make required server-side once DB is in)
- [ ] Optional: add `host_rejoin` event for host reconnect (mirror player path)

### 9. Test infrastructure + coverage

Following [testing.md](../testing.md). Added at start of Phase 2 since DB testing piggybacks on Postgres setup.

**Setup:**
- [ ] Add `vitest`, `@vitest/coverage-v8` to `backend/`
- [ ] Add `vitest.config.ts` with `globals: true`, `include: ['src/**/*.test.ts', 'tests/**/*.test.ts']`
- [ ] Scripts: `test`, `test:watch`, `test:coverage`
- [ ] Add `testcontainers` (dev dep) for DB integration tests
- [ ] `tests/setup.ts`: shared Postgres container lifecycle (`globalSetup`)

**Carry-over from Phase 1:**
- [ ] Unit tests for `engine.ts` (scoring, leaderboard, distribution)
- [ ] Unit tests for `lifecycle.ts` with `vi.useFakeTimers()` (transitions, rejection cases)
- [ ] Integration tests for socket flows (full gameplay, reconnect)

**New for Phase 2:**
- [ ] Repo tests against real Postgres (testcontainers): `userRepo`, `quizRepo`, `gameRepo`
- [ ] Migrations apply cleanly to fresh DB (test asserts `__drizzle_migrations` populated)
- [ ] REST endpoint tests via Fastify `light-my-request`:
  - `GET /quizzes` returns only owner's quizzes
  - `GET /quizzes/:id` for non-owner → 404 (not 403)
  - `POST /quizzes` rejects malformed body (zod 400)
  - All routes return 401 without JWT
- [ ] OAuth callback test: stub Google response → user created → JWT issued
- [ ] Game-end persistence test: full socket flow → assert rows in `games` + `game_results`

## Files to touch

```
backend/
  drizzle.config.ts                             # NEW: drizzle-kit config
  src/
    config.ts                                   # NEW: env parsing (zod)
    db/
      client.ts                                 # NEW: pg.Pool + Drizzle wrapper
      schema.ts                                 # NEW: Drizzle table definitions
      migrations/                               # NEW: generated by drizzle-kit
      repositories/
        userRepo.ts                             # NEW
        quizRepo.ts                             # NEW
        gameRepo.ts                             # NEW
    routes/
      auth.routes.ts                            # NEW
      quiz.routes.ts                            # NEW
    auth/
      google.ts                                 # NEW: @fastify/oauth2 setup
      middleware.ts                             # NEW: verifyJwt hook
    ws/index.ts                                 # MODIFY: create_game reads from DB
    services/game/lifecycle.ts                  # MODIFY: endGame writes to DB
    server.ts                                   # MODIFY: register auth + routes
    data/quizzes.ts                             # DEMOTED: only used by seed script
  scripts/
    seed.ts                                     # NEW: populate test user + quiz

frontend/
  src/
    routes/
      login/+page.svelte                        # NEW
      host/+page.svelte                         # NEW: quiz list dashboard
      host/quiz/new/+page.svelte                # NEW
      host/quiz/[id]/edit/+page.svelte          # NEW
      +page.svelte                              # MODIFY: host CTA → redirect /login if not auth'd
    lib/
      stores/auth.ts                            # NEW
      api.ts                                    # NEW: fetch wrapper with JWT
```

## Verification

1. **Schema**: `npm run db:generate` produces SQL migrations matching `schema.ts`
2. **Migrations**: `npm run db:migrate` creates all tables; `psql` confirms schema matches
3. **Seed**: `npm run db:seed` inserts a test user + the existing 5-question quiz
4. **OAuth flow**: visit `/login` → click "Sign in with Google" → redirected to Google → consent → redirected back → cookie set → `/auth/me` returns 200
5. **Editor**: at `/host`, "Create new quiz" → fill title + 3 questions → save → row appears in list
6. **Host a custom quiz**: click `[Host]` on the saved quiz → game starts with those 3 questions
7. **Persistence**: complete a game → check `games` and `game_results` tables for rows
8. **Auth gates**: hitting `/host` without a cookie → redirects to `/login`; `GET /quizzes/:id` for a quiz you don't own → 404 (not 403, to avoid leaking existence)
9. **Type checks**: `tsc --noEmit` (backend) + `svelte-check` (frontend) — both clean
10. **Smoke**: existing `scripts/smoke.mjs` continues to pass
11. **Unit tests**: `cd backend && npx vitest run` — all pass; `engine.ts` and `lifecycle.ts` covered
12. **Integration tests**: socket flow + REST + repo tests pass against testcontainers Postgres
13. **Coverage**: `npx vitest run --coverage` — pure functions ≥ 95%, lifecycle every branch hit

## Acceptance criteria

- A user can sign in, create a quiz, host a game from it, complete it, and find the game + results in Postgres.
- Existing Phase 1 functionality still works (anonymous players, real-time gameplay, scoring).
- No DB queries inside the realtime loop (verify by reading `lifecycle.ts` — should not import from `db/`).

## Reference

- [architecture.md](../architecture.md) — layer separation (where DB code goes)
- [data-model.md](../data-model.md) — Postgres schema + JSONB shape + validation rules
- [EVENTS.md](../EVENTS.md) — `create_game` payload changes
- [decisions.md](../decisions.md) — D2 (anonymous players), D5 (Postgres), D4 (editor scope)
