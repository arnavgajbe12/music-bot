/**
 * setupManager.js
 * Handles persistence for:
 *  - setup.json  → guild setup channel & permanent message IDs
 *  - settings.json → per-guild feature toggles (largeArt, autoplay, mode247)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SETUP_FILE = path.join(DATA_DIR, 'setup.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file) {
  ensureDir();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeJSON(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── Setup Channel ─────────────────────────────────────────────────────────────

/**
 * Save (or update) the setup panel for a guild.
 * @param {string} guildId
 * @param {string} channelId
 * @param {string} messageId
 */
function saveSetup(guildId, channelId, messageId) {
  const data = readJSON(SETUP_FILE);
  data[guildId] = { channelId, messageId };
  writeJSON(SETUP_FILE, data);
}

/**
 * Remove the setup panel entry for a guild.
 * @param {string} guildId
 */
function removeSetup(guildId) {
  const data = readJSON(SETUP_FILE);
  delete data[guildId];
  writeJSON(SETUP_FILE, data);
}

/**
 * Get the setup info for a guild.
 * @param {string} guildId
 * @returns {{ channelId: string, messageId: string } | null}
 */
function getSetup(guildId) {
  const data = readJSON(SETUP_FILE);
  return data[guildId] || null;
}

// ── Guild Settings ─────────────────────────────────────────────────────────────

const DEFAULTS = {
  largeArt: true,
  autoplay: false,
  mode247: false,
};

/**
 * Get the settings for a guild (with defaults).
 * @param {string} guildId
 * @returns {{ largeArt: boolean, autoplay: boolean, mode247: boolean }}
 */
function getSettings(guildId) {
  const data = readJSON(SETTINGS_FILE);
  return Object.assign({}, DEFAULTS, data[guildId] || {});
}

/**
 * Update one or more settings for a guild.
 * @param {string} guildId
 * @param {Partial<{ largeArt: boolean, autoplay: boolean, mode247: boolean }>} updates
 */
function updateSettings(guildId, updates) {
  const data = readJSON(SETTINGS_FILE);
  data[guildId] = Object.assign({}, DEFAULTS, data[guildId] || {}, updates);
  writeJSON(SETTINGS_FILE, data);
}

module.exports = { saveSetup, removeSetup, getSetup, getSettings, updateSettings };
