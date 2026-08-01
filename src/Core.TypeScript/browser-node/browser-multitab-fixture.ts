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
import type { BrowserLifecycleHostReadout, BrowserLifecycleResult } from "./browser-lifecycle-host";
import type { RoomRunTranscript } from "../darkhall-ui/darkhall-room";

export const BROWSER_MULTITAB_FIXTURE_SCHEMA = "zeta.browser-multitab-fixture.v2" as const;

export type BrowserMultitabFixtureReadout =
  | {
      readonly ok: true;
      readonly value: {
        readonly schema: typeof BROWSER_MULTITAB_FIXTURE_SCHEMA;
        readonly host: BrowserLifecycleHostReadout;
        readonly checkpoint: BrowserMultitabCheckpointReadout;
      };
    }
  | { readonly ok: false; readonly feedback: DarkHallBrowserBootstrapFeedback | BrowserCheckpointFeedback };

type BrowserMultitabFixtureFailure = Extract<BrowserMultitabFixtureReadout, { readonly ok: false }>;

export interface BrowserMultitabCheckpointReadout {
  readonly recoveredRevision: number | null;
  readonly currentRevision: number | null;
  readonly payload: readonly number[] | null;
}

export type BrowserMultitabFixtureStopResult =
  | BrowserLifecycleResult<BrowserLifecycleHostReadout>
  | { readonly ok: false; readonly feedback: DarkHallBrowserBootstrapFeedback | BrowserCheckpointFeedback };

export interface BrowserMultitabFixtureApi {
  read(): BrowserMultitabFixtureReadout;
  checkpoint(revision: number): Promise<BrowserCheckpointResult<BrowserCheckpointRecord>>;
  removeCheckpoint(throughRevision: number): Promise<BrowserCheckpointResult<boolean>>;
  stop(): BrowserMultitabFixtureStopResult;
}

const transcript: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "browser-smoke",
  seed: "real-chromium-two-page",
  controller: [],
  ticks: [],
  heatRows: [],
};

const checkpointPayload = Uint8Array.from(
  "zeta-browser-smoke-checkpoint-v1".split("").map((character) => character.charCodeAt(0)),
);

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
): BrowserMultitabFixtureReadout {
  return {
    ok: true,
    value: {
      schema: BROWSER_MULTITAB_FIXTURE_SCHEMA,
      host: runtime.host.read(),
      checkpoint: {
        recoveredRevision,
        currentRevision: currentCheckpoint?.revision ?? null,
        payload: currentCheckpoint === null ? null : [...currentCheckpoint.payload],
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
const started = loaded.ok
  ? startNativeDarkHallBrowser({
      mount,
      channelName: queryParameter("channel") ?? "zeta-darkhall-browser-smoke",
      transcript,
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
    read: () => read(runtime, recoveredRevision, currentCheckpoint),
    checkpoint: async (revision) => {
      const saved = await checkpointPort.save({
        schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
        nodeId,
        revision,
        payload: checkpointPayload,
      });
      if (saved.ok) currentCheckpoint = saved.value;
      return saved;
    },
    removeCheckpoint: async (throughRevision) => {
      const removed = await checkpointPort.remove(nodeId, throughRevision);
      if (removed.ok && removed.value) currentCheckpoint = null;
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
