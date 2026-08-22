import { describe, expect, test } from "bun:test";
import { ContentHash256 } from "../blake3/blake3";
import { patchPaths } from "../planning/proposal-gated-commit";
import type { SignedProposal } from "../planning/proposal-envelope";
import type { BrowserDatabaseExecutionReceipt } from "./browser-database-intent-outbox";
import {
  encodeBrowserDatabaseReceiptHandoffBody,
  type BrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptHandoffBody,
} from "./browser-database-receipt-handoff";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_ARTIFACT_SCHEMA,
  BROWSER_DATABASE_RECEIPT_PROPOSAL_SUBMISSION_SCHEMA,
  createBrowserDatabaseReceiptProposalPort,
  type BrowserDatabaseReceiptProposalCarrier,
  type BrowserDatabaseReceiptProposalLease,
  type BrowserDatabaseReceiptProposalPort,
  type BrowserDatabaseReceiptProposalResult,
  type BrowserDatabaseReceiptProposalSigner,
} from "./browser-database-receipt-proposal";

const proposalId = "123e4567-e89b-42d3-a456-426614174000";

function receipt(sequence: number): BrowserDatabaseExecutionReceipt {
  return {
    schema: "zeta.browser-database-execution-receipt.v1",
    databaseNodeId: "browser/global",
    intentId: `event/${sequence.toString()}`,
    sequence,
    status: "settled",
    executorId: "tab-a",
    executorKind: "browser-tab",
    revision: sequence + 1,
    accepted: 1,
    duplicates: 0,
    deltaCount: 1,
  };
}

function hash(payload: Uint8Array): string {
  return `blake3:${ContentHash256.ofBytes(payload).toHex()}`;
}

function batch(): BrowserDatabaseReceiptHandoffBatch {
  const receipts = [receipt(3), receipt(4)];
  const body: BrowserDatabaseReceiptHandoffBody = {
    schema: "zeta.browser-database-receipt-handoff-batch.v1",
    databaseNodeId: "browser/global",
    archiveNodeId: "browser/global:receipts",
    archiveRevision: 8,
    firstSequence: 3,
    highWaterSequence: 4,
    receiptCount: receipts.length,
    receipts,
  };
  return { ...body, contentHash: hash(encodeBrowserDatabaseReceiptHandoffBody(body)) };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function proposal(changeDigest: string): SignedProposal {
  return {
    schema: "zeta.proposal.v2",
    proposalId,
    repository: "Lucent-Financial-Group/Zeta",
    baseRef: "main",
    baseSha: "a".repeat(40),
    createdAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-14T00:05:00.000Z",
    nonce: "A".repeat(43),
    changeDigest,
    authorCredentialId: "credential-a",
    authorRegistrySequence: 1,
    assertion: {
      credentialId: "credential-a",
      authenticatorData: "authenticator-data",
      clientDataJSON: "client-data",
      signature: "signature",
    },
  };
}

function accepted<T>(value: T): BrowserDatabaseReceiptProposalResult<T> {
  return { ok: true, value };
}

function createPort(input?: {
  readonly signer?: BrowserDatabaseReceiptProposalSigner;
  readonly carrier?: BrowserDatabaseReceiptProposalCarrier;
  readonly maxPatchBytes?: number;
}) {
  const signer =
    input?.signer ??
    ({
      sign: async (request) => accepted(proposal(await sha256Hex(request.artifact.patch.trim()))),
    } satisfies BrowserDatabaseReceiptProposalSigner);
  const carrier =
    input?.carrier ??
    ({
      reserveFromUserActivation: () =>
        accepted({
          release: () => undefined,
          carry: (request) =>
            Promise.resolve(
              accepted({
                proposalId: request.proposal.proposalId,
                reference: "github-issue:10489",
                disposition: "submitted",
              }),
            ),
        }),
    } satisfies BrowserDatabaseReceiptProposalCarrier);
  const opened = createBrowserDatabaseReceiptProposalPort({
    hasher: { hash },
    signer,
    carrier,
    limits: { maxPatchBytes: input?.maxPatchBytes ?? 32 * 1024 },
  });
  if (!opened.ok) throw new Error(opened.feedback.detail);
  return opened.value;
}

function begin(port: BrowserDatabaseReceiptProposalPort): BrowserDatabaseReceiptProposalLease {
  const opened = port.beginFromUserActivation();
  if (!opened.ok) throw new Error(opened.feedback.detail);
  return opened.value;
}

describe("browser database receipt passkey proposal port", () => {
  test("builds one deterministic content-addressed new-file patch accepted by the gated planner", () => {
    const source = batch();
    const first = createPort().build(source);
    const second = createPort().build(source);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      value: {
        schema: BROWSER_DATABASE_RECEIPT_PROPOSAL_ARTIFACT_SCHEMA,
        contentHash: source.contentHash,
      },
    });
    if (!first.ok) throw new Error(first.feedback.detail);
    expect(first.value.targetPath).toBe(
      `db/receipts/browser/v1/${source.contentHash.slice("blake3:".length)}.json`,
    );
    expect(JSON.parse(first.value.document)).toEqual(source);
    expect(patchPaths(first.value.patch)).toEqual([first.value.targetPath]);
    expect(first.value.patch).toContain("--- /dev/null\n");
    expect(first.value.patch).toContain(`+++ b/${first.value.targetPath}\n`);
  });

  test("injects signing and transport but returns submission rather than persistence acknowledgement", async () => {
    const events: string[] = [];
    const port = createPort({
      signer: {
        sign: async (request) => {
          events.push(`sign:${request.artifact.contentHash}`);
          expect(request.artifact.patch).toContain(request.artifact.targetPath);
          return accepted(proposal(await sha256Hex(request.artifact.patch.trim())));
        },
      },
      carrier: {
        reserveFromUserActivation: () => {
          events.push("reserve");
          return accepted({
            release: () => events.push("release"),
            carry: (request) => {
              events.push(`carry:${request.proposal.proposalId}`);
              expect(request.batch.contentHash).toBe(request.artifact.contentHash);
              return Promise.resolve(
                accepted({ proposalId, reference: "github-issue:10489", disposition: "submitted" }),
              );
            },
          });
        },
      },
    });
    const lease = begin(port);
    const result = await lease.propose(batch());
    expect(events).toEqual(["reserve", `sign:${batch().contentHash}`, `carry:${proposalId}`]);
    expect(result).toEqual({
      ok: true,
      value: {
        schema: BROWSER_DATABASE_RECEIPT_PROPOSAL_SUBMISSION_SCHEMA,
        status: "submitted",
        proposalId,
        reference: "github-issue:10489",
        contentHash: batch().contentHash,
        targetPath: `db/receipts/browser/v1/${batch().contentHash.slice("blake3:".length)}.json`,
      },
    });
  });

  test("rejects a forged content address before asking the passkey signer", async () => {
    let signerCalls = 0;
    const port = createPort({
      signer: {
        sign: () => {
          signerCalls++;
          return Promise.resolve(accepted(proposal("b".repeat(64))));
        },
      },
    });
    const source = { ...batch(), contentHash: `blake3:${"0".repeat(64)}` };
    expect(await begin(port).propose(source)).toMatchObject({
      ok: false,
      feedback: { code: "receipt-proposal-hash-invalid" },
    });
    expect(signerCalls).toBe(0);
  });

  test("releases a reserved presentation when the patch exceeds its finite budget", async () => {
    let signerCalls = 0;
    let carrierCalls = 0;
    let releases = 0;
    const port = createPort({
      maxPatchBytes: 1,
      signer: {
        sign: () => {
          signerCalls++;
          return Promise.resolve(accepted(proposal("b".repeat(64))));
        },
      },
      carrier: {
        reserveFromUserActivation: () =>
          accepted({
            release: () => releases++,
            carry: () => {
              carrierCalls++;
              return Promise.resolve(accepted({ proposalId, reference: "unreachable", disposition: "submitted" }));
            },
          }),
      },
    });
    expect(await begin(port).propose(batch())).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-proposal-capacity-exhausted" },
    });
    expect({ signerCalls, carrierCalls, releases }).toEqual({ signerCalls: 0, carrierCalls: 0, releases: 1 });
  });

  test("turns signer and carrier faults into typed feedback", async () => {
    const signerFailure = createPort({
      signer: {
        sign: () => {
          throw new Error("passkey unavailable");
        },
      },
    });
    expect(await begin(signerFailure).propose(batch())).toMatchObject({
      ok: false,
      feedback: { code: "receipt-proposal-signer-threw" },
    });

    let carrierCalls = 0;
    const mismatchedSigner = createPort({
      signer: {
        sign: () => Promise.resolve(accepted(proposal("b".repeat(64)))),
      },
      carrier: {
        reserveFromUserActivation: () =>
          accepted({
            release: () => undefined,
            carry: () => {
              carrierCalls++;
              return Promise.resolve(accepted({ proposalId, reference: "unreachable", disposition: "submitted" }));
            },
          }),
      },
    });
    expect(await begin(mismatchedSigner).propose(batch())).toMatchObject({
      ok: false,
      feedback: { code: "receipt-proposal-signer-rejected" },
    });
    expect(carrierCalls).toBe(0);

    const carrierFailure = createPort({
      carrier: {
        reserveFromUserActivation: () =>
          accepted({
            release: () => undefined,
            carry: () =>
              Promise.resolve(
                accepted({ proposalId: crypto.randomUUID(), reference: "wrong proposal", disposition: "submitted" }),
              ),
          }),
      },
    });
    expect(await begin(carrierFailure).propose(batch())).toMatchObject({
      ok: false,
      feedback: { code: "receipt-proposal-carrier-rejected" },
    });
  });

  test("makes each user-activated lease single-use", async () => {
    const lease = begin(createPort());
    expect(await lease.propose(batch())).toMatchObject({ ok: true });
    expect(await lease.propose(batch())).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-proposal-carrier-rejected" },
    });
  });

  test("backpressures concurrent use while the first lease operation is signing", async () => {
    let entered!: () => void;
    let resume!: () => void;
    const signing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const held = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const lease = begin(
      createPort({
        signer: {
          sign: async (request) => {
            entered();
            await held;
            return accepted(proposal(await sha256Hex(request.artifact.patch.trim())));
          },
        },
      }),
    );

    const first = lease.propose(batch());
    await signing;
    expect(await lease.propose(batch())).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-proposal-carrier-rejected" },
    });
    resume();
    expect(await first).toMatchObject({ ok: true });
  });
});
