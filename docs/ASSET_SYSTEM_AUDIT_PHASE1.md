# Asset System Audit — Phase 1 (Read-only)

## Scope
Read-only review of the current Auto-Battler asset system. No runtime files, assets, CSS, loader code, Three.js scene code, combat code, or workflows were changed.

Branch: `codex/project-handoff-docs-clean`
PR: Draft PR #3
Test level: Level 1 documentation/audit. No combat run was required.

## Modules and files reviewed
- GitHub repository code search
- `src/game.js` asset-loading and texture references (read-only search)
- `assets/licenses/source_manifest.json`
- `assets/licenses/ASSET_CREDITS.md`
- `docs/ASSET_AND_PAGES_PATH_AUDIT.md`
- GitHub Pages deployment contract recorded in the existing audit
- Sprite-generation tools referenced by the manifest

## Executive result
No production file was changed and no asset was deleted. The most important finding is not a confirmed missing image; it is that the repository does not yet have a machine-readable per-file runtime asset inventory. The current provenance manifest is intentionally group-level, while GitHub Pages copies the complete `assets/` directory. This makes exact orphan detection, duplicate detection, and case validation unreliable without a small validation script.

## Critical
None confirmed from the read-only evidence available.

No specific runtime-referenced file was proven missing, and no specific case mismatch was proven. Do not label individual files as broken or orphaned without a recursive inventory.

## High

### H1 — No per-file source of truth for runtime assets
Evidence:
- `source_manifest.json` states that it is group-level rather than one entry per file.
- Several entries use wildcard groups such as `assets/v5/body_*.png`, `assets/icons/classes/*.png`, and `assets/heroes/*_sheet.png`.

Risk:
- Missing references, case mismatches, duplicate logical keys, and orphaned files cannot be checked reliably in CI or before deployment.
- A deployment can succeed while individual runtime loads fail.

Smallest safe correction direction:
- Add one dependency-light validation script after CC finishes the active loader work.
- The script should enumerate real files, parse known explicit references and approved dynamic patterns, compare exact casing, report duplicate keys, and report suspected orphans without deleting anything.

### H2 — License/provenance uncertainty for the AI-generated V5 batch
Evidence:
- The manifest records `license: unknown` for the V5 hero, monster, and board-ground batches.

Risk:
- These assets may be unsuitable for a public or commercial release until the originating tool and terms are verified.

Smallest safe correction direction:
- Before release, record the actual generator/product and applicable commercial-use terms.
- Keep this as a release-governance task; do not rename or regenerate assets during a loader or UI fix.

## Medium

### M1 — Broad Pages copy can deploy unused and legacy assets
Evidence:
- The deployment contract copies the full `assets/` directory.
- The manifest includes contact sheets, legacy V5 assets, hero sheets, portraits, icons, and older page-specific batches.

Risk:
- Unused contact sheets or legacy files can increase deploy size and create confusion about which art is production-active.

Smallest safe correction direction:
- First classify each file as `runtime-referenced`, `referenced-by-pattern`, `documentation-only`, `archive/legacy`, `suspected-orphan`, or `unknown-needs-review`.
- Only after that, clean up through a separate asset-only PR.

### M2 — Mixed generations and page ownership are not explicit per file
Evidence:
- The manifest describes assets used by several pages (`game.html`, `heroes.html`, `forest-clearing.html`, archived V5, and `autochess.html`) at group level.

Risk:
- A file can appear unused by the active game while still belonging to a legacy/demo page, leading to unsafe deletion.

Smallest safe correction direction:
- Include an `owners` or `consumers` field in the future generated inventory rather than manually editing every asset record now.

### M3 — Dynamic asset patterns require an explicit allowlist
Risk:
- A validator that only searches literal strings will incorrectly classify generated/dynamic paths as unused.

Smallest safe correction direction:
- Keep a small reviewed allowlist of dynamic path patterns and generation outputs.
- Fail only for missing referenced files and duplicate runtime keys; report possible orphans as warnings initially.

## Low

### L1 — Filename policy should be enforced for new production assets
Recommended convention:
`assets/<category>/<stable-id>_<state>.<ext>` using lowercase ASCII, digits, hyphens, and underscores.

This lowers GitHub Pages case-sensitivity and rename risk.

### L2 — Contact sheets should be marked non-runtime
Contact sheets are useful for review but should be classified as documentation/tooling outputs so they are not mistaken for runtime dependencies.

### L3 — Separate visual-generation outputs from final production assets later
Do not reorganize now. Once layout, camera, bench, and the real-asset pipeline are locked, consider a clear distinction between generated source/review artifacts and runtime-ready assets.

## Texture/material and memory review boundary
Code search confirms texture-loading and disposal-related logic exists in `src/game.js`, but this phase did not modify or re-audit CC-owned loader behavior. A trustworthy leak conclusion requires runtime instrumentation and focused creation/removal tests; it must not be inferred from search hits alone.

Future runtime audit, only when approved:
- Record `renderer.info.memory.textures`, geometries, and programs before and after repeated focused waves.
- Verify unit removal, sprite replacement, and failed loads do not continuously increase resources.
- Run any combat/time-dependent checks at x4 and state the exact module and test path used.

## Recommended next action after CC is available
Create a tiny read-only script such as `tools/audit_assets.py` with no new dependency that:
1. Recursively lists `assets/`.
2. Extracts explicit local asset references from active runtime files/data.
3. Applies a reviewed allowlist for dynamic/generated patterns.
4. Detects exact-case mismatches and missing referenced files.
5. Detects duplicate logical keys and optionally byte-identical files.
6. Reports suspected orphans but does not delete or rename anything.
7. Exits non-zero only for missing required assets, case mismatch, or duplicate runtime keys.

This is intentionally deferred until the active CC loader task and Shop-Drawer Phase 1 ownership are clear, to avoid overlapping implementation work.

## Explicitly not touched
- `autochess.html`
- `src/game.js`
- `#shopDrawer`, `#shopCards`, `setShopOpen()`
- Three.js scene, camera, render loop
- Combat, movement, targeting, deployment
- Asset files and filenames
- GitHub Pages workflow
