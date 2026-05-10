import { hashCanonical, shortHash } from "../audit/hash.js";
import type { Candidate, EvidencePacket, InquestOutput, MirrorverseTrace } from "../types.js";

export function buildInquest(trace: Omit<MirrorverseTrace, "inquest">): InquestOutput {
  const allCandidates = mergeCandidates(
    trace.candidates,
    trace.static.eliminated,
    trace.clockwork.candidates,
    trace.final.eliminated_candidates,
  );
  const packetsById = new Map(trace.prism.packets.map((packet) => [packet.packet_id, packet]));

  const withoutHash = {
    candidate_dossiers: allCandidates
      .map((candidate) => dossierFor(candidate, trace, packetsById))
      .sort((a, b) => a.candidate_id.localeCompare(b.candidate_id)),
    release_blockers: trace.final.uncertainty_summary
      .map(toReleaseBlocker)
      .sort((a, b) => a.blocker_id.localeCompare(b.blocker_id)),
    proof_ledger: trace.prism.packets
      .map((packet) => ({
        packet_id: packet.packet_id,
        claim_ids: packet.extracted_claims.map((claim) => claim.claim_id).sort(),
        provenance_hash: packet.provenance_hash,
        effective_independence_key:
          trace.echo.effective_independence_key_by_packet_id[packet.packet_id] ??
          packet.trust_profile.independence_key,
      }))
      .sort((a, b) => a.packet_id.localeCompare(b.packet_id)),
  };

  return {
    ...withoutHash,
    audit_hash: hashCanonical(withoutHash),
  };
}

function dossierFor(
  candidate: Candidate,
  trace: Omit<MirrorverseTrace, "inquest">,
  packetsById: Map<string, EvidencePacket>,
): InquestOutput["candidate_dossiers"][number] {
  const packets = candidate.support_packet_ids
    .map((packetId) => packetsById.get(packetId))
    .filter((packet): packet is EvidencePacket => packet !== undefined);
  const recovery = trace.latch.recovery_actions
    .filter((action) => action.candidate_id === candidate.candidate_id)
    .map((action) => action.action_id)
    .sort();
  const scars = trace.scar.patterns
    .filter((pattern) => pattern.candidate_ids.includes(candidate.candidate_id))
    .map((pattern) => pattern.pattern_id)
    .sort();

  return {
    candidate_id: candidate.candidate_id,
    material_signature: candidate.material_signature,
    survival_status: candidate.survival_status,
    proof_status: candidate.proof_status,
    support_packet_ids: [...candidate.support_packet_ids].sort(),
    proof_claim_ids: packets
      .flatMap((packet) => packet.extracted_claims.map((claim) => claim.claim_id))
      .sort(),
    wounds: candidate.vetoes
      .map((veto) => ({
        validator: veto.validator,
        reason: veto.reason,
        severity: veto.severity,
        recoverable: veto.recoverable,
      }))
      .sort((a, b) => `${a.validator}:${a.reason}`.localeCompare(`${b.validator}:${b.reason}`)),
    recovery_action_ids: recovery,
    scar_pattern_ids: scars,
    death_certificate: candidate.survival_status === "dead" ? deathCertificate(candidate) : null,
  };
}

function toReleaseBlocker(detail: string): InquestOutput["release_blockers"][number] {
  const code = blockerCode(detail);
  return {
    blocker_id: `blocker_${shortHash({ code, detail })}`,
    code,
    severity: blockerSeverity(code),
    detail,
  };
}

function blockerCode(detail: string): InquestOutput["release_blockers"][number]["code"] {
  if (detail.startsWith("ambiguous_survivors:")) return "ambiguous_survivors";
  if (detail.startsWith("brittle_evidence:")) return "brittle_evidence";
  if (detail.startsWith("critical_framing_ambiguity:")) return "critical_framing_ambiguity";
  if (detail.startsWith("duplicate_source_laundering:")) return "duplicate_source_laundering";
  if (detail.startsWith("missing_proof:")) return "missing_proof";
  if (detail === "no_certified_candidate") return "no_certified_candidate";
  if (detail.startsWith("recovery_action:")) return "recovery_action";
  if (detail.startsWith("scar_pattern:")) return "scar_pattern";
  if (detail.startsWith("stale_evidence:")) return "stale_evidence";
  if (detail.startsWith("stale_claim:")) return "stale_claim";
  return "other";
}

function blockerSeverity(
  code: InquestOutput["release_blockers"][number]["code"],
): InquestOutput["release_blockers"][number]["severity"] {
  if (
    code === "ambiguous_survivors" ||
    code === "critical_framing_ambiguity" ||
    code === "stale_evidence" ||
    code === "stale_claim"
  ) {
    return "fatal";
  }
  if (code === "recovery_action" || code === "scar_pattern") {
    return "info";
  }
  return "warning";
}

function deathCertificate(candidate: Candidate): string {
  const hard = candidate.vetoes.find((veto) => veto.severity === "hard");
  return hard ? `${hard.validator}: ${hard.reason}` : "candidate marked dead without hard veto";
}

function mergeCandidates(...groups: Candidate[][]): Candidate[] {
  const byId = new Map<string, Candidate>();
  for (const group of groups) {
    for (const candidate of group) {
      const existing = byId.get(candidate.candidate_id);
      if (!existing || rank(candidate) >= rank(existing)) {
        byId.set(candidate.candidate_id, candidate);
      }
    }
  }
  return [...byId.values()];
}

function rank(candidate: Candidate): number {
  if (candidate.survival_status === "dead") return 3;
  if (candidate.vetoes.length > 0) return 2;
  if (candidate.proof_status === "certified") return 1;
  return 0;
}
