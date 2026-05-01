import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { userRepo } from '../db/repositories/userRepo.js';
import { verifyJwt } from '../auth/middleware.js';

const googleUserInfoSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // GET /auth/google - handled by oauth2 plugin directly because of startRedirectPath

  app.get('/auth/google/callback', async (req, reply) => {
    const token = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token.token.access_token}` },
    });
    const parsed = googleUserInfoSchema.safeParse(await userInfoResponse.json());
    if (!parsed.success) {
      reply.status(400).send({ error: 'oauth_failed', message: 'Failed to get user info' });
      return;
    }
    const userInfo = parsed.data;

    const user = await userRepo.findOrCreateByGoogleSub(
      userInfo.id,
      userInfo.email,
      userInfo.name ?? userInfo.email,
    );

    const jwtToken = await reply.jwtSign({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    reply.setCookie('token', jwtToken, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    reply.redirect(process.env.FRONTEND_URL || 'http://localhost:5173/host');
  });

  app.post('/auth/logout', async (req, reply) => {
    reply.clearCookie('token', { path: '/' });
    reply.send({ success: true });
  });

  app.get('/auth/me', { preValidation: [verifyJwt] }, async (req, reply) => {
    reply.send(req.user);
  });
}
