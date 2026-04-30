<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { auth } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { getSocket } from '$lib/socket';
  import { hostSession } from '$lib/stores/host';
  import type { Quiz } from '../../../../shared/src/index'; // Wait, let's just define a local type or import from shared. Wait, the prompt says "The backend currently allows optional for the default quiz". The shared/src/index.ts I read doesn't have Quiz exported. I'll define it here.

  let quizzes = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!$auth.loading && !$auth.user) {
      goto('/login');
    }
  });

  onMount(async () => {
    if (!$auth.loading && $auth.user) {
      loadQuizzes();
    }
  });

  // Watch for auth state changes if we mount while loading
  $effect(() => {
    if (!$auth.loading && $auth.user && loading && quizzes.length === 0 && !error) {
      loadQuizzes();
    }
  });

  async function loadQuizzes() {
    try {
      loading = true;
      const res = await api('/quizzes');
      if (res.ok) {
        quizzes = await res.json();
      } else {
        error = 'Failed to load quizzes';
      }
    } catch (e) {
      error = 'Error loading quizzes';
    } finally {
      loading = false;
    }
  }

  async function hostQuiz(quizId: string) {
    const socket = getSocket();
    socket.emit('create_game', { quizId }, (res) => {
      if (!res.ok) {
        alert(res.error || 'Failed to create game');
        return;
      }
      hostSession.set({ gameId: res.gameId, hostToken: res.hostToken });
      goto(`/host/${res.gameId}`);
    });
  }

  async function deleteQuiz(id: string) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      const res = await api(`/quizzes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        quizzes = quizzes.filter(q => q.id !== id);
      } else {
        alert('Failed to delete quiz');
      }
    } catch (e) {
      alert('Error deleting quiz');
    }
  }

  async function logout() {
    await auth.logout();
    goto('/');
  }
</script>

<div class="center" style="align-items: flex-start; padding-top: 4rem;">
  <div class="card fade-in" style="max-width: 800px; width: 100%;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <div style="display: flex; flex-direction: column;">
        <h2 style="margin: 0;">My Quizzes</h2>
        {#if $auth.user}
          <div class="muted" style="font-size: 0.9rem;">Signed in as {$auth.user.name}</div>
        {/if}
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <button class="btn-primary" onclick={() => goto('/host/quiz/new')}>Create new quiz</button>
        <button class="btn-secondary" onclick={logout}>Logout</button>
      </div>
    </div>

    {#if loading}
      <p>Loading...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if quizzes.length === 0}
      <div style="text-align: center; padding: 2rem 0;">
        <p class="muted">You haven't created any quizzes yet.</p>
        <button class="btn-primary" style="margin-top: 1rem;" onclick={() => goto('/host/quiz/new')}>Create your first quiz</button>
      </div>
    {:else}
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        {#each quizzes as quiz}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div>
              <div style="font-weight: bold; font-size: 1.1rem;">{quiz.title}</div>
              <div class="muted" style="font-size: 0.9rem;">{quiz.questions?.length || 0} questions</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn-primary" onclick={() => hostQuiz(quiz.id)}>Host</button>
              <button class="btn-secondary" onclick={() => goto(`/host/quiz/${quiz.id}/edit`)}>Edit</button>
              <button class="btn-secondary" style="color: var(--danger, #ef4444); border-color: transparent;" onclick={() => deleteQuiz(quiz.id)}>Delete</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
