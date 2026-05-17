<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { getSocket } from '$lib/socket';
  import { playerSession } from '$lib/stores/player';
  import { hostSession } from '$lib/stores/host';
  import type { QuestionPublic } from '@kahoot/shared';

  interface Props {
    gameId: string;
  }
  let { gameId }: Props = $props();

  let role = $state<'host' | 'player' | 'spectator'>('spectator');
  let phase = $state<'lobby' | 'in_question' | 'answered' | 'reveal' | 'ended'>('lobby');
  let currentQuestion = $state<QuestionPublic | null>(null);
  let myFinalScore = $state<number | null>(null);
  let playerCount = $state(0);
  let starting = $state(false);

  let socket = getSocket();

  onMount(() => {
    if ($hostSession?.gameId === gameId) {
      role = 'host';
      void fetchPlayerCount();
    } else if ($playerSession?.gameId === gameId) {
      role = 'player';
    }

    const handlers = {
      game_started: () => { phase = 'in_question'; starting = false; },
      question: (q: QuestionPublic) => {
        currentQuestion = q;
        phase = 'in_question';
      },
      question_end: () => {
        phase = 'reveal';
      },
      game_end: ({ finalLeaderboard }: any) => {
        if (role === 'player' && $playerSession) {
          const me = finalLeaderboard.find((t: any) => t.playerId === $playerSession!.playerId);
          myFinalScore = me?.score ?? 0;
        }
        phase = 'ended';
      },
      player_joined: () => { playerCount += 1; },
      player_left: () => { playerCount = Math.max(0, playerCount - 1); },
    };

    for (const [event, fn] of Object.entries(handlers)) {
      socket.on(event as any, fn);
    }

    return () => {
      for (const [event, fn] of Object.entries(handlers)) {
        socket.off(event as any, fn);
      }
    };
  });

  async function fetchPlayerCount() {
    try {
      const res = await api(`/games/${gameId}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.playerCount === 'number') playerCount = data.playerCount;
      }
    } catch { /* ignore — events will sync */ }
  }

  function start() {
    if (playerCount === 0 || starting) return;
    starting = true;
    socket.emit('start_game', { gameId }, (res) => {
      if (!res.ok) {
        starting = false;
        console.error(res.error);
      }
    });
  }

  function pickAnotherQuiz() {
    // Intentionally do NOT call client.endActivity() here. Ending the Meet
    // activity also tears down the side panel iframe, which would close the
    // host's cockpit. The next call to startActivity() inside MeetStage's
    // hostQuiz() will transition the main stage cleanly when the host picks
    // a new quiz.
    hostSession.set(null);
    goto('/?mode=meet&surface=side');
  }
</script>

<div class="flex flex-col h-full w-full p-4 overflow-y-auto">
  {#if role === 'host'}
    <!-- HOST SIDEBAR -->
    <div class="flex flex-col gap-6">
      <div class="card p-4 border-2 border-brand bg-white">
        <h2 class="text-xl font-bold mb-2">Host Dashboard</h2>
        <p class="text-sm opacity-70">Manage the game from here. Participants see the shared display in the center.</p>
      </div>

      <div class="grid gap-3">
        {#if phase === 'lobby'}
          <div class="card p-3 text-center">
            <p class="font-bold">{playerCount} player{playerCount === 1 ? '' : 's'} joined</p>
          </div>
          <button
            class="btn-primary py-6 text-lg"
            onclick={start}
            disabled={starting || playerCount === 0}
            title={playerCount === 0 ? 'Need at least one player to start' : ''}
          >
            {starting ? 'Starting…' : 'Start Game'}
          </button>
        {:else if phase === 'in_question'}
          <div class="card p-4 text-center">
            <p class="font-bold">Question in progress...</p>
            <p class="text-sm muted mt-2">Wait for timer or players to finish.</p>
          </div>
        {:else if phase === 'reveal'}
          <button class="btn-primary py-6 text-lg" onclick={start}>
            Next Question
          </button>
        {:else if phase === 'ended'}
          <button class="btn-primary py-4" onclick={pickAnotherQuiz}>
            Pick another quiz
          </button>
        {/if}
      </div>
    </div>

  {:else if role === 'player'}
    <!-- PLAYER SIDEBAR (Read-Only Status) -->
    <div class="flex flex-col h-full gap-4">
      <div class="card p-8 text-center flex-1 flex flex-col justify-center">
        <div class="text-6xl mb-6">🎮</div>
        <h2 class="text-2xl font-bold mb-2">Pikirly</h2>
        <p class="opacity-60">Check the main stage to join and play!</p>
        
        {#if phase === 'lobby'}
          <div class="mt-10 p-4 bg-gray-50 rounded-xl font-bold">
            Joined as {$playerSession?.nickname}
          </div>
        {:else if phase === 'ended'}
          <div class="mt-10 p-4 bg-gray-50 rounded-xl">
             <p class="text-sm uppercase tracking-widest opacity-50">Final Score</p>
             <p class="text-3xl font-black">{myFinalScore ?? 0}</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
