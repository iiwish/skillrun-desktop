import {
  parseConsumerExposureContract,
  parseConsumerInventoryContract,
  type ConsumerExposureContract,
  type ConsumerInventoryContract,
} from "./contracts";
import type { CoreRunnerError } from "./errors";
import { CoreNonZeroExitError, CoreSpawnError, type CoreCommandRequest } from "./errors";
import {
  runSkillrunJson,
  type CommandExecutor,
  type CoreRunnerResult,
} from "./runner";

export type SwitchboardRefreshOptions = {
  executor: CommandExecutor;
  cwd?: string;
  now?: () => number;
};

export type SwitchboardMutationAction = "enable" | "disable";

export type SwitchboardMutationOptions = SwitchboardRefreshOptions & {
  action: SwitchboardMutationAction;
  capsuleId: string;
};

export type RawSwitchboardMutationResult = {
  command: CoreCommandRequest;
  durationMs: number;
  exitCode: 0;
  stdout: string;
  stderr: string;
};

export type SwitchboardSnapshot = {
  inventory: ConsumerInventoryContract;
  exposure: ConsumerExposureContract;
  inventoryRunner: CoreRunnerResult<unknown>;
  exposureRunner: CoreRunnerResult<unknown>;
};

export type SwitchboardMutationResult = {
  mutation: RawSwitchboardMutationResult;
  snapshot: SwitchboardSnapshot;
};

export async function refreshSwitchboard(
  options: SwitchboardRefreshOptions,
): Promise<SwitchboardSnapshot> {
  const inventoryRunner = await runSkillrunJson({
    args: ["consumer", "inventory", "--json"],
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "consumer.inventory.v1",
    now: options.now,
  });
  const exposureRunner = await runSkillrunJson({
    args: ["consumer", "exposure", "--json"],
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "consumer.exposure.v1",
    now: options.now,
  });

  return {
    inventory: parseConsumerInventoryContract(inventoryRunner.data),
    exposure: parseConsumerExposureContract(exposureRunner.data),
    inventoryRunner,
    exposureRunner,
  };
}

export async function changeSwitchboardCapsule(
  options: SwitchboardMutationOptions,
): Promise<SwitchboardMutationResult> {
  const mutation = await runRawSwitchboardMutation(options);
  const snapshot = await refreshSwitchboard(options);
  return { mutation, snapshot };
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

async function runRawSwitchboardMutation(
  options: SwitchboardMutationOptions,
): Promise<RawSwitchboardMutationResult> {
  const now = options.now ?? (() => performance.now());
  const command: CoreCommandRequest = {
    command: "skillrun",
    args: ["switchboard", options.action, options.capsuleId],
    cwd: options.cwd,
  };
  const startedAt = now();

  let output: Awaited<ReturnType<CommandExecutor>>;
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

  return {
    command,
    durationMs,
    exitCode: 0,
    stdout: output.stdout,
    stderr: output.stderr,
  };
}
