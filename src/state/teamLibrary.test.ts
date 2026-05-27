import { describe, expect, it } from "vitest";
import { buildTeamLibraryState } from "./teamLibrary";
import type { TeamCatalogInspectContract } from "../core/contracts";
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
});
