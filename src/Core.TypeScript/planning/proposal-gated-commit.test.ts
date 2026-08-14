import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { createProposalIntent, proposalChallenge, toBase64url, type SignedProposal } from "./proposal-envelope";
import { planGatedCommit, PROPOSAL_ISSUE_MARKER, type ProposalCarrier } from "./proposal-gated-commit";
import type { ProposalAuthorRegistry } from "./proposal-verifier";

const NOW = new Date("2026-08-13T20:00:00.000Z");
const BASE_SHA = "b".repeat(40);
const CREDENTIAL_ID = toBase64url(Buffer.alloc(32, 9));
const REGISTRY_SEQUENCE = 1;
const PATCH =
  "diff --git a/docs/research/example.md b/docs/research/example.md\nindex 1111111..2222222 100644\n--- a/docs/research/example.md\n+++ b/docs/research/example.md\n@@ -1 +1 @@\n-old\n+new\n";

function fixture(payload = PATCH): { carrier: ProposalCarrier; registry: ProposalAuthorRegistry } {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const proposalIntent = createProposalIntent({
    baseSha: BASE_SHA,
    payload,
    authorCredentialId: CREDENTIAL_ID,
    authorRegistrySequence: REGISTRY_SEQUENCE,
    now: NOW,
  });
  const authData = Buffer.alloc(37);
  createHash("sha256").update("lucent-financial-group.github.io").digest().copy(authData, 0);
  authData[32] = 0x05;
  const clientData = Buffer.from(
    JSON.stringify({
      type: "webauthn.get",
      challenge: toBase64url(proposalChallenge(proposalIntent)),
      origin: "https://lucent-financial-group.github.io",
    }),
  );
  const signature = sign(
    "sha256",
    Buffer.concat([authData, createHash("sha256").update(clientData).digest()]),
    privateKey,
  );
  const proposal: SignedProposal = {
    ...proposalIntent,
    assertion: {
      credentialId: CREDENTIAL_ID,
      authenticatorData: toBase64url(authData),
      clientDataJSON: toBase64url(clientData),
      signature: toBase64url(signature),
    },
  };
  return {
    carrier: { payload, proposal },
    registry: {
      schema: "zeta.proposal-author-registry.v2",
      repository: "Lucent-Financial-Group/Zeta",
      sequence: REGISTRY_SEQUENCE,
      issuedAt: "2026-08-13T19:55:00.000Z",
      authors: [
        {
          credentialId: CREDENTIAL_ID,
          origin: "https://lucent-financial-group.github.io",
          rpId: "lucent-financial-group.github.io",
          publicKeyJwk: publicKey.export({ format: "jwk" }),
        },
      ],
      revoked: {},
    },
  };
}

function issueBody(carrier: ProposalCarrier): string {
  return `${PROPOSAL_ISSUE_MARKER}\n\n## Requested change\n\n${carrier.payload}\n## Signed proposal envelope\n\n\`\`\`json\n${JSON.stringify(carrier.proposal)}\n\`\`\`\n`;
}

describe("passkey proposal gated-commit planner", () => {
  test("PGC-1: valid signed unified patch produces a non-main branch plan", () => {
    const { carrier, registry } = fixture();
    const result = planGatedCommit({ issueBody: issueBody(carrier), currentMainSha: BASE_SHA, registry, now: NOW });
    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.branch).toStartWith("heartbeat/proposal-");
      expect(result.branch).not.toBe("main");
      expect(result.commitMessage).toContain("change-digest:");
    }
  });

  test("PGC-2 FAULT INJECTION: free-form instructions cannot masquerade as an executable patch", () => {
    const { carrier, registry } = fixture("Please improve the protocol.");
    const result = planGatedCommit({ issueBody: issueBody(carrier), currentMainSha: BASE_SHA, registry, now: NOW });
    expect(result).toMatchObject({
      ok: false,
      code: "patch",
      retraction: { weight: -1 },
      generator: "git diff --binary",
    });
  });

  test("PGC-3 FAULT INJECTION: workflow authority cannot be changed through this path", () => {
    const protectedPatch = PATCH.replaceAll("docs/research/example.md", ".github/workflows/gate.yml");
    const { carrier, registry } = fixture(protectedPatch);
    const result = planGatedCommit({ issueBody: issueBody(carrier), currentMainSha: BASE_SHA, registry, now: NOW });
    expect(result).toMatchObject({
      ok: false,
      code: "patch",
      retraction: { weight: -1 },
      generator: "maintainer-reviewed-pr",
    });
  });

  test("PGC-4 FAULT INJECTION: main advancing after signature rejects the stale proposal", () => {
    const { carrier, registry } = fixture();
    const result = planGatedCommit({
      issueBody: issueBody(carrier),
      currentMainSha: "c".repeat(40),
      registry,
      now: NOW,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "stale-base",
      retraction: { weight: -1 },
      generator: "bindCurrentMainAndSign",
    });
  });

  test("PGC-5 FAULT INJECTION: a proposal cannot rewrite its own verifier", () => {
    const protectedPatch = PATCH.replaceAll(
      "docs/research/example.md",
      "src/Core.TypeScript/planning/proposal-verifier.ts",
    );
    const { carrier, registry } = fixture(protectedPatch);
    const result = planGatedCommit({ issueBody: issueBody(carrier), currentMainSha: BASE_SHA, registry, now: NOW });
    expect(result).toMatchObject({
      ok: false,
      code: "patch",
      retraction: { weight: -1 },
      generator: "maintainer-reviewed-pr",
    });
  });

  test("PGC-6 FAULT INJECTION: an unrecognized second Git header cannot hide behind a valid path", () => {
    const ambiguous = `${PATCH}diff --git \"a/docs/research/hidden file.md\" \"b/docs/research/hidden file.md\"\n`;
    const { carrier, registry } = fixture(ambiguous);
    const result = planGatedCommit({ issueBody: issueBody(carrier), currentMainSha: BASE_SHA, registry, now: NOW });
    expect(result).toMatchObject({
      ok: false,
      code: "patch",
      retraction: { weight: -1 },
      generator: "git diff --binary",
    });
  });
});
