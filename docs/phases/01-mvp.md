# Phase 1 — Minimal playable loop

**Status**: ✅ Done
**Depends on**: nothing (greenfield)
**Goal**: A host and 2+ players play a full quiz end-to-end with time-decay scoring and a leaderboard.

## Why this phase

Validate the real-time gameplay loop before adding persistence, auth, or scale. If this doesn't work, nothing else matters.

## Deliverables (all completed)

### Shared
- [x] `@kahoot/shared` package with WebSocket event contract
- [x] `scoreAnswer(correct, timeUsedMs, limitMs)` function (server-authoritative)

### Backend
- [x] Fastify + Socket.IO bootstrap on `:3001`
- [x] In-memory `Map<gameId, GameState>` store
- [x] PIN generator (6-digit, retry on collision)
- [x] Event handlers: `create_game`, `join_game`, `start_game`, `submit_answer`, `disconnect`
- [x] Game lifecycle: `startGame`, `beginQuestion`, `endQuestion`, `endGame`
- [x] Per-game `setTimeout` for question deadlines
- [x] Hard-coded JSON quiz seed (`backend/src/data/quizzes.ts`)
- [x] Reconnect path: re-emit current `question` if game is mid-flight
- [x] `GET /health` and `GET /games/:gameId` REST endpoints
- [x] CORS configured for SvelteKit dev server

### Frontend
- [x] SvelteKit SPA (`adapter-static`, `ssr = false`)
- [x] Socket.IO client singleton
- [x] Persistent player + host sessions in `localStorage`
- [x] Routes: `/`, `/join`, `/host/[gameId]`, `/play/[gameId]`
- [x] Kahoot-style design tokens (purple→blue gradient, color-coded answer tiles, shape glyphs)
- [x] Live countdown bar + per-question timer
- [x] Answer-distribution histogram on reveal
- [x] Leaderboard between questions
- [x] Final podium screen
- [x] Stale-game detection (host page checks `/games/:gameId` on mount)

### Verification
- [x] Backend `tsc --noEmit` clean
- [x] Frontend `svelte-check` clean (0 errors, 0 warnings)
- [x] E2E smoke: `node backend/scripts/smoke.mjs` runs a full 5-question game with 2 simulated players; scores match expected time-decay math
- [x] Manual: 2 browser tabs (host + player), full game playthrough

## Test backlog (carries into Phase 2 setup)

Phase 1 shipped with smoke + type checks only. The full test suite (per [testing.md](../testing.md)) is added at the start of Phase 2 since DB testing infrastructure goes in there too.

Carry-over items:
- [ ] Add Vitest config + scripts to backend
- [ ] Unit tests for `engine.ts` (`scoreAnswer`, `topLeaderboard`, `answerDistribution`)
- [ ] Unit tests for `lifecycle.ts` (state transitions, recordAnswer rejection cases) — using fake timers
- [ ] Integration test for full socket flow (driving a real `socket.io-client` against a real server)
- [ ] Integration test for reconnect path re-emitting current question

## Files created

```
shared/src/index.ts                                       # event contract
backend/src/server.ts                                     # bootstrap
backend/src/ws/index.ts                                   # event handlers
backend/src/services/game/engine.ts                       # GameState + pure helpers
backend/src/services/game/lifecycle.ts                    # start/begin/end/score
backend/src/services/game/store.ts                        # in-memory Map
backend/src/data/quizzes.ts                               # hard-coded seed
backend/scripts/smoke.mjs                                 # E2E test driver
frontend/src/routes/+page.svelte                          # landing
frontend/src/routes/join/+page.svelte
frontend/src/routes/host/[gameId]/+page.svelte
frontend/src/routes/play/[gameId]/+page.svelte
frontend/src/lib/socket.ts
frontend/src/lib/stores/{player,host}.ts
frontend/src/app.css                                      # design tokens
```

## Out of scope (intentional)

- Persistence (no DB)
- Authentication (host gets opaque `hostToken` only)
- Quiz authoring (hard-coded JSON seed)
- Multi-instance / Redis
- Reconnect for host
- Mobile-specific layouts
- Confetti / animations beyond fade-in

## Recent fixes (post-Phase-1 ship)

- Removed `pattern="\d{6}"` on PIN inputs (was triggering browser native validation popup) → digits sanitized via `oninput`
- `timeLeftMs` now initialized from `deadlineMs` immediately on `question` event (was showing "0s" for 100ms)
- Backend re-emits `question` in reconnect path (covers events dropped during SPA navigation)
- `GET /games/:gameId` endpoint + host stale-game UI (covers `tsx watch` restart wiping in-memory state during dev)
- `.card` CSS class forces `color: var(--ink)` (white-on-white text on game-over and player question-text card)
- Question text card added to player screen (was Kahoot-style host-only; confusing for remote web play)
