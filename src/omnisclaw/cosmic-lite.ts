// OMNISCLAW × COSMIC-lite: the public BIFROST verifier as a delivery seal.
//
// The embedded fluid pass (clarion/bifrost/fluid.ts) stays the always-on,
// synchronous first gate. This module adds the deterministic six-engine
// COSMIC-lite pipeline (github.com/jourdanlabs/bifrost, loopback :8787) as a
// second, receipted verdict on the async delivery path:
//
//   OMNISCLAW_COSMIC=off        never call the verifier
//   OMNISCLAW_COSMIC=advisory   (default) verdict + receipt logged, text untouched
//   OMNISCLAW_COSMIC=enforce    a REJECTED final reply is held back and replaced
//                               with a refusal that names the gap (REFUSE -> RESOLVE)
//
// The verifier being down is never fatal: the seal degrades to the fluid-only
// behavior — OMNISCLAW keeps working, it just carries one fewer receipt.
import type { ReplyPayload } from "../auto-reply/reply-payload.js";

export type CosmicLiteMode = "off" | "advisory" | "enforce";

export interface CosmicLiteVerdict {
  verdict: "APPROVED" | "LOW_CONFIDENCE" | "REJECTED";
  confidence: number;
  reasons: string[];
  receipt_sha256: string;
}

const DEFAULT_URL = "http://127.0.0.1:8787/verify";
const DEFAULT_TIMEOUT_MS = 1500;

export function cosmicLiteMode(env: NodeJS.ProcessEnv = process.env): CosmicLiteMode {
  const raw = (env.OMNISCLAW_COSMIC ?? "advisory").trim().toLowerCase();
  if (raw === "off" || raw === "0" || raw === "false") {
    return "off";
  }
  return raw === "enforce" ? "enforce" : "advisory";
}

export function cosmicLiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.OMNISCLAW_COSMIC_URL?.trim() || DEFAULT_URL;
}

export async function cosmicLiteVerdict(params: {
  input?: string;
  output: string;
  url?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<CosmicLiteVerdict | null> {
  const fetchImpl = params.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(params.url ?? cosmicLiteUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: params.input, output: params.output }),
      signal: AbortSignal.timeout(params.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as Partial<CosmicLiteVerdict>;
    if (
      data.verdict !== "APPROVED" &&
      data.verdict !== "LOW_CONFIDENCE" &&
      data.verdict !== "REJECTED"
    ) {
      return null;
    }
    return {
      verdict: data.verdict,
      confidence: typeof data.confidence === "number" ? data.confidence : 0,
      reasons: Array.isArray(data.reasons) ? data.reasons.map(String) : [],
      receipt_sha256: typeof data.receipt_sha256 === "string" ? data.receipt_sha256 : "",
    };
  } catch {
    // Unreachable/slow verifier degrades to fluid-only delivery.
    return null;
  }
}

// REFUSE -> RESOLVE: hold back the reply, name the gap, and hand the user the
// path to close it. No invented content, no silent swallowing of a paid answer.
export function cosmicRefusalText(verdict: CosmicLiteVerdict): string {
  const gap = verdict.reasons.length
    ? verdict.reasons[0].replace(/\.$/u, "")
    : "unsupported confidence in the draft";
  return [
    "I'm holding that reply back — verification flagged it before delivery",
    `(${gap.toLowerCase()}).`,
    "Ask me to show only what I can support, or hand me a source for the shaky part and I'll finish the thought.",
  ].join(" ");
}

// The async delivery seal. Applied AFTER the fluid pass on final replies.
export async function applyCosmicLiteSeal(
  payload: ReplyPayload,
  params?: {
    userMessage?: string;
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  },
): Promise<ReplyPayload> {
  const env = params?.env ?? process.env;
  const mode = cosmicLiteMode(env);
  if (mode === "off" || !payload.text?.trim()) {
    return payload;
  }
  const verdict = await cosmicLiteVerdict({
    input: params?.userMessage,
    output: payload.text,
    url: cosmicLiteUrl(env),
    fetchImpl: params?.fetchImpl,
  });
  if (!verdict) {
    return payload;
  }
  if (env.OMNISCLAW_COSMIC_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.error(
      `[omnisclaw] cosmic-lite ${verdict.verdict} conf=${verdict.confidence.toFixed(2)} receipt=${verdict.receipt_sha256.slice(0, 12)}`,
    );
  }
  if (mode === "enforce" && verdict.verdict === "REJECTED") {
    return { ...payload, text: cosmicRefusalText(verdict) };
  }
  return payload;
}
