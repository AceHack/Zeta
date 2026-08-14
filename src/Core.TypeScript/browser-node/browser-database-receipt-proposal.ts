import type { SignedProposal } from "../planning/proposal-envelope";
import {
  copyBrowserDatabaseExecutionReceipt,
  validateBrowserDatabaseExecutionReceipt,
} from "./browser-database-intent-outbox";
import {
  BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
  encodeBrowserDatabaseReceiptHandoffBody,
  type BrowserDatabaseReceiptBatchHasher,
  type BrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptHandoffBody,
} from "./browser-database-receipt-handoff";

export const BROWSER_DATABASE_RECEIPT_PROPOSAL_ARTIFACT_SCHEMA =
  "zeta.browser-database-receipt-proposal-artifact.v1" as const;
export const BROWSER_DATABASE_RECEIPT_PROPOSAL_SUBMISSION_SCHEMA =
  "zeta.browser-database-receipt-proposal-submission.v1" as const;
export const BROWSER_DATABASE_RECEIPT_PROPOSAL_ROOT = "db/receipts/browser/v1" as const;
export const BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY = "Lucent-Financial-Group/Zeta" as const;

export interface BrowserDatabaseReceiptProposalArtifact {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_PROPOSAL_ARTIFACT_SCHEMA;
  readonly contentHash: string;
  readonly targetPath: string;
  readonly document: string;
  readonly patch: string;
}

export interface BrowserDatabaseReceiptProposalSigningRequest {
  readonly artifact: BrowserDatabaseReceiptProposalArtifact;
  readonly batch: BrowserDatabaseReceiptHandoffBatch;
}

export interface BrowserDatabaseReceiptProposalCarrierRequest extends BrowserDatabaseReceiptProposalSigningRequest {
  readonly proposal: SignedProposal;
}

export interface BrowserDatabaseReceiptProposalCarrierReceipt {
  readonly proposalId: string;
  readonly reference: string;
  readonly disposition: "presented" | "submitted";
}

export interface BrowserDatabaseReceiptProposalSubmission {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_PROPOSAL_SUBMISSION_SCHEMA;
  readonly status: BrowserDatabaseReceiptProposalCarrierReceipt["disposition"];
  readonly proposalId: string;
  readonly reference: string;
  readonly contentHash: string;
  readonly targetPath: string;
}

export interface BrowserDatabaseReceiptProposalFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "receipt-proposal-configuration-invalid"
    | "receipt-proposal-batch-invalid"
    | "receipt-proposal-hash-invalid"
    | "receipt-proposal-capacity-exhausted"
    | "receipt-proposal-signer-threw"
    | "receipt-proposal-signer-rejected"
    | "receipt-proposal-carrier-threw"
    | "receipt-proposal-carrier-rejected";
  readonly detail: string;
}

export type BrowserDatabaseReceiptProposalResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDatabaseReceiptProposalFeedback };

export interface BrowserDatabaseReceiptProposalSigner {
  sign(
    request: BrowserDatabaseReceiptProposalSigningRequest,
  ): Promise<BrowserDatabaseReceiptProposalResult<SignedProposal>>;
}

/** A single-use presentation edge synchronously reserved by a user action. */
export interface BrowserDatabaseReceiptProposalCarrierLease {
  carry(
    request: BrowserDatabaseReceiptProposalCarrierRequest,
  ): Promise<BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalCarrierReceipt>>;
  release(): void;
}

/** Reserve transport authority before asynchronous proposal preparation starts. */
export interface BrowserDatabaseReceiptProposalCarrier {
  reserveFromUserActivation(): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalCarrierLease>;
}

export interface BrowserDatabaseReceiptProposalLimits {
  readonly maxPatchBytes: number;
}

export interface BrowserDatabaseReceiptProposalOptions {
  readonly hasher: BrowserDatabaseReceiptBatchHasher;
  readonly signer: BrowserDatabaseReceiptProposalSigner;
  readonly carrier: BrowserDatabaseReceiptProposalCarrier;
  readonly limits: BrowserDatabaseReceiptProposalLimits;
}

/** A single-use proposal operation bound to one carrier reservation. */
export interface BrowserDatabaseReceiptProposalLease {
  propose(
    batch: BrowserDatabaseReceiptHandoffBatch,
  ): Promise<BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalSubmission>>;
  release(): void;
}

/** Build inert artifacts or begin an explicitly user-activated proposal lease. */
export interface BrowserDatabaseReceiptProposalPort {
  build(
    batch: BrowserDatabaseReceiptHandoffBatch,
  ): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalArtifact>;
  beginFromUserActivation(): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalLease>;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptProposalResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserDatabaseReceiptProposalFeedback["code"],
  detail: string,
  severity: BrowserDatabaseReceiptProposalFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: BrowserDatabaseReceiptProposalFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasMethod(value: unknown, name: string): boolean {
  if (!isRecord(value)) return false;
  try {
    return typeof Reflect.get(value, name) === "function";
  } catch {
    return false;
  }
}

function isSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isContentHash(value: unknown): value is string {
  return typeof value === "string" && /^blake3:[0-9a-f]{64}$/.test(value);
}

function bodyFromBatch(batch: BrowserDatabaseReceiptHandoffBatch): BrowserDatabaseReceiptHandoffBody {
  return {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
    databaseNodeId: batch.databaseNodeId,
    archiveNodeId: batch.archiveNodeId,
    archiveRevision: batch.archiveRevision,
    firstSequence: batch.firstSequence,
    highWaterSequence: batch.highWaterSequence,
    receiptCount: batch.receiptCount,
    receipts: batch.receipts.map(copyBrowserDatabaseExecutionReceipt),
  };
}

export function validateBrowserDatabaseReceiptProposalBatch(
  batch: unknown,
  hasher: BrowserDatabaseReceiptBatchHasher,
): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptHandoffBatch> {
  if (
    !isRecord(batch) ||
    batch.schema !== BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA ||
    typeof batch.databaseNodeId !== "string" ||
    batch.databaseNodeId.length === 0 ||
    typeof batch.archiveNodeId !== "string" ||
    batch.archiveNodeId.length === 0 ||
    !isSequence(batch.archiveRevision) ||
    !isSequence(batch.firstSequence) ||
    !isSequence(batch.highWaterSequence) ||
    !isSequence(batch.receiptCount) ||
    batch.receiptCount < 1 ||
    !Array.isArray(batch.receipts) ||
    batch.receipts.length !== batch.receiptCount ||
    !isContentHash(batch.contentHash)
  ) {
    return failed("receipt-proposal-batch-invalid", "The proposal source is not one finite receipt handoff batch.");
  }

  const receipts = [];
  let previousSequence: number | null = null;
  for (const candidate of batch.receipts) {
    const receipt = validateBrowserDatabaseExecutionReceipt(candidate);
    if (
      !receipt.ok ||
      receipt.value.databaseNodeId !== batch.databaseNodeId ||
      (previousSequence !== null && receipt.value.sequence <= previousSequence)
    ) {
      return failed(
        "receipt-proposal-batch-invalid",
        "The proposal source contains an invalid, foreign, or unordered execution receipt.",
      );
    }
    previousSequence = receipt.value.sequence;
    receipts.push(receipt.value);
  }

  const first = receipts[0];
  const last = receipts.at(-1);
  if (first?.sequence !== batch.firstSequence || last?.sequence !== batch.highWaterSequence) {
    return failed(
      "receipt-proposal-batch-invalid",
      "The proposal source sequence bounds do not match its ordered receipts.",
    );
  }

  const immutableReceipts = Object.freeze(
    receipts.map((receipt) => Object.freeze(copyBrowserDatabaseExecutionReceipt(receipt))),
  );
  const validated: BrowserDatabaseReceiptHandoffBatch = Object.freeze({
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
    databaseNodeId: batch.databaseNodeId,
    archiveNodeId: batch.archiveNodeId,
    archiveRevision: batch.archiveRevision,
    firstSequence: batch.firstSequence,
    highWaterSequence: batch.highWaterSequence,
    receiptCount: batch.receiptCount,
    receipts: immutableReceipts,
    contentHash: batch.contentHash,
  });
  let actualHash: string;
  try {
    actualHash = hasher.hash(encodeBrowserDatabaseReceiptHandoffBody(bodyFromBatch(validated)));
  } catch {
    return failed("receipt-proposal-hash-invalid", "The injected receipt batch hasher threw.");
  }
  return actualHash === batch.contentHash
    ? succeeded(validated)
    : failed("receipt-proposal-hash-invalid", "The receipt batch bytes do not match their content address.");
}

export function browserDatabaseReceiptProposalTargetPath(contentHash: string): string {
  return `${BROWSER_DATABASE_RECEIPT_PROPOSAL_ROOT}/${contentHash.slice("blake3:".length)}.json`;
}

export function encodeBrowserDatabaseReceiptProposalDocument(batch: BrowserDatabaseReceiptHandoffBatch): string {
  return `${JSON.stringify(batch, null, 2)}\n`;
}

function encodeNewFilePatch(path: string, document: string): string {
  const lines = document.slice(0, -1).split("\n");
  const additions = lines.map((line) => `+${line}`).join("\n");
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length.toString()} @@`,
    additions,
    "",
  ].join("\n");
}

function buildArtifact(
  batch: BrowserDatabaseReceiptHandoffBatch,
  maxPatchBytes: number,
): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalArtifact> {
  const path = browserDatabaseReceiptProposalTargetPath(batch.contentHash);
  const document = encodeBrowserDatabaseReceiptProposalDocument(batch);
  const patch = encodeNewFilePatch(path, document);
  const patchBytes = new TextEncoder().encode(patch).byteLength;
  return patchBytes <= maxPatchBytes
    ? succeeded(
        Object.freeze({
          schema: BROWSER_DATABASE_RECEIPT_PROPOSAL_ARTIFACT_SCHEMA,
          contentHash: batch.contentHash,
          targetPath: path,
          document,
          patch,
        }),
      )
    : failed(
        "receipt-proposal-capacity-exhausted",
        `The receipt proposal needs ${patchBytes.toString()} patch bytes; its transport budget is ${maxPatchBytes.toString()} bytes.`,
        "backpressure",
      );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validSignedProposal(value: SignedProposal, expectedChangeDigest: string): boolean {
  return (
    isRecord(value) &&
    value.schema === "zeta.proposal.v2" &&
    typeof value.proposalId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.proposalId) &&
    value.repository === BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY &&
    value.baseRef === "main" &&
    typeof value.baseSha === "string" &&
    /^[0-9a-f]{40}$/i.test(value.baseSha) &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string" &&
    typeof value.nonce === "string" &&
    value.nonce.length > 0 &&
    typeof value.authorCredentialId === "string" &&
    value.authorCredentialId.length > 0 &&
    Number.isSafeInteger(value.authorRegistrySequence) &&
    value.authorRegistrySequence >= 0 &&
    value.changeDigest === expectedChangeDigest &&
    isRecord(value.assertion) &&
    value.assertion.credentialId === value.authorCredentialId &&
    typeof value.assertion.authenticatorData === "string" &&
    value.assertion.authenticatorData.length > 0 &&
    typeof value.assertion.clientDataJSON === "string" &&
    value.assertion.clientDataJSON.length > 0 &&
    typeof value.assertion.signature === "string" &&
    value.assertion.signature.length > 0
  );
}

function freezeSignedProposal(value: SignedProposal): SignedProposal {
  const assertion = Object.freeze({
    credentialId: value.assertion.credentialId,
    authenticatorData: value.assertion.authenticatorData,
    clientDataJSON: value.assertion.clientDataJSON,
    signature: value.assertion.signature,
    ...(value.assertion.userHandle === undefined ? {} : { userHandle: value.assertion.userHandle }),
  });
  return Object.freeze({ ...value, assertion });
}

/**
 * Build inert artifacts and open single-use, credential-free proposal leases
 * without claiming that presentation persisted the batch. A later accepted-
 * record observer must acknowledge the handoff before the archive may compact.
 */
export function createBrowserDatabaseReceiptProposalPort(
  options: BrowserDatabaseReceiptProposalOptions,
): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalPort> {
  if (
    !hasMethod(options.hasher, "hash") ||
    !hasMethod(options.signer, "sign") ||
    !hasMethod(options.carrier, "reserveFromUserActivation") ||
    !Number.isSafeInteger(options.limits.maxPatchBytes) ||
    options.limits.maxPatchBytes < 1
  ) {
    return failed(
      "receipt-proposal-configuration-invalid",
      "A receipt proposal port requires a full-digest hasher, signer, carrier, and positive finite patch budget.",
    );
  }

  const build = (
    batchValue: BrowserDatabaseReceiptHandoffBatch,
  ): BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalArtifact> => {
    const batch = validateBrowserDatabaseReceiptProposalBatch(batchValue, options.hasher);
    return batch.ok ? buildArtifact(batch.value, options.limits.maxPatchBytes) : batch;
  };

  return succeeded({
    build,
    beginFromUserActivation: () => {
      let reserved: BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalCarrierLease>;
      try {
        reserved = options.carrier.reserveFromUserActivation();
      } catch {
        return failed(
          "receipt-proposal-carrier-threw",
          "The injected proposal carrier threw while reserving its user-activated presentation edge.",
        );
      }
      if (!reserved.ok) return reserved;

      const carrierLease = reserved.value;
      let available = true;
      let carrierReserved = true;
      const release = (): void => {
        available = false;
        if (!carrierReserved) return;
        carrierReserved = false;
        try {
          carrierLease.release();
        } catch {
          // Release is best-effort cleanup; all operational failures remain typed results.
        }
      };

      return succeeded({
        release,
        propose: async (batchValue) => {
          if (!available) {
            return failed(
              "receipt-proposal-carrier-rejected",
              "The user-activated proposal lease is no longer available.",
              "backpressure",
            );
          }
          available = false;

          const reject = <T>(result: BrowserDatabaseReceiptProposalResult<T>) => {
            release();
            return result;
          };
          const batch = validateBrowserDatabaseReceiptProposalBatch(batchValue, options.hasher);
          if (!batch.ok) return reject(batch);
          const artifact = buildArtifact(batch.value, options.limits.maxPatchBytes);
          if (!artifact.ok) return reject(artifact);

          let signed: BrowserDatabaseReceiptProposalResult<SignedProposal>;
          try {
            signed = await options.signer.sign({ artifact: artifact.value, batch: batch.value });
          } catch {
            return reject(
              failed("receipt-proposal-signer-threw", "The injected passkey signer threw before submission."),
            );
          }
          if (!signed.ok) {
            return reject(failed("receipt-proposal-signer-rejected", signed.feedback.detail, signed.feedback.severity));
          }
          let expectedChangeDigest: string;
          try {
            expectedChangeDigest = await sha256Hex(artifact.value.patch.trim());
          } catch {
            return reject(
              failed(
                "receipt-proposal-signer-rejected",
                "The browser could not compute the signed patch digest before transport.",
              ),
            );
          }
          if (!validSignedProposal(signed.value, expectedChangeDigest)) {
            return reject(
              failed("receipt-proposal-signer-rejected", "The injected signer returned no finite proposal envelope."),
            );
          }
          const proposal = freezeSignedProposal(signed.value);

          let carried: BrowserDatabaseReceiptProposalResult<BrowserDatabaseReceiptProposalCarrierReceipt>;
          try {
            carried = await carrierLease.carry({
              artifact: artifact.value,
              batch: batch.value,
              proposal,
            });
          } catch {
            return reject(
              failed("receipt-proposal-carrier-threw", "The injected proposal carrier threw before submission."),
            );
          }
          if (!carried.ok) {
            return reject(
              failed("receipt-proposal-carrier-rejected", carried.feedback.detail, carried.feedback.severity),
            );
          }
          if (
            carried.value.proposalId !== proposal.proposalId ||
            carried.value.reference.length === 0 ||
            carried.value.reference.length > 4096 ||
            (carried.value.disposition !== "presented" && carried.value.disposition !== "submitted")
          ) {
            return reject(
              failed(
                "receipt-proposal-carrier-rejected",
                "The proposal carrier returned no exact bounded submission receipt.",
              ),
            );
          }
          carrierReserved = false;
          return succeeded(
            Object.freeze({
              schema: BROWSER_DATABASE_RECEIPT_PROPOSAL_SUBMISSION_SCHEMA,
              status: carried.value.disposition,
              proposalId: carried.value.proposalId,
              reference: carried.value.reference,
              contentHash: batch.value.contentHash,
              targetPath: artifact.value.targetPath,
            }),
          );
        },
      });
    },
  });
}
