import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  Boxes,
  CheckCircle2,
  FilePlus2,
  Globe2,
  HardDriveDownload,
  History,
  Languages,
  LibraryBig,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Settings,
  TerminalSquare,
  ToggleLeft,
  ToggleRight,
  Upload,
  type LucideIcon,
} from "lucide-react";
import "./App.css";
import {
  Alert,
  Badge,
  Button,
  DescriptionList,
  EmptyState,
  InlineStatus,
  Metric,
  SummaryStat,
} from "./components/ui";
import {
  refreshDashboardStatus,
  type DashboardRefreshSnapshot,
} from "./core/dashboardService";
import { createTauriCommandExecutor } from "./core/runner";
import { refreshSwitchboard } from "./core/switchboardService";
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
  loadRunsIndexStatus,
  loadRunsList,
  rebuildRunsIndexState,
  type RunsIndexRebuildState,
  type RunsIndexStatusState,
  type RunDetailState,
  type RunsError,
  type RunsListState,
} from "./state/runs";
import {
  TEAM_LIBRARY_SAFETY_COPY,
  loadTeamLibraryInspect,
  type TeamCatalogItem,
  type TeamLibraryError,
  type TeamLibraryItemState,
  type TeamLibraryState,
} from "./state/teamLibrary";
import {
  SWITCHBOARD_SAFETY_COPY,
  applySwitchboardAction,
  buildSwitchboardState,
  type SwitchboardActionError,
  type SwitchboardCapsule,
  type SwitchboardState,
} from "./state/switchboard";
import type { TrayStatusKind } from "./state/trayStatus";

type DashboardView = "capsules" | "teamLibrary" | "clients" | "tools" | "runs" | "settings";
type Locale = "zh" | "en";
type CapsuleFilter = "all" | "enabled" | "issues";
type TeamLibraryFilter = "all" | "installable" | "installed" | "blocked";
type RunsOkFilter = "any" | "true" | "false";
type RunsSourceFilter = "scan" | "index";
type RunsFilters = {
  capsuleId: string;
  status: string;
  mode: string;
  ok: RunsOkFilter;
  errorCode: string;
  since: string;
  until: string;
  limit: string;
};

type PendingTask =
  | "import"
  | "teamLibrary.inspect"
  | "switchboard.refresh"
  | "switchboard.action"
  | "exposure.refresh"
  | "mount.plan"
  | "mount.apply"
  | "mount.rollback"
  | "runs.refresh"
  | "runs.inspect"
  | "runs.index.status"
  | "runs.index.rebuild";

type RefreshState =
  | { phase: "idle" }
  | { phase: "loading"; lastSnapshot?: DashboardRefreshSnapshot }
  | { phase: "ready"; snapshot: DashboardRefreshSnapshot }
  | { phase: "failed"; message: string; lastSnapshot?: DashboardRefreshSnapshot };

type ViewDefinition = {
  id: DashboardView;
  icon: LucideIcon;
  step: string;
  label: string;
  navLabel: string;
  description: string;
};

const copy = {
  zh: {
    appName: "SkillRun Desktop",
    appMeta: "本地 Capsule 工作台",
    alpha: "Alpha",
    language: "语言",
    cn: "中",
    en: "EN",
    surface: "主导航",
    title: "管理本机 Skill Capsule",
    subtitle: "Desktop 只消费 Core 的稳定 JSON surface。所有状态变化都回到 `skillrun` 命令，UI 不读取 `.skillrun` 内部目录。",
    navCapsules: "Capsule",
    navTeamLibrary: "团队库",
    navClients: "客户端",
    navTools: "暴露",
    navRuns: "记录",
    navSettings: "设置",
    capsulesTitle: "Capsule 管理",
    capsulesSubtitle: "默认工作台。扫描本机已登记 Capsule，复核就绪性与暴露意图。",
    teamLibraryTitle: "团队能力库",
    teamLibrarySubtitle: "浏览团队 catalog 中的 `.skr`、Agent Skill 和 MCP server 条目。当前只做 Core inspect，不安装、不下载、不挂载。",
    clientsTitle: "客户端挂载",
    clientsSubtitle: "复核 Claude Desktop 等 MCP client 的 Router 挂载计划。",
    toolsTitle: "工具暴露",
    toolsSubtitle: "查看 Core 报告给 Router 的 tools 和 resources。",
    runsTitle: "执行记录",
    runsSubtitle: "审查最近 run evidence、失败原因和 artifact metadata 摘要。",
    runsExplorer: "Evidence Explorer",
    sourceScan: "实时扫描",
    sourceIndex: "本地索引",
    indexStatus: "索引状态",
    indexReady: "索引可用",
    indexStale: "索引可能过期",
    indexUnavailable: "索引不可用",
    checkIndex: "检查索引",
    rebuildIndex: "重建索引",
    indexGenerated: "生成时间",
    runsIndexed: "已索引记录",
    activeFilters: "筛选条件",
    capsuleFilter: "Capsule ID",
    statusFilter: "状态",
    modeFilter: "模式",
    okFilter: "结果",
    errorCodeFilter: "错误码",
    sinceFilter: "开始时间",
    untilFilter: "结束时间",
    limitFilter: "数量",
    any: "不限",
    onlyOk: "只看成功",
    onlyFailed: "只看失败",
    settingsTitle: "设置",
    settingsSubtitle: "语言、Core 路径和本机诊断信息。",
    workspaceOverview: "工作台概览",
    registered: "已登记",
    ready: "就绪",
    attention: "需处理",
    disabled: "未启用",
    selected: "已选择",
    selectionHint: "左侧列表选择一个 Capsule，右侧会显示 readiness、runtime 和暴露操作。",
    noFilteredCapsulesTitle: "没有匹配的 Capsule",
    noFilteredCapsulesBody: "调整搜索或筛选条件，或刷新本地 registry。",
    noFilteredItemsTitle: "没有匹配的条目",
    noFilteredItemsBody: "调整搜索或筛选条件，或重新检查 catalog。",
    noCatalogTitle: "还没有载入 catalog",
    noCatalogBody: "选择或粘贴团队 catalog JSON 路径后，Desktop 只调用 Core inspect 读取摘要。",
    importAction: "导入 .skr",
    inspectCatalog: "检查 catalog",
    chooseCatalog: "选择 catalog",
    catalogPath: "Catalog 路径",
    catalogPlaceholder: "/path/to/team.catalog.json",
    catalogPathReady: "路径已准备好，可以检查 catalog。",
    catalogBrowserHelp: "浏览器预览不能读取本机 catalog。请粘贴完整路径；在 Tauri 应用里会打开系统文件选择器。",
    catalogSummary: "Catalog 摘要",
    catalogItems: "团队条目",
    itemDetails: "条目详情",
    catalogUpdated: "更新时间",
    installable: "可安装",
    installed: "已安装",
    blocked: "已阻止",
    displayOnly: "仅展示",
    itemKind: "类型",
    itemVersion: "版本",
    publisher: "发布方",
    checksum: "sha256",
    requirements: "环境要求",
    permissions: "权限摘要",
    trustNote: "团队说明",
    tags: "标签",
    filterInstallable: "可安装",
    filterInstalled: "已安装",
    filterBlocked: "已阻止",
    teamLibrarySafety: "Team Library 只展示团队 catalog 和 Core inspect 结果；不会下载、解包、安装、启用、挂载、运行，也不会把条目标记为可信。",
    searchCapsules: "搜索 Capsule",
    searchCatalogItems: "搜索团队条目",
    filterAll: "全部",
    filterEnabled: "已启用",
    filterIssues: "有问题",
    capsule: "Capsule",
    status: "状态",
    exposure: "暴露",
    lastRun: "最近运行",
    actions: "操作",
    close: "关闭",
    capsuleDetails: "Capsule 详情",
    noSelection: "选择一个 Capsule 查看详情。",
    emptyCapsulesTitle: "还没有 Capsule",
    emptyCapsulesBody: "导入 `.skr` 后，它会出现在这里。导入不会自动启用、挂载或标记可信。",
    settingsCorePath: "Core 路径",
    settingsData: "本地数据",
    settingsDiagnostics: "诊断",
    startBadge: "下一步",
    startTitle: "导入一个 .skr Capsule",
    startSubtitle: "选择本地 .skr 文件，确认后进入 Capsule 管理。导入只登记到本机 registry，不安装依赖、不启用、不挂载。",
    startHelp: "还没有 Capsule 时，从这里开始。已有 Capsule 可以直接切到 Capsule 管理。",
    statusTitle: "当前环境",
    statusHint: "刷新后显示 Core、挂载和暴露状态。",
    nextFlowTitle: "完成导入后的路径",
    chooseFile: "选择 .skr 文件",
    pastePathHint: "也可以直接粘贴绝对路径。",
    browserPathHelp: "浏览器预览不能读取本机绝对路径。请把 .skr 文件的完整路径粘贴到输入框；在 Tauri 应用里会打开系统文件选择器。",
    pathReady: "路径已准备好，可以导入。",
    refresh: "刷新状态",
    refreshing: "刷新中",
    noRefresh: "尚未刷新",
    pending: "正在执行",
    selectedCapsule: "当前 Capsule",
    none: "无",
    unknown: "未知",
    notChecked: "未检查",
    true: "是",
    false: "否",
    shellStatus: "本机状态",
    core: "Core",
    imported: "已导入",
    enabled: "已启用",
    readiness: "就绪性",
    exposed: "已暴露",
    tools: "工具",
    commands: "命令证据",
    boundaries: "安全边界",
    commandTrace: "Core 命令记录",
    commandTraceEmpty: "刷新状态后会在这里显示本次执行过的 `skillrun` 命令。",
    lastCaptured: "捕获时间",
    statusFailed: "状态刷新失败",
    importLabel: ".skr 包路径",
    importPlaceholder: "/path/to/capsule.skr",
    choosePackage: "选择路径",
    importPackage: "导入 .skr",
    selectedPath: "已选择",
    importing: "导入中",
    capsuleReview: "导入结果",
    source: "来源",
    switchboardLabel: "Capsule 管理",
    switchboardRefresh: "刷新 Capsule",
    enable: "允许暴露",
    disable: "停止暴露",
    exposurePreview: "暴露预览",
    refreshPreview: "刷新预览",
    noCapsules: "还没有已登记的 Capsule。",
    noTools: "Core 当前没有报告可暴露工具。",
    noToolsFiltered: "没有工具暴露。disabled 或 not-ready 的条目不会进入 Router exposure。",
    noResources: "dry-run 没有报告资源。",
    noRuns: "还没有 run evidence。",
    inspect: "查看证据",
    runList: "执行记录",
    runDetail: "证据详情",
    refreshRuns: "刷新记录",
    mountManager: "挂载管理",
    mountPlan: "刷新挂载计划",
    applyMount: "应用挂载",
    rollback: "回滚",
    planOnly: "当前客户端在这个 alpha 中只支持 plan。",
    client: "客户端",
    supported: "支持",
    detected: "已检测",
    config: "配置",
    router: "Router",
    backup: "备份",
    warnings: "警告",
    dryRun: "Router dry-run",
    routerStatus: "Router 状态",
    routerReady: "Router snapshot 可用",
    routerIssue: "Router 需要处理",
    transport: "传输",
    protocol: "协议",
    capsules: "Capsules",
    resources: "资源",
    artifactMetadata: "Artifact 元数据",
    mode: "模式",
    duration: "耗时",
    artifacts: "产物",
    manifest: "Manifest",
    runtime: "运行时",
    path: "路径",
    input: "输入",
    stdout: "标准输出",
    stderr: "错误输出",
    available: "可用",
    included: "已内嵌",
    flowTitle: "Alpha 主线",
    flowHint: "按顺序推进，危险动作需要显式确认。",
    stepImport: "导入",
    stepReview: "复核 + 启用",
    stepPreview: "预览",
    stepMount: "挂载",
    stepRuns: "查看记录",
    boundaryItems: [
      "enabled 只是本地暴露意图，不代表可信或沙箱。",
      "Desktop 不直接修改 MCP 配置，挂载和回滚都交给 Core。",
      "Runs 默认只展示摘要和 metadata，不读取完整 input、log 或 artifact 内容。",
    ],
    importSafety: "导入只把 `.skr` 加入本地 registry。不会安装依赖、不会自动启用、不会自动挂载，也不会把它标记为可信。",
    teamLibraryEmptyAction: "先检查 catalog",
    teamLibraryDisplayOnlyReason: "这个条目当前只用于展示，不能在 Desktop 中安装或执行。",
    teamLibraryBlockedReason: "Core inspect 标记为不可安装。Desktop 不提供绕过路径。",
    teamLibraryPlanLater: "安装计划稍后开放",
    switchboardSafety: "enabled 表示允许 Router 暴露该 Capsule。就绪性来自 Core preflight，不代表业务正确性、trust 或 sandbox。",
    exposureSafety: "这里只展示 Core 报告的 tool/resource metadata。exposed 不等于 trusted、safe 或 sandboxed。",
    mountSafety: "Desktop 只请求 Core 计算、应用和回滚 MCP client 配置。所有真实写入都必须先确认。",
    runsSafety: "Run evidence 只通过 Core JSON surface 读取。默认不展示完整输入、日志正文或 artifact 内容。",
    confirmEnable: (id: string) =>
      `确认允许 ${id} 暴露给 Router？\n\nenabled 只是本地暴露意图，不代表可信、安装依赖或沙箱。`,
    promptPackage: "输入本地 .skr 包路径",
    confirmMountExtra: "Core 将更新 MCP client 配置。这不会安装依赖，也不会把工具标记为可信。",
    confirmRollbackExtra: (backupPath: string) => `回滚只使用 Core 返回的备份路径：${backupPath}`,
  },
  en: {
    appName: "SkillRun Desktop",
    appMeta: "Local Capsule workspace",
    alpha: "Alpha",
    language: "Language",
    cn: "中",
    en: "EN",
    surface: "Primary navigation",
    title: "Manage local Skill Capsules",
    subtitle: "Desktop only consumes stable Core JSON surfaces. Every state change is backed by a `skillrun` command; the UI never reads `.skillrun` internals.",
    navCapsules: "Capsules",
    navTeamLibrary: "Team Library",
    navClients: "Clients",
    navTools: "Exposure",
    navRuns: "Runs",
    navSettings: "Settings",
    capsulesTitle: "Capsule management",
    capsulesSubtitle: "Default workspace for scanning registered Capsules, readiness, and exposure intent.",
    teamLibraryTitle: "Team Library",
    teamLibrarySubtitle: "Browse team catalog entries for `.skr`, Agent Skills, and MCP servers. This phase only runs Core inspect; it does not install, download, or mount.",
    clientsTitle: "Client mounts",
    clientsSubtitle: "Review Router mount plans for Claude Desktop and other MCP clients.",
    toolsTitle: "Tool exposure",
    toolsSubtitle: "Inspect Core-reported tools and resources for Router exposure.",
    runsTitle: "Run evidence",
    runsSubtitle: "Review recent run evidence, failures, and artifact metadata summaries.",
    runsExplorer: "Evidence Explorer",
    sourceScan: "Live scan",
    sourceIndex: "Local index",
    indexStatus: "Index status",
    indexReady: "Index ready",
    indexStale: "Index may be stale",
    indexUnavailable: "Index unavailable",
    checkIndex: "Check index",
    rebuildIndex: "Rebuild index",
    indexGenerated: "Generated",
    runsIndexed: "Runs indexed",
    activeFilters: "Filters",
    capsuleFilter: "Capsule ID",
    statusFilter: "Status",
    modeFilter: "Mode",
    okFilter: "Result",
    errorCodeFilter: "Error code",
    sinceFilter: "Since",
    untilFilter: "Until",
    limitFilter: "Limit",
    any: "Any",
    onlyOk: "OK only",
    onlyFailed: "Failed only",
    settingsTitle: "Settings",
    settingsSubtitle: "Language, Core path, and local diagnostics.",
    workspaceOverview: "Workspace overview",
    registered: "Registered",
    ready: "Ready",
    attention: "Needs attention",
    disabled: "Disabled",
    selected: "Selected",
    selectionHint: "Select a capsule from the list to inspect readiness, runtime, and exposure actions here.",
    noFilteredCapsulesTitle: "No matching capsules",
    noFilteredCapsulesBody: "Adjust the search or filters, or refresh the local registry.",
    noFilteredItemsTitle: "No matching items",
    noFilteredItemsBody: "Adjust search or filters, or inspect the catalog again.",
    noCatalogTitle: "No catalog loaded",
    noCatalogBody: "Choose or paste a team catalog JSON path. Desktop only calls Core inspect for the summary.",
    importAction: "Import .skr",
    inspectCatalog: "Inspect catalog",
    chooseCatalog: "Choose catalog",
    catalogPath: "Catalog path",
    catalogPlaceholder: "/path/to/team.catalog.json",
    catalogPathReady: "Path ready. You can inspect the catalog.",
    catalogBrowserHelp: "Browser preview cannot read a local catalog. Paste the full path; the Tauri app opens the native file picker.",
    catalogSummary: "Catalog summary",
    catalogItems: "Team items",
    itemDetails: "Item detail",
    catalogUpdated: "Updated",
    installable: "Installable",
    installed: "Installed",
    blocked: "Blocked",
    displayOnly: "Display only",
    itemKind: "Kind",
    itemVersion: "Version",
    publisher: "Publisher",
    checksum: "sha256",
    requirements: "Requirements",
    permissions: "Permissions",
    trustNote: "Team note",
    tags: "Tags",
    filterInstallable: "Installable",
    filterInstalled: "Installed",
    filterBlocked: "Blocked",
    teamLibrarySafety: TEAM_LIBRARY_SAFETY_COPY,
    searchCapsules: "Search capsules",
    searchCatalogItems: "Search team items",
    filterAll: "All",
    filterEnabled: "Enabled",
    filterIssues: "Issues",
    capsule: "Capsule",
    status: "Status",
    exposure: "Exposure",
    lastRun: "Last run",
    actions: "Actions",
    close: "Close",
    capsuleDetails: "Capsule detail",
    noSelection: "Select a capsule to inspect it.",
    emptyCapsulesTitle: "No capsules yet",
    emptyCapsulesBody: "After importing a `.skr`, it appears here. Import does not enable, mount, or trust it automatically.",
    settingsCorePath: "Core path",
    settingsData: "Local data",
    settingsDiagnostics: "Diagnostics",
    startBadge: "Next step",
    startTitle: "Import a .skr Capsule",
    startSubtitle: "Choose a local .skr file, then continue into Capsule management. Import only registers it locally; it does not install, enable, or mount anything.",
    startHelp: "Start here when there are no capsules. If you already have one, jump to Switchboard.",
    statusTitle: "Current environment",
    statusHint: "Refresh to show Core, mount, and exposure status.",
    nextFlowTitle: "Path after import",
    chooseFile: "Choose .skr file",
    pastePathHint: "You can also paste an absolute path.",
    browserPathHelp: "Browser preview cannot read local absolute paths. Paste the full .skr path into the input; the Tauri app opens the native file picker.",
    pathReady: "Path ready. You can import now.",
    refresh: "Refresh status",
    refreshing: "Refreshing",
    noRefresh: "No refresh yet",
    pending: "Running",
    selectedCapsule: "Selected capsule",
    none: "None",
    unknown: "Unknown",
    notChecked: "Not checked",
    true: "Yes",
    false: "No",
    shellStatus: "Local status",
    core: "Core",
    imported: "Imported",
    enabled: "Enabled",
    readiness: "Readiness",
    exposed: "Exposed",
    tools: "tools",
    commands: "Command evidence",
    boundaries: "Safety boundaries",
    commandTrace: "Core command trace",
    commandTraceEmpty: "Refresh status to see the `skillrun` commands executed by this session.",
    lastCaptured: "Captured",
    statusFailed: "Status refresh failed",
    importLabel: ".skr package path",
    importPlaceholder: "/path/to/capsule.skr",
    choosePackage: "Choose path",
    importPackage: "Import .skr",
    selectedPath: "Selected",
    importing: "Importing",
    capsuleReview: "Import result",
    source: "Source",
    switchboardLabel: "Switchboard",
    switchboardRefresh: "Refresh capsules",
    enable: "Enable exposure",
    disable: "Disable exposure",
    exposurePreview: "Exposure preview",
    refreshPreview: "Refresh preview",
    noCapsules: "No registered capsules yet.",
    noTools: "Core did not report any tools.",
    noToolsFiltered: "No tools exposed. Disabled or not-ready entries stay out of Router exposure.",
    noResources: "Dry-run did not report resources.",
    noRuns: "No run evidence yet.",
    inspect: "Inspect",
    runList: "Run list",
    runDetail: "Evidence detail",
    refreshRuns: "Refresh runs",
    mountManager: "Mount manager",
    mountPlan: "Refresh plan",
    applyMount: "Apply mount",
    rollback: "Roll back",
    planOnly: "This client is plan-only in this alpha.",
    client: "Client",
    supported: "Supported",
    detected: "Detected",
    config: "Config",
    router: "Router",
    backup: "Backup",
    warnings: "Warnings",
    dryRun: "Router dry-run",
    routerStatus: "Router status",
    routerReady: "Router snapshot ready",
    routerIssue: "Router needs attention",
    transport: "Transport",
    protocol: "Protocol",
    capsules: "Capsules",
    resources: "Resources",
    artifactMetadata: "Artifact metadata",
    mode: "Mode",
    duration: "Duration",
    artifacts: "Artifacts",
    manifest: "Manifest",
    runtime: "Runtime",
    path: "Path",
    input: "Input",
    stdout: "Stdout",
    stderr: "Stderr",
    available: "Available",
    included: "Included",
    flowTitle: "Alpha spine",
    flowHint: "Move through the workflow in order; dangerous actions require explicit confirmation.",
    stepImport: "Import",
    stepReview: "Review + Enable",
    stepPreview: "Preview",
    stepMount: "Mount",
    stepRuns: "Inspect Runs",
    boundaryItems: [
      "enabled is local exposure intent, not trust or sandboxing.",
      "Desktop does not mutate MCP config directly; Core handles mount and rollback.",
      "Runs show summary and metadata by default, not full input, logs, or artifact content.",
    ],
    importSafety: IMPORT_SAFETY_COPY,
    teamLibraryEmptyAction: "Inspect catalog first",
    teamLibraryDisplayOnlyReason: "This item is display-only in this phase and cannot be installed or executed from Desktop.",
    teamLibraryBlockedReason: "Core inspect marked this item not installable. Desktop does not provide a bypass.",
    teamLibraryPlanLater: "Install plan later",
    switchboardSafety: SWITCHBOARD_SAFETY_COPY,
    exposureSafety: "Exposure preview shows Core-reported tool/resource metadata only. Exposed does not mean sandboxed, trusted, or safe.",
    mountSafety: MOUNT_SAFETY_COPY,
    runsSafety: RUNS_SAFETY_COPY,
    confirmEnable: (id: string) =>
      `Allow ${id} to be exposed by Router?\n\nEnabled means local exposure intent only; it does not install dependencies, establish trust, or sandbox the capsule.`,
    promptPackage: "Enter a local .skr package path",
    confirmMountExtra: "Core will update the MCP client config. This does not install dependencies or mark exposed tools trusted.",
    confirmRollbackExtra: (backupPath: string) => `Rollback uses the Core-returned backup path only: ${backupPath}`,
  },
} as const;

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
  routerStatus: {
    ok: true,
    router: { snapshot: true, capsules: 0 },
    tools: [],
    resources: [],
    error: null,
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
  source: { kind: "scan", stale: null },
  scope: { kind: "all", source: "scan" },
  runs: [],
  safetyCopy: RUNS_SAFETY_COPY,
};

const initialRunsFilters: RunsFilters = {
  capsuleId: "",
  status: "",
  mode: "",
  ok: "any",
  errorCode: "",
  since: "",
  until: "",
  limit: "10",
};

function App() {
  const executor = useMemo(() => createTauriCommandExecutor(), []);
  const [locale, setLocale] = useState<Locale>("zh");
  const t = copy[locale];
  const views = viewDefinitions(t);
  const [activeView, setActiveView] = useState<DashboardView>("capsules");
  const [importOpen, setImportOpen] = useState(false);
  const [packagePath, setPackagePath] = useState("");
  const [pathPickerMessage, setPathPickerMessage] = useState("");
  const packagePathInputRef = useRef<HTMLInputElement>(null);
  const catalogPathInputRef = useRef<HTMLInputElement>(null);
  const [capsuleQuery, setCapsuleQuery] = useState("");
  const [capsuleFilter, setCapsuleFilter] = useState<CapsuleFilter>("all");
  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string>();
  const [catalogPath, setCatalogPath] = useState("");
  const [catalogPickerMessage, setCatalogPickerMessage] = useState("");
  const [teamLibraryQuery, setTeamLibraryQuery] = useState("");
  const [teamLibraryFilter, setTeamLibraryFilter] = useState<TeamLibraryFilter>("all");
  const [teamLibraryState, setTeamLibraryState] = useState<TeamLibraryState>();
  const [teamLibraryError, setTeamLibraryError] = useState<TeamLibraryError>();
  const [selectedTeamItemId, setSelectedTeamItemId] = useState<string>();
  const [pendingTask, setPendingTask] = useState<PendingTask>();
  const [refreshState, setRefreshState] = useState<RefreshState>({ phase: "idle" });
  const [importState, setImportState] = useState<ImportFlowState>(initialImportState);
  const [switchboardState, setSwitchboardState] = useState<SwitchboardState>(initialSwitchboardState);
  const [switchboardError, setSwitchboardError] = useState<SwitchboardActionError>();
  const [exposureState, setExposureState] = useState<ExposurePreviewState>(initialExposureState);
  const [exposureError, setExposureError] = useState<ExposurePreviewError>();
  const [mountState, setMountState] = useState<MountManagerState>(initialMountState);
  const [mountError, setMountError] = useState<MountManagerError>();
  const [runsListState, setRunsListState] = useState<RunsListState>(initialRunsListState);
  const [runDetailState, setRunDetailState] = useState<RunDetailState>();
  const [runsSource, setRunsSource] = useState<RunsSourceFilter>("scan");
  const [runsFilters, setRunsFilters] = useState<RunsFilters>(initialRunsFilters);
  const [runsIndexStatus, setRunsIndexStatus] = useState<RunsIndexStatusState>();
  const [runsIndexRebuild, setRunsIndexRebuild] = useState<RunsIndexRebuildState>();
  const [runsError, setRunsError] = useState<RunsError>();
  const [selectedRunId, setSelectedRunId] = useState<string>();

  const statusSnapshot =
    refreshState.phase === "ready"
      ? refreshState.snapshot
      : refreshState.phase === "loading" || refreshState.phase === "failed"
        ? refreshState.lastSnapshot
        : undefined;
  const selectedCapsule = switchboardState.capsules.find((capsule) => capsule.id === selectedCapsuleId);
  const selectedTeamItem = teamLibraryState?.items.find((item) => item.id === selectedTeamItemId);
  const isRefreshingStatus = refreshState.phase === "loading";
  const activeDefinition = views.find((view) => view.id === activeView) ?? views[0];
  const pendingLabel = pendingTask ? pendingTaskLabel(pendingTask, locale) : undefined;
  const filteredCapsules = switchboardState.capsules.filter((capsule) => {
    const query = capsuleQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      capsule.name.toLowerCase().includes(query) ||
      capsule.id.toLowerCase().includes(query) ||
      capsule.toolName.toLowerCase().includes(query);
    const matchesFilter =
      capsuleFilter === "all" ||
      (capsuleFilter === "enabled" && capsule.enabled) ||
      (capsuleFilter === "issues" && !capsule.readinessOk);
    return matchesQuery && matchesFilter;
  });
  const filteredTeamItems = (teamLibraryState?.items ?? []).filter((item) => {
    const query = teamLibraryQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.tags.some((tag) => tag.toLowerCase().includes(query));
    const matchesFilter =
      teamLibraryFilter === "all" ||
      (teamLibraryFilter === "installable" && item.installable) ||
      (teamLibraryFilter === "installed" && item.installed) ||
      (teamLibraryFilter === "blocked" && item.state === "blocked");
    return matchesQuery && matchesFilter;
  });

  useEffect(() => {
    if (isTauri()) {
      void handleRefreshStatus();
      void handleRefreshSwitchboard();
    }
  }, []);

  async function handleRefreshStatus(): Promise<void> {
    const lastSnapshot = statusSnapshot;
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
      setActiveView("capsules");
      setImportOpen(false);
      void handleRefreshSwitchboard(nextState.capsule.id);
    }
  }

  async function handleSelectPackage() {
    setPathPickerMessage("");

    if (!isTauri()) {
      setPathPickerMessage(t.browserPathHelp);
      packagePathInputRef.current?.focus();
      return;
    }

    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "SkillRun Capsule", extensions: ["skr"] }],
      });

      if (typeof selected === "string") {
        setPackagePath(selected);
      }
    } catch (error) {
      setPathPickerMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSelectCatalog() {
    setCatalogPickerMessage("");

    if (!isTauri()) {
      setCatalogPickerMessage(t.catalogBrowserHelp);
      catalogPathInputRef.current?.focus();
      return;
    }

    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "SkillRun Team Catalog", extensions: ["json"] }],
      });

      if (typeof selected === "string") {
        setCatalogPath(selected);
        setCatalogPickerMessage(t.catalogPathReady);
      }
    } catch (error) {
      setCatalogPickerMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleTeamLibraryInspect() {
    if (!catalogPath.trim()) {
      catalogPathInputRef.current?.focus();
      return;
    }

    setPendingTask("teamLibrary.inspect");
    setTeamLibraryError(undefined);

    const result = await loadTeamLibraryInspect({
      catalogPath: catalogPath.trim(),
      executor,
    });

    if (result.status === "ready") {
      setTeamLibraryState(result.state);
      setSelectedTeamItemId(result.state.items[0]?.id);
    } else {
      setTeamLibraryError(result.error);
    }
    setPendingTask(undefined);
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
        const confirmed = window.confirm(t.confirmEnable(capsule.id));
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
        if (action === "enable") {
          setActiveView("tools");
        }
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
        const confirmed = window.confirm(`${confirmation.message}\n\n${t.confirmMountExtra}`);
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
          `${confirmation.message}\n\n${t.confirmRollbackExtra(mountState.rollbackBackupPath ?? "")}`,
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
    const capsuleId = runsFilters.capsuleId.trim() || selectedCapsuleId;
    const limit = Number.parseInt(runsFilters.limit, 10);

    const result = await loadRunsList({
      capsuleId,
      source: runsSource,
      status: optionalFilter(runsFilters.status),
      mode: optionalFilter(runsFilters.mode),
      ok: okFilterValue(runsFilters.ok),
      errorCode: optionalFilter(runsFilters.errorCode),
      since: optionalFilter(runsFilters.since),
      until: optionalFilter(runsFilters.until),
      limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
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

  async function handleRunsIndexStatus() {
    setPendingTask("runs.index.status");
    setRunsError(undefined);

    const result = await loadRunsIndexStatus({ executor });
    if (result.status === "ready") {
      setRunsIndexStatus(result.state);
    } else {
      setRunsError(result.error);
    }
    setPendingTask(undefined);
  }

  async function handleRunsIndexRebuild() {
    setPendingTask("runs.index.rebuild");
    setRunsError(undefined);

    const result = await rebuildRunsIndexState({ executor });
    if (result.status === "ready") {
      setRunsIndexRebuild(result.state);
      void handleRunsIndexStatus();
    } else {
      setRunsError(result.error);
      setPendingTask(undefined);
    }
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
      <aside className="sidebar" aria-label={t.appName}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">SR</span>
          <div>
            <h1>SkillRun</h1>
            <p>{t.surface}</p>
          </div>
        </div>

        <nav className="side-nav" aria-label={t.surface}>
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={activeView === view.id ? "nav-item active" : "nav-item"}
              aria-label={view.label}
              onClick={() => setActiveView(view.id)}
            >
              <view.icon aria-hidden="true" />
              <span>
                <strong>{view.navLabel}</strong>
                <small>{view.description}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={statusClass(statusSnapshot?.status.kind)}>
            {statusSnapshot ? statusLabel(statusSnapshot.status.kind, locale) : t.notChecked}
          </span>
          <div className="segmented" role="group" aria-label={t.language}>
            <button type="button" className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")}>
              {t.cn}
            </button>
            <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>
              {t.en}
            </button>
          </div>
        </div>
      </aside>

      <section className="workspace" aria-label={activeDefinition.label}>
        <header className="topbar">
          <div className="topbar-copy">
            <p className="eyebrow">{t.appMeta}</p>
            <h2>{activeDefinition.label}</h2>
            <p>{activeDefinition.description}</p>
          </div>
          <div className="topbar-actions">
            {activeView === "capsules" ? (
              <Button icon={FilePlus2} onClick={() => setImportOpen(true)}>
                {t.importAction}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => {
                if (activeView === "clients") void handleMountPlan();
                else if (activeView === "tools") void handleRefreshExposure();
                else if (activeView === "runs") void handleRunsRefresh();
                else if (activeView === "teamLibrary") void handleTeamLibraryInspect();
                else {
                  void handleRefreshStatus();
                  void handleRefreshSwitchboard();
                }
              }}
              disabled={isRefreshingStatus}
              loading={isRefreshingStatus}
            >
              {isRefreshingStatus ? t.refreshing : t.refresh}
            </Button>
          </div>
        </header>

        {pendingLabel ? (
          <div className="pending-bar" role="status">
            <Loader2 aria-hidden="true" />
            <span>{t.pending}: {pendingLabel}</span>
          </div>
        ) : null}

        {activeView === "capsules" ? (
          <CapsulesPage
            t={t}
            locale={locale}
            capsules={filteredCapsules}
            allCapsules={switchboardState.capsules}
            query={capsuleQuery}
            filter={capsuleFilter}
            selectedCapsuleId={selectedCapsuleId}
            selectedCapsule={selectedCapsule}
            error={switchboardError}
            pendingCapsuleId={pendingTask === "switchboard.action" ? selectedCapsuleId : undefined}
            onQueryChange={setCapsuleQuery}
            onFilterChange={setCapsuleFilter}
            onSelectCapsule={setSelectedCapsuleId}
            onImport={() => setImportOpen(true)}
            onRefresh={() => void handleRefreshSwitchboard()}
            onEnable={(capsule) => void handleSwitchboardAction("enable", capsule)}
            onDisable={(capsule) => void handleSwitchboardAction("disable", capsule)}
          />
        ) : null}

        {activeView === "teamLibrary" ? (
          <section className="single-panel">
            <TeamLibraryPanel
              t={t}
              catalogPath={catalogPath}
              pickerMessage={catalogPickerMessage}
              state={teamLibraryState}
              items={filteredTeamItems}
              selectedItem={selectedTeamItem}
              selectedItemId={selectedTeamItemId}
              query={teamLibraryQuery}
              filter={teamLibraryFilter}
              error={teamLibraryError}
              pending={pendingTask === "teamLibrary.inspect"}
              inputRef={catalogPathInputRef}
              onCatalogPathChange={(path) => {
                setCatalogPath(path);
                setCatalogPickerMessage(path ? t.catalogPathReady : "");
              }}
              onSelectCatalog={() => void handleSelectCatalog()}
              onInspect={() => void handleTeamLibraryInspect()}
              onQueryChange={setTeamLibraryQuery}
              onFilterChange={setTeamLibraryFilter}
              onSelectItem={setSelectedTeamItemId}
            />
          </section>
        ) : null}

        {activeView === "clients" ? (
          <section className="single-panel">
            <MountPanel
              t={t}
              locale={locale}
              state={mountState}
              error={mountError}
              pendingAction={mountPendingAction(pendingTask)}
              onPlan={() => void handleMountPlan()}
              onApply={() => void handleMountApply()}
              onRollback={() => void handleMountRollback()}
            />
          </section>
        ) : null}

        {activeView === "tools" ? (
          <section className="single-panel">
            <ExposurePanel
              t={t}
              state={exposureState}
              error={exposureError}
              onRefresh={() => void handleRefreshExposure()}
            />
          </section>
        ) : null}

        {activeView === "runs" ? (
          <section className="single-panel">
            <RunsPanel
              t={t}
              locale={locale}
              source={runsSource}
              filters={runsFilters}
              listState={runsListState}
              detailState={runDetailState}
              indexStatus={runsIndexStatus}
              indexRebuild={runsIndexRebuild}
              error={runsError}
              selectedRunId={selectedRunId}
              pendingTask={pendingTask}
              onSourceChange={setRunsSource}
              onFiltersChange={setRunsFilters}
              onRefresh={() => void handleRunsRefresh()}
              onIndexStatus={() => void handleRunsIndexStatus()}
              onIndexRebuild={() => void handleRunsIndexRebuild()}
              onInspect={(runId, capsuleId) => void handleRunInspect(runId, capsuleId)}
            />
          </section>
        ) : null}

        {activeView === "settings" ? (
          <SettingsPage
            t={t}
            locale={locale}
            statusSnapshot={statusSnapshot}
            onLocaleChange={setLocale}
          />
        ) : null}

        {refreshState.phase === "failed" ? (
          <Alert title={t.statusFailed}>{refreshState.message}</Alert>
        ) : null}

        {importOpen ? (
          <ImportDrawer
            t={t}
            packagePath={packagePath}
            importState={importState}
            pending={pendingTask === "import"}
            pickerMessage={pathPickerMessage}
            inputRef={packagePathInputRef}
            onClose={() => setImportOpen(false)}
            onPackagePathChange={(path) => {
              setPackagePath(path);
              setPathPickerMessage(path ? t.pathReady : "");
            }}
            onSelectPackage={() => void handleSelectPackage()}
            onImport={() => void handleImport()}
          />
        ) : null}
      </section>
    </main>
  );
}

function TeamLibraryPanel({
  t,
  catalogPath,
  pickerMessage,
  state,
  items,
  selectedItem,
  selectedItemId,
  query,
  filter,
  error,
  pending,
  inputRef,
  onCatalogPathChange,
  onSelectCatalog,
  onInspect,
  onQueryChange,
  onFilterChange,
  onSelectItem,
}: {
  t: typeof copy[Locale];
  catalogPath: string;
  pickerMessage?: string;
  state?: TeamLibraryState;
  items: TeamCatalogItem[];
  selectedItem?: TeamCatalogItem;
  selectedItemId?: string;
  query: string;
  filter: TeamLibraryFilter;
  error?: TeamLibraryError;
  pending: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onCatalogPathChange: (path: string) => void;
  onSelectCatalog: () => void;
  onInspect: () => void;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: TeamLibraryFilter) => void;
  onSelectItem: (itemId: string) => void;
}) {
  return (
    <section className="panel-body">
      <form
        className="catalog-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          onInspect();
        }}
      >
        <div className="catalog-source-field">
          <label htmlFor="catalog-path">{t.catalogPath}</label>
          <div className="input-row">
            <input
              id="catalog-path"
              ref={inputRef}
              value={catalogPath}
              onChange={(event) => onCatalogPathChange(event.target.value)}
              placeholder={t.catalogPlaceholder}
            />
            <Button type="button" variant="secondary" icon={HardDriveDownload} onClick={onSelectCatalog}>
              {t.chooseCatalog}
            </Button>
            <Button type="submit" icon={RefreshCw} disabled={!catalogPath.trim()} loading={pending}>
              {t.inspectCatalog}
            </Button>
          </div>
          <p className="form-hint">{pickerMessage || t.noCatalogBody}</p>
        </div>
      </form>

      <section className="index-status-strip neutral" aria-label={t.boundaries}>
        <div>
          <h4>{t.teamLibraryTitle}</h4>
          <p>{t.teamLibrarySafety}</p>
        </div>
        <DescriptionList
          items={[
            [t.source, state?.catalogSource ?? t.none],
            [t.catalogUpdated, state?.catalog.updatedAt ?? t.notChecked],
            [t.catalogItems, state ? String(state.summary.total) : t.unknown],
          ]}
        />
      </section>

      {error ? <Alert>{error.message}</Alert> : null}

      {!state ? (
        <div className="empty-action compact-empty">
          <EmptyState icon={LibraryBig} title={t.noCatalogTitle} />
          <p>{t.noCatalogBody}</p>
          <Button variant="secondary" icon={RefreshCw} onClick={onInspect} disabled={!catalogPath.trim()} loading={pending}>
            {t.teamLibraryEmptyAction}
          </Button>
        </div>
      ) : (
        <>
          <div className="overview-metrics team-library-metrics" aria-label={t.catalogSummary}>
            <SummaryStat label={t.catalogItems} value={state.summary.total} />
            <SummaryStat label={t.installable} value={state.summary.installable} />
            <SummaryStat label={t.installed} value={state.summary.installed} />
            <SummaryStat label={t.blocked} value={state.summary.blocked} tone={state.summary.blocked > 0 ? "warning" : "neutral"} />
          </div>

          <section className="team-library-layout">
            <aside className="catalog-rail" aria-label={t.catalogSummary}>
              <header className="compact-heading">
                <LibraryBig aria-hidden="true" />
                <div>
                  <h3>{state.catalog.name}</h3>
                  <p>{state.catalog.id}</p>
                </div>
              </header>
              <DescriptionList
                items={[
                  [t.catalogUpdated, state.catalog.updatedAt],
                  [t.catalogItems, String(state.catalog.itemCount)],
                  [t.displayOnly, String(state.summary.displayOnly)],
                  [t.source, state.catalogSource],
                ]}
              />
              {state.catalog.description ? <p className="safety-copy">{state.catalog.description}</p> : null}
            </aside>

            <section className="team-items-panel" aria-label={t.catalogItems}>
              <div className="list-toolbar team-library-toolbar">
                <label className="search-field">
                  <Search aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder={t.searchCatalogItems}
                  />
                </label>
                <div className="filter-tabs" role="group" aria-label={t.status}>
                  {([
                    ["all", t.filterAll],
                    ["installable", t.filterInstallable],
                    ["installed", t.filterInstalled],
                    ["blocked", t.filterBlocked],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={filter === value ? "active" : ""}
                      onClick={() => onFilterChange(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {items.length === 0 ? (
                <div className="empty-action compact-empty">
                  <EmptyState icon={Search} title={t.noFilteredItemsTitle} />
                  <p>{t.noFilteredItemsBody}</p>
                </div>
              ) : (
                <div className="team-items-table" role="table" aria-label={t.catalogItems}>
                  <div className="team-items-head" role="row">
                    <span>{t.catalogItems}</span>
                    <span>{t.itemKind}</span>
                    <span>{t.status}</span>
                    <span>{t.source}</span>
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={selectedItemId === item.id ? "team-item-row selected" : "team-item-row"}
                      onClick={() => onSelectItem(item.id)}
                    >
                      <span className="capsule-identity">
                        <strong>{item.name}</strong>
                        <small>{item.id} · {item.version}</small>
                      </span>
                      <span className="muted">{item.kind}</span>
                      <Badge tone={teamItemTone(item.state)}>{teamItemStateLabel(item.state, t)}</Badge>
                      <span className="muted">{item.sourceType}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <TeamItemInspector t={t} item={selectedItem} />
          </section>
        </>
      )}
    </section>
  );
}

function TeamItemInspector({ t, item }: { t: typeof copy[Locale]; item?: TeamCatalogItem }) {
  return (
    <aside className="inspector team-item-inspector" aria-label={t.itemDetails}>
      <header className="compact-heading">
        <LibraryBig aria-hidden="true" />
        <div>
          <h3>{t.itemDetails}</h3>
          <p>{item?.id ?? t.noSelection}</p>
        </div>
      </header>
      {item ? (
        <>
          <DescriptionList
            items={[
              [t.catalogItems, item.name],
              [t.itemKind, item.kind],
              [t.itemVersion, item.version],
              [t.status, teamItemStateLabel(item.state, t)],
              [t.publisher, item.publisherName ?? t.unknown],
              [t.source, item.sourceType],
              [t.checksum, item.sha256 ?? t.none],
            ]}
          />
          <section className="subsection">
            <h4>{t.permissions}</h4>
            {item.permissionsSummary.length === 0 ? <p className="muted">{t.none}</p> : null}
            <ul className="plain-list">
              {item.permissionsSummary.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
          </section>
          <section className="subsection">
            <h4>{t.requirements}</h4>
            {item.requirements.length === 0 ? <p className="muted">{t.none}</p> : null}
            <ul className="plain-list">
              {item.requirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </section>
          {item.trustNote ? (
            <section className="safety-strip">
              <h4>{t.trustNote}</h4>
              <p className="safety-copy">{item.trustNote}</p>
            </section>
          ) : null}
          {item.warnings.length > 0 ? (
            <section className="subsection">
              <h4>{t.warnings}</h4>
              <ul className="plain-list">
                {item.warnings.map((warning) => (
                  <li key={`${warning.code}:${warning.message}`}>
                    <code>{warning.code}</code> {warning.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Button variant="secondary" icon={Play} disabled>
            {item.state === "display_only"
              ? t.displayOnly
              : item.state === "blocked"
                ? t.blocked
                : t.teamLibraryPlanLater}
          </Button>
          {item.state === "display_only" ? <p className="form-hint">{t.teamLibraryDisplayOnlyReason}</p> : null}
          {item.state === "blocked" ? <p className="form-hint">{t.teamLibraryBlockedReason}</p> : null}
        </>
      ) : (
        <div className="inspector-empty">
          <EmptyState icon={LibraryBig} title={t.noSelection} />
          <p>{t.selectionHint}</p>
        </div>
      )}
    </aside>
  );
}

function CapsulesPage({
  t,
  locale,
  capsules,
  allCapsules,
  query,
  filter,
  selectedCapsuleId,
  selectedCapsule,
  error,
  pendingCapsuleId,
  onQueryChange,
  onFilterChange,
  onSelectCapsule,
  onImport,
  onRefresh,
  onEnable,
  onDisable,
}: {
  t: typeof copy[Locale];
  locale: Locale;
  capsules: SwitchboardCapsule[];
  allCapsules: SwitchboardCapsule[];
  query: string;
  filter: CapsuleFilter;
  selectedCapsuleId?: string;
  selectedCapsule?: SwitchboardCapsule;
  error?: SwitchboardActionError;
  pendingCapsuleId?: string;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: CapsuleFilter) => void;
  onSelectCapsule: (capsuleId: string) => void;
  onImport: () => void;
  onRefresh: () => void;
  onEnable: (capsule: SwitchboardCapsule) => void;
  onDisable: (capsule: SwitchboardCapsule) => void;
}) {
  const summary = {
    total: allCapsules.length,
    enabled: allCapsules.filter((capsule) => capsule.enabled).length,
    ready: allCapsules.filter((capsule) => capsule.readinessOk).length,
    attention: allCapsules.filter((capsule) => !capsule.readinessOk).length,
  };

  return (
    <section className="capsules-page">
      <section className="capsule-list-panel" aria-label={t.capsulesTitle}>
        <header className="workspace-overview">
          <div>
            <p className="eyebrow">{t.workspaceOverview}</p>
            <h3>{t.capsulesTitle}</h3>
            <p>{t.capsulesSubtitle}</p>
          </div>
          <div className="overview-metrics" aria-label={t.workspaceOverview}>
            <SummaryStat label={t.registered} value={summary.total} />
            <SummaryStat label={t.enabled} value={summary.enabled} />
            <SummaryStat label={t.ready} value={summary.ready} />
            <SummaryStat label={t.attention} value={summary.attention} tone={summary.attention > 0 ? "warning" : "neutral"} />
          </div>
        </header>

        <div className="list-toolbar">
          <label className="search-field">
            <Search aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t.searchCapsules}
            />
          </label>
          <div className="filter-tabs" role="group" aria-label={t.status}>
            {([
              ["all", t.filterAll],
              ["enabled", t.filterEnabled],
              ["issues", t.filterIssues],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "active" : ""}
                onClick={() => onFilterChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>
            {t.switchboardRefresh}
          </Button>
        </div>

        {error ? <Alert>{error.message}</Alert> : null}

        {allCapsules.length === 0 ? (
          <div className="empty-action">
            <EmptyState icon={Boxes} title={t.emptyCapsulesTitle} />
            <p>{t.emptyCapsulesBody}</p>
            <Button icon={FilePlus2} onClick={onImport}>{t.importAction}</Button>
          </div>
        ) : capsules.length === 0 ? (
          <div className="empty-action compact-empty">
            <EmptyState icon={Search} title={t.noFilteredCapsulesTitle} />
            <p>{t.noFilteredCapsulesBody}</p>
            <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>{t.switchboardRefresh}</Button>
          </div>
        ) : (
          <div className="capsule-table" role="table" aria-label={t.capsulesTitle}>
            <div className="capsule-table-head" role="row">
              <span>{t.capsule}</span>
              <span>{t.status}</span>
              <span>{t.exposure}</span>
              <span>{t.source}</span>
            </div>
            {capsules.map((capsule) => (
              <button
                key={capsule.id}
                type="button"
                className={selectedCapsuleId === capsule.id ? "capsule-row selected" : "capsule-row"}
                onClick={() => onSelectCapsule(capsule.id)}
              >
                <span className="capsule-identity">
                  <strong>{capsule.name}</strong>
                  <small>{capsule.id}</small>
                </span>
                <span>
                  <Badge tone={capsule.readinessOk ? "success" : "warning"}>
                    {capsule.readinessStatus}
                  </Badge>
                </span>
                <span>
                  <Badge tone={capsule.enabled ? "success" : "neutral"}>
                    {capsule.enabled ? t.enabled : t.disabled}
                  </Badge>
                </span>
                <span className="muted">{capsule.sourceType}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <CapsuleInspector
        t={t}
        locale={locale}
        capsule={selectedCapsule}
        pending={selectedCapsule ? pendingCapsuleId === selectedCapsule.id : false}
        onEnable={onEnable}
        onDisable={onDisable}
      />
    </section>
  );
}

function CapsuleInspector({
  t,
  locale,
  capsule,
  pending,
  onEnable,
  onDisable,
}: {
  t: typeof copy[Locale];
  locale: Locale;
  capsule?: SwitchboardCapsule;
  pending: boolean;
  onEnable: (capsule: SwitchboardCapsule) => void;
  onDisable: (capsule: SwitchboardCapsule) => void;
}) {
  return (
    <aside className="inspector" aria-label={t.capsuleDetails}>
      <header className="compact-heading">
        <Boxes aria-hidden="true" />
        <div>
          <h3>{t.capsuleDetails}</h3>
          <p>{capsule?.id ?? t.noSelection}</p>
        </div>
      </header>
      {capsule ? (
        <>
          <DescriptionList
            items={[
              [t.capsule, capsule.name],
              [t.enabled, booleanLabel(capsule.enabled, locale)],
              [t.readiness, capsule.readinessOk ? statusWord("ready", locale) : capsule.nextStep],
              [t.tools, capsule.toolName],
              [t.runtime, `${capsule.adapter} / ${capsule.entrypoint}`],
              [t.manifest, capsule.manifestFreshness],
            ]}
          />
          <div className="button-group">
            <Button
              icon={ToggleRight}
              onClick={() => onEnable(capsule)}
              disabled={!capsule.canEnable || pending}
              loading={pending && capsule.canEnable}
            >
              {t.enable}
            </Button>
            <Button
              variant="secondary"
              icon={ToggleLeft}
              onClick={() => onDisable(capsule)}
              disabled={!capsule.canDisable || pending}
            >
              {t.disable}
            </Button>
          </div>
          <section className="safety-strip">
            <h4>{t.boundaries}</h4>
            <ul className="boundary-list">
              {t.boundaryItems.slice(0, 2).map((item) => (
                <li key={item}>
                  <CheckCircle2 aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <div className="inspector-empty">
          <EmptyState icon={Boxes} title={t.noSelection} />
          <p>{t.selectionHint}</p>
        </div>
      )}
    </aside>
  );
}

function ImportDrawer({
  t,
  packagePath,
  importState,
  pending,
  pickerMessage,
  inputRef,
  onClose,
  onPackagePathChange,
  onSelectPackage,
  onImport,
}: {
  t: typeof copy[Locale];
  packagePath: string;
  importState: ImportFlowState;
  pending: boolean;
  pickerMessage?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onPackagePathChange: (path: string) => void;
  onSelectPackage: () => void;
  onImport: () => void;
}) {
  return (
    <div className="drawer-backdrop" role="presentation">
      <aside className="drawer" aria-label={t.importAction}>
        <header className="drawer-header">
          <div>
            <h3>{t.importAction}</h3>
            <p>{t.importSafety}</p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.close}
          </Button>
        </header>
        <ImportPanel
          t={t}
          packagePath={packagePath}
          importState={importState}
          pending={pending}
          pickerMessage={pickerMessage}
          inputRef={inputRef}
          onPackagePathChange={onPackagePathChange}
          onSelectPackage={onSelectPackage}
          onImport={onImport}
        />
      </aside>
    </div>
  );
}

function SettingsPage({
  t,
  locale,
  statusSnapshot,
  onLocaleChange,
}: {
  t: typeof copy[Locale];
  locale: Locale;
  statusSnapshot?: DashboardRefreshSnapshot;
  onLocaleChange: (locale: Locale) => void;
}) {
  return (
    <section className="settings-page">
      <section className="side-panel">
        <header className="compact-heading">
          <Languages aria-hidden="true" />
          <div>
            <h3>{t.language}</h3>
            <p>{t.settingsSubtitle}</p>
          </div>
        </header>
        <div className="segmented large" role="group" aria-label={t.language}>
          <button type="button" className={locale === "zh" ? "active" : ""} onClick={() => onLocaleChange("zh")}>
            中文
          </button>
          <button type="button" className={locale === "en" ? "active" : ""} onClick={() => onLocaleChange("en")}>
            English
          </button>
        </div>
      </section>
      <section className="side-panel">
        <header className="compact-heading">
          <TerminalSquare aria-hidden="true" />
          <div>
            <h3>{t.settingsDiagnostics}</h3>
            <p>{statusSnapshot ? `${t.lastCaptured}: ${formatTimestamp(statusSnapshot.capturedAtMs, locale)}` : t.noRefresh}</p>
          </div>
        </header>
        {statusSnapshot ? (
          <ul className="command-list">
            {statusSnapshot.commands.map((command) => (
              <li key={`${command.command}-${command.capturedAtMs}`}>
                <code>{command.displayCommand}</code>
                <Badge tone={command.status === "ok" ? "success" : "danger"}>
                  {command.status === "ok" ? "ok" : command.errorKind}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={TerminalSquare} title={t.commandTraceEmpty} />
        )}
      </section>
    </section>
  );
}

function ImportPanel({
  t,
  packagePath,
  importState,
  pending,
  pickerMessage,
  inputRef,
  onPackagePathChange,
  onSelectPackage,
  onImport,
}: {
  t: typeof copy[Locale];
  packagePath: string;
  importState: ImportFlowState;
  pending: boolean;
  pickerMessage?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onPackagePathChange: (path: string) => void;
  onSelectPackage: () => void;
  onImport: () => void;
}) {
  const canImport = Boolean(packagePath) && importState.status !== "importing" && !pending;

  return (
    <section className="panel-body import-body">
      <form
        className="path-form"
        onSubmit={(event) => {
          event.preventDefault();
          onImport();
        }}
      >
        <label htmlFor="package-path">{t.importLabel}</label>
        <div className="input-row">
          <input
            id="package-path"
            ref={inputRef}
            value={packagePath}
            onChange={(event) => onPackagePathChange(event.target.value)}
            placeholder={t.importPlaceholder}
          />
          <Button type="button" variant="secondary" icon={HardDriveDownload} onClick={onSelectPackage}>
            {t.chooseFile}
          </Button>
          <Button type="submit" icon={Upload} disabled={!canImport} loading={pending}>
            {t.importPackage}
          </Button>
        </div>
        <p className="form-hint">{pickerMessage || t.pastePathHint}</p>
      </form>

      {packagePath ? (
        <DescriptionList items={[[t.selectedPath, packagePath]]} />
      ) : null}
      {importState.status === "importing" ? <InlineStatus>{t.importing}</InlineStatus> : null}
      {importState.status === "error" ? <Alert>{importState.error?.message}</Alert> : null}
      {importState.status === "review_ready" && importState.capsule ? (
        <section className="result-block" aria-label={t.capsuleReview}>
          <header>
            <Badge tone="success">{t.capsuleReview}</Badge>
            <h4>{importState.capsule.id}</h4>
          </header>
          <DescriptionList
            items={[
              [t.source, importState.capsule.sourceType],
              [t.enabled, String(importState.capsule.enabled)],
            ]}
          />
        </section>
      ) : null}
    </section>
  );
}

function ExposurePanel({
  t,
  state,
  error,
  onRefresh,
}: {
  t: typeof copy[Locale];
  state: ExposurePreviewState;
  error?: ExposurePreviewError;
  onRefresh: () => void;
}) {
  return (
    <section className="panel-body">
      <div className="toolbar">
        <p className="safety-copy">{t.exposureSafety}</p>
        <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>
          {t.refreshPreview}
        </Button>
      </div>
      {error ? <Alert>{error.message}</Alert> : null}

      <div className="mini-metrics">
        <Metric icon={Route} label={t.transport} value={state.dryRun.transport} detail={state.dryRun.protocol} compact />
        <Metric icon={Boxes} label={t.capsules} value={String(state.dryRun.capsuleCount)} detail={`${state.dryRun.toolCount} ${t.tools}`} compact />
        <Metric icon={Archive} label={t.resources} value={String(state.dryRun.resourceCount)} detail={t.dryRun} compact />
      </div>

      <section className={`index-status-strip ${state.routerStatus.ok ? "success" : "danger"}`} aria-label={t.routerStatus}>
        <div>
          <h4>{state.routerStatus.ok ? t.routerReady : t.routerIssue}</h4>
          <p>{state.routerStatus.errorMessage ?? t.exposureSafety}</p>
        </div>
        <DescriptionList
          items={[
            [t.capsules, String(state.routerStatus.capsuleCount)],
            [t.tools, String(state.routerStatus.toolCount)],
            [t.resources, String(state.routerStatus.resourceCount)],
          ]}
        />
      </section>

      <section className="subsection">
        <h4>{t.tools}</h4>
        {state.emptyReason === "no_tools" ? <EmptyState icon={Globe2} title={t.noTools} /> : null}
        {state.emptyReason === "disabled_or_not_ready" ? <EmptyState icon={Globe2} title={t.noToolsFiltered} /> : null}
        <div className="data-list">
          {state.exposedTools.map((tool) => (
            <article key={`${tool.capsuleId}:${tool.toolName}`} className="data-row compact">
              <div className="row-main">
                <div>
                  <h4>{tool.toolName}</h4>
                  <p>{tool.capsuleId}</p>
                </div>
                <Badge tone="success">{tool.readinessStatus}</Badge>
              </div>
              <DescriptionList items={[[t.manifest, tool.manifestHash]]} />
            </article>
          ))}
        </div>
      </section>

      <section className="subsection">
        <h4>{t.resources}</h4>
        {state.resources.length === 0 ? <p className="muted">{t.noResources}</p> : null}
        <div className="compact-table">
          {state.resources.map((resource) => (
            <div key={resource.uri}>
              <span>{resource.name}</span>
              <code>{resource.uri}</code>
              <span>{resource.mimeType}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function MountPanel({
  t,
  locale,
  state,
  error,
  pendingAction,
  onPlan,
  onApply,
  onRollback,
}: {
  t: typeof copy[Locale];
  locale: Locale;
  state: MountManagerState;
  error?: MountManagerError;
  pendingAction?: "plan" | "apply" | "rollback";
  onPlan: () => void;
  onApply: () => void;
  onRollback: () => void;
}) {
  return (
    <section className="panel-body">
      <div className="toolbar">
        <p className="safety-copy">{t.mountSafety}</p>
        <div className="button-group">
          <Button variant="secondary" icon={RefreshCw} onClick={onPlan} loading={pendingAction === "plan"}>
            {t.mountPlan}
          </Button>
          <Button icon={Link2} onClick={onApply} disabled={!state.canApply} loading={pendingAction === "apply"}>
            {t.applyMount}
          </Button>
          <Button variant="secondary" icon={RotateCcw} onClick={onRollback} disabled={!state.canRollback} loading={pendingAction === "rollback"}>
            {t.rollback}
          </Button>
        </div>
      </div>
      {error ? <Alert>{error.message}</Alert> : null}
      {state.mode === "plan_only" ? <InlineStatus>{t.planOnly}</InlineStatus> : null}
      <DescriptionList
        items={[
          [t.client, state.clientId],
          [t.supported, booleanLabel(state.supported, locale)],
          [t.detected, booleanLabel(state.detected, locale)],
          [t.config, state.configPath || t.unknown],
          [t.router, `${state.routerCommand} ${state.routerArgs.join(" ")}`],
          [t.backup, state.rollbackBackupPath || state.backupPath || t.none],
        ]}
      />
      {state.warnings.length > 0 ? (
        <section className="subsection">
          <h4>{t.warnings}</h4>
          <ul className="plain-list">
            {state.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function RunsPanel({
  t,
  locale,
  source,
  filters,
  listState,
  detailState,
  indexStatus,
  indexRebuild,
  error,
  selectedRunId,
  pendingTask,
  onSourceChange,
  onFiltersChange,
  onRefresh,
  onIndexStatus,
  onIndexRebuild,
  onInspect,
}: {
  t: typeof copy[Locale];
  locale: Locale;
  source: RunsSourceFilter;
  filters: RunsFilters;
  listState: RunsListState;
  detailState?: RunDetailState;
  indexStatus?: RunsIndexStatusState;
  indexRebuild?: RunsIndexRebuildState;
  error?: RunsError;
  selectedRunId?: string;
  pendingTask?: PendingTask;
  onSourceChange: (source: RunsSourceFilter) => void;
  onFiltersChange: (filters: RunsFilters) => void;
  onRefresh: () => void;
  onIndexStatus: () => void;
  onIndexRebuild: () => void;
  onInspect: (runId: string, capsuleId: string) => void;
}) {
  const indexSummary = summarizeIndexStatus(t, indexStatus);
  const activeSource = listState.source.kind === "unknown" ? source : listState.source.kind;

  return (
    <section className="panel-body">
      <div className="runs-toolbar">
        <div>
          <p className="safety-copy">{t.runsSafety}</p>
          <div className="source-toggle" role="group" aria-label={t.source}>
            {([
              ["scan", t.sourceScan],
              ["index", t.sourceIndex],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={source === value ? "active" : ""}
                onClick={() => onSourceChange(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="button-group">
          <Button variant="secondary" icon={RefreshCw} onClick={onIndexStatus} loading={pendingTask === "runs.index.status"}>
            {t.checkIndex}
          </Button>
          <Button variant="secondary" icon={RotateCcw} onClick={onIndexRebuild} loading={pendingTask === "runs.index.rebuild"}>
            {t.rebuildIndex}
          </Button>
          <Button variant="secondary" icon={RefreshCw} onClick={onRefresh} loading={pendingTask === "runs.refresh"}>
            {t.refreshRuns}
          </Button>
        </div>
      </div>

      <section className={`index-status-strip ${indexSummary.tone}`} aria-label={t.indexStatus}>
        <div>
          <h4>{indexSummary.title}</h4>
          <p>{indexSummary.detail}</p>
        </div>
        <DescriptionList
          items={[
            [t.source, activeSource],
            [t.indexGenerated, indexStatus?.index.generatedAt ?? listState.source.generatedAt ?? t.unknown],
            [t.runsIndexed, indexStatus?.index.runsIndexed !== undefined ? String(indexStatus.index.runsIndexed) : t.unknown],
          ]}
        />
      </section>

      <section className="runs-filters" aria-label={t.activeFilters}>
        <label>
          <span>{t.capsuleFilter}</span>
          <input
            value={filters.capsuleId}
            onChange={(event) => onFiltersChange({ ...filters, capsuleId: event.target.value })}
            placeholder="refund-helper"
          />
        </label>
        <label>
          <span>{t.statusFilter}</span>
          <input
            value={filters.status}
            onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
            placeholder="ok / failed"
          />
        </label>
        <label>
          <span>{t.modeFilter}</span>
          <input
            value={filters.mode}
            onChange={(event) => onFiltersChange({ ...filters, mode: event.target.value })}
            placeholder="run / test"
          />
        </label>
        <label>
          <span>{t.okFilter}</span>
          <select
            value={filters.ok}
            onChange={(event) => onFiltersChange({ ...filters, ok: event.target.value as RunsOkFilter })}
          >
            <option value="any">{t.any}</option>
            <option value="true">{t.onlyOk}</option>
            <option value="false">{t.onlyFailed}</option>
          </select>
        </label>
        <label>
          <span>{t.errorCodeFilter}</span>
          <input
            value={filters.errorCode}
            onChange={(event) => onFiltersChange({ ...filters, errorCode: event.target.value })}
            placeholder="timeout"
          />
        </label>
        <label>
          <span>{t.sinceFilter}</span>
          <input
            value={filters.since}
            onChange={(event) => onFiltersChange({ ...filters, since: event.target.value })}
            placeholder="2026-05-26T00:00:00Z"
          />
        </label>
        <label>
          <span>{t.untilFilter}</span>
          <input
            value={filters.until}
            onChange={(event) => onFiltersChange({ ...filters, until: event.target.value })}
            placeholder="2026-05-27T00:00:00Z"
          />
        </label>
        <label>
          <span>{t.limitFilter}</span>
          <input
            value={filters.limit}
            inputMode="numeric"
            onChange={(event) => onFiltersChange({ ...filters, limit: event.target.value })}
            placeholder="10"
          />
        </label>
      </section>

      {indexRebuild ? (
        <div className="index-rebuild-note" role="status">
          {t.rebuildIndex}: {indexRebuild.runsIndexed} {t.runsIndexed}
        </div>
      ) : null}

      {indexStatus?.warnings.length ? (
        <Alert title={t.warnings}>{indexStatus.warnings.join(" · ")}</Alert>
      ) : null}
      {error ? <Alert>{error.message}</Alert> : null}

      <div className="runs-layout">
        <section className="subsection">
          <h4>{t.runList}</h4>
          {listState.runs.length === 0 ? <EmptyState icon={History} title={t.noRuns} /> : null}
          <div className="data-list">
            {listState.runs.map((run) => (
              <article
                key={`${run.capsuleId}:${run.runId}`}
                className={selectedRunId === run.runId ? "data-row compact selected" : "data-row compact"}
              >
                <div className="row-main">
                  <div>
                    <h4>{run.runId}</h4>
                    <p>{run.capsuleId}</p>
                  </div>
                  <Badge tone={run.status === "ok" ? "success" : "danger"}>{run.status}</Badge>
                </div>
                <DescriptionList
                  items={[
                    [t.mode, run.mode],
                    [t.duration, run.durationMs ? `${run.durationMs} ms` : t.unknown],
                    [t.artifacts, String(run.artifactCount)],
                  ]}
                />
                <div className="row-actions">
                  <Button variant="secondary" icon={Play} onClick={() => onInspect(run.runId, run.capsuleId)}>
                    {t.inspect}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="subsection detail-panel">
          <h4>{t.runDetail}</h4>
          {detailState ? (
            <>
              <DescriptionList
                items={[
                  ["Run", detailState.runId],
                  [t.capsules, detailState.capsuleId],
                  ["Record", detailState.recordStatus],
                  ["Envelope", detailState.envelope.status],
                  [t.input, `${t.available}: ${booleanLabel(detailState.input.available, locale)} / ${t.included}: ${booleanLabel(detailState.input.included, locale)}`],
                  [t.stdout, booleanLabel(detailState.logs.stdoutAvailable, locale)],
                  [t.stderr, booleanLabel(detailState.logs.stderrAvailable, locale)],
                ]}
              />
              <section className="subsection">
                <h4>{t.artifactMetadata}</h4>
                {detailState.artifacts.length === 0 ? <p className="muted">{t.none}</p> : null}
                <div className="compact-table">
                  {detailState.artifacts.map((artifact) => (
                    <div key={`${artifact.path}:${artifact.name}`}>
                      <span>{artifact.name}</span>
                      <span>{artifact.kind}</span>
                      <code>{artifact.path}</code>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <EmptyState icon={History} title={t.noRuns} />
          )}
        </section>
      </div>
    </section>
  );
}

function summarizeIndexStatus(
  t: typeof copy[Locale],
  state?: RunsIndexStatusState,
): { title: string; detail: string; tone: "neutral" | "success" | "warning" | "danger" } {
  if (!state) {
    return {
      title: t.indexStatus,
      detail: t.statusHint,
      tone: "neutral",
    };
  }

  if (state.ok) {
    return {
      title: t.indexReady,
      detail: `${state.indexPath}`,
      tone: "success",
    };
  }

  if (state.index.stale) {
    return {
      title: t.indexStale,
      detail: state.warnings[0] ?? t.rebuildIndex,
      tone: "warning",
    };
  }

  return {
    title: t.indexUnavailable,
    detail: state.warnings[0] ?? state.indexPath,
    tone: "danger",
  };
}

function viewDefinitions(t: typeof copy[Locale]): ViewDefinition[] {
  return [
    { id: "capsules", icon: Boxes, step: t.capsules, label: t.capsulesTitle, navLabel: t.navCapsules, description: t.capsulesSubtitle },
    { id: "teamLibrary", icon: LibraryBig, step: t.catalogItems, label: t.teamLibraryTitle, navLabel: t.navTeamLibrary, description: t.teamLibrarySubtitle },
    { id: "clients", icon: Link2, step: t.client, label: t.clientsTitle, navLabel: t.navClients, description: t.clientsSubtitle },
    { id: "tools", icon: Globe2, step: t.tools, label: t.toolsTitle, navLabel: t.navTools, description: t.toolsSubtitle },
    { id: "runs", icon: History, step: t.runList, label: t.runsTitle, navLabel: t.navRuns, description: t.runsSubtitle },
    { id: "settings", icon: Settings, step: t.language, label: t.settingsTitle, navLabel: t.navSettings, description: t.settingsSubtitle },
  ];
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

function optionalFilter(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function okFilterValue(value: RunsOkFilter): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
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

function pendingTaskLabel(task: PendingTask, locale: Locale): string {
  const labels: Record<PendingTask, { zh: string; en: string }> = {
    import: { zh: "导入 .skr", en: "Import .skr" },
    "teamLibrary.inspect": { zh: "检查团队 catalog", en: "Inspect team catalog" },
    "switchboard.refresh": { zh: "刷新 Capsule", en: "Refresh capsules" },
    "switchboard.action": { zh: "更新暴露意图", en: "Update exposure intent" },
    "exposure.refresh": { zh: "刷新暴露预览", en: "Refresh exposure preview" },
    "mount.plan": { zh: "刷新挂载计划", en: "Refresh mount plan" },
    "mount.apply": { zh: "应用挂载", en: "Apply mount" },
    "mount.rollback": { zh: "回滚挂载", en: "Roll back mount" },
    "runs.refresh": { zh: "刷新记录", en: "Refresh runs" },
    "runs.inspect": { zh: "读取证据", en: "Inspect evidence" },
    "runs.index.status": { zh: "检查索引", en: "Check index" },
    "runs.index.rebuild": { zh: "重建索引", en: "Rebuild index" },
  };

  return labels[task][locale];
}

function teamItemStateLabel(state: TeamLibraryItemState, t: typeof copy[Locale]): string {
  const labels: Record<TeamLibraryItemState, string> = {
    display_only: t.displayOnly,
    not_installed: t.installable,
    installed_current: t.installed,
    blocked: t.blocked,
  };
  return labels[state];
}

function teamItemTone(state: TeamLibraryItemState): "neutral" | "success" | "warning" | "danger" {
  if (state === "installed_current") {
    return "success";
  }
  if (state === "blocked") {
    return "danger";
  }
  if (state === "display_only") {
    return "neutral";
  }
  return "warning";
}

function statusLabel(kind: TrayStatusKind, locale: Locale): string {
  const labels: Record<TrayStatusKind, { zh: string; en: string }> = {
    core_missing: { zh: "Core 缺失", en: "Core missing" },
    core_error: { zh: "Core 错误", en: "Core error" },
    recent_failures: { zh: "最近失败", en: "Recent failures" },
    mount_not_configured: { zh: "挂载未配置", en: "Mount not configured" },
    tools_exposed: { zh: "工具已暴露", en: "Tools exposed" },
    capsules_disabled: { zh: "Capsule 未启用", en: "Capsules disabled" },
    no_capsules: { zh: "无 Capsule", en: "No capsules" },
  };

  return labels[kind][locale];
}

function statusClass(kind: TrayStatusKind | undefined): string {
  if (!kind) {
    return "status-chip neutral";
  }

  if (kind === "tools_exposed") {
    return "status-chip success";
  }

  if (kind === "core_missing" || kind === "core_error" || kind === "recent_failures") {
    return "status-chip danger";
  }

  return "status-chip warning";
}

function statusWord(word: "ready", locale: Locale): string {
  if (word === "ready") {
    return locale === "zh" ? "就绪" : "Ready";
  }

  return word;
}

function booleanLabel(value: boolean, locale: Locale): string {
  return value ? copy[locale].true : copy[locale].false;
}

function formatTimestamp(timestampMs: number, locale: Locale): string {
  if (timestampMs <= 0) {
    return locale === "zh" ? "未捕获" : "not captured";
  }

  return new Date(timestampMs).toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
}

export default App;
