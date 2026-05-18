import { describe, expect, it } from "vitest";
import mountPlanFixture from "../core/fixtures/consumer-mount-plan.v1.json";
import mountApplyFixture from "../core/fixtures/consumer-mount-apply.v1.json";
import mountRollbackFixture from "../core/fixtures/consumer-mount-rollback.v1.json";
import type {
  MountApplyContract,
  MountPlanContract,
  MountRollbackContract,
} from "../core/contracts";
import type { CommandExecutor } from "../core/runner";
import {
  applyMount,
  buildMountManagerState,
  loadMountPlan,
  rollbackMount,
} from "./mountManager";

const mountPlanContract = mountPlanFixture as MountPlanContract;
const mountApplyContract = mountApplyFixture as MountApplyContract;
const mountRollbackContract = mountRollbackFixture as MountRollbackContract;

describe("mount manager state", () => {
  it("loads a mount plan through Core and preserves warnings", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const planWithWarning = {
      ...mountPlanContract,
      warnings: ["config file will be created"],
    };

    const result = await loadMountPlan({
      clientId: "claude-desktop",
      executor: mountExecutor(calls, { plan: planWithWarning }),
      cwd: "D:\\data\\skillrun-desktop",
      now: () => 100,
    });

    expect(calls.map((call) => call.args)).toEqual([
      ["consumer", "mount", "plan", "--client", "claude-desktop", "--json"],
    ]);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.state.warnings).toEqual(["config file will be created"]);
      expect(result.state.canApply).toBe(true);
    }
  });

  it("blocks apply before a plan exists", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const result = await applyMount({
      state: undefined,
      confirmed: true,
      executor: async (request) => {
        calls.push(request);
        return { exitCode: 0, stdout: JSON.stringify(mountApplyContract), stderr: "" };
      },
    });

    expect(result.status).toBe("error");
    expect(calls).toHaveLength(0);
  });

  it("requires confirmation before apply", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const state = buildMountManagerState({ plan: mountPlanContract });

    const result = await applyMount({
      state,
      confirmed: false,
      executor: async (request) => {
        calls.push(request);
        return { exitCode: 0, stdout: JSON.stringify(mountApplyContract), stderr: "" };
      },
    });

    expect(result.status).toBe("confirmation_required");
    expect(calls).toHaveLength(0);
  });

  it("applies Claude Desktop mount through Core after confirmation", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const state = buildMountManagerState({ plan: mountPlanContract });

    const result = await applyMount({
      state,
      confirmed: true,
      executor: mountExecutor(calls, { apply: mountApplyContract }),
    });

    expect(calls.map((call) => call.args)).toEqual([
      ["consumer", "mount", "apply", "--client", "claude-desktop", "--json"],
    ]);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.state.applied).toBe(true);
      expect(result.state.rollbackBackupPath).toBe(mountApplyContract.backup?.path);
    }
  });

  it("keeps unsupported or non-Claude clients plan-only", () => {
    const state = buildMountManagerState({
      plan: {
        ...mountPlanContract,
        client: {
          ...mountPlanContract.client,
          id: "cursor",
          name: "Cursor",
          supported: true,
        },
      },
    });

    expect(state.mode).toBe("plan_only");
    expect(state.canApply).toBe(false);
    expect(state.canRollback).toBe(false);
  });

  it("rolls back only with the Core-returned backup path", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const state = buildMountManagerState({
      plan: mountPlanContract,
      apply: mountApplyContract,
    });

    const result = await rollbackMount({
      state,
      confirmed: true,
      requestedBackupPath: "D:\\fake\\backup.json",
      executor: mountExecutor(calls, { rollback: mountRollbackContract }),
    });

    expect(calls.map((call) => call.args)).toEqual([
      [
        "consumer",
        "mount",
        "rollback",
        "--client",
        "claude-desktop",
        "--backup",
        mountApplyContract.backup?.path,
        "--json",
      ],
    ]);
    expect(result.status).toBe("ready");
  });

  it("requires confirmation before rollback", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const state = buildMountManagerState({
      plan: mountPlanContract,
      apply: mountApplyContract,
    });

    const result = await rollbackMount({
      state,
      confirmed: false,
      executor: async (request) => {
        calls.push(request);
        return { exitCode: 0, stdout: JSON.stringify(mountRollbackContract), stderr: "" };
      },
    });

    expect(result.status).toBe("confirmation_required");
    expect(calls).toHaveLength(0);
  });
});

function mountExecutor(
  calls: Parameters<CommandExecutor>[0][],
  contracts: { plan?: unknown; apply?: unknown; rollback?: unknown },
): CommandExecutor {
  return async (request) => {
    calls.push(request);
    const args = request.args.join(" ");
    if (args === "consumer mount plan --client claude-desktop --json") {
      return { exitCode: 0, stdout: JSON.stringify(contracts.plan), stderr: "" };
    }
    if (args === "consumer mount apply --client claude-desktop --json") {
      return { exitCode: 0, stdout: JSON.stringify(contracts.apply), stderr: "" };
    }
    if (
      args ===
      `consumer mount rollback --client claude-desktop --backup ${mountApplyContract.backup?.path} --json`
    ) {
      return { exitCode: 0, stdout: JSON.stringify(contracts.rollback), stderr: "" };
    }
    return { exitCode: 1, stdout: "", stderr: `unexpected command: ${args}` };
  };
}
