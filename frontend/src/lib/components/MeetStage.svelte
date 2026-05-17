<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { auth } from '$lib/stores/auth';
  import { hostSession } from '$lib/stores/host';
  import { goto } from '$app/navigation';
  import type { MeetContext } from '$lib/meet';

  interface Props {
    meetContext: MeetContext;
  }
  let { meetContext }: Props = $props();

  interface QuizListItem {
    id: string;
    title: string;
    questionCount: number;
    createdAt?: string;
  }

  type SortKey = 'created-desc' | 'created-asc' | 'title-asc' | 'title-desc' | 'count-desc' | 'count-asc';

  let quizzes = $state<QuizListItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let creatingGame = $state(false);
  let createError = $state<string | null>(null);
  let sortBy = $state<SortKey>('created-desc');

  function createdMs(q: QuizListItem): number {
    return q.createdAt ? new Date(q.createdAt).getTime() : 0;
  }

  const sortedQuizzes = $derived.by(() => {
    const arr = [...quizzes];
    switch (sortBy) {
      case 'created-desc': return arr.sort((a, b) => createdMs(b) - createdMs(a));
      case 'created-asc':  return arr.sort((a, b) => createdMs(a) - createdMs(b));
      case 'title-asc':    return arr.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':   return arr.sort((a, b) => b.title.localeCompare(a.title));
      case 'count-desc':   return arr.sort((a, b) => b.questionCount - a.questionCount);
      case 'count-asc':    return arr.sort((a, b) => a.questionCount - b.questionCount);
    }
  });

  let loginPollInterval: ReturnType<typeof setInterval> | null = null;
  let loginMessageListener: ((e: MessageEvent) => void) | null = null;
  let createWindowPoll: ReturnType<typeof setInterval> | null = null;

  function cleanupLogin() {
    if (loginPollInterval) {
      clearInterval(loginPollInterval);
      loginPollInterval = null;
    }
    if (loginMessageListener) {
      window.removeEventListener('message', loginMessageListener);
      loginMessageListener = null;
    }
  }

  function cleanupCreateWindow() {
    if (createWindowPoll) {
      clearInterval(createWindowPoll);
      createWindowPoll = null;
    }
  }

  function openCreateWindow() {
    const w = 900;
    const h = 900;
    const left = Math.max(0, Math.floor((screen.width - w) / 2));
    const top = Math.max(0, Math.floor((screen.height - h) / 2));
    const popup = window.open(
      `${window.location.origin}/host/quiz/new`,
      'pikirly-create-quiz',
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
    if (!popup) {
      createError = 'Could not open quiz editor — please allow popups for this site.';
      return;
    }
    cleanupCreateWindow();
    createWindowPoll = setInterval(() => {
      if (popup.closed) {
        cleanupCreateWindow();
        void loadQuizzes();
      }
    }, 1000);
  }

  onMount(() => {
    auth.init();
    return () => {
      cleanupLogin();
      cleanupCreateWindow();
    };
  });

  $effect(() => {
    if (!$auth.loading && $auth.user) {
      loadQuizzes();
    }
  });

  async function loadQuizzes() {
    try {
      loading = true;
      error = null;
      const res = await api('/quizzes');
      if (res.ok) {
        error = null;
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
    try {
      creatingGame = true;
      createError = null;
      
      const res = await api('/games/by-meeting', {
        method: 'POST',
        body: JSON.stringify({
          meetingCode: meetContext.meetingCode,
          hostQuizId: quizId
        })
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error('Failed to parse create-game response:', jsonErr);
        createError = 'Server returned an invalid response (not JSON).';
        creatingGame = false;
        return;
      }

      if (!res.ok || !data.ok) {
        createError = data.message || `Failed to create game (Error: ${data.error || 'unknown'})`;
        creatingGame = false;
        return;
      }

      const { gameId, hostToken } = data;

      // For Google Meet: we must promote the app to the Main Stage
      try {
        const { getMeetClient } = await import('$lib/meet');
        const client = await getMeetClient();
        
        if (client && typeof client.startActivity === 'function') {
          await client.startActivity({
            mainStageUrl: `${window.location.origin}/?mode=meet&surface=stage`
          });
        }
      } catch (meetErr) {
        console.error('Failed to promote to main stage:', meetErr);
      }

      hostSession.set({ gameId, hostToken });
      
      const { navigateMeet } = await import('$lib/meet');
      await navigateMeet(`/host/${gameId}`);
    } catch (err) {
      console.error(err);
      createError = 'A network error occurred. Please try again.';
      creatingGame = false;
    }
  }

  async function handleLogin() {
    cleanupLogin(); // Clear any previous attempt
    const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';
    
    // Generate a unique pairing code
    const pairingCode = crypto.randomUUID();
    
    const popup = window.open(`${backendUrl}/auth/google?state=${pairingCode}`, '_blank', 'width=500,height=600');
    
    loginMessageListener = async (event: MessageEvent) => {
      // Security: Validate the origin matches our own frontend
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'pikirly-auth-complete' && event.data.pairingCode === pairingCode) {
        console.log('Auth complete signal received via postMessage');
        await auth.init();
        cleanupLogin();
      }
    };
    window.addEventListener('message', loginMessageListener);

    if (!popup) {
      createError = 'Login popup was blocked. Please allow popups and try again.';
      cleanupLogin();
      return;
    }

    // Robust Polling fallback
    console.log('Starting pairing code poll:', pairingCode);
    loginPollInterval = setInterval(async () => {
      if (popup.closed) {
        console.log('Login popup closed');
        // Final attempt then stop
        try {
          const res = await api(`/auth/pairing/poll/${pairingCode}`);
          if (res.ok) {
            const { token } = await res.json();
            const { setAuthToken } = await import('$lib/api');
            setAuthToken(token);
            await auth.init();
          }
        } catch (e) { /* ignore */ }
        cleanupLogin();
        return;
      }

      try {
        const res = await api(`/auth/pairing/poll/${pairingCode}`);
        if (res.ok) {
          const { token } = await res.json();
          console.log('Token received via pairing poll');
          
          const { setAuthToken } = await import('$lib/api');
          setAuthToken(token);
          await auth.init();
          cleanupLogin();
        }
      } catch (e) {
        // ignore errors
      }
    }, 2000);
  }
</script>

<div class="p-8">
  <div class="card max-w-2xl mx-auto">
    {#if $auth.loading}
      <div class="flex justify-center p-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    {:else if !$auth.user}
      <div class="text-center py-12">
        <h2 class="text-2xl font-bold mb-4">Host Pikirly in Meet</h2>
        <p class="mb-8">Sign in with your Google account to host games for your meeting participants.</p>
        <button class="btn btn-primary btn-lg" onclick={handleLogin}>
          Sign in to Pikirly
        </button>
        {#if createError}
          <div class="mt-6 p-4 rounded-lg border-2 border-brand bg-white">
            <p class="text-error font-bold">{createError}</p>
          </div>
        {/if}
      </div>
    {:else}
      <h2 class="meet-heading">Pick a quiz</h2>

      {#if createError}
        <div class="p-4 mb-6 rounded-lg border-2 border-brand bg-white">
          <p class="text-error font-bold">{createError}</p>
        </div>
      {/if}

      {#if loading}
        <p>Loading your quizzes...</p>
      {:else if error}
        <p class="text-error">{error}</p>
      {:else if quizzes.length === 0}
        <div class="text-center py-8">
          <p class="mb-4">You don't have any quizzes yet.</p>
          <button class="btn btn-secondary" onclick={openCreateWindow}>Create your first quiz</button>
        </div>
      {:else}
        <div class="meet-actions">
          <select bind:value={sortBy} class="meet-sort" aria-label="Sort quizzes">
            <option value="created-desc">Newest first</option>
            <option value="created-asc">Oldest first</option>
            <option value="title-asc">Title A→Z</option>
            <option value="title-desc">Title Z→A</option>
            <option value="count-desc">Most questions</option>
            <option value="count-asc">Fewest questions</option>
          </select>
          <button class="btn btn-secondary meet-icon-btn" onclick={loadQuizzes} disabled={loading} aria-label="Refresh quiz list" title="Refresh">↻</button>
          <button class="btn btn-secondary meet-icon-btn" onclick={openCreateWindow} aria-label="Create new quiz" title="New quiz">+ New</button>
        </div>
        <div class="meet-quiz-list">
          {#each sortedQuizzes as quiz}
            <div class="meet-quiz-row">
              <div class="meet-quiz-meta">
                <div class="font-bold">{quiz.title}</div>
                <div class="muted text-sm">{quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}</div>
              </div>
              <button class="btn btn-primary meet-host-btn" onclick={() => hostQuiz(quiz.id)} disabled={creatingGame}>
                {creatingGame ? '…' : 'Host'}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .meet-heading {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0 0 12px 0;
  }
  .meet-actions {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }
  .meet-sort {
    width: 100%;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    font-size: 0.9rem;
  }
  .meet-icon-btn {
    width: auto;
    padding: 8px 12px;
    font-size: 0.9rem;
    white-space: nowrap;
  }
  .meet-quiz-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .meet-quiz-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
  }
  .meet-quiz-row:hover { border-color: var(--brand); }
  .meet-quiz-meta {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  .meet-quiz-meta .font-bold {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meet-host-btn {
    width: auto;
    padding: 8px 14px;
    font-size: 0.9rem;
    flex: 0 0 auto;
  }
</style>
