/**
 * SNUGGLE X BOT — index.js
 * 
 * Deploy on Railway, Render, or Heroku.
 * Set env var: SESSION_ID = yobbyx:~your-session-id
 * 
 * Files: index.js, package.json, Dockerfile, Procfile, app.json, heroku.yml, cx-platform.json
 */

require('dotenv/config');

const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const axios = require('axios');
const P = require('pino');
const Database = require('better-sqlite3');

const {
  useMultiFileAuthState,
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');

// ==========================================
// CONFIG
// ==========================================
const SESSION_DIR = path.join(__dirname, 'session');
const CHANNEL_ID = '0029Vb9NwdJ8KMqo8fRJZu3R';
const CHANNEL_JID = CHANNEL_ID + '@newsletter';
const PAIRING_URL = process.env.PAIRING_URL || 'https://pair-snugglex.onrender.com';
const BOT_NAME = '🚫𝔖𝔫𝔲g𝔤𝔩𝔢 𝔵☠️';
const GITHUB_URL = 'https://github.com/yobbyking/snuggle-bot-fresh';

// ==========================================
// SESSION DECODER
// ==========================================
async function decodeSession(sessionId) {
  if (!sessionId) {
    console.error('❌ SESSION_ID env var not set!');
    console.error('   Get it from: https://pair-snugglex.onrender.com');
    process.exit(1);
  }
  if (!sessionId.startsWith('yobbyx:~')) {
    console.error('❌ Invalid SESSION_ID. Must start with yobbyx:~');
    process.exit(1);
  }
  const b64 = sessionId.replace(/^yobbyx:~/, '');
  let sessionB64 = null;

  // Short ID (12 hex chars) → fetch from pairing site
  if (/^[a-f0-9]{12}$/.test(b64)) {
    console.log(`[Session] Fetching session ${b64} from pairing site...`);
    try {
      const res = await axios.get(`${PAIRING_URL}/api/session/${b64}`, { timeout: 30000 });
      if (res.data?.session) {
        sessionB64 = res.data.session;
        console.log('[Session] ✅ Fetched from pairing site');
      }
    } catch (e) { console.log('[Session] Pairing site fetch failed:', e.message); }
    // Fallback: check VPS session-store (if running on VPS)
    if (!sessionB64) {
      const vf = `/root/snuggle-x/session-store/${b64}.json`;
      if (fs.existsSync(vf)) { try { sessionB64 = JSON.parse(fs.readFileSync(vf, 'utf-8')).session; } catch {} }
    }
    if (!sessionB64) { console.error('❌ Session not found. Re-pair at', PAIRING_URL); process.exit(1); }
  } else {
    sessionB64 = b64; // Full base64 session
  }

  // Decode: base64 → gunzip → JSON → files
  try {
    let s = sessionB64.replace(/-/g, '+').replace(/_/g, '/');
    s += '='.repeat((4 - s.length % 4) % 4);
    const gz = Buffer.from(s, 'base64');
    let json;
    try { json = zlib.gunzipSync(gz).toString('utf-8'); } catch { json = Buffer.from(s, 'base64').toString('utf-8'); }
    const files = JSON.parse(json);
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      const fp = path.join(SESSION_DIR, name);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, Buffer.from(content, 'base64'));
    }
    console.log(`[Session] ✅ ${Object.keys(files).length} files written`);
  } catch (e) { console.error('❌ Decode failed:', e.message); process.exit(1); }
}

// ==========================================
// FAKE CONTACT CARD
// ==========================================
function createFakeContact(ownerNumber, ownerName) {
  const num = String(ownerNumber || '0').replace(/[^\d]/g, '') || '0';
  const vcard = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:${BOT_NAME};Bot;;;`, `FN:${BOT_NAME}`,
    `ORG:yobby developer pro`, `TITLE:WhatsApp Bot`,
    `TEL;type=CELL;waid=${num}:${num}`,
    `URL;type=Pairing:${PAIRING_URL}/`,
    `URL;type=GitHub:${GITHUB_URL}`,
    `NOTE:Developed by yobby_mking — Owner: ${ownerName}. Instagram: @yobby_mking`,
    'END:VCARD',
  ].join('\n');
  return {
    key: { participants: '0@s.whatsapp.net', remoteJid: '0@s.whatsapp.net', fromMe: false, id: 'SNUGGX' + Math.random().toString(36).substring(2, 12).toUpperCase() },
    message: { contactMessage: { displayName: BOT_NAME, vcard } },
    participant: '0@s.whatsapp.net',
  };
}

// ==========================================
// CHANNEL FORWARDING
// ==========================================
function getChannelContext() {
  return {
    forwardingScore: 1, isForwarded: true,
    forwardedNewsletterMessageId: '100',
    forwardedNewsletterMessageName: 'Snuggle X',
    newsletterJid: CHANNEL_JID, newsletterName: 'Snuggle X',
  };
}

// ==========================================
// MENU
// ==========================================
function buildMenuHeader(ownerName, prefix, mode) {
  const mem = process.memoryUsage();
  const ramPct = Math.min(100, Math.round((mem.rss / os.totalmem()) * 100));
  const ramBar = '█'.repeat(Math.round(ramPct / 10)) + '░'.repeat(10 - Math.round(ramPct / 10));
  return `┏▣ ◈ *SNUGGLE-X* ◈
┃ *ᴏᴡɴᴇʀ* : ${ownerName}
┃ *ᴘʀᴇғɪx* : [ ${prefix === '' ? 'None' : prefix} ]
┃ *ʜᴏsᴛ* : Railway
┃ *ᴘʟᴜɢɪɴs* : 744
┃ *ᴍᴏᴅᴇ* : ${mode}
┃ *ᴠᴇʀsɪᴏɴ* : 2.0.0
┃ *sᴘᴇᴇᴅ* : ${(process.hrtime()[1] / 1e6).toFixed(4)} ms
┃ *ᴜsᴀɢᴇ* : ${(mem.rss / 1024 / 1024).toFixed(0)} MB of ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
┃ *ʀᴀᴍ:* [${ramBar}] ${ramPct}%
┗▣ `;
}

function buildMenu(prefix, ownerName, mode) {
  const p = prefix === '' ? '' : prefix;
  const readmore = '\u200e'.repeat(700);
  let out = buildMenuHeader(ownerName, prefix, mode) + readmore + '\n\n';
  // Only WORKING commands listed
  const cats = {
    'MAIN MENU': ['menu','all','ping','alive','help','owner','whoami','repo','uptime','time'],
    'AI MENU': ['ai','ask','chatbot','setgeminikey'],
    'GROUP MENU': ['tagall','hidetag','promote','demote','kick','add','ginfo','link','resetlink','setgroupname','setdesc','leave','join','getpp','totalmembers','close','open','lock','unlock','mute','unmute'],
    'ANTI MENU': ['antilink','antispam','antibadword','antidelete','antimention','antitag','antisticker','anticall'],
    'DOWNLOAD MENU': ['song','video'],
    'MEDIA MENU': ['sticker','url','tts','translate','vv','vv2','vv3'],
    'FUN MENU': ['8ball','truth','dare','joke','quote','fact','pickupline','rps','ship','flip','dice','choose','shrug','compliment','insult','roast','rate','respect','simp','hack','kill','hug2','slap2','pat2','dance','wave','wink','cry','bully','poke'],
    'SEARCH MENU': ['weather','wiki','define','shorten','lyrics'],
    'TOOLS MENU': ['calc','qr','uuid','pass','reverse','count','base64','hash','fliptext','tempmail','currency','bmi','color','ssweb','jid','whois','dns','myip','readmore','tinyurl','device','fakename','fakeaddress'],
    'OWNER MENU': ['mode','addsudo','delsudo','sudolist','setpp','setbio','setname','setownername','setprefix','block','unblock','pair','leave','join','delete','forward','blocklist','restart','logout','setmenuimage','setmenuvideo','clearmenuvideo','autofaketyping','autofakerecording','chatbot'],
    'SETTINGS MENU': ['mode','setprefix','setownername','setmenuimage','setmenuvideo','clearmenuvideo','chatbot','setgeminikey','autofaketyping','autofakerecording','setpp','setbio','setname','block','unblock','addsudo','delsudo','sudolist'],
    'SUPPORT MENU': ['feedback','helpers'],
  };
  for (const [name, cmds] of Object.entries(cats)) {
    out += `┏▣ ◈ *${name}* ◈\n`;
    out += cmds.map(c => `│➽ ${p}${c}`).join('\n');
    out += `\n┗▣ \n\n`;
  }
  out += `> *Powered by Yobby King*\n> *Instagram: @yobby_mking*`;
  return out;
}

// ==========================================
// MAIN
// ==========================================
async function start() {
  // Decode session
  const sessionId = process.env.SESSION_ID;
  if (sessionId) {
    await decodeSession(sessionId);
  } else if (!fs.existsSync(path.join(SESSION_DIR, 'creds.json'))) {
    console.error('❌ No SESSION_ID and no existing session. Set SESSION_ID env var.');
    process.exit(1);
  }

  // Owner info
  let ownerJid = null, ownerName = 'Not Set!';
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, 'creds.json'), 'utf-8'));
    if (creds.me?.id) { ownerJid = creds.me.id; ownerName = creds.me.name || 'Not Set!'; }
  } catch {}
  const ownerNumber = ownerJid ? ownerJid.split(':')[0].split('@')[0] : null;
  console.log(`[Bot] Owner: ${ownerNumber} (${ownerJid})`);

  // SQLite
  const db = new Database(path.join(SESSION_DIR, 'bot.db'));
  db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE IF NOT EXISTS sudos (number TEXT PRIMARY KEY);');
  const dbGet = (k, d) => { try { const r = db.prepare('SELECT value FROM kv WHERE key=?').get(k); return r ? r.value : d; } catch { return d; } };
  const dbSet = (k, v) => { try { db.prepare('INSERT OR REPLACE INTO kv (key,value) VALUES (?,?)').run(k, String(v)); } catch {} };
  const getPrefix = () => { const p = dbGet('prefix', '.'); return p === 'none' ? '' : p; };
  const getMode = () => dbGet('mode', 'public');
  const getOwnerName = () => dbGet('ownerName', '') || ownerName;
  const getGeminiKey = () => dbGet('geminiKey', '') || process.env.GEMINI_KEY || '';

  // Connect
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const logger = P({ level: 'warn' }, P.destination({ sync: false }));
  const sock = makeWASocket({
    version, auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    printQRInTerminal: false, browser: Browsers.ubuntu('Chrome'), logger,
    markOnlineOnConnect: false, linkPreview: false, syncFullHistory: false,
  });
  sock.ev.on('creds.update', saveCreds);

  // Channel forwarding wrapper
  const _origSend = sock.sendMessage.bind(sock);
  sock.sendMessage = async function(jid, content, opts = {}) {
    if (content && typeof content === 'object') {
      if (!content.contextInfo) content.contextInfo = {};
      if (!content.contextInfo.forwardedNewsletterMessageId) Object.assign(content.contextInfo, getChannelContext());
    }
    return _origSend(jid, content, opts);
  };

  // Connection
  let isStarting = true;
  sock.ev.on('connection.update', async (u) => {
    if (u.connection === 'open') {
      console.log('[Bot] ✅ Connected as', sock.user.id);
      if (isStarting) {
        isStarting = false;
        setTimeout(() => { try { sock.sendMessage(ownerNumber + '@s.whatsapp.net', { text: '*`SNUGGLE X BOT IS NOW LIVE ✅`*\n> snuggle x bot\n\nType *.menu* to see commands.' }); } catch {} }, 2000);
      }
    }
    if (u.connection === 'close') {
      const code = u.lastDisconnect?.error?.output?.statusCode;
      console.log('[Bot] closed:', code);
      if (code === DisconnectReason.loggedOut) { console.error('[Bot] ❌ Session logged out.'); process.exit(1); }
      else setTimeout(() => start(), 3000);
    }
  });

  // Messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0];
      if (!m || !m.message) return;
      const chatId = m.key.remoteJid;
      if (chatId?.includes('newsletter') || chatId?.includes('broadcast')) return;
      const isGroup = chatId?.endsWith('@g.us');
      const participant = m.key.participant || chatId;
      const participantPn = m.key.participantPn || null;
      const isLid = chatId?.endsWith('@lid');
      const isSelfChat = (chatId?.split('@')[0].split(':')[0] === ownerNumber) || (isLid && m.key.fromMe);
      if (m.key.fromMe && !isSelfChat && !isGroup) return;

      // Extract text
      const msg = m.message;
      let text = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '';
      if (!text) return;
      const raw = text.trim(); if (!raw) return;
      const lower = raw.toLowerCase();

      // Parse
      const prefix = getPrefix();
      const cmdText = raw.replace(/^[*_`~]+/, '').trim();
      const cmd = cmdText.toLowerCase().split(/\s+/)[0];
      const args = cmdText.split(/\s+/).slice(1);
      const argText = args.join(' ');

      const isMenuCmd = (cmd === `${prefix}menu` || (prefix && lower === 'menu'));
      const fakeContact = createFakeContact(ownerNumber, getOwnerName());
      const quotedMsg = isGroup ? (isMenuCmd ? m : fakeContact) : undefined;

      // Owner check
      const ownerCheck = (() => {
        const ph = (isGroup ? participant : chatId)?.split('@')[0].split(':')[0];
        if (ph === ownerNumber) return true;
        if (participantPn && participantPn.split('@')[0] === ownerNumber) return true;
        return isSelfChat || (isGroup && m.key.fromMe);
      })();
      const sudoCheck = (() => { try { return db.prepare('SELECT 1 FROM sudos WHERE number=?').get((isGroup ? participant : chatId)?.split('@')[0].split(':')[0]); } catch { return false; } })();
      const mode = getMode();
      if ((mode === 'silent' || mode === 'private') && !ownerCheck && !sudoCheck) return;
      if (mode === 'groups' && !isGroup && !ownerCheck && !sudoCheck) return;
      if (mode === 'dms' && isGroup && !ownerCheck && !sudoCheck) return;

      // === PUBLIC ===
      if (isMenuCmd) {
        const menuText = buildMenu(prefix, getOwnerName(), mode);
        try { await sock.sendMessage(chatId, { text: menuText }); console.log(`[MENU] ✅ ${chatId}`); }
        catch (e) { console.error('[MENU]', e.message); try { await sock.sendMessage(chatId, { text: menuText }); } catch {} }
        return;
      }
      if (cmd === `${prefix}all` || (prefix && lower === 'all')) { await sock.sendMessage(chatId, { text: buildMenu(prefix, getOwnerName(), mode) }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}ping`) { const t = Date.now(); await sock.sendMessage(chatId, { text: `*PONG* 🏓\nLatency: ${Date.now() - t}ms` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}alive`) { await sock.sendMessage(chatId, { text: `*SNUGGLE X IS ALIVE ✅*\n> owner: ${getOwnerName()}\n> mode: ${mode}\n> uptime: ${formatUptime(process.uptime())}` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}help`) { await sock.sendMessage(chatId, { text: `Type *${prefix}menu* for commands.` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}owner`) { await sock.sendMessage(chatId, { text: `*BOT OWNER* 👑\n> Name: Yobby King\n> Number: ${ownerNumber}\n> Instagram: @yobby_mking` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}repo`) { await sock.sendMessage(chatId, { text: `📦 GitHub: ${GITHUB_URL}` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}uptime`) { await sock.sendMessage(chatId, { text: `⏱️ ${formatUptime(process.uptime())}` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}time`) { await sock.sendMessage(chatId, { text: `🕐 ${new Date().toLocaleString()}` }, { quoted: quotedMsg }); return; }

      // Sticker
      if (cmd === `${prefix}sticker`) {
        let hasMedia = msg.imageMessage || msg.videoMessage || msg.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        if (!hasMedia) { await sock.sendMessage(chatId, { text: 'Send/reply to image with .sticker' }, { quoted: quotedMsg }); return; }
        try {
          let tm = m;
          if (!msg.imageMessage && !msg.videoMessage) { const q = msg.extendedTextMessage.contextInfo.quotedMessage; tm = { key: { remoteJid: chatId, id: msg.extendedTextMessage.contextInfo.stanzaId, participant: msg.extendedTextMessage.contextInfo.participant }, message: q }; }
          const buf = await downloadMediaMessage(tm, 'buffer', {}, { logger: P({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
          await sock.sendMessage(chatId, { sticker: Buffer.from(buf) }, { quoted: quotedMsg });
        } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
        return;
      }

      // === ACCESS GATE ===
      if (!ownerCheck && !sudoCheck) {
        if (cmd.startsWith(prefix)) await sock.sendMessage(chatId, { text: `> *only sudo access 🚫*\n> Get yours 0181163563 ✅` }, { quoted: quotedMsg });
        return;
      }

      // === OWNER/SUDO ===
      switch (cmd) {
        case `${prefix}mode`:
          if (['private','public','silent','groups','dms'].includes(argText)) {
            if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
            dbSet('mode', argText); await sock.sendMessage(chatId, { text: `*MODE* ✅ → *${argText}*` }, { quoted: quotedMsg });
          } else { await sock.sendMessage(chatId, { text: `*Mode:* ${mode}\n*Prefix:* ${prefix}\n\nUsage: .mode public/private/silent/groups/dms` }, { quoted: quotedMsg }); }
          break;
        case `${prefix}setprefix`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setprefix <prefix>' }, { quoted: quotedMsg }); break; }
          dbSet('prefix', argText === 'none' ? 'none' : argText); await sock.sendMessage(chatId, { text: `✅ Prefix: ${argText}` }, { quoted: quotedMsg }); break;
        case `${prefix}setownername`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setownername <name>' }, { quoted: quotedMsg }); break; }
          dbSet('ownerName', argText); ownerName = argText; await sock.sendMessage(chatId, { text: `✅ Owner: ${argText}` }, { quoted: quotedMsg }); break;
        case `${prefix}addsudo`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          const sn = args[0]?.replace(/[^0-9]/g, ''); if (!sn) { await sock.sendMessage(chatId, { text: 'Usage: .addsudo <number>' }, { quoted: quotedMsg }); break; }
          db.prepare('INSERT OR IGNORE INTO sudos (number) VALUES (?)').run(sn); await sock.sendMessage(chatId, { text: `✅ Sudo: ${sn}` }, { quoted: quotedMsg }); break;
        case `${prefix}sudolist`:
          const sudos = db.prepare('SELECT number FROM sudos').all().map(r => r.number);
          await sock.sendMessage(chatId, { text: `*Sudo (${sudos.length}):*\n${sudos.length ? sudos.map(x => '• ' + x).join('\n') : 'None'}` }, { quoted: quotedMsg }); break;
        case `${prefix}tagall`:
          if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; }
          try { const meta = await sock.groupMetadata(chatId); const mentions = meta.participants.map(p => p.id); await sock.sendMessage(chatId, { text: `┏▣ *TAG ALL* ▣\n┗▣ ${mentions.length} members\n\n` + mentions.map(p => '➽ @' + p.split('@')[0]).join('\n'), mentions }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}song`:
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .song <name>' }, { quoted: quotedMsg }); break; }
          await sock.sendMessage(chatId, { text: `🎵 Searching: ${argText}...` }, { quoted: quotedMsg });
          try { const { spawnSync } = require('child_process'); const tf = `/tmp/song-${Date.now()}.mp3`; const r = spawnSync('yt-dlp', ['--no-playlist','--no-warnings','--retries','3','--extract-audio','--audio-format','mp3','--audio-quality','0','-o',tf,`ytsearch1:${argText.replace(/"/g,'')}`], { timeout: 180000, encoding: 'utf-8', maxBuffer: 20*1024*1024 }); if (r.status !== 0 || !fs.existsSync(tf)) throw new Error('Download failed'); const b = fs.readFileSync(tf); const tm = (r.stdout||'').match(/\[info\] \w+: (.+)/); const t = tm ? tm[1].split(' [')[0].trim() : argText; await sock.sendMessage(chatId, { audio: b, mimetype: 'audio/mpeg', fileName: `${t}.mp3`, caption: `🎵 *${t}*` }, { quoted: quotedMsg }); fs.unlinkSync(tf); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}video`:
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .video <name>' }, { quoted: quotedMsg }); break; }
          await sock.sendMessage(chatId, { text: `🎬 Searching: ${argText}...` }, { quoted: quotedMsg });
          try { const { spawnSync } = require('child_process'); const tf = `/tmp/vid-${Date.now()}.mp4`; const r = spawnSync('yt-dlp', ['--no-playlist','--no-warnings','--retries','3','-f','best[ext=mp4][filesize<60M]/best[ext=mp4]/best','--merge-output-format','mp4','-o',tf,`ytsearch1:${argText.replace(/"/g,'')}`], { timeout: 240000, encoding: 'utf-8', maxBuffer: 20*1024*1024 }); if (r.status !== 0 || !fs.existsSync(tf)) throw new Error('Download failed'); const b = fs.readFileSync(tf); if (b.length > 60*1024*1024) { fs.unlinkSync(tf); throw new Error('Too large'); } const tm = (r.stdout||'').match(/\[info\] \w+: (.+)/); const t = tm ? tm[1].split(' [')[0].trim() : argText; await sock.sendMessage(chatId, { video: b, mimetype: 'video/mp4', fileName: `${t}.mp4`, caption: `🎬 *${t}*\n_${(b.length/1024/1024).toFixed(1)} MB_` }, { quoted: quotedMsg }); fs.unlinkSync(tf); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}ai`:
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .ai <question>' }, { quoted: quotedMsg }); break; }
          try { const key = getGeminiKey(); if (!key) { await sock.sendMessage(chatId, { text: '❌ Set .setgeminikey <key>' }, { quoted: quotedMsg }); break; } const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, { contents: [{ parts: [{ text: `You are Snuggle X. Reply concisely. User: ${argText}` }] }] }, { timeout: 30000, headers: { 'Content-Type': 'application/json' } }); const ai = res.data?.candidates?.[0]?.content?.parts?.[0]?.text; await sock.sendMessage(chatId, { text: ai?.trim() || '❌ No response' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}setgeminikey`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setgeminikey <key>' }, { quoted: quotedMsg }); break; }
          dbSet('geminiKey', argText.trim()); await sock.sendMessage(chatId, { text: '✅ Key set' }, { quoted: quotedMsg }); break;
        case `${prefix}calc`:
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .calc <expr>' }, { quoted: quotedMsg }); break; }
          try { const s = argText.replace(/[^0-9+\-*/().%\s]/g, ''); if (!s) throw 0; const r = Function('"use strict";return(' + s + ')')(); await sock.sendMessage(chatId, { text: `🔢 ${argText} = *${r}*` }, { quoted: quotedMsg }); } catch { await sock.sendMessage(chatId, { text: '❌ Invalid' }, { quoted: quotedMsg }); } break;
        case `${prefix}qr`:
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .qr <text>' }, { quoted: quotedMsg }); break; }
          try { const r = await axios.get(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(argText)}`, { responseType: 'arraybuffer', timeout: 15000 }); await sock.sendMessage(chatId, { image: Buffer.from(r.data), caption: '📱 QR' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}8ball`: { const a = ['It is certain.','Without a doubt.','Yes.','Most likely.','Ask again later.','No.','Very doubtful.']; await sock.sendMessage(chatId, { text: `🎱 ${a[Math.floor(Math.random()*a.length)]}` }, { quoted: quotedMsg }); break; }
        case `${prefix}flip`: { await sock.sendMessage(chatId, { text: `🪙 ${Math.random()<0.5?'Heads':'Tails'}` }, { quoted: quotedMsg }); break; }
        case `${prefix}block`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          const bt = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net'; try { await sock.updateBlockStatus(bt, 'block'); await sock.sendMessage(chatId, { text: `✅ Blocked ${bt.split('@')[0]}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}link`:
          if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; }
          try { const c = await sock.groupInviteCode(chatId); await sock.sendMessage(chatId, { text: `🔗 https://chat.whatsapp.com/${c}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        default:
          if (cmd.startsWith(prefix)) await sock.sendMessage(chatId, { text: `Unknown: ${cmd}\nType *${prefix}menu*` }, { quoted: quotedMsg });
      }
    } catch (e) { console.error('[MSG]', e.message); }
  });

  // Anti-call
  sock.ev.on('call', async (calls) => { try { for (const c of calls) await sock.rejectCall(c.id, c.from); } catch {} });
}

function formatUptime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// Start
console.log('========================================');
console.log('  SNUGGLE X BOT v2.0.0');
console.log('========================================');
start().catch(console.error);
