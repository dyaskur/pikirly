import type { Server } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';
import { cleanupGame, roomOf } from '../services/game/lifecycle.js';
import { getGame } from '../services/game/store.js';
import { type AuthedUser, getSession, type IOSocket } from './session.js';
import { registerHostHandlers } from './host.handlers.js';
import { registerPlayerHandlers } from './player.handlers.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerHandlers(io: IO, app: FastifyInstance) {
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const match = cookieHeader.match(/token=([^;]+)/);
    if (match) {
      try {
        socket.data.user = app.jwt.verify(match[1]) as AuthedUser;
      } catch {
        // invalid token
      }
    }
    next();
  });

  io.on('connection', (socket: IOSocket) => {
    registerHostHandlers(io, socket);
    registerPlayerHandlers(io, socket);

    socket.on('disconnect', () => {
      const sess = getSession(socket);
      if (!sess.gameId) return;
      const game = getGame(sess.gameId);
      if (!game) return;

      if (sess.role === 'player' && sess.playerId) {
        const p = game.players.get(sess.playerId);
        if (p) {
          p.connected = false;
          p.socketId = null;
        }
        socket.to(roomOf(sess.gameId)).emit('player_left', { playerId: sess.playerId });
      } else if (sess.role === 'host') {
        game.hostSocketId = null;
      }

      // Cleanup lobby if empty
      if (game.status === 'lobby' && game.players.size === 0 && !game.hostSocketId) {
        cleanupGame(game.gameId);
      }
    });
  });
}
