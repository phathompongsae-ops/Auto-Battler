# Agent Runner Setup v1

This document defines the final bridge from the GitHub task queue to real CC/Codex execution.

## What is already automated without credentials

- Shared task records under `data/agent-tasks/`
- Task contract validation
- State/owner/approval safety policy
- Dry-run dispatch planning
- Standardized Coco/CC handoff format

## What requires credentials before real agent execution

### CC / Claude Code

Preferred supported path: Anthropic Claude Code GitHub Action or Claude Code non-interactive CLI.

Required secret:
- `ANTHROPIC_API_KEY`

Recommended safety boundary:
- Run only when the task status is `READY_FOR_CC`.
- Start with explicit manual dispatch before enabling automatic dispatch.
- Never grant merge authority.
- Task prompt must require an isolated branch/PR and preserve task approval flags.

### Coco / Codex

Supported path: OpenAI Codex CLI / Codex automation.

Required authentication for headless automation:
- `OPENAI_API_KEY` (recommended for GitHub-hosted automation)

Important: a ChatGPT Plus/Pro subscription and OpenAI API billing/keys are separate concepts. Do not assume upgrading ChatGPT alone creates a reusable GitHub Actions secret.

Recommended safety boundary:
- Run only when task status is `READY_FOR_COCO`.
- Start with manual dispatch before enabling automatic dispatch.
- No merge authority.
- Image-generation tasks may still require an image-capable environment; Codex code execution alone is not equivalent to ChatGPT image generation.

## Planned activation sequence

1. User adds `ANTHROPIC_API_KEY` to GitHub Actions secrets.
2. User adds `OPENAI_API_KEY` only if Codex headless execution is desired.
3. Run CC and Coco runner smoke tests manually against a harmless docs-only task.
4. Verify branch/PR behavior and task-state updates.
5. Enable automatic dispatch only after both smoke tests pass.
6. Keep human review mandatory for art approval, canonical approval, merges, and other irreversible/high-impact gates.

## Never automate by default

- PR merge
- `canonicalApproved=true`
- `runtimeEligible=true` when human approval is still pending
- human visual PASS/FAIL
- destructive branch history rewrites
- secret disclosure

## Current activation state

`RUNNER_PREPARED_BUT_NOT_CREDENTIALED`

The repository-side orchestration can be completed without secrets. Real agent invocation must remain disabled until the user explicitly supplies/configures the required credentials.
