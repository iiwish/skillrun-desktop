import { useMemo, useState } from "react";
import "./App.css";
import { createTauriCommandExecutor } from "./core/runner";
import { refreshSwitchboard } from "./core/switchboardService";
import { ExposurePreview } from "./views/ExposurePreview";
import { ImportFlow } from "./views/ImportFlow";
import { MountManager } from "./views/MountManager";
import { EnvelopeExplorer } from "./views/EnvelopeExplorer";
import { Switchboard } from "./views/Switchboard";
import {
  buildExposurePreviewState,
  loadExposurePreview,
  type ExposurePreviewError,
  type ExposurePreviewState,
} from "./state/exposure";
import {
  IMPORT_SAFETY_COPY,
  runImportFlow,
  type ImportFlowState,
} from "./state/importFlow";
import {
  MOUNT_SAFETY_COPY,
  applyMount,
  loadMountPlan,
  rollbackMount,
  type MountManagerError,
  type MountManagerState,
} from "./state/mountManager";
import {
  RUNS_SAFETY_COPY,
  inspectRun,
  loadRunsList,
  type RunDetailState,
  type RunsError,
  type RunsListState,
} from "./state/runs";
import {
  SWITCHBOARD_SAFETY_COPY,
  applySwitchboardAction,
  buildSwitchboardState,
  type SwitchboardActionError,
  type SwitchboardCapsule,
  type SwitchboardState,
} from "./state/switchboard";

type DashboardView = "import" | "switchboard" | "exposure" | "mount" | "runs";

type PendingTask =
  | "import"
  | "switchboard.refresh"
  | "switchboard.action"
  | "exposure.refresh"
  | "mount.plan"
  | "mount.apply"
  | "mount.rollback"
  | "runs.refresh"
  | "runs.inspect";

const views: Array<{ id: DashboardView; label: string; spineLabel: string }> = [
  { id: "import", label: "Import", spineLabel: "Import" },
  { id: "switchboard", label: "Switchboard", spineLabel: "Review + Enable" },
  { id: "exposure", label: "Exposure", spineLabel: "Preview" },
  { id: "mount", label: "Mount", spineLabel: "Mount" },
  { id: "runs", label: "Runs", spineLabel: "Inspect Runs" },
];

const initialImportState: ImportFlowState = {
  status: "idle",
  safetyCopy: IMPORT_SAFETY_COPY,
};

const initialSwitchboardState: SwitchboardState = {
  status: "ready",
  capsules: [],
  exposureTools: [],
  safetyCopy: SWITCHBOARD_SAFETY_COPY,
};

const initialExposureState: ExposurePreviewState = buildExposurePreviewState({
  exposure: { tools: [] },
  dryRun: {
    mcp: { dry_run: true, transport: "stdio", protocol: "model-context-protocol" },
    router: { capsules: 0 },
    tools: [],
    resources: [],
  },
});

const initialMountState: MountManagerState = {
  status: "ready",
  mode: "not_planned",
  clientId: "claude-desktop",
  clientName: "Claude Desktop",
  supported: true,
  detected: false,
  configPath: "",
  backupPath: "",
  rollbackBackupPath: "",
  routerCommand: "skillrun",
  routerArgs: ["router", "serve", "--mcp"],
  warnings: [],
  applied: false,
  rolledBack: false,
  canApply: false,
  canRollback: false,
  safetyCopy: MOUNT_SAFETY_COPY,
};

const initialRunsListState: RunsListState = {
  status: "ready",
  scope: { kind: "all" },
  runs: [],
  safetyCopy: RUNS_SAFETY_COPY,
};

function App() {
  const executor = useMemo(() => createTauriCommandExecutor(), []);
  const [activeView, setActiveView] = useState<DashboardView>("import");
  const [packagePath, setPackagePath] = useState("");
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string>();
  const [pendingTask, setPendingTask] = useState<PendingTask>();
  const [importState, setImportState] = useState<ImportFlowState>(initialImportState);
  const [switchboardState, setSwitchboardState] = useState<SwitchboardState>(initialSwitchboardState);
  const [switchboardError, setSwitchboardError] = useState<SwitchboardActionError>();
  const [exposureState, setExposureState] = useState<ExposurePreviewState>(initialExposureState);
  const [exposureError, setExposureError] = useState<ExposurePreviewError>();
  const [mountState, setMountState] = useState<MountManagerState>(initialMountState);
  const [mountError, setMountError] = useState<MountManagerError>();
  const [runsListState, setRunsListState] = useState<RunsListState>(initialRunsListState);
  const [runDetailState, setRunDetailState] = useState<RunDetailState>();
  const [runsError, setRunsError] = useState<RunsError>();
  const [selectedRunId, setSelectedRunId] = useState<string>();

  const selectedCapsule = switchboardState.capsules.find((capsule) => capsule.id === selectedCapsuleId);

  async function handleImport() {
    if (!packagePath) {
      return;
    }

    setPendingTask("import");
    setImportState({
      status: "importing",
      packagePath,
      safetyCopy: IMPORT_SAFETY_COPY,
    });

    const nextState = await runImportFlow({ packagePath, executor });
    setImportState(nextState);
    setPendingTask(undefined);

    if (nextState.status === "review_ready" && nextState.capsule) {
      setSelectedCapsuleId(nextState.capsule.id);
      setActiveView("switchboard");
      void handleRefreshSwitchboard(nextState.capsule.id);
    }
  }

  async function handleRefreshSwitchboard(nextSelectedCapsuleId = selectedCapsuleId) {
    setPendingTask("switchboard.refresh");
    setSwitchboardError(undefined);

    try {
      const snapshot = await refreshSwitchboard({ executor });
      const nextState = buildSwitchboardState(snapshot);
      setSwitchboardState(nextState);
      if (nextSelectedCapsuleId ?? nextState.capsules[0]?.id) {
        setSelectedCapsuleId(nextSelectedCapsuleId ?? nextState.capsules[0].id);
      }
    } catch (error) {
      setSwitchboardError(toActionError(error, "Switchboard refresh failed."));
    } finally {
      setPendingTask(undefined);
    }
  }

  async function handleSwitchboardAction(action: "enable" | "disable", capsule: SwitchboardCapsule) {
    setSelectedCapsuleId(capsule.id);
    setPendingTask("switchboard.action");
    setSwitchboardError(undefined);

    try {
      if (action === "enable" && capsule.requiresEnableConfirmation) {
        const confirmed = window.confirm(
          `Imported capsule enable requires explicit confirmation.\n\nEnabled means local exposure intent only; it does not make ${capsule.id} trusted or sandboxed.`,
        );
        if (!confirmed) {
          return;
        }
      }

      const result = await applySwitchboardAction({
        action,
        capsule,
        confirmed: true,
        executor,
      });

      if (result.status === "ready") {
        setSwitchboardState(result.state);
        setActiveView(action === "enable" ? "exposure" : "switchboard");
      } else if (result.status === "error") {
        setSwitchboardError(result.error);
      }
    } finally {
      setPendingTask(undefined);
    }
  }

  async function handleRefreshExposure() {
    setPendingTask("exposure.refresh");
    setExposureError(undefined);

    const result = await loadExposurePreview({ executor });
    if (result.status === "ready") {
      setExposureState(result.state);
    } else {
      setExposureError(result.error);
    }
    setPendingTask(undefined);
  }

  async function handleMountPlan() {
    setPendingTask("mount.plan");
    setMountError(undefined);

    const result = await loadMountPlan({
      clientId: "claude-desktop",
      executor,
    });
    if (result.status === "ready") {
      setMountState(result.state);
    } else if (result.status === "error") {
      setMountError(result.error);
    }
    setPendingTask(undefined);
  }

  async function handleMountApply() {
    setPendingTask("mount.apply");
    setMountError(undefined);

    try {
      const confirmation = await applyMount({
        state: mountState,
        confirmed: false,
        executor,
      });

      if (confirmation.status === "confirmation_required") {
        const confirmed = window.confirm(
          `${confirmation.message}\n\nCore will update the MCP client config. This does not install dependencies or mark exposed tools trusted.`,
        );
        if (!confirmed) {
          return;
        }
      }

      const result = await applyMount({
        state: mountState,
        confirmed: true,
        executor,
      });

      if (result.status === "ready") {
        setMountState(result.state);
        setActiveView("runs");
      } else if (result.status === "error") {
        setMountError(result.error);
      }
    } finally {
      setPendingTask(undefined);
    }
  }

  async function handleMountRollback() {
    setPendingTask("mount.rollback");
    setMountError(undefined);

    try {
      const confirmation = await rollbackMount({
        state: mountState,
        confirmed: false,
        executor,
      });

      if (confirmation.status === "confirmation_required") {
        const confirmed = window.confirm(
          `${confirmation.message}\n\nRollback uses the Core-returned backup path only: ${mountState.rollbackBackupPath}.`,
        );
        if (!confirmed) {
          return;
        }
      }

      const result = await rollbackMount({
        state: mountState,
        confirmed: true,
        executor,
      });

      if (result.status === "ready") {
        setMountState(result.state);
      } else if (result.status === "error") {
        setMountError(result.error);
      }
    } finally {
      setPendingTask(undefined);
    }
  }

  async function handleRunsRefresh() {
    setPendingTask("runs.refresh");
    setRunsError(undefined);

    const result = await loadRunsList({
      capsuleId: selectedCapsuleId,
      limit: 10,
      executor,
    });

    if (result.status === "ready") {
      setRunsListState(result.state);
      setRunDetailState(undefined);
      setSelectedRunId(undefined);
    } else {
      setRunsError(result.error);
    }
    setPendingTask(undefined);
  }

  async function handleRunInspect(runId: string, capsuleId: string) {
    setSelectedRunId(runId);
    setPendingTask("runs.inspect");
    setRunsError(undefined);

    const result = await inspectRun({
      runId,
      capsuleId,
      executor,
    });

    if (result.status === "ready") {
      setRunDetailState(result.state);
    } else {
      setRunsError(result.error);
    }
    setPendingTask(undefined);
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
        <nav aria-label="Alpha spine navigation">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={activeView === view.id ? "active" : ""}
              onClick={() => setActiveView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace" aria-label="Alpha dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">Local consumer control plane</p>
            <h2>{"Import -> review -> enable -> preview -> mount -> inspect runs"}</h2>
          </div>
          <button type="button" onClick={() => void handleRefreshSwitchboard()}>
            Refresh Dashboard
          </button>
        </header>

        <section className="spine" aria-label="Alpha flow">
          {views.map((view, index) => (
            <button
              key={view.id}
              type="button"
              className={activeView === view.id ? "spine-step active" : "spine-step"}
              onClick={() => setActiveView(view.id)}
            >
              <span>{index + 1}</span>
              {view.spineLabel}
            </button>
          ))}
        </section>

        <section className="status-grid" aria-label="Desktop alpha status">
          <article>
            <span className="label">Imported</span>
            <strong>{importState.capsule?.id ?? "No imported capsule selected"}</strong>
            <p>Imported means registered from `.skr`; it is not trusted or sandboxed.</p>
          </article>
          <article>
            <span className="label">Enabled</span>
            <strong>{selectedCapsule ? String(selectedCapsule.enabled) : "Unknown"}</strong>
            <p>Enabled is local exposure intent, not a trust decision.</p>
          </article>
          <article>
            <span className="label">Readiness</span>
            <strong>{selectedCapsule?.readinessStatus ?? "Not checked"}</strong>
            <p>Readiness is Core preflight status; failed capsules are not runnable.</p>
          </article>
          <article>
            <span className="label">Exposed</span>
            <strong>{exposureState.exposedTools.length} tools</strong>
            <p>Exposed tools are enabled and ready; exposed does not mean sandboxed.</p>
          </article>
        </section>

        {pendingTask ? <p className="pending">Running {pendingTask}...</p> : null}

        <section className="view-frame">
          {activeView === "import" ? (
            <section className="flow-panel">
              <form
                className="path-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleImport();
                }}
              >
                <label htmlFor="package-path">.skr package path</label>
                <input
                  id="package-path"
                  value={packagePath}
                  onChange={(event) => setPackagePath(event.target.value)}
                  placeholder="/path/to/capsule.skr"
                />
              </form>
              <ImportFlow
                state={importState}
                selectedPath={packagePath}
                onSelectPackage={() => {
                  const nextPath = window.prompt("Enter a local .skr package path", packagePath);
                  if (nextPath !== null) {
                    setPackagePath(nextPath);
                  }
                }}
                onImport={() => void handleImport()}
              />
            </section>
          ) : null}

          {activeView === "switchboard" ? (
            <Switchboard
              state={switchboardState}
              pendingCapsuleId={pendingTask === "switchboard.action" ? selectedCapsuleId : undefined}
              error={switchboardError}
              onRefresh={() => void handleRefreshSwitchboard()}
              onEnable={(capsule) => void handleSwitchboardAction("enable", capsule)}
              onDisable={(capsule) => void handleSwitchboardAction("disable", capsule)}
            />
          ) : null}

          {activeView === "exposure" ? (
            <ExposurePreview
              state={exposureState}
              error={exposureError}
              onRefresh={() => void handleRefreshExposure()}
            />
          ) : null}

          {activeView === "mount" ? (
            <MountManager
              state={mountState}
              error={mountError}
              pendingAction={mountPendingAction(pendingTask)}
              onPlan={() => void handleMountPlan()}
              onApply={() => void handleMountApply()}
              onRollback={() => void handleMountRollback()}
            />
          ) : null}

          {activeView === "runs" ? (
            <EnvelopeExplorer
              listState={runsListState}
              detailState={runDetailState}
              error={runsError}
              selectedRunId={selectedRunId}
              onRefresh={() => void handleRunsRefresh()}
              onInspect={(runId, capsuleId) => void handleRunInspect(runId, capsuleId)}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function mountPendingAction(task: PendingTask | undefined): "plan" | "apply" | "rollback" | undefined {
  if (task === "mount.plan") {
    return "plan";
  }
  if (task === "mount.apply") {
    return "apply";
  }
  if (task === "mount.rollback") {
    return "rollback";
  }
  return undefined;
}

function toActionError(error: unknown, fallback: string): SwitchboardActionError {
  return {
    kind: typeof error === "object" && error !== null && "kind" in error
      ? String((error as { kind: unknown }).kind)
      : "unknown_core_error",
    message: error instanceof Error ? error.message : fallback,
  };
}

export default App;
