import { describe, expect, test } from "bun:test";
import {
  BROWSER_CHECKPOINT_RECORD_SCHEMA,
  browserCheckpointRecordNodeId,
  decideBrowserCheckpointRemoval,
  decideBrowserCheckpointSave,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
  type BrowserCheckpointResult,
} from "../browser-node/browser-checkpoint-port";
import {
  browserCausalCorrectionCheckpointNodeId,
  encodeBrowserCausalCorrectionCheckpoint,
} from "../browser-node/browser-causal-correction-checkpoint";
import {
  BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
  browserCausalHandoffCheckpointNodeId,
  decodeBrowserCausalHandoffCheckpoint,
  encodeBrowserCausalHandoffCheckpoint,
  type BrowserCausalHandoffCheckpoint,
} from "../browser-node/browser-causal-handoff-checkpoint";
import {
  createBrowserCausalCorrectionLedger,
  foldBrowserCausalCorrections,
} from "../browser-node/browser-causal-correction-ledger";
import { encodeBrowserRoomCheckpoint } from "../browser-node/browser-room-checkpoint";
import { BROWSER_NODE_SCHEMA } from "../browser-node/browser-node";
import {
  BROWSER_TAB_COORDINATOR_SCHEMA,
  type BrowserTabChannel,
  type BrowserCausalCorrectionNotice,
  type BrowserCheckpointInvalidation,
  type BrowserTabCoordinatorReadout,
} from "../browser-node/browser-tab-coordinator";
import {
  BROWSER_LIFECYCLE_HOST_SCHEMA,
  type BrowserLifecycleHost,
  type BrowserLifecycleHostReadout,
} from "../browser-node/browser-lifecycle-host";
import {
  DARK_HALL_BROWSER_BOOTSTRAP_SCHEMA,
  type DarkHallBrowserBootstrapOptions,
  type DarkHallBrowserRuntime,
} from "./darkhall-browser-bootstrap";
import {
  DARK_HALL_BROWSER_DURABLE_RUNTIME_SCHEMA,
  startDurableDarkHallBrowser,
  startNativeDurableDarkHallBrowser,
  type DarkHallBrowserDurableOptions,
  type DarkHallBrowserStarter,
} from "./darkhall-browser-durable-runtime";
import { DARK_HALL_DATABASE_READOUT_SCHEMA, type DarkHallDatabaseReadout } from "./darkhall-database-readout";
import type { RoomRunTranscript } from "./darkhall-room";
import { monotoneLastWriterWinsRevisionPolicy } from "../persistence/revision-policy";

const initialTranscript: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "browser-room",
  seed: "durable-runtime",
  controller: [],
  ticks: [{ tick: 1, phase: "observe", event: "started", outcome: "ok" }],
  heatRows: [],
};

const databaseReadout: DarkHallDatabaseReadout = {
  schema: DARK_HALL_DATABASE_READOUT_SCHEMA,
  sourceSchema: "zeta.db.tick.v1",
  nodeId: "node-a-db",
  executorId: "tab-a",
  executorKind: "browser-tab",
  revision: 1,
  admission: "complete",
  accepted: 1,
  duplicates: 0,
  nextDeltaIndex: 1,
  rows: [{ rowKey: "game/score", payload: "1", weight: 1 }],
  feedback: [],
};

const coordinatorReadout: BrowserTabCoordinatorReadout = {
  schema: BROWSER_TAB_COORDINATOR_SCHEMA,
  nodeSchema: BROWSER_NODE_SCHEMA,
  nodeId: "node-a",
  localTabId: "tab-a",
  tabs: [{ tabId: "tab-a", sequence: 1, state: "foreground" }],
  liveness: {
    runtime: "node-capable",
    availability: "live",
    continuity: "single-tab",
    zetaAlive: true,
    criticalPathEligible: false,
    checkpoint: "none",
    openTabIds: ["tab-a"],
    liveTabIds: ["tab-a"],
    suspendedTabIds: [],
    darkTabIds: [],
  },
  feedback: [],
};

function hostReadout(stopped = false): BrowserLifecycleHostReadout {
  return {
    schema: BROWSER_LIFECYCLE_HOST_SCHEMA,
    state: stopped ? "dark" : "foreground",
    stopped,
    admission: "open",
    coordinator: coordinatorReadout,
    feedback: [],
  };
}

function succeeded<T>(value: T): BrowserCheckpointResult<T> {
  return { ok: true, value };
}

function conflict(detail: string): BrowserCheckpointResult<never> {
  return {
    ok: false,
    feedback: { severity: "backpressure", code: "checkpoint-revision-conflict", detail },
  };
}

function copyRecord(record: BrowserCheckpointRecord): BrowserCheckpointRecord {
  return { ...record, payload: new Uint8Array(record.payload) };
}

class MemoryCheckpointPort implements BrowserCheckpointPort {
  readonly revisionPolicy = monotoneLastWriterWinsRevisionPolicy;
  private readonly stored = new Map<string, BrowserCheckpointRecord>();
  closeCalls = 0;
  rejectLoad = false;
  loadOverride: ((nodeId: string) => Promise<BrowserCheckpointResult<BrowserCheckpointRecord | null>>) | null = null;
  saveOverride:
    | ((record: BrowserCheckpointRecord) => Promise<BrowserCheckpointResult<BrowserCheckpointRecord>>)
    | null = null;

  constructor(records: BrowserCheckpointRecord | readonly BrowserCheckpointRecord[] | null = null) {
    for (const record of records === null ? [] : Array.isArray(records) ? records : [records]) {
      this.stored.set(record.nodeId, copyRecord(record));
    }
  }

  get record(): BrowserCheckpointRecord | null {
    return this.recordFor(browserCheckpointRecordNodeId("room", "node-a"));
  }

  set record(record: BrowserCheckpointRecord | null) {
    if (record === null) this.stored.delete(browserCheckpointRecordNodeId("room", "node-a"));
    else this.stored.set(record.nodeId, copyRecord(record));
  }

  recordFor(nodeId: string): BrowserCheckpointRecord | null {
    const record = this.stored.get(nodeId);
    return record === undefined ? null : copyRecord(record);
  }

  setRecord(record: BrowserCheckpointRecord): void {
    this.stored.set(record.nodeId, copyRecord(record));
  }

  records(): readonly BrowserCheckpointRecord[] {
    return [...this.stored.values()].map(copyRecord);
  }

  load(nodeId: string): Promise<BrowserCheckpointResult<BrowserCheckpointRecord | null>> {
    if (this.rejectLoad) return Promise.reject(new Error("injected load rejection"));
    if (this.loadOverride !== null) return this.loadOverride(nodeId);
    return Promise.resolve(succeeded(this.recordFor(nodeId)));
  }

  save(record: BrowserCheckpointRecord): Promise<BrowserCheckpointResult<BrowserCheckpointRecord>> {
    if (this.saveOverride !== null) return this.saveOverride(record);
    const decision = decideBrowserCheckpointSave(this.recordFor(record.nodeId), record, this.revisionPolicy);
    if (!decision.ok) return Promise.resolve(decision);
    this.stored.set(record.nodeId, copyRecord(decision.value.record));
    return Promise.resolve(succeeded(copyRecord(decision.value.record)));
  }

  remove(nodeId: string, throughRevision: number): Promise<BrowserCheckpointResult<boolean>> {
    const decision = decideBrowserCheckpointRemoval(this.recordFor(nodeId), nodeId, throughRevision);
    if (!decision.ok) return Promise.resolve(decision);
    if (decision.value.action === "missing") return Promise.resolve(succeeded(false));
    this.stored.delete(nodeId);
    return Promise.resolve(succeeded(true));
  }

  close(): BrowserCheckpointResult<null> {
    this.closeCalls += 1;
    return succeeded(null);
  }
}

function options(): DarkHallBrowserDurableOptions {
  return {
    root: {},
    mount: {},
    channelName: "durable-room",
    initialTranscript,
    nodeId: "node-a",
    tabId: "tab-a",
    initialSequence: 0,
    maxTrackedTabs: 4,
    maxFeedback: 4,
    maxCausalCorrections: 2,
    capabilities: ["css", "javascript", "indexed-db"],
  };
}

function createStarter(
  updateFailure = false,
  checkpointFailure = false,
): {
  readonly start: DarkHallBrowserStarter;
  readonly starts: DarkHallBrowserBootstrapOptions[];
  readonly updates: RoomRunTranscript[];
  readonly databaseUpdates: DarkHallDatabaseReadout[];
  readonly checkpointUpdates: string[];
  readonly checkpointInvalidations: BrowserCheckpointInvalidation[];
  readonly causalCorrections: Omit<BrowserCausalCorrectionNotice, "sourceTabId">[];
  readonly runtime: DarkHallBrowserRuntime;
} {
  const starts: DarkHallBrowserBootstrapOptions[] = [];
  const updates: RoomRunTranscript[] = [];
  const databaseUpdates: DarkHallDatabaseReadout[] = [];
  const checkpointUpdates: string[] = [];
  const checkpointInvalidations: BrowserCheckpointInvalidation[] = [];
  const causalCorrections: Omit<BrowserCausalCorrectionNotice, "sourceTabId">[] = [];
  let stopped = false;
  let checkpoint: "none" | "volatile" | "durable" = "none";
  const host: BrowserLifecycleHost = {
    read: () => ({
      ...hostReadout(stopped),
      coordinator: {
        ...coordinatorReadout,
        liveness: { ...coordinatorReadout.liveness, checkpoint },
      },
    }),
    updateCheckpoint: (nextCheckpoint) => {
      checkpointUpdates.push(nextCheckpoint);
      if (checkpointFailure) {
        return {
          ok: false,
          feedback: {
            severity: "heat",
            code: "coordinator-operation-failed",
            detail: "injected checkpoint projection failure",
          },
        };
      }
      checkpoint = nextCheckpoint;
      return { ok: true, value: host.read() };
    },
    publishCheckpointInvalidation: (operation, revision) => {
      checkpointInvalidations.push({ sourceTabId: "tab-a", operation, revision });
      return { ok: true, value: host.read() };
    },
    publishDatabaseInvalidation: () => ({ ok: true, value: host.read() }),
    publishDatabaseExecutionReceipt: () => ({ ok: true, value: host.read() }),
    publishCausalCorrection: (correction) => {
      causalCorrections.push(correction);
      return { ok: true, value: host.read() };
    },
    stop: () => {
      stopped = true;
      return { ok: true, value: hostReadout(true) };
    },
  };
  const runtime: DarkHallBrowserRuntime = {
    schema: DARK_HALL_BROWSER_BOOTSTRAP_SCHEMA,
    channelName: "durable-room",
    transport: {
      schema: "zeta.browser-tab-transport.v1",
      selected: "injected",
      attempts: [{ kind: "injected", status: "selected" }],
    },
    host,
    updateTranscript: (transcript) => {
      updates.push(transcript);
      return updateFailure ? { ok: false, detail: "injected render failure" } : { ok: true, value: null };
    },
    updateDatabaseReadout: (readout) => {
      databaseUpdates.push(readout);
      return updateFailure ? { ok: false, detail: "injected render failure" } : { ok: true, value: null };
    },
  };
  return {
    starts,
    updates,
    databaseUpdates,
    checkpointUpdates,
    checkpointInvalidations,
    causalCorrections,
    runtime,
    start: (startOptions) => {
      starts.push(startOptions);
      checkpoint = startOptions.checkpoint;
      return { ok: true, value: runtime };
    },
  };
}

function checkpointRecord(revision: number, transcript: RoomRunTranscript): BrowserCheckpointRecord {
  const encoded = encodeBrowserRoomCheckpoint(transcript);
  if (!encoded.ok) throw new Error(encoded.feedback.detail);
  return {
    schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
    nodeId: browserCheckpointRecordNodeId("room", "node-a"),
    revision,
    payload: encoded.value,
  };
}

function causalCheckpointRecord(
  revision: number,
  corrections: readonly BrowserCausalCorrectionNotice[],
  maxCorrections = 2,
): BrowserCheckpointRecord {
  const created = createBrowserCausalCorrectionLedger(maxCorrections);
  if (!created.ok) throw new Error(created.feedback.detail);
  const folded = foldBrowserCausalCorrections(created.value, corrections);
  if (!folded.ok) throw new Error(folded.feedback.detail);
  const encoded = encodeBrowserCausalCorrectionCheckpoint(folded.value);
  if (!encoded.ok) throw new Error(encoded.feedback.detail);
  return {
    schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
    nodeId: browserCausalCorrectionCheckpointNodeId("node-a"),
    revision,
    payload: encoded.value,
  };
}

function causalHandoffCheckpointRecord(
  revision: number,
  checkpoint: Omit<BrowserCausalHandoffCheckpoint, "schema">,
): BrowserCheckpointRecord {
  const encoded = encodeBrowserCausalHandoffCheckpoint({
    schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
    ...checkpoint,
  });
  if (!encoded.ok) throw new Error(encoded.feedback.detail);
  return {
    schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
    nodeId: browserCausalHandoffCheckpointNodeId("node-a"),
    revision,
    payload: encoded.value,
  };
}

describe("durable Dark Hall browser runtime", () => {
  test("keeps an empty late-join snapshot idle because no replay is transmitted", async () => {
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), new MemoryCheckpointPort(), starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(starter.starts[0]?.causalCorrectionReplay?.snapshot("tab-peer")).toEqual({
      handoffId: "replay/1@tab-a",
      corrections: [],
    });
    expect(started.value.read().causalHandoff).toMatchObject({
      status: "idle",
      direction: "none",
      handoffId: null,
      peerTabId: null,
      correctionCount: 0,
      admittedCorrections: 0,
    });
  });

  test("forwards the injected channel and tab observer through the durable boundary", async () => {
    const channel: BrowserTabChannel = {
      publish: () => ({ ok: true, value: null }),
      subscribe: () => ({
        ok: true,
        value: { unsubscribe: () => ({ ok: true, value: null }) },
      }),
      close: () => ({ ok: true, value: null }),
    };
    const onTabReadout = () => ({ ok: true as const, value: null });
    const observedCausalCorrections: BrowserCausalCorrectionNotice[] = [];
    const onCausalCorrection = (correction: BrowserCausalCorrectionNotice): void => {
      observedCausalCorrections.push(correction);
    };
    const port = new MemoryCheckpointPort();
    const starter = createStarter();

    const started = await startDurableDarkHallBrowser(
      { ...options(), channel, onTabReadout, onCausalCorrection },
      port,
      starter.start,
    );

    expect(started.ok).toBe(true);
    expect(starter.starts[0]?.channel).toBe(channel);
    expect(starter.starts[0]?.onTabReadout).toBe(onTabReadout);
    expect(starter.starts[0]?.onCausalCorrection).not.toBe(onCausalCorrection);
    starter.starts[0]?.onCausalCorrection?.({
      sourceTabId: "tab-b",
      sequence: "2",
      reinterpretsThrough: "1",
      deltaRows: 1,
    });
    expect(started.ok && started.value.read().causal.corrections).toEqual([
      { sourceTabId: "tab-b", sequence: "2", reinterpretsThrough: "1", deltaRows: 1 },
    ]);
    expect(observedCausalCorrections).toEqual([
      { sourceTabId: "tab-b", sequence: "2", reinterpretsThrough: "1", deltaRows: 1 },
    ]);
    expect(starter.starts[0]?.causalCorrectionReplay?.maxCorrections).toBe(2);
    expect(starter.starts[0]?.causalCorrectionReplay?.snapshot("tab-peer")).toEqual({
      handoffId: "replay/1@tab-a",
      corrections: [{ sourceTabId: "tab-b", sequence: "2", reinterpretsThrough: "1", deltaRows: 1 }],
    });
  });

  test("applies a synchronous late-join replay before returning the browser runtime", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const startWithSynchronousReplay: DarkHallBrowserStarter = (startOptions) => {
      startOptions.causalCorrectionReplay?.receive({
        handoffId: "handoff/startup",
        sourceTabId: "tab-b",
        targetTabId: "tab-a",
        maxCorrections: 2,
        corrections: [{ sourceTabId: "tab-origin", sequence: "8", reinterpretsThrough: "5", deltaRows: 3 }],
      });
      return starter.start(startOptions);
    };

    const started = await startDurableDarkHallBrowser(options(), port, startWithSynchronousReplay);

    expect(started.ok).toBe(true);
    expect(started.ok && started.value.read().causal.corrections).toEqual([
      { sourceTabId: "tab-origin", sequence: "8", reinterpretsThrough: "5", deltaRows: 3 },
    ]);
    expect(starter.updates.at(-1)).toMatchObject({
      causalReadout: {
        corrections: [{ sourceTabId: "tab-origin", sequence: "8", reinterpretsThrough: "5", deltaRows: 3 }],
      },
    });
  });

  test("offers recovered history through the peer port and reports admission without losing identity", async () => {
    const correction = { sourceTabId: "tab-origin", sequence: "8", reinterpretsThrough: "5", deltaRows: 3 };
    const senderPort = new MemoryCheckpointPort(causalCheckpointRecord(1, [correction]));
    const senderStarter = createStarter();
    const sender = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-sender" },
      senderPort,
      senderStarter.start,
    );
    const receiverStarter = createStarter();
    const receiver = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-receiver" },
      new MemoryCheckpointPort(),
      receiverStarter.start,
    );
    expect(sender.ok).toBe(true);
    expect(receiver.ok).toBe(true);
    if (!sender.ok || !receiver.ok) return;

    const snapshot = senderStarter.starts[0]?.causalCorrectionReplay?.snapshot("tab-receiver");
    expect(snapshot).toEqual({ handoffId: "replay/1@tab-sender", corrections: [correction] });
    if (snapshot === undefined) return;
    expect(sender.value.read().causalHandoff).toMatchObject({
      status: "offered",
      direction: "outbound",
      localTabId: "tab-sender",
      handoffId: "replay/1@tab-sender",
      peerTabId: "tab-receiver",
      correctionCount: 1,
      admittedCorrections: 0,
      feedback: null,
    });
    expect(senderStarter.updates.at(-1)).toMatchObject({
      causalHandoffReadout: {
        status: "offered",
        direction: "outbound",
        peerTabId: "tab-receiver",
      },
    });

    const replay = {
      handoffId: snapshot.handoffId,
      sourceTabId: "tab-sender",
      targetTabId: "tab-receiver",
      maxCorrections: 2,
      corrections: snapshot.corrections,
    };
    const admission = receiverStarter.starts[0]?.causalCorrectionReplay?.receive(replay);
    expect(admission).toEqual({ disposition: "admitted", admittedCorrections: 1, feedback: null });
    expect(receiver.value.read()).toMatchObject({
      causal: { corrections: [correction] },
      causalHandoff: {
        status: "received",
        direction: "inbound",
        handoffId: "replay/1@tab-sender",
        peerTabId: "tab-sender",
        correctionCount: 1,
        admittedCorrections: 1,
        feedback: null,
      },
    });
    expect(receiverStarter.updates.at(-1)).toMatchObject({
      causalHandoffReadout: {
        status: "received",
        direction: "inbound",
        peerTabId: "tab-sender",
      },
    });

    if (admission !== undefined) {
      senderStarter.starts[0]?.causalCorrectionReplay?.acknowledge({
        ...admission,
        handoffId: "replay/stale",
        sourceTabId: "tab-receiver",
        targetTabId: "tab-sender",
        correctionCount: snapshot.corrections.length,
      });
      expect(sender.value.read().causalHandoff.status).toBe("offered");
      senderStarter.starts[0]?.causalCorrectionReplay?.acknowledge({
        ...admission,
        handoffId: snapshot.handoffId,
        sourceTabId: "tab-receiver",
        targetTabId: "tab-sender",
        correctionCount: snapshot.corrections.length,
      });
    }
    expect(sender.value.read().causalHandoff).toMatchObject({
      status: "acknowledged",
      direction: "outbound",
      handoffId: "replay/1@tab-sender",
      peerTabId: "tab-receiver",
      correctionCount: 1,
      admittedCorrections: 1,
      feedback: null,
    });

    expect(receiverStarter.starts[0]?.causalCorrectionReplay?.receive(replay)).toEqual({
      disposition: "duplicate",
      admittedCorrections: 0,
      feedback: null,
    });
    expect(receiver.value.read()).toMatchObject({
      causal: { corrections: [correction] },
      causalHandoff: { status: "duplicate", admittedCorrections: 0 },
    });
    expect(receiverStarter.updates.at(-1)).toMatchObject({
      causalHandoffReadout: { status: "duplicate", admittedCorrections: 0 },
    });
  });

  test("tracks concurrent peer acknowledgements independently and reuses retry identity", async () => {
    const correction = { sourceTabId: "tab-origin", sequence: "8", reinterpretsThrough: "5", deltaRows: 3 };
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-sender", maxTrackedTabs: 3 },
      new MemoryCheckpointPort(causalCheckpointRecord(1, [correction])),
      starter.start,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const replay = starter.starts[0]?.causalCorrectionReplay;
    const peerB = replay?.snapshot("tab-b");
    expect(peerB).toEqual({ handoffId: "replay/1@tab-sender", corrections: [correction] });
    expect(replay?.snapshot("tab-b")).toEqual(peerB);
    expect(started.value.read().causalHandoff).toMatchObject({
      status: "offered",
      peerTabId: "tab-b",
      pendingHandoffs: 1,
      maxPendingHandoffs: 2,
    });

    const peerC = replay?.snapshot("tab-c");
    expect(peerC).toEqual({ handoffId: "replay/2@tab-sender", corrections: [correction] });
    expect(started.value.read().causalHandoff).toMatchObject({
      status: "offered",
      peerTabId: "tab-c",
      pendingHandoffs: 2,
      maxPendingHandoffs: 2,
    });

    if (peerB === undefined || peerC === undefined) return;
    replay?.acknowledge({
      handoffId: peerB.handoffId,
      sourceTabId: "tab-b",
      targetTabId: "tab-sender",
      correctionCount: peerB.corrections.length,
      disposition: "admitted",
      admittedCorrections: 1,
      feedback: null,
    });
    expect(started.value.read().causalHandoff).toMatchObject({
      status: "acknowledged",
      peerTabId: "tab-b",
      pendingHandoffs: 1,
      maxPendingHandoffs: 2,
    });

    replay?.acknowledge({
      handoffId: peerC.handoffId,
      sourceTabId: "tab-c",
      targetTabId: "tab-sender",
      correctionCount: peerC.corrections.length,
      disposition: "duplicate",
      admittedCorrections: 0,
      feedback: null,
    });
    expect(started.value.read().causalHandoff).toMatchObject({
      status: "duplicate",
      peerTabId: "tab-c",
      pendingHandoffs: 0,
      maxPendingHandoffs: 2,
    });
  });

  test("recovers pending offers across same-tab reload and transfers acknowledgement to a new leader", async () => {
    const correction = { sourceTabId: "tab-origin", sequence: "8", reinterpretsThrough: "5", deltaRows: 3 };
    const port = new MemoryCheckpointPort(causalCheckpointRecord(1, [correction]));
    const firstStarter = createStarter();
    const first = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-sender", maxTrackedTabs: 3 },
      port,
      firstStarter.start,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const replay = firstStarter.starts[0]?.causalCorrectionReplay;
    const peerB = replay?.snapshot("tab-b");
    const peerC = replay?.snapshot("tab-c");
    expect(peerB).toEqual({ handoffId: "replay/1@tab-sender", corrections: [correction] });
    expect(peerC).toEqual({ handoffId: "replay/2@tab-sender", corrections: [correction] });
    expect(first.value.read()).toMatchObject({
      causalHandoff: { pendingHandoffs: 2 },
      causalHandoffCheckpoint: { state: "saving", recoveredRevision: null },
    });
    expect(first.value.stop()).toMatchObject({
      ok: false,
      feedback: { code: "causal-handoff-checkpoint-pending", severity: "backpressure" },
    });
    expect(await first.value.drainCausalHandoffCheckpoint()).toMatchObject({
      ok: true,
      value: {
        causalHandoffCheckpoint: { state: "saved", recoveredRevision: null, currentRevision: 2 },
      },
    });
    expect(first.value.stop()).toMatchObject({ ok: true });

    const sameTabPort = new MemoryCheckpointPort(port.records());
    const sameTabStarter = createStarter();
    const sameTab = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-sender", maxTrackedTabs: 3 },
      sameTabPort,
      sameTabStarter.start,
    );
    expect(sameTab.ok).toBe(true);
    if (!sameTab.ok) return;
    expect(sameTab.value.read()).toMatchObject({
      causalHandoff: { pendingHandoffs: 2 },
      causalHandoffCheckpoint: { state: "saved", recoveredRevision: 2, currentRevision: 2 },
    });
    expect(sameTabStarter.starts[0]?.causalCorrectionReplay?.snapshot("tab-b")).toEqual(peerB);
    expect(sameTab.value.stop()).toMatchObject({ ok: true });

    const nextLeaderPort = new MemoryCheckpointPort(sameTabPort.records());
    const nextLeaderStarter = createStarter();
    const nextLeader = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-leader-2", maxTrackedTabs: 3 },
      nextLeaderPort,
      nextLeaderStarter.start,
    );
    expect(nextLeader.ok).toBe(true);
    if (!nextLeader.ok || peerB === undefined) return;
    const nextLeaderReplay = nextLeaderStarter.starts[0]?.causalCorrectionReplay;
    expect(nextLeaderReplay?.snapshot("tab-c")).toEqual(peerC);
    nextLeaderReplay?.acknowledge({
      handoffId: peerB.handoffId,
      sourceTabId: "tab-b",
      targetTabId: "tab-leader-2",
      correctionCount: peerB.corrections.length,
      disposition: "duplicate",
      admittedCorrections: 0,
      feedback: null,
    });
    expect(nextLeader.value.read()).toMatchObject({
      causalHandoff: { status: "duplicate", peerTabId: "tab-b", pendingHandoffs: 1 },
      causalHandoffCheckpoint: { state: "saving", recoveredRevision: 2 },
    });
    expect(await nextLeader.value.drainCausalHandoffCheckpoint()).toMatchObject({
      ok: true,
      value: { causalHandoffCheckpoint: { state: "saved", currentRevision: 3 } },
    });

    const persisted = nextLeaderPort.recordFor(browserCausalHandoffCheckpointNodeId("node-a"));
    expect(persisted).not.toBeNull();
    if (persisted === null) return;
    expect(decodeBrowserCausalHandoffCheckpoint(persisted.payload)).toEqual({
      ok: true,
      value: {
        schema: BROWSER_CAUSAL_HANDOFF_CHECKPOINT_SCHEMA,
        maxPendingHandoffs: 2,
        generation: 2,
        pending: [{ targetTabId: "tab-c", handoffId: "replay/2@tab-sender", correctionCount: 1 }],
      },
    });
  });

  test("coalesces concurrent senders by source identity and rejects a cross-sender acknowledgement alias", async () => {
    const correction = { sourceTabId: "tab-origin", sequence: "8", reinterpretsThrough: "5", deltaRows: 3 };
    const port = new MemoryCheckpointPort(causalCheckpointRecord(1, [correction]));
    const laterStarter = createStarter();
    const earlierStarter = createStarter();
    const later = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-e", maxTrackedTabs: 3 },
      port,
      laterStarter.start,
    );
    const earlier = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-c", maxTrackedTabs: 3 },
      port,
      earlierStarter.start,
    );
    expect(later.ok).toBe(true);
    expect(earlier.ok).toBe(true);
    if (!later.ok || !earlier.ok) return;

    const laterOffer = laterStarter.starts[0]?.causalCorrectionReplay?.snapshot("tab-d");
    const earlierOffer = earlierStarter.starts[0]?.causalCorrectionReplay?.snapshot("tab-d");
    expect(laterOffer?.handoffId).toBe("replay/1@tab-e");
    expect(earlierOffer?.handoffId).toBe("replay/1@tab-c");
    expect(await later.value.drainCausalHandoffCheckpoint()).toMatchObject({ ok: true });
    expect(await earlier.value.drainCausalHandoffCheckpoint()).toMatchObject({ ok: true });

    if (laterOffer === undefined) return;
    laterStarter.starts[0]?.causalCorrectionReplay?.acknowledge({
      handoffId: laterOffer.handoffId,
      sourceTabId: "tab-d",
      targetTabId: "tab-e",
      correctionCount: laterOffer.corrections.length,
      disposition: "duplicate",
      admittedCorrections: 0,
      feedback: null,
    });
    expect(await later.value.drainCausalHandoffCheckpoint()).toMatchObject({ ok: true });

    const persisted = port.recordFor(browserCausalHandoffCheckpointNodeId("node-a"));
    expect(persisted).not.toBeNull();
    if (persisted === null) return;
    expect(decodeBrowserCausalHandoffCheckpoint(persisted.payload)).toMatchObject({
      ok: true,
      value: {
        pending: [{ targetTabId: "tab-d", handoffId: "replay/1@tab-c", correctionCount: 1 }],
      },
    });
  });

  test("backpressures recovered offers when current tab capacity cannot retain them", async () => {
    const port = new MemoryCheckpointPort(
      causalHandoffCheckpointRecord(1, {
        maxPendingHandoffs: 2,
        generation: 2,
        pending: [
          { targetTabId: "tab-b", handoffId: "replay/1@tab-sender", correctionCount: 1 },
          { targetTabId: "tab-c", handoffId: "replay/2@tab-sender", correctionCount: 1 },
        ],
      }),
    );
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser({ ...options(), maxTrackedTabs: 2 }, port, starter.start);
    expect(started).toMatchObject({
      ok: false,
      feedback: {
        severity: "backpressure",
        source: "causal-handoff-checkpoint",
        code: "causal-handoff-checkpoint-capacity-exhausted",
      },
    });
    expect(starter.starts).toEqual([]);
    expect(port.closeCalls).toBe(1);
  });

  test("backpressures an excess peer without discarding a pending acknowledgement", async () => {
    const correction = { sourceTabId: "tab-origin", sequence: "8", reinterpretsThrough: "5", deltaRows: 3 };
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-sender", maxTrackedTabs: 2 },
      new MemoryCheckpointPort(causalCheckpointRecord(1, [correction])),
      starter.start,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const replay = starter.starts[0]?.causalCorrectionReplay;
    const peerB = replay?.snapshot("tab-b");
    expect(peerB).toEqual({ handoffId: "replay/1@tab-sender", corrections: [correction] });
    expect(replay?.snapshot("tab-c")).toEqual({ handoffId: "replay/2@tab-sender", corrections: [] });
    expect(started.value.read().causalHandoff).toMatchObject({
      status: "backpressured",
      direction: "outbound",
      peerTabId: "tab-c",
      correctionCount: 1,
      pendingHandoffs: 1,
      maxPendingHandoffs: 1,
      feedback: {
        severity: "backpressure",
        code: "causal-correction-replay-pending-capacity-exhausted",
      },
    });

    if (peerB === undefined) return;
    replay?.acknowledge({
      handoffId: peerB.handoffId,
      sourceTabId: "tab-b",
      targetTabId: "tab-sender",
      correctionCount: peerB.corrections.length,
      disposition: "admitted",
      admittedCorrections: 1,
      feedback: null,
    });
    expect(replay?.snapshot("tab-c")).toEqual({ handoffId: "replay/2@tab-sender", corrections: [correction] });
    expect(started.value.read().causalHandoff).toMatchObject({
      status: "offered",
      peerTabId: "tab-c",
      pendingHandoffs: 1,
      maxPendingHandoffs: 1,
      feedback: null,
    });
  });

  test("exposes peer backpressure and conflicting identity as distinct handoff outcomes", async () => {
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-receiver", maxCausalCorrections: 1 },
      new MemoryCheckpointPort(),
      starter.start,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(
      started.value.publishCausalCorrection({ sequence: "2", reinterpretsThrough: "1", deltaRows: 1 }),
    ).toMatchObject({ ok: true });

    starter.starts[0]?.causalCorrectionReplay?.receive({
      handoffId: "handoff/capacity",
      sourceTabId: "tab-sender",
      targetTabId: "tab-receiver",
      maxCorrections: 1,
      corrections: [{ sourceTabId: "tab-sender", sequence: "4", reinterpretsThrough: "3", deltaRows: 1 }],
    });
    expect(started.value.read()).toMatchObject({
      causal: { corrections: [{ sourceTabId: "tab-receiver", sequence: "2" }] },
      causalHandoff: {
        status: "backpressured",
        direction: "inbound",
        peerTabId: "tab-sender",
        correctionCount: 1,
        admittedCorrections: 0,
        feedback: { severity: "backpressure", code: "causal-correction-capacity-exhausted" },
      },
    });

    starter.starts[0]?.causalCorrectionReplay?.receive({
      handoffId: "handoff/conflict",
      sourceTabId: "tab-sender",
      targetTabId: "tab-receiver",
      maxCorrections: 1,
      corrections: [{ sourceTabId: "tab-receiver", sequence: "2", reinterpretsThrough: "1", deltaRows: 2 }],
    });
    expect(started.value.read().causalHandoff).toMatchObject({
      status: "heat",
      feedback: { severity: "heat", code: "causal-correction-conflict" },
    });
  });

  test("persists causal corrections separately and recovers them after every tab closes", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(
      started.value.publishCausalCorrection({ sequence: "14", reinterpretsThrough: "12", deltaRows: 2 }),
    ).toMatchObject({ ok: true, value: { causalCheckpoint: { state: "saving" } } });
    expect(started.value.stop()).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "causal-checkpoint-pending" },
    });
    expect(port.closeCalls).toBe(0);

    expect(await started.value.drainCausalCorrectionCheckpoint()).toMatchObject({
      ok: true,
      value: {
        causalCheckpoint: {
          state: "saved",
          recoveredRevision: null,
          currentRevision: 1,
          feedback: null,
        },
      },
    });
    expect(port.record).toBeNull();
    expect(port.recordFor(browserCausalCorrectionCheckpointNodeId("node-a"))).toMatchObject({ revision: 1 });
    expect(started.value.stop()).toMatchObject({ ok: true });

    const reopenedPort = new MemoryCheckpointPort(port.records());
    const reopenedStarter = createStarter();
    const reopened = await startDurableDarkHallBrowser(
      { ...options(), tabId: "tab-reopened" },
      reopenedPort,
      reopenedStarter.start,
    );
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopenedStarter.starts[0]?.checkpoint).toBe("none");
    expect(reopened.value.read()).toMatchObject({
      recoveredRevision: null,
      currentRevision: null,
      causal: {
        corrections: [{ sourceTabId: "tab-a", sequence: "14", reinterpretsThrough: "12", deltaRows: 2 }],
      },
      causalCheckpoint: { state: "saved", recoveredRevision: 1, currentRevision: 1 },
    });
  });

  test("merges a concurrent causal checkpoint instead of replacing peer evidence", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const peerRecord = causalCheckpointRecord(1, [
      { sourceTabId: "tab-peer", sequence: "8", reinterpretsThrough: "7", deltaRows: 1 },
    ]);
    port.saveOverride = (record) => {
      port.saveOverride = null;
      port.setRecord(peerRecord);
      return Promise.resolve(conflict(`Revision ${String(record.revision)} raced a peer write.`));
    };

    expect(
      started.value.publishCausalCorrection({ sequence: "6", reinterpretsThrough: "5", deltaRows: 2 }),
    ).toMatchObject({ ok: true });
    expect(await started.value.drainCausalCorrectionCheckpoint()).toMatchObject({
      ok: true,
      value: {
        causal: {
          corrections: [
            { sourceTabId: "tab-a", sequence: "6" },
            { sourceTabId: "tab-peer", sequence: "8" },
          ],
        },
        causalCheckpoint: { state: "saved", currentRevision: 2 },
      },
    });
  });

  test("backpressures recovery when local capacity cannot retain every persisted correction", async () => {
    const port = new MemoryCheckpointPort(
      causalCheckpointRecord(3, [
        { sourceTabId: "tab-a", sequence: "4", reinterpretsThrough: "3", deltaRows: 1 },
        { sourceTabId: "tab-b", sequence: "8", reinterpretsThrough: "7", deltaRows: 1 },
      ]),
    );
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser({ ...options(), maxCausalCorrections: 1 }, port, starter.start);

    expect(started).toMatchObject({
      ok: false,
      feedback: { source: "causal-ledger", severity: "backpressure", code: "causal-correction-capacity-exhausted" },
    });
    expect(starter.starts).toEqual([]);
    expect(port.closeCalls).toBe(1);
    expect(port.recordFor(browserCausalCorrectionCheckpointNodeId("node-a"))).toMatchObject({ revision: 3 });
  });

  test("keeps failed correction persistence visible and allows an explicit retry", async () => {
    const port = new MemoryCheckpointPort();
    port.saveOverride = () =>
      Promise.resolve({
        ok: false,
        feedback: {
          severity: "heat",
          code: "checkpoint-write-failed",
          detail: "injected correction checkpoint failure",
        },
      });
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(
      started.value.publishCausalCorrection({ sequence: "6", reinterpretsThrough: "5", deltaRows: 1 }),
    ).toMatchObject({ ok: true });
    expect(await started.value.drainCausalCorrectionCheckpoint()).toMatchObject({
      ok: false,
      feedback: { source: "checkpoint-store", code: "checkpoint-write-failed" },
    });
    expect(started.value.stop()).toMatchObject({
      ok: false,
      feedback: { source: "checkpoint-store", code: "checkpoint-write-failed" },
    });
    expect(port.closeCalls).toBe(0);

    port.saveOverride = null;
    expect(await started.value.drainCausalCorrectionCheckpoint()).toMatchObject({
      ok: true,
      value: { causalCheckpoint: { state: "saved", currentRevision: 1, feedback: null } },
    });
    expect(started.value.stop()).toMatchObject({ ok: true });
    expect(port.closeCalls).toBe(1);
  });

  test("starts cold, checkpoints an advanced transcript, and retracts to the initial room", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(starter.starts[0]?.checkpoint).toBe("none");
    expect(starter.starts[0]?.transcript).toMatchObject({
      ...initialTranscript,
      causalReadout: { admission: "open", corrections: [], maxCorrections: 2 },
    });
    expect(started.value.read()).toMatchObject({
      schema: DARK_HALL_BROWSER_DURABLE_RUNTIME_SCHEMA,
      recoveredRevision: null,
      currentRevision: null,
      room: { roomName: "browser-room", latestTick: 1 },
      database: null,
      causal: {
        schema: "zeta.darkhall.causal-readout.v2",
        admission: "open",
        maxCorrections: 2,
        remainingCapacity: 2,
        corrections: [],
      },
    });

    expect(started.value.updateDatabaseReadout(databaseReadout)).toMatchObject({
      ok: true,
      value: { database: databaseReadout },
    });
    expect(starter.databaseUpdates).toEqual([databaseReadout]);

    expect(
      started.value.publishCausalCorrection({ sequence: "14", reinterpretsThrough: "12", deltaRows: 2 }),
    ).toMatchObject({ ok: true });
    expect(starter.causalCorrections).toEqual([{ sequence: "14", reinterpretsThrough: "12", deltaRows: 2 }]);
    expect(started.value.read().causal).toMatchObject({
      remainingCapacity: 1,
      corrections: [{ sourceTabId: "tab-a", sequence: "14", reinterpretsThrough: "12", deltaRows: 2 }],
    });
    expect(starter.updates[0]).toMatchObject({
      roomName: "browser-room",
      causalReadout: { corrections: [{ sourceTabId: "tab-a", sequence: "14" }] },
    });

    const advanced: RoomRunTranscript = {
      ...initialTranscript,
      roomName: "advanced-room",
      ticks: [...initialTranscript.ticks, { tick: 2, phase: "continue", event: "advanced", outcome: "continued" }],
    };
    const saved = await started.value.checkpoint(2, advanced);
    expect(saved.ok).toBe(true);
    expect(starter.updates).toHaveLength(2);
    expect(starter.updates[1]).toMatchObject({
      roomName: "advanced-room",
      causalReadout: { corrections: [{ sourceTabId: "tab-a", sequence: "14" }] },
    });
    expect(starter.checkpointUpdates).toEqual(["durable"]);
    expect(starter.checkpointInvalidations).toEqual([{ sourceTabId: "tab-a", operation: "saved", revision: 2 }]);
    expect(started.value.read()).toMatchObject({
      recoveredRevision: null,
      currentRevision: 2,
      host: { coordinator: { liveness: { checkpoint: "durable" } } },
      room: { roomName: "advanced-room", latestTick: 2 },
    });

    const staleRetraction = await started.value.retract(1);
    expect(staleRetraction).toMatchObject({ ok: false, feedback: { code: "checkpoint-revision-conflict" } });
    expect(await started.value.retract(2)).toEqual({ ok: true, value: true });
    expect(starter.updates).toHaveLength(3);
    expect(starter.updates[2]).toMatchObject({
      roomName: "browser-room",
      causalReadout: { corrections: [{ sourceTabId: "tab-a", sequence: "14" }] },
    });
    expect(starter.checkpointUpdates).toEqual(["durable", "none"]);
    expect(starter.checkpointInvalidations).toEqual([
      { sourceTabId: "tab-a", operation: "saved", revision: 2 },
      { sourceTabId: "tab-a", operation: "removed", revision: 2 },
    ]);
    expect(started.value.read()).toMatchObject({
      currentRevision: null,
      host: { coordinator: { liveness: { checkpoint: "none" } } },
      room: { roomName: "browser-room" },
    });
    expect(await started.value.drainCausalCorrectionCheckpoint()).toMatchObject({ ok: true });
    expect(port.record).toBeNull();
    expect(port.recordFor(browserCausalCorrectionCheckpointNodeId("node-a"))).toMatchObject({ revision: 1 });
  });

  test("converges peer corrections and backpressures instead of forgetting retained evidence", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    starter.starts[0]?.onCausalCorrection?.({
      sourceTabId: "tab-c",
      sequence: "4",
      reinterpretsThrough: "3",
      deltaRows: 2,
    });
    starter.starts[0]?.onCausalCorrection?.({
      sourceTabId: "tab-b",
      sequence: "2",
      reinterpretsThrough: "1",
      deltaRows: 1,
    });

    const readout = started.value.read().causal;
    expect(readout.corrections.map((correction) => `${correction.sourceTabId}/${correction.sequence}`)).toEqual([
      "tab-b/2",
      "tab-c/4",
    ]);
    expect(readout).toMatchObject({ admission: "backpressure", remainingCapacity: 0, feedback: null });

    (readout.corrections[0] as { sourceTabId: string }).sourceTabId = "mutated";
    expect(started.value.read().causal.corrections[0]?.sourceTabId).toBe("tab-b");

    expect(
      started.value.publishCausalCorrection({ sequence: "6", reinterpretsThrough: "5", deltaRows: 3 }),
    ).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "causal-correction-capacity-exhausted" },
    });
    expect(starter.causalCorrections).toEqual([]);
    expect(started.value.read().causal).toMatchObject({
      admission: "backpressure",
      feedback: { code: "causal-correction-capacity-exhausted" },
      corrections: [{ sourceTabId: "tab-b" }, { sourceTabId: "tab-c" }],
    });
  });

  test("rejects an invalid causal capacity before starting the browser host", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser({ ...options(), maxCausalCorrections: 0 }, port, starter.start);

    expect(started).toMatchObject({
      ok: false,
      feedback: { source: "causal-ledger", code: "causal-correction-ledger-configuration-invalid" },
    });
    expect(starter.starts).toEqual([]);
    expect(port.closeCalls).toBe(1);
  });

  test("recovers the persisted transcript before the browser host starts", async () => {
    const recoveredTranscript: RoomRunTranscript = {
      ...initialTranscript,
      roomName: "recovered-room",
      continuationReadout: {
        schema: "zeta.darkhall.continuation-readout.v1",
        source: "browser",
        loopId: "loop-a",
        resumable: true,
        token: "resume:8",
        statePointer: "room:7",
        nextLap: 8,
        ticksSpent: 7,
        resumeBaseTick: 7,
        stopReason: "checkpoint",
        admissionFeedback: [],
      },
    };
    const port = new MemoryCheckpointPort(checkpointRecord(7, recoveredTranscript));
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(starter.starts[0]?.checkpoint).toBe("durable");
    expect(starter.starts[0]?.transcript).toMatchObject({
      ...recoveredTranscript,
      causalReadout: { admission: "open", corrections: [], maxCorrections: 2 },
    });
    expect(started.value.read()).toMatchObject({
      recoveredRevision: 7,
      currentRevision: 7,
      room: { roomName: "recovered-room", continuationToken: "resume:8" },
    });
  });

  test("rereads authoritative storage when a peer invalidates the local projection", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const peerTranscript: RoomRunTranscript = {
      ...initialTranscript,
      roomName: "peer-room",
      ticks: [...initialTranscript.ticks, { tick: 9, phase: "continue", event: "peer-save", outcome: "continued" }],
    };
    port.record = checkpointRecord(9, peerTranscript);
    starter.starts[0]?.onCheckpointInvalidated?.({ sourceTabId: "tab-b", operation: "saved", revision: 9 });
    const synchronizedSave = await started.value.drainCheckpointInvalidations();

    expect(synchronizedSave).toMatchObject({
      ok: true,
      value: {
        currentRevision: 9,
        checkpointSync: {
          state: "applied",
          invalidation: { sourceTabId: "tab-b", operation: "saved", revision: 9 },
          appliedRevision: 9,
        },
        host: { coordinator: { liveness: { checkpoint: "durable" } } },
        room: { roomName: "peer-room", latestTick: 9 },
      },
    });
    expect(starter.updates).toHaveLength(1);
    expect(starter.updates[0]).toMatchObject({
      ...peerTranscript,
      causalReadout: { admission: "open", corrections: [], maxCorrections: 2 },
    });

    const newerTranscript = { ...peerTranscript, roomName: "newer-than-notice" };
    port.record = checkpointRecord(10, newerTranscript);
    starter.starts[0]?.onCheckpointInvalidated?.({ sourceTabId: "tab-b", operation: "removed", revision: 9 });
    const synchronizedStaleRemoval = await started.value.drainCheckpointInvalidations();

    expect(synchronizedStaleRemoval).toMatchObject({
      ok: true,
      value: {
        currentRevision: 10,
        checkpointSync: {
          state: "applied",
          invalidation: { sourceTabId: "tab-b", operation: "removed", revision: 9 },
          appliedRevision: 10,
        },
        host: { coordinator: { liveness: { checkpoint: "durable" } } },
        room: { roomName: "newer-than-notice" },
      },
    });

    port.record = null;
    starter.starts[0]?.onCheckpointInvalidated?.({ sourceTabId: "tab-b", operation: "removed", revision: 10 });
    expect(await started.value.drainCheckpointInvalidations()).toMatchObject({
      ok: true,
      value: {
        currentRevision: null,
        checkpointSync: { state: "applied", appliedRevision: null },
        host: { coordinator: { liveness: { checkpoint: "none" } } },
        room: { roomName: "browser-room" },
      },
    });
  });

  test("does not let an older peer reread overwrite a newer local commit", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const stalePeerTranscript = { ...initialTranscript, roomName: "stale-peer" };
    const deferredPeerLoad: {
      resolve: ((result: BrowserCheckpointResult<BrowserCheckpointRecord | null>) => void) | null;
    } = { resolve: null };
    port.loadOverride = () =>
      new Promise((resolve) => {
        deferredPeerLoad.resolve = resolve;
      });
    starter.starts[0]?.onCheckpointInvalidated?.({ sourceTabId: "tab-b", operation: "saved", revision: 10 });
    await Promise.resolve();

    port.loadOverride = null;
    const localTranscript = { ...initialTranscript, roomName: "newer-local" };
    const localSave = await started.value.checkpoint(11, localTranscript);
    expect(localSave.ok).toBe(true);
    if (deferredPeerLoad.resolve === null) throw new Error("The deferred peer load did not start.");
    deferredPeerLoad.resolve(succeeded(checkpointRecord(10, stalePeerTranscript)));

    expect(await started.value.drainCheckpointInvalidations()).toMatchObject({
      ok: true,
      value: {
        currentRevision: 11,
        checkpointSync: { state: "applied", appliedRevision: 11 },
        room: { roomName: "newer-local" },
      },
    });
  });

  test("rejects non-durable initial state and corrupt recovery before starting the host", async () => {
    const starter = createStarter();
    const invalidPort = new MemoryCheckpointPort();
    const invalidInitial = await startDurableDarkHallBrowser(
      { ...options(), initialTranscript: { ...initialTranscript, browserTabReadout: coordinatorReadout } },
      invalidPort,
      starter.start,
    );
    expect(invalidInitial).toMatchObject({
      ok: false,
      feedback: { source: "room-checkpoint", code: "room-checkpoint-non-durable-state" },
    });
    expect(invalidPort.closeCalls).toBe(1);
    expect(starter.starts).toHaveLength(0);

    const corruptPort = new MemoryCheckpointPort({
      schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
      nodeId: browserCheckpointRecordNodeId("room", "node-a"),
      revision: 1,
      payload: new TextEncoder().encode("not-json"),
    });
    const corrupt = await startDurableDarkHallBrowser(options(), corruptPort, starter.start);
    expect(corrupt).toMatchObject({
      ok: false,
      feedback: { source: "room-checkpoint", code: "room-checkpoint-decode-failed" },
    });
    expect(corruptPort.closeCalls).toBe(1);
    expect(starter.starts).toHaveLength(0);

    const corruptCausalPort = new MemoryCheckpointPort({
      schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
      nodeId: browserCausalCorrectionCheckpointNodeId("node-a"),
      revision: 1,
      payload: new TextEncoder().encode("not-json"),
    });
    const corruptCausal = await startDurableDarkHallBrowser(options(), corruptCausalPort, starter.start);
    expect(corruptCausal).toMatchObject({
      ok: false,
      feedback: { source: "causal-checkpoint", code: "causal-checkpoint-decode-failed" },
    });
    expect(corruptCausalPort.closeCalls).toBe(1);
    expect(starter.starts).toHaveLength(0);
  });

  test("reports an injected storage rejection as typed feedback and closes the port", async () => {
    const port = new MemoryCheckpointPort();
    port.rejectLoad = true;
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);

    expect(started).toMatchObject({
      ok: false,
      feedback: { source: "checkpoint-store", code: "checkpoint-operation-threw" },
    });
    expect(port.closeCalls).toBe(1);
    expect(starter.starts).toHaveLength(0);
  });

  test("keeps the committed revision visible when rendering the new transcript fails", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter(true);
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const advanced = { ...initialTranscript, roomName: "persisted-before-render" };
    const saved = await started.value.checkpoint(3, advanced);
    expect(saved).toMatchObject({ ok: false, feedback: { source: "room-render", code: "room-render-failed" } });
    expect(port.record?.revision).toBe(3);
    expect(started.value.read()).toMatchObject({
      currentRevision: 3,
      room: { roomName: "persisted-before-render" },
    });
  });

  test("keeps the committed revision when the checkpoint projection rejects the update", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter(false, true);
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const advanced = { ...initialTranscript, roomName: "persisted-before-projection" };
    const saved = await started.value.checkpoint(4, advanced);
    expect(saved).toMatchObject({
      ok: false,
      feedback: { source: "browser-runtime", code: "coordinator-operation-failed" },
    });
    expect(port.record?.revision).toBe(4);
    expect(starter.checkpointUpdates).toEqual(["durable"]);
    expect(starter.updates).toHaveLength(1);
    expect(starter.updates[0]).toMatchObject({
      ...advanced,
      causalReadout: { admission: "open", corrections: [], maxCorrections: 2 },
    });
    expect(started.value.read()).toMatchObject({
      currentRevision: 4,
      host: { coordinator: { liveness: { checkpoint: "none" } } },
      room: { roomName: "persisted-before-projection" },
    });
  });

  test("stops the browser host and checkpoint port exactly once", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(started.value.stop()).toMatchObject({ ok: true, value: { host: { stopped: true } } });
    expect(started.value.stop()).toMatchObject({ ok: true, value: { host: { stopped: true } } });
    expect(port.closeCalls).toBe(1);
    expect(await started.value.checkpoint(1, initialTranscript)).toMatchObject({
      ok: false,
      feedback: { code: "checkpoint-store-closed" },
    });
    expect(await started.value.retract(1)).toMatchObject({
      ok: false,
      feedback: { code: "checkpoint-store-closed" },
    });
  });

  test("native startup reports unavailable IndexedDB without throwing", async () => {
    const started = await startNativeDurableDarkHallBrowser({
      ...options(),
      root: {},
      databaseName: "zeta-test",
      storeName: "rooms",
    });
    expect(started).toMatchObject({
      ok: false,
      feedback: { source: "checkpoint-store", code: "indexed-db-unavailable", severity: "backpressure" },
    });
  });
});
