# Class 1 Motion Production Batch 1 — Melee Family Human Review Candidate v1

Status: `READY_FOR_HUMAN_REVIEW`

This is an offline motion-production package for Fighter, Swordman, and Merchant. It contains exact-approved Neutral Master references plus new Idle, Move, and Basic Attack candidates. Nothing in this package authorizes Runtime Integration, balance changes, canonical promotion, or GitHub work.

## Exact Neutral Master sources

| Class | Exact-approved SHA-256 | Package reference |
|---|---|---|
| Fighter | `4b2ec5558971c3730da352f5ba2a39d928bbf5c722d40e38256dd6b4d48a19c4` | `fighter/neutral/hero.fighter_neutral_master.png` |
| Swordman | `2a1fc6f93f384fbc92486a8e42975a10bb84d8f9cd35b13b155a9668638861ed` | `swordman/neutral/hero.swordman_neutral_master.png` |
| Merchant | `053785f1283a02c49897445edf038e3f95b30cb2733b81c206f648e986b157d3` | `merchant/neutral/hero.merchant_neutral_master.png` |

All three package references are byte-identical to their Class 1 Neutral Master Batch v1 exact-approved sources from PR #83 at head `a7a821045dd7532dd96dfb07dfd352080e588c40`.

## Motion summary

All durations are centiseconds.

| Class | Action | Frames | Durations | Total | Loop | Impact |
|---|---:|---:|---|---:|---|---|
| Fighter | Idle | 8 | `[16,14,12,10,10,12,14,16]` | 104 | true | — |
| Fighter | Move | 8 | `[10,10,10,10,10,10,10,10]` | 80 | true | — |
| Fighter | Basic Attack | 8 | `[10,8,7,6,5,8,12,16]` | 72 | false | frame 004 at 31 cs |
| Swordman | Idle | 8 | `[16,14,12,10,10,12,14,16]` | 104 | true | — |
| Swordman | Move | 8 | `[9,9,9,9,9,9,9,9]` | 72 | true | — |
| Swordman | Basic Attack | 8 | `[8,7,6,5,4,7,11,16]` | 64 | false | frame 004 at 26 cs |
| Merchant | Idle | 8 | `[18,16,14,12,12,14,16,18]` | 120 | true | — |
| Merchant | Move | 8 | `[11,11,11,11,11,11,11,11]` | 88 | true | — |
| Merchant | Basic Attack | 8 | `[10,9,8,6,5,8,12,16]` | 74 | false | frame 004 at 33 cs |

## Motion intent and internal review

### Fighter

- Idle: restrained guarded boxing stance, controlled breathing, stable paired gauntlets.
- Move: compact combat jog with hands ready; no sword-like locomotion.
- Attack: clear single heavy straight punch with anticipation, full extension at frame 004, follow-through, and recovery.
- Internal review: identity, gauntlet continuity, body proportions, anchor, transparency, and normal-speed readability passed.

### Swordman

- Idle: beginner sword-and-buckler guard with subtle balance adjustment.
- Move: controlled weapon-ready run; sword and buckler remain attached and contained.
- Attack: simple single slash; frame 004 is the clearest visual impact. No multi-hit flourish.
- Internal review: identity, sword/buckler continuity, anatomy, anchor, transparency, and normal-speed readability passed.

### Merchant

- Idle: alert merchant-adventurer stance with restrained backpack/gear settling.
- Move: practical loaded jog; backpack weight reads without excessive bounce.
- Attack: short axe chop with impact at frame 004 and stable trade gear through recovery.
- Internal review: identity, axe/backpack continuity, anatomy, anchor, transparency, and normal-speed readability passed.

## Attack-speed safety record

The current runtime values observed in `src/game.js` were Fighter 1.10/s, Swordman 1.25/s, and Merchant 1.15/s. The corresponding base intervals are approximately 90.91 cs, 80.00 cs, and 86.96 cs. Each proposed attack visual cycle fits its current base interval.

`data/design/hero-balance-v1.json` contains different attack-rate records (0.85/0.95/0.90). This divergence is recorded honestly in each attack sidecar. No balance value was changed. Buffed-speed overlap, replay queuing, coalescing, or another class-specific acknowledgment remains a future Runtime Integration validation question.

## Best review order

1. Individual normal-speed GIFs in each class `review/` directory.
2. `review/batch-idle-comparison.gif`
3. `review/batch-move-comparison.gif`
4. `review/batch-attack-comparison.gif`
5. Individual slow-QA GIFs and contact sheets.
6. `review/melee-family-silhouette-comparison.png`
7. Board-, bench-, and shop-scale motion-readability proxies.

## Known limitations

- This is offline motion production only. Asset loading, state registration, runtime markers, Combat behavior, and device/browser playback were not tested.
- Attack-rate records differ between current runtime data and the design record; both are preserved without modification.
- The board-scale artifact is only a neutral scale-readability proxy. The replacement 8×8 isometric Board Preview remains `DEFERRED_UNTIL_AFTER_DEMO`.
- Future high attack-speed overlap and visual-acknowledgment behavior are not invented in this package and must be validated at integration time.

## Approval state

- `humanVisualApproval: pending`
- `exactPackageApproved: false`
- `canonicalApproved: false`
- `motionProductionApproved: false`
- `runtimeIntegrationAuthorized: false`
- `runtimeIntegrated: false`
- `merged: false`

