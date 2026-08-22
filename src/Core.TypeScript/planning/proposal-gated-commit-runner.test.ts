import { describe, expect, test } from "bun:test";
import {
  createGatedReviewPullRequest,
  planProposalIssue,
  proposalReceipt,
  receiptBindsDelegation,
  PROPOSAL_RECEIPT_SCHEMA,
  type HandoffExec,
} from "./proposal-gated-commit-runner";
import { deviceDelegationDigest, encodeDelegatedDeviceProposalIssueBody } from "./delegated-device-proposal";
import { fixture, FIXTURE_BASE_SHA, FIXTURE_NOW } from "./delegated-device-proposal-fixture";
import type { ProposalAuthorRegistry } from "./proposal-verifier";

const EMPTY_REGISTRY: ProposalAuthorRegistry = {
  schema: "zeta.proposal-author-registry.v2",
  repository: "Lucent-Financial-Group/Zeta",
  sequence: 1,
  issuedAt: "2026-08-14T14:00:00.000Z",
  authors: [],
  revoked: {},
};

describe("proposal gated-commit runner handoff", () => {
  test("PGCR-1: branch-to-PR handoff uses argument-safe GitHub CLI inputs and keeps the credential out of proposal arguments", () => {
    let captured:
      | { readonly command: string; readonly args: readonly string[]; readonly options: Parameters<HandoffExec>[2] }
      | undefined;
    const fakeExec: HandoffExec = (command, args, options) => {
      captured = { command, args, options };
    };
    createGatedReviewPullRequest(
      {
        token: "pr-only-secret",
        repository: "Lucent-Financial-Group/Zeta",
        branch: "heartbeat/proposal-example",
        proposalId: "example",
        issueNumber: 42,
      },
      fakeExec,
    );
    expect(captured?.command).toBe("gh");
    expect(captured?.args).toContain("heartbeat/proposal-example");
    expect(captured?.args.join(" ")).not.toContain("pr-only-secret");
    expect(captured?.args.join("\n")).toContain("Agency-Signature-Version: 1");
    expect(captured?.args.join("\n")).toContain("Co-authored-by: zeta-pages-operator <zeta-pages-operator@zeta.agents>");
    expect(captured?.options.env.GH_TOKEN).toBe("pr-only-secret");
  });

  test("PGCR-2 FAULT INJECTION: empty PR token yields a credential teaching error before a GitHub CLI invocation", () => {
    let called = false;
    const fakeExec: HandoffExec = () => {
      called = true;
    };
    expect(() =>
      createGatedReviewPullRequest(
        {
          token: "",
          repository: "Lucent-Financial-Group/Zeta",
          branch: "heartbeat/proposal-example",
          proposalId: "example",
          issueNumber: 42,
        },
        fakeExec,
      ),
    ).toThrow("Pull requests: write");
    expect(called).toBeFalse();
  });

  test("PGCR-3 FAULT INJECTION: GitHub CLI refusal returns a repairable permission teaching error", () => {
    const denied: HandoffExec = () => {
      throw new Error("403");
    };
    expect(() =>
      createGatedReviewPullRequest(
        {
          token: "pr-only-secret",
          repository: "Lucent-Financial-Group/Zeta",
          branch: "heartbeat/proposal-example",
          proposalId: "example",
          issueNumber: 42,
        },
        denied,
      ),
    ).toThrow("Pull requests: write");
  });

  test("PGCR-4: delegated-device marker routes through its fail-closed carrier decoder", () => {
    const result = planProposalIssue(
      "<!-- zeta-delegated-device-proposal-v1 -->\n\n***",
      "a".repeat(40),
      EMPTY_REGISTRY,
      new Date("2026-08-14T14:00:00.000Z"),
    );

    expect(result).toMatchObject({ ok: false, code: "device-carrier", retraction: { weight: -1 } });
  });
});

/**
 * §6.5 — the audit record must reconstruct `action → capability → descriptor → assertion`.
 *
 * Receipt v3 pinned the credential, the device and the patch digest, and stopped there: an auditor
 * reading it could not tell which capability descriptor the use ran under. v4 adds
 * `delegationDigest`, which pins `action`, `baseRef`, `branchPrefix`, `maxPatchBytes`,
 * `pathPolicy` and `validity` in 32 hex-encoded bytes.
 *
 * PGCR-7 is the test that stops the field being decoration: a receipt is only evidence if a
 * *mismatched* digest is refused by something.
 */
describe("proposal receipt pins the capability descriptor", () => {
  test("PGCR-5: a delegated plan's receipt records the descriptor digest under schema v4", () => {
    const value = fixture();
    const plan = planProposalIssue(
      encodeDelegatedDeviceProposalIssueBody(value.submission),
      FIXTURE_BASE_SHA,
      value.registry,
      FIXTURE_NOW,
    );
    expect(plan).toMatchObject({ branch: expect.stringContaining("heartbeat/proposal-") });
    if ("ok" in plan) throw new Error(`planning failed: ${JSON.stringify(plan)}`);

    const receipt = proposalReceipt(plan, "https://github.test/issues/1", FIXTURE_NOW);

    expect(receipt.schema).toBe(PROPOSAL_RECEIPT_SCHEMA);
    expect(receipt.delegationDigest).toBe(value.submission.proposal.delegationDigest);
    expect(receiptBindsDelegation(receipt, value.submission.delegation)).toBeTrue();
  });

  test("PGCR-6: the recorded digest actually discriminates the descriptor it claims to pin", () => {
    // The delegation is varied in EXACTLY ONE field — maxPatchBytes — off a single fixture, so the
    // two digests share keys, device, authority, nonce and timestamps. Anything but the capability
    // is held constant; if the digest did not cover the descriptor these would be equal and the
    // receipt would pin nothing.
    //
    // Building this from two separate fixture() calls does NOT work and is the vacuity trap: each
    // call generates fresh keypairs, so the digests would differ for reasons that have nothing to
    // do with the capability, and the test would survive a mutant that drops `capability` from
    // `canonicalDeviceDelegationIntentBytes`.
    const { submission } = fixture();
    const narrow = submission.delegation;
    const wide = { ...narrow, capability: { ...narrow.capability, maxPatchBytes: 32 * 1024 } };

    expect(narrow.capability.maxPatchBytes).not.toBe(wide.capability.maxPatchBytes);
    expect(deviceDelegationDigest(wide)).not.toBe(deviceDelegationDigest(narrow));
    expect(deviceDelegationDigest(narrow)).toBe(submission.proposal.delegationDigest);
  });

  test("PGCR-7 FAULT INJECTION: a receipt carrying a foreign delegation's digest is refused", () => {
    const mine = fixture();
    const theirs = fixture();
    const receipt = proposalReceipt(
      {
        proposalId: mine.submission.proposal.proposalId,
        baseSha: mine.submission.proposal.baseSha,
        changeDigest: mine.submission.proposal.patchDigest,
        authorityCredentialId: mine.submission.delegation.authorityCredentialId,
        authorRegistrySequence: mine.submission.delegation.authorRegistrySequence,
        nonce: mine.submission.proposal.nonce,
        deviceId: mine.submission.proposal.deviceId,
        delegationDigest: theirs.submission.proposal.delegationDigest,
      },
      "https://github.test/issues/2",
      FIXTURE_NOW,
    );

    expect(receiptBindsDelegation(receipt, mine.submission.delegation)).toBeFalse();
    expect(receiptBindsDelegation(receipt, theirs.submission.delegation)).toBeTrue();
  });

  test("PGCR-8 FAULT INJECTION: a receipt with no descriptor digest fails closed", () => {
    const value = fixture();

    expect(receiptBindsDelegation({}, value.submission.delegation)).toBeFalse();
    expect(receiptBindsDelegation({ delegationDigest: "not-a-digest" }, value.submission.delegation)).toBeFalse();
  });

  test("PGCR-9: the v2 passkey path has no delegation, so it records no descriptor digest", () => {
    const receipt = proposalReceipt(
      {
        proposalId: "22222222-2222-4222-8222-222222222222",
        baseSha: FIXTURE_BASE_SHA,
        changeDigest: "b".repeat(64),
        authorityCredentialId: "credential",
        authorRegistrySequence: 1,
        nonce: "nonce",
      },
      "https://github.test/issues/3",
      FIXTURE_NOW,
    );

    expect(receipt).not.toHaveProperty("delegationDigest");
    expect(receipt).not.toHaveProperty("deviceId");
  });
});
