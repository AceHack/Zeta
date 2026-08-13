import { describe, expect, test } from "bun:test";
import { ContentHash256 } from "../blake3/blake3";
import type { BrowserDatabaseExecutionReceipt } from "./browser-database-intent-outbox";
import {
  BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
  BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
  encodeBrowserDatabaseReceiptHandoffBody,
  type BrowserDatabaseReceiptHandoffAcknowledgement,
  type BrowserDatabaseReceiptHandoffBatch,
} from "./browser-database-receipt-handoff";
import {
  BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA,
  createNativeBrowserDatabaseReceiptBroadcastReceiver,
  createNativeBrowserDatabaseReceiptBroadcastTransport,
  type BrowserDatabaseReceiptBroadcastLimits,
  type BrowserDatabaseReceiptBroadcastRequest,
} from "./browser-database-receipt-broadcast-channel";
import {
  createBrowserDatabaseReceiptPeerReceiver,
  createBrowserDatabaseReceiptPeerSender,
  type BrowserDatabaseReceiptPeerTransportResult,
} from "./browser-database-receipt-peer-exchange";

interface MessageEventLike {
  readonly data?: unknown;
}

interface FakeChannel {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
  close(): void;
}

interface FakeBroadcastBus {
  readonly root: unknown;
  publish(channelName: string, message: unknown): void;
  openChannels(): number;
}

function cloneMessage(value: unknown): unknown {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (Array.isArray(value)) return value.map(cloneMessage);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneMessage(item)]));
  }
  return value;
}

function createFakeBroadcastBus(): FakeBroadcastBus {
  const channels = new Map<string, Set<FakeNativeBroadcastChannel>>();

  class FakeNativeBroadcastChannel implements FakeChannel {
    readonly #name: string;
    readonly #listeners = new Set<(event: MessageEventLike) => void>();
    #closed = false;

    constructor(name: string) {
      this.#name = name;
      const group = channels.get(name) ?? new Set<FakeNativeBroadcastChannel>();
      group.add(this);
      channels.set(name, group);
    }

    postMessage(message: unknown): void {
      if (this.#closed) throw new Error("closed");
      for (const channel of channels.get(this.#name) ?? []) {
        if (channel === this || channel.#closed) continue;
        const copied = cloneMessage(message);
        for (const listener of channel.#listeners) listener({ data: copied });
      }
    }

    addEventListener(type: "message", listener: (event: MessageEventLike) => void): void {
      if (type !== "message" || this.#closed) throw new Error("invalid subscription");
      this.#listeners.add(listener);
    }

    removeEventListener(type: "message", listener: (event: MessageEventLike) => void): void {
      if (type !== "message") throw new Error("invalid unsubscription");
      this.#listeners.delete(listener);
    }

    close(): void {
      if (this.#closed) return;
      this.#closed = true;
      this.#listeners.clear();
      channels.get(this.#name)?.delete(this);
    }
  }

  return {
    root: { BroadcastChannel: FakeNativeBroadcastChannel },
    publish: (channelName, message) => {
      const publisher = new FakeNativeBroadcastChannel(channelName);
      publisher.postMessage(message);
      publisher.close();
    },
    openChannels: () => [...channels.values()].reduce((total, group) => total + group.size, 0),
  };
}

const channelName = "zeta.receipts.test";
const sourcePeerId = "browser/tab-source";
const targetPeerId = "browser/tab-target";
const databaseNodeId = "browser/database";
const archiveNodeId = "browser/database:receipts";
const targetNodeId = "browser/peer:durable";
const limits: BrowserDatabaseReceiptBroadcastLimits = {
  maxRequestPayloadBytes: 64 * 1024,
  maxResponsePayloadBytes: 16 * 1024,
  maxInFlight: 2,
};

function hash(payload: Uint8Array): string {
  return `blake3:${ContentHash256.ofBytes(payload).toHex()}`;
}

function receipt(sequence: number): BrowserDatabaseExecutionReceipt {
  return {
    schema: "zeta.browser-database-execution-receipt.v1",
    databaseNodeId,
    intentId: `event/${sequence.toString()}`,
    sequence,
    status: "settled",
    executorId: sourcePeerId,
    executorKind: "browser-tab",
    revision: sequence + 1,
    accepted: 1,
    duplicates: 0,
    deltaCount: 1,
  };
}

function batch(...sequences: readonly number[]): BrowserDatabaseReceiptHandoffBatch {
  const receipts = sequences.map(receipt);
  const first = receipts[0];
  const last = receipts.at(-1);
  if (first === undefined || last === undefined) throw new Error("test batches require receipts");
  const body = {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_BATCH_SCHEMA,
    databaseNodeId,
    archiveNodeId,
    archiveRevision: receipts.length,
    firstSequence: first.sequence,
    highWaterSequence: last.sequence,
    receiptCount: receipts.length,
    receipts,
  };
  return { ...body, contentHash: hash(encodeBrowserDatabaseReceiptHandoffBody(body)) };
}

function acknowledgement(value: BrowserDatabaseReceiptHandoffBatch): BrowserDatabaseReceiptHandoffAcknowledgement {
  return {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
    targetNodeId,
    databaseNodeId: value.databaseNodeId,
    archiveNodeId: value.archiveNodeId,
    archiveRevision: value.archiveRevision,
    highWaterSequence: value.highWaterSequence,
    receiptCount: value.receiptCount,
    contentHash: value.contentHash,
    disposition: "stored",
  };
}

function unwrap<T>(result: BrowserDatabaseReceiptPeerTransportResult<T>): T {
  if (!result.ok) throw new Error(result.feedback.detail);
  return result.value;
}

function request(sequence: number, payload: Uint8Array): BrowserDatabaseReceiptBroadcastRequest {
  return {
    schema: BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA,
    kind: "request",
    sourcePeerId,
    targetPeerId,
    sequence,
    payload,
  };
}

describe("native browser database receipt BroadcastChannel", () => {
  test("carries a complete receipt handoff between addressed peers", async () => {
    const bus = createFakeBroadcastBus();
    const persisted: BrowserDatabaseReceiptHandoffBatch[] = [];
    const peerReceiver = unwrap(
      createBrowserDatabaseReceiptPeerReceiver({
        peerId: targetPeerId,
        sourcePeerId,
        targetNodeId,
        downstream: {
          handoff: (value) => {
            persisted.push(value);
            return Promise.resolve({ ok: true, value: acknowledgement(value) });
          },
        },
        hasher: { hash },
        limits: { maxReceipts: 8, maxRequestBytes: 64 * 1024, maxResponseBytes: 16 * 1024 },
      }),
    );
    const receiver = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastReceiver({
        root: bus.root,
        channelName,
        peerId: targetPeerId,
        sourcePeerId,
        receiver: peerReceiver,
        limits,
      }),
    );
    const transport = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: bus.root,
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: 40,
        limits,
      }),
    );
    const sender = unwrap(
      createBrowserDatabaseReceiptPeerSender({
        sourcePeerId,
        targetPeerId,
        targetNodeId,
        transport,
        limits: { maxReceipts: 8, maxRequestBytes: 64 * 1024, maxResponseBytes: 16 * 1024 },
      }),
    );
    const value = batch(2, 3);

    expect(await sender.handoff(value)).toMatchObject({
      ok: true,
      value: { contentHash: value.contentHash, disposition: "stored" },
    });
    expect(persisted).toEqual([value]);
    expect(transport.read()).toMatchObject({
      role: "sender",
      status: "complete",
      lastSequence: 40,
      nextSequence: 41,
      inFlight: 0,
    });
    expect(receiver.read()).toMatchObject({ role: "receiver", status: "complete", lastSequence: 40, inFlight: 0 });
    expect(transport.read().requestPayloadBytes).toBeGreaterThan(0);
    expect(receiver.close()).toEqual({ ok: true, value: null });
    expect(transport.close()).toEqual({ ok: true, value: null });
    expect(bus.openChannels()).toBe(0);
  });

  test("backpressures a second sender exchange while preserving the first continuation", async () => {
    const bus = createFakeBroadcastBus();
    let release: ((result: BrowserDatabaseReceiptPeerTransportResult<Uint8Array>) => void) | undefined;
    const receiver = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastReceiver({
        root: bus.root,
        channelName,
        peerId: targetPeerId,
        sourcePeerId,
        receiver: {
          receive: () =>
            new Promise((resolve) => {
              release = resolve;
            }),
          read: () => {
            throw new Error("unused");
          },
        },
        limits,
      }),
    );
    const transport = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: bus.root,
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: 0,
        limits: { ...limits, maxInFlight: 1 },
      }),
    );

    const first = transport.exchange(new Uint8Array([1, 2, 3]));
    expect(transport.read()).toMatchObject({ status: "waiting", inFlight: 1, lastSequence: 0 });
    expect(await transport.exchange(new Uint8Array([4]))).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-broadcast-in-flight-capacity-exhausted" },
    });
    if (release === undefined) throw new Error("receiver did not retain the first request");
    release({ ok: true, value: new Uint8Array([9]) });
    expect(await first).toEqual({ ok: true, value: new Uint8Array([9]) });
    expect(transport.read()).toMatchObject({ status: "complete", inFlight: 0, lastSequence: 0 });
    receiver.close();
    transport.close();
  });

  test("receiver capacity returns bounded feedback without consuming the admitted request", async () => {
    const bus = createFakeBroadcastBus();
    let release: ((result: BrowserDatabaseReceiptPeerTransportResult<Uint8Array>) => void) | undefined;
    const receiver = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastReceiver({
        root: bus.root,
        channelName,
        peerId: targetPeerId,
        sourcePeerId,
        receiver: {
          receive: () =>
            new Promise((resolve) => {
              release = resolve;
            }),
          read: () => {
            throw new Error("unused");
          },
        },
        limits: { ...limits, maxInFlight: 1 },
      }),
    );
    const transport = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: bus.root,
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: 7,
        limits,
      }),
    );

    const admitted = transport.exchange(new Uint8Array([1]));
    expect(await transport.exchange(new Uint8Array([2]))).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-broadcast-in-flight-capacity-exhausted" },
    });
    expect(receiver.read()).toMatchObject({ status: "backpressured", inFlight: 1, lastSequence: 8 });
    if (release === undefined) throw new Error("receiver did not retain the admitted request");
    release({ ok: true, value: new Uint8Array([3]) });
    expect(await admitted).toEqual({ ok: true, value: new Uint8Array([3]) });
    receiver.close();
    transport.close();
  });

  test("ignores other peer traffic and isolates conflicting reuse of an in-flight sequence", async () => {
    const bus = createFakeBroadcastBus();
    let release: ((result: BrowserDatabaseReceiptPeerTransportResult<Uint8Array>) => void) | undefined;
    const receiver = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastReceiver({
        root: bus.root,
        channelName,
        peerId: targetPeerId,
        sourcePeerId,
        receiver: {
          receive: () =>
            new Promise((resolve) => {
              release = resolve;
            }),
          read: () => {
            throw new Error("unused");
          },
        },
        limits,
      }),
    );
    const transport = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: bus.root,
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: 12,
        limits,
      }),
    );

    bus.publish(channelName, { ...request(99, new Uint8Array([0])), targetPeerId: "browser/another-peer" });
    expect(receiver.read()).toMatchObject({ status: "idle", inFlight: 0 });

    const pending = transport.exchange(new Uint8Array([1]));
    bus.publish(channelName, request(12, new Uint8Array([2])));
    expect(receiver.read()).toMatchObject({ status: "heat", inFlight: 1, lastSequence: 12 });
    expect(transport.read()).toMatchObject({ status: "waiting", inFlight: 1, lastSequence: 12 });
    if (release === undefined) throw new Error("receiver did not retain the original request");
    release({ ok: true, value: new Uint8Array([3]) });
    expect(await pending).toEqual({ ok: true, value: new Uint8Array([3]) });
    receiver.close();
    transport.close();
  });

  test("wrong-peer responses cannot steal a pending continuation", async () => {
    const bus = createFakeBroadcastBus();
    const transport = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: bus.root,
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: 21,
        limits,
      }),
    );
    const pending = transport.exchange(new Uint8Array([1, 2]));

    bus.publish(channelName, {
      schema: BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA,
      kind: "response",
      outcome: "succeeded",
      sourcePeerId: "browser/wrong-peer",
      targetPeerId: sourcePeerId,
      sequence: 21,
      payload: new Uint8Array([8]),
    });
    expect(transport.read()).toMatchObject({
      status: "heat",
      inFlight: 1,
      requestPayloadBytes: 2,
      feedback: { code: "receipt-broadcast-response-invalid" },
    });

    bus.publish(channelName, {
      schema: BROWSER_DATABASE_RECEIPT_BROADCAST_SCHEMA,
      kind: "response",
      outcome: "succeeded",
      sourcePeerId: targetPeerId,
      targetPeerId: sourcePeerId,
      sequence: 21,
      payload: new Uint8Array([9]),
    });
    expect(await pending).toEqual({ ok: true, value: new Uint8Array([9]) });
    expect(transport.read()).toMatchObject({ status: "complete", inFlight: 0, lastSequence: 21 });
    transport.close();
  });

  test("explicit close resumes unanswered requests and receiver-side pending work", async () => {
    const bus = createFakeBroadcastBus();
    const transportWithoutPeer = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: bus.root,
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: 0,
        limits,
      }),
    );
    const unanswered = transportWithoutPeer.exchange(new Uint8Array([1]));
    expect(transportWithoutPeer.close()).toEqual({ ok: true, value: null });
    expect(await unanswered).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-broadcast-channel-closed" },
    });

    let release: ((result: BrowserDatabaseReceiptPeerTransportResult<Uint8Array>) => void) | undefined;
    const receiver = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastReceiver({
        root: bus.root,
        channelName,
        peerId: targetPeerId,
        sourcePeerId,
        receiver: {
          receive: () =>
            new Promise((resolve) => {
              release = resolve;
            }),
          read: () => {
            throw new Error("unused");
          },
        },
        limits,
      }),
    );
    const transport = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: bus.root,
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: 10,
        limits,
      }),
    );
    const pending = transport.exchange(new Uint8Array([2]));
    expect(receiver.close()).toEqual({ ok: true, value: null });
    expect(await pending).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-broadcast-channel-closed" },
    });
    if (release === undefined) throw new Error("receiver did not retain pending work");
    release({ ok: true, value: new Uint8Array([3]) });
    await Promise.resolve();
    expect(receiver.read()).toMatchObject({ status: "closed", inFlight: 0 });
    transport.close();
    expect(bus.openChannels()).toBe(0);
  });

  test("enforces payload and sequence bounds and reports unavailable browser capability", async () => {
    expect(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: {},
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: 0,
        limits,
      }),
    ).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-broadcast-channel-unavailable" },
    });

    const bus = createFakeBroadcastBus();
    const receiver = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastReceiver({
        root: bus.root,
        channelName,
        peerId: targetPeerId,
        sourcePeerId,
        receiver: {
          receive: (payload) => Promise.resolve({ ok: true, value: payload }),
          read: () => {
            throw new Error("unused");
          },
        },
        limits,
      }),
    );
    const transport = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: bus.root,
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: Number.MAX_SAFE_INTEGER,
        limits: { ...limits, maxRequestPayloadBytes: 1 },
      }),
    );
    expect(await transport.exchange(new Uint8Array([1, 2]))).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-broadcast-request-capacity-exhausted" },
    });
    expect(await transport.exchange(new Uint8Array([1]))).toEqual({ ok: true, value: new Uint8Array([1]) });
    expect(await transport.exchange(new Uint8Array([1]))).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-broadcast-sequence-exhausted" },
    });
    receiver.close();
    transport.close();
  });

  test("hostile receiver result objects become typed heat", async () => {
    const bus = createFakeBroadcastBus();
    let invocation = 0;
    const receiver = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastReceiver({
        root: bus.root,
        channelName,
        peerId: targetPeerId,
        sourcePeerId,
        receiver: {
          receive: () => {
            invocation += 1;
            if (invocation === 1) {
              return Promise.resolve(
                Object.defineProperty({}, "ok", {
                  get: () => {
                    throw new Error("blocked");
                  },
                }) as never,
              );
            }
            const revoked = Proxy.revocable({}, {
              get: (target, key, receiverObject) => {
                if (key === "then") queueMicrotask(revoked.revoke);
                return Reflect.get(target, key, receiverObject);
              },
            });
            return Promise.resolve(revoked.proxy as never);
          },
          read: () => {
            throw new Error("unused");
          },
        },
        limits,
      }),
    );
    const transport = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: bus.root,
        channelName,
        sourcePeerId,
        targetPeerId,
        initialSequence: 0,
        limits,
      }),
    );

    expect(await transport.exchange(new Uint8Array([1]))).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-broadcast-receiver-invalid" },
    });
    expect(receiver.read()).toMatchObject({
      status: "heat",
      inFlight: 0,
      feedback: { code: "receipt-broadcast-receiver-invalid" },
    });
    expect(await transport.exchange(new Uint8Array([2]))).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-broadcast-receiver-invalid" },
    });
    receiver.close();
    transport.close();
  });
});
