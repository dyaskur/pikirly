# Phase 4 — Google Meet Add-on

**Status**: ✅ Done — merged in PR #6 (commit `4ec6c96`). End-to-end tested.
**Depends on**: Phase 2 (DB + auth + `meeting_id` column), Phase 3 (deployed)
**Goal**: A host running a Meet call launches Pikirly in the Meet side panel; participants play inside Meet without entering a PIN.

## Shipped

- All deliverables and security items below are on `main` as of `4ec6c96`.
- CHANGELOG entries are under `[Unreleased]` ready for the next dated release header.
- Marketplace test-mode registration completed and the end-to-end playthrough passed (see Verification).
- Remaining Meet UX polish tracked in [04-meet-followups.md](04-meet-followups.md) (Phase 4.1).

## Why this phase

Distribution. Meet add-ons surface Pikirly to existing Meet users with zero install friction. Builds on Phase 2/3 infrastructure — no engine rewrite needed because design constraints were locked in early.

## Out of scope (intentional)

- Microsoft Teams add-on
- Zoom app
- In-meeting chat integration
- Recording / replay of past games
- Live host-to-participant voice prompts
- Meet bot identity (host is still a real Google user)
- Google Slides integration (Phase 5)

## Design constraints already satisfied

- ✅ SPA renders in iframe (`adapter-static`, no SSR redirects)
- ✅ `frame-ancestors` CSP can be set on static host (Phase 9)
- ✅ Auth via JWT in `Authorization` header (not cookies — iframe-safe)
- ✅ `meeting_id VARCHAR(64) NULL` reserved in `games` table (Phase 2)
- ✅ Realtime engine is transport + game logic; no assumption about top-level page

## Deliverables

### 1. Add-on manifest

- [x] Register add-on in Google Workspace Marketplace SDK (test mode)
- [x] Manifest declares two surfaces:
  - **Side panel** (player-facing): renders `https://pikirly.app/?mode=meet&surface=side`
  - **Main stage** (host-facing leaderboard): renders `https://pikirly.app/?mode=meet&surface=stage`
- [x] OAuth scopes: `meetings.space.readonly` (to identify the meeting)

### 2. Frontend Meet bootstrap

- [x] Add `@googleworkspace/meet-addons`
- [x] New module `frontend/src/lib/meet.ts`
- [x] Bootstrap path (`mode=standalone` / `mode=meet&surface=side` / `mode=meet&surface=stage`)
- [x] No churn in `socket.ts`, `stores/*`, or game pages — only the entry component differs

### 3. Meeting ↔ Game binding

- [x] `POST /games/by-meeting` (creates game, sets `meeting_id`, returns `{ gameId, hostToken }`)
- [x] `GET /games/by-meeting/:meetingCode` (lookup active game by `meeting_id`; 404 if none)
- [x] `gameRepo.findByMeetingId(meetingCode)` (active/lobby only)

### 4. Identity reconciliation

- [x] `meetParticipants: Map<meetParticipantId, playerId>` on `GameState`
- [x] `join_game` accepts optional `meetParticipantId`, `meetDisplayName`
- [x] Stable mapping across reconnects
- [x] Falls back to Meet display name when no `nickname` provided

### 5. UX inside Meet

- [x] Side panel fits ~400px width
- [x] Main stage shows host dashboard at full Meet stage size
- [x] "Game PIN" header hidden when `mode=meet`
- [x] "Start a game" button in main stage opens quiz picker

### 6. Host launch flow

- [x] Side panel shows sign-in CTA when host not authed
- [x] Once authed, host picks a quiz → `POST /games/by-meeting` → main stage loads
- [x] Participants in Meet auto-join from the side panel without PIN entry


## Security checklist

Meet add-ons run in a cross-origin iframe and exchange auth across windows; this section tracks the hardening that surfaced during dogfooding.

- [x] JWT removed from URLs (`bb5c091`)
- [x] postMessage target origin restricted to `window.location.origin` (`5351f2b`)
- [x] Pairing flow moved server-side; insecure endpoint removed (`7519b61`)
- [x] Pairing codes persisted in DB for multi-process safety (`c0c4674`)
- [x] TLS cert verification re-enabled in prod (`90735ff`)
- [x] PII stripped from logs (`90735ff`)
- [x] Strict Add-on Only mode enforced when `mode=meet` (`042c163`)
- [x] Game PIN restored for hybrid in-Meet + remote participants (`222ea66`)
- [ ] Pino redaction config (out of scope here — tracked in [improvements-ai-hardening.md](improvements-ai-hardening.md))

Add new Meet-specific security work as checkboxes here, not in CHANGELOG-only.

## How it merged

Shipped as a single squashed PR (#6) `main ← feature/phase-04-meet`. CHANGELOG entries on the branch were preserved under `[Unreleased]` on `main`.

## Files to touch

```text
frontend/
  src/lib/meet.ts                              # NEW
  src/routes/+page.svelte                      # MODIFY: detect mode=meet, route to bootstrap
  src/lib/components/MeetBootstrap.svelte      # NEW: side-panel auto-join
  src/lib/components/MeetStage.svelte          # NEW: main-stage host UI

backend/
  src/routes/game.routes.ts                    # NEW: /games/by-meeting endpoints
  src/db/repositories/gameRepo.ts              # MODIFY: findByMeetingId
  src/services/game/engine.ts                  # MODIFY: GameState + meetParticipants
  src/ws/index.ts                              # MODIFY: join_game accepts meetParticipantId

shared/
  src/index.ts                                 # MODIFY: optional Meet fields on join_game

docs/
  meet-addon.md                                # NEW: how to register + test the add-on
```

## Verification

All items passed before PR #6 was merged.

- [x] **Local iframe smoke** — bootstrap initialises without console errors; CSP / `frame-ancestors` doesn't block
- [x] **Marketplace registration (test mode)** — add-on appears in a test Meet meeting's side-panel picker (see [docs/meet-addon.md](../meet-addon.md))
- [x] **End-to-end Meet playthrough** — two test Google accounts in a real test Meet call, full game to `game_end` with no PIN or nickname prompt
- [x] **`games.meeting_id` populated** — verified via `select id, meeting_id from games order by created_at desc limit 5;`
- [x] **Reconnect test** — mid-game side-panel refresh re-syncs to current question via `meetParticipants` mapping in [backend/src/ws/player.handlers.ts](../../backend/src/ws/player.handlers.ts)
- [x] **Standalone regression** — Phase 1–3 flow (host creates quiz, player joins by PIN) unchanged on `main`

## Acceptance criteria

- A Meet host launches Pikirly from the side-panel button without leaving Meet
- Participants see the quiz auto-load with their Meet identity (no PIN, no nickname entry)
- Full game playable inside Meet
- Standalone web flow (Phase 1-3) continues to work unchanged

## Reference

- [Google Meet Add-ons SDK](https://developers.google.com/workspace/meet/develop)
- [decisions.md](../decisions.md) — D6 (SPA-only enables iframe embedding)
- [data-model.md](../data-model.md) — `meeting_id` column
