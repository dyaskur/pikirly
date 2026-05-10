// In-memory game store for Phase 1. Replace with Redis in Phase 2.
import type { GameState } from './engine.js';

const games = new Map<string, GameState>();
const meetingsToGames = new Map<string, string>(); // meetingId -> gameId

export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId);
}

export function setGame(game: GameState) {
  games.set(game.gameId, game);
  if (game.meetingId) {
    meetingsToGames.set(game.meetingId, game.gameId);
  }
}

export function deleteGame(gameId: string) {
  const g = games.get(gameId);
  if (g?.meetingId) {
    meetingsToGames.delete(g.meetingId);
  }
  games.delete(gameId);
}

export function gameExists(gameId: string): boolean {
  return games.has(gameId);
}

export function findByMeetingId(meetingId: string): GameState | undefined {
  const gameId = meetingsToGames.get(meetingId);
  if (!gameId) return undefined;

  const game = games.get(gameId);
  // Ensure the game is still active
  if (game && (game.status === 'lobby' || game.status === 'in_question' || game.status === 'between')) {
    return game;
  }

  // Cleanup if stale
  meetingsToGames.delete(meetingId);
  return undefined;
}

// Generate a 6-digit PIN, retry on collision.
export function generatePin(): string {
  for (let i = 0; i < 10; i++) {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    if (!games.has(pin)) return pin;
  }
  throw new Error('Could not allocate game PIN');
}
