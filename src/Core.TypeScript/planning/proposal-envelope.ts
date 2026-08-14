import { createHash, randomBytes, randomUUID } from "node:crypto";
import { canonicalBytes } from "../ace/canonical";
import {
  PROPOSAL_BASE_REF,
  PROPOSAL_MAX_LIFETIME_MS,
  PROPOSAL_REPOSITORY,
  PROPOSAL_SCHEMA,
  type ProposalIntent,
} from "./proposal-contract";

export {
  PROPOSAL_BASE_REF,
  PROPOSAL_MAX_FUTURE_SKEW_MS,
  PROPOSAL_MAX_LIFETIME_MS,
  PROPOSAL_ORIGIN,
  PROPOSAL_PASSKEY_ENROLLMENT_SCHEMA,
  PROPOSAL_REPOSITORY,
  PROPOSAL_RP_ID,
  PROPOSAL_SCHEMA,
  type ProposalIntent,
  type ProposalPasskeyEnrollment,
  type SignedProposal,
  type WebAuthnAssertion,
} from "./proposal-contract";

export function isCommitSha(value: string): boolean {
  return /^[a-f0-9]{40}$/i.test(value);
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function isProposalId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
 * This fixed-key projection uses Ace's shared canonical byte form. Its byte
 * representation is the exact WebAuthn challenge preimage, so field order is
 * irrelevant while any field substitution invalidates the assertion.
 */
export function canonicalProposalIntent(intent: ProposalIntent): string {
  return new TextDecoder().decode(
    canonicalBytes({
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
      authorRegistrySequence: intent.authorRegistrySequence,
    }),
  );
}

export function proposalChallenge(intent: ProposalIntent): Buffer {
  return createHash("sha256").update(canonicalProposalIntent(intent)).digest();
}

export function createProposalIntent(input: {
  readonly baseSha: string;
  readonly payload: string;
  readonly authorCredentialId: string;
  readonly authorRegistrySequence: number;
  readonly now?: Date;
  readonly expiresInMs?: number;
}): ProposalIntent {
  if (!isCommitSha(input.baseSha))
    throw new Error(
      "teaching error: baseSha must be a 40-character immutable Git commit SHA; generator: bind current main before signing",
    );
  if (input.payload.trim().length === 0)
    throw new Error(
      "teaching error: a proposal must bind a non-empty requested change; generator: describe the change before signing",
    );
  if (input.authorCredentialId.length === 0)
    throw new Error(
      "teaching error: a passkey credential ID is required; generator: enroll an authorized proposal passkey",
    );
  if (!Number.isSafeInteger(input.authorRegistrySequence) || input.authorRegistrySequence < 0)
    throw new Error(
      "teaching error: authorRegistrySequence must bind a non-negative author-registry revision; generator: load the registry from the immutable base commit before signing",
    );
  const now = input.now ?? new Date();
  const expiresInMs = input.expiresInMs ?? PROPOSAL_MAX_LIFETIME_MS;
  if (!Number.isSafeInteger(expiresInMs) || expiresInMs < 1 || expiresInMs > PROPOSAL_MAX_LIFETIME_MS)
    throw new Error(
      "teaching error: expiresInMs must be a positive duration no greater than five minutes; generator: create a fresh bounded envelope",
    );
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
    authorRegistrySequence: input.authorRegistrySequence,
  };
}
