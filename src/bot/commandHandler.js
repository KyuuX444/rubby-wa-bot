import os from 'os';
import { jidNormalizedUser, jidDecode } from 'ruby-baileys';
import { authorizeBotAction } from './roleAuth.js';
import menuHandler, { toSmallFont } from './menuHandler.js';
import { query } from '../server/db/pool.js';
import { recordBotLog } from '../server/services/loggerService.js';

export const BOT_COMMANDS = [
  {
    name: 'menu',
    aliases: ['main', 'help', 'list', 'commands'],
    description: 'Display interactive Rubby Multi Device ButtonV2 menu with categories',
    usage: '/menu [all | category]',
    category: 'main',
    minRole: 'FREE',
  },
  {
    name: 'ping',
    aliases: ['p', 'speed'],
    description: 'Check bot response latency and connection health',
    usage: '/ping',
    category: 'main',
    minRole: 'FREE',
  },
  {
    name: 'runtime',
    aliases: ['uptime'],
    description: 'View bot session uptime and server process runtime',
    usage: '/runtime',
    category: 'info',
    minRole: 'FREE',
  },
  {
    name: 'profile',
    aliases: ['me', 'whoami'],
    description: 'Show WhatsApp sender details and linked website account role',
    usage: '/profile',
    category: 'info',
    minRole: 'FREE',
  },
  {
    name: 'status',
    aliases: ['stats', 'botinfo'],
    description: 'Display bot configuration, message counters, and runtime status',
    usage: '/status',
    category: 'info',
    minRole: 'FREE',
  },
  {
    name: 'groupinfo',
    aliases: ['ginfo', 'group'],
    description: 'Display basic group metadata, member count, and admins (in group chats)',
    usage: '/groupinfo',
    category: 'group',
    minRole: 'FREE',
  },
  {
    name: 'owner',
    aliases: ['admin', 'sys'],
    description: 'Execute owner-only platform commands (requires OWNER website role)',
    usage: '/owner [stats | maintenance on/off]',
    category: 'owner',
    minRole: 'OWNER',
  },
];

export function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

export function extractMessageText(msg) {
  if (!msg?.message) return '';

  const m =
    msg.message.ephemeralMessage?.message ||
    msg.message.viewOnceMessage?.message ||
    msg.message.viewOnceMessageV2?.message ||
    msg.message.documentWithCaptionMessage?.message ||
    msg.message;

  const nativeParamsJson =
    m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    m.buttonsResponseMessage?.selectedButtonId;

  if (nativeParamsJson && typeof nativeParamsJson === 'string') {
    if (nativeParamsJson.startsWith('{')) {
      try {
        const parsed = JSON.parse(nativeParamsJson);
        if (parsed?.id) return String(parsed.id).trim();
      } catch {
      }
    }
  }

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim();
}

function createCommandRegistry(disabledList = []) {
  const activeCommands = BOT_COMMANDS.filter((c) => !disabledList.includes(c.name));
  return {
    getMenuStructure() {
      const categories = {};
      for (const cmd of activeCommands) {
        const cat = (cmd.category || 'main').toLowerCase();
        if (!categories[cat]) {
          categories[cat] = [];
        }
        categories[cat].push(cmd);
      }
      return {
        categories,
        totalCommands: activeCommands.length,
      };
    },
  };
}

export async function handleIncomingCommand({
  sock,
  msg,
  userId,
  settings,
  runtimeState,
  onCommandExecuted,
}) {
  const text = extractMessageText(msg);
  if (!text) return false;

  const prefix = settings.prefix || '/';
  if (!text.startsWith(prefix)) {
    return false;
  }

  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid === 'status@broadcast') {
    return false;
  }

  const isGroup = remoteJid.endsWith('@g.us');
  const isFromMe = Boolean(msg.key.fromMe);
  const senderJid = isGroup
    ? msg.key.participant || msg.key.participantAlt || remoteJid
    : msg.key.remoteJidAlt || remoteJid;
  const normalizedSender = jidNormalizedUser(senderJid);
  const myJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : '';
  const isBotOwnerSender = isFromMe || (myJid && normalizedSender === myJid);

  if (!settings.public_mode && !isBotOwnerSender) {
    return false;
  }

  const withoutPrefix = text.slice(prefix.length).trim();
  if (!withoutPrefix) return false;

  const [rawCmd, ...args] = withoutPrefix.split(/\s+/);
  const cmdName = rawCmd.toLowerCase();
  const argText = args.join(' ');

  const commandDef = BOT_COMMANDS.find(
    (c) => c.name === cmdName || c.aliases.includes(cmdName)
  );

  if (!commandDef) {
    return false;
  }

  const authCheck = await authorizeBotAction(userId, 'FREE');
  if (!authCheck.allowed || !authCheck.user) {
    await recordBotLog(
      userId,
      'auth',
      `Blocked command "${prefix}${commandDef.name}": ${authCheck.reason}`,
      'warn'
    );
    return false;
  }

  const webUser = authCheck.user;

  if (settings.maintenance_mode && !(webUser.role === 'OWNER' && isBotOwnerSender)) {
    await sendFormattedReply(sock, remoteJid, msg, settings, [
      `[${settings.bot_name}] MAINTENANCE MODE`,
      `The bot is currently under maintenance. Please try again later.`,
    ].join('\n'));
    return true;
  }

  const disabledList = Array.isArray(settings.disabled_commands)
    ? settings.disabled_commands
    : [];
  if (disabledList.includes(commandDef.name)) {
    await sendFormattedReply(sock, remoteJid, msg, settings, [
      `[${settings.bot_name}]`,
      `Command "${prefix}${commandDef.name}" is currently disabled in Bot Settings.`,
    ].join('\n'));
    return true;
  }

  const cmdRoleAuth = await authorizeBotAction(userId, commandDef.minRole);
  if (!cmdRoleAuth.allowed) {
    await recordBotLog(
      userId,
      'command',
      `Role authorization denied for ${prefix}${commandDef.name} (User Role: ${webUser.role}, Required: ${commandDef.minRole})`,
      'warn'
    );
    await sendFormattedReply(sock, remoteJid, msg, settings, [
      `╭━━━〔 ୨ৎ ${toSmallFont('ACCESS DENIED')} ୨ৎ 〕━━━╮`,
      `┇ • ${toSmallFont('Command')} : ${prefix}${toSmallFont(commandDef.name)}`,
      `┇ • ${toSmallFont('Required Role')} : *${toSmallFont(commandDef.minRole)}*`,
      `┇ • ${toSmallFont('Your Role')} : *${toSmallFont(webUser.role)}* (ID #${webUser.id})`,
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
    ].join('\n'));
    return true;
  }

  const startTime = Date.now();

  try {
    await onCommandExecuted(userId);

    switch (commandDef.name) {
      case 'menu': {
        if (settings.auto_typing) {
          try {
            await sock.sendPresenceUpdate('composing', remoteJid);
          } catch {
          }
        }

        const registry = createCommandRegistry(disabledList);
        const mContext = {
          chat: remoteJid,
          sender: normalizedSender,
          pushName: msg.pushName || 'User',
          raw: msg,
        };

        try {
          await menuHandler(mContext, {
            conn: sock,
            sock,
            text: argText,
            args,
            usedPrefix: prefix,
            registry,
            webUser,
            settings,
            runtimeState,
          });
        } catch (btnErr) {
          console.error('ButtonV2 fallback:', btnErr);
          const availableCommands = BOT_COMMANDS.filter(
            (c) => !disabledList.includes(c.name)
          );
          const fallbackLines = [
            `╭━━━〔 ୨ৎ *${toSmallFont(settings.bot_name || 'RUBBY MULTI DEVICE')}* ୨ৎ 〕━━━╮`,
            `┇ • ${toSmallFont('Account')} : ${webUser.username} (#${webUser.id})`,
            `┇ • ${toSmallFont('Status')} : *${toSmallFont(webUser.role)}*`,
            `┇ • ${toSmallFont('Prefix')} : ${prefix}`,
            `┇ • ${toSmallFont('Mode')} : ${settings.public_mode ? 'ᴘᴜʙʟɪᴄ' : 'ꜱᴇʟꜰ'}`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            ``,
            ...availableCommands.map(
              (c) => `• ${prefix}${toSmallFont(c.name)} [${toSmallFont(c.minRole)}]`
            ),
          ];
          await sendFormattedReply(sock, remoteJid, msg, settings, fallbackLines.join('\n'));
        }

        if (settings.auto_typing) {
          try {
            await sock.sendPresenceUpdate('paused', remoteJid);
          } catch {
          }
        }
        break;
      }

      case 'ping': {
        const latency = Date.now() - startTime;
        const msgTimestamp = msg.messageTimestamp
          ? Number(msg.messageTimestamp) * 1000
          : startTime;
        const networkDelta = Math.max(1, Date.now() - msgTimestamp);
        const lines = [
          `╭━━━〔 ୨ৎ *${toSmallFont('RUBBY PONG')}* ୨ৎ 〕━━━╮`,
          `┇ • ${toSmallFont('Response')} : ${latency} ms`,
          `┇ • ${toSmallFont('Latency')} : ${networkDelta} ms`,
          `┇ • ${toSmallFont('Bot Role')} : *${toSmallFont(webUser.role)}*`,
          `┇ • ${toSmallFont('Engine')} : Ruby-Baileys`,
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        ];
        await sendFormattedReply(sock, remoteJid, msg, settings, lines.join('\n'));
        break;
      }

      case 'runtime': {
        const sessionUptimeSec = runtimeState.connectedAt
          ? Math.floor((Date.now() - new Date(runtimeState.connectedAt).getTime()) / 1000)
          : 0;
        const processUptimeSec = Math.floor(process.uptime());
        const memMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

        const lines = [
          `╭━━━〔 ୨ৎ *${toSmallFont('SYSTEM RUNTIME')}* ୨ৎ 〕━━━╮`,
          `┇ • ${toSmallFont('Bot Uptime')} : ${formatDuration(sessionUptimeSec)}`,
          `┇ • ${toSmallFont('Server Uptime')} : ${formatDuration(processUptimeSec)}`,
          `┇ • ${toSmallFont('Memory')} : ${memMb} MB`,
          `┇ • ${toSmallFont('Platform')} : ${os.type()} (${os.arch()})`,
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        ];
        await sendFormattedReply(sock, remoteJid, msg, settings, lines.join('\n'));
        break;
      }

      case 'profile': {
        const decoded = jidDecode(normalizedSender);
        const phoneNumber = decoded?.user || normalizedSender.split('@')[0];
        const pushName = msg.pushName || 'WhatsApp User';

        const lines = [
          `╭━━━〔 ୨ৎ *${toSmallFont('USER PROFILE')}* ୨ৎ 〕━━━╮`,
          `┇ • ${toSmallFont('Name')} : ${pushName}`,
          `┇ • ${toSmallFont('Number')} : +${phoneNumber}`,
          `┇ • ${toSmallFont('Context')} : ${isGroup ? 'Group Chat' : 'Private Chat'}`,
          `┇  ──────── ୨୧ ────────`,
          `┇ • ${toSmallFont('Web User')} : ${webUser.username} (#${webUser.id})`,
          `┇ • ${toSmallFont('Bot Role')} : *${toSmallFont(webUser.role)}*`,
          `┇ • ${toSmallFont('Status')} : ${toSmallFont(webUser.status)}`,
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        ];
        await sendFormattedReply(sock, remoteJid, msg, settings, lines.join('\n'));
        break;
      }

      case 'status': {
        const sessionUptimeSec = runtimeState.connectedAt
          ? Math.floor((Date.now() - new Date(runtimeState.connectedAt).getTime()) / 1000)
          : 0;

        const lines = [
          `╭━━━〔 ୨ৎ *${toSmallFont('BOT STATUS')}* ୨ৎ 〕━━━╮`,
          `┇ • ${toSmallFont('Bot Name')} : ${settings.bot_name}`,
          `┇ • ${toSmallFont('Number')} : ${runtimeState.phoneNumber ? '+' + runtimeState.phoneNumber : 'Linked'}`,
          `┇ • ${toSmallFont('Role')} : *${toSmallFont(webUser.role)}*`,
          `┇ • ${toSmallFont('Uptime')} : ${formatDuration(sessionUptimeSec)}`,
          `┇ • ${toSmallFont('Messages')} : ${runtimeState.messagesReceived}`,
          `┇ • ${toSmallFont('Commands')} : ${runtimeState.commandsExecuted}`,
          `┇ • ${toSmallFont('Prefix')} : ${prefix}`,
          `┇ • ${toSmallFont('Mode')} : ${settings.public_mode ? 'Public' : 'Private'}`,
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        ];
        await sendFormattedReply(sock, remoteJid, msg, settings, lines.join('\n'));
        break;
      }

      case 'groupinfo': {
        if (!isGroup) {
          await sendFormattedReply(
            sock,
            remoteJid,
            msg,
            settings,
            `[${settings.bot_name}]\nThis command can only be executed inside a WhatsApp group.`
          );
          break;
        }

        const metadata = await sock.groupMetadata(remoteJid);
        const participants = metadata.participants || [];
        const admins = participants.filter(
          (p) => p.admin === 'admin' || p.admin === 'superadmin'
        );
        const createdDate = metadata.creation
          ? new Date(metadata.creation * 1000).toISOString().split('T')[0]
          : 'Unknown';

        const lines = [
          `╭━━━〔 ୨ৎ *${toSmallFont('GROUP INFO')}* ୨ৎ 〕━━━╮`,
          `┇ • ${toSmallFont('Subject')} : ${metadata.subject || 'Unnamed Group'}`,
          `┇ • ${toSmallFont('ID')} : ${metadata.id}`,
          `┇ • ${toSmallFont('Created')} : ${createdDate}`,
          `┇ • ${toSmallFont('Members')} : ${participants.length}`,
          `┇ • ${toSmallFont('Admins')} : ${admins.length}`,
          `┇ • ${toSmallFont('Announce')} : ${metadata.announce ? 'Yes' : 'No'}`,
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        ];
        await sendFormattedReply(sock, remoteJid, msg, settings, lines.join('\n'));
        break;
      }

      case 'owner': {
        const subCmd = (args[0] || 'info').toLowerCase();

        if (subCmd === 'stats' || subCmd === 'info') {
          const statsRes = await query(`
            SELECT
              (SELECT COUNT(*)::int FROM users) AS total_users,
              (SELECT COUNT(*)::int FROM whatsapp_sessions WHERE connection_status = 'connected') AS connected_wa,
              (SELECT COUNT(*)::int FROM whatsapp_sessions WHERE bot_status = 'running') AS active_bots,
              (SELECT COALESCE(SUM(messages_received), 0)::bigint FROM whatsapp_sessions) AS total_messages,
              (SELECT COALESCE(SUM(commands_executed), 0)::bigint FROM whatsapp_sessions) AS total_commands
          `);
          const st = statsRes.rows[0];

          const lines = [
            `╭━━━〔 ୨ৎ *${toSmallFont('RUBBY OWNER PANEL')}* ୨ৎ 〕━━━╮`,
            `┇ • ${toSmallFont('Owner Account')} : ${webUser.username} (#${webUser.id})`,
            `┇ • ${toSmallFont('Live Bot Role')} : *${toSmallFont(webUser.role)}*`,
            `┇ • ${toSmallFont('Creator')} : Kyuu (github.com/KyuuX444)`,
            `┇ • ${toSmallFont('Website')} : https://api.kyzzz.xyz`,
            `┇  ──────── ୨୧ ────────`,
            `┇ • ${toSmallFont('Total Users')} : ${st.total_users}`,
            `┇ • ${toSmallFont('Connected WA')} : ${st.connected_wa}`,
            `┇ • ${toSmallFont('Active Bots')} : ${st.active_bots}`,
            `┇ • ${toSmallFont('Global Msgs')} : ${st.total_messages}`,
            `┇ • ${toSmallFont('Global Cmds')} : ${st.total_commands}`,
            `┇  ──────── ୨୧ ────────`,
            `┇ • ${prefix}owner stats`,
            `┇ • ${prefix}owner maintenance on|off`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
          ];
          await sendFormattedReply(sock, remoteJid, msg, settings, lines.join('\n'));
        } else if (subCmd === 'maintenance') {
          const toggle = (args[1] || '').toLowerCase();
          if (toggle !== 'on' && toggle !== 'off') {
            await sendFormattedReply(
              sock,
              remoteJid,
              msg,
              settings,
              `Usage: ${prefix}owner maintenance on|off`
            );
            break;
          }
          const newMaint = toggle === 'on';
          await query(
            `UPDATE bot_settings SET maintenance_mode = $1, updated_at = NOW() WHERE user_id = $2`,
            [newMaint, userId]
          );
          settings.maintenance_mode = newMaint;
          await sendFormattedReply(
            sock,
            remoteJid,
            msg,
            settings,
            `[${settings.bot_name} - OWNER]\nMaintenance mode has been set to: ${newMaint ? 'ENABLED' : 'DISABLED'}`
          );
        } else {
          await sendFormattedReply(
            sock,
            remoteJid,
            msg,
            settings,
            `[${settings.bot_name} - OWNER]\nAvailable: ${prefix}owner stats | ${prefix}owner maintenance on|off`
          );
        }
        break;
      }
    }

    await recordBotLog(
      userId,
      'command',
      `Executed ${prefix}${commandDef.name} by ${normalizedSender} (Role: ${webUser.role})`,
      'success'
    );
    return true;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await recordBotLog(
      userId,
      'error',
      `Error executing ${prefix}${commandDef.name}: ${errMsg}`,
      'error'
    );
    return false;
  }
}

async function sendFormattedReply(sock, remoteJid, quotedMsg, settings, text) {
  try {
    if (settings.auto_typing) {
      await sock.sendPresenceUpdate('composing', remoteJid);
      await new Promise((r) => setTimeout(r, 350));
    }
    await sock.sendMessage(remoteJid, { text }, { quoted: quotedMsg });
    if (settings.auto_typing) {
      await sock.sendPresenceUpdate('paused', remoteJid);
    }
  } catch {
    await sock.sendMessage(remoteJid, { text });
  }
}
