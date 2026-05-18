# Work Graph：Desktop Alpha

**Feature ID**：001-desktop-alpha  
**版本**：0.1.0  
**状态**：Confirmed  
**最后更新**：2026-05-18  
**审核记录**：用户于 2026-05-18 要求审核文档，若无问题则提交并继续；本次 review 未发现 blocking issue，work graph 确认。

## Epic E001：App Foundation And Core Contract Layer

### Story US-001：Core Readiness

#### T001: Scaffold Tauri Tray App Shell

状态: Accepted
优先级: P0  
依赖: None  
阻塞: T002, T004  
需求映射: US-001, FR-001, FR-002  
并行: No  
冲突: T002, T004

目标:
创建初始 Desktop app scaffold，具备 Tauri tray 能力和 dashboard window 入口。

允许修改范围:
- `package.json`
- `pnpm-lock.yaml`
- `npm-shrinkwrap.json`
- `yarn.lock`
- `src/**`
- `src-tauri/**`
- `index.html`
- `vite.config.*`
- `tsconfig*.json`
- `.gitignore`

测试目标:
- 所选 frontend stack 生成或新增的 scaffold tests。

交付内容:
- Tauri app 可本地启动。
- Tray menu 包含 Open Dashboard、Import `.skr...`、Refresh、Mount Manager、Envelope Explorer、Quit。

验收标准:
- Tray menu 不包含直接 enable、apply 或 rollback 的动作。
- 关闭 dashboard 不等于退出 app；退出只能通过 Quit。

Definition of Done:
- Scaffold 能通过选定 dev/build command。
- 文件结构支持 `core`、`tray`、`state`、`views` 模块边界。

验证命令:
- `npm test` 或所选等价命令。
- `npm run build` 或所选等价命令。

TDD plan:
- RED: 如果所选 stack 支持，先添加 shell/tray state 的最小失败测试。
- GREEN: 实现最小 scaffold。
- REFACTOR: green 后整理模块边界。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T001.yaml`

完成证据:
- Changed files。
- Scaffold command results。
- Diff summary。
- Residual risk。

#### T002: Implement Core CLI Runner And Error Model

状态: Accepted
优先级: P0  
依赖: T001  
阻塞: T003, T004, T005, T006, T007, T008  
需求映射: US-001, FR-001, FR-003, FR-004, NFR-003  
并行: No  
冲突: T003

目标:
实现可复用 runner：使用参数数组调用 `skillrun`，捕获 stdout/stderr/exit code/duration，只从 stdout 解析 JSON，并返回 typed error classes。

允许修改范围:
- `src/core/runner.ts`
- `src/core/errors.ts`
- `src/core/runner.test.ts`
- `src/core/errors.test.ts`
- `package.json`（仅限补充缺失的验证脚本）
- `src-tauri/src/lib.rs`（仅限最小 Tauri command bridge）

测试目标:
- `src/core/runner.test.ts`
- `src/core/errors.test.ts`

交付内容:
- Runner result model。
- Spawn failure、non-zero exit、JSON parse failure、contract mismatch、`ok=false`、stale refresh 错误类型。

验收标准:
- Runner 不拼接 shell command string。
- Non-zero exit 不会被当成成功 JSON state。
- stderr 只作为诊断文本。

Definition of Done:
- Runner tests 覆盖 success 和全部错误类型。

验证命令:
- `npm test -- src/core`
- `npm exec tsc -- --noEmit`
- `cargo check --manifest-path src-tauri\Cargo.toml`

TDD plan:
- RED: 先写 runner error tests。
- GREEN: 实现 runner 和 errors。
- REFACTOR: 测试通过后再抽取 parsing helpers。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T002.yaml`

完成证据:
- RED/GREEN test outputs。
- Changed files。
- Diff summary。
- Residual risk。

#### T003: Implement Core JSON DTO Parsers And Fixtures

状态: Accepted
优先级: P0  
依赖: T002  
阻塞: T004, T005, T006, T007, T008  
需求映射: FR-001, FR-005, FR-006, FR-008, FR-009, FR-010, NFR-004  
并行: No  
冲突: T002

目标:
为所有 Desktop-facing Core JSON contracts 创建 DTO/parser modules 和 fixtures。

允许修改范围:
- `src/core/contracts/**`
- `src/core/fixtures/**`
- `src/core/contracts.test.ts`

测试目标:
- `src/core/contracts.test.ts`

交付内容:
- Host status、import、inventory、exposure、router dry-run、mount plan/apply/rollback、runs list、runs inspect parsers。
- 每个 surface 至少有成功 fixture；有意义时补充失败 fixture。

验收标准:
- Parser 校验 `schema_version`。
- Required fields 缺失时 fail closed。
- Fixtures 来自 documented Core contracts 或 fresh Core command outputs。

Definition of Done:
- DTO parser tests 通过。
- Parser 不读取本地 Core files。

验证命令:
- `npm test -- src/core`
- `npm exec tsc -- --noEmit`

TDD plan:
- RED: 先添加 fixture parser tests。
- GREEN: 实现 parsers。
- REFACTOR: 合并 schema guards。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T003.yaml`

完成证据:
- Fixture list。
- RED/GREEN test outputs。
- Diff summary。

## Epic E002：Tray Status And Dashboard Foundation

### Story US-001：Core Readiness

#### T004: Implement Tray Status State Model

状态: Accepted
优先级: P0  
依赖: T003  
阻塞: T005, T006, T007, T008  
需求映射: US-001, FR-001, FR-002, FR-004, NFR-002, NFR-003  
并行: No  
冲突: T005

目标:
从 Core command snapshots 计算 tray status，并在刷新失败时保留 last known state。

允许修改范围:
- `src/state/trayStatus.ts`
- `src/state/trayStatus.test.ts`
- `src/tray/**`

测试目标:
- `src/state/trayStatus.test.ts`

交付内容:
- 状态优先级：`core_missing`、`core_error`、`recent_failures`、`mount_not_configured`、`tools_exposed`、`capsules_disabled`、`no_capsules`。
- Stale snapshot 行为。
- 低频 refresh policy hooks。

验收标准:
- 每个状态记录 source command metadata。
- Refresh failure 不弹阻塞 modal。
- Tray 永不启动 Router。

Definition of Done:
- Status unit tests 覆盖 priority 和 stale behavior。

验证命令:
- `npm test -- src/state`
- `npm exec tsc -- --noEmit`

TDD plan:
- RED: 添加 status priority tests。
- GREEN: 实现 state model。
- REFACTOR: 保持 UI-independent logic 独立。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T004.yaml`

完成证据:
- Test results。
- Diff summary。
- Residual risk。

## Epic E003：Golden Path Dashboard

### Story US-002：Import Capsule

#### T005: Implement Import Flow And Capsule Review Entry

状态: Accepted
优先级: P0  
依赖: T004  
阻塞: T006, T007  
需求映射: US-002, FR-005, FR-011, NFR-001  
并行: No  
冲突: T006

目标:
允许选择 `.skr`，调用 Core import，并进入 capsule review；不得自动 enable 或 mount。

允许修改范围:
- `src/views/ImportFlow/**`
- `src/state/importFlow.ts`
- `src/state/importFlow.test.ts`
- `src/core/importService.ts`

测试目标:
- `src/state/importFlow.test.ts`

交付内容:
- `.skr` 文件选择流程。
- Import success state。
- Duplicate ID error handling。
- Safety copy：import 不是 trust、install、enable 或 mount。

验收标准:
- Success 显示 `enabled=false`。
- Import code 不展开 `.skr`。
- Post-import 不调用 enable 或 mount。

Definition of Done:
- Import state tests 通过 mock runner。

验证命令:
- `npm test -- src/state`
- `npm exec tsc -- --noEmit`

TDD plan:
- RED: 添加 import flow tests。
- GREEN: 实现 state/service/UI。
- REFACTOR: 抽取 reusable command status UI。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T005.yaml`

完成证据:
- RED/GREEN test outputs。
- UI screenshot if available。
- Diff summary。

### Story US-003：Review And Enable

#### T006: Implement Capsule Switchboard

状态: Accepted
优先级: P0  
依赖: T004  
阻塞: T007  
需求映射: US-003, FR-006, FR-007, FR-011, NFR-001  
并行: No  
冲突: T005, T007

目标:
展示 capsule inventory，并支持显式 enable/disable；状态变化后刷新 inventory 和 exposure。

允许修改范围:
- `src/views/Switchboard/**`
- `src/state/switchboard.ts`
- `src/state/switchboard.test.ts`
- `src/core/switchboardService.ts`

测试目标:
- `src/state/switchboard.test.ts`

交付内容:
- Capsule list。
- Readiness 和 enabled state display。
- Imported capsule enable/disable confirmation。
- 状态变化后的 refresh。

验收标准:
- `enabled=true` 只描述为 exposure intent。
- Readiness failure 不描述为 runnable。
- Enable failure 展示 Core error，不猜测修复。

Definition of Done:
- Switchboard state tests 通过。

验证命令:
- `npm test -- src/state/switchboard.test.ts --run`
- `npm exec tsc -- --noEmit`
- `npm run build`
- `npm test -- --run`

TDD plan:
- RED: 添加 enable/disable state tests。
- GREEN: 实现 switchboard state/service/UI。
- REFACTOR: 合并 capsule status labels。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T006.yaml`

完成证据:
- Test results。
- Copy review notes。
- Diff summary。

### Story US-004：Preview Exposure

#### T007: Implement Exposure Preview

状态: Accepted
优先级: P1  
依赖: T006  
阻塞: T008  
需求映射: US-004, FR-008, FR-011, NFR-003  
并行: No  
冲突: T006, T008

目标:
展示 Router 将暴露的 tools 和 resource metadata，但不得启动长运行 Router。

允许修改范围:
- `src/views/ExposurePreview/**`
- `src/state/exposure.ts`
- `src/state/exposure.test.ts`
- `src/core/exposureService.ts`

测试目标:
- `src/state/exposure.test.ts`

交付内容:
- Consumer exposure view。
- Router dry-run snapshot view。
- Disabled 或 not-ready capsules 的 empty state。

验收标准:
- Disabled capsules 不显示为 exposed。
- Not-ready capsules 不显示为 exposed。
- Preview 永不启动长运行 `router serve --mcp`。

Definition of Done:
- Exposure tests 通过。

验证命令:
- `npm test -- src/state/exposure.test.ts --run`
- `npm exec tsc -- --noEmit`
- `npm run build`
- `npm test -- --run`

TDD plan:
- RED: 添加 exposure filtering tests。
- GREEN: 实现 exposure preview。
- REFACTOR: 分离 lightweight exposure 和 router dry-run models。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T007.yaml`

完成证据:
- Test results。
- Diff summary。
- Residual risk。

## Epic E004：Mount And Evidence

### Story US-005：Mount Router

#### T008: Implement Claude Desktop Mount Manager

状态: Accepted
优先级: P0  
依赖: T007  
阻塞: T009  
需求映射: US-005, FR-009, FR-011, NFR-001  
并行: No  
冲突: T007, T009

目标:
为 Claude Desktop mount 提供 plan-first apply 和 Core-backed rollback。

允许修改范围:
- `src/views/MountManager/**`
- `src/state/mountManager.ts`
- `src/state/mountManager.test.ts`
- `src/core/mountService.ts`

测试目标:
- `src/state/mountManager.test.ts`

交付内容:
- Mount plan view。
- Apply confirmation flow。
- Backup path display。
- 使用 Core backup path 的 rollback confirmation flow。
- Unsupported clients 的 plan-only state。

验收标准:
- Plan 未加载前 apply disabled。
- Rollback 不能使用用户自造 backup path。
- Warnings 被展示且不被吞掉。
- UI 永不直接编辑 MCP client config。

Definition of Done:
- Mount manager tests 通过。

验证命令:
- `npm test -- src/state/mountManager.test.ts --run`
- `npm exec tsc -- --noEmit`
- `npm run build`
- `npm test -- --run`

TDD plan:
- RED: 添加 plan-before-apply tests。
- GREEN: 实现 mount state/service/UI。
- REFACTOR: 抽取 confirmation flow components。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T008.yaml`

完成证据:
- Test results。
- Copy review notes。
- Diff summary。

### Story US-006：Inspect Runs

#### T009: Implement Envelope Explorer Summary

状态: Accepted
优先级: P1  
依赖: T008  
阻塞: T010  
需求映射: US-006, FR-010, FR-011, NFR-001, NFR-003  
并行: No  
冲突: T008

目标:
从 Core JSON 展示 run list 和 safe inspect details，不读取 logs、full input 或 artifact content。

允许修改范围:
- `src/views/EnvelopeExplorer/**`
- `src/state/runs.ts`
- `src/state/runs.test.ts`
- `src/core/runsService.ts`

测试目标:
- `src/state/runs.test.ts`

交付内容:
- Runs list。
- Capsule filter。
- Run detail summary。
- Envelope status/value summary。
- Input/log/artifact availability metadata。

验收标准:
- 不直接读取 `.skillrun/runs`。
- 不展示 stdout/stderr content。
- 不打开 artifact content。
- Inspect failure 展示 Core error code 和 matches。

Definition of Done:
- Runs state tests 通过。

验证命令:
- `npm test -- src/state/runs.test.ts --run`
- `npm exec tsc -- --noEmit`
- `npm run build`
- `npm test -- --run`

TDD plan:
- RED: 添加 run summary 和 safe-inspect tests。
- GREEN: 实现 explorer state/service/UI。
- REFACTOR: 保持 content-viewer capability 在 alpha 范围外。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T009.yaml`

完成证据:
- Test results。
- Diff summary。
- Residual risk。

## Epic E005：Alpha Acceptance

### Story US-001-US-006：Golden Path

#### T010: Alpha Golden Path Verification

状态: Draft  
优先级: P0  
依赖: T009  
阻塞: None  
需求映射: US-001, US-002, US-003, US-004, US-005, US-006  
并行: No  
冲突: None

目标:
用 mock runner，并在安全时用隔离测试状态下的真实 Core commands，验证 tray-first `.skr` golden path。

允许修改范围:
- `src/**`
- `src-tauri/**`
- `.ai-platform/evidence/T010/**`

测试目标:
- Existing unit tests。
- 实现阶段选定的 end-to-end 或 integration test harness。

交付内容:
- Golden path evidence report。
- 可用时提供 screenshots 或 app verification evidence。
- Known limitations list。

验收标准:
- Tray status、import、enable、exposure、mount plan/apply confirmation 和 run inspect flows 均被覆盖。
- 所有状态变化都可追溯到 command metadata。
- 没有意外实现 alpha non-goal。

Definition of Done:
- Full validation commands 通过，或 failures 被记录为 blockers。
- QA acceptance review 无 blocking findings。

验证命令:
- `npm test`
- `npm run typecheck`
- `npm run build`

TDD plan:
- RED: 最终实现前添加 golden path acceptance test 或 scripted scenario。
- GREEN: 让 scenario 通过。
- REFACTOR: 只在 scenario green 后 polish。

Packet path:
- `.ai-platform/specs/001-desktop-alpha/packets/T010.yaml`

完成证据:
- Full command results。
- Golden path evidence。
- Diff summary。
- Residual risk。

## Approval Gate

本 work graph 已确认。`T001`-`T009` 已 accepted；其他 tasks 保持 `Draft`，按依赖逐个推进。
