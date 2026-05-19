import { fetchExposurePreview } from "../core/exposureService";
import { fetchRunInspect, fetchRunsList } from "../core/runsService";
import { refreshSwitchboard } from "../core/switchboardService";
import type { CommandExecutor } from "../core/runner";
import {
  buildExposurePreviewState,
  type ExposurePreviewState,
} from "./exposure";
import {
  runImportFlow,
  type ImportFlowState,
} from "./importFlow";
import {
  applyMount,
  loadMountPlan,
  type MountManagerState,
} from "./mountManager";
import {
  buildRunDetailState,
  buildRunsListState,
  type RunDetailState,
  type RunsListState,
} from "./runs";
import {
  applySwitchboardAction,
  buildSwitchboardState,
  type SwitchboardState,
} from "./switchboard";
import { computeTrayStatus, type TrayStatus } from "./trayStatus";

export type GoldenPathStep =
  | "import"
  | "switchboard.refresh.initial"
  | "switchboard.enable"
  | "exposure.preview"
  | "mount.plan"
  | "mount.apply"
  | "runs.list"
  | "runs.inspect";

export type GoldenPathCommandTraceEntry = {
  step: GoldenPathStep;
  command: "skillrun";
  args: string[];
  cwd?: string;
};

export type DesktopAlphaGoldenPathOptions = {
  packagePath: string;
  capsuleId: string;
  runId: string;
  executor: CommandExecutor;
  cwd?: string;
  now?: () => number;
};

export type DesktopAlphaGoldenPathResult = {
  status: "ready";
  importedCapsuleId: string;
  importState: ImportFlowState;
  switchboard: SwitchboardState;
  exposure: ExposurePreviewState;
  mount: MountManagerState;
  runs: RunsListState;
  runDetail: RunDetailState;
  trayStatus: TrayStatus;
  enableConfirmation: {
    status: "confirmation_required";
    action: "enable";
    message: string;
  };
  mountApplyConfirmation: {
    status: "confirmation_required";
    action: "apply";
    message: string;
  };
  commandTrace: GoldenPathCommandTraceEntry[];
  nonGoalCommands: string[];
};

export async function runDesktopAlphaGoldenPath(
  options: DesktopAlphaGoldenPathOptions,
): Promise<DesktopAlphaGoldenPathResult> {
  const commandTrace: GoldenPathCommandTraceEntry[] = [];
  let activeStep: GoldenPathStep = "import";
  const tracedExecutor: CommandExecutor = async (request) => {
    commandTrace.push({
      step: activeStep,
      command: request.command,
      args: [...request.args],
      cwd: request.cwd,
    });
    return options.executor(request);
  };
  const common = {
    executor: tracedExecutor,
    cwd: options.cwd,
    now: options.now,
  };

  const importState = await runStep("import", () =>
    runImportFlow({
      ...common,
      packagePath: options.packagePath,
    }),
  );
  assertStatus(importState.status, "review_ready", "import");
  if (!importState.capsule) {
    throw new Error("golden_path_missing_imported_capsule");
  }

  const initialSnapshot = await runStep("switchboard.refresh.initial", () =>
    refreshSwitchboard(common),
  );
  const initialSwitchboard = buildSwitchboardState(initialSnapshot);
  const capsule = initialSwitchboard.capsules.find((item) => item.id === options.capsuleId);
  if (!capsule) {
    throw new Error(`golden_path_missing_capsule:${options.capsuleId}`);
  }

  const enableConfirmation = await applySwitchboardAction({
    ...common,
    action: "enable",
    capsule,
    confirmed: false,
  });
  assertStatus(enableConfirmation.status, "confirmation_required", "enable confirmation");

  const enabledSwitchboardResult = await runStep("switchboard.enable", () =>
    applySwitchboardAction({
      ...common,
      action: "enable",
      capsule,
      confirmed: true,
    }),
  );
  assertStatus(enabledSwitchboardResult.status, "ready", "enable");

  const exposureSnapshot = await runStep("exposure.preview", () =>
    fetchExposurePreview(common),
  );
  const exposure = buildExposurePreviewState(exposureSnapshot);

  const mountPlan = await runStep("mount.plan", () =>
    loadMountPlan({
      ...common,
      clientId: "claude-desktop",
    }),
  );
  assertStatus(mountPlan.status, "ready", "mount plan");

  const mountApplyConfirmation = await applyMount({
    ...common,
    state: mountPlan.state,
    confirmed: false,
  });
  assertStatus(mountApplyConfirmation.status, "confirmation_required", "mount apply confirmation");

  const mountApply = await runStep("mount.apply", () =>
    applyMount({
      ...common,
      state: mountPlan.state,
      confirmed: true,
    }),
  );
  assertStatus(mountApply.status, "ready", "mount apply");

  const runsListSnapshot = await runStep("runs.list", () =>
    fetchRunsList({
      ...common,
      capsuleId: options.capsuleId,
      limit: 5,
    }),
  );
  const runs = buildRunsListState({ list: runsListSnapshot.contract });

  const runInspectSnapshot = await runStep("runs.inspect", () =>
    fetchRunInspect({
      ...common,
      runId: options.runId,
      capsuleId: options.capsuleId,
    }),
  );
  const runDetail = buildRunDetailState({ inspect: runInspectSnapshot.contract });

  const nowMs = options.now?.() ?? 0;
  const trayStatus = computeTrayStatus({
    nowMs,
    exposure: {
      command: "consumer exposure --json",
      capturedAtMs: nowMs,
      data: exposureSnapshot.exposure,
    },
  });

  return {
    status: "ready",
    importedCapsuleId: importState.capsule.id,
    importState,
    switchboard: enabledSwitchboardResult.state,
    exposure,
    mount: mountApply.state,
    runs,
    runDetail,
    trayStatus,
    enableConfirmation: {
      status: enableConfirmation.status,
      action: "enable",
      message: enableConfirmation.message,
    },
    mountApplyConfirmation: {
      status: mountApplyConfirmation.status,
      action: "apply",
      message: mountApplyConfirmation.message,
    },
    commandTrace,
    nonGoalCommands: findNonGoalCommands(commandTrace),
  };

  async function runStep<TResult>(
    step: GoldenPathStep,
    action: () => Promise<TResult>,
  ): Promise<TResult> {
    activeStep = step;
    return action();
  }
}

function assertStatus<TActual extends string, TExpected extends TActual>(
  actual: TActual,
  expected: TExpected,
  label: string,
): asserts actual is TExpected {
  if (actual !== expected) {
    throw new Error(`golden_path_unexpected_status:${label}:${actual}`);
  }
}

function findNonGoalCommands(trace: GoldenPathCommandTraceEntry[]): string[] {
  return trace
    .map((entry) => entry.args.join(" "))
    .filter((line) => {
      if (line === "router serve --mcp") {
        return true;
      }
      return /\b(install|trust|sandbox|marketplace)\b/i.test(line);
    });
}
