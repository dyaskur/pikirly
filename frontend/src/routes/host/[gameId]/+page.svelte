<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { getSocket } from '$lib/socket';
  import { hostSession } from '$lib/stores/host';
  import { goto } from '$app/navigation';
  import type {
    PlayerPublic,
    QuestionPublic,
    LeaderboardEntry,
  } from '@kahoot/shared';

  const gameId = $derived($page.params.gameId ?? '');

  const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

  let players = $state<PlayerPublic[]>([]);
  let starting = $state(false);
  let startError = $state<string | null>(null);
  let staleGame = $state(false);
  let phase = $state<'lobby' | 'in_question' | 'reveal' | 'ended'>('lobby');
  let currentQuestion = $state<QuestionPublic | null>(null);
  let timeLeftMs = $state(0);
  let reveal = $state<{ correctChoice: number; distribution: number[] } | null>(null);
  let leaderboard = $state<LeaderboardEntry[]>([]);
  let final = $state<LeaderboardEntry[] | null>(null);

  let socket = getSocket();
  let tick: ReturnType<typeof setInterval> | null = null;

  function startTimer() {
    if (tick) clearInterval(tick);
    tick = setInterval(() => {
      if (!currentQuestion) return;
      timeLeftMs = Math.max(0, currentQuestion.deadlineMs - Date.now());
    }, 100);
  }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }

  onMount(async () => {
    if (!$hostSession || $hostSession.gameId !== gameId) {
      goto('/');
      return;
    }

    // Verify the game still exists (backend may have restarted).
    const check = await fetch(`${BACKEND}/games/${gameId}`).catch(() => null);
    if (!check || !check.ok) {
      staleGame = true;
      return;
    }

    socket.on('player_joined', (p) => {
      players = [...players, p];
    });
    socket.on('player_left', ({ playerId }) => {
      players = players.filter((p) => p.playerId !== playerId);
    });
    socket.on('game_started', () => {
      phase = 'in_question';
    });
    socket.on('question', (q) => {
      currentQuestion = q;
      timeLeftMs = Math.max(0, q.deadlineMs - Date.now());
      phase = 'in_question';
      reveal = null;
      startTimer();
    });
    socket.on('question_end', (e) => {
      reveal = { correctChoice: e.correctChoice, distribution: e.distribution };
      phase = 'reveal';
      stopTimer();
    });
    socket.on('leaderboard_update', ({ top }) => {
      leaderboard = top;
    });
    socket.on('game_end', ({ finalLeaderboard }) => {
      final = finalLeaderboard;
      phase = 'ended';
      stopTimer();
    });
  });

  onDestroy(() => {
    stopTimer();
    socket.off('player_joined');
    socket.off('player_left');
    socket.off('game_started');
    socket.off('question');
    socket.off('question_end');
    socket.off('leaderboard_update');
    socket.off('game_end');
  });

  function start() {
    if (!$hostSession) return;
    starting = true;
    startError = null;
    socket.emit(
      'start_game',
      { gameId, hostToken: $hostSession.hostToken },
      (res) => {
        starting = false;
        if (!res.ok) startError = res.error;
      },
    );
  }

  const tileColors = ['var(--c-red)', 'var(--c-blue)', 'var(--c-yellow)', 'var(--c-green)'];
  const shapes = ['▲', '◆', '●', '■'];

  const totalAnswers = $derived(reveal ? reveal.distribution.reduce((a, b) => a + b, 0) : 0);
  const progressPct = $derived(
    currentQuestion ? Math.max(0, Math.min(100, (timeLeftMs / currentQuestion.limitMs) * 100)) : 0,
  );
</script>

<div class="center" style="padding: 28px 16px;">
  <div style="width: 100%; max-width: 900px;">
    {#if staleGame}
      <div class="card fade-in" style="text-align:center; max-width:460px; margin: 0 auto;">
        <div style="font-size:2.6rem;">⚠️</div>
        <h2 style="margin: 8px 0 6px;">Game session expired</h2>
        <div class="muted" style="margin-bottom:22px;">The server restarted and lost this game's state. Start a new one.</div>
        <button class="btn-primary" onclick={() => { hostSession.set(null); goto('/'); }}>
          Create new game
        </button>
      </div>
    {:else if phase === 'lobby'}
      <div class="fade-in" style="text-align:center; color:white;">
        <div class="tag">Game PIN</div>
        <div style="font-size: clamp(3rem, 12vw, 6rem); font-weight: 900; letter-spacing: 0.15em; margin: 8px 0 4px;">
          {gameId}
        </div>
        <div style="opacity:0.85;">Players join at <strong>quizzr.app</strong> and enter the PIN</div>

        <div class="card" style="margin-top: 28px; max-width: 720px; margin-inline: auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
            <h2 style="margin:0;">Players ({players.length})</h2>
            <button
              class="btn-primary"
              style="width:auto;"
              onclick={start}
              disabled={starting || players.length === 0}
            >
              {starting ? 'Starting…' : 'Start game'}
            </button>
          </div>
          {#if startError}
            <div class="error">{startError}</div>
          {/if}

          {#if players.length === 0}
            <div class="muted" style="padding: 32px 0; text-align:center;">
              Waiting for players to join…
            </div>
          {:else}
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">
              {#each players as p (p.playerId)}
                <div class="fade-in" style="background:#f3f4f6; padding:12px 14px; border-radius:12px; font-weight:600; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  {p.nickname}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

    {:else if phase === 'in_question' && currentQuestion}
      <div class="fade-in" style="color:white;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
          <div class="tag">Question {currentQuestion.index + 1} / {currentQuestion.total}</div>
          <div style="font-size: 2rem; font-weight:900;">{Math.ceil(timeLeftMs / 1000)}s</div>
        </div>
        <div style="height:8px; background:rgba(255,255,255,0.18); border-radius:99px; overflow:hidden;">
          <div style="height:100%; width:{progressPct}%; background:white; transition: width 0.1s linear;"></div>
        </div>

        <div class="card" style="margin: 22px auto; max-width: 820px; text-align:center;">
          <h2 style="font-size: clamp(1.4rem, 3.4vw, 2rem); margin: 6px 0 24px;">{currentQuestion.text}</h2>
          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
            {#each currentQuestion.choices as choice, i}
              <div style="background:{tileColors[i % 4]}; color:white; padding: 22px; border-radius: 14px; font-weight:800; font-size: 1.1rem; display:flex; gap:10px; align-items:center; justify-content:center;">
                <span style="font-size:1.3rem;">{shapes[i % 4]}</span>
                <span>{choice}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

    {:else if phase === 'reveal' && currentQuestion && reveal}
      {@const maxCount = Math.max(1, ...reveal.distribution)}
      <div class="fade-in" style="color:white;">
        <div class="tag">Results</div>
        <h2 style="margin: 6px 0 16px;">{currentQuestion.text}</h2>

        <div class="card" style="margin-bottom: 18px;">
          <div style="display:grid; grid-template-columns: repeat({currentQuestion.choices.length}, 1fr); gap: 12px; align-items:end; min-height: 200px;">
            {#each currentQuestion.choices as choice, i}
              {@const isCorrect = i === reveal.correctChoice}
              {@const count = reveal.distribution[i] ?? 0}
              {@const h = Math.max(8, (count / maxCount) * 180)}
              <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                <div style="font-weight:800;">{count}</div>
                <div style="height:{h}px; width:100%; background:{tileColors[i % 4]}; border-radius:10px 10px 0 0; opacity:{isCorrect ? 1 : 0.55};"></div>
                <div style="display:flex; gap:6px; align-items:center; font-weight:700; color:{isCorrect ? 'var(--c-green)' : 'var(--ink)'};">
                  {shapes[i % 4]} {choice} {isCorrect ? '✓' : ''}
                </div>
              </div>
            {/each}
          </div>
          <div class="muted" style="text-align:center; margin-top:14px;">
            {totalAnswers} answer{totalAnswers === 1 ? '' : 's'}
          </div>
        </div>

        {#if leaderboard.length > 0}
          <div class="card">
            <h3 style="margin-top:0;">Leaderboard</h3>
            <ol style="padding-left: 20px; margin:0;">
              {#each leaderboard.slice(0, 5) as entry (entry.playerId)}
                <li style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f3f4f6;">
                  <span>{entry.nickname}</span>
                  <strong>{entry.score}</strong>
                </li>
              {/each}
            </ol>
          </div>
        {/if}
      </div>

    {:else if phase === 'ended' && final}
      <div class="fade-in" style="color:white; text-align:center;">
        <div class="tag">Final results</div>
        <h1 style="font-size: clamp(2rem, 6vw, 3.4rem); margin: 8px 0 20px;">🏆 Game over</h1>
        <div class="card" style="max-width:560px; margin: 0 auto;">
          <ol style="padding-left: 20px; text-align:left; margin:0;">
            {#each final as entry (entry.playerId)}
              <li style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f3f4f6;">
                <span style="font-weight:700;">{entry.nickname}</span>
                <strong>{entry.score}</strong>
              </li>
            {/each}
          </ol>
        </div>
        <button class="btn-primary" style="max-width: 280px; margin-top: 26px;" onclick={() => { hostSession.set(null); goto('/'); }}>
          New game
        </button>
      </div>
    {/if}
  </div>
</div>
