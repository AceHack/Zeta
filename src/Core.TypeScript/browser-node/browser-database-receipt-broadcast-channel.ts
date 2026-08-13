import type {
  BrowserDatabaseReceiptPeerReceiver,
  BrowserDatabaseReceiptPeerTransport,
  BrowserDatabaseReceiptPeerTransportFeedback,
  BrowserDatabaseReceiptPeerTransportResult,
} from "./browser-database-receipt-peer-exchange";

export const BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA = "zeta.browser-database-receipt-broadcast-channel.v1" as const;
export const BROWSER_DATABASE_RECEIPT_BROADCAST_READOUT_SCHEMA =
  "zeta.browser-database-receipt-broadcast-readout.v1" as const;

export interface BrowserDatabaseReceiptBroadcastLimits {
  readonly maxRequestPayloadBytes: number;
  readonly maxResponsePayloadBytes: number;
  readonly maxInFlight: number;
}

export interface BrowserDatabaseReceiptBroadcastRequest {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA;
  readonly kind: "request";
  readonly sourcePeerId: string;
  readonly targetPeerId: string;
  readonly sequence: number;
  readonly payload: Uint8Array;
}

export interface BrowserDatabaseReceiptBroadcastSucceededResponse {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA;
  readonly kind: "response";
  readonly outcome: "succeeded";
  readonly sourcePeerId: string;
  readonly targetPeerId: string;
  readonly sequence: number;
  readonly payload: Uint8Array;
}

export interface BrowserDatabaseReceiptBroadcastFailedResponse {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA;
  readonly kind: "response";
  readonly outcome: "failed";
  readonly sourcePeerId: string;
  readonly targetPeerId: string;
  readonly sequence: number;
  readonly feedback: BrowserDatabaseReceiptPeerTransportFeedback;
}

export type BrowserDatabaseReceiptBroadcastResponse =
  | BrowserDatabaseReceiptBroadcastSucceededResponse
  | BrowserDatabaseReceiptBroadcastFailedResponse;

export interface BrowserDatabaseReceiptBroadcastReadout {
  readonly schema: typeof BROWSER_DATABASE_RECEIPT_BROADCAST_READOUT_SCHEMA;
  readonly role: "sender" | "receiver";
  readonly status: "idle" | "waiting" | "complete" | "backpressured" | "heat" | "closed";
  readonly localPeerId: string;
  readonly remotePeerId: string;
  readonly nextSequence: number | null;
  readonly lastSequence: number | null;
  readonly inFlight: number;
  readonly requestPayloadBytes: number;
  readonly responsePayloadBytes: number;
  readonly feedback: BrowserDatabaseReceiptPeerTransportFeedback | null;
}

export interface BrowserDatabaseReceiptBroadcastTransport extends BrowserDatabaseReceiptPeerTransport {
  read(): BrowserDatabaseReceiptBroadcastReadout;
  close(): BrowserDatabaseReceiptPeerTransportResult<null>;
}

export interface BrowserDatabaseReceiptBroadcastReceiverHost {
  read(): BrowserDatabaseReceiptBroadcastReadout;
  close(): BrowserDatabaseReceiptPeerTransportResult<null>;
}

export interface BrowserDatabaseReceiptBroadcastSenderOptions {
  readonly root: unknown;
  readonly channelName: string;
  readonly sourcePeerId: string;
  readonly targetPeerId: string;
  readonly initialSequence: number;
  readonly limits: BrowserDatabaseReceiptBroadcastLimits;
}

export interface BrowserDatabaseReceiptBroadcastReceiverOptions {
  readonly root: unknown;
  readonly channelName: string;
  readonly peerId: string;
  readonly sourcePeerId: string;
  readonly receiver: BrowserDatabaseReceiptPeerReceiver;
  readonly limits: BrowserDatabaseReceiptBroadcastLimits;
}

interface BroadcastMessageEventLike {
  readonly data?: unknown;
}

interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: BroadcastMessageEventLike) => void): void;
  removeEventListener(type: "message", listener: (event: BroadcastMessageEventLike) => void): void;
  close(): void;
}

type BroadcastChannelConstructorLike = new (name: string) => BroadcastChannelLike;

interface PendingExchange {
  readonly requestPayloadBytes: number;
  readonly resolve: (result: BrowserDatabaseReceiptPeerTransportResult<Uint8Array>) => void;
}

function succeeded<T>(value: T): BrowserDatabaseReceiptPeerTransportResult<T> {
  return { ok: true, value };
}

function failed(
  code: string,
  detail: string,
  severity: BrowserDatabaseReceiptPeerTransportFeedback["severity"] = "heat",
): BrowserDatabaseReceiptPeerTransportResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  try {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  } catch {
    return false;
  }
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validLimits(value: BrowserDatabaseReceiptBroadcastLimits): boolean {
  return (
    Number.isSafeInteger(value.maxRequestPayloadBytes) &&
    value.maxRequestPayloadBytes >= 1 &&
    Number.isSafeInteger(value.maxResponsePayloadBytes) &&
    value.maxResponsePayloadBytes >= 1 &&
    Number.isSafeInteger(value.maxInFlight) &&
    value.maxInFlight >= 1
  );
}

function validFeedback(value: unknown): value is BrowserDatabaseReceiptPeerTransportFeedback {
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

function copyFeedback(
  feedback: BrowserDatabaseReceiptPeerTransportFeedback,
): BrowserDatabaseReceiptPeerTransportFeedback {
  return { ...feedback };
}

function statusFor(
  feedback: BrowserDatabaseReceiptPeerTransportFeedback,
): BrowserDatabaseReceiptBroadcastReadout["status"] {
  return feedback.severity === "backpressure" ? "backpressured" : "heat";
}

function readout(
  role: BrowserDatabaseReceiptBroadcastReadout["role"],
  status: BrowserDatabaseReceiptBroadcastReadout["status"],
  localPeerId: string,
  remotePeerId: string,
  nextSequence: number | null,
  lastSequence: number | null,
  inFlight: number,
  requestPayloadBytes: number,
  responsePayloadBytes: number,
  feedback: BrowserDatabaseReceiptPeerTransportFeedback | null,
): BrowserDatabaseReceiptBroadcastReadout {
  return {
    schema: BROWSER_DATABASE_RECEIPT_BROADCAST_READOUT_SCHEMA,
    role,
    status,
    localPeerId,
    remotePeerId,
    nextSequence,
    lastSequence,
    inFlight,
    requestPayloadBytes,
    responsePayloadBytes,
    feedback: feedback === null ? null : copyFeedback(feedback),
  };
}

function hasMethod(value: unknown, name: string): boolean {
  if (!isRecord(value)) return false;
  try {
    return typeof Reflect.get(value, name) === "function";
  } catch {
    return false;
  }
}

function createNativeChannel(
  root: unknown,
  channelName: string,
): BrowserDatabaseReceiptPeerTransportResult<BroadcastChannelLike> {
  if (!isIdentifier(channelName)) {
    return failed(
      "receipt-broadcast-configuration-invalid",
      "A receipt BroadcastChannel name must be a bounded identifier.",
    );
  }
  if (root === null || (typeof root !== "object" && typeof root !== "function")) {
    return failed(
      "receipt-broadcast-channel-unavailable",
      "This runtime does not expose BroadcastChannel.",
      "backpressure",
    );
  }

  let constructorValue: unknown;
  try {
    constructorValue = Reflect.get(root, "BroadcastChannel");
  } catch {
    return failed("receipt-broadcast-channel-blocked", "This runtime blocked access to BroadcastChannel.");
  }
  if (typeof constructorValue !== "function") {
    return failed(
      "receipt-broadcast-channel-unavailable",
      "This runtime does not expose BroadcastChannel.",
      "backpressure",
    );
  }

  let channel: BroadcastChannelLike;
  try {
    channel = new (constructorValue as BroadcastChannelConstructorLike)(channelName);
  } catch {
    return failed("receipt-broadcast-channel-blocked", "This runtime refused to create a receipt BroadcastChannel.");
  }
  try {
    if (
      typeof channel.postMessage !== "function" ||
      typeof channel.addEventListener !== "function" ||
      typeof channel.removeEventListener !== "function" ||
      typeof channel.close !== "function"
    ) {
      try {
        channel.close();
      } catch {
        // The invalid channel shape is the primary feedback.
      }
      return failed("receipt-broadcast-channel-invalid", "BroadcastChannel does not satisfy the receipt byte port.");
    }
  } catch {
    try {
      channel.close();
    } catch {
      // Inspection failure is the primary feedback.
    }
    return failed("receipt-broadcast-channel-blocked", "This runtime blocked inspection of BroadcastChannel methods.");
  }
  return succeeded(channel);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function normalizeReceiverResult(value: unknown): BrowserDatabaseReceiptPeerTransportResult<Uint8Array> {
  if (!isRecord(value)) {
    return failed(
      "receipt-broadcast-receiver-invalid",
      "The injected receipt peer receiver returned neither bytes nor bounded feedback.",
    );
  }
  try {
    const ok = Reflect.get(value, "ok");
    if (ok === true) {
      const payload = Reflect.get(value, "value");
      return payload instanceof Uint8Array
        ? succeeded(new Uint8Array(payload))
        : failed("receipt-broadcast-response-invalid", "The injected receipt peer receiver returned no byte payload.");
    }
    if (ok === false) {
      const feedback = Reflect.get(value, "feedback");
      return validFeedback(feedback)
        ? { ok: false, feedback: copyFeedback(feedback) }
        : failed(
            "receipt-broadcast-receiver-invalid",
            "The injected receipt peer receiver returned unbounded feedback.",
          );
    }
  } catch {
    return failed(
      "receipt-broadcast-receiver-invalid",
      "The injected receipt peer receiver blocked inspection of its result.",
    );
  }
  return failed(
    "receipt-broadcast-receiver-invalid",
    "The injected receipt peer receiver returned neither bytes nor bounded feedback.",
  );
}

function senderConfigurationValid(options: BrowserDatabaseReceiptBroadcastSenderOptions): boolean {
  return (
    isIdentifier(options.sourcePeerId) &&
    isIdentifier(options.targetPeerId) &&
    options.sourcePeerId !== options.targetPeerId &&
    isSequence(options.initialSequence) &&
    validLimits(options.limits)
  );
}

/**
 * Create one finite request/reply client over native BroadcastChannel.
 * An unanswered request remains a resumable Promise until a response or explicit close;
 * this adapter introduces no clock or hidden timeout.
 */
export function createNativeBrowserDatabaseReceiptBroadcastTransport(
  options: BrowserDatabaseReceiptBroadcastSenderOptions,
): BrowserDatabaseReceiptPeerTransportResult<BrowserDatabaseReceiptBroadcastTransport> {
  if (!senderConfigurationValid(options)) {
    return failed(
      "receipt-broadcast-configuration-invalid",
      "A receipt broadcast sender requires distinct peer identities, a safe initial sequence, and finite capacities.",
    );
  }
  const channelResult = createNativeChannel(options.root, options.channelName);
  if (!channelResult.ok) return channelResult;
  const channel = channelResult.value;

  let closed = false;
  let nextSequence: number | null = options.initialSequence;
  const pending = new Map<number, PendingExchange>();
  let latest = readout("sender", "idle", options.sourcePeerId, options.targetPeerId, nextSequence, null, 0, 0, 0, null);

  const recordFeedback = (
    feedback: BrowserDatabaseReceiptPeerTransportFeedback,
    sequence: number | null,
    requestPayloadBytes: number,
    responsePayloadBytes: number,
  ): BrowserDatabaseReceiptPeerTransportResult<never> => {
    latest = readout(
      "sender",
      statusFor(feedback),
      options.sourcePeerId,
      options.targetPeerId,
      nextSequence,
      sequence,
      pending.size,
      requestPayloadBytes,
      responsePayloadBytes,
      feedback,
    );
    return { ok: false, feedback: copyFeedback(feedback) };
  };

  const settle = (
    sequence: number,
    result: BrowserDatabaseReceiptPeerTransportResult<Uint8Array>,
    responsePayloadBytes: number,
  ): void => {
    const exchange = pending.get(sequence);
    if (exchange === undefined) return;
    pending.delete(sequence);
    if (result.ok) {
      latest = readout(
        "sender",
        "complete",
        options.sourcePeerId,
        options.targetPeerId,
        nextSequence,
        sequence,
        pending.size,
        exchange.requestPayloadBytes,
        responsePayloadBytes,
        null,
      );
      exchange.resolve(succeeded(new Uint8Array(result.value)));
      return;
    }
    latest = readout(
      "sender",
      statusFor(result.feedback),
      options.sourcePeerId,
      options.targetPeerId,
      nextSequence,
      sequence,
      pending.size,
      exchange.requestPayloadBytes,
      responsePayloadBytes,
      result.feedback,
    );
    exchange.resolve({ ok: false, feedback: copyFeedback(result.feedback) });
  };

  const receive = (event: BroadcastMessageEventLike): void => {
    let value: unknown;
    try {
      value = event.data;
    } catch {
      const feedback = {
        severity: "heat" as const,
        code: "receipt-broadcast-response-invalid",
        detail: "The receipt BroadcastChannel blocked access to a response event.",
      };
      recordFeedback(feedback, null, 0, 0);
      return;
    }
    try {
      if (
        !isRecord(value) ||
        value.schema !== BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA ||
        value.kind !== "response" ||
        value.targetPeerId !== options.sourcePeerId
      ) {
        return;
      }
      if (value.sourcePeerId !== options.targetPeerId || !isSequence(value.sequence)) {
        const requestPayloadBytes = isSequence(value.sequence)
          ? (pending.get(value.sequence)?.requestPayloadBytes ?? 0)
          : 0;
        const feedback = {
          severity: "heat" as const,
          code: "receipt-broadcast-response-invalid",
          detail: "An addressed receipt response did not bind the configured remote peer and sequence.",
        };
        recordFeedback(feedback, isSequence(value.sequence) ? value.sequence : null, requestPayloadBytes, 0);
        return;
      }
      const exchange = pending.get(value.sequence);
      if (exchange === undefined) return;

      if (value.outcome === "succeeded") {
        if (!(value.payload instanceof Uint8Array)) {
          settle(
            value.sequence,
            failed("receipt-broadcast-response-invalid", "A successful receipt response carried no byte payload."),
            0,
          );
          return;
        }
        if (value.payload.byteLength > options.limits.maxResponsePayloadBytes) {
          settle(
            value.sequence,
            failed(
              "receipt-broadcast-response-capacity-exhausted",
              `The response carries ${value.payload.byteLength.toString()} payload bytes; its budget is ${options.limits.maxResponsePayloadBytes.toString()} bytes.`,
              "backpressure",
            ),
            value.payload.byteLength,
          );
          return;
        }
        settle(value.sequence, succeeded(new Uint8Array(value.payload)), value.payload.byteLength);
        return;
      }
      if (value.outcome === "failed" && validFeedback(value.feedback)) {
        settle(value.sequence, { ok: false, feedback: copyFeedback(value.feedback) }, 0);
        return;
      }
      settle(
        value.sequence,
        failed(
          "receipt-broadcast-response-invalid",
          "The receipt response carried neither bounded bytes nor feedback.",
        ),
        0,
      );
    } catch {
      recordFeedback(
        {
          severity: "heat",
          code: "receipt-broadcast-response-invalid",
          detail: "The receipt response blocked structural validation.",
        },
        null,
        0,
        0,
      );
    }
  };

  try {
    channel.addEventListener("message", receive);
  } catch {
    try {
      channel.close();
    } catch {
      // Listener setup failure is the primary result.
    }
    return failed("receipt-broadcast-subscribe-failed", "BroadcastChannel refused the receipt response listener.");
  }

  const transport: BrowserDatabaseReceiptBroadcastTransport = {
    read: () => ({ ...latest, feedback: latest.feedback === null ? null : copyFeedback(latest.feedback) }),
    exchange: (payload) => {
      if (closed) {
        return Promise.resolve(
          recordFeedback(
            {
              severity: "backpressure",
              code: "receipt-broadcast-channel-closed",
              detail: "The receipt BroadcastChannel sender is closed.",
            },
            null,
            payload instanceof Uint8Array ? payload.byteLength : 0,
            0,
          ),
        );
      }
      if (!(payload instanceof Uint8Array)) {
        return Promise.resolve(
          recordFeedback(
            {
              severity: "heat",
              code: "receipt-broadcast-request-invalid",
              detail: "Receipt broadcast exchange requires a byte payload.",
            },
            null,
            0,
            0,
          ),
        );
      }
      if (payload.byteLength > options.limits.maxRequestPayloadBytes) {
        return Promise.resolve(
          recordFeedback(
            {
              severity: "backpressure",
              code: "receipt-broadcast-request-capacity-exhausted",
              detail: `The request carries ${payload.byteLength.toString()} payload bytes; its budget is ${options.limits.maxRequestPayloadBytes.toString()} bytes.`,
            },
            null,
            payload.byteLength,
            0,
          ),
        );
      }
      if (pending.size >= options.limits.maxInFlight) {
        return Promise.resolve(
          recordFeedback(
            {
              severity: "backpressure",
              code: "receipt-broadcast-in-flight-capacity-exhausted",
              detail: `The sender already holds its ${options.limits.maxInFlight.toString()} in-flight exchanges.`,
            },
            null,
            payload.byteLength,
            0,
          ),
        );
      }
      if (nextSequence === null) {
        return Promise.resolve(
          recordFeedback(
            {
              severity: "backpressure",
              code: "receipt-broadcast-sequence-exhausted",
              detail: "The sender exhausted its safe deterministic request sequence.",
            },
            null,
            payload.byteLength,
            0,
          ),
        );
      }

      const sequence = nextSequence;
      nextSequence = sequence === Number.MAX_SAFE_INTEGER ? null : sequence + 1;
      const request: BrowserDatabaseReceiptBroadcastRequest = {
        schema: BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA,
        kind: "request",
        sourcePeerId: options.sourcePeerId,
        targetPeerId: options.targetPeerId,
        sequence,
        payload: new Uint8Array(payload),
      };
      return new Promise((resolve) => {
        pending.set(sequence, { requestPayloadBytes: payload.byteLength, resolve });
        latest = readout(
          "sender",
          "waiting",
          options.sourcePeerId,
          options.targetPeerId,
          nextSequence,
          sequence,
          pending.size,
          payload.byteLength,
          0,
          null,
        );
        try {
          channel.postMessage(request);
        } catch {
          settle(
            sequence,
            failed("receipt-broadcast-publish-failed", "BroadcastChannel refused the receipt request."),
            0,
          );
        }
      });
    },
    close: () => {
      if (closed) return succeeded(null);
      closed = true;
      let closeFeedback: BrowserDatabaseReceiptPeerTransportFeedback | null = null;
      try {
        channel.removeEventListener("message", receive);
      } catch {
        closeFeedback = {
          severity: "heat",
          code: "receipt-broadcast-unsubscribe-failed",
          detail: "BroadcastChannel refused to remove the receipt response listener.",
        };
      }
      try {
        channel.close();
      } catch {
        closeFeedback ??= {
          severity: "heat",
          code: "receipt-broadcast-close-failed",
          detail: "BroadcastChannel refused to close the receipt sender.",
        };
      }
      const cancellation = {
        severity: "backpressure" as const,
        code: "receipt-broadcast-channel-closed",
        detail: "The receipt BroadcastChannel sender closed with work still pending.",
      };
      for (const [sequence, exchange] of pending) {
        exchange.resolve({ ok: false, feedback: copyFeedback(cancellation) });
        pending.delete(sequence);
      }
      latest = readout(
        "sender",
        "closed",
        options.sourcePeerId,
        options.targetPeerId,
        nextSequence,
        latest.lastSequence,
        0,
        latest.requestPayloadBytes,
        latest.responsePayloadBytes,
        closeFeedback,
      );
      return closeFeedback === null ? succeeded(null) : { ok: false, feedback: closeFeedback };
    },
  };
  return succeeded(transport);
}

function receiverConfigurationValid(options: BrowserDatabaseReceiptBroadcastReceiverOptions): boolean {
  return (
    isIdentifier(options.peerId) &&
    isIdentifier(options.sourcePeerId) &&
    options.peerId !== options.sourcePeerId &&
    hasMethod(options.receiver, "receive") &&
    validLimits(options.limits)
  );
}

/** Host one receipt peer receiver on a native BroadcastChannel endpoint. */
export function createNativeBrowserDatabaseReceiptBroadcastReceiver(
  options: BrowserDatabaseReceiptBroadcastReceiverOptions,
): BrowserDatabaseReceiptPeerTransportResult<BrowserDatabaseReceiptBroadcastReceiverHost> {
  if (!receiverConfigurationValid(options)) {
    return failed(
      "receipt-broadcast-configuration-invalid",
      "A receipt broadcast receiver requires distinct peer identities, a byte receiver, and finite capacities.",
    );
  }
  const channelResult = createNativeChannel(options.root, options.channelName);
  if (!channelResult.ok) return channelResult;
  const channel = channelResult.value;

  let closed = false;
  const inFlight = new Map<number, Uint8Array>();
  let latest = readout("receiver", "idle", options.peerId, options.sourcePeerId, null, null, 0, 0, 0, null);

  const post = (response: BrowserDatabaseReceiptBroadcastResponse): BrowserDatabaseReceiptPeerTransportResult<null> => {
    try {
      channel.postMessage(response);
      return succeeded(null);
    } catch {
      return failed("receipt-broadcast-publish-failed", "BroadcastChannel refused the receipt response.");
    }
  };

  const responseFailure = (
    sequence: number,
    feedback: BrowserDatabaseReceiptPeerTransportFeedback,
  ): BrowserDatabaseReceiptBroadcastFailedResponse => ({
    schema: BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA,
    kind: "response",
    outcome: "failed",
    sourcePeerId: options.peerId,
    targetPeerId: options.sourcePeerId,
    sequence,
    feedback: copyFeedback(feedback),
  });

  const reject = (
    sequence: number,
    feedback: BrowserDatabaseReceiptPeerTransportFeedback,
    requestPayloadBytes: number,
  ): void => {
    const posted = post(responseFailure(sequence, feedback));
    const visibleFeedback = posted.ok ? feedback : posted.feedback;
    latest = readout(
      "receiver",
      statusFor(visibleFeedback),
      options.peerId,
      options.sourcePeerId,
      null,
      sequence,
      inFlight.size,
      requestPayloadBytes,
      0,
      visibleFeedback,
    );
  };

  const respond = async (sequence: number, payload: Uint8Array): Promise<void> => {
    let resultValue: unknown;
    try {
      resultValue = await options.receiver.receive(new Uint8Array(payload));
    } catch {
      resultValue = failed(
        "receipt-broadcast-receiver-failed",
        "The injected receipt peer receiver threw before returning bounded feedback.",
      );
    }
    const current = inFlight.get(sequence);
    if (closed || current === undefined || !sameBytes(current, payload)) return;
    inFlight.delete(sequence);

    const result = normalizeReceiverResult(resultValue);
    if (!result.ok) {
      reject(sequence, result.feedback, payload.byteLength);
      return;
    }
    if (result.value.byteLength > options.limits.maxResponsePayloadBytes) {
      reject(
        sequence,
        {
          severity: "backpressure",
          code: "receipt-broadcast-response-capacity-exhausted",
          detail: `The response carries ${result.value.byteLength.toString()} payload bytes; its budget is ${options.limits.maxResponsePayloadBytes.toString()} bytes.`,
        },
        payload.byteLength,
      );
      return;
    }

    const response: BrowserDatabaseReceiptBroadcastSucceededResponse = {
      schema: BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA,
      kind: "response",
      outcome: "succeeded",
      sourcePeerId: options.peerId,
      targetPeerId: options.sourcePeerId,
      sequence,
      payload: new Uint8Array(result.value),
    };
    const posted = post(response);
    latest = readout(
      "receiver",
      posted.ok ? "complete" : statusFor(posted.feedback),
      options.peerId,
      options.sourcePeerId,
      null,
      sequence,
      inFlight.size,
      payload.byteLength,
      result.value.byteLength,
      posted.ok ? null : posted.feedback,
    );
  };

  const receive = (event: BroadcastMessageEventLike): void => {
    let value: unknown;
    try {
      value = event.data;
    } catch {
      latest = readout("receiver", "heat", options.peerId, options.sourcePeerId, null, null, inFlight.size, 0, 0, {
        severity: "heat",
        code: "receipt-broadcast-request-invalid",
        detail: "The receipt BroadcastChannel blocked access to a request event.",
      });
      return;
    }
    try {
      if (
        closed ||
        !isRecord(value) ||
        value.schema !== BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA ||
        value.kind !== "request" ||
        value.targetPeerId !== options.peerId
      ) {
        return;
      }
      if (value.sourcePeerId !== options.sourcePeerId || !isSequence(value.sequence)) {
        latest = readout(
          "receiver",
          "heat",
          options.peerId,
          options.sourcePeerId,
          null,
          isSequence(value.sequence) ? value.sequence : null,
          inFlight.size,
          0,
          0,
          {
            severity: "heat",
            code: "receipt-broadcast-request-invalid",
            detail: "An addressed receipt request did not bind the configured source peer and sequence.",
          },
        );
        return;
      }
      if (!(value.payload instanceof Uint8Array)) {
        reject(
          value.sequence,
          {
            severity: "heat",
            code: "receipt-broadcast-request-invalid",
            detail: "The addressed receipt request carried no byte payload.",
          },
          0,
        );
        return;
      }
      if (value.payload.byteLength > options.limits.maxRequestPayloadBytes) {
        reject(
          value.sequence,
          {
            severity: "backpressure",
            code: "receipt-broadcast-request-capacity-exhausted",
            detail: `The request carries ${value.payload.byteLength.toString()} payload bytes; its budget is ${options.limits.maxRequestPayloadBytes.toString()} bytes.`,
          },
          value.payload.byteLength,
        );
        return;
      }
      const duplicate = inFlight.get(value.sequence);
      if (duplicate !== undefined) {
        if (!sameBytes(duplicate, value.payload)) {
          const feedback = {
            severity: "heat" as const,
            code: "receipt-broadcast-request-collision",
            detail: "One in-flight request sequence was reused for different receipt bytes.",
          };
          latest = readout(
            "receiver",
            "heat",
            options.peerId,
            options.sourcePeerId,
            null,
            value.sequence,
            inFlight.size,
            value.payload.byteLength,
            0,
            feedback,
          );
        }
        return;
      }
      if (inFlight.size >= options.limits.maxInFlight) {
        reject(
          value.sequence,
          {
            severity: "backpressure",
            code: "receipt-broadcast-in-flight-capacity-exhausted",
            detail: `The receiver already holds its ${options.limits.maxInFlight.toString()} in-flight exchanges.`,
          },
          value.payload.byteLength,
        );
        return;
      }

      const payload = new Uint8Array(value.payload);
      inFlight.set(value.sequence, payload);
      latest = readout(
        "receiver",
        "waiting",
        options.peerId,
        options.sourcePeerId,
        null,
        value.sequence,
        inFlight.size,
        payload.byteLength,
        0,
        null,
      );
      void respond(value.sequence, payload);
    } catch {
      latest = readout("receiver", "heat", options.peerId, options.sourcePeerId, null, null, inFlight.size, 0, 0, {
        severity: "heat",
        code: "receipt-broadcast-request-invalid",
        detail: "The receipt request blocked structural validation.",
      });
    }
  };

  try {
    channel.addEventListener("message", receive);
  } catch {
    try {
      channel.close();
    } catch {
      // Listener setup failure is the primary result.
    }
    return failed("receipt-broadcast-subscribe-failed", "BroadcastChannel refused the receipt request listener.");
  }

  return succeeded({
    read: () => ({ ...latest, feedback: latest.feedback === null ? null : copyFeedback(latest.feedback) }),
    close: () => {
      if (closed) return succeeded(null);
      closed = true;
      let closeFeedback: BrowserDatabaseReceiptPeerTransportFeedback | null = null;
      const cancellation = {
        severity: "backpressure" as const,
        code: "receipt-broadcast-channel-closed",
        detail: "The receipt BroadcastChannel receiver closed before finishing the request.",
      };
      for (const sequence of inFlight.keys()) {
        const posted = post(responseFailure(sequence, cancellation));
        if (!posted.ok) closeFeedback ??= posted.feedback;
      }
      inFlight.clear();
      try {
        channel.removeEventListener("message", receive);
      } catch {
        closeFeedback ??= {
          severity: "heat",
          code: "receipt-broadcast-unsubscribe-failed",
          detail: "BroadcastChannel refused to remove the receipt request listener.",
        };
      }
      try {
        channel.close();
      } catch {
        closeFeedback ??= {
          severity: "heat",
          code: "receipt-broadcast-close-failed",
          detail: "BroadcastChannel refused to close the receipt receiver.",
        };
      }
      latest = readout(
        "receiver",
        "closed",
        options.peerId,
        options.sourcePeerId,
        null,
        latest.lastSequence,
        0,
        latest.requestPayloadBytes,
        latest.responsePayloadBytes,
        closeFeedback,
      );
      return closeFeedback === null ? succeeded(null) : { ok: false, feedback: closeFeedback };
    },
  });
}
