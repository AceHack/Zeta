import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import {
  canonicalDeviceProposalIntent,
  deviceDelegationChallenge,
  deviceDelegationDigest,
  deviceIdForPublicKey,
  type DelegatedDeviceProposalSubmission,
  type DeviceDelegationIntent,
  type DevicePublicKeyJwk,
  type SignedDeviceDelegation,
  type SignedDeviceProposal,
} from "./delegated-device-proposal";
import { toBase64url } from "./proposal-envelope";
import type { ProposalAuthorRegistry } from "./proposal-verifier";

/**
 * Shared test fixture for the delegated-device proposal path.
 *
 * Extracted from `delegated-device-proposal.test.ts` so the runner's receipt tests can build a
 * genuine, fully-signed delegated submission rather than a hand-written stand-in. Every key here
 * is generated per call, so tests that need two *unrelated* delegations just call `fixture()`
 * twice.
 *
 * **Caution — two `fixture()` calls differ in everything.** Fresh keypairs mean fresh device IDs,
 * so any two fixtures have different delegation digests no matter what else you vary. A test that
 * wants to show some *specific* field is covered by the digest must vary that one field off a
 * single fixture (see PGCR-6); comparing two whole fixtures proves only that the keys differed.
 * The first draft of PGCR-6 made exactly this mistake and survived the mutant that drops
 * `capability` from `canonicalDeviceDelegationIntentBytes`.
 */

export const FIXTURE_ORIGIN = "https://lucent-financial-group.github.io";
export const FIXTURE_RP_ID = "lucent-financial-group.github.io";
export const FIXTURE_BASE_SHA = "a".repeat(40);
export const FIXTURE_NOW = new Date("2026-08-14T14:00:00.000Z");
export const FIXTURE_ROOT_CREDENTIAL_ID = toBase64url(Buffer.alloc(32, 11));
export const FIXTURE_REGISTRY_SEQUENCE = 1;
export const FIXTURE_PATCH =
  "diff --git a/docs/example.md b/docs/example.md\n--- a/docs/example.md\n+++ b/docs/example.md\n@@ -1 +1 @@\n-old\n+new\n";

function authenticatorData(): Buffer {
  const output = Buffer.alloc(37);
  createHash("sha256").update(FIXTURE_RP_ID).digest().copy(output, 0);
  output[32] = 0x05;
  output.writeUInt32BE(1, 33);
  return output;
}

function deviceKey(value: JsonWebKey): DevicePublicKeyJwk {
  if (value.kty !== "EC" || value.crv !== "P-256" || typeof value.x !== "string" || typeof value.y !== "string") {
    throw new Error("test generated a non-P-256 public key");
  }
  return { kty: "EC", crv: "P-256", x: value.x, y: value.y, ext: true };
}

export interface DelegatedDeviceFixture {
  readonly submission: DelegatedDeviceProposalSubmission;
  readonly registry: ProposalAuthorRegistry;
  readonly devicePrivateKey: KeyObject;
}

export function fixture(): DelegatedDeviceFixture {
  const root = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const device = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicDeviceKey = deviceKey(device.publicKey.export({ format: "jwk" }));
  const delegationIntent: DeviceDelegationIntent = {
    schema: "zeta.proposal-device-delegation.v1",
    repository: "Lucent-Financial-Group/Zeta",
    deviceId: deviceIdForPublicKey(publicDeviceKey),
    devicePublicKeyJwk: publicDeviceKey,
    authorityCredentialId: FIXTURE_ROOT_CREDENTIAL_ID,
    authorRegistrySequence: FIXTURE_REGISTRY_SEQUENCE,
    issuedAt: FIXTURE_NOW.toISOString(),
    nonce: toBase64url(Buffer.alloc(32, 12)),
    validity: "until-authority-revoked",
    capability: {
      action: "stage-review-branch",
      baseRef: "main",
      branchPrefix: "heartbeat/proposal-",
      maxPatchBytes: 16 * 1024,
      pathPolicy: "zeta.proposal-protected-paths.v1",
    },
  };
  const authData = authenticatorData();
  const clientData = Buffer.from(
    JSON.stringify({
      type: "webauthn.get",
      challenge: toBase64url(deviceDelegationChallenge(delegationIntent)),
      origin: FIXTURE_ORIGIN,
      crossOrigin: false,
    }),
  );
  const rootSignature = sign(
    "sha256",
    Buffer.concat([authData, createHash("sha256").update(clientData).digest()]),
    root.privateKey,
  );
  const delegation: SignedDeviceDelegation = {
    ...delegationIntent,
    assertion: {
      credentialId: FIXTURE_ROOT_CREDENTIAL_ID,
      authenticatorData: toBase64url(authData),
      clientDataJSON: toBase64url(clientData),
      signature: toBase64url(rootSignature),
    },
  };
  const proposalIntent: Omit<SignedDeviceProposal, "signature"> = {
    schema: "zeta.delegated-device-proposal.v1",
    proposalId: "11111111-1111-4111-8111-111111111111",
    repository: "Lucent-Financial-Group/Zeta",
    baseRef: "main",
    baseSha: FIXTURE_BASE_SHA,
    createdAt: FIXTURE_NOW.toISOString(),
    expiresAt: new Date(FIXTURE_NOW.getTime() + 5 * 60_000).toISOString(),
    nonce: toBase64url(Buffer.alloc(32, 13)),
    patchDigest: createHash("sha256").update(FIXTURE_PATCH.trim()).digest("hex"),
    deviceId: delegation.deviceId,
    delegationDigest: deviceDelegationDigest(delegation),
  };
  const deviceSignature = sign("sha256", Buffer.from(canonicalDeviceProposalIntent(proposalIntent), "utf8"), {
    key: device.privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const proposal: SignedDeviceProposal = { ...proposalIntent, signature: toBase64url(deviceSignature) };
  return {
    devicePrivateKey: device.privateKey,
    submission: {
      schema: "zeta.delegated-device-submission.v1",
      delegation,
      proposal,
      payload: FIXTURE_PATCH,
    },
    registry: {
      schema: "zeta.proposal-author-registry.v2",
      repository: "Lucent-Financial-Group/Zeta",
      sequence: FIXTURE_REGISTRY_SEQUENCE,
      issuedAt: "2026-08-14T13:55:00.000Z",
      authors: [
        {
          credentialId: FIXTURE_ROOT_CREDENTIAL_ID,
          origin: FIXTURE_ORIGIN,
          rpId: FIXTURE_RP_ID,
          publicKeyJwk: root.publicKey.export({ format: "jwk" }),
        },
      ],
      revoked: {},
    },
  };
}
