import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { encode } from "cborg";
import {
  canonicalProposalIntent,
  createProposalIntent,
  proposalChallenge,
  toBase64url,
  type SignedProposal,
} from "./proposal-envelope";
import { canonicalProposalIntent as canonicalBrowserProposalIntent } from "../../../demo/identity-dla-site/src/lib/passkeyProposal";
import type { ProposalPasskeyEnrollment } from "./proposal-contract";
import {
  publicKeyJwkFromEnrollment,
  verifyProposalPasskeyEnrollment,
  verifySignedProposal,
  type ProposalAuthorRegistry,
} from "./proposal-verifier";

const ORIGIN = "https://lucent-financial-group.github.io";
const RP_ID = "lucent-financial-group.github.io";
const NOW = new Date("2026-08-13T20:00:00.000Z");
const BASE_SHA = "a".repeat(40);
const PAYLOAD = "Change docs/research/example.md with a reviewed protocol clarification.";
const CREDENTIAL_ID = toBase64url(Buffer.alloc(32, 7));
const REGISTRY_SEQUENCE = 1;

function clientData(intent: ReturnType<typeof createProposalIntent>, origin = ORIGIN): Buffer {
  return Buffer.from(
    JSON.stringify({
      type: "webauthn.get",
      challenge: toBase64url(proposalChallenge(intent)),
      origin,
    }),
  );
}

function authenticatorData(rpId = RP_ID, flags = 0x05): Buffer {
  const output = Buffer.alloc(37);
  createHash("sha256").update(rpId).digest().copy(output, 0);
  output[32] = flags;
  output.writeUInt32BE(1, 33);
  return output;
}

function enrollmentFixture(input?: {
  readonly rpId?: string;
  readonly flags?: number;
  readonly clientOrigin?: string;
}): { readonly enrollment: ProposalPasskeyEnrollment; readonly x: Buffer; readonly y: Buffer } {
  const credentialId = Buffer.alloc(32, 3);
  const challenge = Buffer.alloc(32, 9);
  const x = Buffer.alloc(32, 4);
  const y = Buffer.alloc(32, 5);
  const cose = encode(
    new Map<unknown, unknown>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, x],
      [-3, y],
    ]),
  );
  const authData = Buffer.alloc(55 + credentialId.length + cose.length);
  createHash("sha256")
    .update(input?.rpId ?? RP_ID)
    .digest()
    .copy(authData, 0);
  authData[32] = input?.flags ?? 0x45;
  authData.writeUInt32BE(1, 33);
  authData.writeUInt16BE(credentialId.length, 53);
  credentialId.copy(authData, 55);
  Buffer.from(cose).copy(authData, 55 + credentialId.length);
  const attestation = encode(
    new Map<unknown, unknown>([
      ["fmt", "none"],
      ["attStmt", new Map()],
      ["authData", authData],
    ]),
  );
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: "webauthn.create",
      challenge: toBase64url(challenge),
      origin: input?.clientOrigin ?? ORIGIN,
      crossOrigin: false,
    }),
  );
  return {
    enrollment: {
      schema: "zeta.proposal-passkey-enrollment.v1",
      repository: "Lucent-Financial-Group/Zeta",
      credentialId: toBase64url(credentialId),
      challenge: toBase64url(challenge),
      clientDataJSON: toBase64url(clientDataJSON),
      attestationObject: toBase64url(Buffer.from(attestation)),
      origin: ORIGIN,
      rpId: RP_ID,
      createdAt: NOW.toISOString(),
    },
    x,
    y,
  };
}

function fixture(): { proposal: SignedProposal; registry: ProposalAuthorRegistry } {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const intent = createProposalIntent({
    baseSha: BASE_SHA,
    payload: PAYLOAD,
    authorCredentialId: CREDENTIAL_ID,
    authorRegistrySequence: REGISTRY_SEQUENCE,
    now: NOW,
  });
  const authData = authenticatorData();
  const clientBytes = clientData(intent);
  const signedBytes = Buffer.concat([authData, createHash("sha256").update(clientBytes).digest()]);
  const signature = sign("sha256", signedBytes, privateKey);
  const proposal: SignedProposal = {
    ...intent,
    assertion: {
      credentialId: CREDENTIAL_ID,
      authenticatorData: toBase64url(authData),
      clientDataJSON: toBase64url(clientBytes),
      signature: toBase64url(signature),
    },
  };
  const registry: ProposalAuthorRegistry = {
    schema: "zeta.proposal-author-registry.v2",
    repository: "Lucent-Financial-Group/Zeta",
    sequence: REGISTRY_SEQUENCE,
    issuedAt: "2026-08-13T19:55:00.000Z",
    authors: [
      {
        credentialId: CREDENTIAL_ID,
        origin: ORIGIN,
        rpId: RP_ID,
        publicKeyJwk: publicKey.export({ format: "jwk" }),
      },
    ],
    revoked: {},
  };
  return { proposal, registry };
}

describe("passkey proposal verifier", () => {
  test("PPV-1: verifies a user-verified ES256 assertion bound to the canonical immutable proposal", () => {
    const { proposal, registry } = fixture();
    const result = verifySignedProposal({ proposal, payload: PAYLOAD, registry, now: NOW });
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.proposal.baseSha).toBe(BASE_SHA);
      expect(result.canonicalIntent).toContain('"repository":"Lucent-Financial-Group/Zeta"');
      expect(canonicalBrowserProposalIntent(result.proposal)).toBe(canonicalProposalIntent(result.proposal));
    }
  });

  test("PPV-2 FAULT INJECTION: an unregistered passkey becomes an enrollment teaching error", () => {
    const { proposal, registry } = fixture();
    const result = verifySignedProposal({
      proposal,
      payload: PAYLOAD,
      registry: { ...registry, authors: [] },
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "unknown-author",
      retraction: { weight: -1 },
      generator: "enrollProposalPasskey",
    });
  });

  test("PPV-3 FAULT INJECTION: a stale envelope is rejected even when its cryptographic shape is intact", () => {
    const { proposal, registry } = fixture();
    const expired = { ...proposal, expiresAt: "2026-08-13T19:59:00.000Z" };
    const result = verifySignedProposal({ proposal: expired, payload: PAYLOAD, registry, now: NOW });
    expect(result).toMatchObject({
      ok: false,
      code: "time",
      retraction: { weight: -1 },
      generator: "createProposalIntent",
    });
  });

  test("PPV-4 FAULT INJECTION: a consumed nonce cannot be replayed as another action", () => {
    const { proposal, registry } = fixture();
    const result = verifySignedProposal({
      proposal,
      payload: PAYLOAD,
      registry,
      consumedNonces: new Set([proposal.nonce]),
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "replay",
      retraction: { weight: -1 },
      generator: "createProposalIntent",
    });
  });

  test("PPV-5 FAULT INJECTION: a repository substitution is rejected before any key operation", () => {
    const { proposal, registry } = fixture();
    const wrongRepository = { ...proposal, repository: "attacker/other" } as unknown as SignedProposal;
    const result = verifySignedProposal({ proposal: wrongRepository, payload: PAYLOAD, registry, now: NOW });
    expect(result).toMatchObject({
      ok: false,
      code: "repository",
      retraction: { weight: -1 },
      generator: "createProposalIntent",
    });
  });

  test("PPV-6 FAULT INJECTION: changing the GitHub Pages origin invalidates the relying-party boundary", () => {
    const { proposal, registry } = fixture();
    const changedClientData = clientData(proposal, "https://evil.example");
    const wrongOrigin: SignedProposal = {
      ...proposal,
      assertion: { ...proposal.assertion, clientDataJSON: toBase64url(changedClientData) },
    };
    const result = verifySignedProposal({ proposal: wrongOrigin, payload: PAYLOAD, registry, now: NOW });
    expect(result).toMatchObject({ ok: false, code: "origin", retraction: { weight: -1 }, generator: "signProposal" });
  });

  test("PPV-7 FAULT INJECTION: a forged assertion signature is not accepted", () => {
    const { proposal, registry } = fixture();
    const forged: SignedProposal = {
      ...proposal,
      assertion: { ...proposal.assertion, signature: toBase64url(Buffer.from("forged")) },
    };
    const result = verifySignedProposal({ proposal: forged, payload: PAYLOAD, registry, now: NOW });
    expect(result).toMatchObject({
      ok: false,
      code: "assertion-signature",
      retraction: { weight: -1 },
      generator: "signProposal",
    });
  });

  test("PPV-8 FAULT INJECTION: modifying requested change text after signing is detected", () => {
    const { proposal, registry } = fixture();
    const result = verifySignedProposal({ proposal, payload: `${PAYLOAD}\nInjected edit.`, registry, now: NOW });
    expect(result).toMatchObject({
      ok: false,
      code: "change-digest",
      retraction: { weight: -1 },
      generator: "createProposalIntent",
    });
  });

  test("PPV-9: extracts an ES256 P-256 public key from an enrollment package before registry approval", () => {
    const credentialId = Buffer.alloc(32, 3);
    const x = Buffer.alloc(32, 4);
    const y = Buffer.alloc(32, 5);
    const cose = encode(
      new Map<unknown, unknown>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, x],
        [-3, y],
      ]),
    );
    const authData = Buffer.alloc(55 + credentialId.length + cose.length);
    authData[32] = 0x41;
    authData.writeUInt16BE(credentialId.length, 53);
    credentialId.copy(authData, 55);
    Buffer.from(cose).copy(authData, 55 + credentialId.length);
    const attestation = encode(
      new Map<unknown, unknown>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    const jwk = publicKeyJwkFromEnrollment({
      credentialId: toBase64url(credentialId),
      attestationObject: toBase64url(Buffer.from(attestation)),
    });
    expect(jwk).toEqual({ kty: "EC", crv: "P-256", x: toBase64url(x), y: toBase64url(y), ext: true });
  });

  test("PPV-10 FAULT INJECTION: an older registry cannot verify an envelope bound to a newer sequence", () => {
    const { proposal, registry } = fixture();
    const result = verifySignedProposal({
      proposal,
      payload: PAYLOAD,
      registry: { ...registry, sequence: 0 },
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "registry-sequence",
      retraction: { weight: -1 },
      generator: "bindCurrentMainAndSign",
    });
  });

  test("PPV-11 FAULT INJECTION: a revoked passkey is rejected even while its signature remains valid", () => {
    const { proposal, registry } = fixture();
    const result = verifySignedProposal({
      proposal,
      payload: PAYLOAD,
      registry: { ...registry, revoked: { [CREDENTIAL_ID]: { at: "2026-08-13T19:58:00.000Z", reason: "rotated" } } },
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "revoked-author",
      retraction: { weight: -1 },
      generator: "enrollProposalPasskey",
    });
  });

  test("PPV-12 FAULT INJECTION: proposal identity cannot become a branch or receipt path", () => {
    const { proposal, registry } = fixture();
    const result = verifySignedProposal({
      proposal: { ...proposal, proposalId: "../../authority" },
      payload: PAYLOAD,
      registry,
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "proposal-id",
      retraction: { weight: -1 },
      generator: "createProposalIntent",
    });
  });

  test("PPV-13 FAULT INJECTION: a signer cannot extend an envelope beyond the five-minute verifier bound", () => {
    const { proposal, registry } = fixture();
    const result = verifySignedProposal({
      proposal: { ...proposal, expiresAt: "2026-08-13T20:06:00.000Z" },
      payload: PAYLOAD,
      registry,
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "time",
      retraction: { weight: -1 },
      generator: "createProposalIntent",
    });
  });

  test("PPV-14 FAULT INJECTION: a cross-origin iframe assertion is not an accepted client-data record", () => {
    const { proposal, registry } = fixture();
    const encoded = toBase64url(
      Buffer.from(
        JSON.stringify({
          type: "webauthn.get",
          challenge: toBase64url(proposalChallenge(proposal)),
          origin: ORIGIN,
          crossOrigin: true,
        }),
      ),
    );
    const result = verifySignedProposal({
      proposal: { ...proposal, assertion: { ...proposal.assertion, clientDataJSON: encoded } },
      payload: PAYLOAD,
      registry,
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "client-data",
      retraction: { weight: -1 },
      generator: "signProposal",
    });
  });

  test("PPV-15: independently verifies a registration package into the exact public registry entry", () => {
    const fixture = enrollmentFixture();

    expect(verifyProposalPasskeyEnrollment(fixture.enrollment, NOW)).toEqual({
      ok: true,
      enrollment: fixture.enrollment,
      author: {
        credentialId: fixture.enrollment.credentialId,
        origin: ORIGIN,
        rpId: RP_ID,
        publicKeyJwk: {
          kty: "EC",
          crv: "P-256",
          x: toBase64url(fixture.x),
          y: toBase64url(fixture.y),
          ext: true,
        },
      },
    });
  });

  test("PPV-16 FAULT INJECTION: enrollment substitutions do not become registry authors", () => {
    const fixture = enrollmentFixture();
    const changedChallenge = verifyProposalPasskeyEnrollment(
      { ...fixture.enrollment, challenge: toBase64url(Buffer.alloc(32, 10)) },
      NOW,
    );
    const changedCredential = verifyProposalPasskeyEnrollment(
      { ...fixture.enrollment, credentialId: toBase64url(Buffer.alloc(32, 10)) },
      NOW,
    );
    const changedOrigin = verifyProposalPasskeyEnrollment(
      enrollmentFixture({ clientOrigin: "https://evil.example" }).enrollment,
      NOW,
    );
    const changedRpId = verifyProposalPasskeyEnrollment(enrollmentFixture({ rpId: "evil.example" }).enrollment, NOW);
    const missingVerification = verifyProposalPasskeyEnrollment(enrollmentFixture({ flags: 0x41 }).enrollment, NOW);

    expect(changedChallenge).toMatchObject({ ok: false, code: "challenge" });
    expect(changedCredential).toMatchObject({ ok: false, code: "credential-mismatch" });
    expect(changedOrigin).toMatchObject({ ok: false, code: "origin" });
    expect(changedRpId).toMatchObject({ ok: false, code: "rp-id" });
    expect(missingVerification).toMatchObject({ ok: false, code: "user-verification" });
  });
});
