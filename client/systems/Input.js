/**
 * Input system
 *
 * Reads key bindings from Settings.js so they can be rebound at runtime.
 * Call rebuild() after settings change (or just create a new Input instance).
 */
import { settings } from './Settings.js';

export default class Input {
  constructor(scene) {
    this._scene = scene;
    this.rebuild();
  }

  /** Re-registers keys from current settings — call after rebinding. */
  rebuild() {
    // Remove old keys if they exist
    if (this.keys) {
      Object.values(this.keys).forEach(k => {
        try { this._scene.input.keyboard.removeKey(k); } catch (_) {}
      });
    }

    const KC = Phaser.Input.Keyboard.KeyCodes;
    const resolve = name => KC[name] ?? KC[name.toUpperCase()] ?? KC.W;

    this.keys = this._scene.input.keyboard.addKeys({
      up:       resolve(settings.up),
      down:     resolve(settings.down),
      left:     resolve(settings.left),
      right:    resolve(settings.right),
      // Always add arrow keys as secondary (non-rebindable)
      upArr:    KC.UP,
      downArr:  KC.DOWN,
      leftArr:  KC.LEFT,
      rightArr: KC.RIGHT,
      reset:    KC.R,
    });
  }

  /** @returns {{ up, down, left, right, reset: boolean }} */
  get() {
    const k = this.keys;
    return {
      up:    k.up.isDown    || k.upArr.isDown,
      down:  k.down.isDown  || k.downArr.isDown,
      left:  k.left.isDown  || k.leftArr.isDown,
      right: k.right.isDown || k.rightArr.isDown,
      reset: Phaser.Input.Keyboard.JustDown(k.reset),
    };
  }
}
