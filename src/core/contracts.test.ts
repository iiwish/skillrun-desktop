import { describe, expect, it } from "vitest";
import { CoreContractMismatchError } from "./errors";
import {
  parseConsumerExposureContract,
  parseConsumerInventoryContract,
  parseHostStatusContract,
  parseImportContract,
  parseMountApplyContract,
  parseMountPlanContract,
  parseMountRollbackContract,
  parseRouterDryRunContract,
  parseRouterStatusContract,
  parseRunsIndexRebuildContract,
  parseRunsIndexStatusContract,
  parseRunsInspectContract,
  parseRunsListContract,
  parseTeamCatalogInstallApplyContract,
  parseTeamCatalogInstallPlanContract,
  parseTeamCatalogInspectContract,
  parseTeamCatalogStatusContract,
  type DesktopCoreContract,
} from "./contracts";
import exposureFixture from "./fixtures/consumer-exposure.v1.json";
import exposurePosixFixture from "./fixtures/consumer-exposure.posix.v1.json";
import inventoryFixture from "./fixtures/consumer-inventory.v1.json";
import inventoryPosixFixture from "./fixtures/consumer-inventory.posix.v1.json";
import mountApplyFixture from "./fixtures/consumer-mount-apply.v1.json";
import mountApplyPosixFixture from "./fixtures/consumer-mount-apply.posix.v1.json";
import mountPlanFixture from "./fixtures/consumer-mount-plan.v1.json";
import mountPlanPosixFixture from "./fixtures/consumer-mount-plan.posix.v1.json";
import mountRollbackFixture from "./fixtures/consumer-mount-rollback.v1.json";
import mountRollbackPosixFixture from "./fixtures/consumer-mount-rollback.posix.v1.json";
import runsIndexRebuildFixture from "./fixtures/consumer-runs-index-rebuild.v1.json";
import runsIndexStatusFixture from "./fixtures/consumer-runs-index-status.v1.json";
import runsInspectFixture from "./fixtures/consumer-runs-inspect.v1.json";
import runsInspectPosixFixture from "./fixtures/consumer-runs-inspect.posix.v1.json";
import runsListFixture from "./fixtures/consumer-runs-list.v1.json";
import runsListPosixFixture from "./fixtures/consumer-runs-list.posix.v1.json";
import hostStatusFixture from "./fixtures/host-status.v1.json";
import hostStatusPosixFixture from "./fixtures/host-status.posix.v1.json";
import importFixture from "./fixtures/import.v1.json";
import importPosixFixture from "./fixtures/import.posix.v1.json";
import routerDryRunFixture from "./fixtures/router-dry-run.v1.json";
import routerStatusFixture from "./fixtures/router-status.v1.json";
import teamCatalogInstallApplyFixture from "./fixtures/team-catalog-install-apply.v1.json";
import teamCatalogInstallPlanFixture from "./fixtures/team-catalog-install-plan.v1.json";
import teamCatalogInspectFixture from "./fixtures/team-catalog-inspect.v1.json";
import teamCatalogStatusFixture from "./fixtures/team-catalog-status.v1.json";

type ContractParser = (input: unknown) => DesktopCoreContract;

const parserCases: Array<{
  name: string;
  parser: ContractParser;
  fixture: unknown;
  posixFixture?: unknown;
  schemaVersion: string;
}> = [
  {
    name: "host status",
    parser: parseHostStatusContract,
    fixture: hostStatusFixture,
    posixFixture: hostStatusPosixFixture,
    schemaVersion: "host.status.v1",
  },
  {
    name: "import",
    parser: parseImportContract,
    fixture: importFixture,
    posixFixture: importPosixFixture,
    schemaVersion: "import.v1",
  },
  {
    name: "consumer inventory",
    parser: parseConsumerInventoryContract,
    fixture: inventoryFixture,
    posixFixture: inventoryPosixFixture,
    schemaVersion: "consumer.inventory.v1",
  },
  {
    name: "consumer exposure",
    parser: parseConsumerExposureContract,
    fixture: exposureFixture,
    posixFixture: exposurePosixFixture,
    schemaVersion: "consumer.exposure.v1",
  },
  {
    name: "router dry run",
    parser: parseRouterDryRunContract,
    fixture: routerDryRunFixture,
    schemaVersion: "router.mcp.v1",
  },
  {
    name: "router status",
    parser: parseRouterStatusContract,
    fixture: routerStatusFixture,
    schemaVersion: "router.status.v1",
  },
  {
    name: "mount plan",
    parser: parseMountPlanContract,
    fixture: mountPlanFixture,
    posixFixture: mountPlanPosixFixture,
    schemaVersion: "consumer.mount_plan.v1",
  },
  {
    name: "mount apply",
    parser: parseMountApplyContract,
    fixture: mountApplyFixture,
    posixFixture: mountApplyPosixFixture,
    schemaVersion: "consumer.mount_apply.v1",
  },
  {
    name: "mount rollback",
    parser: parseMountRollbackContract,
    fixture: mountRollbackFixture,
    posixFixture: mountRollbackPosixFixture,
    schemaVersion: "consumer.mount_rollback.v1",
  },
  {
    name: "runs list",
    parser: parseRunsListContract,
    fixture: runsListFixture,
    posixFixture: runsListPosixFixture,
    schemaVersion: "consumer.runs.list.v1",
  },
  {
    name: "runs index rebuild",
    parser: parseRunsIndexRebuildContract,
    fixture: runsIndexRebuildFixture,
    schemaVersion: "consumer.runs.index.v1",
  },
  {
    name: "runs index status",
    parser: parseRunsIndexStatusContract,
    fixture: runsIndexStatusFixture,
    schemaVersion: "consumer.runs.index.status.v1",
  },
  {
    name: "runs inspect",
    parser: parseRunsInspectContract,
    fixture: runsInspectFixture,
    posixFixture: runsInspectPosixFixture,
    schemaVersion: "consumer.runs.inspect.v1",
  },
  {
    name: "team catalog inspect",
    parser: parseTeamCatalogInspectContract,
    fixture: teamCatalogInspectFixture,
    schemaVersion: "team.catalog.inspect.v1",
  },
  {
    name: "team catalog status",
    parser: parseTeamCatalogStatusContract,
    fixture: teamCatalogStatusFixture,
    schemaVersion: "team.catalog.status.v1",
  },
  {
    name: "team catalog install plan",
    parser: parseTeamCatalogInstallPlanContract,
    fixture: teamCatalogInstallPlanFixture,
    schemaVersion: "team.catalog.install_plan.v1",
  },
  {
    name: "team catalog install apply",
    parser: parseTeamCatalogInstallApplyContract,
    fixture: teamCatalogInstallApplyFixture,
    schemaVersion: "team.catalog.install_apply.v1",
  },
];

describe("desktop core contract parsers", () => {
  it.each(parserCases)("parses $name fixture", ({ parser, fixture, schemaVersion }) => {
    expect(parser(fixture).schema_version).toBe(schemaVersion);
  });

  it.each(parserCases.filter((entry) => entry.posixFixture))(
    "parses $name POSIX path fixture",
    ({ parser, posixFixture, schemaVersion }) => {
      expect(parser(posixFixture).schema_version).toBe(schemaVersion);
    },
  );

  it("fails closed when schema_version is missing", () => {
    const invalid = { ...hostStatusFixture };
    delete (invalid as Record<string, unknown>).schema_version;

    expect(() => parseHostStatusContract(invalid)).toThrow(CoreContractMismatchError);
  });

  it("fails closed when required nested fields are missing", () => {
    const invalid = structuredClone(mountPlanFixture);
    delete (invalid.router as Record<string, unknown>).args;

    expect(() => parseMountPlanContract(invalid)).toThrow(CoreContractMismatchError);
  });
});
