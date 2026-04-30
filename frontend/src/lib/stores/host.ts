import { writable } from 'svelte/store';

export interface HostSession {
  gameId: string;
  hostToken: string;
}

const KEY = 'quizzr.host';

function load(): HostSession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HostSession;
  } catch {
    return null;
  }
}

function persist(s: HostSession | null) {
  if (typeof localStorage === 'undefined') return;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
}

export const hostSession = writable<HostSession | null>(load());
hostSession.subscribe(persist);
