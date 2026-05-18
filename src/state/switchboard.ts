import {
  changeSwitchboardCapsule,
  coreErrorKind,
  type SwitchboardMutationAction,
} from "../core/switchboardService";
import type { ConsumerExposureContract, ConsumerInventoryContract } from "../core/contracts";
import type { CommandExecutor } from "../core/runner";

export type SwitchboardCapsule = {
  id: string;
  name: string;
  path: string;
  sourceType: string;
  enabled: boolean;
  exposureLabel: "Exposure intent allowed" | "Exposure intent disabled";
  readinessOk: boolean;
  readinessStatus: string;
  readinessLabel: "Ready" | "Not ready";
  nextStep: string;
  adapter: string;
  entrypoint: string;
  toolName: string;
  manifestFreshness: string;
  canEnable: boolean;
  canDisable: boolean;
  requiresEnableConfirmation: boolean;
};

export type SwitchboardExposureTool = {
  capsuleId: string;
  toolName: string;
  enabled: boolean;
  exposed: boolean;
  readinessStatus: string;
  manifestHash: string;
};

export type SwitchboardState = {
  status: "ready";
  capsules: SwitchboardCapsule[];
  exposureTools: SwitchboardExposureTool[];
  safetyCopy: string;
};

export type SwitchboardActionError = {
  kind: string;
  message: string;
};

export type SwitchboardActionResult =
  | {
      status: "confirmation_required";
      action: SwitchboardMutationAction;
      capsule: SwitchboardCapsule;
      message: string;
    }
  | {
      status: "ready";
      state: SwitchboardState;
    }
  | {
      status: "error";
      error: SwitchboardActionError;
    };

export type BuildSwitchboardStateInput = {
  inventory: Pick<ConsumerInventoryContract, "capsules">;
  exposure: Pick<ConsumerExposureContract, "tools">;
};

export type ApplySwitchboardActionOptions = {
  action: SwitchboardMutationAction;
  capsule: SwitchboardCapsule;
  confirmed: boolean;
  executor: CommandExecutor;
  cwd?: string;
  now?: () => number;
};

export const SWITCHBOARD_SAFETY_COPY =
  "Enabled means local exposure intent only. Readiness is a Core preflight signal, not trust, safety, sandboxing, or business correctness.";

export function buildSwitchboardState(input: BuildSwitchboardStateInput): SwitchboardState {
  return {
    status: "ready",
    capsules: input.inventory.capsules.map(readCapsule),
    exposureTools: input.exposure.tools.map(readExposureTool),
    safetyCopy: SWITCHBOARD_SAFETY_COPY,
  };
}

export async function applySwitchboardAction(
  options: ApplySwitchboardActionOptions,
): Promise<SwitchboardActionResult> {
  if (options.action === "enable" && options.capsule.requiresEnableConfirmation && !options.confirmed) {
    return {
      status: "confirmation_required",
      action: options.action,
      capsule: options.capsule,
      message: "Imported capsule enable requires explicit confirmation.",
    };
  }

  if (options.action === "enable" && !options.capsule.canEnable) {
    return {
      status: "error",
      error: {
        kind: "capsule_not_enableable",
        message: "Capsule is not ready for exposure intent.",
      },
    };
  }

  try {
    const result = await changeSwitchboardCapsule({
      action: options.action,
      capsuleId: options.capsule.id,
      executor: options.executor,
      cwd: options.cwd,
      now: options.now,
    });

    return {
      status: "ready",
      state: buildSwitchboardState(result.snapshot),
    };
  } catch (error) {
    return {
      status: "error",
      error: {
        kind: coreErrorKind(error),
        message: error instanceof Error ? error.message : "Switchboard action failed.",
      },
    };
  }
}

function readCapsule(input: unknown): SwitchboardCapsule {
  const record = asRecord(input);
  const id = readString(record, "id");
  const sourceType = readString(record, "source_type");
  const enabled = record.enabled === true;
  const readiness = asRecord(record.readiness);
  const readinessOk = readiness.ok === true;

  return {
    id,
    name: readString(asRecord(record.skill), "name", id),
    path: readString(record, "path"),
    sourceType,
    enabled,
    exposureLabel: enabled ? "Exposure intent allowed" : "Exposure intent disabled",
    readinessOk,
    readinessStatus: readString(readiness, "status"),
    readinessLabel: readinessOk ? "Ready" : "Not ready",
    nextStep: readString(readiness, "next_step", "none"),
    adapter: readString(asRecord(record.runtime), "adapter"),
    entrypoint: readString(asRecord(record.runtime), "entrypoint"),
    toolName: readString(asRecord(record.tool), "name"),
    manifestFreshness: readString(asRecord(record.manifest), "freshness"),
    canEnable: !enabled && readinessOk,
    canDisable: enabled,
    requiresEnableConfirmation: sourceType === "imported_skr" && !enabled,
  };
}

function readExposureTool(input: unknown): SwitchboardExposureTool {
  const record = asRecord(input);
  return {
    capsuleId: readString(record, "capsule_id"),
    toolName: readString(record, "tool_name"),
    enabled: record.enabled === true,
    exposed: record.exposed === true,
    readinessStatus: readString(record, "readiness_status"),
    manifestHash: readString(record, "manifest_hash"),
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  field: string,
  fallback = "unknown",
): string {
  const value = record[field];
  return typeof value === "string" ? value : fallback;
}
