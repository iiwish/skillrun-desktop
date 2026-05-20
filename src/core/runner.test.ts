import { describe, expect, it } from "vitest";
import {
  CoreContractMismatchError,
  CoreJsonParseError,
  CoreNonZeroExitError,
  CoreOkFalseError,
  CoreSpawnError,
  CoreStaleRefreshError,
} from "./errors";
import { runSkillrunJson, type CommandExecutor } from "./runner";

const fixedNow = () => 1_000;

function executorWith(stdout: string, overrides = {}): CommandExecutor {
  return async () => ({
    exitCode: 0,
    stdout,
    stderr: "",
    ...overrides,
  });
}

describe("runSkillrunJson", () => {
  it("invokes skillrun with an args array and parses stdout JSON", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify({ ok: true, schema_version: "host.status.v1", value: 42 }),
        stderr: "diagnostic",
      };
    };

    const result = await runSkillrunJson<{ value: number }>({
      args: ["host", "status", "--json"],
      cwd: "D:\\data\\skillrun-desktop",
      expectedSchemaVersion: "host.status.v1",
      executor,
      now: fixedNow,
    });

    expect(calls).toEqual([
      {
        command: "skillrun",
        args: ["host", "status", "--json"],
        cwd: "D:\\data\\skillrun-desktop",
      },
    ]);
    expect(result.data.value).toBe(42);
    expect(result.stderr).toBe("diagnostic");
    expect(result.durationMs).toBe(0);
  });

  it("preserves POSIX cwd and arguments when invoking skillrun", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify({ ok: true, schema_version: "import.v1" }),
        stderr: "",
      };
    };

    await runSkillrunJson({
      args: ["import", "/Users/iiwish/Downloads/refund-helper.skr", "--json"],
      cwd: "/Users/iiwish/code/skillrun-desktop",
      expectedSchemaVersion: "import.v1",
      executor,
      now: fixedNow,
    });

    expect(calls).toEqual([
      {
        command: "skillrun",
        args: ["import", "/Users/iiwish/Downloads/refund-helper.skr", "--json"],
        cwd: "/Users/iiwish/code/skillrun-desktop",
      },
    ]);
  });

  it("wraps executor failures as spawn failures", async () => {
    await expect(
      runSkillrunJson({
        args: ["host", "status", "--json"],
        executor: async () => {
          throw new Error("ENOENT");
        },
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(CoreSpawnError);
  });

  it("fails closed on non-zero exit", async () => {
    await expect(
      runSkillrunJson({
        args: ["host", "status", "--json"],
        executor: executorWith("{}", { exitCode: 1, stderr: "boom" }),
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(CoreNonZeroExitError);
  });

  it("parses JSON only from stdout", async () => {
    await expect(
      runSkillrunJson({
        args: ["host", "status", "--json"],
        executor: executorWith("", { stderr: JSON.stringify({ ok: true }) }),
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(CoreJsonParseError);
  });

  it("rejects schema version mismatches", async () => {
    await expect(
      runSkillrunJson({
        args: ["host", "status", "--json"],
        expectedSchemaVersion: "host.status.v1",
        executor: executorWith(JSON.stringify({ ok: true, schema_version: "wrong" })),
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(CoreContractMismatchError);
  });

  it("rejects ok=false responses", async () => {
    await expect(
      runSkillrunJson({
        args: ["host", "status", "--json"],
        executor: executorWith(JSON.stringify({ ok: false, error: "not ready" })),
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(CoreOkFalseError);
  });

  it("rejects stale snapshots when freshness metadata is provided", async () => {
    await expect(
      runSkillrunJson({
        args: ["host", "status", "--json"],
        executor: executorWith(
          JSON.stringify({ ok: true, schema_version: "host.status.v1", refreshed_at_ms: 0 }),
        ),
        expectedSchemaVersion: "host.status.v1",
        maxAgeMs: 500,
        now: fixedNow,
      }),
    ).rejects.toBeInstanceOf(CoreStaleRefreshError);
  });
});
