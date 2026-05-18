# SkillRun Desktop Alpha Roadmap

**状态**：Draft_For_Desktop_Project_Start  
**日期**：2026-05-18  
**依赖文档**：`desktop-readiness.md`、`desktop-core-contract.md`

## 一句话判断

Desktop alpha 的目标不是做“漂亮版 CLI”，而是验证一个 tray-first 消费者闭环：托盘看状态、窗口做确认、Core 执行动作，最终导入 `.skr`、显式启用、预览暴露、挂载 Router、查看执行证据。

## Alpha Product Spine

第一版只围绕一个主线组织：

```text
Import
  -> Review
  -> Enable
  -> Preview
  -> Mount
  -> Inspect Runs
```

这条主线必须比功能数量更重要。任何不服务这条链路的能力，都推迟。

托盘主线：

```text
Tray status
  -> Open Dashboard
  -> Import / Switchboard / Mount / Runs
  -> Tray reflects last known Core state
```

## Phase A: Tray Shell And Core Adapter

目标：让 Desktop 有一个可信的 Core 调用层。

必须完成：

- Tauri tray app shell：托盘常驻，窗口按需打开。
- Tray menu：Open Dashboard、Import `.skr`、Refresh、Mount Manager、Quit。
- CLI runner：参数数组调用 `skillrun`，捕获 stdout/stderr/exit code/duration。
- JSON parser：只从 stdout 解析 Core JSON。
- 统一错误模型：spawn failed、non-zero exit、json parse failed、contract mismatch。
- DTO：覆盖 import、inventory、exposure、mount plan/apply/rollback、runs list/inspect。
- fixture tests：每个 DTO 至少有一个成功样例和一个失败/异常样例。
- Refresh policy：手动刷新优先，自动刷新低频且可暂停。

验收标准：

- runner 不拼接 shell string。
- 非零 exit code 不会被当成成功状态。
- parser 不读取 `.skillrun/`。
- Core command 不可用时 UI 能明确提示。
- 托盘不自动启动 `skillrun router serve --mcp`。
- 托盘不直接执行 enable、mount apply 或 rollback。

## Phase B: Capsule Switchboard

目标：让用户知道本机有哪些 capsule，哪些被允许暴露。

必须完成：

- Capsule list：消费 `skillrun consumer inventory --json`。
- Capsule states：source type、enabled、readiness、adapter、entrypoint、tool name。
- Enable / disable：调用 `skillrun switchboard enable <id>` 和 `skillrun switchboard disable <id>`。
- Refresh policy：enable/disable 后刷新 inventory 和 exposure。
- Copy discipline：明确 imported、enabled、readiness、exposed 的区别。

验收标准：

- `source_type=imported_skr` 且 `enabled=false` 的 capsule 不显示为可暴露。
- readiness failed 的 capsule 不显示为 runnable。
- enable 失败时展示 Core stderr/error，不猜测修复。

## Phase C: Import Flow

目标：让普通用户可以导入一个 `.skr`，但不会误以为已经信任或挂载。

必须完成：

- 文件选择：只选择 `.skr`。
- Import：调用 `skillrun import <package.skr> --json`。
- Success route：导入成功后进入 capsule detail / switchboard。
- Duplicate handling：处理 `registry id already exists`。
- Post-import state：默认 disabled。

验收标准：

- Desktop 不展开 `.skr`。
- 导入成功不会自动 enable。
- 导入成功不会自动 mount。
- UI 文案不使用 install/trusted/sandboxed 误导。

## Phase D: Exposure Preview

目标：让用户在挂载前看清 Router 会暴露什么。

必须完成：

- Lightweight exposure：调用 `skillrun consumer exposure --json`。
- Router snapshot：调用 `skillrun router serve --mcp --dry-run`。
- Tool list：展示 capsule id、tool name、readiness status、manifest hash。
- Resource metadata：只展示 resource name、uri、mime type，不展示 text content。

验收标准：

- disabled capsule 不出现在 exposure。
- not-ready capsule 不出现在 exposure。
- preview 不启动长运行 Router。

## Phase E: MCP Mount Manager

目标：让用户可以把 SkillRun Router 挂到 Claude Desktop，并能回滚。

必须完成：

- Plan：调用 `skillrun consumer mount plan --client claude-desktop --json`。
- Confirm apply：用户确认后调用 `skillrun consumer mount apply --client claude-desktop --json`。
- Backup display：展示 Core 返回的 backup path。
- Rollback：调用 `skillrun consumer mount rollback --client claude-desktop --backup <path> --json`。
- Plan-only clients：Cursor 等只展示 plan，不开放 apply。

验收标准：

- Apply 前必须有 plan。
- Apply 前必须有用户确认。
- Desktop 不直接修改 MCP client config。
- Rollback 只使用 Core 返回的 backup path。

## Phase F: Envelope Explorer

目标：把 SkillRun 的“可审计、可验收”变成消费者能看懂的证据面板。

必须完成：

- Runs list：调用 `skillrun consumer runs list --json`。
- Capsule filter：支持 `--capsule <id>`。
- Run detail：调用 `skillrun consumer runs inspect <run-id> --json --capsule <id>`。
- Summary view：status、mode、duration、error code、hash、artifact count。
- Evidence view：envelope status/value、input availability、log availability、artifact metadata。

验收标准：

- 不直接读取 `.skillrun/runs`。
- 默认不展示完整 input。
- 默认不展示 stdout/stderr content。
- 默认不打开 artifact content。

## Alpha Non-Goals

不要在 alpha 做：

- marketplace。
- signed package trust。
- dependency installer。
- daemon。
- Router hot reload。
- multi-client apply。
- official package update。
- artifact viewer。
- log viewer。
- action authoring IDE。
- Manifest editor。

## Release Gate

Desktop alpha 可以对外试用的最低 gate：

1. Tray-first `.skr` golden path 可以跑通 tray status、import、enable、exposure、mount、run inspect。
2. 每个 Core JSON DTO 都有 parser fixture。
3. 所有状态改变都可追溯到具体 `skillrun` command。
4. 所有危险动作都有确认：enable imported capsule、mount apply、rollback。
5. 文案不夸大安全：不把 enabled/exposed/readiness 说成 trust 或 sandbox。
6. 托盘只做状态和入口，不做隐形 daemon。

## 下一步动作

1. 初始化 Tauri 项目后，先建 `src/core/runner.ts`、`src/core/contracts/*` 和 `src/tray/*`，不要先画完整 UI。
2. 从 `desktop-core-contract.md` 提取 fixture，写 parser tests。
3. 用 mock runner 做 Tray Status + Switchboard 第一屏，再接真实 `skillrun`。
