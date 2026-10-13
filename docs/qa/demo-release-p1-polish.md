# Demo release P1 polish (2026-10-13)

Follow-up to `docs/qa/demo-candidate-qa.md`, starting from `eba095ce`. Only the four P1 items were addressed; P2 is
untouched. There are no balance, monster, camera or art-direction changes.

## 1. Quest "Go" path failures

- **Cause:** the Auto Move planner only tried two L-shaped paths. Scenery between start and goal (Town buildings and
  the fountain, Field ruins, Crypt pillars and walls) made both fail with `no_path`.
- **Fix** (`src/navigation/pathing.ts`):
  - When both L-shapes are blocked, a breadth-first detour runs over the same collision tiles, with the same body
    margin. The step between tile centres is collision-checked too.
  - It returns the turn points, so every segment is axis-aligned and `steerToward` follows it exactly.
  - Hints, collision, gates and manual movement are unchanged.
  - Closed Crypt gates keep their existing rule: Auto Move stops at the doorway with the gate's message.
- **Never silent:** a failed Auto Move (`navigationChanged` failed: no path, stuck, portal) and a Go that cannot
  start (the new `navigationUnavailable` event from `goToQuest`) both put a localized line in the feed:
  - English: "Can't find an automatic route there. Please walk there yourself."
  - Thai: "ไม่สามารถไปยังจุดหมายอัตโนมัติได้ กรุณาเดินไปด้วยตนเอง"
- **Results** (real player body, from the QA positions):

  | Route | Result |
  |---|---|
  | Town: Captain → Smith Brann | arrived |
  | Field: → Elite Ruins | arrived |
  | Crypt: Section II → Crypt Lord | arrived, 151 px from the boss |

  Unit tests walk five QA positions on the real maps.

## 2. Stat-point spending (Character window)

- **Where:** a compact **Attributes** block under the derived stats lists STR, AGI, VIT, INT, DEX and LUK. Each value
  is base + allocated + job bonus.
  - A **Points N** badge shows the remaining points.
  - A **+** per attribute appears only while points remain.
  - While points remain, a green "N stat points to spend" pill in the window's top bar scrolls the sheet to the
    attributes when tapped.
- **Spending:** one tap spends exactly one point through `CombatWorld.allocatePlayerStat`, the same path the dev API
  used. Derived stats refresh, and the sheet rebuilds.
- **Lock:** at zero points the **+** controls are not rendered.
- **Persistence:** allocations were already part of the save snapshot (`stats.allocated`). A save → reset → load
  round trip keeps the point, the derived ATK and the window values.
- **Layout:** the sheet column scrolls (thin bronze scrollbar) when the window is short.
  - At 960×540 the paper doll stays fully in view (CI-10).
  - At 640×360 the **+** controls are 26 px and inside the window.
- **Strings:** new English and Thai entries in the string table.

## 3. Story victory banner

- **Story clear** (no dungeon run, Story profile):
  - English: **"CRYPT LORD DEFEATED!"** (`'{boss} DEFEATED!'`, boss name upper-cased);
  - Thai: **"ปราบ CRYPT LORD สำเร็จ!"** (`'ปราบ {boss} สำเร็จ!'`; monster names stay English in Thai mode, as
    elsewhere).
- **Run modes:** Normal / Hard / Hell keep their own copy (claimed / no reward left today).
- **Rewards:** reward logic is unchanged. The Story reward (600 Gold) is still granted once at turn-in (RP-5,
  story review).

## 4. First-fight cold hitch

### Root cause

The hitch comes from the **first display of the HUD target frame**, at the first target selection. Ruled out:

- combat logic, damage-number text, effect sprites, the hit-flash tint and the attack animation (each under 35 ms on
  first use);
- the in-world target marker, overlays and zone signs (no change when disabled);
- fonts (none load at that moment);
- `backdrop-filter` (computed `none` on the frame).

With the frame's update disabled, the first selection costs 7.6 ms; with it on, about 150 ms. During the long frame
the main thread is idle. Removing the frame's box-shadow, gradient or rounded rim each reduces the cost partly. This is
one-time GPU raster setup for those paint effects on a cold browser: the test harness uses a fresh profile every run,
and a returning player's browser keeps its shader cache.

### Mitigation (kept)

`TargetFrame` pre-paints itself at 1 % opacity for its first 4 frames after the HUD is created, while the world first
appears.

| Measure | Before | After |
|---|---|---|
| First target selection alone | 145–222 ms | 28–49 ms |
| First fight, Field settled 1.5 s, worst frame (3 runs each) | 152.7–180.4 ms | 69.4–76.4 ms |
| First fight p95 | about 14–21 ms | about 14–21 ms (unchanged) |
| Later fights | about 128 FPS, p95 13.9 ms | unchanged |
| Boot stall (first frame after the world appears) | about 680 ms | about 860 ms |

- **Cost:** the boot stall grows by about 180 ms on a cold browser. The one-time cost moves from the first fight into
  start-up.
- **HS-1 test:** HS-1 runs right after boot and sampled the potion icons after a fixed 150 ms. It now waits for the
  icons, up to 1 s; what it checks is unchanged.
- **`--perf-review` limitation:** its "first fight" window still includes the first-ever Field render right after
  `debug.reset()`. That map-load cost (298–466 ms) is outside this mitigation and is unchanged.

## Tests

| Check | Result |
|---|---|
| Typecheck, build | PASS |
| Unit tests | 636/636: new detour tests, five QA-route walks, the Thai placeholder parity test |
| `--release-review` (new, also in the default suite) | 8/8 |
| `--character-review` | 21/21 |
| `--story-review` | 12/12 |
| `--hud-review` | 40/40 |
| `--hud-status-review` | 14/14 (×2) |
| `--presentation-review` | 8/8 |
| 640×360 Thai UI smoke | clean |
| Full browser suite (one run) | 509/510 |

- **Full-suite failure:** the only failure was RP-1's Town case. The test started Quest 1 without tracking it, and an
  earlier suite had changed the tracker. The setup now tracks the quest, and it passes after every quest has been
  untracked, as well as standalone.
- **Full-suite performance:** 114.4 FPS, p95 14.0 ms, max 27.8 ms (warm).
- **Known flakes, unrelated:** the `monsterMotion` unit test fails intermittently on the untouched baseline too
  (1 in 4).
