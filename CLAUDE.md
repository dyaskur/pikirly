# Instructions for AI coding agents

Read this before touching code. Architecture decisions are intentional — don't refactor on instinct.

## Project status

**Phase 1 complete** (in-memory MVP). **Phase 2 complete** (Postgres + Google OAuth + Quiz editor). **Next is Phase 3** (Templates + AI generation).

| # | Phase | Status | Action plan |
|---|---|---|---|
| 1 | Minimal playable loop, in-memory state | ✅ Done | [docs/phases/01-mvp.md](docs/phases/01-mvp.md) |
| 2 | Postgres + Google OAuth + Quiz editor | ✅ Done | [docs/phases/02-persistence-auth-editor.md](docs/phases/02-persistence-auth-editor.md) |
| 3 | Templates + AI generation | 🔜 Next | [docs/phases/03-templates-ai.md](docs/phases/03-templates-ai.md) |
| 4 | Google Meet add-on | 🔜 | [docs/phases/04-meet.md](docs/phases/04-meet.md) |
| 5 | Google Slides add-on | 🔜 | [docs/phases/05-slides.md](docs/phases/05-slides.md) |
| 6 | Question type system (True/False, dynamic choices, randomize) | 🔜 | [docs/phases/06-question-types-foundation.md](docs/phases/06-question-types-foundation.md) |
| 7 | Poll / Open Ended / Word Cloud | 🔜 | [docs/phases/07-poll-openended-wordcloud.md](docs/phases/07-poll-openended-wordcloud.md) |
| 8 | Ordering / Ranking | 🔜 | [docs/phases/08-ordering-ranking.md](docs/phases/08-ordering-ranking.md) |
| 9 | UX polish + deploy | 🔜 | [docs/phases/09-polish-deploy.md](docs/phases/09-polish-deploy.md) |
| — | Redis multi-instance scaling | ⏸ Deferred | [docs/phases/deferred-redis.md](docs/phases/deferred-redis.md) |

**For agents picking up work**: read the relevant phase doc — it contains a checklist of deliverables, files to touch, and verification steps. Don't infer; the plan is explicit.

## Architecture

```
Browser (SvelteKit SPA)
  ↓ Socket.IO (WS) + REST
Node API (Fastify + Socket.IO)
  ↓
[in-memory Map<gameId, GameState>]   ← Redis swap (deferred, only if scale demands)
[no DB yet]                          ← Phase 2: Postgres
```

### Layer separation (strict)

- **`backend/src/ws/`** — transport only. Socket event registration, room mgmt, session tracking. **No game logic here.**
- **`backend/src/services/game/`** — game engine. Pure functions where possible (`engine.ts`), side-effecting lifecycle (`lifecycle.ts`).
- **`backend/src/services/game/store.ts`** — state persistence boundary. Currently in-memory `Map`. **This is the only file that changes when/if Redis is added later.**
- **`backend/src/db/`** — does not exist yet. Phase 2 will add it.
- **`shared/src/index.ts`** — single source of truth for the WebSocket event contract. Imported by both backend and frontend.

### Frontend conventions

- SvelteKit with `adapter-static`, `ssr = false`, `prerender = false` globally.
- One Socket.IO singleton in `frontend/src/lib/socket.ts` — never create another.
- `playerSession` and `hostSession` stores persist to `localStorage` for reconnect.
- Cards (`.card` class) always have white background + dark text — see `app.css`. Don't override `color` inside cards.

## Conventions

- **TypeScript strict everywhere.** Use the shared event types — don't re-declare event shapes.
- **No comments unless the WHY is non-obvious.** Code explains what; commit messages explain why.
- **No abstractions until third use.** A bug fix doesn't need surrounding cleanup.
- **No backwards-compat shims.** This is greenfield. Just change the code.
- **Prefer editing existing files over creating new ones.** Especially: don't create new doc files unless asked.
- **Update `CHANGELOG.md`** in the same commit as any user-visible change (features, behavior changes, schema, deploy, bugs users would notice). Append under `[Unreleased]`. Skip for typo fixes or pure internal refactors.
- **Don't add error handling for impossible cases.** Validate at boundaries (user input, external APIs); trust internal calls.
- **Real-time correctness over clever design.** Server is authoritative for time, scoring, question advancement.

## Don't do

- ❌ Add Redis until traffic actually warrants it — single instance is fine for MVP and likely beyond
- ❌ Add Postgres queries to the realtime loop — DB writes happen at `game_end` only, reads at `create_game` only (Phase 2)
- ❌ Send the correct answer in the `question` event payload (cheating vector)
- ❌ Trust client timestamps for scoring — server is authoritative (`questionStartedAt`, `questionDeadlineAt`)
- ❌ Use `{secondsRemaining}` in payloads — use `deadlineMs` (server epoch) so clients render countdowns locally
- ❌ Add OAuth or sign-up flows for **players** — they're anonymous (just nickname). OAuth is for **hosts** in Phase 2.
- ❌ Switch transport layer (e.g., to Ably). Trade-offs analyzed; not worth it.

## Testing

Strategy doc: [docs/testing.md](docs/testing.md). Pyramid: unit (Vitest) → integration (Vitest + Testcontainers + real Socket.IO) → E2E smoke. No frontend component tests in MVP.

Commands:
- **Backend type check**: `cd backend && pnpm tsc --noEmit`
- **Frontend type check**: `cd frontend && pnpm run check`
- **Unit + integration** (Phase 2+): `cd backend && pnpm test`
- **E2E smoke**: `cd backend && node scripts/smoke.mjs` (requires backend dev server running)
- **Manual smoke**: 2 browser tabs (host + player), play a full game

Always run type checks before claiming a task done. Once Phase 2 lands, also run `vitest`. Add a regression test for every reproduced bug.

## Known gotchas

- **`tsx watch` restarts wipe in-memory games.** During dev, edit a backend file → all PINs become invalid. Host page detects this via `GET /games/:gameId` and shows "session expired" UI.
- **Socket.IO events arrive after page mount.** The `join_game` reconnect path on the play page also re-syncs the current question if the game is mid-flight, covering brief navigation gaps.
- **`pattern="\d{6}"` on inputs blocks form submit.** Use `oninput` to sanitize digits instead — already done; don't re-add `pattern`.

## Where to look first

| Task | Start here |
|---|---|
| Add a new event | `shared/src/index.ts` (types) → `backend/src/ws/index.ts` (handler) → relevant page |
| Change scoring | `shared/src/index.ts` (`scoreAnswer`) — used by both server and reference |
| Change game flow | `backend/src/services/game/lifecycle.ts` |
| Style/UI | `frontend/src/app.css` (design tokens) — global cascades from `.card` and `.btn-*` |
| Reconnect/state-sync bug | `backend/src/ws/index.ts` `join_game` reconnect path |

## Phase 3 starting points (next work)

1. Define template library in `backend/src/data/templates.ts`
2. `GET /templates` + `GET /templates/:id` REST endpoints
3. "Start from template" flow in frontend quiz editor
4. Consume the newly created `POST /ai/generate-questions` endpoint in the frontend
5. "Generate with AI" drawer in quiz editor (calling the multi-provider backend)
