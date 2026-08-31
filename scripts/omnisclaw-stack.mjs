#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bifrostDir = path.resolve(
  process.env.BIFROST_REPO_DIR ||
    process.env.OMNISCLAW_BIFROST_REPO_DIR ||
    path.join(repoRoot, "..", "bifrost"),
);
const nodePath = process.execPath;
const label = "com.jourdanlabs.bifrost-cosmic-lite";
const port = Number(process.env.BIFROST_PORT || 8787);
const maxOutputBytes = Number(process.env.BIFROST_MAX_OUTPUT_BYTES || 200000);
const launchAgentsDir = path.join(os.homedir(), "Library", "LaunchAgents");
const plistPath = path.join(launchAgentsDir, `${label}.plist`);
const uid = process.getuid?.() ?? 501;

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}) },
    encoding: "utf8",
    stdio: opts.stdio || "pipe",
  });
  if (opts.allowFailure) {
    return result;
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      `${command} ${args.join(" ")} failed${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ""}`,
    );
  }
  return result;
}

function assertBifrostCheckout() {
  const packagePath = path.join(bifrostDir, "package.json");
  const serverSource = path.join(bifrostDir, "services", "cosmic-lite", "src", "server.ts");
  if (!existsSync(packagePath) || !existsSync(serverSource)) {
    throw new Error(
      `BIFROST checkout not found at ${bifrostDir}. Set BIFROST_REPO_DIR to the BIFROST repo path.`,
    );
  }
}

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function writeLaunchAgent() {
  await fs.mkdir(launchAgentsDir, { recursive: true });
  const command = `cd ${shellQuote(bifrostDir)} && exec ${shellQuote(nodePath)} services/cosmic-lite/dist/server.js`;
  const stdout = path.join(os.homedir(), ".omnisclaw", "bifrost-cosmic-lite.out.log");
  const stderr = path.join(os.homedir(), ".omnisclaw", "bifrost-cosmic-lite.err.log");
  await fs.mkdir(path.dirname(stdout), { recursive: true });
  await fs.writeFile(
    plistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>${xmlEscape(command)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(bifrostDir)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>${String(port)}</string>
    <key>BIFROST_MAX_OUTPUT_BYTES</key>
    <string>${String(maxOutputBytes)}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(stdout)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(stderr)}</string>
</dict>
</plist>
`,
  );
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function launchctl(args, opts = {}) {
  return run("launchctl", args, opts);
}

async function installBifrost() {
  assertBifrostCheckout();
  console.log(`[omnisclaw] building BIFROST cosmic-lite from ${bifrostDir}`);
  run("pnpm", ["--filter", "@bifrost/cosmic-lite", "build"], {
    cwd: bifrostDir,
    stdio: "inherit",
  });
  await writeLaunchAgent();
  const domain = `gui/${uid}`;
  launchctl(["bootout", domain, plistPath], { allowFailure: true });
  launchctl(["bootstrap", domain, plistPath], { allowFailure: true });
  launchctl(["kickstart", "-k", `${domain}/${label}`], { allowFailure: true });
  console.log(`[omnisclaw] BIFROST LaunchAgent installed: ${plistPath}`);
}

function installGateway() {
  console.log("[omnisclaw] installing OMNISCLAW/OpenClaw gateway service");
  run(nodePath, [path.join(repoRoot, "openclaw.mjs"), "gateway", "install", "--force"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

async function verifyProbe(name, output) {
  const res = await fetch(`http://127.0.0.1:${port}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ output }),
  });
  if (!res.ok) {
    throw new Error(`${name}: verifier returned HTTP ${res.status}`);
  }
  const json = await res.json();
  console.log(
    `[omnisclaw] probe ${name}: ${json.verdict} confidence=${json.confidence} findings=${
      (json.pulsar_findings || []).map((finding) => finding.type).join(",") || "none"
    }`,
  );
  return json;
}

async function probeBifrost() {
  await verifyProbe("clean_fact", "The capital of France is Paris.");
  await verifyProbe("unsafe_code", "function divide(a,b){ return a / b; }");
  await verifyProbe("contradiction", "The report is approved and rejected at the same time.");
  await verifyProbe("overconfidence", "This will definitely always work 100% of the time.");
}

async function status() {
  const result = launchctl(["print", `gui/${uid}/${label}`], { allowFailure: true });
  const running = result.status === 0 && /\bstate = running\b/.test(result.stdout || "");
  console.log(`[omnisclaw] BIFROST service: ${running ? "running" : "not running"}`);
  console.log(`[omnisclaw] BIFROST repo: ${bifrostDir}`);
  console.log(`[omnisclaw] BIFROST endpoint: http://127.0.0.1:${port}/verify`);
  if (running) {
    await probeBifrost();
  }
}

async function main() {
  const [command = "status", ...args] = process.argv.slice(2);
  if (command === "install") {
    await installBifrost();
    if (args.includes("--with-gateway")) {
      installGateway();
    } else {
      console.log("[omnisclaw] gateway unchanged (pass --with-gateway to reinstall it too)");
    }
    await probeBifrost();
    return;
  }
  if (command === "restart-bifrost") {
    await installBifrost();
    await probeBifrost();
    return;
  }
  if (command === "probe") {
    await probeBifrost();
    return;
  }
  if (command === "status") {
    await status();
    return;
  }
  console.error(
    "Usage: node scripts/omnisclaw-stack.mjs [status|probe|restart-bifrost|install [--with-gateway]]",
  );
  process.exit(2);
}

main().catch((error) => {
  console.error(`[omnisclaw] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
