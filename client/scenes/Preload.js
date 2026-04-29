/**
 * Preload scene
 *
 * Loads any assets before the game starts.
 * Currently there are no external assets (everything is drawn with Phaser
 * graphics primitives), so it just transitions straight to GameScene.
 * Add texture / audio loads here as the game grows.
 */
export default class Preload extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    // Future: this.load.image(...), this.load.audio(...)
  }

  create() {
    this.scene.start('Lobby');
  }
}
