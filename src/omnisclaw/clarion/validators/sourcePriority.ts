import type { EvidencePacket, TrustTier } from "../types.js";

export interface PriorityConflict {
  predicate: string;
  values_by_priority: Array<{
    value: string;
    packet_ids: string[];
    tier: TrustTier;
    priority: number;
  }>;
}

export function findSourcePriorityConflicts(
  packets: EvidencePacket[],
  order: TrustTier[],
  predicates: string[],
): PriorityConflict[] {
  const priority = new Map(order.map((tier, index) => [tier, index]));
  const conflicts: PriorityConflict[] = [];

  for (const predicate of predicates) {
    const byValue = new Map<string, Array<{ packet: EvidencePacket; priority: number }>>();
    for (const packet of packets) {
      for (const claim of packet.extracted_claims.filter(
        (candidateClaim) => candidateClaim.predicate === predicate,
      )) {
        byValue.set(claim.object_ref, [
          ...(byValue.get(claim.object_ref) ?? []),
          {
            packet,
            priority: priority.get(packet.trust_profile.tier) ?? Number.MAX_SAFE_INTEGER,
          },
        ]);
      }
    }

    if (byValue.size < 2) {
      continue;
    }

    conflicts.push({
      predicate,
      values_by_priority: [...byValue.entries()]
        .map(([value, entries]) => {
          const strongest = [...entries].sort(
            (a, b) =>
              a.priority - b.priority || a.packet.packet_id.localeCompare(b.packet.packet_id),
          )[0];
          if (!strongest) {
            throw new Error("unreachable source priority state");
          }
          return {
            value,
            packet_ids: entries.map((entry) => entry.packet.packet_id).sort(),
            tier: strongest.packet.trust_profile.tier,
            priority: strongest.priority,
          };
        })
        .sort((a, b) => a.priority - b.priority || a.value.localeCompare(b.value)),
    });
  }

  return conflicts.sort((a, b) => a.predicate.localeCompare(b.predicate));
}
