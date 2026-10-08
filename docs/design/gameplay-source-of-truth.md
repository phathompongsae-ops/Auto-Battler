# Gameplay Source of Truth (Demo V1)

> **Read this file before any gameplay-system work** (jobs, skills, combat,
> dungeons, quests, inventory, loot, party, AI). If code and this file
> disagree, the disagreement is listed under [Known conflicts](#known-conflicts);
> anything not listed is a bug in either the code or this file and must be
> resolved here first.
>
> Art direction lives in `docs/art/` and is out of scope here.

- Created: 2026-10-07 (Gameplay Alignment Audit), branch `phaser-rebuild`, base `f3ddb28`
- Scope: Demo V1. Numbers marked *TBD* are deliberately **not** decided yet;
  do not invent them in code. Add them here first.

**Status legend**

| Tag | Meaning |
| --- | --- |
| **IMPLEMENTED + LOCKED** | In code, matches the design, must not change without a design decision. |
| **LOCKED, NOT IMPLEMENTED** | The design is decided; the code does not do it yet (or only partly). |
| **FUTURE / POST-DEMO** | Direction only. Do not build it in Demo V1. |

**Out of scope for now (do not start):** Field / Dungeon environment art,
Archer / Mage / Cleric / Ninja trees, Class 2, online multiplayer, server
bots, Pet / Summoner gameplay expansion, Cards, Socket gameplay, PvP maps,
The Shattered Spire.

---

## 1. Job and skill foundation

### IMPLEMENTED + LOCKED

| Rule | Where |
| --- | --- |
| Class 1 Job Change at **Lv11** (Job Trial quests, then selection; permanent) | `src/data/jobData.ts` (`JOB_CHANGE_LEVEL`), `src/data/jobChangeData.ts`, `src/progression/JobChange.ts`, feature `job_change` in `src/data/featureData.ts` |
| Class 1 SP: +1 per level from Lv11 to Lv40, so **Lv11 = 1, Lv20 = 10, Lv40 = 30** | `SKILL_POINT_PROGRESSION` in `src/data/jobData.ts`; `earnedSkillPoints` in `src/progression/CharacterProgress.ts` |
| **No** quest or job-change bonus SP (levels only) | `src/data/jobData.ts` comment + formula; quest rewards have no SP field |
| Novice earns 0 SP | `earnedSkillPoints` |
| **Cross-branch spending allowed, no permanent branch lock.** Gates count only SP spent in the node's own branch | `branchSpendRequirement` in `src/skills/skillTreeRules.ts` (`checkLearn`) |
| Per-skill rank caps (1 / 3 / 5 / 10). **No universal Max Skill Lv3 rule** | `maxRank` per node, `src/data/skillTrees/warriorTree.ts` |
| Free tree reset in Alpha/Demo (all SP back, tree buffs/procs removed) | `SkillTree.reset` in `src/skills/SkillTree.ts` |
| Saved ranks are replayed through the real learn rules on load | `rankProblem` (`skillTreeRules.ts`), `src/save/playerSave.ts` |

### Warrior Class 1: IMPLEMENTED + LOCKED (do not redesign or rebalance)

Tree `warrior_c1`, `src/data/skillTrees/warriorTree.ts`; skill shells in
`src/data/skillData.ts` (all cast values come from the learned rank).

| Branch | Node | Max rank | Gate (branch SP) |
| --- | --- | --- | --- |
| Core | Power Slash (`power_strike`) | 5 | - |
| Core | Charge | 1 | - |
| Tank | Heavy Armor Mastery (passive) | 10 | - |
| Tank | Shield Bash | 5 | - |
| Tank | Provoke | 3 | 5 |
| Tank | Iron Guard | 1 | 10 |
| Tank | Guardian Instinct (proc: <30% HP) | 1 | 15 |
| Damage | Sword Mastery (passive) | 10 | - |
| Damage | Whirlwind | 5 | - |
| Damage | Heavy Strike | 3 | 5 |
| Damage | Berserk | 1 | 10 |
| Damage | Battle Instinct (proc: 3-hit streak) | 1 | 15 |

Covered by `tests/unit/warriorSkillTree.test.ts`. Any change here needs an
explicit design decision.

### Temporary Demo job-selection limitation

- Production Job Change keeps all five classes visible but only Warrior is
  selectable while it has the only completed Class 1 tree. Other buttons are
  disabled and labelled Not yet implemented; the authoritative selection
  service also refuses them. Existing saves are preserved, and explicit dev
  force tools can still preview every class and its art. No trees invented.
- Archer / Mage / Cleric / Ninja exist as jobs (`src/data/jobData.ts`) with
  `skillTreeId`s that have **no tree yet**. They (and the Novice) use the
  TEMPORARY DEMO KIT (`DEMO_KIT_LOADOUT`, `src/data/playerData.ts`). Their
  trees are **not designed**; do not design them as part of other work.

### FUTURE / POST-DEMO

- Class 2 (Lv40, `JOB_CHANGE_LEVEL[2]`): schema exists, no data, no SP rule.

---

## 2. Movement skills (Dash / Charge / Lunge)

### LOCKED (rule for every future movement skill)

- Straight-line movement; direction locked at activation.
- Direction source: **target position > current input > facing** (fallback order).
- No steering, no curving, no homing (unless the skill is explicitly Tracking/Homing).
- Collision stops the movement. No pathfinding during the dash.
- The target may dodge out of the line.

### IMPLEMENTED (Warrior Charge, preserved as is)

`dash_strike` effect -> `CombatWorld.dash` (`src/game/CombatWorld.ts`):
direction toward the target's position at activation, straight line,
collision-checked every 4 px and stops at walls, no pathfinding. See
[Known conflicts](#known-conflicts) C-5 for where it differs from the general
rule (needs a target; instant reposition).

---

## 3. Basic Dodge and class mobility

### IMPLEMENTED + LOCKED: Basic Dodge

- Shared `DodgeSystem` requests operate on any combat actor through world collision
  and movement adapters. Human controls: either Shift key or Dodge utility socket.
- Every class; 5.0 s independent cooldown; 0.30 s reusable actor invulnerability;
  72 world px travel over 0.20 s (360 px/s), **4-direction** (cardinal),
  movement input first, facing as the fallback. Desktop: Shift. Mobile: the
  Dodge utility button.
- Game time only. No stamina, charges, GCD, cleanse or skill-cooldown changes.
- Never cancels an executing action (a swing, a skill wind-up). A press made
  during one is **buffered for up to 0.5 s** in `PlayerCombatController`
  (`UTILITY_INPUT_BUFFER_MS`) and performed on the first free frame; while it
  waits, held ATK starts no new swing. The same buffer applies to HP/MP potion
  presses. (Found in the 2026-10-08 playtest: a basic-attack swing locks 444 of
  every 500 ms, so unbuffered presses while holding ATK were mostly lost.)
  `DodgeSystem` / `PotionSystem` themselves still refuse during a lock.
- Collision sweeps every 2 px against the
  actor footprint, solid map/props/water/bounds and closed Story gates.
  Under 8 px available travel consumes nothing; partial movement consumes normally.
- All incoming hits (normal, projectile, direct/AoE/telegraph) check actor
  invulnerability in `CombatSystem`; rejected hits use existing Miss feedback.
- Lightweight opacity cue, no assets, filters or particle system. Utility radial CD.
- Tests: `dodge.test.ts`, `dodge.test.mjs`; real Brute and Lord damage resolution.

### LOCKED (direction), NOT IMPLEMENTED: class mobility

- Every class eventually gets at least one real movement-based survival skill
  (Dash / Blink / Leap / Backstep), optionally with a short i-frame, separate
  from Basic Dodge. Not designed per class yet; do not design it now.

---

## 4. Story Crypt (Dungeon 1, `demo_crypt`)

### IMPLEMENTED + LOCKED

- The Story Crypt is the introductory/tutorial dungeon.
- **Entry requires Lv3 and `mvp_02_meadow` (Trouble in the Meadow) claimed.**
  Data: `src/data/dungeonAccess.ts`; check: `src/world/dungeonAccess.ts`.
  Enforced on the gate portal (walked or Auto Move) in
  `CombatWorld.takePortal` and on the Dungeon Warp Scroll in
  `PlayerActions.useWarpScroll` (refused before a scroll is spent). Never
  checked on load. Refusal: `mapEntryBlocked` event + HUD line
  ("Requires Level 3", "Complete Trouble in the Meadow first").
  Tests: `tests/unit/dungeonAccess.test.ts`, `tests/browser/maps.test.mjs` (M-7a).
  *(At audit time this gate was still uncommitted work in the working tree.)*
- The Lv20 **Dungeon feature does not block the story loop**. A Lv3+ player
  who meets the entry rule can enter, fight the Crypt Lord, complete
  `mvp_03_crypt` (objectives: reach `demo_crypt_entrance`, kill
  `crypt_lord`), turn it in to Captain Rowan for its Story rewards
  (2,500 EXP, 600 Gold, 2 Enchant Stones, 1 Protection Stone, once), and
  return to Town through either exit portal.
  Tests: `tests/unit/storyCrypt.test.ts`, `tests/browser/questFlow.test.mjs` (QF-6, QF-7).

### IMPLEMENTED: Story / Tutorial combat profile (Lv3–5)

Story visits and Lv20 repeat runs share the map but **not** the monster
numbers. The repeat (base) data in `src/data/monsterData.ts` is unchanged.

- **Selection** (`src/dungeon/encounterProfile.ts`, chosen in
  `CombatWorld.enterMap` before monsters spawn): `story` when the map has a
  Story profile **and** the Lv20 Dungeon feature is neither unlocked nor
  already earned; otherwise `standard` (base data). A run is only issued with
  the feature unlocked, and `startRunOnEntry` also refuses during a Story
  visit, so a Story clear never issues, claims or spends a run.
- **Data** (`src/data/storyEncounters.ts`): per-monster level / HP / ATK / DEF
  (MDEF follows DEF), an optional Story signature attack, and a respawn delay.
  Story mobs stay down for the visit (30 min), so a cleared section stays
  cleared after a death; leaving and re-entering respawns everything.
- **Story signature attacks** (`src/data/skillData.ts`): `crypt_slam_story`
  and `crypt_cleave_story` keep the exact telegraph (wind-up, radius / reach,
  cooldown) of `crypt_slam` / `boar_gore` with multipliers sized for Story ATK.

| Monster | Story (Lv3–5) | Lv20 repeat (unchanged) |
| --- | --- | --- |
| Crypt Skeleton | Lv4, 110 HP, ATK 10, DEF 4 | Lv20, 140 HP, ATK 14, DEF 6, respawn 5 s |
| Crypt Knight (Elite) | Lv5, 550 HP, ATK 12, DEF 7, Cleave ×6.5 (0.8 s wind-up, step out of reach) | Lv20, 700 HP, ATK 20, DEF 12, Gore ×2.4, respawn 15 s |
| Crypt Lord (Boss) | Lv6, 2,800 HP, ATK 9, DEF 8, Grave Slam ×8 (1.1 s wind-up, 84 px), Enrage <35% (+40% ATK) | Lv20, 3,000 HP, ATK 26, DEF 16, Grave Slam ×2.2, Enrage <35%, respawn 120 s |

| Skeleton Brute (Story only) | Lv4, 380 HP, ATK 9, DEF 4, Bone Smash ×6 (1.4 s wind-up, 70 px, every 3.5 s) | does not spawn |

Reference player: Lv3–5 Novice, no gear (all early drops are equipment
level 10), 2–4 free points split STR / VIT, demo kit (Power Slash, Fire
Bolt, Guard); 425–525 HP. The measurements below are the original **baseline
without Dodge or potions** (dungeon kills give no EXP). The current Demo adds
Basic Dodge and real potion recovery without changing these monster stats.
After a party wipe the party
retries from its latest checkpoint at HP 100% / MP 50% (see Dungeon 1 run).

Measured with the real combat systems (`tests/unit/storyEncounter.test.ts`,
20 seeds; player steps out of 3 of 4 telegraphs):

- 1 Skeleton: ~1 s. 3 Skeletons: always won, ~3 s, ~8–10% HP lost. Pack of 4:
  always won, ~4.5 s, ~16% HP lost.
- Skeleton Brute: always won, ~6 s, telegraphs twice; a Smash that lands is
  ~10% of a Lv3 bar.
- Knight + guard Skeleton: always won, ~7 s, ~17% HP lost; a Cleave that
  lands is ~13% of a Lv3 bar.
- Crypt Lord at Lv3 from full HP: ~100% won, ~36 s, ~6 Slams, ~40% HP left;
  ignoring every Slam: ~10% won; arriving with 60% HP: ~50% won; its basic
  attacks alone never outpace a player who keeps attacking. Slam that lands:
  ~14% (enraged ~20%) of a Lv3 bar.
- Crypt Lord after a checkpoint retry (HP 100%, MP 50%): ~100% won, ~42 s,
  ~39% HP left.
- The Lv20 Crypt Lord against the same player: never won.

### LOCKED: Story Crypt length

- The Story Crypt is a Tutorial/Story Dungeon. **Target first clear: about
  4–6 minutes for a human first clear.** The longer target is retired by
  the 2026-10-08 design decision. Do not add filler to stretch this tutorial.
- The length comes from encounter pacing, teaching moments, the Elite, the
  checkpoints and the boss flow. **Never inflate monster HP to add time.**
- Future Lv20 repeat dungeons may be longer and more demanding.
- Measured (feedback pass, 2026-10-07; legitimate Lv3 runs with real controls:
  Auto Move from Town, arrow keys, held ATK, Q/E/R, stepping out of
  telegraphs; no teleports, HP edits or gate bypasses), game time from the
  Crypt entrance:

  | Scripted player | Section I | Brute | CP A | Elite | CP B | Boss down | Exit | Wipes | Entering boss (HP / MP) | HP after |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Skilled (dodges every telegraph, all skills) | 8.8 s | 14.4 s | 16.1 s | 23.4 s | 25.1 s | 70 s | 75.5 s | 0 | 266/450, 58 MP | 31 |
  | Newcomer (dodges ~60% after 0.3 s, Power Slash only) | 10.2 s | 15.8 s | 17.2 s | 28.1 s | 30.2 s | 97.4 s | 102.4 s | 1 (boss) | 177/450, 157 MP | 98 |
  | Newcomer (second run) | 10.3 s | 17.2 s | 18.8 s | 29.3 s | 31.2 s | 95.5 s | 100 s | 1 (boss) | 251/450, 161 MP | 99 |

  Tutorial lines never blocked or delayed play (feed only); no encounter
  felt like filler (each fight is 1–10 s, the boss ~40–65 s). Scripts know
  the route and decide instantly; a real first-time player adds reading
  (the original 8 short lines), orientation, hesitation and probably one or two more
  wipes. **Baseline human first-clear estimate: about 3–5 minutes** (before Basic
  Dodge/Potions). The current intended human experience is 4–6 minutes;
  scripted combat time is not a human pacing measurement. See C-13.
- Re-measured 2026-10-08 with the **actual Demo systems** (Basic Dodge with
  Shift + direction, held ATK, real skills, the new-character starter potions
  3 Small HP + 3 Small MP with Auto Potion at its defaults, no teleports / HP
  edits / gate bypasses / boss manipulation):

  | Scripted player | Brute engaged / down | CP A | Knight engaged / down | CP B | Boss fight | Clear (exit) | Wipes | Dodges | Potions | Boss entry → after |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Skilled (dodges every telegraph) | 10.5 / 17.1 s | 18.7 s | 19.3 / 27.5 s | 29.4 s | 35 s | 71.2 s | 0 | 8 (0 telegraph hits) | 1 HP, 3 MP | 265/450 HP, 57 MP → 203/450 HP, 64 MP |
  | Newcomer (~60% of telegraphs, 0.3 s late) | 11.5 / 22.2 s | 23.6 s | 24.2 / 33.6 s | 35.3 s | 76 s (incl. 1 retry) | 117.7 s | 1 (boss) | 11 (6 telegraph hits) | 3 HP (Auto) | 229/450 HP, 168 MP → 115/450 HP, 72 MP |

  All nine tutorial lines appeared naturally (the Dodge lesson at the Brute,
  the HP potion lesson at ≤45% HP with a potion carried). No attack was
  unavoidable once Dodge presses were buffered (below); no encounter is filler.
  Scripted mechanical time is 1.2–2 min; with a first-timer's reading,
  orientation, learning to Dodge and one or two wipes, the realistic human
  first clear is about **4–6 minutes**, matching the design target. No HP
  inflation or filler was added.

### IMPLEMENTED: Story Crypt feedback

- **Tutorial lines** (Story profile only): `StoryEncounterProfile.tutorial`
  (`src/data/storyEncounters.ts`), selection in `src/dungeon/tutorial.ts`,
  fired by `CombatWorld` (`tutorialHint` event) and shown in the HUD feed
  (`LootFeed`, ~7 s, cleared on leaving the map). Beats: entrance objective;
  first Skeleton (tap / Tab to target, hold ATK / Space); the pack (back away,
  don't get surrounded); the Brute (red circles: Dodge/Shift out);
  Checkpoint A (retry point, no healing); Elite: Crypt Knight; Checkpoint B
  (boss ahead, no healing); the Crypt Lord's intro. Each fires once per
  dungeon attempt (on entry, first engagement, checkpoint, or first HP ≤45%
  while carrying an HP potion); retries and re-crossing never repeat them. Never pauses play.
- **Gate visuals:** closed Story progression gates show a faint amber rune
  seal on the doorway floor (`src/rendering/GateBarriers.ts`, built from the
  same gate data; visible exactly while closed; none in Lv20 runs).
  Collision and the "Defeat … first" message are unchanged.
- **Checkpoint feedback:** first activation shows one cool-blue pulse and
  "Retry point updated" (`CombatEffects`), plus the existing feed line; no
  healing, nothing persistent.
- Basic Dodge and HP/MP Potions are implemented. A short conditional HP
  potion lesson appears once per attempt on damage at ≤45% HP only with an
  HP potion in inventory. Party AI remains **not implemented**.

### What the Lv20 Dungeon feature controls (as implemented)

Feature `dungeon` (`requiredLevel: 20`, `src/data/featureData.ts`):

| Area | Gated by Lv20 feature? | Code |
| --- | --- | --- |
| Story Crypt entry (portal / Auto Move / warp) | **No**. Lv3 + quest rule only | `dungeonAccess.ts` |
| Walking inside the Crypt, fighting mobs / Elite / Crypt Lord | **No** | map spawns, `cryptMap.ts` |
| Which monster numbers spawn (Story profile vs Lv20 base) | **Yes**: Story while locked, base once unlocked | `dungeon/encounterProfile.ts` |
| `mvp_03_crypt` progress, completion, turn-in rewards | **No** | `QuestSystem` (kill signal has no run/feature check) |
| Story / first-clear rewards (= `mvp_03_crypt` rewards) | **No** | `src/data/quests/mainQuests.ts` |
| Issuing a dungeon run on entry (`startRunOnEntry`) | **Yes**: no run below Lv20 | `CombatWorld.startRunOnEntry` |
| `enterDungeon(dungeonId, difficulty)` (Normal / Hard / Hell) | **Yes** | `PlayerActions.enterDungeon` (`gate('dungeon')`) |
| Repeat boss rewards (Full Reward / Assist, daily entitlements, Boss Fragments, materials, gear) | **Yes** (need a run) | `CombatWorld.bossDefeated` -> `src/dungeon/claim.ts` |
| `dungeonCleared` event -> `dungeon_clear` quest objectives (Daily / Weekly) | **Yes** (only a claimed run emits it) | `src/dungeon/claim.ts` |
| Dungeon menu screen (`U`) | **Yes** (screen not implemented yet) | `src/ui/data/screens.ts` |
| Kill rewards inside a dungeon | Never (dungeon zone: no EXP / drops / Field Energy, any level) | `src/energy/fieldEnergy.ts` |

The Lv20 feature is reserved for the full Dungeon system: repeat runs,
difficulty/reward tiers, the Dungeon menu, matchmaking.

### IMPLEMENTED: Dungeon 1 run structure (Story Crypt)

Route (unchanged rooms and corridors, `src/data/maps/cryptMap.ts`):

| Step | Where | Story encounter | Teaches |
| --- | --- | --- | --- |
| 1 | Section I, by the door | 1 Skeleton (`story_s1_lone`) | basic targeting / combat |
| 2 | Section I, far end | pack of 4 Skeletons (`story_s1_pack`), out of reach of fight 1 | handling a group |
| 3 | Section II, between the tombs | Skeleton Brute (`story_s2_brute`) | reading and stepping out of a telegraph |
| A | corridor before the Elite Chamber | **Checkpoint A** "Elite Chamber Gate" | |
| 4 | Elite Chamber | Crypt Knight + guard Skeleton | fighting an Elite |
| B | corridor before the Boss Room | **Checkpoint B** "Boss Room Gate" | |
| 5 | Boss Room | Crypt Lord | a real boss |

Lv20 runs keep their original Section I / II spawns (zones marked
`profiles: ['standard']`; the Story ones `['story']`), the same Elite
Chamber and Boss Room; their spawn ids, kinds and places are unchanged.

**Encounters** (`MapDef.encounterAreas`, `MonsterSpawnZone.arena`,
`src/world/encounters.ts`, `MonsterBrain.leashed`,
`CombatWorld.findAggroTarget`): each room is an encounter arena; the
corridors belong to none. An arena monster only notices a player on its
floor, fights anywhere on it, and gives up (walks home, full reset) only
when it or its target leaves it. Monsters without an arena keep the radius
leash. One spawn zone = one encounter for resets.

**Progression gates** (`MapDef.progressionGates`, `src/dungeon/gates.ts`,
`CombatWorld.checkProgressionGates`): a gate shuts one doorway (a tile
rect) while any of its `requiresCleared` spawn zones still has a monster
standing. Walking or Auto Move into a closed doorway puts the player back
where they last stood outside every closed gate, stops Auto Move and shows
the gate's message (at most every 2 s per gate). Rooms themselves are never
gated: the player moves freely inside an active encounter. Gates can be
limited to profiles. Story Crypt (Story profile only; Lv20 runs have none),
cumulative, one per corridor north out of a room:

| Gate | Doorway (tiles) | Opens when down | Message |
| --- | --- | --- | --- |
| `story_gate_section_1` | x 14–17, y 41 (Section I → II) | lone Skeleton, pack of 4 | "Defeat the Skeletons of Section I first" |
| `story_gate_section_2` | x 14–17, y 30 (Section II → Checkpoint A / Elite) | + Skeleton Brute | "Defeat the Skeleton Brute first" |
| `story_gate_elite` | x 14–17, y 20 (Elite → Checkpoint B / Boss) | + Knight guard, Crypt Knight | "Defeat the Crypt Knight and its guard first" |

So the Story order is enforced: Entrance → lone Skeleton → pack → Brute →
Checkpoint A → Knight + guard → Checkpoint B → Crypt Lord; the Boss Room
cannot be entered on foot until the Elite and everything before it is down
(which is also everything Checkpoint B needs).

**Checkpoints** (`MapDef.checkpoints`, `src/dungeon/attempt.ts`): a
checkpoint activates when the player stands in its trigger with its
`requiresCleared` zones down (A: the three teaching encounters; B: the
Knight and its guard; zones absent under the current profile count as
down). The furthest one along the route (`order`) is the retry point;
walking back never moves it back. **Activating restores nothing.**
Checkpoint progress belongs to the current attempt.

**Attempt / wipes** (`DungeonAttempt`, `CombatWorld.onDeath` /
`respawnPlayer`): entering a dungeon map starts a fresh attempt.
- A wipe = every active party member down (`partyDefeated`;
  `CombatWorld.activeParty()` is the player alone until parties exist).
  One member's death never counts.
- **LOCKED wipe semantics.** The limit is the number of *recoverable*
  full-party wipes per attempt (`DIFFICULTIES[run difficulty].partyWipeLimit`):

  | Difficulty | Recoverable wipes (each retries) | The attempt fails on |
  | --- | --- | --- |
  | Normal | 4 (wipes 1–4) | the 5th wipe |
  | Hard | 3 (wipes 1–3) | the 4th wipe |
  | Hell | 2 (wipes 1–2) | the 3rd wipe |

  The Story Crypt has no run and uses Normal's (4 recoverable; the 5th
  fails).
- With a retry left: one is spent; every encounter that is not fully down
  resets (fallen members stand up; all full HP, home, idle; cleared
  encounters stay down); the party reappears at the latest checkpoint (or
  the entrance if none) with **HP 100%, MP 50%**.
- Out of retries: the attempt fails: no clear reward, no run claimed or
  spent, quest progress untouched; the party is sent to Town through the
  dungeon's exit with full HP. Entering again starts a fresh attempt with
  every encounter back, so the Story quest is never missable.
- After the boss is down (clear), deaths spend nothing.
- HUD feed lines: "Checkpoint: …", "Defeated: N retries left",
  "Defeated: no retries left", "Dungeon failed: returned to Town".
- Remaining: no free HP/MP refill station before the boss (none exists).
- *TBD:* revive rules once party members exist.

### First clear vs repeat

- LOCKED: First Story Clear has unique Story rewards that never repeat
  (implemented: `mvp_03_crypt` rewards, claimable once).
- LOCKED: repeat clears focus on Fragments / Materials / upgrade resources
  (implemented through the Lv20 run claim: `src/dungeon/rewards.ts`,
  `src/data/dungeonRewards.ts`; see C-7 for the extra EXP/gear it also grants).

---

## 5. Skill assignment (hotbar)

### IMPLEMENTED + LOCKED

- Five unique active slots, stable skill ids in `CharacterProgress.hotbar`.
- Q / E / R / F / G and mobile use the same logical slots.
- Learning an active fills the first empty slot; a full bar leaves it learned
  and unassigned with feed feedback. Passives and procs cannot be assigned.
- Skills window supports click/tap selection and slot placement, swapping,
  replacement, clearing and drag placement. Edits during an executing action
  wait until it finishes; they do not cancel it.
- Cooldowns remain skill-owned; slot edits never touch MP, cooldowns, statuses,
  buffs or proc internal cooldowns. Only the existing tree reset removes tree buffs.
- Save v4 adds optional `hotbar`; older records migrate deterministically from
  the original tree-order layout. Invalid/unlearned/duplicate ids become empty
  slots without changing ranks. Explicit empty slots persist. No presets.
- Tests: `hotbar.test.ts`, `hotbar.test.mjs`, existing Warrior/save suites.

---

## 6. Potions

### IMPLEMENTED + LOCKED

- Four real inventory consumables (stable ids `small_hp_potion`,
  `medium_hp_potion`, `small_mp_potion`, `medium_mp_potion`), 20 per slot.
- Small HP: 100 instant + 5% Max HP; Medium HP: 180 + 8% Max HP.
  Small MP: 50 instant + 5% Max MP; Medium MP: 90 + 8% Max MP.
- HoT duration 3 s, one tick each second (three ticks). Percentage snapshots
  Max HP/MP at use; cumulative rounding distributes the rounded total exactly.
  HP and MP coexist; a new potion replaces the same resource's potion HoT.
  Clamp to max; dead actors receive nothing. Quiet HoT ticks avoid text flooding.
- HP cooldown 8 s; MP cooldown 12 s; independent, no GCD. Cannot cancel an
  action: reject cleanly during its lock. Full resources and zero count refuse.
- Keyboard 1 / 2; distinct HP/MP utility buttons, radial cooldowns; inventory
  Use calls the same `useItem` path. Small preferred, Medium fallback.
- Auto HP defaults enabled at 35%; Auto MP enabled at 25%, effective only
  with a real inventory item and current combat engagement. Never fires dead,
  out of combat, during a lock or cooldown. 250 ms game-time checks with
  hysteresis/cooldown debounce, same item-use path and no free healing.
- Minimal Settings controls persist toggles and thresholds in optional v4
  `autoPotions`; older saves default without altering inventory. No schema bump.
- No general consumable vendor exists. New Demo characters receive 3 Small
  HP + 3 Small MP through initial inventory; loading an old save never grants
  a new supply. Medium data exists without a new shop or broad drop source.
- Shared `PeriodicResourceSystem` owns deterministic game-time recovery on
  combat actor state (available for future poison/regen). Runtime effects and
  utility cooldowns are not serialized, consistent with skill timer policy.
- Tests: `potions.test.ts`, `potions.test.mjs`, save and HUD/browser suites.

---

## 7. Inventory, weight, Reward Cache

### IMPLEMENTED + LOCKED

- Bag = **48 slots** (`BAG_CAPACITY`, `src/data/inventoryData.ts`); a
  material stack or an unequipped equipment piece takes one slot; equipped
  gear takes none (`src/inventory/Bag.ts`).
- Normal loot only enters with room; otherwise it stays on the ground and
  the HUD says so (`lootBlocked`). No movement / combat penalty.

### LOCKED, NOT IMPLEMENTED

- **Weight Capacity** in addition to slots. Equipped gear does not count;
  stackable materials weigh per item and are very light. When slots **or**
  weight are full, normal loot cannot be collected; no movement/combat penalty.
  *TBD:* capacity value, per-item weights.
- Important Story / Quest / Boss / Rare rewards are never lost.
- **Reward Cache**: Boss / Rare / Story-important items that do not fit go
  to the Cache. No expiry in Demo V1. Reachable from the menu anywhere.
  Claim All takes everything that currently fits; the rest stays.
  *Current code keeps the "never lost" promise differently (C-6).*

---

## 8. Party

### LOCKED, NOT IMPLEMENTED (nothing of this exists in code yet)

**Composition**
- Max 4 including the player. Demo AI members unlock through the story, in
  order: 1. Tank, 2. Healer/Support, 3. DPS. Chosen / swapped in Town.
- Each AI character has its own Level / EXP, Skill Tree / SP, Gear,
  Inventory, Gold / materials. AI earns EXP independently, with catch-up EXP
  when too far behind. AI auto-equips gear and spends SP by Role/Build preset.
- AI not in the party gets background simulated activity: EXP, Gold, common
  materials only (no Rare gear, no Boss gear, no important quest items).
- *TBD:* catch-up threshold and rate, background activity rates, story
  unlock points, which jobs/presets the three AI members use (their trees
  are not designed; see section 1).

**Combat AI**
- Autonomous, condition-based, plus simple player commands (e.g. Focus Boss,
  Heal Priority) that override normal preferences.
- Tank: situational boss / add / protect-healer behaviour.
- DPS: follows the player's target; reacts to dangerous adds, low-HP
  threats, pressure on the healer.
- Healer: lowest-HP priority with extra weight on the Tank / focused target.
- Real (simplified) Threat/Aggro: Tank has a strong threat advantage; Taunt
  overrides temporarily. Support may revive in combat when safe.
- AI uses potions by threshold, conserves MP when low, may use MP potions.
- AI dodges only dangerous telegraphs, then returns to role positioning.

**EXP and loot**
- Party EXP bonus: 2 members +5%, 3 members +10%, 4 members +15%.
- Eligibility: inside the Encounter Zone **and** real contribution (damage,
  tanking / aggro, heal, buff / debuff, CC, revive). A dead member still
  receives EXP / loot if they contributed and remain in the encounter.
- Quest items: every eligible member gets their own progress.
- General materials / consumables may be distributed. Boss gear is Personal
  Loot (AI gets its own into its own inventory). Need/Greed for
  non-personal gear considers Role/Build, not item level alone.

---

## 9. AI player architecture (FUTURE / POST-DEMO; constraint now)

Do not build server bots now, but do not make them impossible:

- Human and AI characters must use the same Character / Combat / Skill /
  Inventory / Quest systems.
- Control source must be separable: Human Controller, AI Controller, future
  Network Controller.
- Future AI players may farm, quest, upgrade, return to Town and join parties.

Current seams and blockers (see C-8):

- Good: combat code only sees abstract `Action`s through `ActionSource`
  (`src/input/Action.ts`, `src/input/InputController.ts`);
  `PlayerCombatController` takes an input + a loadout provider; skill rules,
  damage, SP rules are pure modules.
- Blocking for a second character: `CombatWorld` owns exactly one `player`
  and the inventory / wallet / quests / features / dungeon ledger at world
  level, not per character; monsters can only target `this.player`
  (`CombatWorld.findAggroTarget`).

---

## Known conflicts

Found in the 2026-10-07 audit. "Open" = needs a design decision or a planned
milestone; nothing here may be "fixed" by inventing numbers.

| # | Conflict | Status |
| --- | --- | --- |
| C-1 | **Story Crypt is tuned as Lv20 content.** Crypt mobs, the Crypt Knight and the Crypt Lord are level 20 (`crypt_lord`: 3,000 HP, ATK 26, DEF 16; `src/data/monsterData.ts`) and damage has no level term. Estimated solo Novice at Lv3 (all stat points spent, basic attacks only, no gear, no potions): about 46-52 s to kill the boss vs about 23-27 s survival against its basic attack alone (slam, enrage, adds ignored). The Lv3 loop is **mechanically open but not realistically winnable solo**. | **Resolved (stats)** by the Story profile (section 4); the Lv20 data is unchanged. The former duration mismatch is resolved by the short-dungeon design decision in C-13. |
| C-2 | No checkpoint / wipe system. | **Resolved** (structure pass): checkpoints, party-wipe limits, HP 100% / MP 50% retries, failure flow (section 4). |
| C-3 | Skill loadout is derived (learned actives in tree order fill 5 slots). A Warrior can learn up to 8 actives; the 6th onward is silently unslotted; a new skill can shift existing slots; no manual arrangement. | **Resolved:** persistent assignment, safe edits, migration and Skills editor (section 5). |
| C-4 | Basic Dodge and potions do not exist (reserved HUD sockets only). | **Resolved:** shared Basic Dodge and real HP/MP/Auto Potion systems (sections 3/6). |
| C-5 | Warrior Charge requires a target (no input/facing fallback) and repositions instantly (the target cannot step out of the line). | Accepted for Warrior (preserved as is). The general movement rule applies to every **new** movement skill. |
| C-6 | Guaranteed rewards (quest claim, dungeon claim, crafting) go straight into the bag even past 48 slots instead of a Reward Cache. Satisfies "never lost", but not the Cache design. | Open: inventory/weight + Reward Cache milestone. |
| C-7 | The Lv20 run Full Reward also grants EXP and equipment, beyond the "Fragment / Material / upgrade resources" focus for repeat clears. | Open, needs a decision; reward data unchanged. |
| C-8 | Single-character world (see section 9). Party and AI members are impossible without per-character ownership of inventory / wallet / quests and multi-target aggro. | Open: plan before any party work. |
| C-9 | Lv16–19 Daily pool could assign a dungeon clear that requires Lv20 repeat runs. | **Resolved:** `daily_dungeon_adventurer` pool entry now has `minLevel: 20`. |
| C-10 | Captain Dungeon Gate copy omitted the Lv3 + Meadow Story entry rule. | **Resolved:** copy explains Story entry and separates Lv20 repeat runs. |
| C-11 | The boss room was larger than the Crypt Lord's radius leash (corners ~430 px from the throne, leash 380). | **Resolved** (structure pass): the Boss Room is the boss's encounter arena; it fights anywhere on it and resets only outside it (both profiles). |
| C-12 | The Crypt Knight's aggro radius reached into the corridor before the Boss Room. | **Resolved** (structure pass): the Elite Chamber is its arena; it only notices players in its chamber and gives up when they leave it (both profiles; Lv20 respawn timers unchanged). |
| C-13 | Previous Story Crypt duration mismatch. Baseline legitimate Lv3 scripts take 75–102 s game time; the human estimate was 3–5 min. | **Resolved by design decision (2026-10-08):** short tutorial/story dungeon, intended human first clear 4–6 minutes. Teach targeting, packs, telegraphs, checkpoints, Elite/boss, Dodge and potion recovery. No HP inflation, filler waves/rooms/walking, delays or camera changes. Human playtesting can identify separate pacing issues; being below the retired longer target is not one. |

### Fixed in the alignment pass

- No code conflict with the Story Crypt Lv3 loop was found: the Lv20 feature
  gates only runs, run rewards, `dungeon_clear` objectives and the Dungeon
  menu. Added `tests/unit/storyCrypt.test.ts` so the story loop stays
  independent of the Lv20 feature.

### Core system phase closure (2026-10-08)

- **Hotbar:** 5 persistent active slots; learned actives auto-fill the first
  empty slot; manual rearrange / replace (click, tap or drag); cooldowns
  belong to the skill, never the slot (section 5).
- **Basic Dodge:** all classes; 5.0 s cooldown; 0.30 s i-frame; no stamina, no
  charges; 72 world px over 0.20 s; 4-direction, movement input first then
  facing; Shift on desktop, utility button on mobile; collision and closed
  Story gates respected (section 3).
- **Potions:** HP and MP separate; HP 8 s / MP 12 s cooldowns; no GCD; instant
  + HoT; Auto Potion toggles and thresholds saved; real inventory
  consumption (section 6).
- **Input reliability fixes found in closure QA:** Dodge / potion presses
  during an executing action are buffered (0.5 s) instead of lost; keyboard
  presses are latched from Phaser's key `down` event, so a tap whose down
  and up land in the same frame (quick taps, taps during a frame hitch) is
  no longer dropped. Tests: `utilityInputBuffer.test.ts`, `dodge.test.mjs`
  DG-6 / DG-7.
- **Story Crypt:** intended human first clear ~4–6 minutes (C-13 resolved by
  design decision; re-measured with the real systems, section 4); no HP or
  filler padding; Dodge and potion tutorial feedback implemented.
- **Job Change:** 5 classes visible; Warrior is the only selectable, fully
  implemented Demo progression class; other Class 1 trees remain future work.
- **Save QA:** `tests/unit/saveQa.test.ts` (new save, pre-hotbar migration,
  >5 actives, rearrange + reload, skill-owned cooldowns, runtime-only Dodge /
  utility cooldowns, potion counts, Auto HP / MP preferences and thresholds,
  mid-quest Story progress, no duplicates / losses, Warrior-only guard with
  older non-Warrior saves still loading and forged ranks rejected).
- **Mobile:** 960×540, 844×390 and 640×360 keep every combat control
  (ATK, Skill 1–5, Dodge, HP / MP Potion) on screen, ≥40 px, unobstructed,
  tappable; touch hotbar editing works. Short screens cap the feed to its
  newest 3 lines. 568×320 is **not** a supported layout (the ring meets the
  quest tracker and system strip); it belongs to the Visual Production HUD
  layout pass.
- **Still not implemented:** Party AI, Online, Weight Capacity, Reward Cache,
  non-Warrior skill trees, full visual production, Thai localization,
  Gold/Diamond Shop.

### Story Crypt feedback pass

- Tutorial lines, gate rune seals and checkpoint feedback implemented
  (section 4); combat numbers and cooldown presentation polished (HUD style
  lock). C-13 baseline was re-measured in that pass; the later short-dungeon decision resolves the former mismatch. Tests:
  `tests/unit/storyTutorial.test.ts`, `tests/unit/damageNumbers.test.ts`,
  `tests/unit/hudCooldown.test.ts`, `tests/browser/storyFeedback.test.mjs`
  (SF-1–SF-9), `tests/browser/combatFeedback.test.mjs` (FX-1–FX-3).

### Story Crypt structure pass
- Story encounter skipping fixed with Story-only progression gates (see
  Dungeon 1 run structure); wipe semantics locked in wording. Tests:
  `tests/unit/dungeonStructure.test.ts` (gates; on-foot reachability over the
  real collision grid per step), `tests/browser/dungeonStructure.test.mjs`
  DS-10/11, `tests/browser/storyCrypt.test.mjs` SC-2 (walks in through the
  opened gates before the real fight).

- C-2, C-11, C-12 resolved (see the table). Story-only teaching spawns and
  the Skeleton Brute (`crypt_brute`, `brute_smash_story`) added; the
  Story profile and all Lv20 data unchanged. Tests:
  `tests/unit/dungeonStructure.test.ts`, `tests/unit/storyEncounter.test.ts`
  (pack, Brute, retry vitals), `tests/browser/dungeonStructure.test.mjs`
  (DS-1–DS-9), `tests/browser/combatSlice.test.mjs` CS-8 (Lv20 attempt).

### Story Crypt Lv3–5 balance pass

- C-1 (stats): Story profile added (`src/data/storyEncounters.ts`,
  `src/dungeon/encounterProfile.ts`, two Story signature attacks). Tests:
  `tests/unit/storyEncounter.test.ts`, `tests/browser/storyCrypt.test.mjs`
  (a real Lv3 fight against the Story Crypt Lord, no HP set by hand),
  `tests/browser/combatSlice.test.mjs` CS-8 (Lv20 entry uses base data).
