# Quizzr — real-time multiplayer quiz

Kahoot-style quiz game. Host creates a game, players join via 6-digit PIN, questions broadcast in real-time, time-decay scoring, leaderboard updates after each round.

## Stack

- **Backend**: Node 24 + TypeScript + Fastify + Socket.IO
- **Frontend**: SvelteKit (SPA mode, `adapter-static`)
- **Persistence (Phase 2+)**: PostgreSQL + Google OAuth
- **State**: in-memory `Map` (Redis swap deferred until scaling demands)

## Quick start

```bash
# install once
npm install

# terminal 1 — backend on :3001
cd backend && npm run dev

# terminal 2 — frontend on :5173
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). One tab as host (click "Host a new game"), one or more tabs as players (enter PIN + nickname).

### Smoke test (headless)

```bash
cd backend && node scripts/smoke.mjs
```

Drives a full game with 2 simulated players.

## Project layout

```
kahoot-clone/
├── shared/              # @kahoot/shared — event contract + scoring fn
│   └── src/index.ts
├── backend/
│   ├── src/
│   │   ├── server.ts                     # Fastify + Socket.IO bootstrap
│   │   ├── ws/index.ts                   # Socket event handlers
│   │   ├── services/game/
│   │   │   ├── engine.ts                 # GameState + pure helpers
│   │   │   ├── lifecycle.ts              # startGame, beginQuestion, recordAnswer, endQuestion
│   │   │   └── store.ts                  # in-memory Map (→ Redis if scale demands)
│   │   ├── data/quizzes.ts               # hard-coded JSON quiz seed
│   │   └── types/quiz.ts
│   └── scripts/smoke.mjs                 # E2E test driver
├── frontend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte              # landing (PIN input + host button)
│   │   │   ├── join/+page.svelte         # nickname + PIN entry
│   │   │   ├── host/[gameId]/+page.svelte
│   │   │   └── play/[gameId]/+page.svelte
│   │   ├── lib/
│   │   │   ├── socket.ts                 # Socket.IO client singleton
│   │   │   └── stores/                   # player + host session (localStorage)
│   │   ├── app.css                       # design tokens + utilities
│   │   └── app.html
│   └── svelte.config.js
└── docs/
    ├── PLAN.md                           # architecture + roadmap + decisions
    └── EVENTS.md                         # WebSocket event reference
```

## Docs

Start here:

- [`CLAUDE.md`](CLAUDE.md) — instructions for AI coding agents (read this first)
- [`docs/PLAN.md`](docs/PLAN.md) — master plan + roadmap with links to per-phase docs

Reference:

- [`docs/architecture.md`](docs/architecture.md) — diagram, layer separation, conventions
- [`docs/data-model.md`](docs/data-model.md) — game state shape, Postgres schema, Redis schema
- [`docs/EVENTS.md`](docs/EVENTS.md) — WebSocket event contract
- [`docs/testing.md`](docs/testing.md) — testing strategy, tools, what to test/skip
- [`docs/decisions.md`](docs/decisions.md) — ADR-style decisions log

Per-phase action plans (each is self-contained — agents pick one and execute):

- [`docs/phases/01-mvp.md`](docs/phases/01-mvp.md) — Phase 1 (done)
- [`docs/phases/02-persistence-auth-editor.md`](docs/phases/02-persistence-auth-editor.md) — Phase 2 (next)
- [`docs/phases/03-polish-deploy.md`](docs/phases/03-polish-deploy.md) — Phase 3
- [`docs/phases/04-meet-addon.md`](docs/phases/04-meet-addon.md) — Phase 4
- [`docs/phases/deferred-redis.md`](docs/phases/deferred-redis.md) — Redis swap (deferred)
