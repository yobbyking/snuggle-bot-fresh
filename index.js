/**
 * SNUGGLE X BOT — index.js (entry point)
 * 
 * Deploy on Railway or Render:
 *   1. Set env var SESSION_ID = yobbyx:~<your-session-id>
 *   2. Bot auto-decodes the session, writes files, and connects
 * 
 * The SESSION_ID format: yobbyx:~<12-hex-chars>
 * The 12-hex-chars is a short ID that maps to a gzipped session on the VPS.
 * 
 * For direct deployment (without VPS), you can also set:
 *   SESSION_ID = base64-encoded-gzipped-session (old format)
 *   or
 *   SESSION_ID = yobbyx:~<12-hex-chars> (short format, fetched from VPS)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const axios = require('axios');
const { execSync } = require('child_process');

const SESSION_DIR = path.join(__dirname, 'session');
const VPS_DASHBOARD = process.env.VPS_DASHBOARD || 'http://maglev.proxy.rlwy.net:13558';
const VPS_PASS = process.env.VPS_PASS || 'yobby1';

// === Ensure yt-dlp and ffmpeg are installed (for .song/.video) ===
function ensureDeps() {
  try { execSync('which yt-dlp', { stdio: 'ignore' }); } catch {
    console.log('[Setup] Installing yt-dlp...');
    try { execSync('pip3 install yt-dlp --break-system-packages', { stdio: 'inherit' }); } catch {}
  }
  try { execSync('which ffmpeg', { stdio: 'ignore' }); } catch {
    console.log('[Setup] Installing ffmpeg...');
    try { execSync('apt-get update && apt-get install -y ffmpeg', { stdio: 'inherit' }); } catch {}
  }
}

// === Decode session ID and write session files ===
async function decodeSession(sessionId) {
  if (!sessionId) {
    console.error('❌ SESSION_ID env var not set!');
    console.error('   Set it to: yobbyx:~<12-hex-chars> (from pairing site)');
    process.exit(1);
  }

  if (!sessionId.startsWith('yobbyx:~')) {
    console.error('❌ Invalid SESSION_ID format. Must start with yobbyx:~');
    process.exit(1);
  }

  const b64 = sessionId.replace(/^yobbyx:~/, '');
  let sessionB64 = null;

  // Check if it's a 12-hex short ID
  if (/^[a-f0-9]{12}$/.test(b64)) {
    console.log(`[Session] Short ID detected: ${b64}`);
    console.log(`[Session] Fetching from VPS dashboard...`);
    
    // Try VPS dashboard first
    try {
      const loginRes = await axios.post(`${VPS_DASHBOARD}/api/login`, { password: VPS_PASS }, { timeout: 15000 });
      const token = loginRes.data.token;
      // The dashboard doesn't have a direct "get session" endpoint, but the session is stored in session-store/
      // We need to fetch it — the deploy endpoint does this, but we just want the session data
      // Try fetching from the Render pairing site as fallback
      const PAIRING_URL = process.env.PAIRING_URL || 'https://pair-snugglex.onrender.com';
      const fetchRes = await axios.get(`${PAIRING_URL}/api/session/${b64}`, { timeout: 30000 });
      if (fetchRes.data?.session) {
        sessionB64 = fetchRes.data.session;
        console.log('[Session] ✅ Session fetched from Render');
      }
    } catch (e) {
      console.log('[Session] Render fetch failed:', e.message);
    }

    // If still not found, try VPS session-store directly (if we're on the VPS)
    if (!sessionB64) {
      const sessionFile = `/root/snuggle-x/session-store/${b64}.json`;
      if (fs.existsSync(sessionFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
          sessionB64 = data.session;
          console.log('[Session] ✅ Session found in VPS session-store');
        } catch (e) {
          console.log('[Session] VPS session-store read failed:', e.message);
        }
      }
    }

    if (!sessionB64) {
      console.error('❌ Session not found or expired. Please re-pair to get a new session ID.');
      process.exit(1);
    }
  } else {
    // It's a full base64 session (old format)
    sessionB64 = b64;
    console.log('[Session] Full base64 session detected');
  }

  // Decode: base64 → gunzip → JSON → files
  try {
    console.log('[Session] Decoding session...');
    let standardB64 = sessionB64.replace(/-/g, '+').replace(/_/g, '/');
    standardB64 += '='.repeat((4 - standardB64.length % 4) % 4);
    
    const gzipped = Buffer.from(standardB64, 'base64');
    let jsonStr;
    try {
      jsonStr = zlib.gunzipSync(gzipped).toString('utf-8');
    } catch {
      // Not gzipped, try direct JSON
      jsonStr = Buffer.from(standardB64, 'base64').toString('utf-8');
    }
    
    const files = JSON.parse(jsonStr);
    console.log(`[Session] Found ${Object.keys(files).length} files`);

    // Write session files
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
    for (const [name, b64content] of Object.entries(files)) {
      const fp = path.join(SESSION_DIR, name);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, Buffer.from(b64content, 'base64'));
    }
    console.log('[Session] ✅ Session files written to ./session');
    
    // Verify creds.json exists
    if (fs.existsSync(path.join(SESSION_DIR, 'creds.json'))) {
      const creds = JSON.parse(fs.readFileSync(path.join(SESSION_DIR, 'creds.json'), 'utf-8'));
      console.log(`[Session] Owner: ${creds.me?.id || 'unknown'}`);
    }
  } catch (e) {
    console.error('❌ Failed to decode session:', e.message);
    process.exit(1);
  }
}

// === Main ===
(async () => {
  console.log('========================================');
  console.log('  SNUGGLE X BOT — Starting...');
  console.log('========================================');
  
  // Install yt-dlp + ffmpeg (for .song/.video)
  ensureDeps();
  
  // Decode session
  const sessionId = process.env.SESSION_ID;
  if (sessionId) {
    await decodeSession(sessionId);
  } else if (fs.existsSync(path.join(SESSION_DIR, 'creds.json'))) {
    console.log('[Session] SESSION_ID not set, but session files exist — using existing session');
  } else {
    console.error('❌ No SESSION_ID env var and no existing session files!');
    console.error('   Set SESSION_ID env var to: yobbyx:~<12-hex-chars>');
    process.exit(1);
  }
  
  // Start the bot
  console.log('[Bot] Starting bot...');
  require('./bot.js');
})();
