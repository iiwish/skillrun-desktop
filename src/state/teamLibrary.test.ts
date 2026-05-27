import { describe, expect, it } from "vitest";
import {
  buildTeamLibraryApplyState,
  buildTeamLibraryPlanState,
  buildTeamLibraryState,
} from "./teamLibrary";
import type {
  TeamCatalogInstallApplyContract,
  TeamCatalogInstallPlanContract,
  TeamCatalogInspectContract,
} from "../core/contracts";
import teamCatalogInstallApplyFixture from "../core/fixtures/team-catalog-install-apply.v1.json";
import teamCatalogInstallPlanFixture from "../core/fixtures/team-catalog-install-plan.v1.json";
import teamCatalogInspectFixture from "../core/fixtures/team-catalog-inspect.v1.json";

describe("team library state", () => {
  it("maps inspect contract into read-only team library rows", () => {
    const state = buildTeamLibraryState({
      catalogSource: "/tmp/acme.catalog.json",
      inspect: teamCatalogInspectFixture as TeamCatalogInspectContract,
    });

    expect(state.catalog.id).toBe("acme.internal");
    expect(state.summary.total).toBe(3);
    expect(state.summary.installable).toBe(1);
    expect(state.summary.displayOnly).toBe(1);
    expect(state.summary.blocked).toBe(1);
    expect(state.items[0]).toMatchObject({
      id: "refund",
      state: "not_installed",
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
      installed: true,
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
});
