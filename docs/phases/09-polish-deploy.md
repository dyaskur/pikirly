# Phase 9 — UX Polish + Deploy

**Status**: 🔜
**Depends on**: All prior phases
**Goal**: A polished, mobile-first version of the app is live on a real domain with real users able to play.

## Why this phase

All previous phases make it functional. Phase 9 makes it shippable. Polish lands last so we don't iterate on UI that might be thrown away during feature development.

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
- [ ] **Domain**: $10/yr (e.g., `pikirly.app`)
  - DNS A/CNAME → Cloudflare Pages
  - Subdomain `api.pikirly.app` → Fly.io app
- [ ] **Google OAuth**: register production redirect URI
- [ ] **Smoke test in prod**: 3 devices, full game

### 5. CI/CD

- [ ] GitHub Actions workflow on every PR + push to main:
  - `npm ci`
  - `tsc --noEmit` (backend)
  - `svelte-check` (frontend)
  - `vitest run` with Docker-in-CI for testcontainers Postgres
  - Layer caching for faster runs
- [ ] Block merge on red
- [ ] CD: auto-deploy to Fly.io on merge to main (via `flyctl deploy`)
- [ ] CodeRabbit + CursorBot: add `.coderabbit.yaml` config

### 6. Observability

- [ ] Fly.io built-in metrics (CPU/memory/connections) — no extra setup
- [ ] Frontend error boundary that POSTs to `/api/errors` (simple log)
- [ ] Optional: Sentry free tier (5k events/mo) — only if you want stack traces

### 7. Operations

- [ ] README updated with deploy instructions
- [ ] One-page runbook: how to view logs, restart app, run migration
- [ ] `.env.example` files in `backend/` and `frontend/`
- [ ] Switch CHANGELOG to **git-cliff** (generated from conventional commits)
  - Add `cliff.toml` at repo root with grouping config (feat, fix, docs, perf, refactor)
  - Adopt conventional commit format project-wide; optionally enforce via `commitlint` + pre-commit hook
  - Regenerate `CHANGELOG.md` on tag push in CI: `git cliff -o CHANGELOG.md`
  - Remove the "manually edit CHANGELOG" rule from `CLAUDE.md`; replace with "write conventional commit messages"

### 8. Meet add-on UX (deferred from Phase 4)

Phase 4 shipped functional; these are polish items observed during dogfooding.

Side panel ([frontend/src/lib/components/MeetBootstrap.svelte](../../frontend/src/lib/components/MeetBootstrap.svelte)):
- [ ] Remove double heading stutter — "Host Controls" + `<MeetStage>`'s own "Pick a quiz" heading shouldn't both render in a 400px column. Pick one owner of the title.
- [ ] Make participant side panel useful during gameplay — render the answer pad, current score, and rank instead of the static "Look at the main stage" text
- [ ] Hide the "Are you the host?" sign-in CTA when a game is already active
- [ ] Replace bare spinner with a skeleton of the about-to-render content (quiz picker shell for host, "waiting for host" card for participant)
- [ ] Replace placeholder 🎮 emoji with proper Pikirly mark

Main stage / quiz picker ([frontend/src/lib/components/MeetStage.svelte](../../frontend/src/lib/components/MeetStage.svelte)):
- [ ] Quiz list metadata: show last-played date, add search/sort, surface "recently used" at top
- [ ] Rename "Host in Meeting" button to "Start" (host is already in the meeting)
- [ ] Inline quiz creation (modal) instead of opening editor in a new tab — preserve in-Meet flow
- [ ] Add a "Ready to start?" confirmation before promoting the activity to the main stage (currently silent — surprises the room)
- [ ] Host side panel during gameplay: show live participant count, current question, advance/skip/pause controls, glance leaderboard — don't reduce it to a single "Manage Active Game" button

Cross-cutting:
- [ ] Extract the duplicated `handleLogin` flow from `MeetBootstrap.svelte` and `MeetStage.svelte` into a single reusable component or composable
- [ ] Strip `console.log` / `[DEBUG]` statements from Meet components before deploy

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
  src/lib/components/MeetBootstrap.svelte  # MODIFY: side-panel UX polish
  src/lib/components/MeetStage.svelte      # MODIFY: quiz picker polish, confirm before stage promotion
  src/lib/components/MeetSignIn.svelte     # NEW: shared sign-in extracted from the two Meet components
  .env.example                      # NEW

.github/
  workflows/ci.yml                  # NEW
  workflows/cd.yml                  # NEW
.coderabbit.yaml                    # NEW

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
- CI blocks merge on type errors or failing tests

## Reference

- [decisions.md](../decisions.md) — D3 (single instance is enough)
- [phases/02-persistence-auth-editor.md](02-persistence-auth-editor.md) — required to be done first
