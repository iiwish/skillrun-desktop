import { describe, expect, it } from "vitest";
import { runImportFlow } from "./importFlow";
import importFixture from "../core/fixtures/import.v1.json";
import importPosixFixture from "../core/fixtures/import.posix.v1.json";
import type { CommandExecutor } from "../core/runner";

describe("import flow", () => {
  it("imports a .skr through the Core runner and enters capsule review", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify(importFixture),
        stderr: "",
      };
    };

    const state = await runImportFlow({
      packagePath: "D:\\packages\\refund-helper.skr",
      executor,
      cwd: "D:\\data\\skillrun-desktop",
      now: () => 100,
    });

    expect(calls).toEqual([
      {
        command: "skillrun",
        args: ["import", "D:\\packages\\refund-helper.skr", "--json"],
        cwd: "D:\\data\\skillrun-desktop",
      },
    ]);
    expect(state.status).toBe("review_ready");
    expect(state.capsule?.enabled).toBe(false);
    expect(state.safetyCopy).toContain("does not mark this capsule trusted");
  });

  it("does not call enable or mount after import", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify(importFixture),
        stderr: "",
      };
    };

    await runImportFlow({
      packagePath: "D:\\packages\\refund-helper.skr",
      executor,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].args).not.toContain("enable");
    expect(calls[0].args).not.toContain("mount");
  });

  it("imports a POSIX .skr path and preserves the imported capsule path", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify(importPosixFixture),
        stderr: "",
      };
    };

    const state = await runImportFlow({
      packagePath: "/Users/iiwish/Downloads/refund-helper.skr",
      executor,
      cwd: "/Users/iiwish/code/skillrun-desktop",
      now: () => 100,
    });

    expect(calls).toEqual([
      {
        command: "skillrun",
        args: ["import", "/Users/iiwish/Downloads/refund-helper.skr", "--json"],
        cwd: "/Users/iiwish/code/skillrun-desktop",
      },
    ]);
    expect(state.status).toBe("review_ready");
    expect(state.capsule?.path).toBe("/Users/iiwish/.skillrun/imports/refund-helper");
  });

  it("returns an error state for non-.skr paths before calling Core", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const state = await runImportFlow({
      packagePath: "D:\\packages\\refund-helper.zip",
      executor: async (request) => {
        calls.push(request);
        return { exitCode: 0, stdout: "{}", stderr: "" };
      },
    });

    expect(calls).toHaveLength(0);
    expect(state.status).toBe("error");
    expect(state.error?.kind).toBe("invalid_package_path");
  });

  it("preserves Core failures without guessing repair", async () => {
    const state = await runImportFlow({
      packagePath: "D:\\packages\\refund-helper.skr",
      executor: async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "registry id already exists",
      }),
    });

    expect(state.status).toBe("error");
    expect(state.error?.kind).toBe("non_zero_exit");
    expect(state.error?.message).toContain("skillrun import");
  });

  it("fails closed when imported capsule review fields are malformed", async () => {
    const malformedFixture = {
      ...importFixture,
      capsule: {
        ...importFixture.capsule,
        id: 42,
      },
    };

    const state = await runImportFlow({
      packagePath: "D:\\packages\\refund-helper.skr",
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify(malformedFixture),
        stderr: "",
      }),
    });

    expect(state.status).toBe("error");
    expect(state.error?.kind).toBe("contract_mismatch");
  });
});
