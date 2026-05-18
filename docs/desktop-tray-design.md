# SkillRun Desktop Tray Design

**状态**：Ready_For_Alpha_Design  
**日期**：2026-05-18  
**依赖文档**：`desktop-core-contract.md`

## 一句话判断

SkillRun Desktop 应该是 tray-first，但不是 daemon-first：托盘负责“看见状态”和“进入确认流程”，Core 负责真实 import、enable、mount、run evidence，MCP client 负责启动 Router。

## 托盘的产品职责

托盘只做四件事：

- 显示 Core 可用性。
- 显示本地 capsule / exposure / mount 的摘要状态。
- 提供进入 Dashboard 的入口。
- 提供安全的手动刷新与非危险快捷入口。

托盘不做：

- 不执行 skill。
- 不启动 Router 常驻进程。
- 不自动导入 `.skr`。
- 不自动 enable imported capsule。
- 不自动写 MCP client 配置。
- 不读取 `.skillrun/` 内部文件。

## 托盘状态模型

托盘状态应从低到高覆盖：

| 状态 | 含义 | 主要来源 |
| --- | --- | --- |
| `core_missing` | 找不到 `skillrun` | CLI runner spawn failed |
| `core_error` | `skillrun` 可启动但命令失败 | stderr / exit code |
| `no_capsules` | 本地没有 registered capsule | `consumer inventory --json` |
| `capsules_disabled` | 有 capsule，但没有 exposed tool | `consumer inventory` + `consumer exposure` |
| `tools_exposed` | Router snapshot 将暴露 tool | `consumer exposure --json` |
| `mount_not_configured` | Claude Desktop 未挂 SkillRun Router | `consumer mount plan --client claude-desktop --json` |
| `recent_failures` | 最近 run 有失败 | `consumer runs list --json --limit <n>` |

状态优先级建议：

```text
core_missing
  > core_error
  > recent_failures
  > mount_not_configured
  > tools_exposed
  > capsules_disabled
  > no_capsules
```

优先级不是安全等级，只是 UI 告警顺序。

## 托盘菜单

首版菜单建议：

```text
SkillRun
Status: <summary>
Open Dashboard
Import .skr...
Refresh
Mount Manager
Envelope Explorer
Quit
```

约束：

- `Import .skr...` 可以打开窗口或文件选择器，但导入结果必须进入 Dashboard review。
- `Mount Manager` 只打开页面，不直接 apply。
- `Refresh` 只调用短跑状态命令。
- 菜单里不放 Enable、Apply、Rollback 这类危险动作。

## 刷新策略

默认策略：

- App 启动时刷新一次。
- 用户点击托盘或打开窗口时刷新一次。
- 用户执行 import、enable、disable、mount、rollback 后刷新相关 surfaces。
- 自动刷新低频，例如 60-120 秒，并允许关闭。

失败策略：

- 连续失败后退避。
- 不弹阻塞弹窗。
- 托盘显示降级状态，Dashboard 显示详细错误。

## Router 边界

托盘不默认启动：

```text
skillrun router serve --mcp
```

原因：

- Router 是 MCP runtime entry，应由 MCP client 的 config 启动。
- 托盘启动 Router 会引入进程生命周期、端口/stdio 管理、热更新和崩溃恢复问题。
- Core 当前稳定合同是 CLI JSON + MCP stdio，不是 daemon/local API。

未来如果需要 Desktop 管理 Router，必须先定义新的 Core contract，例如 daemon status、start、stop、health、logs；不能由 Desktop 私自托管。

## Dashboard 关系

托盘是入口，Dashboard 是操作面：

- Switchboard：enable / disable。
- Import Flow：导入 `.skr`。
- Exposure Preview：查看 Router snapshot。
- Mount Manager：plan / apply / rollback。
- Envelope Explorer：查看 run evidence。

危险动作必须在 Dashboard 中展示上下文、差异和确认。

## Alpha 验收

托盘 alpha 通过条件：

1. 关闭 Dashboard 后托盘仍可显示 last known state。
2. Core 不存在时托盘进入 `core_missing`，不会崩溃。
3. 托盘 Refresh 不读取 `.skillrun/`，只调用 Core surfaces。
4. 托盘不会启动 Router。
5. 托盘不会直接执行 enable、apply、rollback。
6. 用户可从托盘进入完整 golden path。
