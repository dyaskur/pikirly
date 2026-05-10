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

  onMount(async () => {
    await auth.init();
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
      const res = await api('/games/by-meeting', {
        method: 'POST',
        body: JSON.stringify({
          meetingCode: meetContext.meetingCode,
          hostQuizId: quizId
        })
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || 'Failed to create game');
        return;
      }

      const { gameId, hostToken } = await res.json();

      // For Google Meet: we must promote the app to the Main Stage
      try {
        const sdk = await import('@googleworkspace/meet-addons');
        const meet = sdk.meet || sdk;
        const addon = meet.addon || meet;
        const session = await addon.createAddonSession({
          cloudProjectNumber: '798042367810'
        });
        const sidePanelClient = await session.createSidePanelClient();
        
        await sidePanelClient.startActivity({
          mainStageUrl: `${window.location.origin}/?mode=meet&surface=stage`
        });
      } catch (meetErr) {
        console.error('Failed to promote to main stage:', meetErr);
      }

      hostSession.set({ gameId, hostToken });
      goto(`/host/${gameId}`);
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    }
  }

  function handleLogin() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';
    const popup = window.open(`${backendUrl}/auth/google`, '_blank', 'width=500,height=600');
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'pikirly-auth-success') {
        auth.init();
        window.removeEventListener('message', handleMessage);
      }
    };
    window.addEventListener('message', handleMessage);

    // Fallback poll
    const interval = setInterval(async () => {
      await auth.init();
      if ($auth.user) {
        clearInterval(interval);
        window.removeEventListener('message', handleMessage);
      }
      if (popup?.closed) {
        clearInterval(interval);
        window.removeEventListener('message', handleMessage);
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
              <button class="btn btn-primary" onclick={() => hostQuiz(quiz.id)}>
                Host in Meeting
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>
