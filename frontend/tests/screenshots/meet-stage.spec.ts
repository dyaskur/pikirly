import { test, expect } from '@playwright/test';
import {
  bootstrapGame,
  seedHostSession,
  broadcastExistingPlayers,
  startGame,
  answerAsPlayers,
  advanceQuestion,
} from './helpers';

const NICKNAMES = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eve'];

test('Meet stage — lobby, in-question, reveal screenshots', async ({ page, request }) => {
  const { gameId, hostToken, players } = await bootstrapGame(request, NICKNAMES);
  await seedHostSession(page, gameId, hostToken);

  await page.goto(`/host/${gameId}?mode=meet&surface=stage`);
  await expect(page.getByText(`${gameId}`).first()).toBeVisible();

  await broadcastExistingPlayers(request, gameId);
  await expect(page.getByText(`Players (${NICKNAMES.length})`)).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/screenshots/meet-stage-lobby.png', fullPage: true });

  await startGame(request, gameId);
  await expect(page.getByText(/Question 1 \/ 5/)).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: 'test-results/screenshots/meet-stage-in-question.png',
    fullPage: true,
  });

  // Spread answers across 4 choices so the distribution chart looks realistic.
  await answerAsPlayers(
    request,
    gameId,
    players.map((p, i) => ({ playerId: p.playerId, choice: i % 4 })),
  );
  await advanceQuestion(request, gameId);

  await expect(page.getByText(/Results/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: 'test-results/screenshots/meet-stage-reveal.png',
    fullPage: true,
  });
});
