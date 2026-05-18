<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import AIGenerateDrawer from './AIGenerateDrawer.svelte';
  import type { Question, QuestionType } from '@kahoot/shared';

  const MIN_CHOICES = 2;
  const MAX_CHOICES = 6;

  let {
    quizId = null as string | null,
    templateId = null as string | null,
    initialData = null as { title: string, questions: Question[] } | null
  } = $props();

  let loading = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);

  let title = $state(initialData?.title ?? '');
  let questions = $state<Question[]>(initialData?.questions ?? []);

  onMount(async () => {
    if (quizId) {
      loading = true;
      try {
        const res = await api(`/quizzes/${quizId}`);
        if (res.ok) {
          const data = await res.json();
          title = data.title;
          questions = data.questions;
        } else {
          error = 'Failed to load quiz';
        }
      } catch (e) {
        error = 'Error loading quiz';
      } finally {
        loading = false;
      }
    } else if (templateId) {
      loading = true;
      try {
        const res = await api(`/templates/${templateId}`);
        if (res.ok) {
          const data = await res.json();
          title = data.name;
          // Important: template questions need fresh IDs so they don't collide
          questions = data.questions.map((q: any) => ({
            ...q,
            id: crypto.randomUUID()
          }));
        } else {
          error = 'Failed to load template';
        }
      } catch (e) {
        error = 'Error loading template';
      } finally {
        loading = false;
      }
    }
  });

  function addQuestion() {
    if (questions.length >= 50) return;
    questions = [
      ...questions,
      {
        id: crypto.randomUUID(),
        type: 'multiple_choice',
        text: '',
        choices: ['', '', '', ''],
        correct: 0,
        limitMs: 20000,
      },
    ];
  }

  function removeQuestion(index: number) {
    questions = questions.filter((_, i) => i !== index);
  }

  function setQuestionType(index: number, type: QuestionType) {
    const q = questions[index];
    if (q.type === type) return;
    if (type === 'true_false') {
      q.choices = ['True', 'False'];
      if (q.correct === undefined || q.correct > 1) q.correct = 0;
    } else if (type === 'multiple_choice' && q.type === 'true_false') {
      // T/F → MC: pad to 4 blank choices so the editor feels normal.
      const padded = [...q.choices];
      while (padded.length < 4) padded.push('');
      q.choices = padded;
    }
    q.type = type;
    questions = [...questions];
  }

  function addChoice(index: number) {
    const q = questions[index];
    if (q.type !== 'multiple_choice' || q.choices.length >= MAX_CHOICES) return;
    q.choices = [...q.choices, ''];
    questions = [...questions];
  }

  function removeChoice(qIndex: number, choiceIndex: number) {
    const q = questions[qIndex];
    if (q.type !== 'multiple_choice' || q.choices.length <= MIN_CHOICES) return;
    q.choices = q.choices.filter((_, i) => i !== choiceIndex);
    if (q.correct !== undefined) {
      if (q.correct === choiceIndex) q.correct = 0;
      else if (q.correct > choiceIndex) q.correct = q.correct - 1;
    }
    questions = [...questions];
  }

  function onAIGenerate(generated: Question[]) {
    questions = [...questions, ...generated].slice(0, 50);
  }

  function closeOrGoHost() {
    if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
      window.close();
    } else {
      goto('/host');
    }
  }

  async function save() {
    if (!title.trim()) {
      error = 'Title is required';
      return;
    }
    if (questions.length === 0) {
      error = 'At least one question is required';
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        error = `Question ${i + 1} text is required`;
        return;
      }
      if (q.type === 'true_false') {
        if (q.choices.length !== 2) {
          error = `Question ${i + 1} (True/False) must have exactly 2 choices`;
          return;
        }
      } else {
        if (q.choices.length < MIN_CHOICES || q.choices.length > MAX_CHOICES) {
          error = `Question ${i + 1} must have between ${MIN_CHOICES} and ${MAX_CHOICES} choices`;
          return;
        }
      }
      if (q.choices.some((c: string) => !c.trim())) {
        error = `Question ${i + 1} must have all choices filled`;
        return;
      }
      if (q.correct === undefined || q.correct < 0 || q.correct >= q.choices.length) {
        error = `Question ${i + 1} must have a correct answer selected`;
        return;
      }
    }

    try {
      saving = true;
      error = null;
      const res = await api(quizId ? `/quizzes/${quizId}` : '/quizzes', {
        method: quizId ? 'PUT' : 'POST',
        body: JSON.stringify({ title, questions }),
      });
      if (res.ok) {
        closeOrGoHost();
      } else {
        const data = await res.json();
        error = data.message || 'Failed to save quiz';
      }
    } catch (e) {
      error = 'Error saving quiz';
    } finally {
      saving = false;
    }
  }
</script>

<div class="center" style="align-items: flex-start; padding-top: 4rem; padding-bottom: 4rem;">
  <div class="card fade-in" style="max-width: 800px; width: 100%;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h2 style="margin: 0;">{quizId ? 'Edit Quiz' : 'Create New Quiz'}</h2>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn-secondary" onclick={closeOrGoHost} disabled={saving}>Cancel</button>
        <button class="btn-primary" onclick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Quiz'}</button>
      </div>
    </div>

    {#if error}
      <div class="error" style="margin-bottom: 1rem;">{error}</div>
    {/if}

    {#if loading}
      <p>Loading...</p>
    {:else}
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        <div>
          <label for="quiz-title" style="display: block; font-weight: bold; margin-bottom: 0.5rem;">Quiz Title</label>
          <input
            id="quiz-title"
            type="text"
            bind:value={title}
            placeholder="e.g., Geography Trivia"
            style="width: 100%; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 1rem;"
          />
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0;">Questions ({questions.length}/50)</h3>
            <div style="display: flex; gap: 0.5rem;">
              <AIGenerateDrawer onGenerate={onAIGenerate} />
              <button class="btn-secondary" onclick={addQuestion} disabled={questions.length >= 50}>+ Add Question</button>
            </div>
          </div>

          {#if questions.length === 0}
            <div style="text-align: center; padding: 2rem; border: 1px dashed #cbd5e1; border-radius: 8px;">
              <p class="muted">No questions yet.</p>
            </div>
          {:else}
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              {#each questions as question, index}
                <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; position: relative;">
                  <button
                    class="btn-secondary"
                    style="position: absolute; top: 1rem; right: 1rem; padding: 0.25rem 0.5rem; color: #ef4444; border-color: transparent;"
                    onclick={() => removeQuestion(index)}
                    aria-label="Remove question"
                  >
                    Remove
                  </button>

                  <div style="font-weight: bold; margin-bottom: 1rem;">Question {index + 1}</div>

                  <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
                    <div style="flex: 0 0 200px;">
                      <label for="q-type-{index}" style="display: block; font-size: 0.9rem; margin-bottom: 0.25rem;">Type</label>
                      <select
                        id="q-type-{index}"
                        value={question.type}
                        onchange={(e) => setQuestionType(index, (e.currentTarget as HTMLSelectElement).value as QuestionType)}
                        style="width: 100%; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px;"
                      >
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="true_false">True / False</option>
                      </select>
                    </div>
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; align-self: flex-end; padding-bottom: 0.5rem;">
                      <input type="checkbox" bind:checked={question.randomizeChoices} />
                      Randomize choice order per player
                    </label>
                  </div>

                  <div style="margin-bottom: 1rem;">
                    <label for="q-text-{index}" style="display: block; font-size: 0.9rem; margin-bottom: 0.25rem;">Question Text</label>
                    <input
                      id="q-text-{index}"
                      type="text"
                      bind:value={question.text}
                      placeholder="e.g., What is the capital of France?"
                      style="width: 100%; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px;"
                    />
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    {#each question.choices as _choice, choiceIndex}
                      <div>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; margin-bottom: 0.25rem;">
                          <input type="radio" bind:group={question.correct} value={choiceIndex} name="correct-{index}" />
                          Choice {choiceIndex + 1} {question.correct === choiceIndex ? '(Correct)' : ''}
                          {#if question.type === 'multiple_choice' && question.choices.length > MIN_CHOICES}
                            <button
                              type="button"
                              onclick={() => removeChoice(index, choiceIndex)}
                              aria-label="Remove choice {choiceIndex + 1}"
                              style="margin-left: auto; background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 0 4px;"
                            >×</button>
                          {/if}
                        </label>
                        <input
                          type="text"
                          bind:value={question.choices[choiceIndex]}
                          placeholder={`Option ${choiceIndex + 1}`}
                          aria-label="Question {index + 1} choice {choiceIndex + 1}"
                          disabled={question.type === 'true_false'}
                          style="width: 100%; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px; border-left: 4px solid {question.correct === choiceIndex ? '#10b981' : '#e5e7eb'};"
                        />
                      </div>
                    {/each}
                  </div>

                  {#if question.type === 'multiple_choice' && question.choices.length < MAX_CHOICES}
                    <div style="margin-bottom: 1rem;">
                      <button class="btn-secondary" onclick={() => addChoice(index)} style="padding: 0.4rem 0.75rem;">
                        + Add choice ({question.choices.length}/{MAX_CHOICES})
                      </button>
                    </div>
                  {/if}

                  <div>
                    <label for="q-limit-{index}" style="display: block; font-size: 0.9rem; margin-bottom: 0.25rem;">Time Limit</label>
                    <select
                      id="q-limit-{index}"
                      bind:value={question.limitMs}
                      style="width: 100%; max-width: 200px; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px;"
                    >
                      <option value={10000}>10 seconds</option>
                      <option value={15000}>15 seconds</option>
                      <option value={20000}>20 seconds</option>
                      <option value={30000}>30 seconds</option>
                      <option value={60000}>1 minute</option>
                    </select>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
