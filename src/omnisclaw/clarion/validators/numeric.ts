import type { Claim } from "../types.js";

export interface NumericConflict {
  predicate: string;
  left: Claim;
  right: Claim;
  delta: number;
}

export function findNumericConflicts(claims: Claim[], tolerance: number): NumericConflict[] {
  const numeric = claims.filter((claim) => claim.predicate.startsWith("numeric:"));
  const conflicts: NumericConflict[] = [];

  for (let leftIndex = 0; leftIndex < numeric.length; leftIndex += 1) {
    const left = numeric[leftIndex];
    if (!left) {
      continue;
    }
    for (let rightIndex = leftIndex + 1; rightIndex < numeric.length; rightIndex += 1) {
      const right = numeric[rightIndex];
      if (!right || left.predicate !== right.predicate) {
        continue;
      }
      const leftValue = Number(left.object_ref);
      const rightValue = Number(right.object_ref);
      if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
        continue;
      }
      const delta = Math.abs(leftValue - rightValue);
      if (delta > tolerance) {
        conflicts.push({ predicate: left.predicate, left, right, delta });
      }
    }
  }

  return conflicts.sort((a, b) =>
    `${a.predicate}:${a.left.claim_id}:${a.right.claim_id}`.localeCompare(
      `${b.predicate}:${b.left.claim_id}:${b.right.claim_id}`,
    ),
  );
}
