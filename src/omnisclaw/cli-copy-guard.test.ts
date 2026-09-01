import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GUARD = join(ROOT, "scripts/check-cli-copy.mjs");

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

describe("cli-copy build guard", () => {
  it("the production walk is clean against rewrite wrappers and exemptions", () => {
    const out = spawnSync(process.execPath, [GUARD], {
      encoding: "utf8",
      cwd: ROOT,
    });
    expect(out.status, out.stderr || out.stdout).toBe(0);
    expect(out.stdout).toMatch(/walk clean/);
  });

  it("can-fail: unwrapped user-facing command copy fails the build guard", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-copy-unwrapped-"));
    dirs.push(dir);
    mkdirSync(join(dir, "sneak"), { recursive: true });
    writeFileSync(
      join(dir, "sneak", "recovery.ts"),
      `export const HINT = "run openclaw skills list after restore";\n`,
    );
    const out = runGuard(dir);
    expect(out.status).toBe(2);
    expect(out.stderr).toMatch(/sneak\/recovery\.ts/);
    expect(out.stderr).toMatch(/openclaw skills list/);
  });

  it("does not fail formatCliCommand template helpers", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-copy-wrapped-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "ok.ts"),
      `import { formatCliCommand } from "./command-format.js";\nexport const hint = formatCliCommand("openclaw doctor --fix");\n`,
    );
    const out = runGuard(dir);
    expect(out.status, out.stderr || out.stdout).toBe(0);
  });

  it("can-fail: unwrapped CLI argv arrays fail the build guard", () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-copy-argv-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "approve.ts"),
      `export function hint(id: string) {\n  return ["openclaw", "devices", "approve", id].join(" ");\n}\n`,
    );
    const out = runGuard(dir);
    expect(out.status).toBe(2);
    expect(out.stderr).toMatch(/approve\.ts/);
    expect(out.stderr).toMatch(/argv/);
  });
});
