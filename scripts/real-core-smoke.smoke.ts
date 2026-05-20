import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
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
      summary.push({
        step: "import",
        detail: `capsule=${imported.data.capsule.id}; enabled=${imported.data.capsule.enabled}`,
      });

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
