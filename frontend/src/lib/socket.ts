import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';

const URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001';

let _socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (_socket) return _socket;
  _socket = io(URL, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
  });
  return _socket;
}
