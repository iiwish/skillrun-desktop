import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CoreContractMismatchError,
  CoreJsonParseError,
  CoreNonZeroExitError,
  CoreOkFalseError,
  CoreRunnerError,
  CoreSpawnError,
} from "../src/core/errors";
import { runSkillrunJson, type CommandExecutor } from "../src/core/runner";

type SmokeTraceEntry = {
  command: string;
  cwd?: string;
  durationMs: number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  status: "ok" | "failed";
};

type SmokeSummaryEntry = {
  step: string;
  detail: string;
};

type HostStatus = {
  command: "host status";
  schema_version: "host.status.v1";
  ok: true;
  paths: {
    skillrun_home: string;
    registry_path: string;
  };
};

type ImportResult = {
  command: "import";
  schema_version: "import.v1";
  ok: true;
  capsule: {
    id: string;
    enabled: boolean;
    path: string;
  };
};

type TeamCatalogInspectResult = {
  command: "team catalog inspect";
  schema_version: "team.catalog.inspect.v1";
  ok: true;
  items: Array<{
    id: string;
    installable: boolean;
  }>;
};

type TeamCatalogPlanResult = {
  command: "team catalog install plan";
  schema_version: "team.catalog.install_plan.v1";
  ok: true;
  item: {
    id: string;
  };
  actions: Array<{
    type: "import";
    replace: boolean;
    requires_confirmation: boolean;
  }>;
};

type TeamCatalogApplyResult = {
  command: "team catalog install apply";
  schema_version: "team.catalog.install_apply.v1";
  ok: true;
  item_id: string;
  download: {
    source_type: "file";
    sha256_verified: boolean;
  };
  import: {
    id: string;
    source_type: "imported_skr";
    enabled: boolean;
    replaced: boolean;
  };
};

type InventoryResult = {
  command: "consumer inventory";
  schema_version: "consumer.inventory.v1";
  capsules: Array<{
    id: string;
    enabled: boolean;
    readiness: {
      ok: boolean;
    };
  }>;
};

type ExposureResult = {
  command: "consumer exposure";
  schema_version: "consumer.exposure.v1";
  tools: Array<{
    capsule_id: string;
    enabled: boolean;
    exposed: boolean;
    readiness_status: string;
  }>;
};

type RouterStatusResult = {
  command: "router status";
  schema_version: "router.status.v1";
  ok: true;
  router: {
    snapshot: boolean;
    capsules: number;
  };
  tools: Array<{
    capsule_id: string;
    name: string;
    manifest_sha256: string;
  }>;
  resources: Array<{
    capsule_id: string;
    uri_prefix: string;
  }>;
  error: null;
};

type RouterDryRunResult = {
  command: "router serve --mcp";
  schema_version: "router.mcp.v1";
  mcp: {
    dry_run: boolean;
    protocol: string;
    transport: string;
  };
  router: {
    snapshot: boolean;
    capsules: number;
  };
  tools: Array<{
    capsule_id: string;
    name: string;
  }>;
  resources: unknown[];
};

type TestRunResult = {
  ok: true;
  run_id: string;
};

type RunsListResult = {
  command: "consumer runs list";
  schema_version: "consumer.runs.list.v1";
  source?: {
    kind: "scan" | "index";
    index_path: string | null;
    generated_at: string | null;
    stale: boolean | null;
  };
  scope: {
    source?: "scan" | "index";
  };
  runs: Array<{
    run_id: string;
    capsule_id: string;
    status: string;
    input_included: boolean;
  }>;
};

type RunsIndexRebuildResult = {
  command: "consumer runs index rebuild";
  schema_version: "consumer.runs.index.v1";
  ok: true;
  index_path: string;
  generated_at: string;
  capsules_scanned: number;
  runs_indexed: number;
};

type RunsIndexStatusResult = {
  command: "consumer runs index status";
  schema_version: "consumer.runs.index.status.v1";
  ok: true;
  index_path: string;
  index: {
    exists: boolean;
    readable: boolean;
    supported_schema: boolean;
    schema_version: string;
    generated_at: string;
    runs_indexed: number;
    stale: boolean;
  };
  warnings: unknown[];
};

type RunsInspectResult = {
  command: "consumer runs inspect";
  schema_version: "consumer.runs.inspect.v1";
  ok: true;
  run_ref: {
    capsule_id: string;
    run_id: string;
  };
  input: {
    included: boolean;
    available: boolean;
  };
  envelope: {
    included: boolean;
    status: string;
  };
  logs: {
    stdout_included: boolean;
    stderr_included: boolean;
  };
};

const capsuleId = "desktop-smoke";

describe("real Core smoke harness", () => {
  it("runs a minimal isolated Core loop through the Desktop JSON runner", async () => {
    const root = await mkdtemp(join(tmpdir(), "skillrun-desktop-real-core-"));
    const coreHome = join(root, "skillrun-home");
    const fakeHome = join(root, "fake-user-home");
    const workspace = join(root, "workspace");
    const trace: SmokeTraceEntry[] = [];
    const summary: SmokeSummaryEntry[] = [];
    const env = {
      ...process.env,
      HOME: fakeHome,
      SKILLRUN_HOME: coreHome,
      XDG_CONFIG_HOME: join(root, "xdg-config"),
    };
    const executor = createNodeSkillrunExecutor(env, trace);

    try {
      await mkdir(coreHome, { recursive: true });
      await mkdir(fakeHome, { recursive: true });
      await mkdir(env.XDG_CONFIG_HOME, { recursive: true });

      const hostStatus = await runJson<HostStatus>(
        {
          args: ["host", "status", "--json"],
          expectedSchemaVersion: "host.status.v1",
          executor,
        },
        trace,
      );

      await assertIsolatedHome(hostStatus.data.paths.skillrun_home, coreHome);
      assertIsolatedPath(hostStatus.data.paths.registry_path, coreHome);
      expect(resolve(hostStatus.data.paths.skillrun_home)).not.toBe(resolve(homedir(), ".skillrun"));
      summary.push({
        step: "host status",
        detail: `schema=${hostStatus.data.schema_version}; isolated_home=${hostStatus.data.paths.skillrun_home}`,
      });

      await runCommand(["init", capsuleId, "--js", "--output", workspace], env, trace);
      const capsulePath = join(workspace, capsuleId);
      summary.push({ step: "init", detail: `capsule=${capsuleId}; workspace=${workspace}` });
      await runCommand(["manifest", "--cwd", capsulePath], env, trace);
      summary.push({ step: "manifest", detail: `cwd=${capsulePath}; generated=true` });
      await runCommand(["pack", "--cwd", capsulePath], env, trace);

      const packagePath = await findSkrPackage(join(capsulePath, "dist"));
      summary.push({ step: "pack", detail: `package=${packagePath}` });
      const imported = await runJson<ImportResult>(
        {
          args: ["import", packagePath, "--json"],
          expectedSchemaVersion: "import.v1",
          executor,
        },
        trace,
      );
      expect(imported.data.capsule).toMatchObject({ id: capsuleId, enabled: false });
      assertIsolatedPath(imported.data.capsule.path, coreHome);
      summary.push({
        step: "import",
        detail: `capsule=${imported.data.capsule.id}; enabled=${imported.data.capsule.enabled}`,
      });

      if (!(await skillrunSupportsTeamCatalog(env, trace))) {
        summary.push({
          step: "team catalog apply",
          detail: "skipped because PATH skillrun does not expose the team catalog command yet",
        });
      } else {
        const catalogPath = await writeTeamCatalog(workspace, capsuleId, packagePath);
        const catalogInspect = await runJson<TeamCatalogInspectResult>(
          {
            args: ["team", "catalog", "inspect", catalogPath, "--json"],
            expectedSchemaVersion: "team.catalog.inspect.v1",
            executor,
          },
          trace,
        );
        expect(catalogInspect.data.items).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: capsuleId, installable: true })]),
        );
        const catalogPlan = await runJson<TeamCatalogPlanResult>(
          {
            args: ["team", "catalog", "install", "plan", catalogPath, capsuleId, "--json"],
            expectedSchemaVersion: "team.catalog.install_plan.v1",
            executor,
          },
          trace,
        );
        expect(catalogPlan.data.actions[0]).toMatchObject({
          type: "import",
          replace: true,
          requires_confirmation: true,
        });
        const catalogApply = await runJson<TeamCatalogApplyResult>(
          {
            args: ["team", "catalog", "install", "apply", catalogPath, capsuleId, "--json"],
            expectedSchemaVersion: "team.catalog.install_apply.v1",
            executor,
          },
          trace,
        );
        expect(catalogApply.data.download).toMatchObject({
          source_type: "file",
          sha256_verified: true,
        });
        expect(catalogApply.data.import).toMatchObject({
          id: capsuleId,
          source_type: "imported_skr",
          enabled: false,
          replaced: true,
        });
        summary.push({
          step: "team catalog apply",
          detail: `capsule=${catalogApply.data.item_id}; replaced=${catalogApply.data.import.replaced}`,
        });
      }

      const inventory = await runJson<InventoryResult>(
        {
          args: ["consumer", "inventory", "--json"],
          expectedSchemaVersion: "consumer.inventory.v1",
          executor,
        },
        trace,
      );
      expect(inventory.data.capsules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: capsuleId,
            enabled: false,
            readiness: expect.objectContaining({ ok: true }),
          }),
        ]),
      );
      const inventoryCapsule = inventory.data.capsules.find((capsule) => capsule.id === capsuleId);
      summary.push({
        step: "inventory",
        detail: `capsule=${capsuleId}; enabled=${inventoryCapsule?.enabled}; readiness_ok=${inventoryCapsule?.readiness.ok}`,
      });

      await runCommand(["switchboard", "enable", capsuleId], env, trace);
      summary.push({ step: "switchboard enable", detail: `capsule=${capsuleId}; enabled=true` });

      const exposure = await runJson<ExposureResult>(
        {
          args: ["consumer", "exposure", "--json"],
          expectedSchemaVersion: "consumer.exposure.v1",
          executor,
        },
        trace,
      );
      expect(exposure.data.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            capsule_id: capsuleId,
            enabled: true,
            exposed: true,
            readiness_status: "ok",
          }),
        ]),
      );
      const exposedTools = exposure.data.tools.filter((tool) => tool.capsule_id === capsuleId && tool.exposed);
      summary.push({
        step: "exposure",
        detail: `capsule=${capsuleId}; exposed_tools=${exposedTools.length}; readiness=${exposedTools[0]?.readiness_status ?? "missing"}`,
      });

      const routerStatus = await runJson<RouterStatusResult>(
        {
          args: ["router", "status", "--json"],
          expectedSchemaVersion: "router.status.v1",
          executor,
        },
        trace,
      );
      expect(routerStatus.data).toMatchObject({
        ok: true,
        router: {
          snapshot: true,
          capsules: 1,
        },
        error: null,
      });
      expect(routerStatus.data.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            capsule_id: capsuleId,
            name: capsuleId,
          }),
        ]),
      );
      summary.push({
        step: "router status",
        detail: `capsules=${routerStatus.data.router.capsules}; tools=${routerStatus.data.tools.length}; resources=${routerStatus.data.resources.length}`,
      });

      const routerDryRun = await runJson<RouterDryRunResult>(
        {
          args: ["router", "serve", "--mcp", "--dry-run"],
          expectedSchemaVersion: "router.mcp.v1",
          executor,
        },
        trace,
      );
      expect(routerDryRun.data.command).toBe("router serve --mcp");
      expect(routerDryRun.data).toMatchObject({
        mcp: {
          dry_run: true,
          protocol: "model-context-protocol",
          transport: "stdio",
        },
        router: {
          snapshot: true,
          capsules: 1,
        },
      });
      expect(routerDryRun.data.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            capsule_id: capsuleId,
            name: capsuleId,
          }),
        ]),
      );
      summary.push({
        step: "router dry-run",
        detail: `transport=${routerDryRun.data.mcp.transport}; tools=${routerDryRun.data.tools.length}; resources=${routerDryRun.data.resources.length}`,
      });

      const testRun = await runJson<TestRunResult>(
        {
          args: ["test", "--cwd", imported.data.capsule.path],
          expectedSchemaVersion: undefined,
          executor,
        },
        trace,
      );
      expect(testRun.data.ok).toBe(true);
      expect(testRun.data.run_id).toMatch(/^run-/);
      summary.push({
        step: "test",
        detail: `capsule=${capsuleId}; run_id=${testRun.data.run_id}`,
      });

      const runsList = await runJson<RunsListResult>(
        {
          args: [
            "consumer",
            "runs",
            "list",
            "--json",
            "--capsule",
            capsuleId,
            "--source",
            "scan",
            "--limit",
            "5",
          ],
          expectedSchemaVersion: "consumer.runs.list.v1",
          executor,
        },
        trace,
      );
      expect(runsList.data.runs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            run_id: testRun.data.run_id,
            capsule_id: capsuleId,
            status: "succeeded",
            input_included: false,
          }),
        ]),
      );
      expect(runsList.data.scope.source).toBe("scan");
      expect(runsList.data.source?.kind ?? "scan").toBe("scan");
      summary.push({
        step: "runs list scan",
        detail: `capsule=${capsuleId}; runs=${runsList.data.runs.length}; found_run=${testRun.data.run_id}`,
      });

      const indexRebuild = await runJson<RunsIndexRebuildResult>(
        {
          args: ["consumer", "runs", "index", "rebuild", "--json"],
          expectedSchemaVersion: "consumer.runs.index.v1",
          executor,
        },
        trace,
      );
      expect(indexRebuild.data).toMatchObject({
        ok: true,
        capsules_scanned: 1,
      });
      expect(indexRebuild.data.runs_indexed).toBeGreaterThanOrEqual(1);
      assertIsolatedPath(indexRebuild.data.index_path, coreHome);
      summary.push({
        step: "runs index rebuild",
        detail: `index=${indexRebuild.data.index_path}; runs_indexed=${indexRebuild.data.runs_indexed}`,
      });

      const indexStatus = await runJson<RunsIndexStatusResult>(
        {
          args: ["consumer", "runs", "index", "status", "--json"],
          expectedSchemaVersion: "consumer.runs.index.status.v1",
          executor,
        },
        trace,
      );
      expect(indexStatus.data).toMatchObject({
        ok: true,
        index: {
          exists: true,
          readable: true,
          supported_schema: true,
          schema_version: "consumer.runs.index.v1",
          stale: false,
        },
      });
      expect(indexStatus.data.index.runs_indexed).toBeGreaterThanOrEqual(1);
      assertIsolatedPath(indexStatus.data.index_path, coreHome);
      summary.push({
        step: "runs index status",
        detail: `stale=${indexStatus.data.index.stale}; runs_indexed=${indexStatus.data.index.runs_indexed}`,
      });

      const indexedRunsList = await runJson<RunsListResult>(
        {
          args: [
            "consumer",
            "runs",
            "list",
            "--json",
            "--capsule",
            capsuleId,
            "--source",
            "index",
            "--limit",
            "5",
          ],
          expectedSchemaVersion: "consumer.runs.list.v1",
          executor,
        },
        trace,
      );
      expect(indexedRunsList.data.scope.source).toBe("index");
      expect(indexedRunsList.data.source?.kind).toBe("index");
      expect(indexedRunsList.data.runs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            run_id: testRun.data.run_id,
            capsule_id: capsuleId,
            input_included: false,
          }),
        ]),
      );
      summary.push({
        step: "runs list index",
        detail: `capsule=${capsuleId}; runs=${indexedRunsList.data.runs.length}; source=${indexedRunsList.data.source?.kind}`,
      });

      const runsInspect = await runJson<RunsInspectResult>(
        {
          args: [
            "consumer",
            "runs",
            "inspect",
            testRun.data.run_id,
            "--json",
            "--capsule",
            capsuleId,
          ],
          expectedSchemaVersion: "consumer.runs.inspect.v1",
          executor,
        },
        trace,
      );
      expect(runsInspect.data).toMatchObject({
        ok: true,
        run_ref: {
          capsule_id: capsuleId,
          run_id: testRun.data.run_id,
        },
        input: {
          included: false,
          available: true,
        },
        envelope: {
          included: true,
          status: "ok",
        },
        logs: {
          stdout_included: false,
          stderr_included: false,
        },
      });
      summary.push({
        step: "runs inspect",
        detail: `capsule=${runsInspect.data.run_ref.capsule_id}; run_id=${runsInspect.data.run_ref.run_id}; envelope=${runsInspect.data.envelope.status}`,
      });

      printSmokeOutput(summary, trace, coreHome, fakeHome);
    } catch (error) {
      throw new Error(`${classifyFailure(error)}\n\n${formatSmokeOutput(summary, trace, coreHome, fakeHome)}`, {
        cause: error,
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

function createNodeSkillrunExecutor(
  env: NodeJS.ProcessEnv,
  trace: SmokeTraceEntry[],
): CommandExecutor {
  return async (request) => runCommand(request.args, env, trace, request.cwd);
}

async function runJson<TData>(
  options: Parameters<typeof runSkillrunJson<TData>>[0],
  trace: SmokeTraceEntry[],
) {
  try {
    return await runSkillrunJson<TData>(options);
  } catch (error) {
    const last = trace.at(-1);
    if (last !== undefined) {
      last.status = "failed";
    }
    throw error;
  }
}

function runCommand(
  args: string[],
  env: NodeJS.ProcessEnv,
  trace: SmokeTraceEntry[],
  cwd?: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const startedAt = performance.now();
  const command = ["skillrun", ...args].join(" ");

  return new Promise((resolvePromise, reject) => {
    const child = spawn("skillrun", args, { cwd, env });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      const entry = {
        command,
        cwd,
        durationMs: performance.now() - startedAt,
        stderr: error.message,
        status: "failed" as const,
      };
      trace.push(entry);
      reject(error);
    });
    child.on("close", (exitCode) => {
      const entry = {
        command,
        cwd,
        durationMs: performance.now() - startedAt,
        exitCode: exitCode ?? -1,
        stdout: preview(stdout),
        stderr: preview(stderr),
        status: exitCode === 0 ? ("ok" as const) : ("failed" as const),
      };
      trace.push(entry);

      if (exitCode !== 0) {
        reject(new CoreSmokeCommandError(command, exitCode ?? -1, stdout, stderr));
        return;
      }

      resolvePromise({
        exitCode: 0,
        stdout,
        stderr,
      });
    });
  });
}

async function assertIsolatedHome(observedPath: string, expectedRoot: string): Promise<void> {
  const observedRealPath = await realpath(observedPath);
  const expectedRealPath = await realpath(expectedRoot);
  expect(observedRealPath.startsWith(expectedRealPath)).toBe(true);
}

async function findSkrPackage(distPath: string): Promise<string> {
  const entries = await readdir(distPath);
  const packageName = entries.find((entry) => entry.endsWith(".skr"));
  if (packageName === undefined) {
    throw new Error(`Environment blocker: no .skr package was created in ${distPath}.`);
  }
  return join(distPath, packageName);
}

async function writeTeamCatalog(workspace: string, capsuleId: string, packagePath: string): Promise<string> {
  const catalogPath = join(workspace, "team-catalog.json");
  const sha256 = createHash("sha256").update(await readFile(packagePath)).digest("hex");
  await writeFile(
    catalogPath,
    JSON.stringify(
      {
        schema_version: "team.catalog.v1",
        catalog_id: "desktop.smoke",
        name: "Desktop Smoke Catalog",
        updated_at: "2026-05-27T00:00:00Z",
        items: [
          {
            id: capsuleId,
            kind: "skillrun.skr",
            name: "Desktop Smoke Capsule",
            description: "Local file-source Team Catalog smoke item.",
            version: "0.0.0",
            source: {
              type: "file",
              url: packagePath,
              sha256,
            },
          },
        ],
      },
      null,
      2,
    ),
  );
  return catalogPath;
}

async function skillrunSupportsTeamCatalog(
  env: NodeJS.ProcessEnv,
  trace: SmokeTraceEntry[],
): Promise<boolean> {
  const help = await runCommand(["--help"], env, trace);
  return help.stdout.includes("team catalog");
}

function classifyFailure(error: unknown): string {
  if (isMissingCliError(error) || isMissingCliSpawnError(error)) {
    return "Environment blocker: missing `skillrun` CLI. Install or expose `skillrun` on PATH before running `npm run smoke:real-core`.";
  }

  if (error instanceof CoreSmokeCommandError || error instanceof CoreNonZeroExitError) {
    return "Core command failed: real `skillrun` exited non-zero during the isolated smoke loop.";
  }

  if (
    error instanceof CoreJsonParseError ||
    error instanceof CoreContractMismatchError ||
    error instanceof CoreOkFalseError
  ) {
    return "JSON mismatch: real `skillrun` stdout did not match the Desktop Core JSON contract.";
  }

  if (error instanceof CoreRunnerError) {
    return `Core runner failure: ${error.kind}.`;
  }

  return "Environment blocker: real Core smoke harness could not complete.";
}

function isMissingCliSpawnError(error: unknown): boolean {
  return error instanceof CoreSpawnError && isMissingCliError(error.cause);
}

function assertIsolatedPath(observedPath: string, expectedRoot: string): void {
  const observed = resolve(observedPath);
  const expected = resolve(expectedRoot);
  expect(observed === expected || observed.startsWith(`${expected}/`)).toBe(true);
}

function isMissingCliError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT" &&
    "syscall" in error &&
    (error as NodeJS.ErrnoException).syscall === "spawn skillrun"
  );
}

function printSmokeOutput(
  summary: SmokeSummaryEntry[],
  trace: SmokeTraceEntry[],
  coreHome: string,
  fakeHome: string,
): void {
  console.log(formatSmokeOutput(summary, trace, coreHome, fakeHome));
}

function formatSmokeOutput(
  summary: SmokeSummaryEntry[],
  trace: SmokeTraceEntry[],
  coreHome: string,
  fakeHome: string,
): string {
  return `${formatSummary(summary)}\n\n${formatTrace(trace, coreHome, fakeHome)}`;
}

function formatSummary(summary: SmokeSummaryEntry[]): string {
  const lines = [
    "Real Core smoke summary:",
    ...summary.map((entry) => `- ${entry.step}: ${entry.detail}`),
  ];
  return lines.join("\n");
}

function formatTrace(trace: SmokeTraceEntry[], coreHome: string, fakeHome: string): string {
  const lines = [
    "Real Core smoke trace:",
    `SKILLRUN_HOME=${coreHome}`,
    `HOME=${fakeHome}`,
    ...trace.map((entry, index) => {
      const details = [
        `${index + 1}. ${entry.command}`,
        `status=${entry.status}`,
        `exit=${entry.exitCode ?? "spawn-error"}`,
        `durationMs=${Math.round(entry.durationMs)}`,
        entry.cwd ? `cwd=${entry.cwd}` : undefined,
        entry.stdout ? `stdout=${entry.stdout}` : undefined,
        entry.stderr ? `stderr=${entry.stderr}` : undefined,
      ].filter(Boolean);
      return details.join(" | ");
    }),
  ];
  return lines.join("\n");
}

function preview(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
}

class CoreSmokeCommandError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number,
    readonly stdout: string,
    readonly stderr: string,
  ) {
    super(`${command} exited with code ${exitCode}.`);
  }
}
