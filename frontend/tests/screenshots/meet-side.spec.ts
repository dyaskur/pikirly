import { test, expect } from '@playwright/test';
import {
  bootstrapGame,
  seedHostSession,
  startGame,
  answerAsPlayers,
  advanceQuestion,
} from './helpers';

const NICKNAMES = ['Alice', 'Bob', 'Charlie'];

test('Meet side panel — lobby, in-question, reveal screenshots', async ({ page, request }) => {
  const { gameId, hostToken, players } = await bootstrapGame(request, NICKNAMES);
  await seedHostSession(page, gameId, hostToken);

  await page.goto(`/host/${gameId}?mode=meet&surface=side`);
  await expect(page.getByText('Host Dashboard')).toBeVisible();

  await expect(page.getByText(`${NICKNAMES.length} players joined`)).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/screenshots/meet-side-lobby.png', fullPage: true });

  await startGame(request, gameId);
  await expect(page.getByText('Question in progress...')).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'test-results/screenshots/meet-side-in-question.png',
    fullPage: true,
  });

  await answerAsPlayers(
    request,
    gameId,
    players.map((p, i) => ({ playerId: p.playerId, choice: i % 4 })),
  );
  await advanceQuestion(request, gameId);

  await expect(page.getByText('Next Question')).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'test-results/screenshots/meet-side-reveal.png',
    fullPage: true,
  });
});
