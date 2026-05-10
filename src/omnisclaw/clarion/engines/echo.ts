import { shortHash } from "../audit/hash.js";
import type { EchoOutput, EvidencePacket } from "../types.js";

export function detectEvidenceEchoes(packets: EvidencePacket[]): EchoOutput {
  const effective = Object.fromEntries(
    packets.map((packet) => [packet.packet_id, packet.trust_profile.lineage_key]),
  );
  const byLineage = new Map<string, { packets: EvidencePacket[]; reason: string }>();

  for (const packet of packets) {
    const key = packet.trust_profile.lineage_key;
    const current = byLineage.get(key) ?? {
      packets: [],
      reason: "packets share an explicit origin lineage",
    };
    byLineage.set(key, { ...current, packets: [...current.packets, packet] });
  }

  for (const cluster of nearDuplicateClusters(packets)) {
    const key = `fingerprint:${cluster.fingerprint}`;
    if (byLineage.has(key)) {
      continue;
    }
    byLineage.set(key, {
      packets: cluster.packets,
      reason: "packets share a near-duplicate claim and text fingerprint",
    });
    for (const packet of cluster.packets) {
      effective[packet.packet_id] = key;
    }
  }

  const duplicate_clusters = [...byLineage.entries()]
    .filter(([, cluster]) => cluster.packets.length > 1)
    .map(([lineage_key, cluster]) => ({
      cluster_id: `echo_${shortHash({ lineage_key, packet_ids: cluster.packets.map((packet) => packet.packet_id).sort() })}`,
      packet_ids: cluster.packets.map((packet) => packet.packet_id).sort(),
      lineage_key,
      reason: cluster.reason,
    }))
    .sort((a, b) => a.cluster_id.localeCompare(b.cluster_id));

  const laundering_flags = duplicate_clusters.map(
    (cluster) =>
      `duplicate_source_laundering:${cluster.cluster_id}:${cluster.packet_ids.join("|")}`,
  );

  return {
    packets,
    duplicate_clusters,
    effective_independence_key_by_packet_id: effective,
    laundering_flags,
  };
}

function nearDuplicateClusters(
  packets: EvidencePacket[],
): Array<{ fingerprint: string; packets: EvidencePacket[] }> {
  const clusters = new Map<string, EvidencePacket[]>();

  for (let leftIndex = 0; leftIndex < packets.length; leftIndex += 1) {
    const left = packets[leftIndex];
    if (!left) {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < packets.length; rightIndex += 1) {
      const right = packets[rightIndex];
      if (!right || left.trust_profile.lineage_key === right.trust_profile.lineage_key) {
        continue;
      }
      const fingerprint = claimFingerprint(left);
      if (fingerprint !== claimFingerprint(right)) {
        continue;
      }
      if (jaccard(left.normalized_terms, right.normalized_terms) < 0.86) {
        continue;
      }
      const current = clusters.get(fingerprint) ?? [];
      clusters.set(fingerprint, uniquePackets([...current, left, right]));
    }
  }

  return [...clusters.entries()]
    .map(([fingerprint, clusterPackets]) => ({
      fingerprint,
      packets: clusterPackets.sort((a, b) => a.packet_id.localeCompare(b.packet_id)),
    }))
    .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

function claimFingerprint(packet: EvidencePacket): string {
  return packet.extracted_claims
    .filter((claim) => claim.predicate !== "text_observation")
    .map((claim) => `${claim.predicate}:${claim.object_ref}`)
    .sort()
    .join("|");
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((term) => rightSet.has(term)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function uniquePackets(packets: EvidencePacket[]): EvidencePacket[] {
  return [...new Map(packets.map((packet) => [packet.packet_id, packet])).values()];
}
