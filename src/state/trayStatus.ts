import type {
  ConsumerExposureContract,
  ConsumerInventoryContract,
  MountPlanContract,
  RunsListContract,
} from "../core/contracts";
import type { CoreErrorKind } from "../core/errors";

export type TrayStatusKind =
  | "core_missing"
  | "core_error"
  | "recent_failures"
  | "mount_not_configured"
  | "tools_exposed"
  | "capsules_disabled"
  | "no_capsules";

export type TrayCommandName =
  | "host status --json"
  | "consumer inventory --json"
  | "consumer exposure --json"
  | "consumer mount plan --client claude-desktop --json"
  | "consumer runs list --json --limit 5";

export type TrayCommandError = {
  kind: CoreErrorKind | "unknown_core_error";
  message: string;
};

export type TrayCommandSnapshot<TData> = {
  command: TrayCommandName;
  capturedAtMs: number;
  data?: TData;
  error?: TrayCommandError;
};

export type TrayStatusSource = {
  command: TrayCommandName;
  capturedAtMs: number;
};

export type TrayStatus = {
  kind: TrayStatusKind;
  label: string;
  source: TrayStatusSource;
  stale: boolean;
  lastKnown?: TrayStatus;
};

export type TrayStatusInput = {
  nowMs: number;
  maxAgeMs?: number;
  lastKnown?: TrayStatus;
  host?: TrayCommandSnapshot<unknown>;
  inventory?: TrayCommandSnapshot<ConsumerInventoryContract>;
  exposure?: TrayCommandSnapshot<ConsumerExposureContract>;
  mountPlan?: TrayCommandSnapshot<MountPlanContract>;
  runsList?: TrayCommandSnapshot<RunsListContract>;
};

const DEFAULT_SOURCE: TrayStatusSource = {
  command: "consumer inventory --json",
  capturedAtMs: 0,
};

const DEFAULT_MAX_AGE_MS = 120_000;
const BASE_REFRESH_MS = 60_000;
const MAX_REFRESH_MS = 300_000;

export function computeTrayStatus(input: TrayStatusInput): TrayStatus {
  const failedSnapshot = [
    input.host,
    input.inventory,
    input.exposure,
    input.mountPlan,
    input.runsList,
  ].find((snapshot) => snapshot?.error);

  if (failedSnapshot?.error?.kind === "spawn_failure") {
    return status("core_missing", failedSnapshot, input, true);
  }

  if (failedSnapshot?.error) {
    return status("core_error", failedSnapshot, input, true);
  }

  if (hasRecentFailures(input.runsList?.data)) {
    return status("recent_failures", input.runsList, input);
  }

  if (mountNeedsConfiguration(input.mountPlan?.data)) {
    return status("mount_not_configured", input.mountPlan, input);
  }

  if (hasExposedTools(input.exposure?.data)) {
    return status("tools_exposed", input.exposure, input);
  }

  if (hasCapsules(input.inventory?.data)) {
    return status("capsules_disabled", input.inventory, input);
  }

  return status("no_capsules", input.inventory, input);
}

export function computeNextRefreshDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) {
    return BASE_REFRESH_MS;
  }

  return Math.min(MAX_REFRESH_MS, BASE_REFRESH_MS * 2 ** consecutiveFailures);
}

function status(
  kind: TrayStatusKind,
  snapshot: TrayCommandSnapshot<unknown> | undefined,
  input: TrayStatusInput,
  forceStale = false,
): TrayStatus {
  const source = snapshotToSource(snapshot);
  const stale = forceStale || isStale(source, input.nowMs, input.maxAgeMs ?? DEFAULT_MAX_AGE_MS);

  return {
    kind,
    label: labelFor(kind),
    source,
    stale,
    lastKnown: stale ? input.lastKnown : undefined,
  };
}

function snapshotToSource(snapshot: TrayCommandSnapshot<unknown> | undefined): TrayStatusSource {
  if (!snapshot) {
    return DEFAULT_SOURCE;
  }

  return {
    command: snapshot.command,
    capturedAtMs: snapshot.capturedAtMs,
  };
}

function isStale(source: TrayStatusSource, nowMs: number, maxAgeMs: number): boolean {
  return nowMs - source.capturedAtMs > maxAgeMs;
}

function hasRecentFailures(runsList: RunsListContract | undefined): boolean {
  return (
    runsList?.runs.some((run) => {
      if (typeof run !== "object" || run === null || Array.isArray(run)) {
        return false;
      }

      const statusValue = (run as Record<string, unknown>).status;
      return statusValue === "failed" || statusValue === "error";
    }) ?? false
  );
}

function mountNeedsConfiguration(mountPlan: MountPlanContract | undefined): boolean {
  if (!mountPlan) {
    return false;
  }

  return mountPlan.changes.length > 0 || mountPlan.client["detected"] === false;
}

function hasExposedTools(exposure: ConsumerExposureContract | undefined): boolean {
  return (
    exposure?.tools.some((tool) => {
      if (typeof tool !== "object" || tool === null || Array.isArray(tool)) {
        return false;
      }

      return (tool as Record<string, unknown>).exposed === true;
    }) ?? false
  );
}

function hasCapsules(inventory: ConsumerInventoryContract | undefined): boolean {
  return (inventory?.capsules.length ?? 0) > 0;
}

function labelFor(kind: TrayStatusKind): string {
  switch (kind) {
    case "core_missing":
      return "Core missing";
    case "core_error":
      return "Core error";
    case "recent_failures":
      return "Recent failures";
    case "mount_not_configured":
      return "Mount not configured";
    case "tools_exposed":
      return "Tools exposed";
    case "capsules_disabled":
      return "Capsules disabled";
    case "no_capsules":
      return "No capsules";
  }
}
