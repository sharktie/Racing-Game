import Car, { CAR_COLORS } from '../entities/Car.js';
import GhostCar from '../entities/GhostCar.js';
import setupCameras from '../systems/Camera.js';
import Hud from '../systems/Hud.js';
import Input from '../systems/Input.js';
import { net } from '../systems/Network.js';
import { showScreen } from '../systems/ui.js';
import Checkpoints from '../track/Checkpoints.js';
import StartingGrid from '../track/StartingGrid.js';
import Track from '../track/Track.js';

const LAPS = 3;
const SEND_INTERVAL = 50; // ms between position updates to the server

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    showScreen(null);

    this.track = new Track(this.registry.get('track'));
    this.checkpoints = new Checkpoints(this.track);
    this.grid = new StartingGrid(this.track);

    this.world = this.add.layer();
    const hud = this.add.layer();

    const g = this.add.graphics();
    this.track.draw(g);
    this.checkpoints.draw(g);
    this.grid.draw(g);
    this.world.add(g);

    this.car = new Car(this, this.grid.slot(net.playerIndex), CAR_COLORS[net.playerIndex] ?? 0xfff1e8);
    this.world.add(this.car.sprite);

    setupCameras(this, this.car.sprite, this.track, this.world, hud);
    this.hud = new Hud(this, hud, this.track, () => this.scene.start('DrawingPhase'));
    this.controls = new Input(this);

    this.laps = LAPS;
    this.lap = 1;
    this.lapTimes = [];
    this.lapTime = 0;
    this.lapStart = 0;
    this.raceStart = 0;
    this.best = Infinity;
    this.driving = false;
    this.offTrackTime = 0;
    this.sinceSend = 0;

    this.ghosts = new Map();
    const onMove = m => this.moveGhost(m);
    const onLeft = id => this.removeGhost(id);
    net.on('player_moved', onMove);
    net.on('player_left', onLeft);
    this.events.once('shutdown', () => {
      net.off('player_moved', onMove);
      net.off('player_left', onLeft);
    });

    this.countdown();
  }

  countdown() {
    let n = 3;
    this.time.addEvent({
      delay: 1000,
      repeat: 3,
      callback: () => {
        if (n > 0) return this.hud.flash(String(n--), '#ffec27', 32);
        this.hud.flash('GO!', '#00e436', 32);
        this.driving = true;
        this.raceStart = this.lapStart = this.time.now;
      },
    });
  }

  update(time, delta) {
    for (const ghost of this.ghosts.values()) ghost.update(delta);

    // Keep sending during the countdown so others see us on the grid.
    this.sinceSend += delta;
    if (this.sinceSend >= SEND_INTERVAL) {
      this.sinceSend = 0;
      net.sendMove(this.car.x, this.car.y, this.car.angle);
    }

    if (this.driving) this.drive(delta);
    this.hud.update(this);
  }

  drive(delta) {
    const { car, track, checkpoints } = this;
    const input = this.controls.get();
    const onTrack = track.isOnTrack(car.x, car.y);

    car.update(input, delta, onTrack);
    this.offTrackTime = onTrack ? 0 : this.offTrackTime + delta;
    this.lapTime = (this.time.now - this.lapStart) / 1000;

    if (input.reset) {
      const { x, y, angle } = checkpoints.last ?? this.grid.slot(net.playerIndex);
      car.reset(x, y, angle);
      this.offTrackTime = 0;
    }

    if (checkpoints.update(car.prevX, car.prevY, car.x, car.y)) {
      this.hud.flash(`CHECKPOINT ${checkpoints.passed.size}/${checkpoints.gates.length}`, '#29adff');
    }

    if (checkpoints.allPassed && track.crossedStart(car.prevX, car.prevY, car.x, car.y)) {
      this.completeLap();
    }
  }

  completeLap() {
    const now = this.time.now;
    const time = (now - this.lapStart) / 1000;
    this.lapTimes.push(time);
    this.best = Math.min(this.best, time);
    this.lapStart = now;
    this.checkpoints.newLap();

    if (this.lap === LAPS) {
      this.driving = false;
      this.hud.flash('FINISH', '#ffec27', 32);
      this.registry.set('result', { laps: this.lapTimes, total: (now - this.raceStart) / 1000 });
      this.time.delayedCall(2000, () => this.scene.start('Leaderboard'));
      return;
    }

    this.lap++;
    this.hud.flash(this.lap === LAPS ? 'FINAL LAP' : `LAP ${this.lap}`);
  }

  moveGhost({ id, x, y, angle }) {
    const ghost = this.ghosts.get(id);
    if (ghost) return ghost.moveTo(x, y, angle);

    const player = net.players.get(id);
    if (!player) return;
    const g = new GhostCar(this, player, x, y, angle);
    this.world.add([g.sprite, g.label]);
    this.ghosts.set(id, g);
  }

  removeGhost(id) {
    this.ghosts.get(id)?.destroy();
    this.ghosts.delete(id);
  }
}
