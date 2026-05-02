<script lang="ts">
  import { api } from '$lib/api';

  interface Question {
    id: string;
    text: string;
    choices: string[];
    correct: number;
    limitMs: number;
  }

  let { onGenerate = (_questions: Question[]) => {} } = $props();

  let open = $state(false);
  let generating = $state(false);
  let error = $state<string | null>(null);

  let topic = $state('');
  let count = $state(5);
  let difficulty = $state<'easy' | 'medium' | 'hard' | undefined>(undefined);

  function openDrawer() {
    open = true;
    error = null;
  }

  function closeDrawer() {
    open = false;
    error = null;
    topic = '';
    count = 5;
    difficulty = undefined;
  }

  async function generate() {
    if (!topic.trim()) {
      error = 'Topic is required';
      return;
    }

    try {
      generating = true;
      error = null;

      const body: Record<string, unknown> = { topic, count };
      if (difficulty) body.difficulty = difficulty;

      const res = await api('/ai/generate-questions', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        error = 'Too many requests. Please wait a minute and try again.';
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        error = data.message || 'Failed to generate questions';
        return;
      }

      const questions: Question[] = await res.json();
      onGenerate(questions);
      closeDrawer();
    } catch (e) {
      error = 'Error generating questions. Please try again.';
    } finally {
      generating = false;
    }
  }
</script>

<button class="btn-secondary" onclick={openDrawer} style="white-space: nowrap;">
  Generate with AI
</button>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="drawer-overlay"
    onclick={closeDrawer}
    onkeydown={(e) => e.key === 'Escape' && closeDrawer()}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="drawer" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="margin: 0;">Generate with AI</h3>
        <button class="btn-secondary" style="width: auto; padding: 8px 14px;" onclick={closeDrawer}>Close</button>
      </div>

      {#if error}
        <div class="error" style="margin-bottom: 1rem;">{error}</div>
      {/if}

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <div>
          <label for="ai-topic" style="display: block; font-weight: bold; margin-bottom: 0.5rem;">Topic</label>
          <input
            id="ai-topic"
            type="text"
            bind:value={topic}
            placeholder="e.g., World War II, Space Exploration"
            disabled={generating}
          />
        </div>

        <div>
          <label for="ai-count" style="display: block; font-weight: bold; margin-bottom: 0.5rem;">
            Number of Questions: {count}
          </label>
          <input
            id="ai-count"
            type="range"
            min="1"
            max="20"
            bind:value={count}
            disabled={generating}
            style="width: 100%; padding: 0;"
          />
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--muted);">
            <span>1</span>
            <span>20</span>
          </div>
        </div>

        <div>
          <label for="ai-difficulty" style="display: block; font-weight: bold; margin-bottom: 0.5rem;">Difficulty (optional)</label>
          <select id="ai-difficulty" bind:value={difficulty} disabled={generating}>
            <option value={undefined}>Any</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <button class="btn-primary" onclick={generate} disabled={generating || !topic.trim()}>
          {generating ? 'Generating...' : 'Generate Questions'}
        </button>

        {#if generating}
          <p class="muted" style="text-align: center; font-size: 0.9rem;">This may take a few seconds...</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 24px;
  }

  .drawer {
    background: var(--card);
    color: var(--ink);
    border-radius: 22px;
    box-shadow: var(--shadow);
    padding: 32px;
    width: 100%;
    max-width: 480px;
    animation: fadeIn 0.2s ease both;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
