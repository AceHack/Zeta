import { createHash, createPublicKey, timingSafeEqual, verify as verifySignature } from "node:crypto";
import { fromBase64url, isCommitSha, isProposalId, isSha256, sha256Hex, toBase64url } from "./proposal-envelope";
import {
  canonicalDeviceDelegationIntentBytes,
  canonicalDeviceProposalIntentBytes,
  canonicalDevicePublicKeyBytes,
  DEVICE_DELEGATION_SCHEMA,
  DEVICE_PROPOSAL_BASE_REF,
  DEVICE_PROPOSAL_BRANCH_PREFIX,
  DEVICE_PROPOSAL_HARD_MAX_PATCH_BYTES,
  DEVICE_PROPOSAL_ISSUE_MARKER,
  DEVICE_PROPOSAL_MAX_FUTURE_SKEW_MS,
  DEVICE_PROPOSAL_MAX_LIFETIME_MS,
  DEVICE_PROPOSAL_PATH_POLICY,
  DEVICE_PROPOSAL_REPOSITORY,
  DEVICE_PROPOSAL_SCHEMA,
  DEVICE_PROPOSAL_SUBMISSION_SCHEMA,
  type DelegatedDeviceProposalSubmission,
  type DeviceDelegationIntent,
  type DeviceProposalCapability,
  type DeviceProposalIntent,
  type DevicePublicKeyJwk,
  type SignedDeviceDelegation,
  type SignedDeviceProposal,
} from "./delegated-device-proposal-contract";
import {
  verifyAuthorizedWebAuthnAssertion,
  type ProposalAuthorRegistry,
  type ProposalTeachingError,
} from "./proposal-verifier";
import { patchPaths, type GatedCommitRejection } from "./proposal-gated-commit";
export {
  canonicalDeviceDelegationIntentBytes,
  canonicalDeviceProposalIntentBytes,
  canonicalDevicePublicKeyBytes,
  DEVICE_DELEGATION_SCHEMA,
  DEVICE_PROPOSAL_BASE_REF,
  DEVICE_PROPOSAL_BRANCH_PREFIX,
  DEVICE_PROPOSAL_HARD_MAX_PATCH_BYTES,
  DEVICE_PROPOSAL_ISSUE_MARKER,
  DEVICE_PROPOSAL_MAX_FUTURE_SKEW_MS,
  DEVICE_PROPOSAL_MAX_LIFETIME_MS,
  DEVICE_PROPOSAL_PATH_POLICY,
  DEVICE_PROPOSAL_REPOSITORY,
  DEVICE_PROPOSAL_SCHEMA,
  DEVICE_PROPOSAL_SUBMISSION_SCHEMA,
  type DelegatedDeviceProposalSubmission,
  type DeviceDelegationIntent,
  type DeviceProposalCapability,
  type DeviceProposalIntent,
  type DevicePublicKeyJwk,
  type SignedDeviceDelegation,
  type SignedDeviceProposal,
} from "./delegated-device-proposal-contract";

export interface DelegatedDeviceCommitPlan {
  readonly ok: true;
  readonly branch: string;
  readonly commitMessage: string;
  readonly paths: readonly string[];
  readonly submission: DelegatedDeviceProposalSubmission;
}

export type DelegatedDeviceProposalErrorCode =
  | "device-delegation"
  | "device-key"
  | "device-proposal"
  | "device-signature"
  | "device-replay"
  | "device-stale-base"
  | "device-carrier";

export interface DelegatedDeviceProposalTeachingError {
  readonly ok: false;
  readonly code: DelegatedDeviceProposalErrorCode;
  readonly message: string;
  readonly retraction: { readonly weight: -1; readonly belief: string };
  readonly generator: string;
}

export type DelegatedDeviceProposalVerification =
  | DelegatedDeviceCommitPlan
  | DelegatedDeviceProposalTeachingError
  | ProposalTeachingError
  | GatedCommitRejection;

function reject(
  code: DelegatedDeviceProposalErrorCode,
  message: string,
  belief: string,
  generator: string,
): DelegatedDeviceProposalTeachingError {
  return { ok: false, code, message, retraction: { weight: -1, belief }, generator };
}

function isGatedCommitRejection(value: readonly string[] | GatedCommitRejection): value is GatedCommitRejection {
  return !Array.isArray(value);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseIso(value: string): number | null {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value ? milliseconds : null;
}

function validNonce(value: string): boolean {
  try {
    const bytes = fromBase64url(value);
    return bytes.length === 32 && toBase64url(bytes) === value;
  } catch {
    return false;
  }
}

function validCredentialId(value: string): boolean {
  try {
    const bytes = fromBase64url(value);
    return bytes.length > 0 && bytes.length <= 4096 && toBase64url(bytes) === value;
  } catch {
    return false;
  }
}

function publicDeviceKey(value: unknown): DevicePublicKeyJwk | null {
  if (
    !isRecord(value) ||
    value.kty !== "EC" ||
    value.crv !== "P-256" ||
    typeof value.x !== "string" ||
    typeof value.y !== "string" ||
    value.ext !== true ||
    "d" in value
  ) {
    return null;
  }
  try {
    const x = fromBase64url(value.x);
    const y = fromBase64url(value.y);
    if (x.length !== 32 || y.length !== 32 || toBase64url(x) !== value.x || toBase64url(y) !== value.y) return null;
  } catch {
    return null;
  }
  return { kty: "EC", crv: "P-256", x: value.x, y: value.y, ext: true };
}

export function canonicalDevicePublicKey(key: DevicePublicKeyJwk): string {
  return new TextDecoder().decode(canonicalDevicePublicKeyBytes(key));
}

export function deviceIdForPublicKey(key: DevicePublicKeyJwk): string {
  return sha256Hex(canonicalDevicePublicKey(key));
}

export function canonicalDeviceDelegationIntent(intent: DeviceDelegationIntent): string {
  return new TextDecoder().decode(canonicalDeviceDelegationIntentBytes(intent));
}

export function deviceDelegationChallenge(intent: DeviceDelegationIntent): Buffer {
  return createHash("sha256").update(canonicalDeviceDelegationIntent(intent)).digest();
}

export function deviceDelegationDigest(intent: DeviceDelegationIntent): string {
  return deviceDelegationChallenge(intent).toString("hex");
}

export function canonicalDeviceProposalIntent(intent: DeviceProposalIntent): string {
  return new TextDecoder().decode(canonicalDeviceProposalIntentBytes(intent));
}

function validCapability(value: unknown): value is DeviceProposalCapability {
  return (
    isRecord(value) &&
    value.action === "stage-review-branch" &&
    value.baseRef === DEVICE_PROPOSAL_BASE_REF &&
    value.branchPrefix === DEVICE_PROPOSAL_BRANCH_PREFIX &&
    Number.isSafeInteger(value.maxPatchBytes) &&
    typeof value.maxPatchBytes === "number" &&
    value.maxPatchBytes > 0 &&
    value.maxPatchBytes <= DEVICE_PROPOSAL_HARD_MAX_PATCH_BYTES &&
    value.pathPolicy === DEVICE_PROPOSAL_PATH_POLICY
  );
}

/**
 * Validate a device delegation against the registry.
 *
 * ## Bumping `sequence` does NOT revoke a device delegation — use `revokedDevices`
 *
 * The sequence check below is `authorRegistrySequence > registry.sequence` (reject only a
 * delegation bound to a *newer* authority revision than the one on protected main). It is
 * deliberately **not** the `!==` used on the v2 proposal path
 * (`verifySignedProposal` → `registry.sequence !== proposal.authorRegistrySequence`), and the
 * asymmetry is intended:
 *
 * | path | check | effect of bumping `registry.sequence` |
 * |---|---|---|
 * | v2 proposal | `!==` | **invalidates** every outstanding proposal |
 * | device delegation | `>` | **no effect** — older sequences stay valid |
 *
 * A delegation declares `validity: "until-authority-revoked"`, so its lifetime is governed by
 * revocation, not by registry revision. Tying it to `!==` would silently kill every enrolled
 * device on any unrelated registry edit (adding an author, correcting a typo).
 *
 * **The operator trap this comment exists to prevent:** bumping `sequence` *looks* like an
 * emergency revoke and is not one. A device delegated at sequence 2 keeps working at sequence 3,
 * 4, 99. The two levers that actually revoke are:
 *
 * - `registry.revoked[<authorityCredentialId>]` → `revoked-author` — revokes the root passkey and
 *   with it every device delegated from it;
 * - `registry.revokedDevices[<deviceId>]` → `device-key` — revokes one device.
 *
 * Pinned by DDP-11/DDP-12/DDP-13 in `delegated-device-proposal.test.ts`; mutating this `>` to
 * `!==` fails DDP-11, which is what keeps the asymmetry documented by a test rather than only by
 * this comment.
 */
function validateDelegation(
  delegation: SignedDeviceDelegation,
  registry: ProposalAuthorRegistry,
  now: Date,
):
  | DelegatedDeviceProposalTeachingError
  | ProposalTeachingError
  | { readonly ok: true; readonly key: DevicePublicKeyJwk } {
  if (!isRecord(delegation) || !isRecord(delegation.assertion)) {
    return reject(
      "device-delegation",
      "teaching error: device delegation is not a structured signed envelope; generator: authorize a fresh bounded device from the primary Pages origin",
      "device-delegation-contract",
      "authorizeProposalDevice",
    );
  }
  const key = publicDeviceKey(delegation.devicePublicKeyJwk);
  const issuedAt = typeof delegation.issuedAt === "string" ? parseIso(delegation.issuedAt) : null;
  if (
    delegation.schema !== DEVICE_DELEGATION_SCHEMA ||
    delegation.repository !== DEVICE_PROPOSAL_REPOSITORY ||
    key === null ||
    !isSha256(delegation.deviceId) ||
    delegation.deviceId !== deviceIdForPublicKey(key) ||
    typeof delegation.authorityCredentialId !== "string" ||
    !validCredentialId(delegation.authorityCredentialId) ||
    !Number.isSafeInteger(delegation.authorRegistrySequence) ||
    delegation.authorRegistrySequence < 0 ||
    delegation.authorRegistrySequence > registry.sequence ||
    issuedAt === null ||
    issuedAt - now.getTime() > DEVICE_PROPOSAL_MAX_FUTURE_SKEW_MS ||
    !validNonce(delegation.nonce) ||
    delegation.validity !== "until-authority-revoked" ||
    !validCapability(delegation.capability)
  ) {
    return reject(
      "device-delegation",
      "teaching error: device delegation is malformed, over-budget, future-issued, or bound to a foreign authority revision; generator: authorize a fresh bounded device from the primary Pages origin",
      "device-delegation-contract",
      "authorizeProposalDevice",
    );
  }
  const assertion = verifyAuthorizedWebAuthnAssertion({
    assertion: delegation.assertion,
    credentialId: delegation.authorityCredentialId,
    expectedChallenge: deviceDelegationChallenge(delegation),
    registry,
  });
  if (!assertion.ok) return assertion;
  if (registry.revokedDevices?.[delegation.deviceId] !== undefined) {
    return reject(
      "device-key",
      "teaching error: delegated proposal device is revoked; generator: authorize a fresh device and obtain independent registry approval",
      "device-proposal-authority",
      "authorizeProposalDevice",
    );
  }
  return { ok: true, key };
}

function validateProposalShape(
  submission: DelegatedDeviceProposalSubmission,
  now: Date,
): DelegatedDeviceProposalTeachingError | null {
  if (
    !isRecord(submission) ||
    !isRecord(submission.proposal) ||
    !isRecord(submission.delegation) ||
    !isRecord(submission.delegation.capability) ||
    typeof submission.payload !== "string"
  ) {
    return reject(
      "device-proposal",
      "teaching error: delegated proposal is not a structured signed submission; generator: bind a fresh proposal to current main and the exact patch bytes",
      "device-proposal-contract",
      "createDelegatedDeviceProposal",
    );
  }
  const { proposal, delegation, payload } = submission;
  const createdAt = typeof proposal.createdAt === "string" ? parseIso(proposal.createdAt) : null;
  const expiresAt = typeof proposal.expiresAt === "string" ? parseIso(proposal.expiresAt) : null;
  let expectedDelegationDigest: string;
  try {
    expectedDelegationDigest = deviceDelegationDigest(delegation);
  } catch {
    return reject(
      "device-proposal",
      "teaching error: delegated proposal contains non-canonical authority bytes; generator: bind a fresh proposal to the retained delegation",
      "device-proposal-contract",
      "createDelegatedDeviceProposal",
    );
  }
  if (
    submission.schema !== DEVICE_PROPOSAL_SUBMISSION_SCHEMA ||
    proposal.schema !== DEVICE_PROPOSAL_SCHEMA ||
    proposal.repository !== DEVICE_PROPOSAL_REPOSITORY ||
    proposal.baseRef !== DEVICE_PROPOSAL_BASE_REF ||
    !isProposalId(proposal.proposalId) ||
    !isCommitSha(proposal.baseSha) ||
    createdAt === null ||
    expiresAt === null ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > DEVICE_PROPOSAL_MAX_LIFETIME_MS ||
    createdAt - now.getTime() > DEVICE_PROPOSAL_MAX_FUTURE_SKEW_MS ||
    now.getTime() > expiresAt ||
    !validNonce(proposal.nonce) ||
    !isSha256(proposal.patchDigest) ||
    proposal.patchDigest !== sha256Hex(payload.trim()) ||
    proposal.deviceId !== delegation.deviceId ||
    proposal.delegationDigest !== expectedDelegationDigest ||
    Buffer.byteLength(payload, "utf8") > delegation.capability.maxPatchBytes
  ) {
    return reject(
      "device-proposal",
      "teaching error: delegated proposal is malformed, expired, over-budget, or differs from its signed patch and delegation digests; generator: bind a fresh proposal to current main and the exact patch bytes",
      "device-proposal-contract",
      "createDelegatedDeviceProposal",
    );
  }
  return null;
}

function verifyDeviceSignature(proposal: SignedDeviceProposal, key: DevicePublicKeyJwk): boolean {
  try {
    const signature = fromBase64url(proposal.signature);
    if (signature.length !== 64 || toBase64url(signature) !== proposal.signature) return false;
    const publicKey = createPublicKey({ key, format: "jwk" });
    return verifySignature(
      "sha256",
      Buffer.from(canonicalDeviceProposalIntent(proposal), "utf8"),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      signature,
    );
  } catch {
    return false;
  }
}

export function verifyDelegatedDeviceProposal(input: {
  readonly submission: DelegatedDeviceProposalSubmission;
  readonly registry: ProposalAuthorRegistry;
  readonly currentMainSha: string;
  readonly consumedProposalIds?: ReadonlySet<string>;
  readonly consumedNonces?: ReadonlySet<string>;
  readonly now?: Date;
}): DelegatedDeviceProposalVerification {
  const now = input.now ?? new Date();
  const shape = validateProposalShape(input.submission, now);
  if (shape) return shape;
  const delegation = validateDelegation(input.submission.delegation, input.registry, now);
  if (!delegation.ok) return delegation;
  const { proposal } = input.submission;
  if (input.consumedProposalIds?.has(proposal.proposalId) || input.consumedNonces?.has(proposal.nonce)) {
    return reject(
      "device-replay",
      "teaching error: delegated proposal ID or nonce was already consumed; generator: sign a fresh proposal after a material patch change",
      "device-proposal-replay",
      "createDelegatedDeviceProposal",
    );
  }
  if (proposal.baseSha !== input.currentMainSha.toLowerCase()) {
    return reject(
      "device-stale-base",
      "teaching error: protected main advanced after the device signed; generator: rebase the patch and sign a fresh short-lived proposal",
      "device-proposal-stale-base",
      "createDelegatedDeviceProposal",
    );
  }
  if (!verifyDeviceSignature(proposal, delegation.key)) {
    return reject(
      "device-signature",
      "teaching error: delegated device signature does not verify against the passkey-authorized public key; generator: sign with the paired non-exportable device key",
      "device-proposal-signature",
      "signDelegatedDeviceProposal",
    );
  }
  const paths = patchPaths(input.submission.payload);
  if (isGatedCommitRejection(paths)) return paths;
  return {
    ok: true,
    branch: `${input.submission.delegation.capability.branchPrefix}${proposal.proposalId}`,
    commitMessage: `proposal: ${proposal.proposalId}\n\ndelegated-device: ${proposal.deviceId}\nauthority-passkey: ${input.submission.delegation.authorityCredentialId}\npatch-digest: ${proposal.patchDigest}`,
    paths,
    submission: input.submission,
  };
}

export function encodeDelegatedDeviceProposalIssueBody(submission: DelegatedDeviceProposalSubmission): string {
  const encoded = toBase64url(Buffer.from(JSON.stringify(submission), "utf8"));
  return `${DEVICE_PROPOSAL_ISSUE_MARKER}\n\n${encoded}\n`;
}

export function decodeDelegatedDeviceProposalIssueBody(
  body: string,
): DelegatedDeviceProposalSubmission | DelegatedDeviceProposalTeachingError {
  if (!body.startsWith(`${DEVICE_PROPOSAL_ISSUE_MARKER}\n\n`)) {
    return reject(
      "device-carrier",
      "teaching error: issue does not carry the delegated-device marker; generator: publish the exact encoded device submission",
      "device-proposal-carrier",
      "encodeDelegatedDeviceProposalIssueBody",
    );
  }
  const encoded = body.slice(DEVICE_PROPOSAL_ISSUE_MARKER.length).trim();
  try {
    const bytes = fromBase64url(encoded);
    if (toBase64url(bytes) !== encoded) throw new Error("non-canonical");
    const parsed = JSON.parse(bytes.toString("utf8")) as DelegatedDeviceProposalSubmission;
    return parsed;
  } catch {
    return reject(
      "device-carrier",
      "teaching error: delegated-device carrier is not canonical base64url JSON; generator: publish the unmodified encoded submission",
      "device-proposal-carrier",
      "encodeDelegatedDeviceProposalIssueBody",
    );
  }
}

export function equalDeviceDigest(left: string, right: string): boolean {
  if (!isSha256(left) || !isSha256(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
