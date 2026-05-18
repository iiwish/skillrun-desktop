import {
  parseImportContract,
  type ImportContract,
} from "./contracts";
import type { CoreRunnerError } from "./errors";
import {
  runSkillrunJson,
  type CommandExecutor,
  type CoreRunnerResult,
} from "./runner";

export type ImportCapsuleOptions = {
  packagePath: string;
  executor: CommandExecutor;
  cwd?: string;
  now?: () => number;
};

export type ImportCapsuleResult = {
  contract: ImportContract;
  runner: CoreRunnerResult<unknown>;
};

export async function importCapsule(
  options: ImportCapsuleOptions,
): Promise<ImportCapsuleResult> {
  const runner = await runSkillrunJson({
    args: ["import", options.packagePath, "--json"],
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "import.v1",
    now: options.now,
  });

  return {
    contract: parseImportContract(runner.data),
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
