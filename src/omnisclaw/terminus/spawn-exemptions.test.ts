import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  SPAWN_EXEMPTIONS,
  assertNotModelDerived,
  modelDerivedArgvHits,
} from "./spawn-exemptions.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SRC = join(ROOT, "src");
const GUARD = join(ROOT, "scripts/check-spawn-exemptions.mjs");

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function runGuard(srcDir: string) {
  return spawnSync(process.execPath, [GUARD, "--src", srcDir], {
    encoding: "utf8",
    cwd: ROOT,
  });
}

describe("spawn-exemptions manifest (§G)", () => {
  it("every listed site exists and argv is not model-derived", () => {
    expect(SPAWN_EXEMPTIONS.sites.length).toBeGreaterThan(20);
    for (const site of SPAWN_EXEMPTIONS.sites) {
      expect(site.modelDerived, site.file).toBe(false);
      const abs = join(SRC, site.file);
      const source = readFileSync(abs, "utf8");
      if (site.reason === "gated-path" || site.reason === "the-gate-itself") {
        continue;
      }
      expect(() => assertNotModelDerived(site.file, source), site.file).not.toThrow();
    }
  });

  it("the src/ walk is clean against the manifest", () => {
    const out = runGuard(SRC);
    expect(out.status, out.stderr || out.stdout).toBe(0);
    expect(out.stdout).toMatch(/src walk clean/);
  });

  it("can-fail: unlisted child_process import fails the build guard", () => {
    const dir = mkdtempSync(join(tmpdir(), "spawn-ex-unlisted-"));
    dirs.push(dir);
    mkdirSync(join(dir, "sneak"), { recursive: true });
    writeFileSync(
      join(dir, "sneak", "model-shell.ts"),
      `import { spawn } from "node:child_process";\nspawn("sh", ["-c", "echo hi"]);\n`,
    );
    const out = runGuard(dir);
    expect(out.status).toBe(2);
    expect(out.stderr).toMatch(/sneak\/model-shell\.ts/);
  });

  it("can-fail: listed site reading request.command into argv fails not-model-derived", () => {
    const bad = `
      export function run(request: { command: string }) {
        const argv = [request.command];
        return argv;
      }
    `;
    expect(modelDerivedArgvHits(bad)).toContain("request.command");
    expect(() => assertNotModelDerived("agents/sandbox/ssh.ts", bad)).toThrow(/request\.command/);
  });
});
