/**
 * SettingsScene — control rebinding screen.
 *
 * Drawn entirely on the Phaser canvas. Click a row to enter listening mode,
 * then press any key to assign it. Escape cancels. Changes saved to
 * localStorage via Settings.js.
 */

import { settings, persistSettings, keyLabel } from '../systems/Settings.js';

const ACTIONS = [
  { id: 'up',    label: 'ACCELERATE' },
  { id: 'down',  label: 'BRAKE / REVERSE' },
  { id: 'left',  label: 'STEER LEFT' },
  { id: 'right', label: 'STEER RIGHT' },
];

const COL_NORMAL   = '#e8e8ec';
const COL_MUTED    = '#5a5a62';
const COL_RED      = '#e03333';
const COL_GOLD     = '#f5c518';
const COL_LISTEN   = '#ffcc44';
const PANEL_BG     = 0x141416;
const BORDER_COL   = 0x252528;

export default class SettingsScene extends Phaser.Scene {
  constructor() { super('SettingsScene'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this._listening = null;   // action id currently being rebound
    this._rows      = {};     // id → { bg, keyText }

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0e);

    // Subtle grid
    const gg = this.add.graphics().setAlpha(0.05);
    for (let y = 0; y < H; y += 32) {
      gg.lineStyle(1, 0xffffff, 1);
      gg.beginPath(); gg.moveTo(0, y); gg.lineTo(W, y); gg.strokePath();
    }

    // Title
    this.add.text(W / 2, H * 0.12, 'SETTINGS', {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: '52px', fontStyle: 'bold',
      color: COL_NORMAL, letterSpacing: 8,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.12 + 52, 'KEY BINDINGS', {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '16px', color: COL_RED, letterSpacing: 5,
    }).setOrigin(0.5);

    // Red underline
    this.add.graphics().fillStyle(0xe03333).fillRect(W / 2 - 80, H * 0.12 + 74, 160, 2);

    // Build rows
    const rowH  = 64;
    const rowW  = Math.min(W * 0.55, 480);
    const startY = H * 0.27;

    ACTIONS.forEach((action, i) => {
      const y = startY + i * (rowH + 10);
      this._buildRow(action, W / 2, y, rowW, rowH);
    });

    // Tip text
    this._tipText = this.add.text(W / 2, startY + ACTIONS.length * (rowH + 10) + 16,
      'Click a control then press any key to rebind', {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '15px', color: COL_MUTED, letterSpacing: 1,
    }).setOrigin(0.5);

    // ── Back button ─────────────────────────────────────────────────────────
    const btnW  = 180, btnH = 48;
    const btnY  = H * 0.9;
    const btnBg = this.add.graphics();
    this._drawBtn(btnBg, W / 2, btnY, btnW, btnH, false);

    const btnText = this.add.text(W / 2, btnY, '← BACK', {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: '24px', fontStyle: 'bold',
      color: '#ffffff', letterSpacing: 4,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btnText.on('pointerover',  () => this._drawBtn(btnBg, W / 2, btnY, btnW, btnH, true));
    btnText.on('pointerout',   () => this._drawBtn(btnBg, W / 2, btnY, btnW, btnH, false));
    btnText.on('pointerdown',  () => this._back());

    // Global keyboard listener for rebinding
    this.input.keyboard.on('keydown', e => this._onKeyDown(e));

    // Fade in
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // ── Row builder ───────────────────────────────────────────────────────────

  _buildRow(action, cx, cy, w, h) {
    const bg = this.add.graphics();
    this._paintRowBg(bg, cx, cy, w, h, false, false);

    // Action label (left side)
    this.add.text(cx - w / 2 + 24, cy, action.label, {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: '20px', fontStyle: 'bold',
      color: COL_MUTED, letterSpacing: 2,
    }).setOrigin(0, 0.5);

    // Current key pill (right side)
    const keyText = this.add.text(cx + w / 2 - 24, cy,
      keyLabel(settings[action.id]), {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: '26px', fontStyle: 'bold',
      color: COL_NORMAL, letterSpacing: 2,
    }).setOrigin(1, 0.5);

    // Hit zone
    const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => {
      if (this._listening !== action.id)
        this._paintRowBg(bg, cx, cy, w, h, true, false);
    });
    zone.on('pointerout',   () => {
      if (this._listening !== action.id)
        this._paintRowBg(bg, cx, cy, w, h, false, false);
    });
    zone.on('pointerdown',  () => this._startListen(action.id));

    this._rows[action.id] = { bg, keyText, cx, cy, w, h };
  }

  _paintRowBg(g, cx, cy, w, h, hover, listening) {
    g.clear();
    const fill  = listening ? 0x1a1400 : hover ? 0x1e1e24 : PANEL_BG;
    const alpha = 1;
    g.fillStyle(fill, alpha);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
    const borderCol = listening ? 0xffcc44 : hover ? 0x3a3a44 : BORDER_COL;
    g.lineStyle(listening ? 2 : 1, borderCol, 1);
    g.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 8);
  }

  // ── Listening mode ────────────────────────────────────────────────────────

  _startListen(actionId) {
    // Clear previous listener row
    if (this._listening && this._rows[this._listening]) {
      const prev = this._rows[this._listening];
      this._paintRowBg(prev.bg, prev.cx, prev.cy, prev.w, prev.h, false, false);
      prev.keyText.setColor(COL_NORMAL);
    }

    this._listening = actionId;
    const row = this._rows[actionId];
    this._paintRowBg(row.bg, row.cx, row.cy, row.w, row.h, false, true);
    row.keyText.setText('Press a key…').setColor(COL_LISTEN);
    this._tipText.setText('Press Escape to cancel');
  }

  _onKeyDown(event) {
    if (!this._listening) return;

    const actionId = this._listening;
    const row      = this._rows[actionId];

    if (event.key === 'Escape') {
      // Cancel — restore old value
      row.keyText.setText(keyLabel(settings[actionId])).setColor(COL_NORMAL);
      this._paintRowBg(row.bg, row.cx, row.cy, row.w, row.h, false, false);
      this._listening = null;
      this._tipText.setText('Click a control then press any key to rebind');
      return;
    }

    // Map browser event.code to Phaser-compatible string
    const keyStr = this._codeToStr(event.code, event.key);
    if (!keyStr) return;

    settings[actionId] = keyStr;
    persistSettings();

    row.keyText.setText(keyLabel(keyStr)).setColor(COL_GOLD);
    this._paintRowBg(row.bg, row.cx, row.cy, row.w, row.h, false, false);

    // Brief flash back to normal
    this.time.delayedCall(600, () => {
      if (row.keyText) row.keyText.setColor(COL_NORMAL);
    });

    this._listening = null;
    this._tipText.setText('Click a control then press any key to rebind');
  }

  /** Convert browser event.code → Phaser KeyCode name string */
  _codeToStr(code, key) {
    // Arrow keys
    if (code === 'ArrowUp')    return 'UP';
    if (code === 'ArrowDown')  return 'DOWN';
    if (code === 'ArrowLeft')  return 'LEFT';
    if (code === 'ArrowRight') return 'RIGHT';
    if (code === 'Space')      return 'SPACE';

    // Letter keys: code = "KeyW" → "W"
    if (code.startsWith('Key')) return code.slice(3).toUpperCase();

    // Digit keys: code = "Digit1" → "ONE", etc. — map common ones
    const digitMap = {
      Digit1: 'ONE', Digit2: 'TWO', Digit3: 'THREE', Digit4: 'FOUR',
      Digit5: 'FIVE', Digit6: 'SIX', Digit7: 'SEVEN', Digit8: 'EIGHT',
      Digit9: 'NINE', Digit0: 'ZERO',
    };
    if (digitMap[code]) return digitMap[code];

    // Fall back to uppercase key string if it's a single char
    if (key && key.length === 1) return key.toUpperCase();

    return null;   // unsupported key — ignore
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  _back() {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
  }

  _drawBtn(g, x, y, w, h, hover) {
    g.clear();
    g.fillStyle(hover ? 0x2a2a32 : 0x1a1a20, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
    g.lineStyle(1.5, hover ? 0x555566 : 0x333340, 1);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
  }
}
