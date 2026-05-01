/**
 * Checkpoints.js
 *
 * Places NUM_CHECKPOINTS gates evenly around the track (skipping the
 * region near the S/F line). Tracks which ones have been passed in
 * the current lap and exposes the respawn position of the last one hit.
 *
 * Lap rule: all checkpoints must be passed (in any order) before the
 * S/F crossing counts as a completed lap.
 */

import { _segmentsCross } from './Track.js';

const NUM_CHECKPOINTS = 7;    // gates evenly spread around the loop
const SF_SKIP_FRAC    = 0.08; // fraction of track to skip around the S/F gate

export default class Checkpoints {
  /**
   * @param {Array<{x,y}>} centerline
   * @param {number} halfWidth
   */
  constructor(centerline, halfWidth) {
    this._c  = centerline;
    this._hw = halfWidth;
    this._gates = this._build();

    // Per-lap state
    this._passedSet  = new Set();   // indices of gates hit this lap
    this._lastIdx    = -1;          // index of most recently crossed gate
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  _build() {
    const n     = this._c.length;
    const gates = [];

    for (let i = 0; i < NUM_CHECKPOINTS; i++) {
      // Spread evenly in (SF_SKIP_FRAC … 1.0) fraction of the track
      const frac = SF_SKIP_FRAC + (i / NUM_CHECKPOINTS) * (1.0 - SF_SKIP_FRAC);
      const idx  = Math.floor(frac * n);
      gates.push({ ...this._makeGate(idx), index: i });
    }

    return gates;
  }

  _makeGate(idx) {
    const c    = this._c;
    const n    = c.length;
    const pt   = c[idx % n];
    const prev = c[(idx - 1 + n) % n];
    const next = c[(idx + 1) % n];

    const dx  = next.x - prev.x;
    const dy  = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx  = -dy / len;
    const ny  =  dx / len;
    const fx  =  dx / len;
    const fy  =  dy / len;
    const w   = this._hw * 1.25;

    return {
      x1: pt.x + nx * w, y1: pt.y + ny * w,
      x2: pt.x - nx * w, y2: pt.y - ny * w,
      cx: pt.x, cy: pt.y,
      angle: Math.atan2(fy, fx),
    };
  }

  // ── Per-lap state ─────────────────────────────────────────────────────────

  /** Call when a lap completes (S/F crossed with all checkpoints passed). */
  resetLap() {
    this._passedSet.clear();
    this._lastIdx = -1;
  }

  /** True if every checkpoint has been hit at least once this lap. */
  allPassed() {
    return this._passedSet.size >= NUM_CHECKPOINTS;
  }

  /**
   * World-space position of the last-passed checkpoint gate centre,
   * or null if none has been passed yet this lap.
   * @returns {{x, y, angle}|null}
   */
  lastPassedPosition() {
    if (this._lastIdx < 0) return null;
    const g = this._gates[this._lastIdx];
    return { x: g.cx, y: g.cy, angle: g.angle };
  }

  // ── Crossing detection ────────────────────────────────────────────────────

  /**
   * Call every frame with the car's movement segment.
   * Returns the index (0-based) of the gate crossed, or -1 if none.
   * Also updates internal lap state automatically.
   */
  update(prevX, prevY, curX, curY) {
    for (const gate of this._gates) {
      if (_segmentsCross(prevX, prevY, curX, curY,
                         gate.x1, gate.y1, gate.x2, gate.y2)) {
        if (!this._passedSet.has(gate.index)) {
          this._passedSet.add(gate.index);
          this._lastIdx = gate.index;
        }
        return gate.index;
      }
    }
    return -1;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  /** Draw all checkpoint gates onto a Phaser Graphics object. */
  draw(g) {
    this._gates.forEach(gate => this._drawGate(g, gate));
  }

  _drawGate(g, gate) {
    const { x1, y1, x2, y2 } = gate;
    const len  = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;

    const lx   = (x2 - x1) / len;
    const ly   = (y2 - y1) / len;
    const SEGS = 10;
    const sl   = len / SEGS;

    for (let i = 0; i < SEGS; i++) {
      const even = i % 2 === 0;
      const col  = even ? 0x0044cc : 0x88aaff;
      g.fillStyle(col, 0.9);
      const ax = x1 + lx * i * sl, ay = y1 + ly * i * sl;
      const bx = ax + lx * sl,     by = ay + ly * sl;
      const pw = -ly * 4,           ph =  lx * 4;
      g.fillTriangle(ax - pw, ay - ph, bx - pw, by - ph, bx + pw, by + ph);
      g.fillTriangle(ax - pw, ay - ph, bx + pw, by + ph, ax + pw, ay + ph);
    }

    g.lineStyle(4, 0x88aaff, 0.95);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
  }
}
