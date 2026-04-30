<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { getSocket } from '$lib/socket';
  import { playerSession } from '$lib/stores/player';
  import type { QuestionPublic } from '@kahoot/shared';

  const gameId = $derived($page.params.gameId ?? '');

  let phase = $state<'lobby' | 'in_question' | 'answered' | 'reveal' | 'ended'>('lobby');
  let currentQuestion = $state<QuestionPublic | null>(null);
  let timeLeftMs = $state(0);
  let myChoice = $state<number | null>(null);
  let revealResult = $state<{ correct: boolean; earned: number; total: number } | null>(null);
  let myRank = $state<number | null>(null);
  let myFinalScore = $state<number | null>(null);
  let connectionMsg = $state<string | null>(null);

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

  onMount(() => {
    const sess = $playerSession;
    if (!sess || sess.gameId !== gameId) {
      goto(`/join?pin=${gameId}`);
      return;
    }

    // On (re)connect, re-join with our stored playerId for resync.
    const reJoin = () => {
      socket.emit(
        'join_game',
        { gameId, nickname: sess.nickname, playerId: sess.playerId },
        (res) => {
          if (!res.ok) {
            connectionMsg = 'Could not rejoin: ' + res.error;
            setTimeout(() => goto('/'), 1500);
          } else {
            connectionMsg = null;
          }
        },
      );
    };

    if (socket.connected) reJoin();
    socket.on('connect', () => { connectionMsg = null; reJoin(); });
    socket.on('disconnect', () => { connectionMsg = 'Reconnecting…'; });

    socket.on('game_started', () => {
      phase = 'in_question';
    });
    socket.on('question', (q) => {
      currentQuestion = q;
      timeLeftMs = Math.max(0, q.deadlineMs - Date.now());
      phase = 'in_question';
      myChoice = null;
      revealResult = null;
      startTimer();
    });
    socket.on('answer_ack', (ack) => {
      if (!ack.accepted) {
        // Allow retry on duplicate/wrong_question; show message on late.
        if (ack.reason === 'late') {
          connectionMsg = 'Too slow on that one!';
          setTimeout(() => connectionMsg = null, 1800);
        } else if (ack.reason === 'duplicate') {
          // ignore — we already have UI state for it
        } else {
          myChoice = null;
          phase = 'in_question';
        }
      }
    });
    socket.on('question_end', (e) => {
      revealResult = {
        correct: e.yourCorrect ?? false,
        earned: e.yourScore ?? 0,
        total: e.totalScore ?? 0,
      };
      phase = 'reveal';
      stopTimer();
    });
    socket.on('leaderboard_update', ({ top }) => {
      const me = top.find((t) => t.playerId === sess.playerId);
      myRank = me?.rank ?? null;
    });
    socket.on('game_end', ({ finalLeaderboard }) => {
      const me = finalLeaderboard.find((t) => t.playerId === sess.playerId);
      myFinalScore = me?.score ?? 0;
      myRank = me?.rank ?? null;
      phase = 'ended';
      stopTimer();
    });
  });

  onDestroy(() => {
    stopTimer();
    socket.off('connect');
    socket.off('disconnect');
    socket.off('game_started');
    socket.off('question');
    socket.off('answer_ack');
    socket.off('question_end');
    socket.off('leaderboard_update');
    socket.off('game_end');
  });

  function pick(idx: number) {
    if (phase !== 'in_question' || myChoice !== null || !$playerSession) return;
    myChoice = idx;
    phase = 'answered';
    socket.emit('submit_answer', {
      gameId,
      playerId: $playerSession.playerId,
      questionIndex: currentQuestion!.index,
      choice: idx,
      clientTs: Date.now(),
    });
  }

  const tileColors = ['var(--c-red)', 'var(--c-blue)', 'var(--c-yellow)', 'var(--c-green)'];
  const shapes = ['▲', '◆', '●', '■'];

  const progressPct = $derived(
    currentQuestion ? Math.max(0, Math.min(100, (timeLeftMs / currentQuestion.limitMs) * 100)) : 0,
  );
</script>

{#if connectionMsg}
  <div style="position:fixed; top:14px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.75); color:white; padding:8px 16px; border-radius:99px; z-index:100; font-size: 0.9rem;">
    {connectionMsg}
  </div>
{/if}

<div class="center" style="padding: 18px 12px;">
  <div style="width:100%; max-width: 720px;">
    {#if phase === 'lobby'}
      <div class="card fade-in" style="text-align:center;">
        <div style="font-size: 3rem;">⏳</div>
        <h2 style="margin: 6px 0 4px;">You're in!</h2>
        <div class="muted">Waiting for the host to start the game…</div>
        {#if $playerSession}
          <div style="margin-top: 22px; padding: 12px; background:#f3f4f6; border-radius:12px; font-weight: 700;">
            {$playerSession.nickname}
          </div>
        {/if}
      </div>

    {:else if (phase === 'in_question' || phase === 'answered') && currentQuestion}
      <div class="fade-in" style="color:white;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <div class="tag">Q {currentQuestion.index + 1} / {currentQuestion.total}</div>
          <div style="font-size: 1.4rem; font-weight: 800;">{Math.ceil(timeLeftMs / 1000)}s</div>
        </div>
        <div style="height:6px; background:rgba(255,255,255,0.22); border-radius:99px; overflow:hidden;">
          <div style="height:100%; width:{progressPct}%; background:white; transition: width 0.1s linear;"></div>
        </div>

        <div class="card" style="margin-top: 16px; text-align:center;">
          <h2 style="font-size: clamp(1.15rem, 4vw, 1.5rem); margin: 4px 0; line-height:1.3;">
            {currentQuestion.text}
          </h2>
        </div>

        {#if phase === 'answered'}
          <div class="card" style="margin-top:18px; text-align:center;">
            <div style="font-size: 2.6rem;">✓</div>
            <div style="font-weight: 800; font-size: 1.2rem; margin-top: 6px;">Answer locked in!</div>
            <div class="muted" style="margin-top: 4px;">Waiting for other players…</div>
            {#if myChoice !== null}
              <div style="margin-top:14px; display:inline-flex; align-items:center; gap:8px; padding: 10px 18px; background:{tileColors[myChoice]}; color:white; border-radius:12px; font-weight:800;">
                {shapes[myChoice]} {currentQuestion.choices[myChoice]}
              </div>
            {/if}
          </div>
        {:else}
          <div style="margin-top: 18px; display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            {#each currentQuestion.choices as choice, i}
              <button
                onclick={() => pick(i)}
                disabled={myChoice !== null}
                style="
                  background:{tileColors[i]};
                  color:white;
                  padding: 28px 14px;
                  font-size: 1.05rem;
                  display:flex; gap:10px; align-items:center; justify-content:center;
                  min-height: 110px;
                  box-shadow: 0 4px 0 rgba(0,0,0,0.18);
                "
              >
                <span style="font-size:1.6rem;">{shapes[i]}</span>
                <span>{choice}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

    {:else if phase === 'reveal' && revealResult}
      <div class="fade-in card" style="text-align:center; padding: 36px 24px;">
        {#if revealResult.correct}
          <div style="font-size: 3.4rem;">🎉</div>
          <h2 style="margin: 6px 0 4px; color: var(--c-green);">Correct!</h2>
          <div class="muted">+{revealResult.earned} points</div>
        {:else}
          <div style="font-size: 3.4rem;">😔</div>
          <h2 style="margin: 6px 0 4px; color: var(--c-red);">Not quite</h2>
          <div class="muted">+0 points</div>
        {/if}
        <div style="margin-top: 22px; padding: 14px; background:#f3f4f6; border-radius:12px;">
          <div class="muted" style="font-size:0.85rem;">Total score</div>
          <div style="font-size: 1.8rem; font-weight: 900;">{revealResult.total}</div>
          {#if myRank}
            <div class="muted" style="font-size:0.85rem; margin-top:4px;">Rank #{myRank}</div>
          {/if}
        </div>
      </div>

    {:else if phase === 'ended'}
      <div class="fade-in card" style="text-align:center;">
        <div style="font-size: 3.4rem;">🏁</div>
        <h2 style="margin: 6px 0 4px;">Game over!</h2>
        {#if myRank}
          <div class="muted">You finished at rank #{myRank}</div>
        {/if}
        {#if myFinalScore !== null}
          <div style="margin: 18px 0; padding: 14px; background:#f3f4f6; border-radius:12px;">
            <div class="muted" style="font-size: 0.85rem;">Final score</div>
            <div style="font-size: 2.2rem; font-weight: 900;">{myFinalScore}</div>
          </div>
        {/if}
        <button class="btn-primary" onclick={() => { playerSession.set(null); goto('/'); }}>
          Play another
        </button>
      </div>
    {/if}
  </div>
</div>
