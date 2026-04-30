# Deferred — Redis multi-instance scaling

**Status**: ⏸ Deferred (not a numbered phase)
**Triggers**: see "When to start" below
**Goal**: Game state survives backend restarts and gameplay scales horizontally across multiple Node instances.

## Why deferred

A single Node process running Socket.IO comfortably handles **1k–3k concurrent connections**. Most quiz apps never hit that. Adding Redis prematurely:

- Adds operational complexity (more services to monitor, secure, back up)
- Adds dev friction (Redis container in `docker-compose`, harder local setup)
- Costs more money (Redis hosting isn't free at production scale — Upstash free tier has 10k commands/day cap)

Single-instance failure mode (lost games on restart) is acceptable for MVP. Mitigated by host-page stale-game UI.

## When to start

Trigger this phase when **any** of:

- Sustained > 500 concurrent connections per instance
- Multi-region deployment becomes a product requirement
- SLO target moves above "best effort" (e.g., 99.5% uptime committed)
- Backend restarts during games becomes user-visible pain
- Single instance hits CPU > 70% during peak

## Out of scope (even when triggered)

- Sharding across multiple Redis clusters (one Redis instance is plenty for our scale)
- Cross-region active-active (single-region is fine)
- Persistent storage of in-flight games beyond Redis TTL — when Redis dies, ongoing games die with it (acceptable)

## Deliverables

### 1. Redis client + adapter

- [ ] Add `ioredis` and `@socket.io/redis-adapter`
- [ ] `backend/src/state/redis.ts` exports two clients (one for adapter pub/sub, one for app data)
- [ ] Wire adapter into Socket.IO server: `io.adapter(createAdapter(pubClient, subClient))`

### 2. Replace in-memory store

- [ ] `backend/src/services/game/store.ts` becomes Redis-backed CRUD
- [ ] All public functions keep the same signatures — engine + lifecycle code unchanged

### 3. Redis schema

```
game:{gameId}                  JSON blob (gameId, hostToken, hostSocketId, quiz,
                               status, currentQuestionIndex, questionStartedAt,
                               questionDeadlineAt, createdAt)
game:{gameId}:players          HASH playerId → JSON {nickname, score, connected,
                               joinedAt, socketId, disconnectedAt}
game:{gameId}:answers:{qIdx}   HASH playerId → JSON {choice, submittedAt, scoreEarned}
game:{gameId}:lock             string (SET NX EX 5)
```

TTL: `EXPIRE game:{gameId} 21600` (6h) on every write to the JSON blob; cascades to subkeys via cleanup task.

### 4. Locking

- [ ] `backend/src/state/locks.ts` exports `withLock(gameId, fn)`:
  - `SET game:{gameId}:lock <nonce> NX EX 5`
  - On acquire: run `fn`, then `DEL` (with Lua to verify nonce — prevent stomping)
  - On miss: retry 3× with exponential backoff (10ms, 30ms, 100ms)
- [ ] All state transitions in `lifecycle.ts` wrapped in `withLock`
- [ ] Answer submission uses `HSETNX` (no lock needed — single field write is atomic)
- [ ] Score updates use Redis pipeline at `endQuestion`: `HGETALL` answers, compute scores in JS, batch `HINCRBY` per player

### 5. Question advancement ownership

- [ ] Worker that handled `start_game` owns the per-game timer (`setTimeout`)
- [ ] On timer fire: `withLock` to advance state
- [ ] **Sweep job on every worker** runs every 1s:
  - Scan `game:*` keys for `status === 'in_question'` and `questionDeadlineAt < now()`
  - For each, `withLock` and advance — covers worker death case
- [ ] Sweep also expires lobbies idle > 10min

### 6. Multi-instance verification

- [ ] `docker-compose.yml`: postgres + redis + 2× backend (different ports) + nginx (sticky sessions, round-robin)
- [ ] Smoke test: kill one backend mid-game; clients on the other backend continue
- [ ] `redis-cli MONITOR` shows pub/sub fan-out

### 7. Operational

- [ ] Redis health check in `/health` endpoint
- [ ] Connection retry / circuit breaker on Redis flap (ioredis defaults are fine)
- [ ] Production: Upstash or Fly Redis (single 256MB instance is plenty)

## Files to touch

```
backend/
  src/
    state/
      redis.ts                                  # NEW: ioredis clients
      locks.ts                                  # NEW: withLock helper
    services/game/
      store.ts                                  # REWRITE: in-memory → Redis
      lifecycle.ts                              # MODIFY: wrap state transitions in withLock
      scheduler.ts                              # NEW: sweep job
    server.ts                                   # MODIFY: register Redis adapter, start sweep
  package.json                                  # ADD: ioredis, @socket.io/redis-adapter

docker-compose.yml                              # NEW or MODIFY
nginx.conf                                      # NEW: sticky sessions + round-robin
```

## Verification

1. Locally: `docker-compose up` brings up postgres + redis + 2 backends + nginx
2. Run `node backend/scripts/smoke.mjs` against `http://localhost:8080` (nginx) — passes
3. During smoke run: `docker kill backend-1` → smoke continues without error (clients on backend-2 unaffected)
4. Manually: open host on browser-1 (sticks to backend-1), player on browser-2 (sticks to backend-2) → events flow correctly
5. `redis-cli` shows expected key shapes
6. Memory leak check: run 100 sequential games, verify Redis keys for completed games expire correctly

## Acceptance criteria

- 2+ backend instances serve games interchangeably
- Backend restart does not lose in-flight games (state persists in Redis)
- Worker death is recovered by sweep within 1s
- All Phase 1–3 functionality unchanged from user perspective

## Reference

- [architecture.md](../architecture.md) — concurrency model section
- [decisions.md](../decisions.md) — D3 (why we deferred this)
- [Socket.IO Redis adapter docs](https://socket.io/docs/v4/redis-adapter/)
