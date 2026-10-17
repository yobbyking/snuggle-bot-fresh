/**
 * createFakeContact.js — Fake contact card for .menu and other replies
 * Shows: 🚫𝔖𝔫𝔲g𝔤𝔩𝔢 𝔵☠️, yobby developer pro, owner number, URLs, bio
 */

const BOT_NAME = '🚫𝔖𝔫𝔲g𝔤𝔩𝔢 𝔵☠️';
const PAIRING_URL = 'https://pair-snugglex.onrender.com/';
const GITHUB_URL = 'https://github.com/yobbyking/snuggle-bot-fresh';

function createFakeContact(ownerNumber, ownerName) {
  const cleanNumber = String(ownerNumber || '0').replace(/[^\d]/g, '') || '0';
  const displayName = BOT_NAME;
  const ownerDisplay = (ownerName && ownerName !== 'Not Set!') ? ownerName : 'Yobby King';

  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${displayName};Bot;;;`,
    `FN:${displayName}`,
    `ORG:yobby developer pro`,
    `TITLE:WhatsApp Bot`,
    `TEL;type=CELL;waid=${cleanNumber}:${cleanNumber}`,
    `URL;type=Pairing:${PAIRING_URL}`,
    `URL;type=GitHub:${GITHUB_URL}`,
    `NOTE:Developed by yobby_mking — Owner: ${ownerDisplay}. Tap the number above to chat with the owner. Instagram: @yobby_mking`,
    'END:VCARD',
  ].join('\n');

  return {
    key: {
      participants: '0@s.whatsapp.net',
      remoteJid: '0@s.whatsapp.net',
      fromMe: false,
      id: 'SNUGGX' + Math.random().toString(36).substring(2, 12).toUpperCase(),
    },
    message: {
      contactMessage: {
        displayName,
        vcard,
      },
    },
    participant: '0@s.whatsapp.net',
  };
}

module.exports = { createFakeContact };
