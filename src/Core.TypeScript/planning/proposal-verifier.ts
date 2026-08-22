import { createHash, createPublicKey, timingSafeEqual, verify as verifySignature } from "node:crypto";
import { decode } from "cborg";
import {
  canonicalProposalIntent,
  fromBase64url,
  isCommitSha,
  isProposalId,
  isSha256,
  proposalChallenge,
  PROPOSAL_BASE_REF,
  PROPOSAL_MAX_FUTURE_SKEW_MS,
  PROPOSAL_MAX_LIFETIME_MS,
  PROPOSAL_ORIGIN,
  PROPOSAL_PASSKEY_ENROLLMENT_SCHEMA,
  PROPOSAL_REPOSITORY,
  PROPOSAL_RP_ID,
  PROPOSAL_SCHEMA,
  sha256Hex,
  toBase64url,
  type ProposalIntent,
  type ProposalPasskeyEnrollment,
  type SignedProposal,
  type WebAuthnAssertion,
} from "./proposal-envelope";

export interface AuthorizedProposalAuthor {
  readonly credentialId: string;
  readonly origin: string;
  readonly rpId: string;
  readonly publicKeyJwk: JsonWebKey;
}

export interface ProposalAuthorRevocation {
  readonly at: string;
  readonly reason?: string;
}

export interface ProposalAuthorRegistry {
  readonly schema: "zeta.proposal-author-registry.v2";
  readonly repository: typeof PROPOSAL_REPOSITORY;
  readonly sequence: number;
  readonly issuedAt: string;
  readonly authors: readonly AuthorizedProposalAuthor[];
  readonly revoked: Readonly<Record<string, ProposalAuthorRevocation>>;
  readonly revokedDevices?: Readonly<Record<string, ProposalAuthorRevocation>>;
}

export type ProposalErrorCode =
  | "schema"
  | "repository"
  | "base-ref"
  | "base-sha"
  | "proposal-id"
  | "time"
  | "nonce"
  | "change-digest"
  | "author-registry"
  | "registry-sequence"
  | "unknown-author"
  | "revoked-author"
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

export type ProposalAuthorRegistryValidation =
  | { readonly ok: true; readonly value: ProposalAuthorRegistry }
  | ProposalTeachingError;

export interface VerifiedProposalPasskeyEnrollment {
  readonly ok: true;
  readonly enrollment: ProposalPasskeyEnrollment;
  readonly author: AuthorizedProposalAuthor;
}

export type ProposalPasskeyEnrollmentVerification = VerifiedProposalPasskeyEnrollment | ProposalTeachingError;

export interface ProposalVerificationInput {
  readonly proposal: SignedProposal;
  readonly payload: string;
  readonly registry: ProposalAuthorRegistry;
  readonly consumedProposalIds?: ReadonlySet<string>;
  readonly consumedNonces?: ReadonlySet<string>;
  readonly now?: Date;
}

export interface AuthorizedWebAuthnAssertionInput {
  readonly assertion: WebAuthnAssertion;
  readonly credentialId: string;
  readonly expectedChallenge: Uint8Array;
  readonly registry: ProposalAuthorRegistry;
}

export type AuthorizedWebAuthnAssertionVerification =
  | { readonly ok: true; readonly author: AuthorizedProposalAuthor }
  | ProposalTeachingError;

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

function parseClientData(
  encoded: string,
): { type: string; challenge: string; origin: string; crossOrigin: boolean } | null {
  try {
    const value = JSON.parse(fromBase64url(encoded).toString("utf8")) as Record<string, unknown>;
    return typeof value.type === "string" && typeof value.challenge === "string" && typeof value.origin === "string"
      ? { type: value.type, challenge: value.challenge, origin: value.origin, crossOrigin: value.crossOrigin === true }
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

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validAuthor(value: unknown): value is AuthorizedProposalAuthor {
  if (!isRecord(value) || typeof value.credentialId !== "string" || value.credentialId.length === 0) return false;
  if (typeof value.origin !== "string" || typeof value.rpId !== "string" || !isRecord(value.publicKeyJwk)) return false;
  try {
    const origin = new URL(value.origin);
    return (
      origin.protocol === "https:" &&
      origin.origin === value.origin &&
      origin.hostname === value.rpId &&
      value.origin === PROPOSAL_ORIGIN &&
      value.rpId === PROPOSAL_RP_ID &&
      value.publicKeyJwk.kty === "EC" &&
      value.publicKeyJwk.crv === "P-256" &&
      typeof value.publicKeyJwk.x === "string" &&
      typeof value.publicKeyJwk.y === "string"
    );
  } catch {
    return false;
  }
}

function validRevocations(value: unknown): value is Readonly<Record<string, ProposalAuthorRevocation>> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([credentialId, candidate]) =>
      credentialId.length > 0 &&
      isRecord(candidate) &&
      typeof candidate.at === "string" &&
      parseIso(candidate.at) !== null &&
      (candidate.reason === undefined || typeof candidate.reason === "string"),
  );
}

export function validateProposalAuthorRegistry(value: unknown): ProposalAuthorRegistryValidation {
  if (
    !isRecord(value) ||
    value.schema !== "zeta.proposal-author-registry.v2" ||
    value.repository !== PROPOSAL_REPOSITORY ||
    typeof value.sequence !== "number" ||
    !Number.isSafeInteger(value.sequence) ||
    value.sequence < 0 ||
    typeof value.issuedAt !== "string" ||
    parseIso(value.issuedAt) === null ||
    !Array.isArray(value.authors) ||
    !value.authors.every(validAuthor) ||
    !validRevocations(value.revoked) ||
    (value.revokedDevices !== undefined && !validRevocations(value.revokedDevices))
  ) {
    return reject(
      "author-registry",
      "teaching error: author registry is malformed or does not describe this repository; generator: load the canonical protected-main registry",
      "proposal-author-registry",
      "loadProposalAuthorRegistry",
    );
  }
  const authors = value.authors as readonly AuthorizedProposalAuthor[];
  if (new Set(authors.map((author) => author.credentialId)).size !== authors.length) {
    return reject(
      "author-registry",
      "teaching error: author registry contains duplicate credential IDs; generator: retain one reviewed entry per passkey",
      "proposal-author-registry-identity",
      "loadProposalAuthorRegistry",
    );
  }
  return {
    ok: true,
    value: {
      schema: "zeta.proposal-author-registry.v2",
      repository: PROPOSAL_REPOSITORY,
      sequence: value.sequence,
      issuedAt: value.issuedAt,
      authors,
      revoked: value.revoked,
      ...(value.revokedDevices === undefined ? {} : { revokedDevices: value.revokedDevices }),
    },
  };
}

function validIntent(intent: ProposalIntent, payload: string, now: Date): ProposalTeachingError | null {
  if (intent.schema !== PROPOSAL_SCHEMA)
    return reject(
      "schema",
      "teaching error: unsupported proposal schema; generator: create a zeta.proposal.v2 envelope",
      "proposal-schema",
      "createProposalIntent",
    );
  if (intent.repository !== PROPOSAL_REPOSITORY)
    return reject(
      "repository",
      "teaching error: proposal targets a different repository; generator: bind the Zeta repository constant",
      "proposal-repository",
      "createProposalIntent",
    );
  if (intent.baseRef !== PROPOSAL_BASE_REF)
    return reject(
      "base-ref",
      "teaching error: proposal must be based on protected main; generator: fetch and bind main's immutable SHA",
      "proposal-base-ref",
      "createProposalIntent",
    );
  if (!isProposalId(intent.proposalId))
    return reject(
      "proposal-id",
      "teaching error: proposalId is not a random UUID; generator: create a fresh envelope rather than supplying a branch or path name",
      "proposal-identity",
      "createProposalIntent",
    );
  if (!isCommitSha(intent.baseSha))
    return reject(
      "base-sha",
      "teaching error: baseSha is not an immutable commit SHA; generator: bind current main before signing",
      "proposal-base-sha",
      "createProposalIntent",
    );
  if (!validNonce(intent.nonce))
    return reject(
      "nonce",
      "teaching error: nonce must be exactly 32 random bytes encoded as base64url; generator: generate a new envelope",
      "proposal-nonce",
      "createProposalIntent",
    );
  if (!Number.isSafeInteger(intent.authorRegistrySequence) || intent.authorRegistrySequence < 0)
    return reject(
      "registry-sequence",
      "teaching error: proposal does not bind a valid author-registry sequence; generator: load the registry from the immutable base commit before signing",
      "proposal-author-registry-sequence",
      "createProposalIntent",
    );
  if (!isSha256(intent.changeDigest) || intent.changeDigest !== sha256Hex(payload.trim()))
    return reject(
      "change-digest",
      "teaching error: requested change bytes differ from the signed digest; generator: re-create and sign the envelope after editing the payload",
      "proposal-change-digest",
      "createProposalIntent",
    );
  const createdAt = parseIso(intent.createdAt);
  const expiresAt = parseIso(intent.expiresAt);
  if (
    createdAt === null ||
    expiresAt === null ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > PROPOSAL_MAX_LIFETIME_MS ||
    createdAt - now.getTime() > PROPOSAL_MAX_FUTURE_SKEW_MS ||
    now.getTime() > expiresAt
  )
    return reject(
      "time",
      "teaching error: proposal is expired or has invalid time bounds; generator: create a fresh five-minute envelope",
      "proposal-time",
      "createProposalIntent",
    );
  return null;
}

export function verifySignedProposal(input: ProposalVerificationInput): ProposalVerification {
  const now = input.now ?? new Date();
  const structuralError = validIntent(input.proposal, input.payload, now);
  if (structuralError) return structuralError;
  if (input.consumedProposalIds?.has(input.proposal.proposalId) || input.consumedNonces?.has(input.proposal.nonce)) {
    return reject(
      "replay",
      "teaching error: proposal ID or nonce was already consumed; generator: bind a new change to a freshly signed envelope",
      "proposal-replay",
      "createProposalIntent",
    );
  }
  const registry = validateProposalAuthorRegistry(input.registry);
  if (!registry.ok) return registry;
  if (registry.value.sequence !== input.proposal.authorRegistrySequence) {
    return reject(
      "registry-sequence",
      "teaching error: proposal author-registry sequence differs from protected main; generator: reload current main and sign a fresh envelope",
      "proposal-author-registry-rollback",
      "bindCurrentMainAndSign",
    );
  }
  const assertion = verifyAuthorizedWebAuthnAssertion({
    assertion: input.proposal.assertion,
    credentialId: input.proposal.authorCredentialId,
    expectedChallenge: proposalChallenge(input.proposal),
    registry: registry.value,
  });
  if (!assertion.ok) return assertion;
  return {
    ok: true,
    proposal: input.proposal,
    canonicalIntent: canonicalProposalIntent(input.proposal),
    author: assertion.author,
  };
}

/** Verify one origin-bound, user-verified assertion without granting repository execution by itself. */
export function verifyAuthorizedWebAuthnAssertion(
  input: AuthorizedWebAuthnAssertionInput,
): AuthorizedWebAuthnAssertionVerification {
  const registry = validateProposalAuthorRegistry(input.registry);
  if (!registry.ok) return registry;
  if (registry.value.revoked[input.credentialId] !== undefined) {
    return reject(
      "revoked-author",
      "teaching error: proposal passkey is revoked; generator: enroll a new passkey and obtain independent registry approval",
      "proposal-author-revoked",
      "enrollProposalPasskey",
    );
  }
  const author = registry.value.authors.find((candidate) => candidate.credentialId === input.credentialId);
  if (!author)
    return reject(
      "unknown-author",
      "teaching error: passkey is not in the authorized proposal-author registry; generator: submit its enrollment package for independent maintainer approval",
      "proposal-author",
      "enrollProposalPasskey",
    );
  if (input.assertion.credentialId !== author.credentialId)
    return reject(
      "credential-mismatch",
      "teaching error: assertion credential does not match the envelope author; generator: sign with the enrolled passkey",
      "proposal-credential",
      "signProposal",
    );
  const clientData = parseClientData(input.assertion.clientDataJSON);
  if (!clientData || clientData.type !== "webauthn.get" || clientData.crossOrigin)
    return reject(
      "client-data",
      "teaching error: assertion lacks a WebAuthn get client-data record; generator: request a fresh user-verified passkey assertion",
      "proposal-client-data",
      "signProposal",
    );
  if (clientData.origin !== author.origin)
    return reject(
      "origin",
      "teaching error: WebAuthn origin differs from the enrolled author origin; generator: use the authorized GitHub Pages origin",
      "proposal-origin",
      "signProposal",
    );
  const expectedChallenge = toBase64url(input.expectedChallenge);
  if (clientData.challenge !== expectedChallenge)
    return reject(
      "challenge",
      "teaching error: assertion challenge is not the canonical proposal digest; generator: re-sign the unchanged envelope",
      "proposal-challenge",
      "signProposal",
    );
  let authenticatorData: Buffer;
  let clientDataBytes: Buffer;
  let signature: Buffer;
  try {
    authenticatorData = fromBase64url(input.assertion.authenticatorData);
    clientDataBytes = fromBase64url(input.assertion.clientDataJSON);
    signature = fromBase64url(input.assertion.signature);
  } catch {
    return reject(
      "client-data",
      "teaching error: assertion bytes are not base64url encoded; generator: create a new assertion through the PWA signer",
      "proposal-assertion-bytes",
      "signProposal",
    );
  }
  if (!authenticatorDataIsBoundToRpId(authenticatorData, author.rpId))
    return reject(
      "rp-id",
      "teaching error: authenticator data is not bound to the enrolled RP ID; generator: sign from the authorized GitHub Pages hostname",
      "proposal-rp-id",
      "signProposal",
    );
  if (!authenticatorDataHasUserVerification(authenticatorData))
    return reject(
      "user-verification",
      "teaching error: assertion lacks user presence or user verification; generator: complete the platform passkey prompt with verification",
      "proposal-user-verification",
      "signProposal",
    );
  let verified = false;
  try {
    const key = createPublicKey({ key: author.publicKeyJwk, format: "jwk" });
    const signedBytes = Buffer.concat([authenticatorData, createHash("sha256").update(clientDataBytes).digest()]);
    verified = verifySignature("sha256", signedBytes, key, signature);
  } catch {
    verified = false;
  }
  if (!verified)
    return reject(
      "assertion-signature",
      "teaching error: passkey signature does not verify against the enrolled public key; generator: re-enroll or sign the exact proposal with the matching passkey",
      "proposal-assertion-signature",
      "signProposal",
    );
  return { ok: true, author };
}

interface DecodedEnrollmentAttestation {
  readonly authenticatorData: Buffer;
  readonly credentialId: Buffer;
  readonly publicKeyJwk: JsonWebKey;
}

function decodeEnrollmentAttestation(attestationObject: string): DecodedEnrollmentAttestation {
  const attestation = decode(fromBase64url(attestationObject));
  const format =
    attestation instanceof Map
      ? attestation.get("fmt")
      : attestation && typeof attestation === "object" && "fmt" in attestation
        ? (attestation as { readonly fmt?: unknown }).fmt
        : undefined;
  const authData =
    attestation instanceof Map
      ? attestation.get("authData")
      : attestation && typeof attestation === "object" && "authData" in attestation
        ? (attestation as { readonly authData?: unknown }).authData
        : undefined;
  if (format !== "none" || !(authData instanceof Uint8Array) || authData.length < 55)
    throw new Error(
      "teaching error: enrollment does not carry none-format authenticator data; generator: create a fresh privacy-preserving passkey enrollment package",
    );
  const credentialIdLength = ((authData[53] ?? 0) << 8) | (authData[54] ?? 0);
  const coseOffset = 55 + credentialIdLength;
  if (credentialIdLength < 1 || credentialIdLength > 1024 || coseOffset >= authData.length)
    throw new Error(
      "teaching error: enrollment lacks a COSE public key; generator: create a fresh passkey enrollment package",
    );
  const cose = decode(authData.subarray(coseOffset), { useMaps: true }) as Map<unknown, unknown>;
  const kty = cose.get(1);
  const algorithm = cose.get(3);
  const curve = cose.get(-1);
  const x = cose.get(-2);
  const y = cose.get(-3);
  if (
    kty !== 2 ||
    algorithm !== -7 ||
    curve !== 1 ||
    !(x instanceof Uint8Array) ||
    !(y instanceof Uint8Array) ||
    x.length !== 32 ||
    y.length !== 32
  ) {
    throw new Error(
      "teaching error: enrollment must contain an ES256 P-256 COSE key; generator: enroll a supported passkey authenticator",
    );
  }
  return {
    authenticatorData: Buffer.from(authData),
    credentialId: Buffer.from(authData.subarray(55, coseOffset)),
    publicKeyJwk: { kty: "EC", crv: "P-256", x: toBase64url(x), y: toBase64url(y), ext: true },
  };
}

/** Extract a P-256 COSE public key without granting it repository authority. */
export function publicKeyJwkFromEnrollment(enrollment: {
  readonly credentialId: string;
  readonly attestationObject: string;
}): JsonWebKey {
  return decodeEnrollmentAttestation(enrollment.attestationObject).publicKeyJwk;
}

/**
 * Verify every browser-controlled enrollment binding before a maintainer may
 * copy its public author record into the protected registry.
 */
export function verifyProposalPasskeyEnrollment(
  value: unknown,
  now: Date = new Date(),
): ProposalPasskeyEnrollmentVerification {
  if (
    !isRecord(value) ||
    value.schema !== PROPOSAL_PASSKEY_ENROLLMENT_SCHEMA ||
    value.repository !== PROPOSAL_REPOSITORY ||
    typeof value.credentialId !== "string" ||
    typeof value.challenge !== "string" ||
    typeof value.clientDataJSON !== "string" ||
    typeof value.attestationObject !== "string" ||
    value.origin !== PROPOSAL_ORIGIN ||
    value.rpId !== PROPOSAL_RP_ID ||
    typeof value.createdAt !== "string"
  ) {
    return reject(
      "schema",
      "teaching error: passkey enrollment is not the canonical Zeta package; generator: enroll from the protected GitHub Pages origin",
      "proposal-passkey-enrollment-schema",
      "enrollProposalPasskey",
    );
  }
  const enrollment = value as unknown as ProposalPasskeyEnrollment;
  const createdAt = parseIso(enrollment.createdAt);
  if (
    createdAt === null ||
    enrollment.createdAt !== new Date(createdAt).toISOString() ||
    createdAt - now.getTime() > PROPOSAL_MAX_FUTURE_SKEW_MS
  ) {
    return reject(
      "time",
      "teaching error: passkey enrollment has no canonical finite creation time; generator: create a fresh enrollment package",
      "proposal-passkey-enrollment-time",
      "enrollProposalPasskey",
    );
  }

  let challenge: Buffer;
  let credentialId: Buffer;
  try {
    challenge = fromBase64url(enrollment.challenge);
    credentialId = fromBase64url(enrollment.credentialId);
  } catch {
    return reject(
      "client-data",
      "teaching error: passkey enrollment identifiers are not canonical base64url; generator: export the untouched browser package",
      "proposal-passkey-enrollment-encoding",
      "enrollProposalPasskey",
    );
  }
  if (
    challenge.length !== 32 ||
    credentialId.length < 1 ||
    credentialId.length > 1024 ||
    toBase64url(challenge) !== enrollment.challenge ||
    toBase64url(credentialId) !== enrollment.credentialId
  ) {
    return reject(
      "client-data",
      "teaching error: passkey enrollment identifiers are not finite canonical WebAuthn values; generator: create a fresh enrollment package",
      "proposal-passkey-enrollment-encoding",
      "enrollProposalPasskey",
    );
  }
  const clientData = parseClientData(enrollment.clientDataJSON);
  if (!clientData || clientData.type !== "webauthn.create" || clientData.crossOrigin) {
    return reject(
      "client-data",
      "teaching error: passkey enrollment lacks a same-origin WebAuthn create record; generator: complete enrollment in the top-level Pages document",
      "proposal-passkey-enrollment-client-data",
      "enrollProposalPasskey",
    );
  }
  if (clientData.origin !== enrollment.origin) {
    return reject(
      "origin",
      "teaching error: passkey enrollment client origin differs from the canonical Pages origin; generator: enroll on the primary Pages site",
      "proposal-passkey-enrollment-origin",
      "enrollProposalPasskey",
    );
  }
  if (clientData.challenge !== enrollment.challenge) {
    return reject(
      "challenge",
      "teaching error: passkey enrollment challenge differs from the exported ceremony; generator: export the untouched browser package",
      "proposal-passkey-enrollment-challenge",
      "enrollProposalPasskey",
    );
  }

  let attestation: DecodedEnrollmentAttestation;
  try {
    attestation = decodeEnrollmentAttestation(enrollment.attestationObject);
  } catch (error) {
    return reject(
      "author-registry",
      error instanceof Error ? error.message : "teaching error: passkey enrollment attestation is malformed",
      "proposal-passkey-enrollment-attestation",
      "enrollProposalPasskey",
    );
  }
  if (!authenticatorDataIsBoundToRpId(attestation.authenticatorData, enrollment.rpId)) {
    return reject(
      "rp-id",
      "teaching error: passkey enrollment authenticator data is not bound to the canonical RP ID; generator: enroll on the primary Pages site",
      "proposal-passkey-enrollment-rp-id",
      "enrollProposalPasskey",
    );
  }
  if (
    !authenticatorDataHasUserVerification(attestation.authenticatorData) ||
    ((attestation.authenticatorData[32] ?? 0) & 0x40) === 0
  ) {
    return reject(
      "user-verification",
      "teaching error: passkey enrollment lacks user presence, user verification, or attested credential data; generator: complete the platform passkey prompt",
      "proposal-passkey-enrollment-user-verification",
      "enrollProposalPasskey",
    );
  }
  if (!equalBytes(attestation.credentialId, credentialId)) {
    return reject(
      "credential-mismatch",
      "teaching error: exported passkey credential ID differs from the attested credential; generator: export the untouched browser package",
      "proposal-passkey-enrollment-credential",
      "enrollProposalPasskey",
    );
  }
  return {
    ok: true,
    enrollment,
    author: {
      credentialId: enrollment.credentialId,
      origin: enrollment.origin,
      rpId: enrollment.rpId,
      publicKeyJwk: attestation.publicKeyJwk,
    },
  };
}
