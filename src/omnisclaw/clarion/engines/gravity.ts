import { shortHash } from "../audit/hash.js";
import type { Candidate, EvidencePacket } from "../types.js";

export function generateCandidateField(packets: EvidencePacket[]): Candidate[] {
  const groups = new Map<
    string,
    { packets: EvidencePacket[]; reasons: Set<string>; signature: string }
  >();

  for (const packet of packets) {
    const anchors = candidateAnchors(packet);
    const primary = anchors[0] ?? `text:${packet.normalized_terms.slice(0, 3).join("-")}`;
    const signature = materialSignature(packet);
    const current = groups.get(primary) ?? { packets: [], reasons: new Set<string>(), signature };
    current.packets.push(packet);
    for (const anchor of anchors) {
      current.reasons.add(
        anchor.startsWith("identifier:") ? "identifier_attraction" : "lexical_attraction",
      );
    }
    if (packet.trust_profile.weight >= 3) {
      current.reasons.add("source_attraction");
    }
    groups.set(primary, current);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([anchor, group], index) => {
      const packetIds = group.packets.map((packet) => packet.packet_id).sort();
      const constraintIds = group.packets
        .flatMap((packet) => packet.constraints.map((constraint) => constraint.constraint_id))
        .sort();
      return {
        candidate_id: `candidate_${String(index + 1).padStart(3, "0")}_${shortHash({ anchor, packetIds })}`,
        candidate_type: inferCandidateType(group.packets),
        support_packet_ids: packetIds,
        active_constraints: constraintIds,
        vetoes: [],
        survival_status: "alive",
        proof_status: "unproven",
        attraction_reasons: [...group.reasons].sort(),
        material_signature: group.signature,
      };
    });
}

export function candidateAnchors(packet: EvidencePacket): string[] {
  const identifiers = packet.extracted_claims
    .filter((claim) => claim.predicate === "identifier")
    .map((claim) => `identifier:${claim.object_ref}`);
  if (identifiers.length > 0) {
    return [...new Set(identifiers)].sort();
  }

  const names = packet.extracted_claims
    .filter((claim) => claim.predicate === "name")
    .map((claim) => `name:${claim.object_ref}`);
  if (names.length > 0) {
    return [...new Set(names)].sort();
  }

  return [`terms:${packet.normalized_terms.slice(0, 3).join("|")}`];
}

function inferCandidateType(packets: EvidencePacket[]): Candidate["candidate_type"] {
  if (
    packets.some((packet) =>
      packet.extracted_claims.some((claim) => claim.predicate === "relationship"),
    )
  ) {
    return "relationship";
  }
  if (
    packets.some((packet) =>
      packet.extracted_claims.some((claim) => claim.predicate === "classification"),
    )
  ) {
    return "classification";
  }
  return "entity";
}

function materialSignature(packet: EvidencePacket): string {
  const name = packet.extracted_claims.find((claim) => claim.predicate === "name")?.object_ref;
  const identifier = packet.extracted_claims.find(
    (claim) => claim.predicate === "identifier",
  )?.object_ref;
  const classification = packet.extracted_claims.find(
    (claim) => claim.predicate === "classification",
  )?.object_ref;
  if (name && identifier) {
    return `${name}#${identifier}`;
  }
  return name ?? identifier ?? classification ?? packet.normalized_terms.slice(0, 3).join(" ");
}
