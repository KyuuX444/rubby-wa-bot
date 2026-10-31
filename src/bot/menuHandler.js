import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import dns from 'node:dns';
import sharp from 'sharp';
import { ButtonV2, jidDecode } from 'ruby-baileys';

dns.setDefaultResultOrder('ipv4first');

export function toSmallFont(text) {
  if (!text) return '';
  const map = {
    a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
    j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ꞯ', r: 'ʀ',
    s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
    A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ꜰ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
    J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ꞯ', R: 'ʀ',
    S: 'ꜱ', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ',
  };
  return String(text)
    .split('')
    .map((c) => map[c] || c)
    .join('');
}

export function getGreeting() {
  const hours = new Date().getHours();
  if (hours >= 4 && hours < 11) return 'ꜱᴇʟᴀᴍᴀᴛ ᴘᴀɢɪ 🌄';
  if (hours >= 11 && hours < 15) return 'ꜱᴇʟᴀᴍᴀᴛ ꜱɪᴀɴɢ ☀️';
  if (hours >= 15 && hours < 18) return 'ꜱᴇʟᴀᴍᴀᴛ ꜱᴏʀᴇ 🌇';
  return 'ꜱᴇʟᴀᴍᴀᴛ ᴍᴀʟᴀᴍ 🌙';
}

export function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export function normalizeNumber(jid) {
  if (!jid) return '';
  const decoded = jidDecode(jid);
  const raw = decoded?.user || String(jid).split('@')[0];
  return String(raw).replace(/\D/g, '');
}

const categoryEmojis = {
  ai: '🤖',
  'ai-image': '🪄',
  asupan: '💃',
  audio: '🎧',
  cewerandom: '👧',
  convert: '🔄',
  downloader: '📥',
  download: '📥',
  ephoto: '📸',
  example: '💡',
  fun: '🎲',
  github: '🐙',
  group: '👥',
  grup: '👥',
  info: 'ℹ️',
  islamic: '🌙',
  main: '🎀',
  general: '🎀',
  maker: '🎨',
  manga: '📚',
  news: '📰',
  novel: '📖',
  nsfw: '🔞',
  other: '✨',
  owner: '👑',
  panel: '⚡',
  premium: '💎',
  primbon: '🔮',
  rpg: '⚔️',
  search: '🔍',
  stalk: '🕵️',
  stalker: '🕵️',
  streaming: '🎬',
  tools: '🔧',
  webapi: '🌐',
};

const getEmoji = (cat) => categoryEmojis[cat.toLowerCase()] || '🌸';

let cachedThumbBuffer = null;
export async function getThumbBuffer() {
  if (cachedThumbBuffer) return cachedThumbBuffer;
  try {
    const localThumbPath = path.resolve('media/thumb.jpg');
    if (fs.existsSync(localThumbPath)) {
      const raw = fs.readFileSync(localThumbPath);
      cachedThumbBuffer = await sharp(raw)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      return cachedThumbBuffer;
    }
    const fallbackPath = path.resolve('node_modules/ruby-baileys/assets/thumb.jpg');
    if (fs.existsSync(fallbackPath)) {
      const raw = fs.readFileSync(fallbackPath);
      cachedThumbBuffer = await sharp(raw)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      return cachedThumbBuffer;
    }
  } catch {
  }
  return null;
}

const handler = async (m, { conn, sock, text, args, usedPrefix, registry, webUser, settings, runtimeState }) => {
  const client = conn || sock;
  const greeting = getGreeting();
  const senderJid = m.sender || '';
  const rawNum = normalizeNumber(senderJid);
  const senderDisplay =
    rawNum && !senderJid.endsWith('@lid') ? `@${rawNum}` : m.pushName || 'User';
  const botName = settings?.bot_name || 'Rubby Multi Device';
  const prfx = usedPrefix || settings?.prefix || '/';
  const sub = (args?.[0] || text || '').toLowerCase().trim();

  const isOwner = webUser?.role === 'OWNER';
  const isPremium = false;

  const statusStr = isOwner ? 'ᴏᴡɴᴇʀ' : isPremium ? 'ᴘʀᴇᴍɪᴜᴍ' : 'ғʀᴇᴇ ᴜsᴇʀ';
  const modeStr = settings?.public_mode === false ? 'ꜱᴇʟꜰ ( ᴏᴡɴᴇʀ ᴏɴʟʏ )' : 'ᴘᴜʙʟɪᴄ';

  const botUptime = runtimeState?.connectedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(runtimeState.connectedAt).getTime()) / 1000))
    : process.uptime();
  const serverUptime = os.uptime();
  const uptimeStr = formatUptime(botUptime);
  const serverUptimeStr = formatUptime(serverUptime);

  const menuStructure = registry.getMenuStructure();
  const categories = menuStructure.categories || {};
  const totalFitur = menuStructure.totalCommands || 0;

  const formatSection = (catName, cmdList) => {
    if (!cmdList?.length) return '';
    const emoji = getEmoji(catName);
    const sortedCmds = [...new Set(cmdList.map((c) => c.name || c))].sort();
    const lines = sortedCmds.map((cmd) => `• ${prfx}${toSmallFont(cmd)}`);
    return `${emoji} *${toSmallFont(catName.toUpperCase())}*\n${lines.join('\n')}`;
  };

  let menuText = '';

  if (sub === 'all') {
    menuText =
      `${greeting}, ${senderDisplay} 👋\n${toSmallFont('Ini semua fitur')} *${toSmallFont(botName)}*:\n\n` +
      `• ${toSmallFont('Status')} : *${statusStr}*\n` +
      `• ${toSmallFont('Uptime')} : ${uptimeStr}\n` +
      `• ${toSmallFont('Server Uptime')} : ${serverUptimeStr}\n` +
      `• ${toSmallFont('Mode')} : ${modeStr}\n` +
      `• ${toSmallFont('Prefix')} : ${prfx}\n\n`;

    for (const cat of Object.keys(categories).sort()) {
      menuText += formatSection(cat, categories[cat]) + '\n\n';
    }
    menuText += `${toSmallFont('Total')}: ${totalFitur} ${toSmallFont('Commands')}`;
  } else if (sub && categories[sub]) {
    menuText =
      `${greeting}, ${senderDisplay} 👋\n\n` +
      `• ${toSmallFont('Status')} : *${statusStr}*\n` +
      `• ${toSmallFont('Uptime')} : ${uptimeStr}\n` +
      `• ${toSmallFont('Server Uptime')} : ${serverUptimeStr}\n` +
      `• ${toSmallFont('Mode')} : ${modeStr}\n` +
      `• ${toSmallFont('Prefix')} : ${prfx}\n\n` +
      `${formatSection(sub, categories[sub])}`;
  } else {
    menuText =
      `${greeting}, ${senderDisplay} 👋\n${toSmallFont('Selamat Datang di')} *${toSmallFont(botName)}*!\n\n` +
      `• ${toSmallFont('Status')} : *${statusStr}*\n` +
      `• ${toSmallFont('Uptime')} : ${uptimeStr}\n` +
      `• ${toSmallFont('Server Uptime')} : ${serverUptimeStr}\n` +
      `• ${toSmallFont('Mode')} : ${modeStr}\n` +
      `• ${toSmallFont('Prefix')} : ${prfx}\n\n` +
      `${toSmallFont('Pilih kategori di tombol bawah, atau ketik')}:\n${prfx}menu <${toSmallFont('kategori')}>\n${prfx}menu all`;
  }

  const categoryRows = [
    {
      title: `📑 ${toSmallFont('semua menu')}`,
      description: toSmallFont('tampilkan semua perintah bot'),
      id: `${prfx}menu all`,
    },
  ];

  for (const cat of Object.keys(categories).sort()) {
    categoryRows.push({
      title: `${getEmoji(cat)} ${toSmallFont(`menu ${cat.toLowerCase()}`)}`,
      description: toSmallFont(`daftar perintah ${cat.toLowerCase()}`),
      id: `${prfx}menu ${cat.toLowerCase()}`,
    });
  }

  const thumbBuf = await getThumbBuffer();

  const btn = new ButtonV2(client)
    .setTitle(botName)
    .setSubtitle('https://api.kyzzz.xyz')
    .setBody(`${botName} in here`)
    .setFooter(menuText)
    .setContextInfo({ mentionedJid: [senderJid] });

  if (thumbBuf) {
    btn.setThumbnail(thumbBuf);
  }

  btn.addRawButton({
    buttonText: { displayText: toSmallFont('pilih menu') },
    buttonId: 'menu',
    type: 1,
    nativeFlowInfo: {
      name: 'single_select',
      paramsJson: JSON.stringify({
        title: toSmallFont('daftar menu'),
        sections: [
          {
            title: toSmallFont('kategori menu'),
            highlight_label: '',
            rows: categoryRows,
          },
        ],
      }),
    },
  });

  btn.addButton(`👑 ${toSmallFont('Owner')}`, `${prfx}owner`);

  await btn.send(m.chat, { quoted: m.raw });
};

handler.command = ['menu', 'main', 'help', 'list'];
handler.owner = false;
handler.premium = false;
handler.group = false;
handler.private = false;
handler.admin = false;
handler.botadmin = false;
handler.noJadiBot = false;

export default handler;
