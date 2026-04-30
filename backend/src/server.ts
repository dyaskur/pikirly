import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as IOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';
import { registerHandlers } from './ws/index.js';
import { getGame } from './services/game/store.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

async function main() {
  const app = Fastify({ logger: { level: 'info' } });
  await app.register(cors, { origin: ORIGIN, credentials: true });

  app.get('/health', async () => ({ ok: true, ts: Date.now() }));

  app.get('/games/:gameId', async (req, reply) => {
    const { gameId } = req.params as { gameId: string };
    const game = getGame(gameId);
    if (!game) {
      reply.code(404).send({ exists: false });
      return;
    }
    reply.send({ exists: true, status: game.status, playerCount: game.players.size });
  });

  await app.listen({ port: PORT, host: HOST });

  const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: ORIGIN, credentials: true },
  });
  registerHandlers(io);

  app.log.info(`Socket.IO ready on ws://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
