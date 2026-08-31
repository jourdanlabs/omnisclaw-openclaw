import { hashCanonical, shortHash } from "../audit/hash.js";
import type {
  Claim,
  Constraint,
  EvidencePacket,
  MirrorverseConfig,
  MirrorverseInput,
  PrismOutput,
  RawRecord,
  TimeMarker,
  TrustProfile,
  TrustTier,
  Veto,
} from "../types.js";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const TRUST_WEIGHTS: Record<TrustTier, number> = {
  low: 1,
  medium: 2,
  high: 3,
  official: 4,
};

export function packetizeInput(input: MirrorverseInput, _config: MirrorverseConfig): PrismOutput {
  const invalid_input_vetoes: Veto[] = [];
  if (!Array.isArray(input.records) || input.records.length === 0) {
    invalid_input_vetoes.push(
      makeInputVeto("input_empty", "Input must contain at least one raw record.", []),
    );
    return { packets: [], claims: [], constraints: [], invalid_input_vetoes };
  }

  const records = [...input.records].sort(compareRecords);
  const packets = records.map((record, index) =>
    packetizeRecord(record, index + 1, invalid_input_vetoes),
  );
  const claims = packets.flatMap((packet) => packet.extracted_claims);
  const constraints = packets.flatMap((packet) => packet.constraints);

  return { packets, claims, constraints, invalid_input_vetoes };
}

export function extractClaims(record: RawRecord, packet_id: string): Claim[] {
  const text = record.text;
  const subject = normalizeRef(
    firstMatch(text, /\b(?:entity|name|company|person|property)\s*[:=]\s*([^;,\n]+)/i) ??
      inferSubject(text),
  );
  const claims: Claim[] = [];

  for (const value of allMatches(
    text,
    /\b(?:entity|name|company|person|property)\s*[:=]\s*([^;,\n]+)/gi,
  )) {
    claims.push(
      makeClaim(packet_id, claims.length + 1, subject, "name", normalizeRef(value), "asserted"),
    );
  }

  for (const value of allMatches(
    text,
    /\b(?:identifier|id|ein|ssn|parcel_id|property_id)\s*[:=]\s*([A-Za-z0-9._-]+)/gi,
  )) {
    claims.push(
      makeClaim(
        packet_id,
        claims.length + 1,
        subject,
        "identifier",
        normalizeRef(value),
        "asserted",
      ),
    );
  }

  for (const value of allMatches(text, /\b(?:classification|class|type)\s*[:=]\s*([^;,\n]+)/gi)) {
    claims.push(
      makeClaim(
        packet_id,
        claims.length + 1,
        subject,
        "classification",
        normalizeRef(value),
        "asserted",
      ),
    );
  }

  for (const value of allMatches(
    text,
    /\bstatus\s*[:=]\s*(active|inactive|open|closed|approved|denied)\b/gi,
  )) {
    claims.push(
      makeClaim(packet_id, claims.length + 1, subject, "status", normalizeRef(value), "asserted"),
    );
  }

  for (const match of text.matchAll(
    /\b(amount|value|score|price|capacity|employees|count)\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi,
  )) {
    const predicate = match[1];
    const object = match[2];
    if (predicate && object) {
      claims.push(
        makeClaim(
          packet_id,
          claims.length + 1,
          subject,
          `numeric:${normalizeRef(predicate)}`,
          normalizeNumber(object),
          "asserted",
        ),
      );
    }
  }

  for (const value of allMatches(
    text,
    /\b(?:valid_until|expires)\s*[:=]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/gi,
  )) {
    claims.push(makeClaim(packet_id, claims.length + 1, subject, "valid_until", value, "asserted"));
  }

  for (const value of allMatches(text, /\brelationship\s*[:=]\s*([^;,\n]+)/gi)) {
    const parsed = value
      .trim()
      .match(/^(.+?)\s+(owns|employs|located_at|parent_of|controls|depends_on)\s+(.+)$/i);
    if (parsed?.[1] && parsed[2] && parsed[3]) {
      claims.push(
        makeClaim(
          packet_id,
          claims.length + 1,
          normalizeRef(parsed[1]),
          normalizeRef(parsed[2]),
          normalizeRef(parsed[3]),
          "asserted",
        ),
      );
    } else {
      claims.push(
        makeClaim(
          packet_id,
          claims.length + 1,
          subject,
          "relationship",
          normalizeRef(value),
          "asserted",
        ),
      );
    }
  }

  if (claims.length === 0) {
    claims.push(
      makeClaim(packet_id, 1, subject, "text_observation", normalizeRef(text), "implied"),
    );
  }

  return claims;
}

export function extractConstraints(record: RawRecord, packet_id: string): Constraint[] {
  const constraints: Constraint[] = [];

  if (!parseDateStrict(record.timestamp)) {
    constraints.push({
      constraint_id: `${packet_id}:constraint:invalid_timestamp`,
      type: "temporal",
      rule: `timestamp must be a real ISO date: ${record.timestamp}`,
      hard_veto: true,
      severity: "fatal",
    });
  }

  for (const value of allMatches(
    record.text,
    /\b(?:valid_until|expires|date)\s*[:=]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/gi,
  )) {
    if (!parseDateStrict(value)) {
      constraints.push({
        constraint_id: `${packet_id}:constraint:impossible_date:${shortHash(value)}`,
        type: "temporal",
        rule: `mentioned date must be real: ${value}`,
        hard_veto: true,
        severity: "fatal",
      });
    }
  }

  return constraints;
}

export function assignTrustProfile(record: RawRecord): TrustProfile {
  return {
    tier: record.trust_tier,
    weight: TRUST_WEIGHTS[record.trust_tier],
    independence_key: `${record.source_type}:${record.source_id}`,
    lineage_key: record.origin_id
      ? `origin:${normalizeRef(record.origin_id)}`
      : `${record.source_type}:${record.source_id}`,
  };
}

export function hashPacket(packet: Omit<EvidencePacket, "provenance_hash">): string {
  return hashCanonical(packet);
}

export function normalizedTerms(text: string): string[] {
  const seen = new Set<string>();
  const terms = text.toLowerCase().match(/[a-z0-9][a-z0-9._-]*/g) ?? [];

  for (const term of terms) {
    if (term.length > 1 && !STOPWORDS.has(term)) {
      seen.add(term);
    }
  }

  return [...seen].sort();
}

export function normalizeRef(value: string): string {
  return value.trim().toLowerCase().replace(/['"]/g, "").replace(/\s+/g, " ");
}

export function normalizeNumber(value: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return value.trim();
  }
  return Number.isInteger(number)
    ? String(number)
    : String(number).replace(/0+$/, "").replace(/\.$/, "");
}

export function parseDateStrict(value: string): Date | null {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!dateOnly?.[1] || !dateOnly[2] || !dateOnly[3]) {
    return null;
  }
  const year = Number(dateOnly[1]);
  const month = Number(dateOnly[2]);
  const day = Number(dateOnly[3]);
  const date = new Date(`${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function packetizeRecord(record: RawRecord, ordinal: number, invalidInput: Veto[]): EvidencePacket {
  const packet_id = `packet_${String(ordinal).padStart(3, "0")}`;

  if (
    !record.source_id ||
    !record.text ||
    !record.timestamp ||
    !record.source_type ||
    !record.trust_tier
  ) {
    invalidInput.push(
      makeInputVeto(
        "record_missing_field",
        "Every record must include source_id, source_type, text, timestamp, and trust_tier.",
        [packet_id],
      ),
    );
  }

  const timestamps: TimeMarker[] = [
    {
      kind: "observed",
      value: record.timestamp,
      valid: parseDateStrict(record.timestamp) !== null,
    },
  ];

  for (const value of allMatches(
    record.text,
    /\b(valid_until|expires)\s*[:=]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/gi,
    2,
  )) {
    timestamps.push({
      kind: record.text.toLowerCase().includes("expires") ? "expires" : "valid_until",
      value,
      valid: parseDateStrict(value) !== null,
    });
  }

  const withoutHash = {
    packet_id,
    source_id: record.source_id,
    source_type: record.source_type,
    observed_text: record.text,
    normalized_terms: normalizedTerms(record.text),
    extracted_claims: extractClaims(record, packet_id),
    constraints: extractConstraints(record, packet_id),
    timestamps,
    trust_profile: assignTrustProfile(record),
  };

  return {
    ...withoutHash,
    provenance_hash: hashPacket(withoutHash),
  };
}

function makeClaim(
  packet_id: string,
  ordinal: number,
  subject_ref: string,
  predicate: string,
  object_ref: string,
  modality: "asserted" | "implied",
): Claim {
  return {
    claim_id: `${packet_id}:claim:${String(ordinal).padStart(2, "0")}`,
    subject_ref,
    predicate,
    object_ref,
    modality,
    support_packet_ids: [packet_id],
    contradiction_packet_ids: [],
    confidence_floor: 0,
    confidence_ceiling: 1,
  };
}

function inferSubject(text: string): string {
  return normalizedTerms(text).slice(0, 3).join(" ") || "unknown";
}

function firstMatch(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[1]?.trim() ?? null;
}

function allMatches(text: string, pattern: RegExp, group = 1): string[] {
  const values: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const value = match[group];
    if (value) {
      values.push(value.trim());
    }
  }
  return values;
}

function compareRecords(a: RawRecord, b: RawRecord): number {
  return `${a.source_id}\u0000${a.timestamp}\u0000${a.text}`.localeCompare(
    `${b.source_id}\u0000${b.timestamp}\u0000${b.text}`,
  );
}

function makeInputVeto(reason: string, message: string, packet_ids: string[]): Veto {
  return {
    veto_id: `input:${reason}:${shortHash({ reason, packet_ids })}`,
    validator: "PRISM",
    reason: message,
    severity: "hard",
    packet_ids,
    recoverable: false,
  };
}
