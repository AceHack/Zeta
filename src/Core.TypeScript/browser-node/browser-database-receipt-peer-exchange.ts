import {
  copyBrowserDatabaseExecutionReceipt,
  validateBrowserDatabaseExecutionReceipt,
  type BrowserDatabaseExecutionReceipt,
} from "./browser-database-intent-outbox";
import {
  BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
  BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
  encodeBrowserDatabaseReceiptHandoffBody,
  type BrowserDatabaseReceiptBatchHasher,
  type BrowserDatabaseReceiptHandoffAcknowledgement,
  type BrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptHandoffBody,
  type BrowserDatabaseReceiptHandoffFeedback,
  type BrowserDatabaseReceiptHandoffPort,
  type BrowserDatabaseReceiptHandoffResult,
} from "./browser-database-receipt-handoff";

export const BROWSER_DATABASE_RECEIPT_PEER_REQUEST_SCHEMA = "zeta.browser-database-receipt-peer-request.v1" as const;
export const BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA = "zeta.browser-database-receipt-peer-response.v1" as const;
export const BROWSER_DATABASE_RECEIPT_PEER_READOUT_SCHEMA = "zeta.browser-database-receipt-peer-readout.v1" as const;

export interface BrowserDatabaseReceiptPeerLimits {
  readonly maxReceipts: number;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
}

export interface BrowserDatabaseReceiptPeerRequest {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_PEER_REQUEST_SCHEMA;
  readonly sourcePeerId: string;
  readonly targetPeerId: string;
  readonly targetNodeId: string;
  readonly batch: BrowserDatabaseReceiptHandoffBatch;
}

export interface BrowserDatabaseReceiptPeerRemoteFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code: string;
  readonly detail: string;
}

export interface BrowserDatabaseReceiptPeerAcknowledgedResponse {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA;
  readonly kind: "acknowledged";
  readonly sourcePeerId: string;
  readonly targetPeerId: string;
  readonly contentHash: string;
  readonly acknowledgement: BrowserDatabaseReceiptHandoffAcknowledgement;
}

export interface BrowserDatabaseReceiptPeerRejectedResponse {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA;
  readonly kind: "rejected";
  readonly sourcePeerId: string;
  readonly targetPeerId: string;
  readonly contentHash: string;
  readonly feedback: BrowserDatabaseReceiptPeerRemoteFeedback;
}

export type BrowserDatabaseReceiptPeerResponse =
  | BrowserDatabaseReceiptPeerAcknowledgedResponse
  | BrowserDatabaseReceiptPeerRejectedResponse;

export interface BrowserDatabaseReceiptPeerTransportFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code: string;
  readonly detail: string;
}

export type BrowserDatabaseReceiptPeerTransportResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserDatabaseReceiptPeerTransportFeedback };

/** One bounded request/reply exchange. Reticulum, WebRTC, or a local bus can implement it. */
export interface BrowserDatabaseReceiptPeerTransport {
  exchange(payload: Uint8Array): Promise<BrowserDatabaseReceiptPeerTransportResult<Uint8Array>>;
}

export interface BrowserDatabaseReceiptPeerReadout {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_PEER_READOUT_SCHEMA;
  readonly role: "sender" | "receiver";
  readonly status: "idle" | "complete" | "backpressured" | "heat";
  readonly localPeerId: string;
  readonly remotePeerId: string;
  readonly targetNodeId: string;
  readonly contentHash: string | null;
  readonly receiptCount: number;
  readonly requestBytes: number;
  readonly responseBytes: number;
  readonly disposition: "stored" | "duplicate" | null;
  readonly feedback: BrowserDatabaseReceiptHandoffFeedback | null;
}

export interface BrowserDatabaseReceiptPeerSender extends BrowserDatabaseReceiptHandoffPort {
  read(): BrowserDatabaseReceiptPeerReadout;
}

export interface BrowserDatabaseReceiptPeerReceiver {
  receive(payload: Uint8Array): Promise<BrowserDatabaseReceiptPeerTransportResult<Uint8Array>>;
  read(): BrowserDatabaseReceiptPeerReadout;
}

export interface BrowserDatabaseReceiptPeerSenderOptions {
  readonly sourcePeerId: string;
  readonly targetPeerId: string;
  readonly targetNodeId: string;
  readonly transport: BrowserDatabaseReceiptPeerTransport;
  readonly limits: BrowserDatabaseReceiptPeerLimits;
}

export interface BrowserDatabaseReceiptPeerReceiverOptions {
  readonly peerId: string;
  readonly sourcePeerId: string;
  readonly targetNodeId: string;
  readonly downstream: BrowserDatabaseReceiptHandoffPort;
  readonly hasher: BrowserDatabaseReceiptBatchHasher;
  readonly limits: BrowserDatabaseReceiptPeerLimits;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptHandoffResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserDatabaseReceiptHandoffFeedback["code"],
  detail: string,
  severity: BrowserDatabaseReceiptHandoffFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: BrowserDatabaseReceiptHandoffFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function peerSucceeded<T>(value: T): BrowserDatabaseReceiptPeerTransportResult<T> {
  return { ok: true, value };
}

function peerFailed(feedback: BrowserDatabaseReceiptHandoffFeedback): BrowserDatabaseReceiptPeerTransportResult<never> {
  return { ok: false, feedback: { ...feedback } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isContentHash(value: unknown): value is string {
  return typeof value === "string" && /^blake3:[0-9a-f]{64}$/.test(value);
}

function validLimits(value: BrowserDatabaseReceiptPeerLimits): boolean {
  return (
    Number.isSafeInteger(value.maxReceipts) &&
    value.maxReceipts >= 1 &&
    Number.isSafeInteger(value.maxRequestBytes) &&
    value.maxRequestBytes >= 1 &&
    Number.isSafeInteger(value.maxResponseBytes) &&
    value.maxResponseBytes >= 1
  );
}

function hasMethods(value: unknown, names: readonly string[]): boolean {
  if (!isRecord(value)) return false;
  try {
    return names.every((name) => typeof Reflect.get(value, name) === "function");
  } catch {
    return false;
  }
}

function copyBatch(batch: BrowserDatabaseReceiptHandoffBatch): BrowserDatabaseReceiptHandoffBatch {
  return { ...batch, receipts: batch.receipts.map(copyBrowserDatabaseExecutionReceipt) };
}

function copyAcknowledgement(
  acknowledgement: BrowserDatabaseReceiptHandoffAcknowledgement,
): BrowserDatabaseReceiptHandoffAcknowledgement {
  return { ...acknowledgement };
}

function statusFor(feedback: BrowserDatabaseReceiptHandoffFeedback): "backpressured" | "heat" {
  return feedback.severity === "backpressure" ? "backpressured" : "heat";
}

function readout(
  role: BrowserDatabaseReceiptPeerReadout["role"],
  status: BrowserDatabaseReceiptPeerReadout["status"],
  localPeerId: string,
  remotePeerId: string,
  targetNodeId: string,
  batch: BrowserDatabaseReceiptHandoffBatch | null,
  requestBytes: number,
  responseBytes: number,
  disposition: BrowserDatabaseReceiptPeerReadout["disposition"],
  feedback: BrowserDatabaseReceiptHandoffFeedback | null,
): BrowserDatabaseReceiptPeerReadout {
  return {
    schema: BROWSER_DATABASE_RECEIPT_PEER_READOUT_SCHEMA,
    role,
    status,
    localPeerId,
    remotePeerId,
    targetNodeId,
    contentHash: batch?.contentHash ?? null,
    receiptCount: batch?.receiptCount ?? 0,
    requestBytes,
    responseBytes,
    disposition,
    feedback: feedback === null ? null : { ...feedback },
  };
}

function encodeJson(
  value: unknown,
  maxBytes: number,
  invalidCode: "receipt-handoff-peer-request-invalid" | "receipt-handoff-peer-response-invalid",
  capacityCode: "receipt-handoff-peer-request-capacity-exhausted" | "receipt-handoff-peer-response-capacity-exhausted",
): BrowserDatabaseReceiptHandoffResult<Uint8Array> {
  let payload: Uint8Array;
  try {
    payload = new TextEncoder().encode(JSON.stringify(value));
  } catch {
    return failed(invalidCode, "The peer message could not be encoded as UTF-8 JSON.");
  }
  return payload.byteLength <= maxBytes
    ? succeeded(payload)
    : failed(
        capacityCode,
        `The peer message needs ${payload.byteLength.toString()} bytes; its budget is ${maxBytes.toString()} bytes.`,
        "backpressure",
      );
}

function decodeJson(
  payload: unknown,
  maxBytes: number,
  invalidCode: "receipt-handoff-peer-request-invalid" | "receipt-handoff-peer-response-invalid",
  capacityCode: "receipt-handoff-peer-request-capacity-exhausted" | "receipt-handoff-peer-response-capacity-exhausted",
): BrowserDatabaseReceiptHandoffResult<unknown> {
  if (!(payload instanceof Uint8Array)) {
    return failed(invalidCode, "The peer transport returned no byte payload.");
  }
  if (payload.byteLength > maxBytes) {
    return failed(
      capacityCode,
      `The peer message carries ${payload.byteLength.toString()} bytes; its budget is ${maxBytes.toString()} bytes.`,
      "backpressure",
    );
  }
  try {
    return succeeded(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload)) as unknown);
  } catch {
    return failed(invalidCode, "The peer message is not valid UTF-8 JSON.");
  }
}

function validateBatch(
  value: unknown,
  maxReceipts: number,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffBatch> {
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA ||
    !isIdentifier(value.databaseNodeId) ||
    !isIdentifier(value.archiveNodeId) ||
    value.databaseNodeId === value.archiveNodeId ||
    !isSequence(value.archiveRevision) ||
    !isSequence(value.firstSequence) ||
    !isSequence(value.highWaterSequence) ||
    !isSequence(value.receiptCount) ||
    value.receiptCount < 1 ||
    !Array.isArray(value.receipts) ||
    value.receipts.length !== value.receiptCount ||
    !isContentHash(value.contentHash)
  ) {
    return failed("receipt-handoff-batch-invalid", "The peer request carries no finite receipt handoff batch.");
  }
  if (value.receiptCount > maxReceipts) {
    return failed(
      "receipt-handoff-peer-request-capacity-exhausted",
      `The peer batch carries ${value.receiptCount.toString()} receipts; its budget is ${maxReceipts.toString()} receipts.`,
      "backpressure",
    );
  }

  const receipts: BrowserDatabaseExecutionReceipt[] = [];
  let previous: number | null = null;
  for (const candidate of value.receipts) {
    const receipt = validateBrowserDatabaseExecutionReceipt(candidate);
    if (
      !receipt.ok ||
      receipt.value.databaseNodeId !== value.databaseNodeId ||
      (previous !== null && receipt.value.sequence <= previous)
    ) {
      return failed(
        "receipt-handoff-batch-invalid",
        "Peer receipt batches require valid source-bound receipts in strictly increasing sequence order.",
      );
    }
    previous = receipt.value.sequence;
    receipts.push(receipt.value);
  }
  if (receipts[0]?.sequence !== value.firstSequence || receipts.at(-1)?.sequence !== value.highWaterSequence) {
    return failed("receipt-handoff-batch-invalid", "Peer receipt boundaries do not match their ordered receipts.");
  }
  return succeeded({
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
    databaseNodeId: value.databaseNodeId,
    archiveNodeId: value.archiveNodeId,
    archiveRevision: value.archiveRevision,
    firstSequence: value.firstSequence,
    highWaterSequence: value.highWaterSequence,
    receiptCount: value.receiptCount,
    receipts: receipts.map(copyBrowserDatabaseExecutionReceipt),
    contentHash: value.contentHash,
  });
}

function verifyContentHash(
  batch: BrowserDatabaseReceiptHandoffBatch,
  hasher: BrowserDatabaseReceiptBatchHasher,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffBatch> {
  const body: BrowserDatabaseReceiptHandoffBody = {
    schema: batch.schema,
    databaseNodeId: batch.databaseNodeId,
    archiveNodeId: batch.archiveNodeId,
    archiveRevision: batch.archiveRevision,
    firstSequence: batch.firstSequence,
    highWaterSequence: batch.highWaterSequence,
    receiptCount: batch.receiptCount,
    receipts: batch.receipts.map(copyBrowserDatabaseExecutionReceipt),
  };
  let actual: string;
  try {
    actual = hasher.hash(encodeBrowserDatabaseReceiptHandoffBody(body));
  } catch {
    return failed("receipt-handoff-hash-invalid", "The receiving peer's content hasher threw.");
  }
  return actual === batch.contentHash
    ? succeeded(copyBatch(batch))
    : failed("receipt-handoff-hash-invalid", "The receiving peer recomputed a different receipt batch digest.");
}

function decodeRequest(
  payload: Uint8Array,
  options: BrowserDatabaseReceiptPeerReceiverOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptPeerRequest> {
  const decoded = decodeJson(
    payload,
    options.limits.maxRequestBytes,
    "receipt-handoff-peer-request-invalid",
    "receipt-handoff-peer-request-capacity-exhausted",
  );
  if (!decoded.ok) return decoded;
  const value = decoded.value;
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_DATABASE_RECEIPT_PEER_REQUEST_SCHEMA ||
    value.sourcePeerId !== options.sourcePeerId ||
    value.targetPeerId !== options.peerId ||
    value.targetNodeId !== options.targetNodeId
  ) {
    return failed(
      "receipt-handoff-peer-request-invalid",
      "The receipt request is not addressed to the configured peer and target database.",
    );
  }
  const batch = validateBatch(value.batch, options.limits.maxReceipts);
  if (!batch.ok) return batch;
  const verified = verifyContentHash(batch.value, options.hasher);
  return verified.ok
    ? succeeded({
        schema: BROWSER_DATABASE_RECEIPT_PEER_REQUEST_SCHEMA,
        sourcePeerId: options.sourcePeerId,
        targetPeerId: options.peerId,
        targetNodeId: options.targetNodeId,
        batch: verified.value,
      })
    : verified;
}

function validRemoteFeedback(value: unknown): value is BrowserDatabaseReceiptPeerRemoteFeedback {
  return (
    isRecord(value) &&
    (value.severity === "backpressure" || value.severity === "heat") &&
    typeof value.code === "string" &&
    value.code.length > 0 &&
    value.code.length <= 256 &&
    !/[\u0000-\u001f\u007f]/.test(value.code) &&
    typeof value.detail === "string" &&
    value.detail.length <= 4096 &&
    !/[\u0000-\u001f\u007f]/.test(value.detail)
  );
}

function validateAcknowledgement(
  value: unknown,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffAcknowledgement> {
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA ||
    !isIdentifier(value.targetNodeId) ||
    !isIdentifier(value.databaseNodeId) ||
    !isIdentifier(value.archiveNodeId) ||
    !isSequence(value.archiveRevision) ||
    !isSequence(value.highWaterSequence) ||
    !isSequence(value.receiptCount) ||
    value.receiptCount < 1 ||
    !isContentHash(value.contentHash) ||
    (value.disposition !== "stored" && value.disposition !== "duplicate")
  ) {
    return failed("receipt-handoff-peer-response-invalid", "The peer response contains no valid acknowledgement.");
  }
  return succeeded({
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
    targetNodeId: value.targetNodeId,
    databaseNodeId: value.databaseNodeId,
    archiveNodeId: value.archiveNodeId,
    archiveRevision: value.archiveRevision,
    highWaterSequence: value.highWaterSequence,
    receiptCount: value.receiptCount,
    contentHash: value.contentHash,
    disposition: value.disposition,
  });
}

function decodeResponse(
  payload: unknown,
  limits: BrowserDatabaseReceiptPeerLimits,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptPeerResponse> {
  const decoded = decodeJson(
    payload,
    limits.maxResponseBytes,
    "receipt-handoff-peer-response-invalid",
    "receipt-handoff-peer-response-capacity-exhausted",
  );
  if (!decoded.ok) return decoded;
  const value = decoded.value;
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA ||
    (value.kind !== "acknowledged" && value.kind !== "rejected") ||
    !isIdentifier(value.sourcePeerId) ||
    !isIdentifier(value.targetPeerId) ||
    !isContentHash(value.contentHash)
  ) {
    return failed("receipt-handoff-peer-response-invalid", "The peer transport returned no valid receipt response.");
  }
  if (value.kind === "rejected") {
    return validRemoteFeedback(value.feedback)
      ? succeeded({
          schema: BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA,
          kind: "rejected",
          sourcePeerId: value.sourcePeerId,
          targetPeerId: value.targetPeerId,
          contentHash: value.contentHash,
          feedback: { ...value.feedback },
        })
      : failed("receipt-handoff-peer-response-invalid", "The peer rejection contains no bounded feedback.");
  }
  const acknowledgement = validateAcknowledgement(value.acknowledgement);
  return acknowledgement.ok
    ? succeeded({
        schema: BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA,
        kind: "acknowledged",
        sourcePeerId: value.sourcePeerId,
        targetPeerId: value.targetPeerId,
        contentHash: value.contentHash,
        acknowledgement: acknowledgement.value,
      })
    : acknowledgement;
}

function acknowledgementMatches(
  acknowledgement: BrowserDatabaseReceiptHandoffAcknowledgement,
  batch: BrowserDatabaseReceiptHandoffBatch,
  targetNodeId: string,
): boolean {
  return (
    acknowledgement.targetNodeId === targetNodeId &&
    acknowledgement.databaseNodeId === batch.databaseNodeId &&
    acknowledgement.archiveNodeId === batch.archiveNodeId &&
    acknowledgement.archiveRevision === batch.archiveRevision &&
    acknowledgement.highWaterSequence === batch.highWaterSequence &&
    acknowledgement.receiptCount === batch.receiptCount &&
    acknowledgement.contentHash === batch.contentHash
  );
}

function transportFailure(value: unknown): BrowserDatabaseReceiptHandoffFeedback {
  if (validRemoteFeedback(value)) {
    return {
      severity: value.severity,
      code:
        value.severity === "backpressure"
          ? "receipt-handoff-downstream-backpressured"
          : "receipt-handoff-peer-transport-failed",
      detail: `Peer transport ${value.code}: ${value.detail}`,
    };
  }
  return {
    severity: "heat",
    code: "receipt-handoff-peer-response-invalid",
    detail: "The peer transport returned neither bytes nor bounded feedback.",
  };
}

/** Adapt a bounded peer exchange into the downstream port used by receipt handoff. */
export function createBrowserDatabaseReceiptPeerSender(
  options: BrowserDatabaseReceiptPeerSenderOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptPeerSender> {
  if (
    !isIdentifier(options.sourcePeerId) ||
    !isIdentifier(options.targetPeerId) ||
    !isIdentifier(options.targetNodeId) ||
    options.sourcePeerId === options.targetPeerId ||
    !hasMethods(options.transport, ["exchange"]) ||
    !validLimits(options.limits)
  ) {
    return failed(
      "receipt-handoff-peer-configuration-invalid",
      "A receipt peer sender requires distinct peer identities, an exchange port, and finite message budgets.",
    );
  }

  let latest = readout(
    "sender",
    "idle",
    options.sourcePeerId,
    options.targetPeerId,
    options.targetNodeId,
    null,
    0,
    0,
    null,
    null,
  );
  const failWith = (
    feedback: BrowserDatabaseReceiptHandoffFeedback,
    batch: BrowserDatabaseReceiptHandoffBatch,
    requestBytes: number,
    responseBytes: number,
  ): BrowserDatabaseReceiptHandoffResult<never> => {
    latest = readout(
      "sender",
      statusFor(feedback),
      options.sourcePeerId,
      options.targetPeerId,
      options.targetNodeId,
      batch,
      requestBytes,
      responseBytes,
      null,
      feedback,
    );
    return { ok: false, feedback };
  };

  return succeeded({
    read: () => ({ ...latest, feedback: latest.feedback === null ? null : { ...latest.feedback } }),
    handoff: async (batchValue) => {
      const batch = validateBatch(batchValue, options.limits.maxReceipts);
      if (!batch.ok) return batch;
      const request: BrowserDatabaseReceiptPeerRequest = {
        schema: BROWSER_DATABASE_RECEIPT_PEER_REQUEST_SCHEMA,
        sourcePeerId: options.sourcePeerId,
        targetPeerId: options.targetPeerId,
        targetNodeId: options.targetNodeId,
        batch: batch.value,
      };
      const encoded = encodeJson(
        request,
        options.limits.maxRequestBytes,
        "receipt-handoff-peer-request-invalid",
        "receipt-handoff-peer-request-capacity-exhausted",
      );
      if (!encoded.ok) return failWith(encoded.feedback, batch.value, 0, 0);

      let exchanged: BrowserDatabaseReceiptPeerTransportResult<Uint8Array>;
      try {
        exchanged = await options.transport.exchange(new Uint8Array(encoded.value));
      } catch {
        return failWith(
          {
            severity: "heat",
            code: "receipt-handoff-peer-transport-failed",
            detail: "The injected peer transport threw before returning a response.",
          },
          batch.value,
          encoded.value.byteLength,
          0,
        );
      }
      if (!isRecord(exchanged) || typeof exchanged.ok !== "boolean") {
        return failWith(transportFailure(exchanged), batch.value, encoded.value.byteLength, 0);
      }
      if (!exchanged.ok) {
        return failWith(transportFailure(exchanged.feedback), batch.value, encoded.value.byteLength, 0);
      }
      const responseBytes = exchanged.value instanceof Uint8Array ? exchanged.value.byteLength : 0;
      const response = decodeResponse(exchanged.value, options.limits);
      if (!response.ok) {
        return failWith(response.feedback, batch.value, encoded.value.byteLength, responseBytes);
      }
      if (
        response.value.sourcePeerId !== options.targetPeerId ||
        response.value.targetPeerId !== options.sourcePeerId ||
        response.value.contentHash !== batch.value.contentHash
      ) {
        return failWith(
          {
            severity: "heat",
            code: "receipt-handoff-peer-response-invalid",
            detail: "The peer response does not bind the configured peers and receipt content address.",
          },
          batch.value,
          encoded.value.byteLength,
          responseBytes,
        );
      }
      if (response.value.kind === "rejected") {
        const feedback: BrowserDatabaseReceiptHandoffFeedback = {
          severity: response.value.feedback.severity,
          code:
            response.value.feedback.severity === "backpressure"
              ? "receipt-handoff-downstream-backpressured"
              : "receipt-handoff-peer-target-rejected",
          detail: `Peer target ${response.value.feedback.code}: ${response.value.feedback.detail}`,
        };
        return failWith(feedback, batch.value, encoded.value.byteLength, responseBytes);
      }
      if (!acknowledgementMatches(response.value.acknowledgement, batch.value, options.targetNodeId)) {
        return failWith(
          {
            severity: "heat",
            code: "receipt-handoff-peer-response-invalid",
            detail: "The peer acknowledgement does not bind the complete receipt batch.",
          },
          batch.value,
          encoded.value.byteLength,
          responseBytes,
        );
      }
      latest = readout(
        "sender",
        "complete",
        options.sourcePeerId,
        options.targetPeerId,
        options.targetNodeId,
        batch.value,
        encoded.value.byteLength,
        responseBytes,
        response.value.acknowledgement.disposition,
        null,
      );
      return succeeded(copyAcknowledgement(response.value.acknowledgement));
    },
  });
}

function responseForFailure(
  options: BrowserDatabaseReceiptPeerReceiverOptions,
  request: BrowserDatabaseReceiptPeerRequest,
  feedback: BrowserDatabaseReceiptHandoffFeedback,
): BrowserDatabaseReceiptPeerRejectedResponse {
  return {
    schema: BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA,
    kind: "rejected",
    sourcePeerId: options.peerId,
    targetPeerId: options.sourcePeerId,
    contentHash: request.batch.contentHash,
    feedback: { ...feedback },
  };
}

/** Receive, independently verify, and persist one addressed receipt batch. */
export function createBrowserDatabaseReceiptPeerReceiver(
  options: BrowserDatabaseReceiptPeerReceiverOptions,
): BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptPeerReceiver> {
  if (
    !isIdentifier(options.peerId) ||
    !isIdentifier(options.sourcePeerId) ||
    !isIdentifier(options.targetNodeId) ||
    options.peerId === options.sourcePeerId ||
    !hasMethods(options.downstream, ["handoff"]) ||
    !hasMethods(options.hasher, ["hash"]) ||
    !validLimits(options.limits)
  ) {
    return failed(
      "receipt-handoff-peer-configuration-invalid",
      "A receipt peer receiver requires distinct peer identities, a local handoff port, a hasher, and finite budgets.",
    );
  }

  let latest = readout(
    "receiver",
    "idle",
    options.peerId,
    options.sourcePeerId,
    options.targetNodeId,
    null,
    0,
    0,
    null,
    null,
  );
  const failReceive = (
    feedback: BrowserDatabaseReceiptHandoffFeedback,
    batch: BrowserDatabaseReceiptHandoffBatch | null,
    requestBytes: number,
  ): BrowserDatabaseReceiptPeerTransportResult<never> => {
    latest = readout(
      "receiver",
      statusFor(feedback),
      options.peerId,
      options.sourcePeerId,
      options.targetNodeId,
      batch,
      requestBytes,
      0,
      null,
      feedback,
    );
    return peerFailed(feedback);
  };
  const encodeResponse = (
    response: BrowserDatabaseReceiptPeerResponse,
    batch: BrowserDatabaseReceiptHandoffBatch,
    requestBytes: number,
    feedback: BrowserDatabaseReceiptHandoffFeedback | null,
    disposition: BrowserDatabaseReceiptPeerReadout["disposition"],
  ): BrowserDatabaseReceiptPeerTransportResult<Uint8Array> => {
    const encoded = encodeJson(
      response,
      options.limits.maxResponseBytes,
      "receipt-handoff-peer-response-invalid",
      "receipt-handoff-peer-response-capacity-exhausted",
    );
    if (!encoded.ok) return failReceive(encoded.feedback, batch, requestBytes);
    latest = readout(
      "receiver",
      feedback === null ? "complete" : statusFor(feedback),
      options.peerId,
      options.sourcePeerId,
      options.targetNodeId,
      batch,
      requestBytes,
      encoded.value.byteLength,
      disposition,
      feedback,
    );
    return peerSucceeded(new Uint8Array(encoded.value));
  };

  return succeeded({
    read: () => ({ ...latest, feedback: latest.feedback === null ? null : { ...latest.feedback } }),
    receive: async (payload) => {
      const requestBytes = payload instanceof Uint8Array ? payload.byteLength : 0;
      const request = decodeRequest(payload, options);
      if (!request.ok) return failReceive(request.feedback, null, requestBytes);

      let handed: BrowserDatabaseReceiptHandoffResult<BrowserDatabaseReceiptHandoffAcknowledgement>;
      try {
        handed = await options.downstream.handoff(copyBatch(request.value.batch));
      } catch {
        handed = failed(
          "receipt-handoff-downstream-threw",
          "The receiving peer's local receipt target threw before acknowledging persistence.",
        );
      }
      if (!handed.ok) {
        return encodeResponse(
          responseForFailure(options, request.value, handed.feedback),
          request.value.batch,
          requestBytes,
          handed.feedback,
          null,
        );
      }
      if (!acknowledgementMatches(handed.value, request.value.batch, options.targetNodeId)) {
        const feedback: BrowserDatabaseReceiptHandoffFeedback = {
          severity: "heat",
          code: "receipt-handoff-ack-invalid",
          detail: "The receiving peer's local store returned no exact batch acknowledgement.",
        };
        return encodeResponse(
          responseForFailure(options, request.value, feedback),
          request.value.batch,
          requestBytes,
          feedback,
          null,
        );
      }
      const response: BrowserDatabaseReceiptPeerAcknowledgedResponse = {
        schema: BROWSER_DATABASE_RECEIPT_PEER_RESPONSE_SCHEMA,
        kind: "acknowledged",
        sourcePeerId: options.peerId,
        targetPeerId: options.sourcePeerId,
        contentHash: request.value.batch.contentHash,
        acknowledgement: copyAcknowledgement(handed.value),
      };
      return encodeResponse(response, request.value.batch, requestBytes, null, handed.value.disposition);
    },
  });
}
