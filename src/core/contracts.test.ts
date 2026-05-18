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
  parseRunsInspectContract,
  parseRunsListContract,
  type DesktopCoreContract,
} from "./contracts";
import exposureFixture from "./fixtures/consumer-exposure.v1.json";
import inventoryFixture from "./fixtures/consumer-inventory.v1.json";
import mountApplyFixture from "./fixtures/consumer-mount-apply.v1.json";
import mountPlanFixture from "./fixtures/consumer-mount-plan.v1.json";
import mountRollbackFixture from "./fixtures/consumer-mount-rollback.v1.json";
import runsInspectFixture from "./fixtures/consumer-runs-inspect.v1.json";
import runsListFixture from "./fixtures/consumer-runs-list.v1.json";
import hostStatusFixture from "./fixtures/host-status.v1.json";
import importFixture from "./fixtures/import.v1.json";
import routerDryRunFixture from "./fixtures/router-dry-run.v1.json";

type ContractParser = (input: unknown) => DesktopCoreContract;

const parserCases: Array<{
  name: string;
  parser: ContractParser;
  fixture: unknown;
  schemaVersion: string;
}> = [
  {
    name: "host status",
    parser: parseHostStatusContract,
    fixture: hostStatusFixture,
    schemaVersion: "host.status.v1",
  },
  { name: "import", parser: parseImportContract, fixture: importFixture, schemaVersion: "import.v1" },
  {
    name: "consumer inventory",
    parser: parseConsumerInventoryContract,
    fixture: inventoryFixture,
    schemaVersion: "consumer.inventory.v1",
  },
  {
    name: "consumer exposure",
    parser: parseConsumerExposureContract,
    fixture: exposureFixture,
    schemaVersion: "consumer.exposure.v1",
  },
  {
    name: "router dry run",
    parser: parseRouterDryRunContract,
    fixture: routerDryRunFixture,
    schemaVersion: "router.mcp.v1",
  },
  {
    name: "mount plan",
    parser: parseMountPlanContract,
    fixture: mountPlanFixture,
    schemaVersion: "consumer.mount_plan.v1",
  },
  {
    name: "mount apply",
    parser: parseMountApplyContract,
    fixture: mountApplyFixture,
    schemaVersion: "consumer.mount_apply.v1",
  },
  {
    name: "mount rollback",
    parser: parseMountRollbackContract,
    fixture: mountRollbackFixture,
    schemaVersion: "consumer.mount_rollback.v1",
  },
  {
    name: "runs list",
    parser: parseRunsListContract,
    fixture: runsListFixture,
    schemaVersion: "consumer.runs.list.v1",
  },
  {
    name: "runs inspect",
    parser: parseRunsInspectContract,
    fixture: runsInspectFixture,
    schemaVersion: "consumer.runs.inspect.v1",
  },
];

describe("desktop core contract parsers", () => {
  it.each(parserCases)("parses $name fixture", ({ parser, fixture, schemaVersion }) => {
    expect(parser(fixture).schema_version).toBe(schemaVersion);
  });

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
