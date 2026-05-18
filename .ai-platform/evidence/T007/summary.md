# T007 Evidence Summary

**Task ID**：T007
**Status**：Accepted
**Executor**：Codex direct execute fallback
**Branch/worktree**：`main` in `D:\data\skillrun-desktop`
**Packet**：`.ai-platform/specs/001-desktop-alpha/packets/T007.yaml`

## Direct Execute Reason

The user asked to review, commit locally, and continue. Sub-agent delegation was not explicitly authorized for this turn, so direct execute fallback was used for T007.

## Files Changed

- `.ai-platform/specs/001-desktop-alpha/packets/T007.yaml`
- `.ai-platform/specs/001-desktop-alpha/tasks.md`
- `.ai-platform/docs/tasks.md`
- `.ai-platform/docs/release-report.md`
- `.ai-platform/evidence/T007/summary.md`
- `.ai-platform/evidence/T007/test-results.md`
- `.ai-platform/evidence/T007/diff.patch`
- `src/core/exposureService.ts`
- `src/state/exposure.ts`
- `src/state/exposure.test.ts`
- `src/views/ExposurePreview/ExposurePreview.tsx`
- `src/views/ExposurePreview/index.ts`

## Implementation Summary

- Added exposure service that calls `skillrun consumer exposure --json`.
- Added router dry-run snapshot call with args exactly `router serve --mcp --dry-run`.
- Added exposure state mapping that filters disabled or not-ready entries from exposed tools.
- Added router dry-run metadata model for transport, protocol, capsule count, tool count, resource count, and resource metadata.
- Added presentational ExposurePreview view with exposed tools, dry-run summary, resource metadata, empty, and error states.

## TDD Evidence

- RED captured: `npm test -- src/state/exposure.test.ts --run` failed because `./exposure` did not exist.
- GREEN captured: `npm test -- src/state/exposure.test.ts --run` passed with 5 tests.

## Router Dry-Run Safety Review

- The service calls `["router", "serve", "--mcp", "--dry-run"]`.
- Tests assert no call is made with args exactly `["router", "serve", "--mcp"]`.
- Implementation does not start a long-running Router process.
- Implementation does not read `.skillrun`, registry, manifest, capsule files, MCP text content, or artifacts.

## Metadata-Only Resource Review

- Router resources are mapped only to `name`, `uri`, and `mimeType`.
- Tests include `text` and `content` fields in a fixture-like resource and assert they do not leak into state output.

## Copy Review Notes

The safety copy states that preview shows Core-reported tool metadata only and that exposed does not mean sandboxed, trusted, or safe.

## Spec Compliance Review

- `US-004`, `FR-008`, `FR-011`, and `NFR-003` are covered at service/state/view component layer.
- Disabled and not-ready entries are filtered out of the exposed display.
- T007 did not wire global dashboard navigation because `App.tsx` is outside the approved T007 write scope.

## Bug/Code Quality Review

- No blocking issues found in the reviewed diff.
- Core calls are dependency-injected and covered by unit tests.
- Error state preserves Core runner error kind/message without guessing filesystem repair.

## QA Acceptance Review

- The future dashboard can preview current exposed tools and Router dry-run metadata before mount.
- View-level integration is intentionally deferred to a later dashboard wiring task.

## Residual Risk

- The ExposurePreview component is not yet connected to the dashboard shell.
- Resource metadata shape beyond `name`, `uri`, and `mime_type` is intentionally ignored until Core documents more fields.

## User Acceptance Status

Accepted by user on 2026-05-18 after request to review, commit locally, and continue.
