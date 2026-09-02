import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  actionGateEnabled,
  authorizeActionCli,
  defaultCliPath,
  packagedAuthorizePath,
} from "./action-gate.mjs";

describe("OMNISCLAW TERMINUS action gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off under vitest unless CADUCEUS is pointed at", () => {
    expect(actionGateEnabled({ VITEST: "true" })).toBe(false);
  });

  it("is off when OMNISCLAW_TERMINUS_ACTION=0 even outside vitest", () => {
    expect(
      actionGateEnabled({
        OMNISCLAW_TERMINUS_ACTION: "0",
        TERMINUS_AUTHORIZE: "/no/such/terminus-authorize.mjs",
      }),
    ).toBe(false);
  });

  it("is on when TERMINUS_ACTION_GATE=1 even if CLI is missing (fail-closed later)", () => {
    expect(
      actionGateEnabled({
        TERMINUS_ACTION_GATE: "1",
        TERMINUS_AUTHORIZE: "/no/such/terminus-authorize.mjs",
      }),
    ).toBe(true);
  });

  it("is on by default outside vitest even if the CLI path is missing", () => {
    expect(
      actionGateEnabled({
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

    const spawnSrc = readFileSync(join(root, "process/exec-spawn.ts"), "utf8");
    const spawnFn = spawnSrc.slice(spawnSrc.indexOf("export function spawnCommandWithInvocation"));
    expect(spawnFn.indexOf("assertTerminusAllow")).toBeGreaterThan(-1);
    expect(spawnFn.indexOf("assertTerminusAllow")).toBeLessThan(spawnFn.indexOf("execa("));
  });

  it("ships scripts/terminus-authorize.mjs in the package files list", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const pin = join(root, "scripts", "terminus-authorize.mjs");
    expect(existsSync(pin)).toBe(true);
    expect(packagedAuthorizePath()).toBe(pin);
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.files).toContain("scripts/terminus-authorize.mjs");
  });

  it("live CLI: ALLOW echo and REFUSE rm -rf /", () => {
    const cli = join(
      process.env.HOME || "",
      "projects",
      "caduceus",
      "scripts",
      "terminus-authorize.mjs",
    );
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
