# SkillRun Desktop Alpha Roadmap

**状态**：Desktop_Alpha_Implementation
**日期**：2026-06-01
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

状态：已实现基础 CLI runner、Core JSON parser fixtures、统一错误模型和真实 Core smoke；继续以 smoke / contract tests 防止边界退化。

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

状态：已实现基础 Capsule 管理、enable / disable 编排和状态刷新；发布前继续通过真实 `.skr` / hero catalog 路径回归。

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

状态：已实现本地 `.skr` 导入链路；导入后仍默认 disabled，不自动 enable 或 mount。

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

状态：已实现 exposure preview、Router dry-run 和 `router.status.v1` / `router.mcp.v1` route diagnostics 展示。

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

状态：已实现 plan / apply / rollback 的 Core 编排边界；继续保持 Desktop 不直接修改 MCP client config。

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

状态：已实现 runs list / inspect 的安全摘要路径；artifact content、stdout/stderr content 和 input include/redaction 仍保持 out of scope。

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

## Phase G: Team Library Planning

状态：已实现 Team Library alpha UI、`team.catalog.inspect.v1` / `team.catalog.status.v1` / install plan / guarded apply 的 parser、service、state 和 smoke 覆盖。

目标：消费 Core team catalog surface，让 Desktop 能浏览团队 catalog、本地状态、安装计划和 guarded apply，同时保持团队分发不是 marketplace。

必须完成：

- 页面计划：见 `team-library-page-plan.md`。
- 信息架构：Team Library 是团队 catalog 浏览 / 计划入口，不替代 Capsule 管理。
- 状态流：inspect -> review item -> install plan -> guarded apply -> Capsule page。
- 边界：Desktop 不直接解析 catalog 来安装，不下载 `.skr`，不解包 `.skr`，不实现 trust 判断。
- 依赖：继续跟随 Core 稳定 JSON surface；新增能力必须先有 fixture 和 parser test，再进入 UI。

验收标准：

- 页面计划明确 Linear 风格的列表 / inspector 工作面，而不是 marketplace 卡片墙。
- 每个 UI action 都能追溯到未来 Core JSON surface。
- 对 plain Agent Skill 和 MCP server item 只展示，不执行或安装。
- 安装成功后仍回到现有 enable / exposure / mount / runs 主线。

## Release Gate

Desktop alpha 可以对外试用的最低 gate：

1. Tray-first `.skr` golden path 可以跑通 tray status、import、enable、exposure、mount、run inspect。
2. 每个 Core JSON DTO 都有 parser fixture。
3. 所有状态改变都可追溯到具体 `skillrun` command。
4. 所有危险动作都有确认：enable imported capsule、mount apply、rollback。
5. 文案不夸大安全：不把 enabled/exposed/readiness 说成 trust 或 sandbox。
6. 托盘只做状态和入口，不做隐形 daemon。

### Alpha Release Checklist

发布 `desktop-v*` alpha 前必须完成：

- [ ] 运行 release workflow 的 `Real Core smoke gate`，或在 `Desktop CI` 手动触发 `run_core_smoke=true`。
- [ ] 如需锁定 Core 版本，在 `workflow_dispatch` 中填写 `skillrun_ref`，并用 `skillrun_expected_version` 校验 `skillrun --version`。
- [ ] 确认 smoke 摘要包含 `host status`、`init`、`manifest`、`pack`、`import`、`inventory`、`switchboard enable`、`exposure`、`test`、`runs list`、`runs inspect`。
- [ ] 只有 real Core smoke 成功后，才能继续生成 draft prerelease alpha artifacts。

## 下一步动作

1. 以 `npm run smoke:real-core` 和 `npm run smoke:hero-desktop` 作为每轮 Desktop alpha 改动的回归基线。
2. 发布前按 `router-diagnostics-manual-test.md` 记录 no routes、routable、blocked、duplicate tool 和 Desktop refresh 的手测证据。
3. 收敛 Desktop alpha release gate：real Core smoke 成功后再生成 draft prerelease artifacts；失败时只修复 Core contract、Desktop parser 或环境说明，不绕过 smoke。
