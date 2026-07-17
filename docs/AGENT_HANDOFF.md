# Agent Handoff Rules

## Purpose
Keep CC and Codex from overwriting each other when work is performed in parallel.

## Current ownership
- CC owns the Shop-Drawer White-Rectangle Rendering Bug follow-up.
- Phase 0 investigation is complete; no repository files were modified.
- Phase 1 has not started because the CC session limit was reached before execution began.
- Until CC reports Phase 1 completion or explicitly releases the area, Codex must not edit `#shopDrawer`, `#shopCards`, shop portrait rendering, `setShopOpen()`, or nearby shop open/close behavior.
- Codex may continue documentation-only work and other clearly separate tasks on the existing documentation branch.

## Current work board

### CC-owned
- Shop-Drawer White-Rectangle Rendering Bug — Phase 1 CSS-only verification.
- Primary allowed area when resumed: the `#shopDrawer` CSS block in `autochess.html`.
- `src/game.js` remains out of scope unless CSS-only candidates all fail and the project owner separately approves a JS phase.

### Codex-safe
- Documentation and handoff maintenance.
- Data Systems, UI/DOM work outside the locked shop-drawer area, Asset Tooling, and Lore/Text when explicitly assigned.
- Read-only audits that do not alter CC-owned runtime code.

### Blocked pending CC
- Any edit to `#shopDrawer`, `#shopCards`, shop image visibility/compositing, `setShopOpen()`, or the white-rectangle workaround path.
- Any test or refactor that changes the isolated reproduction baseline before CC resumes Phase 1.

## Before starting any new task
Every agent must report:
- Current branch
- Current HEAD
- Working-tree status
- Base commit used for the task

Then read the latest files in `docs/` that apply to the task.

## Parallel-work rule
Parallel implementation is allowed only when file or code-area ownership is clearly separate.

Do not allow CC and Codex to edit `src/game.js` concurrently unless the work is isolated in separate branches and one agent is strictly reviewing without writing.

## Prompt and credit rules
- Do not prepare or send an agent command unless the project owner explicitly asks for the command or authorizes execution.
- Use the smallest effective implementation and the smallest risk-appropriate test scope.
- Reuse valid unchanged evidence instead of repeating broad tests.
- Any combat or stage test during development must run at speed x4.
- Every task report must name the modules, tools, files, and code areas used.

## Safe integration order
1. The agent with an existing in-progress code diff finishes, tests, commits, and pushes that task first.
2. The other branch is updated from the latest `main`.
3. Resolve conflicts deliberately; never discard either side automatically.
4. Re-run the risk-appropriate checks in `docs/REGRESSION_CHECKLIST.md`.
5. Merge only after confirming the diff contains no unrelated rollback.

## Source-of-truth rule
After a documentation or implementation PR is merged, the next agent must sync `main` and read the merged handoff documents before accepting a new task.

Do not rely on memory or an older chat summary when the repository contains a newer source-of-truth document or commit.

## Handoff record
A completed task should report:
- Branch and base commit
- Files and code areas changed
- Root cause or objective
- Test evidence
- Commit hash and PR
- Remaining risks
- Explicit list of systems not touched

## Conflict rule
When current code and an older instruction disagree:
- Stop before editing.
- Report the mismatch.
- Prefer the latest merged source of truth unless the project owner explicitly overrides it.
