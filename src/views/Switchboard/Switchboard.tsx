import type {
  SwitchboardActionError,
  SwitchboardCapsule,
  SwitchboardState,
} from "../../state/switchboard";
import { SWITCHBOARD_SAFETY_COPY } from "../../state/switchboard";

export type SwitchboardProps = {
  state: SwitchboardState;
  pendingCapsuleId?: string;
  error?: SwitchboardActionError;
  onRefresh: () => void;
  onEnable: (capsule: SwitchboardCapsule) => void;
  onDisable: (capsule: SwitchboardCapsule) => void;
};

export function Switchboard({
  state,
  pendingCapsuleId,
  error,
  onRefresh,
  onEnable,
  onDisable,
}: SwitchboardProps) {
  return (
    <section aria-label="Capsule switchboard">
      <header>
        <p className="eyebrow">Switchboard</p>
        <h2>Capsules</h2>
      </header>

      <p>{SWITCHBOARD_SAFETY_COPY}</p>

      <button type="button" onClick={onRefresh}>
        Refresh
      </button>

      {error ? <p role="alert">{error.message}</p> : null}

      {state.capsules.length === 0 ? <p>No capsules registered.</p> : null}

      <div>
        {state.capsules.map((capsule) => {
          const isPending = pendingCapsuleId === capsule.id;
          return (
            <article key={capsule.id} aria-label={`Capsule ${capsule.id}`}>
              <h3>{capsule.name}</h3>
              <dl>
                <dt>ID</dt>
                <dd>{capsule.id}</dd>
                <dt>Source</dt>
                <dd>{capsule.sourceType}</dd>
                <dt>Exposure</dt>
                <dd>{capsule.exposureLabel}</dd>
                <dt>Readiness</dt>
                <dd>
                  {capsule.readinessLabel} ({capsule.readinessStatus})
                </dd>
                <dt>Runtime</dt>
                <dd>
                  {capsule.adapter} / {capsule.entrypoint}
                </dd>
                <dt>Tool</dt>
                <dd>{capsule.toolName}</dd>
                <dt>Manifest</dt>
                <dd>{capsule.manifestFreshness}</dd>
              </dl>
              {capsule.readinessOk ? null : <p>Next step: {capsule.nextStep}</p>}
              {capsule.requiresEnableConfirmation ? <p>Imported capsule enable requires confirmation.</p> : null}
              <div>
                <button
                  type="button"
                  onClick={() => onEnable(capsule)}
                  disabled={!capsule.canEnable || isPending}
                >
                  Enable exposure intent
                </button>
                <button
                  type="button"
                  onClick={() => onDisable(capsule)}
                  disabled={!capsule.canDisable || isPending}
                >
                  Disable exposure intent
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <section aria-label="Current exposure">
        <h3>Exposure</h3>
        {state.exposureTools.length === 0 ? <p>No tools exposed.</p> : null}
        {state.exposureTools.map((tool) => (
          <article key={`${tool.capsuleId}:${tool.toolName}`}>
            <h4>{tool.toolName}</h4>
            <p>Capsule: {tool.capsuleId}</p>
            <p>Readiness: {tool.readinessStatus}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
