import type {
  MountManagerError,
  MountManagerState,
} from "../../state/mountManager";
import { MOUNT_SAFETY_COPY } from "../../state/mountManager";

export type MountManagerProps = {
  state: MountManagerState;
  error?: MountManagerError;
  pendingAction?: "plan" | "apply" | "rollback";
  onPlan: () => void;
  onApply: () => void;
  onRollback: () => void;
};

export function MountManager({
  state,
  error,
  pendingAction,
  onPlan,
  onApply,
  onRollback,
}: MountManagerProps) {
  return (
    <section aria-label="Mount manager">
      <header>
        <p className="eyebrow">Mount Manager</p>
        <h2>{state.clientName}</h2>
      </header>

      <p>{MOUNT_SAFETY_COPY}</p>

      <div>
        <button type="button" onClick={onPlan} disabled={pendingAction === "plan"}>
          Refresh plan
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!state.canApply || pendingAction === "apply"}
        >
          Apply mount
        </button>
        <button
          type="button"
          onClick={onRollback}
          disabled={!state.canRollback || pendingAction === "rollback"}
        >
          Roll back
        </button>
      </div>

      {error ? <p role="alert">{error.message}</p> : null}
      {state.mode === "plan_only" ? <p>This client is plan-only in this release.</p> : null}

      <dl>
        <dt>Client</dt>
        <dd>{state.clientId}</dd>
        <dt>Supported</dt>
        <dd>{String(state.supported)}</dd>
        <dt>Detected</dt>
        <dd>{String(state.detected)}</dd>
        <dt>Config</dt>
        <dd>{state.configPath || "unknown"}</dd>
        <dt>Router</dt>
        <dd>
          {state.routerCommand} {state.routerArgs.join(" ")}
        </dd>
        <dt>Backup</dt>
        <dd>{state.rollbackBackupPath || state.backupPath || "none"}</dd>
      </dl>

      {state.warnings.length > 0 ? (
        <section aria-label="Mount warnings">
          <h3>Warnings</h3>
          <ul>
            {state.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
