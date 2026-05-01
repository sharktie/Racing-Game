/**
 * Hud system
 *
 * Two-camera approach:
 *   - Main camera  : follows the car through the world (zoom 1.25, scrolls)
 *   - HUD camera   : static, no zoom, full screen — only sees HUD objects
 *
 * The main camera ignores all HUD objects.
 * The HUD camera ignores all world objects (track, car, etc.).
 *
 * Any overlay created after init (countdown, flash messages) must be
 * registered via addToHudCam() so the main cam ignores them too.
 */
export default class Hud {
  constructor(scene, trackData, onRedraw) {
    this.scene      = scene;
    this.trackData  = trackData;
    this._hudObjs   = [];   // everything the HUD camera should see

    this._build(onRedraw);
    this._buildMinimap();
    this._setupCameras();
  }

  // ── UI elements ───────────────────────────────────────────────────────────

  _build(onRedraw) {
    const { scene } = this;
    const W = scene.scale.width;
    const H = scene.scale.height;

    const panel = {
      fontFamily:      "'Barlow Condensed', Arial",
      fontSize:        '20px',
      color:           '#ffffff',
      backgroundColor: '#00000099',
      padding:         { x: 10, y: 6 },
    };

    this.speedText = scene.add.text(14, 14, '0 km/h', panel).setDepth(20);
    this.lapText   = scene.add.text(14, 52, 'Lap: —', panel).setDepth(20);
    this.bestText  = scene.add.text(14, 90, 'Best: —', panel).setDepth(20);

    this.warningText = scene.add.text(W / 2, H - 52, '', {
      fontFamily: "'Rajdhani', Arial", fontSize: '22px', fontStyle: 'bold',
      color: '#ff4444', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(20).setVisible(false);

    const hint = scene.add.text(W / 2, H - 10, 'WASD / Arrow Keys to drive', {
      fontFamily: "'Barlow Condensed', Arial", fontSize: '13px', color: '#555555',
    }).setOrigin(0.5, 1).setDepth(20);

    const back = scene.add.text(W - 14, 14, '✏  REDRAW', {
      fontFamily: "'Barlow Condensed', Arial", fontSize: '17px',
      color: '#999999', backgroundColor: '#00000099', padding: { x: 10, y: 6 },
    }).setOrigin(1, 0).setDepth(20).setInteractive({ useHandCursor: true });

    back.on('pointerover',  () => back.setColor('#ff4444'));
    back.on('pointerout',   () => back.setColor('#999999'));
    back.on('pointerdown',  () => onRedraw());

    this._hudObjs.push(this.speedText, this.lapText, this.bestText,
                       this.warningText, hint, back);
  }

  _buildMinimap() {
    const { scene, trackData: td } = this;
    const W  = scene.scale.width;
    const H  = scene.scale.height;
    const mW = 170, mH = 110;
    const mX = W - mW - 14;
    const mY = H - mH - 30;
    const sx = mW / td.worldW;
    const sy = mH / td.worldH;

    const g = scene.add.graphics().setDepth(19);

    g.fillStyle(0x000000, 0.70);
    g.fillRoundedRect(mX - 4, mY - 4, mW + 8, mH + 8, 5);
    g.fillStyle(0x1e3a1e, 1);
    g.fillRect(mX, mY, mW, mH);

    const lp = td.left.map(p => ({ x: mX + p.x * sx, y: mY + p.y * sy }));
    const rp = [...td.right].reverse().map(p => ({ x: mX + p.x * sx, y: mY + p.y * sy }));
    g.fillStyle(0x4a4a4a, 1);
    g.fillPoints([...lp, ...rp], true);

    const sfPt = td.centerline[3];
    g.fillStyle(0xffffff, 1);
    g.fillCircle(mX + sfPt.x * sx, mY + sfPt.y * sy, 3);

    const cpPt = td.centerline[Math.floor(td.centerline.length / 2)];
    g.fillStyle(0x88aaff, 1);
    g.fillCircle(mX + cpPt.x * sx, mY + cpPt.y * sy, 3);

    const label = scene.add.text(mX + 4, mY + 4, 'MAP', {
      fontFamily: "'Barlow Condensed', Arial", fontSize: '11px', color: '#666666',
    }).setDepth(21);

    this.mmDot = scene.add.circle(0, 0, 4, 0xff3333).setDepth(21);

    this._mmX  = mX; this._mmY  = mY;
    this._mmSX = sx; this._mmSY = sy;

    this._hudObjs.push(g, label, this.mmDot);
  }

  // ── Camera setup ──────────────────────────────────────────────────────────

  _setupCameras() {
    const { scene } = this;
    const W = scene.scale.width;
    const H = scene.scale.height;

    // Main camera ignores HUD objects
    scene.cameras.main.ignore(this._hudObjs);

    // Dedicated HUD camera: fixed, no zoom
    this._hudCam = scene.cameras.add(0, 0, W, H);
    this._hudCam.setName('hud');
    this._hudCam.transparent = true;

    // HUD camera ignores all NON-hud objects currently in the scene
    const worldObjs = scene.children.list.filter(o => !this._hudObjs.includes(o));
    this._hudCam.ignore(worldObjs);
  }

  /**
   * Register one or more objects as HUD-camera-only overlays.
   * Call this for anything created after _setupCameras (countdown, flash msgs).
   * @param {Phaser.GameObjects.GameObject|Array} objs
   */
  addToHudCam(objs) {
    const arr = Array.isArray(objs) ? objs : [objs];
    // Main cam should not render these
    this.scene.cameras.main.ignore(arr);
    // HUD cam should render them (default — no ignore needed)
  }

  /**
   * Register one or more objects as world-space objects (NOT HUD overlays).
   * Call this for anything created after _setupCameras that should scroll with
   * the world — e.g. ghost cars spawned mid-game.
   * @param {Phaser.GameObjects.GameObject|Array} objs
   */
  addToWorldCam(objs) {
    const arr = Array.isArray(objs) ? objs : [objs];
    // HUD cam must ignore them so they don't appear as frozen overlays
    this._hudCam.ignore(arr);
    // Main cam already sees them by default (no action needed)
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(car, onTrack, offTrackTimer, lapCount, lapStartTime, bestLap, totalLaps = 3) {
    const { scene } = this;

    this.speedText.setText(`${Math.abs(Math.round(car.speed * 35))} km/h`);

    if (lapCount >= 1) {
      const displayLap = Math.min(lapCount, totalLaps);
      const elapsed    = (scene.time.now - lapStartTime) / 1000;
      this.lapText.setText(`Lap ${displayLap} / ${totalLaps}   ${elapsed.toFixed(1)}s`);
    }

    if (bestLap < Infinity) {
      this.bestText.setText(`Best: ${bestLap.toFixed(2)}s`);
    }

    if (!onTrack && offTrackTimer > 0.3) {
      const remaining = Math.max(0, 5.0 - offTrackTimer).toFixed(1);
      this.warningText.setText(`OFF TRACK — reset in ${remaining}s`);
      this.warningText.setVisible(true);
    } else {
      this.warningText.setVisible(false);
    }

    this.mmDot.setPosition(
      this._mmX + car.x * this._mmSX,
      this._mmY + car.y * this._mmSY,
    );
  }
}
