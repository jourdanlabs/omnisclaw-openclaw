#!/usr/bin/env node
/**
 * Tight TERMINUS prove: refuse-on-unknown.
 * Built, not shipped. Does not deploy. Does not join CADUCEUS.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error(JSON.stringify({ ok: false, prove: "refuse-on-unknown", error: msg }, null, 2));
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

const pin = readFileSync(
  join(root, "src/omnisclaw/terminus", "TERMINUS_CONTRACT_PIN"),
  "utf8",
).trim();
assert(pin === "80874fd1d326facc6ae6af0416de35f9bdef0a33", "pin_mismatch:" + pin);

const coverage = JSON.parse(
  readFileSync(join(root, "src/omnisclaw/terminus", "omnisclaw-terminus-v1.json"), "utf8"),
);
assert(coverage.schema === "TerminusCoverageManifestV1", "coverage_schema");
assert(coverage.product === "omnis-claw", "coverage_product");
assert(coverage.caduceus_pin === pin, "coverage_pin");
const ids = coverage.routes.map((r) => r.route_id);
assert(new Set(ids).size === ids.length, "duplicate_route");
assert(ids.includes("channel.auto_reply.final"), "missing_telegram_route");

const gateUrl = pathToFileURL(join(root, "src/omnisclaw/terminus/egress-gate.mjs")).href;
const { decideTerminusEgress, refuseDirectProvider, applyOmnisclawTerminusToReplyPayload } =
  await import(gateUrl);

const missing = decideTerminusEgress({});
assert(missing.allow === false, "missing_route_allowed");
assert(missing.receipt.ok === false, "missing_route_ok");
assert(missing.receipt.pass === false, "missing_route_pass");
assert(missing.receipt.decision === "REFUSE", "missing_route_decision");
assert(missing.receipt.status === "UNKNOWN", "missing_route_status");
assert(missing.receipt.reason === "unknown_route", "missing_route_reason");
assert(/^[0-9a-f]{64}$/.test(missing.receipt.receiptSha256), "missing_route_receipt");

const unknown = decideTerminusEgress({ routeId: "not.a.route" });
assert(unknown.allow === false, "unknown_allowed");
assert(unknown.receipt.ok === false, "unknown_ok");
assert(unknown.receipt.pass === false, "unknown_pass");
assert(unknown.receipt.reason === "unknown_route", "unknown_reason");
assert(unknown.receipt.status === "UNKNOWN", "unknown_status");

const incomplete = decideTerminusEgress({
  routeId: "channel.auto_reply.final",
  target: { provider: "minimax" },
});
assert(incomplete.allow === false, "incomplete_target_allowed");
assert(incomplete.receipt.reason === "unknown_target", "incomplete_target_reason");
assert(incomplete.receipt.ok === false, "incomplete_target_ok");

const unenforced = decideTerminusEgress({ routeId: "openclaw.provider.chat" });
assert(unenforced.allow === true, "provider_route_refused");
assert(unenforced.receipt.ok === true, "provider_route_ok");
assert(unenforced.receipt.pass === true, "provider_route_pass");
assert(unenforced.receipt.status === "GOVERNED", "provider_route_status");

const direct = refuseDirectProvider("minimax");
assert(direct.allow === false, "direct_allowed");
assert(direct.receipt.ok === false, "direct_ok");
assert(direct.receipt.status === "DISABLED", "direct_status");

const telegram = decideTerminusEgress({ routeId: "channel.auto_reply.final" });
assert(telegram.allow === true, "telegram_refused");
assert(telegram.receipt.ok === true, "telegram_not_ok");
assert(telegram.receipt.pass === true, "telegram_not_pass");
assert(telegram.receipt.reason === "governed_route", "telegram_reason");

const kept = applyOmnisclawTerminusToReplyPayload(
  { text: "Yo! I am here." },
  { ctx: { Body: "yo", Provider: "telegram", Surface: "telegram" } },
);
assert(kept.text === "Yo! I am here.", "telegram_text_rewritten");

const rewritten = applyOmnisclawTerminusToReplyPayload(
  { text: "should not leave" },
  { routeId: "not.a.route" },
);
assert(String(rewritten.text).includes("unknown_route"), "unknown_text_not_refused");
assert(!/send anyway/i.test(String(rewritten.text)), "send_anyway_offered");

const report = {
  ok: true,
  card: "OMNISCLAW-TERMINUS-EGRESS-V1",
  status: "BUILT_NOT_SHIPPED",
  shipped: false,
  deployed: false,
  caduceus_joined: false,
  live_provider_claimed: false,
  prove: "refuse-on-unknown",
  contract_pin: pin,
  governed_routes: coverage.routes.filter((r) => r.status === "GOVERNED").map((r) => r.route_id),
  telegram_route: "channel.auto_reply.final",
  unknown: {
    allow: unknown.allow,
    ok: unknown.receipt.ok,
    pass: unknown.receipt.pass,
    reason: unknown.receipt.reason,
  },
  telegram: { allow: telegram.allow, ok: telegram.receipt.ok, reason: telegram.receipt.reason },
};
console.log(JSON.stringify(report, null, 2));
