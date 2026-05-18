import {
  parseMountApplyContract,
  parseMountPlanContract,
  parseMountRollbackContract,
  type MountApplyContract,
  type MountPlanContract,
  type MountRollbackContract,
} from "./contracts";
import type { CoreRunnerError } from "./errors";
import {
  runSkillrunJson,
  type CommandExecutor,
  type CoreRunnerResult,
} from "./runner";

export type MountCommandOptions = {
  executor: CommandExecutor;
  cwd?: string;
  now?: () => number;
  configPath?: string;
};

export type MountPlanOptions = MountCommandOptions & {
  clientId: string;
};

export type MountRollbackOptions = MountCommandOptions & {
  backupPath: string;
};

export type MountPlanResult = {
  contract: MountPlanContract;
  runner: CoreRunnerResult<unknown>;
};

export type MountApplyResult = {
  contract: MountApplyContract;
  runner: CoreRunnerResult<unknown>;
};

export type MountRollbackResult = {
  contract: MountRollbackContract;
  runner: CoreRunnerResult<unknown>;
};

export async function fetchMountPlan(options: MountPlanOptions): Promise<MountPlanResult> {
  const runner = await runSkillrunJson({
    args: withOptionalConfig(
      ["consumer", "mount", "plan", "--client", options.clientId],
      options.configPath,
    ),
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "consumer.mount_plan.v1",
    now: options.now,
  });

  return {
    contract: parseMountPlanContract(runner.data),
    runner,
  };
}

export async function applyClaudeDesktopMount(
  options: MountCommandOptions,
): Promise<MountApplyResult> {
  const runner = await runSkillrunJson({
    args: withOptionalConfig(
      ["consumer", "mount", "apply", "--client", "claude-desktop"],
      options.configPath,
    ),
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "consumer.mount_apply.v1",
    now: options.now,
  });

  return {
    contract: parseMountApplyContract(runner.data),
    runner,
  };
}

export async function rollbackClaudeDesktopMount(
  options: MountRollbackOptions,
): Promise<MountRollbackResult> {
  const runner = await runSkillrunJson({
    args: withOptionalConfig(
      [
        "consumer",
        "mount",
        "rollback",
        "--client",
        "claude-desktop",
        "--backup",
        options.backupPath,
      ],
      options.configPath,
    ),
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "consumer.mount_rollback.v1",
    now: options.now,
  });

  return {
    contract: parseMountRollbackContract(runner.data),
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

function withOptionalConfig(args: string[], configPath: string | undefined): string[] {
  const commandArgs = [...args];
  if (configPath) {
    commandArgs.push("--config", configPath);
  }
  commandArgs.push("--json");
  return commandArgs;
}
