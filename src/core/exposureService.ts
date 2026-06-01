import {
  parseConsumerExposureContract,
  parseRouterDryRunContract,
  parseRouterStatusContract,
  type ConsumerExposureContract,
  type RouterDryRunContract,
  type RouterStatusContract,
} from "./contracts";
import type { CoreRunnerError } from "./errors";
import {
  runSkillrunJson,
  type CommandExecutor,
  type CoreRunnerResult,
} from "./runner";

export type ExposurePreviewOptions = {
  executor: CommandExecutor;
  cwd?: string;
  now?: () => number;
};

export type ExposurePreviewSnapshot = {
  exposure: ConsumerExposureContract;
  routerStatus: RouterStatusContract;
  dryRun: RouterDryRunContract;
  exposureRunner: CoreRunnerResult<unknown>;
  statusRunner: CoreRunnerResult<unknown>;
  dryRunRunner: CoreRunnerResult<unknown>;
};

export async function fetchExposurePreview(
  options: ExposurePreviewOptions,
): Promise<ExposurePreviewSnapshot> {
  const exposureRunner = await runSkillrunJson({
    args: ["consumer", "exposure", "--json"],
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "consumer.exposure.v1",
    now: options.now,
  });

  const statusRunner = await runSkillrunJson({
    args: ["router", "status", "--json"],
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "router.status.v1",
    allowOkFalse: true,
    allowNonZeroJson: true,
    now: options.now,
  });

  const dryRunRunner = await runSkillrunJson({
    args: ["router", "serve", "--mcp", "--dry-run"],
    cwd: options.cwd,
    executor: options.executor,
    expectedSchemaVersion: "router.mcp.v1",
    allowOkFalse: true,
    allowNonZeroJson: true,
    now: options.now,
  });

  return {
    exposure: parseConsumerExposureContract(exposureRunner.data),
    routerStatus: parseRouterStatusContract(statusRunner.data),
    dryRun: parseRouterDryRunContract(dryRunRunner.data),
    exposureRunner,
    statusRunner,
    dryRunRunner,
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
