import {
  startNativeDarkHallBrowser,
  type DarkHallBrowserBootstrapFeedback,
  type DarkHallBrowserRuntime,
} from "../darkhall-ui/darkhall-browser-bootstrap";
import {
  BROWSER_CHECKPOINT_RECORD_SCHEMA,
  openNativeIndexedDbCheckpointPort,
  type BrowserCheckpointFeedback,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
  type BrowserCheckpointResult,
} from "./browser-indexeddb-checkpoint";
import {
  decodeBrowserRoomCheckpoint,
  encodeBrowserRoomCheckpoint,
  type BrowserRoomCheckpointFeedback,
  type BrowserRoomCheckpointResult,
  type DurableRoomRunTranscript,
} from "./browser-room-checkpoint";
import type { BrowserLifecycleHostReadout, BrowserLifecycleResult } from "./browser-lifecycle-host";
import type { RoomRunTranscript } from "../darkhall-ui/darkhall-room";

export const BROWSER_MULTITAB_FIXTURE_SCHEMA = "zeta.browser-multitab-fixture.v3" as const;

type BrowserMultitabFeedback =
  | DarkHallBrowserBootstrapFeedback
  | BrowserCheckpointFeedback
  | BrowserRoomCheckpointFeedback;

export type BrowserMultitabFixtureReadout =
  | {
      readonly ok: true;
      readonly value: {
        readonly schema: typeof BROWSER_MULTITAB_FIXTURE_SCHEMA;
        readonly host: BrowserLifecycleHostReadout;
        readonly checkpoint: BrowserMultitabCheckpointReadout;
      };
    }
  | { readonly ok: false; readonly feedback: BrowserMultitabFeedback };

type BrowserMultitabFixtureFailure = Extract<BrowserMultitabFixtureReadout, { readonly ok: false }>;

export interface BrowserMultitabCheckpointReadout {
  readonly recoveredRevision: number | null;
  readonly currentRevision: number | null;
  readonly payloadBytes: number | null;
  readonly room: {
    readonly roomName: string;
    readonly seed: string;
    readonly latestTick: number | null;
    readonly continuationToken: string | null;
  } | null;
}

export type BrowserMultitabFixtureStopResult =
  | BrowserLifecycleResult<BrowserLifecycleHostReadout>
  | { readonly ok: false; readonly feedback: BrowserMultitabFeedback };

export type BrowserMultitabCheckpointResult<T> = BrowserCheckpointResult<T> | BrowserRoomCheckpointResult<T>;

export interface BrowserMultitabFixtureApi {
  read(): BrowserMultitabFixtureReadout;
  checkpoint(revision: number): Promise<BrowserMultitabCheckpointResult<BrowserCheckpointRecord>>;
  removeCheckpoint(throughRevision: number): Promise<BrowserCheckpointResult<boolean>>;
  stop(): BrowserMultitabFixtureStopResult;
}

const initialTranscript: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "browser-smoke",
  seed: "real-chromium-two-page",
  controller: [{ cell: 0, label: "continue", actionId: "room.continue", selected: true }],
  ticks: [{ tick: 1, phase: "observe", event: "browser-room-started", outcome: "ok" }],
  heatRows: [],
  continuationReadout: {
    schema: "zeta.darkhall.continuation-readout.v1",
    source: "browser-smoke",
    loopId: "browser-smoke-loop",
    resumable: true,
    token: "resume:2",
    statePointer: "real-chromium-two-page:1",
    nextLap: 2,
    ticksSpent: 1,
    resumeBaseTick: 1,
    stopReason: "initial",
    admissionFeedback: [],
  },
};

function transcriptAtRevision(revision: number): RoomRunTranscript {
  return {
    ...initialTranscript,
    ticks: [
      ...initialTranscript.ticks,
      {
        tick: revision,
        phase: "continue",
        event: "browser-room-checkpointed",
        outcome: "continued",
        continuation: `resume:${String(revision + 1)}`,
      },
    ],
    continuationReadout: {
      schema: "zeta.darkhall.continuation-readout.v1",
      source: "browser-smoke",
      loopId: "browser-smoke-loop",
      resumable: true,
      token: `resume:${String(revision + 1)}`,
      statePointer: `real-chromium-two-page:${String(revision)}`,
      nextLap: revision + 1,
      ticksSpent: revision,
      resumeBaseTick: revision,
      stopReason: "checkpoint",
      admissionFeedback: [],
    },
  };
}

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function queryParameter(name: string): string | null {
  const location = record(Reflect.get(globalThis, "location"));
  const search = location === null ? "" : Reflect.get(location, "search");
  return new URLSearchParams(typeof search === "string" ? search : "").get(name);
}

function elementById(id: string): unknown {
  const documentValue = record(Reflect.get(globalThis, "document"));
  if (documentValue === null) return null;
  const getElementById = Reflect.get(documentValue, "getElementById");
  if (typeof getElementById !== "function") return null;
  return Reflect.apply(getElementById, documentValue, [id]);
}

function read(
  runtime: DarkHallBrowserRuntime,
  recoveredRevision: number | null,
  currentCheckpoint: BrowserCheckpointRecord | null,
  currentTranscript: DurableRoomRunTranscript | null,
): BrowserMultitabFixtureReadout {
  const latestTick = currentTranscript?.ticks.reduce<number | null>(
    (latest, tick) => (latest === null || tick.tick > latest ? tick.tick : latest),
    null,
  );
  return {
    ok: true,
    value: {
      schema: BROWSER_MULTITAB_FIXTURE_SCHEMA,
      host: runtime.host.read(),
      checkpoint: {
        recoveredRevision,
        currentRevision: currentCheckpoint?.revision ?? null,
        payloadBytes: currentCheckpoint?.payload.byteLength ?? null,
        room:
          currentTranscript === null
            ? null
            : {
                roomName: currentTranscript.roomName,
                seed: currentTranscript.seed,
                latestTick: latestTick ?? null,
                continuationToken: currentTranscript.continuationReadout?.token ?? null,
              },
      },
    },
  };
}

const mount = elementById("darkhall-room");
const nodeId = queryParameter("node") ?? "llmtv-browser-smoke";
const checkpointPortResult = await openNativeIndexedDbCheckpointPort(globalThis, {
  databaseName: "zeta-browser-smoke",
  storeName: "node-checkpoints",
});
const loaded = checkpointPortResult.ok ? await checkpointPortResult.value.load(nodeId) : checkpointPortResult;
const decoded =
  loaded.ok && loaded.value !== null
    ? decodeBrowserRoomCheckpoint(loaded.value.payload)
    : ({ ok: true, value: initialTranscript } as const);
const started =
  loaded.ok && decoded.ok
    ? startNativeDarkHallBrowser({
        mount,
        channelName: queryParameter("channel") ?? "zeta-darkhall-browser-smoke",
        transcript: decoded.value,
        nodeId,
        tabId: queryParameter("tab") ?? "tab-unknown",
        initialSequence: Number(queryParameter("sequence") ?? "0"),
        maxTrackedTabs: 8,
        maxFeedback: 8,
        capabilities: ["css", "javascript", "broadcast-channel", "indexed-db"],
        checkpoint: loaded.value === null ? "none" : "durable",
      })
    : null;

let startupFailure: BrowserMultitabFixtureFailure | null = null;
if (!checkpointPortResult.ok) startupFailure = checkpointPortResult;
else if (!loaded.ok) startupFailure = loaded;
else if (!decoded.ok) startupFailure = decoded;
else if (started === null) {
  startupFailure = {
    ok: false,
    feedback: {
      severity: "heat",
      code: "checkpoint-store-closed",
      detail: "The browser checkpoint fixture could not create its room runtime.",
    },
  };
} else if (!started.ok) startupFailure = started;

let currentCheckpoint = loaded.ok ? loaded.value : null;
let currentTranscript: DurableRoomRunTranscript | null =
  loaded.ok && loaded.value !== null && decoded.ok ? decoded.value : null;
const recoveredRevision = currentCheckpoint?.revision ?? null;
const checkpointPort: BrowserCheckpointPort | null = checkpointPortResult.ok ? checkpointPortResult.value : null;

let api: BrowserMultitabFixtureApi;
if (startupFailure !== null || started === null || !started.ok || checkpointPort === null) {
  const failure: BrowserMultitabFixtureFailure = startupFailure ?? {
    ok: false,
    feedback: {
      severity: "heat",
      code: "checkpoint-store-closed",
      detail: "The browser checkpoint fixture did not start.",
    },
  };
  if (checkpointPort !== null) checkpointPort.close();
  api = {
    read: () => failure,
    checkpoint: () =>
      Promise.resolve({
        ok: false,
        feedback: {
          severity: "heat",
          code: "checkpoint-store-closed",
          detail: "The browser checkpoint fixture did not start.",
        },
      }),
    removeCheckpoint: () =>
      Promise.resolve({
        ok: false,
        feedback: {
          severity: "heat",
          code: "checkpoint-store-closed",
          detail: "The browser checkpoint fixture did not start.",
        },
      }),
    stop: () => failure,
  };
} else {
  const runtime = started.value;
  api = {
    read: () => read(runtime, recoveredRevision, currentCheckpoint, currentTranscript),
    checkpoint: async (revision) => {
      const nextTranscript = transcriptAtRevision(revision);
      const encoded = encodeBrowserRoomCheckpoint(nextTranscript);
      if (!encoded.ok) return encoded;
      const saved = await checkpointPort.save({
        schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
        nodeId,
        revision,
        payload: encoded.value,
      });
      if (saved.ok) {
        currentCheckpoint = saved.value;
        currentTranscript = nextTranscript;
      }
      return saved;
    },
    removeCheckpoint: async (throughRevision) => {
      const removed = await checkpointPort.remove(nodeId, throughRevision);
      if (removed.ok && removed.value) {
        currentCheckpoint = null;
        currentTranscript = null;
      }
      return removed;
    },
    stop: () => {
      const stopped = runtime.host.stop();
      const closed = checkpointPort.close();
      return stopped.ok && !closed.ok ? closed : stopped;
    },
  };
}

Reflect.set(globalThis, "__zetaBrowserSmoke", api);
