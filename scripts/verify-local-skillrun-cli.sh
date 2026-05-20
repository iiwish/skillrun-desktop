#!/usr/bin/env bash
set -euo pipefail

cargo_home="${CARGO_HOME:-$HOME/.cargo}"
expected_bin="$cargo_home/bin/skillrun"
skillrun_repo="${SKILLRUN_REPO:-https://github.com/iiwish/skillrun}"
expected_version=""

if [[ -n "${SKILLRUN_CORE_PATH:-}" ]]; then
  core_path="$SKILLRUN_CORE_PATH"

  if [[ ! -f "$core_path/Cargo.toml" ]]; then
    echo "skillrun Core Cargo.toml not found at $core_path" >&2
    exit 1
  fi

  core_path="$(cd "$core_path" && pwd -P)"
  expected_version="$(
    cargo metadata --manifest-path "$core_path/Cargo.toml" --no-deps --format-version 1 \
      | sed -n 's/.*"name":"skillrun","version":"\([^"]*\)".*/\1/p'
  )"
fi

actual_bin="$(command -v skillrun || true)"
if [[ -z "$actual_bin" ]]; then
  echo "skillrun not found in PATH; expected $expected_bin" >&2
  exit 1
fi

actual_bin="$(cd "$(dirname "$actual_bin")" && pwd -P)/$(basename "$actual_bin")"
expected_bin="$(cd "$(dirname "$expected_bin")" && pwd -P)/$(basename "$expected_bin")"

if [[ "$actual_bin" != "$expected_bin" ]]; then
  echo "skillrun resolves to $actual_bin, expected $expected_bin" >&2
  exit 1
fi

actual_version="$(skillrun --version)"

if [[ -n "$expected_version" && "$actual_version" != *"$expected_version"* ]]; then
  echo "skillrun --version returned '$actual_version', expected version $expected_version from $core_path" >&2
  exit 1
fi

install_record="$(cargo install --list | sed -n '/^skillrun v/,+1p')"
if [[ -n "${SKILLRUN_CORE_PATH:-}" ]]; then
  if [[ "$install_record" != *"($core_path)"* ]]; then
    echo "cargo install record does not point at $core_path" >&2
    echo "$install_record" >&2
    exit 1
  fi
elif [[ "${SKILLRUN_REQUIRE_GIT_SOURCE:-}" == "1" ]]; then
  if [[ "$install_record" != *"$skillrun_repo"* ]]; then
    echo "cargo install record does not point at $skillrun_repo" >&2
    echo "$install_record" >&2
    exit 1
  fi
fi

echo "skillrun binary: $actual_bin"
echo "skillrun version: $actual_version"
if [[ -n "${SKILLRUN_CORE_PATH:-}" ]]; then
  echo "skillrun source: $core_path"
elif [[ -n "$install_record" ]]; then
  echo "skillrun install record: ${install_record%%$'\n'*}"
fi
