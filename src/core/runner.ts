import {
  CoreContractMismatchError,
  CoreJsonParseError,
  CoreNonZeroExitError,
  CoreOkFalseError,
  CoreSpawnError,
  CoreStaleRefreshError,
  type CoreCommandRequest,
} from "./errors";

export type CommandExecutionResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type CommandExecutor = (request: CoreCommandRequest) => Promise<CommandExecutionResult>;

export type RunSkillrunJsonOptions = {
  args: string[];
  cwd?: string;
  executor: CommandExecutor;
  expectedSchemaVersion?: string;
  maxAgeMs?: number;
  now?: () => number;
};

export type CoreRunnerResult<TData> = {
  command: CoreCommandRequest;
  durationMs: number;
  exitCode: 0;
  stdout: string;
  stderr: string;
  data: TData;
};

export function createTauriCommandExecutor(): CommandExecutor {
  return async (request) => {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<CommandExecutionResult>("run_skillrun", {
      args: request.args,
      cwd: request.cwd,
    });
  };
}

export async function runSkillrunJson<TData = unknown>(
  options: RunSkillrunJsonOptions,
): Promise<CoreRunnerResult<TData>> {
  const now = options.now ?? (() => performance.now());
  const command: CoreCommandRequest = {
    command: "skillrun",
    args: [...options.args],
    cwd: options.cwd,
  };
  const startedAt = now();

  let output: CommandExecutionResult;
  try {
    output = await options.executor(command);
  } catch (cause) {
    throw new CoreSpawnError(command, cause, now() - startedAt);
  }

  const durationMs = now() - startedAt;
  if (output.exitCode !== 0) {
    throw new CoreNonZeroExitError(command, {
      durationMs,
      exitCode: output.exitCode,
      stdout: output.stdout,
      stderr: output.stderr,
    });
  }

  const data = parseStdoutJson(command, output.stdout, durationMs);
  assertObjectContract(command, data, durationMs);
  rejectOkFalse(command, data, durationMs);
  assertSchemaVersion(command, data, options.expectedSchemaVersion, durationMs);
  assertFreshness(command, data, options.maxAgeMs, now(), durationMs);

  return {
    command,
    durationMs,
    exitCode: 0,
    stdout: output.stdout,
    stderr: output.stderr,
    data: data as TData,
  };
}

function parseStdoutJson(command: CoreCommandRequest, stdout: string, durationMs: number): unknown {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CoreJsonParseError(command, stdout, detail, durationMs);
  }
}

function assertObjectContract(
  command: CoreCommandRequest,
  data: unknown,
  durationMs: number,
): asserts data is Record<string, unknown> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new CoreContractMismatchError(command, "root", "Expected a JSON object.", data, durationMs);
  }
}

function rejectOkFalse(
  command: CoreCommandRequest,
  data: Record<string, unknown>,
  durationMs: number,
): void {
  if (data.ok === false) {
    throw new CoreOkFalseError(command, data, durationMs);
  }
}

function assertSchemaVersion(
  command: CoreCommandRequest,
  data: Record<string, unknown>,
  expectedSchemaVersion: string | undefined,
  durationMs: number,
): void {
  if (expectedSchemaVersion === undefined) {
    return;
  }

  if (data.schema_version !== expectedSchemaVersion) {
    throw new CoreContractMismatchError(
      command,
      "schema_version",
      `Expected ${expectedSchemaVersion}.`,
      data,
      durationMs,
    );
  }
}

function assertFreshness(
  command: CoreCommandRequest,
  data: Record<string, unknown>,
  maxAgeMs: number | undefined,
  observedAtMs: number,
  durationMs: number,
): void {
  if (maxAgeMs === undefined || typeof data.refreshed_at_ms !== "number") {
    return;
  }

  const ageMs = observedAtMs - data.refreshed_at_ms;
  if (ageMs > maxAgeMs) {
    throw new CoreStaleRefreshError(command, ageMs, maxAgeMs, durationMs);
  }
}
