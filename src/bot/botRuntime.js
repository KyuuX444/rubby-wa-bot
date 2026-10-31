import { query } from '../server/db/pool.js';
import { realtimeHub } from '../server/services/realtimeHub.js';
import { recordBotLog } from '../server/services/loggerService.js';
import { authorizeBotAction } from './roleAuth.js';
import { handleIncomingCommand, extractMessageText } from './commandHandler.js';

export function attachBotRuntime(sessionEntry) {
  const { userId, sock } = sessionEntry;

  const incrementMessageCount = async () => {
    sessionEntry.runtimeState.messagesReceived += 1;
    try {
      await query(
        `UPDATE whatsapp_sessions
         SET messages_received = messages_received + 1, updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );
    } catch {
    }
    emitStatsUpdate(sessionEntry);
  };

  const incrementCommandCount = async () => {
    sessionEntry.runtimeState.commandsExecuted += 1;
    try {
      await query(
        `UPDATE whatsapp_sessions
         SET commands_executed = commands_executed + 1, updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );
    } catch {
    }
    emitStatsUpdate(sessionEntry);
  };

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !Array.isArray(messages)) {
      return;
    }

    for (const msg of messages) {
      try {
        if (!msg?.message || !msg.key?.remoteJid) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const auth = await authorizeBotAction(userId, 'FREE');
        if (!auth.allowed) {
          continue;
        }

        const settings = sessionEntry.settings;

        await incrementMessageCount();

        if (settings.auto_read && !msg.key.fromMe) {
          try {
            await sock.readMessages([msg.key]);
          } catch {
          }
        }

        if (settings.auto_online) {
          try {
            await sock.sendPresenceUpdate('available', msg.key.remoteJid);
          } catch {
          }
        }

        const wasCommand = await handleIncomingCommand({
          sock,
          msg,
          userId,
          settings,
          runtimeState: sessionEntry.runtimeState,
          onCommandExecuted: incrementCommandCount,
        });

        if (!wasCommand && !msg.key.fromMe) {
          const preview = extractMessageText(msg).slice(0, 80);
          if (preview) {
            await recordBotLog(
              userId,
              'message',
              `Incoming message from ${msg.pushName || msg.key.remoteJid}: "${preview}"`,
              'info'
            );
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await recordBotLog(userId, 'error', `Runtime message error: ${errMsg}`, 'error');
      }
    }
  });
}

export function emitStatsUpdate(sessionEntry) {
  const { userId, runtimeState } = sessionEntry;
  const uptimeSeconds = runtimeState.connectedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(runtimeState.connectedAt).getTime()) / 1000))
    : 0;

  const payload = {
    user_id: userId,
    connection_status: runtimeState.connectionStatus,
    bot_status: runtimeState.botStatus,
    phone_number: runtimeState.phoneNumber,
    jid: runtimeState.jid,
    push_name: runtimeState.pushName,
    messages_received: Number(runtimeState.messagesReceived || 0),
    commands_executed: Number(runtimeState.commandsExecuted || 0),
    connected_at: runtimeState.connectedAt,
    uptime_seconds: uptimeSeconds,
  };

  realtimeHub.sendToUser(userId, 'whatsapp.status', payload);
  realtimeHub.sendToOwners('owner.bot_status', payload);
}
