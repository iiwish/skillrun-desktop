# SkillRun Desktop

SkillRun Desktop 是 [SkillRun](https://github.com/iiwish/skillrun) 的桌面端消费者控制平面（consumer control plane），采用 **tray-first** 设计，让用户可以通过图形界面管理 Skill Capsule 的导入、挂载、运行和状态查看。

## 与 SkillRun 的关系

- **[SkillRun](https://github.com/iiwish/skillrun)**（`/Users/iiwish/self/skillrun`）是核心 Rust CLI / 运行时，负责 Skill Capsule 的构建、检查、打包、执行和 MCP 暴露。
- **SkillRun Desktop**（本项目）是 SkillRun 的桌面端封装。Desktop 不直接操作 `.skillrun/` 内部文件或解析 Manifest，而是将 `skillrun` CLI 作为唯一的 Core API 来调用（`skillrun <command> --json`），通过解析其 stdout JSON 来驱动 UI。

## 技术栈

- **前端**：React + Vite + TypeScript
- **桌面框架**：Tauri v2（Rust）
- **运行时依赖**：`skillrun` CLI

## 快速开始

### 0. 试用 alpha 安装包

`desktop-v0.1.0-alpha.4` 已发布为公开 prerelease，用于验证 Desktop 打包和本地消费者控制台路径：

<https://github.com/iiwish/skillrun-desktop/releases/tag/desktop-v0.1.0-alpha.4>

注意：

- 这是 prerelease，不是 stable/latest。
- macOS app 当前未签名、未 notarize，首次启动时可能出现系统安全提示。
- Desktop 不捆绑或安装 `skillrun` Core CLI、Python、Node、npm、pip package 或 action 依赖。
- 使用安装包前仍需先安装并验证 `skillrun` Core CLI；开发和调试仍推荐使用下面的源码路径。
- alpha.4 重点验证设置页 Core 诊断、Core CLI 安装引导、Team Library 空态 / blocked 态，以及 Router diagnostics 在 Settings / Exposure / 状态栏之间的入口关系。

### 1. 安装前端依赖

```bash
npm install
```

### 2. 安装本地 skillrun CLI

开发时建议使用与本地 Core 仓库对应的 CLI 版本：

```bash
SKILLRUN_CORE_PATH=/Users/iiwish/self/skillrun npm run skillrun:install-local
```

该命令会编译并安装 `skillrun` 二进制文件到 `~/.cargo/bin/`。

### 3. 启动开发模式

```bash
# 同时启动 Vite 前端 dev server 和 Tauri 桌面窗口
npm run tauri dev
```

前端 dev server 默认运行在 `http://localhost:1420`，Tauri 会自动唤起桌面窗口。

如果只想启动前端（不启动 Tauri 桌面壳）：

```bash
npm run dev
```

### 4. 构建生产包

```bash
npm run tauri build
```

## CLI

SkillRun Desktop 依赖的 CLI 就是 **`skillrun`**。常用命令：

```bash
skillrun --version              # 查看版本
skillrun doctor --json          # 检查环境状态
skillrun consumer inventory --json      # 查看已导入的 capsules
skillrun consumer exposure --json       # 查看 MCP 暴露状态
skillrun router status --json           # 查看 Router route / issue 诊断
```

Desktop 内部通过子进程调用这些命令并消费 JSON 输出来驱动界面。

## Smoke 测试

常规 Desktop 验证：

```bash
npm test -- --run
npm run build
cd src-tauri && cargo check
```

真实 Core 闭环 smoke：

```bash
npm run smoke:real-core
```

Hero SKR + Desktop shell smoke：

```bash
SKILLRUN_CLI=/Users/iiwish/self/skillrun/target/debug/skillrun \
npm run smoke:hero-desktop
```

默认 smoke 会在缺少本地 catalog 时调用相邻 Core 仓库的
`scripts/generate-desktop-hero-catalog.sh`，生成
`/Users/iiwish/self/skillrun/target/desktop-hero-skr/catalog.json`，并验证
`command_hello` 的 Team Catalog
`inspect -> install plan -> install apply -> inventory -> enable -> exposure -> router status -> router dry-run`。
`command_hello` 是低摩擦默认入口，只要求系统中存在 `python3` 命令，不要求
pydantic。

如需验证产品 hero，可显式切换到 `meeting_action_brief` 并准备 Python 3.13+
和 pydantic 2.x：

```bash
/opt/homebrew/bin/python3.13 -m venv /tmp/skillrun-hero-py313
/tmp/skillrun-hero-py313/bin/python -m pip install -U pip pydantic

PATH=/tmp/skillrun-hero-py313/bin:$PATH \
SKILLRUN_CLI=/Users/iiwish/self/skillrun/target/debug/skillrun \
SKILLRUN_HERO_ITEM=meeting_action_brief \
npm run smoke:hero-desktop
```

上面的 venv 只用于 smoke，不会改系统 Python。Desktop 应用内的 Settings 也提供
Runtime bin 目录设置，可把已创建的 venv `bin` / `Scripts` 目录临时 prepend 到
Core 子进程 `PATH`，便于处理缺 Python / pydantic 的 readiness 阻塞；Desktop
仍不会自动下载、安装依赖或执行 installer。如果本机有 Chrome，脚本还会启动临时
Vite server，通过 Chrome DevTools Protocol 检查 Desktop shell 在桌面和窄屏视口下包含关键中文文案、Team Library 可切换且没有水平溢出。设置
`SKILLRUN_DESKTOP_UI_SMOKE=0` 可以只跑 Core hero 链路。
