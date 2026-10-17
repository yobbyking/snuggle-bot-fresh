# Snuggle X Bot

Deploy on **Railway** or **Render** with just a `SESSION_ID` environment variable!

## 🚀 Deploy

### Railway
1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select this repo: `yobbyking/snuggle-bot-fresh`
3. Add environment variable:
   - `SESSION_ID` = `yobbyx:~your-session-id` (from pairing site)
4. Deploy! The bot auto-connects.

### Render
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect GitHub repo: `yobbyking/snuggle-bot-fresh`
3. Set:
   - Build Command: `npm install`
   - Start Command: `node index.js`
4. Add environment variable:
   - `SESSION_ID` = `yobbyx:~your-session-id`
5. Deploy!

## 🔑 Get Session ID
1. Go to https://pair-snugglex.onrender.com/
2. Enter your WhatsApp number
3. Pair with WhatsApp
4. Copy the session ID (`yobbyx:~xxxxxxxxxxxx`)

## ✨ Features
- ✅ CYPHER-X style menu with "Read more" (744 plugins listed)
- ✅ Channel forwarding on ALL replies (Snuggle X channel)
- ✅ Fake contact card on command replies (🚫𝔖𝔫𝔲g𝔤𝔩𝔢 𝔵☠️)
- ✅ SQLite for persistent settings
- ✅ Owner/sudo/user access control
- ✅ Works in DM and groups
- ✅ .song / .video (yt-dlp + ffmpeg)
- ✅ .sticker / .url
- ✅ .ai (Gemini AI)
- ✅ .tagall / .hidetag / .promote / .demote / .kick
- ✅ .calc / .qr / .uuid / .pass
- ✅ Anti-call

## 📋 Commands
### Public
- `.menu` — Main menu (CYPHER-X style, no contact card)
- `.all` — Full command list (with contact card)
- `.ping` — Latency check
- `.alive` — Bot status
- `.help` — Quick help

### Owner
- `.mode` — Change bot mode (public/private/silent/groups/dms)
- `.setprefix` — Set command prefix
- `.setownername` — Set owner name in menu
- `.addsudo` / `.delsudo` / `.sudolist` — Manage sudo users
- `.tagall` / `.hidetag` — Tag members
- `.promote` / `.demote` / `.kick` — Group admin
- `.song` / `.video` — YouTube download
- `.sticker` / `.url` — Media tools
- `.ai` — Gemini AI
- `.calc` / `.qr` / `.uuid` / `.pass` — Utilities
- `.block` / `.unblock` — Block users
- `.setbio` / `.setname` — Profile settings

## 🔧 Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_ID` | Yes | Session ID from pairing site (`yobbyx:~xxxxxxxxxxxx`) |
| `GEMINI_KEY` | No | Gemini API key for .ai command |
| `VPS_DASHBOARD` | No | VPS dashboard URL (default: auto) |
| `VPS_PASS` | No | VPS dashboard password (default: yobby1) |

## 📱 Channel
https://whatsapp.com/channel/0029Vb9NwdJ8KMqo8fRJZu3R

## 👨‍💻 Developer
- Instagram: @yobby_mking
- GitHub: yobbyking
