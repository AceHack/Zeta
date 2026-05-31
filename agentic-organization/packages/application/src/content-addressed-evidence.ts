import { createHash } from "node:crypto";

export const ContentAddressedEvidencePrefix = "evidence" as const;

export type ContentAddressedEvidenceArtifact = {
  ref: string;
  kind: string;
  payload: unknown;
};

export function createContentAddressedEvidenceRef(kind: string, payload: unknown): string {
  assertEvidenceKind(kind);
  const digest = createHash("sha256").update(stringifyCanonicalJson(payload)).digest("hex");
  return `${ContentAddressedEvidencePrefix}:${kind}:sha256:${digest}`;
}

export function createContentAddressedEvidenceArtifact(
  kind: string,
  payload: unknown,
): ContentAddressedEvidenceArtifact {
  return {
    ref: createContentAddressedEvidenceRef(kind, payload),
    kind,
    payload,
  };
}

export function isContentAddressedEvidenceRef(value: unknown): value is string {
  return typeof value === "string" && /^evidence:[a-z0-9][a-z0-9-]*:sha256:[0-9a-f]{64}$/.test(value);
}

export function allEvidenceRefsContentAddressed(values: readonly string[]): boolean {
  return values.length > 0 && values.every(isContentAddressedEvidenceRef);
}

export function verifiedContentAddressedEvidenceRefs(
  artifacts: readonly ContentAddressedEvidenceArtifact[] | undefined,
): ReadonlySet<string> {
  const verifiedRefs = new Set<string>();

  for (const artifact of artifacts ?? []) {
    if (!isEvidenceArtifact(artifact)) {
      continue;
    }

    const expectedRef = createContentAddressedEvidenceRef(artifact.kind, artifact.payload);
    if (artifact.ref === expectedRef) {
      verifiedRefs.add(artifact.ref);
    }
  }

  return verifiedRefs;
}

function assertEvidenceKind(kind: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(kind)) {
    throw new Error("content-addressed evidence kind must be lowercase kebab-case");
  }
}

function isEvidenceArtifact(value: unknown): value is ContentAddressedEvidenceArtifact {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const artifact = value as Partial<ContentAddressedEvidenceArtifact>;
  return typeof artifact.ref === "string" && typeof artifact.kind === "string" && "payload" in artifact;
}

function stringifyCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stringifyCanonicalJson).join(",")}]`;
  }

  return `{${Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([entryKey, entryValue]) => `${JSON.stringify(entryKey)}:${stringifyCanonicalJson(entryValue)}`)
    .join(",")}}`;
}
