# Skeleton Neutral Master v1 — Reserved Import Root

**Status: PENDING_PACKAGE_DELIVERY**

This directory is reserved for the future byte-for-byte import of the **Skeleton Neutral Master
Human Review Candidate v1** package. As of this scaffold:

- **No candidate binary has been imported.** This directory intentionally contains only this
  README — no PNG, no ZIP content, no placeholder image, no fabricated evidence.
- **No approval has been recorded.** Human Visual Approval and Exact Package Approval are both
  strictly pending.
- The candidate/ZIP hashes reported in the production handoff are **unverified references** until
  the real package is delivered and independently measured here.

## Expected future Human Review package structure (documented contract — none of this exists yet)

- Skeleton Neutral Master candidate PNG
- procedural identity reference record
- identity-lock sheet
- full-resolution review
- board-scale proxy
- warm-board readability review
- silhouette comparison
- grayscale comparison
- anatomy/prop QA sheet
- transparent-edge QA
- source map
- technical QA record
- candidate metadata sidecar
- known limitations
- production notes
- Human Decision Sheet

## Expected independent audit procedure (future task, not run yet)

1. Verify delivered ZIP: fresh SHA-256, size, entry count, CRC (`unzip -t`), path safety
   (no traversal/absolute paths/symlinks/duplicate or case-collision paths/hidden files).
2. Extract and import byte-for-byte into this directory; re-hash every file after copy.
3. Independently re-derive the candidate PNG's properties (manual IHDR/IDAT decode, as in the
   Class 1 pipeline): 640×960, 8-bit RGBA, fully transparent outer borders, alpha bounds,
   baseline, no background/shadow plate/baked VFX/cropping.
4. Cross-check every sidecar/QA claim against the measured binaries — never trust package claims.
5. Verify the procedural identity reference hash matches `assets/mon_skeleton.png`
   (`6484dd238083f6209732359b3f1b37d311fbc6644bd50e18ab079c20d8c76d1c`, identity evidence only —
   NOT an approved Neutral Master).
6. Confirm the Human Decision Sheet ships with no preselected verdict.
7. Run `tools/validate-skeleton-neutral-master-exact-package-approval-v1.mjs`.

## Approval gates (in order — none passed)

1. Package delivery + independent verification (`READY_FOR_HUMAN_REVIEW`)
2. User Human Visual Approval + Exact Package Approval
3. Skeleton Motion Pilot authorization (separate user decision)
4. Monster Runtime Integration authorization (separate user decision)

## Prohibited until the gates above are explicitly passed

Generating/regenerating Skeleton art, importing any unverified binary, recording any approval,
Skeleton motion production, Monster Runtime Integration, Runtime/Combat/gameplay/balance changes,
projectile/VFX work, and boss/miniboss work.
