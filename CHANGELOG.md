# Changelog

All notable changes to this project are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is date-based until first release; once Phase 3 deploys, switch to [SemVer](https://semver.org/).

Categories: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, **Security**.

## [Unreleased]

### Added
- `CHANGELOG.md` — this file. All future changes land here under `[Unreleased]` until a release is cut.
- **Phase 2: Postgres + Google OAuth + Quiz editor**
  - Drizzle ORM schema for `users`, `quizzes`, `games`, `game_results` (`backend/src/db/schema.ts`)
  - Initial Drizzle migration (`backend/src/db/migrations/0000_*.sql`)
  - Repositories: `userRepo`, `quizRepo`, `gameRepo` (`backend/src/db/repositories/`)
  - Google OAuth flow via `@fastify/oauth2`; JWT issued in HTTP-only cookie
  - Auth routes: `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/logout`, `GET /auth/me`
  - Quiz CRUD REST routes: `GET/POST/PUT/DELETE /quizzes` (owner-scoped, zod-validated, 404 not 403 for non-owner)
  - Frontend `/login` page with Google sign-in button
  - Frontend `/host` quiz dashboard (list / host / edit / delete)
  - Frontend quiz editor at `/host/quiz/new` and `/host/quiz/:id/edit` (shared `QuizEditor.svelte` component)
  - `gameRepo.recordGame` + `gameRepo.recordResults` write game history at `game_end` (off-the-realtime-loop)
  - Vitest + Testcontainers setup (`backend/vitest.config.ts`, `backend/tests/global-setup.ts`)
  - Unit tests for `engine.ts` and `lifecycle.ts`; integration tests for `userRepo`, `quizRepo`, `gameRepo`
  - Idempotent seed script (`backend/scripts/seed.ts`)
  - `Question` and `Quiz` types exported from `@kahoot/shared`
  - Socket.IO handshake middleware decodes JWT cookie → `socket.data.user`

### Changed
- `create_game` payload `quizId` is now required for non-default quizzes; DB-backed quizzes verify owner
- `/auth/me` returns the user object directly (was nested under `{ user }`)
- Backend `data/quizzes.ts` is now a fallback / seed source only — no longer the authoritative quiz list

### Fixed
- Various Phase 2 review fixes before commit: type-check passes, no `as any` in WS create_game, quiz list shows correct question count, Vitest containers start once per run (not per file)

## [2026-04-30]

### Added
- Per-phase self-contained action plans: `docs/phases/01-mvp.md`, `02-persistence-auth-editor.md`, `03-polish-deploy.md`, `04-meet-addon.md`, `deferred-redis.md`
- `docs/testing.md` — pyramid strategy, Vitest + Testcontainers, anti-patterns
- `docs/decisions.md` D8 (Drizzle ORM + raw SQL escape-hatch policy) and D9 (Vitest + Testcontainers; no frontend component tests in MVP)
- `docs/architecture.md` — DB access conventions (mixed Drizzle / raw SQL)
- `GEMINI.md` — forwards Gemini CLI to `CLAUDE.md`
- Phase 2 plan now includes quiz editor (title + N questions, `/host` dashboard, `/host/quiz/new`, `/host/quiz/:id/edit`)
- Phase 2 plan includes test infrastructure setup (Vitest, Testcontainers, repo + REST + OAuth + persistence tests)
- Phase 3 plan adds CI section (GitHub Actions: type check, svelte-check, vitest)

### Changed
- Roadmap renumbered: Redis is **deferred** (no phase number); Postgres + Google OAuth + Quiz editor is now **Phase 2**; UX polish + deploy is **Phase 3**; Google Meet add-on is **Phase 4**
- ORM choice locked to **Drizzle** (was undecided); raw `pg` available as escape hatch via `db.execute(sql\`...\`)`
- `README.md` Stack: Node 20 → **Node 24** (machine runs v24.1.0; Node 20 LTS EOL April 2026)
- `README.md` Docs section split into Start-here / Reference / Per-phase
- `CLAUDE.md` updated to reflect new phase numbering, testing commands, and Phase 2 starting points

## [2026-04-29] — Phase 1 ship

### Added
- Monorepo scaffold: `shared/` (event contract + scoring), `backend/` (Fastify + Socket.IO), `frontend/` (SvelteKit SPA)
- `@kahoot/shared` event contract (`ClientToServerEvents`, `ServerToClientEvents`, `scoreAnswer`)
- Backend game engine: `engine.ts` (pure helpers), `lifecycle.ts` (start/begin/end/score), `store.ts` (in-memory `Map`)
- Backend WS handlers: `create_game`, `join_game`, `start_game`, `submit_answer`, `disconnect`
- Backend REST: `GET /health`, `GET /games/:gameId`
- Hard-coded JSON quiz seed (`backend/src/data/quizzes.ts`, 5 questions)
- Frontend routes: `/`, `/join`, `/host/[gameId]`, `/play/[gameId]`
- `playerSession` + `hostSession` Svelte stores backed by `localStorage` for reconnect
- Kahoot-style design tokens, countdown bar, answer-distribution histogram, leaderboard, podium screen
- E2E smoke driver: `backend/scripts/smoke.mjs` (1 host + 2 players, full 5-question game)

### Fixed
- Removed `pattern="\d{6}"` on PIN inputs — was triggering native browser validation popup; now sanitized via `oninput`
- `timeLeftMs` initialized from `deadlineMs` immediately on `question` event (was showing `0s` for ~100ms)
- Backend re-emits `question` in reconnect path so SPA navigation gaps don't drop the active question
- `GET /games/:gameId` + host stale-game UI handles `tsx watch` restarts wiping in-memory state during dev
- `.card { color: var(--ink) }` — fixes white-on-white text on game-over screen and player question card
- Question text card added to player screen (was host-only Kahoot-style; confusing for remote web play)

## How to update this file

- Append every meaningful change to `[Unreleased]` in the same PR/commit as the change.
- On release, rename `[Unreleased]` to `[YYYY-MM-DD]` (or version) and start a fresh `[Unreleased]` block above it.
- Don't log: typo fixes in this file, internal refactors with no behavior change, dependency bumps without observable effect.
- Do log: new features, removed features, behavior changes, schema changes, deploy/infra changes, bug fixes users would notice.
