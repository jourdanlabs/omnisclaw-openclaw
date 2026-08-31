// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Jourdan Labs
// Canonical TERMINUS action gate — CLAW calls CADUCEUS, does not copy it.
// Fail-closed when the CLI is in play. Vitest skips unless TERMINUS_AUTHORIZE
// or CADUCEUS_ROOT is set (OpenClaw CI has no CADUCEUS process).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Walk up from this module to find the in-package pin (src/ or dist/). */
export function packagedAuthorizePath(fromUrl = import.meta.url) {
  let dir = dirname(fileURLToPath(fromUrl));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "scripts", "terminus-authorize.mjs");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function defaultCliPath(env = process.env) {
  if (env.TERMINUS_AUTHORIZE) return env.TERMINUS_AUTHORIZE;
  const packaged = packagedAuthorizePath();
  if (packaged) return packaged;
  const root = env.CADUCEUS_ROOT || join(homedir(), "projects", "caduceus");
  return join(root, "scripts", "terminus-authorize.mjs");
}

export function actionGateEnabled(env = process.env) {
  const flag = String(env.OMNISCLAW_TERMINUS_ACTION ?? env.TERMINUS_ACTION_GATE ?? "")
    .trim()
    .toLowerCase();
  if (flag === "0" || flag === "off" || flag === "false") return false;
  if (flag === "1" || flag === "on" || flag === "true") return true;
  // Vitest carve-out: OpenClaw CI has no CADUCEUS. Production default is ON.
  // Missing CLI is fail-closed in assertTerminusAllow / authorizeActionCli,
  // not a reason to skip the wrap.
  if (env.VITEST && !env.TERMINUS_AUTHORIZE && !env.CADUCEUS_ROOT) return false;
  return true;
}

export function authorizeActionCli(action, env = process.env) {
  const unavailable = {
    verdict: "REFUSE",
    decision: "REFUSE_SCANNER_FAILURE",
    reason: "terminus_unavailable",
    receipt: null,
  };
  const cli = defaultCliPath(env);
  if (!existsSync(cli)) return unavailable;
  const spawned = spawnSync(process.execPath, [cli], {
    input: JSON.stringify(action),
    encoding: "utf8",
    timeout: 8000,
    env: { ...env },
  });
  if (spawned.error) return unavailable;
  try {
    const out = JSON.parse(spawned.stdout || "");
    if (!out || !["ALLOW", "REFUSE", "HOLD"].includes(out.verdict)) return unavailable;
    return {
      verdict: out.verdict,
      decision: out.decision,
      reason: out.reason,
      receipt: out.receipt,
    };
  } catch {
    return unavailable;
  }
}

export function blockText(result) {
  const reason = result?.reason || "terminus";
  if (result?.verdict === "HOLD") {
    return `TERMINUS HOLD (${reason}): paused for human approval. No side effect ran.`;
  }
  return `TERMINUS REFUSED (${reason}): this action did not run.`;
}

/** Chokepoint for every CLAW process exec. Throws unless ALLOW. */
export function assertTerminusAllow(payload, session_id = "", env = process.env) {
  if (!actionGateEnabled(env)) return;
  const gated = authorizeActionCli(
    {
      agent_id: "claw",
      kind: "shell",
      payload: String(payload ?? ""),
      session_id: String(session_id ?? ""),
    },
    env,
  );
  if (gated.verdict !== "ALLOW") {
    throw new Error(blockText(gated));
  }
}
