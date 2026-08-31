export type SourceType = "document" | "database" | "api" | "user_input" | "derived";
export type TrustTier = "low" | "medium" | "high" | "official";
export type Modality = "asserted" | "implied" | "derived" | "inferred";
export type ConstraintType =
  | "identity"
  | "temporal"
  | "spatial"
  | "numeric"
  | "schema"
  | "causal"
  | "source_priority";
export type ConstraintSeverity = "low" | "medium" | "high" | "fatal";
export type CandidateType =
  | "entity"
  | "relationship"
  | "decision"
  | "classification"
  | "extraction";
export type SurvivalStatus = "alive" | "wounded" | "dead";
export type ProofStatus = "unproven" | "partially_proven" | "certified";
export type FinalStatus = "APPROVED" | "ABSTAIN" | "REJECTED";
export type BenchmarkExpectation =
  | "mirrorverse_should_approve"
  | "mirrorverse_should_block"
  | "mirrorverse_should_reject";

export interface RawRecord {
  source_id: string;
  source_type: SourceType;
  text: string;
  timestamp: string;
  trust_tier: TrustTier;
  origin_id?: string;
}

export interface MirrorverseConfig {
  decision_time: string;
  stale_half_life_days: number;
  predicate_half_life_days: Record<string, number>;
  min_independent_packets: number;
  ambiguity_limit: number;
  numeric_tolerance: number;
  source_priority_order: TrustTier[];
}

export interface MirrorverseInput {
  records: RawRecord[];
  requested_assertion?: string;
  config?: Partial<MirrorverseConfig>;
}

export interface TrustProfile {
  tier: TrustTier;
  weight: number;
  independence_key: string;
  lineage_key: string;
}

export interface TimeMarker {
  kind: "observed" | "valid_until" | "expires" | "mentioned";
  value: string;
  valid: boolean;
}

export interface Claim {
  claim_id: string;
  subject_ref: string;
  predicate: string;
  object_ref: string;
  modality: Modality;
  support_packet_ids: string[];
  contradiction_packet_ids: string[];
  confidence_floor: number;
  confidence_ceiling: number;
}

export interface Constraint {
  constraint_id: string;
  type: ConstraintType;
  rule: string;
  hard_veto: boolean;
  severity: ConstraintSeverity;
}

export interface EvidencePacket {
  packet_id: string;
  source_id: string;
  source_type: SourceType;
  observed_text: string;
  normalized_terms: string[];
  extracted_claims: Claim[];
  constraints: Constraint[];
  timestamps: TimeMarker[];
  provenance_hash: string;
  trust_profile: TrustProfile;
}

export interface Veto {
  veto_id: string;
  validator: string;
  reason: string;
  severity: "soft" | "hard";
  packet_ids: string[];
  recoverable: boolean;
}

export interface Candidate {
  candidate_id: string;
  candidate_type: CandidateType;
  support_packet_ids: string[];
  active_constraints: string[];
  vetoes: Veto[];
  survival_status: SurvivalStatus;
  proof_status: ProofStatus;
  attraction_reasons: string[];
  material_signature: string;
}

export interface PrismOutput {
  packets: EvidencePacket[];
  claims: Claim[];
  constraints: Constraint[];
  invalid_input_vetoes: Veto[];
}

export interface FossilOutput {
  dependency_layers: Array<{
    layer_id: string;
    packet_ids: string[];
    claim_ids: string[];
    timestamp: string;
  }>;
  ancestry_chains: Array<{
    claim_id: string;
    ancestor_claim_ids: string[];
  }>;
  continuity_gaps: string[];
  orphan_claim_ids: string[];
}

export interface EchoOutput {
  packets: EvidencePacket[];
  duplicate_clusters: Array<{
    cluster_id: string;
    packet_ids: string[];
    lineage_key: string;
    reason: string;
  }>;
  effective_independence_key_by_packet_id: Record<string, string>;
  laundering_flags: string[];
}

export interface ScarPattern {
  pattern_id: string;
  validator: string;
  severity: "soft" | "hard";
  reason_signature: string;
  candidate_ids: string[];
  packet_ids: string[];
  occurrence_count: number;
}

export interface StaticOutput {
  candidates: Candidate[];
  survivors: Candidate[];
  eliminated: Candidate[];
  vetoes: Veto[];
  uncertainty_flags: string[];
}

export interface TrialOutput {
  candidates: Candidate[];
  survivors: Candidate[];
  eliminated: Candidate[];
  missing_proof: Array<{ candidate_id: string; reason: string }>;
  exceptions: Array<{ candidate_id: string; reason: string }>;
}

export interface ParallaxOutput {
  framing_flags: string[];
  critical_ambiguity_candidate_ids: string[];
  name_frames: Array<{
    frame_key: string;
    candidate_ids: string[];
    material_signatures: string[];
  }>;
}

export interface LatchOutput {
  recovery_actions: Array<{
    action_id: string;
    candidate_id: string;
    action_type:
      | "add_independent_packet"
      | "refresh_stale_packet"
      | "resolve_ambiguity"
      | "replace_brittle_support"
      | "clarify_conflict";
    description: string;
    blocked_by: string[];
    can_recover: boolean;
    packet_recipe: EvidencePacketRecipe | null;
  }>;
  certifiable_candidate_ids: string[];
  unrecoverable_candidate_ids: string[];
}

export interface EvidencePacketRecipe {
  recipe_id: string;
  source_type_options: SourceType[];
  trust_tier_minimum: TrustTier;
  must_not_share_lineage_with: string[];
  required_claims: Array<{
    subject_ref: string;
    predicate: string;
    object_ref: string;
  }>;
  freshness_required: boolean;
  notes: string[];
}

export interface RiftOutput {
  candidates: Candidate[];
  survivors: Candidate[];
  brittle_candidate_ids: string[];
  fracture_points: Array<{ candidate_id: string; removed_packet_id: string; reason: string }>;
}

export interface ScarOutput {
  patterns: ScarPattern[];
  scar_flags: string[];
}

export interface ClockworkOutput {
  candidates: Candidate[];
  survivors: Candidate[];
  stale_packet_ids: string[];
  stale_claim_ids: string[];
  expired_claim_ids: string[];
  time_valid_claim_ids: string[];
}

export interface InquestOutput {
  candidate_dossiers: Array<{
    candidate_id: string;
    material_signature: string;
    survival_status: SurvivalStatus;
    proof_status: ProofStatus;
    support_packet_ids: string[];
    proof_claim_ids: string[];
    wounds: Array<{
      validator: string;
      reason: string;
      severity: "soft" | "hard";
      recoverable: boolean;
    }>;
    recovery_action_ids: string[];
    scar_pattern_ids: string[];
    death_certificate: string | null;
  }>;
  release_blockers: Array<{
    blocker_id: string;
    code:
      | "ambiguous_survivors"
      | "brittle_evidence"
      | "critical_framing_ambiguity"
      | "duplicate_source_laundering"
      | "missing_proof"
      | "no_certified_candidate"
      | "recovery_action"
      | "scar_pattern"
      | "stale_evidence"
      | "stale_claim"
      | "other";
    severity: "info" | "warning" | "fatal";
    detail: string;
  }>;
  proof_ledger: Array<{
    packet_id: string;
    claim_ids: string[];
    provenance_hash: string;
    effective_independence_key: string;
  }>;
  audit_hash: string;
}

export interface FinalOutput {
  run_id: string;
  status: FinalStatus;
  certified_answer: unknown | null;
  surviving_candidates: Candidate[];
  eliminated_candidates: Candidate[];
  proof_packet_ids: string[];
  veto_summary: Veto[];
  uncertainty_summary: string[];
  audit_hash: string;
}

export interface MirrorverseTrace {
  config: MirrorverseConfig;
  prism: PrismOutput;
  candidates: Candidate[];
  fossil: FossilOutput;
  echo: EchoOutput;
  static: StaticOutput;
  trial: TrialOutput;
  parallax: ParallaxOutput;
  rift: RiftOutput;
  clockwork: ClockworkOutput;
  latch: LatchOutput;
  scar: ScarOutput;
  final: FinalOutput;
  inquest: InquestOutput;
}

export interface BaselineOutput {
  status: "APPROVED" | "ABSTAIN";
  selected_signature: string | null;
  support_packet_ids: string[];
  reasons: string[];
  overlap_score: number;
  audit_hash: string;
}

export interface BenchmarkCase {
  case_id: string;
  fixture: string;
  expectation: BenchmarkExpectation;
  description: string;
}

export interface BenchmarkResult {
  case_id: string;
  fixture: string;
  expectation: BenchmarkExpectation;
  mirrorverse_status: FinalStatus;
  baseline_status: BaselineOutput["status"];
  baseline_selected_signature: string | null;
  outcome: "mirrorverse_win" | "baseline_win" | "tie" | "needs_review";
  lesson: string;
  mirrorverse_audit_hash: string;
  baseline_audit_hash: string;
}

export interface BenchmarkReport {
  run_id: string;
  cases: BenchmarkResult[];
  summary: {
    total: number;
    mirrorverse_wins: number;
    baseline_wins: number;
    ties: number;
    needs_review: number;
  };
  audit_hash: string;
}

export type VantageMode = "report" | "fix" | "wrecking_crew";
export type VantageFindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface VantageFinding {
  finding_id: string;
  severity: VantageFindingSeverity;
  category:
    | "correctness"
    | "maintainability"
    | "test_risk"
    | "package_health"
    | "security"
    | "documentation"
    | "wiring";
  title: string;
  detail: string;
  file_path: string | null;
  evidence: string[];
  suggested_action: string;
  fixable: boolean;
}

export interface VantageGoalCheck {
  check_id: string;
  goal: string;
  status: "passed" | "warning" | "failed" | "not_applicable";
  flow: string;
  required_signals: string[];
  observed_signals: string[];
  missing_signals: string[];
  evidence: string[];
  finding_ids: string[];
}

export interface VantageFixPlan {
  plan_id: string;
  finding_id: string;
  mode: Extract<VantageMode, "fix" | "wrecking_crew">;
  action_type: "package_json_patch" | "command_required" | "manual_review" | "challenge";
  target_file: string | null;
  deterministic: boolean;
  risk: "low" | "medium" | "high";
  summary: string;
  patch_preview: string[];
}

export interface VantageProject {
  project_id: string;
  root_path: string;
  project_type: "node" | "python" | "rust" | "go" | "unknown";
  name: string;
  stage: "seed" | "prototype" | "working" | "hardened";
  quality: "clean" | "promising" | "rough" | "risky";
  file_count: number;
  language_counts: Record<string, number>;
  signals: string[];
  goal_checks: VantageGoalCheck[];
  findings: VantageFinding[];
  fix_plans: VantageFixPlan[];
}

export interface VantageReport {
  run_id: string;
  mode: VantageMode;
  scanned_root: string;
  projects: VantageProject[];
  duplicate_project_groups: Array<{
    group_id: string;
    project_ids: string[];
    reason: string;
  }>;
  summary: {
    project_count: number;
    finding_count: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    fixable_count: number;
    fix_plan_count: number;
    goal_check_count: number;
    failed_goal_check_count: number;
  };
  audit_hash: string;
}

export interface VantageBenchmarkCase {
  case_id: string;
  project_name: string;
  description: string;
  expected_findings: Array<{
    title: string;
    severity?: VantageFindingSeverity;
  }>;
  forbidden_findings: string[];
}

export interface VantageBenchmarkResult {
  case_id: string;
  project_name: string;
  expected_count: number;
  found_expected_count: number;
  missing_expected_titles: string[];
  forbidden_hit_titles: string[];
  severity_mismatches: Array<{
    title: string;
    expected: VantageFindingSeverity;
    actual: VantageFindingSeverity;
  }>;
  unexpected_high_or_critical_titles: string[];
  duplicate_group_detected: boolean;
  score: number;
  outcome: "murked" | "passed" | "needs_work";
}

export interface VantageBenchmarkReport {
  run_id: string;
  fixtures_root: string;
  results: VantageBenchmarkResult[];
  summary: {
    total_cases: number;
    murked_count: number;
    passed_count: number;
    needs_work_count: number;
    expected_findings: number;
    found_expected_findings: number;
    recall_percent: number;
    forbidden_hits: number;
    severity_mismatches: number;
    unexpected_high_or_critical: number;
    duplicate_groups_detected: number;
    average_score: number;
  };
  vantage_audit_hash: string;
  audit_hash: string;
}

export interface VantageApplyReport {
  run_id: string;
  target_root: string;
  dry_run: boolean;
  applied_plans: Array<{
    plan_id: string;
    target_file: string;
    changes: string[];
  }>;
  skipped_plans: Array<{
    plan_id: string;
    reason: string;
  }>;
  changed_files: Array<{
    file_path: string;
    before_hash: string;
    after_hash: string;
  }>;
  summary: {
    applied_count: number;
    skipped_count: number;
    changed_file_count: number;
  };
  audit_hash: string;
}

export type ProspectorRecommendation =
  | "ship_candidate"
  | "keep_building"
  | "merge_variants"
  | "revive"
  | "archive_candidate"
  | "needs_inquest";

export interface ProspectorProject {
  project_id: string;
  vantage_project_id: string;
  root_path: string;
  family_key: string;
  name: string;
  project_type: VantageProject["project_type"];
  stage: VantageProject["stage"];
  quality: VantageProject["quality"];
  completion_score: number;
  risk_score: number;
  recommendation: ProspectorRecommendation;
  evidence: string[];
  blockers: string[];
}

export interface ProspectorFamily {
  family_id: string;
  family_key: string;
  project_ids: string[];
  strongest_project_id: string;
  duplicate_variant_count: number;
  recommendation: "single_project" | "compare_variants" | "merge_or_archive";
  reason: string;
}

export interface ProspectorReport {
  run_id: string;
  scanned_root: string;
  projects: ProspectorProject[];
  families: ProspectorFamily[];
  summary: {
    project_count: number;
    family_count: number;
    duplicate_family_count: number;
    ship_candidate_count: number;
    keep_building_count: number;
    merge_variants_count: number;
    revive_count: number;
    archive_candidate_count: number;
    needs_inquest_count: number;
    average_completion_score: number;
    average_risk_score: number;
  };
  audit_hash: string;
}

export type ProspectorCleanupActionType =
  | "keep_canonical"
  | "compare_variant"
  | "archive_variant"
  | "prepare_ship"
  | "continue_build"
  | "revive_project"
  | "archive_project"
  | "inquest_required";

export interface ProspectorCleanupAction {
  action_id: string;
  action_type: ProspectorCleanupActionType;
  project_id: string;
  root_path: string;
  family_id: string | null;
  priority: "low" | "medium" | "high";
  reason: string;
  proposed_destination: string | null;
  blockers: string[];
  evidence: string[];
}

export interface ProspectorCleanupPlan {
  plan_id: string;
  scanned_root: string;
  canonical_project_ids: string[];
  actions: ProspectorCleanupAction[];
  summary: {
    action_count: number;
    keep_canonical_count: number;
    compare_variant_count: number;
    archive_variant_count: number;
    inquest_required_count: number;
    archive_project_count: number;
    prepare_ship_count: number;
  };
  source_report_hash: string;
  markdown: string;
  audit_hash: string;
}

export interface ProspectorVariantComparison {
  comparison_id: string;
  left_root: string;
  right_root: string;
  left_report_hash: string;
  right_report_hash: string;
  file_summary: {
    shared_file_count: number;
    changed_file_count: number;
    left_only_count: number;
    right_only_count: number;
  };
  left_only_files: string[];
  right_only_files: string[];
  changed_files: string[];
  recommendation: "left_canonical" | "right_canonical" | "manual_merge";
  preservation_manifest: {
    canonical_side: "left" | "right" | null;
    archive_candidate_side: "left" | "right" | null;
    must_preserve: Array<{
      file_path: string;
      source_side: "left" | "right" | "both";
      reason: "left_only" | "right_only" | "changed";
      action: "copy_before_archive" | "manual_merge" | "keep_with_canonical";
      priority: "medium" | "high";
    }>;
    manual_merge_files: string[];
    archive_blockers: string[];
    manifest_limit: number;
  };
  rationale: string[];
  markdown: string;
  audit_hash: string;
}

export type ProspectorMergeArchivePhase =
  | "inspect"
  | "preserve"
  | "merge"
  | "archive"
  | "verify"
  | "release";

export interface ProspectorMergeArchiveStep {
  step_id: string;
  phase: ProspectorMergeArchivePhase;
  action_type:
    | "review_changed_file"
    | "copy_unique_file_to_stage"
    | "keep_canonical_file"
    | "create_archive_snapshot"
    | "run_verification"
    | "record_memory";
  source_side: "left" | "right" | "both" | null;
  source_path: string | null;
  destination_path: string | null;
  command: string | null;
  required: boolean;
  reason: string;
}

export interface ProspectorMergeArchivePlan {
  plan_id: string;
  left_root: string;
  right_root: string;
  canonical_side: "left" | "right" | null;
  archive_side: "left" | "right" | null;
  status: "blocked" | "ready_for_manual_merge" | "ready_for_archive_after_verification";
  comparison_hash: string;
  staging_root: string;
  steps: ProspectorMergeArchiveStep[];
  blockers: string[];
  release_conditions: string[];
  summary: {
    step_count: number;
    changed_review_count: number;
    unique_preserve_count: number;
    verification_count: number;
    blocker_count: number;
  };
  markdown: string;
  audit_hash: string;
}

export type MigrationDisposition =
  | "port_now"
  | "modernize_first"
  | "merge_or_archive"
  | "quarantine"
  | "leave_behind";

export interface MigrationPortfolioItem {
  item_id: string;
  root_path: string;
  name: string;
  family_key: string;
  project_type: VantageProject["project_type"];
  stage: VantageProject["stage"];
  quality: VantageProject["quality"];
  completion_score: number;
  risk_score: number;
  modernization_score: number;
  duplicate_variant_count: number;
  migration_wave: "wave_0_foundation" | "wave_1_low_risk" | "wave_2_refactor" | "wave_3_quarantine";
  disposition: MigrationDisposition;
  top_findings: string[];
  blockers: string[];
  evidence: string[];
}

export interface MigrationEstateItem {
  estate_id: string;
  estate_name: string;
  estate_root: string;
  item_ids: string[];
  item_count: number;
  recommended_action: "port_whole" | "cherry_pick" | "inspect_variants" | "do_not_bulk_port";
  migration_wave: MigrationPortfolioItem["migration_wave"];
  readiness_score: number;
  risk_score: number;
  duplicate_family_count: number;
  port_now_count: number;
  modernize_first_count: number;
  merge_or_archive_count: number;
  quarantine_count: number;
  leave_behind_count: number;
  strongest_item_id: string | null;
  rationale: string[];
}

export interface MigrationPackingItem {
  estate_id: string;
  estate_name: string;
  source_path: string;
  target_hint: string;
  recommended_action: MigrationEstateItem["recommended_action"];
  readiness_score: number;
  risk_score: number;
  reason: string;
  copy_command: string | null;
}

export interface MigrationPackingManifest {
  bring_now: MigrationPackingItem[];
  cherry_pick: MigrationPackingItem[];
  review_first: MigrationPackingItem[];
  leave_off_new_machine: MigrationPackingItem[];
  default_excludes: string[];
  summary: {
    bring_now_count: number;
    cherry_pick_count: number;
    review_first_count: number;
    leave_off_new_machine_count: number;
  };
}

export interface MigrationIntelligenceReport {
  run_id: string;
  scanned_root: string;
  migration_manifest: MigrationPackingManifest;
  estate_portfolio: MigrationEstateItem[];
  portfolio: MigrationPortfolioItem[];
  duplicate_families: Array<{
    family_key: string;
    item_ids: string[];
    strongest_item_id: string;
    recommendation: "single_project" | "compare_variants" | "merge_or_archive";
    reason: string;
  }>;
  migration_waves: Array<{
    wave: MigrationPortfolioItem["migration_wave"];
    item_ids: string[];
    objective: string;
    release_gate: string;
  }>;
  discovery_gaps: string[];
  summary: {
    estate_count: number;
    item_count: number;
    duplicate_family_count: number;
    port_now_count: number;
    modernize_first_count: number;
    merge_or_archive_count: number;
    quarantine_count: number;
    leave_behind_count: number;
    average_modernization_score: number;
    high_risk_count: number;
  };
  source_hashes: {
    prospector_hashes: string[];
    vantage_hashes: string[];
  };
  markdown: string;
  audit_hash: string;
}

export type OathSourceType = "draft" | "authority" | "evidence" | "rule" | "docket" | "contract";
export type OathAuthorityTier = "binding" | "persuasive" | "secondary" | "unknown";
export type OathAuthorityStatus = "good_law" | "questioned" | "overruled" | "stale" | "unknown";
export type OathIssueSeverity = "info" | "low" | "medium" | "high" | "fatal";

export interface OathRecord {
  source_id: string;
  source_type: OathSourceType;
  text: string;
  date?: string;
  citation?: string;
  authority_tier?: OathAuthorityTier;
  authority_status?: OathAuthorityStatus;
}

export interface OathDeadline {
  deadline_id: string;
  trigger_date: string;
  due_days: number;
  filed_date?: string;
  rule_source_id?: string;
}

export interface OathInput {
  matter_id: string;
  jurisdiction?: string;
  decision_date: string;
  records: OathRecord[];
  deadlines?: OathDeadline[];
}

export interface OathClaim {
  claim_id: string;
  source_id: string;
  text: string;
  citations: string[];
  quoted_text: string[];
  legal_signal: boolean;
  support_source_ids: string[];
  issue_ids: string[];
}

export interface OathIssue {
  issue_id: string;
  severity: OathIssueSeverity;
  issue_type:
    | "missing_citation"
    | "citation_not_found"
    | "authority_overruled"
    | "authority_questioned"
    | "quote_not_supported"
    | "deadline_missed"
    | "deadline_invalid"
    | "draft_contradiction"
    | "stale_authority";
  source_ids: string[];
  claim_ids: string[];
  reason: string;
  recoverable: boolean;
}

export interface OathReport {
  run_id: string;
  matter_id: string;
  jurisdiction: string | null;
  status: FinalStatus;
  claims: OathClaim[];
  issues: OathIssue[];
  proof_source_ids: string[];
  release_conditions: string[];
  summary: {
    claim_count: number;
    issue_count: number;
    fatal_count: number;
    high_count: number;
    missing_citation_count: number;
    unsupported_quote_count: number;
    deadline_issue_count: number;
  };
  markdown: string;
  audit_hash: string;
}

export interface EnterpriseTrustCase {
  case_id: string;
  fixture: string;
  workflow: "finance" | "code" | "audit" | "migration" | "knowledge";
  risk: "low" | "medium" | "high" | "critical";
  expected_gate: "APPROVED" | "ABSTAIN" | "REJECTED";
  failure_mode:
    | "none"
    | "contradiction"
    | "ambiguity"
    | "stale_evidence"
    | "brittle_evidence"
    | "laundered_evidence"
    | "priority_conflict";
  description: string;
}

export interface EnterpriseTrustResult {
  case_id: string;
  fixture: string;
  workflow: EnterpriseTrustCase["workflow"];
  risk: EnterpriseTrustCase["risk"];
  expected_gate: EnterpriseTrustCase["expected_gate"];
  clarion_status: FinalOutput["status"];
  fluent_baseline_status: "APPROVED";
  outcome: "clarion_win" | "baseline_tie" | "clarion_needs_work";
  lesson: string;
  proof_packet_count: number;
  veto_count: number;
  uncertainty_count: number;
  clarion_audit_hash: string;
}

export interface EnterpriseTrustBenchmarkReport {
  run_id: string;
  fixtures_root: string;
  results: EnterpriseTrustResult[];
  summary: {
    total_cases: number;
    clarion_wins: number;
    baseline_ties: number;
    clarion_needs_work: number;
    blocked_risky_cases: number;
    approved_clean_cases: number;
  };
  audit_hash: string;
}

export type OmnisActorType = "user" | "agent" | "tool" | "system";
export type OmnisRiskLevel = "low" | "medium" | "high" | "critical";
export type OmnisToolName =
  | "vantage"
  | "vantage_apply"
  | "prospector"
  | "prospector_cleanup"
  | "prospector_compare"
  | "prospector_merge_archive"
  | "migration_intelligence"
  | "oath"
  | "clarion"
  | "cadmus"
  | "dad_jokes"
  | "codex_worker";
export type OmnisActionStatus = "REQUESTED" | "EXECUTED" | "REFUSED" | "FAILED";
export type OmnisDirectiveStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "blocked"
  | "paused"
  | "cancelled";
export type AgentTaskStatus =
  | "queued"
  | "in_progress"
  | "waiting_validation"
  | "blocked"
  | "completed";
export type AgentTaskKind =
  | "lead_plan"
  | "spec"
  | "audit"
  | "validation"
  | "stress_test"
  | "risk_challenge"
  | "memory_record"
  | "release_gate";
export type ChamberEventKind =
  | "directive_planned"
  | "task_delegated"
  | "agent_claim"
  | "agent_challenge"
  | "validation"
  | "risk_flag"
  | "verdict";
export type GateDecisionStatus = "APPROVED" | "ABSTAIN" | "REJECTED";
export type OmnisModelProviderId = "openai" | "minimax" | "kimi" | "anthropic" | "local" | "manual";
export type OmnisModelProviderType = "cloud" | "local" | "manual";
export type OmnisModelCapability =
  | "chat"
  | "code_generation"
  | "tool_planning"
  | "review"
  | "summarization"
  | "vision"
  | "long_context";
export type OmnisModelPolicyMode = "agent_allowed" | "deterministic_organ_forbidden" | "human_only";
export type OmnisModelInvocationPreflightStatus = "READY" | "BLOCKED";
export type OmnisModelTaskClass =
  | "memory"
  | "spec"
  | "code_build"
  | "code_review"
  | "risk_review"
  | "long_context"
  | "chat"
  | "legal"
  | "migration";
export type OmnisModelPrivacyLevel = "local_preferred" | "cloud_allowed" | "cloud_required";
export type LunaEventType =
  | "SESSION_INITIALIZED"
  | "ACTION_REQUESTED"
  | "ACTION_EXECUTED"
  | "ACTION_REFUSED"
  | "ACTION_FAILED"
  | "MEMORY_QUERY"
  | "LOG_VERIFIED"
  | "AGENT_THREAD_STARTED"
  | "AGENT_MESSAGE_RECORDED"
  | "CHAMBER_DIRECTIVE_PLANNED"
  | "AGENT_TASK_CREATED"
  | "AGENT_TASK_UPDATED"
  | "DIRECTIVE_CREATED"
  | "DIRECTIVE_UPDATED"
  | "WORKSPACE_REGISTERED"
  | "PAIRING_TOKEN_CREATED"
  | "PAIRING_TOKEN_REVOKED"
  | "QUEUE_ITEM_CREATED"
  | "QUEUE_ITEM_APPROVED"
  | "QUEUE_ITEM_REFUSED";

export interface OmnisSession {
  session_id: string;
  workspace_root: string;
  created_at: string;
  actor: OmnisActor;
}

export interface OmnisActor {
  actor_id: string;
  actor_type: OmnisActorType;
  display_name: string;
}

export interface OmnisTool {
  name: OmnisToolName;
  version: string;
  capabilities: string[];
  risk_level: OmnisRiskLevel;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  dry_run_supported: boolean;
  mutates_workspace: boolean;
}

export interface OmnisActionRequest {
  request_id: string;
  session_id: string;
  actor: OmnisActor;
  tool_name: OmnisToolName;
  args: string[];
  input: unknown;
  workspace_root: string;
  requested_at: string;
  dry_run: boolean;
}

export interface OmnisActionResult {
  request_id: string;
  tool_name: OmnisToolName;
  status: OmnisActionStatus;
  output: unknown;
  gate_decision: GateDecision;
  vellum_envelope: VellumEnvelope;
  luna_event: LunaEvent;
  audit_hash: string;
}

export interface BuildDirectiveRequest {
  objective: string;
  workspace_root?: string;
  lead_agent_id?: string;
  agent_ids?: string[];
  requested_tools?: OmnisToolName[];
  mode?: "plan" | "audit" | "build" | "fix" | "research";
  mutates_workspace?: boolean;
  approval_required?: boolean;
  notes?: string[];
}

export interface BuildDirective {
  directive_id: string;
  objective: string;
  workspace_root: string;
  created_at: string;
  updated_at: string;
  status: OmnisDirectiveStatus;
  lead_agent_id: string;
  agent_ids: string[];
  requested_tools: OmnisToolName[];
  mode: "plan" | "audit" | "build" | "fix" | "research";
  risk_level: OmnisRiskLevel;
  mutates_workspace: boolean;
  approval_required: boolean;
  approval_queue_ids: string[];
  envelope_ids: string[];
  event_ids: string[];
  notes: string[];
  audit_hash: string;
}

export interface OmnisDirectiveUpdate {
  directive_id: string;
  status: OmnisDirectiveStatus;
  reason: string;
  directive: BuildDirective | null;
  luna_event: LunaEvent;
  audit_hash: string;
}

export interface AgentTask {
  task_id: string;
  directive_id: string;
  thread_id: string;
  assigned_agent_id: string;
  task_kind: AgentTaskKind;
  title: string;
  detail: string;
  status: AgentTaskStatus;
  depends_on_task_ids: string[];
  required_tool_names: OmnisToolName[];
  envelope_ids: string[];
  audit_hash: string;
}

export interface ChamberEvent {
  chamber_event_id: string;
  directive_id: string;
  thread_id: string;
  event_kind: ChamberEventKind;
  agent_id: string;
  summary: string;
  task_id: string | null;
  envelope_id: string;
  audit_hash: string;
}

export interface ChamberDirectivePlan {
  plan_id: string;
  directive: BuildDirective;
  thread: AgentThread;
  tasks: AgentTask[];
  chamber_events: ChamberEvent[];
  handoff_mode: "contract_only" | "codex_subagent_ready";
  release_conditions: string[];
  audit_hash: string;
}

export interface VerificationCommandResult {
  command_id: string;
  command: string;
  cwd: string;
  exit_code: number;
  stdout_tail: string[];
  stderr_tail: string[];
  output_hash: string;
  envelope_id: string;
  audit_hash: string;
}

export interface GovernedBuildLoopReport {
  loop_id: string;
  workspace_root: string;
  objective: string;
  chamber_plan: ChamberDirectivePlan;
  cadmus_result: OmnisActionResult;
  initial_vantage_result: OmnisActionResult;
  patch_queue_item: OmnisQueueItem | null;
  verification_results: VerificationCommandResult[];
  final_vantage_result: OmnisActionResult;
  release_status: "ready_for_release" | "waiting_for_approval" | "blocked";
  release_summary: string[];
  envelope_ids: string[];
  luna_event_ids: string[];
  audit_hash: string;
}

export type CodexWorkerMode = "plan" | "build" | "review" | "fix";
export type CodexWorkerStatus =
  | "ready"
  | "missing_cli"
  | "not_logged_in"
  | "blocked"
  | "executed"
  | "failed";
export type CodexWorkerSandbox = "read-only" | "workspace-write" | "danger-full-access";
export type CodexWorkerApprovalPolicy = "never" | "on-request" | "on-failure" | "untrusted";

export interface CodexWorkerReadiness {
  status: Exclude<CodexWorkerStatus, "executed" | "failed">;
  codex_path: string;
  cli_available: boolean;
  auth_file_present: boolean;
  requires_subscription_auth: true;
  raw_oauth_access_allowed: false;
  recovery_requirements: string[];
  audit_hash: string;
}

export interface CodexWorkerRequest {
  request_id: string;
  workspace_root: string;
  objective: string;
  mode: CodexWorkerMode;
  sandbox: CodexWorkerSandbox;
  approval_policy: CodexWorkerApprovalPolicy;
  model: string | null;
  codex_path: string;
  args: string[];
  execute: boolean;
  requires_subscription_auth: true;
  raw_oauth_access_allowed: false;
  audit_hash: string;
}

export interface CodexWorkerRun {
  run_id: string;
  request: CodexWorkerRequest;
  readiness: CodexWorkerReadiness;
  status: CodexWorkerStatus;
  exit_code: number | null;
  stdout_tail: string[];
  stderr_tail: string[];
  output_hash: string;
  envelope_id: string;
  luna_event_id: string;
  audit_hash: string;
}

export type CodexWorkerJobStatus = "running" | CodexWorkerStatus;

export interface CodexWorkerJob {
  job_id: string;
  request: CodexWorkerRequest;
  readiness: CodexWorkerReadiness;
  status: CodexWorkerJobStatus;
  pid: number | null;
  started_at: string;
  finished_at: string | null;
  exit_code: number | null;
  stdout_tail: string[];
  stderr_tail: string[];
  output_hash: string | null;
  envelope_id: string | null;
  luna_event_id: string | null;
  audit_hash: string;
}

export interface HardeningCheck {
  check_id: string;
  area:
    | "installer"
    | "updates"
    | "tokens"
    | "recovery"
    | "docs"
    | "demo"
    | "benchmarks"
    | "api"
    | "tests";
  status: "ready" | "partial" | "missing";
  summary: string;
  evidence: string[];
  audit_hash: string;
}

export interface OmnisHardeningReport {
  report_id: string;
  workspace_root: string;
  checks: HardeningCheck[];
  installer_commands: string[];
  update_strategy: string[];
  token_storage_strategy: string[];
  crash_recovery_guidance: string[];
  demo_commands: string[];
  benchmark_commands: string[];
  readiness: "ready_for_v1_demo" | "needs_packaging" | "blocked";
  audit_hash: string;
}

export interface Joke {
  id: string;
  text: string;
  status: "draft" | "approved" | "archived";
  createdAt: string;
  scheduledFor?: string;
  tags: string[];
}

export interface JokeSchedule {
  cadence: "daily" | "weekly";
  localTime: string;
  timezone: string;
  enabled: boolean;
}

export interface JokeReceipt {
  jokeId: string;
  action: "generated" | "edited" | "approved" | "sent";
  envelopeId: string;
  timestamp: string;
}

export interface DadJokeWorkbench {
  schedule: JokeSchedule;
  jokes: Joke[];
  approval_queue: Joke[];
  archive: Joke[];
  receipts: JokeReceipt[];
  latest_receipt: JokeReceipt | null;
  assumptions: string[];
  open_questions: string[];
  duplicate_flags: string[];
  next_scheduled_for: string | null;
  audit_hash: string;
}

export interface GateDecision {
  decision_id: string;
  status: GateDecisionStatus;
  reason: string;
  release_allowed: boolean;
  recovery_requirements: string[];
  mirrorverse_status: FinalStatus;
  proof_packet_ids: string[];
  veto_summary: Veto[];
  uncertainty_summary: string[];
  audit_hash: string;
}

export interface VellumEnvelope {
  envelope_id: string;
  sequence: number;
  parent_envelope_hash: string;
  session_id: string;
  actor: OmnisActor;
  tool: OmnisTool;
  action_status: OmnisActionStatus;
  request_hash: string;
  input_hash: string;
  output_hash: string;
  gate_decision_hash: string;
  artifact_hash: string;
  evidence_packet_ids: string[];
  created_at: string;
  audit_hash: string;
}

export interface LunaEvent {
  event_id: string;
  event_type: LunaEventType;
  sequence: number;
  parent_sha: string;
  sha: string;
  timestamp: string;
  session_id: string;
  envelope_id: string;
  envelope_hash: string;
  operation: string;
  summary: string;
  payload_hash: string;
  payload: unknown;
}

export interface LunaVerification {
  path: string;
  entries_total: number;
  genesis_rooted: boolean;
  chain_valid: boolean;
  chain_breaks: Array<{
    entry_index: number;
    expected_parent: string;
    actual_parent: string;
  }>;
  sha_mismatches: Array<{
    entry_index: number;
    stored_sha: string;
    recomputed_sha: string;
  }>;
  first_sha: string | null;
  last_sha: string | null;
  operations_seen: Record<string, number>;
  verdict:
    | "PASS"
    | "EMPTY_LOG"
    | "PARSE_ERROR"
    | "MALFORMED_ENTRY"
    | "NOT_GENESIS_ROOTED"
    | "CHAIN_BROKEN"
    | "SHA_MISMATCH"
    | "FILE_NOT_FOUND";
  audit_hash: string;
}

export interface WorkspaceSnapshot {
  workspace_root: string;
  captured_at: string;
  project_count: number;
  family_count: number;
  duplicate_family_count: number;
  audit_hash: string;
}

export interface AgentThread {
  thread_id: string;
  session_id: string;
  agent_ids: string[];
  soul_hashes?: Record<string, string>;
  model_policy_ids?: string[];
  envelope_ids: string[];
  status: "open" | "paused" | "closed";
  audit_hash: string;
}

export interface OmnisModelProvider {
  provider_id: OmnisModelProviderId;
  display_name: string;
  provider_type: OmnisModelProviderType;
  allowed_for_agents: boolean;
  allowed_for_organs: boolean;
  requires_network: boolean;
  secret_ref: string | null;
  capabilities: OmnisModelCapability[];
  default_model: string;
  allowed_models: string[];
  audit_hash: string;
}

export interface OmnisAgentModelPolicy {
  policy_id: string;
  agent_id: string;
  provider_id: OmnisModelProviderId;
  model: string;
  mode: OmnisModelPolicyMode;
  allowed_capabilities: OmnisModelCapability[];
  max_risk_level: OmnisRiskLevel;
  can_request_tools: boolean;
  can_mutate_workspace: boolean;
  requires_approval_for_mutation: boolean;
  system_boundary: string;
  audit_hash: string;
}

export interface OmnisModelProviderRegistry {
  registry_id: string;
  providers: OmnisModelProvider[];
  agent_policies: OmnisAgentModelPolicy[];
  deterministic_organs: string[];
  invocation_invariants: string[];
  default_budget_policy: OmnisModelBudgetPolicy;
  audit_hash: string;
}

export interface OmnisInstallModelTarget {
  target_id: string;
  provider_id: OmnisModelProviderId;
  requested_model: string;
  resolved_model: string;
  lane: "frontier_cloud" | "alternate_cloud" | "local";
  secret_ref: string | null;
  status: "configured" | "needs_secret" | "needs_local_runtime" | "alias_pending";
  notes: string[];
  audit_hash: string;
}

export interface OmnisInstallAgentWiring {
  agent_id: string;
  primary_target_id: string;
  fallback_target_ids: string[];
  deterministic_tools: OmnisToolName[];
  bifrost_required: boolean;
  mutation_requires_approval: boolean;
  audit_hash: string;
}

export interface OmnisOneClickInstallPackage {
  package_id: string;
  workspace_root: string;
  generated_at: string;
  installer_script_path: string;
  env_template_path: string;
  profile_path: string;
  app_port: number;
  luna_launch_agent: boolean;
  bifrost_enabled: boolean;
  model_targets: OmnisInstallModelTarget[];
  agent_wiring: OmnisInstallAgentWiring[];
  installer_commands: string[];
  recovery_requirements: string[];
  audit_hash: string;
}

export interface OmnisModelBudgetPolicy {
  policy_id: string;
  max_input_tokens: number;
  max_output_tokens: number;
  max_total_tokens: number;
  max_budget_units: number;
  cloud_provider_secret_required: boolean;
  mutation_requires_approval: boolean;
  audit_hash: string;
}

export interface OmnisModelBudgetEstimate {
  estimate_id: string;
  provider_id: OmnisModelProviderId;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_budget_units: number;
  within_policy: boolean;
  violations: string[];
  audit_hash: string;
}

export interface OmnisModelProviderReadiness {
  provider_id: OmnisModelProviderId;
  display_name: string;
  provider_type: OmnisModelProviderType;
  configured: boolean;
  requires_network: boolean;
  secret_ref: string | null;
  ready_for_agent_invocation: boolean;
  blockers: string[];
  audit_hash: string;
}

export interface OmnisModelProviderReadinessReport {
  report_id: string;
  providers: OmnisModelProviderReadiness[];
  budget_policy: OmnisModelBudgetPolicy;
  ready_provider_ids: OmnisModelProviderId[];
  blocked_provider_ids: OmnisModelProviderId[];
  audit_hash: string;
}

export interface OmnisModelRouteDecision {
  route_id: string;
  agent_id: string;
  purpose: string;
  task_class: OmnisModelTaskClass;
  privacy_level: OmnisModelPrivacyLevel;
  risk_level: OmnisRiskLevel;
  selected_provider_id: OmnisModelProviderId;
  selected_model: string;
  selected_target_id: string;
  fallback_provider_ids: OmnisModelProviderId[];
  fallback_models: string[];
  requested_tools: OmnisToolName[];
  supported_provider_ids: OmnisModelProviderId[];
  reasons: string[];
  blocked_provider_ids: OmnisModelProviderId[];
  readiness_hash: string;
  budget_estimate: OmnisModelBudgetEstimate;
  bifrost_required: true;
  audit_hash: string;
}

export interface OmnisModelInvocationContract {
  invocation_id: string;
  agent_id: string;
  provider_id: OmnisModelProviderId;
  model: string;
  purpose: string;
  allowed_capabilities: OmnisModelCapability[];
  allowed_tools: OmnisToolName[];
  input_envelope_required: boolean;
  output_envelope_required: boolean;
  luna_event_required: boolean;
  sentinel_gate_required: boolean;
  network_declared: boolean;
  mutation_requires_approval: boolean;
  budget_estimate: OmnisModelBudgetEstimate;
  release_rule: string;
  audit_hash: string;
}

export interface OmnisModelPolicyCheck {
  check_id: string;
  subject: string;
  allowed: boolean;
  reason: string;
  recovery_requirements: string[];
  audit_hash: string;
}

export interface OmnisModelInvocationPreflight {
  preflight_id: string;
  workspace_root: string;
  status: OmnisModelInvocationPreflightStatus;
  contract: OmnisModelInvocationContract;
  provider_readiness: OmnisModelProviderReadiness;
  policy_check: OmnisModelPolicyCheck;
  blockers: string[];
  recovery_requirements: string[];
  vellum_envelope: VellumEnvelope;
  luna_event: LunaEvent;
  audit_hash: string;
}

export interface OmnisModelProviderCallResult {
  provider_id: OmnisModelProviderId;
  model: string;
  output_text: string;
  raw_response_hash: string;
  request_id: string | null;
  audit_hash: string;
}

export interface OmnisAgentMessage {
  message_id: string;
  thread_id: string;
  agent_id: string;
  role: "agent" | "user" | "system";
  text: string;
  envelope_id: string;
  audit_hash: string;
}

export interface OmnisAgentThreadResponse {
  response_id: string;
  thread_id: string;
  requested_agent_ids: string[];
  generated_messages: OmnisAgentMessage[];
  blocked_preflights: OmnisModelInvocationPreflight[];
  route_decisions?: OmnisModelRouteDecision[];
  provider_results: OmnisModelProviderCallResult[];
  audit_hash: string;
}

export interface OmnisTelegramRuntimeConfig {
  workspace_root: string;
  bot_token_configured: boolean;
  allowed_chat_ids: string[];
  default_agent_ids: string[];
  polling_interval_ms: number;
  network_declared: true;
  audit_hash: string;
}

export interface OmnisTelegramDispatchResult {
  dispatch_id: string;
  workspace_root: string;
  chat_id: string;
  thread_id: string;
  input_text: string;
  response_text: string;
  agent_ids: string[];
  route_decisions: OmnisModelRouteDecision[];
  envelope_ids: string[];
  network_declared: true;
  audit_hash: string;
}

export interface MemoryQuery {
  query_id: string;
  query: string;
  normalized_query: string;
  matched_event_ids: string[];
  answer: string;
  evidence: string[];
  audit_hash: string;
}

export type SoulManifestStatus = "canonical" | "evidence_draft" | "missing";

export interface SoulManifest {
  soul_id: string;
  name: string;
  status: SoulManifestStatus;
  source_path: string;
  pronouns: string | null;
  sections: Record<string, string>;
  missing_sections: string[];
  signature_markers: string[];
  content_hash: string;
  audit_hash: string;
}

export interface SoulRoster {
  roster_id: string;
  souls_dir: string;
  canonical_count: number;
  evidence_draft_count: number;
  missing_count: number;
  manifests: SoulManifest[];
  audit_hash: string;
}

export interface OmnisStatus {
  workspace_root: string;
  omnis_dir: string;
  log_path: string;
  initialized: boolean;
  registered_tools: OmnisTool[];
  log_verification: LunaVerification;
  audit_hash: string;
}

export interface OmnisWorkspaceRecord {
  workspace_id: string;
  workspace_root: string;
  label: string;
  registered_at: string;
  last_seen_at: string;
  status: OmnisStatus;
  audit_hash: string;
}

export interface OmnisWorkspaceRegistry {
  registry_id: string;
  controller_root: string;
  workspaces: OmnisWorkspaceRecord[];
  audit_hash: string;
}

export interface OmnisEventStream {
  workspace_root: string;
  since_sequence: number;
  next_sequence: number;
  events: LunaEvent[];
  audit_hash: string;
}

export interface OmnisApiResponse {
  status_code: number;
  body: unknown;
  audit_hash: string;
}

export interface OmnisPairingRecord {
  pairing_id: string;
  device_label: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_verified_at: string | null;
  audit_hash: string;
}

export interface OmnisPairingIssue {
  pairing_id: string;
  device_label: string;
  token: string;
  token_hash: string;
  expires_at: string;
  record: OmnisPairingRecord;
  audit_hash: string;
}

export interface OmnisPairingStatus {
  workspace_root: string;
  paired: boolean;
  active_pairings: OmnisPairingRecord[];
  expired_pairings: OmnisPairingRecord[];
  revoked_pairings: OmnisPairingRecord[];
  audit_hash: string;
}

export interface OmnisAppState {
  app_id: "omnis-key-desktop";
  workspace_root: string;
  generated_at: string;
  status: OmnisStatus;
  navigation: Array<{
    view_id:
      | "overview"
      | "command"
      | "directives"
      | "agents"
      | "projects"
      | "code"
      | "build"
      | "jokes"
      | "vantage"
      | "cadmus"
      | "oath"
      | "queue"
      | "timeline"
      | "tools"
      | "memory"
      | "refusals"
      | "vellum"
      | "models"
      | "settings"
      | "hardening"
      | "souls";
    label: string;
    badge_count: number;
  }>;
  dashboard: {
    event_count: number;
    action_count: number;
    refusal_count: number;
    failure_count: number;
    memory_query_count: number;
    chain_verdict: LunaVerification["verdict"];
    latest_summary: string;
    model_ready_count: number;
    model_blocked_count: number;
  };
  timeline: Array<{
    event_id: string;
    event_type: LunaEventType;
    operation: string;
    summary: string;
    answer?: string;
    query?: string;
    timestamp: string;
    sha: string;
    envelope_id: string;
  }>;
  refusals: Array<{
    event_id: string;
    summary: string;
    recovery_requirements: string[];
    envelope_id: string;
  }>;
  agent_threads: Array<{
    thread_id: string;
    agent_ids: string[];
    message_count: number;
    latest_summary: string;
    envelope_ids: string[];
    model_policy_ids: string[];
  }>;
  agent_messages: Array<{
    message_id: string;
    thread_id: string;
    agent_id: string;
    role: OmnisAgentMessage["role"];
    text: string;
    envelope_id: string;
  }>;
  directives: BuildDirective[];
  chamber: {
    tasks: AgentTask[];
    events: ChamberEvent[];
  };
  queue: OmnisQueueItem[];
  tools: OmnisTool[];
  model_readiness: OmnisModelProviderReadinessReport;
  dad_jokes: DadJokeWorkbench;
  soul_roster: SoulRoster;
  project_index: OmnisProjectIndex;
  suggested_actions: Array<{
    action_id: string;
    label: string;
    command: string;
    risk_level: OmnisRiskLevel;
  }>;
  audit_hash: string;
}

export interface OmnisProjectIndex {
  index_id: string;
  workspace_root: string;
  source_event_id: string | null;
  project_count: number;
  duplicate_family_count: number;
  ship_candidate_count: number;
  needs_inquest_count: number;
  projects: Array<{
    project_id: string;
    name: string;
    root_path: string;
    family_key: string;
    recommendation: ProspectorRecommendation;
    completion_score: number;
    risk_score: number;
  }>;
  families: Array<{
    family_id: string;
    family_key: string;
    project_ids: string[];
    recommendation: ProspectorFamily["recommendation"];
    strongest_project_id: string;
  }>;
  audit_hash: string;
}

export interface OmnisDesktopBundle {
  workspace_root: string;
  source_design_path: string | null;
  app_state: OmnisAppState;
  html: string;
  audit_hash: string;
}

export interface OmnisMobileBundle {
  workspace_root: string;
  source_design_path: string | null;
  app_state: OmnisAppState;
  html: string;
  audit_hash: string;
}

export interface OmnisObservation {
  observation_id: string;
  workspace_root: string;
  vantage_result: OmnisActionResult;
  prospector_result: OmnisActionResult;
  memory_result: MemoryQuery;
  app_state: OmnisAppState;
  summary: {
    event_count: number;
    action_count: number;
    refusal_count: number;
    failure_count: number;
    chain_verdict: LunaVerification["verdict"];
  };
  audit_hash: string;
}

export interface OmnisEnvelopeInspection {
  envelope_id: string;
  found: boolean;
  event: LunaEvent | null;
  envelope: VellumEnvelope | null;
  gate_decision: GateDecision | null;
  output: unknown;
  audit_hash: string;
}

export type OmnisQueueStatus = "queued" | "approved" | "refused" | "executed";

export interface OmnisQueueItem {
  queue_id: string;
  tool_name: OmnisToolName;
  args: string[];
  reason: string;
  status: OmnisQueueStatus;
  created_envelope_id: string;
  decision_envelope_id: string | null;
  result_envelope_id: string | null;
  audit_hash: string;
}

export interface OmnisQueueDecision {
  queue_id: string;
  decision: "approved" | "refused";
  reason: string;
  queue_item: OmnisQueueItem | null;
  action_result: OmnisActionResult | null;
  luna_event: LunaEvent;
  audit_hash: string;
}

export interface LunaStandaloneConfig {
  version: 1;
  enabled: boolean;
  roots: string[];
  interval_ms: number;
  created_at: string;
  updated_at: string;
  audit_hash: string;
}

export interface LunaStandaloneStatus {
  luna_home: string;
  config_path: string;
  global_log_path: string;
  launch_agent_path: string;
  configured: boolean;
  config: LunaStandaloneConfig | null;
  global_log_verification: LunaVerification;
  audit_hash: string;
}

export interface LunaStandaloneObservation {
  observation_id: string;
  roots: string[];
  observations: OmnisObservation[];
  global_event: LunaEvent;
  status: LunaStandaloneStatus;
  summary: {
    root_count: number;
    event_count: number;
    refusal_count: number;
    failure_count: number;
    chain_verdict: LunaVerification["verdict"];
  };
  audit_hash: string;
}

export interface LunaStandaloneWatchReport {
  watch_id: string;
  iterations: number;
  interval_ms: number;
  observations: LunaStandaloneObservation[];
  summary: {
    first_event_count: number;
    last_event_count: number;
    total_refusals: number;
    total_failures: number;
    chain_verdict: LunaVerification["verdict"];
  };
  audit_hash: string;
}

export interface LunaRootUpdateReport {
  action: "add" | "remove" | "set";
  roots_before: string[];
  roots_after: string[];
  status: LunaStandaloneStatus;
  audit_hash: string;
}

export interface LunaMemoryAnswer {
  query: string;
  answer: string;
  global_event_count: number;
  workspace_event_count: number;
  roots: string[];
  latest_global_event_id: string | null;
  latest_workspace_event_id: string | null;
  latest_summary: string | null;
  matching_event_ids: string[];
  refusal_summaries: string[];
  failure_summaries: string[];
  operations_seen: Record<string, number>;
  audit_hash: string;
}

export interface LunaDocumentationArtifact {
  title: string;
  generated_at: string;
  roots: string[];
  global_event_count: number;
  workspace_event_count: number;
  chain_verdict: LunaVerification["verdict"];
  markdown: string;
  audit_hash: string;
}

export interface LunaLaunchAgentReport {
  label: string;
  plist_path: string;
  program_arguments: string[];
  interval_seconds: number;
  installed: boolean;
  loaded: boolean;
  action: "install" | "uninstall";
  audit_hash: string;
}

export interface LunaDoctorReport {
  doctor_id: string;
  status: LunaStandaloneStatus;
  plist_installed: boolean;
  launch_agent_loaded: boolean;
  root_health: Array<{
    root: string;
    reachable: boolean;
    workspace_log_verdict: LunaVerification["verdict"];
    workspace_log_entries: number;
  }>;
  verdict: "PASS" | "WARN" | "FAIL";
  findings: string[];
  recovery_actions: string[];
  audit_hash: string;
}
