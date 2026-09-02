import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT, TERMINUS_CONTRACT_PIN, TERMINUS_CONTRACT_VERSION } from "./pins.mjs";

export class TerminusCoverageError extends Error {
  constructor(message) {
    super("TERMINUS_COVERAGE:" + message);
    this.name = "TerminusCoverageError";
  }
}

export function defaultCoveragePath() {
  return join(dirname(fileURLToPath(import.meta.url)), "omnisclaw-terminus-v1.json");
}

export function loadCoverage(path = defaultCoveragePath()) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  assertCoverageInvariants(raw);
  return raw;
}

export function assertCoverageInvariants(m) {
  if (m.schema !== "TerminusCoverageManifestV1") throw new TerminusCoverageError("schema");
  if (m.product !== PRODUCT) throw new TerminusCoverageError("product");
  if (m.contract_version !== TERMINUS_CONTRACT_VERSION && m.contract_version !== "1.0.0") {
    throw new TerminusCoverageError("contract_version");
  }
  if (m.caduceus_pin !== TERMINUS_CONTRACT_PIN) throw new TerminusCoverageError("caduceus_pin");
  if (!Array.isArray(m.routes) || m.routes.length < 1)
    throw new TerminusCoverageError("routes_empty");
  const ids = new Set();
  for (const route of m.routes) {
    if (ids.has(route.route_id)) throw new TerminusCoverageError("duplicate:" + route.route_id);
    ids.add(route.route_id);
    if (
      route.status !== "GOVERNED" &&
      route.status !== "DISABLED" &&
      route.status !== "UNENFORCED"
    ) {
      throw new TerminusCoverageError(
        "illegal_status:" + route.route_id + ":" + String(route.status),
      );
    }
  }
}

export function lookupRoute(m, routeId) {
  if (!routeId) return undefined;
  return m.routes.find((route) => route.route_id === routeId);
}
