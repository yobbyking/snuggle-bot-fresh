/**
 * SNUGGLE X BOT — Clean, working Baileys bot
 * 
 * Features:
 *   - Fake contact card on .menu
 *   - Channel forwarding (all replies show "Forwarded from Snuggle X")
 *   - Owner/sudo/user access
 *   - CYPHER-X style menu with readmore
 *   - SQLite for settings
 *   - Works in DM and groups
 * 
 * Usage: node bot.js <sessionFolder>
 */

const {
  useMultiFileAuthState,
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const os = require('os');
const P = require('pino');
const Database = require('better-sqlite3');
const { createFakeContact } = require('./createFakeContact');

// === Session ===
const sessionDir = process.argv[2];
if (!sessionDir || !fs.existsSync(sessionDir)) {
  console.error('Usage: node bot.js <sessionFolder>');
  process.exit(1);
}

// === Owner info from creds ===
let ownerJid = null;
let ownerName = 'Not Set!';
const credsFile = path.join(sessionDir, 'creds.json');
if (fs.existsSync(credsFile)) {
  try {
    const creds = JSON.parse(fs.readFileSync(credsFile, 'utf-8'));
    if (creds.me && creds.me.id) { ownerJid = creds.me.id; ownerName = creds.me.name || 'Not Set!'; }
  } catch {}
}
const ownerNumber = ownerJid ? ownerJid.split(':')[0].split('@')[0] : null;
console.log(`[Bot] Owner: ${ownerNumber} (${ownerJid})`);

// === SQLite ===
const db = new Database(path.join(sessionDir, 'bot.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS sudos (number TEXT PRIMARY KEY);
`);
function dbGet(k, def) { try { const r = db.prepare('SELECT value FROM kv WHERE key=?').get(k); return r ? r.value : def; } catch { return def; } }
function dbSet(k, v) { try { db.prepare('INSERT OR REPLACE INTO kv (key,value) VALUES (?,?)').run(k, String(v)); } catch {} }
function getPrefix() { const p = dbGet('prefix', '.'); return p === 'none' ? '' : p; }
function getMode() { return dbGet('mode', 'public'); }

// === Channel forwarding ===
// Channel: https://whatsapp.com/channel/0029Vb9NwdJ8KMqo8fRJZu3R
const CHANNEL_ID = '0029Vb9NwdJ8KMqo8fRJZu3R';
const CHANNEL_JID = CHANNEL_ID + '@newsletter';

function getChannelContext() {
  return {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageId: '100',
    forwardedNewsletterMessageName: 'Snuggle X',
    newsletterJid: CHANNEL_JID,
    newsletterName: 'Snuggle X',
  };
}

// === Menu builder ===
function buildMenu() {
  const mem = process.memoryUsage();
  const memMB = (mem.rss / 1024 / 1024).toFixed(0);
  const totalRAM = Math.round(os.totalmem() / 1024 / 1024 / 1024);
  const ramPct = Math.min(100, Math.round((mem.rss / os.totalmem()) * 100));
  const ramBar = '█'.repeat(Math.round(ramPct / 10)) + '░'.repeat(10 - Math.round(ramPct / 10));
  const prefix = getPrefix();
  const p = prefix === '' ? '' : prefix;
  const readmore = '\u200e'.repeat(700);

  let header = `┏▣ ◈ *SNUGGLE-X* ◈
┃ *ᴏᴡɴᴇʀ* : ${ownerName}
┃ *ᴘʀᴇғɪx* : [ ${prefix === '' ? 'None' : prefix} ]
┃ *ʜᴏsᴛ* : Railway VPS
┃ *ᴘʟᴜɢɪɴs* : 200+
┃ *ᴍᴏᴅᴇ* : ${getMode()}
┃ *ᴠᴇʀsɪᴏɴ* : 2.0.0
┃ *sᴘᴇᴇᴅ* : ${(process.hrtime()[1] / 1e6).toFixed(4)} ms
┃ *ᴜsᴀɢᴇ* : ${memMB} MB of ${totalRAM} GB
┃ *ʀᴀᴍ:* [${ramBar}] ${ramPct}%
┗▣ 

> created by yobby king
> Instagram @yobby_mking

\`snuggle x bot\``;

  let commands = `
┏▣ ◈ *AI MENU* ◈
│➽ ${p}ai\n│➽ ${p}chatbot\n│➽ ${p}gemini
┗▣ 

┏▣ ◈ *GROUP MENU* ◈
│➽ ${p}tagall\n│➽ ${p}hidetag\n│➽ ${p}promote\n│➽ ${p}demote\n│➽ ${p}kick\n│➽ ${p}add\n│➽ ${p}ginfo\n│➽ ${p}link\n│➽ ${p}leave\n│➽ ${p}join
┗▣ 

┏▣ ◈ *DOWNLOAD MENU* ◈
│➽ ${p}song\n│➽ ${p}video
┗▣ 

┏▣ ◈ *MEDIA MENU* ◈
│➽ ${p}sticker\n│➽ ${p}url\n│➽ ${p}tts\n│➽ ${p}translate\n│➽ ${p}vv\n│➽ ${p}vv2\n│➽ ${p}vv3
┗▣ 

┏▣ ◈ *FUN MENU* ◈
│➽ ${p}8ball\n│➽ ${p}truth\n│➽ ${p}dare\n│➽ ${p}joke\n│➽ ${p}quote\n│➽ ${p}fact\n│➽ ${p}ship\n│➽ ${p}rps
┗▣ 

┏▣ ◈ *TOOLS MENU* ◈
│➽ ${p}calc\n│➽ ${p}qr\n│➽ ${p}uuid\n│➽ ${p}pass\n│➽ ${p}reverse\n│➽ ${p}hash\n│➽ ${p}base64
┗▣ 

┏▣ ◈ *OWNER MENU* ◈
│➽ ${p}mode\n│➽ ${p}setprefix\n│➽ ${p}setownername\n│➽ ${p}block\n│➽ ${p}unblock\n│➽ ${p}pair
┗▣ 

┏▣ ◈ *OTHERS MENU* ◈
│➽ ${p}menu\n│➽ ${p}all\n│➽ ${p}ping\n│➽ ${p}alive\n│➽ ${p}owner\n│➽ ${p}help\n│➽ ${p}whoami\n│➽ ${p}repo
┗▣ 

> *Powered by Yobby King*
> *Instagram: @yobby_mking*`;

  return header + readmore + commands;
}

function buildAlive() {
  return `*SNUGGLE X IS ALIVE ✅*
> snuggle x bot
> owner: ${ownerName}
> mode: ${getMode()}
> uptime: ${formatUptime(process.uptime())}`;
}

function buildOwner() {
  return `*BOT OWNER* 👑
> Name: Yobby King
> Number: ${ownerNumber}
> Instagram: @yobby_mking`;
}

function formatUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// === Access control ===
function isOwner(senderJid, participantPn) {
  if (!senderJid) return false;
  const phone = senderJid.split('@')[0].split(':')[0];
  if (phone === ownerNumber) return true;
  if (participantPn) { const pn = participantPn.split('@')[0].split(':')[0]; if (pn === ownerNumber) return true; }
  return false;
}
function isSudo(senderJid) {
  try { const sudos = db.prepare('SELECT number FROM sudos').all().map(r => r.number); return sudos.includes(senderJid?.split('@')[0].split(':')[0]); } catch { return false; }
}

// === Main ===
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();
  const logger = P({ level: 'warn' }, P.destination({ sync: false }));

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    logger,
    markOnlineOnConnect: false,
    linkPreview: false,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // === Channel forwarding wrapper ===
  const _origSend = sock.sendMessage.bind(sock);
  sock.sendMessage = async function(jid, content, opts = {}) {
    if (content && typeof content === 'object') {
      if (!content.contextInfo) content.contextInfo = {};
      if (!content.contextInfo.forwardedNewsletterMessageId) {
        Object.assign(content.contextInfo, getChannelContext());
      }
    }
    return _origSend(jid, content, opts);
  };

  let isStarting = true;
  sock.ev.on('connection.update', async (update) => {
    if (update.connection === 'open') {
      console.log('[Bot] ✅ Connected as', sock.user.id);
      if (isStarting) {
        isStarting = false;
        setTimeout(() => {
          try { sock.sendMessage(ownerNumber + '@s.whatsapp.net', { text: '*`SNUGGLE X BOT IS NOW LIVE ✅`*\n> snuggle x bot\n\nType *.menu* to see commands.' }); }
          catch (e) { console.error('[LIVE] send failed:', e.message); }
        }, 2000);
      }
    }
    if (update.connection === 'close') {
      const code = update.lastDisconnect?.error?.output?.statusCode;
      console.log('[Bot] closed:', code);
      if (code === DisconnectReason.loggedOut) { console.error('[Bot] ❌ Session logged out.'); setTimeout(() => process.exit(1), 3000); }
      else if (code === 503) setTimeout(() => start(), 10000);
      else setTimeout(() => start(), 3000);
    }
  });

  // === Message handler ===
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0];
      if (!m || !m.message) return;

      const chatId = m.key.remoteJid;
      if (chatId && (chatId.includes('newsletter') || chatId.includes('broadcast'))) return;

      const isGroup = chatId && chatId.endsWith('@g.us');
      const participant = m.key.participant || chatId;
      const participantPn = m.key.participantPn || null;

      // Self-chat detection (works for both phone JID and LID)
      const isLid = chatId && chatId.endsWith('@lid');
      const isSelfChat = (chatId && chatId.split('@')[0].split(':')[0] === ownerNumber) || (isLid && m.key.fromMe);
      if (m.key.fromMe && !isSelfChat && !isGroup) return;

      // Extract text
      const msg = m.message;
      let text = '';
      if (msg.conversation) text = msg.conversation;
      else if (msg.extendedTextMessage?.text) text = msg.extendedTextMessage.text;
      else if (msg.imageMessage?.caption) text = msg.imageMessage.caption;
      else if (msg.videoMessage?.caption) text = msg.videoMessage.caption;
      if (!text) return;

      const raw = text.trim();
      if (!raw) return;
      const lower = raw.toLowerCase();

      // Parse command
      const prefix = getPrefix();
      const cmdText = raw.replace(/^[*_`~]+/, '').trim();
      const cmd = cmdText.toLowerCase().split(/\s+/)[0];
      const args = cmdText.split(/\s+/).slice(1);
      const argText = args.join(' ');

      // Use quoted only in groups (DMs may have LID mismatch)
      const quotedMsg = isGroup ? m : undefined;

      // Log
      if (cmd.startsWith(prefix) || cmd.startsWith('.')) {
        console.log(`[CMD] ${isGroup ? 'GROUP' : 'DM'} ${chatId.split('@')[0]}: ${cmdText.slice(0, 80)}`);
      }

      // Owner/sudo check
      const ownerCheck = isOwner(isGroup ? participant : chatId, participantPn) || isSelfChat || (isGroup && m.key.fromMe);
      const sudoCheck = isSudo(isGroup ? participant : chatId);
      const mode = getMode();

      // Mode checks
      if ((mode === 'silent' || mode === 'private') && !ownerCheck && !sudoCheck) return;
      if (mode === 'groups' && !isGroup && !ownerCheck && !sudoCheck) return;
      if (mode === 'dms' && isGroup && !ownerCheck && !sudoCheck) return;

      // === PUBLIC COMMANDS ===
      if (cmd === `${prefix}menu` || (prefix && lower === 'menu')) {
        const fakeContact = createFakeContact(ownerNumber, ownerName);
        const menuText = buildMenu();
        try {
          await sock.sendMessage(chatId, { text: menuText }, { quoted: isGroup ? fakeContact : undefined });
          console.log(`[MENU] ✅ sent to ${chatId}`);
        } catch (e) {
          console.error('[MENU] failed:', e.message);
          try { await sock.sendMessage(chatId, { text: menuText }); } catch {}
        }
        return;
      }

      if (cmd === `${prefix}all` || (prefix && lower === 'all')) {
        await sock.sendMessage(chatId, { text: buildMenu() }, { quoted: quotedMsg });
        return;
      }

      if (cmd === `${prefix}ping`) {
        const t = Date.now();
        await sock.sendMessage(chatId, { text: `*PONG* 🏓\nLatency: ${Date.now() - t}ms` }, { quoted: quotedMsg });
        return;
      }

      if (cmd === `${prefix}alive` || cmd === `${prefix}help` || cmd === `${prefix}owner` || cmd === `${prefix}whoami` || cmd === `${prefix}repo`) {
        const responses = {
          [`${prefix}alive`]: buildAlive(),
          [`${prefix}help`]: `Type *${prefix}menu* for the menu.`,
          [`${prefix}owner`]: buildOwner(),
          [`${prefix}whoami`]: `*You are* ${m.pushName || 'User'}\n*Status:* ${ownerCheck ? 'Owner 👑' : sudoCheck ? 'Sudo 🔑' : 'User'}`,
          [`${prefix}repo`]: `📦 GitHub: https://github.com/yobbyking/snuggle-bot-fresh`,
        };
        await sock.sendMessage(chatId, { text: responses[cmd] }, { quoted: quotedMsg });
        return;
      }

      if (cmd === `${prefix}sticker`) {
        let hasMedia = msg.imageMessage || msg.videoMessage || msg.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        if (!hasMedia) { await sock.sendMessage(chatId, { text: 'Send/reply to an image with .sticker' }, { quoted: quotedMsg }); return; }
        try {
          let targetMsg = m;
          if (!msg.imageMessage && !msg.videoMessage) {
            const q = msg.extendedTextMessage.contextInfo.quotedMessage;
            targetMsg = { key: { remoteJid: chatId, id: msg.extendedTextMessage.contextInfo.stanzaId, participant: msg.extendedTextMessage.contextInfo.participant }, message: q };
          }
          const buf = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: P({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(chatId, { sticker: Buffer.from(buf) }, { quoted: quotedMsg });
        } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
        return;
      }

      // === OWNER/SUDO commands ===
      if (!ownerCheck && !sudoCheck) {
        if (cmd.startsWith(prefix)) {
          await sock.sendMessage(chatId, { text: `> *only sudo access 🚫*\n> Get yours 0181163563 ✅` }, { quoted: quotedMsg });
        }
        return;
      }

      switch (cmd) {
        case `${prefix}mode`:
          if (['private','public','silent','groups','dms'].includes(argText)) {
            if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
            dbSet('mode', argText);
            await sock.sendMessage(chatId, { text: `*MODE CHANGED* ✅\n> Bot is now in *${argText}* mode` }, { quoted: quotedMsg });
          } else {
            await sock.sendMessage(chatId, { text: `*Current mode:* ${getMode()}\n*Prefix:* ${prefix}\n\nUsage: .mode public/private/silent/groups/dms` }, { quoted: quotedMsg });
          }
          break;

        case `${prefix}setprefix`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setprefix <prefix>' }, { quoted: quotedMsg }); break; }
          dbSet('prefix', argText === 'none' ? 'none' : argText);
          await sock.sendMessage(chatId, { text: `✅ Prefix set to: ${argText === 'none' ? '(none)' : argText}` }, { quoted: quotedMsg });
          break;

        case `${prefix}setownername`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          if (!argText) { await sock.sendMessage(chatId, { text: `Usage: .setownername <name>` }, { quoted: quotedMsg }); break; }
          dbSet('ownerName', argText);
          ownerName = argText;
          await sock.sendMessage(chatId, { text: `✅ Owner name set to: *${argText}*` }, { quoted: quotedMsg });
          break;

        case `${prefix}addsudo`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          const sudoNum = args[0]?.replace(/[^0-9]/g, '');
          if (!sudoNum) { await sock.sendMessage(chatId, { text: 'Usage: .addsudo <number>' }, { quoted: quotedMsg }); break; }
          db.prepare('INSERT OR IGNORE INTO sudos (number) VALUES (?)').run(sudoNum);
          await sock.sendMessage(chatId, { text: `✅ Added ${sudoNum} as sudo` }, { quoted: quotedMsg });
          break;

        case `${prefix}tagall`: {
          if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; }
          try {
            const meta = await sock.groupMetadata(chatId);
            const mentions = meta.participants.map(p => p.id);
            const t = `┏▣ *SNUGGLE X TAG ALL* ▣\n┗▣ Total: ${mentions.length} members\n\n` + mentions.map(p => '➽ @' + p.split('@')[0]).join('\n');
            await sock.sendMessage(chatId, { text: t, mentions });
          } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}song`: {
          const query = argText;
          if (!query) { await sock.sendMessage(chatId, { text: 'Usage: .song <song name>' }, { quoted: quotedMsg }); break; }
          await sock.sendMessage(chatId, { text: `🎵 Searching: ${query}...` }, { quoted: quotedMsg });
          try {
            const { spawnSync } = require('child_process');
            const tmpFile = `/tmp/song-${Date.now()}.mp3`;
            const result = spawnSync('yt-dlp', ['--no-playlist','--no-warnings','--retries','3','--extract-audio','--audio-format','mp3','--audio-quality','0','-o',tmpFile,`ytsearch1:${query.replace(/"/g,'')}`], { timeout: 180000, encoding: 'utf-8', maxBuffer: 20*1024*1024 });
            if (result.status !== 0 || !fs.existsSync(tmpFile)) throw new Error('Download failed');
            const buffer = fs.readFileSync(tmpFile);
            const titleMatch = (result.stdout || '').match(/\[info\] \w+: (.+)/);
            const title = titleMatch ? titleMatch[1].split(' [')[0].trim() : query;
            await sock.sendMessage(chatId, { audio: buffer, mimetype: 'audio/mpeg', fileName: `${title}.mp3`, caption: `🎵 *${title}*\n_Downloaded by Snuggle X_` }, { quoted: quotedMsg });
            fs.unlinkSync(tmpFile);
          } catch (e) { await sock.sendMessage(chatId, { text: `❌ Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}video`: {
          const query = argText;
          if (!query) { await sock.sendMessage(chatId, { text: 'Usage: .video <video name>' }, { quoted: quotedMsg }); break; }
          await sock.sendMessage(chatId, { text: `🎬 Searching: ${query}...` }, { quoted: quotedMsg });
          try {
            const { spawnSync } = require('child_process');
            const tmpFile = `/tmp/video-${Date.now()}.mp4`;
            const result = spawnSync('yt-dlp', ['--no-playlist','--no-warnings','--retries','3','-f','best[ext=mp4][filesize<60M]/best[ext=mp4]/best','--merge-output-format','mp4','-o',tmpFile,`ytsearch1:${query.replace(/"/g,'')}`], { timeout: 240000, encoding: 'utf-8', maxBuffer: 20*1024*1024 });
            if (result.status !== 0 || !fs.existsSync(tmpFile)) throw new Error('Download failed');
            const buffer = fs.readFileSync(tmpFile);
            if (buffer.length > 60*1024*1024) { fs.unlinkSync(tmpFile); throw new Error('Video too large (>60MB)'); }
            const titleMatch = (result.stdout || '').match(/\[info\] \w+: (.+)/);
            const title = titleMatch ? titleMatch[1].split(' [')[0].trim() : query;
            await sock.sendMessage(chatId, { video: buffer, mimetype: 'video/mp4', fileName: `${title}.mp4`, caption: `🎬 *${title}*\n_Size: ${(buffer.length/1024/1024).toFixed(1)} MB_` }, { quoted: quotedMsg });
            fs.unlinkSync(tmpFile);
          } catch (e) { await sock.sendMessage(chatId, { text: `❌ Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}calc`: {
          const expr = argText;
          if (!expr) { await sock.sendMessage(chatId, { text: 'Usage: .calc <expression>' }, { quoted: quotedMsg }); break; }
          try {
            const safe = expr.replace(/[^0-9+\-*/().%\s]/g, '');
            if (!safe) throw new Error('Invalid');
            const result = Function('"use strict"; return (' + safe + ')')();
            await sock.sendMessage(chatId, { text: `🔢 ${expr} = *${result}*` }, { quoted: quotedMsg });
          } catch (e) { await sock.sendMessage(chatId, { text: `❌ Invalid expression` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}qr`: {
          const text = argText;
          if (!text) { await sock.sendMessage(chatId, { text: 'Usage: .qr <text>' }, { quoted: quotedMsg }); break; }
          try {
            const axios = require('axios');
            const res = await axios.get(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`, { responseType: 'arraybuffer', timeout: 15000 });
            await sock.sendMessage(chatId, { image: Buffer.from(res.data), caption: `📱 QR Code` }, { quoted: quotedMsg });
          } catch (e) { await sock.sendMessage(chatId, { text: `❌ Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}ai`: {
          const question = argText;
          if (!question) { await sock.sendMessage(chatId, { text: 'Usage: .ai <question>' }, { quoted: quotedMsg }); break; }
          try {
            const axios = require('axios');
            const key = dbGet('geminiKey', '') || process.env.GEMINI_KEY || '';
            const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, { contents: [{ parts: [{ text: `You are Snuggle X, a helpful WhatsApp bot. Reply concisely. User: ${question}` }] }] }, { timeout: 30000, headers: { 'Content-Type': 'application/json' } });
            const aiText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (aiText) await sock.sendMessage(chatId, { text: aiText.trim() }, { quoted: quotedMsg });
            else await sock.sendMessage(chatId, { text: '❌ AI did not respond' }, { quoted: quotedMsg });
          } catch (e) { await sock.sendMessage(chatId, { text: `❌ AI error: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        default:
          if (cmd.startsWith(prefix)) {
            await sock.sendMessage(chatId, { text: `Unknown: ${cmd}\nType *${prefix}menu* for commands.` }, { quoted: quotedMsg });
          }
      }
    } catch (e) { console.error('[MSG error]', e.message); }
  });

  // === Call handler (anti-call) ===
  sock.ev.on('call', async (calls) => {
    try {
      for (const call of calls) { await sock.rejectCall(call.id, call.from); }
    } catch {}
  });
}

start().catch(console.error);
