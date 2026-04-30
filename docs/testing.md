# Testing strategy

Pragmatic, not religious. Test what's risky and reusable; trust types for the rest.

## Pyramid

```
        E2E smoke         ← 1-2 tests, full game flow
       ──────────
      Integration         ← per-feature: socket flows, REST endpoints, DB
     ──────────────
        Unit              ← pure functions: scoring, leaderboard, validators
   ────────────────
        Types             ← TypeScript strict mode catches half the bugs
```

## Tools

| Layer | Tool | Why |
|---|---|---|
| Unit + Integration (backend) | **Vitest** | Fast, native ESM, TypeScript out of the box, watch mode, same DX as Vite |
| DB integration (Phase 2+) | **Testcontainers** | Real Postgres in Docker per test run; no mocks |
| Socket integration | **`socket.io-client` driving a real server in `beforeAll`** | Use the actual transport; mocks lie |
| E2E smoke | **`backend/scripts/smoke.mjs`** | Already exists; run pre-release |
| Frontend | **Manual + 2-tab playthrough** | Component tests not worth the overhead for MVP — type checks + e2e cover most |
| API contract | **Vitest + `light-my-request`** (Fastify built-in) | In-process HTTP testing, no real port |

## What to test (and what to skip)

### ✅ Test these

- **Pure functions** in `engine.ts` and `shared/src/index.ts`
  - `scoreAnswer` — boundary cases (`t=0`, `t=limit`, `t > limit`, wrong answer)
  - `topLeaderboard` — tie-breaking, empty player set
  - `answerDistribution` — empty hash, all players answered same choice
- **Lifecycle transitions** in `lifecycle.ts`
  - `startGame` from non-lobby state is a no-op
  - `recordAnswer` rejects late/duplicate/wrong-question
  - `endQuestion` advances to next question or ends game
  - Score totals match per-question earned scores
- **Socket flows** (integration)
  - Full game: create → join × N → start → questions → end
  - Reconnect with stored `playerId` resyncs current question
  - `start_game` with wrong `hostToken` returns `forbidden`
- **REST endpoints** (Phase 2+)
  - Auth gates: 401 without JWT
  - Ownership gates: 404 on someone else's quiz (not 403)
  - zod validation rejects malformed quiz bodies
- **DB queries** (Phase 2+)
  - Repos against real Postgres via testcontainers
  - Migrations run cleanly from empty DB

### ❌ Skip these

- Mocked unit tests of socket handlers — rebuild reality just to test it. Use integration instead.
- Snapshot tests of Svelte components — high churn, low signal.
- 100% coverage targets — incentivizes useless tests.
- Tests for getter/setter glue, types-only utilities, third-party library wrappers.
- E2E browser automation (Playwright) for MVP — too much maintenance for our stage.

## Coverage targets

No hard %. Aim for:

- **Pure functions**: 100% line coverage (they're easy)
- **Lifecycle functions**: every branch hit
- **Repos**: happy-path + auth/ownership rejections
- **Hot bugs**: a regression test for every reproduced bug

If a PR fixes a bug, add a test that fails before the fix and passes after.

## Test layout

```
backend/
  src/
    services/game/
      engine.test.ts                 # unit
      lifecycle.test.ts              # unit (with fake timers)
    db/
      repositories/
        quizRepo.test.ts             # integration (testcontainers)
    routes/
      quiz.routes.test.ts            # integration (light-my-request)
  tests/
    integration/
      gameplay.test.ts               # full socket flow
      reconnect.test.ts
    setup.ts                         # vitest globalSetup
  vitest.config.ts
  scripts/
    smoke.mjs                        # E2E (kept as-is)

shared/
  src/
    index.test.ts                    # scoreAnswer + types contract

frontend/                            # no test framework added in MVP
  (manual + svelte-check)
```

## Running tests

```bash
# all
npm test

# backend only, watch mode
cd backend && npx vitest

# integration only
cd backend && npx vitest tests/integration

# DB tests (requires Docker)
cd backend && npx vitest db
```

## CI expectations (Phase 3)

- Run `tsc --noEmit`, `svelte-check`, all `vitest` suites on every PR
- DB tests use testcontainers in CI (Docker layer caching)
- Block merge on red

## Anti-patterns to avoid

- **Mocking the socket server** instead of running it. Real Socket.IO is fast enough — mocks miss timing/order bugs.
- **Sleeping in tests** to wait for events. Use Vitest's `vi.useFakeTimers()` + manual advance, or await event promises with timeouts.
- **Sharing state between tests**. Each test gets a fresh `GameState` / fresh DB schema.
- **Testing the framework**. Don't write tests asserting Fastify routes a path correctly — assume the framework works.
