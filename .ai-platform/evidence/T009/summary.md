# T009 Evidence Summary

**Task ID**：T009
**Status**：Accepted
**Executor**：Codex direct execute fallback
**Branch/worktree**：`main` in `D:\data\skillrun-desktop`
**Packet**：`.ai-platform/specs/001-desktop-alpha/packets/T009.yaml`

## Direct Execute Reason

The user asked to review, commit locally, and continue. Sub-agent delegation was not explicitly authorized for this turn, so direct execute fallback was used for T009.

## Files Changed

- `.ai-platform/specs/001-desktop-alpha/packets/T009.yaml`
- `.ai-platform/specs/001-desktop-alpha/tasks.md`
- `.ai-platform/docs/tasks.md`
- `.ai-platform/docs/release-report.md`
- `.ai-platform/evidence/T009/summary.md`
- `.ai-platform/evidence/T009/test-results.md`
- `.ai-platform/evidence/T009/diff.patch`
- `src/core/runsService.ts`
- `src/state/runs.ts`
- `src/state/runs.test.ts`
- `src/views/EnvelopeExplorer/EnvelopeExplorer.tsx`
- `src/views/EnvelopeExplorer/index.ts`

## Implementation Summary

- Added runs service for Core JSON runs list and runs inspect commands.
- Added runs list state for run id, capsule id, mode, status, error code, duration, hashes, artifact count, and input inclusion flag.
- Added safe run detail state for input/log availability, envelope key summary, warnings, hashes, and artifact metadata.
- Added inspect ok=false handling that surfaces Core error code and matches.
- Added presentational EnvelopeExplorer view for run list and safe detail summary.

## TDD Evidence

- RED captured: `npm test -- src/state/runs.test.ts --run` failed because `./runs` did not exist.
- GREEN captured: `npm test -- src/state/runs.test.ts --run` passed with 4 tests.

## Safe Inspect Review

- List command args support `consumer runs list --json --capsule CAPSULE_ID --limit LIMIT`.
- Inspect command args support `consumer runs inspect RUN_ID --json --capsule CAPSULE_ID`.
- Inspect state maps only safe summaries and metadata.
- Inspect ok=false returns `ok_false`, Core error code, and Core matches.
- Implementation does not directly read `.skillrun/runs`, `record.json`, logs, inputs, or artifacts.

## Content Exclusion Review

- Tests inject full input, envelope output text, artifact content, stdout content, and stderr content.
- State output excludes all injected content values.
- Artifact output is limited to `name`, `kind`, `path`, and `available`.
- Envelope value output is limited to type and top-level keys.

## Spec Compliance Review

- `US-006`, `FR-010`, `FR-011`, `NFR-001`, and `NFR-003` are covered at service/state/view component layer.
- T009 did not wire global dashboard navigation because `App.tsx` is outside the approved T009 write scope.

## Bug/Code Quality Review

- No blocking issues found in the reviewed diff.
- Core calls are dependency-injected and covered by unit tests.
- Safe summaries preserve evidence usefulness without displaying sensitive content.

## QA Acceptance Review

- The future dashboard can list runs, inspect safe run summaries, show input/log availability, and display artifact metadata.
- View-level integration is intentionally deferred to a later dashboard wiring task.

## Residual Risk

- The EnvelopeExplorer component is not yet connected to the dashboard shell.
- Envelope value summarization currently exposes only top-level keys, not deeper structured value summaries.

## User Acceptance Status

Accepted by user on 2026-05-18 after review request.
