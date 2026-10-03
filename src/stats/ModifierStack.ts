import type { ModifierSource, StatModifier } from './modifiers';

/**
 * Live modifiers from systems layered on top of a character's own stats:
 * equipment, pets, buffs and debuffs. Each system owns its source and
 * replaces it wholesale (e.g. equipment re-sends all its modifiers when gear
 * changes); ids are stable, so re-adding an id replaces it.
 *
 * `onChange` lets the owner refresh derived stats (the player re-derives its
 * combat stats). No engine code.
 */
export class ModifierStack {
  private readonly byId = new Map<string, StatModifier>();
  private cache: StatModifier[] = [];

  constructor(private readonly onChange: () => void = () => {}) {}

  /** Add or replace one modifier by id. */
  set(modifier: StatModifier): void {
    this.byId.set(modifier.id, modifier);
    this.changed();
  }

  remove(id: string): void {
    if (this.byId.delete(id)) this.changed();
  }

  /** Replace every modifier of one source (e.g. all equipment) in one step. */
  replaceSource(source: ModifierSource, modifiers: readonly StatModifier[]): void {
    for (const [id, m] of this.byId) if (m.source === source) this.byId.delete(id);
    for (const m of modifiers) {
      if (m.source !== source) throw new Error(`modifier ${m.id} is ${m.source}, not ${source}`);
      this.byId.set(m.id, m);
    }
    this.changed();
  }

  clear(): void {
    if (this.byId.size === 0) return;
    this.byId.clear();
    this.changed();
  }

  list(): readonly StatModifier[] {
    return this.cache;
  }

  private changed(): void {
    this.cache = [...this.byId.values()];
    this.onChange();
  }
}
