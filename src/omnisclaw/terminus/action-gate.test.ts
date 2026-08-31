import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { actionGateEnabled, authorizeActionCli, defaultCliPath } from "./action-gate.mjs";

describe("OMNISCLAW TERMINUS action gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off under vitest unless CADUCEUS is pointed at", () => {
    expect(actionGateEnabled({ VITEST: "true" })).toBe(false);
  });

  it("is on when TERMINUS_ACTION_GATE=1 even if CLI is missing (fail-closed later)", () => {
    expect(
      actionGateEnabled({
        TERMINUS_ACTION_GATE: "1",
        TERMINUS_AUTHORIZE: "/no/such/terminus-authorize.mjs",
      }),
    ).toBe(true);
  });

  it("refuses when CLI is missing", () => {
    const out = authorizeActionCli(
      { agent_id: "claw", kind: "shell", payload: "echo ok", session_id: "t" },
      { TERMINUS_AUTHORIZE: "/no/such/terminus-authorize.mjs" },
    );
    expect(out.verdict).toBe("REFUSE");
    expect(out.reason).toBe("terminus_unavailable");
  });

  it("exec.ts chokepoints call assertTerminusAllow before spawn/execFile", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const execSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../process/exec.ts"),
      "utf8",
    );
    expect(execSrc).toContain("assertTerminusAllow");
    const runExecBody = execSrc.slice(execSrc.indexOf("export async function runExec"));
    const runExecFn = runExecBody.slice(
      0,
      runExecBody.indexOf("export function resolveProcessExitCode"),
    );
    expect(runExecFn.indexOf("assertTerminusAllow")).toBeGreaterThan(-1);
    expect(runExecFn.indexOf("assertTerminusAllow")).toBeLessThan(
      runExecFn.indexOf("execFileAsync"),
    );
    const timeoutBody = execSrc.slice(
      execSrc.indexOf("export async function runCommandWithTimeout"),
    );
    expect(timeoutBody.indexOf("assertTerminusAllow")).toBeGreaterThan(-1);
    expect(timeoutBody.indexOf("assertTerminusAllow")).toBeLessThan(timeoutBody.indexOf("spawn("));
  });

  it("live CLI: ALLOW echo and REFUSE rm -rf /", () => {
    const cli = defaultCliPath(process.env);
    if (!existsSync(cli)) return;
    const allow = authorizeActionCli(
      { agent_id: "claw", kind: "shell", payload: "echo ok", session_id: "t" },
      { TERMINUS_AUTHORIZE: cli },
    );
    expect(allow.verdict).toBe("ALLOW");
    const refuse = authorizeActionCli(
      { agent_id: "claw", kind: "shell", payload: "rm -rf /", session_id: "t" },
      { TERMINUS_AUTHORIZE: cli },
    );
    expect(refuse.verdict).toBe("REFUSE");
    expect(JSON.stringify(allow.receipt ?? {})).not.toContain("echo ok");
  });
});
