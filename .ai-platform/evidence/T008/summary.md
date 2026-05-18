# T008 Evidence Summary

**Task ID**：T008
**Status**：Accepted
**Executor**：Codex direct execute fallback
**Branch/worktree**：`main` in `D:\data\skillrun-desktop`
**Packet**：`.ai-platform/specs/001-desktop-alpha/packets/T008.yaml`

## Direct Execute Reason

The user asked to review, commit locally, and continue. Sub-agent delegation was not explicitly authorized for this turn, so direct execute fallback was used for T008.

## Files Changed

- `.ai-platform/specs/001-desktop-alpha/packets/T008.yaml`
- `.ai-platform/specs/001-desktop-alpha/tasks.md`
- `.ai-platform/docs/tasks.md`
- `.ai-platform/docs/release-report.md`
- `.ai-platform/evidence/T008/summary.md`
- `.ai-platform/evidence/T008/test-results.md`
- `.ai-platform/evidence/T008/diff.patch`
- `src/core/mountService.ts`
- `src/state/mountManager.ts`
- `src/state/mountManager.test.ts`
- `src/views/MountManager/MountManager.tsx`
- `src/views/MountManager/index.ts`

## Implementation Summary

- Added mount service for Core JSON plan/apply/rollback commands.
- Added mount manager state with plan-before-apply, explicit apply/rollback confirmation, plan-only client mode, warnings preservation, and rollback backup path policy.
- Added presentational MountManager view with plan/apply/rollback actions, warnings, config path, router command, and backup display.

## TDD Evidence

- RED captured: `npm test -- src/state/mountManager.test.ts --run` failed because `./mountManager` did not exist.
- GREEN captured: `npm test -- src/state/mountManager.test.ts --run` passed with 7 tests.

## Mount Safety Review

- Plan command args are `consumer mount plan --client CLIENT_ID --json`.
- Apply command args are `consumer mount apply --client claude-desktop --json`.
- Rollback command args are `consumer mount rollback --client claude-desktop --backup CORE_BACKUP_PATH --json`.
- Apply is blocked before a plan exists.
- Apply and rollback return `confirmation_required` before any Core mutation call when not confirmed.
- Unsupported or non-Claude clients remain plan-only.
- Implementation does not directly read or write MCP client config.
- Copy does not describe mount apply as dependency installation.

## Rollback Backup Path Review

- `rollbackMount` ignores `requestedBackupPath` and passes `state.rollbackBackupPath` to Core.
- `state.rollbackBackupPath` is populated only from Core mount apply backup output.
- Tests pass a fake requested backup path and assert the Core command uses the apply result backup path instead.

## Spec Compliance Review

- `US-005`, `FR-009`, `FR-011`, and `NFR-001` are covered at service/state/view component layer.
- T008 did not wire global dashboard navigation because `App.tsx` is outside the approved T008 write scope.

## Bug/Code Quality Review

- No blocking issues found in the reviewed diff.
- Core calls are dependency-injected and covered by unit tests.
- Warnings from plan/apply/rollback are preserved in state.

## QA Acceptance Review

- The future dashboard can preview Claude Desktop mount, apply only after confirmation, and rollback using the Core backup path.
- View-level integration is intentionally deferred to a later dashboard wiring task.

## Residual Risk

- The MountManager component is not yet connected to the dashboard shell.
- Optional `--config` pass-through exists in service but is not surfaced by a UI control in this task.

## User Acceptance Status

Accepted by user on 2026-05-18 after request to review, commit locally, and continue.
