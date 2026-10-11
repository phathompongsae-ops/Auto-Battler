# Grove Guardian production animation — Pass 4B (2026-10-11)

Started on `phaser-rebuild` at `bede15c1`. This pass covers only the Guardian; the Skeleton Brute and Crypt Lord
are locked. No gameplay, balance, geometry, camera or HUD changes. Provenance and reproduction are in
`art-source/monsters/grove_guardian/pass-4b/README.md`.

## Identity and hierarchy

The authoritative source is the approved project-generated D5 idle (the shipped fallback's source), a smooth
illustrated chibi wood golem. Its identity markers: a bark mask with three prongs and one amber eye, an amber heart,
rounded moss on the head, shoulders, fists and knees, oversized fists and root feet.

The idle reuses those two frames unchanged, fitted to the contract. It is 133 px standing, the same world size as
the shipped Guardian. On one feet line at world scale, Warrior < Slime / Wolf < Elite Boar < Guardian: the Guardian
reads as the field mini-boss through its mass and posture, not by enlargement. Codex `image_gen` generated four
action sheets (walk, attack, Stomp, hit) from the approved idle alone. Identity holds across every frame.

| State | Frames / fps | Size | Height (px) | Verdict |
|---|---|---|---|---|
| idle | 2 / 3 | 416×160 | 133 | PASS (approved frames) |
| walk | 8 / 8 | 1664×160 | 132–135 | PASS: heavy alternating gait, steady trunk |
| attack | 5 / 12 | 1040×160 | 130–135 | PASS: contact-first punch, planted back foot |
| special (Stomp) | 10 / 12 | 2080×160 | 111–149 | PASS: raise3 / hold2 / impact2 / recovery3; leg-lift hold, deep stomp crouch |
| hit | 3 / 15 | 624×160 | 124–130 | PASS: short recoil, feet planted |

Contract checks: 208×160 cells, lowest visible row 157, rows 158–159 fully clear, no edge contact, one fit scale
per sheet and no per-frame resizing. Accepted deviation, shared with the Lord: the fitter's rounding leaves interior
alpha at 254, which is invisible.

## Runtime and QA

The generic MonsterAnimator path is used, with only the contract status changed to `integrated`.

- **Geometry:** origin [104, 103.4] at draw scale 0.5, mirrored west, with no procedural motion on top. The world
  body [-21, +4.2, 42, 25.2], hit radius 22, speed 80 and shadow are identical to the fallback.
- **Pre-integration review:** the fitted strips were loaded into the running game while the contract was still
  pending. All states, east and west, used one origin and showed no rotation or scale change.
- **`--guardian-review`** (24/24) uses real Field fights:
  - west, east and circling, with a basic attack showing contact frame 0 on its damage tick
  - Stomp holding frames 0–4 through the 1000 ms wind-up, then impact frame 5 on the damage tick (1007 ms in three
    samples); damage 39 with real strips and with the fallback; Dodge at 850 ms gives a miss
  - death fade, the whole-set fallback with one strip dropped, and restore
  - assets loaded once, and 960 / 844 / 640 captures at zoom 1.65
  - performance in a warmed 4 s fight: real p95 7.1 ms, max 14 ms, no frames over 20 ms; fallback p95 7.1 ms; 14
    texture swaps, on state changes only
- **Test geometry:** the west fight starts 60 px from the spawn. (Before the Environment / Encounter polish pass a
  standing-stone collider 75 px west stopped the approach; the clearing is now open on every side.)
- **Generic suite:** `monsterAnim.test.mjs` now drives all three integrated monsters on production art. The
  debug fixture remains for future pending contracts.
- **Final QA:** typecheck and build pass; unit tests 613/613; `--anim-review` 88/88, `--brute-review` 24/24 and
  `--lord-review` 24/24; the full default browser suite (`npm run test:browser`) passes 476/476 with no console
  errors.

## Resolved: HUD overlap at the map edge

The Guardian Stones used to sit in the Green Meadow's north-east corner, where the camera clamped to the map edge
and the quest tracker and combat cluster covered much of the fight at 844×390 and 640×360. The Environment /
Encounter polish pass (`docs/art/environment-encounter-polish.md`) moved the clearing inland, swapping it with the
pond. GP-17 now checks that the camera follows the fight unclamped at all three viewports and that no HUD element
covers the Guardian.
