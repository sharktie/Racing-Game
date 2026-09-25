import { net } from '../systems/Network.js';
import {
  HALF_WIDTH, HEIGHT, WIDTH, WORLD_SCALE,
  buildLoop, drawStroke, drawTrack, lastSegmentCrossing, setupCanvas,
} from '../systems/Drawer.js';
import { showScreen } from '../systems/ui.js';

const $ = id => document.getElementById(id);

// Host only. Draw a loop with the mouse; guests watch it live.
export default class DrawingPhase extends Phaser.Scene {
  constructor() {
    super('DrawingPhase');
  }

  create() {
    showScreen('draw');
    this.canvas = $('draw-canvas');
    this.ctx = setupCanvas(this.canvas);
    this.points = [];
    this.drawing = false;
    this.blocked = false;
    this.track = null;

    // Assigned rather than addEventListener'd so restarting the scene
    // replaces the handlers instead of stacking another copy.
    this.canvas.onpointerdown = e => this.down(e);
    this.canvas.onpointermove = e => this.move(e);
    this.canvas.onpointerup = () => this.up();
    this.canvas.onpointercancel = () => this.up();
    $('race').onclick = () => this.race();
    $('draw-back').onclick = () => {
      net.clearStroke();
      this.scene.start('Lobby');
    };

    $('race').disabled = true;
    drawStroke(this.ctx, []);
    this.status('DRAW A LOOP');
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    const margin = HALF_WIDTH * 2; // keep the whole road on the map
    return {
      x: Phaser.Math.Clamp((e.clientX - r.left) / r.width * WIDTH, margin, WIDTH - margin),
      y: Phaser.Math.Clamp((e.clientY - r.top) / r.height * HEIGHT, margin, HEIGHT - margin),
    };
  }

  down(e) {
    // Keeps pointer events coming if the mouse leaves the canvas mid-stroke.
    this.canvas.setPointerCapture(e.pointerId);
    this.drawing = true;
    this.blocked = false;
    this.track = null;
    this.points = [this.pos(e)];
    $('race').disabled = true;
    this.status('DRAWING...');
  }

  move(e) {
    if (!this.drawing) return;
    const p = this.pos(e);
    const pts = this.points;
    const last = pts[pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
    pts.push(p);

    if (!this.blocked) {
      const hit = lastSegmentCrossing(pts);
      // Running over the start of the line just means the loop is done:
      // cut off the overshoot and finish there.
      if (hit >= 0 && hit < 10 && pts.length > 40) {
        this.points = pts.slice(hit + 1, -1);
        this.up();
        return;
      }
      if (hit >= 0) {
        this.blocked = true;
        this.status('LINES CROSS', true);
      }
    }

    drawStroke(this.ctx, pts, this.blocked);
    if (pts.length % 5 === 0) net.sendStroke(pts.slice(), this.blocked);
  }

  up() {
    if (!this.drawing) return;
    this.drawing = false;
    net.sendStroke(this.points.slice(), this.blocked);

    if (this.blocked) return this.status('LINES CROSS - TRY AGAIN', true);
    if (this.points.length < 30) return this.status('TOO SMALL - TRY AGAIN', true);

    const loop = buildLoop(this.points);
    if (!loop) return this.status('LINES CROSS - TRY AGAIN', true);

    drawTrack(this.ctx, loop);
    this.track = {
      centerline: loop.map(p => ({ x: p.x * WORLD_SCALE, y: p.y * WORLD_SCALE })),
      halfWidth: HALF_WIDTH * WORLD_SCALE,
      worldW: WIDTH * WORLD_SCALE,
      worldH: HEIGHT * WORLD_SCALE,
    };
    $('race').disabled = false;
    $('race').focus();
    this.status('READY');
  }

  race() {
    if (!this.track) return;
    this.registry.set('track', this.track);
    net.sendTrack(this.track);
    this.scene.start('GameScene');
  }

  status(msg, bad = false) {
    $('status').textContent = msg;
    $('status').classList.toggle('bad', bad);
  }
}
