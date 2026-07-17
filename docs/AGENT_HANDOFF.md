# Agent Handoff Rules

## Purpose
Keep CC and Codex from overwriting each other when work is performed in parallel.

## Current ownership
- CC owns the in-progress Asset Loader Failure Handling task.
- Codex must not edit or duplicate that loader code path until CC reports completion.
- Documentation work may proceed independently on a separate branch.

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
