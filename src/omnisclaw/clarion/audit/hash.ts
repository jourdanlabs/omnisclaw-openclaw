import { createHash } from "node:crypto";
import { canonicalize } from "./canonicalize.js";

export function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export function shortHash(value: unknown): string {
  return hashCanonical(value).slice(0, 12);
}
