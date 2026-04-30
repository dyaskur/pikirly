# Phase 3 — UX polish + deploy

**Status**: 🔜
**Depends on**: Phase 2 done
**Goal**: A polished, mobile-first version of the app is live on a real domain with real users able to play.

## Why this phase

Phase 2 makes it functional. Phase 3 makes it shippable. Polish lands now (not earlier) so we don't iterate on UI that might be thrown away.

## Out of scope (intentional)

- Custom domain email
- Stripe / monetization
- Analytics beyond basic page views
- Internationalization
- Accessibility audit (basic ARIA only)
- Native mobile apps

## Deliverables

### 1. UX polish

- [ ] Final podium screen: top 3 with confetti animation (use `canvas-confetti` ~2KB gzipped)
- [ ] Reconnection toast: top-of-screen banner during socket disconnect with auto-rejoin
- [ ] Live answer-count indicator on host screen ("32/45 answered")
- [ ] Color-hash avatars for players in lobby (deterministic from nickname)
- [ ] Mobile-first responsive pass: lobby, gameplay, reveal, podium all readable on 375×667
- [ ] Loading states: spinners on all async actions
- [ ] Friendly empty state on `/host` when no quizzes ("Create your first quiz")
- [ ] Form validation feedback inline (not just toasts)
- [ ] Question-end reveal: animate the correct-answer tile (pulse / scale)

### 2. Game-flow polish

- [ ] Host can "skip" question early (advance reveal manually)
- [ ] Host can "kick" a misbehaving player from lobby
- [ ] Show countdown ring on player screen (visual countdown, not just text)
- [ ] Sound effects (optional toggle): question-start tick, correct chime, wrong buzz

### 3. Production readiness

- [ ] Pino structured logging with request IDs
- [ ] Graceful shutdown: drain Socket.IO connections before exit
- [ ] Rate limiting on auth + REST routes (`@fastify/rate-limit`)
- [ ] Helmet for security headers (`@fastify/helmet`)
- [ ] CORS: lock to production domain only (env-driven)
- [ ] Environment-based config: dev vs prod
- [ ] Health endpoint includes DB ping
- [ ] Database connection retry on boot (Postgres might not be ready immediately)

### 4. Deploy

- [ ] **Backend**: Fly.io (free tier: 3 shared VMs × 256MB) — single instance is fine
  - `fly.toml` with `internal_port = 3001`
  - Min 1 machine running (don't auto-stop — kills active games)
  - Persistent volume not needed (state in Postgres + memory)
- [ ] **Postgres**: Neon free tier (3GB) — connection pooler enabled
  - Migrations run via CI or one-shot `flyctl ssh`
- [ ] **Frontend**: Cloudflare Pages or Vercel free
  - Build: `npm run build` in `frontend/` → static output in `.svelte-kit/output/client`
  - Set `VITE_BACKEND_URL` to production backend URL at build time
- [ ] **Domain**: $10/yr (e.g., `quizzr.app`)
  - DNS A/CNAME → Cloudflare Pages
  - Subdomain `api.quizzr.app` → Fly.io app
- [ ] **Google OAuth**: register production redirect URI
- [ ] **Smoke test in prod**: 3 devices, full game

### 5. CI

- [ ] GitHub Actions workflow on every PR + push to main:
  - `npm ci`
  - `tsc --noEmit` (backend)
  - `svelte-check` (frontend)
  - `vitest run` with Docker-in-CI for testcontainers Postgres
  - Layer caching for faster runs
- [ ] Block merge on red

### 6. Observability

- [ ] Fly.io built-in metrics (CPU/memory/connections) — no extra setup
- [ ] Frontend error boundary that POSTs to `/api/errors` (simple log)
- [ ] Optional: Sentry free tier (5k events/mo) — only if you want stack traces

### 7. Operations

- [ ] README updated with deploy instructions
- [ ] One-page runbook: how to view logs, restart app, run migration
- [ ] `.env.example` files in `backend/` and `frontend/`

## Files to touch

```
backend/
  src/
    config.ts                       # MODIFY: production env handling
    server.ts                       # MODIFY: helmet, rate-limit, graceful shutdown
    routes/health.routes.ts         # MODIFY: include DB check
  fly.toml                          # NEW
  Dockerfile                        # NEW (multi-stage build)
  .env.example                      # NEW

frontend/
  src/lib/components/
    ConnectionToast.svelte          # NEW
    Avatar.svelte                   # NEW (color-hash)
    Confetti.svelte                 # NEW
  src/lib/sounds/                   # NEW
  src/routes/host/[gameId]/+page.svelte    # MODIFY: skip + kick + answer count
  src/routes/play/[gameId]/+page.svelte    # MODIFY: countdown ring
  .env.example                      # NEW

docs/
  RUNBOOK.md                        # NEW
```

## Verification

1. Deploy preview to Fly.io + Cloudflare Pages staging
2. Full game on phone + laptop simultaneously
3. Throttle network in devtools to "Slow 3G" → verify reconnect toast + auto-rejoin
4. Kill backend container during game → verify graceful shutdown + Fly.io auto-restart
5. Production smoke: 3+ real users from different networks
6. Check Fly.io dashboard for memory/CPU under load

## Acceptance criteria

- App is live at a real domain with HTTPS
- Mobile users can play smoothly without zooming or horizontal scrolling
- Brief network blips (< 30s) recover without user action
- Total monthly cost under $15 (domain $10/yr ≈ $0.85/mo + Fly free + Neon free + Cloudflare free)

## Reference

- [decisions.md](../decisions.md) — D3 (single instance is enough)
- [phases/02-persistence-auth-editor.md](02-persistence-auth-editor.md) — required to be done first
