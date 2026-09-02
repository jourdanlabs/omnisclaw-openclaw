#!/usr/bin/env node
/**
 * OMNIS CLAW — operator chat launcher (WING-style).
 * Probes BIFROST, then opens the pi-tui gateway chat.
 *
 * Usage:
 *   node scripts/omnis-claw-chat.mjs [--local] [--skip-probe] [-- ...openclaw tui args]
 *   pnpm omnisclaw:chat
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const openclawMjs = path.join(repoRoot, "openclaw.mjs");

const argv = process.argv.slice(2);
const skipProbe = argv.includes("--skip-probe");
const passthrough = argv.filter((a) => a !== "--skip-probe");

function banner() {
  const lines = [
    "",
    "  OMNIS CLAW · terminal room",
    "  BIFROST delivery gate · gateway TUI",
    "  Ctrl+C to exit · /help for commands",
    "",
  ];
  process.stderr.write(lines.join("\n"));
}

function probe() {
  const r = spawnSync(process.execPath, ["scripts/omnisclaw-stack.mjs", "probe"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    process.stderr.write("[omnis-claw-chat] BIFROST probe failed — run: pnpm omnisclaw:install\n");
    process.exit(r.status ?? 1);
  }
}

if (!skipProbe) {
  probe();
}

banner();

const env = {
  ...process.env,
  OMNIS_CLAW_TUI: "1",
  OPENCLAW_THEME: process.env.OPENCLAW_THEME || "dark",
};

const child = spawn(process.execPath, [openclawMjs, "tui", ...passthrough], {
  cwd: repoRoot,
  stdio: "inherit",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
