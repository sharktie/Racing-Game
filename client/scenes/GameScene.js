import Car          from '../entities/Car.js';
import GhostCar    from '../entities/GhostCar.js';
import Input        from '../systems/Input.js';
import Camera       from '../systems/Camera.js';
import Hud          from '../systems/Hud.js';
import Track        from '../track/Track.js';
import Checkpoints  from '../track/Checkpoints.js';
import StartingGrid from '../track/StartingGrid.js';
import { net }      from '../systems/Network.js';

// How often (ms) we broadcast our position to the server
const BROADCAST_INTERVAL = 50; // ~20Hz

const TOTAL_LAPS = 3;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const trackData = this.registry.get('trackData');

    this.inputSystem = new Input(this);

    // Track + world layer
    this.track = new Track(trackData);
    const layer = this.add.graphics();
    this.track.draw(layer);

    // Checkpoints (drawn on same layer)
    this.checkpoints = new Checkpoints(trackData.centerline, trackData.halfWidth);
    this.checkpoints.draw(layer);

    // Starting grid (drawn on same layer, slot numbers as scene text)
    this.grid = new StartingGrid(this.track.sfGate, trackData.halfWidth);
    this.grid.draw(layer, this);

    // Local car — spawned at the correct grid slot for this player
    const gridSlot = net.playerIndex ?? 0;
    const startPos = this.grid.getPosition(gridSlot);

    this.car = new Car(this, startPos.x, startPos.y, startPos.angle);

    // World camera
    this.cameraSystem = new Camera(this, this.car, trackData.worldW, trackData.worldH);

    // Race state
    this.driving        = false;
    this.offTrackTimer  = 0;
    this.lapCount       = 1;
    this.lapStartTime   = 0;
    this.bestLap        = Infinity;
    this.raceStartTime  = 0;
    this.raceFinished   = false;
    this.justCrossed    = false;
    this._justHitCPs    = new Set();
    this._lapTimes      = [];   // completed lap times in seconds

    // Multiplayer — ghost cars keyed by socket id
    this._ghosts       = new Map();
    this._broadcastAcc = 0;

    // Register multiplayer listeners
    this._onPlayersUpdate = (players) => this._handlePlayersUpdate(players);
    this._onPlayerLeft    = (id)      => this._removeGhost(id);
    net.on('players_update', this._onPlayersUpdate);
    net.on('player_left',    this._onPlayerLeft);

    // HUD
    this.hud = new Hud(this, trackData, () => {
      // Clean up multiplayer listeners before leaving
      net.off('players_update', this._onPlayersUpdate);
      net.off('player_left',    this._onPlayerLeft);
      document.getElementById('draw-phase').style.display = 'flex';
      document.getElementById('game-phase').style.display = 'none';
      this.scene.start('DrawingPhase');
    }, this.checkpoints);

    // Tell HUD camera to also ignore ghost car sprites
    // (they'll be added to worldObjs naturally since created before _setupCameras
    //  runs inside Hud constructor — ghosts created AFTER need explicit ignore)

    this._startCountdown();
  }

  // ── Multiplayer ghost management ──────────────────────────────────────────

  _handlePlayersUpdate(players) {
    players.forEach(p => {
      if (p.id === net.playerId) return; // skip self
      if (!this._ghosts.has(p.id)) {
        // New ghost
        const ghost = new GhostCar(this, p.index, p.name);
        this._ghosts.set(p.id, ghost);
        // Tell HUD camera to ignore ghost sprites so they scroll with the world
        this.hud.addToWorldCam([ghost.sprite, ghost.label]);
      }
      this._ghosts.get(p.id).applyState(p);
    });
  }

  _removeGhost(id) {
    if (this._ghosts.has(id)) {
      this._ghosts.get(id).destroy();
      this._ghosts.delete(id);
    }
  }

  // ── Main update ───────────────────────────────────────────────────────────

  update(time, delta) {
    // Always update ghost interpolation
    this._ghosts.forEach(g => g.update());

    // Broadcast position even during countdown so other players see us at grid
    this._broadcastAcc += delta;
    if (this._broadcastAcc >= BROADCAST_INTERVAL && net.socket && net.playerId) {
      this._broadcastAcc = 0;
      net.sendUpdate({
        x: this.car.x, y: this.car.y,
        angle: this.car.angle, speed: this.car.speed,
        lap: this.lapCount,
      });
    }

    if (!this.driving) return;

    const input   = this.inputSystem.get();
    const onTrack = this.track.isOnTrack(this.car.x, this.car.y);
    this.car.update(input, delta, onTrack);

    // R key — instant reset to last checkpoint (or grid slot)
    if (input.reset) {
      const cpPos = this.checkpoints.lastPassedPosition();
      const pos   = cpPos ?? this.grid.getPosition(net.playerIndex ?? 0);
      this.car.reset(pos.x, pos.y, pos.angle);
      this.offTrackTimer = 0;
    }

    // Off-track warning (no auto-reset — player uses R)
    if (!onTrack) {
      this.offTrackTimer += delta / 1000;
    } else {
      this.offTrackTimer = 0;
    }

    // Checkpoints — update returns index of gate crossed, or -1
    const cpIdx = this.checkpoints.update(
      this.car.prevX, this.car.prevY, this.car.x, this.car.y,
    );
    if (cpIdx >= 0 && !this._justHitCPs.has(cpIdx)) {
      this._justHitCPs.add(cpIdx);
      const remaining = 7 - this.checkpoints._passedSet.size;
      this._flashMessage(
        remaining > 0 ? `✓  CHECKPOINT  (${remaining} left)` : '✓  ALL CHECKPOINTS',
        '#88aaff',
      );
      this.time.delayedCall(1500, () => this._justHitCPs.delete(cpIdx));
    }

    // S/F line — only counts if all checkpoints passed
    const crossed = this.track.crossedStartFinish(
      this.car.prevX, this.car.prevY, this.car.x, this.car.y,
    );
    if (crossed && !this.justCrossed) {
      this.justCrossed = true;
      if (this.checkpoints.allPassed()) {
        this._completeLap();
        this.checkpoints.resetLap();
      }
      this.time.delayedCall(1500, () => { this.justCrossed = false; });
    }

    this.hud.update(this.car, onTrack, this.offTrackTimer, this.lapCount, this.lapStartTime, this.bestLap, TOTAL_LAPS);
  }

  // ── Lap timing ─────────────────────────────────────────────────────────────

  _completeLap() {
    const elapsed = (this.time.now - this.lapStartTime) / 1000;
    this.lapStartTime = this.time.now;
    this._lapTimes.push(elapsed);

    if (elapsed < this.bestLap) {
      this.bestLap = elapsed;
      this._flashMessage(`🏆 NEW BEST  ${elapsed.toFixed(2)}s`, '#f5c518');
    } else {
      this._flashMessage(`Lap ${this.lapCount}  —  ${elapsed.toFixed(2)}s`, '#ffffff');
    }

    if (net.socket && net.playerId) {
      net.sendLapComplete(this.lapCount, elapsed);
    }

    this.lapCount++;

    if (this.lapCount > TOTAL_LAPS) {
      this.driving      = false;
      this.raceFinished = true;
      const totalTime   = (this.time.now - this.raceStartTime) / 1000;
      this.time.delayedCall(800, () => this._goToLeaderboard(totalTime));
    }
  }

  _goToLeaderboard(totalTime) {
    net.off('players_update', this._onPlayersUpdate);
    net.off('player_left',    this._onPlayerLeft);

    this.registry.set('raceResult', {
      playerName: net.playerName || 'Driver',
      totalTime,
      bestLap:   this.bestLap,
      lapTimes:  this._lapTimes,
    });

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Leaderboard');
    });
  }

  // ── Flash message ─────────────────────────────────────────────────────────

  _flashMessage(text, color) {
    const W = this.scale.width;
    const H = this.scale.height;

    const msg = this.add.text(W / 2, H / 2 - 65, text, {
      fontFamily:      "'Rajdhani', Arial",
      fontSize:        '30px',
      fontStyle:       'bold',
      color,
      stroke:          '#000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(25);

    this.hud.addToHudCam(msg);

    this.tweens.add({
      targets:    msg,
      alpha:      0,
      y:          H / 2 - 120,
      duration:   2000,
      ease:       'Power2',
      onComplete: () => msg.destroy(),
    });
  }

  // ── F1 countdown ──────────────────────────────────────────────────────────

  _startCountdown() {
    const W = this.scale.width;
    const H = this.scale.height;

    const LIGHT_COUNT = 5;
    const LIGHT_R     = 18;
    const LIGHT_GAP   = 14;
    const STEP        = LIGHT_R * 2 + LIGHT_GAP;
    const totalW      = LIGHT_COUNT * STEP - LIGHT_GAP;
    const pad         = 20;
    const panelW      = totalW + pad * 2;
    const panelH      = LIGHT_R * 2 + pad * 2;
    const panelX      = W / 2 - panelW / 2;
    const panelY      = H / 2 - panelH / 2 - 50;

    const panel = this.add.graphics().setDepth(30);
    panel.fillStyle(0x0d0d0f, 0.94);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    panel.lineStyle(2, 0x333336, 1);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);

    const lights = [];
    for (let i = 0; i < LIGHT_COUNT; i++) {
      const lx = panelX + pad + LIGHT_R + i * STEP;
      const ly = panelY + pad + LIGHT_R;
      const g  = this.add.graphics().setDepth(31);
      g.lineStyle(2, 0x2a2a2e, 1);
      g.strokeCircle(lx, ly, LIGHT_R + 3);
      g.fillStyle(0x1a0000, 1);
      g.fillCircle(lx, ly, LIGHT_R);
      lights.push({ g, lx, ly });
    }

    this.hud.addToHudCam([panel, ...lights.map(l => l.g)]);

    const illuminateRed = (i) => {
      const { g, lx, ly } = lights[i];
      g.clear();
      g.fillStyle(0xff1100, 0.28); g.fillCircle(lx, ly, LIGHT_R + 7);
      g.fillStyle(0xff1100, 1);    g.fillCircle(lx, ly, LIGHT_R);
      g.fillStyle(0xff9980, 0.55); g.fillCircle(lx - LIGHT_R * 0.3, ly - LIGHT_R * 0.35, LIGHT_R * 0.28);
    };

    const illuminateGreen = (i) => {
      const { g, lx, ly } = lights[i];
      g.clear();
      g.fillStyle(0x00ff44, 0.28); g.fillCircle(lx, ly, LIGHT_R + 7);
      g.fillStyle(0x00ee33, 1);    g.fillCircle(lx, ly, LIGHT_R);
      g.fillStyle(0x88ffaa, 0.55); g.fillCircle(lx - LIGHT_R * 0.3, ly - LIGHT_R * 0.35, LIGHT_R * 0.28);
    };

    let lit = 0;
    const lightNext = () => {
      illuminateRed(lit++);
      if (lit < LIGHT_COUNT) {
        this.time.delayedCall(1000, lightNext);
      } else {
        this.time.delayedCall(600 + Math.random() * 500, goGreen);
      }
    };

    const goGreen = () => {
      for (let i = 0; i < LIGHT_COUNT; i++) illuminateGreen(i);
      this.driving       = true;
      this.raceStartTime = this.time.now;
      this.cameraSystem.setSmoothFollow();
      this.lapStartTime = this.time.now;

      this.time.delayedCall(1200, () => {
        this.tweens.add({
          targets:    [panel, ...lights.map(l => l.g)],
          alpha:      0,
          duration:   500,
          onComplete: () => {
            panel.destroy();
            lights.forEach(l => l.g.destroy());
          },
        });
      });
    };

    this.time.delayedCall(700, lightNext);
  }
}
