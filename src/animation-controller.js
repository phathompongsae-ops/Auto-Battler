// Standalone sprite-sheet animation framework.
// Intentionally not wired into src/game.js yet.

export const DEFAULT_ANIMATION_STATES = Object.freeze([
  'idle',
  'walk',
  'attack',
  'cast',
  'hit',
  'death',
  'spawn',
]);

function assertPositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number`);
  }
}

function normalizeClip(name, clip) {
  if (!clip || typeof clip !== 'object') {
    throw new TypeError(`Animation clip "${name}" must be an object`);
  }

  const frames = Array.isArray(clip.frames) ? [...clip.frames] : [];
  if (frames.length === 0 || frames.some((frame) => !Number.isInteger(frame) || frame < 0)) {
    throw new TypeError(`Animation clip "${name}" must contain non-negative integer frames`);
  }

  const fps = clip.fps ?? 8;
  assertPositiveNumber(fps, `Animation clip "${name}" fps`);

  return Object.freeze({
    name,
    frames: Object.freeze(frames),
    fps,
    loop: clip.loop !== false,
    next: clip.next ?? null,
    lockUntilComplete: clip.lockUntilComplete === true,
    events: Object.freeze({ ...(clip.events || {}) }),
  });
}

export class AnimationLibrary {
  constructor() {
    this._definitions = new Map();
  }

  register(id, definition) {
    if (!id || typeof id !== 'string') throw new TypeError('Animation definition id is required');
    if (this._definitions.has(id)) throw new Error(`Duplicate animation definition: ${id}`);
    if (!definition || typeof definition !== 'object') throw new TypeError('Animation definition is required');

    const columns = definition.columns;
    const rows = definition.rows;
    if (!Number.isInteger(columns) || columns <= 0) throw new TypeError('columns must be a positive integer');
    if (!Number.isInteger(rows) || rows <= 0) throw new TypeError('rows must be a positive integer');

    const clips = {};
    for (const [name, clip] of Object.entries(definition.clips || {})) {
      clips[name] = normalizeClip(name, clip);
    }
    if (!clips.idle) throw new Error(`Animation definition "${id}" requires an idle clip`);

    const normalized = Object.freeze({
      id,
      columns,
      rows,
      clips: Object.freeze(clips),
      defaultState: definition.defaultState || 'idle',
      flipXByFacing: definition.flipXByFacing !== false,
    });

    if (!normalized.clips[normalized.defaultState]) {
      throw new Error(`Default state "${normalized.defaultState}" is not defined for ${id}`);
    }

    this._definitions.set(id, normalized);
    return normalized;
  }

  get(id) {
    const definition = this._definitions.get(id);
    if (!definition) throw new Error(`Unknown animation definition: ${id}`);
    return definition;
  }

  has(id) {
    return this._definitions.has(id);
  }

  snapshot() {
    return [...this._definitions.values()].map((definition) => ({
      id: definition.id,
      columns: definition.columns,
      rows: definition.rows,
      states: Object.keys(definition.clips),
    }));
  }
}

export class SpriteAnimationController {
  constructor({ definition, onFrame, onEvent, onStateChange, timeScale = 1 }) {
    if (!definition) throw new TypeError('definition is required');
    if (typeof onFrame !== 'function') throw new TypeError('onFrame callback is required');
    assertPositiveNumber(timeScale, 'timeScale');

    this.definition = definition;
    this.onFrame = onFrame;
    this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
    this.onStateChange = typeof onStateChange === 'function' ? onStateChange : () => {};
    this.timeScale = timeScale;

    this.state = null;
    this.frameIndex = 0;
    this.elapsed = 0;
    this.playing = true;
    this.facing = 'right';
    this._completed = false;

    this.play(definition.defaultState, { force: true, restart: true });
  }

  get clip() {
    return this.definition.clips[this.state];
  }

  setTimeScale(value) {
    assertPositiveNumber(value, 'timeScale');
    this.timeScale = value;
  }

  setFacing(facing) {
    if (facing !== 'left' && facing !== 'right') {
      throw new TypeError('facing must be "left" or "right"');
    }
    this.facing = facing;
    this._emitFrame();
  }

  play(state, options = {}) {
    const nextClip = this.definition.clips[state];
    if (!nextClip) throw new Error(`Unknown animation state "${state}" for ${this.definition.id}`);

    const currentClip = this.clip;
    if (
      currentClip &&
      currentClip.lockUntilComplete &&
      !this._completed &&
      options.force !== true &&
      state !== this.state
    ) {
      return false;
    }

    const changed = state !== this.state;
    if (!changed && options.restart !== true) return true;

    const previousState = this.state;
    this.state = state;
    this.frameIndex = 0;
    this.elapsed = 0;
    this._completed = false;
    this.playing = true;
    this._emitFrame();
    this.onStateChange({ previousState, state, controller: this });
    return true;
  }

  pause() {
    this.playing = false;
  }

  resume() {
    this.playing = true;
  }

  reset() {
    this.play(this.definition.defaultState, { force: true, restart: true });
  }

  update(deltaSeconds) {
    if (!this.playing || this._completed) return;
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new TypeError('deltaSeconds must be a non-negative finite number');
    }

    const clip = this.clip;
    const frameDuration = 1 / clip.fps;
    this.elapsed += deltaSeconds * this.timeScale;

    while (this.elapsed >= frameDuration && !this._completed) {
      this.elapsed -= frameDuration;
      this._advanceFrame();
    }
  }

  _advanceFrame() {
    const clip = this.clip;
    const nextIndex = this.frameIndex + 1;

    if (nextIndex < clip.frames.length) {
      this.frameIndex = nextIndex;
      this._emitFrame();
      return;
    }

    if (clip.loop) {
      this.frameIndex = 0;
      this._emitFrame();
      return;
    }

    this._completed = true;
    this.frameIndex = clip.frames.length - 1;
    this._emitFrame();
    this.onEvent({ type: 'complete', state: this.state, controller: this });

    if (clip.next) {
      this.play(clip.next, { force: true, restart: true });
    }
  }

  _emitFrame() {
    const clip = this.clip;
    const frame = clip.frames[this.frameIndex];
    const column = frame % this.definition.columns;
    const row = Math.floor(frame / this.definition.columns);
    const eventName = clip.events[this.frameIndex] ?? clip.events[String(this.frameIndex)] ?? null;

    this.onFrame({
      state: this.state,
      frame,
      frameIndex: this.frameIndex,
      column,
      row,
      columns: this.definition.columns,
      rows: this.definition.rows,
      facing: this.facing,
      flipX: this.definition.flipXByFacing && this.facing === 'left',
      controller: this,
    });

    if (eventName) {
      this.onEvent({ type: 'frame-event', name: eventName, state: this.state, frameIndex: this.frameIndex, controller: this });
    }
  }
}

export function createStandardAnimationDefinition(overrides = {}) {
  return {
    columns: 8,
    rows: 1,
    defaultState: 'idle',
    flipXByFacing: true,
    clips: {
      idle: { frames: [0], fps: 6, loop: true },
      walk: { frames: [1, 2], fps: 8, loop: true },
      attack: { frames: [3, 4], fps: 10, loop: false, next: 'idle', lockUntilComplete: true, events: { 1: 'hit' } },
      cast: { frames: [3, 4], fps: 8, loop: false, next: 'idle', lockUntilComplete: true, events: { 1: 'cast-release' } },
      hit: { frames: [5], fps: 10, loop: false, next: 'idle', lockUntilComplete: true },
      death: { frames: [6, 7], fps: 6, loop: false, lockUntilComplete: true },
      spawn: { frames: [0], fps: 6, loop: false, next: 'idle', lockUntilComplete: true },
      ...(overrides.clips || {}),
    },
    ...overrides,
  };
}
