import type { Page, APIRequestContext } from '@playwright/test';

const BACKEND_URL = 'http://localhost:3001';

export interface BootstrapResult {
  gameId: string;
  hostToken: string;
  players: Array<{ playerId: string; playerToken: string; nickname: string }>;
}

export async function bootstrapGame(
  request: APIRequestContext,
  nicknames: string[],
): Promise<BootstrapResult> {
  const res = await request.post(`${BACKEND_URL}/test/games`, {
    data: { players: nicknames },
  });
  if (!res.ok()) throw new Error(`bootstrapGame failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as BootstrapResult;
}

export async function seedHostSession(page: Page, gameId: string, hostToken: string) {
  await page.addInitScript(
    ([id, token]) => {
      localStorage.setItem('pikirly.host', JSON.stringify({ gameId: id, hostToken: token }));
    },
    [gameId, hostToken],
  );
}

export async function broadcastExistingPlayers(request: APIRequestContext, gameId: string) {
  await request.post(`${BACKEND_URL}/test/games/${gameId}/players/broadcast`);
}

export async function startGame(request: APIRequestContext, gameId: string) {
  const res = await request.post(`${BACKEND_URL}/test/games/${gameId}/start`);
  if (!res.ok()) throw new Error(`startGame failed: ${res.status()} ${await res.text()}`);
}

export async function answerAsPlayers(
  request: APIRequestContext,
  gameId: string,
  answers: Array<{ playerId: string; choice: number }>,
) {
  for (const a of answers) {
    await request.post(`${BACKEND_URL}/test/games/${gameId}/answer`, { data: a });
  }
}

export async function advanceQuestion(request: APIRequestContext, gameId: string) {
  const res = await request.post(`${BACKEND_URL}/test/games/${gameId}/advance`);
  if (!res.ok()) throw new Error(`advance failed: ${res.status()} ${await res.text()}`);
}
