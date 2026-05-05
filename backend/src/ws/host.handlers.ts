import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';
import { DEFAULT_QUIZ_ID, QUIZZES } from '../data/quizzes.js';
import { createGameState } from '../services/game/engine.js';
import { hostRoomOf, roomOf, startGame } from '../services/game/lifecycle.js';
import { generatePin, getGame, setGame } from '../services/game/store.js';
import { quizRepo } from '../db/repositories/quizRepo.js';
import { type AuthedUser, getSession, type IOSocket, setSession } from './session.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerHostHandlers(io: IO, socket: IOSocket) {
  socket.on('create_game', async (payload, cb) => {
    const quizId = payload.quizId ?? DEFAULT_QUIZ_ID;
    let quizForGame: { id: string; title: string; questions: typeof QUIZZES[string]['questions'] } | null = null;
    const user = socket.data.user as AuthedUser | undefined;
    let userId: string | undefined = user?.id;

    if (quizId === DEFAULT_QUIZ_ID) {
      quizForGame = QUIZZES[DEFAULT_QUIZ_ID];
    } else {
      if (!user) {
        cb({ ok: false, error: 'unauthorized' });
        return;
      }
      const row = await quizRepo.getById(quizId, user.id);
      if (row) {
        quizForGame = { id: row.id, title: row.title, questions: row.questions };
      }
    }

    if (!quizForGame) {
      cb({ ok: false, error: 'unknown_quiz' });
      return;
    }
    const gameId = generatePin();
    const dbQuizId = quizId === DEFAULT_QUIZ_ID ? undefined : quizForGame.id;
    const game = createGameState(quizForGame, gameId, dbQuizId, userId);
    game.hostSocketId = socket.id;
    setGame(game);

    setSession(socket, {
      role: 'host',
      gameId,
      hostToken: game.hostToken,
    });

    socket.join(roomOf(gameId));
    socket.join(hostRoomOf(gameId));
    cb({ ok: true, gameId, hostToken: game.hostToken });
  });

  socket.on('start_game', (payload, cb) => {
    const game = getGame(payload.gameId);
    if (!game) {
      cb({ ok: false, error: 'game_not_found' });
      return;
    }
    if (game.hostToken !== payload.hostToken) {
      cb({ ok: false, error: 'forbidden' });
      return;
    }
    if (game.status !== 'lobby') {
      cb({ ok: false, error: 'already_started' });
      return;
    }
    if (game.players.size === 0) {
      cb({ ok: false, error: 'no_players' });
      return;
    }
    cb({ ok: true });
    startGame(io, game);
  });
}
