import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

let io: IO | null = null;

export function setIO(instance: IO) {
  io = instance;
}

export function getIO(): IO {
  if (!io) throw new Error('Socket.IO not initialized yet');
  return io;
}
