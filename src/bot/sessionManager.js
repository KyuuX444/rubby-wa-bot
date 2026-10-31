import makeWASocket, {
  usePostgresAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  jidNormalizedUser,
  jidDecode,
} from 'ruby-baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { pool, query } from '../server/db/pool.js';
import { realtimeHub } from '../server/services/realtimeHub.js';
import { recordBotLog } from '../server/services/loggerService.js';
import { authorizeBotAction } from './roleAuth.js';
import { attachBotRuntime, emitStatsUpdate } from './botRuntime.js';

const silentLogger = pino({ level: 'silent' });

const activeSessions = new Map();

const connectingPromises = new Map();

function hasPairedDeviceCredentials(creds) {
  if (!creds) return false;
  if (creds.registered) return true;
  if (creds.account && creds.me?.id) return true;
  const decoded = creds.me?.id ? jidDecode(creds.me.id) : null;
  return Boolean(decoded && decoded.device !== undefined);
}

export async function ensureUserBotRecords(userId) {
  await query(
    `INSERT INTO whatsapp_sessions (user_id, connection_status, bot_status)
     VALUES ($1, 'disconnected', 'stopped')
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  await query(
    `INSERT INTO bot_settings (user_id, bot_name, prefix, auto_read, auto_typing, auto_online, public_mode, maintenance_mode)
     VALUES ($1, 'Rubby WA Bot', '/', false, true, true, true, false)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const settingsRes = await query(`SELECT * FROM bot_settings WHERE user_id = $1`, [userId]);
  const sessionRes = await query(`SELECT * FROM whatsapp_sessions WHERE user_id = $1`, [userId]);

  return {
    settings: settingsRes.rows[0],
    sessionRow: sessionRes.rows[0],
  };
}

export async function getUserSessionStatus(userId) {
  const { settings, sessionRow } = await ensureUserBotRecords(userId);
  const live = activeSessions.get(userId);

  if (live) {
    const rs = live.runtimeState;
    const uptimeSeconds =
      rs.connectionStatus === 'connected' && rs.connectedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(rs.connectedAt).getTime()) / 1000))
        : 0;

    const pairingExpiresIn =
      live.pairingExpiresAt && live.pairingExpiresAt > Date.now()
        ? Math.ceil((live.pairingExpiresAt - Date.now()) / 1000)
        : 0;

    if (pairingExpiresIn <= 0 && live.lastPairingCode) {
      live.lastPairingCode = null;
      live.pairingExpiresAt = null;
    }

    return {
      id: sessionRow.id,
      user_id: userId,
      phone_number: rs.phoneNumber || live.lastPairingPhone || null,
      jid: rs.jid,
      push_name: rs.pushName,
      connection_status: rs.connectionStatus,
      bot_status: rs.botStatus,
      connection_mode: live.mode || 'qr',
      messages_received: Number(rs.messagesReceived || 0),
      commands_executed: Number(rs.commandsExecuted || 0),
      connected_at: rs.connectedAt,
      updated_at: new Date().toISOString(),
      uptime_seconds: uptimeSeconds,
      qr_data_url: live.lastQrDataUrl || null,
      pairing_code: pairingExpiresIn > 0 ? live.lastPairingCode : null,
      pairing_phone: live.lastPairingPhone || rs.phoneNumber || null,
      pairing_expires_in: pairingExpiresIn,
      settings,
    };
  }

  const uptimeSeconds =
    sessionRow.connection_status === 'connected' && sessionRow.connected_at
      ? Math.max(0, Math.floor((Date.now() - new Date(sessionRow.connected_at).getTime()) / 1000))
      : 0;

  return {
    id: sessionRow.id,
    user_id: userId,
    phone_number: sessionRow.phone_number,
    jid: sessionRow.jid,
    push_name: sessionRow.push_name,
    connection_status: sessionRow.connection_status,
    bot_status: sessionRow.bot_status,
    connection_mode: 'qr',
    messages_received: Number(sessionRow.messages_received || 0),
    commands_executed: Number(sessionRow.commands_executed || 0),
    connected_at: sessionRow.connected_at,
    updated_at: sessionRow.updated_at,
    uptime_seconds: uptimeSeconds,
    qr_data_url: null,
    pairing_code: null,
    pairing_phone: sessionRow.phone_number || null,
    pairing_expires_in: 0,
    settings,
  };
}

export async function cleanupUserSocket(userId, wipeCredentials = false) {
  const existing = activeSessions.get(userId);
  if (existing) {
    existing.manualDisconnect = true;
    if (existing.reconnectTimer) {
      clearTimeout(existing.reconnectTimer);
      existing.reconnectTimer = null;
    }

    if (existing.lastSaveCredsPromise) {
      try {
        await existing.lastSaveCredsPromise;
      } catch {
      }
    }

    if (wipeCredentials) {
      try {
        existing.sock?.cancelPairingCode?.();
      } catch {
      }
    }

    try {
      existing.sock?.ev?.removeAllListeners?.();
      existing.sock?.ws?.close?.();
      existing.sock?.end?.(undefined);
    } catch {
    }

    if (wipeCredentials && existing.clearAuth) {
      try {
        await existing.clearAuth();
      } catch {
      }
    }
    activeSessions.delete(userId);
  } else if (wipeCredentials) {
    await query(`DELETE FROM "baileys_auth" WHERE session = $1`, [`user_${userId}`]);
  }
}

export async function startUserWhatsAppSession(userId, options = {}) {
  const mode = options.mode || 'qr';
  const forceReset = Boolean(options.forceReset);

  const authCheck = await authorizeBotAction(userId, 'FREE');
  if (!authCheck.allowed) {
    throw new Error(authCheck.reason || 'Unauthorized to start WhatsApp session');
  }

  const currentLive = activeSessions.get(userId);
  if (currentLive && !forceReset && mode !== 'reconnect') {
    if (currentLive.runtimeState.connectionStatus === 'connected') {
      return currentLive;
    }
    if (currentLive.isNewLogin || currentLive.runtimeState.connectionStatus === 'connecting') {
      return currentLive;
    }
    if (
      mode === 'qr' &&
      currentLive.mode === 'qr' &&
      currentLive.runtimeState.connectionStatus === 'waiting' &&
      currentLive.lastQrDataUrl
    ) {
      return currentLive;
    }
    if (
      mode === 'qr' &&
      currentLive.mode === 'pairing' &&
      currentLive.lastPairingCode &&
      currentLive.pairingExpiresAt &&
      currentLive.pairingExpiresAt > Date.now()
    ) {
      return currentLive;
    }
  }

  if (connectingPromises.has(userId)) {
    return connectingPromises.get(userId);
  }

  const connectTask = (async () => {
    try {
      await cleanupUserSocket(userId, Boolean(options.resetAuth));

      const { settings, sessionRow } = await ensureUserBotRecords(userId);

      let { state, saveCreds, clearAuth } = await usePostgresAuthState({
        pool,
        session: `user_${userId}`,
      });

      const isPaired = hasPairedDeviceCredentials(state.creds);

      if (
        ((mode === 'qr' || mode === 'pairing') && options.resetAuth) ||
        (!isPaired && state.creds?.me)
      ) {
        await clearAuth();
        const freshAuth = await usePostgresAuthState({
          pool,
          session: `user_${userId}`,
        });
        state = freshAuth.state;
        saveCreds = freshAuth.saveCreds;
        clearAuth = freshAuth.clearAuth;
      }

      const initialStatus = hasPairedDeviceCredentials(state.creds) ? 'connecting' : 'waiting';

      await query(
        `UPDATE whatsapp_sessions
         SET connection_status = $1, bot_status = 'stopped', updated_at = NOW()
         WHERE user_id = $2`,
        [initialStatus, userId]
      );

      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
        },
        logger: silentLogger,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        markOnlineOnConnect: Boolean(settings.auto_online),
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        qrTimeout: 60000,
        pairingCodeTimeoutMs: 180000,
      });

      let resolveHandshakeReady;
      const handshakeReadyPromise = new Promise((resolve) => {
        resolveHandshakeReady = resolve;
      });

      const sessionEntry = {
        userId,
        sock,
        state,
        saveCreds,
        clearAuth,
        settings,
        mode,
        manualDisconnect: false,
        isNewLogin: false,
        reconnectTimer: null,
        lastSaveCredsPromise: null,
        lastQrDataUrl: null,
        lastPairingCode: null,
        lastPairingPhone: null,
        pairingExpiresAt: null,
        handshakeReadyPromise,
        resolveHandshakeReady,
        runtimeState: {
          connectionStatus: initialStatus,
          botStatus: 'stopped',
          phoneNumber: sessionRow.phone_number || null,
          jid: sessionRow.jid || null,
          pushName: sessionRow.push_name || null,
          connectedAt: sessionRow.connected_at || null,
          messagesReceived: Number(sessionRow.messages_received || 0),
          commandsExecuted: Number(sessionRow.commands_executed || 0),
        },
      };

      activeSessions.set(userId, sessionEntry);

      sock.ev.on('creds.update', () => {
        const p = saveCreds().catch((err) => {
          console.error(`[User ${userId}] Failed to save creds:`, err);
        });
        sessionEntry.lastSaveCredsPromise = p;
      });

      attachBotRuntime(sessionEntry);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        if (qr) {
          sessionEntry.resolveHandshakeReady?.(true);

          if (sessionEntry.mode !== 'pairing') {
            try {
              const qrDataUrl = await QRCode.toDataURL(qr, {
                width: 280,
                margin: 1,
                color: {
                  dark: '#171717',
                  light: '#FFFFFF',
                },
              });

              sessionEntry.lastQrDataUrl = qrDataUrl;
              sessionEntry.runtimeState.connectionStatus = 'waiting';

              await query(
                `UPDATE whatsapp_sessions
                 SET connection_status = 'waiting', updated_at = NOW()
                 WHERE user_id = $1`,
                [userId]
              );

              realtimeHub.sendToUser(userId, 'whatsapp.qr', {
                qrDataUrl,
                status: 'waiting',
              });
              emitStatsUpdate(sessionEntry);
            } catch (qrErr) {
              console.error(`[User ${userId}] Failed to generate QR Data URL:`, qrErr);
            }
          }
        }

        if (isNewLogin) {
          sessionEntry.isNewLogin = true;
          sessionEntry.lastQrDataUrl = null;
          sessionEntry.lastPairingCode = null;
          sessionEntry.pairingExpiresAt = null;
          sessionEntry.runtimeState.connectionStatus = 'connecting';

          try {
            await saveCreds();
          } catch (err) {
            console.error(`[User ${userId}] Failed to flush creds on new login:`, err);
          }

          emitStatsUpdate(sessionEntry);
          await recordBotLog(
            userId,
            'connection',
            'Device pairing verified by WhatsApp server. Finalizing session...',
            'success'
          );
        }

        if (connection === 'connecting') {
          if (sessionEntry.runtimeState.connectionStatus !== 'waiting') {
            sessionEntry.runtimeState.connectionStatus = 'connecting';
            emitStatsUpdate(sessionEntry);
          }
        }

        if (connection === 'open') {
          sessionEntry.resolveHandshakeReady?.(true);
          sessionEntry.isNewLogin = false;
          sessionEntry.lastQrDataUrl = null;
          sessionEntry.lastPairingCode = null;
          sessionEntry.pairingExpiresAt = null;

          try {
            await saveCreds();
          } catch {
          }

          const rawJid = sock.user?.id || state.creds?.me?.id || '';
          const normalizedJid = rawJid ? jidNormalizedUser(rawJid) : null;
          const decoded = normalizedJid ? jidDecode(normalizedJid) : null;
          const phoneNumber = decoded?.user || sessionEntry.lastPairingPhone || null;
          const rawName = sock.user?.name || state.creds?.me?.name || '';
          const pushName = rawName && rawName !== '~' ? rawName : 'WhatsApp Account';
          const connectedAt = new Date().toISOString();
          const botStatus = sessionEntry.settings.maintenance_mode ? 'maintenance' : 'running';

          sessionEntry.runtimeState.connectionStatus = 'connected';
          sessionEntry.runtimeState.botStatus = botStatus;
          sessionEntry.runtimeState.phoneNumber = phoneNumber;
          sessionEntry.runtimeState.jid = normalizedJid;
          sessionEntry.runtimeState.pushName = pushName;
          sessionEntry.runtimeState.connectedAt = connectedAt;

          await query(
            `UPDATE whatsapp_sessions
             SET phone_number = $1,
                 jid = $2,
                 push_name = $3,
                 connection_status = 'connected',
                 bot_status = $4,
                 session_data = $5,
                 connected_at = $6,
                 updated_at = NOW()
             WHERE user_id = $7`,
            [
              phoneNumber,
              normalizedJid,
              pushName,
              botStatus,
              JSON.stringify({
                registered: true,
                platform: state.creds?.platform || 'whatsapp-web',
                lastConnectedAt: connectedAt,
              }),
              connectedAt,
              userId,
            ]
          );

          try {
            await sock.sendPresenceUpdate(
              sessionEntry.settings.auto_online ? 'available' : 'unavailable'
            );
          } catch {
          }

          emitStatsUpdate(sessionEntry);
          await recordBotLog(
            userId,
            'connection',
            `WhatsApp connected (+${phoneNumber || 'linked'}) as "${pushName}". Bot runtime is now ${botStatus.toUpperCase()}.`,
            'success'
          );
        }

        if (connection === 'close') {
          const statusCode =
            lastDisconnect?.error?.output?.statusCode ||
            lastDisconnect?.error?.statusCode ||
            0;
          const errMessage = lastDisconnect?.error?.message || 'Connection closed';

          if (sessionEntry.lastSaveCredsPromise) {
            try {
              await sessionEntry.lastSaveCredsPromise;
            } catch {
            }
          }

          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const deviceIsPaired =
            hasPairedDeviceCredentials(state.creds) ||
            sessionEntry.isNewLogin ||
            statusCode === DisconnectReason.restartRequired;

          if (isLoggedOut) {
            await cleanupUserSocket(userId, true);
            await query(
              `UPDATE whatsapp_sessions
               SET connection_status = 'disconnected',
                   bot_status = 'stopped',
                   phone_number = NULL,
                   jid = NULL,
                   push_name = NULL,
                   session_data = '{}'::jsonb,
                   connected_at = NULL,
                   updated_at = NOW()
               WHERE user_id = $1`,
              [userId]
            );

            sessionEntry.runtimeState.connectionStatus = 'disconnected';
            sessionEntry.runtimeState.botStatus = 'stopped';
            sessionEntry.runtimeState.phoneNumber = null;
            sessionEntry.runtimeState.jid = null;
            sessionEntry.runtimeState.pushName = null;
            sessionEntry.runtimeState.connectedAt = null;

            emitStatsUpdate(sessionEntry);
            await recordBotLog(
              userId,
              'connection',
              'WhatsApp session logged out from device. Credentials cleared.',
              'warn'
            );
            return;
          }

          if (sessionEntry.manualDisconnect) {
            sessionEntry.runtimeState.connectionStatus = 'disconnected';
            sessionEntry.runtimeState.botStatus = 'stopped';
            emitStatsUpdate(sessionEntry);
            return;
          }

          if (!deviceIsPaired) {
            await cleanupUserSocket(userId, true);
            await query(
              `UPDATE whatsapp_sessions
               SET connection_status = 'disconnected', bot_status = 'stopped', updated_at = NOW()
               WHERE user_id = $1`,
              [userId]
            );
            sessionEntry.runtimeState.connectionStatus = 'disconnected';
            sessionEntry.runtimeState.botStatus = 'stopped';
            emitStatsUpdate(sessionEntry);
            await recordBotLog(
              userId,
              'connection',
              'Connection window closed before device linking finished. Click Connect to generate a fresh code.',
              'warn'
            );
            return;
          }

          const delayMs = statusCode === DisconnectReason.restartRequired ? 400 : 2000;
          sessionEntry.runtimeState.connectionStatus = 'connecting';
          emitStatsUpdate(sessionEntry);

          await recordBotLog(
            userId,
            'connection',
            statusCode === DisconnectReason.restartRequired
              ? 'Pairing handshake succeeded. Opening authenticated WhatsApp stream...'
              : `Connection interrupted (${errMessage}, code ${statusCode}). Reconnecting in ${delayMs}ms...`,
            'info'
          );

          sessionEntry.reconnectTimer = setTimeout(() => {
            startUserWhatsAppSession(userId, {
              mode: 'reconnect',
              resetAuth: false,
              forceReset: true,
            }).catch((err) => {
              console.error(`[User ${userId}] Auto-reconnect error:`, err);
            });
          }, delayMs);
        }
      });

      emitStatsUpdate(sessionEntry);
      await recordBotLog(
        userId,
        'connection',
        `Initialized WhatsApp connection session (mode: ${mode.toUpperCase()})`,
        'info'
      );

      return sessionEntry;
    } finally {
      connectingPromises.delete(userId);
    }
  })();

  connectingPromises.set(userId, connectTask);
  return connectTask;
}

export async function requestUserPairingCode(
  userId,
  rawPhoneNumber,
  customPairingCode,
  forceNew = false
) {
  const authCheck = await authorizeBotAction(userId, 'FREE');
  if (!authCheck.allowed) {
    throw new Error(authCheck.reason || 'Account is not authorized');
  }

  let normalizedPhone = String(rawPhoneNumber || '').replace(/\D/g, '');
  if (normalizedPhone.startsWith('08')) {
    normalizedPhone = '62' + normalizedPhone.slice(1);
  }
  if (
    !normalizedPhone ||
    normalizedPhone.startsWith('0') ||
    normalizedPhone.length < 6 ||
    normalizedPhone.length > 15
  ) {
    throw new Error(
      'Nomor WhatsApp harus menggunakan kode negara (contoh: 6281234567890).'
    );
  }

  const rawCode =
    customPairingCode ||
    process.env.CUSTOM_PAIRING_CODE ||
    process.env.PAIRING_CODE ||
    'KYUUAPIS';
  const cleanCustomCode = String(rawCode)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const finalCustomCode = cleanCustomCode.length === 8 ? cleanCustomCode : 'KYUUAPIS';

  let sessionEntry = activeSessions.get(userId);

  if (sessionEntry && sessionEntry.runtimeState.connectionStatus === 'connected') {
    throw new Error(
      'WhatsApp sudah terhubung pada akun ini. Klik Disconnect terlebih dahulu jika ingin mengganti nomor.'
    );
  }

  if (
    !forceNew &&
    sessionEntry &&
    sessionEntry.mode === 'pairing' &&
    sessionEntry.lastPairingCode &&
    sessionEntry.lastPairingPhone === normalizedPhone &&
    sessionEntry.pairingExpiresAt &&
    sessionEntry.pairingExpiresAt > Date.now() + 15000
  ) {
    const remainingSec = Math.ceil((sessionEntry.pairingExpiresAt - Date.now()) / 1000);
    return {
      code: sessionEntry.lastPairingCode,
      phoneNumber: normalizedPhone,
      expiresInSeconds: remainingSec,
    };
  }

  sessionEntry = await startUserWhatsAppSession(userId, {
    mode: 'pairing',
    resetAuth: true,
    forceReset: true,
  });

  await Promise.race([
    sessionEntry.handshakeReadyPromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timed out waiting for WhatsApp server handshake')), 20000)
    ),
  ]);

  try {
    sessionEntry.sock.cancelPairingCode?.();
  } catch {
  }

  const code = await sessionEntry.sock.requestPairingCode(normalizedPhone, finalCustomCode);

  const expiresInSeconds = 180;
  sessionEntry.lastPairingCode = code;
  sessionEntry.lastPairingPhone = normalizedPhone;
  sessionEntry.pairingExpiresAt = Date.now() + expiresInSeconds * 1000;
  sessionEntry.lastQrDataUrl = null;
  sessionEntry.runtimeState.connectionStatus = 'waiting';
  sessionEntry.runtimeState.phoneNumber = normalizedPhone;

  await query(
    `UPDATE whatsapp_sessions
     SET connection_status = 'waiting', phone_number = $1, updated_at = NOW()
     WHERE user_id = $2`,
    [normalizedPhone, userId]
  );

  const payload = {
    code,
    phoneNumber: normalizedPhone,
    expiresInSeconds,
  };

  realtimeHub.sendToUser(userId, 'whatsapp.pairing_code', payload);
  emitStatsUpdate(sessionEntry);

  await recordBotLog(
    userId,
    'connection',
    `Generated 8-digit pairing code (${code}) for +${normalizedPhone}`,
    'info'
  );

  return payload;
}

export async function disconnectUserWhatsAppSession(userId, logoutDevice = true) {
  const existing = activeSessions.get(userId);
  if (existing) {
    existing.manualDisconnect = true;
    if (logoutDevice && existing.runtimeState.connectionStatus === 'connected') {
      try {
        await existing.sock.logout('Disconnected from WhatsApp Bot Manager Dashboard');
      } catch {
      }
    }
  }

  await cleanupUserSocket(userId, logoutDevice);

  await query(
    `UPDATE whatsapp_sessions
     SET connection_status = 'disconnected',
         bot_status = 'stopped',
         phone_number = CASE WHEN $2 THEN NULL ELSE phone_number END,
         jid = CASE WHEN $2 THEN NULL ELSE jid END,
         push_name = CASE WHEN $2 THEN NULL ELSE push_name END,
         connected_at = NULL,
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId, logoutDevice]
  );

  const statusPayload = await getUserSessionStatus(userId);
  realtimeHub.sendToUser(userId, 'whatsapp.status', statusPayload);
  realtimeHub.sendToOwners('owner.bot_status', statusPayload);

  await recordBotLog(
    userId,
    'connection',
    logoutDevice
      ? 'WhatsApp session disconnected and logged out by user.'
      : 'Bot runtime stopped.',
    'warn'
  );

  return statusPayload;
}

export async function restartUserBot(userId) {
  await recordBotLog(userId, 'system', 'Restarting bot runtime...', 'info');
  await cleanupUserSocket(userId, false);
  await startUserWhatsAppSession(userId, {
    mode: 'reconnect',
    resetAuth: false,
    forceReset: true,
  });
  return getUserSessionStatus(userId);
}

export async function applyUpdatedBotSettings(userId, updatedSettings) {
  const live = activeSessions.get(userId);
  if (live) {
    live.settings = { ...live.settings, ...updatedSettings };

    if (live.runtimeState.connectionStatus === 'connected') {
      const newBotStatus = live.settings.maintenance_mode ? 'maintenance' : 'running';
      live.runtimeState.botStatus = newBotStatus;

      await query(
        `UPDATE whatsapp_sessions SET bot_status = $1, updated_at = NOW() WHERE user_id = $2`,
        [newBotStatus, userId]
      );

      try {
        await live.sock.sendPresenceUpdate(
          live.settings.auto_online ? 'available' : 'unavailable'
        );
      } catch {
      }

      emitStatsUpdate(live);
    }
  }
}

export async function recoverPersistedSessions() {
  try {
    const res = await query(`
      SELECT DISTINCT s.user_id
      FROM whatsapp_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE u.status = 'active'
        AND EXISTS (
          SELECT 1 FROM "baileys_auth" b
          WHERE b.session = ('user_' || s.user_id::text)
            AND b.type = 'creds'
        )
    `);

    for (const row of res.rows) {
      const uid = Number(row.user_id);
      startUserWhatsAppSession(uid, { mode: 'reconnect', resetAuth: false }).catch((err) => {
        console.error(`[Recovery] Failed to restore session for user ${uid}:`, err);
      });
    }

    if (res.rows.length > 0) {
      console.log(`Recovered ${res.rows.length} persisted WhatsApp session(s).`);
    }
  } catch (err) {
    console.error('Error recovering persisted sessions:', err);
  }
}
