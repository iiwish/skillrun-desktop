import { describe, expect, it } from "vitest";
import inventoryFixture from "../core/fixtures/consumer-inventory.v1.json";
import exposureFixture from "../core/fixtures/consumer-exposure.v1.json";
import type { CommandExecutor } from "../core/runner";
import {
  applySwitchboardAction,
  buildSwitchboardState,
} from "./switchboard";

describe("switchboard state", () => {
  it("labels enabled capsules as exposure intent only", () => {
    const state = buildSwitchboardState({
      inventory: inventoryWithCapsule({ enabled: true }),
      exposure: exposureFixture,
    });

    expect(state.capsules[0].exposureLabel).toBe("Exposure intent allowed");
    expect(state.capsules[0].exposureLabel.toLowerCase()).not.toMatch(/trusted|safe|sandbox|runnable/);
    expect(state.safetyCopy).toContain("not trust, safety, sandboxing, or business correctness");
  });

  it("does not describe readiness failures as runnable or enableable", () => {
    const state = buildSwitchboardState({
      inventory: inventoryWithCapsule({
        readiness: {
          ok: false,
          status: "missing_dependencies",
          next_step: "Run skillrun check from the capsule detail.",
        },
      }),
      exposure: { ...exposureFixture, tools: [] },
    });

    expect(state.capsules[0].readinessLabel).toBe("Not ready");
    expect(state.capsules[0].readinessLabel.toLowerCase()).not.toContain("runnable");
    expect(state.capsules[0].canEnable).toBe(false);
  });

  it("requires confirmation before enabling an imported disabled capsule", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const capsule = buildSwitchboardState({
      inventory: inventoryFixture,
      exposure: { ...exposureFixture, tools: [] },
    }).capsules[0];

    const result = await applySwitchboardAction({
      action: "enable",
      capsule,
      confirmed: false,
      executor: async (request) => {
        calls.push(request);
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    });

    expect(result.status).toBe("confirmation_required");
    expect(calls).toHaveLength(0);
  });

  it("enables through Core and then refreshes inventory and exposure", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const capsule = buildSwitchboardState({
      inventory: inventoryFixture,
      exposure: { ...exposureFixture, tools: [] },
    }).capsules[0];
    const executor = switchboardExecutor(calls, {
      inventory: inventoryWithCapsule({ enabled: true }),
      exposure: exposureFixture,
    });

    const result = await applySwitchboardAction({
      action: "enable",
      capsule,
      confirmed: true,
      executor,
      cwd: "D:\\data\\skillrun-desktop",
      now: () => 100,
    });

    expect(calls.map((call) => call.args)).toEqual([
      ["switchboard", "enable", "refund-helper"],
      ["consumer", "inventory", "--json"],
      ["consumer", "exposure", "--json"],
    ]);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.state.capsules[0].enabled).toBe(true);
      expect(result.state.exposureTools).toHaveLength(1);
    }
  });

  it("surfaces Core enable failure without guessing repair", async () => {
    const capsule = buildSwitchboardState({
      inventory: inventoryFixture,
      exposure: { ...exposureFixture, tools: [] },
    }).capsules[0];

    const result = await applySwitchboardAction({
      action: "enable",
      capsule,
      confirmed: true,
      executor: async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "readiness failed",
      }),
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.kind).toBe("non_zero_exit");
      expect(result.error.message).toContain("skillrun switchboard enable refund-helper");
      expect(result.error.message.toLowerCase()).not.toMatch(/install|fix|repair/);
    }
  });

  it("disables through Core and then refreshes inventory and exposure", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const capsule = buildSwitchboardState({
      inventory: inventoryWithCapsule({ enabled: true }),
      exposure: exposureFixture,
    }).capsules[0];
    const executor = switchboardExecutor(calls, {
      inventory: inventoryWithCapsule({ enabled: false }),
      exposure: { ...exposureFixture, tools: [] },
    });

    const result = await applySwitchboardAction({
      action: "disable",
      capsule,
      confirmed: false,
      executor,
    });

    expect(calls.map((call) => call.args)).toEqual([
      ["switchboard", "disable", "refund-helper"],
      ["consumer", "inventory", "--json"],
      ["consumer", "exposure", "--json"],
    ]);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.state.capsules[0].enabled).toBe(false);
      expect(result.state.exposureTools).toHaveLength(0);
    }
  });
});

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

function switchboardExecutor(
  calls: Parameters<CommandExecutor>[0][],
  refreshed: { inventory: unknown; exposure: unknown },
): CommandExecutor {
  return async (request) => {
    calls.push(request);
    const args = request.args.join(" ");
    if (args === "switchboard enable refund-helper") {
      return { exitCode: 0, stdout: "enabled refund-helper", stderr: "" };
    }
    if (args === "switchboard disable refund-helper") {
      return { exitCode: 0, stdout: "disabled refund-helper", stderr: "" };
    }
    if (args === "consumer inventory --json") {
      return { exitCode: 0, stdout: JSON.stringify(refreshed.inventory), stderr: "" };
    }
    if (args === "consumer exposure --json") {
      return { exitCode: 0, stdout: JSON.stringify(refreshed.exposure), stderr: "" };
    }
    return { exitCode: 1, stdout: "", stderr: `unexpected command: ${args}` };
  };
}
