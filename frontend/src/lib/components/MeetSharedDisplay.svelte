<script lang="ts">
  import type { PlayerPublic, QuestionPublic, LeaderboardEntry } from '@kahoot/shared';

  interface Props {
    phase: 'lobby' | 'in_question' | 'reveal' | 'ended';
    gameId: string;
    players: PlayerPublic[];
    currentQuestion: QuestionPublic | null;
    progressPct: number;
    timeLeftMs: number;
    reveal: { correctChoice: number; distribution: number[] } | null;
    leaderboard: LeaderboardEntry[];
    final: LeaderboardEntry[] | null;
  }

  let { 
    phase, 
    gameId, 
    players, 
    currentQuestion, 
    progressPct, 
    timeLeftMs, 
    reveal, 
    leaderboard, 
    final 
  }: Props = $props();

  const tileColors = ['var(--c-red)', 'var(--c-blue)', 'var(--c-yellow)', 'var(--c-green)', '#8b5cf6', '#f97316'];
  const shapes = ['▲', '◆', '●', '■', '★', '⬢'];
  const totalAnswers = $derived(reveal ? reveal.distribution.reduce((a, b) => a + b, 0) : 0);
  const choiceCols = $derived(
    !currentQuestion ? 2 : currentQuestion.choices.length <= 4 ? 2 : 3,
  );
</script>

<div class="center meet-shared" style="padding: 20px 16px; width: 100%; max-width: 1280px; margin: 0 auto;">
  {#if phase === 'lobby'}
    <div class="fade-in" style="text-align:center; color:white;">
      <div class="tag">Game PIN</div>
      <div style="font-size: clamp(3rem, 12vw, 6rem); font-weight: 900; letter-spacing: 0.15em; margin: 8px 0 4px;">
        {gameId}
      </div>
      <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,0.15); padding: 4px 12px; border-radius:99px; font-size:0.9rem;">
        <span style="color:#4ade80;">●</span> Meet Auto-Join Active
      </div>

      <div class="card" style="margin-top: 28px; max-width: 720px; margin-inline: auto; text-align: left;">
        <h2 style="margin:0 0 14px;">Players ({players.length})</h2>
        {#if players.length === 0}
          <div style="padding: 32px 0; text-align:center; opacity: 0.6;">
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

      <div style="margin-top: 18px; opacity: 0.85; font-size: 0.95rem;">
        Host: open the <strong>side panel</strong> and click <strong>Start Game</strong> when ready.
        {#if players.length === 0}
          <div style="margin-top: 4px; opacity: 0.7; font-size: 0.85rem;">
            Start unlocks once at least one player joins.
          </div>
        {/if}
      </div>
    </div>

  {:else if phase === 'in_question' && currentQuestion}
    <div class="fade-in" style="color:white; width: 100%;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
        <div class="tag">Question {currentQuestion.index + 1} / {currentQuestion.total}</div>
        <div style="font-size: 2.5rem; font-weight:900;">{Math.ceil(timeLeftMs / 1000)}s</div>
      </div>
      <div style="height:12px; background:rgba(255,255,255,0.18); border-radius:99px; overflow:hidden; margin-bottom: 30px;">
        <div style="height:100%; width:{progressPct}%; background:white; transition: width 0.1s linear;"></div>
      </div>

      <div class="card" style="margin: 0 auto; max-width: 820px; text-align:center; padding: 40px;">
        <h2 style="font-size: clamp(1.8rem, 4vw, 2.5rem); margin: 0 0 40px; line-height: 1.2;">{currentQuestion.text}</h2>
        <div style="display:grid; grid-template-columns: repeat({choiceCols}, 1fr); gap: 20px;">
          {#each currentQuestion.choices as choice, i}
            <div style="background:{tileColors[i % tileColors.length]}; color:white; padding: 30px; border-radius: 16px; font-weight:800; font-size: 1.3rem; display:flex; gap:15px; align-items:center; justify-content:center; box-shadow: 0 4px 0 rgba(0,0,0,0.1);">
              <span style="font-size:1.8rem;">{shapes[i % shapes.length]}</span>
              <span>{choice}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>

  {:else if phase === 'reveal' && currentQuestion && reveal}
    {@const maxCount = Math.max(1, ...reveal.distribution)}
    <div class="fade-in reveal-wrap" style="color:white; width: 100%;">
      <div class="tag">Results</div>
      <h2 class="reveal-question">{currentQuestion.text}</h2>

      <div class="reveal-grid" class:has-board={leaderboard.length > 0}>
        <div class="card reveal-chart">
          <div style="display:grid; grid-template-columns: repeat({currentQuestion.choices.length}, 1fr); gap: 12px; align-items:end; min-height: 160px;">
            {#each currentQuestion.choices as choice, i}
              {@const isCorrect = i === reveal.correctChoice}
              {@const count = reveal.distribution[i] ?? 0}
              {@const h = Math.max(8, (count / maxCount) * 140)}
              <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                <div style="font-weight:900; font-size: 1rem;">{count}</div>
                <div style="height:{h}px; width:100%; background:{tileColors[i % tileColors.length]}; border-radius:10px 10px 0 0; opacity:{isCorrect ? 1 : 0.4}; transition: height 0.5s ease-out;"></div>
                <div style="display:flex; gap:6px; align-items:center; font-weight:700; font-size: 0.95rem; text-align: center;">
                  {shapes[i % shapes.length]} {isCorrect ? '✓' : ''}
                </div>
              </div>
            {/each}
          </div>
          <div style="text-align:center; margin-top:12px; opacity: 0.7; font-size: 0.9rem;">
            {totalAnswers} total response{totalAnswers === 1 ? '' : 's'}
          </div>
        </div>

        {#if leaderboard.length > 0}
          <div class="card reveal-board">
            <h3 style="margin:0 0 10px; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; font-size: 1.05rem;">Leaderboard</h3>
            <ol style="padding: 0; margin:0; list-style: none;">
              {#each leaderboard.slice(0, 5) as entry (entry.playerId)}
                <li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f3f4f6; font-size: 0.95rem;">
                  <span style="font-weight: 600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{entry.nickname}</span>
                  <strong style="color: var(--brand);">{entry.score}</strong>
                </li>
              {/each}
            </ol>
          </div>
        {/if}
      </div>
    </div>

  {:else if phase === 'ended' && final}
    <div class="fade-in" style="color:white; text-align:center; width: 100%;">
      <div class="tag">Final results</div>
      <h1 style="font-size: clamp(2.5rem, 8vw, 4rem); margin: 10px 0 30px; letter-spacing: -0.02em;">🏆 Game over</h1>
      <div class="card" style="max-width:600px; margin: 0 auto; padding: 30px;">
        <ol style="padding: 0; text-align:left; margin:0; list-style: none;">
          {#each final as entry, i (entry.playerId)}
            <li style="display:flex; justify-content:space-between; padding:15px 0; border-bottom:1px solid #f3f4f6; align-items: center;">
              <div style="display:flex; align-items: center; gap: 15px;">
                <span style="font-size: 1.5rem; opacity: 0.5; font-weight: 900;">#{i + 1}</span>
                <span style="font-weight:700; font-size: 1.2rem;">{entry.nickname}</span>
              </div>
              <strong style="font-size: 1.4rem; color: var(--brand);">{entry.score}</strong>
            </li>
          {/each}
        </ol>
      </div>
    </div>
  {/if}
</div>

<style>
  .meet-shared { min-height: 100vh; align-items: flex-start; }
  .reveal-question {
    margin: 8px 0 14px;
    font-size: clamp(1.2rem, 2.4vw, 1.75rem);
    line-height: 1.2;
  }
  .reveal-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    align-items: start;
  }
  .reveal-grid.has-board {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  }
  .reveal-chart, .reveal-board {
    padding: 18px;
    margin: 0;
    max-width: none;
    width: 100%;
  }
  @media (max-width: 800px) {
    .reveal-grid.has-board { grid-template-columns: 1fr; }
  }
</style>
