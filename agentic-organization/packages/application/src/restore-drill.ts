import { createHash } from "node:crypto";

export type RestoreDrillProjection = {
  name: string;
  rows: readonly unknown[];
};

export type RestoreDrillSnapshot = {
  organizationId: string;
  capturedAt: string;
  projections: readonly RestoreDrillProjection[];
};

export type RestoreDrillChecksum = {
  algorithm: "sha256";
  organizationId: string;
  projectionCount: number;
  rowCount: number;
  checksum: string;
};

export type RestoreDrillVerification =
  | { status: "passed"; before: RestoreDrillChecksum; after: RestoreDrillChecksum }
  | { status: "failed"; before: RestoreDrillChecksum; after: RestoreDrillChecksum; reason: "checksum_mismatch" };

export function computeRestoreDrillChecksum(snapshot: RestoreDrillSnapshot): RestoreDrillChecksum {
  const canonical = canonicalize({
    organizationId: snapshot.organizationId,
    projections: snapshot.projections
      .map((projection) => ({
        name: projection.name,
        rows: projection.rows.map(canonicalize).sort(),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  });

  return {
    algorithm: "sha256",
    organizationId: snapshot.organizationId,
    projectionCount: snapshot.projections.length,
    rowCount: snapshot.projections.reduce((count, projection) => count + projection.rows.length, 0),
    checksum: createHash("sha256").update(canonical).digest("hex"),
  };
}

export function verifyRestoreDrill(
  beforeSnapshot: RestoreDrillSnapshot,
  afterSnapshot: RestoreDrillSnapshot,
): RestoreDrillVerification {
  const before = computeRestoreDrillChecksum(beforeSnapshot);
  const after = computeRestoreDrillChecksum(afterSnapshot);
  return before.checksum === after.checksum
    ? { status: "passed", before, after }
    : { status: "failed", before, after, reason: "checksum_mismatch" };
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`).join(",")}}`;
}
