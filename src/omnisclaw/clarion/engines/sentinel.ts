import { attachAuditHash } from "../audit/artifact.js";
import { shortHash } from "../audit/hash.js";
import type {
  Candidate,
  ClockworkOutput,
  EchoOutput,
  FinalOutput,
  LatchOutput,
  MirrorverseConfig,
  ParallaxOutput,
  PrismOutput,
  RiftOutput,
  ScarOutput,
  StaticOutput,
  TrialOutput,
  Veto,
} from "../types.js";

export interface SentinelInput {
  config: MirrorverseConfig;
  prism: PrismOutput;
  echo: EchoOutput;
  static: StaticOutput;
  trial: TrialOutput;
  parallax: ParallaxOutput;
  rift: RiftOutput;
  clockwork: ClockworkOutput;
  latch: LatchOutput;
  scar: ScarOutput;
}

export function evaluateReleaseAuthority(input: SentinelInput): FinalOutput {
  const candidates = input.clockwork.candidates;
  const fatalInput = input.prism.invalid_input_vetoes;
  const eliminated = mergeEliminated(
    input.static.eliminated,
    input.trial.eliminated,
    candidates.filter((candidate) => candidate.survival_status === "dead"),
  );
  const veto_summary = collectVetoes(fatalInput, candidates, eliminated);
  const uncertainty_summary = produceUncertaintySummary(input, candidates);

  if (fatalInput.length > 0) {
    return artifact("REJECTED", null, [], eliminated, [], veto_summary, uncertainty_summary);
  }

  const certified = candidates
    .filter(
      (candidate) =>
        candidate.survival_status === "alive" && candidate.proof_status === "certified",
    )
    .sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));

  if (
    (candidates.length > 0 &&
      candidates.every((candidate) => candidate.survival_status === "dead")) ||
    (candidates.length === 0 && eliminated.length > 0)
  ) {
    return artifact("REJECTED", null, [], eliminated, [], veto_summary, uncertainty_summary);
  }

  if (
    certified.some((candidate) =>
      input.parallax.critical_ambiguity_candidate_ids.includes(candidate.candidate_id),
    )
  ) {
    return artifact(
      "ABSTAIN",
      null,
      candidates.filter((candidate) => candidate.survival_status !== "dead"),
      eliminated,
      [],
      veto_summary,
      uncertainty_summary,
    );
  }

  if (certified.length === 1) {
    const [winner] = certified;
    if (!winner) {
      throw new Error("unreachable certified candidate state");
    }
    return artifact(
      "APPROVED",
      {
        candidate_id: winner.candidate_id,
        material_signature: winner.material_signature,
        support_packet_ids: winner.support_packet_ids,
      },
      certified,
      eliminated,
      winner.support_packet_ids,
      veto_summary,
      uncertainty_summary,
    );
  }

  if (certified.length > 1 && sameMaterialAnswer(certified)) {
    return artifact(
      "APPROVED",
      {
        candidate_ids: certified.map((candidate) => candidate.candidate_id),
        material_signature: certified[0]?.material_signature,
        support_packet_ids: [
          ...new Set(certified.flatMap((candidate) => candidate.support_packet_ids)),
        ].sort(),
      },
      certified,
      eliminated,
      [...new Set(certified.flatMap((candidate) => candidate.support_packet_ids))].sort(),
      veto_summary,
      uncertainty_summary,
    );
  }

  return artifact(
    "ABSTAIN",
    null,
    candidates.filter((candidate) => candidate.survival_status !== "dead"),
    eliminated,
    [],
    veto_summary,
    uncertainty_summary,
  );
}

function produceUncertaintySummary(input: SentinelInput, candidates: Candidate[]): string[] {
  const reasons = new Set<string>();
  for (const flag of input.static.uncertainty_flags) {
    reasons.add(flag);
  }
  for (const flag of input.echo.laundering_flags) {
    reasons.add(flag);
  }
  for (const item of input.trial.missing_proof) {
    reasons.add(`missing_proof:${item.candidate_id}:${item.reason}`);
  }
  for (const flag of input.parallax.framing_flags) {
    reasons.add(flag);
  }
  for (const candidateId of input.parallax.critical_ambiguity_candidate_ids) {
    reasons.add(`critical_framing_ambiguity:${candidateId}`);
  }
  for (const fracture of input.rift.fracture_points) {
    reasons.add(`brittle_evidence:${fracture.candidate_id}:${fracture.removed_packet_id}`);
  }
  for (const action of input.latch.recovery_actions) {
    reasons.add(
      `recovery_action:${action.candidate_id}:${action.action_type}:${action.can_recover ? "recoverable" : "blocked"}`,
    );
  }
  for (const flag of input.scar.scar_flags) {
    reasons.add(flag);
  }
  for (const packetId of input.clockwork.stale_packet_ids) {
    reasons.add(`stale_evidence:${packetId}`);
  }
  for (const claimId of input.clockwork.stale_claim_ids) {
    reasons.add(`stale_claim:${claimId}`);
  }

  const living = candidates.filter((candidate) => candidate.survival_status !== "dead");
  const certified = living.filter(
    (candidate) => candidate.proof_status === "certified" && candidate.survival_status === "alive",
  );
  if (certified.length > 1 && !sameMaterialAnswer(certified)) {
    reasons.add(
      `ambiguous_survivors:${certified
        .map((candidate) => candidate.candidate_id)
        .sort()
        .join("|")}`,
    );
  }
  if (certified.length === 0 && living.length > 0) {
    reasons.add("no_certified_candidate");
  }

  return [...reasons].sort();
}

function artifact(
  status: FinalOutput["status"],
  certified_answer: unknown | null,
  surviving_candidates: Candidate[],
  eliminated_candidates: Candidate[],
  proof_packet_ids: string[],
  veto_summary: Veto[],
  uncertainty_summary: string[],
): FinalOutput {
  const withoutHash = {
    run_id: `run_${shortHash({ status, certified_answer, surviving_candidates, eliminated_candidates, proof_packet_ids, veto_summary, uncertainty_summary })}`,
    status,
    certified_answer,
    surviving_candidates,
    eliminated_candidates,
    proof_packet_ids: [...proof_packet_ids].sort(),
    veto_summary: veto_summary.sort((a, b) => a.veto_id.localeCompare(b.veto_id)),
    uncertainty_summary: [...uncertainty_summary].sort(),
  };
  return attachAuditHash(withoutHash);
}

function collectVetoes(
  inputVetoes: Veto[],
  candidates: Candidate[],
  eliminated: Candidate[],
): Veto[] {
  const byId = new Map<string, Veto>();
  for (const veto of inputVetoes) {
    byId.set(veto.veto_id, veto);
  }
  for (const candidate of [...candidates, ...eliminated]) {
    for (const veto of candidate.vetoes) {
      byId.set(veto.veto_id, veto);
    }
  }
  return [...byId.values()];
}

function mergeEliminated(...groups: Candidate[][]): Candidate[] {
  const byId = new Map<string, Candidate>();
  for (const group of groups) {
    for (const candidate of group) {
      byId.set(candidate.candidate_id, candidate);
    }
  }
  return [...byId.values()].sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
}

function sameMaterialAnswer(candidates: Candidate[]): boolean {
  const signatures = new Set(candidates.map((candidate) => candidate.material_signature));
  return signatures.size === 1;
}
