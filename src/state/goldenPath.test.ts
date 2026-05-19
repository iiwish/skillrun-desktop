import { describe, expect, it } from "vitest";
import exposureFixture from "../core/fixtures/consumer-exposure.v1.json";
import importFixture from "../core/fixtures/import.v1.json";
import inventoryFixture from "../core/fixtures/consumer-inventory.v1.json";
import mountApplyFixture from "../core/fixtures/consumer-mount-apply.v1.json";
import mountPlanFixture from "../core/fixtures/consumer-mount-plan.v1.json";
import routerDryRunFixture from "../core/fixtures/router-dry-run.v1.json";
import runsInspectFixture from "../core/fixtures/consumer-runs-inspect.v1.json";
import runsListFixture from "../core/fixtures/consumer-runs-list.v1.json";
import type { CommandExecutor } from "../core/runner";
import { runDesktopAlphaGoldenPath } from "./goldenPath";

describe("desktop alpha golden path", () => {
  it("verifies the tray-first .skr path with traceable Core command metadata", async () => {
    const result = await runDesktopAlphaGoldenPath({
      packagePath: "D:/packages/refund-helper.skr",
      capsuleId: "refund-helper",
      runId: "run-001",
      executor: goldenPathExecutor(),
      cwd: "D:\\data\\skillrun-desktop",
      now: () => 100,
    });

    expect(result.status).toBe("ready");
    expect(result.importedCapsuleId).toBe("refund-helper");
    expect(result.enableConfirmation.status).toBe("confirmation_required");
    expect(result.mountApplyConfirmation.status).toBe("confirmation_required");
    expect(result.trayStatus.kind).toBe("tools_exposed");
    expect(result.exposure.exposedTools.map((tool) => tool.toolName)).toEqual(["refund_helper"]);
    expect(result.mount.applied).toBe(true);
    expect(result.runs.runs.map((run) => run.runId)).toEqual(["run-001"]);
    expect(result.runDetail.runId).toBe("run-001");

    expect(result.commandTrace.map((entry) => entry.args)).toEqual([
      ["import", "D:/packages/refund-helper.skr", "--json"],
      ["consumer", "inventory", "--json"],
      ["consumer", "exposure", "--json"],
      ["switchboard", "enable", "refund-helper"],
      ["consumer", "inventory", "--json"],
      ["consumer", "exposure", "--json"],
      ["consumer", "exposure", "--json"],
      ["router", "serve", "--mcp", "--dry-run"],
      ["consumer", "mount", "plan", "--client", "claude-desktop", "--json"],
      ["consumer", "mount", "apply", "--client", "claude-desktop", "--json"],
      ["consumer", "runs", "list", "--json", "--capsule", "refund-helper", "--limit", "5"],
      ["consumer", "runs", "inspect", "run-001", "--json", "--capsule", "refund-helper"],
    ]);
  });

  it("blocks alpha non-goals and excludes sensitive run content from verification output", async () => {
    const result = await runDesktopAlphaGoldenPath({
      packagePath: "D:/packages/refund-helper.skr",
      capsuleId: "refund-helper",
      runId: "run-001",
      executor: goldenPathExecutor(),
    });
    const serialized = JSON.stringify(result);

    expect(result.commandTrace.some((entry) => entry.args.join(" ") === "router serve --mcp")).toBe(false);
    expect(result.nonGoalCommands).toEqual([]);
    expect(result.runDetail.artifacts).toEqual([
      {
        name: "report.json",
        kind: "json",
        path: "D:/runs/refund-helper/run-001/report.json",
        available: true,
      },
    ]);
    expect(serialized).not.toContain("do-not-show-input");
    expect(serialized).not.toContain("do-not-show-envelope");
    expect(serialized).not.toContain("do-not-show-artifact");
    expect(serialized).not.toContain("do-not-show-stdout");
    expect(serialized).not.toContain("do-not-show-stderr");
  });
});

function goldenPathExecutor(): CommandExecutor {
  let enabled = false;

  return async (request) => {
    const args = request.args.join(" ");

    if (args === "import D:/packages/refund-helper.skr --json") {
      return json(importFixture);
    }
    if (args === "consumer inventory --json") {
      return json(enabled ? inventoryWithCapsule({ enabled: true }) : inventoryFixture);
    }
    if (args === "consumer exposure --json") {
      return json(enabled ? exposureFixture : { ...exposureFixture, tools: [] });
    }
    if (args === "switchboard enable refund-helper") {
      enabled = true;
      return { exitCode: 0, stdout: "enabled refund-helper", stderr: "" };
    }
    if (args === "router serve --mcp --dry-run") {
      return json({
        ...routerDryRunFixture,
        router: {
          ...routerDryRunFixture.router,
          capsules: 1,
        },
        tools: [
          {
            capsule_id: "refund-helper",
            name: "refund_helper",
          },
        ],
      });
    }
    if (args === "consumer mount plan --client claude-desktop --json") {
      return json(mountPlanFixture);
    }
    if (args === "consumer mount apply --client claude-desktop --json") {
      return json(mountApplyFixture);
    }
    if (args === "consumer runs list --json --capsule refund-helper --limit 5") {
      return json({
        ...runsListFixture,
        scope: {
          kind: "capsule",
          capsule_id: "refund-helper",
        },
        runs: [
          {
            run_id: "run-001",
            capsule_id: "refund-helper",
            mode: "run",
            status: "ok",
            ok: true,
            started_at: "2026-05-18T00:00:00Z",
            finished_at: "2026-05-18T00:00:01Z",
            duration_ms: 1000,
            manifest_sha256: "manifest-hash",
            skill_sha256: "skill-hash",
            action_sha256: "action-hash",
            artifact_count: 1,
            input_included: false,
          },
        ],
      });
    }
    if (args === "consumer runs inspect run-001 --json --capsule refund-helper") {
      return json({
        ...runsInspectFixture,
        input: {
          included: false,
          available: true,
          value: "do-not-show-input",
        },
        envelope: {
          included: true,
          status: "ok",
          value: {
            result: "do-not-show-envelope",
          },
        },
        artifacts: [
          {
            name: "report.json",
            kind: "json",
            path: "D:/runs/refund-helper/run-001/report.json",
            available: true,
            content: "do-not-show-artifact",
          },
        ],
        logs: {
          stdout_available: true,
          stderr_available: true,
          stdout_included: false,
          stderr_included: false,
          stdout: "do-not-show-stdout",
          stderr: "do-not-show-stderr",
        },
      });
    }

    return { exitCode: 1, stdout: "", stderr: `unexpected command: ${args}` };
  };
}

function inventoryWithCapsule(overrides: Record<string, unknown>) {
  return {
    ...inventoryFixture,
    capsules: [
      {
        ...inventoryFixture.capsules[0],
        ...overrides,
      },
    ],
  };
}

function json(data: unknown) {
  return {
    exitCode: 0,
    stdout: JSON.stringify(data),
    stderr: "",
  };
}
