# SkillRun Desktop 项目宪章

**版本**：0.1.0  
**状态**：Confirmed  
**最后更新**：2026-05-18  
**审核记录**：用户于 2026-05-18 要求审核文档，若无问题则提交并继续；本次 review 未发现 blocking issue，视为批准。

## 目的

本宪章定义 SkillRun Desktop alpha 的不可协商交付原则。它的作用是防止桌面端漂移成 Core replacement、隐形 daemon、不诚实的安全安装器，或只是披着 UI 的 CLI 包装器。

## 原则

### 1. Desktop 只能是 Core 合同消费者

SkillRun Desktop 只能通过稳定的 `skillrun ... --json` CLI surface 消费 SkillRun Core。不得读取 `.skillrun/` 内部目录，不得解析 Manifest YAML，不得自行展开 `.skr`，不得直接执行 action source，也不得从 MCP text content 反推状态。

### 2. Tray-first，不是 Daemon-first

托盘是状态面和入口面，不是后台运行时。它不得把 `skillrun router serve --mcp` 作为隐藏后台 daemon 启动，也不得在没有 Dashboard 显式流程的情况下执行 import、enable、mount apply 或 rollback。

### 3. 消费者控制闭环优先于功能数量

Alpha 的产品主线是：

```text
Import -> Review -> Enable -> Preview -> Mount -> Inspect Runs
```

任何不直接服务这条路径的能力都延后。

### 4. 信任文案必须诚实

UI 必须持续区分：

- imported 不是 trusted。
- enabled 不是 safe。
- exposed 不是 sandboxed。
- mounted 不是 dependency installed。
- readiness ok 不是业务正确性保证。

SkillRun 通过 Manifest 合同、显式 enable、plan/apply/rollback 和 run evidence 减少 Agent 裸执行风险；它不是完整 OS sandbox。

### 5. 状态必须有证据

Desktop 展示的每个状态都必须能追溯到最后一次成功 Core command，或一次明确捕获的 command failure。刷新失败时保留最后一次成功快照，并标注 stale。

### 6. 危险动作必须 plan-first

Mount apply 和 rollback 必须先展示 Core 提供的 plan、diff 或 backup 上下文。Desktop 不得直接修改 MCP client 配置，也不得自行生成 rollback backup。

### 7. 合同边界必须可测试

Desktop 依赖的 Core JSON DTO 和 parser 必须先有 fixture 覆盖。非零 exit code、JSON parse failure、`ok=false` JSON 必须是不同错误类型。

### 8. 默认 TDD

行为变更默认遵循 RED-GREEN-REFACTOR。例外必须由用户针对具体 task 明确批准。即使是 UI shell 工作，只要涉及合同行为，也需要 parser/state tests。

### 9. UX 必须克制

Desktop 是操作型控制台，不是营销页面。界面应状态优先、信息密度适中、视觉克制，并优化反复检查与确认动作。

### 10. 保护用户工作

实现前必须检查 `git status --short`，识别无关变更，并把编辑限制在 task 的 allowed files 内。不得覆盖用户已有文档或实现工作。

## Git 与 Review 政策

- 没有 confirmed task breakdown 和 self-contained execution packet，不得开始实现任务。
- 每个 task 必须定义 allowed files、validation commands、evidence requirements 和 Definition of Done。
- Review 分三层：spec compliance、engineering quality、QA acceptance。
- Task 只有在有 validation evidence、review 通过、且用户明确 acceptance 后，才能进入 `Accepted`。

## 变更流程

修改本宪章必须单独审核。Plan、tasks 或 execution packet 不得静默放宽这些原则。

## 例外

任何例外都必须写明：被例外的原则、影响的 task、原因、替代验证方式，以及批准该例外的用户消息。
