import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pairingCodes } from '../db/schema.js';
import { userRepo } from '../db/repositories/userRepo.js';
import { verifyJwt } from '../auth/middleware.js';

const googleUserInfoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  email: z.string(),
  name: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // GET /auth/google - handled by oauth2 plugin directly because of startRedirectPath

  app.get('/auth/google/callback', async (req, reply) => {
    // Validate state (pairingCode) strictly
    const querySchema = z.object({
      state: z.string().optional()
    });
    const query = querySchema.parse(req.query);
    const pairingCode = query.state;
    
    console.log('[AUTH-V7] OAuth callback received. Pairing code:', pairingCode);

    const token = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);

    // Fetch user info with a 10s timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    let rawUserInfo;
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.token.access_token}` },
        signal: controller.signal,
      });
      rawUserInfo = await userInfoResponse.json();
    } finally {
      clearTimeout(timeoutId);
    }
    
    console.log('Google UserInfo received. ID:', rawUserInfo.id, 'Type:', typeof rawUserInfo.id);
    
    const parsed = googleUserInfoSchema.safeParse(rawUserInfo);
    if (!parsed.success) {
      console.error('UserInfo validation failed:', parsed.error);
      reply.status(400).send({ error: 'oauth_failed', message: 'Failed to validate user info' });
      return;
    }
    const userInfo = parsed.data;

    // Force ID to string to prevent any DB type inference issues
    const googleSub = String(userInfo.id).trim();
    console.log('[AUTH-V7] Processed googleSub for DB:', googleSub);

    let user;
    try {
      user = await userRepo.findOrCreateByGoogleSub(
        googleSub,
        userInfo.email,
        userInfo.name ?? userInfo.email,
      );
    } catch (dbErr) {
      console.error('[AUTH-V7] DB Query Failed:', dbErr);
      return reply.status(500).send({ 
        error: 'database_error', 
        message: 'Failed to find or create user',
        debug: googleSub 
      });
    }

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

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/host\/?$/, '').replace(/\/+$/, '');
    
    // SECURITY: Do not put JWT in the redirect query string to prevent leakage in logs/history.
    // Instead, rely on the pairing flow (if pairingCode present) or httpOnly cookie.
    let redirectUrl = `${frontendUrl}/login/callback`;
    
    if (pairingCode) {
      console.log(`[AUTH-V7] Linking token to pairingCode: ${pairingCode}`);
      try {
        await db.insert(pairingCodes).values({
          code: pairingCode,
          token: jwtToken,
          expiresAt: new Date(Date.now() + 5 * 60000), // 5 minutes
        });
        
        // Append pairingCode to redirect so frontend knows it can close/notify
        const sep = redirectUrl.includes('?') ? '&' : '?';
        redirectUrl += `${sep}pairingCode=${encodeURIComponent(pairingCode)}`;
      } catch (err) {
        console.error('Failed to save pairing code to db:', err);
      }
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

  app.get('/auth/pairing/poll/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const records = await db.select().from(pairingCodes).where(eq(pairingCodes.code, code));
    const data = records[0];

    if (!data) return reply.status(404).send({ error: 'not_found' });
    if (Date.now() > data.expiresAt.getTime()) {
      await db.delete(pairingCodes).where(eq(pairingCodes.code, code));
      return reply.status(410).send({ error: 'expired' });
    }

    // Return the token and remove it (single-use)
    await db.delete(pairingCodes).where(eq(pairingCodes.code, code));
    return { token: data.token };
  });
}
