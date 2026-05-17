# Phase 4 — Google Meet Add-on

**Status**: 🚧 In progress — first cut shipped to `feature/phase-04-meet`; not yet on `main`. Security hardening still landing; merge strategy pending.
**Depends on**: Phase 2 (DB + auth + `meeting_id` column), Phase 3 (deployed)
**Goal**: A host running a Meet call launches Pikirly in the Meet side panel; participants play inside Meet without entering a PIN.

## Current state

- **Branch**: `feature/phase-04-meet` (~50 commits ahead of `main`; check with `git log main..feature/phase-04-meet --oneline`)
- **Merged to `main`**: nothing yet — only the `meeting_id VARCHAR(64)` column reserved in Phase 2
- **Why still in progress**: security review surfaced a string of fixes (JWT-from-URL removal, postMessage origin restriction, server-side pairing, TLS verification, PII redaction). See the Security checklist below. Merge is gated on those landing and a decided merge strategy.
- **CHANGELOG**: `[Unreleased]` entries for the Meet work are accumulating on the feature branch — they merge in naturally with the PR.

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

- [ ] Register add-on in Google Workspace Marketplace SDK *(pending — needs Workspace test-mode access)*
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

> All boxes above reflect what exists on `feature/phase-04-meet`. They do **not** mean anything is on `main`.

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

## Merge plan

The branch is too large for a single drive-by review. Recommended approach:

1. **Open a single PR `main ← feature/phase-04-meet`** with the full diff, organised by commit.
2. Behind a runtime flag `FEATURE_MEET` (env-toggled) so the standalone flow is unaffected if the flag is off. The flag can flip to default-on after the Marketplace verification passes (deliverable #1 above).
3. Reviewer: whoever last touched `backend/src/ws/` — that's the hottest blast-radius area.
4. CHANGELOG entries on the branch already accumulate under `[Unreleased]`; the PR merge resolves naturally.
5. After merge: the verification checklist below moves into a tracking issue rather than this doc, since post-merge verification is an ops task, not a phase task.

If reviewers push back on size, fall back to a split: (a) backend `/games/by-meeting` + repo + schema check, (b) `shared/src/index.ts` event additions, (c) frontend `meet.ts` + bootstrap components, (d) UX polish (4.1 items). Each PR rebases on the previous.

## Files to touch

```
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

Each item below should be checked off with linked evidence (screenshot path, log excerpt, or test-run id) before Phase 4 flips to ✅ Done.

- [ ] **Local iframe smoke** — Owner: dev
  - How to run: serve the SPA, load `http://localhost:5173/?mode=meet&surface=side` inside an iframe-friendly preview (e.g. a throwaway HTML page with `<iframe src=...>` over `file://`)
  - Pass criteria: bootstrap initialises without console errors; CSP / `frame-ancestors` doesn't block
  - Evidence: console screenshot in `docs/_evidence/04-iframe-smoke.png`

- [ ] **Marketplace registration (test mode)** — Owner: needs Workspace admin
  - How to run: follow [docs/meet-addon.md](../meet-addon.md) to register the add-on in Workspace Marketplace test mode
  - Pass criteria: add-on appears in a test Meet meeting's side-panel picker
  - Evidence: screenshot of the side-panel install

- [ ] **End-to-end Meet playthrough** — Owner: dev, second tester
  - How to run: two test Google accounts, real test Meet call, host installs add-on, picks a quiz, second user joins, play to `game_end`
  - Pass criteria: every player sees question/answer/leaderboard transitions; no PIN or nickname prompt
  - Evidence: short screencap

- [ ] **`games.meeting_id` populated** — Owner: dev
  - How to run: after a Meet-launched game, `select id, meeting_id from games order by created_at desc limit 5;`
  - Pass criteria: `meeting_id` matches the Meet meeting code, not null

- [ ] **Reconnect test** — Owner: dev
  - How to run: mid-game, refresh the side-panel iframe of a participant
  - Pass criteria: re-syncs to current question; no PIN / nickname re-entry; mapping comes from `meetParticipants` in [backend/src/ws/player.handlers.ts](../../backend/src/ws/player.handlers.ts)

- [ ] **Standalone regression** — Owner: dev
  - How to run: full Phase 1–3 flow (host creates quiz, player joins by PIN, full game) with the Meet code merged but `FEATURE_MEET=false`
  - Pass criteria: identical behaviour to pre-merge `main`

## Acceptance criteria

- A Meet host launches Pikirly from the side-panel button without leaving Meet
- Participants see the quiz auto-load with their Meet identity (no PIN, no nickname entry)
- Full game playable inside Meet
- Standalone web flow (Phase 1-3) continues to work unchanged

## Reference

- [Google Meet Add-ons SDK](https://developers.google.com/workspace/meet/develop)
- [decisions.md](../decisions.md) — D6 (SPA-only enables iframe embedding)
- [data-model.md](../data-model.md) — `meeting_id` column
