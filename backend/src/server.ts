import Fastify from 'fastify';
import cors from '@fastify/cors';
import oauthPlugin from '@fastify/oauth2';
import jwtPlugin from '@fastify/jwt';
import cookiePlugin from '@fastify/cookie';
import { Server as IOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kahoot/shared';
import { registerHandlers } from './ws/index.js';
import { getGame } from './services/game/store.js';
import { authRoutes } from './routes/auth.routes.js';
import { quizRoutes } from './routes/quiz.routes.js';

// Bypass self-signed certificate errors for local development behind corporate proxies
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

async function main() {
  const app = Fastify({ logger: { level: 'info' } });
  
  await app.register(cors, { origin: ORIGIN, credentials: true });
  await app.register(cookiePlugin);
  await app.register(jwtPlugin, {
    secret: process.env.JWT_SECRET || 'supersecretdevjwt',
    cookie: {
      cookieName: 'token',
      signed: false,
    }
  });
  
  await app.register(oauthPlugin, {
    name: 'googleOAuth2',
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID || '',
        secret: process.env.GOOGLE_CLIENT_SECRET || '',
      },
      auth: oauthPlugin.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/auth/google',
    callbackUri: `${process.env.BACKEND_URL || 'http://localhost:3001'}/auth/google/callback`,
    scope: ['profile', 'email'],
  });

  app.get('/health', async () => ({ ok: true, ts: Date.now() }));

  await app.register(authRoutes);
  await app.register(quizRoutes);
  await app.register(aiRoutes);

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
  registerHandlers(io, app);

  app.log.info(`Socket.IO ready on ws://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
