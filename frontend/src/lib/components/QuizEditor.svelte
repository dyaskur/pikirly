<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  interface Question {
    id: string;
    text: string;
    choices: string[];
    correct: number;
    limitMs: number;
  }

  let { quizId = null as string | null } = $props();

  let loading = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);

  let title = $state('');
  let questions = $state<Question[]>([]);

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
    }
  });

  function addQuestion() {
    questions = [
      ...questions,
      {
        id: crypto.randomUUID(),
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
      if (q.choices.some((c: string) => !c.trim())) {
        error = `Question ${i + 1} must have all 4 choices filled`;
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
        goto('/host');
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
        <button class="btn-secondary" onclick={() => goto('/host')} disabled={saving}>Cancel</button>
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
            <h3 style="margin: 0;">Questions</h3>
            <button class="btn-secondary" onclick={addQuestion}>+ Add Question</button>
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
                    {#each question.choices as choice, choiceIndex}
                      <div>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; margin-bottom: 0.25rem;">
                          <input type="radio" bind:group={question.correct} value={choiceIndex} name="correct-{index}" />
                          Choice {choiceIndex + 1} {question.correct === choiceIndex ? '(Correct)' : ''}
                        </label>
                        <input
                          type="text"
                          bind:value={question.choices[choiceIndex]}
                          placeholder={`Option ${choiceIndex + 1}`}
                          aria-label="Question {index + 1} choice {choiceIndex + 1}"
                          style="width: 100%; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px; border-left: 4px solid {question.correct === choiceIndex ? '#10b981' : '#e5e7eb'};"
                        />
                      </div>
                    {/each}
                  </div>

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
