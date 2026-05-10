<script lang="ts">
  import { onMount } from 'svelte';
  import { getMeetContext, type MeetContext } from '$lib/meet';
  import { api } from '$lib/api';
  import { auth } from '$lib/stores/auth';
  import MeetStage from './MeetStage.svelte';

  let meetContext: MeetContext | null = $state(null);
  let error: string | null = $state(null);
  let loading = $state(true);
  let activeGameId = $state<string | null>(null);

  onMount(async () => {
    // Wait a bit for auth to initialize
    if ($auth.loading) {
      await new Promise(resolve => {
        const unsubscribe = auth.subscribe(s => {
          if (!s.loading) {
            unsubscribe();
            resolve(null);
          }
        });
      });
    }

    meetContext = await getMeetContext();
    if (!meetContext) {
      error = 'Could not initialize Google Meet context.';
      loading = false;
      return;
    }

    // Check if game already exists for this meeting
    try {
      const res = await api(`/games/by-meeting/${meetContext.meetingCode}`);
      if (res.ok) {
        const { gameId } = await res.json();
        activeGameId = gameId;
      }
    } catch (e) {
      console.error('Bootstrap check error:', e);
    } finally {
      loading = false;
    }
  });

  function handleLogin() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';
    const popup = window.open(`${backendUrl}/auth/google`, '_blank', 'width=500,height=600');
    
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'pikirly-auth-success' && event.data.token) {
        const { setAuthToken } = await import('$lib/api');
        setAuthToken(event.data.token);
        await auth.init();
        window.removeEventListener('message', handleMessage);
      }
    };
    window.addEventListener('message', handleMessage);

    // Fallback poll
    const interval = setInterval(async () => {
      // Check localStorage directly for the token
      const { getAuthToken } = await import('$lib/api');
      const token = getAuthToken();
      
      if (token || $auth.user) {
        console.log('Token found via polling, initializing auth...');
        await auth.init();
        if ($auth.user) {
          clearInterval(interval);
          window.removeEventListener('message', handleMessage);
        }
      }
      
      if (popup?.closed) {
        console.log('Login popup closed');
        clearInterval(interval);
        setTimeout(() => window.removeEventListener('message', handleMessage), 1000);
      }
    }, 1000);
  }
</script>

<div class="flex flex-col items-center justify-center p-4 text-center min-h-[400px]">
  {#if loading}
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
    <p>Connecting to Pikirly...</p>
  {:else if error}
    <div class="card bg-error/10 p-6 mb-4 w-full">
      <p class="text-error font-bold">{error}</p>
    </div>
  {:else if $auth.user}
    <!-- Host View -->
    <div class="w-full">
      <div class="flex justify-between items-center mb-4 px-2">
        <h3 class="text-lg font-bold">Host Controls</h3>
        <div class="text-xs muted">{$auth.user.name}</div>
      </div>
      
      {#if activeGameId}
        <div class="card bg-info/10 p-4 mb-4">
          <p class="font-bold">Game in progress!</p>
          <p class="text-sm muted mt-1">Activity is running on the main stage.</p>
          <button class="btn btn-primary btn-sm mt-4 w-full" onclick={() => goto(`/host/${activeGameId}?mode=meet`)}>
            Manage Active Game
          </button>
        </div>
      {/if}

      <MeetStage {meetContext} />
    </div>
  {:else}
    <!-- Participant / Unauthenticated View -->
    <div class="card p-8 w-full max-w-sm">
      <div class="text-4xl mb-4">🎮</div>
      <h3 class="text-xl font-bold mb-2">Pikirly for Meet</h3>
      
      {#if activeGameId}
        <p class="text-primary font-bold mb-4">Game is active!</p>
        <p class="muted mb-6">Look at the main stage (center area) to join and play.</p>
      {:else}
        <p class="muted mb-6">Waiting for the host to start a game on the main stage...</p>
      {/if}

      <div class="mt-8 pt-8 border-t">
        <p class="text-sm muted mb-4">Are you the host?</p>
        <button class="btn btn-secondary w-full" onclick={handleLogin}>
          Sign in to Host
        </button>
      </div>
    </div>
  {/if}
</div>
