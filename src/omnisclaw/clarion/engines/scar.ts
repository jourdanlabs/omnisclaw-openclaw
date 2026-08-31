import { shortHash } from "../audit/hash.js";
import type { Candidate, ScarOutput, ScarPattern, Veto } from "../types.js";

export function recordScars(candidates: Candidate[]): ScarOutput {
  const bySignature = new Map<
    string,
    { veto: Veto; candidate_ids: Set<string>; packet_ids: Set<string>; count: number }
  >();

  for (const candidate of candidates) {
    for (const veto of candidate.vetoes) {
      const reason_signature = reasonSignature(veto.reason);
      const key = `${veto.validator}:${veto.severity}:${reason_signature}`;
      const current = bySignature.get(key) ?? {
        veto,
        candidate_ids: new Set<string>(),
        packet_ids: new Set<string>(),
        count: 0,
      };
      current.candidate_ids.add(candidate.candidate_id);
      for (const packetId of veto.packet_ids) {
        current.packet_ids.add(packetId);
      }
      current.count += 1;
      bySignature.set(key, current);
    }
  }

  const patterns: ScarPattern[] = [...bySignature.entries()]
    .map(([key, item]) => ({
      pattern_id: `scar_${shortHash({ key, candidate_ids: [...item.candidate_ids].sort(), packet_ids: [...item.packet_ids].sort() })}`,
      validator: item.veto.validator,
      severity: item.veto.severity,
      reason_signature: reasonSignature(item.veto.reason),
      candidate_ids: [...item.candidate_ids].sort(),
      packet_ids: [...item.packet_ids].sort(),
      occurrence_count: item.count,
    }))
    .sort((a, b) => a.pattern_id.localeCompare(b.pattern_id));

  return {
    patterns,
    scar_flags: patterns.map(
      (pattern) =>
        `scar_pattern:${pattern.pattern_id}:${pattern.validator}:${pattern.reason_signature}`,
    ),
  };
}

function reasonSignature(reason: string): string {
  return reason
    .toLowerCase()
    .replace(/[a-f0-9]{12}/g, "<hash>")
    .replace(/candidate_[0-9]{3}_[a-f0-9]+/g, "<candidate>")
    .replace(/packet_[0-9]{3}/g, "<packet>")
    .replace(/\d+(?:\.\d+)?/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}
