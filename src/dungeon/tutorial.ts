import type { TutorialBeat } from '../data/storyEncounters';

/*
 * Story tutorial beats (engine-free): which lines are due now. Each beat is
 * shown at most once per dungeon attempt (the caller keeps `seen`, reset on
 * every entry), so crossing the same tile or retrying after a wipe never
 * repeats a line.
 */

export interface TutorialMoment {
  /** The party just entered the dungeon map. */
  entered?: boolean;
  /** Spawn zones with a monster currently engaged (chasing / attacking). */
  engaged?: (zoneId: string) => boolean;
  /** A checkpoint just activated. */
  checkpointId?: string;
  hpFraction?: number;
  hasHpPotion?: boolean;
}

export function dueTutorialBeats(beats: readonly TutorialBeat[], seen: ReadonlySet<string>, now: TutorialMoment): TutorialBeat[] {
  return beats.filter((b) => {
    if (seen.has(b.id)) return false;
    const t = b.trigger;
    if (t.on === 'enter') return !!now.entered;
    if (t.on === 'engage') return !!now.engaged?.(t.zone);
    if (t.on === 'low_hp') return !!now.hasHpPotion && now.hpFraction !== undefined && now.hpFraction > 0 && now.hpFraction <= t.threshold;
    return now.checkpointId === t.checkpointId;
  });
}
