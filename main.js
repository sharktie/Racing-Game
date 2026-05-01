import Preload      from './client/scenes/Preload.js';
import MenuScene    from './client/scenes/MenuScene.js';
import Lobby        from './client/scenes/Lobby.js';
import DrawingPhase from './client/scenes/DrawingPhase.js';
import GameScene    from './client/scenes/GameScene.js';

const game = new Phaser.Game({
  type:            Phaser.AUTO,
  width:           window.innerWidth,
  height:          window.innerHeight,
  backgroundColor: '#0d0d0f',
  parent:          'game-phase',
  physics: {
    default: 'arcade',
    arcade:  { gravity: { y: 0 }, debug: false },
  },
  scene: [Preload, MenuScene, Lobby, DrawingPhase, GameScene],
});
