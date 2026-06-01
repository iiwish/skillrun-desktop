# SkillRun Desktop Docs

**状态**：Desktop_Alpha_Implementation
**日期**：2026-06-01

## 阅读顺序

1. `desktop-readiness.md`：记录 Desktop alpha 的产品边界、当前已具备能力和后续验证路径。
2. `desktop-core-contract.md`：冻结 Desktop alpha 可以调用的 Core CLI JSON surfaces，以及禁止依赖的内部路径。
3. `desktop-tray-design.md`：定义 tray-first 产品形态、托盘状态、菜单和 Router 边界。
4. `desktop-alpha-roadmap.md`：记录 alpha 阶段拆分、已完成状态和仍需发布前验证的 gate。
5. `team-library-page-plan.md`：记录 Team Library 页面、Core catalog surface、状态流和 UI 禁区。
6. `router-diagnostics-manual-test.md`：Router diagnostics 的手动测试场景，覆盖 no routes、routable、blocked、duplicate tool 和 Desktop UI refresh。

## 核心原则

Desktop 是 SkillRun Core 的 tray-first 消费者控制台，不是 Core replacement。它通过稳定 `skillrun` CLI JSON 编排 import、switchboard、exposure、mount 和 run evidence；不读取 `.skillrun/` 内部目录，不解析 Manifest YAML，不自行执行 action，不自行修改 MCP client 配置，也不把托盘做成隐形 Router daemon。
