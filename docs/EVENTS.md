# WebSocket event contract

Single source of truth: [`shared/src/index.ts`](../shared/src/index.ts). Both backend and frontend import these types — don't duplicate.

All payloads are JSON. `gameId` is the 6-digit PIN. `playerId` is server-issued UUID, persisted to player's `localStorage` for reconnect.

## Client → Server (with ack callback)

| Event | Payload | Ack response | Notes |
|---|---|---|---|
| `create_game` | `{ quizId?: string }` | `{ ok: true, gameId, hostToken }` \| `{ ok: false, error }` | Host creates a new game session. `quizId` defaults to `'general-1'`. |
| `join_game` | `{ gameId, nickname, playerId? }` | `{ ok: true, playerId, players, status }` \| `{ ok: false, error }` | If `playerId` matches an existing player → reconnect path; current question re-emitted if mid-flight. New joins only allowed during `lobby`. |
| `start_game` | `{ gameId, hostToken }` | `{ ok: true }` \| `{ ok: false, error }` | Host-only. Validates `hostToken`. Triggers `game_started` + first `question`. |

## Client → Server (no ack)

| Event | Payload | Notes |
|---|---|---|
| `submit_answer` | `{ gameId, playerId, questionIndex, choice, clientTs }` | Server validates `questionIndex === currentQuestionIndex` and deadline. Server responds with `answer_ack` regardless of acceptance. |

## Server → Client (broadcast to room `game:{gameId}`)

| Event | Payload | Trigger |
|---|---|---|
| `player_joined` | `{ playerId, nickname, score: 0 }` | New player joins lobby (not on reconnect). |
| `player_left` | `{ playerId }` | Player socket disconnects. |
| `game_started` | `()` | Host called `start_game`. Immediately followed by first `question`. |
| `question` | `{ index, total, text, choices: string[], deadlineMs, limitMs }` | New question begins. **No correct answer in payload** (cheating vector). `deadlineMs` is server epoch. |
| `leaderboard_update` | `{ top: LeaderboardEntry[], totalPlayers }` | Sent after each `question_end`. Top 10 only. |
| `game_end` | `{ finalLeaderboard, gameId }` | All questions complete. |

## Server → Client (per-socket emit)

| Event | Payload | Trigger |
|---|---|---|
| `answer_ack` | `{ accepted, reason?, questionIndex }` | Reply to every `submit_answer`. `reason` ∈ `'late' \| 'duplicate' \| 'wrong_question'` if not accepted. |
| `question_end` | `{ questionIndex, correctChoice, distribution: number[], yourScore?, yourCorrect?, totalScore? }` | Question timer expires OR all players answered. Per-player payload contains `your*` fields. Host receives the same event without `your*` fields. |
| `error_msg` | `{ code, message }` | Generic error to client (rare; most errors come via ack). |

## Reserved future events

- `host_rejoin` (Phase 2+) — when adding host reconnect, mirror the player reconnect pattern
- `meet_bind` (Phase 4) — Google Meet add-on identity reconciliation

## Scoring formula

Defined in [`shared/src/index.ts`](../shared/src/index.ts) as `scoreAnswer(correct, timeUsedMs, limitMs)`:

```ts
if (!correct) return 0;
const ratio = Math.min(timeUsedMs, limitMs) / (limitMs * 2);
return Math.max(0, Math.round(1000 * (1 - ratio)));
```

- Correct + answered at `t=0` → **1000 pts**
- Correct + answered at `t=limit` → **500 pts**
- Wrong → **0 pts**

Server is authoritative for `timeUsedMs = Date.now() - questionStartedAt`. Client `clientTs` is informational only — never trust it for scoring.

## Room conventions

- `game:{gameId}` — every connected socket (host + all players) joins this room
- `host:{gameId}` — host socket only (used for host-specific broadcasts; not heavily used in MVP)

## Reconnect flow

1. Client persists `{ gameId, playerId, nickname }` to `localStorage` after first successful `join_game`
2. On reconnect (Socket.IO transport reconnect or page mount), client emits `join_game` with stored `playerId`
3. Backend reconnect path:
   - Updates `connected = true`, refreshes `socketId`
   - Re-joins socket to `game:{gameId}` room
   - If `status === 'in_question'` and current question is not yet expired → re-emits `question` to that socket
4. Client resumes UI based on received events

## Error codes (in `error` field of nack responses)

| Code | Meaning |
|---|---|
| `unknown_quiz` | `quizId` not found |
| `game_not_found` | Game with that PIN doesn't exist (or backend restarted) |
| `invalid_nickname` | Empty or invalid nickname |
| `nickname_taken` | Nickname collision (case-insensitive) |
| `game_in_progress` | Trying to join after game started (only `lobby` accepts new players) |
| `forbidden` | Wrong `hostToken` |
| `already_started` | `start_game` called when status ≠ `lobby` |
| `no_players` | `start_game` called with empty player list |
