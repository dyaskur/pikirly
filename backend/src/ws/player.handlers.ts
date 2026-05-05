import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';
import { publicPlayers } from '../services/game/engine.js';
import { maybeEndEarly, recordAnswer, roomOf } from '../services/game/lifecycle.js';
import { getGame } from '../services/game/store.js';
import { randomUUID } from 'node:crypto';
import { type IOSocket, setSession } from './session.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerPlayerHandlers(io: IO, socket: IOSocket) {
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

    // Reconnect path
    if (payload.playerId && game.players.has(payload.playerId)) {
      const existing = game.players.get(payload.playerId)!;
      existing.connected = true;
      existing.socketId = socket.id;
      
      setSession(socket, {
        role: 'player',
        gameId: game.gameId,
        playerId: payload.playerId,
      });

      socket.join(roomOf(game.gameId));
      cb({
        ok: true,
        playerId: existing.playerId,
        players: publicPlayers(game),
        status: game.status,
      });
      
      // Re-emit current question
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

    const lower = nickname.toLowerCase();
    for (const p of game.players.values()) {
      if (p.nickname.toLowerCase() === lower) {
        cb({ ok: false, error: 'nickname_taken' });
        return;
      }
    }

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

    setSession(socket, {
      role: 'player',
      gameId: game.gameId,
      playerId,
    });

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
}
