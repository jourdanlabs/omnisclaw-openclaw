import { shortHash } from "../audit/hash.js";
import type { Candidate, ClockworkOutput, EvidencePacketRecipe, LatchOutput } from "../types.js";

export function planRecovery(candidates: Candidate[], clockwork: ClockworkOutput): LatchOutput {
  const recovery_actions: LatchOutput["recovery_actions"] = [];

  for (const candidate of candidates) {
    if (candidate.survival_status === "dead") {
      recovery_actions.push(
        makeAction(
          candidate,
          "clarify_conflict",
          "Candidate has a hard veto; replace or correct contradictory source evidence.",
          [candidate],
          hardVetoIds(candidate),
          false,
          null,
        ),
      );
      continue;
    }

    for (const veto of candidate.vetoes) {
      if (
        veto.validator === "TRIAL.burden_of_proof" &&
        veto.reason.includes("independent support packets")
      ) {
        recovery_actions.push(
          makeAction(
            candidate,
            "add_independent_packet",
            "Add a fresh packet from a new effective lineage that asserts the same material signature.",
            candidates,
            [veto.veto_id],
            true,
            recipeFor(candidate, candidates, true),
          ),
        );
      } else if (
        veto.validator === "TRIAL.burden_of_proof" &&
        veto.reason.includes("duplicated lineage")
      ) {
        recovery_actions.push(
          makeAction(
            candidate,
            "add_independent_packet",
            "Replace laundered support with an independently originated corroborating packet.",
            candidates,
            [veto.veto_id],
            true,
            recipeFor(candidate, candidates, true),
          ),
        );
      } else if (veto.validator === "RIFT.fracture") {
        recovery_actions.push(
          makeAction(
            candidate,
            "replace_brittle_support",
            "Add support that survives removal of the current keystone packet.",
            candidates,
            [veto.veto_id],
            !veto.recoverable ? true : veto.recoverable,
            recipeFor(candidate, candidates, true),
          ),
        );
      } else if (veto.validator === "CLOCKWORK.decay") {
        recovery_actions.push(
          makeAction(
            candidate,
            "refresh_stale_packet",
            "Refresh stale packets with time-valid evidence at the current decision time.",
            candidates,
            [veto.veto_id],
            true,
            recipeFor(candidate, candidates, false),
          ),
        );
      } else if (veto.severity === "soft") {
        recovery_actions.push(
          makeAction(
            candidate,
            "clarify_conflict",
            `Resolve soft veto from ${veto.validator}: ${veto.reason}`,
            candidates,
            [veto.veto_id],
            veto.recoverable,
            recipeFor(candidate, candidates, false),
          ),
        );
      }
    }
  }

  for (const packetId of clockwork.stale_packet_ids) {
    const affected = candidates.filter((candidate) =>
      candidate.support_packet_ids.includes(packetId),
    );
    for (const candidate of affected) {
      if (
        !recovery_actions.some(
          (action) =>
            action.candidate_id === candidate.candidate_id &&
            action.action_type === "refresh_stale_packet",
        )
      ) {
        recovery_actions.push(
          makeAction(
            candidate,
            "refresh_stale_packet",
            `Refresh stale packet ${packetId} or replace it with current evidence.`,
            candidates,
            [`stale:${packetId}`],
            true,
            recipeFor(candidate, candidates, false),
          ),
        );
      }
    }
  }

  const certifiable_candidate_ids = candidates
    .filter((candidate) => candidate.survival_status !== "dead")
    .filter((candidate) =>
      recovery_actions.some(
        (action) => action.candidate_id === candidate.candidate_id && action.can_recover,
      ),
    )
    .map((candidate) => candidate.candidate_id)
    .sort();

  const unrecoverable_candidate_ids = candidates
    .filter(
      (candidate) => candidate.survival_status === "dead" || hardVetoIds(candidate).length > 0,
    )
    .map((candidate) => candidate.candidate_id)
    .sort();

  return {
    recovery_actions: dedupeActions(recovery_actions),
    certifiable_candidate_ids,
    unrecoverable_candidate_ids,
  };
}

function makeAction(
  candidate: Candidate,
  action_type: LatchOutput["recovery_actions"][number]["action_type"],
  description: string,
  allCandidates: Candidate[],
  blocked_by: string[],
  can_recover: boolean,
  packet_recipe: EvidencePacketRecipe | null,
): LatchOutput["recovery_actions"][number] {
  return {
    action_id: `latch_${shortHash({ candidate_id: candidate.candidate_id, action_type, description, blocked_by, all_candidate_ids: allCandidates.map((item) => item.candidate_id).sort(), packet_recipe })}`,
    candidate_id: candidate.candidate_id,
    action_type,
    description,
    blocked_by: [...blocked_by].sort(),
    can_recover,
    packet_recipe,
  };
}

function recipeFor(
  candidate: Candidate,
  candidates: Candidate[],
  requireNewLineage: boolean,
): EvidencePacketRecipe {
  const [subject, identifier] = candidate.material_signature.split("#");
  const required_claims = [
    {
      subject_ref: subject ?? candidate.material_signature,
      predicate: "name",
      object_ref: subject ?? candidate.material_signature,
    },
  ];
  if (identifier) {
    required_claims.push({
      subject_ref: subject ?? candidate.material_signature,
      predicate: "identifier",
      object_ref: identifier,
    });
  }

  return {
    recipe_id: `recipe_${shortHash({ candidate_id: candidate.candidate_id, material_signature: candidate.material_signature, requireNewLineage })}`,
    source_type_options: ["database", "api", "document"],
    trust_tier_minimum: "high",
    must_not_share_lineage_with: requireNewLineage ? candidate.support_packet_ids : [],
    required_claims,
    freshness_required: true,
    notes: [
      requireNewLineage
        ? "Evidence must originate independently from existing support packets."
        : "Evidence must be current at the configured decision time.",
      "Packet should preserve observed source text and produce deterministic provenance hash.",
    ],
  };
}

function hardVetoIds(candidate: Candidate): string[] {
  return candidate.vetoes
    .filter((veto) => veto.severity === "hard")
    .map((veto) => veto.veto_id)
    .sort();
}

function dedupeActions(actions: LatchOutput["recovery_actions"]): LatchOutput["recovery_actions"] {
  return [...new Map(actions.map((action) => [action.action_id, action])).values()].sort((a, b) =>
    a.action_id.localeCompare(b.action_id),
  );
}
