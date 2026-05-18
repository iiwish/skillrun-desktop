import { describe, expect, it } from "vitest";
import {
  computeNextRefreshDelayMs,
  computeTrayStatus,
  type TrayCommandSnapshot,
} from "./trayStatus";
import {
  parseConsumerExposureContract,
  parseConsumerInventoryContract,
  parseMountPlanContract,
  parseRunsListContract,
} from "../core/contracts";
import exposureFixture from "../core/fixtures/consumer-exposure.v1.json";
import inventoryFixture from "../core/fixtures/consumer-inventory.v1.json";
import mountPlanFixture from "../core/fixtures/consumer-mount-plan.v1.json";
import runsListFixture from "../core/fixtures/consumer-runs-list.v1.json";

const nowMs = 1_000;
const inventory = parseConsumerInventoryContract(inventoryFixture);
const exposure = parseConsumerExposureContract(exposureFixture);
const mountPlan = parseMountPlanContract(mountPlanFixture);
const runsList = parseRunsListContract(runsListFixture);

function snapshot<T>(
  command: TrayCommandSnapshot<T>["command"],
  data: T,
): TrayCommandSnapshot<T> {
  return {
    command,
    capturedAtMs: nowMs,
    data,
  };
}

describe("tray status model", () => {
  it("prioritizes core missing over all other states", () => {
    const status = computeTrayStatus({
      nowMs,
      host: {
        command: "host status --json",
        capturedAtMs: nowMs,
        error: { kind: "spawn_failure", message: "ENOENT" },
      },
      inventory: snapshot("consumer inventory --json", inventory),
      exposure: snapshot("consumer exposure --json", exposure),
      mountPlan: snapshot("consumer mount plan --client claude-desktop --json", mountPlan),
      runsList: snapshot("consumer runs list --json --limit 5", {
        ...runsList,
        runs: [{ status: "failed" }],
      }),
    });

    expect(status.kind).toBe("core_missing");
    expect(status.source.command).toBe("host status --json");
  });

  it("applies the non-error priority order", () => {
    expect(
      computeTrayStatus({
        nowMs,
        inventory: snapshot("consumer inventory --json", inventory),
        exposure: snapshot("consumer exposure --json", exposure),
        mountPlan: snapshot("consumer mount plan --client claude-desktop --json", mountPlan),
        runsList: snapshot("consumer runs list --json --limit 5", {
          ...runsList,
          runs: [{ status: "error" }],
        }),
      }).kind,
    ).toBe("recent_failures");

    expect(
      computeTrayStatus({
        nowMs,
        inventory: snapshot("consumer inventory --json", inventory),
        exposure: snapshot("consumer exposure --json", exposure),
        mountPlan: snapshot("consumer mount plan --client claude-desktop --json", mountPlan),
        runsList: snapshot("consumer runs list --json --limit 5", runsList),
      }).kind,
    ).toBe("mount_not_configured");

    expect(
      computeTrayStatus({
        nowMs,
        inventory: snapshot("consumer inventory --json", inventory),
        exposure: snapshot("consumer exposure --json", exposure),
        runsList: snapshot("consumer runs list --json --limit 5", runsList),
      }).kind,
    ).toBe("tools_exposed");
  });

  it("distinguishes disabled capsules from no capsules", () => {
    const disabledExposure = { ...exposure, tools: [] };
    expect(
      computeTrayStatus({
        nowMs,
        inventory: snapshot("consumer inventory --json", inventory),
        exposure: snapshot("consumer exposure --json", disabledExposure),
      }).kind,
    ).toBe("capsules_disabled");

    expect(
      computeTrayStatus({
        nowMs,
        inventory: snapshot("consumer inventory --json", { ...inventory, capsules: [] }),
      }).kind,
    ).toBe("no_capsules");
  });

  it("keeps last known state explicit when refresh fails", () => {
    const lastKnown = computeTrayStatus({
      nowMs,
      inventory: snapshot("consumer inventory --json", inventory),
      exposure: snapshot("consumer exposure --json", exposure),
    });

    const status = computeTrayStatus({
      nowMs: nowMs + 90_000,
      lastKnown,
      inventory: {
        command: "consumer inventory --json",
        capturedAtMs: nowMs + 90_000,
        error: { kind: "non_zero_exit", message: "registry locked" },
      },
    });

    expect(status.kind).toBe("core_error");
    expect(status.stale).toBe(true);
    expect(status.lastKnown?.kind).toBe("tools_exposed");
  });

  it("backs off refresh after failures", () => {
    expect(computeNextRefreshDelayMs(0)).toBe(60_000);
    expect(computeNextRefreshDelayMs(1)).toBe(120_000);
    expect(computeNextRefreshDelayMs(3)).toBe(300_000);
  });
});
