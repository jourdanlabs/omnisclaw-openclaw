import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const ARTIFACT = join(dirname(fileURLToPath(import.meta.url)), "provider-gate-live-artifact.json");

function persistOk(artifact: Record<string, unknown> | null): boolean {
  if (!artifact) return false;
  if (artifact.schema !== "OmnisclawProviderGateLiveArtifactV1") return false;
  if (artifact.provider_http_status !== 200) return false;
  if (
    !artifact.at ||
    !artifact.provider ||
    !artifact.env_var ||
    !artifact.response_digest ||
    !artifact.started_receipt_sha256 ||
    !artifact.terminal_receipt_sha256
  ) {
    return false;
  }
  return true;
}

describe("live provider-gate artifact (on specified HEAD)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("persists across a key-less verify read", () => {
    vi.stubEnv("MINIMAX_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(existsSync(ARTIFACT)).toBe(true);
    const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
    expect(artifact.schema).toBe("OmnisclawProviderGateLiveArtifactV1");
    expect(artifact.provider_http_status).toBe(200);
    expect(artifact.provider).toBeTruthy();
    expect(artifact.env_var).toBeTruthy();
    expect(artifact.response_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.started_receipt_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.terminal_receipt_sha256).toMatch(/^[a-f0-9]{64}$/);
    const serialized = JSON.stringify(artifact);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]|Bearer [A-Za-z0-9]/);
    expect(process.env.MINIMAX_API_KEY).toBe("");
    expect(process.env.OPENAI_API_KEY).toBe("");
    expect(persistOk(artifact)).toBe(true);
  });

  it("can-fail: stripping schema makes persistOk reject", () => {
    const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
    delete artifact.schema;
    expect(persistOk(artifact)).toBe(false);
  });
});
