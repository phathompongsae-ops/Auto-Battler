import Phaser from 'phaser';
import { createPlaceholderTextures } from '../graphics/placeholderTextures';

/** Prepares shared resources, then hands off to the world. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    createPlaceholderTextures(this);
    this.scene.start('World');
  }
}
