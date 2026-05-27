import {
  parseTeamCatalogInstallPlanContract,
  parseTeamCatalogInspectContract,
  type TeamCatalogInstallPlanContract,
  type TeamCatalogInspectContract,
} from "./contracts";
import type { CoreRunnerError } from "./errors";
import {
  runSkillrunJson,
  type CommandExecutor,
  type CoreRunnerResult,
} from "./runner";

export type TeamCatalogInspectOptions = {
  executor: CommandExecutor;
  catalogPath: string;
  cwd?: string;
  now?: () => number;
};

export type TeamCatalogInspectResult = {
  contract: TeamCatalogInspectContract;
  runner: CoreRunnerResult<unknown>;
};

export type TeamCatalogInstallPlanOptions = TeamCatalogInspectOptions & {
  itemId: string;
};

export type TeamCatalogInstallPlanResult = {
  contract: TeamCatalogInstallPlanContract;
  runner: CoreRunnerResult<unknown>;
};

export async function fetchTeamCatalogInspect(
  options: TeamCatalogInspectOptions,
): Promise<TeamCatalogInspectResult> {
  const runner = await runSkillrunJson({
    args: ["team", "catalog", "inspect", options.catalogPath, "--json"],
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "team.catalog.inspect.v1",
    now: options.now,
  });

  return {
    contract: parseTeamCatalogInspectContract(runner.data),
    runner,
  };
}

export async function fetchTeamCatalogInstallPlan(
  options: TeamCatalogInstallPlanOptions,
): Promise<TeamCatalogInstallPlanResult> {
  const runner = await runSkillrunJson({
    args: ["team", "catalog", "install", "plan", options.catalogPath, options.itemId, "--json"],
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "team.catalog.install_plan.v1",
    now: options.now,
  });

  return {
    contract: parseTeamCatalogInstallPlanContract(runner.data),
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
