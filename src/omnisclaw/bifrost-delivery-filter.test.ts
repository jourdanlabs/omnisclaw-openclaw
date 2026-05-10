import { describe, expect, it } from "vitest";
import {
  applyOmnisclawBifrostToReplyPayload,
  createOmnisclawBifrostBeforeDeliver,
  verifyOmnisclawFinalText,
} from "./bifrost-delivery-filter.js";

describe("OMNISCLAW BIFROST delivery filter", () => {
  it("removes visible verifier language from final replies", () => {
    const result = applyOmnisclawBifrostToReplyPayload(
      {
        text: "APPROVED by BIFROST: The file is ready for review.",
      },
      { info: { kind: "final" } },
    );

    expect(result.text).toBe("The file is ready for review.");
    expect(result.text).not.toMatch(/\b(APPROVED|BIFROST|CLARION|SENTINEL|AURORA)\b/i);
  });

  it("softens obvious unsupported eligibility certainty", () => {
    const result = verifyOmnisclawFinalText({
      text: "The client is guaranteed eligible.",
    });

    expect(result.repaired).toBe(true);
    expect(result.text).toBe("The client is not verified as eligible.");
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

    expect(result?.text).toBe("not verified as eligible");
  });
});
