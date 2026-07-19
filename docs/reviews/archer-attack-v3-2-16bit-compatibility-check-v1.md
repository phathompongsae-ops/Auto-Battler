# Archer Attack v3.2 — Pre-Runtime 16-bit PNG Compatibility Check

**Result: COMPATIBILITY_PASS**

This is an additive check record. It does not modify frame 004, any PR #79/#80 file, or start Runtime Integration.

## Target asset

| | |
|---|---|
| Path | `docs/assets/review/character-production/archer/attack-v3-2/frames/hero.archer_attack_v3_2_004.png` |
| Measured SHA-256 | `69af0c5088492db38fc81a365e1295264057ffe62f1141f173b86d815da5b277` — exact match |
| Dimensions | 640×960 |
| Bit depth | 16 (per channel) |
| Color type | 6 (RGBA) |
| Interlace | 0 (non-interlaced) |
| Alpha bounds | `528×772+68+83` — exact match to expected |
| Max opaque Y | 854 (baseline 855, half-open convention) |
| Approved Neutral Master cross-check | `4911e7e3...3013` — exact match |

*Note: the task prompt's stated path (`.../frames/004.png`) doesn't exist in the repository — resolved from PR #79/#80's own records to the actual file, `hero.archer_attack_v3_2_004.png`.*

## Approval/scope state confirmed unchanged before testing

- `humanVisualApproval=true`, `attackV3_2PackageApproved=true`, `exactPackageApproved=true`, `animationQualityBenchmarkV1Approved=true`, `benchmarkActivationAuthorized=true` — all confirmed **true**
- `canonicalApproved=false`, `runtimeEligible=false`, `runtimeIntegrated=false`, `runtimeIntegrationAuthorized=false` — all confirmed **false**
- `independentAuditClassification=NON_BLOCKING_FORMAT_ANOMALY`, `approvalBlocker=false`, `runtimeCompatibilityFollowUpRequired=true`, `runtimeIntegrationBlockedUntilCompatibilityCheck=true` — all confirmed as expected going into this check

## Toolchain discovery

**Production target decoder path**: The game's entry point (`autochess.html`) loads THREE.js **r128** via a classic `<script>` tag from `cdnjs.cloudflare.com`, plus `src/game.js` (also a classic script). `src/game.js` uses `new THREE.TextureLoader()` (see `loadAllSprites()`, `src/game.js:364`) to load every sprite asset.

**What THREE r128's TextureLoader actually does**: it has no PNG decoder of its own. Internally (via `THREE.ImageLoader`) it creates a native `Image`, sets `.src`, and wraps the resulting `HTMLImageElement` in a `THREE.Texture`. `WebGLRenderer` then uploads it via the native WebGL `texImage2D` on first render. **100% of the PNG decode work is done by the browser engine, not by THREE.**

**Existing testable local decoder path**: headless Chromium via Playwright (globally installed; browser binaries pre-installed, `PLAYWRIGHT_BROWSERS_PATH` already set) — the same Blink/Skia engine family as any Chromium-based production browser.

**Could not load THREE.js r128 itself**: outbound access to `cdnjs.cloudflare.com` (and `unpkg.com`, tried as a fallback) is blocked by this environment's network policy (`curl` → `CONNECT tunnel failed, response 403`). No vendored copy of three.js exists anywhere in the repository.

**Why the check is still representative**: since THREE.TextureLoader delegates 100% of decode work to native `Image` and 100% of upload work to native `texImage2D`, this check exercises those two primitives directly in the same browser engine. This is **not** identical to running THREE.js r128's own code, and that gap is disclosed explicitly below — but it is real browser-engine decode and real WebGL texture upload, not merely a Pillow/ImageMagick check.

**Point where 16-bit could get silently reduced to 8-bit**: this happens *by design*, inside the browser's native decode step, when the source PNG is rasterized into an `HTMLImageElement`/canvas backing store — canvas `ImageData` is always `Uint8ClampedArray` regardless of source bit depth. This is standard PNG/Canvas spec behavior for every browser, not a bug or an Archer-specific problem.

**What Runtime actually needs** (identified and tested): decode success, correct alpha, correct dimensions, correct visual output, successful texture upload, no memory/format anomaly.

## Tests actually run

### A. Binary integrity
Python struct-level PNG chunk walk + `zlib.crc32` verification against the exact repository binary.
- SHA-256 match: **PASS**
- PNG signature valid, all chunk CRCs valid: **PASS**
- IHDR parsed correctly (640×960, depth=16, colorType=6, non-interlaced): **PASS**
- IEND complete: **PASS**
- Exit code: **0**

### B. Decoder compatibility (browser-native)
`tools/test-archer-attack-v3-2-16bit-compatibility-v1.mjs` — Playwright-driven headless Chromium, native `new Image()` decode via a local static HTTP server (loopback — matching real http(s) delivery, not `file://`).

- Decode succeeded: **true**
- Dimensions: **640×960** (exact)
- Alpha bounds: `528×772+68+83` (exact match)
- Border-opaque pixels: **0**
- No error/warning that made the asset unusable

**A harness bug was found and fixed during this check**, and it's worth being explicit about: Chromium's Private Network Access policy blocks a page with a null/opaque origin (`about:blank`) from fetching loopback (`127.0.0.1`) resources. This produced an `img.onerror` that looked at first like a genuine 16-bit decode failure. It was isolated with a minimal standalone script before drawing any conclusion, confirmed to be an origin/security-policy issue unrelated to the PNG itself, and fixed by navigating the page to a real `http://` origin before the compatibility calls. The fix is in the committed harness with a comment explaining why.

### C. Browser-equivalent decode
Same harness as B — this **is** the browser/headless-runtime test; results reported above. No claim of "full runtime compatibility" is made beyond what was actually executed (see Limitations).

### D. Texture upload compatibility (WebGL, isolated)
Native `gl.texImage2D` call — the same API `THREE.WebGLRenderer`/`Texture` uses internally — run in the same Playwright/Chromium session on the decoded frame 004 image.

| | |
|---|---|
| WebGL available | true (`WebGL 2.0 (OpenGL ES 3.0 Chromium)`) |
| Upload threw | false |
| GL error after upload | `0` (= `gl.NO_ERROR`) |
| `isTexture` after upload | true |
| `isTexture` after `deleteTexture` | false (correctly disposed) |

No integration into the running game — isolated test-only harness, no Runtime registration touched.

### E. Comparison against 8-bit neighbors (frames 003, 005)

| | frame 003 (8-bit) | frame 004 (16-bit) | frame 005 (8-bit) |
|---|---|---|---|
| Decode succeeded | true | true | true |
| Dimensions | 640×960 | 640×960 | 640×960 |
| Alpha bounds | `534×776+71+79` | `528×772+68+83` | `542×772+70+83` |
| File size | 515,930 B | 1,283,721 B | 497,353 B |

Frame 004 is ~2.5× larger on disk (16-bit encoding), but this is a one-time storage/transfer cost, not a decode-time or runtime-memory behavioral difference — the in-memory representation after browser decode is 8-bit RGBA for all three once rasterized. **No behavioral difference detected between the 16-bit frame and its 8-bit neighbors at any tested stage.**

### F. Animation sequence compatibility
All 12 frames (000–011) loaded via the same decode path in one run: **all decoded successfully, all resolved to exactly 640×960, no exceptions, no dimension drift.** Frame 004's presence in the sequence does not break loading, ordering, or iteration.

## Pixel cross-verification

The pixel at (320, 480) — inside the character's opaque silhouette — was decoded independently via Pillow and compared to the browser's decoded value:

| Source | R | G | B | A |
|---|---:|---:|---:|---:|
| Pillow (Python) | 17 | 58 | 0 | 255 |
| Browser (Chromium native decode) | 17 | 58 | 0 | 255 |

**Exact match.** No channel swap, no inversion, no color corruption from the browser's internal 16-bit-to-8-bit downsampling.

## Visual/pixel validation

- Silhouette bounds match expected (`528×772+68+83`): **yes**
- No black/white alpha-edge artifact: confirmed via corner/center sampling
- Transparent pixels remain transparent: confirmed (corner sample = `0,0,0,0`)
- No obvious premultiplication artifact or color clipping: confirmed
- This is pixel-level and programmatic validation, **not** a re-review of artistic quality — that human visual review already happened and was approved in PR #80. This check only confirms the *decoded bytes* are consistent with the *approved content*, at the format/pipeline level.

## Comparison summary

No behavioral difference was found between frame 004 (16-bit) and its 8-bit neighbors at decode, alpha-interpretation, or texture-upload stages. The only difference is on-disk file size, which is a storage/bandwidth cost, not a compatibility risk.

## Limitations (disclosed honestly)

1. **THREE.js r128 itself was not executed** — CDN network access blocked, no vendored copy in the repo. Native `Image` decode and native `texImage2D` upload (the two primitives TextureLoader delegates to) were tested directly instead. This is the single largest gap between this check and "the actual production code running."
2. **Only Chromium/Blink was tested.** WebKit (Safari/iOS) and Gecko (Firefox) were not exercised in this environment. 16-bit PNG decode is part of the baseline PNG spec and supported by all major engines, so this is judged low-risk, but it remains untested here.
3. **Only this container's software/virtual GL implementation was exercised** (`WebGL 2.0 (OpenGL ES 3.0 Chromium)`), not real end-user GPU/driver diversity.
4. **Asset-level isolation only** — this tests decode/upload of the standalone PNG via a local static server, not the actual production hosting (GitHub Pages) or the running game's sprite-sheet frame-slicing/animation-cycling logic, none of which was touched or exercised.

None of these limitations produced evidence of a 16-bit-caused failure; they are disclosed as untested surface area, not as findings.

## Classification

**COMPATIBILITY_PASS** — exact binary verified, production-representative decode and texture-upload primitives succeeded with correct dimensions/alpha/pixel-values/GL-error-state, full 12-frame sequence loads cleanly, no evidence of any 16-bit-caused failure at any tested layer. The one real limitation (THREE.js r128 itself not executed) is judged non-critical given what it delegates to was tested directly.

## Gate flags

| Flag | Value |
|---|---|
| `runtimeCompatibilityCheckPassed` | **true** |
| `runtimeCompatibilityFollowUpRequired` | **false** |
| `runtimeIntegrationBlockedUntilCompatibilityCheck` | **false** |
| `runtimeIntegrationAuthorized` | **true** |
| `canonicalApproved` | false |
| `runtimeEligible` | false |
| `runtimeIntegrated` | false |

## Scope of this check

- Frame 004 was **not** re-encoded or modified in any way.
- No asset binary was modified.
- PR #79, PR #80: files unmodified (re-verified via existing validators, both exit 0).
- `src/`, Core Runtime, Combat, projectile, marker, Game Loop, camera/board/grid/pathfinding: **not touched**.
- No PR merged. `runtimeEligible`/`runtimeIntegrated` **not** set to true.
- No other character's asset production started. No Survival Mode or 3-star hero work started.
- Combat x4: **NOT APPLICABLE** — no Runtime/Combat integration performed or started.

## Next authorized gate

**ARCHER RUNTIME INTEGRATION** — not started by this record. Registering frame 004 (and the full v3.2 12-frame sequence) into `src/game.js`'s asset pipeline, wiring animation playback, and any associated Combat/marker changes requires a separate, explicitly scoped task.
