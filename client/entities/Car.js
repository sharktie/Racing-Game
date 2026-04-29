/**
 * Car entity
 *
 * Handles physics (top-down arcade) and drawing.
 * Tweak the constants at the top to adjust feel.
 */

const ACCEL           = 0.28;
const BRAKE           = 0.42;
const FRICTION        = 0.972;
const MAX_SPEED       = 15;
const TURN_RATE       = 0.043;
const OFF_TRACK_FRICT = 0.87;

export default class Car {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x       World-space start X
   * @param {number} y       World-space start Y
   * @param {number} angle   Starting rotation in radians
   */
  constructor(scene, x, y, angle) {
    this.scene  = scene;
    this.sprite = scene.add.graphics();
    this._drawCar();
    this.sprite.setDepth(10);

    this.x     = x;
    this.y     = y;
    this.angle = angle;
    this.speed = 0;

    // Previous position — used by Track for gate crossing detection
    this.prevX = x;
    this.prevY = y;

    // Sync sprite position immediately so camera can follow from frame 1
    this.sprite.x        = x;
    this.sprite.y        = y;
    this.sprite.rotation = angle;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  _drawCar() {
    const g = this.sprite;
    g.clear();

    // Drop shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(5, 5, 50, 26);

    // Body
    g.fillStyle(0xe03333, 1);
    g.fillRect(-22, -12, 44, 24);

    // Racing stripe
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(-22, -2, 44, 4);

    // Windscreen
    g.fillStyle(0x88ccff, 0.9);
    g.fillRect(4, -8, 13, 16);

    // Rear window
    g.fillStyle(0x88ccff, 0.5);
    g.fillRect(-18, -7, 8, 14);

    // Wheel blocks
    g.fillStyle(0x111111, 1);
    g.fillRect(-22, -17,  10, 7);
    g.fillRect(-22,  10,  10, 7);
    g.fillRect( 12, -17,  10, 7);
    g.fillRect( 12,  10,  10, 7);

    // Tyre details
    g.fillStyle(0x444444, 1);
    g.fillRect(-20, -16, 6, 5);
    g.fillRect(-20,  11, 6, 5);
    g.fillRect( 14, -16, 6, 5);
    g.fillRect( 14,  11, 6, 5);

    // Headlights
    g.fillStyle(0xffee88, 1);
    g.fillRect(20, -9, 5, 6);
    g.fillRect(20,  3, 5, 6);

    // Tail lights
    g.fillStyle(0xff2222, 1);
    g.fillRect(-25, -9, 4, 6);
    g.fillRect(-25,  3, 4, 6);
  }

  // ── Physics update ────────────────────────────────────────────────────────

  /**
   * @param {{ up:boolean, down:boolean, left:boolean, right:boolean }} input
   * @param {number}  delta    Frame delta (ms) — reserved for future delta-time physics
   * @param {boolean} onTrack  Whether the car is on the tarmac
   */
  update(input, delta, onTrack) {
    this.prevX = this.x;
    this.prevY = this.y;

    if (input.up)   this.speed += ACCEL;
    if (input.down) this.speed -= BRAKE;

    this.speed = Math.min(Math.max(this.speed, -MAX_SPEED / 2), MAX_SPEED);
    this.speed *= onTrack ? FRICTION : OFF_TRACK_FRICT;

    if (Math.abs(this.speed) > 0.05) {
      const dir        = this.speed > 0 ? 1 : -1;
      const turnFactor = Math.min(Math.abs(this.speed) / MAX_SPEED, 1);

      if (input.left)  this.angle -= TURN_RATE * dir * turnFactor;
      if (input.right) this.angle += TURN_RATE * dir * turnFactor;
    }

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    this.sprite.x        = this.x;
    this.sprite.y        = this.y;
    this.sprite.rotation = this.angle;
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  reset(x, y, angle) {
    this.x     = x;
    this.y     = y;
    this.angle = angle;
    this.speed = 0;

    this.prevX = x;
    this.prevY = y;

    this.sprite.x        = x;
    this.sprite.y        = y;
    this.sprite.rotation = angle;
  }
}
