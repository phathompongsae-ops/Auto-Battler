/** Something that can be gently pushed apart from its neighbours. */
export interface SeparationAgent {
  readonly x: number;
  readonly y: number;
  readonly hitRadius: number;
  readonly combat: { readonly dead: boolean };
  /** Extra velocity (px/s) to add on top of the agent's own movement this frame. */
  applySeparation(vx: number, vy: number): void;
}

const GOLDEN_ANGLE = 2.399963;

/**
 * Soft separation: overlapping living agents push each other apart, harder
 * the more they overlap (0 at touching distance, `strength` px/s when fully
 * on top of each other). Every living agent gets applySeparation() once per
 * call, with (0, 0) when nothing overlaps it. Engine-agnostic.
 */
export function separate(agents: readonly SeparationAgent[], strength: number, scratch: number[] = []): void {
  const n = agents.length;
  scratch.length = n * 2;
  scratch.fill(0);

  for (let i = 0; i < n; i++) {
    const a = agents[i];
    if (a.combat.dead) continue;
    for (let j = i + 1; j < n; j++) {
      const b = agents[j];
      if (b.combat.dead) continue;
      const minDist = a.hitRadius + b.hitRadius;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;
      if (dist < 0.01) {
        // Exactly stacked: pick a stable direction per pair.
        const angle = (i + j) * GOLDEN_ANGLE;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        dist = 1;
      }
      const push = (1 - Math.min(dist, minDist) / minDist) * strength;
      const ux = (dx / dist) * push;
      const uy = (dy / dist) * push;
      scratch[i * 2] -= ux;
      scratch[i * 2 + 1] -= uy;
      scratch[j * 2] += ux;
      scratch[j * 2 + 1] += uy;
    }
  }

  for (let i = 0; i < n; i++) {
    if (!agents[i].combat.dead) agents[i].applySeparation(scratch[i * 2], scratch[i * 2 + 1]);
  }
}
