import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';
import { createGame } from '../services/game/createGame.js';
import { hostRoomOf, roomOf, tryStartGame } from '../services/game/lifecycle.js';
import { getGame } from '../services/game/store.js';
import { type AuthedUser, getSession, type IOSocket, setSession } from './session.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerHostHandlers(io: IO, socket: IOSocket) {
  socket.on('create_game', async (payload, cb) => {
    const user = socket.data.user as AuthedUser | undefined;

    let result;
    try {
      result = await createGame(payload.quizId, user);
    } catch {
      cb({ ok: false, error: 'internal_error' });
      return;
    }

    if (!result.ok) {
      cb({ ok: false, error: result.error });
      return;
    }

    const { game } = result;
    game.hostSocketId = socket.id;

    setSession(socket, {
      role: 'host',
      gameId: game.gameId,
      hostToken: game.hostToken,
    });

    socket.join(roomOf(game.gameId));
    socket.join(hostRoomOf(game.gameId));
    cb({ ok: true, gameId: game.gameId, hostToken: game.hostToken });
  });

  socket.on('start_game', (payload, cb) => {
    const sess = getSession(socket);
    if (sess.role !== 'host' || sess.gameId !== payload.gameId) {
      cb({ ok: false, error: 'forbidden' });
      return;
    }
    const game = getGame(payload.gameId);
    if (!game) {
      cb({ ok: false, error: 'game_not_found' });
      return;
    }
    const result = tryStartGame(io, game);
    cb(result);
  });
}
