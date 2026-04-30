# Architecture

## High-level diagram

```
                 ┌────────────────────────────────┐
                 │  Browser (SvelteKit SPA)       │
                 │  - Landing / Join page         │
                 │  - Player gameplay screen      │
                 │  - Host dashboard              │
                 │  - (Phase 2) Quiz editor       │
                 └─────────────┬──────────────────┘
                               │ Socket.IO (WS) + REST
                               │
                 ┌─────────────▼──────────────┐
                 │  Load Balancer             │  ← only when multi-instance
                 │  (sticky sessions)         │
                 └─────────────┬──────────────┘
                               │
                 ┌─────────────▼──────────────┐
                 │  Node API                  │
                 │  Fastify + Socket.IO       │
                 └─────┬──────────────┬───────┘
                       │              │
                       │              │
        ┌──────────────▼─────┐    ┌───▼────────────┐
        │ in-memory Map      │    │ PostgreSQL     │
        │ (game state)       │    │ users          │  ← Phase 2
        │ ↓ Redis when scale │    │ quizzes        │
        │   demands          │    │ games          │
        └────────────────────┘    │ game_results   │
                                  └────────────────┘
```

## Layer separation (strict)

| Layer | Path | Responsibility | Don't put here |
|---|---|---|---|
| Transport | `backend/src/ws/` | Socket event registration, rooms, session tracking, connection lifecycle | Game logic, scoring, DB calls |
| Game engine | `backend/src/services/game/engine.ts` | Pure functions over `GameState` (scoring, leaderboard, distribution) | Side effects, DB, sockets |
| Game lifecycle | `backend/src/services/game/lifecycle.ts` | Side-effecting flow: `startGame`, `beginQuestion`, `recordAnswer`, `endQuestion`, `endGame` | DB calls in the realtime loop |
| State boundary | `backend/src/services/game/store.ts` | CRUD over game state. **Currently in-memory `Map`. Only file that swaps to Redis later.** | Anything other than CRUD |
| Persistence | `backend/src/db/` (Phase 2) | Users, quizzes, game history | Realtime hot-path queries |
| Routes | `backend/src/routes/` (Phase 2) | REST: auth, quiz CRUD, health | Game logic |
| Shared types | `shared/src/index.ts` | WebSocket event contract + scoring fn | Anything not used by both backend and frontend |

## Frontend conventions

- SvelteKit with `adapter-static`, `ssr = false`, `prerender = false` globally
- One Socket.IO singleton in `frontend/src/lib/socket.ts` — never create another
- `playerSession` and `hostSession` stores persist to `localStorage` for reconnect
- `.card` class always white background + dark text; don't override `color` inside cards
- Design tokens in `frontend/src/app.css` (`--brand`, `--ink`, `--c-red`, etc.)

## Backend conventions

- TypeScript strict mode; no `any`
- Use shared event types from `@kahoot/shared` — don't redeclare event shapes
- Server is authoritative for time (`questionStartedAt`, `questionDeadlineAt`); ignore client `clientTs` for scoring
- DB writes happen at `game_end` only; reads at `create_game` only — never in the per-answer loop
- Socket.IO rooms: `game:{gameId}` for everyone, `host:{gameId}` for host-only

### Database access (Phase 2+)

- **Default**: Drizzle typed builder in `backend/src/db/repositories/*.ts`
- **Escape hatch**: raw SQL via `db.execute(sql\`...\`)` for complex aggregations, bulk ops, JSON ops, or perf-critical queries — see [decisions.md D8](decisions.md#d8--drizzle-orm-over-prisma--kysely--raw-pg) for triggers
- **Always parameterize** raw SQL — never string-interpolate user input
- **Annotate raw queries** with a short comment explaining why raw was chosen (audit trail)
- **Same pool, same transactions** — Drizzle and raw SQL share the underlying `pg.Pool`

## Concurrency

**Current (single-process):** No locks needed — JS event loop serializes access to the in-memory `Map`.

**If multi-instance later:** see [phases/deferred-redis.md](phases/deferred-redis.md) for lock + sweep design.

## Performance rules

- Never touch Postgres in the realtime loop
- `question` event omits the correct answer (cheating vector)
- `leaderboard_update` capped at top 10
- Use `deadlineMs` (server epoch) — clients render countdowns locally; server doesn't tick to clients
- Use Socket.IO rooms (`io.to('game:{id}').emit(…)`) — single fan-out per event
