# Technology Decision Record：Desktop Alpha

**版本**：0.1.0  
**状态**：Confirmed  
**最后更新**：2026-05-18  
**审核记录**：随 `.ai-platform/specs/001-desktop-alpha/plan.md` 于 2026-05-18 获得批准。

## 决策摘要

采用 `.ai-platform/specs/001-desktop-alpha/plan.md` 作为 Desktop Alpha 的控制性技术架构记录。

## 决策列表

- `D-001`：使用 Tauri tray-first shell。
- `D-002`：Core CLI JSON 是唯一 Core API。
- `D-003`：先建 parser fixtures，再做完整 UI。
- `D-004`：先用 mock runner，再接真实 runner。
- `D-005`：Router lifecycle 不归 Desktop 管。
- `D-006`：危险动作只能在 Dashboard 中确认。

## Review Status

本 TDR 已确认。后续实现仍需逐 task execution packet 和 validation evidence。
