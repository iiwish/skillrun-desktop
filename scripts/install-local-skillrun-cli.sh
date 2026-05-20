#!/usr/bin/env bash
set -euo pipefail

skillrun_repo="${SKILLRUN_REPO:-https://github.com/iiwish/skillrun}"
skillrun_ref="${SKILLRUN_CORE_REF:-}"

if [[ -n "${SKILLRUN_CORE_PATH:-}" ]]; then
  core_path="$SKILLRUN_CORE_PATH"

  if [[ ! -f "$core_path/Cargo.toml" ]]; then
    echo "skillrun Core Cargo.toml not found at $core_path" >&2
    exit 1
  fi

  cargo install --path "$core_path" --locked --force
else
  install_args=(install --git "$skillrun_repo" --locked --force)
  if [[ -n "$skillrun_ref" ]]; then
    install_args+=(--rev "$skillrun_ref")
  fi

  cargo "${install_args[@]}"
  export SKILLRUN_REQUIRE_GIT_SOURCE=1
fi

scripts/verify-local-skillrun-cli.sh
