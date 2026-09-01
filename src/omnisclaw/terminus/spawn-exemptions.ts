// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Jourdan Labs
// Declared non-supervisor spawn sites. The walk in check-spawn-exemptions.mjs
// is the build guard. This module is the typed view of the JSON manifest.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SpawnExemptionReason =
  | "gated-path"
  | "the-gate-itself"
  | "internal-worker"
  | "self-respawn"
  | "os-probe"
  | "fixed-argv"
  | "operator-config"
  | "test-harness";

export type SpawnExemption = {
  file: string;
  reason: SpawnExemptionReason;
  argvShape: string;
  modelDerived: false;
};

type Manifest = {
  schema: string;
  note: string;
  sites: SpawnExemption[];
};

const manifestPath = join(dirname(fileURLToPath(import.meta.url)), "spawn-exemptions.json");

export function loadSpawnExemptions(): Manifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
}

export const SPAWN_EXEMPTIONS = loadSpawnExemptions();

export const SPAWN_EXEMPTION_FILES = new Set(SPAWN_EXEMPTIONS.sites.map((s) => s.file));

/** Fields that mean argv came from a model/tool/request. Listed sites must not read these. */
export const MODEL_DERIVED_ARGV = [
  /\brequest\.(command|execCommand|argv)\b/,
  /\btool\.(command|execCommand|argv)\b/,
  /\bopts\.execCommand\b/,
  /\bparams\.execCommand\b/,
  /\bmodel\.(command|argv)\b/,
];

export function modelDerivedArgvHits(source: string): string[] {
  return MODEL_DERIVED_ARGV.flatMap((re) => source.match(re) ?? []).filter(Boolean);
}

export function assertNotModelDerived(file: string, source: string): void {
  const hits = modelDerivedArgvHits(source);
  if (hits.length > 0) {
    throw new Error(
      `${file} is listed as a spawn exemption but reads model/tool argv (${hits.join(", ")}). Move it onto assertTerminusAllow; do not exempt it.`,
    );
  }
}
