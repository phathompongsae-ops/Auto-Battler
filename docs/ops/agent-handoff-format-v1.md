# Agent Handoff Format v1

Use this format whenever Coco, CC, or the user hands a task to the next owner.

## Required handoff fields

- `taskId`
- `fromOwner`
- `toOwner`
- `fromStatus`
- `toStatus`
- `summary`
- `artifacts[]`: exact repo paths, PRs, commits, or exported file locations
- `sourceOfTruth[]`: exact refs/SHAs/hashes used
- `validation[]`: only checks actually run, including exit/result
- `remainingBlockers[]`
- `nextAction`

## Rules

1. Never say PASS for a check that was not actually run.
2. Never fabricate a SHA, path, PR state, asset, or approval.
3. Binary/assets must be handed off by exact file/path/reference, not by screenshots alone when the binary is required.
4. A human approval is valid only when the user explicitly gives the verdict.
5. Handoff to CC must include enough source-of-truth data that CC does not need to guess lineage.
6. Handoff to Coco must include exact identity/source assets or a declared blocker if those binaries are unavailable.
7. If local filesystems are not shared, GitHub artifacts/commits/PRs are the default transfer boundary.

## Minimal JSON example

```json
{
  "taskId": "archer-attack-v3-current",
  "fromOwner": "coco",
  "toOwner": "cc",
  "fromStatus": "COCO_WORKING",
  "toStatus": "READY_FOR_CC",
  "summary": "10 review-approved PNG frames produced and ready for repository import.",
  "artifacts": [
    {"type":"folder","path":"<exact-transfer-location>"}
  ],
  "sourceOfTruth": [
    {"type":"sha256","value":"4911e7e3ba59241ee011be3e62f1b64230dcf9b3c24c6aeb23dc939d83311013"}
  ],
  "validation": [
    {"name":"human visual review","result":"PASS","evidence":"explicit user verdict"}
  ],
  "remainingBlockers": [],
  "nextAction": "Import exact binaries, hash-lock, validate, and create production candidate without changing approval flags."
}
```
