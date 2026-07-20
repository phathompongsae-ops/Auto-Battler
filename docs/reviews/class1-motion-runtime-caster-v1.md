# Class 1 Motion Runtime Integration — Caster Family, Phase 1

**Status: READY_FOR_RUNTIME_HUMAN_REVIEW**

Integrates the exact-approved Class 1 Caster Family (Mage, Summoner, Acolyte) motion package —
Idle, Move, Basic Attack — into the existing THREE.js board/bench Runtime. Phase 1 only: no
Fighter/Swordman/Merchant integration, no Archer changes, no Skill/Cast/Hit/Death/Victory/
Fusion/Class 2/Secret Class/Survival/3-star work, no projectile/VFX, no gameplay/balance change.

## Source lineage

| | |
|---|---|
| Approval record | `data/design/class1-motion-batch-2-caster-exact-package-approval-v1.json` |
| PR #87 head (expected) | `7c5b0262c5e4febaad57e00720e2d6deb55f72b1` |
| PR #87 head (verified live) | `7c5b0262c5e4febaad57e00720e2d6deb55f72b1` — match |
| PR #87 state (verified live) | open, Draft, unmerged, `mergeable_state=clean` |
| Package SHA-256 | `2a7e074388f0ce93f9182a841d91ff45477af6ed6c52015bee1a29531d7016af` |
| Import root | `docs/assets/review/character-production/class-1-motion-batch-2-caster-v1/` |
| Imported file count reconfirmed | 134/134 |

Archer Runtime Integration (`cc/archer-v3-2-runtime-integration-v1`, unmerged) and Class 1 Motion
Batch 1 Melee Exact Package Approval (PR #86) were used as **architectural/naming references
only** — neither branch's code, data, frame counts, timing, or poses were copied or modified.

## Exact asset lock — reconfirmed this task

All 3 Neutral Master hashes re-measured directly from the PR #87 worktree, independent of the
approval record's own claims:

| Class | SHA-256 | Match |
|---|---|---|
| Mage | `6587abdf0b4427ed9c95acb98a6d7c618e8be653fb13cdcaa9be1472fcb96315` | ✓ |
| Summoner | `731531aaa1d3efc462a12d2265ad602e6e4711a83f054d8f84b5bb00f3956ae3` | ✓ |
| Acolyte | `0853ab6d8f91e4100732c7f3628b31a09a38a762dc999dfbecef3cc23804a9c8` | ✓ |

Source approval record's `approvalFlags` reconfirmed before writing any code:
`humanVisualApproval/motionProductionApproved/exactPackageApproved=true`,
`canonicalApproved/runtimeIntegrationAuthorized/runtimeIntegrated/merged=false`. No mismatch
found — proceeded without rebuilding/re-importing anything.

## Pre-implementation Runtime audit

- **Sprite registration**: `ASSET_META` maps a sprite key to a single fixed-frame-count
  horizontal-filmstrip PNG; `loadAllSprites()` loads all of them into `SPRITES{}` at startup.
- **Visual selection**: `HERO_DEFS[heroKey].sprite` picks the `ASSET_META` key — **and** is
  reused verbatim by `heroPortraitSrc()` (`assets/portraits/${sprite.toLowerCase()}.png`) for
  every shop/bench/ghost-drag `<img>`. This dual-purpose coupling is the most important finding
  of this audit (see Critical Findings below).
- **Archer Pilot integration**: **not present in this branch's history at all.** This branch
  descends from PR #87 ← Melee Batch 1 ← Neutral Master Batch, a separate lineage from the
  unmerged Archer Runtime Integration branch. `hero.archer` here still renders the generic
  `'Sniper'` placeholder sheet like every other art-less hero.
- **Fixed-duration sheets vs. variable-duration per-file sequences**: both now coexist by design.
  The sheet path assumes one shared per-frame duration for every sheet-based unit
  (`ATTACK_FRAME_DUR=0.12s`); the approved Caster schedules are non-uniform per frame and differ
  across all 3 characters, so a second, additive texture-swap registry (`CASTER_FRAME_SEQS`) was
  used instead of forcing new content through the sheet's UV-offset mechanism.
- **Animation state triggers**: Idle is the default fallback state; Move is driven by `u.moving`
  (real movement additionally requires `u.moveFrom`/`u.moveTo`); Basic Attack is triggered by
  `updateUnit()`'s attack branch, which sets `animState='attack'` in the **same statement block**
  that applies Combat damage — there is no "wait for the animation" step anywhere.
- **Facing/flip**: `u.body.scale.x` is toggled directly on the unit's mesh; agnostic to whichever
  animation mechanism drives `material.map` — confirmed empirically, no caster-specific code
  needed.
- **Bench vs. board vs. shop**: bench heroes go through the *same* `makeUnit()` path as board
  heroes (`alive:false`), and `updateUnit()`'s `if (!u.alive) return;` guard means bench units
  never run `updateAnim()`/`updateCasterAnim()` at all — they display a single static Idle-frame-0
  pose forever. This satisfies "Idle only on bench, no Move/Attack" with zero extra code. Shop
  cards/drag-ghost are separate 2D `<img>` elements, entirely unaffected.
- **Attack/damage/acknowledgment interaction**: damage is applied synchronously and immediately
  when cooldown expires; the release-marker frame is visual-reference-only and has no bearing on
  when damage lands. Unchanged by this task.
- **Completion callbacks / queueing / priority / interruption**: none exist anywhere in the
  codebase for animation (no `setTimeout`-based animation timers at all). This integration follows
  the same shape — no callbacks, no queue, no priority system.
- **Current Runtime attack-speed values**: Mage 0.9, Summoner 1.0, Acolyte 0.95
  (`HERO_DEFS[cls].stats.attack_speed`).
- **Runtime vs. design attack-speed disagreement**: none found — `HERO_DEFS` is the sole
  authoritative Runtime source; the approved package makes no attack-speed claim to disagree with.
- **Existing test hooks**: none committed in this branch's history for `src/game.js`. A scratch,
  uncommitted Playwright harness was used for this task's evidence capture; a new, minimal,
  permanent `window.__casterRuntimeTestHook` was added (mirrors the Archer reference branch's own
  hook shape).
- **Package path consumption**: consumed directly from the exact-approved import path — no copy,
  no additive asset-mapping directory, no recompression. Only individual approved frame PNGs are
  loaded at Runtime; GIFs/contact sheets/sidecar JSON/docs are never referenced by `src/game.js`.

## Critical findings from this audit

1. **`sprite` field dual-purpose hazard.** Repointing `HERO_DEFS[cls].sprite` itself to a new
   caster-specific key would have silently 404'd every shop/bench/ghost-drag portrait for these 3
   heroes (`heroPortraitSrc()` lowercases and reuses that same field). **Fixed** by adding a
   separate, additive `boardSprite` field — `sprite` is completely untouched, so portrait/shop/
   bench behavior is byte-for-byte unchanged.
2. **Shared-texture disposal hazard.** `isSharedUnitTexture()` (consulted by `removeUnit()` before
   disposing a texture) only recognized `ASSET_META`-sourced textures. Caster motion textures are
   loaded once and referenced by every same-class unit simultaneously (unlike the sheet path,
   which clones per unit) — without a fix, selling one Mage would have disposed a texture a second,
   still-alive Mage's material still pointed at. **Fixed** by extending `isSharedUnitTexture()` for
   the new registry; verified empirically (two Mage units, remove one, confirm the survivor's
   texture reference and image are intact). This exact class of bug exists, unfixed, in the
   (unmerged) Archer Runtime Integration reference branch — intentionally **not** touched here, as
   fixing Archer's own code is out of this task's scope.

## Implementation

Additive-only change to `src/game.js`:

- `CASTER_FRAME_SEQS` registry (one `THREE.Texture` per approved PNG frame, per class, per
  action) + `loadCasterFrames()`, loaded in parallel with the existing `loadAllSprites()`.
- `boardSprite: 'MageReal' | 'SummonerReal' | 'AcolyteReal'` added to the mage/summoner/acolyte
  `HERO_DEFS` entries — `sprite` unchanged.
- New branch in `makeUnit()`: builds a `PlaneGeometry` sized to the approved 640×960 aspect ratio
  when `boardSprite` resolves and frames are loaded; otherwise falls back to the existing
  sheet/placeholder path, unchanged.
- `updateCasterAnim()` dispatched from the top of the existing `updateAnim()`.
- Caster state reset added to `resetForWave()`.
- `isSharedUnitTexture()` extended (see Critical Findings).
- `window.__casterRuntimeTestHook` debug surface (test-only, no gameplay code path references it).

Anchor `[0.5, 0.92]`, foot baseline, in-place root motion, and `runtimeFlipX` compatibility are
all preserved unchanged. No PNG/GIF binary was modified, recompressed, resized, or moved. Neutral
Master pose is not used as a separate Runtime state — spawn transitions directly into Idle, per
the State Behavior contract (Idle/Move/Basic Attack only; no Neutral entry in the approved
`motions[]` inventory either).

## Motion schedules (exact, per character)

| Class | Idle | Move | Attack | Release |
|---|---|---|---|---|
| Mage | 6f / 100cs | 8f / 88cs | 8f / 89cs | frame 004 @ 38cs |
| Summoner | 6f / 96cs | 8f / 80cs | 8f / 83cs | frame 004 @ 35cs |
| Acolyte | 6f / 108cs | 8f / 88cs | 8f / 86cs | frame 004 @ 37cs |

## Attack-speed and synchronization safety

| Class | Runtime attack interval (1/attack_speed) | Visual attack duration | Margin |
|---|---|---|---|
| Mage | 111.1cs (attack_speed 0.9) | 89cs | 22.1cs |
| Summoner | 100cs (attack_speed 1.0) | 83cs | 17cs |
| Acolyte | 105.3cs (attack_speed 0.95) | 86cs | 19.3cs |

No attack-speed-boosting synergy or skill is reachable by these 3 tier-1 heroes in this codebase
(the Hero Star System's speed multiplier only applies to tier-2 heroes; none of their
`LINK_CLASS_BUFFS` grant `attack_speed_pct`). `dt` is scaled by `speedMul` exactly once, and the
same scaled `dt` drives both the Combat cooldown and the animation frame timer, so the
duration-below-interval relationship holds at every game speed, not just x1 — confirmed
empirically at x4, not just by static comparison.

**Selected behavior: full replay.** Every new Basic Attack resets the frame timer to 0 and plays
frames 0–7 from the start. Safe specifically because the clip always finishes before the next
attack can fire (measured, not assumed) — unlike the Archer reference implementation, which needed
a queued/acknowledgment mechanism because its own attack clip (127cs) exceeds its own base interval
(71.4cs @ attack_speed 1.4). This never moves, delays, or accelerates the Combat damage event,
which remains applied synchronously the instant `atkCooldown` expires, unchanged from before this
task.

- **Normal speed** (Summoner, attack_speed 1.0, 10s window): 10/10 expected attacks fired, ends
  in Idle, not stuck.
- **x4 speed** (Mage, attack_speed 0.9, 60 game-seconds window): 53 attacks fired, all 53 ended
  cleanly, ~54 expected by pure interval math, ends in Idle after draining, not stuck. Max frame
  index observed during attack: 7 (full 8-frame sequence always completes).

## Test results

| Area | Result |
|---|---|
| Asset/metadata validation | pass — `casterLoaded()` true, no failed frame loads, 0 console errors |
| spawn → Idle | pass |
| Idle → Move → Idle | pass |
| Idle → Basic Attack → Idle | pass |
| Basic Attack → Move (if movement resumes) | pass |
| Character isolation (Mage/Summoner/Acolyte never cross-render) | pass |
| Facing (left/right/repeated flips) | pass, no drift |
| Repeated Basic Attacks (normal + x4) | pass, see above |
| Multiple units (3 classes + 2nd Mage copy simultaneously) | pass, independent per-unit state |
| Lifecycle: disposing one unit doesn't affect a same-class sibling | pass (see Critical Findings) |
| Regression: Archer | unaffected — not integrated in this branch, unchanged |
| Regression: Fighter/Swordman/Merchant | unaffected — spot-checked Fighter directly |
| Regression: shared placeholder sheets (Archmage/FrostWeaver keys) | unaffected — still used by archmage/inquisitor/frost_weaver/priest exactly as before |
| New console errors / asset-load failures | 0 |
| Timer/resource leaks | none found |

Evidence: `docs/reviews/class1-motion-runtime-caster-v1/evidence/` —
`board-multi-caster-clean-idle.png` (4 units, 3 classes, real board render before any battle),
`board-real-battle-x1.png`, `board-real-battle-x4.png` (real `spawnWave()` production path),
`runtime-test-raw-results.json` (structured deterministic assertions + timing traces).

## Approval flags

```
humanVisualApproval: true
motionProductionApproved: true
exactPackageApproved: true
canonicalApproved: false
runtimeIntegrationAuthorized: true
runtimeIntegrated: true
merged: false
```

## Known limitations

- Equipment-derived attack-speed items were not exhaustively enumerated against the "full replay"
  safety margin — only base `attack_speed` (no equipment) was measured.
- `ATTACK_SPEED_RUNTIME_VALIDATION_PENDING` and `PENDING_SEPARATE_RUNTIME_INTEGRATION_VALIDATION`
  are not resolved by this record — only measured/compared, per this task's own scope.
- Board Preview remains `DEFERRED_UNTIL_AFTER_DEMO` — untouched.
- Skill/Cast, Hit, Death, Victory, Fusion, Class 2, Secret Class, Survival, 3-star motion,
  projectile, and VFX are entirely out of scope and unimplemented.
- The Archer reference branch's own shared-texture-disposal bug (see Critical Findings) was
  identified but intentionally not fixed — out of this task's scope.

## Scope

Changed paths limited to `src/game.js` (additive only), this record, the approval JSON, the
validator, and the evidence directory. No PNG/GIF binary modified. No `src/` gameplay/Combat/
balance/Skill/Cast/projectile/VFX logic touched beyond the additive animation-registration code
described above. PR #87 not modified. No PR merged, no auto-merge enabled.
