# Phase 7 — Poll / Vote + Open Ended + Word Cloud

**Status**: 🔜
**Depends on**: Phase 6 (question type system)
**Goal**: Add three non-scored question types that collect audience responses without a correct answer — Poll, Open Ended, and Word Cloud — and display results live on the host screen.

## Why this phase

Transforms Pikirly from a pure quiz tool into an audience engagement platform. Poll + Open Ended + Word Cloud cover the core Mentimeter / Slido use cases without requiring a scored quiz.

## Out of scope (intentional)

- AI moderation of open-ended responses
- Exporting results to CSV / PDF (Phase 9 nice-to-have)
- Word cloud custom stop-word list
- Anonymous vs named response toggle
- Response editing after submission

## Deliverables

### 1. Poll / Vote

- [ ] `type: 'poll'` — multiple choice, no correct answer, not scored
- [ ] Engine: collect responses, no `scoreAnswer()` call, no leaderboard delta
- [ ] `question_end` event: include full answer distribution (all choices + counts) for all players
- [ ] Host screen: animated bar chart showing live vote counts updating as players answer
- [ ] Player screen: same choice grid as `multiple_choice`; no "correct" reveal at end — show distribution instead
- [ ] Leaderboard: poll questions skipped (no score contribution)

### 2. Open Ended

- [ ] `type: 'open_ended'` — free text input, not scored
- [ ] `choices: []` — no predefined options
- [ ] New WS event `submit_text_answer`: `{ gameId, questionIndex, text: string (max 200 chars) }`
- [ ] Engine: collect text responses in `g.textAnswersByQuestion: Map<number, Map<playerId, string>>`
- [ ] `question_end` event: include all text responses (anonymized — no player name attached)
- [ ] Host screen: scrollable list of responses; responses appear live as players submit
- [ ] Player screen: text input + submit button; disabled after submit

### 3. Word Cloud

- [ ] `type: 'word_cloud'` — free text input, not scored, aggregated into cloud
- [ ] Same text collection as Open Ended
- [ ] `question_end` event: include word frequency map `{ word: count }` (server tokenizes + lowercases + strips stop words)
- [ ] Host screen: word cloud visualization
  - Use `d3-cloud` or `wordcloud2.js` (~15KB) for rendering
  - Larger font = more frequent word
  - Updates live as responses come in (re-render on each new response)
- [ ] Player screen: same as Open Ended (text input)

### 4. Shared non-scored infrastructure

- [ ] `g.textAnswersByQuestion` added to `GameState` in `engine.ts`
- [ ] `submit_text_answer` WS handler in `ws/index.ts`
- [ ] Validation: max 200 chars, strip HTML, trim whitespace
- [ ] Rate limit: 1 text submission per player per question (same as choice answer)
- [ ] `question_end` broadcast includes both `answerDistribution` (for choice types) and `textResponses` (for text types) — only relevant field populated

### 5. Timer behavior for non-scored types

- [ ] `limitMs` still applies — timer runs as normal
- [ ] After timer: host sees results (distribution / text list / word cloud)
- [ ] No "correct answer reveal" animation for non-scored types
- [ ] Host can still advance manually (skip)

### 6. Editor

- [ ] `poll`: choice editor same as `multiple_choice` but no "correct answer" radio
- [ ] `open_ended`: no choices — just question text + timer
- [ ] `word_cloud`: same as `open_ended`

## Files to touch

```
shared/
  src/index.ts                              # MODIFY: submit_text_answer event, question_end payload

backend/
  src/services/game/engine.ts              # MODIFY: textAnswersByQuestion in GameState
  src/services/game/lifecycle.ts           # MODIFY: question_end broadcast, skip scoring for non-scored
  src/ws/index.ts                          # MODIFY: submit_text_answer handler

frontend/
  src/lib/components/QuizEditor.svelte     # MODIFY: poll/open_ended/word_cloud editor UI
  src/routes/host/[gameId]/+page.svelte    # MODIFY: live bar chart, text list, word cloud
  src/routes/play/[gameId]/+page.svelte    # MODIFY: text input for open_ended/word_cloud
  src/lib/components/WordCloud.svelte      # NEW
  src/lib/components/LiveBarChart.svelte   # NEW
  src/lib/components/ResponseList.svelte   # NEW
```

## Verification

1. Poll: 3 players vote → host sees live bar chart update → `question_end` shows final distribution
2. Open Ended: players type responses → host sees list grow live → no leaderboard delta
3. Word Cloud: 10 players type → host sees word cloud render with frequency sizing
4. Mixed quiz: multiple_choice → poll → open_ended → all work in sequence; leaderboard only counts scored questions
5. `tsc --noEmit` + `svelte-check` pass
6. Text answer > 200 chars → rejected server-side
7. Second submission from same player → ignored

## Acceptance criteria

- Hosts can run a poll without a correct answer; results display live
- Hosts can collect open-ended text responses; all responses visible on host screen
- Word cloud renders and updates in real-time during the question
- Non-scored questions do not affect leaderboard
- Mixed quizzes (scored + non-scored) work correctly end-to-end
