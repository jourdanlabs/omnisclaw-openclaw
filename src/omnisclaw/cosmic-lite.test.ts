import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyCosmicLiteSeal,
  cosmicLiteMode,
  cosmicLiteVerdict,
  cosmicRefusalText,
} from "./cosmic-lite.js";

function fetchReturning(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  })) as unknown as typeof fetch;
}

const APPROVED = {
  verdict: "APPROVED",
  confidence: 1,
  reasons: ["No high-risk signals detected."],
  receipt_sha256: "a".repeat(64),
};
const REJECTED = {
  verdict: "REJECTED",
  confidence: 0.42,
  reasons: ["Detected 1 contradiction signal(s)."],
  receipt_sha256: "b".repeat(64),
};

describe("cosmic-lite mode + client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to advisory and parses off/enforce", () => {
    expect(cosmicLiteMode({} as NodeJS.ProcessEnv)).toBe("advisory");
    expect(cosmicLiteMode({ OMNISCLAW_COSMIC: "off" } as NodeJS.ProcessEnv)).toBe("off");
    expect(cosmicLiteMode({ OMNISCLAW_COSMIC: "ENFORCE" } as NodeJS.ProcessEnv)).toBe("enforce");
    expect(cosmicLiteMode({ OMNISCLAW_COSMIC: "banana" } as NodeJS.ProcessEnv)).toBe("advisory");
  });

  it("returns a typed verdict from the verifier", async () => {
    const verdict = await cosmicLiteVerdict({
      output: "text",
      fetchImpl: fetchReturning(APPROVED),
    });
    expect(verdict?.verdict).toBe("APPROVED");
    expect(verdict?.receipt_sha256).toHaveLength(64);
  });

  it("degrades to null on unreachable or malformed verifier", async () => {
    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await cosmicLiteVerdict({ output: "x", fetchImpl: down })).toBeNull();
    expect(
      await cosmicLiteVerdict({ output: "x", fetchImpl: fetchReturning({ nonsense: true }) }),
    ).toBeNull();
    expect(await cosmicLiteVerdict({ output: "x", fetchImpl: fetchReturning({}, false) })).toBeNull();
  });
});

describe("cosmic-lite delivery seal", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("off mode never calls the verifier", async () => {
    const spy = fetchReturning(APPROVED);
    const out = await applyCosmicLiteSeal(
      { text: "hello" },
      { env: { OMNISCLAW_COSMIC: "off" } as NodeJS.ProcessEnv, fetchImpl: spy },
    );
    expect(out.text).toBe("hello");
    expect(spy).not.toHaveBeenCalled();
  });

  it("advisory leaves text untouched even on REJECTED", async () => {
    const out = await applyCosmicLiteSeal(
      { text: "Definitely 1,083 feet, guaranteed." },
      { env: {} as NodeJS.ProcessEnv, fetchImpl: fetchReturning(REJECTED) },
    );
    expect(out.text).toBe("Definitely 1,083 feet, guaranteed.");
  });

  it("enforce replaces a REJECTED final with a named-gap refusal", async () => {
    const out = await applyCosmicLiteSeal(
      { text: "Yes it is thread-safe. Also it is not thread-safe." },
      { env: { OMNISCLAW_COSMIC: "enforce" } as NodeJS.ProcessEnv, fetchImpl: fetchReturning(REJECTED) },
    );
    expect(out.text).toBe(cosmicRefusalText(REJECTED as never));
    expect(out.text).toContain("holding that reply back");
    expect(out.text.toLowerCase()).toContain("contradiction");
  });

  it("enforce passes APPROVED text through unchanged", async () => {
    const out = await applyCosmicLiteSeal(
      { text: "Paris is the capital of France." },
      { env: { OMNISCLAW_COSMIC: "enforce" } as NodeJS.ProcessEnv, fetchImpl: fetchReturning(APPROVED) },
    );
    expect(out.text).toBe("Paris is the capital of France.");
  });

  it("verifier down = fluid-only delivery, text unchanged", async () => {
    const down = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    const out = await applyCosmicLiteSeal(
      { text: "unchanged" },
      { env: { OMNISCLAW_COSMIC: "enforce" } as NodeJS.ProcessEnv, fetchImpl: down },
    );
    expect(out.text).toBe("unchanged");
  });
});
