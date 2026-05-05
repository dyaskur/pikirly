import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';

export type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface SocketSessionData {
  role?: 'host' | 'player';
  gameId?: string;
  playerId?: string;
  hostToken?: string;
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
}

const sessions = new WeakMap<IOSocket, SocketSessionData>();

export function getSession(s: IOSocket): SocketSessionData {
  let d = sessions.get(s);
  if (!d) {
    d = {};
    sessions.set(s, d);
  }
  return d;
}

export function setSession(s: IOSocket, data: Partial<SocketSessionData>) {
  const current = getSession(s);
  Object.assign(current, data);
}
