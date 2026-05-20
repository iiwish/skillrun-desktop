#!/usr/bin/env node

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);

const options = {
  assetsJson: undefined,
  version: undefined,
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === "--assets-json" || arg === "--version") {
    const value = args[i + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`${arg} requires a value`);
    }

    options[arg.slice(2).replace(/-./g, (match) => match[1].toUpperCase())] = value;
    i += 1;
  } else {
    throw new Error(`Unknown argument: ${arg}`);
  }
}

if (!options.assetsJson) {
  throw new Error("--assets-json is required");
}

if (!options.version) {
  throw new Error("--version is required");
}

const version = normalizeVersion(options.version);
const assets = JSON.parse(readFileSync(options.assetsJson, "utf8"));

if (!Array.isArray(assets)) {
  throw new Error("Release assets JSON must be an array");
}

const actual = assets
  .map((asset) => (typeof asset === "string" ? asset : asset?.name))
  .filter(Boolean)
  .sort();

const expected = [
  `SkillRun.Desktop-${version}-1.x86_64.rpm`,
  `SkillRun.Desktop_${version}_aarch64.dmg`,
  `SkillRun.Desktop_${version}_amd64.AppImage`,
  `SkillRun.Desktop_${version}_amd64.deb`,
  `SkillRun.Desktop_${version}_x64-setup.exe`,
  `SkillRun.Desktop_${version}_x64.dmg`,
  "SkillRun.Desktop_aarch64.app.tar.gz",
  "SkillRun.Desktop_x64.app.tar.gz",
].sort();

const missing = expected.filter((name) => !actual.includes(name));
const unexpected = actual.filter((name) => !expected.includes(name));

if (missing.length > 0 || unexpected.length > 0) {
  const lines = [
    `Desktop release assets did not match the expected alpha set for ${version}.`,
  ];

  if (missing.length > 0) {
    lines.push("", "Missing assets:", ...missing.map((name) => `- ${name}`));
  }

  if (unexpected.length > 0) {
    lines.push("", "Unexpected assets:", ...unexpected.map((name) => `- ${name}`));
  }

  throw new Error(lines.join("\n"));
}

console.log(`Desktop release asset set verified for ${version}: ${expected.length} assets`);

function normalizeVersion(value) {
  const normalized = value.trim().replace(/^refs\/tags\//, "").replace(/^desktop-v/, "").replace(/^v/, "");
  const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

  if (!semverPattern.test(normalized)) {
    throw new Error(`Desktop release version must be semver without a prefix; received "${value}"`);
  }

  return normalized;
}
