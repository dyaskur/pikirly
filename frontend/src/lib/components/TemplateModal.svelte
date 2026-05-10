<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { TemplateStub, Template } from '@kahoot/shared';

  let { onSelect = (_template: Template) => {}, onClose = () => {} } = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let templates = $state<TemplateStub[]>([]);
  let selectedId = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await api('/templates');
      if (res.ok) {
        templates = await res.json();
      } else {
        error = 'Failed to load templates';
      }
    } catch (e) {
      error = 'Error connecting to server';
    } finally {
      loading = false;
    }
  });

  async function handleSelect(id: string) {
    selectedId = id;
    try {
      const res = await api(`/templates/${id}`);
      if (res.ok) {
        const fullTemplate: Template = await res.json();
        onSelect(fullTemplate);
        onClose();
      } else {
        error = 'Failed to load template details';
      }
    } catch (e) {
      error = 'Error loading template';
    }
  }

  // Group templates by category then subcategory
  const grouped = $derived(() => {
    const groups: Record<string, Record<string, TemplateStub[]>> = {};
    for (const t of templates) {
      if (!groups[t.category]) groups[t.category] = {};
      if (!groups[t.category][t.subcategory]) groups[t.category][t.subcategory] = [];
      groups[t.category][t.subcategory].push(t);
    }
    return groups;
  });
</script>

<div class="modal-overlay" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()}>
  <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="modal-header">
      <h2>Start from Template</h2>
      <button class="btn-secondary close-btn" onclick={onClose}>&times;</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="center-state">
          <div class="spinner"></div>
          <p>Loading templates...</p>
        </div>
      {:else if error}
        <div class="error">{error}</div>
      {:else if templates.length === 0}
        <p class="muted center-state">No templates available yet.</p>
      {:else}
        {#each Object.entries(grouped()) as [category, subcategories]}
          <div class="category-section">
            <h3 class="category-title">{category}</h3>
            {#each Object.entries(subcategories) as [subcategory, items]}
              <div class="subcategory-section">
                <h4 class="subcategory-title">{subcategory}</h4>
                <div class="template-grid">
                  {#each items as template}
                    <button 
                      class="template-card" 
                      class:selected={selectedId === template.id}
                      onclick={() => handleSelect(template.id)}
                    >
                      <div class="template-info">
                        <strong>{template.name}</strong>
                        <p class="description">{template.description}</p>
                        <span class="q-count">{template.questionCount} Questions</span>
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-content {
    background: var(--card);
    width: 100%;
    max-width: 800px;
    max-height: 85vh;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  }

  .modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .close-btn {
    font-size: 1.5rem;
    padding: 4px 12px;
    line-height: 1;
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }

  .category-section {
    margin-bottom: 2rem;
  }

  .category-title {
    font-size: 1.25rem;
    color: var(--brand);
    border-bottom: 2px solid var(--brand);
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }

  .subcategory-section {
    margin-left: 1rem;
    margin-bottom: 1.5rem;
  }

  .subcategory-title {
    font-size: 1rem;
    color: #4b5563;
    margin-bottom: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .template-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .template-card:hover {
    border-color: var(--brand);
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    transform: translateY(-2px);
  }

  .template-card.selected {
    border-color: var(--brand);
    background: #f0f7ff;
  }

  .template-info strong {
    display: block;
    margin-bottom: 4px;
    font-size: 1rem;
  }

  .description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 12px 0;
    flex: 1;
  }

  .q-count {
    font-size: 0.75rem;
    background: #f3f4f6;
    padding: 2px 8px;
    border-radius: 999px;
    color: #374151;
  }

  .center-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid var(--brand);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
