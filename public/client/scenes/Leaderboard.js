import { net } from '../systems/Network.js';
import { blink, formatTime, menu, showScreen, text } from '../systems/ui.js';

// Results after a race: your lap times and what to do next.
export default class Leaderboard extends Phaser.Scene {
  constructor() {
    super('Leaderboard');
  }

  create() {
    showScreen(null);
    const { laps, total } = this.registry.get('result');
    const best = Math.min(...laps);
    const W = this.scale.width;
    const left = W / 2 - 96;
    const right = W / 2 + 96;

    text(this, W / 2, 64, 'FINISH', 32, '#ffec27').setOrigin(0.5);

    laps.forEach((t, i) => {
      const color = t === best ? '#ffec27' : '#fff1e8';
      text(this, left, 112 + i * 16, `LAP ${i + 1}`, 8, color);
      text(this, right, 112 + i * 16, formatTime(t), 8, color).setOrigin(1, 0);
    });
    const y = 120 + laps.length * 16;
    text(this, left, y, 'TOTAL');
    text(this, right, y, formatTime(total)).setOrigin(1, 0);

    const items = [{ label: 'MENU', action: () => this.scene.start('MenuScene') }];
    if (net.isHost) {
      items.unshift({ label: 'NEW TRACK', action: () => this.scene.start('DrawingPhase') });
    } else {
      blink(this, text(this, W / 2, 296, 'WAITING FOR HOST', 8, '#c2c3c7').setOrigin(0.5));
    }
    menu(this, W / 2 - 48, 224, items);

    // If the host leaves while we're sitting here, we might be the host now.
    const refresh = () => this.scene.restart();
    net.on('host_changed', refresh);
    this.events.once('shutdown', () => net.off('host_changed', refresh));
  }
}
