# Phase 11 — Self-paced Learning Paths

**Status**: 🔜
**Depends on**: Phase 2 (auth + persistence), Phase 3 (AI generation)
**Goal**: Let a signed-in user pick a curated path (e.g. "Learn AWS") and work through ordered quizzes solo — no host, no PIN, no real-time engine — with progress tracked across sessions and gated by mastery.

## Why this phase

Today the product is purely live multiplayer: a host runs a game, players join with a PIN. There's no way to use it alone for self-study, which is the dominant Kahoot use case for individual learners. A learning-paths surface reuses the existing `Quiz` model + AI generator, adds a thin solo-play flow, and unlocks a second product mode without disturbing the live engine.

## Out of scope (intentional)

- **Spaced repetition** — surfacing weak questions on a schedule. Big design space (intervals, decay model, per-user state). Track in a follow-up doc; ship paths first.
- **Cohorts / teacher assignment** — needs role model + invitation flow. Separate phase.
- **Public path library + clone-to-customize** — needs publishing/moderation flow.
- **Certificates, badges, leaderboards across users** — gamification layer; defer to data on real usage.
- **Streaks / daily goal** — cheap to add, but not load-bearing for v1; spin out separately if usage data shows demand.
- **Path discovery / search** — v1 has a single curated index page; full search/category browse is later.
- **Hints during a question** — explanations on the reveal are enough for v1; hints mid-question is a separate UX call.

## Deliverables

### 1. Shared schema additions

In [shared/src/index.ts](../../shared/src/index.ts):

- [ ] Add optional `explanation?: string` to `Question` (≤500 chars). Shown on the reveal screen in solo mode; ignored in live mode unless the host opts in later.
- [ ] New types:
  ```ts
  export interface LearningPathStep {
    quizId: string;
    title: string;          // copied from quiz at path-build time for display
    masteryThreshold: number; // 0..100 — % score required to unlock next step
  }

  export interface LearningPath {
    id: string;
    title: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    steps: LearningPathStep[];
    createdAt: number;
  }

  export interface PathProgress {
    pathId: string;
    currentStep: number;        // index into steps[]; equals steps.length when path is complete
    completedSteps: number[];   // indices that passed the mastery gate
    bestScores: Record<number, number>; // step index → highest % score
    startedAt: number;
    lastAttemptAt: number;
  }
  ```

### 2. DB schema

In [backend/src/db/schema.ts](../../backend/src/db/schema.ts) (new migration):

- [ ] `learning_paths` — `id`, `title`, `description`, `difficulty`, `created_by_user_id` (null = system-curated), `created_at`, `updated_at`. Steps live in a JSONB column `steps` (array of `{ quiz_id, mastery_threshold }`); titles are denormalised at read time from the joined quiz row to avoid stale display strings.
- [ ] `path_progress` — composite PK `(user_id, path_id)`. Columns: `current_step int`, `completed_steps int[]`, `best_scores jsonb` (`{ "0": 85, "1": 92 }`), `started_at`, `last_attempt_at`.
- [ ] `path_attempts` — every attempt logged. `id`, `user_id`, `path_id`, `step_index`, `score_percent`, `correct_count`, `total_count`, `started_at`, `submitted_at`. Used for both progress update + future spaced-rep / analytics.

### 3. Backend REST routes

In `backend/src/routes/learning-path.routes.ts` (new), all protected by `verifyJwt`:

- [ ] `GET /learning-paths` — list available paths (system-curated + user's own). Returns `LearningPath[]` with embedded `progress` from `path_progress` for the calling user.
- [ ] `GET /learning-paths/:id` — single path with steps + each step's quiz metadata (title, question count) + calling user's progress.
- [ ] `POST /learning-paths` — create custom path. Body: `{ title, description, difficulty, steps: [{ quizId, masteryThreshold }] }`. Validates each `quizId` is owned by the caller or is a published template.
- [ ] `GET /learning-paths/:id/steps/:stepIndex/questions` — return the quiz questions for solo play. Includes `explanation` per question. **Does not** include `correct` index for the question text; correct + explanation are returned on submit (Section 4).
- [ ] `POST /learning-paths/:id/steps/:stepIndex/attempt` — solo-mode answer submission. Body: `{ answers: Array<{ questionIndex: number; choice: number; timeUsedMs: number }> }`. Returns `{ scorePercent, correctCount, totalCount, perQuestion: Array<{ correct: number; wasCorrect: boolean; explanation?: string }>, progressUpdated: boolean, unlockedNextStep: boolean }`. Server validates each answer against the quiz, computes %, updates `path_progress` if `scorePercent >= masteryThreshold`, writes a `path_attempts` row.
- [ ] `DELETE /learning-paths/:id` — owner only; system paths are not deletable via this route.

### 4. AI path generation

Extends Phase 3's AI generator:

- [ ] New route `POST /ai/generate-path` (guarded by the same rate limits planned in [improvements-ai-hardening.md](improvements-ai-hardening.md)). Body: `{ topic: string, steps?: number (default 3, max 5), provider?, model? }`. Returns `{ title, description, difficulty, steps: [{ title, questions: Question[] }] }`.
- [ ] Under the hood: calls the existing `aiService.generateQuestions` once per step with a difficulty curve (step 0 = easy, step N-1 = hard) and a topic-narrowing instruction (e.g. "AWS networking basics" → "AWS VPC peering"). Each step gets `count = 5..10` questions.
- [ ] On accept, the client posts each step's questions to `POST /quizzes` to materialise them, then `POST /learning-paths` to wire them into a path. (Atomicity: if the path POST fails, the orphan quizzes are kept and the user can retry from the path builder.)
- [ ] Prompt includes the instruction to populate `explanation` per question — that's the value-add over live mode.

### 5. Solo play frontend

New page tree under `frontend/src/routes/learn/`:

- [ ] `/learn` — path index: cards for each available path, progress bar overlay, "Resume" CTA on in-progress paths
- [ ] `/learn/[pathId]` — path detail: stepped list with lock/unlock state, best score per step, "Start step N" / "Retry step N" buttons
- [ ] `/learn/[pathId]/step/[stepIndex]` — solo play. One question per page, client-side countdown, no Socket.IO. On submit-all: POST `/learning-paths/:id/steps/:stepIndex/attempt`; render the per-question reveal with the `explanation` text and correct-answer highlight; show "Continue to next step" if `unlockedNextStep`, else "Retry" + the threshold gap.
- [ ] `/learn/build` — manual path builder: pick from the user's quizzes + templates, set mastery threshold per step, save
- [ ] `/learn/ai` — AI path builder: topic field + step count → calls `/ai/generate-path`, shows a preview, on accept does the materialisation flow

### 6. UX details that matter

- [ ] **Per-question explanation slot in the editor** — [SlideEditor.svelte](../../frontend/src/lib/components/SlideEditor.svelte) (assuming the slide-rail editor in [improvements-slide-rail-editor.md](improvements-slide-rail-editor.md) has shipped) gets an optional "Explanation (shown after answer)" textarea. If that editor hasn't shipped, add the same input to [QuizEditor.svelte](../../frontend/src/lib/components/QuizEditor.svelte).
- [ ] **Mastery gate UX** — locked step shows the required %, current best %, and an explicit "Score ≥75% on _Foundation_ to unlock" message rather than just a lock icon
- [ ] **No leaderboard, no PINs, no nicknames** in `/learn` — solo mode is signed-in only and identifies the user by their session
- [ ] **Resume on the dashboard** — `/host` (or whatever the post-login landing is) surfaces the most recent in-progress path

### 7. Seed paths

- [ ] Three system-curated paths shipped via a one-off seed script in `backend/src/db/seed-paths.ts`: "Learn AWS", "JavaScript Fundamentals", "World Geography" (matched to the existing template library). Each path = 3 steps wired to existing template quizzes. Idempotent: skips if a path with that title already exists.

## Files to touch

```
shared/
  src/index.ts                                                # MODIFY: explanation, LearningPath types

backend/
  src/db/schema.ts                                            # MODIFY: 3 new tables
  src/db/migrations/00XX_learning_paths.sql                   # NEW
  src/db/repositories/learningPathRepo.ts                     # NEW
  src/db/seed-paths.ts                                        # NEW
  src/routes/learning-path.routes.ts                          # NEW
  src/routes/ai.routes.ts                                     # MODIFY: add /ai/generate-path
  src/services/ai/service.ts                                  # MODIFY: per-step prompt + difficulty curve
  src/services/ai/service.test.ts                             # MODIFY: cover path generation
  src/server.ts                                               # MODIFY: register learning-path.routes

frontend/
  src/routes/learn/+page.svelte                               # NEW: path index
  src/routes/learn/[pathId]/+page.svelte                      # NEW: path detail
  src/routes/learn/[pathId]/step/[stepIndex]/+page.svelte     # NEW: solo play
  src/routes/learn/build/+page.svelte                         # NEW: manual builder
  src/routes/learn/ai/+page.svelte                            # NEW: AI builder
  src/lib/components/SlideEditor.svelte                       # MODIFY: explanation textarea
  src/lib/components/QuizEditor.svelte                        # MODIFY (only if slide-rail not yet shipped)
  src/routes/host/+page.svelte                                # MODIFY: "Resume path" surface

CHANGELOG.md                                                  # APPEND under [Unreleased]
```

## Tests

In `backend/src/db/repositories/learningPathRepo.integration.test.ts` (Vitest + Testcontainers, following the existing repo test pattern):

- [ ] Create a path with 3 steps, then `recordAttempt` below threshold — `current_step` does not advance, attempt row is written, `best_scores` updates
- [ ] Record attempt at threshold exactly — `current_step` advances, step index appears in `completed_steps`
- [ ] Record attempt above an already-completed step — `best_scores` updates if higher, `current_step` does not regress
- [ ] `findPath` returns embedded progress for the calling user; returns null progress for a different user

In `backend/src/services/ai/service.test.ts`:

- [ ] AI path generator produces `steps.length === requested`, difficulty rises monotonically, each step's questions have `explanation` set

Integration (E2E-lite via Fastify inject):

- [ ] Full flow: `POST /ai/generate-path` → materialise 3 quizzes → `POST /learning-paths` → `POST /learning-paths/:id/steps/0/attempt` with all-correct answers → `unlockedNextStep === true`

## Verification

1. `cd backend && pnpm tsc --noEmit && pnpm test` — all green
2. `cd frontend && pnpm run check` — green
3. Run `pnpm db:migrate && pnpm db:seed-paths` — three seed paths appear in `/learn`
4. Manual: sign in, open `/learn/learn-aws/step/0`, answer all questions correctly, confirm step 1 unlocks; deliberately fail step 1 (score below threshold), confirm step 2 stays locked and the gap message is shown
5. Manual AI flow: `/learn/ai` with topic "Kubernetes basics", step count 3 — generated path saves and is immediately playable end-to-end
6. Manual: open the slide editor on an existing quiz, add an explanation to one question, save; play that quiz via the solo flow and confirm the explanation appears on the reveal
7. Live multiplayer regression: host an existing quiz with PIN, play through with two tabs — behaviour identical to today (the new `explanation` field is silently ignored in live mode for v1)

## Acceptance criteria

- A signed-in user can browse paths, start one, finish a step, and have progress persist across page reloads and sign-outs
- Mastery threshold gates next-step access
- AI path generation works end-to-end (topic → playable path) without the user having to leave the `/learn/ai` page
- Per-question explanations render on the solo reveal screen
- Existing live multiplayer flow is unchanged (no regression in PIN-based games)
- Three seed paths ship for first-run-experience

## Reference

- [docs/phases/03-templates-ai.md](03-templates-ai.md) — AI generator that the path generator extends
- [docs/phases/improvements-ai-hardening.md](improvements-ai-hardening.md) — rate limits / cost caps that apply to the new `/ai/generate-path` route
- [docs/phases/improvements-slide-rail-editor.md](improvements-slide-rail-editor.md) — slide editor that gains the explanation field
- [docs/data-model.md](../data-model.md) — record the new tables and their relationships here when this lands
