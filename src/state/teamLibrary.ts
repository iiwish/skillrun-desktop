import {
  coreErrorKind,
  fetchTeamCatalogInstallApply,
  fetchTeamCatalogInstallPlan,
  fetchTeamCatalogInspect,
  fetchTeamCatalogStatus,
  type TeamCatalogInstallApplyOptions,
  type TeamCatalogInstallPlanOptions,
  type TeamCatalogInspectOptions,
} from "../core/teamLibraryService";
import type {
  TeamCatalogInstallApplyContract,
  TeamCatalogInstallPlanContract,
  TeamCatalogInspectContract,
  TeamCatalogStatusContract,
} from "../core/contracts";

export type TeamCatalogItemKind = "skillrun.skr" | "agent.skill" | "mcp.server";
export type TeamCatalogSourceType = "file" | "https";
export type TeamLibraryItemState =
  | "display_only"
  | "not_installed"
  | "installed_current"
  | "replace_available"
  | "blocked";
export type TeamLibraryRecommendedAction = "none" | "install" | "replace" | "resolve_conflict";

export type TeamCatalogWarning = {
  code: string;
  message: string;
};

export type TeamCatalogItem = {
  id: string;
  kind: TeamCatalogItemKind;
  name: string;
  description: string;
  version: string;
  installable: boolean;
  installed: boolean;
  state: TeamLibraryItemState;
  recommendedAction: TeamLibraryRecommendedAction;
  installPlanAvailable: boolean;
  registry: {
    installed: boolean;
    sourceType?: string;
    enabled: boolean | null;
    path?: string;
  };
  sourceType: TeamCatalogSourceType;
  sha256?: string;
  publisherName?: string;
  homepage?: string;
  repository?: string;
  requirements: string[];
  permissionsSummary: string[];
  mcpSummary: string[];
  trustNote?: string;
  tags: string[];
  warnings: TeamCatalogWarning[];
};

export type TeamLibraryState = {
  status: "ready";
  catalogSource: string;
  catalog: {
    id: string;
    name: string;
    description?: string;
    updatedAt: string;
    homepage?: string;
    itemCount: number;
  };
  summary: {
    total: number;
    installable: number;
    installed: number;
    replaceAvailable: number;
    blocked: number;
    displayOnly: number;
  };
  items: TeamCatalogItem[];
  safetyCopy: string;
};

export type TeamLibraryPlanAction = {
  type: "import";
  replace: boolean;
  requiresConfirmation: boolean;
};

export type TeamLibraryPlanState = {
  status: "ready";
  catalogId: string;
  itemId: string;
  version: string;
  sourceType: TeamCatalogSourceType;
  sha256: string;
  registry: {
    installed: boolean;
    sourceType?: string;
    enabled: boolean | null;
    path?: string;
  };
  actions: TeamLibraryPlanAction[];
  warnings: TeamCatalogWarning[];
  safetyCopy: string;
};

export type TeamLibraryApplyState = {
  status: "ready";
  catalogId: string;
  itemId: string;
  download: {
    sourceType: TeamCatalogSourceType;
    packagePath: string;
    sha256: string;
    sha256Verified: boolean;
  };
  imported: {
    schemaVersion: string;
    id: string;
    path: string;
    sourceType: string;
    enabled: boolean;
    replaced: boolean;
  };
  nextSteps: string[];
  warnings: TeamCatalogWarning[];
  safetyCopy: string;
};

export type TeamLibraryError = {
  kind: string;
  message: string;
};

export type TeamLibraryResult =
  | {
      status: "ready";
      state: TeamLibraryState;
    }
  | {
      status: "error";
      error: TeamLibraryError;
    };

export type BuildTeamLibraryInput = {
  catalogSource: string;
  inspect: TeamCatalogInspectContract;
  status?: TeamCatalogStatusContract;
};

export type BuildTeamLibraryPlanInput = {
  plan: TeamCatalogInstallPlanContract;
};

export type BuildTeamLibraryApplyInput = {
  apply: TeamCatalogInstallApplyContract;
};

export const TEAM_LIBRARY_SAFETY_COPY =
  "Team Library only works through Core inspect, status, plan, and confirmed apply. It does not download, unpack, import, enable, mount, run, or mark catalog items trusted on its own.";

export const TEAM_LIBRARY_PLAN_SAFETY_COPY =
  "Install plan is a Core preview only. Desktop does not download, unpack, import, enable, mount, or apply anything from this result.";

export const TEAM_LIBRARY_APPLY_SAFETY_COPY =
  "Install apply calls Core after explicit confirmation. It imports the package only; it does not enable, mount, install dependencies, run, or mark the item trusted.";

export async function loadTeamLibraryInspect(
  options: TeamCatalogInspectOptions,
): Promise<TeamLibraryResult> {
  try {
    const inspectResult = await fetchTeamCatalogInspect(options);
    const statusResult = await fetchTeamCatalogStatus(options);
    return {
      status: "ready",
      state: buildTeamLibraryState({
        catalogSource: options.catalogPath,
        inspect: inspectResult.contract,
        status: statusResult.contract,
      }),
    };
  } catch (error) {
    return {
      status: "error",
      error: {
        kind: coreErrorKind(error),
        message: error instanceof Error ? error.message : "Team catalog inspect failed.",
      },
    };
  }
}

export async function loadTeamLibraryInstallPlan(
  options: TeamCatalogInstallPlanOptions,
): Promise<
  | {
      status: "ready";
      state: TeamLibraryPlanState;
    }
  | {
      status: "error";
      error: TeamLibraryError;
    }
> {
  try {
    const result = await fetchTeamCatalogInstallPlan(options);
    return {
      status: "ready",
      state: buildTeamLibraryPlanState({ plan: result.contract }),
    };
  } catch (error) {
    return {
      status: "error",
      error: {
        kind: coreErrorKind(error),
        message: error instanceof Error ? error.message : "Team catalog install plan failed.",
      },
    };
  }
}

export async function applyTeamLibraryInstall(
  options: TeamCatalogInstallApplyOptions,
): Promise<
  | {
      status: "ready";
      state: TeamLibraryApplyState;
    }
  | {
      status: "error";
      error: TeamLibraryError;
    }
> {
  try {
    const result = await fetchTeamCatalogInstallApply(options);
    return {
      status: "ready",
      state: buildTeamLibraryApplyState({ apply: result.contract }),
    };
  } catch (error) {
    return {
      status: "error",
      error: {
        kind: coreErrorKind(error),
        message: error instanceof Error ? error.message : "Team catalog install apply failed.",
      },
    };
  }
}

export function buildTeamLibraryState(input: BuildTeamLibraryInput): TeamLibraryState {
  const catalog = input.inspect.catalog;
  const statuses = new Map(
    (input.status?.items ?? []).map((item) => {
      const record = asRecord(item);
      return [readString(record, "id", ""), record] as const;
    }),
  );
  const items = input.inspect.items.map((item) => {
    const record = asRecord(item);
    return buildTeamCatalogItem(record, statuses.get(readString(record, "id", "")));
  });
  return {
    status: "ready",
    catalogSource: input.catalogSource,
    catalog: {
      id: readString(catalog, "catalog_id", ""),
      name: readString(catalog, "name", ""),
      description: readOptionalString(catalog, "description"),
      updatedAt: readString(catalog, "updated_at", ""),
      homepage: readOptionalString(catalog, "homepage"),
      itemCount: readNumber(catalog, "items", items.length),
    },
    summary: {
      total: items.length,
      installable: items.filter((item) => item.installable).length,
      installed: items.filter((item) => item.installed).length,
      replaceAvailable: items.filter((item) => item.state === "replace_available").length,
      blocked: items.filter((item) => item.state === "blocked").length,
      displayOnly: items.filter((item) => item.state === "display_only").length,
    },
    items,
    safetyCopy: TEAM_LIBRARY_SAFETY_COPY,
  };
}

export function buildTeamLibraryPlanState(input: BuildTeamLibraryPlanInput): TeamLibraryPlanState {
  const item = input.plan.item;
  const registry = input.plan.registry;
  return {
    status: "ready",
    catalogId: input.plan.catalog_id,
    itemId: readString(item, "id", ""),
    version: readString(item, "version", ""),
    sourceType: readSourceType(item, "source_type", "file"),
    sha256: readString(item, "sha256", ""),
    registry: {
      installed: readBoolean(registry, "installed", false),
      sourceType: readOptionalString(registry, "source_type"),
      enabled: readOptionalBoolean(registry, "enabled"),
      path: readOptionalString(registry, "path"),
    },
    actions: readPlanActions(input.plan.actions),
    warnings: readWarnings(input.plan.warnings),
    safetyCopy: TEAM_LIBRARY_PLAN_SAFETY_COPY,
  };
}

export function buildTeamLibraryApplyState(input: BuildTeamLibraryApplyInput): TeamLibraryApplyState {
  const download = input.apply.download;
  const importResult = input.apply.import;
  return {
    status: "ready",
    catalogId: input.apply.catalog_id,
    itemId: input.apply.item_id,
    download: {
      sourceType: readSourceType(download, "source_type", "file"),
      packagePath: readString(download, "package_path", ""),
      sha256: readString(download, "sha256", ""),
      sha256Verified: readBoolean(download, "sha256_verified", false),
    },
    imported: {
      schemaVersion: readString(importResult, "schema_version", "import.v1"),
      id: readString(importResult, "id", ""),
      path: readString(importResult, "path", ""),
      sourceType: readString(importResult, "source_type", ""),
      enabled: readBoolean(importResult, "enabled", false),
      replaced: readBoolean(importResult, "replaced", false),
    },
    nextSteps: readStringArray(input.apply.next_steps),
    warnings: readWarnings(input.apply.warnings),
    safetyCopy: TEAM_LIBRARY_APPLY_SAFETY_COPY,
  };
}

function buildTeamCatalogItem(
  record: Record<string, unknown>,
  statusRecord?: Record<string, unknown>,
): TeamCatalogItem {
  const kind = readItemKind(record, "kind", "skillrun.skr");
  const installable = statusRecord
    ? readBoolean(statusRecord, "installable", false)
    : readBoolean(record, "installable", false);
  const statusRegistry = asNullableRecord(statusRecord?.registry);
  const installed = statusRecord
    ? readBoolean(statusRegistry, "installed", false)
    : readBoolean(record, "installed", false);
  const status = statusRecord ? readCatalogStatus(statusRecord, "status") : undefined;
  const warnings = mergeWarnings(readWarnings(record.warnings), readWarnings(statusRecord?.warnings));
  const state = status ? deriveItemStateFromStatus({ kind, status }) : deriveItemState({ kind, installable, installed });
  const recommendedAction = readRecommendedAction(statusRecord, "recommended_action");
  return {
    id: readString(record, "id", ""),
    kind,
    name: readString(record, "name", ""),
    description: readString(record, "description", ""),
    version: readString(record, "version", ""),
    installable,
    installed,
    state,
    recommendedAction,
    installPlanAvailable: statusRecord
      ? readBoolean(statusRecord, "install_plan_available", false)
      : installable,
    registry: {
      installed,
      sourceType: readOptionalString(statusRegistry, "source_type"),
      enabled: readOptionalBoolean(statusRegistry, "enabled"),
      path: readOptionalString(statusRegistry, "path"),
    },
    sourceType: readSourceType(record, "source_type", "file"),
    sha256: readOptionalString(record, "sha256"),
    publisherName: readOptionalString(asNullableRecord(record.publisher), "name"),
    homepage: readOptionalString(record, "homepage"),
    repository: readOptionalString(record, "repository"),
    requirements: readRequirements(record.requirements),
    permissionsSummary: readStringArray(record.permissions_summary),
    mcpSummary: readMcpSummary(record.mcp),
    trustNote: readOptionalString(record, "trust_note"),
    tags: readStringArray(record.tags),
    warnings,
  };
}

function deriveItemStateFromStatus(input: {
  kind: TeamCatalogItemKind;
  status: "missing" | "installed" | "replace_available" | "blocked";
}): TeamLibraryItemState {
  if (input.kind !== "skillrun.skr") {
    return "display_only";
  }
  if (input.status === "replace_available") {
    return "replace_available";
  }
  if (input.status === "installed") {
    return "installed_current";
  }
  if (input.status === "blocked") {
    return "blocked";
  }
  return "not_installed";
}

function deriveItemState(input: {
  kind: TeamCatalogItemKind;
  installable: boolean;
  installed: boolean;
}): TeamLibraryItemState {
  if (input.kind !== "skillrun.skr") {
    return "display_only";
  }
  if (!input.installable) {
    return "blocked";
  }
  if (input.installed) {
    return "installed_current";
  }
  return "not_installed";
}

function mergeWarnings(
  inspectWarnings: TeamCatalogWarning[],
  statusWarnings: TeamCatalogWarning[],
): TeamCatalogWarning[] {
  const merged = new Map<string, TeamCatalogWarning>();
  for (const warning of [...inspectWarnings, ...statusWarnings]) {
    merged.set(`${warning.code}:${warning.message}`, warning);
  }
  return [...merged.values()];
}

function readRequirements(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }
      const record = asNullableRecord(value);
      return readOptionalString(record, "summary") ?? readOptionalString(record, "kind") ?? "";
    })
    .filter(Boolean);
}

function readMcpSummary(input: unknown): string[] {
  const record = asNullableRecord(input);
  if (!record) {
    return [];
  }

  const values: string[] = [];
  if (typeof record.exposes_tools === "boolean") {
    values.push(`exposes_tools: ${String(record.exposes_tools)}`);
  }
  const mount = readOptionalString(record, "mount");
  if (mount) {
    values.push(`mount: ${mount}`);
  }
  return values;
}

function readWarnings(input: unknown): TeamCatalogWarning[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((warning) => {
    const record = asNullableRecord(warning);
    return {
      code: readString(record, "code", "warning"),
      message: readString(record, "message", ""),
    };
  });
}

function readPlanActions(input: unknown): TeamLibraryPlanAction[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((action) => {
    const record = asNullableRecord(action);
    return {
      type: "import",
      replace: readBoolean(record, "replace", false),
      requiresConfirmation: readBoolean(record, "requires_confirmation", false),
    };
  });
}

function readCatalogStatus(
  record: Record<string, unknown> | undefined,
  key: string,
): "missing" | "installed" | "replace_available" | "blocked" | undefined {
  const value = record?.[key];
  if (value === "missing" || value === "installed" || value === "replace_available" || value === "blocked") {
    return value;
  }
  return undefined;
}

function readRecommendedAction(
  record: Record<string, unknown> | undefined,
  key: string,
): TeamLibraryRecommendedAction {
  const value = record?.[key];
  if (value === "none" || value === "install" || value === "replace" || value === "resolve_conflict") {
    return value;
  }
  return "none";
}

function readStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((value): value is string => typeof value === "string");
}

function readItemKind(
  record: Record<string, unknown> | null,
  key: string,
  fallback: TeamCatalogItemKind,
): TeamCatalogItemKind {
  const value = readString(record, key, fallback);
  if (value === "skillrun.skr" || value === "agent.skill" || value === "mcp.server") {
    return value;
  }
  return fallback;
}

function readSourceType(
  record: Record<string, unknown> | null,
  key: string,
  fallback: TeamCatalogSourceType,
): TeamCatalogSourceType {
  const value = readString(record, key, fallback);
  if (value === "file" || value === "https") {
    return value;
  }
  return fallback;
}

function readString(
  record: Record<string, unknown> | null,
  key: string,
  fallback: string,
): string {
  const value = record?.[key];
  return typeof value === "string" ? value : fallback;
}

function readOptionalString(
  record: Record<string, unknown> | null,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value ? value : undefined;
}

function readNumber(
  record: Record<string, unknown> | null,
  key: string,
  fallback: number,
): number {
  const value = record?.[key];
  return typeof value === "number" ? value : fallback;
}

function readBoolean(
  record: Record<string, unknown> | null,
  key: string,
  fallback: boolean,
): boolean {
  const value = record?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function readOptionalBoolean(
  record: Record<string, unknown> | null,
  key: string,
): boolean | null {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function asNullableRecord(input: unknown): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}
