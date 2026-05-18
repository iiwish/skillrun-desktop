# Technical Plan：Desktop Alpha

**Feature ID**：001-desktop-alpha  
**版本**：0.1.0  
**状态**：Confirmed  
**最后更新**：2026-05-18  
**审核记录**：用户于 2026-05-18 要求审核文档，若无问题则提交并继续；本次 review 未发现 blocking issue，视为批准进入 T001 Packetize。

## 决策摘要

### D-001：使用 Tauri Tray-First Shell

Desktop alpha 使用 Tauri 作为 app shell，因为产品需要 native tray、本地进程调用和 dashboard window，同时 Core 必须留在 Rust CLI 项目中。

### D-002：Core CLI JSON 是唯一 Core API

所有 Core 交互都通过 Desktop CLI runner 完成：使用参数数组调用 `skillrun`，只解析 stdout JSON。任何代码路径都不得读取 `.skillrun/` internals。

### D-003：先建 Parser Fixtures，再做完整 UI

在 UI 依赖 Core surfaces 前，先为 host、import、inventory、exposure、router dry-run、mount 和 runs 建 DTO/parser tests。

### D-004：先用 Mock Runner，再接真实 Runner

第一版 tray status 和 dashboard slices 先用 mock runner，使 UI state、error handling 和 parser behavior 可测试，并避免误改真实用户 Core 状态。

### D-005：Router 生命周期不归 Desktop 管

Desktop 可以预览 `router serve --mcp --dry-run`，但不得把长运行 Router 作为 tray daemon 启动。MCP client 从 mounted config 启动 Router。

### D-006：危险动作只能在 Dashboard 中确认

Enable imported capsule、mount apply 和 rollback 必须有 Dashboard 上下文和显式确认。Tray menu 只能打开流程。

## Constitution Check

| Principle | Status | Notes |
| --- | --- | --- |
| Core Contract Consumer | Satisfied | D-002 是中心架构规则。 |
| Tray-First, Not Daemon-First | Satisfied | D-005 阻止隐藏 Router 管理。 |
| Consumer Control Plane Over Feature Count | Satisfied | Work graph 只围绕 golden path。 |
| Honest Trust Language | Satisfied | Copy discipline 进入 task acceptance criteria。 |
| Evidence Over UI Claims | Satisfied | Parser/state tasks 要求 command traceability。 |
| Plan-First Dangerous Actions | Satisfied | Mount manager task 要求 plan before apply。 |
| Testable Contract Boundaries | Satisfied | Parser fixture tasks 先于 UI tasks。 |
| TDD By Default | Satisfied | 行为任务包含 RED-GREEN-REFACTOR。 |
| UX Discipline | Satisfied | UI task scope 是 dashboard/control-plane，不是 landing page。 |
| Preserve User Work | Satisfied | Execution tasks 要求 worktree check 和 allowed files。 |

Constitution 已进入 `Confirmed`。Execution 仍需满足 per-task packet、allowed files、validation commands 和 evidence gate。

## 备选方案

### A-001：先做 Web Dashboard

拒绝。它能绕开 tray 复杂度，但无法验证产品第一身份：tray-first local control plane。

### A-002：让 Desktop 管理 Core Daemon

拒绝。它会发明 Core 目前不存在的生命周期合同，并引入 stdio、hot reload、crash recovery 和 process ownership 风险。

### A-003：为了速度读取 Core 内部文件

拒绝。它会把 Desktop 绑死在不稳定实现细节上，并破坏 Core contract boundary。

### A-004：先做 Marketplace 或官方包浏览

拒绝。它偏离核心消费者路径，应等 import、switchboard、mount 和 run evidence 被证明后再做。

## 架构轮廓

```text
Tauri tray / dashboard
  -> core runner
  -> skillrun argument-array command
  -> stdout JSON parser
  -> Desktop DTO/state model
  -> UI views and confirmation flows
```

建议初始结构：

```text
src/
  core/
    runner.ts
    errors.ts
    contracts/
    fixtures/
  tray/
  state/
  views/
    Dashboard
    Switchboard
    ImportFlow
    ExposurePreview
    MountManager
    EnvelopeExplorer
src-tauri/
```

最终路径可以适配 Tauri scaffold，但 task packets 必须保持架构边界。

## 风险

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Tauri scaffold 选择造成文件 churn | 早期任务可能触碰较宽文件范围 | 第一个 task 只负责 scaffold；后续 task 使用稳定 module boundaries。 |
| Parser contracts 与 Core 漂移 | UI 展示错误状态 | 用 Core outputs 冻结 fixtures，并校验 schema versions。 |
| Tray actions 变得过强 | 出现不安全 one-click 行为 | Tray task acceptance 禁止 enable/apply/rollback。 |
| UI copy 夸大安全 | 违反 trust model | 每个危险状态加入 copy review acceptance criteria。 |
| Mount apply 在测试中触碰真实用户 config | 用户状态风险 | 先用 mock runner 和 config override tests；真实 apply 保持手动确认。 |

## Supporting Artifacts

- Product design：`.ai-platform/docs/product-design.md`
- Feature spec：`.ai-platform/specs/001-desktop-alpha/spec.md`
- Requirements checklist：`.ai-platform/specs/001-desktop-alpha/checklists/requirements.md`
- Work graph：`.ai-platform/specs/001-desktop-alpha/tasks.md`

## 对任务的影响

- 先 scaffold、runner、contracts 和 tests，再做完整 UI。
- 按 golden path 顺序构建。
- 每个 view 只消费 DTO state，不扫描 filesystem。
- 一次只 packetize 和 execute 一个 governed task。
