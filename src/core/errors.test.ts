import { describe, expect, it } from "vitest";
import {
  CoreContractMismatchError,
  CoreJsonParseError,
  CoreNonZeroExitError,
  CoreOkFalseError,
  CoreSpawnError,
  CoreStaleRefreshError,
  type CoreCommandRequest,
} from "./errors";

const command: CoreCommandRequest = {
  command: "skillrun",
  args: ["host", "status", "--json"],
  cwd: "D:\\data\\skillrun-desktop",
};

describe("core runner errors", () => {
  it("preserves diagnostic command metadata", () => {
    const error = new CoreNonZeroExitError(command, {
      durationMs: 12,
      exitCode: 2,
      stdout: "",
      stderr: "failed",
    });

    expect(error.kind).toBe("non_zero_exit");
    expect(error.command.args).toEqual(["host", "status", "--json"]);
    expect(error.stderr).toBe("failed");
  });

  it("has distinct typed failure classes", () => {
    expect(new CoreSpawnError(command, new Error("missing")).kind).toBe("spawn_failure");
    expect(new CoreJsonParseError(command, "{", "bad").kind).toBe("json_parse_failure");
    expect(new CoreContractMismatchError(command, "schema_version", "bad").kind).toBe(
      "contract_mismatch",
    );
    expect(new CoreOkFalseError(command, { ok: false, error: "bad" }).kind).toBe("ok_false");
    expect(new CoreStaleRefreshError(command, 10_000, 1_000).kind).toBe("stale_refresh");
  });
});
