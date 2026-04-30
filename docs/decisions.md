# Decisions log

ADR-style. Why we picked X over Y. Append new decisions; don't rewrite history.

---

## D1 — Socket.IO over Ably (and raw WebSocket)

**Date**: 2026-04-28
**Status**: Locked

**Decision**: Use Socket.IO for transport.

**Why not Ably**:
- Pay-per-message + per-connection model. Free tier (6M msgs/mo, 200 connections) easy to outgrow once popular.
- Ack/RPC pattern messier — Socket.IO `emit(event, data, cb)` is clean. Ably is pub/sub; req/resp would need separate REST or hand-rolled channels.
- Game logic stays on our backend regardless — Ably only saves transport.

**Why not raw WebSocket**:
- No built-in rooms, ack callbacks, reconnection, transport fallback. Reinventing Socket.IO.

**Trade-off accepted**: We hand-roll Redis pub/sub adapter when/if multi-instance.

---

## D2 — Anonymous players, OAuth for hosts only

**Date**: 2026-04-28
**Status**: Locked

**Decision**: Players join with a nickname only (no account). Hosts authenticate via Google OAuth.

**Why**:
- Players need zero friction to join — Kahoot UX standard.
- Hosts need persistent quiz storage and game history — accounts justified.

**Implication**: `game_results` table stores `player_nickname` as a free-text field, no FK.

---

## D3 — In-memory game state for MVP, Redis deferred

**Date**: 2026-04-28
**Status**: Locked (revisit when concurrent users justify it)

**Decision**: Phase 1 stores game state in a Node `Map`. Redis swap deferred indefinitely.

**Why**:
- One Node process handles 1k–3k concurrent connections easily.
- Premature horizontal scaling = wasted dev cycles.
- Single point of failure is acceptable for MVP — game session loss is non-catastrophic (replay another).

**Trigger to revisit**: any of:
- Sustained > 500 concurrent connections per instance
- Need for multi-region deployment
- SLO requirements > "best effort"

**Cost of deferring**: backend restart wipes all live games. Mitigation: host page detects via `GET /games/:gameId` 404 and shows "session expired" UI.

---

## D4 — JSON seed quizzes for Phase 1, simple editor in Phase 2, rich editor never (for now)

**Date**: 2026-04-28
**Status**: Locked

**Decision**: No quiz authoring UI in Phase 1. Phase 2 ships a minimal editor (title + per-question rows). Rich media/drag-reorder/collaborative editing not on the roadmap.

**Why**:
- Phase 1 needs to validate the realtime gameplay loop, not the authoring flow.
- Minimal editor in Phase 2 piggybacks on DB schema + auth already being added.
- Rich editor is a category-leader feature; defer until product-market fit.

---

## D5 — Postgres over MongoDB / Firestore / Supabase

**Date**: 2026-04-28
**Status**: Locked

**Decision**: PostgreSQL via `pg` or Kysely (TBD in Phase 2 implementation).

**Why**:
- Strong consistency for game results.
- JSONB for `quizzes.questions` gives schemaless flexibility where it's needed.
- Free hosting via Neon (3GB) — same cost as Firestore at our scale.
- No vendor lock-in.

**Why not Firestore**: pricing scales with reads/writes; one popular game = surprise bill.

**Why not Supabase**: Postgres under the hood anyway; we don't need their realtime layer (we have Socket.IO).

---

## D6 — SvelteKit SPA mode (not SSR)

**Date**: 2026-04-28
**Status**: Locked

**Decision**: `adapter-static` with `ssr = false`, `prerender = false`.

**Why**:
- Gameplay is fully client-side after initial load.
- No SEO requirement.
- Static SPA hosts free on Cloudflare Pages / Vercel.
- SSR adds complexity without benefit for a websocket app.

---

## D7 — 6-digit numeric PINs

**Date**: 2026-04-28
**Status**: Locked

**Decision**: Game IDs are 6-digit numeric PINs (e.g., `290195`).

**Why**:
- Easy to type on mobile (numeric keyboard).
- Familiar to users (Kahoot pattern).
- 900k namespace is plenty for concurrent active games at our scale.
- Collisions handled by `SET NX` retry (up to 5×).

**Trade-off**: PINs are guessable in a dictionary attack at high concurrency. Acceptable for MVP — game lobbies expire in 6h and don't expose sensitive data.

---

## D8 — Drizzle ORM over Prisma / Kysely / raw `pg`

**Date**: 2026-04-29
**Status**: Locked

**Decision**: Use Drizzle ORM for Postgres access in Phase 2.

**Why not Prisma**:
- Query-engine binary adds ~40–50MB → slow cold start on Fly.io free tier (256MB shared-CPU machines)
- Required `prisma generate` codegen step adds friction
- Overkill for our 4-table schema
- Pricing model nudges toward Accelerate/Pulse paid services

**Why not Kysely**:
- Excellent query builder, but no schema-first ergonomics — schema types declared separately
- Drizzle's schema-as-source-of-truth is a better fit for a small, tightly-scoped DB

**Why not raw `pg`**:
- Manual `RowType` interfaces drift from schema → bugs
- Hand-rolled migration tooling adds maintenance burden
- Field name typos slip past compile

**Why Drizzle**:
- TypeScript schema is the source of truth; queries auto-typed from it
- No runtime codegen — types resolved at compile time
- Tiny runtime (~30KB) — fast cold start
- Native JSONB support: `quizzes.questions` types as `Question[]` in TS
- `drizzle-kit` generates SQL migrations from schema diffs
- Close to SQL — low lock-in if we ever swap

**Trade-offs accepted**:
- Less mature ecosystem than Prisma (fewer tutorials, smaller community)
- Some advanced query patterns require dropping to SQL templates
- Newer project — API surface still evolving (we accept occasional minor breaking changes)

**Mixed-style policy** (raw SQL escape hatch):

Drizzle is not a hard wall. Use the typed builder by default; drop to raw SQL via `db.execute(sql\`...\`)` (or `db.$client.query()` for the underlying `pg.Pool`) when warranted. Same connection pool, same transaction boundaries — no second driver.

Triggers for raw SQL:
- Complex aggregations (window functions, percentile/rank, multi-level CTEs)
- Bulk operations (`INSERT ... ON CONFLICT`, `COPY`, multi-row update with subquery)
- DB-side JSON operations on `quizzes.questions` (e.g., `jsonb_array_length`)
- Hot-path queries where `EXPLAIN ANALYZE` shows the builder's plan is suboptimal
- Anything the builder doesn't express cleanly in < 5 lines

Convention:
- Builder queries live in `repositories/*.ts` as plain methods
- Raw-SQL queries live in the same files but tagged with a comment explaining why raw was chosen — keeps the audit trail visible
- Always parameterize (`sql\`... ${value} ...\``) — never string-interpolate user input

## D9 — Vitest + Testcontainers; pyramid-style coverage; no frontend component tests in MVP

**Date**: 2026-04-30
**Status**: Locked

**Decision**: Backend tests use Vitest. DB integration tests use Testcontainers. Frontend relies on type checks + manual + E2E smoke. Coverage targets per-layer, not aggregate.

**Why Vitest over Jest**:
- Native ESM + TypeScript, no Babel layer
- Faster cold start; same config/DSL as Vite (we already use Vite)
- Built-in watch mode that doesn't choke on monorepos

**Why Testcontainers over a mocked DB**:
- Mocks lie about query plans, JSONB behavior, FK cascades
- Real Postgres in Docker per test run is fast enough (< 5s startup)
- Same query path as production

**Why no frontend component tests in MVP**:
- Svelte components in this app are thin — mostly markup + a few stores
- Type checks (`svelte-check`) catch most issues
- Manual 2-tab playthrough catches UX bugs that unit tests would miss anyway
- Add component tests in Phase 3+ only if regression rate justifies it

**Why no coverage % target**:
- Aggregate % rewards trivial tests. Per-layer judgment ("every lifecycle branch hit", "every endpoint has auth + ownership tests") gives better signal.

**Trade-offs accepted**:
- No protection against pure CSS/visual regressions until Phase 3 polish
- Some integration tests will be slower than equivalent mocked unit tests — acceptable for the realism gain

See [testing.md](testing.md) for the full strategy.

## Adding a new decision

Use this template:

```
## D{n} — Title

**Date**: YYYY-MM-DD
**Status**: Locked | Reversible | Superseded by D{m}

**Decision**: One sentence.

**Why**: Bullets.

**Trade-offs accepted**: What we gave up.
```
