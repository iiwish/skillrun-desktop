import { useMemo, useState } from "react";
import "./App.css";
import {
  refreshDashboardStatus,
  type DashboardRefreshSnapshot,
} from "./core/dashboardService";
import { createTauriCommandExecutor } from "./core/runner";
import type { TrayStatus, TrayStatusKind } from "./state/trayStatus";

type RefreshState =
  | { phase: "idle" }
  | { phase: "loading"; lastSnapshot?: DashboardRefreshSnapshot }
  | { phase: "ready"; snapshot: DashboardRefreshSnapshot }
  | { phase: "failed"; message: string; lastSnapshot?: DashboardRefreshSnapshot };

function App() {
  const executor = useMemo(() => createTauriCommandExecutor(), []);
  const [refreshState, setRefreshState] = useState<RefreshState>({ phase: "idle" });

  const snapshot =
    refreshState.phase === "ready"
      ? refreshState.snapshot
      : refreshState.phase === "loading" || refreshState.phase === "failed"
        ? refreshState.lastSnapshot
        : undefined;
  const isRefreshing = refreshState.phase === "loading";

  async function handleRefresh(): Promise<void> {
    const lastSnapshot = snapshot;
    setRefreshState({ phase: "loading", lastSnapshot });

    try {
      const nextSnapshot = await refreshDashboardStatus({
        executor,
        lastKnown: lastSnapshot?.status,
      });
      setRefreshState({ phase: "ready", snapshot: nextSnapshot });
    } catch (error) {
      setRefreshState({
        phase: "failed",
        lastSnapshot,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="SkillRun sections">
        <div className="brand">
          <span className="brand-mark">SR</span>
          <div>
            <h1>SkillRun</h1>
            <p>Desktop Alpha</p>
          </div>
        </div>
        <nav>
          <a className="active" href="#status">Status</a>
          <a href="#switchboard">Switchboard</a>
          <a href="#mount">Mount</a>
          <a href="#runs">Runs</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Local consumer control plane</p>
            <h2>Core status and capsule controls</h2>
          </div>
          <button type="button" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </header>

        <section id="status" className="status-grid" aria-label="Desktop alpha status">
          <article>
            <span className="label">Core</span>
            <strong>{snapshot?.status.label ?? "Not checked"}</strong>
            <p>{statusDescription(snapshot?.status)}</p>
            {refreshState.phase === "failed" ? (
              <p className="error-text" role="alert">{refreshState.message}</p>
            ) : null}
          </article>
          <article>
            <span className="label">Source command</span>
            <strong>{snapshot ? sourceCommand(snapshot) : "Awaiting refresh"}</strong>
            <p>{snapshot ? sourceDetail(snapshot.status) : "Click Refresh to run read-only Core JSON commands."}</p>
          </article>
          <article>
            <span className="label">Refresh boundary</span>
            <strong>Read-only</strong>
            <p>Refresh runs status, inventory, exposure, mount plan, and recent runs checks only.</p>
          </article>
        </section>

        <section className="command-panel" aria-label="Core command trace" aria-live="polite">
          <div className="section-heading">
            <span className="label">Core command trace</span>
            <strong>{snapshot ? formatTimestamp(snapshot.capturedAtMs) : "No refresh yet"}</strong>
          </div>
          {snapshot ? (
            <ul className="command-list">
              {snapshot.commands.map((command) => (
                <li key={`${command.command}-${command.capturedAtMs}`}>
                  <code>{command.displayCommand}</code>
                  <span className={command.status === "ok" ? "pill success" : "pill error"}>
                    {command.status === "ok" ? "ok" : command.errorKind}
                  </span>
                  {command.errorMessage ? <p>{command.errorMessage}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Refresh has not run any `skillrun` command yet.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function statusDescription(status: TrayStatus | undefined): string {
  if (!status) {
    return "Click Refresh to query the local SkillRun Core through the Tauri runner.";
  }

  const descriptions: Record<TrayStatusKind, string> = {
    core_missing: "Desktop could not start `skillrun`; install or expose the CLI on PATH.",
    core_error: "A Core JSON command failed; inspect the command trace for the exact failing command.",
    recent_failures: "Recent run history includes a failed or error run.",
    mount_not_configured: "Claude Desktop mount plan reports pending configuration work.",
    tools_exposed: "Core exposure JSON reports at least one exposed tool.",
    capsules_disabled: "Core inventory has capsules, but none are currently exposed.",
    no_capsules: "Core inventory is empty.",
  };

  return descriptions[status.kind];
}

function sourceCommand(snapshot: DashboardRefreshSnapshot): string {
  return (
    snapshot.commands.find((command) => command.command === snapshot.status.source.command)
      ?.displayCommand ?? `skillrun ${snapshot.status.source.command}`
  );
}

function sourceDetail(status: TrayStatus): string {
  const stale = status.stale ? "Stale refresh" : "Fresh refresh";
  return `${stale}; captured ${formatTimestamp(status.source.capturedAtMs)}.`;
}

function formatTimestamp(timestampMs: number): string {
  if (timestampMs <= 0) {
    return "not captured";
  }

  return new Date(timestampMs).toLocaleString();
}

export default App;
