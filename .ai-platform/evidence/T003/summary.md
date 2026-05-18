# T003 Evidence Summary

**Task ID**：T003
**Status**：Accepted
**Executor**：Codex direct execute fallback
**Branch/worktree**：`main` in `D:\data\skillrun-desktop`
**Packet**：`.ai-platform/specs/001-desktop-alpha/packets/T003.yaml`

## Direct Execute Reason

The user asked to review, commit locally, and continue. Sub-agent delegation was not explicitly authorized, so direct execute fallback was used for T003.

## Files Changed

- `.ai-platform/specs/001-desktop-alpha/packets/T003.yaml`
- `.ai-platform/specs/001-desktop-alpha/tasks.md`
- `.ai-platform/docs/tasks.md`
- `.ai-platform/docs/release-report.md`
- `src/core/contracts/index.ts`
- `src/core/contracts.test.ts`
- `src/core/fixtures/*.json`

## Fixture Sources

Live Core command outputs from `D:\data\skillrunv2`:

- `host status --json`
- `consumer inventory --json`
- `consumer exposure --json`
- `router serve --mcp --dry-run`
- `consumer mount plan --client claude-desktop --json`
- `consumer runs list --json --limit 3`

Documented Desktop Core Contract samples:

- `import.v1`
- `consumer.mount_apply.v1`
- `consumer.mount_rollback.v1`
- `consumer.runs.inspect.v1`

## Implementation Summary

- Added DTO/parser coverage for host status, import, consumer inventory, consumer exposure, router dry-run, mount plan/apply/rollback, runs list, and runs inspect.
- Added fixture-backed tests for all Desktop-facing Core JSON surfaces.
- Added fail-closed validation for `command`, `schema_version`, and required nested fields.

## TDD Evidence

- RED captured: `npm test -- src/core/contracts.test.ts --run` failed because `./contracts` did not exist.
- GREEN captured: `npm test -- src/core/contracts.test.ts --run` passed with 12 tests.

## Parser Safety Review

- Parsers do not call Core commands at runtime.
- Parsers do not read `.skillrun` internals or `D:\data\skillrunv2` files.
- Every parser validates `schema_version`.
- Required fields fail closed with `CoreContractMismatchError`.

## Spec Compliance Review

- `FR-001`, `FR-005`, `FR-006`, `FR-008`, `FR-009`, `FR-010`, and `NFR-004` are covered at contract-parser layer.
- T003 did not implement UI flows, state machines, tray status, import service, mount manager, exposure preview, or run explorer.

## Residual Risk

- Some write-state surfaces use documented samples rather than live command output to avoid mutating local MCP client or registry state.
- Parser validation is intentionally structural and minimal; semantic UI rules remain in later state/view tasks.

## User Acceptance Status

Accepted by user on 2026-05-18 after request to review, commit locally, and continue.
