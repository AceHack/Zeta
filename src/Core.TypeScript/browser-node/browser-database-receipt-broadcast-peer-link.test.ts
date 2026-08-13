import { describe, expect, test } from "bun:test";
import { ContentHash256 } from "../blake3/blake3";
import type { BrowserDatabaseExecutionReceipt } from "./browser-database-intent-outbox";
import { createNativeBrowserDatabaseReceiptBroadcastPeerLink } from "./browser-database-receipt-broadcast-peer-link";
import {
  BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
  type BrowserDatabaseReceiptArchiveMaintenancePort,
  type BrowserDatabaseReceiptArchiveSnapshot,
  type BrowserDatabaseReceiptHandoffBatch,
  type BrowserDatabaseReceiptHandoffPort,
} from "./browser-database-receipt-handoff";

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
    openChannels: () => [...channels.values()].reduce((total, group) => total + group.size, 0),
  };
}

const databaseNodeId = "browser/database";
const archiveNodeId = "browser/database:receipts";
const targetNodeId = "browser/database:peer-receipts";
const tickLimits = { maxDeltas: 1, maxEntries: 8, maxCheckpointBytes: 64 * 1024 } as const;
const linkLimits = {
  handoff: { minimumReceipts: 1, maxReceipts: 8, maxBatchBytes: 64 * 1024 },
  peer: { maxReceipts: 8, maxRequestBytes: 64 * 1024, maxResponseBytes: 16 * 1024 },
  broadcast: { maxRequestPayloadBytes: 64 * 1024, maxResponsePayloadBytes: 16 * 1024, maxInFlight: 1 },
} as const;
const hasher = { hash: (payload: Uint8Array) => `blake3:${ContentHash256.ofBytes(payload).toHex()}` };

function receipt(sequence: number, executorId: string): BrowserDatabaseExecutionReceipt {
  return {
    schema: "zeta.browser-database-execution-receipt.v1",
    databaseNodeId,
    intentId: `event/${sequence.toString()}`,
    sequence,
    status: "settled",
    executorId,
    executorKind: "browser-tab",
    revision: sequence + 1,
    accepted: 1,
    duplicates: 0,
    deltaCount: 1,
  };
}

function snapshot(receipts: readonly BrowserDatabaseExecutionReceipt[]): BrowserDatabaseReceiptArchiveSnapshot {
  return {
    schema: "zeta.browser-database-receipt-archive-snapshot.v1",
    databaseNodeId,
    archiveNodeId,
    archiveRevision: receipts.length,
    receiptPayloadBytes: receipts.length * 128,
    limits: tickLimits,
    receipts,
    generation: null,
  };
}

function archive(
  initial: BrowserDatabaseReceiptArchiveSnapshot,
): BrowserDatabaseReceiptArchiveMaintenancePort & { compacted(): number } {
  let current = initial;
  let compacted = 0;
  return {
    read: () => Promise.resolve({ ok: true, value: current }),
    compactGeneration: (candidate) => {
      if (candidate.archiveRevision !== current.archiveRevision) {
        return Promise.resolve({
          ok: false,
          feedback: {
            severity: "backpressure",
            code: "receipt-handoff-archive-changed",
            detail: "fixture generation changed",
          },
        });
      }
      compacted += candidate.receipts.length;
      current = snapshot([]);
      return Promise.resolve({ ok: true, value: true });
    },
    compacted: () => compacted,
  };
}

function downstream(received: BrowserDatabaseReceiptHandoffBatch[]): BrowserDatabaseReceiptHandoffPort {
  return {
    handoff: (batch) => {
      received.push(batch);
      return Promise.resolve({
        ok: true,
        value: {
          schema: BROWSER_DATABASE_RECEIPT_HANDOFF_ACK_SCHEMA,
          targetNodeId,
          databaseNodeId: batch.databaseNodeId,
          archiveNodeId: batch.archiveNodeId,
          archiveRevision: batch.archiveRevision,
          highWaterSequence: batch.highWaterSequence,
          receiptCount: batch.receiptCount,
          contentHash: batch.contentHash,
          disposition: "stored",
        },
      });
    },
  };
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false }): T {
  if (!result.ok) throw new Error("expected successful peer-link construction");
  return result.value;
}

describe("native browser database receipt peer link", () => {
  test("drains one complete archive generation through the full protocol and closes both directions", async () => {
    const bus = createFakeBroadcastBus();
    const sourceArchive = archive(snapshot([receipt(0, "tab-a")]));
    const targetArchive = archive(snapshot([]));
    const receivedByA: BrowserDatabaseReceiptHandoffBatch[] = [];
    const receivedByB: BrowserDatabaseReceiptHandoffBatch[] = [];
    const linkB = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastPeerLink({
        root: bus.root,
        channelName: "receipt-link",
        localPeerId: "tab-b",
        remotePeerId: "tab-a",
        initialSequence: 20,
        databaseNodeId,
        archiveNodeId,
        targetNodeId,
        archive: targetArchive,
        downstream: downstream(receivedByB),
        hasher,
        limits: linkLimits,
      }),
    );
    const linkA = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastPeerLink({
        root: bus.root,
        channelName: "receipt-link",
        localPeerId: "tab-a",
        remotePeerId: "tab-b",
        initialSequence: 10,
        databaseNodeId,
        archiveNodeId,
        targetNodeId,
        archive: sourceArchive,
        downstream: downstream(receivedByA),
        hasher,
        limits: linkLimits,
      }),
    );

    expect(bus.openChannels()).toBe(4);
    expect(await linkA.handoff.handoff()).toMatchObject({
      ok: true,
      value: { status: "complete", releasedReceipts: 1, disposition: "stored" },
    });
    expect(sourceArchive.compacted()).toBe(1);
    expect(receivedByA).toEqual([]);
    expect(receivedByB).toHaveLength(1);
    expect(linkA.read()).toMatchObject({
      status: "complete",
      localPeerId: "tab-a",
      remotePeerId: "tab-b",
      outboundPeer: { status: "complete", receiptCount: 1 },
      outboundTransport: { status: "complete", inFlight: 0 },
    });
    expect(linkB.read()).toMatchObject({
      status: "complete",
      inboundPeer: { status: "complete", receiptCount: 1 },
      inboundTransport: { status: "complete", inFlight: 0 },
    });

    expect(linkA.close()).toEqual({ ok: true, value: null });
    expect(linkB.close()).toEqual({ ok: true, value: null });
    expect(linkA.read().status).toBe("closed");
    expect(bus.openChannels()).toBe(0);
  });

  test("keeps a partial generation local and reports unavailable native transport without leaking channels", async () => {
    const bus = createFakeBroadcastBus();
    const retainedArchive = archive(snapshot([receipt(0, "tab-a")]));
    const retained = unwrap(
      createNativeBrowserDatabaseReceiptBroadcastPeerLink({
        root: bus.root,
        channelName: "receipt-link-retained",
        localPeerId: "tab-a",
        remotePeerId: "tab-b",
        initialSequence: 0,
        databaseNodeId,
        archiveNodeId,
        targetNodeId,
        archive: retainedArchive,
        downstream: downstream([]),
        hasher,
        limits: { ...linkLimits, handoff: { ...linkLimits.handoff, minimumReceipts: 2 } },
      }),
    );

    expect(await retained.handoff.handoff()).toMatchObject({
      ok: true,
      value: { status: "retained", retainedReceipts: 1, releasedReceipts: 0 },
    });
    expect(retained.read()).toMatchObject({ status: "retained", outboundPeer: { status: "idle" } });
    expect(retainedArchive.compacted()).toBe(0);
    expect(retained.close()).toEqual({ ok: true, value: null });
    expect(bus.openChannels()).toBe(0);

    expect(
      createNativeBrowserDatabaseReceiptBroadcastPeerLink({
        root: {},
        channelName: "receipt-link-unavailable",
        localPeerId: "tab-a",
        remotePeerId: "tab-b",
        initialSequence: 0,
        databaseNodeId,
        archiveNodeId,
        targetNodeId,
        archive: retainedArchive,
        downstream: downstream([]),
        hasher,
        limits: linkLimits,
      }),
    ).toMatchObject({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "receipt-peer-link-outbound-receipt-broadcast-channel-unavailable",
      },
    });
  });
});
