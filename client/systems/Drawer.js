/**
 * Drawer
 *
 * Handles all canvas rendering and path-processing for the drawing phase.
 * Used by DrawingPhase.js.
 *
 * Features:
 *  - Real-time self-intersection detection (blocks invalid tracks)
 *  - Catmull-Rom spline smoothing at the start/end join for a seamless loop
 *  - Laplacian + resample pipeline for clean centerlines
 */

// ── Constants ──────────────────────────────────────────────────────────────
export const HALF_W_DRAW = 12;  // track half-width in canvas pixels
export const WORLD_SCALE = 10;  // upscale draw coords → Phaser world

// ── CSS injection ──────────────────────────────────────────────────────────

export function injectStyles() {
  if (document.getElementById('drawing-phase-styles')) return;
  const style = document.createElement('style');
  style.id = 'drawing-phase-styles';
  style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Barlow+Condensed:wght@400;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --red:    #e8312a;
  --gold:   #f5c518;
  --dark:   #0d0d0f;
  --panel:  #161618;
  --border: #2a2a2e;
  --text:   #e8e8ec;
  --muted:  #6b6b72;
}

body {
  background: var(--dark);
  color: var(--text);
  font-family: 'Barlow Condensed', sans-serif;
  overflow: hidden;
  height: 100vh;
}

#draw-phase {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

#draw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

#draw-header h1 {
  font-family: 'Rajdhani', sans-serif;
  font-size: 26px;
  letter-spacing: 3px;
  color: var(--red);
  text-transform: uppercase;
}

#draw-header .subtitle {
  font-size: 14px;
  color: var(--muted);
  letter-spacing: 1px;
}

#canvas-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  min-height: 0;
}

#drawCanvas {
  cursor: crosshair;
  border: 1px solid var(--border);
  border-radius: 4px;
  display: block;
  max-width: 100%;
  max-height: 100%;
}

#draw-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--panel);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.btn {
  padding: 9px 22px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.btn:hover  { opacity: 0.85; }
.btn:active { transform: scale(0.97); }

#btn-generate { background: var(--gold); color: #0d0d0f; }
#btn-clear    { background: var(--border); color: var(--muted); }
#btn-race {
  background: var(--red);
  color: #fff;
  display: none;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0   rgba(232, 49, 42, 0.6); }
  50%       { box-shadow: 0 0 0 8px rgba(232, 49, 42, 0);   }
}

#status {
  font-size: 14px;
  color: var(--muted);
  letter-spacing: 1px;
  flex: 1;
  transition: color 0.2s;
}
#status.warn { color: #ff6b6b; font-weight: 700; }

#game-phase { position: fixed; inset: 0; }
#game-phase canvas { display: block; }
  `;
  document.head.appendChild(style);
}

// ── Background ────────────────────────────────────────────────────────────

export function drawBackground(ctx, canvas) {
  ctx.fillStyle = '#1e4a1e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 1;
  for (let x = 0; x < canvas.width; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  ctx.save();
  ctx.font      = 'bold 15px "Barlow Condensed", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.textAlign = 'center';
  ctx.fillText('Click & drag to draw your track loop', canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillText('Try to return to where you started!',  canvas.width / 2, canvas.height / 2 + 14);
  ctx.restore();
}

// ── Self-intersection detection ───────────────────────────────────────────

/**
 * Strict segment-segment crossing test (shared endpoints do NOT count).
 * Returns true only for proper transversal intersections.
 */
function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const cross = (px, py, qx, qy, rx, ry) =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px);

  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);

  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/**
 * Incremental check: does the most recently added segment cross any earlier one?
 * Call this on every mousemove point addition for real-time feedback.
 *
 * To avoid false positives we skip the two segments adjacent to the new one.
 *
 * @param  {Array<{x,y}>} pts  Raw points array (≥ 2 entries)
 * @returns {boolean}
 */
export function hasNewCrossing(pts) {
  const n = pts.length;
  if (n < 4) return false;

  const ax = pts[n - 2].x, ay = pts[n - 2].y;
  const bx = pts[n - 1].x, by = pts[n - 1].y;

  // Skip segments i = n-3 (shares point pts[n-2]) — so check up to n-4
  for (let i = 0; i < n - 3; i++) {
    if (segsCross(ax, ay, bx, by,
                  pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)) {
      return true;
    }
  }
  return false;
}

/**
 * Full scan — checks every non-adjacent pair of segments.
 * Used once at generate-time for a definitive answer.
 *
 * @param  {Array<{x,y}>} pts
 * @returns {boolean}
 */
export function hasCrossing(pts) {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) {
      if (segsCross(
        pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y,
        pts[j].x, pts[j].y, pts[j+1].x, pts[j+1].y,
      )) return true;
    }
  }
  return false;
}

// ── Path processing ───────────────────────────────────────────────────────

/**
 * Laplacian smoothing (open polyline — preserves endpoints).
 */
export function smooth(pts, iters = 5) {
  let p = pts.slice();
  for (let k = 0; k < iters; k++) {
    const n = p.length;
    const next = new Array(n);
    next[0]     = p[0];
    next[n - 1] = p[n - 1];
    for (let i = 1; i < n - 1; i++) {
      next[i] = {
        x: (p[i - 1].x + 2 * p[i].x + p[i + 1].x) / 4,
        y: (p[i - 1].y + 2 * p[i].y + p[i + 1].y) / 4,
      };
    }
    p = next;
  }
  return p;
}

/**
 * Uniform arc-length resampling.
 */
export function resample(pts, spacing = 6) {
  if (pts.length < 2) return pts;
  const out = [{ ...pts[0] }];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    acc += Math.hypot(dx, dy);
    if (acc >= spacing) {
      out.push({ x: pts[i].x, y: pts[i].y });
      acc = 0;
    }
  }
  // Always keep the final point so the loop-close has the right anchor
  const last = pts[pts.length - 1];
  const prev = out[out.length - 1];
  if (prev.x !== last.x || prev.y !== last.y) out.push({ ...last });
  return out.length > 1 ? out : [{ ...pts[0] }, { ...pts[pts.length - 1] }];
}

/**
 * Catmull-Rom spline interpolation between p1 and p2,
 * with p0 and p3 as the surrounding control points.
 */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x +
               (-p0.x + p2.x) * t +
               (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
               (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y +
               (-p0.y + p2.y) * t +
               (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
               (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/**
 * Close the loop with a Catmull-Rom bridge.
 *
 * The four control points straddle the join seam:
 *   p0 = pts[n-2]  (second-to-last drawn point)
 *   p1 = pts[n-1]  (last drawn point → where the stroke ends)
 *   p2 = pts[0]    (first drawn point → where the stroke starts)
 *   p3 = pts[1]    (second drawn point)
 *
 * We interpolate `steps` bridge points between p1 and p2 so the
 * start/end join is C1-continuous rather than a sharp corner.
 *
 * @param  {Array<{x,y}>} pts
 * @param  {number}       steps  Bridge resolution (default 20)
 * @returns {Array<{x,y}>}
 */
export function closeLoop(pts, steps = 20) {
  const n = pts.length;
  if (n < 4) return pts;

  const p0 = pts[n - 2];
  const p1 = pts[n - 1];
  const p2 = pts[0];
  const p3 = pts[1];

  const bridge = [];
  for (let i = 1; i <= steps; i++) {
    bridge.push(catmullRom(p0, p1, p2, p3, i / (steps + 1)));
  }

  return [...pts, ...bridge];
}

/**
 * Compute left/right offset polylines from a closed centerline.
 */
export function offsets(pts, hw) {
  const L = [], R = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny =  dx / len;
    L.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw });
    R.push({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw });
  }
  return { L, R };
}

// ── Rendering helpers ─────────────────────────────────────────────────────

export function strokePoly(ctx, pts, close = false) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  if (close) ctx.closePath();
  ctx.stroke();
}

export function drawChecker(ctx, pA, pB, isCP) {
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const mx0 = pA.x + (pB.x - pA.x) * t0, my0 = pA.y + (pB.y - pA.y) * t0;
    const mx1 = pA.x + (pB.x - pA.x) * t1, my1 = pA.y + (pB.y - pA.y) * t1;
    const even = i % 2 === 0;
    ctx.strokeStyle = isCP ? (even ? '#0044cc' : '#88aaff') : (even ? '#000' : '#fff');
    ctx.lineWidth   = 5;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(mx0, my0); ctx.lineTo(mx1, my1); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function drawArrow(ctx, x, y, ang, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Render the full track preview onto the drawing canvas.
 */
export function renderPreview(ctx, canvas, pts, L, R) {
  drawBackground(ctx, canvas);

  // Track fill
  ctx.fillStyle = '#3b3b3b';
  ctx.beginPath();
  L.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  [...R].reverse().forEach(p => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();

  // Kerb stripes
  const SEG = 12;
  for (let i = 0; i < pts.length; i += SEG * 2) {
    const slL = L.slice(i, i + SEG);
    const slR = R.slice(i, i + SEG);
    ctx.strokeStyle = 'rgba(220,30,30,0.75)';
    ctx.lineWidth   = 5;
    if (slL.length > 1) strokePoly(ctx, slL);
    if (slR.length > 1) strokePoly(ctx, slR);
  }

  // Edge lines
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 2.5;
  strokePoly(ctx, L, true);
  strokePoly(ctx, R, true);

  // Centre dashes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([8, 10]);
  strokePoly(ctx, pts, true);
  ctx.setLineDash([]);

  // S/F gate
  const sfI = 3;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(L[sfI].x, L[sfI].y); ctx.lineTo(R[sfI].x, R[sfI].y); ctx.stroke();
  drawChecker(ctx, L[sfI], R[sfI], false);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Barlow Condensed", sans-serif';
  ctx.fillText('S/F', L[sfI].x + 4, L[sfI].y - 5);

  // Checkpoint gate
  const cpI = Math.floor(pts.length / 2);
  ctx.strokeStyle = '#88aaff'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(L[cpI].x, L[cpI].y); ctx.lineTo(R[cpI].x, R[cpI].y); ctx.stroke();
  drawChecker(ctx, L[cpI], R[cpI], true);
  ctx.fillStyle = '#88aaff'; ctx.font = 'bold 11px "Barlow Condensed", sans-serif';
  ctx.fillText('CP', L[cpI].x + 4, L[cpI].y - 5);

  // Starting direction arrow
  const s0  = pts[6];
  const s1  = pts[7] || pts[6];
  const ang = Math.atan2(s1.y - s0.y, s1.x - s0.x);
  drawArrow(ctx, s0.x, s0.y, ang, '#f5c518');
}
