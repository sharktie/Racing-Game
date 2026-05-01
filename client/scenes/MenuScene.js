/**
 * MenuScene — animated title / main-menu screen.
 *
 * Pure Phaser (no HTML overlay). Draws everything on the canvas:
 *   • Animated dashed track loop in the background
 *   • Flickering grid scanlines for atmosphere
 *   • Big "TRACK RACER" logotype
 *   • "PLAY" button that transitions to Lobby
 */
export default class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  // ── Preload ───────────────────────────────────────────────────────────────
  preload() {
    // All assets drawn programmatically — nothing to load
  }

  // ── Create ────────────────────────────────────────────────────────────────
  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this._t = 0;

    // ── Background ──────────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a0e);

    // Grid scanlines (subtle horizontal rules)
    this._gridGfx = this.add.graphics().setAlpha(0.07);
    this._drawGrid(W, H);

    // ── Animated track loop ─────────────────────────────────────────────────
    this._trackGfx = this.add.graphics();
    this._trackDash = 0; // drives dash animation offset
    this._trackPoints = this._buildTrackPoints(W, H);

    // ── Glowing start/finish line ───────────────────────────────────────────
    this._lineGfx = this.add.graphics();

    // ── Decorative speed-blur lines on right ────────────────────────────────
    this._blurLines = [];
    for (let i = 0; i < 6; i++) {
      const g = this.add.graphics().setAlpha(0);
      this._blurLines.push({ gfx: g, y: 0, alpha: 0 });
    }
    this._spawnBlurLines(W, H);

    // ── Title logotype ──────────────────────────────────────────────────────
    const titleY = H * 0.36;

    // Shadow layer
    this.add.text(W / 2 + 4, titleY + 6, 'TRACK RACER', {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize:   `${Math.round(W * 0.088)}px`,
      fontStyle:  'bold',
      color:      '#000000',
      letterSpacing: 10,
    }).setOrigin(0.5).setAlpha(0.55);

    // Red accent bar behind title
    const barH = Math.round(W * 0.088) * 0.18;
    this.add.rectangle(W / 2, titleY + 2, W * 0.72, barH, 0xe03333, 0.9);

    // Main title
    this._title = this.add.text(W / 2, titleY, 'TRACK RACER', {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize:   `${Math.round(W * 0.088)}px`,
      fontStyle:  'bold',
      color:      '#f0f0f4',
      letterSpacing: 10,
    }).setOrigin(0.5).setAlpha(0);

    // Tagline
    this._tagline = this.add.text(W / 2, titleY + Math.round(W * 0.088) * 0.72, 'DRAW YOUR TRACK · RACE YOUR FRIENDS', {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize:   `${Math.round(W * 0.016)}px`,
      fontStyle:  'bold',
      color:      '#e03333',
      letterSpacing: 5,
    }).setOrigin(0.5).setAlpha(0);

    // ── PLAY button ─────────────────────────────────────────────────────────
    const btnY = H * 0.62;
    const btnW = Math.min(W * 0.28, 280);
    const btnH = 62;

    this._btnBg = this.add.graphics().setAlpha(0);
    this._drawBtn(this._btnBg, W / 2, btnY, btnW, btnH, false);

    this._btnText = this.add.text(W / 2, btnY, 'PLAY', {
      fontFamily: "'Rajdhani', sans-serif",
      fontSize:   '34px',
      fontStyle:  'bold',
      color:      '#ffffff',
      letterSpacing: 8,
    }).setOrigin(0.5).setAlpha(0);

    // Hit zone
    const hitZone = this.add.zone(W / 2, btnY, btnW + 20, btnH + 20)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      this._drawBtn(this._btnBg, W / 2, btnY, btnW, btnH, true);
    });
    hitZone.on('pointerout', () => {
      this._drawBtn(this._btnBg, W / 2, btnY, btnW, btnH, false);
    });
    hitZone.on('pointerdown', () => this._startGame());

    // Also allow Enter/Space
    this.input.keyboard.on('keydown-ENTER', () => this._startGame());
    this.input.keyboard.on('keydown-SPACE', () => this._startGame());

    // ── Version / credit ─────────────────────────────────────────────────────
    this.add.text(W / 2, H - 22, 'v1.0 · custom track racer', {
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize:   '13px',
      color:      '#333340',
      letterSpacing: 3,
    }).setOrigin(0.5);

    // ── Entrance animations ──────────────────────────────────────────────────
    this._entrance();
  }

  // ── Entrance tween sequence ───────────────────────────────────────────────
  _entrance() {
    const delay = 200;

    this.tweens.add({
      targets: this._title,
      alpha: 1, y: `-=14`,
      duration: 700, ease: 'Cubic.Out', delay,
    });

    this.tweens.add({
      targets: this._tagline,
      alpha: 1,
      duration: 500, ease: 'Cubic.Out', delay: delay + 280,
    });

    this.tweens.add({
      targets: [this._btnBg, this._btnText],
      alpha: 1,
      duration: 400, ease: 'Cubic.Out', delay: delay + 520,
    });

    // Pulse on play button
    this.time.delayedCall(delay + 800, () => {
      this.tweens.add({
        targets: this._btnText,
        scaleX: 1.04, scaleY: 1.04,
        yoyo: true, repeat: -1,
        duration: 900, ease: 'Sine.InOut',
      });
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(time, delta) {
    this._t += delta;
    this._trackDash += delta * 0.18;

    // Redraw animated track loop
    this._trackGfx.clear();
    this._drawTrackLoop();

    // Update blur lines
    this._updateBlurLines(delta);
  }

  // ── Build oval track path ─────────────────────────────────────────────────
  _buildTrackPoints(W, H) {
    const cx = W * 0.5, cy = H * 0.5;
    const rx = W * 0.38, ry = H * 0.28;
    const pts = [];
    const steps = 80;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
      // Slight squircle warp for interest
      const warp = 1 + 0.12 * Math.sin(a * 2 + 0.8);
      pts.push({
        x: cx + Math.cos(a) * rx * warp,
        y: cy + Math.sin(a) * ry,
      });
    }
    return pts;
  }

  _drawTrackLoop() {
    const g   = this._trackGfx;
    const pts = this._trackPoints;
    const n   = pts.length;
    const hw  = 28; // half-width of track band
    const dashLen  = 22;
    const gapLen   = 16;
    const dashCycle = dashLen + gapLen;
    const offset   = this._trackDash % dashCycle;

    // Tarmac fill — draw as thick stroked path
    g.lineStyle(hw * 2, 0x1a1a22, 1);
    g.beginPath();
    pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    g.closePath();
    g.strokePath();

    // Outer white kerb edge
    g.lineStyle(2.5, 0xffffff, 0.18);
    g.beginPath();
    pts.forEach((p, i) => {
      const nx = -_normal(pts, i, n).y * hw;
      const ny =  _normal(pts, i, n).x * hw;
      i === 0 ? g.moveTo(p.x + nx, p.y + ny) : g.lineTo(p.x + nx, p.y + ny);
    });
    g.closePath();
    g.strokePath();

    // Inner white kerb edge
    g.lineStyle(2.5, 0xffffff, 0.12);
    g.beginPath();
    pts.forEach((p, i) => {
      const nx =  _normal(pts, i, n).y * hw;
      const ny = -_normal(pts, i, n).x * hw;
      i === 0 ? g.moveTo(p.x + nx, p.y + ny) : g.lineTo(p.x + nx, p.y + ny);
    });
    g.closePath();
    g.strokePath();

    // Animated centre dashes (racing line)
    let dist = 0;
    for (let i = 0; i < n; i++) {
      const next = pts[(i + 1) % n];
      const segLen = Math.hypot(next.x - pts[i].x, next.y - pts[i].y);
      let d = 0;
      while (d < segLen) {
        const phase = ((dist + d + offset) % dashCycle);
        if (phase < dashLen) {
          const t0 = d / segLen;
          const t1 = Math.min((d + (dashLen - phase)) / segLen, 1);
          const x0 = pts[i].x + (next.x - pts[i].x) * t0;
          const y0 = pts[i].y + (next.y - pts[i].y) * t0;
          const x1 = pts[i].x + (next.x - pts[i].x) * t1;
          const y1 = pts[i].y + (next.y - pts[i].y) * t1;
          g.lineStyle(2, 0xffffff, 0.22);
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.strokePath();
        }
        d += dashLen + gapLen;
      }
      dist += segLen;
    }

    // S/F line glow
    const sfIdx = Math.floor(this._trackPoints.length * 0.92);
    const p0 = pts[sfIdx];
    const nm = _normal(pts, sfIdx, n);
    const sfX0 = p0.x + nm.y * hw * 1.1, sfY0 = p0.y - nm.x * hw * 1.1;
    const sfX1 = p0.x - nm.y * hw * 1.1, sfY1 = p0.y + nm.x * hw * 1.1;
    const pulse = 0.5 + 0.5 * Math.sin(this._t * 0.003);
    g.lineStyle(3, 0xe03333, 0.5 + pulse * 0.45);
    g.beginPath(); g.moveTo(sfX0, sfY0); g.lineTo(sfX1, sfY1); g.strokePath();
  }

  // ── Scanline grid ─────────────────────────────────────────────────────────
  _drawGrid(W, H) {
    const g = this._gridGfx;
    g.lineStyle(1, 0xffffff, 1);
    for (let y = 0; y < H; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath();
    }
  }

  // ── Speed-blur lines ──────────────────────────────────────────────────────
  _spawnBlurLines(W, H) {
    this._blurLinesMeta = this._blurLines.map((b, i) => ({
      gfx:   b.gfx,
      x:     W * (0.55 + Math.random() * 0.38),
      y:     H * (0.2  + Math.random() * 0.6),
      len:   40 + Math.random() * 100,
      alpha: 0,
      life:  0,
      maxLife: 600 + Math.random() * 800,
      delay: i * 220,
    }));
  }

  _updateBlurLines(delta) {
    this._blurLinesMeta.forEach(b => {
      b.delay -= delta;
      if (b.delay > 0) return;
      b.life += delta;
      const t = b.life / b.maxLife;
      b.alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      b.gfx.clear();
      if (t < 1) {
        b.gfx.lineStyle(1.5, 0xe03333, b.alpha * 0.45);
        b.gfx.beginPath();
        b.gfx.moveTo(b.x, b.y);
        b.gfx.lineTo(b.x - b.len * (0.4 + t * 0.6), b.y);
        b.gfx.strokePath();
      } else {
        // Respawn
        const W = this.scale.width, H = this.scale.height;
        b.x = W * (0.55 + Math.random() * 0.38);
        b.y = H * (0.2  + Math.random() * 0.6);
        b.len = 40 + Math.random() * 100;
        b.life = 0;
        b.maxLife = 500 + Math.random() * 800;
        b.delay = Math.random() * 300;
      }
    });
  }

  // ── Button draw ───────────────────────────────────────────────────────────
  _drawBtn(g, x, y, w, h, hover) {
    g.clear();
    g.fillStyle(hover ? 0xff4444 : 0xe03333, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
    if (hover) {
      g.lineStyle(2, 0xff8888, 0.6);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 6);
    }
  }

  // ── Transition to Lobby ───────────────────────────────────────────────────
  _startGame() {
    if (this._transitioning) return;
    this._transitioning = true;

    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Lobby');
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _normal(pts, i, n) {
  const next = pts[(i + 1) % n];
  const prev = pts[(i + n - 1) % n];
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}
