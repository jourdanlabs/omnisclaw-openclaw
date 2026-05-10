import { shortHash } from "../audit/hash.js";
import type {
  Candidate,
  ClockworkOutput,
  EvidencePacket,
  MirrorverseConfig,
  Veto,
} from "../types.js";
import { parseDateStrict } from "./prism.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function checkFreshness(
  candidates: Candidate[],
  packets: EvidencePacket[],
  config: MirrorverseConfig,
): ClockworkOutput {
  const packetById = new Map(packets.map((packet) => [packet.packet_id, packet]));
  const decisionTime = parseDateStrict(config.decision_time);
  if (!decisionTime) {
    throw new Error(`Invalid deterministic decision_time: ${config.decision_time}`);
  }

  const stale_packet_ids = new Set<string>();
  const stale_claim_ids = new Set<string>();
  const expired_claim_ids = new Set<string>();
  const time_valid_claim_ids = new Set<string>();
  const outputCandidates = candidates.map((candidate) => structuredClone(candidate));

  for (const packet of packets) {
    const observed = packet.timestamps.find((marker) => marker.kind === "observed");
    const observedDate = observed ? parseDateStrict(observed.value) : null;
    if (!observedDate || ageDays(observedDate, decisionTime) > config.stale_half_life_days) {
      stale_packet_ids.add(packet.packet_id);
    }

    for (const claim of packet.extracted_claims) {
      const claimHalfLife =
        config.predicate_half_life_days[claim.predicate] ?? config.stale_half_life_days;
      const claimIsStale = !observedDate || ageDays(observedDate, decisionTime) > claimHalfLife;
      if (claimIsStale) {
        stale_claim_ids.add(claim.claim_id);
      }
      if (claim.predicate === "valid_until") {
        const expires = parseDateStrict(claim.object_ref);
        if (!expires || expires.getTime() < decisionTime.getTime()) {
          expired_claim_ids.add(claim.claim_id);
        } else if (!claimIsStale) {
          time_valid_claim_ids.add(claim.claim_id);
        }
      } else if (!claimIsStale) {
        time_valid_claim_ids.add(claim.claim_id);
      }
    }
  }

  for (const candidate of outputCandidates) {
    const candidatePackets = candidate.support_packet_ids
      .map((packetId) => packetById.get(packetId))
      .filter((packet): packet is EvidencePacket => packet !== undefined);
    const staleSupport = candidatePackets.filter((packet) =>
      stale_packet_ids.has(packet.packet_id),
    );
    const explicitClaims = candidatePackets
      .flatMap((packet) => packet.extracted_claims)
      .filter((claim) => claim.predicate !== "text_observation");
    const staleClaims = explicitClaims.filter((claim) => stale_claim_ids.has(claim.claim_id));
    if (staleSupport.length === candidatePackets.length && candidatePackets.length > 0) {
      candidate.vetoes.push(
        makeClockworkVeto(
          candidate,
          "all support packets are stale at decision time",
          staleSupport.map((packet) => packet.packet_id),
        ),
      );
      candidate.survival_status = "wounded";
      candidate.proof_status = "partially_proven";
    } else if (staleClaims.length === explicitClaims.length && explicitClaims.length > 0) {
      candidate.vetoes.push(
        makeClockworkVeto(
          candidate,
          "all explicit support claims are stale at decision time",
          candidate.support_packet_ids,
        ),
      );
      candidate.survival_status = "wounded";
      candidate.proof_status = "partially_proven";
    } else if (staleClaims.length > 0) {
      candidate.vetoes.push(
        makeClockworkVeto(
          candidate,
          "some explicit support claims are stale at decision time",
          candidate.support_packet_ids,
        ),
      );
      candidate.survival_status =
        candidate.survival_status === "alive" ? "wounded" : candidate.survival_status;
      if (candidate.proof_status === "certified") {
        candidate.proof_status = "partially_proven";
      }
    } else if (staleSupport.length > 0) {
      candidate.vetoes.push(
        makeClockworkVeto(
          candidate,
          "some support packets are stale at decision time",
          staleSupport.map((packet) => packet.packet_id),
        ),
      );
      candidate.survival_status =
        candidate.survival_status === "alive" ? "wounded" : candidate.survival_status;
      if (candidate.proof_status === "certified") {
        candidate.proof_status = "partially_proven";
      }
    }
  }

  return {
    candidates: outputCandidates,
    survivors: outputCandidates.filter((candidate) => candidate.survival_status !== "dead"),
    stale_packet_ids: [...stale_packet_ids].sort(),
    stale_claim_ids: [...stale_claim_ids].sort(),
    expired_claim_ids: [...expired_claim_ids].sort(),
    time_valid_claim_ids: [...time_valid_claim_ids].sort(),
  };
}

function ageDays(observed: Date, decisionTime: Date): number {
  return Math.max(0, (decisionTime.getTime() - observed.getTime()) / DAY_MS);
}

function makeClockworkVeto(candidate: Candidate, reason: string, packet_ids: string[]): Veto {
  return {
    veto_id: `veto_${shortHash({ candidate_id: candidate.candidate_id, reason, validator: "CLOCKWORK" })}`,
    validator: "CLOCKWORK.decay",
    reason,
    severity: "soft",
    packet_ids: [...packet_ids].sort(),
    recoverable: true,
  };
}
