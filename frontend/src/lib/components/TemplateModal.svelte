<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { TemplateStub, Template } from '@kahoot/shared';

  interface Props {
    onSelect?: (template: Template) => void;
    onClose?: () => void;
  }

  let { onSelect = () => {}, onClose = () => {} }: Props = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let templates = $state<TemplateStub[]>([]);
  let selectedId = $state<string | null>(null);
  let searchTerm = $state('');

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

  // Filter and group templates by category then subcategory
  const grouped = $derived(() => {
    const term = searchTerm.toLowerCase().trim();
    const filtered = term 
      ? templates.filter(t => 
          t.name.toLowerCase().includes(term) || 
          t.description.toLowerCase().includes(term) ||
          t.category.toLowerCase().includes(term) ||
          t.subcategory.toLowerCase().includes(term)
        )
      : templates;

    const groups: Record<string, Record<string, TemplateStub[]>> = {};
    for (const t of filtered) {
      if (!groups[t.category]) groups[t.category] = {};
      if (!groups[t.category][t.subcategory]) groups[t.category][t.subcategory] = [];
      groups[t.category][t.subcategory].push(t);
    }
    return groups;
  });
</script>

<div class="modal-overlay" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()}>
  <div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <div class="modal-header" style="display: flex; flex-direction: column; gap: 1.5rem;">
      <h2 style="margin: 0;">Start from Template</h2>
      <button class="btn-secondary close-btn" onclick={onClose}>&times;</button>
      
      <div class="search-container">
        <input 
          type="text" 
          bind:value={searchTerm} 
          placeholder="Search templates, categories, or topics..."
          class="search-input"
        />
        {#if searchTerm}
          <button class="clear-search" onclick={() => searchTerm = ''}>&times;</button>
        {/if}
      </div>
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
      {:else if Object.keys(grouped()).length === 0}
        <div class="center-state">
          <p class="muted">No templates match "{searchTerm}"</p>
          <button class="btn-secondary" onclick={() => searchTerm = ''}>Clear search</button>
        </div>
      {:else}
        {#each Object.entries(grouped()) as [category, subcategories]}
          <div class="category-section">
            <h3 class="category-title">{category}</h3>
            <div class="template-grid">
              {#each Object.entries(subcategories) as [subcategory, items]}
                {#each items as template}
                  <button 
                    class="template-card" 
                    class:selected={selectedId === template.id}
                    onclick={() => handleSelect(template.id)}
                  >
                    <div class="template-info">
                      {#if subcategory}
                        <span class="subcategory-tag">{subcategory}</span>
                      {/if}
                      <strong>{template.name}</strong>
                      <p class="description">{template.description}</p>
                      <span class="q-count">{template.questionCount} Questions</span>
                    </div>
                  </button>
                {/each}
              {/each}
            </div>
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
    max-width: 900px;
    max-height: 85vh;
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
    position: relative;
    --brand-rgb: 99, 102, 241; /* Indigo-500 equivalent */
  }

  .modal-header {
    padding: 32px 32px 24px 32px;
    border-bottom: 1px solid #f3f4f6;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.75rem;
    font-weight: 800;
    color: #111827;
  }

  .close-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    line-height: 1;
    border-radius: 8px;
    background: #f3f4f6;
    border: none;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 10;
  }

  .close-btn:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  .search-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    padding-right: 2.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--brand);
    box-shadow: 0 0 0 3px rgba(var(--brand-rgb, 59, 130, 246), 0.1);
  }

  .clear-search {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0 4px;
  }

  .clear-search:hover {
    color: #4b5563;
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
    margin-bottom: 1.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  .template-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  .subcategory-tag {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--brand);
    background: rgba(var(--brand-rgb, 59, 130, 246), 0.1);
    padding: 2px 8px;
    border-radius: 4px;
    margin-bottom: 8px;
    letter-spacing: 0.025em;
  }

  .template-card:hover {
    border-color: var(--brand);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    transform: translateY(-4px);
  }

  .template-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--brand);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .template-card:hover::before {
    opacity: 1;
  }

  .template-card.selected {
    border-color: var(--brand);
    border-width: 2px;
    padding: 19px; /* Compensate for thicker border to prevent jump */
  }

  .template-card.selected::before {
    opacity: 1;
  }

  .template-info strong {
    display: block;
    margin-bottom: 8px;
    font-size: 1.1rem;
    color: #1f2937;
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
