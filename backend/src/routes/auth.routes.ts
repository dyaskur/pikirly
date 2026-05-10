import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { userRepo } from '../db/repositories/userRepo.js';
import { verifyJwt } from '../auth/middleware.js';

const googleUserInfoSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().optional(),
});

// In-memory store for temporary pairing codes (used for iframe-safe auth)
const pairingStore = new Map<string, { token: string; expires: number }>();

// Cleanup expired pairing codes every minute
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pairingStore.entries()) {
    if (now > data.expires) pairingStore.delete(code);
  }
}, 60000);

export async function authRoutes(app: FastifyInstance) {
  // GET /auth/google - handled by oauth2 plugin directly because of startRedirectPath

  app.get('/auth/google/callback', async (req, reply) => {
    const token = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
    
    // Check for pairing code in cookie (if we want to use cookies to track it through the flow)
    // But for now, we'll just pass it through query params from the frontend if needed
    const pairingCode = (req.query as any).state; // We'll use the 'state' param for the pairing code

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

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    let redirectUrl = `${frontendUrl}/login/callback?token=${jwtToken}`;
    if (pairingCode) {
      redirectUrl += `&pairingCode=${pairingCode}`;
    }
    reply.redirect(redirectUrl);
  });

  app.post('/auth/logout', async (req, reply) => {
    reply.clearCookie('token', { path: '/' });
    reply.send({ success: true });
  });

  app.get('/auth/me', { preValidation: [verifyJwt] }, async (req, reply) => {
    reply.send(req.user);
  });

  // NEW: Support for pairing-code based auth (iframe-safe)
  app.post('/auth/pairing/save', async (req, reply) => {
    const schema = z.object({
      pairingCode: z.string().min(10),
      token: z.string().min(10),
    });

    const body = schema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: 'invalid_params' });

    pairingStore.set(body.data.pairingCode, {
      token: body.data.token,
      expires: Date.now() + 5 * 60000, // 5 minutes
    });

    return { ok: true };
  });

  app.get('/auth/pairing/poll/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const data = pairingStore.get(code);

    if (!data) return reply.status(404).send({ error: 'not_found' });
    if (Date.now() > data.expires) {
      pairingStore.delete(code);
      return reply.status(410).send({ error: 'expired' });
    }

    // Return the token and remove it (single-use)
    pairingStore.delete(code);
    return { token: data.token };
  });
}
