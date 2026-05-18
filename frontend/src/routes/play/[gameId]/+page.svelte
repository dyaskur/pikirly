<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getSocket } from '$lib/socket';
  import { playerSession } from '$lib/stores/player';
  import MeetSharedDisplay from '$lib/components/MeetSharedDisplay.svelte';
  import MeetSideControls from '$lib/components/MeetSideControls.svelte';
  import type { PlayerPublic, QuestionPublic, LeaderboardEntry } from '@kahoot/shared';
  import { seededShuffle } from '@kahoot/shared';

  const gameId = $derived($page.params.gameId ?? '');

  let players = $state<PlayerPublic[]>([]);
  let leaderboard = $state<LeaderboardEntry[]>([]);
  let final = $state<LeaderboardEntry[] | null>(null);
  let reveal = $state<{ correctChoice: number; distribution: number[] } | null>(null);

  let phase = $state<'lobby' | 'in_question' | 'answered' | 'reveal' | 'ended'>('lobby');
  let currentQuestion = $state<QuestionPublic | null>(null);
  let displayOrder = $state<number[]>([]);
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
      if (isMeet) {
        exitPlayerSession({ clear: false });
      } else {
        goto(`/join?pin=${gameId}`);
      }
      return;
    }

    // On (re)connect, re-join with our stored playerId for resync.
    const reJoin = () => {
      socket.emit(
        'join_game',
        { gameId, nickname: sess.nickname, playerId: sess.playerId, playerToken: sess.playerToken },
        (res) => {
          if (!res.ok) {
            connectionMsg = 'Could not rejoin: ' + res.error;
            if (!isMeet) {
              setTimeout(() => goto('/'), 1500);
            }
          } else {
            connectionMsg = null;
          }
        },
      );
    };

    const handlers = {
      connect: () => { connectionMsg = null; reJoin(); },
      disconnect: () => { connectionMsg = 'Reconnecting…'; },
      game_started: () => { phase = 'in_question'; },
      player_joined: (p: any) => { players = [...players, p]; },
      player_left: ({ playerId }: any) => { players = players.filter(p => p.playerId !== playerId); },
      question: (q: QuestionPublic) => {
        currentQuestion = q;
        const canonicalOrder = q.choices.map((_, i) => i);
        displayOrder = q.randomizeChoices
          ? seededShuffle(canonicalOrder, `${sess.playerId}:${q.index}`)
          : canonicalOrder;
        timeLeftMs = Math.max(0, q.deadlineMs - Date.now());
        phase = 'in_question';
        myChoice = null;
        revealResult = null;
        startTimer();
      },
      answer_ack: (ack: any) => {
        if (!ack.accepted) {
          if (ack.reason === 'late') {
            connectionMsg = 'Too slow on that one!';
            setTimeout(() => connectionMsg = null, 1800);
          } else if (ack.reason === 'duplicate') {
            // ignore
          } else {
            myChoice = null;
            phase = 'in_question';
          }
        }
      },
      question_end: (e: any) => {
        reveal = { correctChoice: e.correctChoice, distribution: e.distribution };
        revealResult = {
          correct: e.yourCorrect ?? false,
          earned: e.yourScore ?? 0,
          total: e.totalScore ?? 0,
        };
        phase = 'reveal';
        stopTimer();
      },
      leaderboard_update: ({ top }: any) => {
        leaderboard = top;
        const me = top.find((t: any) => t.playerId === sess.playerId);
        myRank = me?.rank ?? null;
      },
      game_end: ({ finalLeaderboard }: any) => {
        final = finalLeaderboard;
        const me = finalLeaderboard.find((t: any) => t.playerId === sess.playerId);
        myFinalScore = me?.score ?? 0;
        myRank = me?.rank ?? null;
        phase = 'ended';
        stopTimer();
      }
    };

    if (socket.connected) reJoin();

    // Register handlers
    for (const [event, fn] of Object.entries(handlers)) {
      socket.on(event as any, fn);
    }

    return () => {
      stopTimer();
      // Unregister ONLY our handlers
      for (const [event, fn] of Object.entries(handlers)) {
        socket.off(event as any, fn);
      }
    };
  });

  function pick(idx: number) {
    if (phase !== 'in_question' || myChoice !== null || !$playerSession) return;
    myChoice = idx;
    phase = 'answered';
    socket.emit('submit_answer', {
      questionIndex: currentQuestion!.index,
      choice: idx,
      clientTs: Date.now(),
    });
  }

  const tileColors = ['var(--c-red)', 'var(--c-blue)', 'var(--c-yellow)', 'var(--c-green)', '#8b5cf6', '#f97316'];
  const shapes = ['▲', '◆', '●', '■', '★', '⬢'];

  const choiceCols = $derived(
    !currentQuestion ? 2 : currentQuestion.choices.length <= 4 ? 2 : 3,
  );

  const progressPct = $derived(
    currentQuestion ? Math.max(0, Math.min(100, (timeLeftMs / currentQuestion.limitMs) * 100)) : 0,
  );

  let isMeet = $derived($page.url.searchParams.get('mode') === 'meet');
  let isSidePanel = $derived($page.url.searchParams.get('surface') === 'side');

  function exitPlayerSession({ clear = true }: { clear?: boolean } = {}) {
    if (clear) playerSession.set(null);
    if (isMeet) {
      const surface = isSidePanel ? 'side' : 'stage';
      goto(`/?mode=meet&surface=${surface}`);
    } else {
      goto('/');
    }
  }
</script>

{#if connectionMsg}
  <div style="position:fixed; top:14px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.75); color:white; padding:8px 16px; border-radius:99px; z-index:100; font-size: 0.9rem;">
    {connectionMsg}
  </div>
{/if}

{#if isMeet}
  {#if isSidePanel}
    <MeetSideControls {gameId} />
  {:else}
    <!-- Main Stage for Players: Full Interactive UI -->
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
                  <div style="margin-top:14px; display:inline-flex; align-items:center; gap:8px; padding: 10px 18px; background:{tileColors[myChoice % tileColors.length]}; color:white; border-radius:12px; font-weight:800;">
                    {shapes[myChoice % shapes.length]} {currentQuestion.choices[myChoice]}
                  </div>
                {/if}
              </div>
            {:else}
              <div style="margin-top: 18px; display:grid; grid-template-columns: repeat({choiceCols}, 1fr); gap: 12px;">
                {#each displayOrder as canonicalIdx}
                  <button
                    onclick={() => pick(canonicalIdx)}
                    disabled={myChoice !== null}
                    style="
                      background:{tileColors[canonicalIdx % tileColors.length]};
                      color:white;
                      padding: 28px 14px;
                      font-size: 1.05rem;
                      display:flex; gap:10px; align-items:center; justify-content:center;
                      min-height: 110px;
                      box-shadow: 0 4px 0 rgba(0,0,0,0.18);
                    "
                  >
                    <span style="font-size:1.6rem;">{shapes[canonicalIdx % shapes.length]}</span>
                    <span>{currentQuestion.choices[canonicalIdx]}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>

        {:else if phase === 'reveal' && revealResult}
          <div class="fade-in card" style="text-align:center; padding: 36px 24px;">
            {#if revealResult.correct}
              <div style="font-size: 3.4rem;">🎉</div>
              <h2 style="margin: 6px 0 4px;">Correct!</h2>
              <div class="muted">+{revealResult.earned} points</div>
            {:else}
              <div style="font-size: 3.4rem;">😔</div>
              <h2 style="margin: 6px 0 4px;">Not quite</h2>
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
          </div>
        {/if}
      </div>
    </div>
  {/if}
{:else}
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
            <h2 style="margin: 6px 0 4px;">Correct!</h2>
            <div class="muted">+{revealResult.earned} points</div>
          {:else}
            <div style="font-size: 3.4rem;">😔</div>
            <h2 style="margin: 6px 0 4px;">Not quite</h2>
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
          {#if isMeet}
            <div class="muted" style="margin-top: 18px; font-size: 0.9rem;">
              Waiting for the host to start a new game…
            </div>
          {:else}
            <button class="btn-primary" onclick={() => exitPlayerSession()}>
              Play another
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
