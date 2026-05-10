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

### 1. Question templates (Database Persistent)

- [x] Define template structure: `{ id, name, description, category, subcategory, questions: Question[] }`
- [ ] Database Schema: Add `templates` table to Postgres (read-only for hosts, writable by admins).
- [ ] Migration: Seed the `templates` table with starter set (General Knowledge, Tech Trivia, etc.).
- [ ] `GET /templates` — returns list of template stubs from DB.
- [ ] `GET /templates/:id` — returns full template with questions from DB.
- [ ] Frontend: "Start from template" button on `/host` dashboard.
- [ ] (Future/Phase 9+) Admin Panel: UI for admins to add/edit/delete system templates.

### 2. AI question generation (Multi-provider)

- [x] Design pluggable AI service architecture in `backend/src/services/ai/`:
  - [x] `types.ts`: Define `AIProvider` interface and `GenerateQuestionsOptions`.
  - [x] `service.ts`: Central `AIService` orchestrator.
  - [x] `adapters/`: Provider-specific implementations using direct REST (`fetch`):
    - [x] `openai-compatible.ts`: OpenAI Chat Completions (REST). Used for both OpenAI and OpenRouter.
    - [x] `straico.ts`: Straico Native Prompt V1 (REST).
- [x] New REST endpoint `POST /ai/generate-questions`:
  - [x] Auth: JWT (hosts only).
  - [x] Body: `{ topic: string, count: number (1–20), difficulty?: 'easy' | 'medium' | 'hard', provider?: string }`.
  - [x] Calls `AIService.generateQuestions(options)`.
- [x] Prompt design & Validation:
  - [x] System prompt for valid JSON array of `Question` objects.
  - [x] Zod validation of AI output before returning to client.
- [x] Environment Variables:
  - [x] `AI_PROVIDER`: Default provider (e.g., `straico`).
  - [x] `AI_FALLBACK_PROVIDER`: Fallback provider if the primary fails (e.g., `openrouter`).
  - [x] `OPENAI_API_KEY`: API key for OpenAI.
  - [x] `STRAICO_API_KEY`: API key for Straico.
  - [x] `OPENROUTER_API_KEY`: API key for OpenRouter.
- [ ] Rate limit: 5 requests/min per user.
- [x] Frontend: "Generate with AI" button in quiz editor.
  - [x] Drawer/modal: topic input + count slider (1–20) + difficulty select.
  - [ ] Error state for rate limit / API failure.

### 3. Template + AI polish (Deferred / Future Work)

The following items were identified as high-value polish but deferred to prioritize the core template system and database normalization:

- [ ] **AI Rate Limiting**: Implement a 5 requests/min limit per user in the backend to prevent API cost spikes and abuse.
- [ ] **AI Deduplication**: Add logic to the frontend or backend to skip generated questions that already exist (by text match) in the current quiz.
- [ ] **Question Regeneration**: Add a "Regenerate" icon/button to each question row in the editor. Clicking it should call the AI service with the same topic to replace just that specific question.
- [ ] **Template Search Deepening**: Expand search to include specific question content (currently limited to name/description/category).

---

## Technical Debt & Decisions

1. **Normalization**: Moved from static code to a normalized `template_categories` + `templates` table structure to support a future Admin Panel.
2. **Inference Workaround**: Used explicit interfaces in `templateRepo.ts` to solve Drizzle type-collapse issues. This should be reviewed if Drizzle updates its inference engine.
3. **Seed Data Move**: Moved hardcoded data to `backend/src/db/seeds/` to keep live application bundles lean.

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
