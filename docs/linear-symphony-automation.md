# Linear + Symphony Automation Playbook

This project can enter an autonomous optimization loop with two jobs:

1. An issue factory that audits the repository and writes scoped Linear issues.
2. A Symphony worker that polls Linear, creates isolated workspaces, and lets
   Codex implement one issue at a time.

## Current Local Baseline

- Repository: `https://github.com/iiwish/skillrun-desktop.git`
- Frontend dependencies: installed with `npm install`
- `npm test -- --run`: passing, 57 tests
- `npm run build`: passing
- `cd src-tauri && cargo check`: passing
- `skillrun` CLI: install from the upstream Core repository with
  `npm run skillrun:install-local`, then verify with
  `npm run skillrun:verify-local`

## macOS Local Core CLI

Desktop and Symphony workers expect the real Core CLI to be available as
`skillrun` without embedding a Core checkout path in frontend code. For local
macOS development, install the Core CLI from the upstream repository into
Cargo's bin directory:

```bash
cargo install --git https://github.com/iiwish/skillrun --locked --force
```

The repository helper runs that install and verifies the resulting binary:

```bash
npm run skillrun:install-local
```

Use `SKILLRUN_CORE_PATH=/path/to/skillrun npm run skillrun:install-local` only
when intentionally validating an active Core checkout, for example
`/Users/iiwish/self/skillrun` during local Core development. The verification
command checks that `which skillrun` resolves to Cargo's bin directory and that
`skillrun --version` is available. When `SKILLRUN_CORE_PATH` is set, it also
checks that the installed version and Cargo install record match that checkout:

```bash
which skillrun
skillrun --version
npm run skillrun:verify-local
SKILLRUN_CORE_PATH=/Users/iiwish/self/skillrun npm run skillrun:verify-local
```

The Tauri bridge still starts `skillrun` through an argument-array process call.
On macOS it also checks `~/.cargo/bin/skillrun` when the app process does not
inherit a shell `PATH`, and `SKILLRUN_CLI_PATH` can override the binary for
nonstandard local setups.

## Linear Setup

Create or choose a Linear project for this repository, for example:

```text
SkillRun Desktop Alpha Automation
```

Recommended workflow states:

- Backlog
- Todo
- In Progress
- Human Review
- Rework
- Merging
- Done

Recommended labels:

- `ai-generated`
- `symphony`
- `desktop-alpha`
- `frontend`
- `tauri`
- `test`
- `docs`
- `blocked-env`

## Symphony Setup

1. Get a Linear personal API key.
2. Confirm the Linear project slug from the project URL. This workspace is
   currently configured for:

```yaml
project_slug: "skillrun-68dab379d537"
```

3. Start Symphony from the Symphony repository:

```bash
cd /Users/iiwish/Documents/Codex/2026-05-19/openai-symphony-https-github-com-openai/elixir
export LINEAR_API_KEY="..."
mise exec -- ./bin/symphony --port 4000 /Users/iiwish/self/skillrun-desktop/symphony/WORKFLOW.md
```

4. Put selected Linear issues into `Todo`. Symphony will claim them and create
   workspaces under `~/code/skillrun-desktop-workspaces`.

The workflow uses Codex `danger-full-access` because autonomous workers must be
able to write Git metadata for branch creation, commits, pushes, and PR handoff.
Keep `max_concurrent_agents` low until the loop is consistently reliable.

## Issue Factory Prompt

Use this prompt in Codex when you want AI to create Linear issues from the
current repository state:

```text
Audit /Users/iiwish/self/skillrun-desktop for desktop-alpha readiness.

Create Linear issues in the SkillRun Desktop Alpha Automation project. Each
issue must be small enough for one autonomous Symphony worker run.

Rules:
- Use labels: ai-generated, symphony, desktop-alpha, plus the relevant area.
- Start issues in Backlog unless I explicitly ask to queue them in Todo.
- Each issue must include Context, Scope, Acceptance Criteria, Validation, and
  Non-goals.
- Prefer implementation issues that improve the alpha spine:
  import -> review -> enable -> preview -> mount -> inspect runs.
- Do not create marketplace, daemon, signed trust, artifact viewer, log viewer,
  dependency installer, or authoring IDE issues yet.
- Include exact validation commands. Baseline commands are:
  npm test -- --run
  npm run build
- Add cargo check only for Tauri/Rust issues.
```

## Suggested First Backlog

### Add Rust toolchain documentation and Tauri validation gate

Context: this repository contains a Tauri shell in `src-tauri`, so future
contributors and AI workers need an explicit Rust/Cargo validation path.

Acceptance criteria:

- Document the required Rust toolchain for Tauri development.
- Add a clear validation path for `cd src-tauri && cargo check`.
- Keep Node validation unchanged.

Validation:

```bash
npm test -- --run
npm run build
cd src-tauri && cargo check
```

### Wire the Tauri `run_skillrun` command to the TypeScript runner

Context: `src/core/runner.ts` expects a Tauri command named `run_skillrun`.

Acceptance criteria:

- Implement the Tauri command with argument-array execution.
- Capture `stdout`, `stderr`, and `exitCode`.
- Do not invoke through shell string concatenation.
- Add Rust or integration coverage where practical.

Validation:

```bash
npm test -- --run
npm run build
cd src-tauri && cargo check
```

### Build the first real Tray Status refresh path

Context: the UI currently shows placeholder status text while state and contract
tests already exist.

Acceptance criteria:

- Add a refresh action that calls the Core runner through existing state/service
  layers.
- Show Core missing, no capsules, disabled capsules, exposed tools, and mount
  status states.
- Preserve the rule that tray/dashboard does not start a long-running router.

Validation:

```bash
npm test -- --run
npm run build
```

### Connect Switchboard UI to inventory and enable/disable flows

Context: the alpha roadmap requires visible imported/enabled/readiness/exposed
distinctions.

Acceptance criteria:

- Render inventory data from `skillrun consumer inventory --json`.
- Add explicit enable/disable commands through Core runner services.
- Refresh inventory and exposure after changes.
- Avoid copy that equates enabled with trusted or sandboxed.

Validation:

```bash
npm test -- --run
npm run build
```

### Add CI for frontend and Tauri checks

Context: Symphony workers need reliable green/red feedback before handoff.

Acceptance criteria:

- Add GitHub Actions for Node install, tests, and build.
- Add Rust/Cargo setup and `cargo check` for `src-tauri`.
- Cache dependencies where sensible.

Validation:

```bash
npm test -- --run
npm run build
cd src-tauri && cargo check
```

## Operating Model

Start conservative:

- AI may create issues in Backlog.
- A human promotes only well-scoped issues to Todo.
- Symphony implements Todo issues and moves them to Human Review.
- A human reviews and moves approved issues to Merging.

After the project earns trust:

- Allow the issue factory to put low-risk test/docs/refactor issues directly
  into Todo.
- Keep product behavior, Tauri config, MCP mount, and release issues behind
  Human Review.
- Consider auto-landing only after CI, PR review, and rollback paths are
  consistently reliable.
