import { hashCanonical, shortHash } from "../audit/hash.js";
import { runFinal } from "../pipeline.js";
import type { FinalStatus, GateDecisionStatus, MirrorverseInput, RawRecord } from "../types.js";

export type BifrostFluidMode = "silent" | "careful" | "audit" | "debug";
export type BifrostFluidReleaseStatus =
  | "released"
  | "repaired"
  | "regenerated"
  | "abstained"
  | "blocked";

export interface BifrostFluidContext {
  verifiedFacts?: string[];
  blockedClaims?: string[];
  staleFacts?: string[];
  sourceNotes?: string[];
}

export interface BifrostFluidVerificationInput {
  userMessage: string;
  draftResponse: string;
  context?: BifrostFluidContext;
  mode?: BifrostFluidMode;
  runtime?: string;
  now?: string;
  repairAttempt?: boolean;
}

export interface BifrostFluidAudit {
  audit_id: string;
  runtime: string;
  mode: BifrostFluidMode;
  draft_hash: string;
  final_response_hash: string;
  status: BifrostFluidReleaseStatus;
  gate_status: GateDecisionStatus;
  mirrorverse_status: FinalStatus;
  blockers: string[];
  recovery_requirements: string[];
  proof_packet_ids: string[];
  visible_gate: boolean;
  repaired: boolean;
  audit_hash: string;
}

export interface BifrostFluidVerificationResult {
  response: string;
  status: BifrostFluidReleaseStatus;
  repaired: boolean;
  visible_gate: boolean;
  blockers: string[];
  recovery_requirements: string[];
  audit: BifrostFluidAudit;
}

const DEFAULT_NOW = "2026-05-10";

const GATE_LANGUAGE = [
  /\bAPPROVED\b/i,
  /\bREJECTED\b/i,
  /\bABSTAIN(?:ED)?\b/i,
  /\bBIFROST\b/i,
  /\bCLARION\b/i,
  /\bSENTINEL\b/i,
  /\bAURORA\b/i,
  /\baudit[_ -]?hash\b/i,
  /\bproof[_ -]?packet/i,
  /\bgate decision\b/i,
  /\bconfidence threshold\b/i,
];

const ABSOLUTE_LANGUAGE = [
  /\bguarantee(?:d|s)?\b/i,
  /\b100%\b/i,
  /\balways\b/i,
  /\bnever\b/i,
  /\bdefinitely\b/i,
  /\bcertainly\b/i,
];

export function verifyFluidAgentResponse(
  input: BifrostFluidVerificationInput,
): BifrostFluidVerificationResult {
  const mode = input.mode ?? "silent";
  const runtime = input.runtime ?? "bifrost-fluid";
  const now = input.now ?? DEFAULT_NOW;
  const context = input.context ?? {};
  const draft = normalizeResponse(input.draftResponse);
  const blockers = detectBlockers({
    draft,
    mode,
    context,
  });
  const mirrorverse = runFinal({
    records: recordsForDraft({
      userMessage: input.userMessage,
      draft,
      blockers,
      context,
      now,
    }),
    requested_assertion: "omnisclaw response is safe to release",
    config: {
      decision_time: now,
      min_independent_packets: 1,
      ambiguity_limit: 0,
      stale_half_life_days: 365,
    },
  } satisfies MirrorverseInput);
  const releaseAllowed = blockers.length === 0 && mirrorverse.status !== "REJECTED";
  const response = releaseAllowed
    ? cleanVisibleResponse(draft, mode)
    : naturalRepair({
        userMessage: input.userMessage,
        draft,
        context,
        blockers,
        mode,
      });
  const status = statusFor({
    releaseAllowed,
    blockers,
    mirrorverseStatus: mirrorverse.status,
    repairAttempt: input.repairAttempt === true,
  });
  const repaired = !releaseAllowed || input.repairAttempt === true;
  const visible_gate = mode === "audit" || mode === "debug";
  const recovery_requirements = recoveryRequirements(blockers, context);
  const auditWithoutHash = {
    audit_id: `fluid_${shortHash({
      runtime,
      draft,
      response,
      blockers,
      mirrorverse_hash: mirrorverse.audit_hash,
    })}`,
    runtime,
    mode,
    draft_hash: hashCanonical(draft),
    final_response_hash: hashCanonical(response),
    status,
    gate_status: gateStatusFor(status),
    mirrorverse_status: mirrorverse.status,
    blockers,
    recovery_requirements,
    proof_packet_ids: mirrorverse.proof_packet_ids,
    visible_gate,
    repaired,
  };
  const audit = {
    ...auditWithoutHash,
    audit_hash: hashCanonical(auditWithoutHash),
  };
  return {
    response,
    status,
    repaired,
    visible_gate,
    blockers,
    recovery_requirements,
    audit,
  };
}

export function buildFluidRepairPrompt(input: {
  userMessage: string;
  failedDraft: string;
  context?: BifrostFluidContext;
  blockers: string[];
}): string {
  const context = input.context ?? {};
  return [
    "Rewrite the agent answer so it sounds natural and useful.",
    "Do not mention BIFROST, CLARION, SENTINEL, AURORA, approval, rejection, gates, audit hashes, or verification machinery.",
    "Use only the verified facts provided. If the requested claim cannot be supported, say what can be verified and naturally abstain from the rest.",
    "",
    "User message:",
    input.userMessage,
    "",
    "Failed draft:",
    input.failedDraft,
    "",
    "Verifier blockers:",
    input.blockers.join("; ") || "none",
    "",
    "Verified facts:",
    facts(context).join("\n") || "(none supplied)",
    "",
    "Blocked claims:",
    (context.blockedClaims ?? []).join("\n") || "(none supplied)",
    "",
    "Stale facts:",
    (context.staleFacts ?? []).join("\n") || "(none supplied)",
  ].join("\n");
}

function detectBlockers(input: {
  draft: string;
  mode: BifrostFluidMode;
  context: BifrostFluidContext;
}): string[] {
  const blockers: string[] = [];
  const draft = input.draft;
  if (!draft.trim()) {
    blockers.push("empty_response");
  }
  if (
    (input.mode === "silent" || input.mode === "careful") &&
    GATE_LANGUAGE.some((pattern) => pattern.test(draft))
  ) {
    blockers.push("visible_gate_language");
  }
  for (const blockedClaim of input.context.blockedClaims ?? []) {
    if (containsLoose(draft, blockedClaim)) {
      blockers.push(`blocked_claim:${stableLabel(blockedClaim)}`);
    }
  }
  for (const staleFact of input.context.staleFacts ?? []) {
    if (
      containsLoose(draft, staleFact) &&
      !/\b(as of|last known|may have changed|latest I can verify|not current)\b/i.test(draft)
    ) {
      blockers.push(`stale_fact_without_caveat:${stableLabel(staleFact)}`);
    }
  }
  if (
    (input.context.verifiedFacts ?? []).length === 0 &&
    ABSOLUTE_LANGUAGE.some((pattern) => pattern.test(draft))
  ) {
    blockers.push("absolute_claim_without_verified_support");
  }
  return [...new Set(blockers)].sort();
}

function recordsForDraft(input: {
  userMessage: string;
  draft: string;
  blockers: string[];
  context: BifrostFluidContext;
  now: string;
}): RawRecord[] {
  const status = input.blockers.length === 0 ? "approved" : "denied";
  const base = {
    source_type: "derived" as const,
    timestamp: input.now,
    trust_tier: "high" as const,
  };
  return [
    {
      ...base,
      source_id: "omnisclaw_user_request",
      text: `subject:omnisclaw_request predicate:text object:${sanitizeRecordText(input.userMessage)}`,
    },
    {
      ...base,
      source_id: "omnisclaw_draft_response",
      text: `subject:omnisclaw_response predicate:status object:${status}; subject:omnisclaw_response predicate:blocker_count object:${input.blockers.length}; ${sanitizeRecordText(input.draft)}`,
    },
    {
      ...base,
      source_id: "omnisclaw_fluid_policy",
      text: `subject:omnisclaw_response predicate:must_hide_gate object:true; subject:omnisclaw_response predicate:status object:${status}; blockers:${input.blockers.join(",") || "none"}`,
    },
    ...facts(input.context).map((fact, index) => ({
      ...base,
      source_id: `omnisclaw_verified_fact_${index + 1}`,
      text: `subject:verified_fact predicate:supports_response object:${sanitizeRecordText(fact)}`,
    })),
  ];
}

function naturalRepair(input: {
  userMessage: string;
  draft: string;
  context: BifrostFluidContext;
  blockers: string[];
  mode: BifrostFluidMode;
}): string {
  const verified = facts(input.context);
  if (verified.length > 0) {
    return normalizeResponse(
      [
        "Here's what I can verify:",
        ...verified.map((fact) => `- ${fact}`),
        input.context.blockedClaims?.length
          ? "I don't have enough support to go beyond that yet."
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (input.blockers.includes("empty_response")) {
    return "I don't have enough information to answer that yet.";
  }
  if (input.mode === "careful") {
    return "I can't verify that strongly enough from what I have. The safest answer is to treat it as unconfirmed for now.";
  }
  return "I can't verify that from the available information yet.";
}

function recoveryRequirements(blockers: string[], context: BifrostFluidContext): string[] {
  if (blockers.length === 0) {
    return [];
  }
  return [
    ...blockers.map((blocker) => `Repair response blocker: ${blocker}.`),
    ...(context.verifiedFacts?.length
      ? []
      : ["Provide verified facts or source context before making strong claims."]),
  ].sort();
}

function statusFor(input: {
  releaseAllowed: boolean;
  blockers: string[];
  mirrorverseStatus: FinalStatus;
  repairAttempt: boolean;
}): BifrostFluidReleaseStatus {
  if (input.releaseAllowed && input.repairAttempt) {
    return "regenerated";
  }
  if (input.releaseAllowed) {
    return "released";
  }
  if (input.mirrorverseStatus === "REJECTED") {
    return "blocked";
  }
  if (input.blockers.length > 0) {
    return "repaired";
  }
  return "abstained";
}

function gateStatusFor(status: BifrostFluidReleaseStatus): GateDecisionStatus {
  if (status === "released" || status === "regenerated") {
    return "APPROVED";
  }
  if (status === "blocked") {
    return "REJECTED";
  }
  return "ABSTAIN";
}

function cleanVisibleResponse(value: string, mode: BifrostFluidMode): string {
  if (mode === "audit" || mode === "debug") {
    return normalizeResponse(value);
  }
  return normalizeResponse(value)
    .replace(/\b(?:APPROVED|REJECTED|ABSTAINED?)\s*:?\s*/gi, "")
    .replace(/\b(?:BIFROST|CLARION|SENTINEL|AURORA)\s*(?:says|gate|verdict)?\s*:?\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function facts(context: BifrostFluidContext): string[] {
  return [
    ...new Set(
      [...(context.verifiedFacts ?? []), ...(context.sourceNotes ?? [])]
        .map(normalizeResponse)
        .filter(Boolean),
    ),
  ];
}

function normalizeResponse(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function containsLoose(haystack: string, needle: string): boolean {
  const normalizedHaystack = normalizeLoose(haystack);
  const normalizedNeedle = normalizeLoose(needle);
  return normalizedNeedle.length > 0 && normalizedHaystack.includes(normalizedNeedle);
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableLabel(value: string): string {
  return normalizeLoose(value).slice(0, 40).replace(/\s+/g, "_") || shortHash(value);
}

function sanitizeRecordText(value: string): string {
  return normalizeResponse(value).replace(/\s+/g, " ").slice(0, 600);
}
