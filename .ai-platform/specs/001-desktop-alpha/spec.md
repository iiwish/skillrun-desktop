# Feature Spec：Desktop Alpha 消费者控制台

**Feature ID**：001-desktop-alpha  
**版本**：0.1.0  
**状态**：Confirmed  
**来源**：`.ai-platform/docs/product-design.md`  
**最后更新**：2026-05-18  
**审核记录**：用户已于 2026-05-18 批准产品合同。

## 摘要

构建第一个 SkillRun Desktop alpha：一个 tray-first 本地消费者控制台。Alpha 只证明一条消费者路径：

```text
Import -> Review -> Enable -> Preview -> Mount -> Inspect Runs
```

Desktop 必须依赖 SkillRun Core JSON contracts，并保持产品信任边界。

## 用户故事

### US-001：Core Readiness

用户启动 Desktop 后，需要在 tray 看到 SkillRun Core 是否可用，并能进入 Dashboard。

### US-002：Import Capsule

用户选择 `.skr` 文件后，Desktop 通过 Core 导入 capsule，并明确展示导入不等于 trust、enable 或 mount。

### US-003：Review And Enable

用户检查 capsule readiness、source type、runtime 和 tool 信息后，显式决定是否允许 Router exposure intent。

### US-004：Preview Exposure

用户在 mount 前看到 Router 当前会暴露哪些 tools，以及 disabled / not-ready capsules 不会暴露。

### US-005：Mount Router

用户先查看 Claude Desktop mount plan，再确认 apply；如有问题，只能用 Core 返回的 backup path rollback。

### US-006：Inspect Runs

用户查看 Agent 调用后的 run summary、structured envelope、error code、artifact metadata 和 log availability，不读取敏感原始内容。

## 功能需求

### FR-001：Host Handshake

Desktop 必须在启动或刷新时调用 `skillrun host status --json`，解析 `host.status.v1`，并读取 binary version、contract versions、platform、paths、capabilities 和 Desktop boundaries。

### FR-002：Tray Status

Desktop 必须用短跑 Core commands 汇总并展示这些状态：`core_missing`、`core_error`、`no_capsules`、`capsules_disabled`、`tools_exposed`、`mount_not_configured`、`recent_failures`。

### FR-003：CLI Runner

Desktop 必须用参数数组调用 `skillrun`，捕获 stdout、stderr、exit code 和 duration。stdout 是唯一结构化数据源；stderr 只用于失败诊断。

### FR-004：Error Model

Desktop 必须区分 spawn failure、non-zero exit、JSON parse failure、contract mismatch、`ok=false` JSON 和 stale refresh。非零 exit code 不得被降级成成功状态。

### FR-005：Import Flow

Desktop 必须通过 `skillrun import PACKAGE_PATH --json` 导入 `.skr`，成功后进入 capsule review 或 switchboard，并显示 imported capsule 默认为 `enabled=false`。

### FR-006：Capsule Switchboard

Desktop 必须从 `consumer inventory --json` 展示 capsule id/name、source type、enabled、readiness status、adapter、entrypoint、tool name 和 manifest freshness。

### FR-007：Enable And Disable

Desktop 只能在用户显式动作后调用 `switchboard enable CAPSULE_ID` 或 `switchboard disable CAPSULE_ID`。Enable/disable 后必须刷新 inventory 和 exposure。

### FR-008：Exposure Preview

Desktop 必须展示 `consumer exposure --json` 返回的 tools，并可用 `router serve --mcp --dry-run` 做 Router snapshot 预检。Disabled 或 not-ready capsules 不得显示为 exposed。

### FR-009：Mount Manager

Desktop 必须先调用 `consumer mount plan --client claude-desktop --json`，再允许用户确认 apply。Rollback 只能使用 Core 返回的 backup path。Unsupported clients 保持 plan-only。

### FR-010：Envelope Explorer

Desktop 必须通过 `consumer runs list --json` 和 `consumer runs inspect RUN_ID --json --capsule CAPSULE_ID` 展示 run summary、status、duration、mode、error code、hash、artifact metadata、input availability 和 log availability。

### FR-011：Forbidden Internals

Desktop 不得读取 `.skillrun/`、解析 Manifest YAML、读取 `record.json`、读取 stdout/stderr log、打开 artifacts、执行 actions、直接编辑 MCP client config，或从 MCP text content 反推 UI 数据。

## 非功能需求

### NFR-001：Safety Copy

UI copy 必须持续区分 imported、enabled、exposed、mounted、readiness ok 与 trusted、safe、sandboxed、dependency installed、business correctness 的差异。

### NFR-002：Refresh Reliability

托盘刷新必须手动优先。自动刷新应低频、可暂停，连续失败后退避。刷新失败不得弹阻塞式对话框。

### NFR-003：Traceability

每个 Desktop 展示状态都必须记录来源 command、时间、结果或 failure class。Stale state 必须可见。

### NFR-004：Testability

每个被 Desktop 消费的 Core JSON surface 必须有 DTO/parser fixture tests。状态模型必须有 priority、error 和 stale behavior tests。

### NFR-005：UX

UI 是操作型控制台，不是 landing page。第一屏应提供可工作的状态和操作入口，危险动作必须有上下文和确认。

## 范围内

- Tauri tray shell。
- Core CLI runner。
- Desktop-facing Core JSON contracts 的 DTO/parser layer。
- Tray status model。
- Import、Switchboard、Exposure、Mount Manager、Envelope Explorer dashboard pages。
- 先用 mock runner 开发 parser/state/UI flows，再接入真实 Core。

## 范围外

- Marketplace。
- Signed trust。
- Dependency installation。
- Desktop daemon。
- Router process management。
- Artifact/log/input content viewer。
- Authoring IDE。
- Manifest editor。

## 主验收流程

1. 用户启动 Desktop，在托盘看到 Core readiness。
2. 用户打开 dashboard 并导入 `.skr`。
3. Desktop 把 imported capsule 显示为 disabled。
4. 用户 review readiness 并 enable capsule。
5. Desktop 显示 exposure preview。
6. 用户通过 Core preview/apply Claude Desktop mount。
7. Agent 通过 SkillRun Router 调用 tool。
8. Desktop 显示 run evidence summary。

## 边界与错误状态

- 找不到 `skillrun`。
- Core command 返回 non-zero exit。
- stdout JSON parse failed。
- JSON schema version 或 required fields 不匹配。
- Import duplicate registry id。
- Capsule readiness failed。
- Exposure empty。
- Mount client unsupported。
- Rollback conflict。
- Runs inspect 找不到 run 或 capsule。
- Refresh failed after last successful snapshot。

## 阻塞性约束

- Desktop 实现不得把 `.skillrun/` internals 当作 API。
- Tray menu 不得直接执行 enable、apply 或 rollback。
- UI copy 不得暗示 Core 并未提供的 sandbox 或 trust guarantee。
- Core Router 由 MCP client 启动，不由 Desktop tray 作为 daemon 启动。

## 验收标准

- `core_missing` 状态可稳定展示且不崩溃。
- Import 后显示 `source_type=imported_skr` 和 `enabled=false`。
- Enable 前 exposure 为空；ready capsule enable 后 exposure 非空。
- Mount apply 在 plan 显示前不可用。
- Rollback 只接受 Core 返回的 backup path。
- Envelope Explorer 不直接读取 logs、input content 或 artifact content。
