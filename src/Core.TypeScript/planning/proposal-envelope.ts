import { createHash, randomBytes, randomUUID } from "node:crypto";

export const PROPOSAL_SCHEMA = "zeta.proposal.v1";
export const PROPOSAL_REPOSITORY = "Lucent-Financial-Group/Zeta";
export const PROPOSAL_BASE_REF = "main";

export interface ProposalIntent {
  readonly schema: typeof PROPOSAL_SCHEMA;
  readonly proposalId: string;
  readonly repository: typeof PROPOSAL_REPOSITORY;
  readonly baseRef: typeof PROPOSAL_BASE_REF;
  readonly baseSha: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly changeDigest: string;
  readonly authorCredentialId: string;
}

export interface WebAuthnAssertion {
  readonly credentialId: string;
  readonly authenticatorData: string;
  readonly clientDataJSON: string;
  readonly signature: string;
  readonly userHandle?: string;
}

export interface SignedProposal extends ProposalIntent {
  readonly assertion: WebAuthnAssertion;
}

export function isCommitSha(value: string): boolean {
  return /^[a-f0-9]{40}$/i.test(value);
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function toBase64url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

export function fromBase64url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  return Buffer.from(value, "base64url");
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * This serialization is deliberately a fixed-key object, not an open JSON map.
 * Its byte representation is the exact WebAuthn challenge preimage, so any
 * field substitution changes the challenge and invalidates the assertion.
 */
export function canonicalProposalIntent(intent: ProposalIntent): string {
  return JSON.stringify({
    schema: intent.schema,
    proposalId: intent.proposalId,
    repository: intent.repository,
    baseRef: intent.baseRef,
    baseSha: intent.baseSha,
    createdAt: intent.createdAt,
    expiresAt: intent.expiresAt,
    nonce: intent.nonce,
    changeDigest: intent.changeDigest,
    authorCredentialId: intent.authorCredentialId,
  });
}

export function proposalChallenge(intent: ProposalIntent): Buffer {
  return createHash("sha256").update(canonicalProposalIntent(intent)).digest();
}

export function createProposalIntent(input: {
  readonly baseSha: string;
  readonly payload: string;
  readonly authorCredentialId: string;
  readonly now?: Date;
  readonly expiresInMs?: number;
}): ProposalIntent {
  if (!isCommitSha(input.baseSha)) throw new Error("teaching error: baseSha must be a 40-character immutable Git commit SHA; generator: bind current main before signing");
  if (input.payload.trim().length === 0) throw new Error("teaching error: a proposal must bind a non-empty requested change; generator: describe the change before signing");
  if (input.authorCredentialId.length === 0) throw new Error("teaching error: a passkey credential ID is required; generator: enroll an authorized proposal passkey");
  const now = input.now ?? new Date();
  const expiresInMs = input.expiresInMs ?? 5 * 60_000;
  return {
    schema: PROPOSAL_SCHEMA,
    proposalId: randomUUID(),
    repository: PROPOSAL_REPOSITORY,
    baseRef: PROPOSAL_BASE_REF,
    baseSha: input.baseSha.toLowerCase(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + expiresInMs).toISOString(),
    nonce: toBase64url(randomBytes(32)),
    changeDigest: sha256Hex(input.payload.trim()),
    authorCredentialId: input.authorCredentialId,
  };
}
