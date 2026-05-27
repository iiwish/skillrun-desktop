# SkillRun Desktop Core Contract

**状态**：Ready_For_Desktop_Alpha_Implementation  
**日期**：2026-05-18  
**适用范围**：`skillrun-desktop` tray-first alpha 阶段调用 SkillRun Core 的稳定边界

## 一句话判断

Desktop alpha 必须把 `skillrun` CLI JSON 当成唯一 Core API：UI 可以编排、确认和展示，但不得读取 `.skillrun/` 内部文件、解析 Manifest YAML、展开 `.skr`、直接执行 action 或自行修改 MCP client 配置。

## Contract Model

Desktop 对 Core 的调用模型只有一种：

```text
Tauri tray / window
  -> Desktop CLI runner
  -> skillrun <command> --json
  -> parse stdout JSON
  -> map to Desktop DTO
```

执行约束：

- 使用参数数组启动 `skillrun`，不要拼接 shell command string。
- `stdout` 是结构化数据源；`stderr` 只用于失败诊断。
- 非零 exit code 视为命令失败，不从半截输出推断状态。
- JSON parse 失败视为 Desktop adapter bug 或 Core contract mismatch。
- Desktop 内部可以包一层 runner result，例如 `{ ok, command, exit_code, stdout_json, stderr_text, duration_ms }`，但这不是 Core contract。
- 除用户选择的 `.skr` 文件路径和 MCP client config path override 外，Desktop 不应直接读写 Core 内部路径。

托盘约束：

- 托盘可以周期性刷新短跑状态，但默认刷新必须低频、可暂停、可手动触发。
- 托盘不得自动运行 `skillrun router serve --mcp`。
- 托盘不得自动 import、enable、mount apply 或 rollback。
- 托盘菜单只能发起显式用户动作，例如 Open Dashboard、Import、Refresh、Mount Manager、Quit。

## 0. Tray Status

### Commands

```text
skillrun doctor --json
skillrun consumer inventory --json
skillrun consumer exposure --json
skillrun consumer mount plan --client claude-desktop --json
skillrun consumer runs list --json --limit <n>
```

### UI States

- `core_missing`：找不到 `skillrun` 或无法启动。
- `core_error`：Core 命令失败。
- `no_capsules`：inventory 为空。
- `capsules_disabled`：存在 capsule，但 exposure 为空。
- `tools_exposed`：Router snapshot 将暴露至少一个 tool。
- `mount_not_configured`：mount plan 显示需要配置。
- `recent_failures`：最近 runs 中存在失败记录。

### UI Rules

- 托盘状态必须来自 Core JSON 或命令失败结果。
- 托盘状态可以合并多个 Core surfaces，但每个状态都要能追溯到最后一次命令。
- 托盘点击打开 Dashboard，危险动作进入窗口确认，不在菜单里直接执行。

### Forbidden

- 不用托盘进程常驻 Router。
- 不在托盘菜单里做 one-click enable imported capsule。
- 不在托盘菜单里做 one-click mount apply。
- 不把“托盘运行中”展示成“SkillRun 正在保护你”。

## 0.1 Long-Running Process Boundary

Desktop alpha 只允许两类 Core 进程：

- 短跑命令：import、inventory、exposure、mount plan/apply/rollback、runs list/inspect、check、doctor。
- MCP runtime：`skillrun router serve --mcp`，由 MCP client 配置启动，不由 Desktop 托盘后台默认启动。

如果后续需要 Desktop 管理 Router 进程，必须先在 Core 增加明确 daemon/local API contract；alpha 不做这个跨越。

## 1. Import Flow

### Command

```text
skillrun import <package.skr> --json
```

可选高级参数：

```text
skillrun import <package.skr> --id <id> --json
skillrun import <package.skr> --to <dir> --json
```

### Required JSON Fields

```json
{
  "command": "import",
  "schema_version": "import.v1",
  "ok": true,
  "package_path": "...",
  "registry_path": "...",
  "capsule": {
    "id": "...",
    "path": "...",
    "source_type": "imported_skr",
    "enabled": false
  },
  "warnings": []
}
```

### UI Rules

- 成功后跳转到 capsule detail 或 switchboard。
- 默认展示为 disabled。
- 不自动 enable。
- 不自动 mount。
- 不展示为 trusted、safe 或 sandboxed。

### Forbidden

- Desktop 不得自行解包 `.skr`。
- Desktop 不得读取 package 内的 Manifest 来决定是否导入成功。
- Desktop 不得把 import 失败降级成“部分导入成功”。

## 2. Capsule Switchboard

### Command

```text
skillrun consumer inventory --json
skillrun switchboard enable <id>
skillrun switchboard disable <id>
```

`switchboard list --json` 可用于兼容旧 switchboard 视图，但 Desktop 首屏优先使用 `consumer inventory --json`。

### Required JSON Fields

```json
{
  "command": "consumer inventory",
  "schema_version": "consumer.inventory.v1",
  "version": 1,
  "registry_path": "...",
  "capsules": [
    {
      "id": "...",
      "path": "...",
      "source_type": "local_path",
      "enabled": true,
      "registered_at": "...",
      "manifest": {
        "path": ".skillrun/manifest.generated.yaml",
        "present": true,
        "freshness": "fresh"
      },
      "skill": {
        "name": "..."
      },
      "runtime": {
        "adapter": "python",
        "entrypoint": "action.py"
      },
      "tool": {
        "name": "..."
      },
      "readiness": {
        "ok": true,
        "status": "ok",
        "next_step": "none"
      }
    }
  ]
}
```

### UI Rules

- `enabled=true` 只表示“允许被 Router 暴露的本地意图”。
- `readiness.ok=false` 的 capsule 不能被描述为 runnable。
- enable/disable 后必须刷新 inventory 和 exposure。
- enable 前建议展示确认，尤其是 `source_type=imported_skr`。

### Forbidden

- 不读取 registry 文件。
- 不读取 `.skillrun/manifest.generated.yaml`。
- 不把 enabled 展示为 trusted。
- 不把 readiness 展示为 sandbox guarantee。

## 3. Capsule Detail And Readiness

### Command

```text
skillrun registry inspect <id> --json
skillrun check --json --cwd <capsule>
skillrun doctor --json --cwd <capsule>
```

### UI Rules

- `registry inspect` 用于展示单个 capsule 的 Core 视图。
- `check` 和 `doctor` 只在用户主动诊断时调用。
- `<capsule>` 路径只能来自 Core 返回或用户明确选择，不从 Desktop 自己扫描目录得到。

### Forbidden

- 不直接读取 capsule 文件来重建 readiness。
- 不执行 action source 来验证 readiness。
- 不自动安装依赖。

## 4. Exposure Preview

### Command

```text
skillrun consumer exposure --json
skillrun router serve --mcp --dry-run
```

### Required JSON Fields

`consumer exposure --json`：

```json
{
  "command": "consumer exposure",
  "schema_version": "consumer.exposure.v1",
  "registry_path": "...",
  "tools": [
    {
      "capsule_id": "...",
      "tool_name": "...",
      "enabled": true,
      "exposed": true,
      "readiness_status": "ok",
      "manifest_hash": "..."
    }
  ]
}
```

`router serve --mcp --dry-run`：

```json
{
  "command": "router serve --mcp",
  "schema_version": "router.mcp.v1",
  "mcp": {
    "dry_run": true,
    "transport": "stdio",
    "protocol": "model-context-protocol"
  },
  "router": {
    "snapshot": true,
    "capsules": 1
  },
  "tools": [],
  "resources": []
}
```

### UI Rules

- `consumer exposure` 适合 Switchboard 旁边的轻量预览。
- `router --dry-run` 适合 Mount Manager 预检。
- disabled 或 readiness failed 的 capsule 不应显示为 exposed。
- Router dry-run 的 resources 只展示 metadata。

### Forbidden

- 不从 MCP text content 反解析 UI 数据。
- 不在 preview 页面启动长运行 Router。
- 不把 `.skr` 或 capsule path 当成 MCP client 挂载入口。

## 5. MCP Mount Manager

### Command

```text
skillrun consumer mount plan --client <id> --json
skillrun consumer mount apply --client claude-desktop --json
skillrun consumer mount rollback --client claude-desktop --backup <path> --json
```

可选高级参数：

```text
skillrun consumer mount plan --client <id> --config <path> --json
skillrun consumer mount apply --client claude-desktop --config <path> --json
skillrun consumer mount rollback --client claude-desktop --config <path> --backup <path> --json
```

### Required JSON Fields

Plan：

```json
{
  "command": "consumer mount plan",
  "schema_version": "consumer.mount_plan.v1",
  "client": {
    "id": "claude-desktop",
    "name": "Claude Desktop",
    "supported": true,
    "detected": true
  },
  "operation": "plan",
  "config": null,
  "backup": null,
  "router": {
    "server_name": "skillrun",
    "command": "skillrun",
    "args": ["router", "serve", "--mcp"]
  },
  "changes": [],
  "warnings": []
}
```

Apply：

```json
{
  "command": "consumer mount apply",
  "schema_version": "consumer.mount_apply.v1",
  "client": {},
  "config": {},
  "backup": null,
  "applied": true,
  "changes": [],
  "warnings": []
}
```

Rollback：

```json
{
  "command": "consumer mount rollback",
  "schema_version": "consumer.mount_rollback.v1",
  "client": {},
  "config": {},
  "backup": {},
  "rolled_back": true,
  "warnings": []
}
```

### UI Rules

- 所有 apply 前必须先显示 plan。
- Apply 和 rollback 都必须有用户确认。
- 首版只对 `claude-desktop` 开启 apply。
- 对 Cursor 等 plan-only client，UI 必须保持 plan-only。
- Rollback 只接受 Core 返回的 backup path。

### Forbidden

- Desktop 不得自行修改 MCP client 配置。
- Desktop 不得自行生成 rollback backup。
- Desktop 不得把 mount apply 描述为 dependency install。
- Desktop 不得吞掉 warnings。

## 6. Envelope Explorer

### Command

```text
skillrun consumer runs list --json
skillrun consumer runs list --json --capsule <id> --limit <n>
skillrun consumer runs inspect <run-id> --json --capsule <id>
```

### Required JSON Fields

List：

```json
{
  "command": "consumer runs list",
  "schema_version": "consumer.runs.list.v1",
  "registry_path": "...",
  "scope": {
    "kind": "all",
    "capsule_id": null
  },
  "runs": []
}
```

Inspect：

```json
{
  "command": "consumer runs inspect",
  "schema_version": "consumer.runs.inspect.v1",
  "registry_path": "...",
  "ok": true,
  "run_ref": {},
  "capsule": {},
  "record": {},
  "input": {
    "included": false,
    "available": true
  },
  "envelope": {
    "included": true,
    "status": "ok",
    "value": {}
  },
  "artifacts": [],
  "logs": {
    "stdout_available": false,
    "stderr_available": false,
    "stdout_included": false,
    "stderr_included": false
  },
  "warnings": []
}
```

### UI Rules

- 首版展示 run summary、status、duration、mode、error code、hash、artifact metadata 和 log availability。
- 默认不展示完整 input。
- 默认不展示 stdout/stderr 内容。
- 默认不打开 artifact content。
- inspect 失败时展示 Core 返回的 error code 和 matches，不从文件系统猜测。

### Forbidden

- 不直接读取 `.skillrun/runs`。
- 不直接读取 `record.json`。
- 不直接打开 stdout/stderr log。
- 不直接打开 artifacts。

## 7. Team Library

**状态**：Guarded_Apply_Implemented

Team Library 是团队 catalog 的受控浏览和安装入口。Desktop 当前只允许消费 Core `inspect`、`install plan` 和用户显式确认后的 `install apply` surface；不得自行实现 catalog install/update 语义。

### Commands

```text
skillrun team catalog inspect <catalog> --json
skillrun team catalog install plan <catalog> <item-id> --json
skillrun team catalog install apply <catalog> <item-id> --json
```

### UI Rules

- `inspect` 只用于展示 catalog 和 item summary。
- 页面调用 `inspect` 展示 catalog 和 item summary。
- plan 面板调用 `install plan` 展示 import / replace / conflict / warning。
- `install apply` 必须由用户确认后触发。
- apply 成功后跳转到 Capsule 页面，由现有 Switchboard / Exposure / Mount / Runs 页面继续后续路径。
- 如果 Core apply 对 source fail closed，例如当前 `https` source 尚无 downloader，Desktop 只展示 Core 错误，不自行下载。
- `kind = "skillrun.skr"` 才可能进入 install / update。
- `agent.skill` 和 `mcp.server` item 只能作为 display-only item，直到 Core 明确支持。

### Forbidden

- 不直接读取 `.skillrun/` 私有目录。
- 不自行下载 `.skr`。
- 不自行解包 `.skr`。
- 不直接解析 catalog 后调用 `skillrun import` 绕过 Core plan/apply。
- 不对 plain Agent Skill 或 MCP server item 执行本地命令。
- 不把 checksum 展示为 trust proof。
- 不自动 enable、mount、安装依赖或启动 MCP server。

## Error Handling

Desktop 必须按以下顺序处理失败：

1. 进程启动失败：提示 `skillrun` 不可用或路径错误。
2. 非零 exit code：展示 command、exit code、stderr 摘要。
3. JSON parse 失败：展示 contract mismatch，不继续推断。
4. `ok=false` JSON：展示 Core 返回的 error code、message、warnings。
5. 状态刷新失败：保留最后一次成功快照，并标注 stale。

托盘错误额外规则：

- 托盘刷新失败不得弹出阻塞式对话框。
- 托盘只显示降级状态；详细错误进入 Dashboard。
- 连续失败应降低刷新频率，避免后台刷屏。

常见错误语义：

- `registry id already exists`：提示用户改名或移除旧 capsule。
- `readiness.ok=false`：不能 enable 或不能 expose。
- unsupported mount client：保持 preview-only。
- rollback conflict：不要覆盖用户现有配置，提示需要手动处理。

## Security And Trust Copy

Desktop 必须使用诚实文案：

- imported 不是 trusted。
- enabled 不是 safe。
- exposed 不是 sandboxed。
- mounted 不是 dependency installed。
- readiness ok 不是业务正确性保证。
- SkillRun 的消费安全来自 Manifest-driven exposure、显式 enable、plan/apply/rollback、run evidence，而不是完整 sandbox。

## Real Core Smoke Harness

Desktop 仓库提供独立真实 Core smoke 命令：

```bash
npm run smoke:real-core
```

该命令使用临时 `SKILLRUN_HOME`、临时 `HOME` 和临时 `XDG_CONFIG_HOME`，默认不读取或写入用户真实 `~/.skillrun`。smoke 通过 Desktop 的 `runSkillrunJson` 跑真实 `skillrun` JSON surface，并执行最小闭环：

```text
host status --json
  -> init --js
  -> manifest
  -> pack
  -> import --json
  -> consumer inventory --json
  -> switchboard enable
  -> consumer exposure --json
```

失败输出必须包含命令 trace，并区分缺少 CLI、Core 命令失败、JSON mismatch 或环境 blocker。

## Alpha Golden Path

Desktop alpha 的最低验收链路：

```text
选择 .skr
  -> skillrun import --json
  -> inventory 显示 imported_skr + enabled=false
  -> exposure 为空
  -> 用户 enable
  -> exposure 和 router dry-run 显示 tool
  -> mount plan 显示 skillrun router serve --mcp
  -> 用户 apply Claude Desktop
  -> Agent 通过 Router 调用 tool
  -> runs list 出现记录
  -> runs inspect 展示 envelope evidence
```

Tray-first 版本的入口是：

```text
Tray says Core ready / no capsules
  -> Open Dashboard
  -> follow the golden path above
  -> Tray says tools exposed / recent runs ok
```

如果这条链路不顺，Desktop 不应先做 marketplace、官方包浏览、daemon 或复杂权限 UI。

## Out Of Scope

Alpha 阶段不做：

- package marketplace。
- signed trust store。
- dependency installer。
- daemon API。
- Router hot reload。
- multi-client apply。
- artifact content viewer。
- stdout/stderr content viewer。
- input include/redaction policy。
- official package update semantics。
- Desktop 自己的 registry、manifest 或 run history。

## Next Actions

1. 在 desktop 项目中实现 CLI runner：参数数组调用、超时、stdout JSON parse、stderr capture、统一错误类型。
2. 为上述 JSON surfaces 建 TypeScript DTO，并用固定 fixture 做 parser test。
3. 按 Import Flow、Switchboard、Exposure Preview、Mount Manager、Envelope Explorer 的顺序做 alpha 页面。
