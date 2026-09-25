import { CAR_COLORS } from '../entities/Car.js';
import { net } from '../systems/Network.js';
import { hex, showScreen } from '../systems/ui.js';

const $ = id => document.getElementById(id);

// The lobby is an HTML screen (index.html) because it needs a text box.
export default class Lobby extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  create() {
    showScreen('lobby');

    // Assigned rather than addEventListener'd so coming back here doesn't
    // stack up a second copy of each handler.
    $('join').onsubmit = e => {
      e.preventDefault();
      this.join();
    };
    $('draw-track').onclick = () => this.scene.start('DrawingPhase');
    $('lobby-back').onclick = () => this.scene.start('MenuScene');

    const refresh = () => this.refresh();
    net.on('players', refresh);
    this.events.once('shutdown', () => net.off('players', refresh));

    $('error').textContent = '';
    this.refresh();
    if (!net.joined) $('name').focus();
  }

  join() {
    const button = $('join-button');
    button.disabled = true;
    $('error').textContent = '';

    net.join($('name').value, res => {
      button.disabled = false;
      // Went back to the menu before the server answered.
      if (!this.scene.isActive()) return net.leave();
      if (res.error) {
        $('error').textContent = res.error;
        return;
      }
      if (res.track) {
        // A race is already going, jump straight in.
        this.registry.set('track', res.track);
        this.scene.start('GameScene');
        return;
      }
      this.refresh();
    });
  }

  refresh() {
    $('join').hidden = net.joined;
    $('room').hidden = !net.joined;
    if (!net.joined) return;

    const players = [...net.players.values()].sort((a, b) => a.index - b.index);
    $('count').textContent = `LOBBY ${players.length}/4`;
    $('players').replaceChildren(...players.map(p => {
      const li = document.createElement('li');
      li.textContent = `${p.index + 1}P ${p.name}`
        + (p.id === net.hostId ? ' HOST' : '')
        + (p.id === net.playerId ? ' (YOU)' : '');
      li.style.color = hex(CAR_COLORS[p.index] ?? 0xfff1e8);
      return li;
    }));
    $('draw-track').hidden = !net.isHost;
    $('wait').hidden = net.isHost;
  }
}
