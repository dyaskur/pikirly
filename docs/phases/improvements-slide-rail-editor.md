# Improvements — Slide-Rail Quiz Editor

**Status**: 🔜
**Depends on**: Phase 2 (current QuizEditor exists and persists via `/quizzes`)
**Goal**: Replace today's vertically-stacked question cards with a Kahoot/Slides-style two-column layout — slide rail on the left (one thumbnail per question), main pane on the right showing only the selected slide. Pure frontend refactor against the existing schema; no backend, no DB, no shared-event changes.

## Why

The current [QuizEditor.svelte](../../frontend/src/lib/components/QuizEditor.svelte) renders every question as a card in a long scroll. Past ~10 questions this becomes unusable for the kind of edit-by-edit work hosts actually do: jump between two specific slides, reorder, duplicate, preview "what does slide N look like to a player". A slide-rail editor makes "1 question = 1 slide" the visible mental model, matches what users expect from Kahoot/Slides, and unblocks Phase 6.5 by carving out the pure-UI refactor (PR-C in [06.5-rich-slides.md](06.5-rich-slides.md)) so it can ship before Phase 6 lands.

## Out of scope (intentional)

- Per-question images / media (stays in Phase 6.5 PR-D)
- Info / non-scored slides (stays in Phase 6.5 PR-E and depends on Phase 7)
- New question types (Phase 6)
- Schema / migration / shared event changes — quiz payload stays `{ title, questions: Question[] }`
- Mobile-first redesign — rail collapses gracefully but desktop is the target
- Undo/redo history (separate concern; not needed to ship the layout)
- Multi-select operations (single-select only for v1)

## Deliverables

### 1. Extract per-slide editing into `SlideEditor.svelte`

In `frontend/src/lib/components/SlideEditor.svelte` (new):

- [ ] Renders one question: text input, four choice inputs with correct-answer radio, time-limit select
- [ ] Props: `question: Question`, `index: number`, `total: number`, callbacks `onChange(updated: Question)` and `onDelete()`
- [ ] Bigger / more readable than today's card — this is now the main pane, not one of N stacked cards
- [ ] All styling moves out of inline `style="..."` blobs into a `<style>` block or `app.css` tokens
- [ ] No business logic — purely controlled component

### 2. Slide rail in `SlideRail.svelte`

In `frontend/src/lib/components/SlideRail.svelte` (new):

- [ ] Vertical list of thumbnails on the left (~140px wide)
- [ ] Each thumbnail: slide number + truncated question text preview + selected-state border
- [ ] Selected thumbnail visually distinct (filled background, accent border)
- [ ] "+ Add slide" button pinned at the bottom of the rail (disabled when `questions.length >= 50`)
- [ ] Drag-to-reorder via HTML5 drag API (`draggable=true`, `ondragstart` / `ondragover` / `ondrop`) — reorder mutates the questions array; selection follows the moved item
- [ ] Empty state: rail shows just the "+ Add first slide" CTA when `questions.length === 0`
- [ ] Props: `questions: Question[]`, `selectedIndex: number`, callbacks `onSelect(i)`, `onReorder(from, to)`, `onAdd()`

### 3. `QuizEditor.svelte` becomes the layout shell

Heavy refactor of [QuizEditor.svelte](../../frontend/src/lib/components/QuizEditor.svelte):

- [ ] Title input + header (Cancel / Save / AI Generate / Add) stays at the top, full width
- [ ] Two-column body: `<SlideRail>` left, `<SlideEditor>` right (renders the selected question)
- [ ] New `selectedIndex` `$state`, defaults to `0`; clamped on delete; auto-set to the new index on add/duplicate
- [ ] `onChange` from SlideEditor updates `questions[selectedIndex]` immutably
- [ ] Keyboard handlers on a wrapping `<div tabindex="-1">`:
  - `ArrowUp` / `ArrowDown` — move selection (don't wrap)
  - `Cmd+D` / `Ctrl+D` — duplicate selected slide; new slide gets fresh `id` and is auto-selected
  - `Delete` / `Backspace` (only when no input focused) — delete selected with a confirm dialog
- [ ] AIGenerateDrawer behaviour unchanged: appends to `questions`; first newly-added slide becomes selected
- [ ] Save validation unchanged (title required, ≥1 question, each question text + 4 choices non-empty)

### 4. Responsive collapse

In the same shell:

- [ ] Below 768px: rail collapses into a horizontal scroller pinned above the slide editor; thumbnails become ~110px-wide cards
- [ ] Keyboard nav still works on desktop sizes; touch reorder is out of scope (drag stays mouse-only for v1)

## Files to touch

```
frontend/
  src/lib/components/
    QuizEditor.svelte        # heavy refactor: layout shell only
    SlideRail.svelte         # NEW
    SlideEditor.svelte       # NEW (extracted from QuizEditor)
  src/app.css                # tokens for rail width, thumbnail, selected state (only if reused elsewhere)

CHANGELOG.md                 # APPEND under [Unreleased] — "Slide-style quiz editor"

docs/phases/
  06.5-rich-slides.md        # note that PR-C (slide-rail editor shell) shipped via this doc; remove from PR list or mark ✅
```

No backend, no shared-event, no schema changes.

## Tests

The project doesn't have frontend component tests in the MVP (see [docs/testing.md](../testing.md)), so verification is manual.

- [ ] **Type check passes**: `cd frontend && pnpm run check`
- [ ] Manual: editor opens, existing quizzes render with first slide selected
- [ ] Manual: keyboard nav ↑/↓ moves selection
- [ ] Manual: `Cmd+D` duplicates selected; selection moves to the duplicate
- [ ] Manual: `Backspace` with confirm deletes selected; selection moves to previous (or stays at 0 if deleting first)
- [ ] Manual: drag a thumbnail from position 3 to position 1; order persists after save + reload
- [ ] Manual: AI-generate 5 questions into an empty quiz; rail populates; selection lands on the first new slide
- [ ] Manual: 768px viewport — rail collapses to horizontal scroller without breaking the editor

## Verification

1. Type check passes (above)
2. Save an existing quiz unchanged through the new editor and diff the JSON — should be byte-identical to today
3. Create a new 10-question quiz from scratch using only the new editor; host the quiz; play it through; confirm question text, choices, correct-answer, and time limits all match what was entered
4. Reorder 3 slides via drag; save; reload; host the quiz; confirm new order is the play order
5. CHANGELOG entry under `[Unreleased]` → **Changed**: "Quiz editor redesigned as slide rail + main pane (one question = one slide)"

## Acceptance criteria

- The slide-rail layout is the default editor for both create and edit flows
- No regression: existing quizzes (saved before this change) open and save round-trip with no data loss
- Keyboard shortcuts work; drag reorder works
- Phase 6.5 PR-C is no longer needed — it's referenced from [06.5-rich-slides.md](06.5-rich-slides.md) as "shipped via improvements-slide-rail-editor.md", and Phase 6.5 can drop straight to image upload (PR-D) and info slides (PR-E) on top of this editor

## Reference

- [docs/phases/06.5-rich-slides.md](06.5-rich-slides.md) — PR-C (slide rail) is the seed for this doc; PR-D / PR-E build on top once shipped
