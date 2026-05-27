import { describe, expect, it } from "vitest";
import { fetchTeamCatalogInspect } from "./teamLibraryService";
import type { CommandExecutor } from "./runner";
import teamCatalogInspectFixture from "./fixtures/team-catalog-inspect.v1.json";

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
});
