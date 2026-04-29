/**
 * Input system
 *
 * Reads WASD and arrow keys and returns a normalised input object.
 * Add gamepad or touch-joystick support here in the future.
 */
export default class Input {
  constructor(scene) {
    this.keys = scene.input.keyboard.addKeys({
      up:       Phaser.Input.Keyboard.KeyCodes.W,
      down:     Phaser.Input.Keyboard.KeyCodes.S,
      left:     Phaser.Input.Keyboard.KeyCodes.A,
      right:    Phaser.Input.Keyboard.KeyCodes.D,
      upArr:    Phaser.Input.Keyboard.KeyCodes.UP,
      downArr:  Phaser.Input.Keyboard.KeyCodes.DOWN,
      leftArr:  Phaser.Input.Keyboard.KeyCodes.LEFT,
      rightArr: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    });
  }

  /** @returns {{ up:boolean, down:boolean, left:boolean, right:boolean }} */
  get() {
    const k = this.keys;
    return {
      up:    k.up.isDown    || k.upArr.isDown,
      down:  k.down.isDown  || k.downArr.isDown,
      left:  k.left.isDown  || k.leftArr.isDown,
      right: k.right.isDown || k.rightArr.isDown,
    };
  }
}
