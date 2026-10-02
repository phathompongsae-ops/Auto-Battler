import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#16202d',
  pixelArt: true,
  roundPixels: true,
  fps: {
    target: 60,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      // Step physics with the real frame delta so motion stays smooth on
      // 90/120/144 Hz screens instead of updating at a fixed 60 Hz.
      fixedStep: false,
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, WorldScene],
};

const game = new Phaser.Game(config);

// Expose the game for debugging and browser tests during development only.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
