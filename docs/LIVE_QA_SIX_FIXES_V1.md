# Live Gameplay QA — Six Confirmed Fixes v1

Branch: `cc/live-gameplay-qa-six-fixes-v1` (base: main @ `e2af2c1cdb38bee02f6002f6f5c709e5e32a34fd`)

Six defects confirmed by the user on the deployed GitHub Pages build
(https://phathompongsae-ops.github.io/Auto-Battler/), each fixed at its verified root cause.
Files changed: `src/game.js`, `autochess.html`, plus this doc and
`tests/live_qa_six_fixes.test.js` (regression suite).

---

## Fix 1 — Slime / Orc Brute render as black rectangles with tint flashes

**Root cause.** `makeUnit` had two body branches: ASSET_META textured plane, else opaque
`BoxGeometry` placeholder. Slime and OrcBrute have Motion animation frames
(`MONSTER_MOTION_DEFS` / `MONSTER_TEXTURES`) but no ASSET_META entry, so they fell into the
box branch. Motion frames were then texture-swapped onto an opaque box material never
configured for transparency (black where the PNG is transparent). Additionally
`restoreBodyColor` restored `u.placeholderColor` (Slime `0x6fcf5a`, OrcBrute `0xa0522d`)
after hit-flashes, tinting the sprite.

**Fix.** New `makeUnit` branch between the two: when `MONSTER_MOTION_DEFS[cfg.sprite] &&
MONSTER_MOTION_READY[cfg.sprite]`, build the same transparent billboard `PlaneGeometry`
as the textured branch (`transparent: true, alphaTest: 0.5`), seeded with idle frame 0.
`restoreBodyColor` now restores **white** whenever the material has a texture map, and
`placeholderColor` only for genuine untextured boxes (which remain as the fallback when
Motion frames fail to load).

## Fix 2 — Units face the wrong direction while moving / attacking

**Root cause.** Facing was set by writing `u.body.scale.x` inline at two independent call
sites (movement ~line 2567, attack ~line 3380) with no shared convention, no per-sprite
base-facing handling, and sign churn on `dirX === 0`.

**Fix.** One central helper used by both call sites:

```js
const SPRITE_BASE_FACING = {}; // per-sprite canonical facing multiplier (default 1 = art faces right)
function setUnitFacing(u, dirX) {
  if (!dirX || !u.body) return; // horizontal tie / pure-vertical: keep the last valid facing
  const want = (dirX > 0 ? 1 : -1) * (SPRITE_BASE_FACING[u.sprite] || 1);
  if (u.body.scale.x !== want) u.body.scale.x = want;
}
```

Movement passes the grid-step delta; attack passes the world-x delta toward the target.
Same contract for both; no per-frame writes when facing is unchanged; ties preserve the
last facing.

## Fix 3 — No purchasable items (equipment pipeline had no storefront)

**Root cause.** The full equipment pipeline existed (`ITEM_BASE`, `createItemInstance`,
`equipItem`, `buildCombatStats`) but `createItemInstance` had **zero callers** — nothing in
the UI ever created an item.

**Fix.** Item section added to the existing shop drawer (`#itemShopHeader` +
`#itemShopCards` in `autochess.html`, rendered by `renderUI`), reusing the pipeline
end-to-end: `buyShopItem` validates phase/gold/inventory capacity, deducts gold exactly
once, and calls the existing `createItemInstance`. Item offers are picked inside
`pickShopOffers` (so hero reroll refreshes them too) but are a **separate pool** from hero
offers. Reroll never touches owned instances.

**Pricing.** No authoritative pricing exists in repo docs (checked `DEMO1_DATA_POLICY.md`,
`CURRENT_PROJECT_HANDOFF.md`, GDD) — the task's fallback schedule is used verbatim:

```js
const ITEM_SHOP = {
  slots: 2,
  base_cost: 6,        // 4 base items
  combined_cost: 14,   // 10 recipe items
  bands: [
    { min_wave: 1,  max_wave: 5,  combined_chance: 0    }, // base only
    { min_wave: 6,  max_wave: 10, combined_chance: 0.25 },
    { min_wave: 11, max_wave: 15, combined_chance: 0.5  },
  ],
};
```

## Fix 4 — Game far too easy

**Root cause (mechanics).** Hero defense used flat subtraction, so mid-game def values
zeroed out most enemy attacks. Enemy `armor` already used a percentage path.

**Fix (mechanics).** Hero branch of `mitigateDamage` replaced with diminishing-returns
mitigation; the enemy armor % path is untouched:

```js
return rawDmg * 100 / (100 + Math.max(0, def)); // heroes: 30 def ≈ 23% reduction, never zero
```

**Fix (balance pass).** Measured first: a scripted "casual but engaged" Playwright player
(buys EXP, buys heroes to capacity, buys+equips items, links 3 heroes, real x4 button)
cleared all 15 waves at 58–96% team HP on the new formula alone — still too easy. A small
deterministic per-stage table was added, applied **exactly once at spawn** in `spawnWave`
(fixed lookup — no compounding, unlike the removed +12%/wave idea). Compositions, boss
identity, and skills unchanged:

```js
const STAGE_ENEMY_SCALE = {
  1:{hp:1.0,atk:1.0}, 2:{hp:1.0,atk:1.0}, 3:{hp:1.05,atk:1.05},
  4:{hp:1.15,atk:1.1}, 5:{hp:1.2,atk:1.15},
  6:{hp:1.35,atk:1.2}, 7:{hp:1.45,atk:1.25}, 8:{hp:1.55,atk:1.3},
  9:{hp:1.65,atk:1.35}, 10:{hp:1.7,atk:1.4},
  11:{hp:1.9,atk:1.5}, 12:{hp:2.0,atk:1.55}, 13:{hp:2.15,atk:1.6},
  14:{hp:2.3,atk:1.65}, 15:{hp:2.45,atk:1.7},
};
```

An earlier, harsher draft of bands 9–15 was rejected by measurement (run died at wave 10
with 2% HP margin at 9). Final measured runs (3 scripted x4 playthroughs): eliminated at
wave 10 / reached 14 / reached 13 — early waves comfortable, waves 6–10 demand economy,
11–15 threaten losses. Accepted as the target curve.

## Fix 5 — Distant melee units idle instead of surrounding the boss

**Root cause.** `findMeleeApproachTile` only considered the 4 attack-adjacent tiles; when
all were occupied, `stepToward` returned with no goal and far units froze.

**Fix.** New `findMeleeStagingTile` picks the best free, in-bounds, non-bench, A*-reachable
ring-2 tile (deterministic scan order = tie-breaking); `stepToward` falls back to it when
the attack ring is full. Staging goals are never cached past one pick (a ring-2 goal fails
the cache's adjacency condition), so staged units re-check the attack ring every step and
advance the moment a tile opens — no oscillation, no reservation conflicts (`occupied`
remains the only tile reservation). If neither ring yields a tile, `findBestReachableEnemy`
retargets to the nearest enemy with any reachable approach/staging tile.

## Fix 6 — Drag ghost, tile highlight, and drop tile misaligned

**Root cause.** The ghost anchor, raycast/highlight, and drop resolution each derived
their own point from the pointer event; the ghost subtracted `GHOST_Y_OFFSET` internally
while the raycast used raw `clientY`, and a stale comment described an outdated canvas
inset.

**Fix.** ONE shared function `dragTargetPoint(ds, e)` (`clientY - liftY`, where `liftY` is
`GHOST_Y_OFFSET` for touch, `0` for mouse) now feeds the ghost anchor, the tile raycast,
the highlight (`unitDrag.hoverTile`), and the drop — a single point, so highlight ==
drop by construction. The ghost is feet-anchored to that point (`.benchGhost` transform
`translate(-50%, -100%)`, `transform-origin: bottom center`). Tap-select flow unchanged.

---

## Validation

- **Existing tests:** the repository has no test suite or runner; none existed to run.
- **New regression suite:** `tests/live_qa_six_fixes.test.js` — 70 checks, all passing
  (62 for the six fixes + 8 for the follow-up foot-anchor; see the follow-up section below).
  Run: serve the repo root over HTTP (Three.js CDN substituted locally if egress-blocked),
  then `BASE_URL=http://127.0.0.1:PORT/autochess.html node tests/live_qa_six_fixes.test.js`
  (env overrides: `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`).
- **Syntax:** `node --check` clean on `src/game.js` and the test file.
- **Combat:** x1 full wave (win, no page errors); x4 15-wave curve measured via 3 scripted
  full playthroughs (balance section above).
- **Viewports:** 360×800 portrait, 800×360 landscape, 844×390 landscape (touch), 1280×720
  (mouse) — all via emulated Playwright Chromium. **No real Android hardware was
  available; no real-device verification is claimed.**
- **Console/assets:** no new console errors; the only 404 is the browser's automatic
  `favicon.ico` request (no favicon exists in the repo — pre-existing on the live build).
- **Scope:** diff touches only `src/game.js` and `autochess.html` (+ tests/docs). No
  Motion PNGs, metadata sidecars, animation timings, workflows, camera, lighting, or
  unrelated hero skills were modified.

---

## Follow-up — Real-device visual QA (unit cell alignment + black background)

Two defects were re-reported from the deployed **live main** build and re-verified against both
live main and this PR branch, independently.

### Black background (Slime/Orc) — already fixed by Fix 1

Confirmed via direct render on both builds: live main spawns Slime/Orc as an opaque
`BoxGeometry` (`transparent:false`, tinted) with the motion PNG mapped on → black rectangle; this
PR branch spawns them as a transparent alpha-tested `PlaneGeometry` (`0xffffff`) → clean sprite.
Live main is simply outdated relative to this PR. **No additional change.**

### Unit not centered in its cell — foot-anchor fix

Reproduced on **both** builds (identical art + anchor; not a PR-#95 regression). The unit's
logical grid coordinate and group **root are exactly at the cell center** on both builds
(measured 0 px). The problem was purely the sprite's **vertical visual anchor**: `body.position.y
= h/2` placed the billboard plane's geometric bottom at the ground, but sprite frames carry
transparent bottom padding (heroes ≈20.6% of frame height, Slime/Orc ≈10.9%), lifting the
*visible* feet ≈`padFrac × planeHeight` above the cell center (heroes ≈0.29 world units ≈ ⅓ of a
cell) so the drawn feet landed on the back grid line.

**Fix (`spriteFootLift`):** sample each sprite's opaque bottom padding once (frame 0, cached per
sprite key) and lower the plane by that fraction of its height
(`body.position.y = h/2 - footLift`), so the drawn feet meet the cell center. The HP/mana/badge
stack rides down with it (`barY = h + 0.14 - footLift`); the shadow and link-ring stay at ground
(now coincident with the feet). Box placeholders get zero lift. The lowered anchor is re-applied
on the moving/idle body-Y updates so it survives movement. Board, tiles, camera, `occupied`/logic,
movement/pathfinding, drag target point, tap-select, balance, and combat are untouched.

Measured after fix: `rootVsCenter_px = 0` and opaque `feetVsCenter_px = 0` on center and edge
tiles; pre-fix visible-feet error was ≈12 screen px. Regression suite: **70/70 pass** (62 prior +
8 new foot-anchor checks). Verified at 360×800, 800×360, 844×390 (touch) and 1280×720 (mouse) —
emulated Playwright Chromium; no real Android hardware was available, so no real-device
verification is claimed.
