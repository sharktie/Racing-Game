// Key bindings, stored as key codes in localStorage.

const STORAGE_KEY = 'track_racer_keys';
const KC = Phaser.Input.Keyboard.KeyCodes;

export const ACTIONS = [
  { id: 'up',    label: 'ACCELERATE' },
  { id: 'down',  label: 'BRAKE' },
  { id: 'left',  label: 'STEER LEFT' },
  { id: 'right', label: 'STEER RIGHT' },
];

export const keys = { up: KC.W, down: KC.S, left: KC.A, right: KC.D };

try {
  Object.assign(keys, JSON.parse(localStorage.getItem(STORAGE_KEY)));
} catch {}

export function saveKeys() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {}
}

// "W", "UP", "SPACE", ... straight from Phaser's key code table.
export function keyName(code) {
  return Object.keys(KC).find(name => KC[name] === code) ?? '?';
}
