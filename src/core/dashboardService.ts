import {
  parseConsumerExposureContract,
  parseConsumerInventoryContract,
  parseHostStatusContract,
  parseMountPlanContract,
  parseRunsListContract,
  type ConsumerExposureContract,
  type ConsumerInventoryContract,
  type HostStatusContract,
  type MountPlanContract,
  type RunsListContract,
} from "./contracts";
import type { CoreErrorKind } from "./errors";
import {
  runSkillrunJson,
  type CommandExecutor,
  type CoreRunnerResult,
} from "./runner";
import {
  computeTrayStatus,
  type TrayCommandName,
  type TrayCommandSnapshot,
  type TrayStatus,
} from "../state/trayStatus";

export type DashboardCommandStatus = "ok" | "error";

export type DashboardCommandRecord = {
  command: TrayCommandName;
  displayCommand: string;
  capturedAtMs: number;
  status: DashboardCommandStatus;
  durationMs?: number;
  errorKind?: CoreErrorKind | "unknown_core_error";
  errorMessage?: string;
};

export type DashboardRefreshSnapshot = {
  status: TrayStatus;
  commands: DashboardCommandRecord[];
  capturedAtMs: number;
  contracts: DashboardCoreContracts;
};

export type RefreshDashboardStatusOptions = {
  executor: CommandExecutor;
  cwd?: string;
  nowMs?: () => number;
  now?: () => number;
  lastKnown?: TrayStatus;
};

type CapturedCommand<TData> = {
  snapshot: TrayCommandSnapshot<TData>;
  record: DashboardCommandRecord;
};

export async function refreshDashboardStatus(
  options: RefreshDashboardStatusOptions,
): Promise<DashboardRefreshSnapshot> {
  const nowMs = options.nowMs ?? (() => Date.now());
  const commands: DashboardCommandRecord[] = [];

  const host = await captureCommand({
    command: "host status --json",
    args: ["host", "status", "--json"],
    expectedSchemaVersion: "host.status.v1",
    parse: parseHostStatusContract,
    options,
  });
  commands.push(host.record);

  if (host.snapshot.error) {
    const capturedAtMs = nowMs();
    return {
      capturedAtMs,
      commands,
      status: computeTrayStatus({
        nowMs: capturedAtMs,
        lastKnown: options.lastKnown,
        host: host.snapshot,
      }),
      contracts: {},
    };
  }

  const [inventory, exposure, mountPlan, runsList] = await Promise.all([
    captureCommand({
      command: "consumer inventory --json",
      args: ["consumer", "inventory", "--json"],
      expectedSchemaVersion: "consumer.inventory.v1",
      parse: parseConsumerInventoryContract,
      options,
    }),
    captureCommand({
      command: "consumer exposure --json",
      args: ["consumer", "exposure", "--json"],
      expectedSchemaVersion: "consumer.exposure.v1",
      parse: parseConsumerExposureContract,
      options,
    }),
    captureCommand({
      command: "consumer mount plan --client claude-desktop --json",
      args: ["consumer", "mount", "plan", "--client", "claude-desktop", "--json"],
      expectedSchemaVersion: "consumer.mount_plan.v1",
      parse: parseMountPlanContract,
      options,
    }),
    captureCommand({
      command: "consumer runs list --json --limit 5",
      args: ["consumer", "runs", "list", "--json", "--limit", "5"],
      expectedSchemaVersion: "consumer.runs.list.v1",
      parse: parseRunsListContract,
      options,
    }),
  ]);
  commands.push(inventory.record, exposure.record, mountPlan.record, runsList.record);

  const capturedAtMs = nowMs();
  return {
    capturedAtMs,
    commands,
    status: computeTrayStatus({
      nowMs: capturedAtMs,
      lastKnown: options.lastKnown,
      host: host.snapshot,
      inventory: inventory.snapshot,
      exposure: exposure.snapshot,
      mountPlan: mountPlan.snapshot,
      runsList: runsList.snapshot,
    }),
    contracts: {
      host: host.snapshot.data,
      inventory: inventory.snapshot.data,
      exposure: exposure.snapshot.data,
      mountPlan: mountPlan.snapshot.data,
      runsList: runsList.snapshot.data,
    },
  };
}

async function captureCommand<TData>(input: {
  command: TrayCommandName;
  args: string[];
  expectedSchemaVersion: string;
  parse: (data: unknown) => TData;
  options: RefreshDashboardStatusOptions;
}): Promise<CapturedCommand<TData>> {
  const capturedAtMs = (input.options.nowMs ?? (() => Date.now()))();

  try {
    const runner = await runSkillrunJson({
      args: input.args,
      cwd: input.options.cwd,
      executor: input.options.executor,
      expectedSchemaVersion: input.expectedSchemaVersion,
      now: input.options.now,
    });
    const data = input.parse(runner.data);
    return {
      snapshot: {
        command: input.command,
        capturedAtMs,
        data,
      },
      record: successRecord(input.command, input.args, capturedAtMs, runner),
    };
  } catch (error) {
    return {
      snapshot: {
        command: input.command,
        capturedAtMs,
        error: {
          kind: coreErrorKind(error),
          message: errorMessage(error),
        },
      },
      record: {
        command: input.command,
        displayCommand: displayCommand(input.args),
        capturedAtMs,
        status: "error",
        errorKind: coreErrorKind(error),
        errorMessage: errorMessage(error),
      },
    };
  }
}

function successRecord<TData>(
  command: TrayCommandName,
  args: string[],
  capturedAtMs: number,
  runner: CoreRunnerResult<TData>,
): DashboardCommandRecord {
  return {
    command,
    displayCommand: displayCommand(args),
    capturedAtMs,
    status: "ok",
    durationMs: runner.durationMs,
  };
}

function displayCommand(args: string[]): string {
  return ["skillrun", ...args].join(" ");
}

function coreErrorKind(error: unknown): CoreErrorKind | "unknown_core_error" {
  if (typeof error === "object" && error !== null && "kind" in error) {
    const kind = (error as { kind?: unknown }).kind;
    if (typeof kind === "string") {
      return kind as CoreErrorKind;
    }
  }

  return "unknown_core_error";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export type DashboardCoreContracts = {
  host?: HostStatusContract;
  inventory?: ConsumerInventoryContract;
  exposure?: ConsumerExposureContract;
  mountPlan?: MountPlanContract;
  runsList?: RunsListContract;
};
