# Phase 8 — Ordering / Ranking

**Status**: 🔜
**Depends on**: Phase 6 (question type system), Phase 7 (non-scored infrastructure)
**Goal**: Add a ranked/ordering question type where players drag items into the correct order and are scored based on how close their ranking is to the correct sequence.

## Why this phase

Ordering questions test deeper understanding than multiple choice — useful for timelines, priority ranking, and step-by-step processes. Mechanically distinct from all other types (drag UI + partial scoring).

## Parallel PR strategy

```
Wave 1 (2 parallel PRs)               Wave 2 (2 parallel PRs)        Wave 3 (1 PR)
──────────────────────────            ────────────────────────────   ──────────────
PR-A shared scoring + kendall +       PR-C engine + WS validate      PR-E editor + host + player
  shared/src/index.test.ts              └─ needs A + B                 page integration
PR-B WS payload type change           PR-D RankingInput.svelte         └─ needs A + D
  (choice: number | number[])           (standalone Svelte file)
```

**PR-A** · Wave 1 · §2 + §7 tests — files: `shared/src/index.ts`, `shared/src/index.test.ts` (new)
**PR-B** · Wave 1 · §3 — files: `shared/src/index.ts` (just the `submit_answer` payload union — coordinate with PR-A so the shared file diff is non-overlapping; split into two distinct edits)
**PR-C** · Wave 2 · §1 schema activation + engine call — files: `backend/src/routes/quiz.routes.ts`, `backend/src/services/game/lifecycle.ts`, `backend/src/ws/index.ts`
**PR-D** · Wave 2 · §4 player UI primitive — files: `frontend/src/lib/components/RankingInput.svelte` (new). Library decision: prefer native HTML5 drag-and-drop over `@neodrag/svelte` for v1 (zero dep weight; touch fallback via `pointerdown`/`pointermove`).
**PR-E** · Wave 3 · §5 + §6 integration — files: `frontend/src/lib/components/QuizEditor.svelte` (or `SlideEditor.svelte`), `frontend/src/routes/host/[gameId]/+page.svelte`, `frontend/src/routes/play/[gameId]/+page.svelte`

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
- [ ] Scoring method: **Kendall tau distance** (count inversions between submitted and correct orders)
  - Let `n = choices.length`, `inversions = k`, `maxInversions = n*(n-1)/2`
  - Accuracy ratio: `acc = 1 - (k / maxInversions)` → 1 for perfect match, 0 for fully reversed
  - Time decay (same shape as `scoreAnswer`): `timeFactor = 1 - min(timeUsedMs, limitMs) / (limitMs * 2)` → in `[0.5, 1]`
  - Final score: `Math.round(1000 * acc * timeFactor)`, bounded `[0, 1000]`
  - Reference outputs (verify in unit test): 4 items, perfect order, t=0 → `1000`; 4 items, fully reversed, any t → `0`; 4 items, 1 swap of adjacent, t=0 → `1000 * (1 - 1/6) ≈ 833`; 4 items, perfect order, t = limitMs → `500`
- [ ] Implement `kendallInversions(a: number[], b: number[]): number` as a helper in `shared/src/index.ts` (naive O(n²) is fine — `n ≤ 6`)
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
7. `scoreRanking` unit tests in `shared/src/index.test.ts` (new): assert the four reference outputs listed in §2 exactly; also assert `kendallInversions` returns 0 for identical arrays, 3 for `[0,1,2]` vs `[2,1,0]` (n=3, max=3)

## Acceptance criteria

- Players can drag-and-drop items into order on both desktop and mobile
- Partial scoring works: more correct placements = higher score
- Timer auto-submits current ordering on expiry
- Host sees correct order on reveal
- Existing question types unaffected
