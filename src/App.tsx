import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Archive,
  Boxes,
  CheckCircle2,
  Copy,
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
import AppShell from "./components/layout/AppShell";
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
  applyTeamLibraryInstall,
  loadTeamLibraryInstallPlan,
  loadTeamLibraryInspect,
  type TeamCatalogItem,
  type TeamLibraryApplyState,
  type TeamLibraryError,
  type TeamLibraryItemState,
  type TeamLibraryPlanState,
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


import { type DashboardView } from "./components/layout/SidebarNav";

type Locale = "zh" | "en";
type CapsuleFilter = "all" | "enabled" | "issues";
type TeamLibraryFilter = "all" | "installable" | "installed" | "replace" | "blocked";
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
  | "teamLibrary.plan"
  | "teamLibrary.apply"
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
    teamLibrarySubtitle: "浏览团队 catalog 中的 `.skr`、Agent Skill 和 MCP server 条目。安装必须先检查计划并二次确认。",
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
    settingsSubtitle: "语言、Core 状态和本机诊断信息。",
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
    noCatalogBody: "选择或粘贴团队 catalog JSON 路径后，Desktop 调用 Core inspect / status 读取摘要和本地状态。",
    firstRunTitle: "跑通第一次本地能力安装",
    firstRunSubtitle: "从示例团队能力库开始：先检查 catalog，再复核安装计划，确认后导入 `.skr`，最后启用暴露并查看 Router / run evidence。",
    firstRunCoreTitle: "Core 就绪",
    firstRunCoreReady: "Core 可用，可以检查能力库。",
    firstRunCoreMissing: "先刷新或修复 Core CLI。",
    firstRunCatalogTitle: "示例能力库",
    firstRunCatalogReady: "Catalog 路径已准备好。",
    firstRunCatalogEmpty: "使用本地 hero catalog 进入 Team Library。",
    firstRunInstallTitle: "复核安装",
    firstRunInstallBody: "检查 install plan 后再确认导入。",
    firstRunExposureTitle: "启用暴露",
    firstRunExposureBody: "导入后仍需显式 enable 和 Router 预览。",
    useSampleCatalog: "试用本地示例能力库",
    openTeamLibrary: "打开团队能力库",
    sampleCatalogReady: "已填入本地 hero catalog 路径。请检查 catalog。",
    sampleCatalogHint: "本地示例 catalog 来自相邻 Core 仓库的 hero smoke 产物；Desktop 不会自动生成、下载、安装或启用它。",
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
    replaceAvailable: "可替换",
    blocked: "已阻止",
    displayOnly: "仅展示",
    recommendedAction: "推荐动作",
    installPlanAvailable: "可生成计划",
    itemKind: "类型",
    itemVersion: "版本",
    publisher: "发布方",
    checksum: "sha256",
    requirements: "环境要求",
    permissions: "权限摘要",
    trustNote: "团队说明",
    tags: "标签",
    installPlan: "检查安装计划",
    installReplacePlan: "检查替换计划",
    planResult: "安装计划",
    planAction: "计划动作",
    planImport: "导入到本机 registry",
    planReplace: "替换已导入 Capsule",
    requiresConfirmation: "需要确认",
    registry: "Registry",
    registrySource: "登记来源",
    currentPath: "当前路径",
    noPlan: "尚未检查安装计划",
    planSafety: "安装计划只是 Core 预览。Desktop 不会下载、解包、导入、启用、挂载或应用这个结果。",
    installApply: "执行安装",
    applyTeamInstall: "安装到 registry",
    applyTeamUpdate: "更新已导入 Capsule",
    applyResult: "安装结果",
    applySafety: "执行安装只会调用 Core apply 导入 `.skr`。不会启用、挂载、安装依赖、运行或标记可信。",
    sha256Verified: "sha256 已校验",
    nextSteps: "下一步",
    filterInstallable: "可安装",
    filterInstalled: "已安装",
    filterReplace: "可替换",
    filterBlocked: "已阻止",
    teamLibrarySafety: "Team Library 只通过 Core inspect / status / plan / apply 工作；不会自行下载、解包、导入、启用、挂载、运行，也不会把条目标记为可信。",
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
    coreDetected: "Core 可用",
    coreMissingHint: "Desktop 没能启动 `skillrun`。请确认 Core CLI 已安装，并且 Desktop 启动环境能在 PATH 中找到它。",
    coreInstallTitle: "安装 Core CLI",
    coreInstallBody: "Desktop 不会自动安装或执行 installer。复制适合当前系统的命令，在终端确认后运行，然后回到这里刷新状态。",
    coreInstallMacLinux: "macOS / Linux",
    coreInstallWindows: "Windows PowerShell",
    coreInstallBoundary: "不会自动下载、写入 PATH、安装依赖或运行安装脚本。",
    copyInstallCommand: "复制命令",
    installCommandCopied: "已复制",
    runtimeSetupTitle: "Python runtime 引导",
    runtimeSetupBody: "这个条目需要本机 Python runtime。Desktop 不会替你安装；复制命令在终端创建 venv 后，把生成的 bin 目录填到设置里再刷新。",
    runtimeSetupMacLinux: "macOS / Linux venv",
    runtimeSetupWindows: "Windows PowerShell venv",
    runtimeSetupBoundary: "只创建你确认执行的本机 venv；Desktop 只把配置的 bin 目录临时加入 Core 子进程 PATH。",
    runtimeBinDir: "Runtime bin 目录",
    runtimeBinDirPlaceholder: "/Users/you/.skillrun/runtimes/python-3.13/bin",
    runtimeBinDirHelp: "例如 venv 的 bin 或 Scripts 目录。留空时 Desktop 使用启动时的 PATH。",
    runtimeBinDirConfigured: "已配置 runtime PATH",
    coreReadyHint: "Desktop 只通过 Core CLI JSON surface 读取状态；不会读取 `.skillrun/` 内部目录。",
    coreVersion: "Core 版本",
    corePath: "Core 路径",
    skillrunHome: "SkillRun Home",
    registryPath: "Registry 路径",
    statusSourceCommand: "状态来源",
    statusErrorKind: "错误类型",
    statusErrorMessage: "错误信息",
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
    routerRoutes: "Router 路由诊断",
    routerRoutesNeedReview: "Router 路由需复核",
    routerDiagnosticsHint: "Core 报告了 blocked route 或 warning/error。请按建议动作处理后刷新。",
    routerDiagnosticsEntryTitle: "Router 诊断入口",
    routerDiagnosticsEntryBody: "Router route / issue 诊断在工具暴露页读取；Settings 只显示 Core host 状态。",
    routerDiagnosticsSource: "Router 诊断来源",
    routerDiagnosticsSourceBody: "来自 Core `router status --json` 和 `router serve --mcp --dry-run`；不会启动长运行 Router。",
    routerDiagnosticsShortcut: "Router 诊断",
    openRouterDiagnostics: "打开 Router 诊断",
    openCoreDiagnostics: "打开 Core 诊断",
    noRouterRoutes: "Core 当前没有报告 Router route。",
    routeReady: "可路由",
    routeBlocked: "已阻止",
    routable: "可路由",
    routeWarnings: "路由警告",
    routeErrors: "路由错误",
    recovery: "恢复建议",
    issue: "问题",
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
    teamLibraryEmptyStepsTitle: "检查路径",
    teamLibraryEmptyStepCatalogPath: "粘贴或选择团队 catalog JSON",
    teamLibraryEmptyStepInspect: "调用 Core inspect / status 读取摘要",
    teamLibraryEmptyStepPlan: "选择 `.skr` 条目后再检查安装计划",
    teamLibraryDisplayOnlyReason: "这个条目当前只用于展示，不能在 Desktop 中安装或执行。",
    teamLibraryBlockedReason: "Core status 标记为 blocked。Desktop 不提供绕过路径。",
    teamLibraryBlockedSummaryTitle: "有条目被 Core 阻止",
    teamLibraryBlockedSummaryBody: "blocked 通常表示本地 registry/source 冲突，或 Core 无法生成受控安装计划。选择条目查看原因；Desktop 不提供绕过路径。",
    teamLibraryBlockedItems: "阻塞条目",
    teamLibraryBlockedCalloutTitle: "这个条目当前不能在 Desktop 安装",
    teamLibraryBlockedCalloutBody: "Core status 标记为 blocked。请按推荐动作处理本地 registry 或 source 冲突后，重新检查 catalog。",
    teamLibraryReplaceReason: "可替换只表示 Core 可以生成受控 replace plan，不代表已证明有新版本。",
    teamLibraryPlanLater: "安装计划稍后开放",
    switchboardSafety: "enabled 表示允许 Router 暴露该 Capsule。就绪性来自 Core preflight，不代表业务正确性、trust 或 sandbox。",
    exposureSafety: "这里只展示 Core 报告的 tool/resource metadata。exposed 不等于 trusted、safe 或 sandboxed。",
    mountSafety: "Desktop 只请求 Core 计算、应用和回滚 MCP client 配置。所有真实写入都必须先确认。",
    runsSafety: "Run evidence 只通过 Core JSON surface 读取。默认不展示完整输入、日志正文或 artifact 内容。",
    confirmEnable: (id: string) =>
      `确认允许 ${id} 暴露给 Router？\n\nenabled 只是本地暴露意图，不代表可信、安装依赖或沙箱。`,
    confirmTeamInstall: (id: string, action: string) =>
      `确认${action} ${id}？\n\nDesktop 会调用 Core team catalog install apply。它不会自动启用、挂载、安装依赖、运行或标记可信。`,
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
    teamLibrarySubtitle: "Browse team catalog entries for `.skr`, Agent Skills, and MCP servers. Installing requires a checked plan and explicit confirmation.",
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
    settingsSubtitle: "Language, Core status, and local diagnostics.",
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
    noCatalogBody: "Choose or paste a team catalog JSON path. Desktop calls Core inspect / status for the summary and local state.",
    firstRunTitle: "Complete the first local capability install",
    firstRunSubtitle: "Start with a sample Team Library: inspect the catalog, review the install plan, confirm the `.skr` import, then enable exposure and inspect Router / run evidence.",
    firstRunCoreTitle: "Core ready",
    firstRunCoreReady: "Core is available. You can inspect a library.",
    firstRunCoreMissing: "Refresh or repair the Core CLI first.",
    firstRunCatalogTitle: "Sample library",
    firstRunCatalogReady: "Catalog path is ready.",
    firstRunCatalogEmpty: "Use the local hero catalog and continue in Team Library.",
    firstRunInstallTitle: "Review install",
    firstRunInstallBody: "Check an install plan before confirming import.",
    firstRunExposureTitle: "Enable exposure",
    firstRunExposureBody: "Imported capsules still require explicit enable and Router preview.",
    useSampleCatalog: "Try local sample library",
    openTeamLibrary: "Open Team Library",
    sampleCatalogReady: "Local hero catalog path filled. Inspect the catalog next.",
    sampleCatalogHint: "The local sample catalog comes from the adjacent Core repo hero smoke artifact; Desktop will not generate, download, install, or enable it automatically.",
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
    replaceAvailable: "Replaceable",
    blocked: "Blocked",
    displayOnly: "Display only",
    recommendedAction: "Recommended action",
    installPlanAvailable: "Plan available",
    itemKind: "Kind",
    itemVersion: "Version",
    publisher: "Publisher",
    checksum: "sha256",
    requirements: "Requirements",
    permissions: "Permissions",
    trustNote: "Team note",
    tags: "Tags",
    installPlan: "Check install plan",
    installReplacePlan: "Check replace plan",
    planResult: "Install plan",
    planAction: "Planned action",
    planImport: "Import to local registry",
    planReplace: "Replace imported Capsule",
    requiresConfirmation: "Requires confirmation",
    registry: "Registry",
    registrySource: "Registry source",
    currentPath: "Current path",
    noPlan: "No install plan checked",
    planSafety: "Install plan is a Core preview only. Desktop does not download, unpack, import, enable, mount, or apply this result.",
    installApply: "Apply install",
    applyTeamInstall: "Install to registry",
    applyTeamUpdate: "Update imported Capsule",
    applyResult: "Install result",
    applySafety: "Apply install only calls Core apply to import the `.skr`. It does not enable, mount, install dependencies, run, or mark it trusted.",
    sha256Verified: "sha256 verified",
    nextSteps: "Next steps",
    filterInstallable: "Installable",
    filterInstalled: "Installed",
    filterReplace: "Replace",
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
    coreDetected: "Core available",
    coreMissingHint: "Desktop could not spawn `skillrun`. Confirm the Core CLI is installed and visible in PATH for the Desktop launch environment.",
    coreInstallTitle: "Install Core CLI",
    coreInstallBody: "Desktop does not install or execute installers automatically. Copy the command for your system, run it after confirming in a terminal, then refresh here.",
    coreInstallMacLinux: "macOS / Linux",
    coreInstallWindows: "Windows PowerShell",
    coreInstallBoundary: "No automatic downloads, PATH writes, dependency installs, or installer execution.",
    copyInstallCommand: "Copy command",
    installCommandCopied: "Copied",
    runtimeSetupTitle: "Python runtime guide",
    runtimeSetupBody: "This entry needs a local Python runtime. Desktop will not install it for you; copy the command, create the venv in a terminal, then set the generated bin directory in Settings and refresh.",
    runtimeSetupMacLinux: "macOS / Linux venv",
    runtimeSetupWindows: "Windows PowerShell venv",
    runtimeSetupBoundary: "Only creates the local venv you explicitly run; Desktop only prepends the configured bin directory to Core child-process PATH.",
    runtimeBinDir: "Runtime bin directory",
    runtimeBinDirPlaceholder: "/Users/you/.skillrun/runtimes/python-3.13/bin",
    runtimeBinDirHelp: "For example a venv bin or Scripts directory. Leave empty to use the Desktop launch PATH.",
    runtimeBinDirConfigured: "Runtime PATH configured",
    coreReadyHint: "Desktop reads state only through Core CLI JSON surfaces; it does not read internal `.skillrun/` directories.",
    coreVersion: "Core version",
    corePath: "Core path",
    skillrunHome: "SkillRun Home",
    registryPath: "Registry path",
    statusSourceCommand: "Status source",
    statusErrorKind: "Error kind",
    statusErrorMessage: "Error message",
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
    routerRoutes: "Router route diagnostics",
    routerRoutesNeedReview: "Router routes need review",
    routerDiagnosticsHint: "Core reported blocked routes or warning/error diagnostics. Resolve the recommended action, then refresh.",
    routerDiagnosticsEntryTitle: "Router diagnostics entry",
    routerDiagnosticsEntryBody: "Router route / issue diagnostics live in Exposure; Settings only shows Core host status.",
    routerDiagnosticsSource: "Router diagnostics source",
    routerDiagnosticsSourceBody: "Read from Core `router status --json` and `router serve --mcp --dry-run`; Desktop does not start a long-running Router.",
    routerDiagnosticsShortcut: "Router diagnostics",
    openRouterDiagnostics: "Open Router diagnostics",
    openCoreDiagnostics: "Open Core diagnostics",
    noRouterRoutes: "Core did not report any Router routes.",
    routeReady: "Routable",
    routeBlocked: "Blocked",
    routable: "Routable",
    routeWarnings: "Route warnings",
    routeErrors: "Route errors",
    recovery: "Recovery",
    issue: "Issue",
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
    teamLibraryEmptyStepsTitle: "Inspection path",
    teamLibraryEmptyStepCatalogPath: "Paste or choose a team catalog JSON",
    teamLibraryEmptyStepInspect: "Call Core inspect / status for summary",
    teamLibraryEmptyStepPlan: "Select a `.skr` item before checking a plan",
    teamLibraryDisplayOnlyReason: "This item is display-only in this phase and cannot be installed or executed from Desktop.",
    teamLibraryBlockedReason: "Core status marked this item blocked. Desktop does not provide a bypass.",
    teamLibraryBlockedSummaryTitle: "Core blocked some items",
    teamLibraryBlockedSummaryBody: "Blocked usually means a local registry/source conflict, or Core cannot generate a guarded install plan. Select an item to inspect the cause; Desktop does not provide a bypass.",
    teamLibraryBlockedItems: "Blocked items",
    teamLibraryBlockedCalloutTitle: "This item cannot be installed from Desktop right now",
    teamLibraryBlockedCalloutBody: "Core status marked this item blocked. Resolve the local registry or source conflict using the recommended action, then inspect the catalog again.",
    teamLibraryReplaceReason: "Replaceable only means Core can generate a guarded replace plan; it does not prove a newer version.",
    teamLibraryPlanLater: "Install plan later",
    switchboardSafety: SWITCHBOARD_SAFETY_COPY,
    exposureSafety: "Exposure preview shows Core-reported tool/resource metadata only. Exposed does not mean sandboxed, trusted, or safe.",
    mountSafety: MOUNT_SAFETY_COPY,
    runsSafety: RUNS_SAFETY_COPY,
    confirmEnable: (id: string) =>
      `Allow ${id} to be exposed by Router?\n\nEnabled means local exposure intent only; it does not install dependencies, establish trust, or sandbox the capsule.`,
    confirmTeamInstall: (id: string, action: string) =>
      `Confirm ${action} for ${id}?\n\nDesktop will call Core team catalog install apply. It will not enable, mount, install dependencies, run, or mark it trusted.`,
    promptPackage: "Enter a local .skr package path",
    confirmMountExtra: "Core will update the MCP client config. This does not install dependencies or mark exposed tools trusted.",
    confirmRollbackExtra: (backupPath: string) => `Rollback uses the Core-returned backup path only: ${backupPath}`,
  },
} as const;

const coreInstallCommands = {
  shell: "curl --proto '=https' --tlsv1.2 -LsSf https://github.com/iiwish/skillrun/releases/latest/download/skillrun-installer.sh | sh\nskillrun --version",
  powershell:
    "powershell -ExecutionPolicy Bypass -c \"irm https://github.com/iiwish/skillrun/releases/latest/download/skillrun-installer.ps1 | iex\"\nskillrun --version",
} as const;

type CoreInstallCommandKind = keyof typeof coreInstallCommands;

const pythonRuntimeCommands = {
  shell:
    "mkdir -p \"$HOME/.skillrun/runtimes\"\npython3.13 -m venv \"$HOME/.skillrun/runtimes/python-3.13\"\n\"$HOME/.skillrun/runtimes/python-3.13/bin/python\" -m pip install -U pip pydantic\necho \"$HOME/.skillrun/runtimes/python-3.13/bin\"",
  powershell:
    "$runtime = \"$env:USERPROFILE\\.skillrun\\runtimes\\python-3.13\"\npy -3.13 -m venv $runtime\n& \"$runtime\\Scripts\\python.exe\" -m pip install -U pip pydantic\nWrite-Output \"$runtime\\Scripts\"",
} as const;

type PythonRuntimeCommandKind = keyof typeof pythonRuntimeCommands;

const RUNTIME_BIN_DIR_STORAGE_KEY = "skillrun-desktop.runtimeBinDir";
const LOCAL_HERO_CATALOG_PATH = "../skillrun/target/desktop-hero-skr/catalog.json";

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
    routes: [],
    issues: [],
  },
  routerStatus: {
    ok: true,
    router: { snapshot: true, capsules: 0 },
    tools: [],
    resources: [],
    routes: [],
    issues: [],
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
  const [runtimeBinDir, setRuntimeBinDir] = useState(() => {
    try {
      return localStorage.getItem(RUNTIME_BIN_DIR_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const runtimePathDirs = useMemo(() => {
    const trimmed = runtimeBinDir.trim();
    return trimmed ? [trimmed] : [];
  }, [runtimeBinDir]);
  const executor = useMemo(() => createTauriCommandExecutor({ extraPathDirs: runtimePathDirs }), [runtimePathDirs]);
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
  const [teamLibraryPlan, setTeamLibraryPlan] = useState<TeamLibraryPlanState>();
  const [teamLibraryApply, setTeamLibraryApply] = useState<TeamLibraryApplyState>();
  const [teamLibraryError, setTeamLibraryError] = useState<TeamLibraryError>();
  const [teamLibraryPlanError, setTeamLibraryPlanError] = useState<TeamLibraryError>();
  const [teamLibraryApplyError, setTeamLibraryApplyError] = useState<TeamLibraryError>();
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
  const selectedTeamItemPlan = teamLibraryPlan?.itemId === selectedTeamItemId ? teamLibraryPlan : undefined;
  const selectedTeamItemApply = teamLibraryApply?.itemId === selectedTeamItemId ? teamLibraryApply : undefined;
  const isRefreshingStatus = refreshState.phase === "loading";
  const activeDefinition = views.find((view) => view.id === activeView) ?? views[0];
  const pendingLabel = pendingTask ? pendingTaskLabel(pendingTask, locale) : undefined;
  const localizedCatalogPickerMessage = localizeCatalogPickerMessage(catalogPickerMessage, t);
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
      (teamLibraryFilter === "replace" && item.state === "replace_available") ||
      (teamLibraryFilter === "blocked" && item.state === "blocked");
    return matchesQuery && matchesFilter;
  });

  useEffect(() => {
    if (isTauri()) {
      void handleRefreshStatus();
      void handleRefreshSwitchboard();
    }
  }, []);

  useEffect(() => {
    try {
      const trimmed = runtimeBinDir.trim();
      if (trimmed) {
        localStorage.setItem(RUNTIME_BIN_DIR_STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(RUNTIME_BIN_DIR_STORAGE_KEY);
      }
    } catch {
      // Keep the configured path for this session even if persistence is unavailable.
    }
  }, [runtimeBinDir]);

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

  function handleUseSampleCatalog() {
    setCatalogPath(LOCAL_HERO_CATALOG_PATH);
    setCatalogPickerMessage(t.sampleCatalogReady);
    setTeamLibraryError(undefined);
    setActiveView("teamLibrary");
    window.setTimeout(() => catalogPathInputRef.current?.focus(), 0);
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
      setTeamLibraryPlan(undefined);
      setTeamLibraryApply(undefined);
      setTeamLibraryPlanError(undefined);
      setTeamLibraryApplyError(undefined);
    } else {
      setTeamLibraryError(result.error);
    }
    setPendingTask(undefined);
  }

  function handleSelectTeamItem(itemId: string) {
    setSelectedTeamItemId(itemId);
    setTeamLibraryPlan(undefined);
    setTeamLibraryApply(undefined);
    setTeamLibraryPlanError(undefined);
    setTeamLibraryApplyError(undefined);
  }

  async function handleTeamLibraryPlan(item: TeamCatalogItem) {
    const source = teamLibraryState?.catalogSource ?? catalogPath.trim();
    if (!source || !item.installPlanAvailable) {
      return;
    }

    setPendingTask("teamLibrary.plan");
    setTeamLibraryPlanError(undefined);
    setTeamLibraryApply(undefined);
    setTeamLibraryApplyError(undefined);

    const result = await loadTeamLibraryInstallPlan({
      catalogPath: source,
      itemId: item.id,
      executor,
    });

    if (result.status === "ready") {
      setTeamLibraryPlan(result.state);
    } else {
      setTeamLibraryPlanError(result.error);
    }
    setPendingTask(undefined);
  }

  async function handleTeamLibraryApply(item: TeamCatalogItem, plan: TeamLibraryPlanState) {
    const source = teamLibraryState?.catalogSource ?? catalogPath.trim();
    if (!source || !item.installable || plan.itemId !== item.id) {
      return;
    }

    const primaryAction = plan.actions[0];
    const actionLabel = primaryAction?.replace ? t.applyTeamUpdate : t.applyTeamInstall;
    const confirmed = window.confirm(t.confirmTeamInstall(item.id, actionLabel));
    if (!confirmed) {
      return;
    }

    setPendingTask("teamLibrary.apply");
    setTeamLibraryApplyError(undefined);

    const result = await applyTeamLibraryInstall({
      catalogPath: source,
      itemId: item.id,
      executor,
    });

    if (result.status === "ready") {
      setTeamLibraryApply(result.state);
      setSelectedCapsuleId(result.state.imported.id);
      setActiveView("capsules");
      setPendingTask(undefined);
      void handleRefreshSwitchboard(result.state.imported.id);
      void loadExposurePreview({ executor }).then((preview) => {
        if (preview.status === "ready") {
          setExposureState(preview.state);
        } else {
          setExposureError(preview.error);
        }
      });
    } else {
      setTeamLibraryApplyError(result.error);
      setPendingTask(undefined);
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
    <AppShell
      activeView={activeView}
      onNavigate={setActiveView}
      navItems={views}
      settingsLabel={t.settingsTitle}
      statusKind={statusSnapshot?.status.kind}
      statusLabel={trayStatusLabel(statusSnapshot?.status.kind, t)}
      statusTitle={t.shellStatus}
      coreLabel={t.core}
      sourceCommandLabel={t.statusSourceCommand}
      lastCapturedLabel={t.lastCaptured}
      noRefreshLabel={t.noRefresh}
      statusCommand={statusSnapshot?.status.source.command}
      statusCapturedAt={statusSnapshot ? formatTimestamp(statusSnapshot.status.source.capturedAtMs, locale) : undefined}
      coreVersion={coreVersionFromSnapshot(statusSnapshot)}
      onRefresh={handleRefreshStatus}
      refreshLabel={t.refresh}
      isRefreshing={isRefreshingStatus}
      diagnosticsShortcutLabel={t.routerDiagnosticsShortcut}
      diagnosticsShortcutValue={t.navTools}
      onDiagnosticsShortcut={() => setActiveView("tools")}
    >
      <section className="workspace" aria-label={activeDefinition.label}>
        <header className="topbar">
          <div className="topbar-copy">
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
            <Loader2 aria-hidden="true" className="spin" />
            <span>{pendingLabel}</span>
          </div>
        ) : null}

        <div className="page-container">
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
            statusSnapshot={statusSnapshot}
            catalogPath={catalogPath}
            error={switchboardError}
            pendingCapsuleId={pendingTask === "switchboard.action" ? selectedCapsuleId : undefined}
            onQueryChange={setCapsuleQuery}
            onFilterChange={setCapsuleFilter}
            onSelectCapsule={setSelectedCapsuleId}
            onImport={() => setImportOpen(true)}
            onRefresh={() => void handleRefreshSwitchboard()}
            onRefreshStatus={() => void handleRefreshStatus()}
            onUseSampleCatalog={handleUseSampleCatalog}
            onOpenTeamLibrary={() => setActiveView("teamLibrary")}
            onOpenSettings={() => setActiveView("settings")}
            onEnable={(capsule) => void handleSwitchboardAction("enable", capsule)}
            onDisable={(capsule) => void handleSwitchboardAction("disable", capsule)}
            onRefreshRuntime={() => void handleRefreshSwitchboard()}
          />
        ) : null}

        {activeView === "teamLibrary" ? (
          <section className="single-panel">
            <TeamLibraryPanel
              t={t}
              catalogPath={catalogPath}
              pickerMessage={localizedCatalogPickerMessage}
              state={teamLibraryState}
              items={filteredTeamItems}
              selectedItem={selectedTeamItem}
              selectedItemId={selectedTeamItemId}
              selectedPlan={selectedTeamItemPlan}
              selectedApply={selectedTeamItemApply}
              query={teamLibraryQuery}
              filter={teamLibraryFilter}
              error={teamLibraryError}
              planError={teamLibraryPlanError}
              applyError={teamLibraryApplyError}
              pending={pendingTask === "teamLibrary.inspect"}
              pendingPlan={pendingTask === "teamLibrary.plan"}
              pendingApply={pendingTask === "teamLibrary.apply"}
              inputRef={catalogPathInputRef}
              onCatalogPathChange={(path) => {
                setCatalogPath(path);
                setCatalogPickerMessage(path ? t.catalogPathReady : "");
              }}
              onSelectCatalog={() => void handleSelectCatalog()}
              onUseSampleCatalog={handleUseSampleCatalog}
              onInspect={() => void handleTeamLibraryInspect()}
              onQueryChange={setTeamLibraryQuery}
              onFilterChange={setTeamLibraryFilter}
              onSelectItem={handleSelectTeamItem}
              onPlan={(item) => void handleTeamLibraryPlan(item)}
              onApply={(item, plan) => void handleTeamLibraryApply(item, plan)}
              onRefreshRuntime={() => void handleTeamLibraryInspect()}
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
              onOpenCoreDiagnostics={() => setActiveView("settings")}
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
            runtimeBinDir={runtimeBinDir}
            onLocaleChange={setLocale}
            onRuntimeBinDirChange={setRuntimeBinDir}
            onRefreshStatus={() => void handleRefreshStatus()}
            onOpenRouterDiagnostics={() => setActiveView("tools")}
          />
        ) : null}
        </div>

        {refreshState.phase === "failed" ? (
          <div className="page-container" style={{ paddingTop: 0 }}>
            <Alert title={t.statusFailed}>{refreshState.message}</Alert>
          </div>
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
    </AppShell>
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
  selectedPlan,
  selectedApply,
  query,
  filter,
  error,
  planError,
  applyError,
  pending,
  pendingPlan,
  pendingApply,
  inputRef,
  onCatalogPathChange,
  onSelectCatalog,
  onUseSampleCatalog,
  onInspect,
  onQueryChange,
  onFilterChange,
  onSelectItem,
  onPlan,
  onApply,
  onRefreshRuntime,
}: {
  t: typeof copy[Locale];
  catalogPath: string;
  pickerMessage?: string;
  state?: TeamLibraryState;
  items: TeamCatalogItem[];
  selectedItem?: TeamCatalogItem;
  selectedItemId?: string;
  selectedPlan?: TeamLibraryPlanState;
  selectedApply?: TeamLibraryApplyState;
  query: string;
  filter: TeamLibraryFilter;
  error?: TeamLibraryError;
  planError?: TeamLibraryError;
  applyError?: TeamLibraryError;
  pending: boolean;
  pendingPlan: boolean;
  pendingApply: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  onCatalogPathChange: (path: string) => void;
  onSelectCatalog: () => void;
  onUseSampleCatalog: () => void;
  onInspect: () => void;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: TeamLibraryFilter) => void;
  onSelectItem: (itemId: string) => void;
  onPlan: (item: TeamCatalogItem) => void;
  onApply: (item: TeamCatalogItem, plan: TeamLibraryPlanState) => void;
  onRefreshRuntime: () => void;
}) {
  const blockedItems = state?.items.filter((item) => item.state === "blocked") ?? [];

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
          <section className="empty-workflow" aria-label={t.teamLibraryEmptyStepsTitle}>
            <h4>{t.teamLibraryEmptyStepsTitle}</h4>
            <ol>
              <li>{t.teamLibraryEmptyStepCatalogPath}</li>
              <li>{t.teamLibraryEmptyStepInspect}</li>
              <li>{t.teamLibraryEmptyStepPlan}</li>
            </ol>
          </section>
          <div className="button-group center">
            <Button icon={Play} onClick={onUseSampleCatalog}>
              {t.useSampleCatalog}
            </Button>
            <Button variant="secondary" icon={RefreshCw} onClick={onInspect} disabled={!catalogPath.trim()} loading={pending}>
              {t.teamLibraryEmptyAction}
            </Button>
          </div>
          <p className="form-hint">{t.sampleCatalogHint}</p>
        </div>
      ) : (
        <>
          <div className="overview-metrics team-library-metrics" aria-label={t.catalogSummary}>
            <SummaryStat label={t.catalogItems} value={state.summary.total} />
            <SummaryStat label={t.installable} value={state.summary.installable} />
            <SummaryStat label={t.installed} value={state.summary.installed} />
            <SummaryStat label={t.replaceAvailable} value={state.summary.replaceAvailable} tone={state.summary.replaceAvailable > 0 ? "warning" : "neutral"} />
            <SummaryStat label={t.blocked} value={state.summary.blocked} tone={state.summary.blocked > 0 ? "warning" : "neutral"} />
          </div>

          {blockedItems.length > 0 ? <TeamLibraryBlockedSummary t={t} items={blockedItems} /> : null}

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
                    ["replace", t.filterReplace],
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

            <TeamItemInspector
              t={t}
              item={selectedItem}
              plan={selectedPlan}
              apply={selectedApply}
              planError={planError}
              applyError={applyError}
              pendingPlan={pendingPlan}
              pendingApply={pendingApply}
              onPlan={onPlan}
              onApply={onApply}
              onRefreshRuntime={onRefreshRuntime}
            />
          </section>
        </>
      )}
    </section>
  );
}

function TeamLibraryBlockedSummary({
  t,
  items,
}: {
  t: typeof copy[Locale];
  items: TeamCatalogItem[];
}) {
  return (
    <section className="team-library-blocked-summary" aria-label={t.teamLibraryBlockedSummaryTitle}>
      <div>
        <h4>{t.teamLibraryBlockedSummaryTitle}</h4>
        <p>{t.teamLibraryBlockedSummaryBody}</p>
      </div>
      <DescriptionList
        items={[
          [t.blocked, String(items.length)],
          [t.teamLibraryBlockedItems, items.map((item) => item.id).join(", ")],
        ]}
      />
    </section>
  );
}

function TeamItemInspector({
  t,
  item,
  plan,
  apply,
  planError,
  applyError,
  pendingPlan,
  pendingApply,
  onPlan,
  onApply,
  onRefreshRuntime,
}: {
  t: typeof copy[Locale];
  item?: TeamCatalogItem;
  plan?: TeamLibraryPlanState;
  apply?: TeamLibraryApplyState;
  planError?: TeamLibraryError;
  applyError?: TeamLibraryError;
  pendingPlan: boolean;
  pendingApply: boolean;
  onPlan: (item: TeamCatalogItem) => void;
  onApply: (item: TeamCatalogItem, plan: TeamLibraryPlanState) => void;
  onRefreshRuntime: () => void;
}) {
  const runtimeHint = item ? runtimeSetupHintForTeamItem(item) : false;

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
              [t.recommendedAction, teamItemRecommendedActionLabel(item.recommendedAction, t)],
              [t.installPlanAvailable, item.installPlanAvailable ? t.true : t.false],
              [t.registrySource, item.registry.sourceType ?? t.none],
              [t.enabled, item.registry.enabled === null ? t.unknown : String(item.registry.enabled)],
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
          {runtimeHint ? <PythonRuntimeSetupGuide t={t} onRefresh={onRefreshRuntime} /> : null}
          {item.trustNote ? (
            <section className="safety-strip">
              <h4>{t.trustNote}</h4>
              <p className="safety-copy">{item.trustNote}</p>
            </section>
          ) : null}
          {item.state === "blocked" ? <TeamItemBlockedCallout t={t} item={item} /> : null}
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
          <Button
            variant="secondary"
            icon={Play}
            disabled={!item.installPlanAvailable || pendingPlan}
            loading={pendingPlan}
            onClick={() => onPlan(item)}
          >
            {item.installPlanAvailable ? teamItemPlanButtonLabel(item, t) : item.state === "display_only" ? t.displayOnly : t.blocked}
          </Button>
          {item.state === "display_only" ? <p className="form-hint">{t.teamLibraryDisplayOnlyReason}</p> : null}
          {item.state === "blocked" ? <p className="form-hint">{t.teamLibraryBlockedReason}</p> : null}
          {item.state === "replace_available" ? <p className="form-hint">{t.teamLibraryReplaceReason}</p> : null}
          {planError ? <Alert>{planError.message}</Alert> : null}
          {applyError ? <Alert>{applyError.message}</Alert> : null}
          <TeamInstallPlanPanel
            t={t}
            item={item}
            plan={plan}
            apply={apply}
            pendingApply={pendingApply}
            onApply={onApply}
          />
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

function TeamItemBlockedCallout({
  t,
  item,
}: {
  t: typeof copy[Locale];
  item: TeamCatalogItem;
}) {
  return (
    <section className="team-item-blocked-callout" aria-label={t.teamLibraryBlockedCalloutTitle}>
      <div>
        <h4>{t.teamLibraryBlockedCalloutTitle}</h4>
        <p>{t.teamLibraryBlockedCalloutBody}</p>
      </div>
      <DescriptionList
        items={[
          [t.recommendedAction, teamItemRecommendedActionLabel(item.recommendedAction, t)],
          [t.registrySource, item.registry.sourceType ?? t.none],
          [t.currentPath, item.registry.path ?? t.none],
          [t.installPlanAvailable, item.installPlanAvailable ? t.true : t.false],
        ]}
      />
    </section>
  );
}

function TeamInstallPlanPanel({
  t,
  item,
  plan,
  apply,
  pendingApply,
  onApply,
}: {
  t: typeof copy[Locale];
  item: TeamCatalogItem;
  plan?: TeamLibraryPlanState;
  apply?: TeamLibraryApplyState;
  pendingApply: boolean;
  onApply: (item: TeamCatalogItem, plan: TeamLibraryPlanState) => void;
}) {
  if (!plan) {
    return (
      <section className="subsection">
        <h4>{t.planResult}</h4>
        <p className="muted">{t.noPlan}</p>
      </section>
    );
  }

  const primaryAction = plan.actions[0];
  const applyLabel = primaryAction?.replace ? t.applyTeamUpdate : t.applyTeamInstall;
  return (
    <section className="subsection plan-result-panel">
      <h4>{t.planResult}</h4>
      <p className="safety-copy">{t.planSafety}</p>
      <DescriptionList
        items={[
          [t.planAction, primaryAction?.replace ? t.planReplace : t.planImport],
          [t.requiresConfirmation, primaryAction ? String(primaryAction.requiresConfirmation) : t.unknown],
          [t.registrySource, plan.registry.sourceType ?? t.none],
          [t.enabled, plan.registry.enabled === null ? t.unknown : String(plan.registry.enabled)],
          [t.currentPath, plan.registry.path ?? t.none],
          [t.checksum, plan.sha256],
        ]}
      />
      {plan.warnings.length > 0 ? (
        <ul className="plain-list">
          {plan.warnings.map((warning) => (
            <li key={`${warning.code}:${warning.message}`}>
              <code>{warning.code}</code> {warning.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="apply-confirm-strip">
        <div>
          <h4>{t.installApply}</h4>
          <p>{t.applySafety}</p>
        </div>
        <Button icon={CheckCircle2} loading={pendingApply} disabled={pendingApply || !primaryAction} onClick={() => onApply(item, plan)}>
          {applyLabel}
        </Button>
      </div>
      {apply ? (
        <section className="apply-result-panel">
          <h4>{t.applyResult}</h4>
          <DescriptionList
            items={[
              [t.imported, apply.imported.id],
              [t.currentPath, apply.imported.path],
              [t.sha256Verified, apply.download.sha256Verified ? t.true : t.false],
              [t.enabled, apply.imported.enabled ? t.true : t.false],
            ]}
          />
          {apply.nextSteps.length > 0 ? (
            <div className="subsection nested-subsection">
              <h4>{t.nextSteps}</h4>
              <ul className="plain-list">
                {apply.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
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
  statusSnapshot,
  catalogPath,
  error,
  pendingCapsuleId,
  onQueryChange,
  onFilterChange,
  onSelectCapsule,
  onImport,
  onRefresh,
  onRefreshStatus,
  onUseSampleCatalog,
  onOpenTeamLibrary,
  onOpenSettings,
  onEnable,
  onDisable,
  onRefreshRuntime,
}: {
  t: typeof copy[Locale];
  locale: Locale;
  capsules: SwitchboardCapsule[];
  allCapsules: SwitchboardCapsule[];
  query: string;
  filter: CapsuleFilter;
  selectedCapsuleId?: string;
  selectedCapsule?: SwitchboardCapsule;
  statusSnapshot?: DashboardRefreshSnapshot;
  catalogPath: string;
  error?: SwitchboardActionError;
  pendingCapsuleId?: string;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: CapsuleFilter) => void;
  onSelectCapsule: (capsuleId: string) => void;
  onImport: () => void;
  onRefresh: () => void;
  onRefreshStatus: () => void;
  onUseSampleCatalog: () => void;
  onOpenTeamLibrary: () => void;
  onOpenSettings: () => void;
  onEnable: (capsule: SwitchboardCapsule) => void;
  onDisable: (capsule: SwitchboardCapsule) => void;
  onRefreshRuntime: () => void;
}) {
  const summary = {
    total: allCapsules.length,
    enabled: allCapsules.filter((capsule) => capsule.enabled).length,
    ready: allCapsules.filter((capsule) => capsule.readinessOk).length,
    attention: allCapsules.filter((capsule) => !capsule.readinessOk).length,
  };

  return (
    <>
    <FirstRunPanel
      t={t}
      locale={locale}
      coreDetected={Boolean(statusSnapshot?.contracts.host)}
      coreVersion={coreVersionFromSnapshot(statusSnapshot)}
      catalogReady={Boolean(catalogPath.trim())}
      hasCapsules={allCapsules.length > 0}
      enabledCount={summary.enabled}
      onRefreshStatus={onRefreshStatus}
      onUseSampleCatalog={onUseSampleCatalog}
      onOpenTeamLibrary={onOpenTeamLibrary}
      onOpenSettings={onOpenSettings}
    />
    <section className="capsules-page">
      <section className="capsule-list-panel" aria-label={t.capsulesTitle}>
        {allCapsules.length === 0 ? (
          <div className="empty-state-full">
            <Boxes aria-hidden="true" />
            <p className="empty-title">{t.emptyCapsulesTitle}</p>
            <p className="empty-body">{t.emptyCapsulesBody}</p>
            <Button icon={FilePlus2} onClick={onImport}>{t.importAction}</Button>
          </div>
        ) : (
          <>
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
              <div className="toolbar-spacer" />
              {summary.total > 0 ? (
                <span className="toolbar-count">
                  {summary.total} {t.registered.toLowerCase()}
                  {summary.attention > 0 ? ` · ${summary.attention} ${t.attention.toLowerCase()}` : ""}
                </span>
              ) : null}
              <Button variant="ghost" icon={RefreshCw} onClick={onRefresh}>
                {t.switchboardRefresh}
              </Button>
            </div>

            {error ? <Alert>{error.message}</Alert> : null}

            {capsules.length === 0 ? (
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
          </>
        )}
      </section>

      <CapsuleInspector
        t={t}
        locale={locale}
        capsule={selectedCapsule}
        pending={selectedCapsule ? pendingCapsuleId === selectedCapsule.id : false}
        onEnable={onEnable}
        onDisable={onDisable}
        onRefreshRuntime={onRefreshRuntime}
      />
    </section>
    </>
  );
}

function FirstRunPanel({
  t,
  locale,
  coreDetected,
  coreVersion,
  catalogReady,
  hasCapsules,
  enabledCount,
  onRefreshStatus,
  onUseSampleCatalog,
  onOpenTeamLibrary,
  onOpenSettings,
}: {
  t: typeof copy[Locale];
  locale: Locale;
  coreDetected: boolean;
  coreVersion?: string;
  catalogReady: boolean;
  hasCapsules: boolean;
  enabledCount: number;
  onRefreshStatus: () => void;
  onUseSampleCatalog: () => void;
  onOpenTeamLibrary: () => void;
  onOpenSettings: () => void;
}) {
  const steps = [
    {
      icon: TerminalSquare,
      title: t.firstRunCoreTitle,
      body: coreDetected
        ? `${t.firstRunCoreReady}${coreVersion ? ` ${coreVersion}` : ""}`
        : t.firstRunCoreMissing,
      complete: coreDetected,
      action: coreDetected ? onOpenSettings : onRefreshStatus,
      actionLabel: coreDetected ? t.settingsTitle : t.refresh,
    },
    {
      icon: LibraryBig,
      title: t.firstRunCatalogTitle,
      body: catalogReady ? t.firstRunCatalogReady : t.firstRunCatalogEmpty,
      complete: catalogReady,
      action: catalogReady ? onOpenTeamLibrary : onUseSampleCatalog,
      actionLabel: catalogReady ? t.openTeamLibrary : t.useSampleCatalog,
    },
    {
      icon: CheckCircle2,
      title: t.firstRunInstallTitle,
      body: hasCapsules ? `${t.imported}: ${hasCapsules ? t.true : t.false}` : t.firstRunInstallBody,
      complete: hasCapsules,
      action: onOpenTeamLibrary,
      actionLabel: t.openTeamLibrary,
    },
    {
      icon: Route,
      title: t.firstRunExposureTitle,
      body: enabledCount > 0 ? `${t.enabled}: ${enabledCount}` : t.firstRunExposureBody,
      complete: enabledCount > 0,
      action: onOpenTeamLibrary,
      actionLabel: t.openTeamLibrary,
    },
  ];

  return (
    <section className="first-run-panel" aria-label={t.firstRunTitle}>
      <div className="first-run-copy">
        <Badge tone={coreDetected ? "success" : "warning"}>{coreDetected ? t.coreDetected : t.notChecked}</Badge>
        <h3>{t.firstRunTitle}</h3>
        <p>{t.firstRunSubtitle}</p>
        <div className="button-group">
          <Button icon={Play} onClick={onUseSampleCatalog}>
            {t.useSampleCatalog}
          </Button>
          <Button variant="secondary" icon={LibraryBig} onClick={onOpenTeamLibrary}>
            {t.openTeamLibrary}
          </Button>
        </div>
        <p className="form-hint">{t.sampleCatalogHint}</p>
      </div>
      <div className="first-run-steps">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.title}
              type="button"
              className={step.complete ? "first-run-step complete" : "first-run-step"}
              onClick={step.action}
            >
              <Icon aria-hidden="true" />
              <span>
                <strong>{step.title}</strong>
                <small>{step.body}</small>
              </span>
              <Badge tone={step.complete ? "success" : "neutral"}>
                {step.complete ? statusWord("ready", locale) : step.actionLabel}
              </Badge>
            </button>
          );
        })}
      </div>
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
  onRefreshRuntime,
}: {
  t: typeof copy[Locale];
  locale: Locale;
  capsule?: SwitchboardCapsule;
  pending: boolean;
  onEnable: (capsule: SwitchboardCapsule) => void;
  onDisable: (capsule: SwitchboardCapsule) => void;
  onRefreshRuntime: () => void;
}) {
  const runtimeHint = capsule ? runtimeSetupHintForCapsule(capsule) : false;

  return (
    <aside className="inspector" aria-label={t.capsuleDetails}>
      {capsule ? (
        <>
          <header className="compact-heading">
            <Boxes aria-hidden="true" />
            <div>
              <h3>{capsule.name}</h3>
              <p>{capsule.id}</p>
            </div>
          </header>
          <DescriptionList
            items={[
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
          {runtimeHint ? <PythonRuntimeSetupGuide t={t} onRefresh={onRefreshRuntime} /> : null}
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
          <Boxes aria-hidden="true" />
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
  runtimeBinDir,
  onLocaleChange,
  onRuntimeBinDirChange,
  onRefreshStatus,
  onOpenRouterDiagnostics,
}: {
  t: typeof copy[Locale];
  locale: Locale;
  statusSnapshot?: DashboardRefreshSnapshot;
  runtimeBinDir: string;
  onLocaleChange: (locale: Locale) => void;
  onRuntimeBinDirChange: (path: string) => void;
  onRefreshStatus: () => void;
  onOpenRouterDiagnostics: () => void;
}) {
  const [copiedInstallCommand, setCopiedInstallCommand] = useState<CoreInstallCommandKind>();

  async function copyInstallCommand(kind: CoreInstallCommandKind) {
    const command = coreInstallCommands[kind];
    if (await writeClipboardText(command)) {
      setCopiedInstallCommand(kind);
      return;
    }

    setCopiedInstallCommand(undefined);
  }

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
        <section className="diagnostics-link-card" aria-label={t.routerDiagnosticsEntryTitle}>
          <div>
            <h4>{t.routerDiagnosticsEntryTitle}</h4>
            <p>{t.routerDiagnosticsEntryBody}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            icon={Route}
            onClick={onOpenRouterDiagnostics}
          >
            {t.openRouterDiagnostics}
          </Button>
        </section>
        <RuntimePathSettings
          t={t}
          runtimeBinDir={runtimeBinDir}
          onRuntimeBinDirChange={onRuntimeBinDirChange}
          onRefreshStatus={onRefreshStatus}
        />
        {statusSnapshot ? (
          <>
            <div className={`diagnostic-banner ${coreDiagnosticsTone(statusSnapshot)}`}>
              <strong>{coreDiagnosticsTitle(statusSnapshot, t)}</strong>
              <p>{coreDiagnosticsDetail(statusSnapshot, t)}</p>
            </div>
            {isCoreMissing(statusSnapshot) ? (
              <CoreInstallGuide
                t={t}
                copiedCommand={copiedInstallCommand}
                onCopyInstallCommand={copyInstallCommand}
              />
            ) : null}
            <DescriptionList items={coreDiagnosticsItems(statusSnapshot, t)} />
            <ul className="command-list">
              {statusSnapshot.commands.map((command) => (
                <li key={`${command.command}-${command.capturedAtMs}`}>
                  <div className="command-row">
                    <code>{command.displayCommand}</code>
                    <Badge tone={command.status === "ok" ? "success" : "danger"}>
                      {command.status === "ok" ? "ok" : command.errorKind}
                    </Badge>
                  </div>
                  {command.errorMessage ? <p>{command.errorMessage}</p> : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState icon={TerminalSquare} title={t.commandTraceEmpty} />
        )}
      </section>
    </section>
  );
}

function CoreInstallGuide({
  t,
  copiedCommand,
  onCopyInstallCommand,
}: {
  t: typeof copy[Locale];
  copiedCommand?: CoreInstallCommandKind;
  onCopyInstallCommand: (kind: CoreInstallCommandKind) => void;
}) {
  const commands: Array<{ kind: CoreInstallCommandKind; label: string; command: string }> = [
    { kind: "shell", label: t.coreInstallMacLinux, command: coreInstallCommands.shell },
    { kind: "powershell", label: t.coreInstallWindows, command: coreInstallCommands.powershell },
  ];

  return (
    <section className="install-guide" aria-label={t.coreInstallTitle}>
      <div className="install-guide-header">
        <div>
          <h4>{t.coreInstallTitle}</h4>
          <p>{t.coreInstallBody}</p>
        </div>
        <Badge tone="warning">{t.notChecked}</Badge>
      </div>
      <div className="install-command-list">
        {commands.map((item) => (
          <article className="install-command-card" key={item.kind}>
            <div className="install-command-title">
              <strong>{item.label}</strong>
              <Button
                type="button"
                variant="secondary"
                icon={Copy}
                onClick={() => onCopyInstallCommand(item.kind)}
              >
                {copiedCommand === item.kind ? t.installCommandCopied : t.copyInstallCommand}
              </Button>
            </div>
            <pre><code>{item.command}</code></pre>
          </article>
        ))}
      </div>
      <p className="install-guide-boundary">{t.coreInstallBoundary}</p>
    </section>
  );
}

function RuntimePathSettings({
  t,
  runtimeBinDir,
  onRuntimeBinDirChange,
  onRefreshStatus,
}: {
  t: typeof copy[Locale];
  runtimeBinDir: string;
  onRuntimeBinDirChange: (path: string) => void;
  onRefreshStatus: () => void;
}) {
  return (
    <section className="runtime-path-settings" aria-label={t.runtimeBinDir}>
      <div className="install-guide-header">
        <div>
          <h4>{t.runtimeBinDir}</h4>
          <p>{t.runtimeBinDirHelp}</p>
        </div>
        {runtimeBinDir.trim() ? <Badge tone="success">{t.runtimeBinDirConfigured}</Badge> : <Badge>{t.none}</Badge>}
      </div>
      <label className="runtime-path-field">
        <span>{t.runtimeBinDir}</span>
        <input
          value={runtimeBinDir}
          onChange={(event) => onRuntimeBinDirChange(event.target.value)}
          placeholder={t.runtimeBinDirPlaceholder}
        />
      </label>
      <div className="button-group">
        <Button type="button" variant="secondary" icon={RefreshCw} onClick={onRefreshStatus}>
          {t.refresh}
        </Button>
      </div>
    </section>
  );
}

function PythonRuntimeSetupGuide({
  t,
  onRefresh,
}: {
  t: typeof copy[Locale];
  onRefresh: () => void;
}) {
  const [copiedCommand, setCopiedCommand] = useState<PythonRuntimeCommandKind>();

  async function copyPythonRuntimeCommand(kind: PythonRuntimeCommandKind) {
    if (await writeClipboardText(pythonRuntimeCommands[kind])) {
      setCopiedCommand(kind);
      return;
    }

    setCopiedCommand(undefined);
  }

  const commands: Array<{ kind: PythonRuntimeCommandKind; label: string; command: string }> = [
    { kind: "shell", label: t.runtimeSetupMacLinux, command: pythonRuntimeCommands.shell },
    { kind: "powershell", label: t.runtimeSetupWindows, command: pythonRuntimeCommands.powershell },
  ];

  return (
    <section className="install-guide runtime-setup-guide" aria-label={t.runtimeSetupTitle}>
      <div className="install-guide-header">
        <div>
          <h4>{t.runtimeSetupTitle}</h4>
          <p>{t.runtimeSetupBody}</p>
        </div>
        <Button type="button" variant="secondary" icon={RefreshCw} onClick={onRefresh}>
          {t.refresh}
        </Button>
      </div>
      <div className="install-command-list">
        {commands.map((item) => (
          <article className="install-command-card" key={item.kind}>
            <div className="install-command-title">
              <strong>{item.label}</strong>
              <Button
                type="button"
                variant="secondary"
                icon={Copy}
                onClick={() => copyPythonRuntimeCommand(item.kind)}
              >
                {copiedCommand === item.kind ? t.installCommandCopied : t.copyInstallCommand}
              </Button>
            </div>
            <pre><code>{item.command}</code></pre>
          </article>
        ))}
      </div>
      <p className="install-guide-boundary">{t.runtimeSetupBoundary}</p>
    </section>
  );
}

function coreVersionFromSnapshot(snapshot?: DashboardRefreshSnapshot): string | undefined {
  const binary = recordFrom(snapshot?.contracts.host?.binary);
  return readOptionalRecordString(binary, "version");
}

function isCoreMissing(snapshot: DashboardRefreshSnapshot): boolean {
  return snapshot.status.kind === "core_missing";
}

async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback below.
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

function trayStatusLabel(
  kind: DashboardRefreshSnapshot["status"]["kind"] | undefined,
  t: typeof copy[Locale],
): string {
  if (!kind) {
    return t.notChecked;
  }

  switch (kind) {
    case "core_missing":
      return localeText(t, "Core 缺失", "Core missing");
    case "core_error":
      return localeText(t, "Core 错误", "Core error");
    case "recent_failures":
      return localeText(t, "最近失败", "Recent failures");
    case "mount_not_configured":
      return localeText(t, "挂载未配置", "Mount not configured");
    case "tools_exposed":
      return localeText(t, "工具已暴露", "Tools exposed");
    case "capsules_disabled":
      return localeText(t, "Capsule 未启用", "Capsules disabled");
    case "no_capsules":
      return localeText(t, "无 Capsule", "No capsules");
  }
}

function coreDiagnosticsTone(snapshot: DashboardRefreshSnapshot): "success" | "warning" | "danger" {
  if (snapshot.contracts.host) {
    return "success";
  }
  if (snapshot.status.kind === "core_missing" || snapshot.status.kind === "core_error") {
    return "danger";
  }
  return "warning";
}

function coreDiagnosticsTitle(snapshot: DashboardRefreshSnapshot, t: typeof copy[Locale]): string {
  if (snapshot.contracts.host) {
    return t.coreDetected;
  }
  return trayStatusLabel(snapshot.status.kind, t);
}

function coreDiagnosticsDetail(snapshot: DashboardRefreshSnapshot, t: typeof copy[Locale]): string {
  if (snapshot.contracts.host) {
    return t.coreReadyHint;
  }

  if (snapshot.status.kind === "core_missing") {
    return t.coreMissingHint;
  }

  const hostCommand = snapshot.commands.find((command) => command.command === "host status --json");
  return hostCommand?.errorMessage ?? t.coreMissingHint;
}

function coreDiagnosticsItems(
  snapshot: DashboardRefreshSnapshot,
  t: typeof copy[Locale],
): Array<[string, ReactNode]> {
  const host = snapshot.contracts.host;
  if (host) {
    const binary = recordFrom(host.binary);
    const paths = recordFrom(host.paths);
    return [
      [t.core, <Badge tone="success">{t.coreDetected}</Badge>],
      [t.coreVersion, stringOrUnknown(readOptionalRecordString(binary, "version"), t)],
      [t.corePath, codeOrUnknown(readOptionalRecordString(paths, "current_exe"), t)],
      [t.skillrunHome, codeOrUnknown(readOptionalRecordString(paths, "skillrun_home"), t)],
      [t.registryPath, codeOrUnknown(readOptionalRecordString(paths, "registry_path"), t)],
      [t.statusSourceCommand, <code>{snapshot.status.source.command}</code>],
    ];
  }

  const hostCommand = snapshot.commands.find((command) => command.command === "host status --json");
  return [
    [t.core, <Badge tone="danger">{trayStatusLabel(snapshot.status.kind, t)}</Badge>],
    [t.statusSourceCommand, <code>{hostCommand?.displayCommand ?? "skillrun host status --json"}</code>],
    [t.statusErrorKind, stringOrUnknown(hostCommand?.errorKind, t)],
    [t.statusErrorMessage, stringOrUnknown(hostCommand?.errorMessage, t)],
  ];
}

function recordFrom(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

function readOptionalRecordString(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringOrUnknown(value: string | undefined, t: typeof copy[Locale]): string {
  return value ?? t.unknown;
}

function codeOrUnknown(value: string | undefined, t: typeof copy[Locale]): ReactNode {
  return value ? <code>{value}</code> : t.unknown;
}

function localeText(t: typeof copy[Locale], zh: string, en: string): string {
  return t.language === "语言" ? zh : en;
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
  onOpenCoreDiagnostics,
}: {
  t: typeof copy[Locale];
  state: ExposurePreviewState;
  error?: ExposurePreviewError;
  onRefresh: () => void;
  onOpenCoreDiagnostics: () => void;
}) {
  const hasRouterDiagnostics =
    state.routerStatus.blockedCount > 0 ||
    state.routerStatus.warningCount > 0 ||
    state.routerStatus.errorCount > 0 ||
    !state.routerStatus.ok;
  const routerStatusTone =
    state.routerStatus.errorCount > 0 || !state.routerStatus.ok
      ? "danger"
      : state.routerStatus.warningCount > 0 || state.routerStatus.blockedCount > 0
        ? "warning"
        : "success";
  const routerStatusTitle =
    routerStatusTone === "danger"
      ? t.routerIssue
      : routerStatusTone === "warning"
        ? t.routerRoutesNeedReview
        : t.routerReady;
  const routedIssueKeys = new Set<string>();
  for (const route of state.routerRoutes) {
    if (route.issue) {
      routedIssueKeys.add(`${route.issue.code}:${route.issue.capsuleId ?? ""}:${route.issue.toolName ?? ""}`);
    }
  }
  const standaloneRouterIssues = state.routerIssues.filter(
    (issue) => !routedIssueKeys.has(`${issue.code}:${issue.capsuleId ?? ""}:${issue.toolName ?? ""}`),
  );

  return (
    <section className="panel-body">
      <div className="toolbar">
        <p className="safety-copy">{t.exposureSafety}</p>
        <Button variant="secondary" icon={RefreshCw} onClick={onRefresh}>
          {t.refreshPreview}
        </Button>
      </div>
      {error ? <Alert>{error.message}</Alert> : null}

      <section className="diagnostics-link-card" aria-label={t.routerDiagnosticsSource}>
        <div>
          <h4>{t.routerDiagnosticsSource}</h4>
          <p>{t.routerDiagnosticsSourceBody}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          icon={Settings}
          onClick={onOpenCoreDiagnostics}
        >
          {t.openCoreDiagnostics}
        </Button>
      </section>

      <div className="mini-metrics">
        <Metric icon={Route} label={t.transport} value={state.dryRun.transport} detail={state.dryRun.protocol} compact />
        <Metric icon={Boxes} label={t.capsules} value={String(state.dryRun.capsuleCount)} detail={`${state.dryRun.toolCount} ${t.tools}`} compact />
        <Metric icon={Archive} label={t.resources} value={String(state.dryRun.resourceCount)} detail={t.dryRun} compact />
      </div>

      <section className={`index-status-strip ${routerStatusTone}`} aria-label={t.routerStatus}>
        <div>
          <h4>{routerStatusTitle}</h4>
          <p>{state.routerStatus.errorMessage ?? (hasRouterDiagnostics ? t.routerDiagnosticsHint : t.exposureSafety)}</p>
        </div>
        <DescriptionList
          items={[
            [t.routerRoutes, String(state.routerStatus.routeCount)],
            [t.routable, String(state.routerStatus.routableCount)],
            [t.blocked, String(state.routerStatus.blockedCount)],
            [t.routeWarnings, String(state.routerStatus.warningCount)],
            [t.routeErrors, String(state.routerStatus.errorCount)],
          ]}
        />
      </section>

      <section className="subsection">
        <h4>{t.routerRoutes}</h4>
        {state.routerRoutes.length === 0 ? <p className="muted">{t.noRouterRoutes}</p> : null}
        {state.routerRoutes.length > 0 ? (
          <div className="data-list">
            {state.routerRoutes.map((route) => {
              const routeTone = route.issue?.severity === "error" ? "danger" : route.state === "blocked" ? "warning" : "success";
              const routeLabel = route.state === "routable" ? t.routeReady : t.routeBlocked;
              const routeItems: Array<[string, string]> = [
                [t.capsule, route.capsuleId],
                [t.path, route.capsulePath],
                [t.enabled, route.enabled ? t.true : t.false],
                [t.readiness, route.readinessReason ? `${route.readinessStatus}: ${route.readinessReason}` : route.readinessStatus],
                [t.recovery, route.recommendedAction],
              ];
              if (route.uriPrefix) {
                routeItems.splice(4, 0, [t.resources, route.uriPrefix]);
              }
              if (route.manifestHash) {
                routeItems.splice(4, 0, [t.manifest, route.manifestHash]);
              }
              if (route.issue) {
                routeItems.splice(4, 0, [t.issue, `${route.issue.code}: ${route.issue.message}`]);
              }

              return (
                <article key={`${route.capsuleId}:${route.toolName ?? route.capsulePath}`} className="data-row compact">
                  <div className="row-main">
                    <div>
                      <h4>{route.toolName ?? route.capsuleId}</h4>
                      <p>{route.readinessStatus}</p>
                    </div>
                    <Badge tone={routeTone}>{routeLabel}</Badge>
                  </div>
                  <DescriptionList items={routeItems} />
                </article>
              );
            })}
          </div>
        ) : null}
        {standaloneRouterIssues.length > 0 ? (
          <div className="data-list">
            {standaloneRouterIssues.map((issue) => (
              <article key={`${issue.code}:${issue.capsuleId ?? ""}:${issue.toolName ?? ""}`} className="data-row compact">
                <div className="row-main">
                  <div>
                    <h4>{issue.toolName ?? issue.capsuleId ?? issue.code}</h4>
                    <p>{issue.message}</p>
                  </div>
                  <Badge tone={issue.severity === "error" ? "danger" : "warning"}>{issue.severity}</Badge>
                </div>
                <DescriptionList
                  items={[
                    [t.issue, issue.code],
                    [t.recovery, issue.recommendedAction],
                  ]}
                />
              </article>
            ))}
          </div>
        ) : null}
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
    "teamLibrary.plan": { zh: "检查安装计划", en: "Check install plan" },
    "teamLibrary.apply": { zh: "执行团队安装", en: "Apply team install" },
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

function localizeCatalogPickerMessage(message: string, t: typeof copy[Locale]): string {
  if (!message) {
    return "";
  }

  if (message === copy.zh.catalogPathReady || message === copy.en.catalogPathReady) {
    return t.catalogPathReady;
  }

  if (message === copy.zh.catalogBrowserHelp || message === copy.en.catalogBrowserHelp) {
    return t.catalogBrowserHelp;
  }

  return message;
}

function teamItemStateLabel(state: TeamLibraryItemState, t: typeof copy[Locale]): string {
  const labels: Record<TeamLibraryItemState, string> = {
    display_only: t.displayOnly,
    not_installed: t.installable,
    installed_current: t.installed,
    replace_available: t.replaceAvailable,
    blocked: t.blocked,
  };
  return labels[state];
}

function teamItemRecommendedActionLabel(
  action: TeamCatalogItem["recommendedAction"],
  t: typeof copy[Locale],
): string {
  const labels: Record<TeamCatalogItem["recommendedAction"], string> = {
    none: t.none,
    install: t.applyTeamInstall,
    replace: t.planReplace,
    resolve_conflict: t.blocked,
  };
  return labels[action];
}

function teamItemPlanButtonLabel(item: TeamCatalogItem, t: typeof copy[Locale]): string {
  if (item.recommendedAction === "replace") {
    return t.installReplacePlan;
  }
  return t.installPlan;
}

function teamItemTone(state: TeamLibraryItemState): "neutral" | "success" | "warning" | "danger" {
  if (state === "installed_current") {
    return "success";
  }
  if (state === "replace_available") {
    return "warning";
  }
  if (state === "blocked") {
    return "danger";
  }
  if (state === "display_only") {
    return "neutral";
  }
  return "warning";
}

function runtimeSetupHintForTeamItem(item: TeamCatalogItem): boolean {
  return item.requirements.some((requirement) => pythonRuntimeText(requirement));
}

function runtimeSetupHintForCapsule(capsule: SwitchboardCapsule): boolean {
  if (capsule.readinessOk) {
    return false;
  }

  return [capsule.readinessStatus, capsule.nextStep, capsule.adapter, capsule.entrypoint].some((value) =>
    pythonRuntimeText(value),
  );
}

function pythonRuntimeText(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes("python") || lower.includes("pydantic") || lower.includes("dependency-error");
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
