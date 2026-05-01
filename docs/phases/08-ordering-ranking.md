# Phase 8 — Ordering / Ranking

**Status**: 🔜
**Depends on**: Phase 6 (question type system), Phase 7 (non-scored infrastructure)
**Goal**: Add a ranked/ordering question type where players drag items into the correct order and are scored based on how close their ranking is to the correct sequence.

## Why this phase

Ordering questions test deeper understanding than multiple choice — useful for timelines, priority ranking, and step-by-step processes. Mechanically distinct from all other types (drag UI + partial scoring).

## Out of scope (intentional)

- Weighted ranking (not all positions equal value)
- Tie-breaking rules beyond score
- Touch-drag on very old iOS Safari (progressive enhancement only)

## Deliverables

### 1. Schema

- [ ] `type: 'ranking'` added in Phase 6 as a placeholder — activate it here
- [ ] `Question` fields for ranking:
  - `choices: string[]` — the items to rank (2–6 items)
  - `correct: number[]` — canonical correct order as array of indices (e.g., `[2, 0, 3, 1]`)
  - `correct` changes type: `number | number[]` — union; ranking uses `number[]`
  - Update zod validation in `quiz.routes.ts` accordingly

### 2. Scoring

- [ ] New scoring function in `shared/src/index.ts`:
  ```ts
  export function scoreRanking(
    submitted: number[],   // player's order (indices)
    correct: number[],     // canonical order
    timeUsedMs: number,
    limitMs: number,
  ): number
  ```
- [ ] Scoring method: **Kendall tau distance** (count inversions vs correct order)
  - Full score (1000) → zero inversions (perfect match)
  - Partial score → proportional to inversions avoided
  - Time bonus still applies (same formula as `scoreAnswer`)
- [ ] Engine: call `scoreRanking` when `question.type === 'ranking'`

### 3. WS protocol

- [ ] Extend `submit_answer` payload: `choice` field becomes `choice: number | number[]`
  - `number` → existing multiple_choice / true_false
  - `number[]` → ranking submission (ordered list of item indices)
- [ ] Validate: submitted array must be a permutation of `[0..choices.length-1]`

### 4. Player UI

- [ ] Drag-to-rank interface:
  - Vertical list of items in random initial order (seeded per player, same as choice randomization)
  - Drag handle on each item (touch + mouse)
  - Reorder by drag-and-drop
  - "Submit order" button — disabled until player interacts (can't submit default order without intent)
- [ ] Use `@neodrag/svelte` or native HTML5 drag-and-drop (keep bundle small)
- [ ] Timer still runs — auto-submits current order on expiry
- [ ] After reveal: items animate to correct positions with color coding (green = correct position, red = wrong)

### 5. Host UI

- [ ] During question: show how many players have submitted (same as other types)
- [ ] After reveal: show correct order prominently; show distribution of most common submitted orders (top 3)

### 6. Editor

- [ ] `type: 'ranking'`: choice editor same as `multiple_choice` (add/remove items 2–6)
- [ ] Correct order: drag-to-reorder within the editor to set canonical sequence
- [ ] No "correct answer radio" — correct order IS the order of items in the editor

## Files to touch

```
shared/
  src/index.ts                              # MODIFY: scoreRanking, correct: number|number[], submit_answer payload

backend/
  src/routes/quiz.routes.ts                 # MODIFY: zod schema for ranking correct field
  src/services/game/lifecycle.ts            # MODIFY: call scoreRanking for ranking type
  src/ws/index.ts                           # MODIFY: validate ranking submission

frontend/
  src/lib/components/QuizEditor.svelte      # MODIFY: ranking editor (drag-to-set-order)
  src/routes/play/[gameId]/+page.svelte     # MODIFY: drag-to-rank player UI
  src/routes/host/[gameId]/+page.svelte     # MODIFY: ranking reveal UI
  src/lib/components/RankingInput.svelte    # NEW — drag-to-rank component
```

## Verification

1. Create ranking question with 4 items, correct order set in editor → save
2. Player drags to correct order → submits → full score (minus time decay)
3. Player submits wrong order → partial score proportional to inversions
4. Timer expires before submit → current order auto-submitted
5. Reveal: items animate to correct positions, correct/wrong position color coded
6. `tsc --noEmit` + `svelte-check` pass
7. `scoreRanking` unit tests: perfect order = 1000 (minus time), reversed order = ~0, half-wrong = ~500

## Acceptance criteria

- Players can drag-and-drop items into order on both desktop and mobile
- Partial scoring works: more correct placements = higher score
- Timer auto-submits current ordering on expiry
- Host sees correct order on reveal
- Existing question types unaffected
