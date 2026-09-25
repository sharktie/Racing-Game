import { keys } from './Settings.js';

export default class Input {
  constructor(scene) {
    const KC = Phaser.Input.Keyboard.KeyCodes;

    // enableCapture is off on purpose: captured keys get preventDefault() page
    // wide, even after this scene stops, which made letters like W and R
    // impossible to type into the lobby name box after a race.
    this.keys = scene.input.keyboard.addKeys({
      up: keys.up,
      down: keys.down,
      left: keys.left,
      right: keys.right,
      upArrow: KC.UP,
      downArrow: KC.DOWN,
      leftArrow: KC.LEFT,
      rightArrow: KC.RIGHT,
      reset: KC.R,
    }, false);

    // Latched from the event rather than JustDown(), which misses a tap
    // that goes down and up within one frame.
    this.resetPressed = false;
    this.keys.reset.on('down', () => { this.resetPressed = true; });
  }

  get() {
    const k = this.keys;
    const reset = this.resetPressed;
    this.resetPressed = false;
    return {
      up:    k.up.isDown    || k.upArrow.isDown,
      down:  k.down.isDown  || k.downArrow.isDown,
      left:  k.left.isDown  || k.leftArrow.isDown,
      right: k.right.isDown || k.rightArrow.isDown,
      reset,
    };
  }
}
