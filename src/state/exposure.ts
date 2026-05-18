import {
  coreErrorKind,
  fetchExposurePreview,
  type ExposurePreviewOptions,
} from "../core/exposureService";
import type { ConsumerExposureContract, RouterDryRunContract } from "../core/contracts";

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
  dryRun: Pick<RouterDryRunContract, "mcp" | "router" | "tools" | "resources">;
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
    resources: input.dryRun.resources.map(readResourceMetadata),
    safetyCopy: EXPOSURE_SAFETY_COPY,
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

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  field: string,
  fallback = "unknown",
): string {
  const value = record[field];
  return typeof value === "string" ? value : fallback;
}

function readNumber(record: Record<string, unknown>, field: string, fallback = 0): number {
  const value = record[field];
  return typeof value === "number" ? value : fallback;
}
