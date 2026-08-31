import type { FinalOutput } from "../types.js";
import { hashCanonical } from "./hash.js";

export function attachAuditHash(output: Omit<FinalOutput, "audit_hash">): FinalOutput {
  return {
    ...output,
    audit_hash: hashCanonical(output),
  };
}
