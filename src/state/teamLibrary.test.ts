import { describe, expect, it } from "vitest";
import {
  buildTeamLibraryApplyState,
  buildTeamLibraryPlanState,
  buildTeamLibraryState,
  loadTeamLibraryInspect,
} from "./teamLibrary";
import type {
  TeamCatalogInstallApplyContract,
  TeamCatalogInstallPlanContract,
  TeamCatalogInspectContract,
  TeamCatalogStatusContract,
} from "../core/contracts";
import teamCatalogInstallApplyFixture from "../core/fixtures/team-catalog-install-apply.v1.json";
import teamCatalogInstallPlanFixture from "../core/fixtures/team-catalog-install-plan.v1.json";
import teamCatalogInspectFixture from "../core/fixtures/team-catalog-inspect.v1.json";
import teamCatalogStatusFixture from "../core/fixtures/team-catalog-status.v1.json";

describe("team library state", () => {
  it("maps inspect contract into read-only team library rows", () => {
    const state = buildTeamLibraryState({
      catalogSource: "/tmp/acme.catalog.json",
      inspect: teamCatalogInspectFixture as TeamCatalogInspectContract,
      status: teamCatalogStatusFixture as TeamCatalogStatusContract,
    });

    expect(state.catalog.id).toBe("acme.internal");
    expect(state.summary.total).toBe(3);
    expect(state.summary.installable).toBe(2);
    expect(state.summary.displayOnly).toBe(1);
    expect(state.summary.blocked).toBe(1);
    expect(state.summary.replaceAvailable).toBe(1);
    expect(state.items[0]).toMatchObject({
      id: "refund",
      state: "replace_available",
      recommendedAction: "replace",
      installPlanAvailable: true,
      installed: true,
      registry: {
        sourceType: "imported_skr",
        enabled: true,
      },
      sourceType: "https",
      sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      publisherName: "Acme Operations",
    });
    expect(state.items[1]).toMatchObject({
      id: "weekly-review",
      kind: "agent.skill",
      state: "display_only",
    });
    expect(state.items[2]).toMatchObject({
      id: "legacy-local",
      state: "blocked",
      recommendedAction: "resolve_conflict",
      installPlanAvailable: false,
      installed: true,
      registry: {
        sourceType: "local_path",
      },
    });
  });

  it("maps install plan contract without applying it", () => {
    const state = buildTeamLibraryPlanState({
      plan: teamCatalogInstallPlanFixture as TeamCatalogInstallPlanContract,
    });

    expect(state).toMatchObject({
      catalogId: "acme.internal",
      itemId: "refund",
      sourceType: "https",
      registry: {
        installed: false,
        enabled: null,
      },
    });
    expect(state.actions).toEqual([
      {
        type: "import",
        replace: false,
        requiresConfirmation: false,
      },
    ]);
    expect(state.safetyCopy).toContain("preview only");
  });

  it("maps install apply contract without enabling or mounting", () => {
    const state = buildTeamLibraryApplyState({
      apply: teamCatalogInstallApplyFixture as TeamCatalogInstallApplyContract,
    });

    expect(state).toMatchObject({
      catalogId: "acme.internal",
      itemId: "refund",
      download: {
        sourceType: "file",
        sha256Verified: true,
      },
      imported: {
        id: "refund",
        sourceType: "imported_skr",
        enabled: false,
        replaced: false,
      },
    });
    expect(state.nextSteps).toHaveLength(3);
    expect(state.safetyCopy).toContain("does not enable");
  });

  it("loads inspect details and status through Core before building rows", async () => {
    const calls: string[] = [];
    const result = await loadTeamLibraryInspect({
      catalogPath: "/tmp/acme.catalog.json",
      executor: async (request) => {
        calls.push(request.args.join(" "));
        if (request.args.includes("status")) {
          return {
            exitCode: 0,
            stdout: JSON.stringify(teamCatalogStatusFixture),
            stderr: "",
          };
        }
        return {
          exitCode: 0,
          stdout: JSON.stringify(teamCatalogInspectFixture),
          stderr: "",
        };
      },
    });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") {
      throw new Error("expected ready team library result");
    }
    expect(calls).toEqual([
      "team catalog inspect /tmp/acme.catalog.json --json",
      "team catalog status /tmp/acme.catalog.json --json",
    ]);
    expect(result.state.items[0]).toMatchObject({
      id: "refund",
      state: "replace_available",
      recommendedAction: "replace",
    });
  });
});
