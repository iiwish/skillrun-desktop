import {
  coreErrorKind,
  importCapsule,
  type ImportCapsuleOptions,
} from "../core/importService";

export type ImportFlowStatus = "idle" | "importing" | "review_ready" | "error";

export type ImportedCapsuleReview = {
  id: string;
  path: string;
  sourceType: string;
  enabled: boolean;
};

export type ImportFlowError = {
  kind: string;
  message: string;
};

export type ImportFlowState = {
  status: ImportFlowStatus;
  packagePath?: string;
  capsule?: ImportedCapsuleReview;
  safetyCopy: string;
  error?: ImportFlowError;
};

export type RunImportFlowOptions = ImportCapsuleOptions;

export const IMPORT_SAFETY_COPY =
  ".skr import copies a local capsule into the registry; it does not install dependencies, does not enable exposure, does not mount a client, and does not mark this capsule trusted.";

export async function runImportFlow(options: RunImportFlowOptions): Promise<ImportFlowState> {
  if (!options.packagePath.toLowerCase().endsWith(".skr")) {
    return errorState(options.packagePath, {
      kind: "invalid_package_path",
      message: "Import requires a .skr package.",
    });
  }

  try {
    const result = await importCapsule(options);
    const capsule = result.contract.capsule;

    return {
      status: "review_ready",
      packagePath: options.packagePath,
      capsule: readImportedCapsule(capsule),
      safetyCopy: IMPORT_SAFETY_COPY,
    };
  } catch (error) {
    return errorState(options.packagePath, {
      kind: importFlowErrorKind(error),
      message: error instanceof Error ? error.message : "Import failed.",
    });
  }
}

function errorState(packagePath: string, error: ImportFlowError): ImportFlowState {
  return {
    status: "error",
    packagePath,
    safetyCopy: IMPORT_SAFETY_COPY,
    error,
  };
}

function importFlowErrorKind(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("malformed_import_contract:")) {
    return "malformed_import_contract";
  }

  return coreErrorKind(error);
}

function readImportedCapsule(record: Record<string, unknown>): ImportedCapsuleReview {
  return {
    id: readString(record, "id"),
    path: readString(record, "path"),
    sourceType: readString(record, "source_type"),
    enabled: readBoolean(record, "enabled"),
  };
}

function readString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw new Error(`malformed_import_contract:${field}`);
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  if (typeof value !== "boolean") {
    throw new Error(`malformed_import_contract:${field}`);
  }
  return value;
}
