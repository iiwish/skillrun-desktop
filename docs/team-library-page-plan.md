# SkillRun Desktop Team Library Page Plan

**状态**：Guarded_Apply_Implementation
**日期**：2026-05-27
**依赖**：`skillrun` Core `team catalog inspect`、`install plan`、本地 `file` source `install apply` 已落地；HTTPS download 仍等待 Core 显式 downloader

## 一句话判断

Team Library 是 Desktop 的团队能力库入口：让成员浏览团队 catalog、复核 `.skr` 来源和影响、显式安装或更新、再进入现有 Capsule / Exposure / Mount / Runs 主线。它不是 marketplace，也不是 Desktop 自己的 installer 或 trust layer。

## Product Intent

Team Library 要降低“团队分发 MCP tools 和 Agent Skills”的理解成本，但不能改变 SkillRun 的边界：

- 用户看到的是团队能力、版本、来源、requirements、permissions summary 和 warnings。
- Desktop 展示 Core 返回的 inspect / plan / apply 结果。
- `.skr` 仍是底层分发 artifact。
- 导入后仍回到现有 Capsule 工作台：复核、显式 enable、预览 exposure、显式 mount、查看 run evidence。

## Navigation

Team Library 应作为主导航中的一等页面，但位置应克制：

```text
Capsule
Team Library
客户端
暴露
记录
设置
```

原因：

- Capsule 仍是默认本地控制台。
- Team Library 是团队分发入口，不是替代 Capsule 管理。
- 客户端、暴露、记录仍是安装后的后续路径。

中文标签建议：`团队库`。英文标签建议：`Team Library`。

## Page Hierarchy

页面采用 Linear 风格的三栏工作面，而不是营销页或卡片墙：

```text
Header toolbar
  Catalog selector / Refresh / Search / filter

Catalog column
  Catalog status
  Source freshness
  Warning summary

Items table
  Name
  Kind
  Version
  Source
  Installed state
  Warnings

Inspector rail
  Selected item detail
  Requirements
  Permissions summary
  Source checksum
  Plan result
  Primary action
```

视觉原则：

- 保持现有 Desktop 的紧凑产品 UI，不做 marketplace tile grid。
- 用表格 / 列表支持扫描，不用大图、hero、decorative illustration。
- warnings、checksum、requirements 放在 inspector 中，避免列表变得噪声过高。
- Primary action 必须跟随 Core plan 状态，不在 inspect-only 阶段显示可执行 install。

## Core Surface Dependency

Team Library 只允许调用 Core 暴露的 JSON surface。当前这些命令仍是 Core 草案，Desktop 不能先行实现：

```text
skillrun team catalog inspect <catalog> --json
skillrun team catalog status <catalog> --json
skillrun team catalog install plan <catalog> <item-id> --json
skillrun team catalog install apply <catalog> <item-id> --json
```

Desktop DTO 必须跟随 Core 命令冻结 fixture，不能从 catalog 文件自行解析并执行安装逻辑。

## Data Model For UI

Desktop 内部页面状态可以抽象为：

```ts
type TeamLibraryItemState =
  | "display_only"
  | "not_installed"
  | "installed_current"
  | "replace_available"
  | "blocked";
```

映射原则：

- `kind = "skillrun.skr"` 才可能进入 install / update。
- `agent.skill` 和 `mcp.server` 可以展示为 `display_only`，不能出现 install/apply 按钮。
- `status` 输出的 `missing` / `installed` / `replace_available` / `blocked` 是列表和 inspector 的状态来源。
- `replace_available` 只表示 Core 可以生成 guarded replace plan，不代表已证明远端有新版本。
- `https` source 缺少 checksum 必须展示为 blocked。
- registry 中同 id 为 `local_path` 时必须展示为 conflict，不能覆盖。
- Core plan 返回 warning 时，主按钮仍可显示，但必须保留确认步骤。

## User Flow

### 1. Inspect Catalog

用户选择或输入 catalog source 后：

```text
Desktop
  -> skillrun team catalog inspect <catalog> --json
  -> skillrun team catalog status <catalog> --json
  -> catalog summary + items
  -> installed / replace_available / blocked status
```

UI 行为：

- 显示 catalog id、name、updated_at 和 item count。
- 显示 schema unsupported / invalid / read failed。
- 不下载 `.skr`。
- 不读取 `.skillrun/`。
- 不把 checksum 展示为 trust proof。

### 2. Review Item

用户选择 item 后，右侧 inspector 展示：

- name / description / version / kind。
- publisher display fields。
- source type / URL / sha256。
- requirements。
- permissions summary。
- MCP exposure hint。
- trust note。
- warnings。

对于 `agent.skill` / `mcp.server`：

- 展示为团队共享能力。
- Primary action 使用 disabled 状态，例如 `等待 Core 支持`。
- 不允许运行本地命令、clone、install package 或 mount。

### 3. Install Plan

用户点 `检查安装计划` 后：

```text
Desktop
  -> skillrun team catalog install plan <catalog> <item-id> --json
  -> show import / replace / conflict / warning
```

UI 行为：

- 展示将要 import 还是 replace。
- 展示 registry installed state。
- 展示 checksum / source warnings。
- replace 时必须二次确认。
- conflict 时只展示 blocked，不提供绕过按钮。

### 4. Install Apply

用户确认后：

```text
Desktop
  -> skillrun team catalog install apply <catalog> <item-id> --json
  -> navigate to Capsule page
```

UI 行为：

- apply 只能由用户显式确认触发。
- 成功后跳转到 Capsule 页面并选中新 capsule。
- 后续 action 用现有页面完成：enable、exposure preview、mount、runs。
- 不自动 enable。
- 不自动 mount。
- 不自动安装依赖。
- 不运行 action、test、validate 或 MCP server。
- 当前 Desktop 只消费 Core apply 结果；若 Core 对 `https` source fail closed，Desktop 只展示错误，不自行下载。

## Empty, Loading, Error States

必须覆盖以下状态：

- Core command not implemented：显示 Team Library 需要 Core `team catalog` surface，不能提供假流程。
- No catalog configured：提供 catalog source 输入或后续设置入口。
- Catalog loading：保持表格尺寸稳定，显示 skeleton row。
- Catalog invalid：展示 Core error code、message 和 stderr 摘要。
- Empty catalog：展示空表格和 catalog metadata。
- Display-only item：展示原因，不出现 install。
- Plan conflict：展示 conflict reason 和 Core error code。
- Apply failed：保留 plan 结果和 selected item，不假设部分安装成功。

## Copy Rules

可以使用：

- `安装到本机 registry`
- `检查安装计划`
- `更新已导入 Capsule`
- `checksum verified`
- `团队提供的 trust note`

不能使用：

- `trusted`
- `safe`
- `sandboxed`
- `verified publisher`
- `auto install dependencies`
- `marketplace`
- `one-click publish`

中文安全文案建议：

> Team Library 只展示团队 catalog 和 Core 计划。安装 `.skr` 不代表可信、沙箱或依赖已安装；启用和挂载仍需要你显式确认。

## Implementation Sequence

### PR 1: Contract Stubs After Core Inspect Lands

- 增加 `team.catalog.inspect.v1` parser fixture。
- 增加 `teamLibraryService` read-only load 方法。
- 不新增 install/apply UI。

状态：已完成。

### PR 2: Read-Only Team Library Page

- 增加主导航 `团队库`。
- Catalog selector + item table + inspector。
- 支持 loading / empty / invalid / display-only states。
- 只调用 `inspect`。

状态：已完成。

### PR 3: Install Plan

- 增加 `team.catalog.install_plan.v1` parser fixture。
- 增加 plan 按钮和 inspector plan panel。
- conflict / warning / replace confirmation 先可视化。
- 不调用 apply。

状态：已完成。

### PR 4: Guarded Apply

- 增加 `team.catalog.install_apply.v1` parser fixture。
- 用户确认后调用 apply。
- 成功后跳转 Capsule page。
- 刷新 inventory / exposure。

状态：已完成 UI / parser / service / state 接入；真实 Core smoke 可在具备本地 file-source catalog fixture 后补强。

### PR 5: Team Library Smoke

- 在 real Core smoke 中增加最小 catalog fixture。
- 覆盖 inspect -> plan -> apply -> inventory -> enable -> exposure。
- 仍不自动 mount、不安装依赖。

## Acceptance Gates

- Desktop 没有直接读取 `.skillrun/`。
- Desktop 没有自行下载、解包或复制 `.skr`。
- Desktop 没有对 `agent.skill` / `mcp.server` 执行本地命令。
- 所有 install / update 行为都可追溯到 Core command trace。
- Apply 前有 plan，replace 前有二次确认。
- 安装成功后仍默认 disabled。
- UI 文案不把 checksum、enabled、readiness、exposed 或 mounted 表达为 trust / safety / sandbox。
- 中英文文案均不溢出主导航、toolbar、table row 和 inspector。

## Open Questions

- Team Library catalog source 应先放在页面本地输入，还是进入 Settings 管理多个 catalog？
- Core 命令最终是 `team catalog ...` 还是更短的 `catalog ...`？
- file source 缺少 checksum 时，Desktop 是否只允许 inspect / plan，不允许 apply？
- 是否需要 catalog item 的 `default_client_mount`，还是继续让用户在 Mount Manager 里选择 client？
