import { describe, expect, test } from "bun:test";
import { ContentHash256 } from "../blake3/blake3";
import type { BrowserDatabaseExecutionReceipt } from "./browser-database-intent-outbox";
import {
  BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
  type BrowserDatabaseReceiptArchiveMaintenancePort,
  type BrowserDatabaseReceiptArchiveSnapshot,
  type BrowserDatabaseReceiptHandoffBatch,
} from "./browser-database-receipt-handoff";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_ACCEPTANCE_PORT_KIND,
  type BrowserDatabaseReceiptProposalAcceptancePort,
} from "./browser-database-receipt-proposal-acceptance";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_SUBMISSION_SCHEMA,
  browserDatabaseReceiptProposalTargetPath,
  type BrowserDatabaseReceiptProposalLease,
  type BrowserDatabaseReceiptProposalPort,
  type BrowserDatabaseReceiptProposalSubmission,
} from "./browser-database-receipt-proposal";
import { createBrowserDatabaseReceiptSyncRuntime } from "./browser-database-receipt-sync-runtime";

const databaseNodeId = "browser/global";
const archiveNodeId = "browser/global:receipts";
const targetNodeId = "git:Lucent-Financial-Group/Zeta";
const limits = { minimumReceipts: 1, maxReceipts: 8, maxBatchBytes: 32 * 1024 } as const;

function receipt(sequence: number): BrowserDatabaseExecutionReceipt {
  return {
    schema: "zeta.browser-database-execution-receipt.v1",
    databaseNodeId,
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

function snapshot(receipts: readonly BrowserDatabaseExecutionReceipt[] = [receipt(3), receipt(4)]) {
  return {
    schema: "zeta.browser-database-receipt-archive-snapshot.v1",
    databaseNodeId,
    archiveNodeId,
    archiveRevision: 8,
    receiptPayloadBytes: 512,
    limits: { maxDeltas: 1, maxEntries: 8, maxCheckpointBytes: 32 * 1024 },
    receipts,
    generation: null,
  } satisfies BrowserDatabaseReceiptArchiveSnapshot;
}

function hash(payload: Uint8Array): string {
  return `blake3:${ContentHash256.ofBytes(payload).toHex()}`;
}

function acceptance(
  handoff: BrowserDatabaseReceiptProposalAcceptancePort["handoff"],
): BrowserDatabaseReceiptProposalAcceptancePort {
  return { kind: BROWSER_DATABASE_RECEIPT_PROPOSAL_ACCEPTANCE_PORT_KIND, handoff };
}

function archive(
  source = snapshot(),
  compactGeneration: BrowserDatabaseReceiptArchiveMaintenancePort["compactGeneration"] = () => {
    throw new Error("submission must not compact the archive");
  },
): BrowserDatabaseReceiptArchiveMaintenancePort {
  return {
    read: () => Promise.resolve({ ok: true, value: source }),
    compactGeneration,
  };
}

function acknowledgement(batch: BrowserDatabaseReceiptHandoffBatch) {
  return {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
    targetNodeId,
    databaseNodeId: batch.databaseNodeId,
    archiveNodeId: batch.archiveNodeId,
    archiveRevision: batch.archiveRevision,
    highWaterSequence: batch.highWaterSequence,
    receiptCount: batch.receiptCount,
    contentHash: batch.contentHash,
    disposition: "stored",
  } as const;
}

function submission(contentHash: string, status: "presented" | "submitted"): BrowserDatabaseReceiptProposalSubmission {
  return {
    schema: BROWSER_DATABASE_RECEIPT_PROPOSAL_SUBMISSION_SCHEMA,
    status,
    proposalId: "11111111-1111-4111-8111-111111111111",
    reference: "https://github.com/Lucent-Financial-Group/Zeta/issues/new",
    contentHash,
    targetPath: browserDatabaseReceiptProposalTargetPath(contentHash),
  };
}

function open(
  proposal: BrowserDatabaseReceiptProposalPort,
  acceptedRecords: BrowserDatabaseReceiptProposalAcceptancePort,
  receiptArchive = archive(),
) {
  const created = createBrowserDatabaseReceiptSyncRuntime({
    databaseNodeId,
    archiveNodeId,
    targetNodeId,
    archive: receiptArchive,
    hasher: { hash },
    limits,
    proposal,
    acceptance: acceptedRecords,
  });
  if (!created.ok) throw new Error(created.feedback.detail);
  return created.value;
}

function proposalPort(
  propose: BrowserDatabaseReceiptProposalLease["propose"],
  hooks: { readonly begin?: () => void; readonly release?: () => void } = {},
): BrowserDatabaseReceiptProposalPort {
  return {
    build: () => {
      throw new Error("not used by the coordinator");
    },
    beginFromUserActivation: () => {
      hooks.begin?.();
      return { ok: true, value: { propose, release: () => hooks.release?.() } };
    },
  };
}

describe("browser database receipt sync runtime", () => {
  test("submits only from the explicit user-activation method and never compacts on presentation", async () => {
    let leaseCalls = 0;
    let proposalCalls = 0;
    let acceptanceCalls = 0;
    const ordering: string[] = [];
    const runtime = open(
      proposalPort(
        (batch) => {
          proposalCalls++;
          return Promise.resolve({ ok: true, value: submission(batch.contentHash, "presented") });
        },
        {
          begin: () => {
            leaseCalls++;
            ordering.push("reserve");
          },
        },
      ),
      acceptance(() => {
        acceptanceCalls++;
        throw new Error("submission must not poll acceptance");
      }),
      {
        read: () => {
          ordering.push("archive");
          return Promise.resolve({ ok: true, value: snapshot() });
        },
        compactGeneration: () => {
          throw new Error("submission must not compact the archive");
        },
      },
    );

    const submitting = runtime.submitFromUserActivation();
    expect(leaseCalls).toBe(1);
    expect(ordering).toEqual(["reserve", "archive"]);
    expect(await submitting).toMatchObject({
      ok: true,
      value: {
        status: "presented",
        receiptCount: 2,
        highWaterSequence: 4,
        proposal: { status: "presented" },
        handoff: null,
      },
    });
    expect(proposalCalls).toBe(1);
    expect(acceptanceCalls).toBe(0);
  });

  test("rejects proposal metadata for any other archive generation", async () => {
    const runtime = open(
      proposalPort(() =>
        Promise.resolve({ ok: true, value: submission(`blake3:${"f".repeat(64)}`, "submitted") }),
      ),
      acceptance(() => {
        throw new Error("submission must not poll acceptance");
      }),
    );

    expect(await runtime.submitFromUserActivation()).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-sync-proposal-invalid" },
    });
  });

  test("polls accepted state without reaching the proposal port", async () => {
    let proposalCalls = 0;
    const pendingFeedback = {
      severity: "backpressure",
      code: "receipt-handoff-acceptance-pending",
      detail: "not accepted",
    } as const;
    const runtime = open(
      proposalPort(() => {
          proposalCalls++;
          throw new Error("polling must not sign or carry a proposal");
      }),
      acceptance(() => Promise.resolve({ ok: false, feedback: pendingFeedback })),
    );

    expect(await runtime.pollAcceptance()).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-acceptance-pending" },
    });
    expect(runtime.read()).toMatchObject({
      status: "pending",
      receiptCount: 2,
      handoff: { status: "backpressured" },
    });
    expect(proposalCalls).toBe(0);
  });

  test("reports acceptance only from the acceptance handoff", async () => {
    let proposalCalls = 0;
    let compactions = 0;
    const runtime = open(
      proposalPort(() => {
          proposalCalls++;
          throw new Error("polling must not submit a proposal");
      }),
      acceptance((batch) => Promise.resolve({ ok: true, value: acknowledgement(batch) })),
      archive(snapshot(), () => {
        compactions++;
        return Promise.resolve({ ok: true, value: true });
      }),
    );

    expect(await runtime.pollAcceptance()).toMatchObject({
      ok: true,
      value: {
        status: "accepted",
        receiptCount: 2,
        handoff: { status: "complete", disposition: "stored" },
      },
    });
    expect(proposalCalls).toBe(0);
    expect(compactions).toBe(1);
  });

  test("backpressures a poll while a user-authorized submission owns the boundary", async () => {
    let entered!: () => void;
    let release!: (value: BrowserDatabaseReceiptProposalSubmission) => void;
    const proposed = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const carrier = new Promise<BrowserDatabaseReceiptProposalSubmission>((resolve) => {
      release = resolve;
    });
    let acceptanceCalls = 0;
    let proposedHash = "";
    const runtime = open(
      proposalPort(async (batch) => {
          proposedHash = batch.contentHash;
          entered();
          return { ok: true, value: await carrier };
      }),
      acceptance((batch) => {
        acceptanceCalls++;
        return Promise.resolve({ ok: true, value: acknowledgement(batch) });
      }),
    );

    const submitting = runtime.submitFromUserActivation();
    await proposed;
    expect(await runtime.pollAcceptance()).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-sync-busy" },
    });
    expect(acceptanceCalls).toBe(0);
    release(submission(proposedHash, "submitted"));
    expect(await submitting).toMatchObject({ ok: true, value: { status: "submitted" } });
  });

  test("keeps an underfilled archive local without invoking proposal or acceptance", async () => {
    let proposalCalls = 0;
    const created = createBrowserDatabaseReceiptSyncRuntime({
      databaseNodeId,
      archiveNodeId,
      targetNodeId,
      archive: archive(snapshot([receipt(3)])),
      hasher: { hash },
      limits: { ...limits, minimumReceipts: 2 },
      proposal: proposalPort(() => {
          proposalCalls++;
          throw new Error("an underfilled archive must remain local");
      }),
      acceptance: acceptance(() => {
        throw new Error("submission must not poll acceptance");
      }),
    });
    if (!created.ok) throw new Error(created.feedback.detail);

    expect(await created.value.submitFromUserActivation()).toMatchObject({
      ok: true,
      value: { status: "retained", receiptCount: 1, proposal: null },
    });
    expect(proposalCalls).toBe(0);
  });

  test("releases the presentation lease when the archive remains local", async () => {
    let releases = 0;
    const created = createBrowserDatabaseReceiptSyncRuntime({
      databaseNodeId,
      archiveNodeId,
      targetNodeId,
      archive: archive(snapshot([receipt(3)])),
      hasher: { hash },
      limits: { ...limits, minimumReceipts: 2 },
      proposal: proposalPort(
        () => {
          throw new Error("a retained archive must not propose");
        },
        { release: () => releases++ },
      ),
      acceptance: acceptance(() => {
        throw new Error("submission must not poll acceptance");
      }),
    });
    if (!created.ok) throw new Error(created.feedback.detail);

    expect(await created.value.submitFromUserActivation()).toMatchObject({
      ok: true,
      value: { status: "retained" },
    });
    expect(releases).toBe(1);
  });

  test("releases the presentation lease when archive reading fails", async () => {
    let releases = 0;
    const runtime = open(
      proposalPort(
        () => {
          throw new Error("an unreadable archive must not propose");
        },
        { release: () => releases++ },
      ),
      acceptance(() => {
        throw new Error("submission must not poll acceptance");
      }),
      {
        read: () => Promise.reject(new Error("storage unavailable")),
        compactGeneration: () => {
          throw new Error("submission must not compact the archive");
        },
      },
    );

    expect(await runtime.submitFromUserActivation()).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-sync-archive-threw" },
    });
    expect(releases).toBe(1);
  });
});
