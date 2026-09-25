import DrawingPhase from './client/scenes/DrawingPhase.js';
import GameScene from './client/scenes/GameScene.js';
import Leaderboard from './client/scenes/Leaderboard.js';
import Lobby from './client/scenes/Lobby.js';
import MenuScene from './client/scenes/MenuScene.js';
import Preload from './client/scenes/Preload.js';
import SettingsScene from './client/scenes/SettingsScene.js';
import { drawStroke, setupCanvas } from './client/systems/Drawer.js';
import { net } from './client/systems/Network.js';
import { fitCanvases } from './client/systems/ui.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 640,
  height: 360,
  backgroundColor: '#000000',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Preload, MenuScene, SettingsScene, Lobby, DrawingPhase, GameScene, Leaderboard],
});

// These network events can arrive while any scene is showing, so they're
// handled here. this.scene.start() inside a scene only stops that one scene,
// which left e.g. the results screen drawn over a new race.
function switchTo(key) {
  for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.scene.key);
  game.scene.start(key);
}

const watch = document.getElementById('watch');
const watchCtx = setupCanvas(document.getElementById('watch-canvas'));

// Guests watch the host draw.
net.on('draw_stroke', ({ points, blocked }) => {
  if (net.isHost) return;
  watch.hidden = false;
  fitCanvases();
  drawStroke(watchCtx, points || [], blocked);
});

net.on('draw_clear', () => {
  watch.hidden = true;
});

net.on('track', track => {
  watch.hidden = true;
  game.registry.set('track', track);
  switchTo('GameScene');
});

net.on('disconnected', () => {
  watch.hidden = true;
  switchTo('MenuScene');
});

document.getElementById('watch-leave').onclick = () => {
  watch.hidden = true;
  switchTo('MenuScene');
};
