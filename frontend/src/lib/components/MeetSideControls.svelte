<script lang="ts">
  import { onMount } from 'svelte';
  import { getSocket } from '$lib/socket';
  import { playerSession } from '$lib/stores/player';
  import { hostSession } from '$lib/stores/host';
  import type { PlayerPublic, QuestionPublic, LeaderboardEntry } from '@kahoot/shared';

  interface Props {
    gameId: string;
  }
  let { gameId }: Props = $props();

  let role = $state<'host' | 'player' | 'spectator'>('player');
  let phase = $state<'lobby' | 'in_question' | 'answered' | 'reveal' | 'ended'>('lobby');
  let currentQuestion = $state<QuestionPublic | null>(null);
  let myChoice = $state<number | null>(null);
  let revealResult = $state<{ correct: boolean; earned: number; total: number } | null>(null);
  let myRank = $state<number | null>(null);
  let myFinalScore = $state<number | null>(null);

  let socket = getSocket();

  onMount(() => {
    // Determine role
    if ($hostSession?.gameId === gameId) {
      role = 'host';
    } else if ($playerSession?.gameId === gameId) {
      role = 'player';
    }

    const handlers = {
      game_started: () => { phase = 'in_question'; },
      question: (q: QuestionPublic) => {
        currentQuestion = q;
        phase = 'in_question';
        myChoice = null;
        revealResult = null;
      },
      question_end: (e: any) => {
        if (role === 'player') {
          revealResult = {
            correct: e.yourCorrect ?? false,
            earned: e.yourScore ?? 0,
            total: e.totalScore ?? 0,
          };
        }
        phase = 'reveal';
      },
      leaderboard_update: ({ top }: any) => {
        if (role === 'player' && $playerSession) {
          const me = top.find((t: any) => t.playerId === $playerSession!.playerId);
          myRank = me?.rank ?? null;
        }
      },
      game_end: ({ finalLeaderboard }: any) => {
        if (role === 'player' && $playerSession) {
          const me = finalLeaderboard.find((t: any) => t.playerId === $playerSession!.playerId);
          myFinalScore = me?.score ?? 0;
          myRank = me?.rank ?? null;
        }
        phase = 'ended';
      }
    };

    // Register handlers
    for (const [event, fn] of Object.entries(handlers)) {
      socket.on(event as any, fn);
    }

    return () => {
      for (const [event, fn] of Object.entries(handlers)) {
        socket.off(event as any, fn);
      }
    };
  });

  function start() {
    socket.emit('start_game', { gameId }, (res) => {
      if (!res.ok) console.error(res.error);
    });
  }

  function pick(idx: number) {
    if (phase !== 'in_question' || myChoice !== null || role !== 'player') return;
    myChoice = idx;
    phase = 'answered';
    socket.emit('submit_answer', {
      questionIndex: currentQuestion!.index,
      choice: idx,
      clientTs: Date.now(),
    });
  }

  const tileColors = ['var(--c-red)', 'var(--c-blue)', 'var(--c-yellow)', 'var(--c-green)'];
  const shapes = ['▲', '◆', '●', '■'];
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
          <button class="btn-primary py-6 text-lg" onclick={start}>
            Start Game
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
          <button class="btn-secondary py-4" onclick={() => window.location.href = '/'}>
            Back to Home
          </button>
        {/if}
      </div>
    </div>

  {:else if role === 'player'}
    <!-- PLAYER SIDEBAR -->
    <div class="flex flex-col h-full gap-4">
      {#if phase === 'lobby'}
        <div class="card p-8 text-center flex-1 flex flex-col justify-center">
          <div class="text-5xl mb-4">⏳</div>
          <h2 class="text-2xl font-bold mb-2">You're in!</h2>
          <p>Watch the main stage for the game to start.</p>
          <div class="mt-8 p-4 bg-gray-50 rounded-xl font-bold">
            {$playerSession?.nickname}
          </div>
        </div>

      {:else if phase === 'in_question'}
        <div class="grid grid-cols-1 gap-4 h-full">
          {#each [0, 1, 2, 3] as i}
            <button
              onclick={() => pick(i)}
              style="background: {tileColors[i]};"
              class="flex-1 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
            >
              <span class="text-6xl font-black">{shapes[i]}</span>
            </button>
          {/each}
        </div>

      {:else if phase === 'answered'}
        <div class="card p-8 text-center flex-1 flex flex-col justify-center">
          <div class="text-6xl mb-4 text-brand">✓</div>
          <h2 class="text-2xl font-bold mb-2">Answer Locked!</h2>
          <p>Check the main stage for results.</p>
        </div>

      {:else if phase === 'reveal' && revealResult}
        <div class="card p-8 text-center flex-1 flex flex-col justify-center" style="border: 4px solid {revealResult.correct ? 'var(--c-green)' : 'var(--c-red)'}">
          <div class="text-6xl mb-4">{revealResult.correct ? '🎉' : '😔'}</div>
          <h2 class="text-3xl font-bold mb-2" style="color: {revealResult.correct ? 'var(--c-green)' : 'var(--c-red)'}">
            {revealResult.correct ? 'Correct!' : 'Incorrect'}
          </h2>
          <p class="text-xl">+{revealResult.earned} points</p>
          
          <div class="mt-10 p-4 bg-gray-50 rounded-xl">
            <p class="text-sm uppercase tracking-widest opacity-50 mb-1">Total Score</p>
            <p class="text-4xl font-black">{revealResult.total}</p>
            {#if myRank}
              <p class="mt-2 font-bold opacity-70">Rank #{myRank}</p>
            {/if}
          </div>
        </div>

      {:else}
        <div class="card p-8 text-center flex-1 flex flex-col justify-center">
          <div class="text-6xl mb-4">🏁</div>
          <h2 class="text-2xl font-bold">Game Over!</h2>
          {#if myRank}
            <p class="mt-2">You ranked #{myRank}</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
