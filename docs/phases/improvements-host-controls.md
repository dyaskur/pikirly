# Improvements — Host Live Session Controls

**Status**: 🔜
**Depends on**: Phase 1 (engine), Phase 4 (Meet add-on shipped — its host surface is one consumer)
**Goal**: Give the host pause / resume / skip / advance controls during a live game, in both the standalone web flow and the Meet add-on side panel. Today the host can only watch the timer run out; this lands the engine primitives + shared events + UI buttons.

## Why

Real classroom / dogfood feedback: a question fires while a learner is still reading; the room wants to discuss an answer mid-question; the host wants to end the reveal pause early to keep momentum. The Phase 4.1 follow-up doc already lists "advance/skip/pause controls" as a Meet-host gap, but the underlying capability has to exist on the engine first and the standalone host page needs it too — so this is its own focused unit rather than a Meet polish item.

## Out of scope (intentional)

- Re-asking a question / replaying it
- Extending a question's time limit dynamically (separate concern: `extend_question`)
- Kicking, muting, or moderating individual players
- Skipping to an arbitrary question index (jump-to-N) — only "next now"
- Showing per-player answer timing to the host
- Persisting pause events to the DB (live-only state)

## Deliverables

### 1. Engine state

- [ ] Add `pausedAt: number | null` and `accumulatedPauseMs: number` to [`GameState`](../../backend/src/services/game/engine.ts#L21)
- [ ] Extend [`GameStatus`](../../shared/src/index.ts#L4) with `'paused'` (sub-state of in-question — only valid when `currentQuestionIndex >= 0` and `pausedAt !== null`)
- [ ] Scoring uses `now - questionStartedAt - accumulatedPauseMs` as time-used so paused time does not penalise late-answer scoring ([`scoreAnswer`](../../shared/src/index.ts#L126) inputs in [`recordAnswer`](../../backend/src/services/game/lifecycle.ts#L157))

### 2. Lifecycle functions

In [backend/src/services/game/lifecycle.ts](../../backend/src/services/game/lifecycle.ts):

- [ ] `pauseQuestion(io, g)` — only valid when `status === 'in_question'`. Clear the active timer, capture **`remainingMs = Math.max(0, questionDeadlineAt - now)`** (clamp — if the deadline has already passed, remaining is 0, not negative), set `pausedAt = now`, set `status = 'paused'`, broadcast `question_paused { remainingMs }`. If `remainingMs === 0` you may also choose to fire `endQuestion` immediately instead of pausing — pick one and document.
- [ ] `resumeQuestion(io, g)` — only valid when `status === 'paused'`. Compute `pauseDuration = Math.max(0, now - pausedAt)`, push `questionDeadlineAt` forward by that amount, add to `accumulatedPauseMs`, clear `pausedAt`, set `status = 'in_question'`, re-schedule timer using **`Math.max(0, questionDeadlineAt - now)`** (clamp again — never schedule a negative-delay `setTimeout`; treat 0 as "fire on next tick"), broadcast `question_resumed { deadlineMs }`
- [ ] `skipQuestion(io, g)` — only valid when `status` is `'in_question'` or `'paused'`. Force-call `endQuestion(io, g, currentQuestionIndex)` (existing function already handles reveal + leaderboard + auto-advance). If paused: unpause first so timing math stays consistent.
- [ ] `advanceNow(io, g)` — only valid when `status === 'between'`. Clear the active timer (the one scheduling next question), call `beginQuestion(io, g, currentQuestionIndex + 1)` (or `endGame` if no more questions)
- [ ] [`recordAnswer`](../../backend/src/services/game/lifecycle.ts#L157) rejects with a new reason `'paused'` when `status === 'paused'`

### 3. Shared event contract

In [shared/src/index.ts](../../shared/src/index.ts):

- [ ] Add to `ClientToServerEvents`:
  ```ts
  pause_question: (payload: { gameId: string }, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  resume_question: (payload: { gameId: string }, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  skip_question: (payload: { gameId: string }, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  advance_now: (payload: { gameId: string }, cb: (res: { ok: true } | { ok: false; error: string }) => void) => void;
  ```
- [ ] Add to `ServerToClientEvents`:
  ```ts
  question_paused: (payload: { questionIndex: number; remainingMs: number }) => void;
  question_resumed: (payload: { questionIndex: number; deadlineMs: number }) => void;
  ```
- [ ] Extend `answer_ack.reason` with `'paused'`
- [ ] Add `'paused'` to the `GameStatus` union

### 4. Host socket handlers

In [backend/src/ws/host.handlers.ts](../../backend/src/ws/host.handlers.ts):

- [ ] Four new handlers (`pause_question`, `resume_question`, `skip_question`, `advance_now`)
- [ ] Each follows the existing `start_game` authorisation pattern: read `sess` via `getSession(socket)`, fail with `'forbidden'` if `sess.role !== 'host' || sess.gameId !== payload.gameId`. **Never** trust `hostToken` from the payload (see Phase 2 security notes).
- [ ] Each returns `{ ok: false, error: 'invalid_state' }` if the engine refuses (e.g. pause while in lobby)

### 5. Reconnect / late-join sync

- [ ] `join_game` reconnect path in [backend/src/ws/player.handlers.ts](../../backend/src/ws/player.handlers.ts) must include the `'paused'` status correctly when re-emitting the current question — late-joiners should see "paused" UI, not a stuck timer
- [ ] If status is `'paused'`, the re-sync payload sends the fresh `remainingMs` (recomputed server-side: `questionDeadlineAt - pausedAt`, clamped to 0) plus an explicit `paused: true` flag. **Do not** synthesise a `deadlineMs = now + remainingMs` — that would let the client decrement past it. Clients **must not decrement `deadlineMs`** while `status === 'paused'`; they render a static `remainingMs` until the next `question_resumed` event arrives, at which point they switch back to deadline-based countdown using the new `deadlineMs`.

### 6. Standalone host UI

In `frontend/src/routes/host/+page.svelte`:

- [ ] During `in_question`: Pause button + Skip button visible
- [ ] During `paused`: Resume button + Skip button visible; main display shows "Paused — N s remaining" overlay
- [ ] During `between`: "Next question now" button visible
- [ ] Wire each to the corresponding socket event with optimistic disable until ack
- [ ] Show server error toasts on `{ ok: false, error }`

### 7. Player UI

In `frontend/src/routes/play/+page.svelte`:

- [ ] On `question_paused`: freeze the countdown, show "Paused" overlay, disable answer buttons
- [ ] On `question_resumed`: re-enable, restart countdown using `deadlineMs`
- [ ] Handle `answer_ack` with `reason === 'paused'` as a no-op (server already filtered)

### 8. Meet host UI (closes a 4.1 item)

In [frontend/src/lib/components/MeetSideControls.svelte](../../frontend/src/lib/components/MeetSideControls.svelte) (and `MeetStage.svelte` if the controls live there):

- [ ] Same Pause / Resume / Skip / Advance buttons as standalone host UI — extract into a reusable `HostLiveControls.svelte` component so both surfaces share code
- [ ] On checkbox in [04-meet-followups.md](04-meet-followups.md): "Host side panel during gameplay: show … advance/skip/pause controls" — tick when this ships

## Files to touch

```text
shared/
  src/index.ts                                      # MODIFY: events, GameStatus, answer_ack reason

backend/
  src/services/game/engine.ts                       # MODIFY: GameState fields
  src/services/game/lifecycle.ts                    # MODIFY: pause/resume/skip/advance + recordAnswer guard
  src/services/game/lifecycle.test.ts               # MODIFY: new test cases
  src/ws/host.handlers.ts                           # MODIFY: 4 new handlers
  src/ws/player.handlers.ts                         # MODIFY: join_game reconnect respects 'paused'

frontend/
  src/routes/host/+page.svelte                      # MODIFY: pause/resume/skip/advance buttons
  src/routes/play/+page.svelte                      # MODIFY: pause overlay, disable answers
  src/lib/components/HostLiveControls.svelte        # NEW: shared button strip
  src/lib/components/MeetSideControls.svelte        # MODIFY: embed HostLiveControls
  src/lib/components/MeetStage.svelte               # MODIFY (if host live controls live there)

CHANGELOG.md                                        # APPEND under [Unreleased]
docs/phases/04-meet-followups.md                    # tick the "advance/skip/pause" item once shipped
```

## Tests

In [backend/src/services/game/lifecycle.test.ts](../../backend/src/services/game/lifecycle.test.ts) (Vitest, no Testcontainers needed for these):

- [ ] `pause` rejects `submit_answer` with `reason: 'paused'`
- [ ] `pause` then `resume` extends `questionDeadlineAt` by exactly the pause duration (±5ms tolerance for timer scheduling)
- [ ] `pause` then `resume` then a correct late answer scores using `now - questionStartedAt - accumulatedPauseMs` (not raw elapsed)
- [ ] `skip` while `in_question` triggers the same reveal + leaderboard flow as the timer firing
- [ ] `skip` while `paused` unpauses first and still reveals
- [ ] `advance_now` while `between` skips the reveal pause and starts the next question immediately
- [ ] `advance_now` on the last question calls `endGame`
- [ ] Each handler returns `'forbidden'` for a non-host socket, `'invalid_state'` from a wrong-state engine call

Integration test (one is enough):

- [ ] Two clients connected via real Socket.IO: host pauses → player sees `question_paused`, answer rejected; host resumes → player sees `question_resumed`, answer accepted with correct score.

## Verification

1. **Unit + integration**: `cd backend && pnpm test` — all new lifecycle tests green
2. **Type check**: `cd backend && pnpm tsc --noEmit && cd ../frontend && pnpm run check`
3. **Manual standalone smoke**: host + player tabs, start a game; mid-question hit Pause → player UI freezes → Resume → countdown picks up where it stopped; on next question hit Skip → reveal fires immediately; in the between-pause hit Advance → next question starts without waiting
4. **Manual Meet smoke**: same flow inside a test Meet meeting using the Meet side controls; confirm the shared `HostLiveControls.svelte` component renders identically
5. **CHANGELOG entry under `[Unreleased]`** — features under **Added**

## Acceptance criteria

- Host can pause / resume / skip a live question and advance the between-question pause, in both standalone and Meet flows
- Player UI never lets a paused player submit; scoring is fair across pause boundaries
- Reconnect during pause shows the player a frozen countdown, not a stuck or already-expired timer
- The 4.1 "advance/skip/pause controls" checkbox can be ticked
