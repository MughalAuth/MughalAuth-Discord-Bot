const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'userSelections.json');

let _data = {};
let _saveTimer = null;

/** Load saved selections from disk. Call once on startup. */
function load() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(FILE_PATH)) {
      _data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
      console.log(`✅ Persistence: Loaded ${Object.keys(_data).length} user app selections.`);
    } else {
      _data = {};
      console.log('📁 Persistence: No saved data found — starting fresh.');
    }
  } catch (e) {
    console.error('❌ Persistence: Failed to load:', e.message);
    _data = {};
  }
}

function _write() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(_data, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ Persistence: Failed to save:', e.message);
  }
}

/** Debounced save — writes 100ms after last call to avoid disk hammering. */
function _scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_write, 100);
}

/** Save a user's selected app. Persists immediately (debounced). */
function setUserApp(userId, appName) {
  _data[userId] = appName;
  _scheduleSave();
}

/** Get a user's saved app selection, or null. */
function getUserApp(userId) {
  return _data[userId] || null;
}

/** Get all saved selections as a plain object. */
function getAllSelections() {
  return { ..._data };
}

module.exports = { load, setUserApp, getUserApp, getAllSelections };
