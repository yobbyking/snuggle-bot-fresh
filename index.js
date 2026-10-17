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
let SESSION_DIR_OVERRIDE = null;
function getSessionDir() { return SESSION_DIR_OVERRIDE || SESSION_DIR; }
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
    if (!fs.existsSync(getSessionDir())) fs.mkdirSync(getSessionDir(), { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      const fp = path.join(getSessionDir(), name);
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
// CHANNEL FORWARDING — uses forwardedNewsletterMessageInfo (correct format from Klaus-Bot)
// ==========================================
function getChannelContext() {
  return {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: CHANNEL_JID,
      newsletterName: 'Snuggle X',
      serverMessageId: Math.floor(Math.random() * 9000) + 1,
    },
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
  // Check for session folder argument (VPS mode: node index.js /path/to/session)
  // OR SESSION_ID env var (Railway/Render mode: SESSION_ID=yobbyx:~xxx)
  const sessionArg = process.argv[2];
  if (sessionArg && fs.existsSync(path.join(sessionArg, 'creds.json'))) {
    // VPS mode — use the session folder directly
    SESSION_DIR_OVERRIDE = sessionArg;
    console.log(`[Bot] Using session folder: ${sessionArg}`);
  } else {
    // Railway/Render mode — decode SESSION_ID
    const sessionId = process.env.SESSION_ID;
    if (sessionId) {
      await decodeSession(sessionId);
    } else if (!fs.existsSync(path.join(getSessionDir(), 'creds.json'))) {
      console.error('❌ No SESSION_ID and no existing session. Set SESSION_ID env var.');
      process.exit(1);
    }
  }

  // Owner info
  let ownerJid = null, ownerName = 'Not Set!';
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(getSessionDir(), 'creds.json'), 'utf-8'));
    if (creds.me?.id) { ownerJid = creds.me.id; ownerName = creds.me.name || 'Not Set!'; }
  } catch {}
  const ownerNumber = ownerJid ? ownerJid.split(':')[0].split('@')[0] : null;
  console.log(`[Bot] Owner: ${ownerNumber} (${ownerJid})`);

  // SQLite
  const db = new Database(path.join(getSessionDir(), 'bot.db'));
  db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE IF NOT EXISTS sudos (number TEXT PRIMARY KEY);');
  const dbGet = (k, d) => { try { const r = db.prepare('SELECT value FROM kv WHERE key=?').get(k); return r ? r.value : d; } catch { return d; } };
  const dbSet = (k, v) => { try { db.prepare('INSERT OR REPLACE INTO kv (key,value) VALUES (?,?)').run(k, String(v)); } catch {} };
  const getPrefix = () => { const p = dbGet('prefix', '.'); return p === 'none' ? '' : p; };
  const getMode = () => dbGet('mode', 'public');
  const getOwnerName = () => dbGet('ownerName', '') || ownerName;
  const getGeminiKey = () => dbGet('geminiKey', '') || process.env.GEMINI_KEY || '';

  // Connect
  const { state, saveCreds } = await useMultiFileAuthState(getSessionDir());
  const { version } = await fetchLatestBaileysVersion();
  const logger = P({ level: 'warn' }, P.destination({ sync: false }));
  const sock = makeWASocket({
    version, auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    printQRInTerminal: false, browser: Browsers.ubuntu('Chrome'), logger,
    markOnlineOnConnect: false, linkPreview: false, syncFullHistory: false,
  });
  sock.ev.on('creds.update', saveCreds);

  // Channel forwarding wrapper — ONLY for groups, NOT DMs (DMs get silently dropped with contextInfo)
  const _origSend = sock.sendMessage.bind(sock);
  sock.sendMessage = async function(jid, content, opts = {}) {
    if (content && typeof content === 'object' && !content.react && !content.delete && !content.sticker && !content.contacts && !content.poll) {
      // Only add channel forwarding for GROUP messages, not DMs
      const isGroupSend = jid && jid.endsWith('@g.us');
      if (isGroupSend) {
        if (!content.contextInfo) content.contextInfo = {};
        if (!content.contextInfo.forwardedNewsletterMessageInfo) Object.assign(content.contextInfo, getChannelContext());
      }
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

  // Messages — KEY FIX from Klaus-Bot: process ALL messages including fromMe=true
  // Don't skip fromMe=true. The owner's messages arrive as fromMe=true in DMs.
  // Also: DON'T redirect LID DMs — keep the @lid JID, Baileys routes natively.
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

      // Owner detection — match against phone number, LID, and fromMe
      const senderPhone = (isGroup ? participant : chatId)?.split('@')[0].split(':')[0];
      const isOwner = senderPhone === ownerNumber || (participantPn && participantPn.split('@')[0] === ownerNumber) || (isLid && !isGroup);
      // DON'T skip fromMe=true — process ALL messages (owner commands come as fromMe=true)
      // Only skip fromMe=true in non-owner DMs to prevent echo loops
      if (m.key.fromMe && !isGroup && !isOwner) return;

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

      // Owner check — use the isOwner variable computed above (covers phone, LID, fromMe)
      const ownerCheck = isOwner || (isGroup && m.key.fromMe);
      const sudoCheck = (() => { try { return db.prepare('SELECT 1 FROM sudos WHERE number=?').get((isGroup ? participant : chatId)?.split('@')[0].split(':')[0]); } catch { return false; } })();
      const mode = getMode();
      if ((mode === 'silent' || mode === 'private') && !ownerCheck && !sudoCheck) return;
      if (mode === 'groups' && !isGroup && !ownerCheck && !sudoCheck) return;
      if (mode === 'dms' && isGroup && !ownerCheck && !sudoCheck) return;

      // === LOADING ANIMATION for .menu ===
      async function showLoading(chatId) {
        try {
          const lm = await _origSend(chatId, { text: '*Loading* •' });
          const stages = ['*Loading* ••','*Loading* • •','*Loading* • • •','*Loading* • • • •'];
          for (const s of stages) { await new Promise(r => setTimeout(r, 400)); try { await _origSend(chatId, { text: s, edit: lm.key }); } catch {} }
          await new Promise(r => setTimeout(r, 400));
        } catch (e) { console.error('[Loading]', e.message); }
      }

      // === CONVERSATION-AWARE CHATBOT ===
      const chatHistory = new Map();
      function getChatHistory(jid) { if (!chatHistory.has(jid)) chatHistory.set(jid, []); return chatHistory.get(jid); }
      function addToHistory(jid, role, text) { const h = getChatHistory(jid); h.push({ role, parts: [{ text }] }); if (h.length > 20) h.shift(); }

      // === PUBLIC COMMANDS ===
      if (isMenuCmd) {
        await showLoading(chatId);
        const menuText = buildMenu(prefix, getOwnerName(), mode);
        try { await sock.sendMessage(chatId, { text: menuText }); console.log(`[MENU] ✅ ${chatId}`); }
        catch (e) { console.error('[MENU]', e.message); try { await _origSend(chatId, { text: menuText }); } catch {} }
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
      if (cmd === `${prefix}whoami`) { await sock.sendMessage(chatId, { text: `*You are* ${m.pushName || 'User'}\n*Number:* ${senderPhone}\n*Status:* ${ownerCheck ? 'Owner 👑' : sudoCheck ? 'Sudo 🔑' : 'User'}` }, { quoted: quotedMsg }); return; }

      // === CONVERSATION-AWARE CHATBOT (auto-reply in DMs) ===
      const chatbotOn = dbGet('chatbot', '0') === '1';
      if (chatbotOn && !isGroup && !cmd.startsWith(prefix) && !cmd.startsWith('.') && !cmd.startsWith('!') && !cmd.startsWith('/')) {
        const key = getGeminiKey();
        if (key) {
          try {
            await sock.sendPresenceUpdate('composing', chatId);
            addToHistory(chatId, 'user', raw);
            const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
              contents: getChatHistory(chatId),
              systemInstruction: { parts: [{ text: `You are Snuggle X, a helpful WhatsApp bot assistant. Be friendly and concise. Owner: ${getOwnerName()}.` }] },
            }, { timeout: 30000, headers: { 'Content-Type': 'application/json' } });
            const aiText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (aiText) { addToHistory(chatId, 'model', aiText.trim()); await sock.sendMessage(chatId, { text: aiText.trim() }); }
          } catch (e) { console.error('[CHATBOT]', e.message); }
          return;
        }
      }

      // === STICKER (public) ===
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

      // === URL (public) ===
      if (cmd === `${prefix}url`) {
        let hasMedia = msg.imageMessage || msg.videoMessage || msg.audioMessage || msg.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        if (!hasMedia) { await sock.sendMessage(chatId, { text: 'Send/reply to media with .url' }, { quoted: quotedMsg }); return; }
        try {
          let tm = m; if (!msg.imageMessage && !msg.videoMessage && !msg.audioMessage) { const q = msg.extendedTextMessage.contextInfo.quotedMessage; tm = { key: { remoteJid: chatId, id: msg.extendedTextMessage.contextInfo.stanzaId, participant: msg.extendedTextMessage.contextInfo.participant }, message: q }; }
          const buf = await downloadMediaMessage(tm, 'buffer', {}, { logger: P({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
          const FormData = require('form-data'); const form = new FormData(); form.append('file', Buffer.from(buf), 'upload.bin');
          const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, { headers: form.getHeaders(), timeout: 60000 });
          const url = res.data?.data?.url?.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          await sock.sendMessage(chatId, { text: `✅ *URL:*\n${url}` }, { quoted: quotedMsg });
        } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); }
        return;
      }

      // === ACCESS GATE ===
      if (!ownerCheck && !sudoCheck) {
        if (cmd.startsWith(prefix)) await sock.sendMessage(chatId, { text: `> *only sudo access 🚫*\n> Get yours 0181163563 ✅` }, { quoted: quotedMsg });
        return;
      }

      // Helper: toggle anti feature
      async function toggleAnti(key, label) {
        if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); return; }
        const s = dbGetJSON('settings', {}); const gs = s[chatId] || {};
        const sub = args[0]?.toLowerCase();
        if (sub === 'delete' && args[1] === 'on') { gs[key] = 'delete'; s[chatId] = gs; dbSet('settings', JSON.stringify(s)); await sock.sendMessage(chatId, { text: `✅ Anti-${label}: DELETE` }, { quoted: quotedMsg }); }
        else if (sub === 'warn' && args[1] === 'on') { gs[key] = 'warn'; s[chatId] = gs; dbSet('settings', JSON.stringify(s)); await sock.sendMessage(chatId, { text: `✅ Anti-${label}: WARN` }, { quoted: quotedMsg }); }
        else if (sub === 'kick' && args[1] === 'on') { gs[key] = 'kick'; s[chatId] = gs; dbSet('settings', JSON.stringify(s)); await sock.sendMessage(chatId, { text: `✅ Anti-${label}: KICK` }, { quoted: quotedMsg }); }
        else if (sub === 'on') { gs[key] = 'delete'; s[chatId] = gs; dbSet('settings', JSON.stringify(s)); await sock.sendMessage(chatId, { text: `✅ Anti-${label} ON (delete)` }, { quoted: quotedMsg }); }
        else if (sub === 'off') { gs[key] = 'off'; s[chatId] = gs; dbSet('settings', JSON.stringify(s)); await sock.sendMessage(chatId, { text: `❌ Anti-${label} OFF` }, { quoted: quotedMsg }); }
        else { await sock.sendMessage(chatId, { text: `*Anti-${label}:* ${gs[key] || 'off'}\n\nUsage: .${key} delete/warn/kick on\n.${key} off` }, { quoted: quotedMsg }); }
      }

      // === ALL COMMANDS ===
      switch (cmd) {
        case `${prefix}mode`:
          if (['private','public','silent','groups','dms'].includes(argText)) { if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } dbSet('mode', argText); await sock.sendMessage(chatId, { text: `*MODE* ✅ → *${argText}*` }, { quoted: quotedMsg }); }
          else { await sock.sendMessage(chatId, { text: `*Mode:* ${mode}\n*Prefix:* ${prefix}\n\nUsage: .mode public/private/silent/groups/dms` }, { quoted: quotedMsg }); } break;
        case `${prefix}setprefix`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setprefix <prefix>' }, { quoted: quotedMsg }); break; } dbSet('prefix', argText === 'none' ? 'none' : argText); await sock.sendMessage(chatId, { text: `✅ Prefix: ${argText}` }, { quoted: quotedMsg }); break;
        case `${prefix}setownername`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setownername <name>' }, { quoted: quotedMsg }); break; } dbSet('ownerName', argText); ownerName = argText; await sock.sendMessage(chatId, { text: `✅ Owner: ${argText}` }, { quoted: quotedMsg }); break;
        case `${prefix}addsudo`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } { const sn = args[0]?.replace(/[^0-9]/g, ''); if (!sn) { await sock.sendMessage(chatId, { text: 'Usage: .addsudo <number>' }, { quoted: quotedMsg }); break; } db.prepare('INSERT OR IGNORE INTO sudos (number) VALUES (?)').run(sn); await sock.sendMessage(chatId, { text: `✅ Sudo: ${sn}` }, { quoted: quotedMsg }); } break;
        case `${prefix}delsudo`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } { const dn = args[0]?.replace(/[^0-9]/g, ''); if (!dn) { await sock.sendMessage(chatId, { text: 'Usage: .delsudo <number>' }, { quoted: quotedMsg }); break; } db.prepare('DELETE FROM sudos WHERE number=?').run(dn); await sock.sendMessage(chatId, { text: `✅ Removed ${dn}` }, { quoted: quotedMsg }); } break;
        case `${prefix}sudolist`: { const sudos = db.prepare('SELECT number FROM sudos').all().map(r => r.number); await sock.sendMessage(chatId, { text: `*Sudo (${sudos.length}):*\n${sudos.length ? sudos.map(x => '• ' + x).join('\n') : 'None'}` }, { quoted: quotedMsg }); } break;
        // GROUP
        case `${prefix}tagall`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } try { const meta = await sock.groupMetadata(chatId); const mentions = meta.participants.map(p => p.id); await sock.sendMessage(chatId, { text: `┏▣ *TAG ALL* ▣\n┗▣ ${mentions.length} members\n\n` + mentions.map(p => '➽ @' + p.split('@')[0]).join('\n'), mentions }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}hidetag`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } try { const meta = await sock.groupMetadata(chatId); const mentions = meta.participants.map(p => p.id); await sock.sendMessage(chatId, { text: argText || '👥', mentions }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}promote`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } { const t = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if (!t) { await sock.sendMessage(chatId, { text: 'Mention a user' }, { quoted: quotedMsg }); break; } try { await sock.groupParticipantsUpdate(chatId, [t], 'promote'); await sock.sendMessage(chatId, { text: `✅ Promoted @${t.split('@')[0]}`, mentions: [t] }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } } break;
        case `${prefix}demote`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } { const t = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if (!t) { await sock.sendMessage(chatId, { text: 'Mention a user' }, { quoted: quotedMsg }); break; } try { await sock.groupParticipantsUpdate(chatId, [t], 'demote'); await sock.sendMessage(chatId, { text: `✅ Demoted @${t.split('@')[0]}`, mentions: [t] }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } } break;
        case `${prefix}kick`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } { const t = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if (!t) { await sock.sendMessage(chatId, { text: 'Mention a user' }, { quoted: quotedMsg }); break; } try { await sock.groupParticipantsUpdate(chatId, [t], 'remove'); await sock.sendMessage(chatId, { text: `✅ Kicked @${t.split('@')[0]}`, mentions: [t] }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } } break;
        case `${prefix}add`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } { const n = args[0]?.replace(/[^0-9]/g, ''); if (!n) { await sock.sendMessage(chatId, { text: 'Usage: .add <number>' }, { quoted: quotedMsg }); break; } try { await sock.groupParticipantsUpdate(chatId, [`${n}@s.whatsapp.net`], 'add'); await sock.sendMessage(chatId, { text: `✅ Added ${n}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } } break;
        case `${prefix}ginfo`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } try { const meta = await sock.groupMetadata(chatId); await sock.sendMessage(chatId, { text: `📋 *Group Info*\n\n*Name:* ${meta.subject}\n*Members:* ${meta.participants.length}\n*Admins:* ${meta.participants.filter(p => p.admin).length}\n*Created:* ${new Date(meta.creation * 1000).toLocaleDateString()}\n*Desc:* ${meta.desc || 'None'}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}link`: case `${prefix}grouplink`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } try { const c = await sock.groupInviteCode(chatId); await sock.sendMessage(chatId, { text: `🔗 https://chat.whatsapp.com/${c}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}resetlink`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } try { await sock.groupRevokeInvite(chatId); await sock.sendMessage(chatId, { text: '✅ Link reset' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}setgroupname`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setgroupname <name>' }, { quoted: quotedMsg }); break; } try { await sock.groupUpdateSubject(chatId, argText); await sock.sendMessage(chatId, { text: `✅ Name: ${argText}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}setdesc`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setdesc <desc>' }, { quoted: quotedMsg }); break; } try { await sock.groupUpdateDescription(chatId, argText); await sock.sendMessage(chatId, { text: '✅ Desc updated' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}leave`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } await sock.sendMessage(chatId, { text: '👋 Goodbye!' }, { quoted: quotedMsg }); await sock.groupLeave(chatId); break;
        case `${prefix}join`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } { const l = args[0]; if (!l || !l.includes('chat.whatsapp.com')) { await sock.sendMessage(chatId, { text: 'Usage: .join <link>' }, { quoted: quotedMsg }); break; } try { await sock.groupAcceptInvite(l.split('/').pop()); await sock.sendMessage(chatId, { text: '✅ Joined' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } } break;
        case `${prefix}getpp`: { const t = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (isGroup ? m.key.participant : chatId); if (!t) { await sock.sendMessage(chatId, { text: 'Mention/reply to user' }, { quoted: quotedMsg }); break; } try { const u = await sock.profilePictureUrl(t, 'image'); const r = await axios.get(u, { responseType: 'arraybuffer', timeout: 15000 }); await sock.sendMessage(chatId, { image: Buffer.from(r.data), caption: `📸 ${t.split('@')[0]}` }, { quoted: quotedMsg }); } catch { await sock.sendMessage(chatId, { text: '❌ No profile pic' }, { quoted: quotedMsg }); } } break;
        case `${prefix}totalmembers`: if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; } try { const meta = await sock.groupMetadata(chatId); await sock.sendMessage(chatId, { text: `👥 *${meta.participants.length} members*` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        // ANTI
        case `${prefix}antilink`: await toggleAnti('antilink', 'link'); break;
        case `${prefix}antispam`: await toggleAnti('antispam', 'spam'); break;
        case `${prefix}antibadword`: await toggleAnti('antibadword', 'badword'); break;
        case `${prefix}antidelete`: await toggleAnti('antidelete', 'delete'); break;
        case `${prefix}antimention`: await toggleAnti('antimention', 'mention'); break;
        case `${prefix}antitag`: await toggleAnti('antitag', 'tag'); break;
        case `${prefix}antisticker`: await toggleAnti('antisticker', 'sticker'); break;
        case `${prefix}anticall`: { const on = argText === 'on'; dbSet('anticall', on ? '1' : '0'); await sock.sendMessage(chatId, { text: `${on ? '✅' : '❌'} Anti-call ${on ? 'ON' : 'OFF'}` }, { quoted: quotedMsg }); } break;
        // DOWNLOAD
        case `${prefix}song`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .song <name>' }, { quoted: quotedMsg }); break; } await sock.sendMessage(chatId, { text: `🎵 Searching: ${argText}...` }, { quoted: quotedMsg }); try { const { spawnSync } = require('child_process'); const tf = `/tmp/song-${Date.now()}.mp3`; const r = spawnSync('yt-dlp', ['--no-playlist','--no-warnings','--retries','3','--extract-audio','--audio-format','mp3','--audio-quality','0','-o',tf,`ytsearch1:${argText.replace(/["']/g,'')}`], { timeout: 180000, encoding: 'utf-8', maxBuffer: 20*1024*1024 }); if (r.status !== 0 || !fs.existsSync(tf)) { const err = (r.stderr||r.stdout||'').split('\n').filter(l=>l.includes('ERROR')).join(' ').slice(0,200); throw new Error(err || 'Download failed — try different song'); } const b = fs.readFileSync(tf); const tm = (r.stdout||'').match(/\[info\] \w+: (.+)/); const t = tm ? tm[1].split(' [')[0].trim() : argText; await sock.sendMessage(chatId, { audio: b, mimetype: 'audio/mpeg', fileName: `${t}.mp3`, caption: `🎵 *${t}*` }, { quoted: quotedMsg }); fs.unlinkSync(tf); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}video`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .video <name>' }, { quoted: quotedMsg }); break; } await sock.sendMessage(chatId, { text: `🎬 Searching: ${argText}...` }, { quoted: quotedMsg }); try { const { spawnSync } = require('child_process'); const tf = `/tmp/vid-${Date.now()}.mp4`; const r = spawnSync('yt-dlp', ['--no-playlist','--no-warnings','--retries','3','-f','best[ext=mp4][filesize<60M]/best[ext=mp4]/best','--merge-output-format','mp4','-o',tf,`ytsearch1:${argText.replace(/["']/g,'')}`], { timeout: 240000, encoding: 'utf-8', maxBuffer: 20*1024*1024 }); if (r.status !== 0 || !fs.existsSync(tf)) { const err = (r.stderr||r.stdout||'').split('\n').filter(l=>l.includes('ERROR')).join(' ').slice(0,200); throw new Error(err || 'Download failed — try different video'); } const b = fs.readFileSync(tf); if (b.length > 60*1024*1024) { fs.unlinkSync(tf); throw new Error('Too large (>60MB)'); } const tm = (r.stdout||'').match(/\[info\] \w+: (.+)/); const t = tm ? tm[1].split(' [')[0].trim() : argText; await sock.sendMessage(chatId, { video: b, mimetype: 'video/mp4', fileName: `${t}.mp4`, caption: `🎬 *${t}*\n_${(b.length/1024/1024).toFixed(1)} MB_` }, { quoted: quotedMsg }); fs.unlinkSync(tf); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        // MEDIA
        case `${prefix}tts`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .tts <text>' }, { quoted: quotedMsg }); break; } try { const r = await axios.get(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(argText)}&tl=en&client=tw-ob`, { responseType: 'arraybuffer', timeout: 15000 }); await sock.sendMessage(chatId, { audio: Buffer.from(r.data), mimetype: 'audio/mpeg' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}translate`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .translate <text>' }, { quoted: quotedMsg }); break; } try { const r = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(argText)}`, { timeout: 10000 }); await sock.sendMessage(chatId, { text: `🌐 ${r.data[0].map(t=>t[0]).join('')}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}vv`: case `${prefix}vv2`: case `${prefix}vv3`: { if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } const q = msg.extendedTextMessage?.contextInfo?.quotedMessage; if (!q) { await sock.sendMessage(chatId, { text: 'Reply to view-once media' }, { quoted: quotedMsg }); break; } try { const tm = { key: { remoteJid: chatId, id: msg.extendedTextMessage.contextInfo.stanzaId, participant: msg.extendedTextMessage.contextInfo.participant, fromMe: msg.extendedTextMessage.contextInfo.fromMe || false }, message: q }; const buf = await downloadMediaMessage(tm, 'buffer', {}, { logger: P({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }); const b = Buffer.from(buf); let mt = 'image', mm = 'image/jpeg'; if (q.videoMessage) { mt = 'video'; mm = q.videoMessage.mimetype || 'video/mp4'; } else if (q.audioMessage) { mt = 'audio'; mm = q.audioMessage.mimetype || 'audio/mpeg'; } if (mt === 'video') await sock.sendMessage(chatId, { video: b, mimetype: mm, caption: '🔓 Unlocked' }, { quoted: quotedMsg }); else if (mt === 'audio') await sock.sendMessage(chatId, { audio: b, mimetype: mm }, { quoted: quotedMsg }); else await sock.sendMessage(chatId, { image: b, mimetype: mm, caption: '🔓 Unlocked' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } } break;
        // FUN
        case `${prefix}8ball`: { const a = ['It is certain.','Without a doubt.','Yes.','Most likely.','Ask again later.','No.','Very doubtful.']; await sock.sendMessage(chatId, { text: `🎱 ${a[Math.floor(Math.random()*a.length)]}` }, { quoted: quotedMsg }); break; }
        case `${prefix}truth`: { const t = ['What is your biggest fear?','Most embarrassing moment?','Biggest secret?','Who is your crush?']; await sock.sendMessage(chatId, { text: `🤔 *Truth:* ${t[Math.floor(Math.random()*t.length)]}` }, { quoted: quotedMsg }); break; }
        case `${prefix}dare`: { const d = ['Send a voice note singing.','Send your last screenshot.','Text first contact "I love you".']; await sock.sendMessage(chatId, { text: `😈 *Dare:* ${d[Math.floor(Math.random()*d.length)]}` }, { quoted: quotedMsg }); break; }
        case `${prefix}joke`: try { const r = await axios.get('https://v2.jokeapi.dev/joke/Any?safe-mode&type=single', { timeout: 10000 }); await sock.sendMessage(chatId, { text: `😂 ${r.data.joke}` }, { quoted: quotedMsg }); } catch { await sock.sendMessage(chatId, { text: '😂 Why dont programmers like nature? Too many bugs.' }, { quoted: quotedMsg }); } break;
        case `${prefix}quote`: try { const r = await axios.get('https://api.quotable.io/random', { timeout: 10000 }); await sock.sendMessage(chatId, { text: `💬 *${r.data.content}*\n\n— ${r.data.author}` }, { quoted: quotedMsg }); } catch { await sock.sendMessage(chatId, { text: '💬 *The only way to do great work is to love what you do.*\n\n— Steve Jobs' }, { quoted: quotedMsg }); } break;
        case `${prefix}fact`: { const f = ['Honey never spoils.','A group of flamingos is called a flamboyance.','The shortest war lasted 38 minutes.','Octopuses have three hearts.']; await sock.sendMessage(chatId, { text: `🧠 *Did you know?* ${f[Math.floor(Math.random()*f.length)]}` }, { quoted: quotedMsg }); break; }
        case `${prefix}pickupline`: { const l = ['Are you a magician? Everyone else disappears when I look at you.','Are you Wi-Fi? Because Im feeling a connection.','Is your name Google? You have everything Ive been searching for.']; await sock.sendMessage(chatId, { text: `😏 ${l[Math.floor(Math.random()*l.length)]}` }, { quoted: quotedMsg }); break; }
        case `${prefix}rps`: { const c = ['rock','paper','scissors']; const bc = c[Math.floor(Math.random()*3)]; const uc = args[0]?.toLowerCase(); if (!uc || !c.includes(uc)) { await sock.sendMessage(chatId, { text: 'Usage: .rps <rock|paper|scissors>' }, { quoted: quotedMsg }); break; } const r = uc === bc ? 'Tie! 🤝' : ((uc==='rock'&&bc==='scissors')||(uc==='paper'&&bc==='rock')||(uc==='scissors'&&bc==='paper')) ? 'You win! 🎉' : 'I win! 🤖'; await sock.sendMessage(chatId, { text: `🪨📄✂️\n\nYou: ${uc}\nBot: ${bc}\n\n${r}` }, { quoted: quotedMsg }); } break;
        case `${prefix}ship`: { const u1 = args[0] || 'Romeo'; const u2 = args[1] || 'Juliet'; const p = Math.floor(Math.random()*100); await sock.sendMessage(chatId, { text: `💞 *Ship*\n\n${u1} ❤️ ${u2}\n\nCompatibility: ${p}% ${p>80?'💕':p>50?'💖':p>30?'💔':'❌'}` }, { quoted: quotedMsg }); } break;
        case `${prefix}flip`: await sock.sendMessage(chatId, { text: `🪙 ${Math.random()<0.5?'Heads':'Tails'}` }, { quoted: quotedMsg }); break;
        case `${prefix}dice`: { const s = parseInt(args[0])||6; await sock.sendMessage(chatId, { text: `🎲 You rolled: ${Math.floor(Math.random()*s)+1} (d${s})` }, { quoted: quotedMsg }); } break;
        case `${prefix}choose`: { const o = argText.split(',').map(x=>x.trim()).filter(x=>x); if (o.length<2) { await sock.sendMessage(chatId, { text: 'Usage: .choose a, b, c' }, { quoted: quotedMsg }); break; } await sock.sendMessage(chatId, { text: `🤔 I choose: *${o[Math.floor(Math.random()*o.length)]}*` }, { quoted: quotedMsg }); } break;
        case `${prefix}shrug`: await sock.sendMessage(chatId, { text: '¯\\_(ツ)_/¯' }, { quoted: quotedMsg }); break;
        // SEARCH
        case `${prefix}weather`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .weather <city>' }, { quoted: quotedMsg }); break; } try { const r = await axios.get(`https://wttr.in/${encodeURIComponent(argText)}?format=3`, { timeout: 10000 }); await sock.sendMessage(chatId, { text: `🌤️ ${r.data}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}wiki`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .wiki <query>' }, { quoted: quotedMsg }); break; } try { const r = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(argText)}`, { timeout: 10000 }); await sock.sendMessage(chatId, { text: `📖 *${r.data.title}*\n\n${r.data.extract}` }, { quoted: quotedMsg }); } catch { await sock.sendMessage(chatId, { text: '❌ Not found' }, { quoted: quotedMsg }); } break;
        case `${prefix}define`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .define <word>' }, { quoted: quotedMsg }); break; } try { const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(argText)}`, { timeout: 10000 }); const d = r.data[0]; const def = d.meanings[0].definitions[0]; await sock.sendMessage(chatId, { text: `📖 *${argText}* (${d.meanings[0].partOfSpeech})\n\n${def.definition}` }, { quoted: quotedMsg }); } catch { await sock.sendMessage(chatId, { text: '❌ Not found' }, { quoted: quotedMsg }); } break;
        case `${prefix}shorten`: if (!args[0]) { await sock.sendMessage(chatId, { text: 'Usage: .shorten <url>' }, { quoted: quotedMsg }); break; } try { const r = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(args[0])}`, { timeout: 10000 }); await sock.sendMessage(chatId, { text: `🔗 ${r.data}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        // TOOLS
        case `${prefix}calc`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .calc <expr>' }, { quoted: quotedMsg }); break; } try { const s = argText.replace(/[^0-9+\-*/().%\s]/g, ''); if (!s) throw 0; const r = Function('"use strict";return(' + s + ')')(); await sock.sendMessage(chatId, { text: `🔢 ${argText} = *${r}*` }, { quoted: quotedMsg }); } catch { await sock.sendMessage(chatId, { text: '❌ Invalid' }, { quoted: quotedMsg }); } break;
        case `${prefix}qr`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .qr <text>' }, { quoted: quotedMsg }); break; } try { const r = await axios.get(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(argText)}`, { responseType: 'arraybuffer', timeout: 15000 }); await sock.sendMessage(chatId, { image: Buffer.from(r.data), caption: '📱 QR' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}uuid`: await sock.sendMessage(chatId, { text: `🆔 ${require('crypto').randomUUID()}` }, { quoted: quotedMsg }); break;
        case `${prefix}pass`: { const len = parseInt(args[0])||12; const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'; let p = ''; for (let i=0; i<Math.min(len,50); i++) p += ch[Math.floor(Math.random()*ch.length)]; await sock.sendMessage(chatId, { text: `🔐 ${p}` }, { quoted: quotedMsg }); } break;
        case `${prefix}reverse`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .reverse <text>' }, { quoted: quotedMsg }); break; } await sock.sendMessage(chatId, { text: `🔄 ${argText.split('').reverse().join('')}` }, { quoted: quotedMsg }); break;
        case `${prefix}count`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .count <text>' }, { quoted: quotedMsg }); break; } await sock.sendMessage(chatId, { text: `📊 Chars: ${argText.length}\nWords: ${argText.split(/\s+/).filter(w=>w).length}` }, { quoted: quotedMsg }); break;
        case `${prefix}base64`: { const sub = args[0]?.toLowerCase(); const t = args.slice(1).join(' '); if (!sub || !t) { await sock.sendMessage(chatId, { text: 'Usage: .base64 encode <text>\n       .base64 decode <text>' }, { quoted: quotedMsg }); break; } try { const r = sub==='encode' ? Buffer.from(t).toString('base64') : Buffer.from(t, 'base64').toString('utf-8'); await sock.sendMessage(chatId, { text: `🔐 ${r}` }, { quoted: quotedMsg }); } catch { await sock.sendMessage(chatId, { text: '❌ Invalid' }, { quoted: quotedMsg }); } } break;
        case `${prefix}hash`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .hash <text>' }, { quoted: quotedMsg }); break; } { const c = require('crypto'); await sock.sendMessage(chatId, { text: `#️⃣ MD5: ${c.createHash('md5').update(argText).digest('hex')}\nSHA256: ${c.createHash('sha256').update(argText).digest('hex')}` }, { quoted: quotedMsg }); } break;
        case `${prefix}fliptext`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .fliptext <text>' }, { quoted: quotedMsg }); break; } { const m2 = {'a':'ɐ','b':'q','c':'ɔ','d':'p','e':'ǝ','f':'ɟ','g':'ƃ','h':'ɥ','i':'ᴉ','j':'ɾ','k':'ʞ','l':'l','m':'ɯ','n':'u','o':'o','p':'d','q':'b','r':'ɹ','s':'s','t':'ʇ','u':'n','v':'ʌ','w':'ʍ','x':'x','y':'ʎ','z':'z'}; let r2=''; for (const ch of argText) r2 += m2[ch.toLowerCase()]||ch; await sock.sendMessage(chatId, { text: `🔄 ${r2.split('').reverse().join('')}` }, { quoted: quotedMsg }); } break;
        // AI
        case `${prefix}ai`: case `${prefix}ask`: if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .ai <question>' }, { quoted: quotedMsg }); break; } try { const key = getGeminiKey(); if (!key) { await sock.sendMessage(chatId, { text: '❌ Set .setgeminikey <key>' }, { quoted: quotedMsg }); break; } await sock.sendPresenceUpdate('composing', chatId); const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, { contents: [{ parts: [{ text: `You are Snuggle X. Reply concisely. User: ${argText}` }] }] }, { timeout: 30000, headers: { 'Content-Type': 'application/json' } }); const ai = res.data?.candidates?.[0]?.content?.parts?.[0]?.text; await sock.sendMessage(chatId, { text: ai?.trim() || '❌ No response' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}chatbot`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } if (argText === 'on') { dbSet('chatbot', '1'); await sock.sendMessage(chatId, { text: '✅ AI Chatbot ON — I will reply to DMs with conversation context' }, { quoted: quotedMsg }); } else if (argText === 'off') { dbSet('chatbot', '0'); await sock.sendMessage(chatId, { text: '❌ AI Chatbot OFF' }, { quoted: quotedMsg }); } else { await sock.sendMessage(chatId, { text: `*AI Chatbot:* ${dbGet('chatbot','0')==='1'?'ON ✅':'OFF ❌'}\n\nUsage: .chatbot on/off` }, { quoted: quotedMsg }); } break;
        case `${prefix}setgeminikey`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setgeminikey <key>' }, { quoted: quotedMsg }); break; } dbSet('geminiKey', argText.trim()); await sock.sendMessage(chatId, { text: '✅ Key set' }, { quoted: quotedMsg }); break;
        // OWNER
        case `${prefix}setpp`: case `${prefix}setprofilepic`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } try { if (msg.imageMessage) { const buf = await downloadMediaMessage(m, 'buffer', {}, { logger: P({ level: 'silent' }) }); await sock.updateProfilePicture(sock.user.id, Buffer.from(buf)); await sock.sendMessage(chatId, { text: '✅ Profile pic updated' }, { quoted: quotedMsg }); } else { await sock.sendMessage(chatId, { text: 'Send image with caption .setpp' }, { quoted: quotedMsg }); } } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}setbio`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setbio <text>' }, { quoted: quotedMsg }); break; } try { await sock.updateProfileStatus(argText); await sock.sendMessage(chatId, { text: '✅ Bio updated' }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}setname`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setname <name>' }, { quoted: quotedMsg }); break; } try { await sock.updateProfileName(argText); await sock.sendMessage(chatId, { text: `✅ Name: ${argText}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}block`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } { const bt = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net'; try { await sock.updateBlockStatus(bt, 'block'); await sock.sendMessage(chatId, { text: `✅ Blocked ${bt.split('@')[0]}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } } break;
        case `${prefix}unblock`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } { const bt = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net'; try { await sock.updateBlockStatus(bt, 'unblock'); await sock.sendMessage(chatId, { text: `✅ Unblocked ${bt.split('@')[0]}` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } } break;
        case `${prefix}setmenuimage`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } try { if (msg.imageMessage) { const buf = await downloadMediaMessage(m, 'buffer', {}, { logger: P({ level: 'silent' }) }); fs.writeFileSync(path.join(getSessionDir(), 'menu-image.png'), Buffer.from(buf)); await sock.sendMessage(chatId, { text: '✅ Menu image set' }, { quoted: quotedMsg }); } else if (args[0]?.startsWith('http')) { const r = await axios.get(args[0], { responseType: 'arraybuffer', timeout: 30000 }); fs.writeFileSync(path.join(getSessionDir(), 'menu-image.png'), Buffer.from(r.data)); await sock.sendMessage(chatId, { text: '✅ Menu image set from URL' }, { quoted: quotedMsg }); } else { await sock.sendMessage(chatId, { text: 'Usage: .setmenuimage (send image with caption)\n.setmenuimage <url>' }, { quoted: quotedMsg }); } } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}setmenuvideo`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } try { if (msg.videoMessage) { const buf = await downloadMediaMessage(m, 'buffer', {}, { logger: P({ level: 'silent' }) }); fs.writeFileSync(path.join(getSessionDir(), 'menu-video.mp4'), Buffer.from(buf)); await sock.sendMessage(chatId, { text: '✅ Menu video set' }, { quoted: quotedMsg }); } else { await sock.sendMessage(chatId, { text: 'Send video with caption .setmenuvideo' }, { quoted: quotedMsg }); } } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); } break;
        case `${prefix}clearmenuvideo`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } try { fs.unlinkSync(path.join(getSessionDir(), 'menu-video.mp4')); } catch {} await sock.sendMessage(chatId, { text: '✅ Menu video cleared' }, { quoted: quotedMsg }); break;
        case `${prefix}autofaketyping`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } { const on = argText === 'on'; dbSet('faketyping', on ? '1' : '0'); await sock.sendMessage(chatId, { text: `${on?'✅':'❌'} Auto fake typing ${on?'ON':'OFF'}` }, { quoted: quotedMsg }); } break;
        case `${prefix}autofakerecording`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } { const on = argText === 'on'; dbSet('fakerecording', on ? '1' : '0'); await sock.sendMessage(chatId, { text: `${on?'✅':'❌'} Auto fake recording ${on?'ON':'OFF'}` }, { quoted: quotedMsg }); } break;
        case `${prefix}pair`: if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; } { const pn = args[0]?.replace(/[^0-9]/g, ''); if (!pn || pn.length < 10) { await sock.sendMessage(chatId, { text: 'Usage: .pair <number with country code>' }, { quoted: quotedMsg }); break; } await sock.sendMessage(chatId, { text: `⏳ Requesting pairing code for +${pn}...` }, { quoted: quotedMsg }); try { const { useMultiFileAuthState: ua, makeWASocket: ms, fetchLatestBaileysVersion: fv, makeCacheableSignalKeyStore: mk, Browsers: b } = require('@whiskeysockets/baileys'); const psd = path.join(getSessionDir(), 'pair-' + pn); fs.rmSync(psd, { recursive: true, force: true }); fs.mkdirSync(psd, { recursive: true }); const { state: ps, saveCreds: pc } = await ua(psd); const { version: pv } = await fv(); const pl = P({ level: 'silent' }); const psock = ms({ version: pv, auth: { creds: ps.creds, keys: mk(ps.keys, pl) }, printQRInTerminal: false, browser: b.ubuntu('Chrome'), logger: pl, markOnlineOnConnect: false }); let code = null; psock.ev.on('creds.update', pc); psock.ev.on('connection.update', async (u) => { if (u.qr && !code) { try { await new Promise(r=>setTimeout(r,1500)); code = await psock.requestPairingCode(pn); await sock.sendMessage(chatId, { text: `🔑 *Pairing Code:*\n\n*${code}*\n\nWhatsApp → Linked Devices → Link with phone number.` }, { quoted: quotedMsg }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } } if (u.connection === 'open') { setTimeout(() => { try { psock.end(); } catch {} fs.rmSync(psd, { recursive: true, force: true }); }, 5000); } }); } catch (e) { await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: quotedMsg }); } } break;
        default:
          if (cmd.startsWith(prefix)) await sock.sendMessage(chatId, { text: `Unknown: ${cmd}\nType *${prefix}menu*` }, { quoted: quotedMsg });
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
