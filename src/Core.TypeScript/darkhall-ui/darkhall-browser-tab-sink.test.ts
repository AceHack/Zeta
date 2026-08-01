import { describe, expect, test } from "bun:test";
import { BROWSER_NODE_SCHEMA } from "../browser-node/browser-node";
import {
  BROWSER_TAB_COORDINATOR_SCHEMA,
  type BrowserTabCoordinatorReadout,
} from "../browser-node/browser-tab-coordinator";
import {
  createDarkHallBrowserTabSink,
  createNativeDarkHallRoomMount,
  type DarkHallRoomMount,
} from "./darkhall-browser-tab-sink";
import type { RoomRunTranscript } from "./darkhall-room";

const transcript: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "darkhall",
  seed: "browser-host",
  controller: [],
  ticks: [],
  heatRows: [],
};

const readout: BrowserTabCoordinatorReadout = {
  schema: BROWSER_TAB_COORDINATOR_SCHEMA,
  nodeSchema: BROWSER_NODE_SCHEMA,
  nodeId: "llmtv-room-a",
  localTabId: "tab-a",
  tabs: [
    { tabId: "tab-a", sequence: 2, state: "foreground" },
    { tabId: "tab-b", sequence: 4, state: "background" },
  ],
  liveness: {
    runtime: "node-capable",
    availability: "live",
    continuity: "multi-tab",
    zetaAlive: true,
    criticalPathEligible: false,
    checkpoint: "durable",
    openTabIds: ["tab-a", "tab-b"],
    liveTabIds: ["tab-a", "tab-b"],
    suspendedTabIds: [],
    darkTabIds: [],
  },
  feedback: [],
};

describe("Dark Hall browser tab sink", () => {
  test("renders coordinator observations into the room mount without scripts", () => {
    const writes: string[] = [];
    const mount: DarkHallRoomMount = {
      replace: (markup) => {
        writes.push(markup);
        return { ok: true, value: null };
      },
    };
    const sink = createDarkHallBrowserTabSink(transcript, mount);

    expect(sink.write(readout)).toEqual({ ok: true, value: null });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('data-browser-node="llmtv-room-a"');
    expect(writes[0]).toContain('data-browser-local-tab="tab-a"');
    expect(writes[0]).toContain('data-browser-continuity="multi-tab"');
    expect(writes[0]).not.toContain("<script");
    expect(transcript.browserTabReadout).toBeUndefined();
  });

  test("adapts an innerHTML mount through a typed native edge", () => {
    const element = { innerHTML: "old" };
    const mounted = createNativeDarkHallRoomMount(element);
    expect(mounted.ok).toBe(true);
    if (!mounted.ok) return;

    expect(mounted.value.replace("<section>room</section>")).toEqual({ ok: true, value: null });
    expect(element.innerHTML).toBe("<section>room</section>");
    expect(createNativeDarkHallRoomMount({})).toEqual({
      ok: false,
      detail: "The supplied Dark Hall room mount does not expose innerHTML.",
    });
  });

  test("converts a throwing mount into typed feedback", () => {
    const sink = createDarkHallBrowserTabSink(transcript, {
      replace: () => {
        throw new Error("injected mount failure");
      },
    });

    expect(sink.write(readout)).toEqual({
      ok: false,
      detail: "The injected Dark Hall room mount threw while replacing markup.",
    });
  });
});
