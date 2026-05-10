<script lang="ts">
  import { onMount } from 'svelte';
  import { getMeetContext, type MeetContext } from '$lib/meet';
  import { api } from '$lib/api';
  import { getSocket } from '$lib/socket';
  import { playerSession } from '$lib/stores/player';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import MeetStage from './MeetStage.svelte';

  let meetContext: MeetContext | null = $state(null);
  let error: string | null = $state(null);
  let loading = $state(true);
  let nickname = $state('');
  let showHostUI = $state(false);

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
      loading = true;
      // Find game for this meeting
      const res = await api(`/games/by-meeting/${meetContext!.meetingCode}`);
      if (res.status === 404) {
        // No game found. If user is signed in, default to host UI if no one else has started it
        if ($auth.user) {
          showHostUI = true;
        }
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

<div class="flex flex-col items-center justify-center p-4 text-center min-h-[400px]">
  {#if showHostUI && meetContext}
    <div class="w-full">
      <div class="flex justify-between items-center mb-4 px-2">
        <h3 class="text-lg font-bold">Host a Quiz</h3>
        <button class="text-sm text-primary underline" onclick={() => { showHostUI = false; bootstrapPlayer(); }}>
          Cancel
        </button>
      </div>
      <MeetStage {meetContext} />
    </div>
  {:else if loading}
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
    <p>Connecting to Pikirly...</p>
  {:else if error}
    <div class="card bg-error/10 p-6 mb-4 w-full">
      <p class="text-error font-bold">{error}</p>
    </div>
    {#if error.includes('No active game found')}
      <button class="btn btn-primary" onclick={() => { loading = true; error = null; bootstrapPlayer(); }}>
        Retry
      </button>
    {/if}
    <div class="mt-8 pt-8 border-t w-full">
      <p class="text-sm muted mb-4">Are you the host?</p>
      {#if $auth.user}
        <button class="btn btn-secondary w-full" onclick={() => showHostUI = true}>
          Host a Game
        </button>
      {:else}
        <button class="btn btn-secondary w-full" onclick={() => goto('/login')}>
          Sign in to Host
        </button>
      {/if}
    </div>
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
    <div class="mt-8 pt-8 border-t w-full">
      <p class="text-sm muted mb-2">Want to host instead?</p>
      <button class="text-sm text-primary underline" onclick={() => showHostUI = true}>
        Open Host Dashboard
      </button>
    </div>
  {:else}
    <div class="card bg-info/10 p-6 mb-4 w-full">
      <p class="font-bold">No active game found.</p>
      <p class="text-sm muted mt-2">Waiting for host to start a session...</p>
    </div>
    <div class="mt-8 pt-8 border-t w-full">
      <p class="text-sm muted mb-4">Are you the host?</p>
      {#if $auth.user}
        <button class="btn btn-primary w-full" onclick={() => showHostUI = true}>
          Host a Game
        </button>
      {:else}
        <button class="btn btn-secondary w-full" onclick={() => goto('/login')}>
          Sign in to Host
        </button>
      {/if}
    </div>
  {/if}
</div>
