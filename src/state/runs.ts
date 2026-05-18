import {
  coreErrorKind,
  fetchRunInspect,
  fetchRunsList,
  type RunsInspectOptions,
  type RunsListOptions,
} from "../core/runsService";
import type { RunsInspectContract, RunsListContract } from "../core/contracts";

export type RunSummary = {
  runId: string;
  capsuleId: string;
  mode: string;
  status: string;
  ok: boolean | null;
  errorCode?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  manifestHash?: string;
  skillHash?: string;
  actionHash?: string;
  artifactCount: number;
  inputIncluded: boolean;
};

export type RunsListState = {
  status: "ready";
  scope: {
    kind: string;
    capsuleId?: string;
  };
  runs: RunSummary[];
  safetyCopy: string;
};

export type RunDetailState = {
  status: "ready";
  runId: string;
  capsuleId: string;
  mode: string;
  recordStatus: string;
  durationMs?: number;
  hashes: {
    manifest?: string;
    skill?: string;
    action?: string;
  };
  input: {
    included: boolean;
    available: boolean;
  };
  envelope: {
    included: boolean;
    status: string;
    valueSummary: {
      type: string;
      keys: string[];
    };
  };
  artifacts: ArtifactMetadata[];
  logs: {
    stdoutAvailable: boolean;
    stderrAvailable: boolean;
    stdoutIncluded: boolean;
    stderrIncluded: boolean;
  };
  warnings: string[];
  safetyCopy: string;
};

export type ArtifactMetadata = {
  name: string;
  kind: string;
  path: string;
  available: boolean;
};

export type RunErrorMatch = {
  kind: string;
  capsuleId: string;
  runId: string;
};

export type RunsError = {
  kind: string;
  message: string;
  code?: string;
  matches: RunErrorMatch[];
};

export type RunsListResult =
  | {
      status: "ready";
      state: RunsListState;
    }
  | {
      status: "error";
      error: RunsError;
    };

export type RunDetailResult =
  | {
      status: "ready";
      state: RunDetailState;
    }
  | {
      status: "error";
      error: RunsError;
    };

export type BuildRunsListInput = {
  list: Pick<RunsListContract, "scope" | "runs">;
};

export type BuildRunDetailInput = {
  inspect: RunsInspectContract;
};

export const RUNS_SAFETY_COPY =
  "Runs Explorer shows Core-reported summaries and availability metadata only. It does not show full input, log content, or artifact content.";

export async function loadRunsList(options: RunsListOptions): Promise<RunsListResult> {
  try {
    const result = await fetchRunsList(options);
    return {
      status: "ready",
      state: buildRunsListState({ list: result.contract }),
    };
  } catch (error) {
    return runsErrorResult(error, "Runs list failed.");
  }
}

export async function inspectRun(options: RunsInspectOptions): Promise<RunDetailResult> {
  try {
    const result = await fetchRunInspect(options);
    return {
      status: "ready",
      state: buildRunDetailState({ inspect: result.contract }),
    };
  } catch (error) {
    return runsErrorResult(error, "Run inspect failed.");
  }
}

export function buildRunsListState(input: BuildRunsListInput): RunsListState {
  const scope = asRecord(input.list.scope);
  return {
    status: "ready",
    scope: {
      kind: readString(scope, "kind"),
      capsuleId: readOptionalString(scope, "capsule_id"),
    },
    runs: input.list.runs.map(readRunSummary),
    safetyCopy: RUNS_SAFETY_COPY,
  };
}

export function buildRunDetailState(input: BuildRunDetailInput): RunDetailState {
  const runRef = asRecord(input.inspect.run_ref);
  const capsule = asRecord(input.inspect.capsule);
  const record = asRecord(input.inspect.record);
  const inputSummary = asRecord(input.inspect.input);
  const envelope = asRecord(input.inspect.envelope);
  const logs = asRecord(input.inspect.logs);

  return {
    status: "ready",
    runId: readString(runRef, "run_id"),
    capsuleId: readString(capsule, "id", readString(runRef, "capsule_id")),
    mode: readString(record, "mode"),
    recordStatus: readString(record, "status"),
    durationMs: readOptionalNumber(record, "duration_ms"),
    hashes: {
      manifest: readOptionalString(record, "manifest_sha256"),
      skill: readOptionalString(record, "skill_sha256"),
      action: readOptionalString(record, "action_sha256"),
    },
    input: {
      included: inputSummary.included === true,
      available: inputSummary.available === true,
    },
    envelope: {
      included: envelope.included === true,
      status: readString(envelope, "status"),
      valueSummary: summarizeValue(envelope.value),
    },
    artifacts: input.inspect.artifacts.map(readArtifactMetadata),
    logs: {
      stdoutAvailable: logs.stdout_available === true,
      stderrAvailable: logs.stderr_available === true,
      stdoutIncluded: logs.stdout_included === true,
      stderrIncluded: logs.stderr_included === true,
    },
    warnings: input.inspect.warnings.map(readWarning),
    safetyCopy: RUNS_SAFETY_COPY,
  };
}

function readRunSummary(input: unknown): RunSummary {
  const record = asRecord(input);
  return {
    runId: readString(record, "run_id"),
    capsuleId: readString(record, "capsule_id"),
    mode: readString(record, "mode"),
    status: readString(record, "status"),
    ok: typeof record.ok === "boolean" ? record.ok : null,
    errorCode: readOptionalString(record, "error_code"),
    startedAt: readOptionalString(record, "started_at"),
    finishedAt: readOptionalString(record, "finished_at"),
    durationMs: readOptionalNumber(record, "duration_ms"),
    manifestHash: readOptionalString(record, "manifest_sha256"),
    skillHash: readOptionalString(record, "skill_sha256"),
    actionHash: readOptionalString(record, "action_sha256"),
    artifactCount: readNumber(record, "artifact_count"),
    inputIncluded: record.input_included === true,
  };
}

function readArtifactMetadata(input: unknown): ArtifactMetadata {
  const record = asRecord(input);
  return {
    name: readString(record, "name"),
    kind: readString(record, "kind"),
    path: readString(record, "path"),
    available: record.available === true,
  };
}

function readWarning(input: unknown): string {
  const record = asRecord(input);
  const code = readString(record, "code", "warning");
  const message = readString(record, "message", "");
  return message ? `${code}: ${message}` : code;
}

function summarizeValue(input: unknown): RunDetailState["envelope"]["valueSummary"] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      type: input === null ? "null" : Array.isArray(input) ? "array" : typeof input,
      keys: [],
    };
  }
  return {
    type: "object",
    keys: Object.keys(input as Record<string, unknown>).sort(),
  };
}

function runsErrorResult(error: unknown, fallback: string): { status: "error"; error: RunsError } {
  const data = readErrorData(error);
  return {
    status: "error",
    error: {
      kind: coreErrorKind(error),
      message: error instanceof Error ? error.message : fallback,
      code: data.code,
      matches: data.matches,
    },
  };
}

function readErrorData(error: unknown): { code?: string; matches: RunErrorMatch[] } {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return { matches: [] };
  }

  const data = asRecord((error as { data?: unknown }).data);
  const errorRecord = asRecord(data.error);
  const matches = Array.isArray(data.matches) ? data.matches.map(readRunErrorMatch) : [];
  return {
    code: readOptionalString(errorRecord, "code"),
    matches,
  };
}

function readRunErrorMatch(input: unknown): RunErrorMatch {
  const record = asRecord(input);
  return {
    kind: readString(record, "kind"),
    capsuleId: readString(record, "capsule_id"),
    runId: readString(record, "run_id"),
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

function readOptionalString(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" ? value : undefined;
}

function readNumber(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  return typeof value === "number" ? value : 0;
}

function readOptionalNumber(record: Record<string, unknown>, field: string): number | undefined {
  const value = record[field];
  return typeof value === "number" ? value : undefined;
}
