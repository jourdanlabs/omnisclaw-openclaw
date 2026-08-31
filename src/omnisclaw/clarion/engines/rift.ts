import { shortHash } from "../audit/hash.js";
import type { Candidate, EvidencePacket, MirrorverseConfig, RiftOutput, Veto } from "../types.js";

export function fractureTest(
  candidates: Candidate[],
  packets: EvidencePacket[],
  config: MirrorverseConfig,
): RiftOutput {
  const packetById = new Map(packets.map((packet) => [packet.packet_id, packet]));
  const outputCandidates = candidates.map((candidate) => structuredClone(candidate));
  const brittle_candidate_ids: string[] = [];
  const fracture_points: RiftOutput["fracture_points"] = [];

  for (const candidate of outputCandidates) {
    if (candidate.survival_status === "dead") {
      continue;
    }
    const candidatePackets = candidate.support_packet_ids
      .map((packetId) => packetById.get(packetId))
      .filter((packet): packet is EvidencePacket => packet !== undefined);
    const strongest = removeKeystoneEvidence(candidatePackets);
    if (!strongest) {
      continue;
    }
    const remaining = candidatePackets.filter((packet) => packet.packet_id !== strongest.packet_id);
    const remainingIndependent = new Set(
      remaining.map((packet) => packet.trust_profile.independence_key),
    );
    const remainingExplicitClaims = remaining
      .flatMap((packet) => packet.extracted_claims)
      .filter((claim) => claim.predicate !== "text_observation");

    if (remainingIndependent.size === 0 || remainingExplicitClaims.length === 0) {
      const reason = "candidate collapses when strongest support packet is removed";
      brittle_candidate_ids.push(candidate.candidate_id);
      fracture_points.push({
        candidate_id: candidate.candidate_id,
        removed_packet_id: strongest.packet_id,
        reason,
      });
      candidate.vetoes.push(makeRiftVeto(candidate, reason, [strongest.packet_id]));
      candidate.survival_status = "wounded";
      candidate.proof_status = "partially_proven";
    }

    for (const fracture of numericToleranceFractures(candidate, candidatePackets, config)) {
      brittle_candidate_ids.push(candidate.candidate_id);
      fracture_points.push(fracture);
      candidate.vetoes.push(
        makeRiftVeto(
          candidate,
          fracture.reason,
          fracture.removed_packet_id === "mutation:numeric_tolerance"
            ? candidate.support_packet_ids
            : [fracture.removed_packet_id],
        ),
      );
      candidate.survival_status = "wounded";
      candidate.proof_status = "partially_proven";
    }
  }

  return {
    candidates: outputCandidates,
    survivors: outputCandidates.filter((candidate) => candidate.survival_status !== "dead"),
    brittle_candidate_ids: brittle_candidate_ids.sort(),
    fracture_points: fracture_points.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id)),
  };
}

function numericToleranceFractures(
  candidate: Candidate,
  packets: EvidencePacket[],
  config: MirrorverseConfig,
): RiftOutput["fracture_points"] {
  if (config.numeric_tolerance <= 0) {
    return [];
  }

  const points: RiftOutput["fracture_points"] = [];
  const numericClaims = packets.flatMap((packet) =>
    packet.extracted_claims.filter((claim) => claim.predicate.startsWith("numeric:")),
  );
  for (let leftIndex = 0; leftIndex < numericClaims.length; leftIndex += 1) {
    const left = numericClaims[leftIndex];
    if (!left) {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < numericClaims.length; rightIndex += 1) {
      const right = numericClaims[rightIndex];
      if (!right || left.predicate !== right.predicate) {
        continue;
      }
      const delta = Math.abs(Number(left.object_ref) - Number(right.object_ref));
      if (delta > 0 && delta <= config.numeric_tolerance) {
        points.push({
          candidate_id: candidate.candidate_id,
          removed_packet_id: "mutation:numeric_tolerance",
          reason: `${left.predicate} only survives because tolerance allows delta ${delta}`,
        });
      }
    }
  }
  return points.sort((a, b) => a.reason.localeCompare(b.reason));
}

export function removeKeystoneEvidence(packets: EvidencePacket[]): EvidencePacket | null {
  return (
    [...packets].sort((a, b) => {
      const weight = b.trust_profile.weight - a.trust_profile.weight;
      if (weight !== 0) {
        return weight;
      }
      return a.packet_id.localeCompare(b.packet_id);
    })[0] ?? null
  );
}

function makeRiftVeto(candidate: Candidate, reason: string, packet_ids: string[]): Veto {
  return {
    veto_id: `veto_${shortHash({ candidate_id: candidate.candidate_id, reason, validator: "RIFT" })}`,
    validator: "RIFT.fracture",
    reason,
    severity: "soft",
    packet_ids,
    recoverable: false,
  };
}
