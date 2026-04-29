/**
 * DrawingPhase Scene
 *
 * A full Phaser scene for the drawing UI. Handles all canvas-based track drawing,
 * path processing, and transitions to GameScene.
 *
 * New features:
 *  - Real-time self-intersection detection: the stroke turns red and drawing
 *    is blocked as soon as lines would cross.
 *  - Catmull-Rom loop closure smooths the start/end seam automatically.
 */

import { net } from '../systems/Network.js';
import {
  injectStyles,
  drawBackground,
  smooth,
  resample,
  closeLoop,
  offsets,
  renderPreview,
  hasNewCrossing,
  hasCrossing,
  HALF_W_DRAW,
  WORLD_SCALE,
} from '../systems/Drawer.js';

export default class DrawingPhase extends Phaser.Scene {
  constructor() {
    super('DrawingPhase');
  }

  create() {
    injectStyles();

    this.drawPhaseEl = document.getElementById('draw-phase');
    this.gamePhaseEl = document.getElementById('game-phase');
    this.canvas      = document.getElementById('drawCanvas');
    this.ctx         = this.canvas.getContext('2d');
    this.wrap        = document.getElementById('canvas-wrap');
    this.statusEl    = document.getElementById('status');
    this.btnGenerate = document.getElementById('btn-generate');
    this.btnClear    = document.getElementById('btn-clear');
    this.btnRace     = document.getElementById('btn-race');

    this.drawPhaseEl.style.display = 'flex';
    this.gamePhaseEl.style.display = 'none';

    this._rawPts    = [];
    this._drawing   = false;
    this._blocked   = false;   // true while the current stroke has a crossing
    this._trackData = null;

    this._sizeCanvas();
    this._bindEvents();
    this.clear();
  }

  shutdown() {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown',  this._onDownBound);
      this.canvas.removeEventListener('mousemove',  this._onMoveBound);
      this.canvas.removeEventListener('mouseup',    this._onUpBound);
      this.canvas.removeEventListener('touchstart', this._onTouchStartBound);
      this.canvas.removeEventListener('touchmove',  this._onTouchMoveBound);
      this.canvas.removeEventListener('touchend',   this._onTouchEndBound);
    }
    if (this.btnGenerate) this.btnGenerate.removeEventListener('click', this._onGenerateBound);
    if (this.btnClear)    this.btnClear.removeEventListener('click', this._onClearBound);
    if (this.btnRace)     this.btnRace.removeEventListener('click', this._onRaceBound);
    if (this._resizeListener) window.removeEventListener('resize', this._resizeListener);
  }

  _sizeCanvas() {
    const W = Math.floor(this.wrap.clientWidth  - 24);
    const H = Math.floor(this.wrap.clientHeight - 24);
    this.canvas.width  = W;
    this.canvas.height = H;
    drawBackground(this.ctx, this.canvas);
  }

  _bindEvents() {
    const canvas = this.canvas;

    this._onDownBound = e => this._onDown(e);
    this._onMoveBound = e => this._onMove(e);
    this._onUpBound   = () => this._onUp();

    canvas.addEventListener('mousedown', this._onDownBound);
    canvas.addEventListener('mousemove', this._onMoveBound);
    canvas.addEventListener('mouseup',   this._onUpBound);

    const toMouse = e => ({
      clientX: e.touches[0]?.clientX ?? e.changedTouches[0].clientX,
      clientY: e.touches[0]?.clientY ?? e.changedTouches[0].clientY,
    });

    this._onTouchStartBound = e => { e.preventDefault(); this._onDown(toMouse(e)); };
    this._onTouchMoveBound  = e => { e.preventDefault(); this._onMove(toMouse(e)); };
    this._onTouchEndBound   = e => { e.preventDefault(); this._onUp(); };

    canvas.addEventListener('touchstart', this._onTouchStartBound, { passive: false });
    canvas.addEventListener('touchmove',  this._onTouchMoveBound,  { passive: false });
    canvas.addEventListener('touchend',   this._onTouchEndBound,   { passive: false });

    this._onGenerateBound = () => this.generateTrack();
    this._onClearBound    = () => this.clear();
    this._onRaceBound     = () => this._race();

    this.btnGenerate.addEventListener('click', this._onGenerateBound);
    this.btnClear.addEventListener('click', this._onClearBound);
    this.btnRace.addEventListener('click', this._onRaceBound);

    this._resizeListener = () => {
      if (this.drawPhaseEl.style.display !== 'none') this._sizeCanvas();
    };
    window.addEventListener('resize', this._resizeListener);
  }

  _getXY(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── Mouse / touch handlers ────────────────────────────────────────────────

  _onDown(e) {
    this._drawing   = true;
    this._blocked   = false;
    this._rawPts    = [];
    this._trackData = null;
    this.btnRace.style.display = 'none';

    // Fresh canvas for each new stroke
    drawBackground(this.ctx, this.canvas);

    const { x, y } = this._getXY(e);
    this._rawPts.push({ x, y });

    // Begin the live stroke path
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x, y);

    this._setStatus('Drawing…');
  }

  _onMove(e) {
    if (!this._drawing) return;

    const { x, y } = this._getXY(e);
    const pts = this._rawPts;

    // Throttle: only record a point if it moved enough (reduces noise)
    const last = pts[pts.length - 1];
    if (Math.hypot(x - last.x, y - last.y) < 3) return;

    pts.push({ x, y });

    // Check whether the new segment crosses any earlier one
    const crossing = hasNewCrossing(pts);

    if (crossing && !this._blocked) {
      // First frame of a crossing — warn the user
      this._blocked = true;
      this._setStatus('⚠ Lines can\'t cross — keep drawing or clear', true);
    } else if (!crossing && this._blocked) {
      // Crossing resolved (user looped back) — unblock
      this._blocked = false;
      this._setStatus('Drawing…');
    }

    const { ctx } = this;

    if (this._blocked) {
      // Draw the offending segment in red
      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = 'rgba(255,80,80,0.85)';
    } else {
      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    }

    ctx.lineTo(x, y);
    ctx.stroke();

    // Start a new sub-path from the current point so each
    // segment can be coloured independently next frame
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  _onUp() {
    this._drawing = false;

    if (this._blocked) {
      this._setStatus('⚠ Track has crossing lines — clear and try again', true);
      return;
    }

    if (this._rawPts.length > 30) {
      this._setStatus(`${this._rawPts.length} pts captured — click Generate Track`);
    } else {
      this._setStatus('Draw more — try a bigger loop!');
    }
  }

  // ── Track generation ──────────────────────────────────────────────────────

  generateTrack() {
    if (this._rawPts.length < 30) {
      this._setStatus('Draw more first — bigger loop!');
      return;
    }

    // Final crossing check on the raw points (catches any edge cases)
    if (hasCrossing(this._rawPts)) {
      this._setStatus('⚠ Track has crossing lines — clear and redraw', true);
      return;
    }

    // ── Processing pipeline ──────────────────────────────────────────────
    //
    // 1. Heavy smooth  — removes hand-wobble from the raw stroke
    // 2. Resample      — uniform point spacing
    // 3. Light smooth  — clean up after resample
    // 4. closeLoop     — Catmull-Rom bridge blends start ↔ end seamlessly
    // 5. Resample      — uniform spacing on the now-closed loop
    //
    let pts = smooth(this._rawPts, 8);
    pts = resample(pts, 5);
    pts = smooth(pts, 3);
    pts = closeLoop(pts, 24);   // 24-point Catmull-Rom bridge at the seam
    pts = resample(pts, 5);

    if (pts.length < 20) {
      this._setStatus('Track too short — draw a bigger loop!');
      return;
    }

    const { L, R } = offsets(pts, HALF_W_DRAW);

    renderPreview(this.ctx, this.canvas, pts, L, R);

    const sc = WORLD_SCALE;
    this._trackData = {
      centerline: pts.map(p => ({ x: p.x * sc, y: p.y * sc })),
      left:       L.map(p =>   ({ x: p.x * sc, y: p.y * sc })),
      right:      R.map(p =>   ({ x: p.x * sc, y: p.y * sc })),
      worldW:     this.canvas.width  * sc,
      worldH:     this.canvas.height * sc,
      halfWidth:  HALF_W_DRAW * sc,
    };

    this.btnRace.style.display = 'inline-block';
    this._setStatus('✓ Track ready — click Race! to drive it');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  clear() {
    this._rawPts    = [];
    this._drawing   = false;
    this._blocked   = false;
    this._trackData = null;
    this.btnRace.style.display = 'none';
    drawBackground(this.ctx, this.canvas);
    // Reset the live-stroke path so there's no stale moveTo
    this.ctx.beginPath();
    this._setStatus('Click & drag to draw your track loop');
    this.statusEl.classList.remove('warn');
  }

  _race() {
    if (!this._trackData) return;
    this.registry.set('trackData', this._trackData);
    // If in a multiplayer room, broadcast the track to guests
    if (net.socket && net.roomCode) {
      net.sendTrack(this._trackData);
    }
    // Show the Phaser canvas, hide the HTML drawing UI
    this.drawPhaseEl.style.display = 'none';
    this.gamePhaseEl.style.display = 'block';
    this.scene.start('GameScene');
  }

  _setStatus(msg, warn = false) {
    this.statusEl.textContent = msg;
    this.statusEl.classList.toggle('warn', warn);
  }
}
