// Top-down arcade handling. Speeds are in world pixels per 60fps frame and
// everything is scaled by the real frame time, so 144Hz screens aren't faster.
const ACCEL = 0.28;
const BRAKE = 0.42;
const FRICTION = 0.972;
const OFF_TRACK_FRICTION = 0.87;
const MAX_SPEED = 15;
const TURN_RATE = 0.043;

// One colour per player slot.
export const CAR_COLORS = [0xff004d, 0x29adff, 0xffec27, 0x00e436];

export function drawCar(g, color) {
  g.fillStyle(0x000000);
  g.fillRect(-20, -16, 12, 32); // rear wheels
  g.fillRect(8, -16, 12, 32);   // front wheels
  g.fillStyle(color);
  g.fillRect(-22, -11, 44, 22);
  g.fillStyle(0x1d2b53);
  g.fillRect(4, -8, 8, 16);     // windscreen
}

export default class Car {
  constructor(scene, { x, y, angle }, color) {
    this.sprite = scene.add.graphics().setDepth(1);
    drawCar(this.sprite, color);
    this.reset(x, y, angle);
  }

  reset(x, y, angle) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.angle = angle;
    this.speed = 0;
    this.sprite.setPosition(x, y).setRotation(angle);
  }

  update(input, delta, onTrack) {
    const dt = Math.min(delta / (1000 / 60), 3);
    this.prevX = this.x;
    this.prevY = this.y;

    if (input.up) this.speed += ACCEL * dt;
    if (input.down) this.speed -= BRAKE * dt;
    this.speed = Phaser.Math.Clamp(this.speed, -MAX_SPEED / 2, MAX_SPEED);
    this.speed *= (onTrack ? FRICTION : OFF_TRACK_FRICTION) ** dt;

    // Steering gets stronger with speed and flips when reversing.
    this.angle += (input.right - input.left) * TURN_RATE * (this.speed / MAX_SPEED) * dt;

    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.sprite.setPosition(this.x, this.y).setRotation(this.angle);
  }
}
