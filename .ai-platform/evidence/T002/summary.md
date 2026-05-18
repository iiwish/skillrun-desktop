# T002 Evidence Summary

**Task ID**：T002
**Status**：Accepted
**Executor**：Codex direct execute fallback
**Branch/worktree**：`main` in `D:\data\skillrun-desktop`
**Packet**：`.ai-platform/specs/001-desktop-alpha/packets/T002.yaml`

## Direct Execute Reason

The user asked to review, commit locally, and continue. Sub-agent delegation was not explicitly authorized, so direct execute fallback was used for T002.

## Files Changed

- `.ai-platform/specs/001-desktop-alpha/packets/T002.yaml`
- `.ai-platform/specs/001-desktop-alpha/tasks.md`
- `.ai-platform/docs/tasks.md`
- `.ai-platform/docs/release-report.md`
- `src/core/errors.ts`
- `src/core/errors.test.ts`
- `src/core/runner.ts`
- `src/core/runner.test.ts`
- `src-tauri/src/lib.rs`

## Implementation Summary

- Added typed Core runner errors for spawn failure, non-zero exit, JSON parse failure, contract mismatch, `ok=false`, and stale refresh.
- Added `runSkillrunJson` with args-array command metadata, stdout-only JSON parsing, optional schema validation, optional freshness guard, duration, stdout, stderr, and exit code reporting.
- Added `createTauriCommandExecutor()` so the frontend runner can call the native Tauri command bridge.
- Added Rust `run_skillrun` command using `std::process::Command`, argument arrays, optional cwd, and no shell interpolation.

## TDD Evidence

- RED captured: `npm test -- src/core --run` failed because `src/core/errors` did not exist.
- GREEN captured: `npm test -- src/core --run` passed with 2 files and 9 tests.

## Runner Safety Review

- The command is represented as `{ command: "skillrun", args: string[], cwd?: string }`.
- The Rust bridge uses `Command::new("skillrun")` plus `.args(args)`, not a shell command string.
- The runner parses JSON only from stdout; stderr remains diagnostic metadata.
- Non-zero exit is never treated as valid JSON state.

## Spec Compliance Review

- `US-001`, `FR-001`, `FR-003`, `FR-004`, and `NFR-003` are covered at runner layer.
- T002 did not implement broad Core DTO parsers, import flow, tray status, mount manager, exposure preview, or run explorer.
- A small scope expansion to `src-tauri/src/lib.rs` was necessary because Tauri frontend code cannot use Node `child_process` at runtime.

## Bug / Code Quality Review

No blocking finding in self-review. The main architecture correction was adding the Tauri command bridge instead of leaving an injectable-only runner.

## Residual Risk

- The Rust bridge is compile-verified but not manually exercised against a packaged desktop app in this task.
- T003 still needs concrete DTO/parser fixtures for every Desktop-facing Core JSON contract.

## User Acceptance Status

Accepted by user on 2026-05-18 after request to review, commit locally, and continue.
