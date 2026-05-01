/**
 * StartingGrid.js
 *
 * Builds and draws the 4-slot F1-style starting grid behind the S/F line.
 * Grid positions are returned as {x, y, angle} world-space spawn points.
 */
export default class StartingGrid {
  /**
   * @param {{ cx, cy, fx, fy, nx, ny }} sfGate  S/F gate geometry from Track
   * @param {number} halfWidth
   */
  constructor(sfGate, halfWidth) {
    this._sf = sfGate;
    this._hw = halfWidth;
    this._slots = this._build();
  }

  // ── Build slots ───────────────────────────────────────────────────────────

  _build() {
    const { cx, cy, fx, fy, nx, ny } = this._sf;
    const hw      = this._hw;
    const laneOff = hw * 0.45;
    const rowGap  = hw * 1.1;
    const angle   = Math.atan2(fy, fx);

    return [
      // Row 0 — closest to line
      { depth: hw * 1.2,            side:  laneOff },
      { depth: hw * 1.2,            side: -laneOff },
      // Row 1 — further back
      { depth: hw * 1.2 + rowGap,   side:  laneOff },
      { depth: hw * 1.2 + rowGap,   side: -laneOff },
    ].map(({ depth, side }) => ({
      x: cx - fx * depth + nx * side,
      y: cy - fy * depth + ny * side,
      angle,
      // store geometry for box drawing
      cx: cx - fx * depth + nx * side,
      cy: cy - fy * depth + ny * side,
      fx, fy, nx, ny,
    }));
  }

  /** @param {number} slotIndex  0-3 */
  getPosition(slotIndex) {
    return this._slots[Math.min(slotIndex, this._slots.length - 1)];
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  /**
   * Draw F1-style open corner-bracket markers for each slot.
   * @param {Phaser.GameObjects.Graphics} g
   * @param {Phaser.Scene} [scene]  if provided, slot numbers are added as text
   */
  draw(g, scene) {
    const bw   = this._hw * 0.55;
    const bl   = this._hw * 0.9;
    const armF = bl * 0.38;
    const armN = bw * 0.38;
    const lw   = 3.5;

    this._slots.forEach((slot, idx) => {
      const { cx, cy, fx, fy, nx, ny } = slot;

      const TL = { x: cx + fx * bl + nx * bw, y: cy + fy * bl + ny * bw };
      const TR = { x: cx + fx * bl - nx * bw, y: cy + fy * bl - ny * bw };
      const BL = { x: cx - fx * bl + nx * bw, y: cy - fy * bl + ny * bw };
      const BR = { x: cx - fx * bl - nx * bw, y: cy - fy * bl - ny * bw };

      const drawCorner = (corner, fa, na) => {
        const fEnd = { x: corner.x - fx * armF * fa, y: corner.y - fy * armF * fa };
        const nEnd = { x: corner.x - nx * armN * na, y: corner.y - ny * armN * na };
        g.lineStyle(lw, 0xffffff, 0.9);
        g.beginPath();
        g.moveTo(fEnd.x, fEnd.y);
        g.lineTo(corner.x, corner.y);
        g.lineTo(nEnd.x, nEnd.y);
        g.strokePath();
      };

      drawCorner(TL, +1, +1);
      drawCorner(TR, +1, -1);
      drawCorner(BL, -1, +1);
      drawCorner(BR, -1, -1);

      if (scene) {
        scene.add.text(cx, cy, String(idx + 1), {
          fontFamily: 'Arial Black',
          fontSize:   `${Math.round(this._hw * 0.4)}px`,
          color:      '#ffffff',
        }).setAlpha(0.30).setOrigin(0.5).setDepth(2);
      }
    });
  }
}
