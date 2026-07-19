# Post-Archer Motion Batch Production Acceleration Plan v1

Status: **PLANNING / DATA / REVIEW READINESS ONLY**  
Repository: `phathompongsae-ops/Auto-Battler`  
Current planning base: PR #70 exact HEAD `cd973caa65bba350ea1362660be38ff9f359aaf8`

This plan exists to make Archer the **last deliberately bureaucratic motion pilot**, not the template for repeating the same number of planning/production/review PRs for every character.

The post-pilot objective is:

> **Produce several compatible units faster while keeping visual quality, exact-file approval, rollback and audit isolation.**

Not:

> **Repeat Archer's serial pilot process for every unit.**

---

## 1. Verified starting state

At planning start:

- PR #67 remains the generated but visually rejected/superseded Archer Attack v1 candidate.
- PR #69 remains the authoritative Attack v1 rejection + Attack v2 redo contract/source-of-truth planning layer.
- PR #70 remains the Attack v2 review/approval readiness layer at exact HEAD `cd973caa65bba350ea1362660be38ff9f359aaf8`, open/draft/unmerged.
- A fresh search found no newer CC-owned Archer Attack v2 Production PR. If CC creates one while this plan is active, record its state only; do not interfere with it from this planning branch.

This branch is intentionally based on the Coco planning lineage, not any active CC execution branch.

---

## 2. What Archer should prove once, versus what should repeat

### A. One-time pilot work

Archer is used to prove once:

- exact neutral/source identity approval and immutable byte boundaries;
- package naming, sidecar/source-map schema and provenance;
- FPS/loop/rootMotion/runtimeFlipX/anchor conventions;
- marker vocabulary and semantic-marker review;
- runtime loader/state/fallback/cache/dispose seams;
- transition and x4 integration test pattern;
- mobile/board review artifacts;
- exact-file approval sequencing;
- failure lessons: near-static motion, identity drift, background/checker remnants, blind reliance on hashes/pixel deltas.

These standards should become reusable templates/configuration, not repeated discovery work.

### B. Reusable work

Reuse after pilot acceptance:

- project style/readability rules;
- common package manifest/config shape;
- common technical validator engine;
- archetype-specific visual gates;
- standard review artifact generator;
- combined batch review page/index;
- exact-file approval overlay format;
- PR #56-style runtime seams and rollback/testing structure.

### C. Character-specific work

Still individual:

- exact current neutral/source identity;
- face/costume/material/silhouette lock;
- actual support/anchor evidence;
- weapon/anatomy biomechanics;
- signature attack/skill pose progression;
- semantic marker timing where applicable;
- human decision on exact visual candidate.

### D. Work that can be batched

- candidate inventory and manifests;
- simple Idle across compatible units;
- Move within a locomotion archetype;
- Basic Attack only within genuinely compatible biomechanics subgroups;
- common technical validation;
- standard artifact generation;
- combined review presentation;
- multi-package exact approval overlay;
- grouped runtime migration of already-approved isolated packages.

### E. Work that remains individually reviewed

- exact source identity approvals;
- every exact package's human visual decision;
- complex weapon articulation;
- boss/unique motion;
- multi-phase/signature skills;
- ambiguous markers;
- packages with identity drift, near-static failure or repeated rejection.

---

## 3. New default workflow after Archer Pilot Acceptance

**Motion Archetype**  
→ **Batch Candidates**  
→ **Parallel / Batch Production**  
→ **Batch Technical Validation**  
→ **Human Visual Review**  
→ **Exact Approval**  
→ **Runtime Migration**

The batch is a coordination container only. Each unit/state remains an isolated package with its own version, paths, hashes, approval state and rollback boundary.

A batch must never mean "one shared pose copied onto several identities."

---

## 4. Minimum motion set: do not produce what the game does not need

The runtime framework supports six visual states: Idle, Move, Attack, Skill, Hit and Death. That support is **not** a requirement to produce all six states immediately.

The existing runtime already has deterministic fallbacks (`skill -> attack -> idle`, `hit -> idle`, `death -> hit -> idle`), reuses the existing hit-flash bridge, and preserves the existing death-fade behavior. Therefore the production minimum should be driven by visible gameplay need, not by the size of the runtime state enum.

### REQUIRED NOW

For an active combat unit with an approved production identity:

1. **Idle** — stable readable default state.
2. **Move** — required for units that reposition/approach range.
3. **Basic Attack** — required for every unit that performs basic attacks.

### REQUIRED LATER

Produce only when actual gameplay/readability requires it:

- **Skill** — when a signature cast/telegraph/marker must read differently from Attack fallback, especially bosses or signature mechanics.
- **Spawn / Summon** — only when a gameplay feature visibly exposes a distinct spawn/summon action.
- **Bespoke Death** — when a boss or special unit cannot communicate death adequately through the existing fade/fallback.

### OPTIONAL POLISH

- dedicated Hit reaction while hit-flash remains sufficient;
- dedicated ordinary-unit Death while death-fade/fallback remains acceptable;
- victory/emote/showcase loops;
- non-gameplay spawn flourishes.

This is the biggest direct scope reduction versus automatically producing six states for every unit.

---

## 5. Reusable Motion Archetype Matrix

Machine-readable source: `data/design/motion-production-archetype-matrix-v1.json`

Primary production groups grounded in current repo data:

- **HUMANOID_RANGED** — Archer, Sniper, Ranger; Spirit Archer as ranged-monster overlap.
- **HUMANOID_MELEE** — Fighter, Swordman, Knight, Berserker, Blade Master, Duelist, Spirit Blade; Skeleton/Orc/Orc Warlord where anatomy fits.
- **HUMANOID_CASTER** — Mage, Archmage, Frost Weaver, Summoner, Beast Lord, Acolyte, Priest, Inquisitor; Lich King only as a boss/unique overlap.
- **SMALL_CREATURE** — Slime.
- **QUADRUPED_BEAST** — Stone Wolf is the first confirmed Map 1 archetype starter.
- **HEAVY_CONSTRUCT** — Golem.
- **RANGED_MONSTER** — Spirit Archer.
- **ASSASSIN_FAST** — Shadow Assassin, Ninja, Trickster; Duelist can share some fast-motion review language.
- **BOSS_UNIQUE** — Orc Warlord, Bone Dragon, Lich King, Arena Overlord; Golem may use some heavy-boss gates but remains its own heavy pilot.
- **HUMANOID_SPECIALIST_SUPPORT** — Merchant, Tycoon.

Warden/Champion/Immortal Champion are excluded because current Map 1 data marks them obsolete. Novice is not scheduled until current gameplay/runtime need is explicitly confirmed.

### Motion batching rule of thumb

- **Idle:** safest broad batch category.
- **Move:** batch by locomotion biomechanics.
- **Basic Attack:** batch only within similar weapon/anatomy mechanics; do not erase distinct attack concepts.
- **Skill:** individual by default or very small proven semantic groups.
- **Hit:** broad batch candidate later, if dedicated hit motion becomes worthwhile.
- **Death:** batch by anatomy/weight later; bosses individual.
- **Spawn/Summon:** individual and only when needed.

Existing Class 1 profiles already prove why attack batching must be semantic rather than generic: Fighter punch, Swordman slash, Archer bow draw, Mage cast, Summoner command, Acolyte holy pulse and Merchant gadget throw are deliberately different attacks.

---

## 6. Recommended batch sizes

Starting guidelines, to be tuned after the Slime/Golem migration batch:

| Motion | Recommended batch |
|---|---:|
| Simple Idle | 4–8 units |
| Simple Move | 3–6 units |
| Dedicated Hit later | 4–8 units |
| Death later, same anatomy family | 3–5 units |
| Small-creature Basic Attack | 2–4 units |
| Humanoid same-weapon Basic Attack | 2–3 units |
| Caster compatible attack/cast skeleton | 2–3 units |
| Heavy construct attack | 1–2 units |
| Complex Skill / Boss | 1 unit |

Continue batching only while identities are approved, the archetype pipeline is proven, packages remain isolated, and no unit-specific runtime change appears.

Split a unit out immediately for identity drift, near-static motion, different biomechanics, marker ambiguity, boss/signature complexity, repeated rejection, changed source master or unique runtime requirements.

---

## 7. Slime + Golem migration readiness

Machine-readable source: `data/design/slime-golem-motion-migration-readiness-v1.json`

### Slime

Current useful evidence:

- old Move: real 8-frame 512×512 sequence, 12 FPS, loop, in-place, anchor `[0.5,0.9]`, `footstepCue@0.7`;
- old Idle: real 8-frame 512×512 sequence, 8 FPS, loop, in-place, no markers;
- PR #56 proved Idle runtime switching/loop/anchor behavior technically;
- style-lock migration contract says old Slime Idle/Move are **possibly reusable with exact review**, not production-approved.

Current classification:

- style anchor: **REFERENCE ONLY**;
- approved production neutral master: **MISSING**;
- old Idle/Move: **REFERENCE ONLY / CONDITIONAL REUSE / NOT PRODUCTION APPROVED**;
- Basic Attack: **MISSING**.

Fastest safe route after Archer acceptance:

1. approve one current Slime neutral master / exact identity;
2. compare old Idle/Move at reduced scale against that identity;
3. reuse/repackage only if exact visual/provenance gate passes, otherwise redo;
4. create missing Basic Attack;
5. common batch validation + combined user review + isolated exact approvals.

Slime currently has no skillIds in current Map 1 encounter data, so a dedicated Skill animation is **not required now**.

### Golem

Current useful evidence:

- old Attack visual-fix sequence passed old x4 visual testing but is from the previous visual identity and has legacy timing divergence;
- old Idle technically works and was integrated in PR #56;
- Golem Move is missing;
- style-lock explicitly requires replacement of old Golem Idle/Attack because the approved direction is more compact/chunky with oversized fists.

Current classification:

- style anchor: **REFERENCE ONLY**;
- approved production neutral master: **MISSING**;
- old Idle: **STALE VISUAL IDENTITY / NEEDS REDO**;
- old Attack: **REFERENCE ONLY / NEEDS REDO**;
- Move: **MISSING**.

Fastest safe route:

1. approve a new compact/chunky Golem neutral master;
2. batch Golem Idle + missing Move as two isolated packages in one CC task;
3. redo Attack as a heavy readable anticipation → impact → recovery sequence;
4. derive marker timing from the actual impact pose/current contract instead of blindly copying legacy `0.75` or an older planned value;
5. batch technical validation and combined Slime/Golem review;
6. approve/migrate packages independently.

Do not force Slime and Golem through one generator method. Slime can legitimately use squash/stretch deformation; Golem needs weight, rigid massing, anticipation and impact readability.

---

## 8. Reusable validator architecture

Planning only — no tooling refactor in this task.

### Common Technical Validator

One reusable engine, driven by package config, should cover:

- PNG decode/naming;
- dimensions/RGBA;
- hashes;
- alpha/bounds/crop;
- anchor/support;
- FPS/loop;
- rootMotion/runtimeFlipX;
- provenance/source hashes;
- sidecar/marker schema;
- protected-byte boundaries.

### Motion-Specific Gate

Plug in only the relevant semantic gate:

- Idle loop/identity;
- locomotion gait/contact/loop;
- ranged draw/release;
- melee anticipation/contact/follow-through;
- caster gather/release;
- creature deformation;
- heavy impact;
- boss/unique custom config.

### Character-Specific Config

Hold the unit-specific facts in config rather than cloning a validator file:

- source hashes;
- anchor/canvas/timing;
- marker semantics;
- identity locks;
- chosen archetype gate;
- justified exceptions.

A common technical PASS can only mean **technically ready for visual review**, never approved.

---

## 9. Reusable review artifact pipeline

Automatically produce for every package:

1. contact sheet;
2. preview GIF;
3. board-scale preview;
4. marker diagnostic only when a semantic marker exists.

Add special diagnostics only for complex risks:

- full-draw / full-windup / impact diagnostic;
- old-vs-new comparison;
- risky transition diagnostic.

For a batch, create one combined phone-friendly index/page so the user can review several packages without opening dozens of unrelated artifacts.

Avoid manually producing redundant review images that do not prove a distinct gate.

---

## 10. Batch approval strategy

A simple batch such as five Idle packages can be reviewed using one combined page/contact overview.

However:

- exact hashes remain separate per package;
- approval remains a per-package decision;
- one approval overlay PR may contain several individually locked packages;
- if one package fails, remove only that package from the approval set and redo/version it separately;
- do not modify passed sibling bytes just to keep the batch synchronized.

This prevents one bad asset from blocking four good assets.

---

## 11. PR strategy after the pilot

### Fast-path default

For 3–6 compatible units:

1. **`Batch <Motion/Archetype> Production — Wave N`**  
   Multiple isolated packages + common validation/artifacts.
2. **Batch Exact-File Approval overlay**  
   Only explicitly user-approved packages; hashes locked per package.
3. **Grouped Runtime Migration**  
   Only approved packages; per-unit/state rollback; x4 validation.

Do **not** create planning + handoff + readiness + production + approval PR layers for every simple package merely because Archer needed them while the system was being invented.

### Separate PR when justified

- new archetype pilot;
- complex boss/unique action;
- signature skill;
- source/identity failure;
- runtime/gameplay change;
- isolated redo after visual failure.

---

## 12. Proposed production waves

Detailed machine plan: `data/design/motion-production-waves-throughput-v1.json`

### Wave 0 — Migration validation

- Slime
- Golem

Purpose: prove batch production/validation/review/partial approval/migration with two very different anatomies.

### Wave 1 — Humanoid Melee Foundation

- Fighter
- Swordman
- Skeleton
- Orc

Idle/Move grouped. Attacks split into fist/blade/heavy subgroups.

### Wave 2 — Ranged/Caster Map 1 Core

- Mage
- Summoner
- Acolyte
- Merchant
- Spirit Archer

Idle/Move broadly batchable; attacks stay semantic subgroups.

### Wave 3 — Assassin / Fast

- Shadow Assassin
- Ninja
- Trickster
- Duelist

Ninja enters only after its exact current source identity is approved. Warp/backline behavior stays runtime-owned.

### Wave 4 — Class 2 Melee

- Knight
- Berserker
- Blade Master
- Spirit Blade

### Wave 5 — Class 2 Ranged/Caster

- Sniper
- Ranger
- Archmage
- Frost Weaver
- Priest
- Inquisitor

### Wave 6 — Specialist/Hybrid small batch

- Beast Lord
- Tycoon

Small intentionally; do not pad with unrelated units simply to reach an arbitrary batch size.

### Dedicated slow-path passes

- Stone Wolf first as the quadruped archetype starter;
- Orc Warlord;
- Bone Dragon;
- Lich King;
- Arena Overlord.

Future Map 2/3 or unconfirmed secret units are not scheduled until current repository data and exact source identities exist.

---

## 13. Throughput model

These are **capacity-planning estimates**, not promises and not measured historical throughput. They assume source identities are already approved, common validator/artifact tooling exists, and no package requires a runtime change.

### Packages/day

| Complexity | Idle | Move | Basic Attack |
|---|---:|---:|---:|
| Simple — Conservative | 3–4 | 2–3 | 1–2 |
| Simple — Target | 6–8 | 4–6 | 2–3 |
| Simple — Fast Path | 8–10 | 6–8 | 3–4 |
| Medium — Conservative | 2–3 | 1–2 | ~1 |
| Medium — Target | 4–5 | 3–4 | ~2 |
| Medium — Fast Path | 5–6 | 4–5 | 2–3 |
| Complex | 1–2 max | 1–2 max | ~0.5–1/day typical |

### Equivalent core units/day after identity is ready

Idle + Move + Basic Attack production/technical capacity:

- **Conservative:** ~0.5–0.8 unit/day
- **Target:** ~1.2–1.8 units/day
- **Fast-path, simple proven archetype:** ~2–2.5 units/day

Human review is expected to become the real bottleneck before technical checks. Design review sessions around roughly 6–10 simple package previews, 3–6 medium, or 1–2 complex packages at a time.

### Redo allowance

- Conservative: 25–35%
- Target: 15–25%
- Proven fast-path archetype: 10–15%
- New archetype / complex boss: potentially 30–50%; do not use fast-path schedule assumptions.

### Example time saving

For an illustrative 30 simple-to-medium **core motion packages after identity approval**:

- repeating pilot-style serial planning/PR/review loops: roughly **20–30 working days**;
- target batch workflow: roughly **8–13 working days** including normal review/redo allowance;
- proven fast-path-heavy mix: roughly **6–9 working days**.

Expected improvement for repeated simple/medium archetypes: approximately **2.5×–4× motion throughput**, with roughly **60–80% less coordination/PR overhead** than repeating pilot layers per package.

Unique bosses, new archetypes and hard visual failures do not receive this multiplier.

---

## 14. Fast-path eligibility

Machine policy: `data/design/motion-fast-path-policy-v1.json`

A motion enters fast-path only if all are true:

- archetype pipeline already passed a representative pilot;
- exact current source identity approved;
- motion is required now;
- no unusual anatomy;
- no unique/ambiguous marker complexity;
- no unresolved failure pattern;
- reusable validator supports it;
- standard artifacts can prove it clearly;
- package rollback/hash isolation is clean;
- no runtime/gameplay change required.

Fast path:

**Production → Technical + Archetype Gate → Batch User Review → Exact Approval → Grouped Runtime Migration**

No per-unit planning/readiness PR by default.

---

## 15. Slow-path triggers

Exit fast path for:

- identity drift;
- near-static motion;
- complex weapon articulation;
- boss/unique unit;
- multi-phase/signature skill;
- special VFX timing tied to pose;
- unusual anatomy / first member of a new archetype;
- marker ambiguity;
- repeated visual rejection;
- changed source master;
- unit-specific runtime/gameplay requirement.

Slow path is not permanent. Once the new archetype/problem is solved, accepted and encoded into reusable config/gates, later compatible siblings can return to fast path.

---

## 16. Exact post-Archer execution order

After **Archer Pilot Acceptance**:

1. **Slime/Golem migration batch** — validate conditional reuse vs redo, source locks, package isolation.
2. **Validate the batch workflow** — measure real throughput and failure isolation.
3. **Lock reusable production template** — common validator/config/artifact conventions.
4. **Start Wave 1** — no return to one-character-at-a-time by default.
5. **Parallelize safe motion categories** — especially Idle/Move; attack sub-batches can proceed independently.
6. **Hold complex motions for dedicated passes** — bosses, first quadruped, signature skills and failed packages.

### CC owns

- production/generation execution;
- implementation of reusable validator/artifact tooling when separately authorized;
- technical validation;
- runtime integration/migration;
- x4 runtime/Combat testing.

### Coco owns

- GitHub/source-of-truth verification;
- planning/data/config;
- archetype and batch candidate grouping;
- review coordination and state reconciliation;
- exact approval record preparation after explicit user decisions;
- ancestry/scope/changed-path auditing.

Coco must not duplicate CC by generating production motion or editing runtime.

---

## 17. Stop boundary / current non-actions

This planning package does **not**:

- generate Slime PNGs;
- generate Golem PNGs;
- edit Archer or any approved Archer source/motion;
- modify existing Slime/Golem binary frames;
- modify `src/`, runtime, Combat, gameplay, board, camera or map;
- authorize current Slime/Golem production;
- interfere with CC's Archer Attack v2 execution;
- merge any PR.

The next use of this plan begins **after Archer Pilot Acceptance**, with an explicitly authorized Slime/Golem migration batch—not before.
