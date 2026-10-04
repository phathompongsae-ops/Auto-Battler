import Phaser from 'phaser';
import { PRESENTATION_ARTS } from '../data/demoConfig';
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
    if (!characterArtDisabled()) for (const art of PRESENTATION_ARTS) preloadCharacterArt(this, art);
  }

  create(): void {
    createPlaceholderTextures(this);
    for (const art of PRESENTATION_ARTS) applyCharacterArtFilter(this, art);
    this.scene.start('World');
  }
}
