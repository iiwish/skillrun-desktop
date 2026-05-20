#!/usr/bin/env bash
set -euo pipefail

skillrun_repo="${SKILLRUN_REPO:-https://github.com/iiwish/skillrun}"

if [[ -n "${SKILLRUN_CORE_PATH:-}" ]]; then
  core_path="$SKILLRUN_CORE_PATH"

  if [[ ! -f "$core_path/Cargo.toml" ]]; then
    echo "skillrun Core Cargo.toml not found at $core_path" >&2
    exit 1
  fi

  cargo install --path "$core_path" --locked --force
else
  cargo install --git "$skillrun_repo" --locked --force
  export SKILLRUN_REQUIRE_GIT_SOURCE=1
fi

scripts/verify-local-skillrun-cli.sh
