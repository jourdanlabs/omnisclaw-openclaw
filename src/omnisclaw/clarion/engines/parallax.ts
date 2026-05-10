import type { Candidate, ParallaxOutput } from "../types.js";

export function inspectFraming(candidates: Candidate[]): ParallaxOutput {
  const living = candidates.filter((candidate) => candidate.survival_status !== "dead");
  const byName = new Map<string, Candidate[]>();

  for (const candidate of living) {
    const key = nameFrame(candidate.material_signature);
    byName.set(key, [...(byName.get(key) ?? []), candidate]);
  }

  const name_frames = [...byName.entries()]
    .filter(
      ([, frameCandidates]) =>
        new Set(frameCandidates.map((candidate) => candidate.material_signature)).size > 1,
    )
    .map(([frame_key, frameCandidates]) => ({
      frame_key,
      candidate_ids: frameCandidates.map((candidate) => candidate.candidate_id).sort(),
      material_signatures: [
        ...new Set(frameCandidates.map((candidate) => candidate.material_signature)),
      ].sort(),
    }))
    .sort((a, b) => a.frame_key.localeCompare(b.frame_key));

  const critical = new Set<string>();
  const framing_flags: string[] = [];

  for (const frame of name_frames) {
    const frameCandidates = living.filter((candidate) =>
      frame.candidate_ids.includes(candidate.candidate_id),
    );
    const hasCertified = frameCandidates.some(
      (candidate) =>
        candidate.proof_status === "certified" && candidate.survival_status === "alive",
    );
    const hasShadow = frameCandidates.some(
      (candidate) =>
        candidate.proof_status !== "certified" || candidate.survival_status !== "alive",
    );
    framing_flags.push(`parallax_frame:${frame.frame_key}:${frame.material_signatures.join("|")}`);
    if (hasCertified && hasShadow) {
      for (const candidate of frameCandidates) {
        critical.add(candidate.candidate_id);
      }
    }
  }

  return {
    framing_flags,
    critical_ambiguity_candidate_ids: [...critical].sort(),
    name_frames,
  };
}

function nameFrame(materialSignature: string): string {
  return materialSignature.split("#")[0] ?? materialSignature;
}
