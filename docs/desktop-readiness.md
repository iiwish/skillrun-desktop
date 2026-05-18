# SkillRun Desktop Readiness Review

**状态**：Ready_For_Desktop_Alpha_Planning  
**日期**：2026-05-18  
**适用范围**：`skillrun-desktop` tray-first 独立项目启动前的产品边界、Core 合同和 alpha 验证路径

## 一句话判断

Desktop 现在可以进入 alpha 规划与原型开发，但必须把自己定位成 **SkillRun Core 的消费者控制台**：只调用稳定 CLI JSON / Router 合同，不读取 `.skillrun/` 内部目录，不解析 Manifest YAML，不直接执行 action，不发明自己的 import、mount、run history 或 trust 语义。

如果第一版直接做 Tauri 托盘应用，方向成立；但托盘只能是 **本地状态入口与快捷控制面**，不能变成隐形 Core daemon。

## 当前结论

SkillRun Core 到 v0.5.13 已经补齐 Desktop alpha 的关键底座：

- 本地 capsule inventory。
- `.skr import`。
- capsule enable / disable。
- readiness / dependency 状态。
- exposure preview。
- Router MCP runtime。
- Claude Desktop mount apply / rollback。
- run list。
- run inspect。
- imported capsule 到 Router exposure 的端到端合同测试。

因此 Desktop 不再需要等待 Core “能不能跑”。真正要控制的是边界：Desktop 只做 UI、编排、确认和可视化，不做 Core replacement。

## Desktop 的核心定位

SkillRun Desktop 不是作者 IDE，不是 marketplace，也不是 Agent framework。

它的第一身份应该是：

> 本地 Skill Capsule 消费者控制台。

产品形态应该是：

> Tray-first local control plane.

也就是说：托盘常驻，窗口按需打开；托盘展示 Core 是否可用、Router 是否已挂载、是否有 exposed tools、最近 runs 是否失败。托盘本身不常驻运行 Router，不扫描 `.skillrun/`，不直接执行 skill。

目标用户：

- 想使用已有 Skill Capsule，但不想手写 MCP client 配置的人。
- 想看清哪些 capsule 已导入、已启用、不可运行，以及原因的人。
- 想审查 Agent 执行记录、preflight 拦截、结构化错误和 artifact 摘要的人。
- 想体验官方场景包，但不想理解 CLI 全流程的人。

## 允许消费的 Core 合同

Desktop alpha 可以依赖以下 `skillrun` surfaces：

| Surface | Desktop 用途 | 边界 |
| --- | --- | --- |
| `skillrun import <package.skr> --json` | 导入本地 `.skr` | 导入后默认 `enabled=false`；不安装依赖，不代表 trust |
| `skillrun consumer inventory --json` | Capsule 列表、readiness、source type、enabled 状态 | 本地 inventory，不是 trust store |
| `skillrun registry inspect <id> --json` | 单个 capsule 详情 | 只读合同，不读取 registry 文件 |
| `skillrun switchboard list --json` | enable state 列表 | 展示状态，不解释为 trusted/sandboxed |
| `skillrun switchboard enable <id>` | 显式启用 capsule | 必须显示确认；启用前不暴露给 Router |
| `skillrun switchboard disable <id>` | 显式关闭 capsule | 可作为 UI 快捷开关 |
| `skillrun consumer exposure --json` | Router 暴露预览 | 只显示 `enabled=true` 且 readiness ok 的 tools |
| `skillrun router serve --mcp --dry-run` | Router snapshot 预览 | 用于 UI 检查，不启动长运行服务 |
| `skillrun router serve --mcp` | MCP runtime entry | MCP client 应挂 Router，不挂 `.skr` 或 capsule path |
| `skillrun consumer mount plan --client <id> --json` | MCP client 配置预览 | 所有客户端都应先 plan |
| `skillrun consumer mount apply --client claude-desktop --json` | Claude Desktop 一键挂载 | 真实写配置，必须有用户确认 |
| `skillrun consumer mount rollback --client claude-desktop --backup <path> --json` | Claude Desktop 回滚 | 只用 Core 提供的 backup path |
| `skillrun consumer runs list --json` | Envelope Explorer 列表 | 只读摘要，不含完整 input/log/artifact content |
| `skillrun consumer runs inspect <run-id> --json --capsule <id>` | Envelope Explorer 详情 | 默认不返回完整 input、stdout/stderr 或 artifact content |
| `skillrun check --json --cwd <capsule>` | readiness 诊断 | 不执行 action source |
| `skillrun doctor --json --cwd <capsule>` | 修复建议 | 不执行 action source |

## 禁止依赖

Desktop 不得依赖：

- `.skillrun/` 内部目录布局作为稳定 API。
- 直接读取或解析 `.skillrun/manifest.generated.yaml`。
- 直接读取 `.skillrun/runs`、`record.json`、`stdout.log`、`stderr.log` 或 artifact 文件作为 UI 数据源。
- 直接执行 `action.py`、`action.mjs` 或 command adapter。
- 从 MCP text content 反解析审计数据。
- 把 `.skr` 当成 MCP runtime entry。
- 把 `switchboard enabled=true` 展示为 trusted、safe 或 sandboxed。
- 自己实现 package extraction、mount config mutation、rollback 或 run evidence parsing。

## Alpha 首屏建议

Desktop 第一个 alpha 应验证“消费者控制台”模型，而不是追求完整 marketplace。

### 0. Tray Status

- 数据源：短跑 Core 命令，例如 `skillrun doctor --json`、`consumer inventory --json`、`consumer exposure --json`、`consumer mount plan --client claude-desktop --json`。
- 展示：Core not found、No capsules、Capsules disabled、Tools exposed、Mount not configured、Recent failures。
- 操作：Open Dashboard、Import `.skr`、Refresh、Mount Manager、Quit。
- 边界：托盘不启动长运行 Router；MCP client 仍通过 mounted config 启动 `skillrun router serve --mcp`。

### 1. Capsule Switchboard

- 数据源：`consumer inventory --json`。
- 展示：name/id、source type、enabled、readiness status、adapter、entrypoint、manifest freshness。
- 操作：import、enable、disable、inspect readiness。
- 关键文案：enabled 表示“允许暴露意图”，不表示 trusted 或 sandboxed。

### 2. Import Flow

- 入口：选择本地 `.skr` 文件。
- 执行：`skillrun import <package.skr> --json`。
- 成功后：跳转到 imported capsule 详情。
- 默认状态：disabled。
- 必须展示：不安装依赖、不建立 trust、不自动挂载 MCP client。

### 3. Exposure Preview

- 数据源：`consumer exposure --json` 或 `router serve --mcp --dry-run`。
- 展示：当前 Router 会暴露哪些 tools。
- 明确：disabled / not-ready capsule 不暴露。
- 不直接启动长运行 Router，除非用户进入 Mount Manager。

### 4. MCP Mount Manager

- Preview：`consumer mount plan --client <id> --json`。
- Apply：首版只对 Claude Desktop 开启 `consumer mount apply --client claude-desktop --json`。
- Rollback：使用 apply 返回的 backup path 调用 rollback。
- Cursor：如果 Core 仍是 plan-only，UI 也必须 plan-only。

### 5. Envelope Explorer

- 列表：`consumer runs list --json`。
- 详情：`consumer runs inspect <run-id> --json --capsule <id>`。
- 首版只展示：status、duration、mode、error code、envelope、artifact metadata、log availability。
- 不展示完整 input，不打开 artifact content，不读取 stdout/stderr 内容。

## 推荐交互模型

```text
Tray status
  -> Open Dashboard
  -> Import .skr
  -> Inventory shows imported capsule disabled
  -> User reviews readiness
  -> User enables capsule
  -> Exposure Preview shows Router tool
  -> Mount Manager mounts SkillRun Router
  -> Agent calls tool through MCP
  -> Envelope Explorer shows run evidence
```

这个模型应成为 Desktop alpha 的主线。不要先做“官方包商店”“复杂权限中心”或“依赖安装向导”。

## 仍不应由 Desktop 发明的能力

这些能力要等 Core 合同明确后再做 UI：

- signed package trust。
- package registry / marketplace。
- dependency install / virtualenv / runtime image。
- artifact content opening。
- stdout/stderr content browsing。
- input redaction / include-input。
- Router hot reload。
- daemon API。
- multi-client mount apply。
- official pack install/update semantics。

## 设计原则

1. Desktop 是 Core contract consumer，不是 Core replacement。
2. Tray 是状态入口，不是 daemon。
3. 所有状态改变都通过 `skillrun` 命令或未来 local API。
4. UI 必须持续区分 runnable、enabled、exposed、trusted、sandboxed。
5. `.skr` 是 import/distribution artifact，不是 runtime entry。
6. Router 是 MCP client 唯一推荐挂载入口。
7. Envelope Explorer 先做 summary 和 safe inspect，再做受控内容读取。
8. 官方场景包先用 mock/csv/json connector，不被真实平台授权卡死。

## 下一步建议

1. 按 `desktop-core-contract.md` 实现 Tauri tray shell + CLI runner + JSON schema adapter，不做后台 daemon。
2. 为 Import、Switchboard、Exposure、Mount、Runs 五组 Core JSON 建 TypeScript DTO 与 parser fixture。
3. 以一条 golden path 验证 alpha：tray status、import `.skr`、enable、preview exposure、mount Claude Desktop、查看 run evidence。
