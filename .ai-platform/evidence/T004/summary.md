# T004 Evidence Summary

**Task ID**：T004
**Status**：Accepted
**Executor**：Codex direct execute fallback
**Branch/worktree**：`main` in `D:\data\skillrun-desktop`
**Packet**：`.ai-platform/specs/001-desktop-alpha/packets/T004.yaml`

## Direct Execute Reason

The user asked to review, commit locally, and continue. Sub-agent delegation was not explicitly authorized, so direct execute fallback was used for T004.

## Files Changed

- `.ai-platform/specs/001-desktop-alpha/packets/T004.yaml`
- `.ai-platform/specs/001-desktop-alpha/tasks.md`
- `.ai-platform/docs/tasks.md`
- `.ai-platform/docs/release-report.md`
- `src/state/trayStatus.ts`
- `src/state/trayStatus.test.ts`

## Implementation Summary

- Added pure tray status computation from parsed Core command snapshots.
- Added priority coverage for `core_missing`, `core_error`, `recent_failures`, `mount_not_configured`, `tools_exposed`, `capsules_disabled`, and `no_capsules`.
- Added explicit stale last-known-state behavior for refresh failures.
- Added low-frequency refresh/backoff helper.

## TDD Evidence

- RED captured: `npm test -- src/state/trayStatus.test.ts --run` failed because `./trayStatus` did not exist.
- GREEN captured: `npm test -- src/state/trayStatus.test.ts --run` passed with 5 tests.

## Priority Order Review

The implementation follows the documented order:

`core_missing > core_error > recent_failures > mount_not_configured > tools_exposed > capsules_disabled > no_capsules`

## Stale Behavior Review

- Refresh failure returns `core_missing` or `core_error`.
- If `lastKnown` exists, the failure status carries `stale=true` and preserves `lastKnown`.
- Non-error stale is still based on snapshot age.

## Spec Compliance Review

- `US-001`, `FR-001`, `FR-002`, `FR-004`, `NFR-002`, and `NFR-003` are covered at state-model layer.
- T004 did not call Core commands, read `.skillrun`, start Router, add UI flows, or add dangerous tray actions.

## Residual Risk

- The native tray UI is not yet wired to this model.
- T005/T006 still need action-triggered refresh integration after import/enable/disable.

## User Acceptance Status

Accepted by user on 2026-05-18 after request to review, commit locally, and continue.
