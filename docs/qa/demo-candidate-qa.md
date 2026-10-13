# Final Demo Candidate QA (2026-10-13)

- **Branch / commit:** `phaser-rebuild` at `0b6d9b13` ("feat: polish combat presentation").
- **Scope:** QA only. No production code changed in this pass.
- **Verdict:** **DEMO CANDIDATE**. No P0. No P1 prevents normal play. The end-to-end loop completes without debug
  tools, all targeted reviews pass, and the full suite is stable.

## Precheck

- **Working tree:** clean apart from local-only folders (`.codex-remote-attachments/`, `art-source/candidates/`, a
  new untracked `art-source/Refer/`). `test-results/` is git-ignored. None are committed.
- **Machine:** no stale project Node or Chrome processes; about 5.2 GB of RAM free at start.

## End-to-end: fresh New Game → Victory

A scripted player started a fresh profile and played the Demo using only:

- **Input:** arrows, Space, Q/E/R, Shift (Dodge), 1 (potion), T (talk), Esc.
- **UI:** the quest tracker's Go buttons and the NPC dialogue Accept / Complete buttons.

The driver read game state only to observe it, like reading the screen. It never called a debug mutator (a guard
rejects them).

| Step | Result |
|---|---|
| Town start | Captain Rowan offers *Welcome to Haven* |
| Quest 1 | accepted, then turned in at Smith Brann (Smith offers *Trouble in the Meadow*) |
| Field | wolves ×3, wolf fangs ×3 picked up, Elite Boar (Gore telegraph 805 ms) |
| Quest 2 | turned in at the Captain; the Crypt opens (Lv3 + quest) |
| Crypt | Skeletons ×6, Skeleton Brute (Bone Smash), Crypt Knight (Cleave), Crypt Lord (Grave Slam, Enrage) |
| Quest 3 / Victory | *Into the Sunken Crypt* claimed: +600 Gold, Enchant Stone ×2, Protection Stone ×1; Job Change unlocks |
| Grove Guardian (optional) | defeated after Victory (Stomp telegraph) |
| Wipe / recovery | 6 player defeats in the run, mostly from the bot's crude play. Auto-respawn each time, in the Crypt for Crypt defeats; progress kept; the fight continued and was won |

- **Time:** about 16 min of driver play to Victory, including its deaths. A first-time human is estimated at
  15–25 min.
- **Level:** Lv 1 → 12–13. The Internal Demo runs ×10 EXP and drops, so Job Change unlocks by the end.
- **Softlocks:** none.
- **Console errors:** none.
- **Duplicate damage events:** 0.

## Combat validation (real values, from the game's event log and the boss reviews)

| Attack | Wind-up → impact | Damage | Dodge |
|---|---|---|---|
| Brute — Bone Smash | 1403 ms (lock 1400) | unchanged (BP-6) | avoids (BP-7) |
| Crypt Lord — Grave Slam | 1104 ms (lock 1100) | 64 on every landed hit | avoids (LP-7) |
| Grove Guardian — Stomp | 1001–1007 ms (lock 1000) | 39 base (GP-6) | avoids (GP-7) |

- **Telegraphs:** the zone ends within one frame of the damage tick (CP-2).
- **Cooldowns, MP, potions:** cooldowns (CP-5, HUD), MP use and regeneration, potion use and auto-potion, and the
  potion buff icons (HS-1) all work.
- **Boss status rows:** Enraged chip and "Winding up!" (HS-5/6/10/11).
- **Animation timing:** unchanged (attack-animation checks 38/38).

## UI / UX by viewport (English and Thai)

Every window was reviewed at each viewport: HUD, Character, Inventory, Skills, Quests, More, Settings, Shop, Map,
Enhancement, Warp, Commissions, NPC dialogue, boss combat HUD and chat (also covered by the chat suite). An automatic
audit found no clipped text, no off-screen controls, no broken images and no undersized buttons in any of the six
combinations.

- **960×540:** PASS. Circular skill icons and cooldowns are clear; Character stats stay grouped; loadout sockets are
  usable.
- **844×390:** PASS.
- **640×360:** PASS. Thai labels fit; windows scroll where needed; the [T] Talk prompt is clear of the slots (CP-4).

Pet and Dungeon are intentionally hidden (`implemented: false`).

## Visual consistency

The Warrior's ready idle and its walk / attack transitions, NPC figures, monsters and bosses, the environment pass
(pond, Crypt stairwells, portcullis seals, soft shadows, landmark labels), soft red telegraphs, circular skill icons,
and item / currency icons are consistent at 1.65 zoom. Remaining items are listed under P1 / P2.

## Tests

| Check | Result |
|---|---|
| Typecheck, build | PASS |
| Unit tests | 630/630 |
| `--presentation-review` | 8/8 |
| `--warrior-review` | 24/24 |
| `--brute-review` | 24/24 |
| `--lord-review` | 24/24 |
| `--guardian-review` | 25/25 |
| `--hud-review` | 40/40 |
| `--hud-status-review` | 14/14 |
| `--story-review` | 12/12 |
| `--character-review` | 21/21 |
| `--skill-review` | 10/10 |
| `--npc-review` | 7/7 |
| `--environment-review` | 10/10 |
| Attack-animation checks | 38/38 |
| Full browser suite (one run) | **505/505**, no console errors, no file changed during the run (SHA-1); lowest free RAM about 3.2 GB |

Two non-reproducing timing flakes appeared on first runs. Each was rerun once as a targeted check, passed, and touched
no production code:

- **CP-2:** the first browser run straight after the build.
- **HS-1:** the potion icon sampled only 150 ms after use.

## Performance

| Measure | FPS | p95 | Worst frame |
|---|---|---|---|
| Full suite (warm combat check) | 112.9 | 14.1 ms | 27.9 ms |
| `--perf-review`, fights 2–3 | 128–132 | 13.8–13.9 ms | 27.7–34.7 ms |
| `--perf-review`, first fight after boot | 79–84 | 20.9–27.7 ms | **298–381 ms** |
| Previous commit `3917d52d`, first fight (same method) | 82.6 | 21.0 ms | 316 ms |

- **Warm play:** matches the recent stable result (about 128 FPS, p95 about 13.9 ms, worst about 34.7 ms).
- **Cold first fight:** one hitch of about 0.3 s. It is the same on `3917d52d`, so it predates the final combat
  polish and is not a regression.
- **Startup:** the first boot after a production build can take over 15 s on a cold dev server (test harness only).

## Blockers and gaps

**P0:** none.

**P1 (strong polish; none prevents normal play):**

1. **Quest "Go" fails silently on the main route.** Auto Move's L-shaped planner returns `no_path`, so Go does
   nothing and shows no message. The player has to walk by hand. It happens at three points:
   - Town: Captain → Smith Brann, from the Captain (`nav_town_enhancement`);
   - Field: → Elite Boar zone (`nav_field_elite_zone`);
   - Crypt: → Crypt Lord, from the mid sections (`nav_crypt_boss`).

   This predates the recent milestones. The likely fix is data: detour waypoints like `nav_town_pet` has, plus a
   "can't find a path" notice.
2. **No way to spend stat points.** Each level grants a free stat point, but only the dev API can spend it. The
   Story Crypt test assumes two points spent.
3. **Cold first-combat hitch** of about 0.3 s, once per session (pre-existing; see Performance).
4. **Story Victory banner** reads "BOSS DEFEATED! (no run: no reward)". At the climax this sounds like the player got
   nothing, though the Story reward comes at turn-in.

**P2 (post-Demo):**

- **EXP text:** the quest reward and chat say +2500 EXP while the floating text says +25000 (×10 demo multiplier).
- **Banner overlap:** the "QUEST COMPLETE: …" banner runs under the player frame at 960×540.
- **Thai mode:** quest, NPC and item text stays English. Settings says so.
- **Shop:** a developer sample; nothing can be bought.
- **Field travel:** the walk back to Town through the Field is often interrupted by aggro.
- **Telegraph on red carpet:** mid wind-up is subdued on the Lord's carpet.
- **Warrior art:**
  - the back-view blade is softer than the drawn art;
  - walking keeps the sword-down pose, so idle → walk switches poses;
  - the ready stance has no shoulder change.
- **Icons:** Charge, Provoke and Iron Guard are composed from existing art, not dedicated illustrations.
- **Test robustness:** HS-1 samples 150 ms after potion use; CP-2 is sensitive to a cold first run.

## Known acceptable limitations

- **Demo tuning:** the Internal Demo uses ×10 EXP and drops (`DEMO_TEST_DEFAULTS`).
- **Hidden screens:** Pet and Dungeon windows are not implemented. Repeat Dungeon runs unlock at Lv20.
- **Job Change and Warrior skills:** these come after the main chain (Lv11 + Job Trial). They are covered by the
  Character, Skill and Warrior reviews, not by the end-to-end run, which stayed a Novice.
- **No push or deploy:** this pass changed nothing outside this document.
