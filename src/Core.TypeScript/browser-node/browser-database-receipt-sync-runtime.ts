import {
  createBrowserDatabaseReceiptHandoffRuntime,
  prepareBrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptArchiveMaintenancePort,
  type BrowserDatabaseReceiptBatchHasher,
  type BrowserDatabaseReceiptHandoffFeedback,
  type BrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptHandoffLimits,
  type BrowserDatabaseReceiptHandoffReadout,
} from "./browser-database-receipt-handoff";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_ACCEPTANCE_PORT_KIND,
  type BrowserDatabaseReceiptProposalAcceptancePort,
} from "./browser-database-receipt-proposal-acceptance";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_SUBMISSION_SCHEMA,
  browserDatabaseReceiptProposalTargetPath,
  type BrowserDatabaseReceiptProposalFeedback,
  type BrowserDatabaseReceiptProposalLease,
  type BrowserDatabaseReceiptProposalPort,
  type BrowserDatabaseReceiptProposalSubmission,
} from "./browser-database-receipt-proposal";

export const BROWSER_DATABASE_RECEIPT_SYNC_READOUT_SCHEMA = "zeta.browser-database-receipt-sync-readout.v1" as const;

export interface BrowserDatabaseReceiptSyncRuntimeFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "receipt-sync-configuration-invalid"
    | "receipt-sync-busy"
    | "receipt-sync-archive-threw"
    | "receipt-sync-proposal-threw"
    | "receipt-sync-proposal-invalid"
    | "receipt-sync-acceptance-threw";
  readonly detail: string;
}

export type BrowserDatabaseReceiptSyncFeedback =
  | BrowserDatabaseReceiptSyncRuntimeFeedback
  | BrowserDatabaseReceiptHandoffFeedback
  | BrowserDatabaseReceiptProposalFeedback;

export type BrowserDatabaseReceiptSyncStatus =
  | "idle"
  | "retained"
  | "presented"
  | "submitted"
  | "pending"
  | "accepted"
  | "backpressured"
  | "heat";

export interface BrowserDatabaseReceiptSyncReadout {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_SYNC_READOUT_SCHEMA;
  readonly status: BrowserDatabaseReceiptSyncStatus;
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly receiptCount: number;
  readonly highWaterSequence: number | null;
  readonly contentHash: string | null;
  readonly proposal: BrowserDatabaseReceiptProposalSubmission | null;
  readonly handoff: BrowserDatabaseReceiptHandoffReadout | null;
  readonly feedback: BrowserDatabaseReceiptSyncFeedback | null;
}

export type BrowserDatabaseReceiptSyncResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDatabaseReceiptSyncFeedback };

export interface BrowserDatabaseReceiptSyncRuntimeOptions {
  readonly databaseNodeId: string;
  readonly archiveNodeId: string;
  readonly targetNodeId: string;
  readonly archive: BrowserDatabaseReceiptArchiveMaintenancePort;
  readonly hasher: BrowserDatabaseReceiptBatchHasher;
  readonly limits: BrowserDatabaseReceiptHandoffLimits;
  readonly proposal: BrowserDatabaseReceiptProposalPort;
  readonly acceptance: BrowserDatabaseReceiptProposalAcceptancePort;
}

export interface BrowserDatabaseReceiptSyncRuntime {
  submitFromUserActivation(): Promise<BrowserDatabaseReceiptSyncResult<BrowserDatabaseReceiptSyncReadout>>;
  pollAcceptance(): Promise<BrowserDatabaseReceiptSyncResult<BrowserDatabaseReceiptSyncReadout>>;
  read(): BrowserDatabaseReceiptSyncReadout;
}

type ActiveOperation = "submit" | "poll";

function succeeded<T>(value: T): BrowserDatabaseReceiptSyncResult<T> {
  return { ok: true, value };
}

function failed(feedback: BrowserDatabaseReceiptSyncFeedback): BrowserDatabaseReceiptSyncResult<never> {
  return { ok: false, feedback };
}

function runtimeFeedback(
  code: BrowserDatabaseReceiptSyncRuntimeFeedback["code"],
  detail: string,
  severity: BrowserDatabaseReceiptSyncRuntimeFeedback["severity"] = "heat",
): BrowserDatabaseReceiptSyncRuntimeFeedback {
  return { severity, code, detail };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasMethods(value: unknown, names: readonly string[]): boolean {
  if (!isRecord(value)) return false;
  try {
    return names.every((name) => typeof Reflect.get(value, name) === "function");
  } catch {
    return false;
  }
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function validLimits(value: BrowserDatabaseReceiptHandoffLimits): boolean {
  return (
    Number.isSafeInteger(value.minimumReceipts) &&
    value.minimumReceipts >= 1 &&
    Number.isSafeInteger(value.maxReceipts) &&
    value.maxReceipts >= value.minimumReceipts &&
    Number.isSafeInteger(value.maxBatchBytes) &&
    value.maxBatchBytes >= 1
  );
}

function copyProposal(
  proposal: BrowserDatabaseReceiptProposalSubmission | null,
): BrowserDatabaseReceiptProposalSubmission | null {
  return proposal === null ? null : { ...proposal };
}

function copyHandoff(
  handoff: BrowserDatabaseReceiptHandoffReadout | null,
): BrowserDatabaseReceiptHandoffReadout | null {
  return handoff === null ? null : { ...handoff, feedback: handoff.feedback === null ? null : { ...handoff.feedback } };
}

function copyReadout(readout: BrowserDatabaseReceiptSyncReadout): BrowserDatabaseReceiptSyncReadout {
  return {
    ...readout,
    proposal: copyProposal(readout.proposal),
    handoff: copyHandoff(readout.handoff),
    feedback: readout.feedback === null ? null : { ...readout.feedback },
  };
}

function statusFor(feedback: BrowserDatabaseReceiptSyncFeedback): "backpressured" | "heat" {
  return feedback.severity === "backpressure" ? "backpressured" : "heat";
}

function statusForHandoff(readout: BrowserDatabaseReceiptHandoffReadout): BrowserDatabaseReceiptSyncStatus {
  if (readout.status === "complete") return "accepted";
  if (readout.status === "backpressured") return "backpressured";
  return readout.status;
}

function submissionMatchesBatch(
  submission: unknown,
  batch: BrowserDatabaseReceiptHandoffBatch,
): submission is BrowserDatabaseReceiptProposalSubmission {
  return (
    isRecord(submission) &&
    submission.schema === BROWSER_DATABASE_RECEIPT_PROPOSAL_SUBMISSION_SCHEMA &&
    (submission.status === "presented" || submission.status === "submitted") &&
    typeof submission.proposalId === "string" &&
    submission.proposalId.length > 0 &&
    submission.proposalId.length <= 1024 &&
    typeof submission.reference === "string" &&
    submission.reference.length > 0 &&
    submission.reference.length <= 4096 &&
    submission.contentHash === batch.contentHash &&
    submission.targetPath === browserDatabaseReceiptProposalTargetPath(batch.contentHash)
  );
}

/**
 * Coordinate user-authorized proposal publication and background-safe
 * acceptance observation without allowing the polling path to reach a signer.
 */
export function createBrowserDatabaseReceiptSyncRuntime(
  options: BrowserDatabaseReceiptSyncRuntimeOptions,
): BrowserDatabaseReceiptSyncResult<BrowserDatabaseReceiptSyncRuntime> {
  if (
    !isIdentifier(options.databaseNodeId) ||
    !isIdentifier(options.archiveNodeId) ||
    !isIdentifier(options.targetNodeId) ||
    new Set([options.databaseNodeId, options.archiveNodeId, options.targetNodeId]).size !== 3 ||
    !hasMethods(options.archive, ["read", "compactGeneration"]) ||
    !hasMethods(options.hasher, ["hash"]) ||
    !validLimits(options.limits) ||
    !hasMethods(options.proposal, ["build", "beginFromUserActivation"]) ||
    options.acceptance.kind !== BROWSER_DATABASE_RECEIPT_PROPOSAL_ACCEPTANCE_PORT_KIND ||
    !hasMethods(options.acceptance, ["handoff"])
  ) {
    return failed(
      runtimeFeedback(
        "receipt-sync-configuration-invalid",
        "Receipt synchronization requires three distinct nodes, finite budgets, archive and hash ports, an explicit proposal port, and a repository-acceptance port.",
      ),
    );
  }

  const acceptance = createBrowserDatabaseReceiptHandoffRuntime({
    databaseNodeId: options.databaseNodeId,
    archiveNodeId: options.archiveNodeId,
    targetNodeId: options.targetNodeId,
    archive: options.archive,
    downstream: options.acceptance,
    hasher: options.hasher,
    limits: options.limits,
  });
  if (!acceptance.ok) return failed(acceptance.feedback);

  let active: ActiveOperation | null = null;
  let latest: BrowserDatabaseReceiptSyncReadout = {
    schema: BROWSER_DATABASE_RECEIPT_SYNC_READOUT_SCHEMA,
    status: "idle",
    databaseNodeId: options.databaseNodeId,
    archiveNodeId: options.archiveNodeId,
    receiptCount: 0,
    highWaterSequence: null,
    contentHash: null,
    proposal: null,
    handoff: null,
    feedback: null,
  };

  const rejectBusy = (requested: ActiveOperation): BrowserDatabaseReceiptSyncResult<never> => {
    const feedback = runtimeFeedback(
      "receipt-sync-busy",
      `Receipt ${requested} waits while the ${active ?? "current"} operation owns the finite synchronization boundary.`,
      "backpressure",
    );
    latest = { ...latest, status: "backpressured", feedback };
    return failed(feedback);
  };

  const failWith = (feedback: BrowserDatabaseReceiptSyncFeedback): BrowserDatabaseReceiptSyncResult<never> => {
    latest = { ...latest, status: statusFor(feedback), feedback };
    return failed(feedback);
  };

  return succeeded({
    read: () => copyReadout(latest),
    submitFromUserActivation: async () => {
      if (active !== null) return rejectBusy("submit");
      active = "submit";
      let proposalLease: BrowserDatabaseReceiptProposalLease | null = null;
      try {
        let leased;
        try {
          leased = options.proposal.beginFromUserActivation();
        } catch {
          return failWith(
            runtimeFeedback(
              "receipt-sync-proposal-threw",
              "The proposal port threw while reserving its user-activated presentation edge.",
            ),
          );
        }
        if (!leased.ok) return failWith(leased.feedback);
        proposalLease = leased.value;

        let snapshot;
        try {
          snapshot = await options.archive.read();
        } catch {
          return failWith(
            runtimeFeedback("receipt-sync-archive-threw", "The receipt archive threw during submission."),
          );
        }
        if (!snapshot.ok) return failWith(snapshot.feedback);
        const prepared = prepareBrowserDatabaseReceiptHandoffBatch(options, snapshot.value);
        if (!prepared.ok) return failWith(prepared.feedback);
        if (prepared.value.status !== "ready") {
          latest = {
            ...latest,
            status: prepared.value.status,
            receiptCount: prepared.value.snapshot.receipts.length,
            highWaterSequence: null,
            contentHash: null,
            proposal: null,
            feedback: null,
          };
          return succeeded(copyReadout(latest));
        }

        let submitted;
        try {
          submitted = await proposalLease.propose(prepared.value.batch);
        } catch {
          return failWith(
            runtimeFeedback("receipt-sync-proposal-threw", "The proposal port threw during user submission."),
          );
        }
        if (!submitted.ok) return failWith(submitted.feedback);
        if (!submissionMatchesBatch(submitted.value, prepared.value.batch)) {
          return failWith(
            runtimeFeedback(
              "receipt-sync-proposal-invalid",
              "The proposal port returned no exact bounded submission receipt for the prepared archive generation.",
            ),
          );
        }
        latest = {
          ...latest,
          status: submitted.value.status,
          receiptCount: prepared.value.batch.receiptCount,
          highWaterSequence: prepared.value.batch.highWaterSequence,
          contentHash: prepared.value.batch.contentHash,
          proposal: copyProposal(submitted.value),
          feedback: null,
        };
        return succeeded(copyReadout(latest));
      } finally {
        try {
          proposalLease?.release();
        } catch {
          // Release is best-effort cleanup; operational failures are already typed.
        }
        active = null;
      }
    },
    pollAcceptance: async () => {
      if (active !== null) return rejectBusy("poll");
      active = "poll";
      try {
        let accepted;
        try {
          accepted = await acceptance.value.handoff();
        } catch {
          return failWith(
            runtimeFeedback(
              "receipt-sync-acceptance-threw",
              "The acceptance-only handoff runtime threw while polling.",
            ),
          );
        }
        if (!accepted.ok) {
          let handoff: BrowserDatabaseReceiptHandoffReadout | null = null;
          try {
            handoff = acceptance.value.read();
          } catch {
            return failWith(
              runtimeFeedback(
                "receipt-sync-acceptance-threw",
                "The acceptance-only handoff readout threw while polling.",
              ),
            );
          }
          latest = {
            ...latest,
            status:
              accepted.feedback.code === "receipt-handoff-acceptance-pending"
                ? "pending"
                : statusFor(accepted.feedback),
            receiptCount: handoff.retainedReceipts,
            highWaterSequence: handoff.highWaterSequence,
            contentHash: handoff.contentHash,
            handoff: copyHandoff(handoff),
            feedback: accepted.feedback,
          };
          return failed(accepted.feedback);
        }
        latest = {
          ...latest,
          status: statusForHandoff(accepted.value),
          receiptCount: accepted.value.retainedReceipts + accepted.value.releasedReceipts,
          highWaterSequence: accepted.value.highWaterSequence,
          contentHash: accepted.value.contentHash,
          handoff: copyHandoff(accepted.value),
          feedback: null,
        };
        return succeeded(copyReadout(latest));
      } finally {
        active = null;
      }
    },
  });
}
