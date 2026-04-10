/**
 * setupManager.js
 * Handles persistence for:
 *  - setup.json    → guild setup channel & permanent message IDs
 *  - settings.json → per-guild feature toggles (largeArt, autoplay, mode247)
 *  - noprefix.json → users granted no-prefix access (with optional expiry)
 *  - prefix.json   → per-guild custom prefixes
 *
 * Performance: all reads are served from an in-memory cache that is populated
 * on first access. Writes use atomic rename (write to .tmp then rename) to
 * prevent JSON corruption if the process crashes mid-write.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SETUP_FILE = path.join(DATA_DIR, 'setup.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const NOPREFIX_FILE = path.join(DATA_DIR, 'noprefix.json');
const PREFIX_FILE = path.join(DATA_DIR, 'prefix.json');

// ── In-memory cache ───────────────────────────────────────────────────────────
// Each entry is { data: object, loaded: boolean }
const _cache = {
  [SETUP_FILE]: null,
  [SETTINGS_FILE]: null,
  [NOPREFIX_FILE]: null,
  [PREFIX_FILE]: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Read JSON from cache, loading from disk on first access.
 * All subsequent calls are served from memory — zero disk I/O.
 */
function readJSON(file) {
  if (_cache[file] !== null) return _cache[file];
  ensureDir();
  if (!fs.existsSync(file)) {
    _cache[file] = {};
    return _cache[file];
  }
  try {
    _cache[file] = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    _cache[file] = {};
  }
  return _cache[file];
}

/**
 * Persist JSON to disk using atomic write (tmp → rename) to prevent corruption.
 * The in-memory cache is updated synchronously; the disk write is async.
 */
function writeJSON(file, data) {
  _cache[file] = data;
  ensureDir();
  const tmp = file + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error(`[setupManager] Failed to write ${path.basename(file)}:`, err);
    // Attempt cleanup of the .tmp file
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
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
  metadataSource: 'youtubemusic',
  playbackSource: 'ytmsearch:',
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

// ── No-Prefix System ──────────────────────────────────────────────────────────

/**
 * Add a user to the no-prefix list.
 * @param {string} userId
 * @param {number|null} expiresAt - Unix ms timestamp, or null for permanent
 */
function noprefixAdd(userId, expiresAt) {
  const data = readJSON(NOPREFIX_FILE);
  data[userId] = { expiresAt: expiresAt ?? null, enabled: true };
  writeJSON(NOPREFIX_FILE, data);
}

/**
 * Remove a user from the no-prefix list.
 * @param {string} userId
 */
function noprefixRemove(userId) {
  const data = readJSON(NOPREFIX_FILE);
  delete data[userId];
  writeJSON(NOPREFIX_FILE, data);
}

/**
 * Get all no-prefix entries (may include expired ones).
 * @returns {Object<string, { expiresAt: number|null, enabled: boolean }>}
 */
function noprefixList() {
  return readJSON(NOPREFIX_FILE);
}

/**
 * Check if a user currently has no-prefix access (not expired, not disabled).
 * @param {string} userId
 * @returns {boolean}
 */
function hasNoPrefix(userId) {
  const data = readJSON(NOPREFIX_FILE);
  const entry = data[userId];
  if (!entry) return false;
  if (entry.enabled === false) return false;
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    // Auto-remove expired entries
    delete data[userId];
    writeJSON(NOPREFIX_FILE, data);
    return false;
  }
  return true;
}

/**
 * Toggle no-prefix for a user (must already have an entry).
 * @param {string} userId
 * @param {boolean} enabled
 */
function noprefixSetEnabled(userId, enabled) {
  const data = readJSON(NOPREFIX_FILE);
  if (!data[userId]) return;
  data[userId].enabled = enabled;
  writeJSON(NOPREFIX_FILE, data);
}

// ── Custom Server Prefixes ────────────────────────────────────────────────────

/**
 * Get the active prefixes for a guild. Falls back to config default.
 * @param {string} guildId
 * @returns {string[]}
 */
function getPrefixes(guildId) {
  const data = readJSON(PREFIX_FILE);
  const entry = data[guildId];
  if (!entry || !entry.prefixes || entry.prefixes.length === 0) {
    const config = require('../../config');
    return [config.botSetup.prefix];
  }
  return entry.prefixes;
}

/**
 * Set (overwrite) the prefix list for a guild.
 * @param {string} guildId
 * @param {string[]} prefixes
 */
function setPrefixes(guildId, prefixes) {
  const data = readJSON(PREFIX_FILE);
  data[guildId] = { prefixes };
  writeJSON(PREFIX_FILE, data);
}

/**
 * Add a prefix to a guild's prefix list (no duplicates).
 * @param {string} guildId
 * @param {string} prefix
 */
function addPrefix(guildId, prefix) {
  const current = getPrefixes(guildId);
  const config = require('../../config');
  const base = current.filter((p) => p !== config.botSetup.prefix);
  if (!base.includes(prefix)) base.push(prefix);
  setPrefixes(guildId, base.length > 0 ? base : [prefix]);
}

/**
 * Remove a prefix from a guild's prefix list.
 * @param {string} guildId
 * @param {string} prefix
 * @returns {boolean} true if removed, false if not found
 */
function removePrefix(guildId, prefix) {
  const current = getPrefixes(guildId);
  const filtered = current.filter((p) => p !== prefix);
  if (filtered.length === current.length) return false;
  const data = readJSON(PREFIX_FILE);
  if (filtered.length === 0) {
    delete data[guildId];
  } else {
    data[guildId] = { prefixes: filtered };
  }
  writeJSON(PREFIX_FILE, data);
  return true;
}

module.exports = {
  saveSetup,
  removeSetup,
  getSetup,
  getSettings,
  updateSettings,
  noprefixAdd,
  noprefixRemove,
  noprefixList,
  hasNoPrefix,
  noprefixSetEnabled,
  getPrefixes,
  setPrefixes,
  addPrefix,
  removePrefix,
};
