import type { Candidate, EvidencePacket, FossilOutput } from "../types.js";

export function reconstructDependencyLayers(
  candidates: Candidate[],
  packets: EvidencePacket[],
): FossilOutput {
  const sortedPackets = [...packets].sort((a, b) =>
    `${timestampValue(a)}:${a.packet_id}`.localeCompare(`${timestampValue(b)}:${b.packet_id}`),
  );
  const dependency_layers = sortedPackets.map((packet, index) => ({
    layer_id: `layer_${String(index + 1).padStart(3, "0")}`,
    packet_ids: [packet.packet_id],
    claim_ids: packet.extracted_claims.map((claim) => claim.claim_id).sort(),
    timestamp: packet.timestamps[0]?.value ?? "unknown",
  }));

  const ancestry_chains = sortedPackets.flatMap((packet, packetIndex) =>
    packet.extracted_claims.map((claim) => ({
      claim_id: claim.claim_id,
      ancestor_claim_ids: sortedPackets
        .slice(0, packetIndex)
        .flatMap((previous) => previous.extracted_claims)
        .filter(
          (previousClaim) =>
            previousClaim.subject_ref === claim.subject_ref &&
            previousClaim.predicate === claim.predicate,
        )
        .map((previousClaim) => previousClaim.claim_id)
        .sort(),
    })),
  );

  const supported = new Set(candidates.flatMap((candidate) => candidate.support_packet_ids));
  const orphan_claim_ids = packets
    .filter((packet) => !supported.has(packet.packet_id))
    .flatMap((packet) => packet.extracted_claims.map((claim) => claim.claim_id))
    .sort();

  const continuity_gaps = candidates
    .filter((candidate) => candidate.support_packet_ids.length === 1)
    .map((candidate) => `${candidate.candidate_id}:single_layer_candidate`);

  return {
    dependency_layers,
    ancestry_chains,
    continuity_gaps,
    orphan_claim_ids,
  };
}

function timestampValue(packet: EvidencePacket): string {
  return packet.timestamps[0]?.value ?? "9999-99-99";
}
