#!/usr/bin/env bash
set -euo pipefail

skillrun_repo="${SKILLRUN_REPO:-https://github.com/iiwish/skillrun}"
skillrun_ref="${SKILLRUN_CORE_REF:-}"
cargo_home="${CARGO_HOME:-$HOME/.cargo}"
cargo_bin="$cargo_home/bin"

mkdir -p "$cargo_bin"
export PATH="$cargo_bin:$PATH"
if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "$cargo_bin" >> "$GITHUB_PATH"
fi

if [[ -n "${SKILLRUN_CORE_PATH:-}" ]]; then
  core_path="$SKILLRUN_CORE_PATH"

  if [[ ! -f "$core_path/Cargo.toml" ]]; then
    echo "skillrun Core Cargo.toml not found at $core_path" >&2
    exit 1
  fi

  cargo install --path "$core_path" --locked --force
else
  base_install_args=(install --git "$skillrun_repo" --locked --force)
  if [[ -n "$skillrun_ref" ]]; then
    if ! cargo "${base_install_args[@]}" --rev "$skillrun_ref"; then
      echo "cargo install --rev '$skillrun_ref' failed; retrying as branch/tag ref" >&2
      if ! cargo "${base_install_args[@]}" --branch "$skillrun_ref"; then
        echo "cargo install --branch '$skillrun_ref' failed; retrying as tag ref" >&2
        cargo "${base_install_args[@]}" --tag "$skillrun_ref"
      fi
    fi
  else
    cargo "${base_install_args[@]}"
  fi
  export SKILLRUN_REQUIRE_GIT_SOURCE=1
fi

scripts/verify-local-skillrun-cli.sh
