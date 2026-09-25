import { CAR_COLORS } from '../entities/Car.js';
import { net } from './Network.js';
import { formatTime, text } from './ui.js';

const MAP_WIDTH = 96;

export default class Hud {
  constructor(scene, layer, track, onNewTrack) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const add = obj => (layer.add(obj), obj);
    this.scene = scene;

    this.lap = add(text(scene, 8, 8, ''));
    this.time = add(text(scene, 8, 20, ''));
    this.best = add(text(scene, 8, 32, ''));
    this.speed = add(text(scene, W - 8, 8, '').setOrigin(1, 0));
    this.message = add(text(scene, W / 2, H / 2 - 64, '', 16).setOrigin(0.5));
    this.warning = add(text(scene, W / 2, H - 40, 'OFF TRACK - PRESS R', 8, '#ff004d').setOrigin(0.5));
    add(text(scene, 8, H - 16, 'R RESET', 8, '#c2c3c7'));

    this.newTrack = add(text(scene, W - 8, 20, 'NEW TRACK', 8, '#c2c3c7')
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.newTrack.setColor('#ffec27'))
      .on('pointerout', () => this.newTrack.setColor('#c2c3c7'))
      .on('pointerdown', onNewTrack));
    // Layers only affect drawing, not clicks, so stop the zoomed world camera
    // from also treating a click somewhere else as a click on this.
    scene.cameras.main.ignore(this.newTrack);

    // Minimap in the bottom right corner.
    this.mapScale = MAP_WIDTH / track.worldW;
    this.mapX = W - MAP_WIDTH - 8;
    this.mapY = H - track.worldH * this.mapScale - 8;
    const map = add(scene.add.graphics());
    map.fillStyle(0x000000).fillRect(this.mapX - 2, this.mapY - 2, MAP_WIDTH + 4, track.worldH * this.mapScale + 4);
    map.lineStyle(2, 0x5f574f).strokePoints(track.centerline.map(p => this.toMap(p)), true);
    this.dots = add(scene.add.graphics());
  }

  toMap(p) {
    return { x: this.mapX + p.x * this.mapScale, y: this.mapY + p.y * this.mapScale };
  }

  dot(p, color, size) {
    const { x, y } = this.toMap(p);
    this.dots.fillStyle(color).fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
  }

  flash(msg, color = '#fff1e8', size = 16) {
    this.message.setText(msg).setColor(color).setFontSize(size);
    this.messageTimer?.remove();
    this.messageTimer = this.scene.time.delayedCall(1200, () => this.message.setText(''));
  }

  update(race) {
    const { car, checkpoints } = race;

    this.lap.setText(`LAP ${race.lap}/${race.laps}`);
    this.time.setText(formatTime(race.lapTime));
    this.best.setText(`BEST ${formatTime(race.best)}`);
    this.speed.setText(`${Math.round(Math.abs(car.speed) * 35)} KM/H`);
    this.warning.setVisible(race.offTrackTime > 300 && Math.floor(race.time.now / 300) % 2 === 0);
    this.newTrack.setVisible(net.isHost);

    this.dots.clear();
    checkpoints.gates.forEach((gate, i) => {
      this.dot(gate, checkpoints.passed.has(i) ? 0x1d2b53 : 0x29adff, 2);
    });
    for (const ghost of race.ghosts.values()) this.dot(ghost, ghost.color, 3);
    this.dot(car, CAR_COLORS[net.playerIndex] ?? 0xfff1e8, 3);
  }
}
