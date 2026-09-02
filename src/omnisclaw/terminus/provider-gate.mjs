import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideTerminusEgress, terminusEnabled } from "./egress-gate.mjs";
import { OPENCLAW_PROVIDER_CHAT } from "./pins.mjs";
import {
  assertHonestReceipt,
  buildProviderGateReceipt,
  buildTerminusReceipt,
  canonicalJson,
  digestCanonical,
  verifyProviderGateReceiptPair,
} from "./receipts.mjs";

export const DEFAULT_PROVIDER_TARGET = {
  provider: "minimax",
  scheme: "https",
  hostname: "api.minimax.io",
  port: 443,
  path: "/v1/chat/completions",
  model: "MiniMax-M3",
  residency: "CN",
  api_shape: "openai_chat",
};

const KEY_ENV_CANDIDATES = [
  { envVar: "MINIMAX_API_KEY", provider: "minimax" },
  { envVar: "OPENAI_API_KEY", provider: "openai" },
];

export function defaultFixturePath() {
  return join(dirname(fileURLToPath(import.meta.url)), "provider-gate-fixture.json");
}

export function loadProviderGateFixture(path = defaultFixturePath()) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function resolveProviderCredentials(env = process.env) {
  for (const candidate of KEY_ENV_CANDIDATES) {
    const apiKey = String(env[candidate.envVar] ?? "").trim();
    if (apiKey) {
      return { ok: true, provider: candidate.provider, envVar: candidate.envVar, apiKey };
    }
  }
  return {
    ok: false,
    provider: null,
    envVar: null,
    apiKey: null,
    reason: "provider_key_missing",
  };
}

export function buildProviderRequestBody(target, prompt = "Reply with exactly: ACK") {
  return {
    model: target.model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 16,
    temperature: 0,
  };
}

export function providerRequestUrl(target) {
  return `${target.scheme}://${target.hostname}:${target.port}${target.path}`;
}

const PROVIDER_RESIDENCY = {
  minimax: "CN",
  openai: "US",
  anthropic: "US",
  google: "US",
  ollama: "LOCAL",
};

// Semantically unknown providers are never governable. A target that resolves
// to residency GLOBAL must refuse, never allow (Pan gate 2026-09-02).
const KNOWN_PROVIDER_TRANSPORTS = new Set(Object.keys(PROVIDER_RESIDENCY));

export function isKnownProviderTransport(provider) {
  return KNOWN_PROVIDER_TRANSPORTS.has(
    String(provider ?? "")
      .trim()
      .toLowerCase(),
  );
}

export function resolveProviderResidency(provider) {
  const normalized = String(provider ?? "")
    .trim()
    .toLowerCase();
  return PROVIDER_RESIDENCY[normalized] ?? "GLOBAL";
}

export function resolveApiShape(api) {
  const normalized = String(api ?? "")
    .trim()
    .toLowerCase();
  if (normalized.includes("responses")) return "openai_responses";
  if (normalized.includes("anthropic")) return "anthropic_messages";
  if (normalized.includes("ollama")) return "ollama_chat";
  if (normalized.includes("completion") || normalized.includes("chat")) return "openai_chat";
  return "provider_native";
}

export function resolveProviderTransportTarget(model, url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  const provider = String(model?.provider ?? "").trim();
  const modelId = String(model?.id ?? "").trim();
  const api = String(model?.api ?? "").trim();
  if (!provider || !modelId || !api) {
    return null;
  }
  if (!isKnownProviderTransport(provider)) {
    return null;
  }
  const port = parsed.port
    ? Number.parseInt(parsed.port, 10)
    : parsed.protocol === "https:"
      ? 443
      : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  const path = parsed.pathname || "/";
  if (!path.startsWith("/")) {
    return null;
  }
  return {
    provider,
    scheme: parsed.protocol.replace(":", ""),
    hostname: parsed.hostname.toLowerCase(),
    port,
    path,
    model: modelId,
    residency: resolveProviderResidency(provider),
    api_shape: resolveApiShape(api),
  };
}

export function decideProviderTransportEgress(model, url, env = process.env) {
  if (!terminusEnabled(env)) {
    return { allow: true, skipped: true };
  }
  const target = resolveProviderTransportTarget(model, url);
  return decideTerminusEgress({
    routeId: OPENCLAW_PROVIDER_CHAT,
    ...(target ? { target } : { target: { provider: "unknown" } }),
  });
}

export function assertSecretFreeProviderArtifacts(artifacts) {
  const haystack = canonicalJson({
    started: artifacts.started ?? null,
    terminal: artifacts.terminal ?? null,
    refusal: artifacts.refusal ?? null,
  });
  const needles = [];
  if (artifacts.apiKey) needles.push(artifacts.apiKey);
  if (artifacts.prompt) needles.push(artifacts.prompt);
  if (artifacts.responseText) {
    const snippet = artifacts.responseText.slice(0, 200);
    if (snippet.length >= 8) needles.push(snippet);
  }
  for (const needle of needles) {
    if (needle && haystack.includes(needle)) {
      throw new Error("PROVIDER_GATE_SECRET_EGRESS:" + String(needle).slice(0, 8));
    }
  }
  if (/sk-[A-Za-z0-9]{8,}/.test(haystack)) {
    throw new Error("PROVIDER_GATE_SECRET_EGRESS:sk_pattern");
  }
  return true;
}

function refuseProviderGate(reason, status = "UNENFORCED") {
  const refusal = buildTerminusReceipt({
    decision: "REFUSE",
    reason,
    routeId: OPENCLAW_PROVIDER_CHAT,
    status,
  });
  assertHonestReceipt(refusal);
  assertSecretFreeProviderArtifacts({ refusal });
  return {
    ok: false,
    live: false,
    owed: reason === "provider_key_missing",
    provider_calls: 0,
    refusal,
    started: null,
    terminal: null,
  };
}

let lastTransportHeaderPair = null;

export function getLastTransportHeaderPair() {
  return lastTransportHeaderPair;
}

/** STARTED + TERMINAL from URL + status only. Does not read the stream body. */
export function buildTransportHeaderReceiptPair(input = {}) {
  const target = input.target;
  const url = String(input.url ?? "");
  const status = input.status;
  if (!target || !url || typeof status !== "number") {
    lastTransportHeaderPair = null;
    return { ok: false, reason: "transport_pair_input", started: null, terminal: null };
  }
  const requestId = input.requestId ?? randomUUID();
  const envelopeId = input.envelopeId ?? envelopeIdFor(requestId, { url, streamed: true });
  const targetDigest = digestCanonical(target);
  const bodyDigest = digestCanonical({ url, streamed: true });
  const started = startedReceiptFields({ requestId, envelopeId, targetDigest, bodyDigest });
  const terminal = terminalReceiptFields({
    requestId,
    envelopeId,
    targetDigest,
    bodyDigest,
    responseDigest: null,
    providerHttpStatus: status,
    startedReceiptSha256: started.receiptSha256,
    reason: "transport_headers_only",
  });
  const pair = verifyProviderGateReceiptPair(started, terminal);
  lastTransportHeaderPair = {
    started,
    terminal,
    pair,
    body_digested: false,
    streamed: true,
  };
  return lastTransportHeaderPair;
}

function envelopeIdFor(requestId, target) {
  return digestCanonical({ request_id: requestId, target }).slice(0, 32);
}

function startedReceiptFields(input) {
  return buildProviderGateReceipt({
    decision: "ALLOW",
    reason: "provider_gate_started",
    routeId: OPENCLAW_PROVIDER_CHAT,
    status: "GOVERNED",
    phase: "STARTED",
    request_id: input.requestId,
    envelope_id: input.envelopeId,
    target_digest: input.targetDigest,
    body_digest: input.bodyDigest,
    response_digest: null,
    provider_http_status: null,
    prev_receipt_sha256: null,
  });
}

function terminalReceiptFields(input) {
  const succeeded =
    typeof input.providerHttpStatus === "number" &&
    input.providerHttpStatus >= 200 &&
    input.providerHttpStatus < 300;
  return buildProviderGateReceipt({
    decision: succeeded ? "ALLOW" : "REFUSE",
    reason: input.reason ?? (succeeded ? "provider_gate_completed" : "provider_http_error"),
    routeId: OPENCLAW_PROVIDER_CHAT,
    status: succeeded ? "GOVERNED" : "UNENFORCED",
    phase: "TERMINAL",
    request_id: input.requestId,
    envelope_id: input.envelopeId,
    target_digest: input.targetDigest,
    body_digest: input.bodyDigest,
    response_digest: input.responseDigest,
    provider_http_status: input.providerHttpStatus,
    prev_receipt_sha256: input.startedReceiptSha256,
  });
}

export async function governedProviderCall(input = {}) {
  const env = input.env ?? process.env;
  const fetchImpl = input.fetch ?? globalThis.fetch;
  const target = input.target ?? DEFAULT_PROVIDER_TARGET;
  const prompt = input.prompt ?? "Reply with exactly: ACK";

  if (!isKnownProviderTransport(target?.provider)) {
    return refuseProviderGate("unknown_provider", "UNKNOWN");
  }
  const egress = decideTerminusEgress({ routeId: OPENCLAW_PROVIDER_CHAT, target });
  if (!egress.allow) {
    return refuseProviderGate(egress.receipt.reason, egress.receipt.status);
  }

  const creds = resolveProviderCredentials(env);
  if (!creds.ok) {
    return refuseProviderGate(creds.reason);
  }

  const requestId = input.requestId ?? randomUUID();
  const envelopeId = input.envelopeId ?? envelopeIdFor(requestId, target);
  const body = buildProviderRequestBody(target, prompt);
  const bodyDigest = digestCanonical(body);
  const targetDigest = digestCanonical(target);
  const started = startedReceiptFields({
    requestId,
    envelopeId,
    targetDigest,
    bodyDigest,
  });

  const url = providerRequestUrl(target);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + creds.apiKey,
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  const responseDigest = createHash("sha256").update(responseText, "utf8").digest("hex");
  const terminal = terminalReceiptFields({
    requestId,
    envelopeId,
    targetDigest,
    bodyDigest,
    responseDigest,
    providerHttpStatus: response.status,
    startedReceiptSha256: started.receiptSha256,
    reason: response.ok ? "provider_gate_completed" : "provider_http_error",
  });

  const pair = verifyProviderGateReceiptPair(started, terminal);
  if (!pair.ok) {
    throw new Error("PROVIDER_GATE_RECEIPT_PAIR:" + pair.reason);
  }

  assertSecretFreeProviderArtifacts({
    started,
    terminal,
    apiKey: creds.apiKey,
    prompt,
    responseText,
  });

  return {
    ok: response.ok,
    live: input.fixture ? false : true,
    owed: false,
    provider_calls: 1,
    provider_http_status: response.status,
    response_digest: responseDigest,
    started,
    terminal,
    refusal: null,
  };
}

export async function governedProviderCallFromFixture(input = {}) {
  const fixture = input.fixture ?? loadProviderGateFixture(input.fixturePath);
  const target = input.target ?? fixture.target;
  const responseText = fixture.response_body;
  const fetchImpl = async () => ({
    ok: fixture.provider_http_status >= 200 && fixture.provider_http_status < 300,
    status: fixture.provider_http_status,
    text: async () => responseText,
  });
  return governedProviderCall({
    ...input,
    target,
    requestId: fixture.request_id,
    envelopeId: fixture.envelope_id,
    fetch: fetchImpl,
    env: { ...(input.env ?? {}), MINIMAX_API_KEY: "fixture-minimax-key-not-real" },
    fixture: true,
  });
}
