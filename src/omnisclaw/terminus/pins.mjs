/**
 * Frozen TERMINUS-CONTRACT-V1 pins. Do not invent alternate identities.
 * Authority: caduceus-code-wave4 80874fd1d326facc6ae6af0416de35f9bdef0a33
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TERMINUS_CONTRACT_VERSION = "TERMINUS-CONTRACT-V1";
export const TERMINUS_CONTRACT_PIN = "80874fd1d326facc6ae6af0416de35f9bdef0a33";
export const OMNIS_GATE_PIN = "02322c52b6e95a8c10fe3ab110ab18dfea59891e";
export const PRODUCT = "omnis-claw";
export const CARD = "OMNISCLAW-TERMINUS-EGRESS-V1";
export const SLICE_STATUS = "BUILT_NOT_SHIPPED";
export const CLAIM_BOUNDARY =
  "local fail-closed egress on known delivery routes plus fixture-proven provider gate; not a CADUCEUS join; live provider turn OWED until keys exist";

export const CHANNEL_AUTO_REPLY_FINAL = "channel.auto_reply.final";
export const AGENT_COMMAND_FINAL = "agent.command.final";
export const OPENCLAW_PROVIDER_CHAT = "openclaw.provider.chat";
export const DIRECT_PROVIDER_ANY = "direct.provider.any";
export const CADUCEUS_CHAT = "caduceus.chat";

export function vendorPinPath() {
  return join(dirname(fileURLToPath(import.meta.url)), "TERMINUS_CONTRACT_PIN");
}

export function readVendorPin() {
  return readFileSync(vendorPinPath(), "utf8").trim();
}

export function assertVendorPin() {
  const onDisk = readVendorPin();
  if (onDisk !== TERMINUS_CONTRACT_PIN) {
    throw new Error("TERMINUS_PIN_MISMATCH:" + onDisk);
  }
}
