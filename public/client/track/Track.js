// Where the start/finish line sits along the centerline.
export const START_INDEX = 3;

export function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const cross = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// Point i of a closed loop, plus the unit direction of travel (fx, fy) there.
export function pointAt(pts, i) {
  const n = pts.length;
  const p = pts[i % n];
  const a = pts[(i - 1 + n) % n];
  const b = pts[(i + 1) % n];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: p.x, y: p.y, fx: (b.x - a.x) / len, fy: (b.y - a.y) / len };
}

export default class Track {
  constructor({ centerline, halfWidth, worldW, worldH }) {
    this.centerline = centerline;
    this.halfWidth = halfWidth;
    this.worldW = worldW;
    this.worldH = worldH;

    this.left = [];
    this.right = [];
    for (let i = 0; i < centerline.length; i++) {
      const { x, y, fx, fy } = pointAt(centerline, i);
      this.left.push({ x: x - fy * halfWidth, y: y + fx * halfWidth });
      this.right.push({ x: x + fy * halfWidth, y: y - fx * halfWidth });
    }

    this.start = this.gate(START_INDEX);
  }

  // A line across the track at centerline point i, facing the way we race.
  gate(i) {
    const p = pointAt(this.centerline, i);
    return { ...p, angle: Math.atan2(p.fy, p.fx) };
  }

  crosses(gate, x0, y0, x1, y1) {
    // A bit wider than the road so clipping the grass still counts.
    const w = this.halfWidth * 1.25;
    return segmentsCross(x0, y0, x1, y1,
      gate.x - gate.fy * w, gate.y + gate.fx * w,
      gate.x + gate.fy * w, gate.y - gate.fx * w);
  }

  crossedStart(x0, y0, x1, y1) {
    return this.crosses(this.start, x0, y0, x1, y1);
  }

  isOnTrack(x, y) {
    const hw2 = this.halfWidth * this.halfWidth;
    const c = this.centerline;
    const n = c.length;

    for (let i = 0; i < n; i++) {
      const a = c[i];
      const b = c[(i + 1) % n];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const ab2 = abx * abx + aby * aby;
      const t = ab2 ? Phaser.Math.Clamp(((x - a.x) * abx + (y - a.y) * aby) / ab2, 0, 1) : 0;
      const dx = a.x + t * abx - x;
      const dy = a.y + t * aby - y;
      if (dx * dx + dy * dy <= hw2) return true;
    }
    return false;
  }

  draw(g) {
    g.fillStyle(0x008751).fillRect(0, 0, this.worldW, this.worldH);

    // Road, one quad per segment. Filling it as a single ring-shaped polygon
    // left a wedge of grass across the road where the ring's ends meet.
    const L = this.left;
    const R = this.right;
    const n = L.length;
    g.fillStyle(0x5f574f);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      g.fillTriangle(L[i].x, L[i].y, L[j].x, L[j].y, R[j].x, R[j].y);
      g.fillTriangle(L[i].x, L[i].y, R[j].x, R[j].y, R[i].x, R[i].y);
    }

    // Kerbs: white edges with short red blocks.
    g.lineStyle(12, 0xfff1e8);
    g.strokePoints(this.left, true);
    g.strokePoints(this.right, true);
    g.lineStyle(12, 0xff004d);
    for (let i = 0; i < this.left.length; i += 4) {
      g.strokePoints(this.left.slice(i, i + 3));
      g.strokePoints(this.right.slice(i, i + 3));
    }

    // Chequered start/finish line, two rows deep.
    const { x, y, fx, fy } = this.start;
    const hw = this.halfWidth;
    const s = hw / 5;
    const at = (u, v) => ({ x: x + fx * v - fy * u, y: y + fy * v + fx * u });
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 2; j++) {
        const u = -hw + i * s;
        const v = (j - 1) * s;
        g.fillStyle((i + j) % 2 ? 0x000000 : 0xfff1e8);
        g.fillPoints([at(u, v), at(u + s, v), at(u + s, v + s), at(u, v + s)], true);
      }
    }
  }
}
