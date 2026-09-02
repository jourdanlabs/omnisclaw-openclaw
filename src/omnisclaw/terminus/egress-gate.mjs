import { lookupRoute, loadCoverage } from "./coverage.mjs";
import { assertVendorPin, CHANNEL_AUTO_REPLY_FINAL } from "./pins.mjs";
import { assertHonestReceipt, buildTerminusReceipt } from "./receipts.mjs";

const AUTHORIZED_TARGET_FIELDS = [
  "provider",
  "scheme",
  "hostname",
  "port",
  "path",
  "model",
  "residency",
  "api_shape",
  // Set by resolveProviderTransportTarget when the target's origin matches the
  // model's own baseUrl origin. Part of the shape, not a bypass: unknown
  // fields still refuse.
  "bound",
];

// No kill-switch: the egress gate is always on. An OMNISCLAW_TERMINUS=0
// ambient bypass was removed (Pan gate 2026-09-02, C1 precedent) — a
// production env sniff must never silently disable the gate. Tests exercise
// the gate directly or inject explicit doubles at call sites; nothing ambient
// turns this off.
export function terminusEnabled() {
  return true;
}

export function decideTerminusEgress(input = {}) {
  assertVendorPin();
  const coverage = input.coverage ?? loadCoverage();
  const routeId = typeof input.routeId === "string" ? input.routeId.trim() : "";
  if (!routeId) return refuse(null, "UNKNOWN", "unknown_route");
  const route = lookupRoute(coverage, routeId);
  if (!route) return refuse(routeId, "UNKNOWN", "unknown_route");
  const targetReason = targetRefusalReason(input.target);
  if (targetReason) return refuse(routeId, route.status, targetReason);
  if (route.status === "DISABLED") {
    return refuse(routeId, "DISABLED", "route_not_governed:" + routeId + ":DISABLED");
  }
  if (route.status === "UNENFORCED") {
    return refuse(routeId, "UNENFORCED", "route_not_governed:" + routeId + ":UNENFORCED");
  }
  return {
    allow: true,
    receipt: buildTerminusReceipt({
      decision: "ALLOW",
      reason: "governed_route",
      routeId,
      status: "GOVERNED",
    }),
  };
}

export function applyOmnisclawTerminusToReplyPayload(payload, params = {}) {
  const env = params.env ?? process.env;
  if (!terminusEnabled(env)) return payload;
  if (
    payload.isError === true ||
    payload.isReasoning === true ||
    payload.isCompactionNotice === true
  ) {
    return payload;
  }
  const routeId = params.routeId ?? routeIdFromContext(params.ctx) ?? CHANNEL_AUTO_REPLY_FINAL;
  const result = decideTerminusEgress({
    routeId,
    target: params.target,
    coverage: params.coverage,
  });
  if (result.allow) return payload;
  return { ...payload, text: terminusRefusalText(result.receipt.reason) };
}

export function terminusRefusalText(reason) {
  return "Held back — TERMINUS refused this egress (" + reason + "). There is no send-anyway.";
}

export function refuseDirectProvider(_provider = "unknown") {
  return decideTerminusEgress({ routeId: "direct.provider.any" });
}

function refuse(routeId, status, reason) {
  const receipt = buildTerminusReceipt({ decision: "REFUSE", reason, routeId, status });
  assertHonestReceipt(receipt);
  return { allow: false, receipt };
}

function targetRefusalReason(target) {
  if (target == null) return null;
  if (typeof target !== "object" || Array.isArray(target)) return "unknown_target";
  const keys = Object.keys(target);
  if (keys.some((key) => !AUTHORIZED_TARGET_FIELDS.includes(key))) return "unknown_target";
  const provider = nonempty(target.provider);
  const scheme = nonempty(target.scheme);
  const hostname = nonempty(target.hostname);
  const path = nonempty(target.path);
  const model = nonempty(target.model);
  const residency = nonempty(target.residency);
  const apiShape = nonempty(target.api_shape);
  const port = target.port;
  if (!provider || !scheme || !hostname || !path || !model || !residency || !apiShape)
    return "unknown_target";
  if (scheme !== "http" && scheme !== "https") return "unknown_target";
  if (!path.startsWith("/")) return "unknown_target";
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535)
    return "unknown_target";
  return null;
}

function nonempty(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function routeIdFromContext(ctx) {
  if (!ctx) return undefined;
  const surface = String(ctx.Surface ?? ctx.Provider ?? "")
    .trim()
    .toLowerCase();
  if (!surface) return undefined;
  return CHANNEL_AUTO_REPLY_FINAL;
}
