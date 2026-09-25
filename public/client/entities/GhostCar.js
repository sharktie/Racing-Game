import { CAR_COLORS, drawCar } from './Car.js';
import { hex, text } from '../systems/ui.js';

// Another player's car. Positions arrive about 20 times a second, so it eases
// towards the latest one instead of jumping.
export default class GhostCar {
  constructor(scene, player, x, y, angle) {
    this.color = CAR_COLORS[player.index] ?? 0xc2c3c7;
    this.sprite = scene.add.graphics();
    drawCar(this.sprite, this.color);

    // Scaled up to cancel out the world zoom, so the name is normal HUD size.
    this.label = text(scene, 0, 0, player.name, 8, hex(this.color))
      .setOrigin(0.5, 1)
      .setScale(1 / scene.cameras.main.zoom)
      .setDepth(2);

    this.x = this.tx = x;
    this.y = this.ty = y;
    this.angle = this.ta = angle;
    this.update(0);
  }

  moveTo(x, y, angle) {
    this.tx = x;
    this.ty = y;
    this.ta = angle;
  }

  update(delta) {
    const t = 1 - Math.pow(0.68, delta / (1000 / 60));
    this.x += (this.tx - this.x) * t;
    this.y += (this.ty - this.y) * t;
    this.angle += Phaser.Math.Angle.Wrap(this.ta - this.angle) * t;
    this.sprite.setPosition(this.x, this.y).setRotation(this.angle);
    this.label.setPosition(this.x, this.y - 30);
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
  }
}
