import { checkFreshness } from "./engines/clockwork.js";
import { detectEvidenceEchoes } from "./engines/echo.js";
import { reconstructDependencyLayers } from "./engines/fossil.js";
import { generateCandidateField } from "./engines/gravity.js";
import { buildInquest } from "./engines/inquest.js";
import { planRecovery } from "./engines/latch.js";
import { inspectFraming } from "./engines/parallax.js";
import { packetizeInput } from "./engines/prism.js";
import { fractureTest } from "./engines/rift.js";
import { recordScars } from "./engines/scar.js";
import { evaluateReleaseAuthority } from "./engines/sentinel.js";
import { applyVetoes } from "./engines/static.js";
import { crossExamine } from "./engines/trial.js";
import type { MirrorverseConfig, MirrorverseInput, MirrorverseTrace } from "./types.js";

export const DEFAULT_CONFIG: MirrorverseConfig = {
  decision_time: "2026-05-05",
  stale_half_life_days: 365,
  predicate_half_life_days: {},
  min_independent_packets: 2,
  ambiguity_limit: 0,
  numeric_tolerance: 0,
  source_priority_order: ["official", "high", "medium", "low"],
};

export function runMirrorverse(input: MirrorverseInput): MirrorverseTrace {
  const config = resolveConfig(input.config);
  const prism = packetizeInput(input, config);
  const candidates = generateCandidateField(prism.packets);
  const fossil = reconstructDependencyLayers(candidates, prism.packets);
  const echo = detectEvidenceEchoes(prism.packets);
  const staticFindings = applyVetoes(candidates, prism.packets, fossil, config);
  const trial = crossExamine(staticFindings.survivors, prism.packets, echo, fossil, config);
  const parallax = inspectFraming(trial.survivors);
  const rift = fractureTest(trial.survivors, prism.packets, config);
  const clockwork = checkFreshness(rift.survivors, prism.packets, config);
  const latch = planRecovery(clockwork.candidates, clockwork);
  const scar = recordScars([...staticFindings.eliminated, ...clockwork.candidates]);
  const final = evaluateReleaseAuthority({
    config,
    prism,
    echo,
    static: staticFindings,
    trial,
    parallax,
    rift,
    clockwork,
    latch,
    scar,
  });
  const traceWithoutInquest = {
    config,
    prism,
    candidates,
    fossil,
    echo,
    static: staticFindings,
    trial,
    parallax,
    rift,
    clockwork,
    latch,
    scar,
    final,
  };
  const inquest = buildInquest(traceWithoutInquest);

  return {
    ...traceWithoutInquest,
    inquest,
  };
}

export function runFinal(input: MirrorverseInput) {
  return runMirrorverse(input).final;
}

function resolveConfig(config: MirrorverseInput["config"]): MirrorverseConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}
