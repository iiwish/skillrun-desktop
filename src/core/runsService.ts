import {
  parseRunsInspectContract,
  parseRunsListContract,
  type RunsInspectContract,
  type RunsListContract,
} from "./contracts";
import type { CoreRunnerError } from "./errors";
import {
  runSkillrunJson,
  type CommandExecutor,
  type CoreRunnerResult,
} from "./runner";

export type RunsListOptions = {
  executor: CommandExecutor;
  cwd?: string;
  now?: () => number;
  capsuleId?: string;
  limit?: number;
};

export type RunsInspectOptions = {
  executor: CommandExecutor;
  cwd?: string;
  now?: () => number;
  runId: string;
  capsuleId?: string;
};

export type RunsListResult = {
  contract: RunsListContract;
  runner: CoreRunnerResult<unknown>;
};

export type RunsInspectResult = {
  contract: RunsInspectContract;
  runner: CoreRunnerResult<unknown>;
};

export async function fetchRunsList(options: RunsListOptions): Promise<RunsListResult> {
  const args = ["consumer", "runs", "list", "--json"];
  if (options.capsuleId) {
    args.push("--capsule", options.capsuleId);
  }
  if (options.limit !== undefined) {
    args.push("--limit", String(options.limit));
  }

  const runner = await runSkillrunJson({
    args,
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "consumer.runs.list.v1",
    now: options.now,
  });

  return {
    contract: parseRunsListContract(runner.data),
    runner,
  };
}

export async function fetchRunInspect(options: RunsInspectOptions): Promise<RunsInspectResult> {
  const args = ["consumer", "runs", "inspect", options.runId, "--json"];
  if (options.capsuleId) {
    args.push("--capsule", options.capsuleId);
  }

  const runner = await runSkillrunJson({
    args,
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "consumer.runs.inspect.v1",
    now: options.now,
  });

  return {
    contract: parseRunsInspectContract(runner.data),
    runner,
  };
}

export function coreErrorKind(error: unknown): CoreRunnerError["kind"] | "unknown_core_error" {
  if (typeof error === "object" && error !== null && "kind" in error) {
    const kind = (error as { kind?: unknown }).kind;
    if (typeof kind === "string") {
      return kind as CoreRunnerError["kind"];
    }
  }

  return "unknown_core_error";
}
