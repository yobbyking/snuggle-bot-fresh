/**
 * SNUGGLE X BOT — bot.js
 * 
 - CYPHER-X style menu (no contact card on .menu)
 * - Channel forwarding + contact card on all other replies
 * - SQLite for settings
 * - Works in DM and groups
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
const sessionDir = process.argv[2] || './session';
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

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
function dbGetJSON(k, def) { try { const v = dbGet(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function dbSetJSON(k, v) { dbSet(k, JSON.stringify(v)); }

function getPrefix() { const p = dbGet('prefix', '.'); return p === 'none' ? '' : p; }
function getMode() { return dbGet('mode', 'public'); }
function getOwnerName() { return dbGet('ownerName', '') || ownerName; }
function getGeminiKey() { return dbGet('geminiKey', '') || process.env.GEMINI_KEY || ''; }

// === Channel forwarding ===
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

// === Menu builders ===
function buildMenuHeader() {
  const mem = process.memoryUsage();
  const memMB = (mem.rss / 1024 / 1024).toFixed(0);
  const totalRAM = Math.round(os.totalmem() / 1024 / 1024 / 1024);
  const ramPct = Math.min(100, Math.round((mem.rss / os.totalmem()) * 100));
  const ramBar = '█'.repeat(Math.round(ramPct / 10)) + '░'.repeat(10 - Math.round(ramPct / 10));
  const prefix = getPrefix();
  return `┏▣ ◈ *SNUGGLE-X* ◈
┃ *ᴏᴡɴᴇʀ* : ${getOwnerName()}
┃ *ᴘʀᴇғɪx* : [ ${prefix === '' ? 'None' : prefix} ]
┃ *ʜᴏsᴛ* : Railway VPS
┃ *ᴘʟᴜɢɪɴs* : 744
┃ *ᴍᴏᴅᴇ* : ${getMode()}
┃ *ᴠᴇʀsɪᴏɴ* : 1.8.7
┃ *sᴘᴇᴇᴅ* : ${(process.hrtime()[1] / 1e6).toFixed(4)} ms
┃ *ᴜsᴀɢᴇ* : ${memMB} MB of ${totalRAM} GB
┃ *ʀᴀᴍ:* [${ramBar}] ${ramPct}%
┗▣ `;
}

function buildMenu() {
  const prefix = getPrefix();
  const p = prefix === '' ? '' : prefix;
  const readmore = '\u200e'.repeat(700);
  let out = buildMenuHeader() + readmore + '\n\n';

  // AI MENU
  out += `┏▣ ◈ *AI MENU* ◈\n│➽ ${p}analyze\n│➽ ${p}blackbox\n│➽ ${p}cat\n│➽ ${p}chatbot\n│➽ ${p}dalle\n│➽ ${p}dare\n│➽ ${p}deepseek\n│➽ ${p}dog\n│➽ ${p}doppleai\n│➽ ${p}explaincode\n│➽ ${p}flirt\n│➽ ${p}gemini\n│➽ ${p}generate\n│➽ ${p}gpt\n│➽ ${p}grok-ai\n│➽ ${p}imagen\n│➽ ${p}llama\n│➽ ${p}metaai\n│➽ ${p}mistral\n│➽ ${p}neon\n│➽ ${p}pixabay\n│➽ ${p}programming\n│➽ ${p}qwen\n│➽ ${p}recipe\n│➽ ${p}story\n│➽ ${p}summarize\n│➽ ${p}teach\n│➽ ${p}translate2\n│➽ ${p}valentine\n│➽ ${p}zodiac\n┗▣ \n\n`;
  // ANIME MENU
  out += `┏▣ ◈ *ANIME MENU* ◈\n│➽ ${p}anime\n│➽ ${p}animegif\n│➽ ${p}animenews\n│➽ ${p}animequote\n│➽ ${p}animerec\n│➽ ${p}character\n│➽ ${p}cuddle\n│➽ ${p}feed\n│➽ ${p}foxgirl\n│➽ ${p}goose\n│➽ ${p}hug\n│➽ ${p}kiss\n│➽ ${p}lizard\n│➽ ${p}manga\n│➽ ${p}pat\n│➽ ${p}season\n│➽ ${p}slap\n│➽ ${p}smug\n│➽ ${p}tickle\n┗▣ \n\n`;
  // AUDIO MENU
  out += `┏▣ ◈ *AUDIO MENU* ◈\n│➽ ${p}8daudio\n│➽ ${p}bassboost\n│➽ ${p}black\n│➽ ${p}blown\n│➽ ${p}chipmunk\n│➽ ${p}deep\n│➽ ${p}earrape\n│➽ ${p}echo\n│➽ ${p}fast\n│➽ ${p}fat\n│➽ ${p}flanger\n│➽ ${p}nightcore\n│➽ ${p}reverb\n│➽ ${p}reverse\n│➽ ${p}robot\n│➽ ${p}slow\n│➽ ${p}slowed\n│➽ ${p}smooth\n│➽ ${p}squirrel\n│➽ ${p}tomp3\n│➽ ${p}toptt\n│➽ ${p}tremolo\n│➽ ${p}vibrato\n│➽ ${p}volaudio\n┗▣ \n\n`;
  // DOWNLOAD MENU
  out += `┏▣ ◈ *DOWNLOAD MENU* ◈\n│➽ ${p}apk\n│➽ ${p}capcut\n│➽ ${p}dlmovie\n│➽ ${p}download\n│➽ ${p}facebook\n│➽ ${p}fbaudio\n│➽ ${p}gdrive\n│➽ ${p}gitclone\n│➽ ${p}igaudio\n│➽ ${p}image\n│➽ ${p}instagram\n│➽ ${p}itunes\n│➽ ${p}mediafire\n│➽ ${p}movie2\n│➽ ${p}pin\n│➽ ${p}savestatus\n│➽ ${p}selectmovie\n│➽ ${p}song\n│➽ ${p}song2\n│➽ ${p}spotify\n│➽ ${p}sticker\n│➽ ${p}subtitle\n│➽ ${p}tik-img\n│➽ ${p}tiktok\n│➽ ${p}tiktokaudio\n│➽ ${p}twitter\n│➽ ${p}video\n│➽ ${p}videodoc\n│➽ ${p}ytmp3\n│➽ ${p}ytmp3doc\n┗▣ \n\n`;
  // ECONOMY MENU
  out += `┏▣ ◈ *ECONOMY MENU* ◈\n│➽ ${p}bal\n│➽ ${p}bankrob\n│➽ ${p}beg\n│➽ ${p}blackjack\n│➽ ${p}buy\n│➽ ${p}coinflip\n│➽ ${p}crime\n│➽ ${p}daily\n│➽ ${p}dep\n│➽ ${p}economy\n│➽ ${p}econprofile\n│➽ ${p}edice\n│➽ ${p}eflip\n│➽ ${p}fish\n│➽ ${p}gamble\n│➽ ${p}gift\n│➽ ${p}give\n│➽ ${p}heist\n│➽ ${p}hunt\n│➽ ${p}inv\n│➽ ${p}lb\n│➽ ${p}loan\n│➽ ${p}mine\n│➽ ${p}networth\n│➽ ${p}payloan\n│➽ ${p}poor\n│➽ ${p}rich\n│➽ ${p}rob\n│➽ ${p}sell\n│➽ ${p}shop\n│➽ ${p}slots\n│➽ ${p}streak\n│➽ ${p}tax\n│➽ ${p}use\n│➽ ${p}with\n│➽ ${p}work\n┗▣ \n\n`;
  // EPHOTO360 MENU
  out += `┏▣ ◈ *EPHOTO360 MENU* ◈\n│➽ ${p}1917style\n│➽ ${p}advancedglow\n│➽ ${p}blackpinklogo\n│➽ ${p}blackpinkstyle\n│➽ ${p}cartoonstyle\n│➽ ${p}deletingtext\n│➽ ${p}dragonball\n│➽ ${p}effectclouds\n│➽ ${p}flag3dtext\n│➽ ${p}flagtext\n│➽ ${p}freecreate\n│➽ ${p}galaxystyle\n│➽ ${p}galaxywallpaper\n│➽ ${p}glitchtext\n│➽ ${p}glowingtext\n│➽ ${p}gradienttext\n│➽ ${p}graffiti\n│➽ ${p}incandescent\n│➽ ${p}lighteffects\n│➽ ${p}logomaker\n│➽ ${p}luxurygold\n│➽ ${p}makingneon\n│➽ ${p}matrix\n│➽ ${p}multicoloredneon\n│➽ ${p}neonglitch\n│➽ ${p}papercutstyle\n│➽ ${p}pixelglitch\n│➽ ${p}royaltext\n│➽ ${p}sand\n│➽ ${p}summerbeach\n│➽ ${p}topography\n│➽ ${p}watercolortext\n│➽ ${p}writetext\n┗▣ \n\n`;
  // FINANCE MENU
  out += `┏▣ ◈ *FINANCE MENU* ◈\n│➽ ${p}cryptonews\n│➽ ${p}forex\n┗▣ \n\n`;
  // FUN MENU
  out += `┏▣ ◈ *FUN MENU* ◈\n│➽ ${p}8ball\n│➽ ${p}ad\n│➽ ${p}advice\n│➽ ${p}angry2\n│➽ ${p}avengers\n│➽ ${p}bite2\n│➽ ${p}blur\n│➽ ${p}bully\n│➽ ${p}caution\n│➽ ${p}coffee\n│➽ ${p}coinbattle\n│➽ ${p}compliment\n│➽ ${p}confuse2\n│➽ ${p}couplepp\n│➽ ${p}cry2\n│➽ ${p}dadjoke\n│➽ ${p}dance2\n│➽ ${p}dbinary\n│➽ ${p}ebinary\n│➽ ${p}emojiquiz\n│➽ ${p}facepalm2\n│➽ ${p}fact\n│➽ ${p}fox\n│➽ ${p}funfact\n│➽ ${p}gamefact\n│➽ ${p}gfx\n│➽ ${p}gun\n│➽ ${p}hack\n│➽ ${p}hug2\n│➽ ${p}inspire\n│➽ ${p}insult\n│➽ ${p}jokes\n│➽ ${p}kill\n│➽ ${p}lick\n│➽ ${p}moviequote\n│➽ ${p}nokia\n│➽ ${p}onepiece\n│➽ ${p}panda\n│➽ ${p}pat2\n│➽ ${p}pickupline\n│➽ ${p}poke2\n│➽ ${p}prog\n│➽ ${p}progquote\n│➽ ${p}pubg\n│➽ ${p}quotes\n│➽ ${p}rate\n│➽ ${p}respect\n│➽ ${p}roast\n│➽ ${p}rpsls\n│➽ ${p}sciencefact\n│➽ ${p}ship\n│➽ ${p}simp\n│➽ ${p}slap2\n│➽ ${p}stupidcheck\n│➽ ${p}tickle2\n│➽ ${p}trivia\n│➽ ${p}triviafact\n│➽ ${p}truth\n│➽ ${p}truthdetector\n│➽ ${p}truthordare\n│➽ ${p}warningsign\n│➽ ${p}wave\n│➽ ${p}wave2\n│➽ ${p}wink\n│➽ ${p}wyr\n│➽ ${p}xxqc\n│➽ ${p}yeet2\n┗▣ \n\n`;
  // GAMES MENU
  out += `┏▣ ◈ *GAMES MENU* ◈\n│➽ ${p}battle\n│➽ ${p}coin\n│➽ ${p}connect4\n│➽ ${p}delttt\n│➽ ${p}dice\n│➽ ${p}fasttype\n│➽ ${p}footballquiz\n│➽ ${p}guess\n│➽ ${p}hangman\n│➽ ${p}luck\n│➽ ${p}math\n│➽ ${p}memory\n│➽ ${p}nhie\n│➽ ${p}numbattle\n│➽ ${p}quest\n│➽ ${p}quiz\n│➽ ${p}riddle\n│➽ ${p}rps\n│➽ ${p}scramble\n│➽ ${p}survive\n│➽ ${p}ttt\n│➽ ${p}wcg\n│➽ ${p}whoami\n│➽ ${p}wordle\n│➽ ${p}wyr2\n┗▣ \n\n`;
  // GROUP MENU
  out += `┏▣ ◈ *GROUP MENU* ◈\n│➽ ${p}add\n│➽ ${p}addcode\n│➽ ${p}addmem\n│➽ ${p}afk\n│➽ ${p}akick\n│➽ ${p}allow\n│➽ ${p}announcements\n│➽ ${p}antibadword\n│➽ ${p}antibeg\n│➽ ${p}antibot\n│➽ ${p}antibotall\n│➽ ${p}antich\n│➽ ${p}antidemote\n│➽ ${p}antiforeign\n│➽ ${p}antigroupmention\n│➽ ${p}antigroupstatus\n│➽ ${p}antilink\n│➽ ${p}antilinkall\n│➽ ${p}antilinkgc\n│➽ ${p}antilm\n│➽ ${p}antimm\n│➽ ${p}antispam\n│➽ ${p}antitag\n│➽ ${p}antitagadmin\n│➽ ${p}antitts\n│➽ ${p}antiword\n│➽ ${p}approveall\n│➽ ${p}autogreet\n│➽ ${p}broadcast\n│➽ ${p}cancelkick\n│➽ ${p}close\n│➽ ${p}closetime\n│➽ ${p}creategc\n│➽ ${p}delallowed\n│➽ ${p}delcode\n│➽ ${p}delppgroup\n│➽ ${p}demote\n│➽ ${p}disapproveall\n│➽ ${p}dismiss\n│➽ ${p}dismissreply\n│➽ ${p}dmrelay\n│➽ ${p}editsettings\n│➽ ${p}everyone\n│➽ ${p}fetchgroups\n│➽ ${p}flaguser\n│➽ ${p}gcsettings\n│➽ ${p}getgrouppp\n│➽ ${p}ginfo\n│➽ ${p}goodbye\n│➽ ${p}hiauto\n│➽ ${p}hidetag\n│➽ ${p}invite\n│➽ ${p}kick\n│➽ ${p}kickadmins\n│➽ ${p}kickall\n│➽ ${p}kickinactive\n│➽ ${p}kickr\n│➽ ${p}link\n│➽ ${p}listactive\n│➽ ${p}listallowed\n│➽ ${p}listcode\n│➽ ${p}listinactive\n│➽ ${p}listrequests\n│➽ ${p}lock\n│➽ ${p}logouts\n│➽ ${p}mediaonly\n│➽ ${p}mediatag\n│➽ ${p}mentioncap\n│➽ ${p}msg-react\n│➽ ${p}msgr\n│➽ ${p}msgs\n│➽ ${p}muteuser\n│➽ ${p}notice\n│➽ ${p}open\n│➽ ${p}opentime\n│➽ ${p}others\n│➽ ${p}pause\n│➽ ${p}phoneguard\n│➽ ${p}poll\n│➽ ${p}promote\n│➽ ${p}react-ch\n│➽ ${p}resetlink\n│➽ ${p}resetrule\n│➽ ${p}rules\n│➽ ${p}savecontact\n│➽ ${p}sendgrouptag\n│➽ ${p}setdesc\n│➽ ${p}setgoodbyeimage\n│➽ ${p}setgoodbyevideo\n│➽ ${p}setgroupname\n│➽ ${p}setppgroup\n│➽ ${p}setrule\n│➽ ${p}setwelcome\n│➽ ${p}setwelcomeimage\n│➽ ${p}setwelcomevideo\n│➽ ${p}showgoodbye\n│➽ ${p}showwelcome\n│➽ ${p}spamtag\n│➽ ${p}tagadmin\n│➽ ${p}tagadminall\n│➽ ${p}testgoodbye\n│➽ ${p}testwelcome\n│➽ ${p}textmode\n│➽ ${p}tkick\n│➽ ${p}tosgroup\n│➽ ${p}totalmembers\n│➽ ${p}unban\n│➽ ${p}unlock\n│➽ ${p}unmuteuser\n│➽ ${p}unpause\n│➽ ${p}userid\n│➽ ${p}vcf\n│➽ ${p}voicemode\n│➽ ${p}warn\n│➽ ${p}welcome\n┗▣ \n\n`;
  // IMAGE MENU
  out += `┏▣ ◈ *IMAGE MENU* ◈\n│➽ ${p}carbon\n│➽ ${p}invert\n│➽ ${p}jail\n│➽ ${p}mnm\n│➽ ${p}naturewlp\n│➽ ${p}rainbow\n│➽ ${p}remini\n│➽ ${p}rip-meme\n│➽ ${p}trigger-meme\n│➽ ${p}wallpaper\n│➽ ${p}wanted\n│➽ ${p}wasted\n┗▣ \n\n`;
  // LOGO MENU
  out += `┏▣ ◈ *LOGO MENU* ◈\n│➽ ${p}gfx\n│➽ ${p}gfx10\n│➽ ${p}gfx11\n│➽ ${p}gfx12\n│➽ ${p}gfx2\n│➽ ${p}gfx3\n│➽ ${p}gfx4\n│➽ ${p}gfx5\n│➽ ${p}gfx6\n│➽ ${p}gfx7\n│➽ ${p}gfx8\n│➽ ${p}gfx9\n┗▣ \n\n`;
  // OTHERS MENU
  out += `┏▣ ◈ *OTHERS MENU* ◈\n│➽ ${p}alive\n│➽ ${p}botstatus\n│➽ ${p}pair\n│➽ ${p}ping\n│➽ ${p}ping2\n│➽ ${p}repo\n│➽ ${p}time\n│➽ ${p}uptime\n┗▣ \n\n`;
  // OWNER MENU
  out += `┏▣ ◈ *OWNER MENU* ◈\n│➽ ${p}aza\n│➽ ${p}banlist\n│➽ ${p}block\n│➽ ${p}buy-panel\n│➽ ${p}delete\n│➽ ${p}deljunk\n│➽ ${p}delstickercmd\n│➽ ${p}disk\n│➽ ${p}dlvo\n│➽ ${p}gcaddprivacy\n│➽ ${p}groupid\n│➽ ${p}install\n│➽ ${p}join\n│➽ ${p}leave\n│➽ ${p}listbadword\n│➽ ${p}listblocked\n│➽ ${p}listignorelist\n│➽ ${p}listsudo\n│➽ ${p}logout\n│➽ ${p}modestatus\n│➽ ${p}owner\n│➽ ${p}ppprivacy\n│➽ ${p}react\n│➽ ${p}readreceipts\n│➽ ${p}reboot\n│➽ ${p}restart\n│➽ ${p}setaza\n│➽ ${p}setprofilepic\n│➽ ${p}setstickercmd\n│➽ ${p}startupmsg\n│➽ ${p}tcfix\n│➽ ${p}tostatus\n│➽ ${p}toviewonce\n│➽ ${p}unblockall\n│➽ ${p}uninstall\n│➽ ${p}update\n┗▣ \n\n`;
  // RELIGION MENU
  out += `┏▣ ◈ *RELIGION MENU* ◈\n│➽ ${p}bible\n│➽ ${p}praytime\n│➽ ${p}quran\n┗▣ \n\n`;
  // SEARCH MENU
  out += `┏▣ ◈ *SEARCH MENU* ◈\n│➽ ${p}book\n│➽ ${p}define\n│➽ ${p}define2\n│➽ ${p}element\n│➽ ${p}imdb\n│➽ ${p}lyrics\n│➽ ${p}namemeaning\n│➽ ${p}npm\n│➽ ${p}shazam\n│➽ ${p}songscan\n│➽ ${p}tiktoksearch\n│➽ ${p}weather\n│➽ ${p}websearch\n│➽ ${p}whatis\n│➽ ${p}wiki\n│➽ ${p}yts\n┗▣ \n\n`;
  // SETTINGS MENU
  out += `┏▣ ◈ *SETTINGS MENU* ◈\n│➽ ${p}addbadword\n│➽ ${p}addcountrycode\n│➽ ${p}addignorelist\n│➽ ${p}addmenuimage\n│➽ ${p}addmenuvideo\n│➽ ${p}addsudo\n│➽ ${p}allvar\n│➽ ${p}alwaysonline\n│➽ ${p}antiaudio\n│➽ ${p}antibug\n│➽ ${p}anticall\n│➽ ${p}antichannelpost\n│➽ ${p}anticontact\n│➽ ${p}antidelete\n│➽ ${p}antideletestatus\n│➽ ${p}antidocument\n│➽ ${p}antiedit\n│➽ ${p}antiforward\n│➽ ${p}antigif\n│➽ ${p}antiimage\n│➽ ${p}antilocation\n│➽ ${p}antimessage\n│➽ ${p}antipoll\n│➽ ${p}antireaction\n│➽ ${p}antisticker\n│➽ ${p}antivideo\n│➽ ${p}antiviewonce\n│➽ ${p}antivoice\n│➽ ${p}approve\n│➽ ${p}autobio\n│➽ ${p}autoblock\n│➽ ${p}autoreact\n│➽ ${p}autoreactstatus\n│➽ ${p}autoread\n│➽ ${p}autorecord\n│➽ ${p}autorecordtyping\n│➽ ${p}autosaverepliedstatus\n│➽ ${p}autosavestatus\n│➽ ${p}autosend\n│➽ ${p}autotype\n│➽ ${p}autoviewstatus\n│➽ ${p}blocklist\n│➽ ${p}chr\n│➽ ${p}clearmenuimages\n│➽ ${p}clearmenuvideos\n│➽ ${p}delanticallmsg\n│➽ ${p}delcountrycode\n│➽ ${p}deletebadword\n│➽ ${p}delgfilter\n│➽ ${p}delgoodbye\n│➽ ${p}delignorelist\n│➽ ${p}delpfilter\n│➽ ${p}delsudo\n│➽ ${p}delvar\n│➽ ${p}delwelcome\n│➽ ${p}disable\n│➽ ${p}enable\n│➽ ${p}forward\n│➽ ${p}getid\n│➽ ${p}getsettings\n│➽ ${p}getvar\n│➽ ${p}gfilter\n│➽ ${p}groupaddprivacy\n│➽ ${p}lastseen\n│➽ ${p}listcountrycode\n│➽ ${p}listdisabled\n│➽ ${p}listgfilter\n│➽ ${p}listpfilter\n│➽ ${p}listwarn\n│➽ ${p}menustyle\n│➽ ${p}mode\n│➽ ${p}mute\n│➽ ${p}mutelist\n│➽ ${p}mypp\n│➽ ${p}mystatus\n│➽ ${p}onlineprivacy\n│➽ ${p}pfilter\n│➽ ${p}readprivacy\n│➽ ${p}reject\n│➽ ${p}removepp\n│➽ ${p}resetaza\n│➽ ${p}resetsetting\n│➽ ${p}resetwarn\n│➽ ${p}set\n│➽ ${p}setalive\n│➽ ${p}setanticallmsg\n│➽ ${p}setbio\n│➽ ${p}setbotname\n│➽ ${p}setcontextlink\n│➽ ${p}setfont\n│➽ ${p}setgoodbye\n│➽ ${p}setmenuimage\n│➽ ${p}setmenuvideo\n│➽ ${p}setname\n│➽ ${p}setownername\n│➽ ${p}setownernumber\n│➽ ${p}setprefix\n│➽ ${p}setstatusemoji\n│➽ ${p}setstickerauthor\n│➽ ${p}setstickerpackname\n│➽ ${p}settimezone\n│➽ ${p}setvar\n│➽ ${p}setwarn\n│➽ ${p}setwatermark\n│➽ ${p}showanticallmsg\n│➽ ${p}systemstatus\n│➽ ${p}testanticallmsg\n│➽ ${p}unblock\n│➽ ${p}unmute\n┗▣ \n\n`;
  // SPORTS MENU
  out += `┏▣ ◈ *SPORTS MENU* ◈\n│➽ ${p}blmatches\n│➽ ${p}blscorers\n│➽ ${p}blstandings\n│➽ ${p}blupcoming\n│➽ ${p}clmatches\n│➽ ${p}clscorers\n│➽ ${p}clstandings\n│➽ ${p}clupcoming\n│➽ ${p}eflmatches\n│➽ ${p}eflscorers\n│➽ ${p}eflstandings\n│➽ ${p}eflupcoming\n│➽ ${p}elmatches\n│➽ ${p}elscorers\n│➽ ${p}elstandings\n│➽ ${p}elupcoming\n│➽ ${p}eplmatches\n│➽ ${p}eplscorers\n│➽ ${p}eplstandings\n│➽ ${p}eplupcoming\n│➽ ${p}l1matches\n│➽ ${p}l1scorers\n│➽ ${p}l1standings\n│➽ ${p}l1upcoming\n│➽ ${p}llmatches\n│➽ ${p}llscorers\n│➽ ${p}llstandings\n│➽ ${p}llupcoming\n│➽ ${p}matches\n│➽ ${p}samatches\n│➽ ${p}sascorers\n│➽ ${p}sastandings\n│➽ ${p}saupcoming\n│➽ ${p}scorers\n│➽ ${p}sportsnews\n│➽ ${p}standings\n│➽ ${p}upcoming\n│➽ ${p}wcmatches\n│➽ ${p}wcscorers\n│➽ ${p}wcstandings\n│➽ ${p}wcupcoming\n│➽ ${p}wrestlingevents\n│➽ ${p}wwenews\n│➽ ${p}wweschedule\n┗▣ \n\n`;
  // SUPPORT MENU
  out += `┏▣ ◈ *SUPPORT MENU* ◈\n│➽ ${p}feedback\n│➽ ${p}helpers\n┗▣ \n\n`;
  // TOOLS MENU
  out += `┏▣ ◈ *TOOLS MENU* ◈\n│➽ ${p}addnote\n│➽ ${p}akiyama\n│➽ ${p}anagram\n│➽ ${p}base64\n│➽ ${p}bmi\n│➽ ${p}browse\n│➽ ${p}calculate\n│➽ ${p}catbox\n│➽ ${p}channelid\n│➽ ${p}circlestk\n│➽ ${p}cmdsearch\n│➽ ${p}color\n│➽ ${p}compress\n│➽ ${p}countdown\n│➽ ${p}currency\n│➽ ${p}delallnotes\n│➽ ${p}delcmd\n│➽ ${p}delcmds\n│➽ ${p}delmail\n│➽ ${p}delnote\n│➽ ${p}device\n│➽ ${p}dice2\n│➽ ${p}dns\n│➽ ${p}doc\n│➽ ${p}emojimix\n│➽ ${p}fakeaddress\n│➽ ${p}fakecard\n│➽ ${p}fakeperson\n│➽ ${p}fancy\n│➽ ${p}features\n│➽ ${p}ffstalk\n│➽ ${p}filtervcf\n│➽ ${p}fliptext\n│➽ ${p}genpass\n│➽ ${p}genusername\n│➽ ${p}getabout\n│➽ ${p}getnote\n│➽ ${p}getnotes\n│➽ ${p}getpp\n│➽ ${p}github\n│➽ ${p}glink\n│➽ ${p}gsmarena\n│➽ ${p}hash\n│➽ ${p}imgbb\n│➽ ${p}jid\n│➽ ${p}jsonformat\n│➽ ${p}listcmd\n│➽ ${p}myip\n│➽ ${p}namegen\n│➽ ${p}ngl\n│➽ ${p}obfuscate\n│➽ ${p}ocr\n│➽ ${p}pasteboard\n│➽ ${p}permit\n│➽ ${p}photo\n│➽ ${p}pixhost\n│➽ ${p}pollmulti\n│➽ ${p}qc\n│➽ ${p}qrcode\n│➽ ${p}readmail\n│➽ ${p}readmore\n│➽ ${p}readqr\n│➽ ${p}receipt\n│➽ ${p}remind\n│➽ ${p}removebg\n│➽ ${p}roman\n│➽ ${p}roundstk\n│➽ ${p}runeval\n│➽ ${p}say\n│➽ ${p}sendasviewonce\n│➽ ${p}setcmd\n│➽ ${p}shorten\n│➽ ${p}sitecheck\n│➽ ${p}smeme\n│➽ ${p}split\n│➽ ${p}ssfull\n│➽ ${p}ssphone\n│➽ ${p}ssweb\n│➽ ${p}sswebpc\n│➽ ${p}sswebtab\n│➽ ${p}statusdelay\n│➽ ${p}statussettings\n│➽ ${p}take\n│➽ ${p}telesticker\n│➽ ${p}tempinbox\n│➽ ${p}tempmail\n│➽ ${p}tempmailhelp\n│➽ ${p}texttopdf\n│➽ ${p}tgstickers\n│➽ ${p}tinyurl\n│➽ ${p}tip\n│➽ ${p}toimage\n│➽ ${p}tourl\n│➽ ${p}trackip\n│➽ ${p}translate\n│➽ ${p}twaudio\n│➽ ${p}unit\n│➽ ${p}updatenote\n│➽ ${p}vcc\n│➽ ${p}vv2\n│➽ ${p}wc\n│➽ ${p}whois\n┗▣ \n\n`;
  // VIDEO MENU
  out += `┏▣ ◈ *VIDEO MENU* ◈\n│➽ ${p}toaudio\n│➽ ${p}tovideo\n│➽ ${p}volvideo\n│➽ ${p}webp2mp4\n┗▣ \n\n`;
  out += `> *Powered by Yobby King*\n> *Instagram: @yobby_mking*`;
  return out;
}

function buildAlive() {
  return `*SNUGGLE X IS ALIVE ✅*
> snuggle x bot
> owner: ${getOwnerName()}
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
    defaultQueryTimeoutMs: 60000,
    connectTimeoutMs: 30000,
    keepAliveIntervalMs: 20000,
  });

  sock.ev.on('creds.update', saveCreds);

  // === Channel forwarding wrapper — adds contextInfo to ALL messages ===
  // .menu is excluded (no contact card on menu, but channel forwarding still applies)
  // All other replies get channel forwarding + contact card (in groups)
  let isMenuCommand = false;
  const _origSend = sock.sendMessage.bind(sock);
  sock.sendMessage = async function(jid, content, opts = {}) {
    // Add channel forwarding to ALL messages
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

      // Self-chat detection
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

      // For non-menu commands, use contact card as quoted in groups
      const isMenuCmd = (cmd === `${prefix}menu` || (prefix && lower === 'menu'));
      const fakeContact = createFakeContact(ownerNumber, getOwnerName());
      // .menu: NO contact card (just plain message)
      // All other commands: contact card as quoted in groups
      const quotedMsg = isGroup ? (isMenuCmd ? m : fakeContact) : undefined;

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
      if (isMenuCmd) {
        // .menu: NO contact card, just the menu text with readmore
        const menuText = buildMenu();
        try {
          await sock.sendMessage(chatId, { text: menuText });
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

      if (cmd === `${prefix}alive`) { await sock.sendMessage(chatId, { text: buildAlive() }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}help`) { await sock.sendMessage(chatId, { text: `Type *${prefix}menu* for the menu.` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}owner`) { await sock.sendMessage(chatId, { text: buildOwner() }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}whoami`) { await sock.sendMessage(chatId, { text: `*You are* ${m.pushName || 'User'}\n*Status:* ${ownerCheck ? 'Owner 👑' : sudoCheck ? 'Sudo 🔑' : 'User'}` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}repo`) { await sock.sendMessage(chatId, { text: `📦 GitHub: https://github.com/yobbyking/snuggle-bot-fresh` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}uptime`) { await sock.sendMessage(chatId, { text: `⏱️ Uptime: ${formatUptime(process.uptime())}` }, { quoted: quotedMsg }); return; }
      if (cmd === `${prefix}time`) { await sock.sendMessage(chatId, { text: `🕐 ${new Date().toLocaleString()}` }, { quoted: quotedMsg }); return; }

      // === Sticker ===
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

      // === URL upload ===
      if (cmd === `${prefix}url`) {
        let hasMedia = msg.imageMessage || msg.videoMessage || msg.audioMessage || msg.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        if (!hasMedia) { await sock.sendMessage(chatId, { text: 'Send/reply to media with .url' }, { quoted: quotedMsg }); return; }
        try {
          let targetMsg = m;
          if (!msg.imageMessage && !msg.videoMessage && !msg.audioMessage) {
            const q = msg.extendedTextMessage.contextInfo.quotedMessage;
            targetMsg = { key: { remoteJid: chatId, id: msg.extendedTextMessage.contextInfo.stanzaId, participant: msg.extendedTextMessage.contextInfo.participant }, message: q };
          }
          const buf = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: P({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
          const FormData = require('form-data');
          const axios = require('axios');
          const form = new FormData();
          form.append('file', Buffer.from(buf), 'upload.bin');
          const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, { headers: form.getHeaders(), timeout: 60000 });
          const url = res.data?.data?.url?.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          await sock.sendMessage(chatId, { text: `✅ *URL:*\n${url}` }, { quoted: quotedMsg });
        } catch (e) { await sock.sendMessage(chatId, { text: `❌ Failed: ${e.message}` }, { quoted: quotedMsg }); }
        return;
      }

      // === ACCESS GATE ===
      if (!ownerCheck && !sudoCheck) {
        if (cmd.startsWith(prefix)) {
          await sock.sendMessage(chatId, { text: `> *only sudo access 🚫*\n> Get yours 0181163563 ✅` }, { quoted: quotedMsg });
        }
        return;
      }

      // === OWNER/SUDO COMMANDS ===
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

        case `${prefix}delsudo`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          const delNum = args[0]?.replace(/[^0-9]/g, '');
          if (!delNum) { await sock.sendMessage(chatId, { text: 'Usage: .delsudo <number>' }, { quoted: quotedMsg }); break; }
          db.prepare('DELETE FROM sudos WHERE number=?').run(delNum);
          await sock.sendMessage(chatId, { text: `✅ Removed ${delNum}` }, { quoted: quotedMsg });
          break;

        case `${prefix}sudolist`:
          const sudos = db.prepare('SELECT number FROM sudos').all().map(r => r.number);
          await sock.sendMessage(chatId, { text: `*Sudo users (${sudos.length}):*\n${sudos.length > 0 ? sudos.map(x => '• ' + x).join('\n') : 'None'}` }, { quoted: quotedMsg });
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

        case `${prefix}hidetag`: {
          if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; }
          try {
            const meta = await sock.groupMetadata(chatId);
            const mentions = meta.participants.map(p => p.id);
            await sock.sendMessage(chatId, { text: argText || '👥', mentions });
          } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}promote`: {
          if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; }
          const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
          if (!target) { await sock.sendMessage(chatId, { text: 'Mention a user' }, { quoted: quotedMsg }); break; }
          try { await sock.groupParticipantsUpdate(chatId, [target], 'promote'); await sock.sendMessage(chatId, { text: `✅ Promoted @${target.split('@')[0]}`, mentions: [target] }, { quoted: quotedMsg }); }
          catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}demote`: {
          if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; }
          const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
          if (!target) { await sock.sendMessage(chatId, { text: 'Mention a user' }, { quoted: quotedMsg }); break; }
          try { await sock.groupParticipantsUpdate(chatId, [target], 'demote'); await sock.sendMessage(chatId, { text: `✅ Demoted @${target.split('@')[0]}`, mentions: [target] }, { quoted: quotedMsg }); }
          catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}kick`: {
          if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; }
          const target = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
          if (!target) { await sock.sendMessage(chatId, { text: 'Mention a user' }, { quoted: quotedMsg }); break; }
          try { await sock.groupParticipantsUpdate(chatId, [target], 'remove'); await sock.sendMessage(chatId, { text: `✅ Kicked @${target.split('@')[0]}`, mentions: [target] }, { quoted: quotedMsg }); }
          catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
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
            const key = getGeminiKey();
            if (!key) { await sock.sendMessage(chatId, { text: '❌ Set Gemini API key: .setgeminikey <key>' }, { quoted: quotedMsg }); break; }
            const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, { contents: [{ parts: [{ text: `You are Snuggle X, a helpful WhatsApp bot. Reply concisely. User: ${question}` }] }] }, { timeout: 30000, headers: { 'Content-Type': 'application/json' } });
            const aiText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (aiText) await sock.sendMessage(chatId, { text: aiText.trim() }, { quoted: quotedMsg });
            else await sock.sendMessage(chatId, { text: '❌ AI did not respond' }, { quoted: quotedMsg });
          } catch (e) { await sock.sendMessage(chatId, { text: `❌ AI error: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}setgeminikey`:
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setgeminikey <key>' }, { quoted: quotedMsg }); break; }
          dbSet('geminiKey', argText.trim());
          await sock.sendMessage(chatId, { text: '✅ Gemini API key set' }, { quoted: quotedMsg });
          break;

        case `${prefix}8ball`: {
          const answers = ['It is certain.', 'Without a doubt.', 'Yes definitely.', 'You may rely on it.', 'Most likely.', 'Yes.', 'Signs point to yes.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Dont count on it.', 'My reply is no.', 'Very doubtful.'];
          await sock.sendMessage(chatId, { text: `🎱 ${answers[Math.floor(Math.random() * answers.length)]}` }, { quoted: quotedMsg });
          break;
        }

        case `${prefix}truth`: {
          const truths = ['What is your biggest fear?', 'What is the most embarrassing thing that happened to you?', 'What is your biggest secret?', 'Who is your crush?', 'What is the worst thing you have ever done?'];
          await sock.sendMessage(chatId, { text: `🤔 *Truth:* ${truths[Math.floor(Math.random() * truths.length)]}` }, { quoted: quotedMsg });
          break;
        }

        case `${prefix}dare`: {
          const dares = ['Send a voice note singing a song.', 'Send your last screenshot.', 'Send a selfie right now.', 'Text the first person in your contacts "I love you".'];
          await sock.sendMessage(chatId, { text: `😈 *Dare:* ${dares[Math.floor(Math.random() * dares.length)]}` }, { quoted: quotedMsg });
          break;
        }

        case `${prefix}joke`: {
          try {
            const axios = require('axios');
            const res = await axios.get('https://v2.jokeapi.dev/joke/Any?safe-mode&type=single', { timeout: 10000 });
            await sock.sendMessage(chatId, { text: `😂 ${res.data.joke}` }, { quoted: quotedMsg });
          } catch { await sock.sendMessage(chatId, { text: '😂 Why dont programmers like nature? It has too many bugs.' }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}flip`: {
          const result = Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙';
          await sock.sendMessage(chatId, { text: `🪙 *Coin Flip*\n\n${result}` }, { quoted: quotedMsg });
          break;
        }

        case `${prefix}dice`: {
          const sides = parseInt(args[0]) || 6;
          const result = Math.floor(Math.random() * sides) + 1;
          await sock.sendMessage(chatId, { text: `🎲 *Dice (d${sides})*\n\nYou rolled: ${result}` }, { quoted: quotedMsg });
          break;
        }

        case `${prefix}uuid`: {
          const uuid = require('crypto').randomUUID();
          await sock.sendMessage(chatId, { text: `🆔 *UUID*\n\n${uuid}` }, { quoted: quotedMsg });
          break;
        }

        case `${prefix}pass`: {
          const len = parseInt(args[0]) || 12;
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
          let pass = '';
          for (let i = 0; i < Math.min(len, 50); i++) pass += chars[Math.floor(Math.random() * chars.length)];
          await sock.sendMessage(chatId, { text: `🔐 *Random Password*\n\n${pass}` }, { quoted: quotedMsg });
          break;
        }

        case `${prefix}block`: {
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          const target = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
          if (!target) { await sock.sendMessage(chatId, { text: 'Usage: .block <number>' }, { quoted: quotedMsg }); break; }
          try { await sock.updateBlockStatus(target, 'block'); await sock.sendMessage(chatId, { text: `✅ Blocked ${target.split('@')[0]}` }, { quoted: quotedMsg }); }
          catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}unblock`: {
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          const target = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
          if (!target) { await sock.sendMessage(chatId, { text: 'Usage: .unblock <number>' }, { quoted: quotedMsg }); break; }
          try { await sock.updateBlockStatus(target, 'unblock'); await sock.sendMessage(chatId, { text: `✅ Unblocked ${target.split('@')[0]}` }, { quoted: quotedMsg }); }
          catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}setbio`: {
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setbio <text>' }, { quoted: quotedMsg }); break; }
          try { await sock.updateProfileStatus(argText); await sock.sendMessage(chatId, { text: '✅ Bio updated' }, { quoted: quotedMsg }); }
          catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}setname`: {
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          if (!argText) { await sock.sendMessage(chatId, { text: 'Usage: .setname <name>' }, { quoted: quotedMsg }); break; }
          try { await sock.updateProfileName(argText); await sock.sendMessage(chatId, { text: `✅ Name updated` }, { quoted: quotedMsg }); }
          catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}grouplink`: case `${prefix}link`: {
          if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; }
          try {
            const code = await sock.groupInviteCode(chatId);
            await sock.sendMessage(chatId, { text: `🔗 *Group Link:*\nhttps://chat.whatsapp.com/${code}` }, { quoted: quotedMsg });
          } catch (e) { await sock.sendMessage(chatId, { text: `Failed: ${e.message}` }, { quoted: quotedMsg }); }
          break;
        }

        case `${prefix}leave`: {
          if (!ownerCheck) { await sock.sendMessage(chatId, { text: '> *only owner* 🚫' }, { quoted: quotedMsg }); break; }
          if (!isGroup) { await sock.sendMessage(chatId, { text: 'Group only' }, { quoted: quotedMsg }); break; }
          await sock.sendMessage(chatId, { text: '👋 Goodbye!' }, { quoted: quotedMsg });
          await sock.groupLeave(chatId);
          break;
        }

        default:
          if (cmd.startsWith(prefix)) {
            await sock.sendMessage(chatId, { text: `Unknown: ${cmd}\nType *${prefix}menu* for commands.` }, { quoted: quotedMsg });
          }
      }
    } catch (e) { console.error('[MSG error]', e.message); }
  });

  // === Call handler ===
  sock.ev.on('call', async (calls) => {
    try { for (const call of calls) { await sock.rejectCall(call.id, call.from); } } catch {}
  });
}

start().catch(console.error);
