import {
  applyClaudeDesktopMount,
  coreErrorKind,
  fetchMountPlan,
  rollbackClaudeDesktopMount,
  type MountCommandOptions,
  type MountPlanOptions,
} from "../core/mountService";
import type {
  MountApplyContract,
  MountPlanContract,
  MountRollbackContract,
} from "../core/contracts";

export type MountManagerMode = "not_planned" | "ready" | "plan_only" | "applied" | "rolled_back";

export type MountManagerState = {
  status: "ready";
  mode: MountManagerMode;
  clientId: string;
  clientName: string;
  supported: boolean;
  detected: boolean;
  configPath?: string;
  backupPath?: string;
  rollbackBackupPath?: string;
  routerCommand: string;
  routerArgs: string[];
  warnings: string[];
  applied: boolean;
  rolledBack: boolean;
  canApply: boolean;
  canRollback: boolean;
  safetyCopy: string;
};

export type MountManagerError = {
  kind: string;
  message: string;
};

export type MountManagerResult =
  | {
      status: "ready";
      state: MountManagerState;
    }
  | {
      status: "confirmation_required";
      action: "apply" | "rollback";
      message: string;
    }
  | {
      status: "error";
      error: MountManagerError;
    };

export type BuildMountManagerStateInput = {
  plan: MountPlanContract;
  apply?: MountApplyContract;
  rollback?: MountRollbackContract;
};

export type ApplyMountOptions = MountCommandOptions & {
  state?: MountManagerState;
  confirmed: boolean;
};

export type RollbackMountOptions = MountCommandOptions & {
  state: MountManagerState;
  confirmed: boolean;
  requestedBackupPath?: string;
};

export const MOUNT_SAFETY_COPY =
  "Mount apply changes the MCP client config through Core only; it does not install dependencies. Rollback uses the Core-returned backup path.";

export async function loadMountPlan(options: MountPlanOptions): Promise<MountManagerResult> {
  try {
    const result = await fetchMountPlan(options);
    return {
      status: "ready",
      state: buildMountManagerState({ plan: result.contract }),
    };
  } catch (error) {
    return errorResult(error, "Mount plan failed.");
  }
}

export async function applyMount(options: ApplyMountOptions): Promise<MountManagerResult> {
  if (!options.state) {
    return {
      status: "error",
      error: {
        kind: "mount_plan_required",
        message: "Mount plan must be loaded before apply.",
      },
    };
  }

  if (!options.confirmed) {
    return {
      status: "confirmation_required",
      action: "apply",
      message: "Mount apply requires explicit confirmation.",
    };
  }

  if (!options.state.canApply) {
    return {
      status: "error",
      error: {
        kind: "mount_apply_not_allowed",
        message: "Mount apply is only available for Claude Desktop after a plan.",
      },
    };
  }

  try {
    const result = await applyClaudeDesktopMount(options);
    return {
      status: "ready",
      state: buildMountManagerState({
        plan: stateToPlanContract(options.state),
        apply: result.contract,
      }),
    };
  } catch (error) {
    return errorResult(error, "Mount apply failed.");
  }
}

export async function rollbackMount(options: RollbackMountOptions): Promise<MountManagerResult> {
  if (!options.confirmed) {
    return {
      status: "confirmation_required",
      action: "rollback",
      message: "Mount rollback requires explicit confirmation.",
    };
  }

  if (!options.state.canRollback || !options.state.rollbackBackupPath) {
    return {
      status: "error",
      error: {
        kind: "mount_rollback_not_allowed",
        message: "Mount rollback requires a Core-returned backup path.",
      },
    };
  }

  try {
    const result = await rollbackClaudeDesktopMount({
      ...options,
      backupPath: options.state.rollbackBackupPath,
    });
    return {
      status: "ready",
      state: buildMountManagerState({
        plan: stateToPlanContract(options.state),
        rollback: result.contract,
      }),
    };
  } catch (error) {
    return errorResult(error, "Mount rollback failed.");
  }
}

export function buildMountManagerState(input: BuildMountManagerStateInput): MountManagerState {
  const client = input.rollback?.client ?? input.apply?.client ?? input.plan.client;
  const backup = input.apply?.backup ?? input.rollback?.backup ?? input.plan.backup;
  const supported = readBoolean(client, "supported");
  const clientId = readString(client, "id");
  const isClaude = clientId === "claude-desktop";
  const applied = input.apply?.applied === true;
  const rolledBack = input.rollback?.rolled_back === true;
  const planOnly = !supported || !isClaude;
  const warnings = [
    ...readStringArray(input.plan.warnings),
    ...readStringArray(input.apply?.warnings),
    ...readStringArray(input.rollback?.warnings),
  ];

  return {
    status: "ready",
    mode: rolledBack ? "rolled_back" : applied ? "applied" : planOnly ? "plan_only" : "ready",
    clientId,
    clientName: readString(client, "name", clientId),
    supported,
    detected: readBoolean(client, "detected"),
    configPath: readString(asRecord(input.apply?.config ?? input.rollback?.config ?? input.plan.config), "path", ""),
    backupPath: readString(asRecord(backup), "path", ""),
    rollbackBackupPath: readString(asRecord(input.apply?.backup), "path", ""),
    routerCommand: readString(input.plan.router, "command"),
    routerArgs: readStringArray(input.plan.router.args),
    warnings,
    applied,
    rolledBack,
    canApply: !applied && !rolledBack && !planOnly,
    canRollback: applied && !rolledBack && Boolean(readString(asRecord(input.apply?.backup), "path", "")),
    safetyCopy: MOUNT_SAFETY_COPY,
  };
}

function stateToPlanContract(state: MountManagerState): MountPlanContract {
  return {
    command: "consumer mount plan",
    schema_version: "consumer.mount_plan.v1",
    client: {
      id: state.clientId,
      name: state.clientName,
      supported: state.supported,
      detected: state.detected,
    },
    operation: "state_rehydrated",
    config: state.configPath ? { path: state.configPath } : null,
    backup: state.backupPath ? { path: state.backupPath } : null,
    router: {
      server_name: "skillrun",
      command: state.routerCommand,
      args: state.routerArgs,
    },
    changes: [],
    warnings: state.warnings,
  };
}

function errorResult(error: unknown, fallback: string): MountManagerResult {
  return {
    status: "error",
    error: {
      kind: coreErrorKind(error),
      message: error instanceof Error ? error.message : fallback,
    },
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, field: string, fallback = "unknown"): string {
  const value = record[field];
  return typeof value === "string" ? value : fallback;
}

function readBoolean(record: Record<string, unknown>, field: string): boolean {
  return record[field] === true;
}

function readStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((value): value is string => typeof value === "string");
}
