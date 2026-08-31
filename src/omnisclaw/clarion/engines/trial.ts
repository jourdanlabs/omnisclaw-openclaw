import { shortHash } from "../audit/hash.js";
import type {
  Candidate,
  EchoOutput,
  EvidencePacket,
  FossilOutput,
  MirrorverseConfig,
  TrialOutput,
  Veto,
} from "../types.js";

export function crossExamine(
  candidates: Candidate[],
  packets: EvidencePacket[],
  echo: EchoOutput,
  _strata: FossilOutput,
  config: MirrorverseConfig,
): TrialOutput {
  const packetById = new Map(packets.map((packet) => [packet.packet_id, packet]));
  const outputCandidates = candidates.map((candidate) => structuredClone(candidate));
  const missing_proof: TrialOutput["missing_proof"] = [];
  const exceptions: TrialOutput["exceptions"] = [];

  for (const candidate of outputCandidates) {
    const candidatePackets = candidate.support_packet_ids
      .map((packetId) => packetById.get(packetId))
      .filter((packet): packet is EvidencePacket => packet !== undefined);
    const finding = testRequiredElements(candidate, candidatePackets, echo, config);
    if (finding.length > 0) {
      for (const reason of finding) {
        missing_proof.push({ candidate_id: candidate.candidate_id, reason });
        candidate.vetoes.push(makeTrialVeto(candidate, reason, candidate.support_packet_ids));
      }
      candidate.survival_status = candidate.survival_status === "dead" ? "dead" : "wounded";
      candidate.proof_status = "partially_proven";
    } else if (
      candidate.survival_status === "alive" &&
      !candidate.vetoes.some((veto) => veto.severity === "hard")
    ) {
      candidate.proof_status = "certified";
    }

    if (
      candidate.candidate_type === "relationship" &&
      candidatePackets.some((packet) => packet.timestamps[0]?.valid === false)
    ) {
      exceptions.push({
        candidate_id: candidate.candidate_id,
        reason: "relationship evidence has invalid observation time",
      });
    }
  }

  return {
    candidates: outputCandidates,
    survivors: outputCandidates.filter((candidate) => candidate.survival_status !== "dead"),
    eliminated: outputCandidates.filter((candidate) => candidate.survival_status === "dead"),
    missing_proof,
    exceptions,
  };
}

export function testRequiredElements(
  candidate: Candidate,
  packets: EvidencePacket[],
  echo: EchoOutput,
  config: MirrorverseConfig,
): string[] {
  const reasons: string[] = [];
  const independent = new Set(
    packets.map(
      (packet) =>
        echo.effective_independence_key_by_packet_id[packet.packet_id] ??
        packet.trust_profile.independence_key,
    ),
  );
  const predicates = new Set(
    packets.flatMap((packet) => packet.extracted_claims.map((claim) => claim.predicate)),
  );

  if (candidate.candidate_type === "entity" && independent.size < config.min_independent_packets) {
    reasons.push(
      `identity requires ${config.min_independent_packets} independent support packets; found ${independent.size}`,
    );
  }

  const laundered = echo.duplicate_clusters.filter((cluster) =>
    cluster.packet_ids.some((packetId) => candidate.support_packet_ids.includes(packetId)),
  );
  if (laundered.length > 0) {
    reasons.push(
      `support includes duplicated lineage clusters: ${laundered
        .map((cluster) => cluster.cluster_id)
        .sort()
        .join(", ")}`,
    );
  }

  if (candidate.candidate_type === "classification" && !predicates.has("classification")) {
    reasons.push("classification requires explicit classification evidence");
  }

  if (candidate.candidate_type === "relationship") {
    if (
      !packets.some((packet) =>
        packet.extracted_claims.some(
          (claim) => !["name", "identifier", "valid_until"].includes(claim.predicate),
        ),
      )
    ) {
      reasons.push("relationship requires an explicit relationship claim");
    }
    if (packets.some((packet) => packet.timestamps[0]?.valid === false)) {
      reasons.push("relationship requires temporal compatibility");
    }
  }

  return reasons.sort();
}

function makeTrialVeto(candidate: Candidate, reason: string, packet_ids: string[]): Veto {
  return {
    veto_id: `veto_${shortHash({ candidate_id: candidate.candidate_id, reason, validator: "TRIAL" })}`,
    validator: "TRIAL.burden_of_proof",
    reason,
    severity: "soft",
    packet_ids: [...packet_ids].sort(),
    recoverable: true,
  };
}
