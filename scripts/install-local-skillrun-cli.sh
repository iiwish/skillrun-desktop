#!/usr/bin/env bash
set -euo pipefail

core_path="${SKILLRUN_CORE_PATH:-/Users/iiwish/self/skillrun}"

if [[ ! -f "$core_path/Cargo.toml" ]]; then
  echo "skillrun Core Cargo.toml not found at $core_path" >&2
  exit 1
fi

cargo install --path "$core_path" --locked --force
scripts/verify-local-skillrun-cli.sh
