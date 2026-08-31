import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProcessSupervisor } from "./supervisor.js";

const BASE = {
  sessionId: "bulma-terminus",
  backendId: "test",
};

describe("TERMINUS on supervisor.spawn", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses child / pty / anchored-shell before adapter dispatch when CLI is missing", async () => {
    vi.stubEnv("TERMINUS_ACTION_GATE", "1");
    vi.stubEnv("TERMINUS_AUTHORIZE", "/no/such/terminus-authorize.mjs");
    const supervisor = createProcessSupervisor();
    expect(() => supervisor.spawn({ ...BASE, mode: "child", argv: ["rm", "-rf", "/"] })).toThrow(
      /TERMINUS REFUSED/,
    );
    expect(() => supervisor.spawn({ ...BASE, mode: "pty", ptyCommand: "rm -rf /" })).toThrow(
      /TERMINUS REFUSED/,
    );
    expect(() =>
      supervisor.spawn({ ...BASE, mode: "anchored-shell", command: "rm -rf /" }),
    ).toThrow(/TERMINUS REFUSED/);
  });

  it("can-fail: gate off lets a real child echo run (wrap is load-bearing)", async () => {
    vi.stubEnv("TERMINUS_ACTION_GATE", "0");
    vi.stubEnv("VITEST", "true");
    const supervisor = createProcessSupervisor();
    const run = await supervisor.spawn({
      ...BASE,
      mode: "child",
      argv: [process.execPath, "-e", "process.stdout.write('supervisor-canfail')"],
      captureOutput: true,
    });
    const exit = await run.wait();
    expect(exit.stdout).toContain("supervisor-canfail");
    await supervisor.shutdown();
  });

  it("can-fail: neutralizing assertTerminusAllow lets a refused argv run", async () => {
    vi.resetModules();
    vi.doMock("../../omnisclaw/terminus/action-gate.mjs", () => ({
      assertTerminusAllow: () => undefined,
    }));
    vi.stubEnv("TERMINUS_ACTION_GATE", "1");
    vi.stubEnv("TERMINUS_AUTHORIZE", "/no/such/terminus-authorize.mjs");
    const { createProcessSupervisor } = await import("./supervisor.js");
    const supervisor = createProcessSupervisor();
    const run = await supervisor.spawn({
      ...BASE,
      mode: "child",
      argv: [process.execPath, "-e", "process.stdout.write('supervisor-neutralized')"],
      captureOutput: true,
    });
    const exit = await run.wait();
    expect(exit.stdout).toContain("supervisor-neutralized");
    await supervisor.shutdown();
    vi.doUnmock("../../omnisclaw/terminus/action-gate.mjs");
  });

  it("source-order: spawn() calls assertTerminusAllow before startRun", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "supervisor.ts"),
      "utf8",
    );
    const spawnFn = src.slice(src.indexOf("const spawn = (input: SpawnInput)"));
    expect(spawnFn.indexOf("assertTerminusAllow")).toBeGreaterThan(-1);
    expect(spawnFn.indexOf("assertTerminusAllow")).toBeLessThan(spawnFn.indexOf("startRun"));
  });
});
