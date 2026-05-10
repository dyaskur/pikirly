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
    const init = async () => {
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
        const data = await res.json();
        if (res.ok && data.ok) {
          activeGameId = data.gameId;
        }
      } catch (e) {
        console.error('Bootstrap check error:', e);
      } finally {
        loading = false;
      }
    };

    void init();

    return () => {
      cleanupLogin();
    };
  });

  async function handleLogin() {
    cleanupLogin(); // Clear any previous attempt
    const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';
    
    // Generate a unique pairing code for this login attempt
    const pairingCode = crypto.randomUUID();
    
    // Open the login popup with the pairing code in the state parameter
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
        // ignore errors during poll
      }
    }, 2000);
  }

  async function handleManageActive() {
    if (!activeGameId) return;
    
    // Attempt to promote to main stage again just in case it closed
    try {
      const { getMeetClient } = await import('$lib/meet');
      const client = await getMeetClient();
      if (client && typeof client.startActivity === 'function') {
        console.log('[BOOTSTRAP] Re-promoting active game to Main Stage:', activeGameId);
        await client.startActivity({
          mainStageUrl: `${window.location.origin}/?mode=meet&surface=stage`
        });
      }
    } catch (e) {
      console.error('[BOOTSTRAP] Failed to re-promote:', e);
    }
    
    const { navigateMeet } = await import('$lib/meet');
    await navigateMeet(`/host/${activeGameId}`);
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
          <button class="btn btn-primary btn-sm mt-4 w-full" onclick={handleManageActive}>
            Manage Active Game
          </button>
        </div>
      {/if}

      <MeetStage meetContext={meetContext!} />
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
