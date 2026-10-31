import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import argon2 from 'argon2';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { recordBotLog } from '../services/loggerService.js';
import type { User, UserRole } from '../../shared/types.js';

export const authRouter = Router();

const DEFAULT_GITHUB_DEVICE_CLIENT_ID = '178c6fc778ccc68e1d6a';

const pendingDeviceFlows = new Map<
  string,
  {
    deviceCode: string;
    clientId: string;
    userCode: string;
    verificationUri: string;
    interval: number;
    lastPolledAt: number;
    expiresAt: number;
  }
>();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait a few minutes.' },
});

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username cannot exceed 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email address is required'),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(16, 'Invalid reset token'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

async function createSessionForUser(req: Request, res: Response, userId: number): Promise<string> {
  const sessionToken = crypto.randomBytes(48).toString('hex');
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const ttlHours = Number(process.env.SESSION_TTL_HOURS || 72);
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  await query(
    `INSERT INTO user_sessions (id, user_id, csrf_token, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionToken, userId, csrfToken, ipAddress, userAgent, expiresAt.toISOString()]
  );

  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('wbm_session', sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return csrfToken;
}

async function resolveOrCreateGitHubUser(accessToken: string): Promise<User> {
  const ghUserRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Rubby-WA-Bot-Platform',
    },
  });

  if (!ghUserRes.ok) {
    throw new Error('Failed to fetch GitHub user profile.');
  }

  const ghUser: any = await ghUserRes.json();
  const githubId = String(ghUser.id);
  const githubLogin = String(ghUser.login || 'github_user');
  const avatarUrl = ghUser.avatar_url ? String(ghUser.avatar_url) : null;

  let primaryEmail: string | null = ghUser.email ? String(ghUser.email).toLowerCase() : null;

  if (!primaryEmail) {
    try {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Rubby-WA-Bot-Platform',
        },
      });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as any[];
        const found =
          emails.find((e) => e.primary && e.verified) ||
          emails.find((e) => e.verified) ||
          emails[0];
        if (found?.email) {
          primaryEmail = String(found.email).toLowerCase();
        }
      }
    } catch {
    }
  }

  if (!primaryEmail) {
    primaryEmail = `${githubId}+${githubLogin.toLowerCase()}@users.noreply.github.com`;
  }

  const existingRes = await query<User>(
    `SELECT id, username, email, role, status, github_id, github_username, avatar_url, created_at, updated_at
     FROM users
     WHERE github_id = $1 OR LOWER(email) = LOWER($2)
     ORDER BY CASE WHEN github_id = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [githubId, primaryEmail]
  );

  if (existingRes.rows.length > 0) {
    const existingUser = existingRes.rows[0];
    if (existingUser.status !== 'active') {
      throw new Error(`Account is currently ${existingUser.status}.`);
    }

    const updatedRes = await query<User>(
      `UPDATE users
       SET github_id = $1,
           github_username = $2,
           avatar_url = COALESCE($3, avatar_url),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, username, email, role, status, github_id, github_username, avatar_url, created_at, updated_at`,
      [githubId, githubLogin, avatarUrl, existingUser.id]
    );

    const user = updatedRes.rows[0];
    await recordBotLog(
      user.id,
      'auth',
      `Authenticated via GitHub (@${githubLogin}) — Synchronized Bot Role: ${user.role}`,
      'success'
    );
    return user;
  }

  let baseUsername = githubLogin.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 26);
  if (baseUsername.length < 3) {
    baseUsername = `gh_${baseUsername}`;
  }

  let candidateUsername = baseUsername;
  for (let attempt = 0; attempt < 5; attempt++) {
    const unameCheck = await query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [candidateUsername]
    );
    if (unameCheck.rows.length === 0) break;
    candidateUsername = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;
  }

  const randomPwd = crypto.randomBytes(32).toString('hex');
  const passwordHash = await argon2.hash(randomPwd, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const ownerCheck = await query(`SELECT id FROM users WHERE role = 'OWNER' LIMIT 1`);
  const isCreatorGitHub = githubLogin.toLowerCase() === 'kyuux444';
  const initialRole: UserRole =
    ownerCheck.rows.length === 0 || isCreatorGitHub ? 'OWNER' : 'FREE';

  const insertRes = await query<User>(
    `INSERT INTO users (username, email, password_hash, role, status, github_id, github_username, avatar_url)
     VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)
     RETURNING id, username, email, role, status, github_id, github_username, avatar_url, created_at, updated_at`,
    [
      candidateUsername,
      primaryEmail,
      passwordHash,
      initialRole,
      githubId,
      githubLogin,
      avatarUrl,
    ]
  );

  const newUser = insertRes.rows[0];

  await query(
    `INSERT INTO whatsapp_sessions (user_id, connection_status, bot_status)
     VALUES ($1, 'disconnected', 'stopped')
     ON CONFLICT (user_id) DO NOTHING`,
    [newUser.id]
  );

  await query(
    `INSERT INTO bot_settings (user_id, bot_name, prefix, auto_read, auto_typing, auto_online, public_mode, maintenance_mode)
     VALUES ($1, 'Rubby WA Bot', '/', false, true, true, true, false)
     ON CONFLICT (user_id) DO NOTHING`,
    [newUser.id]
  );

  await recordBotLog(
    newUser.id,
    'auth',
    `Account registered via GitHub (@${githubLogin}) with role ${newUser.role}. Bot role synchronized to ${newUser.role}.`,
    'success'
  );

  return newUser;
}

authRouter.get('/github/config', (_req: Request, res: Response) => {
  const webOAuthEnabled = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  );
  res.json({
    webOAuthEnabled,
    deviceFlowEnabled: true,
  });
});

authRouter.get('/github', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.redirect('/login?github_mode=device');
    return;
  }

  const state = crypto.randomBytes(20).toString('hex');
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('wbm_gh_state', state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });

  const proto =
    (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() ||
    req.protocol ||
    'https';
  const host =
    (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() ||
    req.get('host');
  const redirectUri = `${proto}://${host}/api/auth/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

authRouter.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const savedState = req.cookies?.['wbm_gh_state'];

    res.clearCookie('wbm_gh_state', { path: '/' });

    if (!code || !state || state !== savedState) {
      res.redirect('/login?error=Invalid+GitHub+OAuth+state');
      return;
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) {
      res.redirect('/login?error=GitHub+authorization+failed');
      return;
    }

    const user = await resolveOrCreateGitHubUser(tokenData.access_token);
    await createSessionForUser(req, res, user.id);

    res.redirect('/dashboard');
  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);
    const msg = encodeURIComponent(error?.message || 'GitHub sign in failed');
    res.redirect(`/login?error=${msg}`);
  }
});

authRouter.post('/github/device/start', authRateLimiter, async (_req: Request, res: Response) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID || DEFAULT_GITHUB_DEVICE_CLIENT_ID;

    const params = new URLSearchParams({
      client_id: clientId,
      scope: 'read:user user:email',
    });

    const ghRes = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Rubby-WA-Bot-Platform',
      },
      body: params.toString(),
    });

    const rawText = await ghRes.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      res.status(502).json({ error: 'GitHub OAuth server is temporarily busy. Please try again.' });
      return;
    }

    if (!ghRes.ok || !data.device_code || !data.user_code) {
      res.status(400).json({
        error: data.error_description || 'GitHub Device Flow returned an invalid response.',
      });
      return;
    }

    const flowToken = crypto.randomBytes(24).toString('hex');
    const expiresIn = Number(data.expires_in || 900);
    const interval = Math.max(5, Number(data.interval || 5));
    const verificationUri = data.verification_uri || 'https://github.com/login/device';
    const expiresAt = Date.now() + expiresIn * 1000;

    pendingDeviceFlows.set(flowToken, {
      deviceCode: data.device_code,
      clientId,
      userCode: data.user_code,
      verificationUri,
      interval,
      lastPolledAt: 0,
      expiresAt,
    });

    res.json({
      flowToken,
      userCode: data.user_code,
      verificationUri,
      expiresIn,
      expiresAt,
      interval,
    });
  } catch (error) {
    console.error('GitHub device flow start error:', error);
    res.status(500).json({ error: 'Failed to start GitHub authentication.' });
  }
});

authRouter.post('/github/device/poll', async (req: Request, res: Response) => {
  try {
    const flowToken = String(req.body?.flowToken || '');
    const flow = pendingDeviceFlows.get(flowToken);

    if (!flow || Date.now() > flow.expiresAt) {
      pendingDeviceFlows.delete(flowToken);
      res.json({
        status: 'expired',
        error: 'GitHub login code expired. Please request a new code.',
      });
      return;
    }

    const now = Date.now();
    const minWaitMs = Math.max(4500, flow.interval * 1000 - 400);
    if (flow.lastPolledAt > 0 && now - flow.lastPolledAt < minWaitMs) {
      res.json({
        status: 'pending',
        userCode: flow.userCode,
        verificationUri: flow.verificationUri,
        interval: flow.interval,
      });
      return;
    }

    flow.lastPolledAt = now;

    const params = new URLSearchParams({
      client_id: flow.clientId,
      device_code: flow.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    const pollRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Rubby-WA-Bot-Platform',
      },
      body: params.toString(),
    });

    const rawBody = await pollRes.text();
    let pollData: any;
    try {
      pollData = JSON.parse(rawBody);
    } catch {
      flow.interval = Math.min(15, flow.interval + 2);
      res.json({
        status: 'pending',
        slowDown: true,
        interval: flow.interval,
      });
      return;
    }

    if (pollData.error === 'authorization_pending') {
      res.json({
        status: 'pending',
        interval: flow.interval,
      });
      return;
    }

    if (pollData.error === 'slow_down') {
      flow.interval = Number(pollData.interval || flow.interval + 5);
      res.json({
        status: 'pending',
        slowDown: true,
        interval: flow.interval,
      });
      return;
    }

    if (
      pollData.error === 'expired_token' ||
      pollData.error === 'bad_verification_code'
    ) {
      pendingDeviceFlows.delete(flowToken);
      res.json({
        status: 'expired',
        error: 'GitHub device code expired. Please generate a new code.',
      });
      return;
    }

    if (pollData.error === 'access_denied') {
      pendingDeviceFlows.delete(flowToken);
      res.json({
        status: 'failed',
        error: 'GitHub authorization was cancelled by user.',
      });
      return;
    }

    if (pollData.error) {
      res.json({
        status: 'pending',
        interval: flow.interval,
      });
      return;
    }

    if (!pollData.access_token) {
      res.json({
        status: 'pending',
        interval: flow.interval,
      });
      return;
    }

    pendingDeviceFlows.delete(flowToken);

    const user = await resolveOrCreateGitHubUser(pollData.access_token);
    const csrfToken = await createSessionForUser(req, res, user.id);

    res.json({
      status: 'authenticated',
      user,
      csrfToken,
    });
  } catch (error: any) {
    console.error('GitHub device poll transient error:', error);
    res.json({
      status: 'pending',
    });
  }
});

authRouter.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { username, email, password } = parsed.data;

    const existing = await query(
      `SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1`,
      [username, email]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Username or email is already registered.' });
      return;
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const ownerCheck = await query(`SELECT id FROM users WHERE role = 'OWNER' LIMIT 1`);
    const initialRole: UserRole = ownerCheck.rows.length === 0 ? 'OWNER' : 'FREE';

    const userRes = await query<User>(
      `INSERT INTO users (username, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, username, email, role, status, github_id, github_username, avatar_url, created_at, updated_at`,
      [username, email, passwordHash, initialRole]
    );

    const newUser = userRes.rows[0];

    await query(
      `INSERT INTO whatsapp_sessions (user_id, connection_status, bot_status)
       VALUES ($1, 'disconnected', 'stopped')
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id]
    );

    await query(
      `INSERT INTO bot_settings (user_id, bot_name, prefix, auto_read, auto_typing, auto_online, public_mode, maintenance_mode)
       VALUES ($1, 'Rubby WA Bot', '/', false, true, true, true, false)
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id]
    );

    await recordBotLog(
      newUser.id,
      'auth',
      `Account registered with role ${newUser.role}. Bot role synchronized to ${newUser.role}.`,
      'success'
    );

    const csrfToken = await createSessionForUser(req, res, newUser.id);

    res.status(201).json({
      user: newUser,
      csrfToken,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

authRouter.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { identifier, password } = parsed.data;

    const userRes = await query<User & { password_hash: string }>(
      `SELECT id, username, email, password_hash, role, status, github_id, github_username, avatar_url, created_at, updated_at
       FROM users
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) OR LOWER(github_username) = LOWER($1)
       LIMIT 1`,
      [identifier]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid username/email or password.' });
      return;
    }

    const user = userRes.rows[0];

    const validPassword = await argon2.verify(user.password_hash, password);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid username/email or password.' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({
        error: `Your account is currently ${user.status}. Please contact the platform administrator.`,
      });
      return;
    }

    await query(`DELETE FROM user_sessions WHERE expires_at <= NOW()`);

    const csrfToken = await createSessionForUser(req, res, user.id);

    await recordBotLog(
      user.id,
      'auth',
      `User signed in to dashboard (Synchronized Role: ${user.role})`,
      'info'
    );

    const { password_hash: _, ...safeUser } = user;

    res.json({
      user: safeUser,
      csrfToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to sign in.' });
  }
});

authRouter.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.sessionId) {
      await query(`DELETE FROM user_sessions WHERE id = $1`, [req.sessionId]);
    }
    res.clearCookie('wbm_session', { path: '/' });
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to sign out.' });
  }
});

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    user: req.user,
    csrfToken: req.csrfToken,
  });
});

authRouter.post('/forgot-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { email } = parsed.data;
    const userRes = await query<User>(
      `SELECT id, username, email FROM users WHERE LOWER(email) = LOWER($1) AND status = 'active' LIMIT 1`,
      [email]
    );

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt.toISOString()]
      );

      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || '127.0.0.1',
          port: Number(process.env.SMTP_PORT || 25),
          secure: false,
          tls: { rejectUnauthorized: false },
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@jadibot.local',
          to: user.email,
          subject: 'Rubby WA Bot - Password Reset Request',
          text: `Hello ${user.username},\n\nUse the following link within 30 minutes to reset your password:\n${resetUrl}\n\nReset Token: ${rawToken}\n`,
        });
      } catch (mailErr) {
        console.warn('Local SMTP dispatch warning:', mailErr);
      }

      await recordBotLog(user.id, 'auth', 'Password reset token requested', 'info');
    }

    res.json({
      message: 'If an active account matches that email address, password reset instructions have been dispatched.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

authRouter.post('/reset-password', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetRes = await query<{ id: number; user_id: number }>(
      `SELECT id, user_id
       FROM password_resets
       WHERE token_hash = $1 AND used = false AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (resetRes.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired password reset token.' });
      return;
    }

    const resetRow = resetRes.rows[0];
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
      passwordHash,
      resetRow.user_id,
    ]);
    await query(`UPDATE password_resets SET used = true WHERE id = $1`, [resetRow.id]);
    await query(`DELETE FROM user_sessions WHERE user_id = $1`, [resetRow.user_id]);

    await recordBotLog(resetRow.user_id, 'auth', 'Password was reset successfully', 'success');

    res.json({ message: 'Password has been reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});
