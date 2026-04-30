import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';
import { DEFAULT_QUIZ_ID, QUIZZES } from '../data/quizzes.js';
import { createGameState, publicPlayers } from '../services/game/engine.js';
import {
  cleanupGame,
  hostRoomOf,
  maybeEndEarly,
  recordAnswer,
  roomOf,
  startGame,
} from '../services/game/lifecycle.js';
import { generatePin, getGame, setGame } from '../services/game/store.js';
import { randomUUID } from 'node:crypto';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketSessionData {
  role?: 'host' | 'player';
  gameId?: string;
  playerId?: string;
  hostToken?: string;
}

const sessions = new WeakMap<IOSocket, SocketSessionData>();

function session(s: IOSocket): SocketSessionData {
  let d = sessions.get(s);
  if (!d) {
    d = {};
    sessions.set(s, d);
  }
  return d;
}

export function registerHandlers(io: IO) {
  io.on('connection', (socket) => {
    socket.on('create_game', (payload, cb) => {
      const quizId = payload.quizId ?? DEFAULT_QUIZ_ID;
      const quiz = QUIZZES[quizId];
      if (!quiz) {
        cb({ ok: false, error: 'unknown_quiz' });
        return;
      }
      const gameId = generatePin();
      const game = createGameState(quiz, gameId);
      game.hostSocketId = socket.id;
      setGame(game);

      const sess = session(socket);
      sess.role = 'host';
      sess.gameId = gameId;
      sess.hostToken = game.hostToken;

      socket.join(roomOf(gameId));
      socket.join(hostRoomOf(gameId));
      cb({ ok: true, gameId, hostToken: game.hostToken });
    });

    socket.on('join_game', (payload, cb) => {
      const game = getGame(payload.gameId);
      if (!game) {
        cb({ ok: false, error: 'game_not_found' });
        return;
      }
      const nickname = (payload.nickname ?? '').trim().slice(0, 24);
      if (!nickname) {
        cb({ ok: false, error: 'invalid_nickname' });
        return;
      }

      // Reconnect path (also fires on first mount of play page)
      if (payload.playerId && game.players.has(payload.playerId)) {
        const existing = game.players.get(payload.playerId)!;
        existing.connected = true;
        existing.socketId = socket.id;
        const sess = session(socket);
        sess.role = 'player';
        sess.gameId = game.gameId;
        sess.playerId = payload.playerId;
        socket.join(roomOf(game.gameId));
        cb({
          ok: true,
          playerId: existing.playerId,
          players: publicPlayers(game),
          status: game.status,
        });
        // Re-emit current question so events missed during SPA navigation are recovered.
        if (game.status === 'in_question' && game.currentQuestionIndex >= 0) {
          const q = game.quiz.questions[game.currentQuestionIndex];
          if (q && game.questionDeadlineAt && Date.now() < game.questionDeadlineAt + 500) {
            socket.emit('question', {
              index: game.currentQuestionIndex,
              total: game.quiz.questions.length,
              text: q.text,
              choices: q.choices,
              deadlineMs: game.questionDeadlineAt,
              limitMs: q.limitMs,
            });
          }
        }
        return;
      }

      // Reject duplicate nicknames (case-insensitive) for clarity.
      const lower = nickname.toLowerCase();
      for (const p of game.players.values()) {
        if (p.nickname.toLowerCase() === lower) {
          cb({ ok: false, error: 'nickname_taken' });
          return;
        }
      }

      // Only allow new joins during lobby.
      if (game.status !== 'lobby') {
        cb({ ok: false, error: 'game_in_progress' });
        return;
      }

      const playerId = randomUUID();
      game.players.set(playerId, {
        playerId,
        nickname,
        score: 0,
        connected: true,
        joinedAt: Date.now(),
        socketId: socket.id,
      });

      const sess = session(socket);
      sess.role = 'player';
      sess.gameId = game.gameId;
      sess.playerId = playerId;

      socket.join(roomOf(game.gameId));
      socket
        .to(roomOf(game.gameId))
        .emit('player_joined', { playerId, nickname, score: 0 });
      cb({
        ok: true,
        playerId,
        players: publicPlayers(game),
        status: game.status,
      });
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

    socket.on('submit_answer', (payload) => {
      const game = getGame(payload.gameId);
      if (!game) return;
      const result = recordAnswer(
        game,
        payload.playerId,
        payload.questionIndex,
        payload.choice,
        payload.clientTs,
      );
      socket.emit('answer_ack', {
        accepted: result.accepted,
        reason: result.reason,
        questionIndex: payload.questionIndex,
      });
      if (result.accepted) maybeEndEarly(io, game, payload.questionIndex);
    });

    socket.on('disconnect', () => {
      const sess = sessions.get(socket);
      if (!sess?.gameId) return;
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

      // If the lobby empties out, drop the game.
      if (game.status === 'lobby' && game.players.size === 0 && !game.hostSocketId) {
        cleanupGame(game.gameId);
      }
    });
  });
}
