import type {
  ExposurePreviewError,
  ExposurePreviewState,
} from "../../state/exposure";
import { EXPOSURE_SAFETY_COPY } from "../../state/exposure";

export type ExposurePreviewProps = {
  state: ExposurePreviewState;
  error?: ExposurePreviewError;
  onRefresh: () => void;
};

export function ExposurePreview({
  state,
  error,
  onRefresh,
}: ExposurePreviewProps) {
  return (
    <section aria-label="Exposure preview">
      <header>
        <p className="eyebrow">Exposure Preview</p>
        <h2>Router Preview</h2>
      </header>

      <p>{EXPOSURE_SAFETY_COPY}</p>

      <button type="button" onClick={onRefresh}>
        Refresh
      </button>

      {error ? <p role="alert">{error.message}</p> : null}

      <section aria-label="Exposed tools">
        <h3>Tools</h3>
        {state.emptyReason === "no_tools" ? <p>No tools reported by Core.</p> : null}
        {state.emptyReason === "disabled_or_not_ready" ? (
          <p>No tools exposed. Disabled or not-ready entries are hidden from exposure.</p>
        ) : null}
        {state.exposedTools.map((tool) => (
          <article key={`${tool.capsuleId}:${tool.toolName}`}>
            <h4>{tool.toolName}</h4>
            <p>Capsule: {tool.capsuleId}</p>
            <p>Readiness: {tool.readinessStatus}</p>
            <p>Manifest: {tool.manifestHash}</p>
          </article>
        ))}
      </section>

      <section aria-label="Router dry-run">
        <h3>Dry Run</h3>
        <dl>
          <dt>Transport</dt>
          <dd>{state.dryRun.transport}</dd>
          <dt>Protocol</dt>
          <dd>{state.dryRun.protocol}</dd>
          <dt>Capsules</dt>
          <dd>{state.dryRun.capsuleCount}</dd>
          <dt>Tools</dt>
          <dd>{state.dryRun.toolCount}</dd>
          <dt>Resources</dt>
          <dd>{state.dryRun.resourceCount}</dd>
        </dl>
      </section>

      <section aria-label="Resource metadata">
        <h3>Resources</h3>
        {state.resources.length === 0 ? <p>No resources reported by dry-run.</p> : null}
        {state.resources.map((resource) => (
          <article key={resource.uri}>
            <h4>{resource.name}</h4>
            <p>URI: {resource.uri}</p>
            <p>MIME: {resource.mimeType}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
