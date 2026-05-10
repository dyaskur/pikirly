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
  }

  let quizzes = $state<QuizListItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let creatingGame = $state(false);
  let createError = $state<string | null>(null);

  let loginPollInterval: ReturnType<typeof setInterval> | null = null;
  let loginMessageListener: ((e: MessageEvent) => void) | null = null;

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

  onMount(() => {
    auth.init();
    return () => {
      cleanupLogin();
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

      console.log('[DEBUG] Server response status:', res.status);
      let data;
      try {
        data = await res.json();
        console.log('[DEBUG] Server response body:', data);
      } catch (jsonErr) {
        console.error('[DEBUG] Failed to parse JSON:', jsonErr);
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

      if (event.data?.type === 'pikirly-auth-success' && event.data.token) {
        console.log('Token received via postMessage');
        const { setAuthToken } = await import('$lib/api');
        setAuthToken(event.data.token);
        await auth.init();
        cleanupLogin();
      }
    };
    window.addEventListener('message', loginMessageListener);

    // Robust Polling fallback
    console.log('Starting pairing code poll:', pairingCode);
    loginPollInterval = setInterval(async () => {
      if (popup?.closed) {
        console.log('Login popup closed');
        // Give it one last check then stop
        setTimeout(cleanupLogin, 2000);
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
        <p class="muted mb-8">Sign in with your Google account to host games for your meeting participants.</p>
        <button class="btn btn-primary btn-lg" onclick={handleLogin}>
          Sign in to Pikirly
        </button>
      </div>
    {:else}
      <div class="flex justify-between items-center mb-8">
        <h2 class="text-2xl font-bold">Pick a quiz for this meeting</h2>
        <div class="text-sm muted">Signed in as {$auth.user.name}</div>
      </div>

      {#if createError}
        <div class="card bg-error/10 p-4 mb-6">
          <p class="text-error font-bold">{createError}</p>
        </div>
      {/if}

      {#if loading}
        <p>Loading your quizzes...</p>
      {:else if error}
        <p class="text-error">{error}</p>
      {:else if quizzes.length === 0}
        <div class="text-center py-8">
          <p class="muted mb-4">You don't have any quizzes yet.</p>
          <a href="/host/quiz/new" target="_blank" class="btn btn-secondary">Create a quiz in new tab</a>
        </div>
      {:else}
        <div class="grid gap-4">
          {#each quizzes as quiz}
            <div class="flex justify-between items-center p-4 border rounded-lg hover:border-primary transition-colors">
              <div>
                <div class="font-bold">{quiz.title}</div>
                <div class="text-sm muted">{quiz.questionCount} questions</div>
              </div>
              <button class="btn btn-primary" onclick={() => hostQuiz(quiz.id)} disabled={creatingGame}>
                {creatingGame ? 'Starting...' : 'Host in Meeting'}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>
