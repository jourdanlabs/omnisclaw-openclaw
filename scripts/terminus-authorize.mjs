#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Jourdan Labs
// Thin pin for the shippable artifact. Does not copy CADUCEUS policy.
// Forwards stdin JSON to the CADUCEUS CLI when present; otherwise REFUSE
// terminus_unavailable (fail-closed). A packaged CLAW without CADUCEUS
// must not silently ungate exec.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = resolve(fileURLToPath(import.meta.url));

const unavailable = {
  verdict: "REFUSE",
  decision: "REFUSE_SCANNER_FAILURE",
  reason: "terminus_unavailable",
  receipt: null,
};

function writeRefuse() {
  process.stdout.write(`${JSON.stringify(unavailable)}\n`);
  process.exit(1);
}

function resolveCaduceusCli() {
  const pointed = process.env.TERMINUS_AUTHORIZE;
  if (pointed && resolve(pointed) !== SELF) {
    return pointed;
  }
  if (process.env.CADUCEUS_ROOT) {
    return join(process.env.CADUCEUS_ROOT, "scripts", "terminus-authorize.mjs");
  }
  return join(homedir(), "projects", "caduceus", "scripts", "terminus-authorize.mjs");
}

let raw;
try {
  raw = readFileSync(0, "utf8");
} catch {
  writeRefuse();
}

const cli = resolveCaduceusCli();
if (!cli || !existsSync(cli) || resolve(cli) === SELF) {
  writeRefuse();
}

const spawned = spawnSync(process.execPath, [cli], {
  input: raw,
  encoding: "utf8",
  timeout: 8000,
  env: { ...process.env },
});
if (spawned.error || spawned.status === null) {
  writeRefuse();
}
process.stdout.write(spawned.stdout || `${JSON.stringify(unavailable)}\n`);
process.exit(spawned.status ?? 1);
