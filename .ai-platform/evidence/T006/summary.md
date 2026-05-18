# T006 Evidence Summary

**Task ID**：T006
**Status**：Accepted
**Executor**：Codex direct execute fallback
**Branch/worktree**：`main` in `D:\data\skillrun-desktop`
**Packet**：`.ai-platform/specs/001-desktop-alpha/packets/T006.yaml`

## Direct Execute Reason

The user asked to review, commit locally, and continue. Sub-agent delegation was not explicitly authorized for this turn, so direct execute fallback was used for T006.

## Files Changed

- `.ai-platform/specs/001-desktop-alpha/packets/T006.yaml`
- `.ai-platform/specs/001-desktop-alpha/tasks.md`
- `.ai-platform/docs/tasks.md`
- `.ai-platform/docs/release-report.md`
- `.ai-platform/evidence/T006/summary.md`
- `.ai-platform/evidence/T006/test-results.md`
- `.ai-platform/evidence/T006/diff.patch`
- `src/core/switchboardService.ts`
- `src/state/switchboard.ts`
- `src/state/switchboard.test.ts`
- `src/views/Switchboard/Switchboard.tsx`
- `src/views/Switchboard/index.ts`

## Implementation Summary

- Added a switchboard service that refreshes `consumer inventory --json` and `consumer exposure --json` through existing Core JSON parsers.
- Added raw text command handling for `skillrun switchboard enable <id>` and `skillrun switchboard disable <id>` without assuming JSON output.
- Added switchboard state mapping for capsule identity, source type, readiness, runtime, tool name, manifest freshness, exposure intent, and confirmation policy.
- Added a presentational Switchboard view with refresh, enable, disable, empty, error, and exposure sections.

## TDD Evidence

- RED captured: `npm test -- src/state/switchboard.test.ts --run` failed because `./switchboard` did not exist.
- GREEN captured: `npm test -- src/state/switchboard.test.ts --run` passed with 6 tests.

## Switchboard Safety Review

- `enabled=true` is labelled as `Exposure intent allowed`; it is not labelled trusted, safe, sandboxed, or runnable.
- `readiness.ok=false` maps to `Not ready` and `canEnable=false`.
- Imported disabled capsules require explicit confirmation before enable.
- Enable and disable call the exact Core switchboard text command once, then refresh inventory and exposure.
- Enable failure surfaces the Core runner error kind/message and does not suggest install/fix/repair actions.
- Implementation does not read registry files, `.skillrun`, manifests, package internals, or start Router.

## Copy Review Notes

The safety copy states that enabled means local exposure intent only and that readiness is a Core preflight signal, not trust, safety, sandboxing, or business correctness.

## Spec Compliance Review

- `US-003`, `FR-006`, `FR-007`, `FR-011`, and `NFR-001` are covered at service/state/view component layer.
- T006 did not wire global dashboard navigation because `App.tsx` is outside the approved T006 write scope.

## Bug/Code Quality Review

- No blocking issues found in the reviewed diff.
- Core commands are dependency-injected and covered by unit tests.
- Raw enable/disable handling preserves non-zero exit semantics through `CoreNonZeroExitError`.

## QA Acceptance Review

- The future dashboard can list capsules, show readiness/exposure intent, require imported enable confirmation, and refresh exposure state after changes.
- View-level integration is intentionally deferred to a later dashboard wiring task.

## Residual Risk

- The Switchboard component is not yet connected to the dashboard shell.
- Native confirmation modal integration is not implemented in this task; state returns `confirmation_required` for the future shell to render.

## User Acceptance Status

Accepted by user on 2026-05-18 after request to review, commit locally, and continue.
