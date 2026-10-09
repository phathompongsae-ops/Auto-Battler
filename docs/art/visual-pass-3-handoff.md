# Visual Production Pass 3 — resumed handoff

Starting HEAD: `171b7ee`, branch `phaser-rebuild`. Existing unfinished CC
ground atlas, pipeline, accepted prop PNGs and motion code were preserved.
No new generation, candidate integration or gameplay tuning was performed.

## Environment

Field now uses a per-map Wang descriptor, like Town. The existing generated
75-frame atlas has 64px frames, 2px margin and 4px spacing, drawn at 0.5 on
the unchanged 32px world grid. Grass/dirt reuse approved Town source art;
dark grass and moss are derived grades. Four 16-mask transitions cover
dirt/grass, grass/dark grass, grass/moss and water/grass. The grass connector
handles unsupported mixed corners. Position hashing chooses mirrored plain
variants deterministically (grass 4, dirt/dark grass/moss 2 each).

Water uses the existing painted base plus shoreline transitions. All 43
Field water cells remain solid in the original collision layer; overlays
never register colliders. The single water base has a visible repeating
wave motif, though the reviewed shoreline has no pale square seam rings.
Town's atlas and original ground lookup remain unchanged. The generalized
descriptor retains Town's existing fallback and connector.

`buildFieldGround.mjs` is retained for reproducibility, but the usable atlas
was not regenerated during the resumed session. `prepareArt.mjs` retains
CC's `maxScale` cap to avoid enlarging small source props.

## Props

Sizes below are world-space canvas bounds, including transparent padding.
All art uses bottom-centred origin (0.5,1), half-scale rendering and the
existing placement/depth/occlusion rules. No footprint or navigation changes.

| Prop | Runtime size | Integration | Existing footprint |
|---|---|---|---|
| Bush | 32×32 | Accepted | 1×1 solid |
| Mossy rock | 32×32 | Accepted as `rock` | 1×1 solid |
| Big rock | 64×64 | Accepted | 2×2 solid/tall |
| Signpost | 32×32 | Accepted | 1×1 non-solid |
| Tent | 64×64 | Accepted | 2×2 solid/tall |
| Campfire | 32×32 | Accepted, ground depth | 1×1 non-solid |
| Stump | 32×32 | Accepted | 1×1 solid |
| Skull | 32×32 | Accepted as Crypt `bones`, ground depth | 1×1 non-solid |
| Rubble | 32×32 | Accepted, ground depth | 1×1 non-solid |
| Cobweb | Existing code-drawn size | Generated candidate rejected; fallback retained | Unchanged, non-solid |

## Wolf

Existing two-frame sheet and silhouette are preserved. Presentation scale
is 1.08× its former size: frame bounds 46.44×32.4 world px, feet-aligned.
Its existing Pass 2 dark outline/contrast treatment was sufficient and was
not rerun. Contact shadow opacity rises from 0.30 to 0.36 without changing
shadow dimensions or targeting cue. Tier-scaled body stays 23×13.8 world px
at (-11.5,+2.3); hit radius remains 12. It stays smaller than Boar/Guardian.

## Temporary motion versus final animation

All monsters still have **two real idle frames only**. No real walk, attack,
hit or death strips were generated. `MonsterMotion` adds restrained velocity
bob/lean, existing-windup lean, damage/miss lunge and incoming-hit recoil.
Death retains the original code squash/fade. The layer changes display
origin/rotation with compensating body offsets, never actor position,
velocity, combat stats, AI state, action timing or telegraph geometry.
State resets on map change, respawn and replacement actor; dead states and
expired kicks are discarded. No per-frame display objects, filters or tweens.

| Monster | Idle | Walk / attack / hit | Death | Status |
|---|---|---|---|---|
| Crypt Lord | 2 real frames | Procedural | Existing fade/squash | Final action frames pending, highest priority |
| Grove Guardian | 2 real frames | Procedural | Existing fade/squash | Final action frames pending, highest priority |
| Crypt Knight | 2 real frames | Procedural | Existing fade/squash | Temporary |
| Elite Boar | 2 real frames | Procedural | Existing fade/squash | Temporary |
| Wolf | 2 real frames | Procedural | Existing fade/squash | Temporary; scale/shadow polished |
| Mushroom | 2 real frames | Procedural | Existing fade/squash | Temporary |
| Slime | 2 real frames | Procedural | Existing fade/squash | Temporary |
| Crypt Skeleton | 2 real frames | Procedural | Existing fade/squash | Temporary |
| Skeleton Brute | Reused Skeleton idle | Procedural | Existing fade/squash | Dedicated art still pending |

Procedural poses reduce rigid sliding, but do not supply footfall/contact or
the silhouette changes of final animation. PixelLab quota exhaustion was
reported in the interrupted handoff; this pass does not wait for more quota.

## HUD and gameplay lock

Shop/Daily/Map share one horizontal row at the minimap's top edge, minimum
12px top safe inset and 6–8px gaps. Existing Shop shell is preserved; no Shop
functionality is added. Tracker remains below this region. Camera stays 1.65
with its existing follow settings. No Settings/localization changes.

Runtime art-on/off comparisons cover player/monster rectangles, hit radii,
spawns, complete solid tile grids and static prop bodies in all three maps.
Chase/fight sampling checks body equivalence while posed. Maps, nav data,
AI/aggro, combat data, projectile simulation, Dodge and Story rules/gates/
checkpoints are unchanged from starting HEAD.

## Verification and review

Screenshots and logs remain ignored in `test-results/`, outside the commit. Review covers
Field den/pond/dark grass/moss/camp, Crypt Brute/Knight/Lord, combat feedback,
player skills/Dodge, responsive HUD and art-off geometry.

Initial review exposed fixture issues: the Wolf was placed outside its real
encounter, and Chromium profile cleanup raced child-process shutdown on
Windows. Fixtures now stay in the Den; cleanup closes Chromium gracefully
and retries removal of the test-created temporary profile. No test thresholds
were relaxed. Compact utilities receive a real 12px top inset.

Closing review found two more issues, both fixed:

- The top-aligned utility row covered the boss target frame's right end,
  including its **Winding up!** warning, at 844×390 and 640×360. At 640×360
  the frame also clipped the player frame. The frame stays centred while it
  fits. Otherwise `Hud.fitTarget` centres it in the gap between the player
  frame and the utility row, re-measured only on resize, and its state wraps
  onto its own line. New browser check P3-6 covers 960×540, 844×390 and
  640×360. At 640×360 the whole Grave Slam circle (92px screen radius at zoom
  1.65) stays on screen, and the label stays clear of all controls.
- Windows profile removal could still hit a transient Chrome file lock after
  every check had reported. It now retries up to five times and then only
  warns, because the profile sits in git-ignored `test-results/`.

Final results, closing session:

| Gate | Result |
|---|---|
| `npm run typecheck` | Clean |
| `npm run test:unit` | 591/591 |
| `npm run build` | Succeeds (existing >1.6MB chunk advisory only) |
| `npm run test:browser` (full) | 361/361, including P3-1…P3-6, MM-1…MM-3, Town→Field (M-3) and Town→Crypt (M-7) portals, HUD at 1366×768 / 960×540 / 844×390 / 640×360, CS-8 Grave Slam, Dodge, Story Crypt, no console errors |
| Camera zoom | 1.65 (P3-3) |
| Performance | 140 FPS, p95 7.1ms, 1/420 frames over 20ms. Earlier single runs failing p95 < 20ms reproduced on the starting HEAD `171b7ee` too (machine load, not Pass 3) |

## Remaining needs / focused Pass 4

MUST: dedicated Skeleton Brute; real walk/attack/hit frames for Crypt Lord
and Grove Guardian first. SHOULD: other monster action strips, NPC sprites,
item icons, Warrior passive icons, Crypt gates/doors and remaining details
(standing stones, giant mushrooms and ruin pillars still expose placeholders).
OPTIONAL: boss-specific VFX, environmental particles and illustrated utility
icons. The strongest remaining mismatch is real monster articulation against
the finished ground/props; Crypt carpet/door details are visibly temporary.

**Pass 4 scope: final walk/attack/hit animation for Crypt Lord and Grove
Guardian, fitted to existing action timings and verified against fixed bodies.**
