import { afterEach, describe, expect, it, vi } from "vitest";
import { OPENCLAW_PROVIDER_CHAT } from "./pins.mjs";
import {
  assertSecretFreeProviderArtifacts,
  buildTransportHeaderReceiptPair,
  decideProviderTransportEgress,
  DEFAULT_PROVIDER_TARGET,
  governedProviderCall,
  governedProviderCallFromFixture,
  resolveApiShape,
  resolveProviderCredentials,
  resolveProviderResidency,
  resolveProviderTransportTarget,
} from "./provider-gate.mjs";
import { recomputeReceiptSha256, verifyProviderGateReceiptPair } from "./receipts.mjs";

describe("OMNISCLAW provider gate (Track C)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves transport targets from model and request URL", () => {
    const target = resolveProviderTransportTarget(
      {
        id: "gpt-5.4",
        provider: "openai",
        api: "openai-responses",
        baseUrl: "https://api.openai.com",
      },
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
      bound: true,
    });
    expect(resolveProviderResidency("minimax")).toBe("CN");
    expect(resolveApiShape("openai-completions")).toBe("openai_chat");
  });

  it("allows governed provider transport for resolved targets", () => {
    const target = resolveProviderTransportTarget(
      {
        id: "MiniMax-M3",
        provider: "minimax",
        api: "openai-completions",
        baseUrl: "https://api.minimax.io",
      },
      "https://api.minimax.io/v1/chat/completions",
    );
    const egress = decideProviderTransportEgress(
      {
        id: "MiniMax-M3",
        provider: "minimax",
        api: "openai-completions",
        baseUrl: "https://api.minimax.io",
      },
      "https://api.minimax.io/v1/chat/completions",
    );
    expect(target).not.toBeNull();
    expect(egress.allow).toBe(true);
    expect(egress.receipt?.routeId).toBe(OPENCLAW_PROVIDER_CHAT);
  });

  it("builds stream-safe header receipts without a response body", () => {
    const target = resolveProviderTransportTarget(
      {
        id: "MiniMax-M3",
        provider: "minimax",
        api: "openai-completions",
        baseUrl: "https://api.minimax.io",
      },
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

  it("refuses semantically unknown providers instead of residency-GLOBAL-allow", () => {
    const model = {
      id: "evil-1",
      provider: "totally-unknown-provider",
      api: "openai-chat",
    };
    const url = "https://attacker.example/v1/chat";
    expect(resolveProviderResidency(model.provider)).toBe("GLOBAL");
    expect(resolveProviderTransportTarget(model, url)).toBeNull();
    const egress = decideProviderTransportEgress(model, url);
    expect(egress.allow).toBe(false);
    expect(egress.receipt?.decision).toBe("REFUSE");
  });

  it("ignores ambient OMNISCLAW_TERMINUS=0 at the transport layer", () => {
    const governed = decideProviderTransportEgress(
      {
        id: "MiniMax-M3",
        provider: "minimax",
        api: "openai-completions",
        baseUrl: "https://api.minimax.io",
      },
      "https://api.minimax.io/v1/chat/completions",
      { OMNISCLAW_TERMINUS: "0" },
    );
    expect(governed.allow).toBe(true);
    const refused = decideProviderTransportEgress(
      { id: "evil-1", provider: "totally-unknown-provider", api: "openai-chat" },
      "https://attacker.example/v1/chat",
      { OMNISCLAW_TERMINUS: "0" },
    );
    expect(refused.allow).toBe(false);
    expect(refused.receipt?.decision).toBe("REFUSE");
  });

  it("refuses governed calls handed an unbound target directly", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("must not fetch for an unbound target");
    });
    const result = await governedProviderCall({
      target: { ...DEFAULT_PROVIDER_TARGET, provider: "totally-unknown-provider" },
      env: { MINIMAX_API_KEY: "fixture-minimax-key-not-real" },
      fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.live).toBe(false);
    expect(result.provider_calls).toBe(0);
    expect(result.refusal?.decision).toBe("REFUSE");
    expect(result.refusal?.reason).toBe("target_unbound");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses governed calls whose target origin does not match the model", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("must not fetch across origins");
    });
    const result = await governedProviderCall({
      model: {
        id: "gpt-5.4",
        provider: "openai",
        api: "openai-responses",
        baseUrl: "https://api.openai.com",
      },
      target: { ...DEFAULT_PROVIDER_TARGET },
      env: { MINIMAX_API_KEY: "fixture-minimax-key-not-real" },
      fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.provider_calls).toBe(0);
    expect(result.refusal?.decision).toBe("REFUSE");
    expect(result.refusal?.reason).toBe("target_origin_mismatch");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("binds legitimacy to the model's own endpoint, not a name list", () => {
    const openrouter = {
      id: "moonshotai/kimi-k2",
      provider: "openrouter",
      api: "openai-chat",
      baseUrl: "https://openrouter.ai",
    };
    const xai = {
      id: "grok-4",
      provider: "xai",
      api: "openai-chat",
      baseUrl: "https://api.x.ai",
    };
    // Supported providers the old hardcoded list broke: bound traffic allows.
    expect(
      decideProviderTransportEgress(openrouter, "https://openrouter.ai/api/v1/chat/completions")
        .allow,
    ).toBe(true);
    expect(decideProviderTransportEgress(xai, "https://api.x.ai/v1/chat/completions").allow).toBe(
      true,
    );
    // Known name, hostile host: exfiltration-shaped, refuses.
    const openai = {
      id: "gpt-5.4",
      provider: "openai",
      api: "openai-responses",
      baseUrl: "https://api.openai.com",
    };
    expect(
      decideProviderTransportEgress(openai, "https://attacker.example/v1/responses").allow,
    ).toBe(false);
    // Bound model, wrong provider road: refuses.
    const minimax = {
      id: "MiniMax-M3",
      provider: "minimax",
      api: "openai-completions",
      baseUrl: "https://api.minimax.io",
    };
    expect(
      decideProviderTransportEgress(minimax, "https://openrouter.ai/api/v1/chat/completions").allow,
    ).toBe(false);
    // No baseUrl: not a legitimate egress principal, refuses.
    expect(
      decideProviderTransportEgress(
        { id: "gpt-5.4", provider: "openai", api: "openai-responses" },
        "https://api.openai.com/v1/responses",
      ).allow,
    ).toBe(false);
  });

  it("rejects a mutated terminal receipt with a stale hash", async () => {
    const result = await governedProviderCallFromFixture();
    expect(verifyProviderGateReceiptPair(result.started, result.terminal).ok).toBe(true);
    const mutated = {
      ...result.terminal,
      decision: "REFUSE",
      provider_http_status: 500,
    };
    expect(mutated.receiptSha256).toBe(result.terminal?.receiptSha256);
    const verdict = verifyProviderGateReceiptPair(result.started, mutated);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("terminal_hash_mismatch");
  });

  it("rejects a hash-valid terminal whose decision disagrees with ok/pass", async () => {
    const result = await governedProviderCallFromFixture();
    const dishonest = {
      ...result.terminal,
      decision: "REFUSE",
      ok: true,
      pass: true,
    };
    dishonest.receiptSha256 = recomputeReceiptSha256(dishonest);
    const verdict = verifyProviderGateReceiptPair(result.started, dishonest);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("terminal_fake_pass");
  });

  it("refuses live provider calls when no key is present", async () => {
    vi.stubEnv("MINIMAX_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await governedProviderCall({
      model: {
        id: "MiniMax-M3",
        provider: "minimax",
        api: "openai-completions",
        baseUrl: "https://api.minimax.io",
      },
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
