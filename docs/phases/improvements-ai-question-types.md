# Improvements — AI Question-Type Parity

**Status**: 🔜
**Depends on**: Phase 6 (question type system shipped)
**Goal**: Teach the AI generator about the new question types and choice-count flexibility introduced in Phase 6 so that AI-generated quizzes match what hosts can build by hand.

## Why this exists

Phase 6 added `true_false` and dynamic 2–6 choices to the human editor and the engine, but the AI path was deliberately left at "4-choice multiple-choice only":

- Prompts in [straico.ts:20](../../backend/src/services/ai/adapters/straico.ts) and [openai-compatible.ts:26](../../backend/src/services/ai/adapters/openai-compatible.ts) hardcode `["choice 1", "choice 2", "choice 3", "choice 4"]` and don't mention `type`.
- The AI-only zod validator at [ai/service.ts:11-14](../../backend/src/services/ai/service.ts) still enforces `choices.length(4)` + `correct.max(3)`. Even if a model returned T/F, it would be rejected as invalid format.

Closing this gap is its own concern — prompt changes can regress generation quality, so it deserves a focused PR with model-output spot checks rather than being bundled with the UI work.

## Out of scope (intentional)

- Per-type AI prompts (one prompt that can emit a mix is the goal — host doesn't ask "generate 5 true/false questions")
- Streaming responses
- Fine-tuning / model selection per question type
- New question types from Phases 7–8 — handle those when they land

## Deliverables

### 1. Prompt updates

- [ ] Both adapter prompts mention `type: 'multiple_choice' | 'true_false'`, and that `choices` can be 2–6 items (must be exactly 2 when `type === 'true_false'`).
- [ ] Prompt instructs the model to pick `type` based on the question — e.g. binary-fact questions should be T/F, multi-option facts should be MC.
- [ ] Keep `correct` as a 0-based index, but clarify range (`0..choices.length - 1`).

### 2. Zod schema

- [ ] [`ai/service.ts`](../../backend/src/services/ai/service.ts) `aiQuestionSchema` mirrors the loosened `quiz.routes.ts` schema: `type: z.enum(['multiple_choice', 'true_false']).default('multiple_choice')`, `choices: z.array(...).min(2).max(6)`, `correct: z.number().int().min(0)`, plus the two `.refine()` checks (correct-in-range, T/F-has-2-choices).

### 3. Output post-processing

- [ ] If a model omits `type`, default to `multiple_choice` (the zod default already handles this — verify with a unit test).
- [ ] If a model returns T/F with choices other than `['True', 'False']` (e.g. `['Yes', 'No']`), normalize at the service boundary so the editor doesn't show oddly-labelled T/F.

### 4. Tests

- [ ] [`ai/service.test.ts`](../../backend/src/services/ai/service.test.ts): add a fixture that exercises a mixed MC+T/F response and asserts both pass validation.
- [ ] Snapshot/regex test on the prompt string to catch accidental regressions on the "4 choices" wording.

## Files to touch

```text
backend/
  src/services/ai/service.ts                     # MODIFY: loosen zod, T/F normalization
  src/services/ai/service.test.ts                # MODIFY: mixed-type fixture
  src/services/ai/adapters/straico.ts            # MODIFY: prompt template
  src/services/ai/adapters/openai-compatible.ts  # MODIFY: prompt template
```

## Verification

1. Generate 10 questions on a topic where T/F is natural ("History of computing — fast facts") → response contains a mix of T/F and MC, all validate.
2. Generate 10 questions on a topic with no obvious T/F angle ("Geography of Indonesia") → response is mostly MC; zero validation failures.
3. Force a 6-choice generation ("List 6 …"); response has at least one 5–6 choice question; validates.
4. `cd backend && pnpm test` — new fixtures pass.

## Acceptance criteria

- AI-generated quizzes can include `true_false` questions when the topic warrants it.
- AI-generated MC questions can have 2–6 choices, not just 4.
- No regression on existing topics — generation quality at least matches Phase 3's baseline.
- Validation rejects malformed `type` / `choices` / `correct` combos cleanly with the same error path as Phase 6 manual entry.

## Relation to other plans

- [Phase 7 — Poll / Open Ended / Word Cloud](07-poll-openended-wordcloud.md) extends the type system further; when those land, the AI prompts will need another pass. Phase 7's plan references this doc rather than duplicating the AI work.
- [Improvements — AI Hardening](improvements-ai-hardening.md) is orthogonal (rate limits, cost caps, redaction) — can land before, after, or alongside.
