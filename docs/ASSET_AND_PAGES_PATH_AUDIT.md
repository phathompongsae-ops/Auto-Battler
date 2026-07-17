# Asset Inventory and GitHub Pages Path Audit

## Scope
Read-only audit of the current `main` deployment shape and runtime asset-path risks. No production code, assets, workflow, or filenames were changed.

Base reviewed: `main` at `509b7569f76c58302b85d32b396b13367a02b693`.

## Confirmed deployment contract
GitHub Pages builds `_site` by:

1. Copying `autochess.html` to `_site/index.html`.
2. Copying the entire `assets/` directory to `_site/assets/`.
3. Copying the entire `src/` directory to `_site/src/`.

Therefore runtime references in `autochess.html` and `src/game.js` must resolve relative to the deployed site root exactly as they do from repository root.

## Confirmed runtime entry points
- Page entry: `/index.html` generated from `autochess.html`.
- Game script: `src/game.js`.
- Three.js: external CDN script loaded before `src/game.js`.
- All shipped local runtime assets must live under either `assets/` or `src/`, because the workflow does not copy other repository folders into `_site`.

## High-risk path rules

### 1. Case sensitivity
GitHub Pages runs on a case-sensitive filesystem. These pairs are different paths:

- `assets/Hero.png`
- `assets/hero.png`

Windows or some local development environments may appear to tolerate a mismatch that will fail after deployment.

Required rule: every manifest/reference must match repository filename casing exactly.

### 2. Root-relative paths
Avoid paths beginning with `/` unless intentionally targeting the domain root. The project is deployed under `/Auto-Battler/`, so `/assets/...` may resolve outside the repository site.

Preferred forms:

- `assets/...`
- `./assets/...`
- `src/...`

### 3. Parent-directory traversal
Do not use `../assets/...` from `src/game.js` merely because the script file is inside `src/`. Browser URL resolution for dynamically loaded assets is relative to the document URL, not necessarily the JavaScript source-file directory.

Use paths relative to deployed `index.html` unless explicitly resolved through `new URL(..., document.baseURI)`.

### 4. Spaces, Thai characters, and punctuation
These can work but increase rename, encoding, and manual-reference risk. New runtime asset filenames should use lowercase ASCII, digits, hyphens, or underscores.

Recommended pattern:

`assets/<category>/<stable-id>_<state>.<ext>`

Examples:

- `assets/heroes/fighter_idle.png`
- `assets/monsters/stone_wolf_idle.png`
- `assets/bosses/arena_warden_idle.png`

### 5. Extension mismatch
`.png`, `.webp`, `.jpg`, and `.jpeg` must match exactly. Renaming an asset without updating its reference will deploy successfully but fail only at runtime.

## Loader-specific risks

The active CC task owns loader failure handling. This audit must not duplicate that implementation.

The loader should ultimately make these failures observable:

- Referenced file is absent.
- Filename case differs.
- Unsupported or malformed image.
- Network/CDN failure.
- One failed asset prevents completion callback.

Expected post-loader behavior remains:

- Log the failed key and path.
- Count failed entries as completed.
- Finish loading exactly once.
- Use the existing placeholder visual for affected units.

## Current architecture observations

### Procedural assets
Stage tiles, floor patterns, banners, glows, cracks, smoke, and similar visual elements are generated in code using canvas textures and Three.js geometry. These do not depend on files under `assets/` and are not deployment-path risks.

### External dependency
Three.js is loaded from a CDN. The page already has an `onerror` message for this script. This dependency is separate from local sprite loading and should not be mixed into the local asset manifest.

### Deployment copying is broad
The workflow copies the entire `assets/` directory, not only referenced files. Consequently:

- An unused asset can still inflate the deployed artifact.
- Deployment success does not prove that every runtime path is valid.
- An orphan file cannot be identified solely from the Pages workflow.

## Orphan-file policy
Do not delete, move, or rename suspected orphan assets during this audit.

Before cleanup, produce a machine-derived comparison between:

1. Every file under `assets/`.
2. Every explicit asset path referenced by runtime code/data.
3. Any generated or dynamic path patterns.

Classify each file as:

- `runtime-referenced`
- `referenced-by-pattern`
- `documentation-only`
- `archive/legacy`
- `suspected-orphan`
- `unknown-needs-review`

Only remove files in a separate cleanup PR after the live game and fallback behavior are verified.

## Minimal future tooling recommendation
After CC finishes the loader task, add one small validation script in a separate task that:

1. Reads known runtime asset manifests/paths.
2. Checks that each path exists with exact casing.
3. Reports duplicate logical keys.
4. Reports unreferenced files without deleting them.
5. Exits non-zero only for missing referenced assets or duplicate keys.

Do not introduce a bundler or dependency-heavy asset pipeline for this check.

## Recommended integration order

1. CC finishes and commits Asset Loader Failure Handling.
2. Merge the documentation PR after confirming no overlap.
3. Sync latest `main`.
4. Run an exact-casing asset-path inventory against the post-loader source.
5. Add the lightweight validation script only if the inventory proves worthwhile.
6. Handle orphan cleanup later in a dedicated, reviewable PR.

## Acceptance criteria for the future validation task
- No production asset is renamed automatically.
- Missing referenced files are reported with source key/path.
- Exact case mismatches are detected.
- Dynamic/generated paths are explicitly allowlisted.
- GitHub Pages output contract remains `index.html`, `assets/`, and `src/`.
- Runtime verification uses a clean load and one combat wave at x4 if any loader/runtime path code changes.

## Audit limitations
This connector review confirmed the deployment workflow and runtime entry structure, but it did not provide a complete recursive repository tree suitable for a trustworthy file-by-file orphan classification. Therefore no specific asset is labeled orphan in this document. A future inventory must derive the list mechanically rather than guess from search snippets.
