// Waits for the pixel font, otherwise the first screen draws its text in a
// fallback font and never updates. Gives up after a few seconds if offline.
export default class Preload extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create() {
    const timeout = new Promise(resolve => setTimeout(resolve, 3000));
    Promise.race([document.fonts.load('8px "Press Start 2P"'), timeout])
      .catch(() => {})
      .then(() => this.scene.start('MenuScene'));
  }
}
