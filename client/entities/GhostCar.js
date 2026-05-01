/**
 * GhostCar — renders a remote player's car with interpolation.
 *
 * Receives position updates from the server and smoothly interpolates
 * between them so motion looks fluid even at 20Hz server tick.
 */

// Distinct colours for each player slot
const PLAYER_COLOURS = [0xe03333, 0x3399ff, 0xffcc00, 0x33cc66];
const PLAYER_NAMES   = ['P1', 'P2', 'P3', 'P4'];

export default class GhostCar {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} playerIndex  0-3
   * @param {string} playerName   Display name from server
   */
  constructor(scene, playerIndex, playerName) {
    this.scene       = scene;
    this.playerIndex = playerIndex;
    this.colour      = PLAYER_COLOURS[playerIndex] || 0xaaaaaa;

    this.sprite = scene.add.graphics();
    this._drawCar();
    this.sprite.setDepth(9);
    this.sprite.setAlpha(0.82);

    // Name label — rendered in world space, positioned above the car each frame
    const label = playerName || PLAYER_NAMES[playerIndex] || `P${playerIndex + 1}`;
    this.label = scene.add.text(0, 0, label, {
      fontFamily:      "'Barlow Condensed', Arial",
      fontSize:        '15px',
      fontStyle:       'bold',
      color:           '#ffffff',
      stroke:          '#000000',
      strokeThickness: 4,
      backgroundColor: '#00000055',
      padding:         { x: 4, y: 2 },
    }).setOrigin(0.5, 1).setDepth(11);

    // Interpolation targets
    this.tx = 0; this.ty = 0; this.ta = 0;
    this.x  = 0; this.y  = 0; this.angle = 0;
    this._snapped = false;  // snap to first received position instantly
  }

  _drawCar() {
    const g = this.sprite;
    g.clear();

    // Shadow
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(5, 5, 50, 26);

    // Body
    g.fillStyle(this.colour, 1);
    g.fillRect(-22, -12, 44, 24);

    // Stripe
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(-22, -2, 44, 4);

    // Windscreen
    g.fillStyle(0x88ccff, 0.85);
    g.fillRect(4, -8, 13, 16);

    // Wheels
    g.fillStyle(0x111111, 1);
    g.fillRect(-22, -17, 10, 7);
    g.fillRect(-22,  10, 10, 7);
    g.fillRect( 12, -17, 10, 7);
    g.fillRect( 12,  10, 10, 7);

    // Headlights
    g.fillStyle(0xffee88, 1);
    g.fillRect(20, -9, 5, 6);
    g.fillRect(20,  3, 5, 6);
  }

  /** Receive a new authoritative state from server */
  applyState(state) {
    this.tx = state.x;
    this.ty = state.y;
    this.ta = state.angle;
    // Snap immediately on first update so ghost doesn't slide in from (0,0)
    if (!this._snapped) {
      this.x     = state.x;
      this.y     = state.y;
      this.angle = state.angle;
      this._snapped = true;
    }
  }

  /** Call every frame */
  update() {
    const LERP = 0.32;  // faster lerp = snappier tracking
    this.x     += (this.tx - this.x)     * LERP;
    this.y     += (this.ty - this.y)     * LERP;

    // Angle lerp (handle wrap-around)
    let da = this.ta - this.angle;
    if (da >  Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    this.angle += da * LERP;

    this.sprite.x        = this.x;
    this.sprite.y        = this.y;
    this.sprite.rotation = this.angle;

    this.label.x = this.x;
    this.label.y = this.y - 30;  // 30px above centre — clears the car roof and wheels
  }

  destroy() {
    this.sprite.destroy();
    this.label.destroy();
  }
}
