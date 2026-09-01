#!/usr/bin/env node
/**
 * Build guard: every src/ child_process value import or createChildAdapter
 * import must be named in src/omnisclaw/terminus/spawn-exemptions.json.
 *
 * Type-only imports do not count. Test files do not count.
 * Exit 0 = coverage holds. Exit 2 = unlisted spawn site.
 *
 * --src DIR overrides the tree (can-fail fixtures).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DEFAULT_SRC = join(ROOT, "src");
const MANIFEST = join(ROOT, "src/omnisclaw/terminus/spawn-exemptions.json");

const srcArg = process.argv.indexOf("--src");
const SRC = srcArg >= 0 && process.argv[srcArg + 1] ? process.argv[srcArg + 1] : DEFAULT_SRC;

const SKIP_FILE =
  /\.(test|test-support|test-helpers|test-helper)\.[cm]?[jt]sx?$|e2e\.test-support\.[cm]?[jt]sx?$/;
const SKIP_PATH = /(^|\/)(test|test-utils\/fixtures)(\/|$)|test-support|test-helpers|test-helper/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      walk(p, out);
      continue;
    }
    if (!/\.([cm]?[jt]s|tsx)$/.test(name)) continue;
    out.push(p);
  }
  return out;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function isTypeOnlyImportClause(clause) {
  const c = clause.trim();
  if (c.startsWith("type ") && !c.includes("{")) return true;
  if (/^type\s*\{/.test(c)) return true;
  const m = c.match(/^\{([^}]+)\}$/);
  if (!m) return false;
  const specs = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return specs.length > 0 && specs.every((s) => s.startsWith("type "));
}

function hasChildProcessValueImport(text) {
  for (const m of text.matchAll(
    /import\s+(type\s+)?([^;]+?)\s+from\s+['"](?:node:child_process|child_process)['"]/g,
  )) {
    if (m[1]) continue;
    if (isTypeOnlyImportClause(m[2])) continue;
    return true;
  }
  if (/require\(\s*['"](?:node:child_process|child_process)['"]/.test(text)) return true;
  return false;
}

function hasCreateChildAdapterImport(text) {
  return /import\s+\{[^}]*\bcreateChildAdapter\b[^}]*\}\s+from\s+['"][^'"]+['"]/.test(text);
}

function relPosix(abs) {
  return relative(SRC, abs).split("\\").join("/");
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const listed = new Set((manifest.sites ?? []).map((s) => s.file));

const unlisted = [];
for (const file of walk(SRC)) {
  const rel = relPosix(file);
  if (SKIP_FILE.test(rel) || SKIP_PATH.test(rel)) continue;
  const text = stripComments(readFileSync(file, "utf8"));
  if (!hasChildProcessValueImport(text) && !hasCreateChildAdapterImport(text)) continue;
  if (!listed.has(rel)) unlisted.push(rel);
}

if (unlisted.length) {
  console.error("spawn-exemptions: unlisted child_process / createChildAdapter sites:");
  for (const f of unlisted.sort()) console.error(`  ${f}`);
  process.exit(2);
}

console.log(`spawn-exemptions: ${listed.size} listed sites, src walk clean`);
