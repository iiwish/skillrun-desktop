import { describe, expect, it } from "vitest";
import { refreshDashboardStatus } from "./dashboardService";
import type { CommandExecutor } from "./runner";
import hostStatusFixture from "./fixtures/host-status.v1.json";
import inventoryFixture from "./fixtures/consumer-inventory.v1.json";
import exposureFixture from "./fixtures/consumer-exposure.v1.json";
import mountPlanFixture from "./fixtures/consumer-mount-plan.v1.json";
import runsListFixture from "./fixtures/consumer-runs-list.v1.json";

describe("refreshDashboardStatus", () => {
  it("returns core_missing when skillrun cannot be spawned", async () => {
    const executor: CommandExecutor = async () => {
      throw new Error("ENOENT");
    };

    const snapshot = await refreshDashboardStatus({
      executor,
      now: () => 10,
      nowMs: () => 1_000,
    });

    expect(snapshot.status.kind).toBe("core_missing");
    expect(snapshot.status.source.command).toBe("host status --json");
    expect(snapshot.commands).toHaveLength(1);
    expect(snapshot.commands[0]).toMatchObject({
      displayCommand: "skillrun host status --json",
      status: "error",
      errorKind: "spawn_failure",
    });
  });

  it("builds a traceable status from Core JSON commands", async () => {
    const executed: string[] = [];
    const executor = fixtureExecutor(executed);

    const snapshot = await refreshDashboardStatus({
      executor,
      now: () => 10,
      nowMs: () => 1_000,
    });

    expect(snapshot.status.kind).toBe("mount_not_configured");
    expect(snapshot.status.source.command).toBe(
      "consumer mount plan --client claude-desktop --json",
    );
    expect(snapshot.commands.map((command) => command.displayCommand)).toEqual([
      "skillrun host status --json",
      "skillrun consumer inventory --json",
      "skillrun consumer exposure --json",
      "skillrun consumer mount plan --client claude-desktop --json",
      "skillrun consumer runs list --json --limit 5",
    ]);
    expect(executed).not.toContain("switchboard enable refund-helper");
    expect(executed).not.toContain("consumer mount apply --client claude-desktop --json");
    expect(executed).not.toContain("consumer mount rollback --client claude-desktop --json");
    expect(snapshot.commands.every((command) => command.status === "ok")).toBe(true);
  });
});

function fixtureExecutor(executed: string[]): CommandExecutor {
  const fixtures: Record<string, unknown> = {
    "host status --json": hostStatusFixture,
    "consumer inventory --json": inventoryFixture,
    "consumer exposure --json": exposureFixture,
    "consumer mount plan --client claude-desktop --json": mountPlanFixture,
    "consumer runs list --json --limit 5": runsListFixture,
  };

  return async (request) => {
    const key = request.args.join(" ");
    executed.push(key);
    const fixture = fixtures[key];
    if (!fixture) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `unexpected command: ${key}`,
      };
    }

    return {
      exitCode: 0,
      stdout: JSON.stringify(fixture),
      stderr: "",
    };
  };
}
