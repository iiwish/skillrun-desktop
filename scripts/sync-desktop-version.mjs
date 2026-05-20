#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

const options = {
  check: false,
  tag: undefined,
  version: undefined,
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === "--check") {
    options.check = true;
  } else if (arg === "--tag" || arg === "--version") {
    const value = args[i + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value`);
    }

    options[arg.slice(2)] = value;
    i += 1;
  } else {
    throw new Error(`Unknown argument: ${arg}`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8"));
}

function writeJson(path, data) {
  writeFileSync(join(repoRoot, path), `${JSON.stringify(data, null, 2)}\n`);
}

function normalizeVersion(value) {
  const version = value.trim().replace(/^refs\/tags\//, "").replace(/^desktop-v/, "").replace(/^v/, "");
  const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

  if (!semverPattern.test(version)) {
    throw new Error(
      `Desktop release version must be semver without a prefix; received "${value}"`,
    );
  }

  return version;
}

function readCargoVersion() {
  const cargoToml = readFileSync(join(repoRoot, "src-tauri/Cargo.toml"), "utf8");
  const match = cargoToml.match(/^version = "([^"]+)"/m);

  if (!match) {
    throw new Error("Could not find package version in src-tauri/Cargo.toml");
  }

  return match[1];
}

function writeCargoVersion(version) {
  const cargoPath = join(repoRoot, "src-tauri/Cargo.toml");
  const cargoToml = readFileSync(cargoPath, "utf8");

  if (!/^version = "([^"]+)"/m.test(cargoToml)) {
    throw new Error("Could not update package version in src-tauri/Cargo.toml");
  }

  const nextCargoToml = cargoToml.replace(/^version = "([^"]+)"/m, `version = "${version}"`);

  writeFileSync(cargoPath, nextCargoToml);
}

const packageJson = readJson("package.json");
const expectedVersion = normalizeVersion(
  options.version ?? options.tag ?? process.env.GITHUB_REF_NAME ?? packageJson.version,
);
const packageLock = readJson("package-lock.json");
const tauriConfig = readJson("src-tauri/tauri.conf.json");

const currentVersions = {
  "package.json": packageJson.version,
  "package-lock.json": packageLock.version,
  "package-lock.json packages[\"\"]": packageLock.packages?.[""]?.version,
  "src-tauri/Cargo.toml": readCargoVersion(),
  "src-tauri/tauri.conf.json": tauriConfig.version,
};

const mismatches = Object.entries(currentVersions).filter(([, version]) => version !== expectedVersion);

if (options.check) {
  if (mismatches.length > 0) {
    const details = mismatches.map(([path, version]) => `${path}: ${version}`).join("\n");
    throw new Error(`Desktop version mismatch; expected ${expectedVersion}\n${details}`);
  }

  console.log(`Desktop versions are synchronized at ${expectedVersion}`);
  process.exit(0);
}

packageJson.version = expectedVersion;
packageLock.version = expectedVersion;

if (!packageLock.packages?.[""]) {
  throw new Error('Could not find root package entry in package-lock.json packages[""]');
}

packageLock.packages[""].version = expectedVersion;
tauriConfig.version = expectedVersion;

writeJson("package.json", packageJson);
writeJson("package-lock.json", packageLock);
writeCargoVersion(expectedVersion);
writeJson("src-tauri/tauri.conf.json", tauriConfig);

console.log(`Synchronized Desktop versions to ${expectedVersion}`);
