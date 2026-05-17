# Phase 4 — Google Meet Add-on

**Status**: 🔜
**Depends on**: Phase 2 (DB + auth + `meeting_id` column), Phase 3 (deployed)
**Goal**: A host running a Meet call launches Pikirly in the Meet side panel; participants play inside Meet without entering a PIN.

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

- [ ] Register add-on in Google Workspace Marketplace SDK
- [ ] Manifest declares two surfaces:
  - **Side panel** (player-facing): renders `https://pikirly.app/?mode=meet&surface=side`
  - **Main stage** (host-facing leaderboard): renders `https://pikirly.app/?mode=meet&surface=stage`
- [ ] OAuth scopes: `meetings.space.readonly` (to identify the meeting)

### 2. Frontend Meet bootstrap

- [ ] Add `@google/meet-addons-sdk`
- [ ] New module `frontend/src/lib/meet.ts`:
  - Detects `mode=meet` query param
  - Calls `meet.addon.createAddonClient()`
  - Reads participant identity + meeting code
  - Reads surface (`side` vs `stage`) from query
- [ ] Bootstrap path:
  - `mode=standalone` (default) → existing Phase 1-3 flow
  - `mode=meet&surface=side` → player flow without PIN entry; auto-joins game tied to meeting
  - `mode=meet&surface=stage` → host dashboard / leaderboard view
- [ ] No changes to `socket.ts`, `stores/*`, or game pages — only the entry component differs

### 3. Meeting ↔ Game binding

- [ ] New REST endpoint `POST /games/by-meeting`:
  - Body: `{ meetingCode, hostQuizId }`
  - Auth: JWT (host)
  - Behavior: create new game with `meeting_id = meetingCode`, return `{ gameId, hostToken }`
- [ ] New REST endpoint `GET /games/by-meeting/:meetingCode`:
  - Behavior: lookup active game by `meeting_id`; return 404 if none
  - Used by side-panel bootstrap to find the game players should join
- [ ] In `gameRepo`: add `findByMeetingId(meetingCode)` query (only active/lobby games)

### 4. Identity reconciliation

Players in Meet have a Meet participant ID. We map that to our anonymous `playerId` once on first join.

- [ ] Add to `GameState`: `meetParticipants: Map<meetParticipantId, playerId>` (in-memory; doesn't need persistence)
- [ ] Modify `join_game` payload: optional `meetParticipantId`, `meetDisplayName`
- [ ] On first join with `meetParticipantId`, allocate a `playerId` and store the mapping; subsequent joins from the same Meet user (e.g., reconnect) get the same `playerId`
- [ ] Use Meet display name as nickname if `nickname` not provided

### 5. UX inside Meet

- [ ] Side panel layout fits ~400px width; existing player UI already mobile-first so should adapt
- [ ] Main stage shows the host dashboard at full Meet stage size
- [ ] Hide the "Game PIN" header when `mode=meet` (players don't need to type it)
- [ ] Add "Start a game" button in main stage that opens quiz picker

### 6. Host launch flow

- [ ] Side panel shows "Sign in to Pikirly" if not authed in Meet
- [ ] Once authed, host picks a quiz → `POST /games/by-meeting` → main stage loads with leaderboard
- [ ] Players in Meet see side panel auto-join (no PIN entry)

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

1. Local: load `http://localhost:5173/?mode=meet&surface=side` in iframe-friendly preview tool; bootstrap doesn't error
2. Sandbox: register add-on in Workspace Marketplace test mode; install in test Meet meeting
3. Two test accounts in Meet → host installs add-on → side panel shows quiz picker → main stage shows lobby → second user sees side panel with auto-join → full game playthrough
4. Verify `games.meeting_id` populated correctly
5. Reconnect test: refresh side-panel iframe mid-game → re-syncs without PIN entry

## Acceptance criteria

- A Meet host launches Pikirly from the side-panel button without leaving Meet
- Participants see the quiz auto-load with their Meet identity (no PIN, no nickname entry)
- Full game playable inside Meet
- Standalone web flow (Phase 1-3) continues to work unchanged

## Reference

- [Google Meet Add-ons SDK](https://developers.google.com/workspace/meet/develop)
- [decisions.md](../decisions.md) — D6 (SPA-only enables iframe embedding)
- [data-model.md](../data-model.md) — `meeting_id` column
