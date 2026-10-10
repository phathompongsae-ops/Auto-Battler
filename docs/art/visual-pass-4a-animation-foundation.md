# Visual Production Pass 4A — monster animation foundation

Starting HEAD `d0e2cb8`. Runtime and contracts only: **no final art was generated**.
Combat, cooldowns, wind-ups, speeds, hit radii, collision, HUD and camera (1.65)
are unchanged.

## Runtime

| Piece | Role |
|---|---|
| `src/data/monsterAnimArt.ts` | The art contracts for Crypt Lord, Grove Guardian and Skeleton Brute: files, cell, feet row, frames, fps, special segments. `status: 'pending'` until the strips exist; only `integrated` contracts are loaded (no 404s). |
| `src/graphics/monsterArt.ts` `resolveMonsterArt` | Best art first: all five strips for the art id → that id's idle sheet → the borrowed `texture` sheet (tinted only when standing in for dedicated art) → placeholder. A half-loaded set is never used. |
| `src/rendering/monsterAnimState.ts` | Pure, engine-free frame choice from the simulation clock. |
| `src/rendering/MonsterAnimator.ts` | Maps gameplay events onto timelines and sets frames (`Monster.showFrame`); applies combat facing to every monster. |
| `src/debug/monsterAnimFixture.ts` | Test-only code-drawn strips at the exact contract sizes (`debug.installMonsterAnimFixture(id)`), so the real path is tested before art exists. |

**State priority:** death (existing code squash / fade, last frame kept) > special
wind-up / impact > basic attack > special recovery > hit > walk > idle. A new
basic attack may cut a special's recovery; a hit never cuts an attack or a
special. A hit that lands during either is dropped, not replayed afterwards.

**Timing follows gameplay; nothing feeds back:**

- **Basic attack.** `skillUsed` for a skill without a wind-up. Frame 0 (contact)
  is drawn on the tick its damage lands, because monster basic attacks resolve
  on use.
- **Special.** `skillWindup` carries the real wind-up ms. Raise, then hold until
  `start + ms`, then impact. The first impact frame is drawn on the same
  simulation tick that `SkillSystem` lands the hit, whether or not anyone is
  inside the area. Then recovery.
- **Hit.** Taken from `damage` on the monster.
- **Clock.** The animator runs on `world.now`, so hit stop freezes animation
  and gameplay together.

**Facing:** monsters turn toward the target when a basic attack begins, when a
wind-up begins, and on the impact tick. They mirror only, never rotate. Area
wind-ups (no target id) face the brain's target, falling back to the player.
The facing fix applies to fallback monsters too.

**MonsterMotion** stays the fallback. Monsters with real strips get no
procedural bob, lean, lunge or recoil. Hit flash and shadow are unchanged.

**Skeleton Brute:** `MonsterDef.artId = 'crypt_brute'` is the dedicated slot.
While it is pending, the Brute keeps the Skeleton sheet with its `#c8b2a4`
tint and the Skeleton placeholder. Once dedicated art loads, it draws untinted.
Its body, hit radius and speed come from its tier scale either way.

## Art contracts (all `pending`)

Shared rules:

- Horizontal transparent PNG strips at `public/assets/monsters/<id>/<state>.png`
  (`idle`, `walk`, `attack`, `special`, `hit`). Each strip is `frames × cell
  width` by `cell height`.
- All five strips of one monster share one cell size and feet row.
- Sources face right (east); the runtime mirrors them for left.
- Drawn at 0.5 (2 source px per world px).
- Feet centred horizontally, standing **on** the feet row: the lowest visible
  pixel is `feetRow − 1` (as in every approved sheet), so the last 2 rows stay
  clear. Standing height = `feetRow −` top visible row.
- No baked shadow, text, UI or background.
- Basic attack is contact-first.
- Special segments run raise → hold (looped until the wind-up ends) → impact →
  recovery.

| | Crypt Lord | Grove Guardian | Skeleton Brute |
|---|---|---|---|
| Cell / feet row | 224×192 / 190 | 208×160 / 158 | 176×144 / 142 (was 112×108 / 106; see below) |
| Standing height (source px) | 150–168 | 124–140 | 88–100 (shorter than the Knight's 106) |
| Idle | 2 @ 3 fps | 2 @ 3 fps | 2 @ 3 fps |
| Walk | 8 @ 8 fps | 8 @ 8 fps | 6 @ 9 fps |
| Attack | 5 @ 12 fps, contact on frame 0 | same | same |
| Special | Grave Slam (both profiles), 1100 ms: raise 3, hold 2, impact 2, recovery 3 @ 12 fps | Stomp, 1000 ms: same segments | Bone Smash (Story), 1400 ms: same segments |
| Hit | 3 @ 15 fps | 3 @ 15 fps | 3 @ 15 fps |
| World body | 50×30 from (−25, +5); hit radius 24 | 42×25.2 from (−21, +4.2); hit radius 22 | 29×17.4 from (−14.5, +2.9); hit radius 16 |

**Skeleton Brute canvas (2026-10-10).** The Brute's cell grew from 112×108 / 106
to **176×144, feet row 142**. The lowest visible body or weapon pixel normally
ends on row 141, and rows 142–143 stay transparent. The growth is only room for
animation excursion: the hammer reaches 1.64× further forward than the body
reaches back, plus the walk, the swing and the overhead Bone Smash. It is **not**
a bigger Brute. The standing height stays 88–100 source px (idle fitted at
94 / 95), the draw scale stays 0.5, and the world body, hit radius, speed and
shadow come from the tier scale, unchanged. The old cell could not hold the
approved design: centring the feet shrank it to 75–77 px, and a full-figure fit
put the feet 13 px off centre, which made mirroring jump. The validator keeps
the 88–100 band, so a Brute scaled up to fill the canvas fails.

Integration later: drop in the five PNGs, set `status: 'integrated'`. The unit
contract tests then check every file's exact size.

## Verification

Unit test `tests/unit/monsterAnim.test.ts` and browser suite
`tests/browser/monsterAnim.test.mjs` (MA-1…MA-8) cover:

- Real fights for all three monsters with fixture strips.
- Wind-up frames for exactly the gameplay wind-up, and the first impact frame
  on the logged damage tick (equal timestamps).
- Contact frame 0 on basic-attack damage ticks.
- Facing at wind-up start.
- No procedural pose and zero body drift.
- Identical bodies and hit radii with and without strips.
- The fallback (including the tinted Brute) before installing and after
  removing fixtures.
- Camera zoom 1.65.
