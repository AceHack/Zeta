import {
  startNativeDurableDarkHallBrowser,
  type DarkHallBrowserDurableFeedback,
  type DarkHallBrowserDurableResult,
  type DarkHallBrowserDurableRuntime,
} from "../darkhall-ui/darkhall-browser-durable-runtime";
import { zetaDbTickToDarkHallDatabaseReadout } from "../darkhall-ui/darkhall-database-readout";
import type { BrowserCheckpointRecord } from "./browser-checkpoint-port";
import type { BrowserLifecycleHostReadout } from "./browser-lifecycle-host";
import { createNativeServiceWorkerTabChannel } from "./browser-service-worker-channel";
import type { RoomRunTranscript } from "../darkhall-ui/darkhall-room";
import { runBrowserZetaDbWake } from "./browser-zetadb-image-port";
import type { ZetaDbDelta, ZetaDbFeedback, ZetaDbTickReadout } from "../zetadb/zeta-db-node";

export const BROWSER_MULTITAB_FIXTURE_SCHEMA = "zeta.browser-multitab-fixture.v4" as const;

type BrowserMultitabFeedback = DarkHallBrowserDurableFeedback;

export type BrowserMultitabFixtureReadout =
  | {
      readonly ok: true;
      readonly value: {
        readonly schema: typeof BROWSER_MULTITAB_FIXTURE_SCHEMA;
        readonly host: BrowserLifecycleHostReadout;
        readonly checkpoint: BrowserMultitabCheckpointReadout;
        readonly database: ReturnType<DarkHallBrowserDurableRuntime["read"]>["database"];
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

export type BrowserMultitabFixtureStopResult = DarkHallBrowserDurableResult<BrowserLifecycleHostReadout>;

export type BrowserMultitabCheckpointResult<T> = DarkHallBrowserDurableResult<T>;

export type BrowserMultitabDatabaseResult =
  | { readonly ok: true; readonly value: ZetaDbTickReadout }
  | { readonly ok: false; readonly feedback: ZetaDbFeedback | DarkHallBrowserDurableFeedback };

export interface BrowserMultitabFixtureApi {
  read(): BrowserMultitabFixtureReadout;
  checkpoint(revision: number): Promise<BrowserMultitabCheckpointResult<BrowserCheckpointRecord>>;
  removeCheckpoint(throughRevision: number): Promise<BrowserMultitabCheckpointResult<boolean>>;
  databaseTick(deltas: readonly ZetaDbDelta[]): Promise<BrowserMultitabDatabaseResult>;
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

function read(runtime: DarkHallBrowserDurableRuntime): BrowserMultitabFixtureReadout {
  const current = runtime.read();
  return {
    ok: true,
    value: {
      schema: BROWSER_MULTITAB_FIXTURE_SCHEMA,
      host: current.host,
      checkpoint: {
        recoveredRevision: current.recoveredRevision,
        currentRevision: current.currentRevision,
        payloadBytes: current.payloadBytes,
        room: current.currentRevision === null ? null : current.room,
      },
      database: current.database,
    },
  };
}

const mount = elementById("darkhall-room");
const nodeId = queryParameter("node") ?? "llmtv-browser-smoke";
const serviceWorkerChannel = createNativeServiceWorkerTabChannel(globalThis);
const started = serviceWorkerChannel.ok
  ? await startNativeDurableDarkHallBrowser({
      databaseName: "zeta-browser-smoke",
      storeName: "node-checkpoints",
      mount,
      channelName: queryParameter("channel") ?? "zeta-darkhall-browser-smoke",
      channel: serviceWorkerChannel.value,
      initialTranscript,
      nodeId,
      tabId: queryParameter("tab") ?? "tab-unknown",
      initialSequence: Number(queryParameter("sequence") ?? "0"),
      maxTrackedTabs: 8,
      maxFeedback: 8,
      capabilities: ["css", "javascript", "service-worker", "indexed-db"],
    })
  : ({
      ok: false,
      feedback: {
        severity: serviceWorkerChannel.feedback.severity,
        code: "channel-start-failed",
        source: "browser-runtime",
        detail: `${serviceWorkerChannel.feedback.code}: ${serviceWorkerChannel.feedback.detail}`,
        cleanup: [],
      },
    } as const);

let api: BrowserMultitabFixtureApi;
if (!started.ok) {
  const failure: BrowserMultitabFixtureFailure = started;
  api = {
    read: () => failure,
    checkpoint: () => Promise.resolve(failure),
    removeCheckpoint: () => Promise.resolve(failure),
    databaseTick: () => Promise.resolve(failure),
    stop: () => failure,
  };
} else {
  const runtime = started.value;
  api = {
    read: () => read(runtime),
    checkpoint: (revision) => runtime.checkpoint(revision, transcriptAtRevision(revision)),
    removeCheckpoint: (throughRevision) => runtime.retract(throughRevision),
    databaseTick: async (deltas) => {
      const tick = await runBrowserZetaDbWake(
        globalThis,
        { databaseName: "zeta-browser-smoke-node", storeName: "database-images" },
        {
          nodeId: `${nodeId}:database`,
          executorId: queryParameter("tab") ?? "tab-unknown",
          executorKind: "browser-tab",
          deltas,
          limits: { maxDeltas: 16, maxEntries: 64, maxCheckpointBytes: 64 * 1024 },
        },
      );
      if (!tick.ok) return tick;
      const rendered = runtime.updateDatabaseReadout(zetaDbTickToDarkHallDatabaseReadout(tick.value));
      return rendered.ok ? tick : rendered;
    },
    stop: () => {
      const stopped = runtime.stop();
      return stopped.ok ? { ok: true, value: stopped.value.host } : stopped;
    },
  };
}

Reflect.set(globalThis, "__zetaBrowserSmoke", api);
