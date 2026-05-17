<script lang="ts">
  import { onMount } from 'svelte';
  import { getMeetContext, type MeetContext } from '$lib/meet';
  import { api } from '$lib/api';
  import { auth } from '$lib/stores/auth';
  import MeetStage from './MeetStage.svelte';
  import { playerSession } from '$lib/stores/player';

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

  async function bootstrap() {
    loading = true;
    error = null;
    activeGameId = null;

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
      if (res.status === 404) {
        // Normal: no game exists for this meeting yet. Host UI will let them create one.
        activeGameId = null;
      } else if (res.ok) {
        const data = await res.json();
        if (data.ok) activeGameId = data.gameId;
      } else {
        error = 'Failed to connect to server. Please try again.';
      }
    } catch (e) {
      console.error('Bootstrap check error:', e);
      error = 'A network error occurred during initialization.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void bootstrap();

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
      
      if (event.data?.type === 'pikirly-auth-complete' && event.data.pairingCode === pairingCode) {
        console.log('Auth complete signal received via postMessage');
        // Trigger an immediate manual check for the pairing code
        await auth.init();
        cleanupLogin();
      }
    };
    window.addEventListener('message', loginMessageListener);

    if (!popup) {
      error = 'Login popup was blocked. Please allow popups for this site and try again.';
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
    <div class="card p-6 mb-4 w-full" style="border: 2px solid var(--brand);">
      <p class="font-bold">{error}</p>
    </div>
    <button class="btn btn-primary" onclick={bootstrap}>
      Retry
    </button>
  {:else if $auth.user}
    <!-- Host View -->
    <div class="w-full">
      <div class="flex justify-between items-center mb-4 px-2">
        <h3 class="text-lg font-bold">Host Controls</h3>
        <div class="text-xs muted">{$auth.user.name}</div>
      </div>
      
      {#if activeGameId}
        <div class="card p-6 mb-4 w-full" style="border: 2px solid var(--info);">
          <p class="font-bold">Game in progress!</p>
          <p class="mt-1">Activity is running on the main stage.</p>
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
        <div class="mb-4">
          <p class="font-bold">Game is active!</p>
          <p class="mt-2">Look at the main stage (center area) to join and play.</p>
        </div>
      {:else}
        <div class="mb-6">
          <p>Waiting for the host to start a game on the main stage...</p>
        </div>
      {/if}

      <div class="mt-8 pt-8 border-t">
        <div class="mb-4">
          <p>Are you the host?</p>
        </div>
        <button class="btn btn-secondary w-full" onclick={handleLogin}>
          Sign in to Host
        </button>
      </div>
    </div>
  {/if}
</div>
