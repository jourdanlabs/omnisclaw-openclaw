import { createHash } from "node:crypto";
import { CARD, PRODUCT, TERMINUS_CONTRACT_PIN, TERMINUS_CONTRACT_VERSION } from "./pins.mjs";

export function buildTerminusReceipt(input) {
  const ok = input.decision === "ALLOW" && input.status === "GOVERNED";
  const pass = ok;
  if (input.decision === "REFUSE" && ok) throw new Error("TERMINUS_FAKE_PASS:refuse_marked_ok");
  if (input.status === "UNKNOWN" && ok) throw new Error("TERMINUS_FAKE_PASS:unknown_marked_ok");
  if (input.status === "UNENFORCED" && ok)
    throw new Error("TERMINUS_FAKE_PASS:unenforced_marked_ok");
  if (input.status === "DISABLED" && ok) throw new Error("TERMINUS_FAKE_PASS:disabled_marked_ok");
  const body = {
    card: CARD,
    contractPin: TERMINUS_CONTRACT_PIN,
    contractVersion: TERMINUS_CONTRACT_VERSION,
    decision: input.decision,
    ok,
    pass,
    product: PRODUCT,
    reason: input.reason,
    routeId: input.routeId,
    status: input.status,
  };
  const receiptSha256 = createHash("sha256").update(canonicalJson(body), "utf8").digest("hex");
  const receipt = { ...body, receiptSha256 };
  assertHonestReceipt(receipt);
  return receipt;
}

export function assertHonestReceipt(receipt) {
  if (receipt.decision === "REFUSE" && (receipt.ok || receipt.pass)) {
    throw new Error("TERMINUS_FAKE_PASS:refuse_receipt");
  }
  if (receipt.status === "UNKNOWN" && (receipt.ok || receipt.pass)) {
    throw new Error("TERMINUS_FAKE_PASS:unknown_receipt");
  }
  if (receipt.pass !== receipt.ok) throw new Error("TERMINUS_FAKE_PASS:pass_ok_mismatch");
  if (receipt.contractPin !== TERMINUS_CONTRACT_PIN) throw new Error("TERMINUS_FAKE_PASS:pin");
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((item) => canonicalJson(item)).join(",") + "]";
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return (
    "{" +
    entries.map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item)).join(",") +
    "}"
  );
}

export function digestCanonical(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

const PROVIDER_GATE_RECEIPT_FIELDS = new Set([
  "phase",
  "request_id",
  "envelope_id",
  "target_digest",
  "body_digest",
  "response_digest",
  "provider_http_status",
  "prev_receipt_sha256",
]);

/** Dual-receipt leg: STARTED + TERMINAL share identity fields; secrets stay out. */
export function buildProviderGateReceipt(input) {
  const base = buildTerminusReceipt({
    decision: input.decision,
    reason: input.reason,
    routeId: input.routeId,
    status: input.status,
  });
  const extras = {};
  for (const key of PROVIDER_GATE_RECEIPT_FIELDS) {
    if (input[key] !== undefined) extras[key] = input[key];
  }
  const body = { ...base, ...extras };
  delete body.receiptSha256;
  const receiptSha256 = createHash("sha256").update(canonicalJson(body), "utf8").digest("hex");
  const receipt = { ...body, receiptSha256 };
  assertHonestReceipt(receipt);
  return receipt;
}

export function recomputeReceiptSha256(receipt) {
  const { receiptSha256: _claimed, ...body } = receipt;
  return createHash("sha256").update(canonicalJson(body), "utf8").digest("hex");
}

export function verifyReceiptHash(receipt) {
  if (!receipt || typeof receipt.receiptSha256 !== "string") {
    return { ok: false, reason: "receipt_hash_missing" };
  }
  if (recomputeReceiptSha256(receipt) !== receipt.receiptSha256) {
    return { ok: false, reason: "receipt_hash_mismatch" };
  }
  return { ok: true, reason: "receipt_hash_valid" };
}

function terminalHonestyReason(terminal) {
  if (terminal.decision === "REFUSE" && (terminal.ok || terminal.pass)) {
    return "terminal_fake_pass";
  }
  if (terminal.decision === "ALLOW" && (!terminal.ok || !terminal.pass)) {
    return "terminal_allow_not_ok";
  }
  if (terminal.decision === "ALLOW" && terminal.status !== "GOVERNED") {
    return "terminal_allow_not_governed";
  }
  if (terminal.status === "GOVERNED" && terminal.decision !== "ALLOW") {
    return "terminal_governed_not_allow";
  }
  if (
    (terminal.status === "UNKNOWN" ||
      terminal.status === "UNENFORCED" ||
      terminal.status === "DISABLED") &&
    (terminal.ok || terminal.pass)
  ) {
    return "terminal_unenforced_marked_ok";
  }
  if (terminal.pass !== terminal.ok) return "terminal_pass_ok_mismatch";
  return null;
}

export function verifyProviderGateReceiptPair(started, terminal) {
  if (!started || !terminal) return { ok: false, reason: "missing_receipt" };
  if (started.phase !== "STARTED" || terminal.phase !== "TERMINAL") {
    return { ok: false, reason: "phase_invalid" };
  }
  if (verifyReceiptHash(started).ok !== true) {
    return { ok: false, reason: "started_hash_mismatch" };
  }
  if (verifyReceiptHash(terminal).ok !== true) {
    return { ok: false, reason: "terminal_hash_mismatch" };
  }
  if (started.request_id !== terminal.request_id)
    return { ok: false, reason: "request_id_mismatch" };
  if (started.envelope_id !== terminal.envelope_id)
    return { ok: false, reason: "envelope_id_mismatch" };
  if (started.target_digest !== terminal.target_digest)
    return { ok: false, reason: "target_digest_mismatch" };
  if (started.body_digest !== terminal.body_digest)
    return { ok: false, reason: "body_digest_mismatch" };
  if (terminal.prev_receipt_sha256 !== recomputeReceiptSha256(started)) {
    return { ok: false, reason: "receipt_chain_break" };
  }
  if (!started.ok || !started.pass) {
    return { ok: false, reason: "started_not_pass" };
  }
  const dishonest = terminalHonestyReason(terminal);
  if (dishonest) {
    return { ok: false, reason: dishonest };
  }
  return { ok: true, reason: "provider_gate_pair_valid" };
}
