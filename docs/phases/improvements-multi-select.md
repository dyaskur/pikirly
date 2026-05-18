# Improvements — Multi-Select Questions

**Status**: 🔜
**Depends on**: Phase 6 (question type system)
**Goal**: Add a new `multi_select` question type where a question can have more than one correct answer. Players tick multiple choices and submit once.

## Why this exists

The Phase 6 type system added True/False and 2–6 choices but kept the single-correct-answer assumption (`Question.correct: number`). Multi-correct is a separate concern with non-trivial protocol impact (the `submit_answer` WS event needs to carry a set, not a scalar) and a scoring policy decision, so it deserves its own focused PR rather than getting bundled into Phase 6 or 7.

## Out of scope (intentional)

- Allowing the host to require a *minimum* number of selections (e.g. "pick at least 2")
- Per-choice weighting (some choices worth more)
- Negative points beyond the partial-credit floor
- Drag-to-rank within multi-select (that's [Phase 8 — Ordering / Ranking](08-ordering-ranking.md))

## Design decisions to lock in before coding

1. **Scoring policy** — pick one and ship it; toggle later if needed:
   - **All-or-nothing** (Kahoot's default): correct set must match exactly → full time-decay points; otherwise 0. Simplest mental model.
   - **Partial credit**: `+points/N` for each correct selected, `−points/N` for each wrong selected, floored at 0. More forgiving but easier to game.
   - **Recommendation**: all-or-nothing for parity with Kahoot.
2. **UX for submission** — player can tap multiple tiles before committing; needs an explicit Submit button (current MC submits on first tap). Editor must allow ≥ 2 correct.
3. **Minimum selections** — default to 1 (allow under-selection, scored 0 if not exact match under all-or-nothing).

## Deliverables

### 1. Shared schema (`shared/src/index.ts`)

- [ ] Add `'multi_select'` to the `QuestionType` union.
- [ ] Add an optional `correctSet?: number[]` to `Question` alongside the existing `correct?: number`. For `multi_select`, `correctSet` is required and `correct` is undefined. Keeping them as separate fields avoids a `number | number[]` union that every engine consumer would have to narrow.
- [ ] Update `QuestionPublic` similarly — but the question event still doesn't expose `correct`/`correctSet` (cheating vector). Players need only `type` to know to render checkboxes.
- [ ] `ClientToServerEvents.submit_answer.choice: number` becomes `number | number[]`. Document the contract: scalar for single-answer types, array for `multi_select`.
- [ ] `ServerToClientEvents.question_end.correctChoice: number` becomes `correctChoice: number | number[]` (or add a separate `correctSet?: number[]` to keep `correctChoice` scalar-only).

### 2. Backend engine (`backend/src/services/game/lifecycle.ts`, `engine.ts`)

- [ ] `recordAnswer()` accepts `choice: number | number[]`. For `multi_select`, normalize to a sorted unique array, validate every index is in `[0, choices.length)`.
- [ ] Scoring (all-or-nothing): `correct = setEquals(submitted, question.correctSet)`; on `true`, use existing time-decay; else 0.
- [ ] `answerDistribution()` for `multi_select`: count selections per choice (not per player — a player picking 3 increments 3 bars). Add a derived "answered" count for the "X of Y answered" UI.
- [ ] `maybeEndEarly()` still works — gate on `answers.size >= players.size` (one entry per player regardless of selection count).
- [ ] `question_end` payload: `correctChoice` becomes `correctSet` when type is `multi_select`; clients render multiple highlighted tiles.

### 3. Zod / validation (`backend/src/routes/quiz.routes.ts`)

- [ ] Add `multi_select` to the `type` enum.
- [ ] New refinement: when `type === 'multi_select'`, `correctSet` is required, length ≥ 2, every value is `< choices.length`, no duplicates. `correct` must be undefined.
- [ ] Loosen the existing "correct must be a valid choice index" refine so it only runs when type is single-correct.

### 4. Editor (`frontend/src/lib/components/QuizEditor.svelte`)

- [ ] Type selector gains "Multi-Select".
- [ ] When `type === 'multi_select'`: replace the radio group with checkboxes bound to `correctSet`. Show a hint: "Players must pick exactly these to score."
- [ ] Save validation: at least 2 entries in `correctSet`, all within choices range.
- [ ] When switching *from* `multi_select` to another type, drop `correctSet` and reset `correct = 0`. Switching *to* `multi_select` clears `correct` and starts with `correctSet = []` (UX nudges the host to pick at least 2).

### 5. Player UI (`frontend/src/routes/play/[gameId]/+page.svelte`)

- [ ] When `currentQuestion.type === 'multi_select'`, render tiles as toggle-buttons (selected state visually distinct). Tapping a tile flips it in `mySelections: Set<number>`.
- [ ] Render a "Submit answer" button below the grid; disabled until `mySelections.size >= 1` (or `>= 2` if we enforce a minimum).
- [ ] On submit: emit `submit_answer` with `choice: [...mySelections].sort()`.
- [ ] After submit, lock the UI (same as scalar `multiple_choice`) and show the "locked in" chip with all selections listed.
- [ ] `seededShuffle` still applies — shuffle the *display order*, submit canonical indices.

### 6. Host UI (`frontend/src/routes/host/[gameId]/+page.svelte`, `MeetSharedDisplay.svelte`)

- [ ] Reveal: when `type === 'multi_select'`, highlight every tile in `correctSet` (not just one). Update the legend so the green tick shows on each correct tile.
- [ ] Distribution chart: same renderer; just interpret counts as "selections" not "voters" in the caption.

### 7. Tests

- [ ] `engine.test.ts` + `lifecycle.test.ts`: cover correct-set match, partial selection (scored 0), over-selection (scored 0), and distribution counting.
- [ ] `quizRepo.test.ts`: round-trip a multi-select question through DB.
- [ ] Editor smoke: switching type preserves data correctly.

### 8. Migration

- [ ] No SQL migration needed — `correctSet` lives in the JSONB column and old rows simply don't have it. The existing `0001_question_type_backfill.sql` is sufficient.

## Files to touch

```text
shared/
  src/index.ts                              # MODIFY: type union, correctSet, WS event signatures

backend/
  src/services/game/engine.ts               # MODIFY: setEquals helper, distribution
  src/services/game/lifecycle.ts            # MODIFY: recordAnswer scoring, question_end payload
  src/routes/quiz.routes.ts                 # MODIFY: zod refinements
  src/services/game/lifecycle.test.ts       # MODIFY: add multi-select cases
  src/services/game/engine.test.ts          # MODIFY: distribution test

frontend/
  src/lib/components/QuizEditor.svelte      # MODIFY: checkboxes for correctSet, validation
  src/routes/play/[gameId]/+page.svelte     # MODIFY: toggle tiles + Submit button
  src/routes/host/[gameId]/+page.svelte     # MODIFY: highlight all correct tiles
  src/lib/components/MeetSharedDisplay.svelte # MODIFY: same reveal treatment
```

## Verification

1. Create a 4-choice question with `correctSet: [0, 2]`; save round-trips through the API.
2. Two players: one picks `[0, 2]` → scored full points; another picks `[0]` → scored 0 (all-or-nothing).
3. Distribution shows higher counts on tiles 0 and 2 (the popular picks), fewer on 1 and 3.
4. Reveal screen highlights both tile 0 and tile 2 in green.
5. With `randomizeChoices: true`, the displayed order is shuffled per player but submission carries the canonical indices and scoring is unaffected.
6. Switching a question from multi-select back to multiple-choice in the editor leaves `correctSet` undefined and `correct = 0` selectable.
7. `tsc --noEmit` + `svelte-check` + `pnpm test` all green.

## Acceptance criteria

- Hosts can author questions with two or more correct answers.
- Players submit a set of selections in one event and the server validates / scores them deterministically.
- All-or-nothing scoring is the default; switching to partial credit later is a one-function change in `recordAnswer()`.
- Existing single-correct types remain unchanged on the wire and in scoring.

## Coordination

- [improvements-ai-question-types.md](improvements-ai-question-types.md) — once multi-select ships, the AI generator should also be allowed to emit it. Add a bullet to that doc's "Deliverables" before this PR merges.
- [Phase 7](07-poll-openended-wordcloud.md) — non-scored types (poll, open-ended, word cloud) intentionally don't share the multi-select scoring path. Don't try to unify them.
