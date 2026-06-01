import { describe, expect, it } from "vitest";
import exposureFixture from "../core/fixtures/consumer-exposure.v1.json";
import routerDryRunFixture from "../core/fixtures/router-dry-run.v1.json";
import routerStatusFixture from "../core/fixtures/router-status.v1.json";
import type { CommandExecutor } from "../core/runner";
import {
  buildExposurePreviewState,
  loadExposurePreview,
} from "./exposure";

describe("exposure preview", () => {
  it("loads consumer exposure and router dry-run without starting a long-running router", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const result = await loadExposurePreview({
      executor: exposureExecutor(calls, {
        exposure: exposureFixture,
        routerStatus: routerStatusFixture,
        dryRun: routerDryRunFixture,
      }),
      cwd: "D:\\data\\skillrun-desktop",
      now: () => 100,
    });

    expect(calls.map((call) => call.args)).toEqual([
      ["consumer", "exposure", "--json"],
      ["router", "status", "--json"],
      ["router", "serve", "--mcp", "--dry-run"],
    ]);
    expect(calls.some((call) => call.args.join(" ") === "router serve --mcp")).toBe(false);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.state.routerRoutes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            capsuleId: "meeting_action_brief",
            state: "routable",
            readinessStatus: "ok",
          }),
        ]),
      );
      expect(result.state.routerStatus.routeCount).toBe(1);
      expect(result.state.routerStatus.routableCount).toBe(1);
    }
  });

  it("filters disabled and not-ready tools out of the exposed display", () => {
    const state = buildExposurePreviewState({
      exposure: {
        ...exposureFixture,
        tools: [
          {
            capsule_id: "ready-capsule",
            tool_name: "ready_tool",
            enabled: true,
            exposed: true,
            readiness_status: "ok",
            manifest_hash: "ready-hash",
          },
          {
            capsule_id: "disabled-capsule",
            tool_name: "disabled_tool",
            enabled: false,
            exposed: false,
            readiness_status: "ok",
            manifest_hash: "disabled-hash",
          },
          {
            capsule_id: "not-ready-capsule",
            tool_name: "not_ready_tool",
            enabled: true,
            exposed: false,
            readiness_status: "missing_dependencies",
            manifest_hash: "not-ready-hash",
          },
        ],
      },
      routerStatus: routerStatusFixture,
      dryRun: routerDryRunFixture,
    });

    expect(state.exposedTools.map((tool) => tool.toolName)).toEqual(["ready_tool"]);
    expect(state.filteredToolCount).toBe(2);
    expect(state.emptyReason).toBeUndefined();
  });

  it("returns an empty state when all exposure entries are disabled or not ready", () => {
    const state = buildExposurePreviewState({
      exposure: {
        ...exposureFixture,
        tools: [
          {
            capsule_id: "not-ready-capsule",
            tool_name: "not_ready_tool",
            enabled: true,
            exposed: false,
            readiness_status: "missing_dependencies",
            manifest_hash: "not-ready-hash",
          },
        ],
      },
      routerStatus: routerStatusFixture,
      dryRun: routerDryRunFixture,
    });

    expect(state.exposedTools).toHaveLength(0);
    expect(state.emptyReason).toBe("disabled_or_not_ready");
  });

  it("maps router resources as metadata only", () => {
    const state = buildExposurePreviewState({
      exposure: exposureFixture,
      routerStatus: {
        ...routerStatusFixture,
        ok: false,
        error: { code: "duplicate-tool-name", message: "duplicate MCP tool name refund" },
      },
      dryRun: {
        ...routerDryRunFixture,
        resources: [
          {
            name: "Run Evidence",
            uri: "skillrun://runs/latest",
            mime_type: "application/json",
            text: "hidden content",
            content: { should_not: "leak" },
          },
        ],
      },
    });

    expect(state.resources).toEqual([
      {
        name: "Run Evidence",
        uri: "skillrun://runs/latest",
        mimeType: "application/json",
      },
    ]);
    expect(state.routerStatus.ok).toBe(false);
    expect(state.routerStatus.errorCode).toBe("duplicate-tool-name");
    expect(JSON.stringify(state.resources)).not.toContain("hidden content");
    expect(JSON.stringify(state.resources)).not.toContain("should_not");
  });

  it("maps Router route issues and recovery actions without reading Core internals", () => {
    const state = buildExposurePreviewState({
      exposure: exposureFixture,
      routerStatus: {
        ok: true,
        router: { snapshot: true, capsules: 1 },
        tools: [],
        resources: [],
        routes: [
          {
            capsule_id: "meeting_action_brief",
            capsule_path: "/tmp/skillrun/capsules/meeting_action_brief",
            enabled: true,
            state: "blocked",
            readiness_status: "missing_dependency",
            readiness_reason: "python not found",
            issue: {
              code: "capsule-not-ready",
              severity: "warning",
              message: "Capsule is enabled but not ready.",
              capsule_id: "meeting_action_brief",
              tool_name: "meeting_action_brief",
              recommended_action: "Install the required runtime, then refresh Router status.",
            },
            recommended_action: "Install the required runtime, then refresh Router status.",
          },
        ],
        issues: [
          {
            code: "capsule-not-ready",
            severity: "warning",
            message: "Capsule is enabled but not ready.",
            capsule_id: "meeting_action_brief",
            tool_name: "meeting_action_brief",
            recommended_action: "Install the required runtime, then refresh Router status.",
          },
        ],
        error: null,
      },
      dryRun: routerDryRunFixture,
    });

    expect(state.routerRoutes).toEqual([
      expect.objectContaining({
        capsuleId: "meeting_action_brief",
        state: "blocked",
        readinessStatus: "missing_dependency",
        readinessReason: "python not found",
        issue: expect.objectContaining({
          code: "capsule-not-ready",
          severity: "warning",
          recommendedAction: "Install the required runtime, then refresh Router status.",
        }),
      }),
    ]);
    expect(state.routerStatus.blockedCount).toBe(1);
    expect(state.routerStatus.warningCount).toBe(1);
    expect(JSON.stringify(state.routerRoutes)).not.toContain(".skillrun");
  });

  it("keeps structured Router diagnostics when Core exits non-zero", async () => {
    const routerIssue = {
      code: "duplicate-tool-name",
      severity: "error",
      message: "duplicate MCP tool name meeting_action_brief",
      capsule_id: "meeting_action_brief",
      tool_name: "meeting_action_brief",
      recommended_action: "Disable one duplicate capsule, then refresh Router status.",
    };
    const statusJson = {
      command: "router status",
      schema_version: "router.status.v1",
      ok: false,
      router: { snapshot: true, capsules: 1 },
      tools: [],
      resources: [],
      routes: [
        {
          capsule_id: "meeting_action_brief",
          capsule_path: "/tmp/skillrun/capsules/meeting_action_brief",
          enabled: true,
          state: "blocked",
          readiness_status: "duplicate_tool_name",
          tool_name: "meeting_action_brief",
          issue: routerIssue,
          recommended_action: "Disable one duplicate capsule, then refresh Router status.",
        },
      ],
      issues: [routerIssue],
      error: { code: "duplicate-tool-name", message: "duplicate MCP tool name meeting_action_brief" },
    };
    const dryRunJson = {
      command: "router serve --mcp --dry-run",
      schema_version: "router.mcp.v1",
      ok: false,
      mcp: { dry_run: true, protocol: "model-context-protocol", transport: "stdio" },
      router: { snapshot: true, capsules: 1 },
      tools: [],
      resources: [],
      routes: statusJson.routes,
      issues: [routerIssue],
      error: statusJson.error,
    };

    const result = await loadExposurePreview({
      executor: async (request) => {
        const args = request.args.join(" ");
        if (args === "consumer exposure --json") {
          return { exitCode: 0, stdout: JSON.stringify(exposureFixture), stderr: "" };
        }
        if (args === "router status --json") {
          return { exitCode: 1, stdout: JSON.stringify(statusJson), stderr: "" };
        }
        if (args === "router serve --mcp --dry-run") {
          return { exitCode: 1, stdout: JSON.stringify(dryRunJson), stderr: "" };
        }
        return { exitCode: 1, stdout: "", stderr: `unexpected command: ${args}` };
      },
    });

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.state.routerStatus.ok).toBe(false);
      expect(result.state.routerStatus.errorCode).toBe("duplicate-tool-name");
      expect(result.state.routerStatus.errorCount).toBe(1);
      expect(result.state.routerRoutes[0]).toEqual(
        expect.objectContaining({
          state: "blocked",
          issue: expect.objectContaining({ code: "duplicate-tool-name" }),
        }),
      );
    }
  });

  it("surfaces Core errors without guessing filesystem repair", async () => {
    const result = await loadExposurePreview({
      executor: async (request) => {
        if (request.args.join(" ") === "consumer exposure --json") {
          return { exitCode: 1, stdout: "", stderr: "registry unavailable" };
        }
        return { exitCode: 0, stdout: JSON.stringify(routerDryRunFixture), stderr: "" };
      },
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.kind).toBe("non_zero_exit");
      expect(result.error.message).toContain("skillrun consumer exposure --json");
      expect(result.error.message.toLowerCase()).not.toMatch(/scan|read|repair|fix/);
    }
  });
});

function exposureExecutor(
  calls: Parameters<CommandExecutor>[0][],
  contracts: { exposure: unknown; routerStatus: unknown; dryRun: unknown },
): CommandExecutor {
  return async (request) => {
    calls.push(request);
    const args = request.args.join(" ");
    if (args === "consumer exposure --json") {
      return { exitCode: 0, stdout: JSON.stringify(contracts.exposure), stderr: "" };
    }
    if (args === "router status --json") {
      return { exitCode: 0, stdout: JSON.stringify(contracts.routerStatus), stderr: "" };
    }
    if (args === "router serve --mcp --dry-run") {
      return { exitCode: 0, stdout: JSON.stringify(contracts.dryRun), stderr: "" };
    }
    return { exitCode: 1, stdout: "", stderr: `unexpected command: ${args}` };
  };
}
