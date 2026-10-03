import Phaser from 'phaser';
import { WARRIOR_ART } from '../data/characterArt';
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
    if (!characterArtDisabled()) preloadCharacterArt(this, WARRIOR_ART);
  }

  create(): void {
    createPlaceholderTextures(this);
    applyCharacterArtFilter(this, WARRIOR_ART);
    this.scene.start('World');
  }
}
