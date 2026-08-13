import { createHash, createPublicKey, timingSafeEqual, verify as verifySignature } from "node:crypto";
import { decode } from "cborg";
import {
  canonicalProposalIntent,
  fromBase64url,
  isCommitSha,
  isSha256,
  proposalChallenge,
  PROPOSAL_BASE_REF,
  PROPOSAL_REPOSITORY,
  PROPOSAL_SCHEMA,
  sha256Hex,
  toBase64url,
  type ProposalIntent,
  type SignedProposal,
} from "./proposal-envelope";

export interface AuthorizedProposalAuthor {
  readonly credentialId: string;
  readonly origin: string;
  readonly rpId: string;
  readonly publicKeyJwk: JsonWebKey;
}

export interface ProposalAuthorRegistry {
  readonly schema: "zeta.proposal-author-registry.v1";
  readonly repository: typeof PROPOSAL_REPOSITORY;
  readonly authors: readonly AuthorizedProposalAuthor[];
}

export type ProposalErrorCode =
  | "schema"
  | "repository"
  | "base-ref"
  | "base-sha"
  | "time"
  | "nonce"
  | "change-digest"
  | "unknown-author"
  | "credential-mismatch"
  | "client-data"
  | "origin"
  | "challenge"
  | "rp-id"
  | "user-verification"
  | "assertion-signature"
  | "replay";

export interface ProposalTeachingError {
  readonly ok: false;
  readonly code: ProposalErrorCode;
  readonly message: string;
  readonly retraction: { readonly weight: -1; readonly belief: string };
  readonly generator: string;
}

export interface VerifiedProposal {
  readonly ok: true;
  readonly proposal: SignedProposal;
  readonly canonicalIntent: string;
  readonly author: AuthorizedProposalAuthor;
}

export type ProposalVerification = ProposalTeachingError | VerifiedProposal;

export interface ProposalVerificationInput {
  readonly proposal: SignedProposal;
  readonly payload: string;
  readonly registry: ProposalAuthorRegistry;
  readonly consumedProposalIds?: ReadonlySet<string>;
  readonly consumedNonces?: ReadonlySet<string>;
  readonly now?: Date;
}

function reject(code: ProposalErrorCode, message: string, belief: string, generator: string): ProposalTeachingError {
  return { ok: false, code, message, retraction: { weight: -1, belief }, generator };
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

function parseIso(value: string): number | null {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function parseClientData(encoded: string): { type: string; challenge: string; origin: string } | null {
  try {
    const value = JSON.parse(fromBase64url(encoded).toString("utf8")) as Record<string, unknown>;
    return typeof value.type === "string" && typeof value.challenge === "string" && typeof value.origin === "string"
      ? { type: value.type, challenge: value.challenge, origin: value.origin }
      : null;
  } catch {
    return null;
  }
}

function authenticatorDataIsBoundToRpId(data: Buffer, rpId: string): boolean {
  if (data.length < 37) return false;
  const expected = createHash("sha256").update(rpId).digest();
  return equalBytes(data.subarray(0, 32), expected);
}

function authenticatorDataHasUserVerification(data: Buffer): boolean {
  const flags = data[32] ?? 0;
  return (flags & 0x01) !== 0 && (flags & 0x04) !== 0;
}

function validNonce(value: string): boolean {
  try {
    return fromBase64url(value).length === 32;
  } catch {
    return false;
  }
}

function validIntent(intent: ProposalIntent, payload: string, now: Date): ProposalTeachingError | null {
  if (intent.schema !== PROPOSAL_SCHEMA) return reject("schema", "teaching error: unsupported proposal schema; generator: create a zeta.proposal.v1 envelope", "proposal-schema", "createProposalIntent");
  if (intent.repository !== PROPOSAL_REPOSITORY) return reject("repository", "teaching error: proposal targets a different repository; generator: bind the Zeta repository constant", "proposal-repository", "createProposalIntent");
  if (intent.baseRef !== PROPOSAL_BASE_REF) return reject("base-ref", "teaching error: proposal must be based on protected main; generator: fetch and bind main's immutable SHA", "proposal-base-ref", "createProposalIntent");
  if (!isCommitSha(intent.baseSha)) return reject("base-sha", "teaching error: baseSha is not an immutable commit SHA; generator: bind current main before signing", "proposal-base-sha", "createProposalIntent");
  if (!validNonce(intent.nonce)) return reject("nonce", "teaching error: nonce must be exactly 32 random bytes encoded as base64url; generator: generate a new envelope", "proposal-nonce", "createProposalIntent");
  if (!isSha256(intent.changeDigest) || intent.changeDigest !== sha256Hex(payload.trim())) return reject("change-digest", "teaching error: requested change bytes differ from the signed digest; generator: re-create and sign the envelope after editing the payload", "proposal-change-digest", "createProposalIntent");
  const createdAt = parseIso(intent.createdAt);
  const expiresAt = parseIso(intent.expiresAt);
  if (createdAt === null || expiresAt === null || expiresAt <= createdAt || now.getTime() > expiresAt) return reject("time", "teaching error: proposal is expired or has invalid time bounds; generator: create a fresh five-minute envelope", "proposal-time", "createProposalIntent");
  return null;
}

export function verifySignedProposal(input: ProposalVerificationInput): ProposalVerification {
  const now = input.now ?? new Date();
  const structuralError = validIntent(input.proposal, input.payload, now);
  if (structuralError) return structuralError;
  if (input.consumedProposalIds?.has(input.proposal.proposalId) || input.consumedNonces?.has(input.proposal.nonce)) {
    return reject("replay", "teaching error: proposal ID or nonce was already consumed; generator: bind a new change to a freshly signed envelope", "proposal-replay", "createProposalIntent");
  }
  if (input.registry.schema !== "zeta.proposal-author-registry.v1" || input.registry.repository !== PROPOSAL_REPOSITORY) {
    return reject("unknown-author", "teaching error: author registry does not describe this repository; generator: load the canonical Zeta proposal-author registry", "proposal-author-registry", "loadProposalAuthorRegistry");
  }
  const author = input.registry.authors.find(candidate => candidate.credentialId === input.proposal.authorCredentialId);
  if (!author) return reject("unknown-author", "teaching error: passkey is not in the authorized proposal-author registry; generator: submit its enrollment package for independent maintainer approval", "proposal-author", "enrollProposalPasskey");
  if (input.proposal.assertion.credentialId !== author.credentialId) return reject("credential-mismatch", "teaching error: assertion credential does not match the envelope author; generator: sign with the enrolled passkey", "proposal-credential", "signProposal");
  const clientData = parseClientData(input.proposal.assertion.clientDataJSON);
  if (!clientData || clientData.type !== "webauthn.get") return reject("client-data", "teaching error: assertion lacks a WebAuthn get client-data record; generator: request a fresh user-verified passkey assertion", "proposal-client-data", "signProposal");
  if (clientData.origin !== author.origin) return reject("origin", "teaching error: WebAuthn origin differs from the enrolled author origin; generator: use the authorized GitHub Pages origin", "proposal-origin", "signProposal");
  const expectedChallenge = toBase64url(proposalChallenge(input.proposal));
  if (clientData.challenge !== expectedChallenge) return reject("challenge", "teaching error: assertion challenge is not the canonical proposal digest; generator: re-sign the unchanged envelope", "proposal-challenge", "signProposal");
  let authenticatorData: Buffer;
  let clientDataBytes: Buffer;
  let signature: Buffer;
  try {
    authenticatorData = fromBase64url(input.proposal.assertion.authenticatorData);
    clientDataBytes = fromBase64url(input.proposal.assertion.clientDataJSON);
    signature = fromBase64url(input.proposal.assertion.signature);
  } catch {
    return reject("client-data", "teaching error: assertion bytes are not base64url encoded; generator: create a new assertion through the PWA signer", "proposal-assertion-bytes", "signProposal");
  }
  if (!authenticatorDataIsBoundToRpId(authenticatorData, author.rpId)) return reject("rp-id", "teaching error: authenticator data is not bound to the enrolled RP ID; generator: sign from the authorized GitHub Pages hostname", "proposal-rp-id", "signProposal");
  if (!authenticatorDataHasUserVerification(authenticatorData)) return reject("user-verification", "teaching error: assertion lacks user presence or user verification; generator: complete the platform passkey prompt with verification", "proposal-user-verification", "signProposal");
  let verified = false;
  try {
    const key = createPublicKey({ key: author.publicKeyJwk, format: "jwk" });
    const signedBytes = Buffer.concat([authenticatorData, createHash("sha256").update(clientDataBytes).digest()]);
    verified = verifySignature("sha256", signedBytes, key, signature);
  } catch {
    verified = false;
  }
  if (!verified) return reject("assertion-signature", "teaching error: passkey signature does not verify against the enrolled public key; generator: re-enroll or sign the exact proposal with the matching passkey", "proposal-assertion-signature", "signProposal");
  return { ok: true, proposal: input.proposal, canonicalIntent: canonicalProposalIntent(input.proposal), author };
}

/** Extract a P-256 COSE public key from a passkey registration record.
 * Enrollment has no GitHub authority; a maintainer must independently review the
 * output before it enters the author registry consumed by verifySignedProposal. */
export function publicKeyJwkFromEnrollment(enrollment: { readonly credentialId: string; readonly attestationObject: string }): JsonWebKey {
  const attestation = decode(fromBase64url(enrollment.attestationObject));
  const authData = attestation instanceof Map
    ? attestation.get("authData")
    : attestation && typeof attestation === "object" && "authData" in attestation
      ? (attestation as { readonly authData?: unknown }).authData
      : undefined;
  if (!(authData instanceof Uint8Array) || authData.length < 55) throw new Error("teaching error: enrollment does not carry authenticator data; generator: create a fresh passkey enrollment package");
  const credentialIdLength = ((authData[53] ?? 0) << 8) | (authData[54] ?? 0);
  const coseOffset = 55 + credentialIdLength;
  if (coseOffset >= authData.length) throw new Error("teaching error: enrollment lacks a COSE public key; generator: create a fresh passkey enrollment package");
  const cose = decode(authData.subarray(coseOffset), { useMaps: true }) as Map<unknown, unknown>;
  const kty = cose.get(1);
  const algorithm = cose.get(3);
  const curve = cose.get(-1);
  const x = cose.get(-2);
  const y = cose.get(-3);
  if (kty !== 2 || algorithm !== -7 || curve !== 1 || !(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) {
    throw new Error("teaching error: enrollment must contain an ES256 P-256 COSE key; generator: enroll a supported passkey authenticator");
  }
  return { kty: "EC", crv: "P-256", x: toBase64url(x), y: toBase64url(y), ext: true };
}
