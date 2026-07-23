# Auto-Battler Agent Orchestration v1

Purpose: use GitHub as the shared source of truth between ChatGPT/Coco and Claude Code (CC) without sharing local filesystems.

## Roles

- ChatGPT/Coco: planning, task creation, GitHub/source verification, asset/data coordination, review coordination.
- CC: repository execution, code/runtime integration, validators, Git operations, technical tests.
- User: human visual/design approval and final decisions.

## Core rule

Agents never assume another agent can see their local filesystem. Every handoff must be represented in GitHub by a task record, branch/PR, or committed artifact path.

## Task lifecycle

1. `READY_FOR_COCO`
2. `COCO_WORKING`
3. `READY_FOR_CC`
4. `CC_WORKING`
5. `READY_FOR_HUMAN_REVIEW`
6. `APPROVED` or `REWORK_REQUIRED`
7. `DONE`

Blocked work uses `BLOCKED` with a concrete blocker and required resolver.

## Handoff contract

Every task record must contain:

- task id and title
- current owner: `coco`, `cc`, or `user`
- current status
- exact repo and base ref/SHA when repository work is involved
- scope allowlist and denylist
- inputs with exact paths/SHAs where applicable
- required outputs
- validation required
- next owner and transition condition
- blocker field

## Safety

- No automatic merge.
- No approval flags may be set from technical success alone.
- Human visual approval remains mandatory where asset contracts require it.
- Do not modify Core Combat/Game Loop/Camera/Board/Pathfinding unless the task explicitly authorizes it.
- Do not fabricate missing assets, SHAs, tests, or approvals.

## How ChatGPT/Coco hands work to CC

ChatGPT/Coco updates or creates a task JSON under `data/agent-tasks/` with `status: READY_FOR_CC` and exact inputs/constraints. CC is instructed to read the latest task record first and execute only tasks whose owner is `cc` and status is `READY_FOR_CC`.

CC then commits its result on a dedicated branch/PR and updates the task record to either `READY_FOR_HUMAN_REVIEW`, `READY_FOR_COCO`, or `BLOCKED`.

## How CC hands work back

The CC report must include branch, full commit SHA, PR number, files changed, tests actually run, blockers, and the next expected owner. ChatGPT/Coco verifies GitHub state before continuing.

## Automation boundary

This protocol enables shared orchestration through GitHub immediately. Fully automatic agent-to-agent execution still requires an external runner/API credential for CC and/or Codex. Until that runner is connected, GitHub task records are the authoritative queue and the user can trigger the next agent with a short command such as `ดำเนินการ`.
