import { net } from '../systems/Network.js';
import { menu, showScreen, text } from '../systems/ui.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    showScreen(null);
    net.leave(); // back at the title means out of the lobby

    const W = this.scale.width;
    text(this, W / 2, 104, 'TRACK', 48, '#ffec27').setOrigin(0.5);
    text(this, W / 2, 160, 'RACER', 48, '#ff004d').setOrigin(0.5);

    menu(this, W / 2 - 40, 232, [
      { label: 'PLAY', action: () => this.scene.start('Lobby') },
      { label: 'CONTROLS', action: () => this.scene.start('SettingsScene') },
    ]);
  }
}
