import { CoreContractMismatchError, type CoreCommandRequest } from "../errors";

export type HostStatusContract = {
  command: "host status";
  schema_version: "host.status.v1";
  ok: true;
  binary: Record<string, unknown>;
  desktop_contract: Record<string, unknown>;
  contracts: Record<string, unknown>;
  platform: Record<string, unknown>;
  paths: Record<string, unknown>;
  capabilities: unknown[];
  boundaries: Record<string, unknown>;
  warnings: unknown[];
};

export type ImportContract = {
  command: "import";
  schema_version: "import.v1";
  ok: true;
  package_path: string;
  registry_path: string;
  capsule: Record<string, unknown>;
  warnings: unknown[];
};

export type ConsumerInventoryContract = {
  command: "consumer inventory";
  schema_version: "consumer.inventory.v1";
  version: number;
  registry_path: string;
  capsules: unknown[];
};

export type ConsumerExposureContract = {
  command: "consumer exposure";
  schema_version: "consumer.exposure.v1";
  registry_path: string;
  tools: unknown[];
};

export type RouterDryRunContract = {
  command: "router serve --mcp";
  schema_version: "router.mcp.v1";
  mcp: Record<string, unknown>;
  router: Record<string, unknown>;
  tools: unknown[];
  resources: unknown[];
};

export type RouterStatusContract = {
  command: "router status";
  schema_version: "router.status.v1";
  ok: boolean;
  router: Record<string, unknown>;
  tools: unknown[];
  resources: unknown[];
  error: Record<string, unknown> | null;
};

export type MountPlanContract = {
  command: "consumer mount plan";
  schema_version: "consumer.mount_plan.v1";
  client: Record<string, unknown>;
  operation: string;
  config: Record<string, unknown> | null;
  backup: Record<string, unknown> | null;
  router: Record<string, unknown>;
  changes: unknown[];
  warnings: unknown[];
};

export type MountApplyContract = {
  command: "consumer mount apply";
  schema_version: "consumer.mount_apply.v1";
  client: Record<string, unknown>;
  config: Record<string, unknown>;
  backup: Record<string, unknown> | null;
  applied: boolean;
  changes: unknown[];
  warnings: unknown[];
};

export type MountRollbackContract = {
  command: "consumer mount rollback";
  schema_version: "consumer.mount_rollback.v1";
  client: Record<string, unknown>;
  config: Record<string, unknown>;
  backup: Record<string, unknown>;
  rolled_back: boolean;
  warnings: unknown[];
};

export type RunsListContract = {
  command: "consumer runs list";
  schema_version: "consumer.runs.list.v1";
  registry_path: string;
  source?: Record<string, unknown>;
  scope: Record<string, unknown>;
  runs: unknown[];
};

export type RunsIndexRebuildContract = {
  command: "consumer runs index rebuild";
  schema_version: "consumer.runs.index.v1";
  ok: true;
  registry_path: string;
  index_path: string;
  generated_at: string;
  capsules_scanned: number;
  runs_indexed: number;
};

export type RunsIndexStatusContract = {
  command: "consumer runs index status";
  schema_version: "consumer.runs.index.status.v1";
  ok: boolean;
  registry_path: string;
  index_path: string;
  index: Record<string, unknown>;
  warnings: unknown[];
};

export type RunsInspectContract = {
  command: "consumer runs inspect";
  schema_version: "consumer.runs.inspect.v1";
  registry_path: string;
  ok: true;
  run_ref: Record<string, unknown>;
  capsule: Record<string, unknown>;
  record: Record<string, unknown>;
  input: Record<string, unknown>;
  envelope: Record<string, unknown>;
  artifacts: unknown[];
  logs: Record<string, unknown>;
  warnings: unknown[];
};

export type TeamCatalogInspectContract = {
  command: "team catalog inspect";
  schema_version: "team.catalog.inspect.v1";
  ok: true;
  catalog: Record<string, unknown>;
  items: unknown[];
  error: null;
};

export type DesktopCoreContract =
  | HostStatusContract
  | ImportContract
  | ConsumerInventoryContract
  | ConsumerExposureContract
  | RouterDryRunContract
  | RouterStatusContract
  | MountPlanContract
  | MountApplyContract
  | MountRollbackContract
  | RunsListContract
  | RunsIndexRebuildContract
  | RunsIndexStatusContract
  | RunsInspectContract
  | TeamCatalogInspectContract;

const contractCommand: CoreCommandRequest = {
  command: "skillrun",
  args: ["<contract-parser>"],
};

export function parseHostStatusContract(input: unknown): HostStatusContract {
  const data = baseContract(input, "host.status.v1", "host status");
  requireLiteral(data, "ok", true);
  requireRecord(data, "binary");
  requireRecord(data, "desktop_contract");
  requireRecord(data, "contracts");
  requireRecord(data, "platform");
  requireRecord(data, "paths");
  requireArray(data, "capabilities");
  requireRecord(data, "boundaries");
  requireArray(data, "warnings");
  return data as HostStatusContract;
}

export function parseImportContract(input: unknown): ImportContract {
  const data = baseContract(input, "import.v1", "import");
  requireLiteral(data, "ok", true);
  requireString(data, "package_path");
  requireString(data, "registry_path");
  const capsule = requireRecord(data, "capsule");
  requireString(capsule, "id");
  requireString(capsule, "path");
  requireString(capsule, "source_type");
  requireBoolean(capsule, "enabled");
  requireArray(data, "warnings");
  return data as ImportContract;
}

export function parseConsumerInventoryContract(input: unknown): ConsumerInventoryContract {
  const data = baseContract(input, "consumer.inventory.v1", "consumer inventory");
  requireNumber(data, "version");
  requireString(data, "registry_path");
  for (const capsule of requireArray(data, "capsules")) {
    const record = asRecord(capsule, "capsules[]");
    requireString(record, "id");
    requireString(record, "path");
    requireString(record, "source_type");
    requireBoolean(record, "enabled");
    requireRecord(record, "manifest");
    requireRecord(record, "skill");
    requireRecord(record, "runtime");
    requireRecord(record, "tool");
    requireRecord(record, "readiness");
  }
  return data as ConsumerInventoryContract;
}

export function parseConsumerExposureContract(input: unknown): ConsumerExposureContract {
  const data = baseContract(input, "consumer.exposure.v1", "consumer exposure");
  requireString(data, "registry_path");
  for (const tool of requireArray(data, "tools")) {
    const record = asRecord(tool, "tools[]");
    requireString(record, "capsule_id");
    requireString(record, "tool_name");
    requireBoolean(record, "enabled");
    requireBoolean(record, "exposed");
    requireString(record, "readiness_status");
  }
  return data as ConsumerExposureContract;
}

export function parseRouterDryRunContract(input: unknown): RouterDryRunContract {
  const data = baseContract(input, "router.mcp.v1", "router serve --mcp");
  const mcp = requireRecord(data, "mcp");
  requireLiteral(mcp, "dry_run", true);
  requireString(mcp, "transport");
  requireString(mcp, "protocol");
  const router = requireRecord(data, "router");
  requireBoolean(router, "snapshot");
  requireNumber(router, "capsules");
  requireArray(data, "tools");
  requireArray(data, "resources");
  return data as RouterDryRunContract;
}

export function parseRouterStatusContract(input: unknown): RouterStatusContract {
  const data = baseContract(input, "router.status.v1", "router status");
  requireBoolean(data, "ok");
  const router = requireRecord(data, "router");
  requireBoolean(router, "snapshot");
  requireNumber(router, "capsules");
  requireArray(data, "tools");
  requireArray(data, "resources");
  if (data.error !== null) {
    requireRecord(data, "error");
  }
  return data as RouterStatusContract;
}

export function parseMountPlanContract(input: unknown): MountPlanContract {
  const data = baseContract(input, "consumer.mount_plan.v1", "consumer mount plan");
  requireMountClient(data);
  requireString(data, "operation");
  requireNullableRecord(data, "config");
  requireNullableRecord(data, "backup");
  const router = requireRecord(data, "router");
  requireString(router, "server_name");
  requireString(router, "command");
  requireStringArray(router, "args");
  requireArray(data, "changes");
  requireArray(data, "warnings");
  return data as MountPlanContract;
}

export function parseMountApplyContract(input: unknown): MountApplyContract {
  const data = baseContract(input, "consumer.mount_apply.v1", "consumer mount apply");
  requireMountClient(data);
  requireRecord(data, "config");
  requireNullableRecord(data, "backup");
  requireBoolean(data, "applied");
  requireArray(data, "changes");
  requireArray(data, "warnings");
  return data as MountApplyContract;
}

export function parseMountRollbackContract(input: unknown): MountRollbackContract {
  const data = baseContract(input, "consumer.mount_rollback.v1", "consumer mount rollback");
  requireMountClient(data);
  requireRecord(data, "config");
  requireRecord(data, "backup");
  requireBoolean(data, "rolled_back");
  requireArray(data, "warnings");
  return data as MountRollbackContract;
}

export function parseRunsListContract(input: unknown): RunsListContract {
  const data = baseContract(input, "consumer.runs.list.v1", "consumer runs list");
  requireString(data, "registry_path");
  if ("source" in data && data.source !== null) {
    requireRecord(data, "source");
  }
  const scope = requireRecord(data, "scope");
  requireString(scope, "kind");
  requireArray(data, "runs");
  return data as RunsListContract;
}

export function parseRunsIndexRebuildContract(input: unknown): RunsIndexRebuildContract {
  const data = baseContract(input, "consumer.runs.index.v1", "consumer runs index rebuild");
  requireLiteral(data, "ok", true);
  requireString(data, "registry_path");
  requireString(data, "index_path");
  requireString(data, "generated_at");
  requireNumber(data, "capsules_scanned");
  requireNumber(data, "runs_indexed");
  return data as RunsIndexRebuildContract;
}

export function parseRunsIndexStatusContract(input: unknown): RunsIndexStatusContract {
  const data = baseContract(input, "consumer.runs.index.status.v1", "consumer runs index status");
  requireBoolean(data, "ok");
  requireString(data, "registry_path");
  requireString(data, "index_path");
  requireRecord(data, "index");
  requireArray(data, "warnings");
  return data as RunsIndexStatusContract;
}

export function parseRunsInspectContract(input: unknown): RunsInspectContract {
  const data = baseContract(input, "consumer.runs.inspect.v1", "consumer runs inspect");
  requireString(data, "registry_path");
  requireLiteral(data, "ok", true);
  requireRecord(data, "run_ref");
  requireRecord(data, "capsule");
  requireRecord(data, "record");
  const inputSummary = requireRecord(data, "input");
  requireBoolean(inputSummary, "included");
  requireBoolean(inputSummary, "available");
  const envelope = requireRecord(data, "envelope");
  requireBoolean(envelope, "included");
  requireString(envelope, "status");
  requireRecord(envelope, "value");
  requireArray(data, "artifacts");
  const logs = requireRecord(data, "logs");
  requireBoolean(logs, "stdout_available");
  requireBoolean(logs, "stderr_available");
  requireBoolean(logs, "stdout_included");
  requireBoolean(logs, "stderr_included");
  requireArray(data, "warnings");
  return data as RunsInspectContract;
}

export function parseTeamCatalogInspectContract(input: unknown): TeamCatalogInspectContract {
  const data = baseContract(input, "team.catalog.inspect.v1", "team catalog inspect");
  requireLiteral(data, "ok", true);
  const catalog = requireRecord(data, "catalog");
  requireString(catalog, "catalog_id");
  requireString(catalog, "name");
  requireString(catalog, "updated_at");
  requireNumber(catalog, "items");
  for (const item of requireArray(data, "items")) {
    const record = asRecord(item, "items[]");
    requireString(record, "id");
    const kind = requireString(record, "kind");
    if (!["skillrun.skr", "agent.skill", "mcp.server"].includes(kind)) {
      throw mismatch("items[].kind", "Expected supported team catalog item kind.");
    }
    requireString(record, "name");
    requireString(record, "description");
    requireString(record, "version");
    requireBoolean(record, "installable");
    requireBoolean(record, "installed");
    const sourceType = requireString(record, "source_type");
    if (!["file", "https"].includes(sourceType)) {
      throw mismatch("items[].source_type", "Expected file or https.");
    }
    requireArray(record, "warnings");
  }
  if (data.error !== null) {
    throw mismatch("error", "Expected null.");
  }
  return data as TeamCatalogInspectContract;
}

function baseContract(
  input: unknown,
  schemaVersion: DesktopCoreContract["schema_version"],
  command: DesktopCoreContract["command"],
): Record<string, unknown> {
  const data = asRecord(input, "root");
  requireLiteral(data, "command", command);
  requireLiteral(data, "schema_version", schemaVersion);
  return data;
}

function requireMountClient(record: Record<string, unknown>): void {
  const client = requireRecord(record, "client");
  requireString(client, "id");
  requireString(client, "name");
  requireBoolean(client, "supported");
  requireBoolean(client, "detected");
}

function requireString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw mismatch(field, "Expected string.");
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number") {
    throw mismatch(field, "Expected number.");
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  if (typeof value !== "boolean") {
    throw mismatch(field, "Expected boolean.");
  }
  return value;
}

function requireLiteral<TLiteral extends string | number | boolean>(
  record: Record<string, unknown>,
  field: string,
  expected: TLiteral,
): TLiteral {
  if (record[field] !== expected) {
    throw mismatch(field, `Expected ${String(expected)}.`);
  }
  return expected;
}

function requireRecord(record: Record<string, unknown>, field: string): Record<string, unknown> {
  return asRecord(record[field], field);
}

function requireNullableRecord(
  record: Record<string, unknown>,
  field: string,
): Record<string, unknown> | null {
  if (record[field] === null) {
    return null;
  }
  return asRecord(record[field], field);
}

function requireArray(record: Record<string, unknown>, field: string): unknown[] {
  const value = record[field];
  if (!Array.isArray(value)) {
    throw mismatch(field, "Expected array.");
  }
  return value;
}

function requireStringArray(record: Record<string, unknown>, field: string): string[] {
  const values = requireArray(record, field);
  if (!values.every((value) => typeof value === "string")) {
    throw mismatch(field, "Expected string array.");
  }
  return values;
}

function asRecord(input: unknown, field: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw mismatch(field, "Expected object.");
  }
  return input as Record<string, unknown>;
}

function mismatch(field: string, detail: string): CoreContractMismatchError {
  return new CoreContractMismatchError(contractCommand, field, detail);
}
