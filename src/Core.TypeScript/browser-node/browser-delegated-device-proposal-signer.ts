import {
  canonicalDeviceDelegationIntentBytes,
  canonicalDeviceProposalIntentBytes,
  canonicalDevicePublicKeyBytes,
  DEVICE_DELEGATION_SCHEMA,
  DEVICE_PROPOSAL_BASE_REF,
  DEVICE_PROPOSAL_BRANCH_PREFIX,
  DEVICE_PROPOSAL_HARD_MAX_PATCH_BYTES,
  DEVICE_PROPOSAL_MAX_LIFETIME_MS,
  DEVICE_PROPOSAL_PATH_POLICY,
  DEVICE_PROPOSAL_REPOSITORY,
  DEVICE_PROPOSAL_SCHEMA,
  DEVICE_PROPOSAL_SUBMISSION_SCHEMA,
  deviceBytesToBase64url,
  deviceBytesToHex,
  deviceProposalIdFromBytes,
  type DelegatedDeviceProposalSubmission,
  type DeviceDelegationIntent,
  type DevicePublicKeyJwk,
  type SignedDeviceDelegation,
} from "../planning/delegated-device-proposal-contract";
import type { WebAuthnAssertion } from "../planning/proposal-contract";

export interface BrowserDelegatedDeviceProposalFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "device-proposal-configuration-invalid"
    | "device-proposal-key-unavailable"
    | "device-proposal-passkey-refused"
    | "device-proposal-signing-refused";
  readonly detail: string;
}

export type BrowserDelegatedDeviceProposalResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDelegatedDeviceProposalFeedback };

export interface BrowserProposalDeviceKey {
  readonly deviceId: string;
  readonly publicKeyJwk: DevicePublicKeyJwk;
  sign(bytes: Uint8Array): Promise<BrowserDelegatedDeviceProposalResult<string>>;
}

export interface BrowserProposalDeviceKeyPort {
  loadOrCreate(): Promise<BrowserDelegatedDeviceProposalResult<BrowserProposalDeviceKey>>;
}

export interface BrowserProposalDigestPort {
  sha256(bytes: Uint8Array): Promise<BrowserDelegatedDeviceProposalResult<Uint8Array>>;
  randomBytes(length: number): BrowserDelegatedDeviceProposalResult<Uint8Array>;
}

export interface BrowserProposalPasskeyAuthorityPort {
  assert(input: {
    readonly credentialId: string;
    readonly challenge: Uint8Array;
  }): Promise<BrowserDelegatedDeviceProposalResult<WebAuthnAssertion>>;
}

export interface BrowserDelegatedDeviceProposalSigner {
  authorizeFromUserActivation(input: {
    readonly authorityCredentialId: string;
    readonly authorRegistrySequence: number;
    readonly maxPatchBytes: number;
  }): Promise<BrowserDelegatedDeviceProposalResult<SignedDeviceDelegation>>;
  sign(input: {
    readonly delegation: SignedDeviceDelegation;
    readonly baseSha: string;
    readonly payload: string;
  }): Promise<BrowserDelegatedDeviceProposalResult<DelegatedDeviceProposalSubmission>>;
}

function failed(
  code: BrowserDelegatedDeviceProposalFeedback["code"],
  detail: string,
  severity: BrowserDelegatedDeviceProposalFeedback["severity"] = "heat",
): BrowserDelegatedDeviceProposalResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function retainedDelegation(value: SignedDeviceDelegation): boolean {
  return (
    isRecord(value) &&
    value.schema === DEVICE_DELEGATION_SCHEMA &&
    value.repository === DEVICE_PROPOSAL_REPOSITORY &&
    typeof value.deviceId === "string" &&
    /^[0-9a-f]{64}$/u.test(value.deviceId) &&
    isRecord(value.devicePublicKeyJwk) &&
    value.devicePublicKeyJwk.kty === "EC" &&
    value.devicePublicKeyJwk.crv === "P-256" &&
    typeof value.devicePublicKeyJwk.x === "string" &&
    typeof value.devicePublicKeyJwk.y === "string" &&
    value.devicePublicKeyJwk.ext === true &&
    isRecord(value.assertion) &&
    isRecord(value.capability) &&
    value.capability.action === "stage-review-branch" &&
    value.capability.baseRef === DEVICE_PROPOSAL_BASE_REF &&
    value.capability.branchPrefix === DEVICE_PROPOSAL_BRANCH_PREFIX &&
    Number.isSafeInteger(value.capability.maxPatchBytes) &&
    value.capability.maxPatchBytes > 0 &&
    value.capability.maxPatchBytes <= DEVICE_PROPOSAL_HARD_MAX_PATCH_BYTES &&
    value.capability.pathPolicy === DEVICE_PROPOSAL_PATH_POLICY
  );
}

function finiteConfiguration(options: {
  readonly now: () => number;
  readonly keys: BrowserProposalDeviceKeyPort;
  readonly digest: BrowserProposalDigestPort;
  readonly passkeys: BrowserProposalPasskeyAuthorityPort;
}): boolean {
  return (
    typeof options.now === "function" &&
    typeof options.keys.loadOrCreate === "function" &&
    typeof options.digest.sha256 === "function" &&
    typeof options.digest.randomBytes === "function" &&
    typeof options.passkeys.assert === "function"
  );
}

async function sha256Hex(
  digest: BrowserProposalDigestPort,
  bytes: Uint8Array,
): Promise<BrowserDelegatedDeviceProposalResult<string>> {
  const result = await digest.sha256(bytes);
  if (!result.ok) return result;
  return result.value.byteLength === 32
    ? { ok: true, value: deviceBytesToHex(result.value) }
    : failed("device-proposal-signing-refused", "The browser returned a non-SHA-256 digest length.");
}

function randomValue(
  digest: BrowserProposalDigestPort,
  length: number,
): BrowserDelegatedDeviceProposalResult<Uint8Array> {
  const result = digest.randomBytes(length);
  return result.ok && result.value.byteLength === length
    ? result
    : failed("device-proposal-signing-refused", "The browser returned the wrong amount of proposal entropy.");
}

/** Build the browser-owned one-time delegation and unattended device-signing service. */
export function createBrowserDelegatedDeviceProposalSigner(options: {
  readonly now: () => number;
  readonly keys: BrowserProposalDeviceKeyPort;
  readonly digest: BrowserProposalDigestPort;
  readonly passkeys: BrowserProposalPasskeyAuthorityPort;
}): BrowserDelegatedDeviceProposalResult<BrowserDelegatedDeviceProposalSigner> {
  if (!finiteConfiguration(options)) {
    return failed(
      "device-proposal-configuration-invalid",
      "Device proposal signing requires injected time, entropy, digest, device-key custody, and passkey authority ports.",
    );
  }

  return {
    ok: true,
    value: {
      async authorizeFromUserActivation(input) {
        const now = options.now();
        if (
          input.authorityCredentialId.length < 1 ||
          input.authorityCredentialId.length > 4096 ||
          !Number.isSafeInteger(input.authorRegistrySequence) ||
          input.authorRegistrySequence < 0 ||
          !Number.isSafeInteger(input.maxPatchBytes) ||
          input.maxPatchBytes < 1 ||
          input.maxPatchBytes > DEVICE_PROPOSAL_HARD_MAX_PATCH_BYTES ||
          !Number.isFinite(now)
        ) {
          return failed(
            "device-proposal-configuration-invalid",
            "Device authorization requires one registered passkey, a finite registry sequence, and a patch cap no greater than 32 KiB.",
          );
        }
        const key = await options.keys.loadOrCreate();
        if (!key.ok) return key;
        const keyDigest = await sha256Hex(options.digest, canonicalDevicePublicKeyBytes(key.value.publicKeyJwk));
        if (!keyDigest.ok) return keyDigest;
        if (keyDigest.value !== key.value.deviceId) {
          return failed("device-proposal-key-unavailable", "The device key ID differs from its public-key digest.");
        }
        const nonce = randomValue(options.digest, 32);
        if (!nonce.ok) return nonce;
        const intent: DeviceDelegationIntent = {
          schema: DEVICE_DELEGATION_SCHEMA,
          repository: DEVICE_PROPOSAL_REPOSITORY,
          deviceId: key.value.deviceId,
          devicePublicKeyJwk: key.value.publicKeyJwk,
          authorityCredentialId: input.authorityCredentialId,
          authorRegistrySequence: input.authorRegistrySequence,
          issuedAt: new Date(now).toISOString(),
          nonce: deviceBytesToBase64url(nonce.value),
          validity: "until-authority-revoked",
          capability: {
            action: "stage-review-branch",
            baseRef: DEVICE_PROPOSAL_BASE_REF,
            branchPrefix: DEVICE_PROPOSAL_BRANCH_PREFIX,
            maxPatchBytes: input.maxPatchBytes,
            pathPolicy: DEVICE_PROPOSAL_PATH_POLICY,
          },
        };
        let canonicalIntent: Uint8Array;
        try {
          canonicalIntent = canonicalDeviceDelegationIntentBytes(intent);
        } catch {
          return failed("device-proposal-signing-refused", "The browser could not canonicalize device authority.");
        }
        const challenge = await options.digest.sha256(canonicalIntent);
        if (!challenge.ok) return challenge;
        const assertion = await options.passkeys.assert({
          credentialId: input.authorityCredentialId,
          challenge: challenge.value,
        });
        if (!assertion.ok) return assertion;
        if (assertion.value.credentialId !== input.authorityCredentialId) {
          return failed("device-proposal-passkey-refused", "The browser used a different passkey credential.");
        }
        return { ok: true, value: Object.freeze({ ...intent, assertion: Object.freeze(assertion.value) }) };
      },

      async sign(input) {
        if (!retainedDelegation(input.delegation)) {
          return failed(
            "device-proposal-signing-refused",
            "The retained browser delegation is malformed; authorize the device again.",
            "backpressure",
          );
        }
        const key = await options.keys.loadOrCreate();
        if (!key.ok) return key;
        if (key.value.deviceId !== input.delegation.deviceId) {
          return failed(
            "device-proposal-key-unavailable",
            "The retained device key does not match the passkey-authorized delegation.",
            "backpressure",
          );
        }
        if (
          !/^[0-9a-f]{40}$/u.test(input.baseSha) ||
          input.payload.trim().length === 0 ||
          new TextEncoder().encode(input.payload).byteLength > input.delegation.capability.maxPatchBytes
        ) {
          return failed(
            "device-proposal-signing-refused",
            "A delegated proposal requires current main, a non-empty exact patch, and bytes within the authorized cap.",
            "backpressure",
          );
        }
        const proposalEntropy = randomValue(options.digest, 16);
        const nonce = randomValue(options.digest, 32);
        if (!proposalEntropy.ok) return proposalEntropy;
        if (!nonce.ok) return nonce;
        const proposalId = deviceProposalIdFromBytes(proposalEntropy.value);
        if (proposalId === null) {
          return failed("device-proposal-signing-refused", "The browser returned invalid proposal identifier entropy.");
        }
        const patchDigest = await sha256Hex(options.digest, new TextEncoder().encode(input.payload.trim()));
        if (!patchDigest.ok) return patchDigest;
        let canonicalDelegation: Uint8Array;
        try {
          canonicalDelegation = canonicalDeviceDelegationIntentBytes(input.delegation);
        } catch {
          return failed("device-proposal-signing-refused", "The browser could not canonicalize retained authority.");
        }
        const delegationDigest = await sha256Hex(options.digest, canonicalDelegation);
        if (!delegationDigest.ok) return delegationDigest;
        const createdAt = options.now();
        if (!Number.isFinite(createdAt)) {
          return failed("device-proposal-signing-refused", "The browser returned a non-finite proposal time.");
        }
        const proposal = {
          schema: DEVICE_PROPOSAL_SCHEMA,
          proposalId,
          repository: DEVICE_PROPOSAL_REPOSITORY,
          baseRef: DEVICE_PROPOSAL_BASE_REF,
          baseSha: input.baseSha,
          createdAt: new Date(createdAt).toISOString(),
          expiresAt: new Date(createdAt + DEVICE_PROPOSAL_MAX_LIFETIME_MS).toISOString(),
          nonce: deviceBytesToBase64url(nonce.value),
          patchDigest: patchDigest.value,
          deviceId: key.value.deviceId,
          delegationDigest: delegationDigest.value,
        } as const;
        let canonicalProposal: Uint8Array;
        try {
          canonicalProposal = canonicalDeviceProposalIntentBytes(proposal);
        } catch {
          return failed("device-proposal-signing-refused", "The browser could not canonicalize the proposal.");
        }
        const signature = await key.value.sign(canonicalProposal);
        if (!signature.ok) return signature;
        return {
          ok: true,
          value: Object.freeze({
            schema: DEVICE_PROPOSAL_SUBMISSION_SCHEMA,
            delegation: input.delegation,
            proposal: Object.freeze({ ...proposal, signature: signature.value }),
            payload: input.payload,
          }),
        };
      },
    },
  };
}
