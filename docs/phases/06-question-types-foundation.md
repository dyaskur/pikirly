# Phase 6 — Question Type System (Foundation)

**Status**: 🔜
**Depends on**: Phase 2 (quiz schema), Phase 3 (editor)
**Goal**: Replace fixed 4-choice multiple-choice with an extensible question type system. Ships True/False, dynamic choice count, and randomized answer order as first types.

## Why this phase

All future question types (Phases 7–8) depend on this. The schema, engine, and editor must be type-aware before adding Poll, Word Cloud, or Ranking. Do it once, do it right.

## Breaking changes

- `Question.choices: string[]` stays, but `choices.length` is no longer fixed at 4
- New required field: `Question.type: QuestionType`
- `Question.correct: number` becomes optional (not applicable for Poll, Word Cloud, Open Ended)
- Existing seed data + DB rows need migration

## Deliverables

### 1. Schema — `@kahoot/shared`

- [ ] Add `QuestionType` union to `shared/src/index.ts`:
  ```ts
  export type QuestionType =
    | 'multiple_choice'   // existing — has correct answer, scored
    | 'true_false'        // 2 choices: True / False — has correct answer, scored
    | 'poll'              // Phase 7: no correct answer
    | 'open_ended'        // Phase 7: text input
    | 'word_cloud'        // Phase 7: text input → aggregate
    | 'ranking'           // Phase 8: ordered list
  ```
- [ ] Update `Question` interface:
  ```ts
  export interface Question {
    id: string;
    type: QuestionType;
    text: string;
    choices: string[];           // 2–6 items; empty for open_ended/word_cloud
    correct?: number;            // index; undefined for non-scored types
    limitMs: number;
    randomizeChoices?: boolean;  // shuffle per-participant if true
  }
  ```
- [ ] Update `Quiz` interface — no changes needed

### 2. DB migration

- [ ] `questions` JSONB column already stores `Question[]` — add migration that backfills `type: 'multiple_choice'` on all existing question rows
- [ ] Run `drizzle-kit generate` + commit new migration SQL

### 3. Engine changes

- [ ] `scoreAnswer()` in `shared/src/index.ts`: guard `if (!question.correct) return 0` for non-scored types (forward-compat for Phase 7)
- [ ] `recordAnswer()` in `lifecycle.ts`: pass question type through; skip scoring for non-scored types
- [ ] `question` WS event payload: add `type`, `randomizeChoices` fields
- [ ] Server does NOT randomize — sends canonical order; **client randomizes** using a per-player seed (player socket ID) so reconnects get same order

### 4. True/False question type

- [ ] Editor: when `type === 'true_false'`, show only 2 fixed choice inputs ("True", "False"), hide add/remove buttons
- [ ] Engine: no special handling — `choices: ['True', 'False']`, `correct: 0|1`, scored normally
- [ ] Frontend player screen: render 2-choice layout (larger buttons, horizontal)

### 5. Dynamic choice count

- [ ] Remove hardcoded `choices.length === 4` validation in `quiz.routes.ts`
- [ ] New validation: `choices.length >= 2 && choices.length <= 6` for `multiple_choice`
- [ ] Editor: "Add choice" button (up to 6) + "Remove" per choice (min 2)
- [ ] Player screen: render 2–6 choice grid (CSS grid auto-adapts)

### 6. Randomize answer order

- [ ] `randomizeChoices?: boolean` toggle in editor (per-question)
- [ ] Client-side shuffle in player screen: `seededShuffle(choices, playerSocketId + questionIndex)`
- [ ] Track original index mapping so `submit_answer` still sends canonical index (not shuffled index)
- [ ] Host screen always shows canonical order (no shuffle)

### 7. Editor updates

- [ ] Question type selector (dropdown or tab) at top of each question card
- [ ] Conditional UI per type:
  - `multiple_choice`: 2–6 editable choices + correct answer radio
  - `true_false`: fixed "True"/"False" labels + correct answer radio
  - `poll`, `open_ended`, `word_cloud`, `ranking`: placeholder "coming in Phase 7/8" badge
- [ ] `randomizeChoices` toggle (checkbox) visible for `multiple_choice` + `true_false`

## Files to touch

```
shared/
  src/index.ts                              # MODIFY: QuestionType, Question interface

backend/
  src/db/migrations/000X_add_question_type.sql  # NEW — backfill migration
  src/routes/quiz.routes.ts                 # MODIFY: remove fixed-4 validation
  src/services/game/lifecycle.ts            # MODIFY: type-aware scoring
  src/ws/index.ts                           # MODIFY: include type in question event
  src/data/quizzes.ts                       # MODIFY: add type:'multiple_choice' to seed

frontend/
  src/lib/components/QuizEditor.svelte      # MODIFY: type selector, dynamic choices
  src/routes/play/[gameId]/+page.svelte     # MODIFY: client-side shuffle, 2-choice layout
  src/routes/host/[gameId]/+page.svelte     # MODIFY: render variable choice count
```

## Verification

1. `tsc --noEmit` + `svelte-check` pass
2. Existing multiple-choice game works unchanged
3. Create True/False question → save → host → player sees 2 choices → scores correctly
4. Create 6-choice question → saves, renders, scores correctly
5. Enable `randomizeChoices` → two players see different orders → both submit correct answers → both scored
6. DB migration: existing quiz rows have `type: 'multiple_choice'` backfilled
7. Vitest: update engine + lifecycle tests for new `type` field

## Acceptance criteria

- All existing quizzes continue to work without manual edits
- Hosts can create True/False questions
- Choice count 2–6 works end-to-end
- Player choice order is randomized per-player when enabled, but scores are canonical-index-based
