<script lang="ts">
  import { onMount } from 'svelte';
  import { getMeetContext, type MeetContext } from '$lib/meet';
  import { api } from '$lib/api';
  import { getSocket } from '$lib/socket';
  import { playerSession } from '$lib/stores/player';
  import { goto } from '$app/navigation';

  let meetContext: MeetContext | null = $state(null);
  let error: string | null = $state(null);
  let loading = $state(true);

  onMount(async () => {
    meetContext = await getMeetContext();
    if (!meetContext) {
      error = 'Could not initialize Google Meet context.';
      loading = false;
      return;
    }

    if (meetContext.surface === 'side') {
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
        // Poll for game? Or just show message.
        loading = false;
        return;
      }

      if (!res.ok) {
        error = 'Failed to find game.';
        loading = false;
        return;
      }

      const { gameId } = await res.json();
      
      // Auto-join
      const socket = getSocket();
      socket.emit('join_game', {
        gameId,
        nickname: meetContext!.displayName,
        meetParticipantId: meetContext!.participantId,
        meetDisplayName: meetContext!.displayName
      }, (response) => {
        if (response.ok) {
          playerSession.set({
            gameId,
            playerId: response.playerId,
            playerToken: response.playerToken,
            nickname: meetContext!.displayName
          });
          goto(`/play/${gameId}`);
        } else {
          error = response.error;
          loading = false;
        }
      });
    } catch (err) {
      console.error(err);
      error = 'An error occurred during bootstrap.';
      loading = false;
    }
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
  {/if}
</div>
