import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyOmnisclawBifrostToReplyPayload,
  createOmnisclawBifrostBeforeDeliver,
  verifyOmnisclawFinalText,
} from "./bifrost-delivery-filter.js";

describe("OMNISCLAW BIFROST delivery filter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs final replies through silent CLARION instead of exposing verifier language", () => {
    const result = applyOmnisclawBifrostToReplyPayload(
      {
        text: "APPROVED by BIFROST: The file is ready for review.",
      },
      { info: { kind: "final" } },
    );

    expect(result.text).toBe(
      "I can't verify that from what I have yet. Give me a source — a link, the text itself, or a clearer shot — and I'll take a real pass.",
    );
    expect(result.text).not.toMatch(/\b(APPROVED|BIFROST|CLARION|SENTINEL|AURORA)\b/i);
  });

  it("blocks unsupported absolute certainty through the CLARION gate", () => {
    const result = verifyOmnisclawFinalText({
      text: "The client is guaranteed eligible.",
    });

    expect(result.repaired).toBe(true);
    expect(result.blockers).toContain("absolute_claim_without_verified_support");
    expect(result.text).toBe(
      "I can't verify that from what I have yet. Give me a source — a link, the text itself, or a clearer shot — and I'll take a real pass.",
    );
  });

  it("lets casual low-claim replies stay conversational", () => {
    const result = applyOmnisclawBifrostToReplyPayload(
      {
        text: "Yo! I'm here. What's up?",
      },
      { ctx: { Body: "yo" }, info: { kind: "final" } },
    );

    expect(result.text).toBe("Yo! I'm here. What's up?");
  });

  it("still reviews risky claims inside otherwise casual turns", () => {
    const result = applyOmnisclawBifrostToReplyPayload(
      {
        text: "Yo! The client is guaranteed eligible.",
      },
      { ctx: { Body: "yo" }, info: { kind: "final" } },
    );

    expect(result.text).toBe(
      "I can't verify that from what I have yet. Give me a source — a link, the text itself, or a clearer shot — and I'll take a real pass.",
    );
  });

  it("releases only verified facts when a blocked claim appears", () => {
    const result = verifyOmnisclawFinalText({
      text: "The client is guaranteed eligible and the retainer is signed.",
      context: {
        verifiedFacts: ["The retainer is signed."],
        blockedClaims: ["The client is guaranteed eligible."],
      },
    });

    expect(result.repaired).toBe(true);
    expect(result.blockers).toEqual(["blocked_claim:the_client_is_guaranteed_eligible"]);
    expect(result.text).toBe(
      "Here's what I can verify:\n- The retainer is signed.\nI don't have enough support to go beyond that yet — hand me a source for the rest and I'll keep going.",
    );
  });

  it("skips reasoning, errors, and non-final payloads", () => {
    expect(
      applyOmnisclawBifrostToReplyPayload(
        { text: "APPROVED by BIFROST: hidden", isReasoning: true },
        { info: { kind: "final" } },
      ).text,
    ).toContain("BIFROST");
    expect(
      applyOmnisclawBifrostToReplyPayload(
        { text: "APPROVED by BIFROST: error", isError: true },
        { info: { kind: "final" } },
      ).text,
    ).toContain("BIFROST");
    expect(
      applyOmnisclawBifrostToReplyPayload(
        { text: "APPROVED by BIFROST: block" },
        { info: { kind: "block" } },
      ).text,
    ).toContain("BIFROST");
  });

  it("runs after any existing beforeDeliver hook", async () => {
    const beforeDeliver = createOmnisclawBifrostBeforeDeliver({
      previous: async () => ({ text: "CLARION: definitely eligible" }),
    });

    const result = await beforeDeliver({ text: "ignored" }, { kind: "final" });

    expect(result?.text).toBe(
      "I can't verify that from what I have yet. Give me a source — a link, the text itself, or a clearer shot — and I'll take a real pass.",
    );
    expect(result?.text).not.toMatch(/\b(CLARION|BIFROST|definitely)\b/i);
  });
});
