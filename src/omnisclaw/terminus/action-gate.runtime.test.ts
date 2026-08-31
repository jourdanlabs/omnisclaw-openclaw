import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertTerminusAllow } from "./action-gate.mjs";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeMockCli(script: string): string {
  const dir = join(tmpdir(), `omnisclaw-terminus-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  dirs.push(dir);
  const path = join(dir, "terminus-authorize.mjs");
  writeFileSync(path, script);
  return path;
}

const REFUSE_RM = `#!/usr/bin/env node
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const action = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const payload = String(action.payload ?? "");
if (/rm\\s+-[-]?r/.test(payload) || payload.includes("find / -delete")) {
  process.stdout.write(JSON.stringify({
    verdict: "REFUSE",
    decision: "REFUSE_SECRET",
    reason: "catastrophic_delete",
    receipt: { kind: "terminus.action", payload_redacted: true },
  }));
  process.exit(0);
}
if (/^ls\\b|^git status|^npm test|^echo /.test(payload)) {
  process.stdout.write(JSON.stringify({
    verdict: "ALLOW",
    decision: "PERMIT",
    reason: "allow",
    receipt: { kind: "terminus.action", payload_redacted: true },
  }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({
  verdict: "HOLD",
  decision: "HOLD",
  reason: "ambiguous",
  receipt: { kind: "terminus.action", payload_redacted: true },
}));
`;

describe("TERMINUS on the 2.0 exec path (runtime)", () => {
  it("REFUSE rm -rf / and variants; ALLOW ls/git/npm; HOLD ambiguous; raw command not in receipt", async () => {
    const cli = writeMockCli(REFUSE_RM);
    const env = { TERMINUS_AUTHORIZE: cli, TERMINUS_ACTION_GATE: "1" };
    expect(() => assertTerminusAllow("rm -rf /", "s", env)).toThrow(/TERMINUS REFUSED/);
    expect(() => assertTerminusAllow("rm -r -f /", "s", env)).toThrow(/TERMINUS REFUSED/);
    expect(() => assertTerminusAllow("find / -delete", "s", env)).toThrow(/TERMINUS REFUSED/);
    expect(() => assertTerminusAllow("ls -la", "s", env)).not.toThrow();
    expect(() => assertTerminusAllow("git status", "s", env)).not.toThrow();
    expect(() => assertTerminusAllow("npm test", "s", env)).not.toThrow();
    expect(() => assertTerminusAllow("echo ok", "s", env)).not.toThrow();
    expect(() => assertTerminusAllow("touch /etc/hosts", "s", env)).toThrow(/TERMINUS HOLD/);
    const { authorizeActionCli } = await import("./action-gate.mjs");
    const refused = authorizeActionCli(
      { agent_id: "claw", kind: "shell", payload: "rm -rf /", session_id: "s" },
      env,
    );
    expect(JSON.stringify(refused.receipt ?? {})).not.toContain("rm -rf");
  });

  it("can-fail: assertTerminusAllow skipped means a catastrophic string is not blocked here", () => {
    // Weakening: call with the gate flag off. The 2.0 spawn path would then run.
    // This test proves the wiring is load-bearing — disable it and REFUSE does not fire.
    const cli = writeMockCli(REFUSE_RM);
    expect(() =>
      assertTerminusAllow("rm -rf /", "s", {
        TERMINUS_AUTHORIZE: cli,
        TERMINUS_ACTION_GATE: "0",
        VITEST: "true",
      }),
    ).not.toThrow();
  });
});
