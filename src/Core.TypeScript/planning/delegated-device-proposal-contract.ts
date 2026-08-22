import { canonicalBytes } from "../ace/canonical";
import type { WebAuthnAssertion } from "./proposal-contract";

export const DEVICE_DELEGATION_SCHEMA = "zeta.proposal-device-delegation.v1" as const;
export const DEVICE_PROPOSAL_SCHEMA = "zeta.delegated-device-proposal.v1" as const;
export const DEVICE_PROPOSAL_SUBMISSION_SCHEMA = "zeta.delegated-device-submission.v1" as const;
export const DEVICE_PROPOSAL_ISSUE_MARKER = "<!-- zeta-delegated-device-proposal-v1 -->" as const;
export const DEVICE_PROPOSAL_REPOSITORY = "Lucent-Financial-Group/Zeta" as const;
export const DEVICE_PROPOSAL_BASE_REF = "main" as const;
export const DEVICE_PROPOSAL_BRANCH_PREFIX = "heartbeat/proposal-" as const;
export const DEVICE_PROPOSAL_PATH_POLICY = "zeta.proposal-protected-paths.v1" as const;
export const DEVICE_PROPOSAL_MAX_LIFETIME_MS = 5 * 60_000;
export const DEVICE_PROPOSAL_MAX_FUTURE_SKEW_MS = 30_000;
export const DEVICE_PROPOSAL_HARD_MAX_PATCH_BYTES = 32 * 1024;

export interface DevicePublicKeyJwk {
  readonly kty: "EC";
  readonly crv: "P-256";
  readonly x: string;
  readonly y: string;
  readonly ext: true;
}

export interface DeviceProposalCapability {
  readonly action: "stage-review-branch";
  readonly baseRef: typeof DEVICE_PROPOSAL_BASE_REF;
  readonly branchPrefix: typeof DEVICE_PROPOSAL_BRANCH_PREFIX;
  readonly maxPatchBytes: number;
  readonly pathPolicy: typeof DEVICE_PROPOSAL_PATH_POLICY;
}

export interface DeviceDelegationIntent {
  readonly schema: typeof DEVICE_DELEGATION_SCHEMA;
  readonly repository: typeof DEVICE_PROPOSAL_REPOSITORY;
  readonly deviceId: string;
  readonly devicePublicKeyJwk: DevicePublicKeyJwk;
  readonly authorityCredentialId: string;
  readonly authorRegistrySequence: number;
  readonly issuedAt: string;
  readonly nonce: string;
  readonly validity: "until-authority-revoked";
  readonly capability: DeviceProposalCapability;
}

export interface SignedDeviceDelegation extends DeviceDelegationIntent {
  readonly assertion: WebAuthnAssertion;
}

export interface DeviceProposalIntent {
  readonly schema: typeof DEVICE_PROPOSAL_SCHEMA;
  readonly proposalId: string;
  readonly repository: typeof DEVICE_PROPOSAL_REPOSITORY;
  readonly baseRef: typeof DEVICE_PROPOSAL_BASE_REF;
  readonly baseSha: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly patchDigest: string;
  readonly deviceId: string;
  readonly delegationDigest: string;
}

export interface SignedDeviceProposal extends DeviceProposalIntent {
  readonly signature: string;
}

export interface DelegatedDeviceProposalSubmission {
  readonly schema: typeof DEVICE_PROPOSAL_SUBMISSION_SCHEMA;
  readonly delegation: SignedDeviceDelegation;
  readonly proposal: SignedDeviceProposal;
  readonly payload: string;
}

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function deviceBytesToBase64url(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += BASE64URL_ALPHABET[first >>> 2] ?? "";
    output += BASE64URL_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >>> 4)] ?? "";
    if (second !== undefined) output += BASE64URL_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >>> 6)] ?? "";
    if (third !== undefined) output += BASE64URL_ALPHABET[third & 0x3f] ?? "";
  }
  return output;
}

export function deviceBytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function deviceProposalIdFromBytes(bytes: Uint8Array): string | null {
  if (bytes.byteLength !== 16) return null;
  const value = new Uint8Array(bytes);
  value[6] = ((value[6] ?? 0) & 0x0f) | 0x40;
  value[8] = ((value[8] ?? 0) & 0x3f) | 0x80;
  const hex = deviceBytesToHex(value);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function canonicalDevicePublicKeyBytes(key: DevicePublicKeyJwk): Uint8Array {
  return canonicalBytes({ kty: key.kty, crv: key.crv, x: key.x, y: key.y, ext: key.ext });
}

export function canonicalDeviceDelegationIntentBytes(intent: DeviceDelegationIntent): Uint8Array {
  return canonicalBytes({
    schema: intent.schema,
    repository: intent.repository,
    deviceId: intent.deviceId,
    devicePublicKeyJwk: intent.devicePublicKeyJwk,
    authorityCredentialId: intent.authorityCredentialId,
    authorRegistrySequence: intent.authorRegistrySequence,
    issuedAt: intent.issuedAt,
    nonce: intent.nonce,
    validity: intent.validity,
    capability: intent.capability,
  });
}

export function canonicalDeviceProposalIntentBytes(intent: DeviceProposalIntent): Uint8Array {
  return canonicalBytes({
    schema: intent.schema,
    proposalId: intent.proposalId,
    repository: intent.repository,
    baseRef: intent.baseRef,
    baseSha: intent.baseSha,
    createdAt: intent.createdAt,
    expiresAt: intent.expiresAt,
    nonce: intent.nonce,
    patchDigest: intent.patchDigest,
    deviceId: intent.deviceId,
    delegationDigest: intent.delegationDigest,
  });
}
