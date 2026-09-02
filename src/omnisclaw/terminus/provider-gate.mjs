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
  openrouter: "US",
  xai: "US",
};

// Legitimacy is BINDING, never a name list (Pan gate round 2, 2026-09-02: a
// hardcoded 5-provider allowlist broke real openrouter/xai traffic, and no
// list can cover 40+ provider plugins + operator customs). A target is
// legitimate iff the request URL's origin matches the MODEL'S OWN baseUrl
// origin — the endpoint the registry issued that model. No baseUrl, or a
// mismatch, resolves to null and every downstream refuses. Residency below is
// a receipt label only; it never decides.
function resolveModelBaseOrigin(model) {
  let parsed;
  try {
    parsed = new URL(String(model?.baseUrl ?? "").trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
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
  return {
    scheme: parsed.protocol.replace(":", ""),
    hostname: parsed.hostname.toLowerCase(),
    port,
  };
}

// Closed by KEY_ENV_CANDIDATES: governed LIVE calls can only spend the two
// key types this gate resolves (minimax, openai). No third entry can arrive
// without touching the credential list directly above — keep them adjacent.
// This maps a resolved credential to the model the live call binds; it is
// not a provider allowlist.
export const KEYED_PROVIDER_ENDPOINTS = {
  minimax: {
    baseUrl: "https://api.minimax.io",
    chatPath: "/v1/chat/completions",
    model: "MiniMax-M3",
  },
  openai: { baseUrl: "https://api.openai.com", chatPath: "/v1/responses", model: "gpt-5.4" },
};

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
  // Binding: the request must go where THIS model was issued to go. A model
  // without a baseUrl is not a legitimate egress principal; a URL anywhere
  // else (even for a well-known provider name) is exfiltration-shaped.
  const base = resolveModelBaseOrigin(model);
  if (!base) {
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
  const scheme = parsed.protocol.replace(":", "");
  const hostname = parsed.hostname.toLowerCase();
  if (scheme !== base.scheme || hostname !== base.hostname || port !== base.port) {
    return null;
  }
  return {
    provider,
    scheme,
    hostname,
    port,
    path,
    model: modelId,
    residency: resolveProviderResidency(provider),
    api_shape: resolveApiShape(api),
    bound: true,
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
  const requested = input.target ?? DEFAULT_PROVIDER_TARGET;
  const prompt = input.prompt ?? "Reply with exactly: ACK";

  // Governed calls spend credentials, so the target must be bound to a model
  // (re-resolved here — a raw hostname is never trusted on arrival).
  let target = requested;
  if (input.model) {
    const bound = resolveProviderTransportTarget(input.model, providerRequestUrl(requested));
    if (!bound) {
      return refuseProviderGate("target_origin_mismatch", "UNBOUND");
    }
    target = bound;
  } else if (requested?.bound !== true) {
    return refuseProviderGate("target_unbound", "UNBOUND");
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
  // The fixture endpoint is the bound truth for fixture calls: synthesize the
  // model it implies so the call proves through the same binding as live.
  const fixtureTarget = target ?? DEFAULT_PROVIDER_TARGET;
  const model = input.model ?? {
    provider: fixtureTarget.provider,
    id: fixtureTarget.model,
    api: String(fixtureTarget.api_shape ?? "").replaceAll("_", "-") || "fixture",
    baseUrl: `${fixtureTarget.scheme}://${fixtureTarget.hostname}:${fixtureTarget.port}`,
  };
  const responseText = fixture.response_body;
  const fetchImpl = async () => ({
    ok: fixture.provider_http_status >= 200 && fixture.provider_http_status < 300,
    status: fixture.provider_http_status,
    text: async () => responseText,
  });
  return governedProviderCall({
    ...input,
    model,
    target,
    requestId: fixture.request_id,
    envelopeId: fixture.envelope_id,
    fetch: fetchImpl,
    env: { ...(input.env ?? {}), MINIMAX_API_KEY: "fixture-minimax-key-not-real" },
    fixture: true,
  });
}
