# Phase 3 — Templates + AI Generation

**Status**: Next
**Depends on**: Phase 2 (quiz CRUD + editor)
**Goal**: Hosts can start from a template instead of a blank quiz, and can generate quiz questions automatically by giving a prompt + question count to an AI.

## Why this phase

Blank-slate creation is friction. Templates and AI generation lower the barrier to hosting — a teacher can have a 10-question quiz ready in 30 seconds.

## Out of scope (intentional)

- AI grading of open-ended answers (Phase 7+)
- Community template marketplace / sharing
- Fine-tuned model (use Claude API off-the-shelf)
- Image/media in generated questions

## Deliverables

### 1. Question templates

- [ ] Define built-in template library in `backend/src/data/templates.ts`:
  - Each template: `{ id, name, description, questions: Question[] }`
  - Starter set: General Knowledge, True/False Sampler, Ice Breaker, Tech Trivia
- [ ] `GET /templates` — returns list of template stubs (id, name, description, question count)
- [ ] `GET /templates/:id` — returns full template with questions
- [ ] Frontend: "Start from template" button on `/host` dashboard
  - Modal or page listing templates with preview
  - On select → pre-populate quiz editor with template questions (editable)
- [ ] Templates are read-only system data — not stored in DB, no CRUD

### 2. AI question generation (Multi-provider)

- [ ] Design pluggable AI service architecture in `backend/src/services/ai/`:
  - `types.ts`: Define `AIProvider` interface and `GenerateQuestionsOptions`.
  - `service.ts`: Central `AIService` orchestrator.
  - `adapters/`: Provider-specific implementations using direct REST (`fetch`):
    - `openai-compatible.ts`: OpenAI Chat Completions (REST). Used for both OpenAI and OpenRouter.
    - `straico.ts`: Straico Native Prompt V1 (REST).
- [ ] New REST endpoint `POST /ai/generate-questions`:
  - Auth: JWT (hosts only).
  - Body: `{ topic: string, count: number (1–20), difficulty?: 'easy' | 'medium' | 'hard', provider?: string }`.
  - Calls `AIService.generateQuestions(options)`.
- [ ] Prompt design & Validation:
  - System prompt for valid JSON array of `Question` objects.
  - Zod validation of AI output before returning to client.
- [ ] Environment Variables:
  - `AI_PROVIDER`: Default provider (e.g., `straico`).
  - `AI_FALLBACK_PROVIDER`: Fallback provider if the primary fails (e.g., `openrouter`).
  - `OPENAI_API_KEY`: API key for OpenAI.
  - `STRAICO_API_KEY`: API key for Straico.
  - `OPENROUTER_API_KEY`: API key for OpenRouter.
- [ ] Rate limit: 5 requests/min per user.
- [ ] Frontend: "Generate with AI" button in quiz editor.
  - Drawer/modal: topic input + count slider (1–20) + difficulty select.
  - Error state for rate limit / API failure.

### 3. Template + AI polish

- [ ] Validate generated questions server-side with zod before returning (safety net)
- [ ] Deduplicate: if generated question text matches existing question in quiz, skip
- [ ] "Regenerate" button per question in editor (re-generates single question with same topic)

## Files to touch

```
backend/
  src/data/templates.ts                  # NEW — built-in template definitions
  src/routes/template.routes.ts          # NEW — GET /templates, GET /templates/:id
  src/routes/ai.routes.ts                # NEW — POST /ai/generate-questions
  src/server.ts                          # MODIFY — register new routes
  .env.example                           # MODIFY — add ANTHROPIC_API_KEY

frontend/
  src/routes/host/+page.svelte           # MODIFY — "Start from template" button
  src/lib/components/TemplateModal.svelte  # NEW
  src/lib/components/AIGenerateDrawer.svelte  # NEW
  src/routes/host/quiz/new/+page.svelte  # MODIFY — accept template pre-fill
```

## Verification

1. `GET /templates` returns template list; `GET /templates/:id` returns full questions
2. Pick template → quiz editor pre-filled with questions → save → game works
3. `POST /ai/generate-questions` with `{ topic: "World War II", count: 5 }` → returns 5 valid questions
4. Generated questions append to editor, editable
5. 6th request in 1 min → 429 rate limit response
6. Invalid AI output (malformed JSON) → 502 with clear error, not crash
7. `tsc --noEmit` + `svelte-check` pass

## Acceptance criteria

- Host can start a quiz from a template in < 10 seconds
- Host can generate 10 questions on any topic in < 30 seconds
- Generated questions pass zod validation 100% of the time
- AI generation failure shows friendly error, does not lose existing quiz state
