export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const TILE_SIZE = 32;

export const PLAYER_WALK_FPS = 8;

export const CAMERA_LERP = 0.15;

/** Gameplay camera zoom (camera re-evaluation after Visual Production Pass 1): the Warrior (40 world px tall) reads at ~66 px on screen; the 960×540 view still spans ~582×327 world px, room for the 84 px Grave Slam telegraph. */
export const CAMERA_ZOOM = 1.65;
