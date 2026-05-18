import type { ImportFlowState } from "../../state/importFlow";
import { IMPORT_SAFETY_COPY } from "../../state/importFlow";

export type ImportFlowProps = {
  state: ImportFlowState;
  selectedPath?: string;
  onSelectPackage: () => void;
  onImport: () => void;
};

export function ImportFlow({
  state,
  selectedPath,
  onSelectPackage,
  onImport,
}: ImportFlowProps) {
  const packagePath = selectedPath ?? state.packagePath;
  const canImport = Boolean(packagePath) && state.status !== "importing";

  return (
    <section aria-label="Import .skr package">
      <header>
        <p className="eyebrow">Import Flow</p>
        <h2>Import .skr</h2>
      </header>

      <p>{IMPORT_SAFETY_COPY}</p>

      <div>
        <button type="button" onClick={onSelectPackage}>
          Choose .skr
        </button>
        <button type="button" onClick={onImport} disabled={!canImport}>
          Import
        </button>
      </div>

      {packagePath ? <p>Selected: {packagePath}</p> : null}
      {state.status === "importing" ? <p>Importing...</p> : null}
      {state.status === "error" ? <p role="alert">{state.error?.message}</p> : null}
      {state.status === "review_ready" && state.capsule ? (
        <article aria-label="Capsule review">
          <h3>{state.capsule.id}</h3>
          <p>Source: {state.capsule.sourceType}</p>
          <p>Enabled: {String(state.capsule.enabled)}</p>
        </article>
      ) : null}
    </section>
  );
}
