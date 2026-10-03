import Phaser from 'phaser';
import { DEMO_PLAYER_PRESENTATION } from '../data/demoConfig';
import {
  applyCharacterArtFilter,
  characterArtDisabled,
  preloadCharacterArt,
} from '../graphics/characterArt';
import { createPlaceholderTextures } from '../graphics/placeholderTextures';

/** Prepares shared resources, then hands off to the world. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // A failed sheet is not fatal: the player falls back to placeholder art.
    if (!characterArtDisabled()) preloadCharacterArt(this, DEMO_PLAYER_PRESENTATION.art);
  }

  create(): void {
    createPlaceholderTextures(this);
    applyCharacterArtFilter(this, DEMO_PLAYER_PRESENTATION.art);
    this.scene.start('World');
  }
}
