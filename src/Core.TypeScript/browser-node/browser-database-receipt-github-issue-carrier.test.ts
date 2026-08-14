import { describe, expect, test } from "bun:test";
import { parseProposalIssueBody, PROPOSAL_ISSUE_MARKER } from "../planning/proposal-gated-commit";
import type { SignedProposal } from "../planning/proposal-envelope";
import type { BrowserDatabaseReceiptProposalCarrierRequest } from "./browser-database-receipt-proposal";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_ISSUE_MARKER,
  createNativeBrowserDatabaseReceiptGitHubIssueCarrier,
} from "./browser-database-receipt-github-issue-carrier";

const proposal: SignedProposal = {
  schema: "zeta.proposal.v2",
  proposalId: "123e4567-e89b-42d3-a456-426614174000",
  repository: "Lucent-Financial-Group/Zeta",
  baseRef: "main",
  baseSha: "a".repeat(40),
  createdAt: "2026-08-14T03:00:00.000Z",
  expiresAt: "2026-08-14T03:05:00.000Z",
  nonce: "nonce-a",
  changeDigest: "b".repeat(64),
  authorCredentialId: "credential-a",
  authorRegistrySequence: 3,
  assertion: {
    credentialId: "credential-a",
    authenticatorData: "authenticator-data",
    clientDataJSON: "client-data",
    signature: "signature",
  },
};

const patch = "diff --git a/example b/example\n--- a/example\n+++ b/example\n@@ -1 +1 @@\n-old\n+new\n";
const request = {
  artifact: {
    schema: "zeta.browser-database-receipt-proposal-artifact.v1",
    contentHash: `blake3:${"c".repeat(64)}`,
    targetPath: `db/receipts/browser/v1/${"c".repeat(64)}.json`,
    document: "{}\n",
    patch,
  },
  batch: {
    schema: "zeta.browser-database-receipt-handoff-batch.v1",
    databaseNodeId: "browser/global",
    archiveNodeId: "browser/global:receipts",
    archiveRevision: 1,
    firstSequence: 1,
    highWaterSequence: 1,
    receiptCount: 1,
    receipts: [],
    contentHash: `blake3:${"c".repeat(64)}`,
  },
  proposal,
} satisfies BrowserDatabaseReceiptProposalCarrierRequest;

describe("native GitHub issue proposal carrier", () => {
  test("presents the exact gated-commit carrier without claiming submission", async () => {
    let openedUrl = "";
    let closes = 0;
    const openedWindow: { opener: unknown; location: { href: string }; close: () => void } = {
      opener: "page",
      location: { href: "" },
      close: () => closes++,
    };
    const carrier = createNativeBrowserDatabaseReceiptGitHubIssueCarrier({
      root: {
        open: (url: string) => {
          expect(url).toBe("");
          return openedWindow;
        },
      },
      repository: "Lucent-Financial-Group/Zeta",
      maxUrlBytes: 128 * 1024,
    });
    expect(carrier.ok).toBe(true);
    if (!carrier.ok) throw new Error(carrier.feedback.detail);
    const reserved = carrier.value.reserveFromUserActivation();
    expect(openedWindow.opener).toBeNull();
    expect(openedWindow.location.href).toBe("");
    if (!reserved.ok) throw new Error(reserved.feedback.detail);
    await Promise.resolve();
    expect(await reserved.value.carry(request)).toEqual({
      ok: true,
      value: {
        proposalId: proposal.proposalId,
        reference: `github-issue-compose:${proposal.proposalId}`,
        disposition: "presented",
      },
    });
    reserved.value.release();
    expect(closes).toBe(0);
    openedUrl = openedWindow.location.href;
    const url = new URL(openedUrl);
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/Lucent-Financial-Group/Zeta/issues/new");
    expect(BROWSER_DATABASE_RECEIPT_PROPOSAL_ISSUE_MARKER).toBe(PROPOSAL_ISSUE_MARKER);
    expect(parseProposalIssueBody(url.searchParams.get("body") ?? "")).toEqual({ payload: patch.trim(), proposal });
  });

  test("backpressures blocked popups and URLs over the finite transport budget", async () => {
    const blocked = createNativeBrowserDatabaseReceiptGitHubIssueCarrier({
      root: { open: () => null },
      repository: "Lucent-Financial-Group/Zeta",
      maxUrlBytes: 128 * 1024,
    });
    if (!blocked.ok) throw new Error(blocked.feedback.detail);
    expect(blocked.value.reserveFromUserActivation()).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-proposal-carrier-rejected" },
    });

    let opens = 0;
    let closes = 0;
    const constrained = createNativeBrowserDatabaseReceiptGitHubIssueCarrier({
      root: {
        open: () => {
          opens++;
          return { opener: "page", location: { href: "" }, close: () => closes++ };
        },
      },
      repository: "Lucent-Financial-Group/Zeta",
      maxUrlBytes: 1,
    });
    if (!constrained.ok) throw new Error(constrained.feedback.detail);
    const reserved = constrained.value.reserveFromUserActivation();
    if (!reserved.ok) throw new Error(reserved.feedback.detail);
    expect(await reserved.value.carry(request)).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-proposal-carrier-rejected" },
    });
    expect({ opens, closes }).toEqual({ opens: 1, closes: 1 });
  });

  test("closes an unused reservation and rejects reuse", async () => {
    let closes = 0;
    const carrier = createNativeBrowserDatabaseReceiptGitHubIssueCarrier({
      root: {
        open: () => ({ opener: "page", location: { href: "" }, close: () => closes++ }),
      },
      repository: "Lucent-Financial-Group/Zeta",
      maxUrlBytes: 128 * 1024,
    });
    if (!carrier.ok) throw new Error(carrier.feedback.detail);
    const reserved = carrier.value.reserveFromUserActivation();
    if (!reserved.ok) throw new Error(reserved.feedback.detail);
    reserved.value.release();
    reserved.value.release();
    expect(closes).toBe(1);
    expect(await reserved.value.carry(request)).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-proposal-carrier-rejected" },
    });
  });
});
