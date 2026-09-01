#!/usr/bin/env node
/**
 * Build guard: user-facing `openclaw <subcommand>` string literals in src/,
 * extensions/, and packages/ must go through formatCliCommand / replaceCliName /
 * formatInlineCliCommand, or be listed in scripts/cli-copy-exemptions.json.
 *
 * Also flags CLI argv arrays `["openclaw", "<subcommand>"` unless a rewrite
 * wrapper is in the nearby window (template helpers that join then wrap).
 *
 * Test files do not count. Comments do not count.
 * Exit 0 = copy walk clean. Exit 2 = unwrapped user-facing CLI copy.
 *
 * --src DIR overrides the tree (can-fail fixtures).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MANIFEST = join(ROOT, "scripts/cli-copy-exemptions.json");

const srcArg = process.argv.indexOf("--src");
const OVERRIDE_SRC = srcArg >= 0 && process.argv[srcArg + 1] ? process.argv[srcArg + 1] : null;
const SCAN_DIRS = OVERRIDE_SRC
  ? [OVERRIDE_SRC]
  : [join(ROOT, "src"), join(ROOT, "extensions"), join(ROOT, "packages")];

const SKIP_FILE =
  /\.(test|test-support|test-helpers|test-helper|test-fixtures)\.[cm]?[jt]sx?$|e2e\.test-support\.[cm]?[jt]sx?$/;
const SKIP_PATH = /(^|\/)(test|test-utils\/fixtures)(\/|$)|test-support|test-helpers|test-helper/;

// Subcommand, not a TypeScript `openclaw as Foo` cast or `import * as openclaw from`.
const CMD_RE = /(?<![./@\w-])openclaw (?!as\b|from\b|import\b)[a-z]/g;
const ARGV_RE =
  /\[\s*["']openclaw["']\s*,\s*["'](devices|nodes|hooks|gateway|skills|plugins|doctor|onboard|completion|channels|config|models|pairing|sessions|backup|matrix|browser|agents|logs|health|dashboard|configure|setup|status|update|uninstall|cron|memory|node|proxy)["']/g;
const WRAPPER_RE =
  /\b(?:formatCliCommand|replaceCliName|formatInlineCliCommand|formatCliArgs)\s*\(/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
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

function relPosix(abs) {
  return relative(OVERRIDE_SRC ?? ROOT, abs)
    .split("\\")
    .join("/");
}

function isWrapped(text, index) {
  const start = Math.max(0, index - 240);
  const end = Math.min(text.length, index + 400);
  return WRAPPER_RE.test(text.slice(start, index)) || WRAPPER_RE.test(text.slice(index, end));
}

function hitsInFile(text) {
  const hits = [];
  CMD_RE.lastIndex = 0;
  let m;
  while ((m = CMD_RE.exec(text))) {
    if (isWrapped(text, m.index)) continue;
    const line = text.slice(0, m.index).split("\n").length;
    const snippet = text.slice(m.index, Math.min(text.length, m.index + 48)).replace(/\s+/g, " ");
    hits.push({ line, snippet });
  }
  ARGV_RE.lastIndex = 0;
  while ((m = ARGV_RE.exec(text))) {
    if (isWrapped(text, m.index)) continue;
    const line = text.slice(0, m.index).split("\n").length;
    const snippet = text.slice(m.index, Math.min(text.length, m.index + 48)).replace(/\s+/g, " ");
    hits.push({ line, snippet: `argv ${snippet}` });
  }
  return hits;
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const exemptFiles = new Set((manifest.sites ?? []).map((s) => s.file));

const unwrapped = [];
for (const dir of SCAN_DIRS) {
  let files;
  try {
    files = walk(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    const rel = relPosix(file);
    if (SKIP_FILE.test(rel) || SKIP_PATH.test(rel)) continue;
    if (exemptFiles.has(rel)) continue;
    const text = stripComments(readFileSync(file, "utf8"));
    const hits = hitsInFile(text);
    if (hits.length) unwrapped.push({ file: rel, hits });
  }
}

if (unwrapped.length) {
  console.error("cli-copy: unwrapped user-facing `openclaw <subcommand>` literals:");
  for (const entry of unwrapped.sort((a, b) => a.file.localeCompare(b.file))) {
    for (const hit of entry.hits) {
      console.error(`  ${entry.file}:${hit.line}: ${hit.snippet}`);
    }
  }
  process.exit(2);
}

const listed = (manifest.sites ?? []).length;
console.log(`cli-copy: ${listed} exempted site(s), walk clean`);
