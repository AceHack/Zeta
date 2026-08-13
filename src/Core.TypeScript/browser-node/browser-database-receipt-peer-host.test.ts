import { describe, expect, test } from "bun:test";
import {
  BROWSER_DATABASE_RECEIPT_HANDOFF_READOUT_SCHEMA,
  type BrowserDatabaseReceiptHandoffReadout,
} from "./browser-database-receipt-handoff";
import {
  startBrowserDatabaseReceiptPeerHost,
  type BrowserDatabaseReceiptPeerLinkFactory,
  type BrowserDatabaseReceiptPeerLinkPort,
} from "./browser-database-receipt-peer-host";
import { BROWSER_NODE_SCHEMA, planBrowserNode, type BrowserTabPresence } from "./browser-node";
import { BROWSER_TAB_COORDINATOR_SCHEMA, type BrowserTabCoordinatorReadout } from "./browser-tab-coordinator";

function coordinator(tabs: readonly BrowserTabPresence[], localTabId = "tab-a"): BrowserTabCoordinatorReadout {
  const planned = planBrowserNode({
    capabilities: ["javascript", "broadcast-channel"],
    tabs,
    checkpoint: "durable",
    bindings: [],
    requests: [],
  });
  return {
    schema: BROWSER_TAB_COORDINATOR_SCHEMA,
    nodeSchema: BROWSER_NODE_SCHEMA,
    nodeId: "browser/node",
    localTabId,
    tabs,
    liveness: planned.liveness,
    feedback: planned.feedback,
  };
}

function handoffReadout(status: BrowserDatabaseReceiptHandoffReadout["status"]): BrowserDatabaseReceiptHandoffReadout {
  return {
    schema: BROWSER_DATABASE_RECEIPT_HANDOFF_READOUT_SCHEMA,
    status,
    databaseNodeId: "browser/database",
    archiveNodeId: "browser/database:receipts",
    targetNodeId: "browser/database:peer-receipts",
    archiveRevision: 0,
    retainedReceipts: 0,
    releasedReceipts: status === "complete" ? 1 : 0,
    receiptPayloadBytes: 0,
    highWaterSequence: status === "complete" ? 1 : null,
    contentHash: status === "complete" ? "blake3:test" : null,
    disposition: status === "complete" ? "stored" : null,
    feedback: null,
  };
}

class FakeLink implements BrowserDatabaseReceiptPeerLinkPort {
  status: "idle" | "complete" | "closed" = "idle";
  readonly peerId: string;
  private readonly events: string[];
  private readonly failClose: boolean;
  private readonly failHandoff: boolean;

  constructor(peerId: string, events: string[], failClose = false, failHandoff = false) {
    this.peerId = peerId;
    this.events = events;
    this.failClose = failClose;
    this.failHandoff = failHandoff;
  }

  readonly handoff = {
    handoff: async () => {
      this.events.push(`handoff:${this.peerId}`);
      if (this.failHandoff) throw new Error("injected handoff failure");
      this.status = "complete";
      return { ok: true as const, value: handoffReadout("complete") };
    },
  };

  read() {
    return { status: this.status, feedback: null };
  }

  close() {
    this.events.push(`close:${this.peerId}`);
    this.status = "closed";
    return this.failClose
      ? {
          ok: false as const,
          feedback: { severity: "backpressure" as const, code: "injected-close", detail: "close refused" },
        }
      : { ok: true as const, value: null };
  }
}

function factory(events: string[], failClosePeer: string | null = null): BrowserDatabaseReceiptPeerLinkFactory {
  return {
    open: (remotePeerId) => {
      events.push(`open:${remotePeerId}`);
      return { ok: true, value: new FakeLink(remotePeerId, events, remotePeerId === failClosePeer) };
    },
  };
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false }): T {
  if (!result.ok) throw new Error("expected success");
  return result.value;
}

describe("browser database receipt peer host", () => {
  test("retains one link for a stable selection and swaps it before opening the next peer", async () => {
    const events: string[] = [];
    const host = unwrap(
      startBrowserDatabaseReceiptPeerHost(
        { nodeId: "browser/node", localPeerId: "tab-a", maxTrackedTabs: 4 },
        factory(events),
      ),
    );

    expect(host.observe(coordinator([{ tabId: "tab-a", sequence: 1, state: "foreground" }]))).toMatchObject({
      ok: true,
      value: { status: "alone", activePeerId: null },
    });
    expect(
      host.sink.write(
        coordinator([
          { tabId: "tab-b", sequence: 1, state: "background" },
          { tabId: "tab-a", sequence: 2, state: "foreground" },
        ]),
      ),
    ).toEqual({ ok: true, value: null });
    expect(host.read()).toMatchObject({ status: "linked", activePeerId: "tab-b", linkStatus: "idle" });

    host.observe(
      coordinator([
        { tabId: "tab-a", sequence: 3, state: "foreground" },
        { tabId: "tab-b", sequence: 2, state: "foreground" },
        { tabId: "tab-c", sequence: 1, state: "foreground" },
      ]),
    );
    expect(events).toEqual(["open:tab-b"]);

    host.observe(
      coordinator([
        { tabId: "tab-a", sequence: 4, state: "foreground" },
        { tabId: "tab-c", sequence: 2, state: "foreground" },
      ]),
    );
    expect(events).toEqual(["open:tab-b", "close:tab-b", "open:tab-c"]);
    expect(await host.handoff()).toMatchObject({ ok: true, value: { status: "linked", linkStatus: "complete" } });
    expect(events).toEqual(["open:tab-b", "close:tab-b", "open:tab-c", "handoff:tab-c"]);

    expect(host.close()).toMatchObject({ ok: true, value: { status: "closed" } });
    expect(host.close()).toMatchObject({ ok: true, value: { status: "closed" } });
    expect(events).toEqual(["open:tab-b", "close:tab-b", "open:tab-c", "handoff:tab-c", "close:tab-c"]);
  });

  test("closes a stale link when the local tab becomes dormant or the snapshot is invalid", () => {
    const events: string[] = [];
    const host = unwrap(
      startBrowserDatabaseReceiptPeerHost(
        { nodeId: "browser/node", localPeerId: "tab-a", maxTrackedTabs: 2 },
        factory(events),
      ),
    );
    host.observe(
      coordinator([
        { tabId: "tab-a", sequence: 1, state: "foreground" },
        { tabId: "tab-b", sequence: 1, state: "foreground" },
      ]),
    );

    expect(
      host.observe(
        coordinator([
          { tabId: "tab-a", sequence: 2, state: "suspended" },
          { tabId: "tab-b", sequence: 2, state: "foreground" },
        ]),
      ),
    ).toMatchObject({ ok: true, value: { status: "dormant", activePeerId: null } });
    expect(events).toEqual(["open:tab-b", "close:tab-b"]);

    expect(
      host.observe(
        coordinator([
          { tabId: "tab-a", sequence: 3, state: "foreground" },
          { tabId: "tab-b", sequence: 3, state: "foreground" },
          { tabId: "tab-c", sequence: 3, state: "foreground" },
        ]),
      ),
    ).toMatchObject({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "receipt-peer-host-selection-failed",
        causeCode: "receipt-peer-selection-capacity-exhausted",
      },
    });
    expect(host.read()).toMatchObject({ status: "backpressured", activePeerId: null, selection: null });
  });

  test("does not open a replacement when closing the previous link backpressures", () => {
    const events: string[] = [];
    const host = unwrap(
      startBrowserDatabaseReceiptPeerHost(
        { nodeId: "browser/node", localPeerId: "tab-a", maxTrackedTabs: 3 },
        factory(events, "tab-b"),
      ),
    );
    host.observe(
      coordinator([
        { tabId: "tab-a", sequence: 1, state: "foreground" },
        { tabId: "tab-b", sequence: 1, state: "foreground" },
      ]),
    );

    expect(
      host.observe(
        coordinator([
          { tabId: "tab-a", sequence: 2, state: "foreground" },
          { tabId: "tab-c", sequence: 2, state: "foreground" },
        ]),
      ),
    ).toMatchObject({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "receipt-peer-host-link-close-failed",
        causeCode: "injected-close",
      },
    });
    expect(events).toEqual(["open:tab-b", "close:tab-b"]);
    expect(host.read()).toMatchObject({ status: "backpressured", activePeerId: null });
  });

  test("rejects coordinator identity drift without disturbing the active link", () => {
    const events: string[] = [];
    const host = unwrap(
      startBrowserDatabaseReceiptPeerHost(
        { nodeId: "browser/node", localPeerId: "tab-a", maxTrackedTabs: 2 },
        factory(events),
      ),
    );
    host.observe(
      coordinator([
        { tabId: "tab-a", sequence: 1, state: "foreground" },
        { tabId: "tab-b", sequence: 1, state: "foreground" },
      ]),
    );

    expect(host.observe({ ...coordinator([], "tab-x"), nodeId: "other/node" })).toMatchObject({
      ok: false,
      feedback: { code: "receipt-peer-host-readout-mismatch" },
    });
    expect(host.read()).toMatchObject({ status: "heat", activePeerId: "tab-b" });
    expect(events).toEqual(["open:tab-b"]);
  });

  test("turns thrown link construction and handoff into typed heat", async () => {
    const tabs = coordinator([
      { tabId: "tab-a", sequence: 1, state: "foreground" },
      { tabId: "tab-b", sequence: 1, state: "foreground" },
    ]);
    const constructionHost = unwrap(
      startBrowserDatabaseReceiptPeerHost(
        { nodeId: "browser/node", localPeerId: "tab-a", maxTrackedTabs: 2 },
        {
          open: () => {
            throw new Error("injected construction failure");
          },
        },
      ),
    );
    expect(constructionHost.observe(tabs)).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-peer-host-link-open-failed" },
    });

    const events: string[] = [];
    const handoffHost = unwrap(
      startBrowserDatabaseReceiptPeerHost(
        { nodeId: "browser/node", localPeerId: "tab-a", maxTrackedTabs: 2 },
        {
          open: (remotePeerId) => ({
            ok: true,
            value: new FakeLink(remotePeerId, events, false, true),
          }),
        },
      ),
    );
    handoffHost.observe(tabs);
    expect(await handoffHost.handoff()).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "receipt-peer-host-handoff-failed" },
    });
    expect(handoffHost.read()).toMatchObject({ status: "heat", activePeerId: "tab-b" });
  });
});
