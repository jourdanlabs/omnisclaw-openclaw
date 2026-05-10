import type { ReplyPayload } from "../auto-reply/reply-payload.js";
import type { ReplyDispatchBeforeDeliver } from "../auto-reply/reply/reply-dispatcher.js";
import type { ReplyDispatchKind } from "../auto-reply/reply/reply-dispatcher.types.js";
import type { FinalizedMsgContext, MsgContext } from "../auto-reply/templating.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  type BifrostFluidContext,
  type BifrostFluidMode,
  verifyFluidAgentResponse,
} from "./clarion/bifrost/fluid.js";

type BeforeDeliverInfo = {
  kind: ReplyDispatchKind;
};

export function createOmnisclawBifrostBeforeDeliver(params: {
  cfg?: OpenClawConfig;
  ctx?: MsgContext | FinalizedMsgContext;
  previous?: ReplyDispatchBeforeDeliver;
}): ReplyDispatchBeforeDeliver {
  return async (payload, info) => {
    const previous = params.previous ? await params.previous(payload, info) : payload;
    if (!previous) {
      return null;
    }
    return applyOmnisclawBifrostToReplyPayload(previous, {
      cfg: params.cfg,
      ctx: params.ctx,
      info,
    });
  };
}

export function applyOmnisclawBifrostToReplyPayload(
  payload: ReplyPayload,
  params?: {
    cfg?: OpenClawConfig;
    ctx?: MsgContext | FinalizedMsgContext;
    info?: BeforeDeliverInfo;
  },
): ReplyPayload {
  if (!isOmnisclawBifrostEnabled()) {
    return payload;
  }
  if (params?.info?.kind !== "final") {
    return payload;
  }
  if (
    payload.isError === true ||
    payload.isReasoning === true ||
    payload.isCompactionNotice === true
  ) {
    return payload;
  }
  if (!payload.text?.trim()) {
    return payload;
  }
  const result = verifyOmnisclawFinalText({
    userMessage: userMessageFromContext(params?.ctx),
    text: payload.text,
    context: contextFromRuntime(params?.ctx),
  });
  if (!result.repaired) {
    return payload;
  }
  return {
    ...payload,
    text: result.text,
  };
}

export function verifyOmnisclawFinalText(input: {
  userMessage?: string;
  text: string;
  context?: BifrostFluidContext;
  mode?: BifrostFluidMode;
}): {
  text: string;
  repaired: boolean;
  blockers: string[];
  auditHash: string;
} {
  if (
    !shouldRunClarionReview({
      userMessage: input.userMessage,
      text: input.text,
      context: input.context,
    })
  ) {
    return {
      text: input.text,
      repaired: false,
      blockers: [],
      auditHash: "",
    };
  }
  const verification = verifyFluidAgentResponse({
    userMessage: input.userMessage ?? "",
    draftResponse: input.text,
    runtime: "omnisclaw-openclaw",
    mode: input.mode ?? modeFromEnv(),
    ...(input.context ? { context: input.context } : {}),
  });
  return {
    text: verification.response,
    repaired: verification.repaired || verification.response !== input.text,
    blockers: verification.blockers,
    auditHash: verification.audit.audit_hash,
  };
}

function shouldRunClarionReview(input: {
  userMessage?: string;
  text: string;
  context?: BifrostFluidContext;
}): boolean {
  const text = input.text.trim();
  if (!text) {
    return false;
  }
  if (hasRuntimeEvidence(input.context)) {
    return true;
  }
  if (matchesAny(text, ALWAYS_REVIEW_PATTERNS)) {
    return true;
  }
  if (looksLikeCasualConversation(input.userMessage, text)) {
    return false;
  }
  return matchesAny(text, CLAIM_REVIEW_PATTERNS);
}

const ALWAYS_REVIEW_PATTERNS = [
  /\b(?:APPROVED|REJECTED|ABSTAIN(?:ED)?)\b/iu,
  /\b(?:BIFROST|CLARION|SENTINEL|AURORA)\b/iu,
  /\baudit[_ -]?hash\b/iu,
  /\bproof[_ -]?packet\b/iu,
  /\bgate decision\b/iu,
  /\bconfidence threshold\b/iu,
  /\b(?:guaranteed|definitely|certainly|always|never|impossible|100%)\b/iu,
];

const CLAIM_REVIEW_PATTERNS = [
  /\b(?:client|eligible|eligibility|retainer|contract|court|filing|lawsuit|statute|regulation|compliance|liability|damages|settlement|attorney|counsel)\b/iu,
  /\b(?:medical|diagnosis|treatment|dosage|symptom|prescription)\b/iu,
  /\b(?:tax|financial|investment|invoice|payment|balance|revenue|profit|loss|refund)\b/iu,
  /\b(?:verified|confirmed|proven|evidence|source|citation|according to|research shows)\b/iu,
  /\b(?:today|yesterday|tomorrow|latest|current|now|recent|deadline|expires?|due)\b/iu,
  /\b\d{1,4}(?:[.,]\d{3})*(?:\.\d+)?\s*(?:%|percent|dollars?|usd|hours?|days?|weeks?|months?|years?)\b/iu,
  /\b(?:https?:\/\/|www\.)\S+/iu,
  /\b[A-Z][a-z]+ \d{1,2}, \d{4}\b/u,
];

const CASUAL_USER_PATTERNS = [
  /^(?:yo+|hey+|hi+|hello+|sup|what'?s up|wyd|lol|lmao|haha|thanks?|thank you|cool|nice|dope|ok(?:ay)?|yep|yeah|nah|gm|gn)[\s.!?]*$/iu,
];

const CASUAL_REPLY_PATTERNS = [
  /^(?:yo+|hey+|hi+|hello+|sup)[\s,!?.]*(?:i'?m here|what'?s up|what can i do|ready|how can i help)?[\s.!?]*$/iu,
  /^(?:got it|sounds good|absolutely|for sure|yep|yeah|ok(?:ay)?|nice|dope|cool|thanks?|thank you)[\s.!?]*(?:i'?m here|what'?s next|send it|let'?s do it)?[\s.!?]*$/iu,
  /^i'?m here[\s.!?]*(?:what'?s up|what do you need|what are we doing)?[\s.!?]*$/iu,
];

function looksLikeCasualConversation(userMessage: string | undefined, text: string): boolean {
  const normalizedText = text.trim();
  if (normalizedText.length > 240) {
    return false;
  }
  if (matchesAny(normalizedText, CLAIM_REVIEW_PATTERNS)) {
    return false;
  }
  if (matchesAny(normalizedText, CASUAL_REPLY_PATTERNS)) {
    return true;
  }
  const normalizedUserMessage = userMessage?.trim() ?? "";
  return Boolean(
    normalizedUserMessage &&
    matchesAny(normalizedUserMessage, CASUAL_USER_PATTERNS) &&
    normalizedText.split(/\s+/u).length <= 24,
  );
}

function hasRuntimeEvidence(context: BifrostFluidContext | undefined): boolean {
  return Boolean(
    context?.verifiedFacts?.length ||
    context?.blockedClaims?.length ||
    context?.staleFacts?.length ||
    context?.sourceNotes?.length,
  );
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isOmnisclawBifrostEnabled(): boolean {
  const raw = process.env.OMNISCLAW_BIFROST ?? process.env.OPENCLAW_BIFROST;
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function modeFromEnv(): BifrostFluidMode {
  const raw = (process.env.OMNISCLAW_BIFROST_MODE ?? process.env.OPENCLAW_BIFROST_MODE ?? "")
    .trim()
    .toLowerCase();
  if (raw === "careful" || raw === "audit" || raw === "debug") {
    return raw;
  }
  return "silent";
}

function contextFromRuntime(ctx?: MsgContext | FinalizedMsgContext): BifrostFluidContext {
  return compactContext({
    verifiedFacts: envLines("OMNISCLAW_VERIFIED_FACTS", "OPENCLAW_VERIFIED_FACTS"),
    blockedClaims: envLines("OMNISCLAW_BLOCKED_CLAIMS", "OPENCLAW_BLOCKED_CLAIMS"),
    staleFacts: envLines("OMNISCLAW_STALE_FACTS", "OPENCLAW_STALE_FACTS"),
    sourceNotes: [
      ...envLines("OMNISCLAW_SOURCE_NOTES", "OPENCLAW_SOURCE_NOTES"),
      ...contextSourceNotes(ctx),
    ],
  });
}

function contextSourceNotes(ctx?: MsgContext | FinalizedMsgContext): string[] {
  if (!ctx) {
    return [];
  }
  return [
    ...stringArray(ctx.LinkUnderstanding),
    ...stringArray(ctx.MediaUnderstanding?.map((item) => JSON.stringify(item))),
    ...stringArray(ctx.ThreadHistoryBody),
    ...stringArray(ctx.ReplyToBody),
  ];
}

function compactContext(context: BifrostFluidContext): BifrostFluidContext {
  return {
    verifiedFacts: uniqueNonEmpty(context.verifiedFacts),
    blockedClaims: uniqueNonEmpty(context.blockedClaims),
    staleFacts: uniqueNonEmpty(context.staleFacts),
    sourceNotes: uniqueNonEmpty(context.sourceNotes),
  };
}

function envLines(...names: string[]): string[] {
  return names.flatMap((name) => stringArray(process.env[name]));
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringArray(item));
  }
  if (typeof value !== "string") {
    return [];
  }
  return value.split(/\r?\n|;;/u);
}

function uniqueNonEmpty(values: string[] | undefined): string[] | undefined {
  const normalized = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function userMessageFromContext(ctx?: MsgContext | FinalizedMsgContext): string | undefined {
  if (!ctx) {
    return undefined;
  }
  const bodyForAgent = typeof ctx.BodyForAgent === "string" ? ctx.BodyForAgent.trim() : "";
  if (bodyForAgent) {
    return bodyForAgent;
  }
  const body = typeof ctx.Body === "string" ? ctx.Body.trim() : "";
  if (body) {
    return body;
  }
  const rawBody = typeof ctx.RawBody === "string" ? ctx.RawBody.trim() : "";
  return rawBody || undefined;
}
