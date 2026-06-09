import { describe, expect, it } from "vitest";
import {
  fetchTeamCatalogInstallApply,
  fetchTeamCatalogInstallPlan,
  fetchTeamCatalogInspect,
  fetchTeamCatalogStatus,
} from "./teamLibraryService";
import type { CommandExecutor } from "./runner";
import teamCatalogInstallApplyFixture from "./fixtures/team-catalog-install-apply.v1.json";
import teamCatalogInstallPlanFixture from "./fixtures/team-catalog-install-plan.v1.json";
import teamCatalogInspectFixture from "./fixtures/team-catalog-inspect.v1.json";
import teamCatalogStatusFixture from "./fixtures/team-catalog-status.v1.json";

describe("fetchTeamCatalogInspect", () => {
  it("calls Core team catalog inspect without plan or apply", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify(teamCatalogInspectFixture),
        stderr: "",
      };
    };

    const result = await fetchTeamCatalogInspect({
      catalogPath: "/Users/iiwish/team/catalog.json",
      executor,
      now: () => 1_000,
    });

    expect(result.contract.schema_version).toBe("team.catalog.inspect.v1");
    expect(calls).toEqual([
      {
        command: "skillrun",
        args: ["team", "catalog", "inspect", "/Users/iiwish/team/catalog.json", "--json"],
        cwd: undefined,
      },
    ]);
    expect(calls.map((call) => call.args.join(" "))).not.toContain("team catalog install plan");
    expect(calls.map((call) => call.args.join(" "))).not.toContain("team catalog install apply");
  });

  it("calls Core team catalog status without plan or apply", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify(teamCatalogStatusFixture),
        stderr: "",
      };
    };

    const result = await fetchTeamCatalogStatus({
      catalogPath: "/Users/iiwish/team/catalog.json",
      executor,
      now: () => 1_000,
    });

    expect(result.contract.schema_version).toBe("team.catalog.status.v1");
    expect(calls).toEqual([
      {
        command: "skillrun",
        args: ["team", "catalog", "status", "/Users/iiwish/team/catalog.json", "--json"],
        cwd: undefined,
      },
    ]);
    expect(calls.map((call) => call.args.join(" "))).not.toContain("team catalog install plan");
    expect(calls.map((call) => call.args.join(" "))).not.toContain("team catalog install apply");
  });

  it("calls Core install plan without apply", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify(teamCatalogInstallPlanFixture),
        stderr: "",
      };
    };

    const result = await fetchTeamCatalogInstallPlan({
      catalogPath: "/Users/iiwish/team/catalog.json",
      itemId: "refund",
      executor,
      now: () => 1_000,
    });

    expect(result.contract.schema_version).toBe("team.catalog.install_plan.v1");
    expect(calls).toEqual([
      {
        command: "skillrun",
        args: [
          "team",
          "catalog",
          "install",
          "plan",
          "/Users/iiwish/team/catalog.json",
          "refund",
          "--json",
        ],
        cwd: undefined,
      },
    ]);
    expect(calls.map((call) => call.args.join(" "))).not.toContain("team catalog install apply");
  });

  it("calls Core install apply only through the Team Catalog apply surface", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: JSON.stringify(teamCatalogInstallApplyFixture),
        stderr: "",
      };
    };

    const result = await fetchTeamCatalogInstallApply({
      catalogPath: "/Users/iiwish/team/catalog.json",
      itemId: "refund",
      executor,
      now: () => 1_000,
    });

    expect(result.contract.schema_version).toBe("team.catalog.install_apply.v1");
    expect(calls).toEqual([
      {
        command: "skillrun",
        args: [
          "team",
          "catalog",
          "install",
          "apply",
          "/Users/iiwish/team/catalog.json",
          "refund",
          "--json",
        ],
        cwd: undefined,
      },
    ]);
    expect(calls.map((call) => call.args.join(" "))).not.toContain("import");
  });

  it("passes remote catalog URLs to read-only Core catalog surfaces without apply", async () => {
    const calls: Parameters<CommandExecutor>[0][] = [];
    const executor: CommandExecutor = async (request) => {
      calls.push(request);
      const stdout = request.args.includes("inspect")
        ? teamCatalogInspectFixture
        : request.args.includes("status")
          ? teamCatalogStatusFixture
          : teamCatalogInstallPlanFixture;
      return {
        exitCode: 0,
        stdout: JSON.stringify(stdout),
        stderr: "",
      };
    };
    const catalogUrl = "https://example.com/team.catalog.json";

    await fetchTeamCatalogInspect({
      catalogPath: catalogUrl,
      executor,
      now: () => 1_000,
    });
    await fetchTeamCatalogStatus({
      catalogPath: catalogUrl,
      executor,
      now: () => 1_000,
    });
    await fetchTeamCatalogInstallPlan({
      catalogPath: catalogUrl,
      itemId: "refund",
      executor,
      now: () => 1_000,
    });

    expect(calls.map((call) => call.args)).toEqual([
      ["team", "catalog", "inspect", catalogUrl, "--json"],
      ["team", "catalog", "status", catalogUrl, "--json"],
      ["team", "catalog", "install", "plan", catalogUrl, "refund", "--json"],
    ]);
    expect(calls.map((call) => call.args.join(" "))).not.toContain("team catalog install apply");
  });
});
