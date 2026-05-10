<script lang="ts">
  import { onMount } from 'svelte';
  import { getMeetContext, type MeetContext } from '$lib/meet';
  import { api } from '$lib/api';
  import { getSocket } from '$lib/socket';
  import { playerSession } from '$lib/stores/player';
  import { goto } from '$app/navigation';

  import { auth } from '$lib/stores/auth';

  let meetContext: MeetContext | null = $state(null);
  let error: string | null = $state(null);
  let loading = $state(true);
  let nickname = $state('');

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

    if (meetContext.surface === 'side') {
      // If we already have a session for this game, try to reconnect
      const sess = $playerSession;
      if (sess) {
        // Find game first to be sure
        const res = await api(`/games/by-meeting/${meetContext.meetingCode}`);
        if (res.ok) {
          const { gameId } = await res.json();
          if (sess.gameId === gameId) {
            goto(`/play/${gameId}`);
            return;
          }
        }
      }

      await bootstrapPlayer();
    } else {
      loading = false;
    }
  });

  async function bootstrapPlayer() {
    try {
      // Find game for this meeting
      const res = await api(`/games/by-meeting/${meetContext!.meetingCode}`);
      if (res.status === 404) {
        error = 'No active game found for this meeting. Waiting for host...';
        loading = false;
        return;
      }

      if (!res.ok) {
        error = 'Failed to find game.';
        loading = false;
        return;
      }

      const { gameId } = await res.json();
      
      // Auto-join if we have identity
      const effectiveNickname = $auth.user?.name || nickname;
      
      if (effectiveNickname) {
        performJoin(gameId, effectiveNickname);
      } else {
        loading = false;
      }
    } catch (err) {
      console.error(err);
      error = 'An error occurred during bootstrap.';
      loading = false;
    }
  }

  function performJoin(gameId: string, name: string) {
    loading = true;
    error = null;
    const socket = getSocket();
    socket.emit('join_game', {
      gameId,
      nickname: name,
      meetParticipantId: meetContext!.participantId,
      meetDisplayName: name
    }, (response) => {
      if (response.ok) {
        playerSession.set({
          gameId,
          playerId: response.playerId,
          playerToken: response.playerToken,
          nickname: name
        });
        goto(`/play/${gameId}`);
      } else {
        error = response.error;
        loading = false;
      }
    });
  }

  function handleManualJoin(e: Event) {
    e.preventDefault();
    if (!nickname.trim()) return;
    
    // Find game again (or use cached if we stored it)
    api(`/games/by-meeting/${meetContext!.meetingCode}`).then(async res => {
      if (res.ok) {
        const { gameId } = await res.json();
        performJoin(gameId, nickname);
      } else {
        error = 'Game no longer available.';
      }
    });
  }
</script>

<div class="flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
  {#if loading}
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
    <p>Connecting to Pikirly...</p>
  {:else if error}
    <div class="card bg-error/10 p-6 mb-4">
      <p class="text-error font-bold">{error}</p>
    </div>
    {#if error.includes('No active game found')}
      <button class="btn btn-primary" onclick={() => { loading = true; error = null; bootstrapPlayer(); }}>
        Retry
      </button>
    {/if}
  {:else if !nickname && !$auth.user}
    <div class="card p-6 w-full max-w-sm">
      <h3 class="text-xl font-bold mb-4">Join the Game</h3>
      <form onsubmit={handleManualJoin} class="spaced">
        <input 
          type="text" 
          placeholder="Enter nickname" 
          bind:value={nickname}
          maxlength="24"
          class="text-center"
        />
        <button type="submit" class="btn-primary" disabled={!nickname.trim()}>
          Join
        </button>
      </form>
      <div class="my-4 text-sm muted">or</div>
      <button class="btn-secondary w-full" onclick={() => goto('/login')}>
        Sign in with Google
      </button>
    </div>
  {/if}
</div>
