import {
  coreErrorKind,
  fetchExposurePreview,
  type ExposurePreviewOptions,
} from "../core/exposureService";
import type { ConsumerExposureContract, RouterDryRunContract, RouterStatusContract } from "../core/contracts";

export type ExposureTool = {
  capsuleId: string;
  toolName: string;
  readinessStatus: string;
  manifestHash: string;
};

export type RouterResourceMetadata = {
  name: string;
  uri: string;
  mimeType: string;
};

export type RouterIssueSeverity = "warning" | "error";

export type RouterIssue = {
  code: string;
  severity: RouterIssueSeverity;
  message: string;
  capsuleId?: string;
  toolName?: string;
  recommendedAction: string;
};

export type RouterRouteState = "routable" | "blocked";

export type RouterRouteDiagnostic = {
  capsuleId: string;
  capsulePath: string;
  enabled: boolean;
  state: RouterRouteState;
  readinessStatus: string;
  readinessReason?: string;
  toolName?: string;
  manifestHash?: string;
  uriPrefix?: string;
  issue?: RouterIssue;
  recommendedAction: string;
};

export type ExposurePreviewState = {
  status: "ready";
  exposedTools: ExposureTool[];
  filteredToolCount: number;
  emptyReason?: "no_tools" | "disabled_or_not_ready";
  dryRun: {
    transport: string;
    protocol: string;
    capsuleCount: number;
    toolCount: number;
    resourceCount: number;
  };
  routerStatus: {
    ok: boolean;
    capsuleCount: number;
    toolCount: number;
    resourceCount: number;
    errorCode?: string;
    errorMessage?: string;
    routeCount: number;
    routableCount: number;
    blockedCount: number;
    warningCount: number;
    errorCount: number;
  };
  routerRoutes: RouterRouteDiagnostic[];
  routerIssues: RouterIssue[];
  resources: RouterResourceMetadata[];
  safetyCopy: string;
};

export type ExposurePreviewError = {
  kind: string;
  message: string;
};

export type ExposurePreviewResult =
  | {
      status: "ready";
      state: ExposurePreviewState;
    }
  | {
      status: "error";
      error: ExposurePreviewError;
    };

export type BuildExposurePreviewInput = {
  exposure: Pick<ConsumerExposureContract, "tools">;
  routerStatus: Pick<RouterStatusContract, "ok" | "router" | "tools" | "resources" | "routes" | "issues" | "error">;
  dryRun: Pick<RouterDryRunContract, "mcp" | "router" | "tools" | "resources" | "routes" | "issues" | "error">;
};

export const EXPOSURE_SAFETY_COPY =
  "Exposure preview shows Core-reported tool metadata only. Exposed does not mean sandboxed, trusted, or safe.";

export async function loadExposurePreview(
  options: ExposurePreviewOptions,
): Promise<ExposurePreviewResult> {
  try {
    const snapshot = await fetchExposurePreview(options);
    return {
      status: "ready",
      state: buildExposurePreviewState(snapshot),
    };
  } catch (error) {
    return {
      status: "error",
      error: {
        kind: coreErrorKind(error),
        message: error instanceof Error ? error.message : "Exposure preview failed.",
      },
    };
  }
}

export function buildExposurePreviewState(
  input: BuildExposurePreviewInput,
): ExposurePreviewState {
  const allTools = input.exposure.tools.map(readExposureTool);
  const exposedTools = allTools.filter((tool) => tool.isExposed);
  const filteredToolCount = allTools.length - exposedTools.length;
  const routerRoutes = readRouterRoutes(
    hasItems(input.routerStatus.routes) ? input.routerStatus.routes : input.dryRun.routes,
  );
  const routerIssues = mergeRouteIssues(
    readRouterIssues(hasItems(input.routerStatus.issues) ? input.routerStatus.issues : input.dryRun.issues),
    routerRoutes,
  );

  return {
    status: "ready",
    exposedTools: exposedTools.map(({ isExposed: _isExposed, ...tool }) => tool),
    filteredToolCount,
    emptyReason: emptyReason(allTools.length, filteredToolCount),
    dryRun: {
      transport: readString(asRecord(input.dryRun.mcp), "transport"),
      protocol: readString(asRecord(input.dryRun.mcp), "protocol"),
      capsuleCount: readNumber(asRecord(input.dryRun.router), "capsules"),
      toolCount: input.dryRun.tools.length,
      resourceCount: input.dryRun.resources.length,
    },
    routerStatus: readRouterStatus(input.routerStatus, routerRoutes, routerIssues),
    routerRoutes,
    routerIssues,
    resources: input.dryRun.resources.map(readResourceMetadata),
    safetyCopy: EXPOSURE_SAFETY_COPY,
  };
}

function readRouterStatus(
  input: BuildExposurePreviewInput["routerStatus"],
  routerRoutes: RouterRouteDiagnostic[],
  routerIssues: RouterIssue[],
): ExposurePreviewState["routerStatus"] {
  const error = asRecord(input.error);
  return {
    ok: input.ok === true,
    capsuleCount: readNumber(asRecord(input.router), "capsules"),
    toolCount: input.tools.length,
    resourceCount: input.resources.length,
    errorCode: readOptionalString(error, "code"),
    errorMessage: readOptionalString(error, "message"),
    routeCount: routerRoutes.length,
    routableCount: routerRoutes.filter((route) => route.state === "routable").length,
    blockedCount: routerRoutes.filter((route) => route.state === "blocked").length,
    warningCount: routerIssues.filter((issue) => issue.severity === "warning").length,
    errorCount: routerIssues.filter((issue) => issue.severity === "error").length,
  };
}

function emptyReason(
  totalToolCount: number,
  filteredToolCount: number,
): ExposurePreviewState["emptyReason"] {
  if (totalToolCount === 0) {
    return "no_tools";
  }
  if (totalToolCount === filteredToolCount) {
    return "disabled_or_not_ready";
  }
  return undefined;
}

function readExposureTool(input: unknown): ExposureTool & { isExposed: boolean } {
  const record = asRecord(input);
  const enabled = record.enabled === true;
  const exposed = record.exposed === true;
  const readinessStatus = readString(record, "readiness_status");

  return {
    capsuleId: readString(record, "capsule_id"),
    toolName: readString(record, "tool_name"),
    readinessStatus,
    manifestHash: readString(record, "manifest_hash"),
    isExposed: enabled && exposed && readinessStatus === "ok",
  };
}

function readResourceMetadata(input: unknown): RouterResourceMetadata {
  const record = asRecord(input);
  return {
    name: readString(record, "name"),
    uri: readString(record, "uri"),
    mimeType: readString(record, "mime_type"),
  };
}

function readRouterRoutes(input: unknown[] | undefined): RouterRouteDiagnostic[] {
  return Array.isArray(input) ? input.map(readRouterRoute) : [];
}

function readRouterRoute(input: unknown): RouterRouteDiagnostic {
  const record = asRecord(input);
  const issue = readOptionalIssue(record.issue);
  return {
    capsuleId: readString(record, "capsule_id"),
    capsulePath: readString(record, "capsule_path"),
    enabled: readBoolean(record, "enabled"),
    state: readRouteState(record),
    readinessStatus: readString(record, "readiness_status"),
    readinessReason: readOptionalString(record, "readiness_reason"),
    toolName: readOptionalString(record, "tool_name"),
    manifestHash: readOptionalString(record, "manifest_sha256"),
    uriPrefix: readOptionalString(record, "uri_prefix"),
    issue,
    recommendedAction: readString(record, "recommended_action"),
  };
}

function readRouterIssues(input: unknown[] | undefined): RouterIssue[] {
  return Array.isArray(input) ? input.map(readRouterIssue) : [];
}

function mergeRouteIssues(issues: RouterIssue[], routes: RouterRouteDiagnostic[]): RouterIssue[] {
  const merged = [...issues];
  const keys = new Set(issues.map(routerIssueKey));
  for (const route of routes) {
    if (!route.issue) {
      continue;
    }
    const key = routerIssueKey(route.issue);
    if (!keys.has(key)) {
      keys.add(key);
      merged.push(route.issue);
    }
  }
  return merged;
}

function routerIssueKey(issue: RouterIssue): string {
  return `${issue.code}:${issue.capsuleId ?? ""}:${issue.toolName ?? ""}`;
}

function readRouterIssue(input: unknown): RouterIssue {
  const record = asRecord(input);
  return {
    code: readString(record, "code"),
    severity: readIssueSeverity(record),
    message: readString(record, "message"),
    capsuleId: readOptionalString(record, "capsule_id"),
    toolName: readOptionalString(record, "tool_name"),
    recommendedAction: readString(record, "recommended_action"),
  };
}

function readOptionalIssue(input: unknown): RouterIssue | undefined {
  return isRecord(input) ? readRouterIssue(input) : undefined;
}

function hasItems(input: unknown[] | undefined): input is unknown[] {
  return Array.isArray(input) && input.length > 0;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function readString(
  record: Record<string, unknown>,
  field: string,
  fallback = "unknown",
): string {
  const value = record[field];
  return typeof value === "string" ? value : fallback;
}

function readOptionalString(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, field: string, fallback = false): boolean {
  const value = record[field];
  return typeof value === "boolean" ? value : fallback;
}

function readRouteState(record: Record<string, unknown>): RouterRouteState {
  return record.state === "routable" ? "routable" : "blocked";
}

function readIssueSeverity(record: Record<string, unknown>): RouterIssueSeverity {
  return record.severity === "error" ? "error" : "warning";
}

function readNumber(record: Record<string, unknown>, field: string, fallback = 0): number {
  const value = record[field];
  return typeof value === "number" ? value : fallback;
}
