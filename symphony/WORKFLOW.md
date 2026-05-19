---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "skillrun-68dab379d537"
  active_states:
    - Todo
    - In Progress
    - Rework
    - Merging
  terminal_states:
    - Done
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
polling:
  interval_ms: 10000
workspace:
  root: ~/code/skillrun-desktop-workspaces
hooks:
  after_create: |
    git clone --local /Users/iiwish/self/skillrun-desktop .
    git remote set-url origin https://github.com/iiwish/skillrun-desktop.git
    npm ci
  before_run: |
    if [ ! -f package.json ]; then
      find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +
      git clone --local /Users/iiwish/self/skillrun-desktop .
      git remote set-url origin https://github.com/iiwish/skillrun-desktop.git
      npm ci
    fi
    git remote set-url origin https://github.com/iiwish/skillrun-desktop.git
    npm ci
  before_remove: |
    git status --short || true
agent:
  max_concurrent_agents: 2
  max_turns: 20
codex:
  command: codex --config shell_environment_policy.inherit=all --config 'model="gpt-5.5"' --config model_reasoning_effort=high app-server
  approval_policy: never
  thread_sandbox: danger-full-access
  turn_sandbox_policy:
    type: dangerFullAccess
---

You are working autonomously on Linear issue `{{ issue.identifier }}` for the
`skillrun-desktop` repository.

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
Current status: {{ issue.state }}
Labels: {{ issue.labels }}
URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

Repository contract:

- This is a Tauri + Vite + React + TypeScript desktop app.
- Product boundary lives in `docs/desktop-readiness.md`,
  `docs/desktop-core-contract.md`, and `docs/desktop-alpha-roadmap.md`.
- Desktop must consume stable `skillrun` CLI JSON contracts. Do not read
  `.skillrun/` internals, parse manifest files directly, or mutate MCP client
  configs outside Core commands.
- Keep the alpha spine intact: import -> review -> enable -> preview -> mount
  -> inspect runs.
- Do not add marketplace, signed package trust, dependency installation,
  daemon behavior, artifact viewer, log viewer, or authoring IDE work unless
  the Linear issue explicitly asks for it.

Required workflow:

1. Read the issue and current branch state.
2. Create or update one persistent Linear comment headed `## Codex Workpad`.
3. Mirror acceptance criteria and validation from the issue into the workpad.
4. Reproduce or inspect the current behavior before changing code.
5. Make a small, focused branch and commit.
6. Run validation before pushing.
7. Open or update a PR and attach it to the Linear issue.
8. Move the issue to `Human Review` only after validation and PR feedback are
   clean, or record a true external blocker in the workpad.

Baseline validation:

```bash
npm test -- --run
npm run build
```

Run this when Rust/Cargo is available or when the issue touches Tauri/Rust:

```bash
cd src-tauri && cargo check
```

If `cargo` or the `skillrun` CLI is missing and the issue requires it, treat
that as an environment blocker only after documenting the exact missing command
and the impact in the Linear workpad.

Final response requirements:

- Summarize completed changes and validation only.
- Do not include extra next steps for the human unless blocked.
- Keep Linear as the source of truth by updating the workpad before finishing.
