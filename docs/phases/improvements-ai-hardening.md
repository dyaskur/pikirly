# Improvements — AI Hardening & Backend Robustness

**Status**: 🔜
**Depends on**: Phase 3 (AI generation shipped behind a feature branch)
**Goal**: Close the abuse, cost, reliability, and observability gaps that Phase 3 left open. Make `POST /ai/generate-questions` safe to expose without burning quotas, surface failures cleanly, and fix related backend hygiene issues.

## Why this phase

Phase 3 shipped multi-provider AI generation but the route is currently unbounded — any authenticated user can spam it and rapidly exhaust upstream credits (Straico, OpenAI, OpenRouter). Phase 3's deliverables list a "5 req/min per user" limit but it was never implemented. Several other small issues surfaced while debugging the test infra (Docker socket, fallback semantics, missing CI hooks) and are cheap to bundle here rather than scatter across later phases.

## Out of scope (intentional)

- Streaming AI responses (deferred until UX needs it)
- Per-organization billing / usage analytics dashboards
- Fine-grained per-provider quotas (single global limit is fine for now)
- A feature-flag / kill-switch system (manual env toggle is enough)
- Replacing testcontainers with a different DB strategy

## Deliverables

### 1. Rate limiting on `/ai/generate-questions`

- [ ] Install `@fastify/rate-limit`
- [ ] Apply to the AI route only (not global): **5 req/min per authenticated user**, keyed by `req.user.sub`, not IP (corporate NATs collapse to one IP)
- [ ] Return `429` with `Retry-After` header and a JSON body `{ error: 'rate_limited', retryAfterMs }` so the editor can surface a friendly toast
- [ ] Hard daily cap per user (default `50/day`, env-configurable via `AI_DAILY_LIMIT_PER_USER`) — independent of the per-minute window, prevents slow drip attacks

### 2. Cost-shaping at the route layer

- [ ] Cap `count` to **10** (down from 20) for unauthenticated/free tier; keep the schema upper bound at 20 but enforce 10 in the route until we have tiers
- [ ] Reject empty/whitespace topics earlier (current `min(1)` allows `" "`)
- [ ] Reject topics over **120 chars** at the route level (current schema allows 200, but longer prompts → more tokens → more cost; tune later)
- [ ] Add a **30s** timeout around `aiService.generateQuestions(...)` using `AbortController`; return `504` on timeout instead of holding the connection open

### 3. AI service correctness

- [ ] **Don't fall back on schema-validation errors.** Today, if Straico returns malformed data, the service silently retries OpenAI — which doubles cost and masks a real provider bug. Distinguish transport/network errors (retry-eligible) from validation errors (fail fast). See `backend/src/services/ai/service.ts:55-66`.
- [ ] Update [service.test.ts:71](backend/src/services/ai/service.test.ts) to match the corrected behavior — currently expects `"via straico"` but receives `"via openai"`.
- [ ] Surface per-provider attempt info in the thrown error (`{ attempts: [{ provider, error }] }`) so route logs are diagnostic without the user seeing internals
- [ ] Refuse to register a provider whose API key is empty — today providers silently load with `apiKey: ''` and only fail at call time. Log a warning at boot and skip that provider in the fallback chain.

### 4. Logging & redaction

- [ ] Add a Pino redaction config so request logs strip `authorization`, `cookie`, and any field matching `*api_key*` / `*secret*` — Fastify's default logger currently dumps full headers on error
- [ ] Log AI generation outcomes (provider, count, latency, success/fail) at `info` for usage analysis; never log the topic/prompt body (PII risk in school deployments)

### 5. Test infra polish (carry-over from current branch)

- [ ] Make `tests/global-setup.ts` print an actionable error when no Docker daemon is reachable (probe `DOCKER_HOST` and the colima default socket, suggest `colima start` or `DOCKER_HOST=...` if missing)
- [ ] Move `src/db/repositories/*.test.ts` to `*.integration.test.ts` for consistency with the new naming convention; remove the `src/db/repositories/**` exclude in `vitest.config.ts` once renamed
- [ ] CI: add a Docker-enabled job that runs `npm run test:integration` (the unit job runs `npm run test`)

### 6. Boot-time hardening (touches Phase 9, but cheap to do now)

- [ ] `@fastify/helmet` on the global app
- [ ] Refuse to boot in `NODE_ENV=production` if `JWT_SECRET` is the dev fallback (`'supersecretdevjwt'`) — fail loud
- [ ] Drop `NODE_TLS_REJECT_UNAUTHORIZED=0` from `server.ts` — it's a footgun even in dev. If a corporate proxy needs it, document an opt-in env var (`ALLOW_INSECURE_TLS=1`) instead of toggling on `NODE_ENV !== 'production'`

## Files to touch

```
backend/
  src/server.ts                              # MODIFY — register rate-limit, helmet, drop TLS bypass
  src/routes/ai.routes.ts                    # MODIFY — per-route rate limit, timeout, tighter schema
  src/services/ai/service.ts                 # MODIFY — fallback semantics, empty-key skip
  src/services/ai/service.test.ts            # MODIFY — fix expectation, add retry-vs-validate test
  src/db/repositories/quizRepo.test.ts       # RENAME → *.integration.test.ts
  src/db/repositories/userRepo.test.ts       # RENAME → *.integration.test.ts
  tests/global-setup.ts                      # MODIFY — friendlier docker-missing error
  vitest.config.ts                           # MODIFY — remove src/db/repositories exclude after rename
  .env.example                               # MODIFY — add AI_DAILY_LIMIT_PER_USER, ALLOW_INSECURE_TLS

.github/workflows/ci.yml                     # NEW — unit + integration jobs (if not already present)
```

## Verification

1. **Rate limit per minute**: hit `/ai/generate-questions` 6× in 60s as the same user → 6th returns `429` with `Retry-After`.
2. **Daily cap**: bypass the per-minute window with sleeps; 51st call in 24h returns `429` with `daily_limit_reached`.
3. **Validation failure no longer cascades**: mock Straico to return malformed JSON → service throws `"AI generated invalid question format via straico"` *without* retrying OpenAI; OpenAI mock receives 0 calls. Cost on the dashboard reflects 1 call, not 2.
4. **Empty-key provider skipped**: unset `OPENAI_API_KEY`, set `AI_PROVIDER=straico`. Boot logs `"OpenAI provider disabled: missing OPENAI_API_KEY"`. Straico failure throws transport error directly, no fallback attempt.
5. **Timeout**: stub a provider that sleeps 60s → route returns `504` after 30s, upstream socket released.
6. **Helmet**: `curl -I http://localhost:3001/health` shows `x-content-type-options: nosniff` and friends.
7. **Test infra**: with Docker stopped, `tests/global-setup.ts` prints a one-line "start colima or set DOCKER_HOST" message instead of a stack trace.
8. **CI**: PR triggers both unit and integration jobs; integration job pulls postgres:15-alpine and goes green.

## Acceptance criteria

- A malicious or runaway client cannot exceed `5 req/min` or `50 req/day` against `/ai/generate-questions`.
- Validation errors do not silently double upstream cost.
- Boot fails fast on missing prod-critical config (JWT secret) instead of running with insecure defaults.
- Test failures from a missing Docker daemon include the fix in the error message.
- AI usage logs let an operator answer "how many generations did user X run today?" with a single grep.

## Reference

- `backend/src/routes/ai.routes.ts` — current route, no rate limit
- `backend/src/services/ai/service.ts:55-66` — fallback logic that currently retries on validation errors
- `backend/src/services/ai/service.test.ts:71` — test asserting the buggy behavior
- [docs/phases/03-templates-ai.md](03-templates-ai.md) — original deliverables list (rate limit was specified but not shipped)
- [docs/phases/09-polish-deploy.md](09-polish-deploy.md) — "production readiness" overlap; this phase pulls a few items forward
