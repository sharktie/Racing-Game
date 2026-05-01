/**
 * Settings.js
 *
 * Singleton storing player preferences (currently key bindings).
 * Persisted to localStorage so they survive page reloads.
 */

const STORAGE_KEY = 'track_racer_settings';

const DEFAULTS = {
  up:    'W',
  down:  'S',
  left:  'A',
  right: 'D',
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) { /* ignore parse errors */ }
  return { ...DEFAULTS };
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
}

// Mutable singleton — mutate .keys then call persist()
export const settings = load();

export function persistSettings() {
  save(settings);
}

/** Human-readable label for a Phaser KeyCode string, e.g. "W", "UP", "SPACE" */
export function keyLabel(keyStr) {
  if (!keyStr) return '—';
  // Phaser uses e.g. "UP", "DOWN", "LEFT", "RIGHT", "SPACE"
  const map = {
    UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→', SPACE: 'SPC',
  };
  return map[keyStr] ?? keyStr;
}
