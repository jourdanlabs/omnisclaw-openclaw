import { afterEach, describe, expect, it, vi } from "vitest";
import { createOmnisclawBifrostBeforeDeliver } from "../bifrost-delivery-filter.js";
import { loadCoverage } from "./coverage.mjs";
import {
  applyOmnisclawTerminusToReplyPayload,
  decideTerminusEgress,
  refuseDirectProvider,
  terminusEnabled,
  terminusRefusalText,
} from "./egress-gate.mjs";
import {
  AGENT_COMMAND_FINAL,
  assertVendorPin,
  CHANNEL_AUTO_REPLY_FINAL,
  SLICE_STATUS,
  TERMINUS_CONTRACT_PIN,
} from "./pins.mjs";

const COMPLETE_TARGET = {
  provider: "minimax",
  scheme: "https",
  hostname: "api.minimax.io",
  port: 443,
  path: "/v1/chat/completions",
  model: "MiniMax-M3",
  residency: "CN",
  api_shape: "openai_chat",
};

describe("OMNISCLAW TERMINUS egress", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pins the house TERMINUS-CONTRACT-V1 identity", () => {
    assertVendorPin();
    const coverage = loadCoverage();
    expect(coverage.caduceus_pin).toBe(TERMINUS_CONTRACT_PIN);
    expect(coverage.product).toBe("omnis-claw");
    expect(SLICE_STATUS).toBe("BUILT_NOT_SHIPPED");
  });

  it("has no ambient kill-switch: OMNISCLAW_TERMINUS=0 cannot disable the gate", () => {
    expect(terminusEnabled()).toBe(true);
    expect(terminusEnabled({ OMNISCLAW_TERMINUS: "0" })).toBe(true);
    const refused = applyOmnisclawTerminusToReplyPayload(
      { text: "hello from an unknown pipe" },
      { routeId: "not.a.route", env: { OMNISCLAW_TERMINUS: "0" } },
    );
    expect(refused.text).toBe(terminusRefusalText("unknown_route"));
  });

  it("refuses unknown routes and never marks a pass", () => {
    const missing = decideTerminusEgress({});
    expect(missing.allow).toBe(false);
    expect(missing.receipt.ok).toBe(false);
    expect(missing.receipt.pass).toBe(false);
    expect(missing.receipt.decision).toBe("REFUSE");
    expect(missing.receipt.status).toBe("UNKNOWN");
    expect(missing.receipt.reason).toBe("unknown_route");
    expect(missing.receipt.receiptSha256).toMatch(/^[0-9a-f]{64}$/u);

    const unknown = decideTerminusEgress({ routeId: "not.a.route" });
    expect(unknown.allow).toBe(false);
    expect(unknown.receipt.ok).toBe(false);
    expect(unknown.receipt.pass).toBe(false);
    expect(unknown.receipt.reason).toBe("unknown_route");
    expect(unknown.receipt.status).toBe("UNKNOWN");
  });

  it("refuses incomplete or extra-field targets as unknown", () => {
    const incomplete = decideTerminusEgress({
      routeId: CHANNEL_AUTO_REPLY_FINAL,
      target: { provider: "minimax" },
    });
    expect(incomplete.allow).toBe(false);
    expect(incomplete.receipt.ok).toBe(false);
    expect(incomplete.receipt.reason).toBe("unknown_target");

    const extra = decideTerminusEgress({
      routeId: CHANNEL_AUTO_REPLY_FINAL,
      target: { ...COMPLETE_TARGET, extra: "nope" } as typeof COMPLETE_TARGET,
    });
    expect(extra.allow).toBe(false);
    expect(extra.receipt.reason).toBe("unknown_target");
  });

  it("refuses DISABLED routes and allows governed provider chat", () => {
    const direct = refuseDirectProvider("minimax");
    expect(direct.allow).toBe(false);
    expect(direct.receipt.ok).toBe(false);
    expect(direct.receipt.pass).toBe(false);
    expect(direct.receipt.status).toBe("DISABLED");

    const provider = decideTerminusEgress({
      routeId: "openclaw.provider.chat",
      target: COMPLETE_TARGET,
    });
    expect(provider.allow).toBe(true);
    expect(provider.receipt.ok).toBe(true);
    expect(provider.receipt.status).toBe("GOVERNED");

    const caduceus = decideTerminusEgress({ routeId: "caduceus.chat" });
    expect(caduceus.allow).toBe(false);
    expect(caduceus.receipt.status).toBe("DISABLED");
  });

  it("allows known Telegram/auto-reply and agent-command finals", () => {
    const telegram = decideTerminusEgress({ routeId: CHANNEL_AUTO_REPLY_FINAL });
    expect(telegram.allow).toBe(true);
    expect(telegram.receipt.ok).toBe(true);
    expect(telegram.receipt.pass).toBe(true);
    expect(telegram.receipt.reason).toBe("governed_route");

    const withTarget = decideTerminusEgress({
      routeId: CHANNEL_AUTO_REPLY_FINAL,
      target: COMPLETE_TARGET,
    });
    expect(withTarget.allow).toBe(true);

    const agent = decideTerminusEgress({ routeId: AGENT_COMMAND_FINAL });
    expect(agent.allow).toBe(true);
    expect(agent.receipt.ok).toBe(true);
  });

  it("rewrites unknown-route finals and leaves known Telegram text alone", () => {
    const refused = applyOmnisclawTerminusToReplyPayload(
      { text: "hello from an unknown pipe" },
      { routeId: "not.a.route" },
    );
    expect(refused.text).toBe(terminusRefusalText("unknown_route"));
    expect(refused.text).not.toMatch(/send anyway/i);

    const telegram = applyOmnisclawTerminusToReplyPayload(
      { text: "Yo! I'm here. What's up?" },
      { ctx: { Body: "yo", Provider: "telegram", Surface: "telegram" } },
    );
    expect(telegram.text).toBe("Yo! I'm here. What's up?");
  });

  it("sits on top of BIFROST without ripping it out", async () => {
    const beforeDeliver = createOmnisclawBifrostBeforeDeliver({
      ctx: { Body: "check this", Provider: "telegram", Surface: "telegram" },
    });
    const repaired = await beforeDeliver(
      { text: "The client is guaranteed eligible." },
      { kind: "final" },
    );
    expect(repaired?.text).toBe(
      "I can't verify that from what I have yet. Give me a source — a link, the text itself, or a clearer shot — and I'll take a real pass.",
    );

    const unknown = applyOmnisclawTerminusToReplyPayload(
      { text: "The client is guaranteed eligible." },
      { routeId: "mystery.egress" },
    );
    expect(unknown.text).toBe(terminusRefusalText("unknown_route"));
  });
});
