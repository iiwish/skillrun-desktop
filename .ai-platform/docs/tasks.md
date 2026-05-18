# Desktop Alpha Task Index

**版本**：0.1.0  
**状态**：Confirmed  
**最后更新**：2026-05-18  
**审核记录**：随 `.ai-platform/specs/001-desktop-alpha/tasks.md` 于 2026-05-18 获得批准。

## 当前 Feature Work Graph

- Feature：`001-desktop-alpha`
- Work graph：`.ai-platform/specs/001-desktop-alpha/tasks.md`
- 状态：`Confirmed`
- 可执行 tasks：T001 已通过 review 和用户 acceptance，下一步进入 T002 packetize。

## Global Task Index

### T001: Scaffold Tauri Tray App Shell

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

## 当前闸门

`T001` 已完成 direct execution，并于 2026-05-18 通过用户接受。其他 task 保持 `Draft`。

## 下一步建议

下一步进入 T002 Packetize Mode，输入文档：

- `.ai-platform/memory/constitution.md`
- `.ai-platform/specs/001-desktop-alpha/plan.md`
- `.ai-platform/specs/001-desktop-alpha/tasks.md`

Analyze Mode 已完成且无 Critical/High findings。`T001` 已生成 packet 和 evidence，并已 accepted；`T002` 仍需生成 execution packet 后才能执行。
