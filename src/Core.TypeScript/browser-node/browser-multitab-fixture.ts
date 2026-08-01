import {
  startNativeDarkHallBrowser,
  type DarkHallBrowserBootstrapFeedback,
  type DarkHallBrowserRuntime,
} from "../darkhall-ui/darkhall-browser-bootstrap";
import type { BrowserLifecycleHostReadout, BrowserLifecycleResult } from "./browser-lifecycle-host";
import type { RoomRunTranscript } from "../darkhall-ui/darkhall-room";

export const BROWSER_MULTITAB_FIXTURE_SCHEMA = "zeta.browser-multitab-fixture.v1" as const;

export type BrowserMultitabFixtureReadout =
  | {
      readonly ok: true;
      readonly value: {
        readonly schema: typeof BROWSER_MULTITAB_FIXTURE_SCHEMA;
        readonly host: BrowserLifecycleHostReadout;
      };
    }
  | { readonly ok: false; readonly feedback: DarkHallBrowserBootstrapFeedback };

export type BrowserMultitabFixtureStopResult =
  | BrowserLifecycleResult<BrowserLifecycleHostReadout>
  | { readonly ok: false; readonly feedback: DarkHallBrowserBootstrapFeedback };

export interface BrowserMultitabFixtureApi {
  read(): BrowserMultitabFixtureReadout;
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

function read(runtime: DarkHallBrowserRuntime): BrowserMultitabFixtureReadout {
  return {
    ok: true,
    value: {
      schema: BROWSER_MULTITAB_FIXTURE_SCHEMA,
      host: runtime.host.read(),
    },
  };
}

const mount = elementById("darkhall-room");
const started = startNativeDarkHallBrowser({
  mount,
  channelName: queryParameter("channel") ?? "zeta-darkhall-browser-smoke",
  transcript,
  nodeId: queryParameter("node") ?? "llmtv-browser-smoke",
  tabId: queryParameter("tab") ?? "tab-unknown",
  initialSequence: Number(queryParameter("sequence") ?? "0"),
  maxTrackedTabs: 8,
  maxFeedback: 8,
  capabilities: ["css", "javascript", "broadcast-channel"],
  checkpoint: "durable",
});

const api: BrowserMultitabFixtureApi = started.ok
  ? {
      read: () => read(started.value),
      stop: () => started.value.host.stop(),
    }
  : {
      read: () => started,
      stop: () => started,
    };

Reflect.set(globalThis, "__zetaBrowserSmoke", api);
