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

  it("2.0 exec chokepoints call assertTerminusAllow before spawn", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const execSrc = readFileSync(join(root, "process/exec.ts"), "utf8");
    const runnerSrc = readFileSync(join(root, "process/exec-runner.ts"), "utf8");
    const bashSrc = readFileSync(join(root, "agents/bash-tools.exec-runtime.ts"), "utf8");

    const runExecFn = execSrc.slice(execSrc.indexOf("export async function runExec"));
    expect(runExecFn.indexOf("assertTerminusAllow")).toBeGreaterThan(-1);
    expect(runExecFn.indexOf("assertTerminusAllow")).toBeLessThan(
      runExecFn.indexOf("spawnCommand"),
    );

    const runnerFn = runnerSrc.slice(
      runnerSrc.indexOf("async function runCommandWithOutputEncoding"),
    );
    expect(runnerFn.indexOf("assertTerminusAllow")).toBeGreaterThan(-1);
    expect(runnerFn.indexOf("assertTerminusAllow")).toBeLessThan(
      runnerFn.indexOf("spawnCommandWithInvocation"),
    );

    const bashFn = bashSrc.slice(bashSrc.indexOf("export async function runExecProcess"));
    expect(bashFn.indexOf("assertTerminusAllow")).toBeGreaterThan(-1);
    expect(bashFn.indexOf("assertTerminusAllow")).toBeLessThan(bashFn.indexOf("const startedAt"));
    expect(bashFn).toMatch(/assertTerminusAllow\(opts\.execCommand/);
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
    const hold = authorizeActionCli(
      { agent_id: "claw", kind: "shell", payload: "touch /etc/hosts", session_id: "t" },
      { TERMINUS_AUTHORIZE: cli },
    );
    expect(hold.verdict).toBe("HOLD");
    const lifted = authorizeActionCli(
      {
        agent_id: "claw",
        kind: "shell",
        payload: "touch /etc/hosts",
        session_id: "t",
        human_override: true,
      },
      { TERMINUS_AUTHORIZE: cli },
    );
    expect(lifted.verdict).toBe("ALLOW");
    const noLift = authorizeActionCli(
      {
        agent_id: "claw",
        kind: "shell",
        payload: "rm -rf /",
        session_id: "t",
        human_override: true,
      },
      { TERMINUS_AUTHORIZE: cli },
    );
    expect(noLift.verdict).toBe("REFUSE");
  });
});
