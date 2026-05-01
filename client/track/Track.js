/**
 * Track.js
 *
 * Core track geometry: surface drawing, isOnTrack, S/F gate crossing.
 * Knows nothing about checkpoints or the starting grid.
 */
export default class Track {
  constructor(data) {
    this.centerline = data.centerline;
    this.left       = data.left;
    this.right      = data.right;
    this.worldW     = data.worldW;
    this.worldH     = data.worldH;
    this.halfWidth  = data.halfWidth;

    this._buildSFGate();
  }

  // ── Start/Finish gate ─────────────────────────────────────────────────────

  _buildSFGate() {
    const gate = this._makeGate(3);   // near start of centerline
    this.sfX1 = gate.x1; this.sfY1 = gate.y1;
    this.sfX2 = gate.x2; this.sfY2 = gate.y2;
    this._sfGate = gate;
  }

  _makeGate(index) {
    const c    = this.centerline;
    const n    = c.length;
    const pt   = c[index % n];
    const prev = c[(index - 1 + n) % n];
    const next = c[(index + 1) % n];

    const dx  = next.x - prev.x;
    const dy  = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx  = -dy / len;
    const ny  =  dx / len;
    const fx  =  dx / len;
    const fy  =  dy / len;
    const w   = this.halfWidth * 1.25;

    return {
      x1: pt.x + nx * w, y1: pt.y + ny * w,
      x2: pt.x - nx * w, y2: pt.y - ny * w,
      nx, ny, fx, fy,
      cx: pt.x, cy: pt.y,
      angle: Math.atan2(fy, fx),
    };
  }

  /** Expose the raw SF gate for StartingGrid */
  get sfGate() { return this._sfGate; }

  // ── Drawing ───────────────────────────────────────────────────────────────

  draw(g) {
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

    // S/F line (drawn last so it overlaps the surface)
    this._drawSFLine(g);
  }

  _drawSFLine(g) {
    const { x1, y1, x2, y2 } = this;
    const x1s = this.sfX1, y1s = this.sfY1, x2s = this.sfX2, y2s = this.sfY2;
    const len  = Math.hypot(x2s - x1s, y2s - y1s);
    if (len < 1) return;

    const lx   = (x2s - x1s) / len;
    const ly   = (y2s - y1s) / len;
    const SEGS = 10;
    const sl   = len / SEGS;

    for (let i = 0; i < SEGS; i++) {
      const col = i % 2 === 0 ? 0x000000 : 0xffffff;
      g.fillStyle(col, 0.95);
      const ax = x1s + lx * i * sl, ay = y1s + ly * i * sl;
      const bx = ax  + lx * sl,     by = ay  + ly * sl;
      const pw = -ly * 5,            ph =  lx * 5;
      g.fillTriangle(ax - pw, ay - ph, bx - pw, by - ph, bx + pw, by + ph);
      g.fillTriangle(ax - pw, ay - ph, bx + pw, by + ph, ax + pw, ay + ph);
    }

    g.lineStyle(5, 0xffffff, 1);
    g.beginPath(); g.moveTo(x1s, y1s); g.lineTo(x2s, y2s); g.strokePath();
  }

  _strokePoly(g, pts, close = false) {
    g.beginPath();
    pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    if (close) g.closePath();
    g.strokePath();
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

  crossedStartFinish(prevX, prevY, curX, curY) {
    return _segmentsCross(
      prevX, prevY, curX, curY,
      this.sfX1, this.sfY1, this.sfX2, this.sfY2,
    );
  }
}

// ── Shared helper ─────────────────────────────────────────────────────────────
export function _segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const cross = (px, py, qx, qy, rx, ry) =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px);

  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);

  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
