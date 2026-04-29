/**
 * Camera system
 *
 * During countdown: follows with lerpX/Y = 1 (instant snap, no drift).
 * Once driving starts: switches to smooth lerp (0.09).
 *
 * Call setSmoothFollow() when the race begins.
 */
export default class Camera {
  constructor(scene, target, worldW, worldH) {
    this._cam    = scene.cameras.main;
    this._target = target;

    this._cam.setBounds(0, 0, worldW, worldH);
    this._cam.setZoom(1.25);

    // Instant-snap follow so the car is centred from frame 1
    this._cam.startFollow(target.sprite, true, 1, 1);
  }

  /** Call this when the race goes green to switch to smooth follow. */
  setSmoothFollow() {
    this._cam.startFollow(this._target.sprite, true, 0.09, 0.09);
  }
}
