import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ensureDefaultOwner } from './db/seed.js';
import { query } from './db/pool.js';
import { authRouter } from './routes/authRoutes.js';
import { botRouter } from './routes/botRoutes.js';
import { ownerRouter } from './routes/ownerRoutes.js';
import { realtimeHub } from './services/realtimeHub.js';
import { recoverPersistedSessions } from '../bot/sessionManager.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

const PERMISSIONS_POLICY_VALUE =
  'accelerometer=(), autoplay=(), camera=(), cross-origin-isolated=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=(), interest-cohort=()';

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY_VALUE);
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Creator', 'Kyuu (https://github.com/KyuuX444)');
  res.setHeader('X-License', 'NOT FOR SALE - Mandatory Creator Attribution');

  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }

  if (!req.cookies?.['wbm_session'] && !req.cookies?.['wbm_sec']) {
    const token = crypto.randomBytes(16).toString('hex');
    res.cookie('wbm_sec', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 3600 * 1000,
    });
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'Rubby WA Bot',
    creator: 'Kyuu (https://github.com/KyuuX444)',
    license: 'NOT FOR SALE',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/public/stats', async (_req, res) => {
  try {
    const statsRes = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM whatsapp_sessions WHERE connection_status = 'connected') AS connected_sessions,
        (SELECT COALESCE(SUM(messages_received), 0)::bigint FROM whatsapp_sessions) AS total_messages,
        (SELECT COALESCE(SUM(commands_executed), 0)::bigint FROM whatsapp_sessions) AS total_commands
    `);
    const row = statsRes.rows[0] || {};
    res.json({
      engine: 'ruby-baileys v1.5.18',
      uptimeSeconds: Math.floor(process.uptime()),
      totalUsers: Number(row.total_users || 0),
      connectedSessions: Number(row.connected_sessions || 0),
      totalMessages: Number(row.total_messages || 0),
      totalCommands: Number(row.total_commands || 0),
    });
  } catch {
    res.json({
      engine: 'ruby-baileys v1.5.18',
      uptimeSeconds: Math.floor(process.uptime()),
      totalUsers: 1,
      connectedSessions: 0,
      totalMessages: 0,
      totalCommands: 0,
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/bot', botRouter);
app.use('/api/owner', ownerRouter);

const clientDistPath = path.resolve(__dirname, '../../dist/client');
app.use(express.static(clientDistPath, { index: false }));

let cachedIndexHtmlWithSri: string | null = null;

function getIndexHtmlWithSri(): string | null {
  if (cachedIndexHtmlWithSri) return cachedIndexHtmlWithSri;
  const indexPath = path.join(clientDistPath, 'index.html');
  if (!fs.existsSync(indexPath)) return null;

  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace(
    /<(script|link)\b([^>]*?)\b(src|href)="(\/assets\/[^"]+)"([^>]*)>/g,
    (fullMatch, tag, beforeAttr, urlAttr, assetUrl, afterAttr) => {
      if (fullMatch.includes('integrity=')) return fullMatch;
      const filePath = path.join(clientDistPath, assetUrl.replace(/^\//, ''));
      if (!fs.existsSync(filePath)) return fullMatch;
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha384').update(content).digest('base64');
      return `<${tag}${beforeAttr}${urlAttr}="${assetUrl}" integrity="sha384-${hash}"${afterAttr}>`;
    }
  );

  cachedIndexHtmlWithSri = html;
  return cachedIndexHtmlWithSri;
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
    return;
  }

  const html = getIndexHtmlWithSri();
  if (!html) {
    res.status(200).send('Rubby WA Bot Server is running.');
    return;
  }

  const proto =
    (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() ||
    req.protocol ||
    'https';
  const host =
    (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() ||
    req.get('host') ||
    'localhost:3000';
  const origin = `${proto}://${host}`;

  const rendered = html.replace(/__OG_ORIGIN__/g, origin);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(rendered);
});

server.on('upgrade', (request, socket, head) => {
  const pathname = request.url?.split('?')[0];
  if (pathname === '/ws') {
    realtimeHub.handleUpgrade(request, socket, head);
  } else {
    socket.destroy();
  }
});

const PORT = Number(process.env.PORT || 3000);

async function bootstrap() {
  try {
    await ensureDefaultOwner();
    await recoverPersistedSessions();

    server.listen(PORT, '0.0.0.0', () => {
      console.log('==============================================================');
      console.log('  RUBBY WA BOT — MULTI-USER WHATSAPP BOT MANAGER');
      console.log('  Original Creator : Kyuu (https://github.com/KyuuX444)');
      console.log('  Website          : https://api.kyzzz.xyz');
      console.log('  License          : STRICTLY NOT FOR SALE (FREE OPEN SOURCE)');
      console.log(`  Server Listening : http://0.0.0.0:${PORT}`);
      console.log('==============================================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
