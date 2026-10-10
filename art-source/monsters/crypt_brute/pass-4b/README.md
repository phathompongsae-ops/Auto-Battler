# Skeleton Brute Pass 4B: production strip provenance

The shipped strips are in `public/assets/monsters/crypt_brute/` (`walk`, `attack`, `special`, `hit`; `idle`
comes from `../idle.png`). They were approved 2026-10-10 and the contract is `integrated`.

- `source/`: the six accepted Codex `image_gen` sheets. Each one's first figure is an unchanged copy of
  the locked reference idle pose (`../source/reference-idle-pair.png`). It is the scale anchor, fitted to the idle's 94.5 px.
- `prompts/`: the exact prompts. The reference was attached to every generation, and `_common.txt` is the shared head.
- `fit/*.json` + `tools/`: the fitting specs and the dependency-free fitter.
  - Each spec gives a frame's source figure, its ground row and its root anchor:
    - walk: upper-body centre at the idle's 87.5;
    - attack and hit: back heel at the idle's x 54;
    - Bone Smash raise/hold: feet-band centre 93.5;
    - impact/recovery: heel 54.
  - The fitter applies the idle's matte cleanup and area-resamples in premultiplied alpha.

Reproduce (output is byte-identical to `public/`):

    for j in walk attack special-a special-impact special-recovery hit; do node art-source/monsters/crypt_brute/pass-4b/tools/fit.mjs art-source/monsters/crypt_brute/pass-4b/fit/$j.json; done
    node art-source/monsters/crypt_brute/pass-4b/tools/concat.mjs art-source/monsters/crypt_brute/pass-4b/fit/special.png art-source/monsters/crypt_brute/pass-4b/fit/special-{a,impact,recovery}.png

| Strip | Frames | From |
|---|---|---|
| walk | 6 @ 9 fps | `walk-sheet-v2` figures 1–6 |
| attack | 5 @ 12 fps, frame 0 = contact | `attack-sheet-v4` 1–5 (A1 ground 482: hammer reaches the soles, feet ≈1 px up; A3 −2 px to clear the cell edge) |
| special | 10 @ 12 fps: raise 3, hold 2, impact 2, recovery 3 | `special-a-sheet` 1–5 (R1–R2 −5 px), `special-impact-sheet` 1–2, `special-b-sheet-v2` 3–5 |
| hit | 3 @ 15 fps | `hit-sheet` 1–3 |

Accepted deviations: the skull is 3–7 % larger than the idle's (generator proportion), attack frame 0's
feet sit about 1 px up, and Bone Smash has a small forward lunge over the planted back heel.
Rejected generations are not kept here.
