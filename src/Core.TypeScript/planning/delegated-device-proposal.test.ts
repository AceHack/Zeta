import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  canonicalDeviceProposalIntent,
  decodeDelegatedDeviceProposalIssueBody,
  deviceDelegationChallenge,
  deviceDelegationDigest,
  deviceIdForPublicKey,
  encodeDelegatedDeviceProposalIssueBody,
  verifyDelegatedDeviceProposal,
  type DelegatedDeviceProposalSubmission,
  type DeviceDelegationIntent,
  type DevicePublicKeyJwk,
  type SignedDeviceDelegation,
  type SignedDeviceProposal,
} from "./delegated-device-proposal";
import { toBase64url } from "./proposal-envelope";
import type { ProposalAuthorRegistry } from "./proposal-verifier";

const ORIGIN = "https://lucent-financial-group.github.io";
const RP_ID = "lucent-financial-group.github.io";
const BASE_SHA = "a".repeat(40);
const NOW = new Date("2026-08-14T14:00:00.000Z");
const ROOT_CREDENTIAL_ID = toBase64url(Buffer.alloc(32, 11));
const PATCH =
  "diff --git a/docs/example.md b/docs/example.md\n--- a/docs/example.md\n+++ b/docs/example.md\n@@ -1 +1 @@\n-old\n+new\n";

function authenticatorData(): Buffer {
  const output = Buffer.alloc(37);
  createHash("sha256").update(RP_ID).digest().copy(output, 0);
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

function fixture(): {
  readonly submission: DelegatedDeviceProposalSubmission;
  readonly registry: ProposalAuthorRegistry;
  readonly devicePrivateKey: KeyObject;
} {
  const root = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const device = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicDeviceKey = deviceKey(device.publicKey.export({ format: "jwk" }));
  const delegationIntent: DeviceDelegationIntent = {
    schema: "zeta.proposal-device-delegation.v1",
    repository: "Lucent-Financial-Group/Zeta",
    deviceId: deviceIdForPublicKey(publicDeviceKey),
    devicePublicKeyJwk: publicDeviceKey,
    authorityCredentialId: ROOT_CREDENTIAL_ID,
    authorRegistrySequence: 1,
    issuedAt: NOW.toISOString(),
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
      origin: ORIGIN,
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
      credentialId: ROOT_CREDENTIAL_ID,
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
    baseSha: BASE_SHA,
    createdAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 5 * 60_000).toISOString(),
    nonce: toBase64url(Buffer.alloc(32, 13)),
    patchDigest: createHash("sha256").update(PATCH.trim()).digest("hex"),
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
      payload: PATCH,
    },
    registry: {
      schema: "zeta.proposal-author-registry.v2",
      repository: "Lucent-Financial-Group/Zeta",
      sequence: 1,
      issuedAt: "2026-08-14T13:55:00.000Z",
      authors: [
        {
          credentialId: ROOT_CREDENTIAL_ID,
          origin: ORIGIN,
          rpId: RP_ID,
          publicKeyJwk: root.publicKey.export({ format: "jwk" }),
        },
      ],
      revoked: {},
    },
  };
}

describe("delegated browser device proposals", () => {
  test("DDP-1: a passkey-authorized device stages one bounded review branch", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({ ...value, currentMainSha: BASE_SHA, now: NOW });

    expect(result).toMatchObject({
      ok: true,
      branch: "heartbeat/proposal-11111111-1111-4111-8111-111111111111",
      paths: ["docs/example.md"],
    });
  });

  test("DDP-2: the public issue carrier round-trips without carrying a GitHub credential", () => {
    const { submission } = fixture();
    const body = encodeDelegatedDeviceProposalIssueBody(submission);

    expect(body).toStartWith("<!-- zeta-delegated-device-proposal-v1 -->");
    expect(body).not.toContain("ghp_");
    expect(decodeDelegatedDeviceProposalIssueBody(body)).toEqual(submission);
  });

  test("DDP-3 FAULT INJECTION: unsigned issue spam cannot impersonate the delegated device", () => {
    const value = fixture();
    const submission = {
      ...value.submission,
      proposal: { ...value.submission.proposal, signature: toBase64url(Buffer.alloc(64)) },
    };
    const result = verifyDelegatedDeviceProposal({
      submission,
      registry: value.registry,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "device-signature", retraction: { weight: -1 } });
  });

  test("DDP-4 FAULT INJECTION: changing the patch after signing is rejected", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({
      submission: { ...value.submission, payload: `${PATCH}# injected` },
      registry: value.registry,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "device-proposal", retraction: { weight: -1 } });
  });

  test("DDP-5 FAULT INJECTION: revoking the root passkey revokes its delegated device", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: {
        ...value.registry,
        revoked: { [ROOT_CREDENTIAL_ID]: { at: NOW.toISOString(), reason: "device lost" } },
      },
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "revoked-author", retraction: { weight: -1 } });
  });

  test("DDP-6 FAULT INJECTION: stale and replayed device proposals remain inert", () => {
    const value = fixture();
    const stale = verifyDelegatedDeviceProposal({
      ...value,
      currentMainSha: "b".repeat(40),
      now: NOW,
    });
    const replay = verifyDelegatedDeviceProposal({
      ...value,
      currentMainSha: BASE_SHA,
      consumedNonces: new Set([value.submission.proposal.nonce]),
      now: NOW,
    });

    expect(stale).toMatchObject({ ok: false, code: "device-stale-base" });
    expect(replay).toMatchObject({ ok: false, code: "device-replay" });
  });

  test("DDP-7 FAULT INJECTION: device authority cannot rewrite its verifier", () => {
    const value = fixture();
    const protectedPatch = PATCH.replaceAll("docs/example.md", "src/Core.TypeScript/planning/proposal-verifier.ts");
    const proposal = {
      ...value.submission.proposal,
      patchDigest: createHash("sha256").update(protectedPatch.trim()).digest("hex"),
    };
    const signature = sign("sha256", Buffer.from(canonicalDeviceProposalIntent(proposal), "utf8"), {
      key: value.devicePrivateKey,
      dsaEncoding: "ieee-p1363",
    });
    const result = verifyDelegatedDeviceProposal({
      submission: {
        ...value.submission,
        payload: protectedPatch,
        proposal: { ...proposal, signature: toBase64url(signature) },
      },
      registry: value.registry,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "patch", generator: "maintainer-reviewed-pr" });
  });

  test("DDP-8 FAULT INJECTION: malformed carrier bytes are a typed refusal", () => {
    expect(decodeDelegatedDeviceProposalIssueBody("<!-- zeta-delegated-device-proposal-v1 -->\n\n***")).toMatchObject({
      ok: false,
      code: "device-carrier",
    });
  });

  test("DDP-9 FAULT INJECTION: a revoked browser device cannot spend an otherwise valid root delegation", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: {
        ...value.registry,
        revokedDevices: {
          [value.submission.proposal.deviceId]: { at: NOW.toISOString(), reason: "browser lost" },
        },
      },
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "device-key", retraction: { weight: -1 } });
  });

  test("DDP-10 FAULT INJECTION: device authority cannot rewrite future delegation verification", () => {
    const value = fixture();
    const protectedPatch = PATCH.replaceAll(
      "docs/example.md",
      "src/Core.TypeScript/planning/delegated-device-proposal.ts",
    );
    const proposal = {
      ...value.submission.proposal,
      patchDigest: createHash("sha256").update(protectedPatch.trim()).digest("hex"),
    };
    const signature = sign("sha256", Buffer.from(canonicalDeviceProposalIntent(proposal), "utf8"), {
      key: value.devicePrivateKey,
      dsaEncoding: "ieee-p1363",
    });
    const result = verifyDelegatedDeviceProposal({
      submission: {
        ...value.submission,
        payload: protectedPatch,
        proposal: { ...proposal, signature: toBase64url(signature) },
      },
      registry: value.registry,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "patch", generator: "maintainer-reviewed-pr" });
  });
});
