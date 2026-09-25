import { ACTIONS, keyName, keys, saveKeys } from '../systems/Settings.js';
import { menu, showScreen, text } from '../systems/ui.js';

const KC = Phaser.Input.Keyboard.KeyCodes;
const HINT = 'ARROW KEYS ALWAYS WORK';

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create() {
    showScreen(null);
    const W = this.scale.width;
    this.listening = null;

    text(this, W / 2, 72, 'CONTROLS', 16, '#ffec27').setOrigin(0.5);
    this.hint = text(this, W / 2, 280, HINT, 8, '#5f574f').setOrigin(0.5);

    this.menu = menu(this, W / 2 - 128, 120, [
      ...ACTIONS.map(action => ({ label: this.label(action), action: e => this.listen(action, e) })),
      { label: 'BACK', action: () => this.scene.start('MenuScene') },
    ]);

    // Registered after the menu so the menu sees each key first.
    this.input.keyboard.on('keydown', e => this.onKey(e));
  }

  label(action, key = keyName(keys[action.id])) {
    return action.label.padEnd(16, '.') + key;
  }

  listen(action, event) {
    this.listening = action;
    this.startEvent = event; // the Enter press that got us here isn't the new key
    this.menu.enabled = false;
    this.menu.setLabel(ACTIONS.indexOf(action), this.label(action, '?'));
    this.hint.setText('PRESS A KEY - ESC CANCELS').setColor('#fff1e8');
  }

  onKey(e) {
    if (!this.listening) {
      if (e.keyCode === KC.ESC) this.scene.start('MenuScene');
      return;
    }
    if (e === this.startEvent) return;

    const action = this.listening;
    if (e.keyCode !== KC.ESC) {
      // If another action already uses this key, give it our old one.
      const clash = ACTIONS.find(a => a !== action && keys[a.id] === e.keyCode);
      if (clash) keys[clash.id] = keys[action.id];
      keys[action.id] = e.keyCode;
      saveKeys();
    }

    this.listening = null;
    this.menu.enabled = true;
    ACTIONS.forEach((a, i) => this.menu.setLabel(i, this.label(a)));
    this.hint.setText(HINT).setColor('#5f574f');
  }
}
