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

### LOCKED, NOT IMPLEMENTED

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

### LOCKED, NOT IMPLEMENTED: Basic Dodge

- Every class has it. Cooldown **5 s**, i-frame **0.30 s**.
- No stamina, no charges. Separate from class Mobility/Survival skills.
- Current code: only a reserved, disabled HUD socket (`dodge` in
  `src/ui/data/actionBar.ts`). No input Action, no i-frame state.
  *TBD:* dodge distance / speed.

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

### What the Lv20 Dungeon feature controls (as implemented)

Feature `dungeon` (`requiredLevel: 20`, `src/data/featureData.ts`):

| Area | Gated by Lv20 feature? | Code |
| --- | --- | --- |
| Story Crypt entry (portal / Auto Move / warp) | **No**. Lv3 + quest rule only | `dungeonAccess.ts` |
| Walking inside the Crypt, fighting mobs / Elite / Crypt Lord | **No** | map spawns, `cryptMap.ts` |
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

### LOCKED, NOT IMPLEMENTED: Dungeon 1 run design

- Target length: 12-15 minutes for a new player.
- Normal mobs, a teaching section for AoE / dodge / telegraph, **one Elite**
  before the Crypt Lord, no full miniboss.
  *Current layout matches mobs + one Elite (`crypt_knight`) + boss; the
  teaching section does not exist yet.*
- Checkpoint system; retry from the latest checkpoint.
- Party Wipe limits: **Normal 4, Hard 3, Hell 2**.
- Individual death does **not** consume a wipe; a support revive can restore
  a dead member; a full party wipe consumes one retry.
- After a wipe: encounter/boss resets fully; party at **HP 100%, MP 50%**.
- No free HP/MP refill station before the boss.
- *TBD:* checkpoint positions, what happens when wipes run out, behaviour for
  a solo player (a solo death is a party wipe of one).

### First clear vs repeat

- LOCKED: First Story Clear has unique Story rewards that never repeat
  (implemented: `mvp_03_crypt` rewards, claimable once).
- LOCKED: repeat clears focus on Fragments / Materials / upgrade resources
  (implemented through the Lv20 run claim: `src/dungeon/rewards.ts`,
  `src/data/dungeonRewards.ts`; see C-7 for the extra EXP/gear it also grants).

---

## 5. Skill assignment (hotbar)

### IMPLEMENTED + LOCKED

- Cooldown belongs to the **skill**, not the slot
  (`CombatantState.cooldowns: Map<SkillId, number>`, `src/combat/SkillSystem.ts`).
- Starter skills are auto-assigned (`DEMO_KIT_LOADOUT`); learned actives fill
  slots automatically in tree order (`SkillTree.loadout`).
- Q / E / R / F / G and the mobile cluster buttons are the same five
  `skill1..skill5` Actions (`src/input/Action.ts`, `src/ui/data/actionBar.ts`).
- Buffs / procs are statuses on the combatant; the hotbar does not own them
  (only a tree **reset** clears tree buffs).

### LOCKED, NOT IMPLEMENTED

- A newly learned active fills an **empty** slot (existing slots never move).
- Player can drag / rearrange learned skills.
- When learned actives exceed slots, the player chooses the loadout.
- The loadout can change during combat; the change applies after the current
  action/animation ends; changing slots never resets a cooldown; unequipping
  never removes buffs / debuffs / procs.
- Needs a persisted per-character loadout (save format change; do it once,
  with migration).

---

## 6. Potions

### LOCKED, NOT IMPLEMENTED

- HP Potion and MP Potion are separate items with separate cooldowns:
  **HP 8 s, MP 12 s**. No global cooldown.
- Cannot cancel a hard-locked action/animation.
- Recovery: immediate flat amount by tier, then a small % heal-over-time.
- Demo V1 tiers: **Small** and **Medium**.
- Auto Potion with separate HP% and MP% thresholds, player-configurable.
- Current code: no potion items; a reserved HUD socket (`potion` in
  `src/ui/data/actionBar.ts`).
- *TBD:* flat amounts per tier, HoT % and duration, default Auto Potion
  thresholds, prices / drop sources.

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
| C-1 | **Story Crypt is tuned as Lv20 content.** Crypt mobs, the Crypt Knight and the Crypt Lord are level 20 (`crypt_lord`: 3,000 HP, ATK 26, DEF 16; `src/data/monsterData.ts`) and damage has no level term. Estimated solo Novice at Lv3 (all stat points spent, basic attacks only, no gear, no potions): about 46-52 s to kill the boss vs about 23-27 s survival against its basic attack alone (slam, enrage, adds ignored). The Lv3 loop is **mechanically open but not realistically winnable solo**. | **Open.** Needs a story-tier tuning decision (e.g. Story Crypt stat profile or a story difficulty) and the 12-15 min target. Monster balance left unchanged per audit rules. |
| C-2 | No checkpoint / wipe system: after dying in the Crypt the player respawns at the Crypt entrance spawn with full HP/MP (`CombatantState.reset`), not HP 100% / MP 50% at a checkpoint; there is no wipe limit. The boss already resets when it loses its target (`MonsterBrain.returnHome`: HP refilled, enrage removed), which matches "boss resets fully". | Open: part of the Dungeon 1 run milestone. |
| C-3 | Skill loadout is derived (learned actives in tree order fill 5 slots). A Warrior can learn up to 8 actives; the 6th onward is silently unslotted; a new skill can shift existing slots; no manual arrangement. | Open: skill-assignment milestone (needs a persisted loadout). |
| C-4 | Basic Dodge and potions do not exist (reserved HUD sockets only). | Open: Demo V1 combat-basics milestone. |
| C-5 | Warrior Charge requires a target (no input/facing fallback) and repositions instantly (the target cannot step out of the line). | Accepted for Warrior (preserved as is). The general movement rule applies to every **new** movement skill. |
| C-6 | Guaranteed rewards (quest claim, dungeon claim, crafting) go straight into the bag even past 48 slots instead of a Reward Cache. Satisfies "never lost", but not the Cache design. | Open: inventory/weight + Reward Cache milestone. |
| C-7 | The Lv20 run Full Reward also grants EXP and equipment, beyond the "Fragment / Material / upgrade resources" focus for repeat clears. | Open, needs a decision; reward data unchanged. |
| C-8 | Single-character world (see section 9). Party and AI members are impossible without per-character ownership of inventory / wallet / quests and multi-target aggro. | Open: plan before any party work. |
| C-9 | Daily pool lists `daily_dungeon_adventurer` with `minLevel: 1`, while Dailies unlock at Lv16 and dungeon clears need the Lv20 run, so a Lv16-19 player can roll a Daily they cannot complete. | Open (not part of the Story loop); fix with a data `minLevel` once confirmed. |
| C-10 | The Captain's Dungeon Gate note mentions only the Lv20 run, not the Lv3 + Meadow entry rule (the gate itself explains refusals). | Minor copy, open. |

### Fixed in the alignment pass

- No code conflict with the Story Crypt Lv3 loop was found: the Lv20 feature
  gates only runs, run rewards, `dungeon_clear` objectives and the Dungeon
  menu. Added `tests/unit/storyCrypt.test.ts` so the story loop stays
  independent of the Lv20 feature.
