import { shortHash } from "../audit/hash.js";
import type {
  Candidate,
  EvidencePacket,
  FossilOutput,
  MirrorverseConfig,
  StaticOutput,
  Veto,
} from "../types.js";
import { findNumericConflicts } from "../validators/numeric.js";
import { findSourcePriorityConflicts } from "../validators/sourcePriority.js";

const MUTUALLY_EXCLUSIVE: Record<string, Set<string>> = {
  active: new Set(["inactive", "closed", "denied"]),
  inactive: new Set(["active", "open", "approved"]),
  open: new Set(["closed"]),
  closed: new Set(["open"]),
  approved: new Set(["denied", "inactive"]),
  denied: new Set(["approved", "active"]),
};

export function applyVetoes(
  candidates: Candidate[],
  packets: EvidencePacket[],
  strata: FossilOutput,
  config: MirrorverseConfig,
): StaticOutput {
  const packetById = new Map(packets.map((packet) => [packet.packet_id, packet]));
  const outputCandidates = candidates.map((candidate) => structuredClone(candidate));
  const uncertainty_flags: string[] = [
    ...strata.continuity_gaps.map((gap) => `continuity_gap:${gap}`),
  ];
  const vetoes: Veto[] = [];

  for (const candidate of outputCandidates) {
    const candidatePackets = candidate.support_packet_ids
      .map((packetId) => packetById.get(packetId))
      .filter((packet): packet is EvidencePacket => packet !== undefined);
    for (const packet of candidatePackets) {
      for (const constraint of packet.constraints) {
        if (constraint.hard_veto) {
          addVeto(candidate, vetoes, {
            validator: "STATIC.temporal",
            reason: constraint.rule,
            severity: "hard",
            packet_ids: [packet.packet_id],
            recoverable: false,
          });
        }
      }
    }

    detectHardContradictions(candidate, candidatePackets, vetoes, config);
    detectSoftAmbiguity(candidate, candidatePackets, vetoes, uncertainty_flags);
    applySurvival(candidate);
  }

  return {
    candidates: outputCandidates,
    survivors: outputCandidates.filter((candidate) => candidate.survival_status !== "dead"),
    eliminated: outputCandidates.filter((candidate) => candidate.survival_status === "dead"),
    vetoes,
    uncertainty_flags: uncertainty_flags.sort(),
  };
}

export function detectHardContradictions(
  candidate: Candidate,
  packets: EvidencePacket[],
  vetoes: Veto[],
  config: MirrorverseConfig,
): void {
  const identifiersByPacket = new Map<string, Set<string>>();
  for (const packet of packets) {
    const identifiers = new Set(
      packet.extracted_claims
        .filter((claim) => claim.predicate === "identifier")
        .map((claim) => claim.object_ref),
    );
    if (identifiers.size > 1) {
      addVeto(candidate, vetoes, {
        validator: "STATIC.identity",
        reason: `single packet asserts incompatible identifiers: ${[...identifiers].sort().join(", ")}`,
        severity: "hard",
        packet_ids: [packet.packet_id],
        recoverable: false,
      });
    }
    identifiersByPacket.set(packet.packet_id, identifiers);
  }

  for (const packet of packets) {
    const statuses = new Set(
      packet.extracted_claims
        .filter((claim) => claim.predicate === "status")
        .map((claim) => claim.object_ref),
    );
    for (const status of statuses) {
      const opposites = MUTUALLY_EXCLUSIVE[status] ?? new Set<string>();
      const conflict = [...statuses].find((candidateStatus) => opposites.has(candidateStatus));
      if (conflict) {
        addVeto(candidate, vetoes, {
          validator: "STATIC.source_disagreement",
          reason: `single source asserts mutually exclusive statuses: ${status} vs ${conflict}`,
          severity: "hard",
          packet_ids: [packet.packet_id],
          recoverable: false,
        });
      }
    }
  }

  const statusesByPacket = packets.map((packet) => ({
    packet_id: packet.packet_id,
    statuses: new Set(
      packet.extracted_claims
        .filter((claim) => claim.predicate === "status")
        .map((claim) => claim.object_ref),
    ),
  }));
  for (const left of statusesByPacket) {
    for (const right of statusesByPacket) {
      if (left.packet_id >= right.packet_id) {
        continue;
      }
      for (const status of left.statuses) {
        const opposites = MUTUALLY_EXCLUSIVE[status] ?? new Set<string>();
        const conflict = [...right.statuses].find((candidateStatus) =>
          opposites.has(candidateStatus),
        );
        if (conflict) {
          addVeto(candidate, vetoes, {
            validator: "STATIC.source_disagreement",
            reason: `sources assert mutually exclusive statuses: ${status} vs ${conflict}`,
            severity: "hard",
            packet_ids: [left.packet_id, right.packet_id].sort(),
            recoverable: false,
          });
        }
      }
    }
  }

  for (const conflict of findNumericConflicts(
    packets.flatMap((packet) => packet.extracted_claims),
    config.numeric_tolerance,
  )) {
    addVeto(candidate, vetoes, {
      validator: "STATIC.numeric",
      reason: `${conflict.predicate} differs by ${conflict.delta}, exceeding tolerance ${config.numeric_tolerance}`,
      severity: "hard",
      packet_ids: [
        ...new Set([...conflict.left.support_packet_ids, ...conflict.right.support_packet_ids]),
      ].sort(),
      recoverable: false,
    });
  }

  for (const conflict of findSourcePriorityConflicts(packets, config.source_priority_order, [
    "classification",
  ])) {
    const strongest = conflict.values_by_priority[0];
    if (!strongest) {
      continue;
    }
    addVeto(candidate, vetoes, {
      validator: "STATIC.source_priority",
      reason: `${conflict.predicate} has incompatible values; strongest source tier ${strongest.tier} asserts ${strongest.value}`,
      severity: "soft",
      packet_ids: [
        ...new Set(conflict.values_by_priority.flatMap((entry) => entry.packet_ids)),
      ].sort(),
      recoverable: true,
    });
  }
}

export function detectSoftAmbiguity(
  candidate: Candidate,
  packets: EvidencePacket[],
  vetoes: Veto[],
  uncertaintyFlags: string[],
): void {
  const trustTiers = new Set(packets.map((packet) => packet.trust_profile.tier));
  if (trustTiers.size > 1) {
    addVeto(candidate, vetoes, {
      validator: "STATIC.trust_conflict",
      reason: `mixed source trust tiers: ${[...trustTiers].sort().join(", ")}`,
      severity: "soft",
      packet_ids: packets.map((packet) => packet.packet_id).sort(),
      recoverable: true,
    });
  }

  const names = new Set(
    packets.flatMap((packet) =>
      packet.extracted_claims
        .filter((claim) => claim.predicate === "name")
        .map((claim) => claim.object_ref),
    ),
  );
  if (names.size > 1) {
    uncertaintyFlags.push(`${candidate.candidate_id}:name_aliases:${[...names].sort().join("|")}`);
  }
}

export function applySurvival(candidate: Candidate): void {
  if (candidate.vetoes.some((veto) => veto.severity === "hard")) {
    candidate.survival_status = "dead";
    candidate.proof_status = "unproven";
  } else if (candidate.vetoes.some((veto) => veto.severity === "soft")) {
    candidate.survival_status = "wounded";
    candidate.proof_status = "partially_proven";
  }
}

function addVeto(candidate: Candidate, vetoes: Veto[], veto: Omit<Veto, "veto_id">): void {
  const withId = {
    ...veto,
    veto_id: `veto_${shortHash({ candidate_id: candidate.candidate_id, ...veto })}`,
  };
  candidate.vetoes.push(withId);
  vetoes.push(withId);
}
