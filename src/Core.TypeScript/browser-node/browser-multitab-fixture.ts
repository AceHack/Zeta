import {
  startNativeDurableDarkHallBrowser,
  type DarkHallBrowserDurableFeedback,
  type DarkHallBrowserDurableRuntime,
} from "../darkhall-ui/darkhall-browser-durable-runtime";
import { zetaDbTickToDarkHallDatabaseReadout } from "../darkhall-ui/darkhall-database-readout";
import type { BrowserCheckpointRecord } from "./browser-checkpoint-port";
import type { BrowserExecutionAdmissionFeedback } from "./browser-execution-admission";
import type { BrowserLifecycleHostReadout } from "./browser-lifecycle-host";
import { createNativeServiceWorkerTabChannel } from "./browser-service-worker-channel";
import type { RoomRunTranscript } from "../darkhall-ui/darkhall-room";
import { runBrowserZetaDbWake } from "./browser-zetadb-image-port";
import { createNativeBrowserExecutionAdmission } from "./browser-web-lock-execution-admission";
import type { ZetaDbDelta, ZetaDbFeedback, ZetaDbTickReadout } from "../zetadb/zeta-db-node";
import {
  startBrowserZetaDbTabRuntime,
  type BrowserZetaDbTabFeedback,
  type BrowserZetaDbTabRuntime,
} from "./browser-zetadb-tab-runtime";
import type { BrowserDatabaseInvalidation } from "./browser-tab-coordinator";

export const BROWSER_MULTITAB_FIXTURE_SCHEMA = "zeta.browser-multitab-fixture.v5" as const;

type BrowserMultitabFeedback =
  | DarkHallBrowserDurableFeedback
  | BrowserExecutionAdmissionFeedback
  | BrowserZetaDbTabFeedback
  | ZetaDbFeedback;

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

export type BrowserMultitabFixtureStopResult =
  | { readonly ok: true; readonly value: BrowserLifecycleHostReadout }
  | { readonly ok: false; readonly feedback: BrowserMultitabFeedback };

export type BrowserMultitabCheckpointResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserMultitabFeedback };

export type BrowserMultitabDatabaseResult =
  | { readonly ok: true; readonly value: ZetaDbTickReadout }
  | { readonly ok: false; readonly feedback: ZetaDbFeedback | BrowserMultitabFeedback };

export interface BrowserMultitabFixtureApi {
  read(): BrowserMultitabFixtureReadout;
  checkpoint(revision: number): Promise<BrowserMultitabCheckpointResult<BrowserCheckpointRecord>>;
  removeCheckpoint(throughRevision: number): Promise<BrowserMultitabCheckpointResult<boolean>>;
  databaseTick(deltas: readonly ZetaDbDelta[]): Promise<BrowserMultitabDatabaseResult>;
  drainDatabaseInvalidations(): Promise<BrowserMultitabDatabaseResult>;
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
const tabId = queryParameter("tab") ?? "tab-unknown";
const databaseNodeId = `${nodeId}:database`;
let receiveDatabaseInvalidation: ((invalidation: BrowserDatabaseInvalidation) => void) | null = null;
let startupDatabaseInvalidation: BrowserDatabaseInvalidation | null = null;
const pendingStartupDatabaseInvalidation = (): BrowserDatabaseInvalidation | null => startupDatabaseInvalidation;
const onDatabaseInvalidated = (invalidation: BrowserDatabaseInvalidation): void => {
  if (receiveDatabaseInvalidation !== null) {
    receiveDatabaseInvalidation(invalidation);
    return;
  }
  if (
    invalidation.databaseNodeId === databaseNodeId &&
    (startupDatabaseInvalidation === null || invalidation.revision > startupDatabaseInvalidation.revision)
  ) {
    startupDatabaseInvalidation = invalidation;
  }
};
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
      tabId,
      initialSequence: Number(queryParameter("sequence") ?? "0"),
      maxTrackedTabs: 8,
      maxFeedback: 8,
      capabilities: ["css", "javascript", "service-worker", "indexed-db"],
      onDatabaseInvalidated,
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
    drainDatabaseInvalidations: () => Promise.resolve(failure),
    stop: () => failure,
  };
} else {
  const runtime = started.value;
  const databaseAdmission = createNativeBrowserExecutionAdmission(globalThis);
  const databaseRuntime = databaseAdmission.ok
    ? startBrowserZetaDbTabRuntime({
        databaseNodeId,
        executorId: tabId,
        limits: { maxDeltas: 16, maxEntries: 64, maxCheckpointBytes: 64 * 1024 },
        admission: databaseAdmission.value,
        execute: (request) =>
          runBrowserZetaDbWake(
            globalThis,
            { databaseName: "zeta-browser-smoke-node", storeName: "database-images" },
            request,
          ),
        observe: (tick) => runtime.updateDatabaseReadout(zetaDbTickToDarkHallDatabaseReadout(tick)),
        publishInvalidation: (nextDatabaseNodeId, revision) =>
          runtime.publishDatabaseInvalidation(nextDatabaseNodeId, revision),
      })
    : databaseAdmission;
  if (!databaseRuntime.ok) {
    const failure: BrowserMultitabFixtureFailure = databaseRuntime;
    runtime.stop();
    api = {
      read: () => failure,
      checkpoint: () => Promise.resolve(failure),
      removeCheckpoint: () => Promise.resolve(failure),
      databaseTick: () => Promise.resolve(failure),
      drainDatabaseInvalidations: () => Promise.resolve(failure),
      stop: () => failure,
    };
  } else {
    const database: BrowserZetaDbTabRuntime = databaseRuntime.value;
    receiveDatabaseInvalidation = (invalidation) => {
      database.receiveInvalidation(invalidation);
    };
    const startupInvalidation = pendingStartupDatabaseInvalidation();
    if (startupInvalidation !== null) receiveDatabaseInvalidation(startupInvalidation);
    api = {
      read: () => read(runtime),
      checkpoint: (revision) => runtime.checkpoint(revision, transcriptAtRevision(revision)),
      removeCheckpoint: (throughRevision) => runtime.retract(throughRevision),
      databaseTick: (deltas) => database.tick(deltas),
      drainDatabaseInvalidations: async () => {
        const drained = await database.drainInvalidations();
        if (!drained.ok) return drained;
        return drained.value === null
          ? {
              ok: false,
              feedback: {
                severity: "heat",
                code: "database-tab-executor-threw",
                detail: "No peer database invalidation has produced a finite tick readout.",
              },
            }
          : { ok: true, value: drained.value };
      },
      stop: () => {
        database.stop();
        const stopped = runtime.stop();
        return stopped.ok ? { ok: true, value: stopped.value.host } : stopped;
      },
    };
  }
}

Reflect.set(globalThis, "__zetaBrowserSmoke", api);
