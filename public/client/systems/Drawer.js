// Everything for the drawing screen: turning a mouse stroke into a clean
// closed loop, and drawing strokes/tracks onto a 2D canvas.

import { START_INDEX, pointAt, segmentsCross } from '../track/Track.js';

// Tracks are drawn on a 1024x640 grid and scaled up 10x for the race.
export const WIDTH = 1024;
export const HEIGHT = 640;
export const HALF_WIDTH = 12;
export const WORLD_SCALE = 10;

// Index of the earlier segment that the newest segment crosses, or -1.
export function lastSegmentCrossing(pts) {
  const n = pts.length;
  if (n < 4) return -1;
  const a = pts[n - 2];
  const b = pts[n - 1];
  // Stop before n - 3: that segment shares a point with the new one.
  for (let i = 0; i < n - 3; i++) {
    if (segmentsCross(a.x, a.y, b.x, b.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)) return i;
  }
  return -1;
}

function loopCrosses(pts) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // neighbours through pts[0]
      const c = pts[j];
      const d = pts[(j + 1) % n];
      if (segmentsCross(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)) return true;
    }
  }
  return false;
}

// Averages each point with its neighbours. Keeps the two ends in place.
function smooth(pts, iterations) {
  for (let k = 0; k < iterations; k++) {
    pts = pts.map((p, i) => {
      if (i === 0 || i === pts.length - 1) return p;
      const a = pts[i - 1];
      const b = pts[i + 1];
      return { x: (a.x + 2 * p.x + b.x) / 4, y: (a.y + 2 * p.y + b.y) / 4 };
    });
  }
  return pts;
}

// Drops points until they're roughly `spacing` apart.
function resample(pts, spacing) {
  const out = [pts[0]];
  let dist = 0;
  for (let i = 1; i < pts.length; i++) {
    dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (dist >= spacing) {
      out.push(pts[i]);
      dist = 0;
    }
  }
  const last = pts[pts.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a, b, c, d) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

// Bridges the gap from the end of the stroke back to its start with a curve
// so the join is smooth instead of a sharp corner.
function closeLoop(pts, steps) {
  const n = pts.length;
  const bridge = [];
  for (let i = 1; i <= steps; i++) {
    bridge.push(catmullRom(pts[n - 2], pts[n - 1], pts[0], pts[1], i / (steps + 1)));
  }
  return [...pts, ...bridge];
}

// Returns an evenly spaced, smooth closed loop, or null if it crosses itself.
export function buildLoop(stroke) {
  let pts = smooth(stroke, 8);
  pts = resample(pts, 5);
  pts = smooth(pts, 3);
  pts = closeLoop(pts, 24);
  pts = resample(pts, 5);
  if (pts.length < 20 || loopCrosses(pts)) return null;
  return pts;
}

// The canvases are lower resolution than the drawing grid on purpose so they
// come out chunky; this maps grid coordinates onto them.
export function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return ctx;
}

function path(ctx, pts, close = false) {
  ctx.beginPath();
  for (const p of pts) ctx.lineTo(p.x, p.y);
  if (close) ctx.closePath();
}

export function drawStroke(ctx, pts, blocked = false) {
  ctx.fillStyle = '#008751';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (!pts.length) return;

  path(ctx, pts);
  ctx.strokeStyle = blocked ? '#ff004d' : '#fff1e8';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Mark where the stroke started, so you know where to come back to.
  ctx.fillStyle = '#ffec27';
  ctx.fillRect(pts[0].x - 6, pts[0].y - 6, 12, 12);
}

export function drawTrack(ctx, loop) {
  drawStroke(ctx, []);

  path(ctx, loop, true);
  ctx.strokeStyle = '#5f574f';
  ctx.lineWidth = HALF_WIDTH * 2;
  ctx.stroke();

  const s = pointAt(loop, START_INDEX);
  ctx.beginPath();
  ctx.moveTo(s.x - s.fy * HALF_WIDTH, s.y + s.fx * HALF_WIDTH);
  ctx.lineTo(s.x + s.fy * HALF_WIDTH, s.y - s.fx * HALF_WIDTH);
  ctx.strokeStyle = '#fff1e8';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Arrow showing which way the race goes.
  const a = pointAt(loop, START_INDEX + 6);
  ctx.beginPath();
  ctx.moveTo(a.x + a.fx * 10, a.y + a.fy * 10);
  ctx.lineTo(a.x - a.fx * 6 - a.fy * 7, a.y - a.fy * 6 + a.fx * 7);
  ctx.lineTo(a.x - a.fx * 6 + a.fy * 7, a.y - a.fy * 6 - a.fx * 7);
  ctx.fillStyle = '#ffec27';
  ctx.fill();
}
