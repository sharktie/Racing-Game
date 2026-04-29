/**
 * CustomTrack
 *
 * Wraps the raw trackData object produced by DrawingPhase and exposes:
 *  - draw(graphics)           — renders the full track into a Phaser Graphics object
 *  - isOnTrack(x, y)          — returns true if world-space position is on tarmac
 *  - crossedStartFinish(...)  — segment/gate crossing test
 *  - crossedCheckpoint(...)   — segment/gate crossing test
 *  - startX / startY / startAngle  — car spawn position (box 1, behind S/F line)
 */
export default class CustomTrack {
  constructor(data) {
    this.centerline = data.centerline;
    this.left       = data.left;
    this.right      = data.right;
    this.worldW     = data.worldW;
    this.worldH     = data.worldH;
    this.halfWidth  = data.halfWidth;

    this._buildGates();
    this._buildStartPosition();
  }

  // ── Gate geometry ─────────────────────────────────────────────────────────

  _makeGate(index) {
    const c    = this.centerline;
    const n    = c.length;
    const pt   = c[index % n];
    const prev = c[(index - 1 + n) % n];
    const next = c[(index + 1) % n];

    const dx  = next.x - prev.x;
    const dy  = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    // Normal (perpendicular, pointing left of travel)
    const nx  = -dy / len;
    const ny  =  dx / len;
    // Forward direction (along travel)
    const fx  =  dx / len;
    const fy  =  dy / len;
    const w   = this.halfWidth * 1.25;

    return {
      x1: pt.x + nx * w, y1: pt.y + ny * w,
      x2: pt.x - nx * w, y2: pt.y - ny * w,
      // also expose the normal and forward vectors for grid box placement
      nx, ny, fx, fy, cx: pt.x, cy: pt.y,
    };
  }

  _buildGates() {
    this._sfGate = this._makeGate(3);
    const sf = this._sfGate;
    this.sfX1 = sf.x1; this.sfY1 = sf.y1;
    this.sfX2 = sf.x2; this.sfY2 = sf.y2;

    const cp = this._makeGate(Math.floor(this.centerline.length / 2));
    this.cpX1 = cp.x1; this.cpY1 = cp.y1;
    this.cpX2 = cp.x2; this.cpY2 = cp.y2;
  }

  /**
   * Build 4 grid positions behind the S/F line — 2 rows of 2.
   * Row 1: slots 0 (left) and 1 (right) — closest to line
   * Row 2: slots 2 (left) and 3 (right) — further back
   */
  _buildStartPosition() {
    const sf      = this._sfGate;
    const hw      = this.halfWidth;
    const laneOff = hw * 0.45;
    const rowGap  = hw * 1.1;

    const slots = [
      // row 0
      { depth: hw * 1.2,           side:  laneOff },   // slot 0: left,  near
      { depth: hw * 1.2 + rowGap,  side: -laneOff },   // slot 1: right, near-ish
      // row 1
      { depth: hw * 1.2 + rowGap,  side:  laneOff },   // slot 2: left,  far
      { depth: hw * 1.2 + rowGap*2,side: -laneOff },   // slot 3: right, far
    ];

    this._gridSlots = slots.map(({ depth, side }) => ({
      x:     sf.cx - sf.fx * depth + sf.nx * side,
      y:     sf.cy - sf.fy * depth + sf.ny * side,
      angle: Math.atan2(sf.fy, sf.fx),
      // for drawing box outlines
      cx: sf.cx - sf.fx * depth + sf.nx * side,
      cy: sf.cy - sf.fy * depth + sf.ny * side,
      fx: sf.fx, fy: sf.fy, nx: sf.nx, ny: sf.ny,
    }));

    this._gridBoxes = this._gridSlots;
  }

  /** @param {number} index  0-3 player slot */
  getGridPosition(index) {
    return this._gridSlots[Math.min(index, this._gridSlots.length - 1)];
  }

  // Legacy single-player compat
  get startX()     { return this._gridSlots[0].x;     }
  get startY()     { return this._gridSlots[0].y;     }
  get startAngle() { return this._gridSlots[0].angle; }

  // ── Drawing ───────────────────────────────────────────────────────────────

  draw(g, scene) {
    // Grass background
    g.fillStyle(0x1e4a1e, 1);
    g.fillRect(0, 0, this.worldW, this.worldH);

    // Track surface
    const poly = [...this.left, ...[...this.right].reverse()];
    g.fillStyle(0x363636, 1);
    g.fillPoints(poly, true);

    // Kerb stripes
    const SEG = 12;
    const n   = this.centerline.length;
    for (let i = 0; i < n; i += SEG * 2) {
      const sL = this.left.slice(i, i + SEG);
      const sR = this.right.slice(i, i + SEG);
      g.lineStyle(8, 0xcc2020, 1);
      if (sL.length > 1) this._strokePoly(g, sL);
      if (sR.length > 1) this._strokePoly(g, sR);
    }

    // White edge lines
    g.lineStyle(4, 0xffffff, 0.55);
    this._strokePoly(g, this.left,  true);
    this._strokePoly(g, this.right, true);

    // Centre dashes
    g.lineStyle(2, 0xffffff, 0.14);
    for (let i = 0; i < n - 1; i += 2) {
      const a = this.centerline[i];
      const b = this.centerline[i + 1];
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath();
    }

    // Grid boxes (drawn before gates so gate overlaps them)
    this._drawGridBoxes(g, scene);

    // Gates
    this._drawGate(g, this.sfX1, this.sfY1, this.sfX2, this.sfY2, false);
    this._drawGate(g, this.cpX1, this.cpY1, this.cpX2, this.cpY2, true);
  }

  /**
   * Draw two F1-style starting grid boxes behind the S/F line.
   * Each box is a painted rectangle on the tarmac.
   */
  _drawGridBoxes(g, scene) {
    const bw = this.halfWidth * 0.55;  // box half-width (across track)
    const bl = this.halfWidth * 0.9;   // box half-length (along track)

    this._gridBoxes.forEach((box, idx) => {
      const { cx, cy, fx, fy, nx, ny } = box;

      // Four corners of the box
      const corners = [
        { x: cx + fx * bl + nx * bw, y: cy + fy * bl + ny * bw },
        { x: cx + fx * bl - nx * bw, y: cy + fy * bl - ny * bw },
        { x: cx - fx * bl - nx * bw, y: cy - fy * bl - ny * bw },
        { x: cx - fx * bl + nx * bw, y: cy - fy * bl + ny * bw },
      ];

      // White painted box outline
      g.lineStyle(3, 0xffffff, 0.85);
      g.beginPath();
      corners.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.closePath();
      g.strokePath();

      // Subtle white fill
      g.fillStyle(0xffffff, 0.07);
      g.fillPoints(corners, true);

      // Box number label
      if (scene) {
        scene.add.text(cx, cy, String(idx + 1), {
          fontFamily: 'Arial Black',
          fontSize:   `${Math.round(this.halfWidth * 0.45)}px`,
          color:      '#ffffff',
        }).setAlpha(0.45).setOrigin(0.5).setDepth(2);
      }
    });
  }

  _strokePoly(g, pts, close = false) {
    g.beginPath();
    pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    if (close) g.closePath();
    g.strokePath();
  }

  _drawGate(g, x1, y1, x2, y2, isCheckpoint) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;

    const lx   = (x2 - x1) / len;
    const ly   = (y2 - y1) / len;
    const SEGS = 10;
    const sl   = len / SEGS;

    for (let i = 0; i < SEGS; i++) {
      const even = i % 2 === 0;
      const col  = isCheckpoint ? (even ? 0x0044cc : 0x88aaff) : (even ? 0x000000 : 0xffffff);
      g.fillStyle(col, 0.95);
      const ax = x1 + lx * i * sl, ay = y1 + ly * i * sl;
      const bx = ax + lx * sl,     by = ay + ly * sl;
      const pw = -ly * 5,           ph =  lx * 5;
      g.fillTriangle(ax - pw, ay - ph, bx - pw, by - ph, bx + pw, by + ph);
      g.fillTriangle(ax - pw, ay - ph, bx + pw, by + ph, ax + pw, ay + ph);
    }

    const lc = isCheckpoint ? 0x88aaff : 0xffffff;
    g.lineStyle(5, lc, 1);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
  }

  // ── Spatial queries ───────────────────────────────────────────────────────

  isOnTrack(x, y) {
    const hw2 = this.halfWidth * this.halfWidth;
    const c   = this.centerline;
    const n   = c.length;

    for (let i = 0; i < n; i++) {
      const ax = c[i].x,           ay = c[i].y;
      const bx = c[(i + 1) % n].x, by = c[(i + 1) % n].y;

      const abx = bx - ax, aby = by - ay;
      const ab2 = abx * abx + aby * aby;

      let dist2;
      if (ab2 === 0) {
        const dx = x - ax, dy = y - ay;
        dist2 = dx * dx + dy * dy;
      } else {
        const t  = Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / ab2));
        const px = ax + t * abx - x;
        const py = ay + t * aby - y;
        dist2 = px * px + py * py;
      }

      if (dist2 <= hw2) return true;
    }
    return false;
  }

  _segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
    const cross = (px, py, qx, qy, rx, ry) =>
      (qx - px) * (ry - py) - (qy - py) * (rx - px);

    const d1 = cross(cx, cy, dx, dy, ax, ay);
    const d2 = cross(cx, cy, dx, dy, bx, by);
    const d3 = cross(ax, ay, bx, by, cx, cy);
    const d4 = cross(ax, ay, bx, by, dx, dy);

    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  crossedStartFinish(prevX, prevY, curX, curY) {
    return this._segmentsCross(prevX, prevY, curX, curY,
      this.sfX1, this.sfY1, this.sfX2, this.sfY2);
  }

  crossedCheckpoint(prevX, prevY, curX, curY) {
    return this._segmentsCross(prevX, prevY, curX, curY,
      this.cpX1, this.cpY1, this.cpX2, this.cpY2);
  }
}
