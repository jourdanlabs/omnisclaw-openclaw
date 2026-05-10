import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { ReplyPayload } from "../auto-reply/reply-payload.js";
import type { ReplyDispatchBeforeDeliver } from "../auto-reply/reply/reply-dispatcher.js";
import type { FinalizedMsgContext, MsgContext } from "../auto-reply/templating.js";
import type { ReplyDispatchKind } from "../auto-reply/reply/reply-dispatcher.types.js";

type BeforeDeliverInfo = {
  kind: ReplyDispatchKind;
};

const GATE_LANGUAGE_PATTERNS = [
  /\bAPPROVED\b/gi,
  /\bREJECTED\b/gi,
  /\bABSTAIN(?:ED)?\b/gi,
  /\bBIFROST\b/gi,
  /\bCLARION\b/gi,
  /\bSENTINEL\b/gi,
  /\bAURORA\b/gi,
  /\baudit[_ -]?hash\b/gi,
  /\bproof[_ -]?packet\b/gi,
  /\bgate decision\b/gi,
  /\bconfidence threshold\b/gi,
];

const GATE_PREFIX_PATTERNS = [
  /^\s*(?:APPROVED|REJECTED|ABSTAIN(?:ED)?)\s*(?:by\s+\w+)?\s*[:\-–—]\s*/i,
  /^\s*(?:BIFROST|CLARION|SENTINEL|AURORA)\s*(?:says|found|reports|verdict)?\s*[:\-–—]\s*/i,
];

const UNSUPPORTED_CERTAINTY_PATTERNS = [
  /\bguaranteed eligible\b/gi,
  /\bdefinitely eligible\b/gi,
  /\bcertainly eligible\b/gi,
  /\b100%\s+eligible\b/gi,
];

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
  if (payload.isError === true || payload.isReasoning === true || payload.isCompactionNotice === true) {
    return payload;
  }
  if (!payload.text?.trim()) {
    return payload;
  }
  const result = verifyOmnisclawFinalText({
    userMessage: userMessageFromContext(params?.ctx),
    text: payload.text,
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
}): {
  text: string;
  repaired: boolean;
  blockers: string[];
} {
  const text = input.text.trim();
  const blockers = detectBifrostBlockers(text);
  if (blockers.length === 0) {
    return { text: input.text, repaired: false, blockers };
  }
  const repaired = naturalRepair(text, blockers);
  return {
    text: repaired,
    repaired: repaired !== input.text,
    blockers,
  };
}

function isOmnisclawBifrostEnabled(): boolean {
  const raw = process.env.OMNISCLAW_BIFROST ?? process.env.OPENCLAW_BIFROST;
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function detectBifrostBlockers(text: string): string[] {
  const blockers: string[] = [];
  if (GATE_LANGUAGE_PATTERNS.some((pattern) => patternMatches(pattern, text))) {
    blockers.push("visible_gate_language");
  }
  if (UNSUPPORTED_CERTAINTY_PATTERNS.some((pattern) => patternMatches(pattern, text))) {
    blockers.push("unsupported_certainty");
  }
  return [...new Set(blockers)].sort();
}

function patternMatches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function naturalRepair(text: string, blockers: string[]): string {
  let repaired = text.trim();
  if (blockers.includes("visible_gate_language")) {
    for (const pattern of GATE_PREFIX_PATTERNS) {
      repaired = repaired.replace(pattern, "");
    }
    for (const pattern of GATE_LANGUAGE_PATTERNS) {
      repaired = repaired.replace(pattern, "");
    }
    repaired = repaired
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([:;,.!?])/g, "$1")
      .replace(/^\s*[:\-–—]\s*/, "")
      .trim();
  }
  if (blockers.includes("unsupported_certainty")) {
    repaired = repaired
      .replace(/\bguaranteed eligible\b/gi, "not verified as eligible")
      .replace(/\bdefinitely eligible\b/gi, "not verified as eligible")
      .replace(/\bcertainly eligible\b/gi, "not verified as eligible")
      .replace(/\b100%\s+eligible\b/gi, "not verified as eligible");
  }
  return repaired || "I cannot verify a reliable answer from the available context.";
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
