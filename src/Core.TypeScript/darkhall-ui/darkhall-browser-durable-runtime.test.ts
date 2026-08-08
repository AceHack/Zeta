import { describe, expect, test } from "bun:test";
import {
  BROWSER_CHECKPOINT_RECORD_SCHEMA,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
  type BrowserCheckpointResult,
} from "../browser-node/browser-indexeddb-checkpoint";
import { encodeBrowserRoomCheckpoint } from "../browser-node/browser-room-checkpoint";
import { BROWSER_NODE_SCHEMA } from "../browser-node/browser-node";
import {
  BROWSER_TAB_COORDINATOR_SCHEMA,
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
import type { RoomRunTranscript } from "./darkhall-room";

const initialTranscript: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "browser-room",
  seed: "durable-runtime",
  controller: [],
  ticks: [{ tick: 1, phase: "observe", event: "started", outcome: "ok" }],
  heatRows: [],
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
  record: BrowserCheckpointRecord | null;
  closeCalls = 0;
  rejectLoad = false;
  loadOverride: ((nodeId: string) => Promise<BrowserCheckpointResult<BrowserCheckpointRecord | null>>) | null = null;

  constructor(record: BrowserCheckpointRecord | null = null) {
    this.record = record === null ? null : copyRecord(record);
  }

  load(nodeId: string): Promise<BrowserCheckpointResult<BrowserCheckpointRecord | null>> {
    if (this.rejectLoad) return Promise.reject(new Error("injected load rejection"));
    if (this.loadOverride !== null) return this.loadOverride(nodeId);
    if (this.record !== null && this.record.nodeId !== nodeId) return Promise.resolve(succeeded(null));
    return Promise.resolve(succeeded(this.record === null ? null : copyRecord(this.record)));
  }

  save(record: BrowserCheckpointRecord): Promise<BrowserCheckpointResult<BrowserCheckpointRecord>> {
    if (this.record !== null && record.revision < this.record.revision) {
      return Promise.resolve(conflict("The stored checkpoint is newer."));
    }
    this.record = copyRecord(record);
    return Promise.resolve(succeeded(copyRecord(record)));
  }

  remove(_nodeId: string, throughRevision: number): Promise<BrowserCheckpointResult<boolean>> {
    if (this.record === null) return Promise.resolve(succeeded(false));
    if (this.record.revision > throughRevision) {
      return Promise.resolve(conflict("The stored checkpoint is newer than the retraction."));
    }
    this.record = null;
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
  readonly checkpointUpdates: string[];
  readonly checkpointInvalidations: BrowserCheckpointInvalidation[];
  readonly runtime: DarkHallBrowserRuntime;
} {
  const starts: DarkHallBrowserBootstrapOptions[] = [];
  const updates: RoomRunTranscript[] = [];
  const checkpointUpdates: string[] = [];
  const checkpointInvalidations: BrowserCheckpointInvalidation[] = [];
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
  };
  return {
    starts,
    updates,
    checkpointUpdates,
    checkpointInvalidations,
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
    nodeId: "node-a",
    revision,
    payload: encoded.value,
  };
}

describe("durable Dark Hall browser runtime", () => {
  test("starts cold, checkpoints an advanced transcript, and retracts to the initial room", async () => {
    const port = new MemoryCheckpointPort();
    const starter = createStarter();
    const started = await startDurableDarkHallBrowser(options(), port, starter.start);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(starter.starts[0]?.checkpoint).toBe("none");
    expect(starter.starts[0]?.transcript).toEqual(initialTranscript);
    expect(started.value.read()).toMatchObject({
      schema: DARK_HALL_BROWSER_DURABLE_RUNTIME_SCHEMA,
      recoveredRevision: null,
      currentRevision: null,
      room: { roomName: "browser-room", latestTick: 1 },
    });

    const advanced: RoomRunTranscript = {
      ...initialTranscript,
      roomName: "advanced-room",
      ticks: [...initialTranscript.ticks, { tick: 2, phase: "continue", event: "advanced", outcome: "continued" }],
    };
    const saved = await started.value.checkpoint(2, advanced);
    expect(saved.ok).toBe(true);
    expect(starter.updates).toEqual([advanced]);
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
    expect(starter.updates).toEqual([advanced, initialTranscript]);
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
    expect(starter.starts[0]?.transcript).toEqual(recoveredTranscript);
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
    expect(starter.updates).toEqual([peerTranscript]);

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
      nodeId: "node-a",
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
    expect(starter.updates).toEqual([advanced]);
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
