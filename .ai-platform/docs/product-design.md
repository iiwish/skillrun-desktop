# SkillRun Desktop Alpha 产品设计

**版本**：0.1.0  
**状态**：Confirmed  
**来源**：`docs/desktop-readiness.md`、`docs/desktop-core-contract.md`、`docs/desktop-tray-design.md`、`docs/desktop-alpha-roadmap.md`  
**最后更新**：2026-05-18  
**审核记录**：用户已于 2026-05-18 批准 Desktop Alpha 产品合同，并要求进入 Plan Mode。

## 产品定位

SkillRun Desktop 是 SkillRun Core 的 tray-first 本地消费者控制台。它不是 Core replacement、作者 IDE、marketplace、依赖安装器、daemon，也不是通用 Agent framework。

第一个 alpha 要验证：普通消费者能否在不理解完整 CLI 流程的情况下消费 Skill Capsule，同时不破坏 Core 的安全与信任边界。

## 目标用户

- 想使用已有 Skill Capsule，但不想手写 MCP client 配置的人。
- 想看清本机哪些 capsule 已导入、已启用、已暴露或被 readiness 阻塞的人。
- 想审查 Agent 执行证据、结构化错误和 artifact metadata 的人。
- 想体验官方场景 capsule，但不想理解 Rust、MCP 或 adapter 细节的人。

## JTBD

当我拿到或创建一个 Skill Capsule 时，我希望能导入它、检查状态、明确决定是否允许它暴露给 MCP client、安全挂载 SkillRun Router，并在执行后查看证据。

## 用户故事

### US-001：Core Readiness

作为 Desktop 用户，我需要托盘显示 SkillRun Core 是否可用，从而判断控制台是否可操作。

### US-002：导入 Capsule

作为 Desktop 用户，我需要导入 `.skr` 文件，但导入不能自动意味着 trusted、enabled 或 mounted。

### US-003：Review And Enable

作为 Desktop 用户，我需要检查 imported capsule，并显式启用或禁用 Router exposure intent。

### US-004：Exposure Preview

作为 Desktop 用户，我需要在 mount 或使用 Router 前，看清 Router 将暴露哪些 tools。

### US-005：Mount Router

作为 Desktop 用户，我需要预览并应用 SkillRun Router 到 Claude Desktop 的挂载，并由 Core 处理 backup 与 rollback。

### US-006：Inspect Runs

作为 Desktop 用户，我需要查看 run evidence summary，从而理解一次 Agent 调用做了什么、为什么失败。

## 核心用户路径

```text
Tray status
  -> Open Dashboard
  -> Import .skr
  -> Review imported capsule
  -> Enable capsule
  -> Preview Router exposure
  -> Mount SkillRun Router to Claude Desktop
  -> Agent calls tool through MCP
  -> Inspect run evidence
```

## 功能需求

### FR-001：Host Handshake

Desktop 必须在启动或刷新时调用 `skillrun host status --json`，并解析 `host.status.v1`。

### FR-002：Tray Status

Desktop 必须用短跑 Core commands 汇总 Core availability、capsule inventory、exposure、mount state 和 recent failures。

### FR-003：CLI Runner

Desktop 必须使用参数数组调用 Core，捕获 stdout、stderr、exit code 和 duration，并且只从 stdout 解析 JSON。

### FR-004：Error Model

Desktop 必须区分 spawn failure、non-zero exit、JSON parse failure、contract mismatch、`ok=false` JSON 和 stale refresh。

### FR-005：Import Flow

Desktop 必须通过 `skillrun import PACKAGE_PATH --json` 导入用户选择的 `.skr` 文件，并把导入后的 capsule 显示为 disabled。

### FR-006：Capsule Switchboard

Desktop 必须从 `consumer inventory --json` 展示 capsule source type、enabled state、readiness、adapter、entrypoint 和 tool name。

### FR-007：Enable And Disable

Desktop 只能在用户显式动作触发时调用 `skillrun switchboard enable CAPSULE_ID` 和 `skillrun switchboard disable CAPSULE_ID`，然后刷新 inventory 与 exposure。

### FR-008：Exposure Preview

Desktop 必须从 `consumer exposure --json` 展示 exposed tools，并可用 `router serve --mcp --dry-run` 做 Router snapshot 校验。

### FR-009：Mount Manager

Desktop 在任何 apply 前，必须先调用 `consumer mount plan --client claude-desktop --json`；apply 和 rollback 必须有用户确认。

### FR-010：Envelope Explorer

Desktop 必须通过 `consumer runs list --json` 和 `consumer runs inspect RUN_ID --json --capsule CAPSULE_ID` 展示安全的 evidence summary。

### FR-011：Forbidden Internals

Desktop 不得读取 `.skillrun/`、解析 Manifest YAML、读取 run files、打开 stdout/stderr logs、打开 artifact content、执行 actions，或直接编辑 MCP client config。

## 非功能需求

### NFR-001：Safety Copy

UI 不得把 imported、enabled、exposed、mounted 或 readiness states 描述成 trust、safe、sandbox、dependency installed 或 business correctness。

### NFR-002：Refresh Reliability

托盘刷新必须以手动优先；自动刷新必须低频，连续失败后退避，且不得弹出阻塞式对话框。

### NFR-003：Traceability

每个展示状态都必须能追溯到 Core command result 或 command failure。

### NFR-004：Testability

每个被 Desktop 消费的 Core JSON surface，都必须先有 DTO/parser fixture tests。

### NFR-005：UX

Desktop 应像操作型控制台：状态优先、克制、有足够信息密度，并对危险动作保持显式。

## 功能范围

Alpha 包含 tray shell、CLI runner、DTO/parser contracts、tray status、import flow、capsule switchboard、exposure preview、Claude Desktop mount manager 和 safe run evidence inspection。

## 非目标

- Marketplace 或 registry browsing。
- Signed package trust store。
- Dependency installer。
- Desktop daemon API。
- Router hot reload 或 router process management。
- Multi-client mount apply。
- Official package update semantics。
- Artifact content viewer。
- Log content viewer。
- Input include/redaction policy。
- Authoring IDE 或 Manifest editor。

## 边界场景

- Core binary missing 或 spawn failure。
- Core command 返回 non-zero exit。
- stdout 不是合法 JSON。
- JSON schema version 或 required fields 不符合预期。
- Import 时 registry ID already exists。
- Imported 或 local capsule readiness failed。
- Mount client unsupported 或 plan-only。
- Rollback 与当前 config 冲突。
- Recent runs 包含失败记录。
- 已有成功快照后 refresh 失败。

## 约束与假设

- Core 版本线为 `v0.5.14` 或更新，以支持 `host status --json`。
- Desktop 作为独立 tray-first 项目启动。
- 首个支持 apply 的 client 是 Claude Desktop。
- Cursor 等其他 clients 在 Core 提供 apply support 前保持 plan-only。
- Router 通过 MCP client config 挂载，并由 MCP client 启动；Desktop tray 不启动 Router。

## 集成需求

Desktop 消费以下 Core surfaces：

- `host status --json`
- `import PACKAGE_PATH --json`
- `consumer inventory --json`
- `registry inspect CAPSULE_ID --json`
- `switchboard list --json`
- `switchboard enable CAPSULE_ID`
- `switchboard disable CAPSULE_ID`
- `consumer exposure --json`
- `router serve --mcp --dry-run`
- `consumer mount plan --client claude-desktop --json`
- `consumer mount apply --client claude-desktop --json`
- `consumer mount rollback --client claude-desktop --backup BACKUP_PATH --json`
- `consumer runs list --json`
- `consumer runs inspect RUN_ID --json --capsule CAPSULE_ID`
- `check --json --cwd CAPSULE_PATH`
- `doctor --json --cwd CAPSULE_PATH`

## 成功标准

- 用户可以从 tray status 到 run evidence 完整跑通 golden path，且无需手动编辑 MCP config。
- 导入 `.skr` 永远不会自动 enable、expose、trust 或 mount。
- 每个危险动作都有 Dashboard 上下文和确认。
- Tray 永远不会把 Router 作为隐藏 daemon 启动。
- Alpha 依赖的每个 DTO parser 都有 fixture test。

## 验收标准

- 找不到 `skillrun` 时，Tray 显示 `core_missing` 且不崩溃。
- Import success 显示 `source_type=imported_skr` 和 `enabled=false`。
- Enable 前 exposure 为空；ready capsule enable 后 exposure 非空。
- Mount apply 在 plan 显示前不可用。
- Rollback 只接受 Core 返回的 backup path。
- Envelope Explorer 展示 summary metadata，但不直接读取 logs、input content 或 artifact content。

## 澄清记录

- 2026-05-18：用户批准 Desktop Alpha 产品合同，并要求进入 Plan Mode。

## 开放问题

无阻塞 planning 的开放问题。实现细节由技术计划和 task approval 决定。
