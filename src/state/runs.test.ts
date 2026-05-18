import { describe, expect, it } from "vitest";
import runsListFixture from "../core/fixtures/consumer-runs-list.v1.json";
import runsInspectFixture from "../core/fixtures/consumer-runs-inspect.v1.json";
import type { CommandExecutor } from "../core/runner";
import {
  buildRunDetailState,
  inspectRun,
  loadRunsList,
} from "./runs";
import type { RunsInspectContract } from "../core/contracts";

describe("runs state", () => {
  it("loads runs list through Core with capsule and limit filters", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const result = await loadRunsList({
      capsuleId: "refund-helper",
      limit: 5,
      executor: runsExecutor(calls, { list: runsListWithRun() }),
      cwd: "D:\\data\\skillrun-desktop",
      now: () => 100,
    });

    expect(calls.map((call) => call.args)).toEqual([
      ["consumer", "runs", "list", "--json", "--capsule", "refund-helper", "--limit", "5"],
    ]);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.state.runs[0].runId).toBe("run-001");
      expect(result.state.runs[0].inputIncluded).toBe(false);
    }
  });

  it("inspects a run through Core using run id and capsule id", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const result = await inspectRun({
      runId: "run-001",
      capsuleId: "refund-helper",
      executor: runsExecutor(calls, { inspect: runsInspectFixture }),
    });

    expect(calls.map((call) => call.args)).toEqual([
      ["consumer", "runs", "inspect", "run-001", "--json", "--capsule", "refund-helper"],
    ]);
    expect(result.status).toBe("ready");
  });

  it("maps inspect details without leaking input, log, or artifact content", () => {
    const state = buildRunDetailState({
      inspect: {
        ...(runsInspectFixture as RunsInspectContract),
        input: {
          included: true,
          available: true,
          value: { secret: "do-not-show-input" },
        },
        envelope: {
          included: true,
          status: "ok",
          value: {
            ok: true,
            output: "do-not-show-output",
            artifacts: [
              {
                name: "report",
                kind: "json",
                path: "report.json",
                content: "do-not-show-artifact",
              },
            ],
          },
        },
        artifacts: [
          {
            name: "report",
            kind: "json",
            path: "report.json",
            available: true,
            content: "do-not-show-artifact",
          },
        ],
        logs: {
          stdout_available: true,
          stderr_available: true,
          stdout_included: true,
          stderr_included: true,
          stdout: "do-not-show-stdout",
          stderr: "do-not-show-stderr",
        },
      },
    });

    const serialized = JSON.stringify(state);
    expect(state.input).toEqual({ included: true, available: true });
    expect(state.logs).toEqual({
      stdoutAvailable: true,
      stderrAvailable: true,
      stdoutIncluded: true,
      stderrIncluded: true,
    });
    expect(state.artifacts).toEqual([
      {
        name: "report",
        kind: "json",
        path: "report.json",
        available: true,
      },
    ]);
    expect(state.envelope.valueSummary).toEqual({
      type: "object",
      keys: ["artifacts", "ok", "output"],
    });
    expect(serialized).not.toContain("do-not-show-input");
    expect(serialized).not.toContain("do-not-show-output");
    expect(serialized).not.toContain("do-not-show-artifact");
    expect(serialized).not.toContain("do-not-show-stdout");
    expect(serialized).not.toContain("do-not-show-stderr");
  });

  it("surfaces inspect ok=false error code and matches", async () => {
    const result = await inspectRun({
      runId: "ambiguous-run",
      capsuleId: "refund-helper",
      executor: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          command: "consumer runs inspect",
          schema_version: "consumer.runs.inspect.v1",
          registry_path: "C:/Users/iiwish/.skillrun/registry.json",
          ok: false,
          error: {
            code: "AmbiguousRunId",
            message: "run_id matched multiple registered capsules",
          },
          matches: [
            { kind: "local_run", capsule_id: "capsule-a", run_id: "ambiguous-run" },
            { kind: "local_run", capsule_id: "capsule-b", run_id: "ambiguous-run" },
          ],
        }),
        stderr: "",
      }),
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.kind).toBe("ok_false");
      expect(result.error.code).toBe("AmbiguousRunId");
      expect(result.error.matches.map((match) => match.capsuleId)).toEqual(["capsule-a", "capsule-b"]);
    }
  });
});

function runsListWithRun() {
  return {
    ...runsListFixture,
    runs: [
      {
        run_id: "run-001",
        run_ref: { kind: "local_run", capsule_id: "refund-helper", run_id: "run-001" },
        capsule_id: "refund-helper",
        capsule_path: "C:/Users/iiwish/.skillrun/imports/refund-helper",
        mode: "run",
        status: "ok",
        ok: true,
        error_code: null,
        started_at: "2026-05-18T00:00:00Z",
        finished_at: "2026-05-18T00:00:01Z",
        duration_ms: 1000,
        manifest_sha256: "manifest-hash",
        skill_sha256: "skill-hash",
        action_sha256: "action-hash",
        artifact_count: 1,
        input_included: false,
      },
    ],
  };
}

function runsExecutor(
  calls: Parameters<CommandExecutor>[0][],
  contracts: { list?: unknown; inspect?: unknown },
): CommandExecutor {
  return async (request) => {
    calls.push(request);
    const args = request.args.join(" ");
    if (args === "consumer runs list --json --capsule refund-helper --limit 5") {
      return { exitCode: 0, stdout: JSON.stringify(contracts.list), stderr: "" };
    }
    if (args === "consumer runs inspect run-001 --json --capsule refund-helper") {
      return { exitCode: 0, stdout: JSON.stringify(contracts.inspect), stderr: "" };
    }
    return { exitCode: 1, stdout: "", stderr: `unexpected command: ${args}` };
  };
}
