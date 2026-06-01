# Router Diagnostics Manual Test

Status: Desktop alpha manual test guide  
Scope: `router.status.v1`, `router.mcp.v1`, and the Exposure view

This guide verifies that Desktop presents Core-reported Router diagnostics without crossing the Desktop/Core boundary.

## Boundaries

- Desktop only consumes `skillrun consumer exposure --json`, `skillrun router status --json`, and `skillrun router serve --mcp --dry-run`.
- Desktop must not read `.skillrun/`, unpack `.skr`, parse Manifest YAML, start a hidden Router daemon, auto-mount MCP clients, or auto-install dependencies.
- `enabled=true` means local exposure intent only. It is not trust, sandbox, publisher identity, or dependency installation.
- Recovery text must come from Core `recommended_action` or Desktop copy around that action. Desktop must not claim it already repaired the route.

## Setup

Use an isolated Core home unless the test explicitly targets a real user setup:

```bash
export SKILLRUN_TEST_ROOT="$(mktemp -d /tmp/skillrun-router-diag-XXXXXX)"
export SKILLRUN_HOME="$SKILLRUN_TEST_ROOT/skillrun-home"
export HOME="$SKILLRUN_TEST_ROOT/fake-home"
export XDG_CONFIG_HOME="$SKILLRUN_TEST_ROOT/xdg-config"
mkdir -p "$SKILLRUN_HOME" "$HOME" "$XDG_CONFIG_HOME" "$SKILLRUN_TEST_ROOT/outputs"

export PATH="/Users/iiwish/self/skillrun/target/debug:$PATH"
skillrun --version
skillrun host status --json
```

For the default Desktop hero catalog, prepare an explicit Python 3.13 venv when needed:

```bash
/opt/homebrew/bin/python3.13 -m venv /tmp/skillrun-hero-py313
/tmp/skillrun-hero-py313/bin/python -m pip install -U pip pydantic
export PATH="/tmp/skillrun-hero-py313/bin:$PATH"
```

## Scenario 1: No Routes

Goal: Desktop shows an empty Router route state without implying background work.

```bash
skillrun consumer exposure --json | tee "$SKILLRUN_TEST_ROOT/outputs/exposure-empty.json"
skillrun router status --json | tee "$SKILLRUN_TEST_ROOT/outputs/router-status-empty.json"
skillrun router serve --mcp --dry-run | tee "$SKILLRUN_TEST_ROOT/outputs/router-dry-run-empty.json"
```

Expected Core:

- `schema_version` is `consumer.exposure.v1`, `router.status.v1`, and `router.mcp.v1`.
- `routes` is absent or empty.
- `issues` is absent or empty.
- `ok` is true for Router outputs.

Expected Desktop:

- Exposure view shows no tools and no Router routes.
- Copy stays factual, for example that Core did not report Router routes.
- No long-running Router process starts.

## Scenario 2: Routable Route

Goal: Desktop shows an enabled ready capsule as routable.

```bash
SKILLRUN_CLI=/Users/iiwish/self/skillrun/target/debug/skillrun \
SKILLRUN_HERO_CATALOG=/Users/iiwish/self/skillrun/target/desktop-hero-skr/catalog.json \
npm run smoke:hero-desktop
```

Expected Core:

- `router status --json` reports at least one `routes[]` entry for the hero capsule.
- The hero route has `state: "routable"` and `readiness_status: "ok"`.
- `issues` is empty.

Expected Desktop:

- Exposure view summary shows one routable route and zero blocked/error issues.
- Route row displays capsule/tool identity, readiness, and recovery suggestion.
- Resource rows show metadata only.

## Scenario 3: Blocked Route From Missing Runtime

Goal: Desktop shows blocked / warning diagnostics and recovery copy without trying to repair the environment.

First install and enable a Python hero while the Python 3.13 venv is available:

```bash
skillrun team catalog install apply /Users/iiwish/self/skillrun/target/desktop-hero-skr/catalog.json meeting_action_brief --json \
  | tee "$SKILLRUN_TEST_ROOT/outputs/hero-apply.json"
skillrun switchboard enable meeting_action_brief
skillrun router status --json | tee "$SKILLRUN_TEST_ROOT/outputs/router-status-before-runtime-missing.json"
```

Then remove only the temporary venv from `PATH` and re-run Router diagnostics against the same isolated `SKILLRUN_HOME`:

```bash
export PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v '^/tmp/skillrun-hero-py313/bin$' | paste -sd ':' -)"

skillrun consumer inventory --json | tee "$SKILLRUN_TEST_ROOT/outputs/inventory-runtime-missing.json"
skillrun router status --json | tee "$SKILLRUN_TEST_ROOT/outputs/router-status-runtime-missing.json"
skillrun router serve --mcp --dry-run | tee "$SKILLRUN_TEST_ROOT/outputs/router-dry-run-runtime-missing.json"
```

For Desktop UI review, start Desktop from a shell with the same `SKILLRUN_HOME` and the venv removed from `PATH`:

```bash
npm run dev -- --host 127.0.0.1
```

Expected Core:

- The enabled capsule is not shown as routable while its runtime is missing.
- Structured route issues use `severity: "warning"` or `severity: "error"` and include `recommended_action`.
- If Core exits non-zero, stdout still carries structured JSON for Desktop to render.

Expected Desktop:

- The route is not shown as routable.
- Any visible warning/error comes from Core diagnostics.
- Desktop does not install Python, pydantic, or dependencies.
- Desktop does not describe the capsule as trusted, sandboxed, or safe.

## Scenario 4: Duplicate Tool Name

Goal: Desktop preserves Core fail-closed diagnostics when Router returns structured JSON with a non-zero exit.

Create or import two enabled capsules that expose the same MCP tool name, then run:

```bash
skillrun router status --json | tee "$SKILLRUN_TEST_ROOT/outputs/router-status-duplicate.json"
skillrun router serve --mcp --dry-run | tee "$SKILLRUN_TEST_ROOT/outputs/router-dry-run-duplicate.json"
```

Expected Core:

- Router command may exit non-zero.
- `stdout` still contains structured JSON with `ok: false`, `routes`, `issues`, and `error`.
- `issues[]` includes an error such as duplicate tool name and a `recommended_action`.

Expected Desktop:

- Exposure view remains usable and shows the Router issue instead of a generic JSON failure.
- The status strip uses warning/error tone.
- Recovery copy tells the user to resolve the duplicate enabled capsule/tool conflict.
- Desktop does not bypass Core by editing registry or `.skillrun/` files.

## Scenario 5: Desktop UI Refresh

Run Desktop locally:

```bash
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:1420/`, then:

1. Go to the Exposure / Tools view.
2. Click refresh preview.
3. Confirm the status strip, route diagnostics section, tool list, and resource list match the saved Core JSON outputs.
4. Switch language between Chinese and English.
5. Check a narrow viewport around 390px width.

Expected Desktop:

- No horizontal overflow.
- No overlapping text in status strips, route rows, or buttons.
- No console errors.
- Copy stays restrained: it names route state and recovery action, not hidden automation.

## Evidence To Record

- `skillrun --version`
- `git rev-parse HEAD` for `skillrun` and `skillrun-desktop`
- Output files under `$SKILLRUN_TEST_ROOT/outputs`
- Screenshot of the Exposure view for routable and blocked/error states
- Any unexpected Core stderr or browser console error
