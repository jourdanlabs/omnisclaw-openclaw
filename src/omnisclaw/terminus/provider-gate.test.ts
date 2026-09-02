import { afterEach, describe, expect, it, vi } from "vitest";
import { OPENCLAW_PROVIDER_CHAT } from "./pins.mjs";
import {
  assertSecretFreeProviderArtifacts,
  buildTransportHeaderReceiptPair,
  decideProviderTransportEgress,
  governedProviderCall,
  governedProviderCallFromFixture,
  resolveApiShape,
  resolveProviderCredentials,
  resolveProviderResidency,
  resolveProviderTransportTarget,
} from "./provider-gate.mjs";
import { verifyProviderGateReceiptPair } from "./receipts.mjs";

describe("OMNISCLAW provider gate (Track C)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves transport targets from model and request URL", () => {
    const target = resolveProviderTransportTarget(
      { id: "gpt-5.4", provider: "openai", api: "openai-responses" },
      "https://api.openai.com/v1/responses",
    );
    expect(target).toEqual({
      provider: "openai",
      scheme: "https",
      hostname: "api.openai.com",
      port: 443,
      path: "/v1/responses",
      model: "gpt-5.4",
      residency: "US",
      api_shape: "openai_responses",
    });
    expect(resolveProviderResidency("minimax")).toBe("CN");
    expect(resolveApiShape("openai-completions")).toBe("openai_chat");
  });

  it("allows governed provider transport for resolved targets", () => {
    const target = resolveProviderTransportTarget(
      { id: "MiniMax-M3", provider: "minimax", api: "openai-completions" },
      "https://api.minimax.io/v1/chat/completions",
    );
    const egress = decideProviderTransportEgress(
      { id: "MiniMax-M3", provider: "minimax", api: "openai-completions" },
      "https://api.minimax.io/v1/chat/completions",
    );
    expect(target).not.toBeNull();
    expect(egress.allow).toBe(true);
    expect(egress.receipt?.routeId).toBe(OPENCLAW_PROVIDER_CHAT);
  });

  it("builds stream-safe header receipts without a response body", () => {
    const target = resolveProviderTransportTarget(
      { id: "MiniMax-M3", provider: "minimax", api: "openai-completions" },
      "https://api.minimax.io/v1/chat/completions",
    );
    const recorded = buildTransportHeaderReceiptPair({
      target,
      url: "https://api.minimax.io/v1/chat/completions",
      status: 200,
    });
    expect(recorded.body_digested).toBe(false);
    expect(recorded.streamed).toBe(true);
    expect(recorded.pair.ok).toBe(true);
    expect(recorded.terminal.response_digest).toBeNull();
    expect(recorded.terminal.reason).toBe("transport_headers_only");
  });

  it("refuses transport egress when target cannot be resolved", () => {
    const egress = decideProviderTransportEgress({ provider: "openai" }, "not-a-url");
    expect(egress.allow).toBe(false);
    expect(egress.receipt?.reason).toBe("unknown_target");
  });

  it("refuses live provider calls when no key is present", async () => {
    vi.stubEnv("MINIMAX_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await governedProviderCall({
      env: { MINIMAX_API_KEY: "", OPENAI_API_KEY: "" },
      fetch: vi.fn(),
    });
    expect(result.ok).toBe(false);
    expect(result.live).toBe(false);
    expect(result.owed).toBe(true);
    expect(result.provider_calls).toBe(0);
    expect(result.refusal?.decision).toBe("REFUSE");
    expect(result.refusal?.reason).toBe("provider_key_missing");
    expect(result.refusal?.routeId).toBe(OPENCLAW_PROVIDER_CHAT);
    expect(result.refusal?.ok).toBe(false);
    expect(result.started).toBeNull();
    expect(result.terminal).toBeNull();
    assertSecretFreeProviderArtifacts({ refusal: result.refusal });
  });

  it("resolves provider credentials from MINIMAX first", () => {
    const resolved = resolveProviderCredentials({
      MINIMAX_API_KEY: "mm-fixture",
      OPENAI_API_KEY: "oa-fixture",
    });
    expect(resolved.ok).toBe(true);
    expect(resolved.envVar).toBe("MINIMAX_API_KEY");
    expect(resolved.provider).toBe("minimax");
  });

  it("runs a fixture-backed governed call with dual receipts and zero secret egress", async () => {
    const result = await governedProviderCallFromFixture();
    expect(result.ok).toBe(true);
    expect(result.live).toBe(false);
    expect(result.provider_calls).toBe(1);
    expect(result.started?.phase).toBe("STARTED");
    expect(result.terminal?.phase).toBe("TERMINAL");
    expect(result.started?.ok).toBe(true);
    expect(result.terminal?.ok).toBe(true);
    expect(verifyProviderGateReceiptPair(result.started, result.terminal)).toEqual({
      ok: true,
      reason: "provider_gate_pair_valid",
    });
    assertSecretFreeProviderArtifacts({
      started: result.started,
      terminal: result.terminal,
      apiKey: "fixture-minimax-key-not-real",
      prompt: "Reply with exactly: ACK",
      responseText:
        '{"id":"fixture-chat","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"ACK"},"finish_reason":"stop"}],"usage":{"prompt_tokens":8,"completion_tokens":2,"total_tokens":10}}',
    });
    const serialized = JSON.stringify({ started: result.started, terminal: result.terminal });
    expect(serialized).not.toContain("fixture-minimax-key-not-real");
    expect(serialized).not.toContain("Reply with exactly: ACK");
    expect(serialized).not.toContain('"content":"ACK"');
  });
});
