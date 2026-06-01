#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultCatalogPath = resolve(repoRoot, "../skillrun/target/desktop-hero-skr/catalog.json");
const catalogPath = resolve(process.env.SKILLRUN_HERO_CATALOG ?? defaultCatalogPath);
const itemId = process.env.SKILLRUN_HERO_ITEM ?? "meeting_action_brief";
const skillrunBin = process.env.SKILLRUN_CLI ?? "skillrun";
const runUiSmoke = process.env.SKILLRUN_DESKTOP_UI_SMOKE !== "0";
const artifactDir = resolve(process.env.SKILLRUN_DESKTOP_SMOKE_ARTIFACTS ?? join(tmpdir(), "skillrun-desktop-hero-smoke-artifacts"));

const summary = [];
const trace = [];

try {
  await runCoreHeroSmoke();
  if (runUiSmoke) {
    await runUiSmokeIfPossible();
  } else {
    summary.push(["ui smoke", "skipped via SKILLRUN_DESKTOP_UI_SMOKE=0"]);
  }
  printResult();
} catch (error) {
  printResult();
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function runCoreHeroSmoke() {
  if (!existsSync(catalogPath)) {
    throw new Error(
      [
        `Hero catalog not found: ${catalogPath}`,
        "Set SKILLRUN_HERO_CATALOG=/path/to/catalog.json, or generate the Desktop hero .skr suite from the skillrun repo first.",
      ].join("\n"),
    );
  }

  const root = await mkdtemp(join(tmpdir(), "skillrun-desktop-hero-smoke-"));
  const env = {
    ...process.env,
    HOME: join(root, "home"),
    SKILLRUN_HOME: join(root, "skillrun-home"),
    XDG_CONFIG_HOME: join(root, "xdg-config"),
  };

  try {
    await mkdir(env.HOME, { recursive: true });
    await mkdir(env.SKILLRUN_HOME, { recursive: true });
    await mkdir(env.XDG_CONFIG_HOME, { recursive: true });

    const version = await runCommand([skillrunBin, "--version"], { env });
    summary.push(["skillrun version", version.stdout.trim()]);

    const inspect = await runSkillrunJson(["team", "catalog", "inspect", catalogPath, "--json"], {
      env,
      schema: "team.catalog.inspect.v1",
    });
    const catalogItem = inspect.items.find((item) => item.id === itemId);
    if (!catalogItem) {
      throw new Error(`Catalog ${catalogPath} does not include item ${itemId}.`);
    }
    if (catalogItem.installable !== true) {
      throw new Error(`Catalog item ${itemId} is not installable.`);
    }
    summary.push(["catalog inspect", `items=${inspect.items.length}; hero=${itemId}`]);
    const requirements = summarizeRequirements(catalogItem);
    if (requirements) {
      summary.push(["catalog requirements", requirements]);
    }

    const statusBefore = await runSkillrunJson(["team", "catalog", "status", catalogPath, "--json"], {
      env,
      schema: "team.catalog.status.v1",
    });
    const statusItemBefore = statusBefore.items.find((item) => item.id === itemId);
    if (!statusItemBefore || statusItemBefore.status !== "missing" || statusItemBefore.recommended_action !== "install") {
      throw new Error(`Catalog status before apply should mark ${itemId} as missing/install.`);
    }
    summary.push(["catalog status", `before=${statusItemBefore.status}; action=${statusItemBefore.recommended_action}`]);

    const plan = await runSkillrunJson(["team", "catalog", "install", "plan", catalogPath, itemId, "--json"], {
      env,
      schema: "team.catalog.install_plan.v1",
    });
    if (plan.ok !== true || plan.item?.id !== itemId) {
      throw new Error(`Unexpected install plan result for ${itemId}.`);
    }
    if (!plan.actions?.some((action) => action.type === "import")) {
      throw new Error(`Install plan for ${itemId} did not include an import action.`);
    }
    summary.push(["catalog plan", `actions=${plan.actions.length}; warnings=${plan.warnings?.length ?? 0}`]);

    const apply = await runSkillrunJson(["team", "catalog", "install", "apply", catalogPath, itemId, "--json"], {
      env,
      schema: "team.catalog.install_apply.v1",
    });
    if (apply.ok !== true || apply.item_id !== itemId || apply.download?.sha256_verified !== true) {
      throw new Error(`Install apply for ${itemId} did not verify checksum and import successfully.`);
    }
    if (apply.import?.id !== itemId || apply.import?.enabled !== false) {
      throw new Error(`Install apply for ${itemId} should import disabled by default.`);
    }
    summary.push(["catalog apply", `sha256_verified=${apply.download.sha256_verified}; enabled=${apply.import.enabled}`]);

    const statusAfter = await runSkillrunJson(["team", "catalog", "status", catalogPath, "--json"], {
      env,
      schema: "team.catalog.status.v1",
    });
    const statusItemAfter = statusAfter.items.find((item) => item.id === itemId);
    if (!statusItemAfter || statusItemAfter.status !== "replace_available" || statusItemAfter.registry?.installed !== true) {
      throw new Error(`Catalog status after apply should mark ${itemId} as replace_available with an installed registry entry.`);
    }
    summary.push(["catalog status", `after=${statusItemAfter.status}; registry=${statusItemAfter.registry.source_type}`]);

    const inventory = await runSkillrunJson(["consumer", "inventory", "--json"], {
      env,
      schema: "consumer.inventory.v1",
    });
    const inventoryItem = inventory.capsules.find((capsule) => capsule.id === itemId);
    if (!inventoryItem || inventoryItem.enabled !== false) {
      throw new Error(`Inventory did not show disabled imported hero capsule ${itemId}.`);
    }
    summary.push(["inventory", `capsules=${inventory.capsules.length}; hero_enabled=${inventoryItem.enabled}`]);

    await runCommand([skillrunBin, "switchboard", "enable", itemId], { env });
    summary.push(["switchboard enable", `capsule=${itemId}`]);

    const exposure = await runSkillrunJson(["consumer", "exposure", "--json"], {
      env,
      schema: "consumer.exposure.v1",
    });
    const exposed = exposure.tools.find((tool) => tool.capsule_id === itemId && tool.exposed === true);
    if (!exposed) {
      throw new Error(`Exposure did not show ${itemId} as exposed after enable.`);
    }
    summary.push(["exposure", `tool=${exposed.name ?? itemId}; readiness=${exposed.readiness_status ?? "unknown"}`]);

    const routerStatus = await runSkillrunJson(["router", "status", "--json"], {
      env,
      schema: "router.status.v1",
    });
    if (!routerStatus.tools?.some((tool) => tool.capsule_id === itemId || tool.name === itemId)) {
      throw new Error(`Router status did not include hero tool ${itemId}.`);
    }
    if (Array.isArray(routerStatus.routes) && !routerStatus.routes.some((route) => route.capsule_id === itemId && route.state === "routable")) {
      throw new Error(`Router status did not mark ${itemId} as routable.`);
    }
    if (Array.isArray(routerStatus.issues) && routerStatus.issues.length > 0) {
      throw new Error(`Router status reported issues for ${itemId}: ${JSON.stringify(routerStatus.issues).slice(0, 240)}`);
    }
    summary.push(["router status", `routes=${routerStatus.routes?.length ?? 0}; hero=${itemId}`]);

    const router = await runSkillrunJson(["router", "serve", "--mcp", "--dry-run"], {
      env,
      schema: "router.mcp.v1",
    });
    if (!router.tools?.some((tool) => tool.capsule_id === itemId || tool.name === itemId)) {
      throw new Error(`Router dry-run did not include hero tool ${itemId}.`);
    }
    if (Array.isArray(router.routes) && !router.routes.some((route) => route.capsule_id === itemId && route.state === "routable")) {
      throw new Error(`Router dry-run did not mark ${itemId} as routable.`);
    }
    summary.push(["router dry-run", `tools=${router.tools.length}; hero=${itemId}`]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

async function runUiSmokeIfPossible() {
  const chromePath = findChrome();
  if (!chromePath) {
    summary.push(["ui smoke", "skipped because Chrome was not found; set CHROME_PATH to enable DOM checks"]);
    return;
  }

  const root = await mkdtemp(join(tmpdir(), "skillrun-desktop-ui-smoke-"));
  const vitePort = await getFreePort();
  const cdpPort = await getFreePort();
  const server = await createViteServer({
    configFile: join(repoRoot, "vite.config.ts"),
    root: repoRoot,
    server: {
      host: "127.0.0.1",
      port: vitePort,
      strictPort: true,
    },
  });

  let chrome;
  try {
    await server.listen();
    const url = `http://127.0.0.1:${vitePort}/`;
    await waitForHttpOk(url);

    chrome = spawn(
      chromePath,
      [
        "--headless=new",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-extensions",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${join(root, "chrome-profile")}`,
        "about:blank",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );

    const chromeErrors = [];
    chrome.stderr.setEncoding("utf8");
    chrome.stderr.on("data", (chunk) => {
      chromeErrors.push(chunk);
    });

    await waitForCdp(cdpPort);
    const page = await connectToFirstPage(cdpPort);
    try {
      await mkdir(artifactDir, { recursive: true });
      await assertViewport(page, url, { name: "desktop", width: 1440, height: 900 });
      await assertTeamLibrarySwitch(page);
      await assertSettingsLanguageSwitch(page);
      const desktopScreenshotPath = join(artifactDir, `desktop-${Date.now()}.png`);
      await writeFile(desktopScreenshotPath, await page.captureScreenshot());
      await assertViewport(page, url, { name: "mobile", width: 390, height: 844 });
      const mobileScreenshotPath = join(artifactDir, `mobile-${Date.now()}.png`);
      await writeFile(mobileScreenshotPath, await page.captureScreenshot());
      summary.push(["ui smoke", `desktop/mobile DOM ok; screenshots=${desktopScreenshotPath}, ${mobileScreenshotPath}`]);
    } finally {
      page.close();
    }

    if (chromeErrors.join("").includes("Uncaught")) {
      throw new Error("Chrome stderr included an uncaught browser error.");
    }
  } finally {
    await server.close();
    if (chrome && !chrome.killed) {
      chrome.kill("SIGTERM");
    }
    await rm(root, { force: true, recursive: true });
  }
}

async function assertViewport(page, url, viewport) {
  page.clearErrors();
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.name === "mobile",
  });
  await page.navigate(url);
  const result = await page.evaluate(`(() => {
    const text = document.body.innerText;
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      hasCapsuleManage: text.includes("Capsule 管理"),
      hasImport: text.includes("导入 .skr"),
      hasRefresh: text.includes("刷新状态"),
      hasEmpty: text.includes("还没有 Capsule"),
      hasSettings: text.includes("设置"),
      hasNoPersistentLanguageToggle: !text.includes("EN") && !Array.from(document.querySelectorAll('[role="group"]')).some((element) => element.getAttribute("aria-label") === "语言"),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`);

  const missing = Object.entries(result)
    .filter(([key, value]) => key.startsWith("has") && value !== true)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`${viewport.name} UI smoke missing expected text: ${missing.join(", ")}`);
  }
  if (result.overflowX) {
    throw new Error(`${viewport.name} UI smoke detected horizontal overflow.`);
  }
  if (page.errors.length > 0) {
    throw new Error(`${viewport.name} UI smoke saw browser errors: ${page.errors.join("; ")}`);
  }
}

async function assertTeamLibrarySwitch(page) {
  const result = await page.evaluate(`new Promise((resolve) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const teamButton = buttons.find((button) => {
      const label = [button.getAttribute("aria-label"), button.textContent].filter(Boolean).join(" ");
      return label.includes("团队能力库") || label.includes("Team Library");
    });
    if (!teamButton) {
      resolve({ clicked: false, hasTeamLibrary: false });
      return;
    }
    teamButton.click();
    setTimeout(() => {
      const text = document.body.innerText;
      resolve({
        clicked: true,
        hasTeamLibrary: text.includes("团队能力库") || text.includes("Catalog 路径") || text.includes("检查 catalog"),
      });
    }, 100);
  })`);

  if (result.clicked !== true || result.hasTeamLibrary !== true) {
    throw new Error("Desktop UI smoke could not switch to Team Library.");
  }
}

async function assertSettingsLanguageSwitch(page) {
  const result = await page.evaluate(`new Promise((resolve) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const settingsButton = buttons.find((button) => {
      const label = [button.getAttribute("aria-label"), button.textContent].filter(Boolean).join(" ");
      return label.includes("设置") || label.includes("Settings");
    });
    if (!settingsButton) {
      resolve({ clicked: false, hasLanguageSetting: false });
      return;
    }
    settingsButton.click();
    setTimeout(() => {
      const text = document.body.innerText;
      resolve({
        clicked: true,
        hasLanguageSetting: text.includes("中文") && text.includes("English"),
      });
    }, 100);
  })`);

  if (result.clicked !== true || result.hasLanguageSetting !== true) {
    throw new Error("Desktop UI smoke could not find the language switch in Settings.");
  }
}

async function runSkillrunJson(args, options) {
  const result = await runCommand([skillrunBin, ...args], { env: options.env });
  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Expected JSON from skillrun ${args.join(" ")}, got: ${result.stdout.slice(0, 240)}`, {
      cause: error,
    });
  }
  if (data.schema_version !== options.schema) {
    throw new Error(`Expected schema ${options.schema}, got ${data.schema_version ?? "<missing>"}.`);
  }
  return data;
}

function runCommand(command, options = {}) {
  const startedAt = performance.now();
  const [program, ...args] = command;
  return new Promise((resolvePromise, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      trace.push({
        command: command.join(" "),
        durationMs: Math.round(performance.now() - startedAt),
        exitCode,
        stderr: preview(stderr),
        stdout: preview(stdout),
      });
      if (exitCode !== 0) {
        reject(new Error(`${command.join(" ")} exited ${exitCode}.\n${stderr || stdout}`));
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

async function connectToFirstPage(cdpPort) {
  const list = await fetchJson(`http://127.0.0.1:${cdpPort}/json/list`);
  const target = list.find((entry) => entry.type === "page");
  if (!target?.webSocketDebuggerUrl) {
    throw new Error("Chrome did not expose a page target for UI smoke.");
  }
  return createCdpPage(target.webSocketDebuggerUrl);
}

function createCdpPage(url) {
  const ws = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  const eventResolvers = new Map();
  const errors = [];

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePending, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolvePending(message.result ?? {});
      }
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      errors.push(message.params?.exceptionDetails?.text ?? "Runtime exception");
    }
    if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      errors.push(message.params.entry.text);
    }
    const resolver = eventResolvers.get(message.method);
    if (resolver) {
      eventResolvers.delete(message.method);
      resolver(message.params ?? {});
    }
  });

  const opened = new Promise((resolveOpen, rejectOpen) => {
    ws.addEventListener("open", resolveOpen, { once: true });
    ws.addEventListener("error", () => rejectOpen(new Error("Chrome DevTools websocket failed.")), { once: true });
  });

  return {
    get errors() {
      return errors;
    },
    clearErrors() {
      errors.length = 0;
    },
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolvePending, reject) => {
        pending.set(id, { resolve: resolvePending, reject });
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error(`Timed out waiting for CDP method ${method}.`));
          }
        }, 10_000);
      });
    },
    async navigate(targetUrl) {
      await this.send("Page.enable");
      await this.send("Runtime.enable");
      await this.send("Log.enable");
      const loaded = waitForEvent(eventResolvers, "Page.loadEventFired");
      await this.send("Page.navigate", { url: targetUrl });
      await loaded;
    },
    async evaluate(expression) {
      const result = await this.send("Runtime.evaluate", {
        awaitPromise: true,
        expression,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed.");
      }
      return result.result?.value;
    },
    async captureScreenshot() {
      const result = await this.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      return Buffer.from(result.data, "base64");
    },
    close() {
      ws.close();
    },
  };
}

function waitForEvent(eventResolvers, method) {
  return new Promise((resolvePromise, reject) => {
    eventResolvers.set(method, resolvePromise);
    setTimeout(() => {
      if (eventResolvers.has(method)) {
        eventResolvers.delete(method);
        reject(new Error(`Timed out waiting for CDP event ${method}.`));
      }
    }, 10_000);
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function waitForCdp(port) {
  const url = `http://127.0.0.1:${port}/json/version`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetchJson(url);
      return;
    } catch {
      await delay(100);
    }
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

async function waitForHttpOk(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until Vite finishes booting.
    }
    await delay(100);
  }
  throw new Error(`Vite server did not become ready at ${url}.`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
  return response.json();
}

function getFreePort() {
  return new Promise((resolvePromise, reject) => {
    const server = createNetServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address?.port) {
          resolvePromise(address.port);
        } else {
          reject(new Error("Could not allocate a free local port."));
        }
      });
    });
  });
}

function printResult() {
  console.log("Hero Desktop smoke summary:");
  for (const [step, detail] of summary) {
    console.log(`- ${step}: ${detail}`);
  }
  console.log("");
  console.log("Hero Desktop smoke trace:");
  for (const [index, entry] of trace.entries()) {
    console.log(
      [
        `${index + 1}. ${entry.command}`,
        `exit=${entry.exitCode}`,
        `durationMs=${entry.durationMs}`,
        entry.stdout ? `stdout=${entry.stdout}` : undefined,
        entry.stderr ? `stderr=${entry.stderr}` : undefined,
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }
}

function preview(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
}

function summarizeRequirements(item) {
  if (!Array.isArray(item.requirements) || item.requirements.length === 0) {
    return "";
  }
  return item.requirements
    .map((requirement) => {
      const kind = typeof requirement.kind === "string" ? requirement.kind : "runtime";
      const summaryText = typeof requirement.summary === "string" ? requirement.summary : "";
      return summaryText ? `${kind}: ${summaryText}` : kind;
    })
    .join("; ");
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
