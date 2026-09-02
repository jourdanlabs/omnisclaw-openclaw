#!/usr/bin/env node
/**
 * Track C prove: one governed provider call with dual receipts.
 * Live turn is OWED when keys are absent — fixture path proves the gate.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = join(root, "src/omnisclaw/terminus");
const liveArtifactPath = join(artifactsDir, "provider-gate-live-artifact.json");

function fail(msg) {
  console.error(JSON.stringify({ ok: false, prove: "provider-gate", error: msg }, null, 2));
  process.exit(1);
}

const gateUrl = pathToFileURL(join(root, "src/omnisclaw/terminus/provider-gate.mjs")).href;
const {
  governedProviderCall,
  governedProviderCallFromFixture,
  resolveProviderCredentials,
  assertSecretFreeProviderArtifacts,
  decideProviderTransportEgress,
  buildTransportHeaderReceiptPair,
  resolveProviderTransportTarget,
  KEYED_PROVIDER_ENDPOINTS,
} = await import(gateUrl);

const minimaxModel = {
  id: "MiniMax-M3",
  provider: "minimax",
  api: "openai-completions",
  baseUrl: "https://api.minimax.io",
};

const missing = await governedProviderCall({
  model: minimaxModel,
  env: { MINIMAX_API_KEY: "", OPENAI_API_KEY: "" },
  fetch: async () => {
    throw new Error("fetch_must_not_run_without_key");
  },
});
if (missing.ok !== false || missing.refusal?.reason !== "provider_key_missing") {
  fail("missing_key_refusal");
}
if (missing.provider_calls !== 0 || missing.owed !== true) {
  fail("missing_key_owed");
}
assertSecretFreeProviderArtifacts({ refusal: missing.refusal });

const transportAllow = decideProviderTransportEgress(
  minimaxModel,
  "https://api.minimax.io/v1/chat/completions",
);
if (!transportAllow.allow) {
  fail("transport_gate_refused_valid_target");
}
const transportRefuse = decideProviderTransportEgress({ provider: "openai" }, "not-a-url");
if (transportRefuse.allow !== false || transportRefuse.receipt?.reason !== "unknown_target") {
  fail("transport_gate_did_not_refuse_unknown_target");
}

const transportSource = readFileSync(join(root, "src/agents/provider-transport-fetch.ts"), "utf8");
if (
  !/function buildGuardedModelFetch[\s\S]*decideProviderTransportEgress\(model, url\)/.test(
    transportSource,
  )
) {
  fail("transport_join_missing");
}
if (!transportSource.includes("buildTransportHeaderReceiptPair")) {
  fail("transport_header_receipts_missing");
}
const headerTarget = resolveProviderTransportTarget(
  minimaxModel,
  "https://api.minimax.io/v1/chat/completions",
);
const headerPair = buildTransportHeaderReceiptPair({
  target: headerTarget,
  url: "https://api.minimax.io/v1/chat/completions",
  status: 200,
});
if (!headerPair?.pair?.ok || headerPair.body_digested !== false) {
  fail("transport_header_receipts");
}

const creds = resolveProviderCredentials(process.env);
const fixture = await governedProviderCallFromFixture();
if (!fixture.ok || fixture.provider_calls !== 1) {
  fail("fixture_gate_failed");
}
if (!fixture.started?.receiptSha256 || !fixture.terminal?.receiptSha256) {
  fail("fixture_dual_receipt_missing");
}
if (fixture.terminal.prev_receipt_sha256 !== fixture.started.receiptSha256) {
  fail("fixture_receipt_chain_break");
}

let live = null;
let liveHappened = false;
if (creds.ok) {
  // Live spends a real key: bind the call to the credential's own endpoint.
  // Previously this posted whichever key existed to the minimax default URL.
  const ep = KEYED_PROVIDER_ENDPOINTS[creds.provider];
  if (!ep) {
    fail(`live_credential_without_endpoint:${creds.provider}`);
  }
  const liveModel = {
    id: ep.model,
    provider: creds.provider,
    api: "openai-chat",
    baseUrl: ep.baseUrl,
  };
  const liveTarget = resolveProviderTransportTarget(liveModel, ep.baseUrl + ep.chatPath);
  if (!liveTarget) {
    fail("live_target_unbound");
  }
  live = await governedProviderCall({ model: liveModel, target: liveTarget, env: process.env });
  liveHappened = live.live === true && live.provider_calls === 1;
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(
    liveArtifactPath,
    JSON.stringify(
      {
        schema: "OmnisclawProviderGateLiveArtifactV1",
        at: new Date().toISOString(),
        provider: creds.provider,
        env_var: creds.envVar,
        provider_http_status: live.provider_http_status,
        response_digest: live.response_digest,
        started_receipt_sha256: live.started?.receiptSha256 ?? null,
        terminal_receipt_sha256: live.terminal?.receiptSha256 ?? null,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

const report = {
  ok: true,
  card: "OMNISCLAW-PROVIDER-GATE-V1",
  status: liveHappened ? "LIVE_PROVEN" : "BUILT_FIXTURE_PROVEN_LIVE_OWED",
  shipped: false,
  deployed: false,
  caduceus_joined: false,
  live_provider_claimed: liveHappened,
  live_turn: liveHappened ? "DONE" : "OWED",
  prove: "dual-receipt-provider-gate",
  transport_join: {
    ok: true,
    seam: "buildGuardedModelFetch",
    gate: "decideProviderTransportEgress",
    unknown_target_refused: true,
    checks_provider_key: false,
    header_receipts: true,
    body_digested: false,
  },
  missing_key_refusal: {
    ok: missing.ok,
    owed: missing.owed,
    reason: missing.refusal?.reason ?? null,
  },
  fixture: {
    ok: fixture.ok,
    provider_calls: fixture.provider_calls,
    started: fixture.started.receiptSha256,
    terminal: fixture.terminal.receiptSha256,
  },
  live: liveHappened
    ? {
        ok: live.ok,
        provider: creds.provider,
        env_var: creds.envVar,
        provider_http_status: live.provider_http_status,
        response_digest: live.response_digest,
        artifact: liveArtifactPath,
      }
    : {
        ok: false,
        owed: true,
        reason: creds.reason ?? "provider_key_missing",
        artifact: null,
      },
};

console.log(JSON.stringify(report, null, 2));
