import { writable } from 'svelte/store';

export interface PlayerSession {
  gameId: string;
  playerId: string;
  nickname: string;
}

const KEY = 'quizzr.player';

function load(): PlayerSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

function persist(s: PlayerSession | null) {
  if (typeof localStorage === 'undefined') return;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
}

export const playerSession = writable<PlayerSession | null>(load());
playerSession.subscribe(persist);
