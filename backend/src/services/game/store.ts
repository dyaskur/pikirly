// In-memory game store for Phase 1. Replace with Redis in Phase 2.
import type { GameState } from './engine.js';

const games = new Map<string, GameState>();

export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId);
}

export function setGame(g: GameState): void {
  games.set(g.gameId, g);
}

export function deleteGame(gameId: string): void {
  games.delete(gameId);
}

export function gameExists(gameId: string): boolean {
  return games.has(gameId);
}

// Generate a 6-digit PIN, retry on collision.
export function generatePin(): string {
  for (let i = 0; i < 10; i++) {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    if (!games.has(pin)) return pin;
  }
  throw new Error('Could not allocate game PIN');
}
