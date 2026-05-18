import { describe, expect, it } from "vitest";
import exposureFixture from "../core/fixtures/consumer-exposure.v1.json";
import routerDryRunFixture from "../core/fixtures/router-dry-run.v1.json";
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
        dryRun: routerDryRunFixture,
      }),
      cwd: "D:\\data\\skillrun-desktop",
      now: () => 100,
    });

    expect(calls.map((call) => call.args)).toEqual([
      ["consumer", "exposure", "--json"],
      ["router", "serve", "--mcp", "--dry-run"],
    ]);
    expect(calls.some((call) => call.args.join(" ") === "router serve --mcp")).toBe(false);
    expect(result.status).toBe("ready");
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
      dryRun: routerDryRunFixture,
    });

    expect(state.exposedTools).toHaveLength(0);
    expect(state.emptyReason).toBe("disabled_or_not_ready");
  });

  it("maps router resources as metadata only", () => {
    const state = buildExposurePreviewState({
      exposure: exposureFixture,
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
    expect(JSON.stringify(state.resources)).not.toContain("hidden content");
    expect(JSON.stringify(state.resources)).not.toContain("should_not");
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
  contracts: { exposure: unknown; dryRun: unknown },
): CommandExecutor {
  return async (request) => {
    calls.push(request);
    const args = request.args.join(" ");
    if (args === "consumer exposure --json") {
      return { exitCode: 0, stdout: JSON.stringify(contracts.exposure), stderr: "" };
    }
    if (args === "router serve --mcp --dry-run") {
      return { exitCode: 0, stdout: JSON.stringify(contracts.dryRun), stderr: "" };
    }
    return { exitCode: 1, stdout: "", stderr: `unexpected command: ${args}` };
  };
}
