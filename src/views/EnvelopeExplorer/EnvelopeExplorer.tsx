import type {
  RunDetailState,
  RunsError,
  RunsListState,
} from "../../state/runs";
import { RUNS_SAFETY_COPY } from "../../state/runs";

export type EnvelopeExplorerProps = {
  listState: RunsListState;
  detailState?: RunDetailState;
  error?: RunsError;
  selectedRunId?: string;
  onRefresh: () => void;
  onInspect: (runId: string, capsuleId: string) => void;
};

export function EnvelopeExplorer({
  listState,
  detailState,
  error,
  selectedRunId,
  onRefresh,
  onInspect,
}: EnvelopeExplorerProps) {
  return (
    <section aria-label="Envelope explorer">
      <header>
        <p className="eyebrow">Envelope Explorer</p>
        <h2>Runs</h2>
      </header>

      <p>{RUNS_SAFETY_COPY}</p>

      <button type="button" onClick={onRefresh}>
        Refresh
      </button>

      {error ? <p role="alert">{error.message}</p> : null}

      <section aria-label="Run list">
        <h3>Run List</h3>
        {listState.runs.length === 0 ? <p>No runs found.</p> : null}
        {listState.runs.map((run) => (
          <article key={`${run.capsuleId}:${run.runId}`} aria-current={selectedRunId === run.runId}>
            <h4>{run.runId}</h4>
            <p>Capsule: {run.capsuleId}</p>
            <p>Status: {run.status}</p>
            <p>Mode: {run.mode}</p>
            <p>Duration: {run.durationMs ?? "unknown"} ms</p>
            <p>Artifacts: {run.artifactCount}</p>
            {run.errorCode ? <p>Error: {run.errorCode}</p> : null}
            <button type="button" onClick={() => onInspect(run.runId, run.capsuleId)}>
              Inspect
            </button>
          </article>
        ))}
      </section>

      {detailState ? (
        <section aria-label="Run detail">
          <h3>Run Detail</h3>
          <p>Run: {detailState.runId}</p>
          <p>Capsule: {detailState.capsuleId}</p>
          <p>Status: {detailState.recordStatus}</p>
          <p>Envelope: {detailState.envelope.status}</p>
          <p>Envelope keys: {detailState.envelope.valueSummary.keys.join(", ") || "none"}</p>
          <p>Input available: {String(detailState.input.available)}</p>
          <p>Input included: {String(detailState.input.included)}</p>
          <p>Stdout available: {String(detailState.logs.stdoutAvailable)}</p>
          <p>Stderr available: {String(detailState.logs.stderrAvailable)}</p>

          <section aria-label="Artifact metadata">
            <h4>Artifacts</h4>
            {detailState.artifacts.length === 0 ? <p>No artifacts reported.</p> : null}
            {detailState.artifacts.map((artifact) => (
              <article key={`${artifact.path}:${artifact.name}`}>
                <h5>{artifact.name}</h5>
                <p>Kind: {artifact.kind}</p>
                <p>Path: {artifact.path}</p>
                <p>Available: {String(artifact.available)}</p>
              </article>
            ))}
          </section>
        </section>
      ) : null}
    </section>
  );
}
