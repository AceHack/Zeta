import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BROWSER_NODE_SCHEMA } from "../browser-node/browser-node";
import {
  BROWSER_TAB_COORDINATOR_SCHEMA,
  type BrowserTabCoordinatorReadout,
} from "../browser-node/browser-tab-coordinator";
import {
  BLACK_BODY_READOUT_SCHEMA,
  classifyHeatKind,
  HEAT_FSHARP_SURFACE,
  HEAT_RECEIPT_SCHEMA,
  coordinationBandwidth,
  HEAT_READOUT_SCHEMA,
  HEAT_SIGNAL_QSHARP_SOURCE,
  HEAT_SIGNAL_TREATY_PATH,
  TEMPERATURE_READOUT_SCHEMA,
  TEMPERATURE_REFERENCE_ORACLE,
  sLaneVerdict,
  blackBodyPeakFrequencyPpm,
  blackBodyRadiancePpm,
  blackBodyReadout,
  heatReceiptFromRow,
  heatReceiptPpm,
  heatReceiptsFromRows,
  heatSignals,
  normalizeHeatSignals,
  normalizeControllerCells,
  renderDarkHallRoomDocument,
  renderDarkHallRoomHtml,
  roomTranscriptToLlmtv,
  summarizeHeatRows,
  temperatureBand,
  temperatureReadout,
  temperatureTreatyBundle,
  thermalPpm,
  type HeatReadout,
  type HeatRow,
  type RoomRunTranscript,
} from "./darkhall-room";
import { renderLlmtvDocument } from "./darkhall-tv";
import { DARK_HALL_CAUSAL_HANDOFF_READOUT_SCHEMA, DARK_HALL_CAUSAL_READOUT_SCHEMA } from "./darkhall-causal-readout";
import { DARK_HALL_DATABASE_READOUT_SCHEMA, type DarkHallDatabaseReadout } from "./darkhall-database-readout";

const css = readFileSync(join(import.meta.dir, "darkhall-room.css"), "utf-8");
const heatTreaty = JSON.parse(
  readFileSync(join(import.meta.dir, "..", "..", "Core.QSharp.ReferenceOracle", "heat-signals-treaty.json"), "utf-8"),
) as {
  readonly schema: string;
  readonly readoutSchema: string;
  readonly temperatureReadoutSchema: string;
  readonly blackBodyReadoutSchema: string;
  readonly qsharpSource: string;
  readonly fsharpSurface: string;
  readonly signals: readonly { readonly token: string; readonly public: boolean }[];
  readonly temperatureCases: readonly {
    readonly id: string;
    readonly heatPpm: number;
    readonly uncertaintyPpm: number;
    readonly pressurePpm: number;
    readonly attentionPpm: number;
    readonly temperaturePpm: number;
    readonly band: "cold" | "warm" | "hot" | "critical";
    readonly fidelity: "exact" | "saturated" | "below-resolution" | "out-of-domain";
  }[];
  readonly blackBodyCases: readonly {
    readonly id: string;
    readonly temperaturePpm: number;
    readonly radiancePpm: number;
    readonly peakFrequencyPpm: number;
  }[];
};

const doorDeniedHeat: HeatRow = {
  tick: 1,
  roomName: "darkhall",
  heatRejected: 1,
  backpressured: 1,
  storageErrors: 0,
  heatKinds: ["room-boundary.door-denied"],
  signals: ["denied"],
  reasons: ["darkhall -> glass refused"],
};

const horizonHeat: HeatRow = {
  tick: 2,
  roomName: "darkhall",
  heatRejected: 2,
  backpressured: 0,
  storageErrors: 1,
  heatKinds: ["room-horizon.forgotten", "custom.storage"],
  signals: ["forgotten", "storage-error"],
  reasons: ["bounded horizon forgot materialized keys", "sink storage failed"],
};

const heatRows: readonly HeatRow[] = [doorDeniedHeat, horizonHeat];

const heatReadout: HeatReadout = {
  schema: HEAT_READOUT_SCHEMA,
  qsharpTreaty: HEAT_SIGNAL_TREATY_PATH,
  qsharpSource: HEAT_SIGNAL_QSHARP_SOURCE,
  rows: 2,
  heatRejected: 3,
  backpressured: 1,
  storageErrors: 1,
  heatKinds: ["room-boundary.door-denied", "room-horizon.forgotten", "custom.storage"],
  signals: ["denied", "forgotten", "storage-error"],
  reasons: ["darkhall -> glass refused", "bounded horizon forgot materialized keys", "sink storage failed"],
};

const transcriptTemperatureReadout = temperatureReadout({
  source: "darkhall",
  heatPpm: 187_500,
  uncertaintyPpm: 62_500,
  pressurePpm: 62_500,
  attentionPpm: 0,
});

const transcriptBlackBodyReadout = blackBodyReadout({
  source: transcriptTemperatureReadout.source,
  temperaturePpm: transcriptTemperatureReadout.temperaturePpm,
});

const transcriptTemperatureTreaty = temperatureTreatyBundle({
  temperature: transcriptTemperatureReadout,
  blackBody: transcriptBlackBodyReadout,
});

const continuationToken = "spawn:darkhall-heat-board:2:2:saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board";

const transcriptContinuationReadout = {
  schema: "zeta.darkhall.continuation-readout.v1",
  source: "DarkHallScheduler heat-board sim loop",
  loopId: "darkhall-heat-board",
  resumable: true,
  token: continuationToken,
  statePointer: "saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board",
  nextLap: 2,
  ticksSpent: 2,
  resumeBaseTick: 2,
  stopReason: "lap-budget",
  admissionFeedback: [],
} as const;

const browserTabReadout: BrowserTabCoordinatorReadout = {
  schema: BROWSER_TAB_COORDINATOR_SCHEMA,
  nodeSchema: BROWSER_NODE_SCHEMA,
  nodeId: "llmtv-room-a",
  localTabId: "tab-a",
  tabs: [
    { tabId: "tab-a", sequence: 4, state: "foreground" },
    { tabId: "tab-b", sequence: 2, state: "background" },
    { tabId: "tab-<dark>", sequence: 9, state: "dark" },
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
    darkTabIds: ["tab-<dark>"],
  },
  feedback: [
    {
      severity: "backpressure",
      code: "tab-capacity-exhausted",
      detail: "The bounded readout retained its current peers.",
    },
  ],
};

const databaseReadout: DarkHallDatabaseReadout = {
  schema: DARK_HALL_DATABASE_READOUT_SCHEMA,
  sourceSchema: "zeta.db.tick.v1",
  nodeId: "llmtv-room-db",
  executorId: "tab-<b>",
  executorKind: "browser-tab",
  revision: 12,
  admission: "backpressured",
  accepted: 2,
  duplicates: 1,
  nextDeltaIndex: 3,
  rows: [
    { rowKey: "game/<score>", payload: "9000 & rising", weight: 1 },
    { rowKey: "game/lives", payload: "2", weight: -1 },
  ],
  feedback: [
    {
      severity: "backpressure",
      code: "database-capacity-exhausted",
      detail: "The finite tick budget was spent.",
    },
  ],
};

const transcript: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "darkhall",
  seed: "0x2a",
  generatedBy: "DarkHallScheduler heat-board sim loop",
  controller: [
    {
      cell: 0,
      label: "play/meta-cart",
      actionId: "darkhall.play.meta-cart-host",
      actionClass: "transition",
      gate: "append-only",
      selected: true,
    },
    {
      cell: 13,
      label: "re-observe",
      actionId: "darkhall.reobserve",
      actionClass: "operator",
      gate: "append-only",
    },
  ],
  ticks: [
    {
      tick: 1,
      phase: "observe",
      event: "controller readout banked",
      choiceCell: 0,
      outcome: "backpressure",
      heat: doorDeniedHeat,
    },
    {
      tick: 2,
      phase: "continue",
      event: "finite horizon measured",
      outcome: "continued",
      heat: horizonHeat,
      continuation: continuationToken,
    },
  ],
  heatRows,
  heatReadout,
  temperatureReadout: transcriptTemperatureReadout,
  blackBodyReadout: transcriptBlackBodyReadout,
  temperatureTreaty: transcriptTemperatureTreaty,
  continuationReadout: transcriptContinuationReadout,
  travelerFrame: {
    schema: "zeta.darkhall.traveler-frame.v1",
    source: "DarkHallScheduler heat-board sim loop",
    commonPhase: 2,
    coordinates: [
      { traveler: "heat:darkhall", phase: 2 },
      { traveler: "room:darkhall", phase: 2 },
    ],
    commonDominatesRoom: true,
    commonDominatesHeat: true,
  },
  phaseClock: {
    schema: "zeta.darkhall.phase-clock.v1",
    source: "DarkHallScheduler heat-board sim loop",
    basis: "seed-phase",
    seed: "0x2a",
    phase: 2,
    skewBoundTicks: 0,
    appendOnly: true,
    travelers: 2,
  },
};

describe("Dark Hall CSS room UI", () => {
  it("projects a transcript into a stable 4x4 controller surface", () => {
    const html = renderDarkHallRoomHtml(transcript);

    expect((html.match(/class="zeta-room-cell"/g) ?? []).length).toBe(16);
    expect(html).toContain('data-selected="true"');
    expect(html).toContain('data-cell="13"');
    expect(html).toContain("darkhall.play.meta-cart-host");
    expect(html).toContain('class="zeta-room-cell-input"');
    expect(html).toContain('data-controller-cell="13"');
    expect(html).toContain('aria-keyshortcuts="D"');
    expect(html).toContain("spawn:darkhall-heat-board");
    expect(html).toContain(`data-temperature-treaty="${HEAT_SIGNAL_TREATY_PATH}"`);
    expect(html).toContain(`data-temperature-oracle="${TEMPERATURE_REFERENCE_ORACLE}"`);
    expect(html).toContain('data-traveler-frame="zeta.darkhall.traveler-frame.v1"');
    expect(html).toContain('data-traveler-phase="2"');
    expect(html).toContain('data-phase-clock="zeta.darkhall.phase-clock.v1"');
    expect(html).toContain('data-phase-clock-basis="seed-phase"');
    expect(html).toContain('data-phase="2"');
    expect(html).toContain('data-phase-skew-bound="0"');
    expect(html).toContain('data-continuation-readout="zeta.darkhall.continuation-readout.v1"');
    expect(html).toContain('data-continuation-status="resumable"');
    expect(html).toContain('data-continuation-loop="darkhall-heat-board"');
    expect(html).toContain('data-continuation-stop="lap-budget"');
    expect(html).toContain('data-continuation-next-lap="2"');
    expect(html).toContain('data-continuation-resume-base-tick="2"');
    expect(html).toContain("<dt>skew</dt><dd>0</dd>");
    expect(html).toContain("<dt>resume</dt><dd>resumable</dd>");
    expect(html).toContain(`<code>${continuationToken}</code>`);
  });

  it("renders later corrections without implying backward execution or history rewrites", () => {
    const withCausalReadout: RoomRunTranscript = {
      ...transcript,
      causalReadout: {
        schema: DARK_HALL_CAUSAL_READOUT_SCHEMA,
        sourceSchema: "zeta.browser-causal-correction-ledger.v1",
        executionDirection: "forward-only",
        appendOnly: true,
        rewritesHistory: false,
        maxCorrections: 4,
        remainingCapacity: 3,
        admission: "open",
        corrections: [
          {
            sourceTabId: "tab-b",
            sequence: "9007199254740994",
            reinterpretsThrough: "9007199254740993",
            deltaRows: 2,
          },
        ],
        feedback: null,
      },
      causalHandoffReadout: {
        schema: DARK_HALL_CAUSAL_HANDOFF_READOUT_SCHEMA,
        localTabId: "tab-a",
        maxCorrections: 4,
        pendingHandoffs: 1,
        maxPendingHandoffs: 3,
        status: "offered",
        direction: "outbound",
        handoffId: "handoff/room",
        peerTabId: "tab-b",
        correctionCount: 1,
        admittedCorrections: 0,
        feedback: null,
      },
    };
    const html = renderDarkHallRoomHtml(withCausalReadout);

    expect(html).toContain(`data-causal-readout="${DARK_HALL_CAUSAL_READOUT_SCHEMA}"`);
    expect(html).toContain('data-execution-direction="forward-only"');
    expect(html).toContain('data-rewrites-history="false"');
    expect(html).toContain('data-correction-count="1"');
    expect(html).toContain('data-correction-capacity="4"');
    expect(html).toContain('data-correction-remaining="3"');
    expect(html).toContain('data-correction-admission="open"');
    expect(html).toContain('data-correction-source="tab-b"');
    expect(html).toContain('data-correction-sequence="9007199254740994"');
    expect(html).toContain('data-reinterprets-through="9007199254740993"');
    expect(html).toContain("<dt>direction</dt><dd>forward-only</dd>");
    expect(html).toContain("history 9007199254740993");
    expect(html).toContain("correction 9007199254740994");
    expect(html).toContain("source tab-b");
    expect(html).toContain(`data-causal-handoff-readout="${DARK_HALL_CAUSAL_HANDOFF_READOUT_SCHEMA}"`);
    expect(html).toContain('data-causal-handoff-status="offered"');
    expect(html).toContain('data-causal-handoff-direction="outbound"');
    expect(html).toContain('data-causal-handoff-id="handoff/room"');
    expect(html).toContain('data-causal-handoff-peer="tab-b"');
    expect(html).toContain('data-causal-handoff-corrections="1"');
    expect(html).toContain('data-causal-handoff-admitted="0"');
    expect(html).toContain('data-causal-handoff-pending="1"');
    expect(html).toContain('data-causal-handoff-capacity="3"');
    expect(html).toContain("peer handoff");
    expect(html).toContain("1 records · 0 new · 1 / 3 pending");
    expect(css).toContain(".zeta-room-causality");
    expect(css).toContain(".zeta-causal-correction");
    expect(css).toContain(".zeta-causal-handoff");
    expect(css).not.toContain("animation:");

    const llmtv = renderLlmtvDocument(roomTranscriptToLlmtv(withCausalReadout));
    expect(llmtv).toContain(`data-causal-readout="${DARK_HALL_CAUSAL_READOUT_SCHEMA}"`);
    expect(llmtv).toContain('data-correction-admission="open"');
    expect(llmtv).toContain('data-correction-count="1"');
    expect(llmtv).toContain('data-source="tab-b"');
    expect(llmtv).toContain("9007199254740993 &rarr; 9007199254740994");
    expect(llmtv).toContain(`data-causal-handoff-readout="${DARK_HALL_CAUSAL_HANDOFF_READOUT_SCHEMA}"`);
    expect(llmtv).toContain('data-causal-handoff-status="offered"');
    expect(llmtv).toContain('data-causal-handoff-direction="outbound"');
    expect(llmtv).toContain('data-causal-handoff-id="handoff/room"');
    expect(llmtv).toContain('data-causal-handoff-peer="tab-b"');
    expect(llmtv).toContain('data-causal-handoff-pending="1"');
    expect(llmtv).toContain('data-causal-handoff-capacity="3"');
    expect(llmtv).toContain("handoff · offered");
  });

  it("keeps causal rendering additive for transcripts without a readout", () => {
    const html = renderDarkHallRoomHtml(transcript);

    expect(html).not.toContain("zeta-room-causality");
    expect(html).not.toContain("data-causal-readout");
    expect(html).not.toContain("data-causal-handoff-readout");
  });

  it("projects browser tab ownership and liveness into CSS-addressable room state", () => {
    const html = renderDarkHallRoomHtml({ ...transcript, browserTabReadout });

    expect(html).toContain(`data-browser-tab-readout="${BROWSER_TAB_COORDINATOR_SCHEMA}"`);
    expect(html).toContain('data-browser-node="llmtv-room-a"');
    expect(html).toContain('data-browser-local-tab="tab-a"');
    expect(html).toContain('data-browser-local-state="foreground"');
    expect(html).toContain('data-browser-availability="live"');
    expect(html).toContain('data-browser-continuity="multi-tab"');
    expect(html).toContain('data-browser-checkpoint="durable"');
    expect(html).toContain('data-browser-alive="true"');
    expect(html).toContain('data-browser-feedback="1"');
    expect(html).toContain("--browser-tab-count:3");
    expect(html).toContain("--browser-live-ratio:0.6667");
    expect(html).toContain('data-tab="tab-a" data-state="foreground" data-local="true"');
    expect(html).toContain('data-tab="tab-&lt;dark&gt;" data-state="dark" data-local="false"');
    expect(html).not.toContain("tab-<dark>");
    expect(html).not.toContain("<script");
    expect(css).toContain('.zeta-browser-tab[data-local="true"]');
    expect(css).toContain("var(--browser-live-ratio, 0)");
    expect(css).not.toContain("animation:");
  });

  it("keeps browser tab rendering additive for transcripts without a readout", () => {
    const html = renderDarkHallRoomHtml(transcript);

    expect(html).not.toContain("zeta-room-browser");
    expect(html).not.toContain("data-browser-tab-readout");
  });

  it("projects database rows and executor handoff into CSS-addressable room state", () => {
    const html = renderDarkHallRoomHtml({ ...transcript, databaseReadout });

    expect(html).toContain(`data-database-readout="${DARK_HALL_DATABASE_READOUT_SCHEMA}"`);
    expect(html).toContain('data-database-node="llmtv-room-db"');
    expect(html).toContain('data-database-executor="tab-&lt;b&gt;"');
    expect(html).toContain('data-database-executor-kind="browser-tab"');
    expect(html).toContain('data-database-revision="12"');
    expect(html).toContain('data-database-admission="backpressured"');
    expect(html).toContain('data-database-rows="2"');
    expect(html).toContain('data-row-key="game/&lt;score&gt;" data-row-weight="1"');
    expect(html).toContain('data-database-row-select="true" data-row-key="game/&lt;score&gt;"');
    expect(html).toContain('aria-label="Load game/&lt;score&gt; into the row command editor"');
    expect(html).toContain("9000 &amp; rising");
    expect(html).toContain('data-row-key="game/lives" data-row-weight="-1"');
    expect(html).not.toContain("game/<score>");
    expect(css).toContain('.zeta-room-database[data-database-admission="backpressured"]');
    expect(css).not.toContain("animation:");
  });

  it("normalizes sparse controller cells without letting callers resize the grid", () => {
    const cells = normalizeControllerCells([
      { cell: 15, label: "meta" },
      { cell: 99, label: "out-of-range" },
      { cell: 15, label: "duplicate" },
    ]);

    expect(cells.length).toBe(16);
    expect(cells[15]?.label).toBe("meta");
    expect(cells.some((cell) => cell.label === "out-of-range")).toBe(false);
    expect(cells.some((cell) => cell.label === "duplicate")).toBe(false);
  });

  it("classifies heat into the same room-facing signal families used by the scheduler", () => {
    expect(classifyHeatKind("room-horizon.forgotten")).toBe("forgotten");
    expect(classifyHeatKind("soft-emu.prune")).toBe("forgotten");
    expect(classifyHeatKind("meta-cart.policy-backpressure")).toBe("backpressure");
    expect(classifyHeatKind("room-boundary.door-denied")).toBe("denied");
    expect(classifyHeatKind("bounded.storage-error")).toBe("storage-error");
    expect(classifyHeatKind("llmtv.replay.invalid")).toBe("invalid");
    expect(classifyHeatKind("llmtv.replay.expired")).toBe("expired");
    expect(classifyHeatKind("llmtv.replay.stale")).toBe("stale");
    expect(normalizeHeatSignals(["backpressure", "future-signal"])).toEqual(["backpressure", "other"]);

    expect(heatSignals(doorDeniedHeat)).toEqual(["denied"]);
    expect(heatSignals(horizonHeat)).toEqual(["forgotten", "storage-error"]);

    expect(summarizeHeatRows(heatRows)).toEqual({
      rows: 2,
      heatRejected: 3,
      backpressured: 1,
      storageErrors: 1,
      heatKinds: ["room-boundary.door-denied", "room-horizon.forgotten", "custom.storage"],
      signals: ["denied", "forgotten", "storage-error"],
    });
  });

  it("trusts F# transcript heat signals without reparsing heatKinds", () => {
    const sourceTagged: HeatRow = {
      tick: 3,
      roomName: "darkhall",
      heatRejected: 1,
      backpressured: 1,
      storageErrors: 0,
      heatKinds: ["room-boundary.door-denied"],
      signals: ["backpressure"],
      reasons: ["explicit F# scheduler signal wins"],
    };

    expect(heatSignals(sourceTagged)).toEqual(["backpressure"]);
    const firstTick = transcript.ticks[0];
    if (firstTick === undefined) {
      throw new Error("test transcript must have a first tick");
    }
    expect(
      renderDarkHallRoomHtml({
        ...transcript,
        heatRows: [sourceTagged],
        ticks: [{ ...firstTick, heat: sourceTagged }],
      }),
    ).toContain('data-signals="backpressure"');
  });

  it("projects heat rows into compact provenance receipts without changing the heat summary", () => {
    expect(heatReceiptPpm(1)).toBe(62_500);
    // Was `expect(heatReceiptPpm(99)).toBe(1_000_000)` — that assertion PINNED the defect:
    // the old linear encoder saturated at 16 units, so 99 units and 1_000_000 units were the
    // same picture. 99 units now reads below the ceiling and below `critical`
    // (081M00TYT8N087G0R003MPMRX9); saturation is reported as a value, not as a maxed gauge.
    expect(heatReceiptPpm(99)).toBe(415_240);
    expect(heatReceiptPpm(99)).toBeLessThan(heatReceiptPpm(1_000));

    const receipts = heatReceiptsFromRows(heatRows, { source: "darkhall/room" });

    expect(receipts).toHaveLength(2);
    expect(receipts[0]).toEqual({
      schema: HEAT_RECEIPT_SCHEMA,
      source: "darkhall/room",
      tick: 1,
      roomName: "darkhall",
      outcome: "denied",
      policy: "no-forget",
      heatPpm: 62_500,
      pressurePpm: 62_500,
      storagePpm: 0,
      signals: ["denied"],
      heatKinds: ["room-boundary.door-denied"],
      reasons: ["darkhall -> glass refused"],
      // Appended by the schema-evolution decision
      // (docs/research/2026-08-14-how-a-published-four-oracle-schema-acquires-a-field.md):
      // three OPTIONAL per-rail fidelity keys on `zeta.heat.receipt.v1`. Every
      // value key above is unchanged — this row is a healthy receipt, so all
      // three read `exact`, and the diff against the pre-decision expectation is
      // purely additive. `081M01400RZ087G0R000PS3VJG`.
      heatFidelity: "exact",
      pressureFidelity: "exact",
      storageFidelity: "exact",
      // 081M01400RZ087G0R000PS3VJG — the two optional signal-provenance keys.
      // This row carries `signals: ["denied"]` on the wire, so the channel was READ
      // (`reported`) and it handed over one token. Pinned here rather than left to
      // the key-set audit: `zeta.heat.receipt.v1` is bound by TypeScript alone, so
      // no cross-oracle key-set check compares it and the value vector is the only
      // guard that an oracle quietly dropping these keys would trip.
      signalSource: "reported",
      signalObservations: 1,
    });
    expect(heatReceiptFromRow(horizonHeat).outcome).toBe("storage-error");
    expect(heatReceiptFromRow(horizonHeat).policy).toBe("host-export");
  });

  it("renders an F# DarkHallRoomTranscript JSON fixture with source-owned heat signals", () => {
    const fromFsharp = JSON.parse(`{
      "schema": "zeta.darkhall.room-ui.v1",
      "roomName": "darkhall",
      "seed": "S4",
      "generatedBy": "DarkHallRoomTranscript.fs",
      "controller": [],
      "ticks": [
        {
          "tick": 1,
          "phase": "measure",
          "event": "heat-row:1",
          "choiceCell": -1,
          "outcome": "backpressure",
          "heat": {
            "tick": 1,
            "roomName": "darkhall",
            "heatRejected": 1,
            "backpressured": 1,
            "storageErrors": 0,
            "heatKinds": ["room-boundary.door-denied"],
            "signals": ["denied"],
            "reasons": ["darkhall -> glass refused"]
          },
          "continuation": ""
        }
      ],
      "heatReadout": {
        "schema": "zeta.heat.readout.v1",
        "qsharpTreaty": "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json",
        "qsharpSource": "src/Core.QSharp.ReferenceOracle/HeatSignals.qs",
        "rows": 1,
        "heatRejected": 1,
        "backpressured": 1,
        "storageErrors": 0,
        "heatKinds": ["room-boundary.door-denied"],
        "signals": ["denied"],
        "reasons": ["darkhall -> glass refused"]
      },
      "continuationReadout": {
        "schema": "zeta.darkhall.continuation-readout.v1",
        "source": "DarkHallRoomTranscript.fs",
        "loopId": "darkhall-heat-board",
        "resumable": true,
        "token": "spawn:darkhall-heat-board:2:2:saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board",
        "statePointer": "saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board",
        "nextLap": 2,
        "ticksSpent": 2,
        "resumeBaseTick": 2,
        "stopReason": "lap-budget",
        "admissionFeedback": []
      },
      "heatRows": [
        {
          "tick": 1,
          "roomName": "darkhall",
          "heatRejected": 1,
          "backpressured": 1,
          "storageErrors": 0,
          "heatKinds": ["room-boundary.door-denied"],
          "signals": ["denied"],
          "reasons": ["darkhall -> glass refused"]
        }
      ]
    }`) as RoomRunTranscript;

    const html = renderDarkHallRoomHtml(fromFsharp);

    expect(html).toContain('data-heat-readout="zeta.heat.readout.v1"');
    expect(html).toContain(`data-heat-treaty="${HEAT_SIGNAL_TREATY_PATH}"`);
    expect(html).toContain(`data-qsharp-source="${HEAT_SIGNAL_QSHARP_SOURCE}"`);
    expect(html).toContain('data-phase-clock="zeta.darkhall.phase-clock.v1"');
    expect(html).toContain('data-phase="1"');
    expect(html).toContain('data-continuation-status="resumable"');
    expect(html).toContain('data-continuation-stop="lap-budget"');
    expect(html).toContain('data-signals="denied"');
    expect(html).toContain('data-heat-signals="denied"');
    expect(html).toContain("<dd>denied</dd>");
  });

  it("renders an F# DarkHallRoomTranscript JSON fixture with the temperature treaty bundle", () => {
    const fromFsharp = JSON.parse(`{
      "schema": "zeta.darkhall.room-ui.v1",
      "roomName": "darkhall",
      "seed": "S4",
      "generatedBy": "DarkHallRoomTranscript.fs",
      "controller": [],
      "ticks": [],
      "heatReadout": {
        "schema": "zeta.heat.readout.v1",
        "qsharpTreaty": "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json",
        "qsharpSource": "src/Core.QSharp.ReferenceOracle/HeatSignals.qs",
        "rows": 1,
        "heatRejected": 1,
        "backpressured": 1,
        "storageErrors": 0,
        "heatKinds": ["room-boundary.door-denied"],
        "signals": ["denied"],
        "reasons": ["darkhall -> glass refused"]
      },
      "temperatureReadout": {
        "schema": "zeta.temperature.readout.v1",
        "source": "darkhall",
        "temperaturePpm": 62500,
        "band": "warm",
        "heatPpm": 62500,
        "uncertaintyPpm": 0,
        "pressurePpm": 62500,
        "attentionPpm": 0
      },
      "blackBodyReadout": {
        "schema": "zeta.blackbody.readout.v1",
        "source": "darkhall",
        "temperaturePpm": 62500,
        "radiancePpm": 15,
        "peakFrequencyPpm": 62500
      },
      "temperatureTreaty": {
        "heatReadoutSchema": "zeta.heat.readout.v1",
        "temperatureReadoutSchema": "zeta.temperature.readout.v1",
        "blackBodyReadoutSchema": "zeta.blackbody.readout.v1",
        "qsharpTreaty": "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json",
        "qsharpSource": "src/Core.QSharp.ReferenceOracle/HeatSignals.qs",
        "fsharpSurface": "src/Core/Heat.fs",
        "referenceOracle": "fsharp-blackbody-reference",
        "referenceFeedback": [],
        "temperature": {
          "schema": "zeta.temperature.readout.v1",
          "source": "darkhall",
          "temperaturePpm": 62500,
          "band": "warm",
          "heatPpm": 62500,
          "uncertaintyPpm": 0,
          "pressurePpm": 62500,
          "attentionPpm": 0
        },
        "blackBody": {
          "schema": "zeta.blackbody.readout.v1",
          "source": "darkhall",
          "temperaturePpm": 62500,
          "radiancePpm": 15,
          "peakFrequencyPpm": 62500
        }
      },
      "heatRows": [
        {
          "tick": 1,
          "roomName": "darkhall",
          "heatRejected": 1,
          "backpressured": 1,
          "storageErrors": 0,
          "heatKinds": ["room-boundary.door-denied"],
          "signals": ["denied"],
          "reasons": ["darkhall -> glass refused"]
        }
      ]
    }`) as RoomRunTranscript;

    const html = renderDarkHallRoomHtml(fromFsharp);

    expect(html).toContain(`data-temperature-treaty="${HEAT_SIGNAL_TREATY_PATH}"`);
    expect(html).toContain(`data-temperature-qsharp-source="${HEAT_SIGNAL_QSHARP_SOURCE}"`);
    expect(html).toContain(`data-temperature-oracle="${TEMPERATURE_REFERENCE_ORACLE}"`);
    expect(html).toContain('data-temperature-readout="zeta.temperature.readout.v1"');
    expect(html).toContain('data-black-body-radiance="15"');
    expect(html).not.toContain("data-temperature-feedback=");
  });

  it("keeps the room heat readout aligned with the Q# signal treaty", () => {
    const publicTokens = heatTreaty.signals.filter((signal) => signal.public).map((signal) => signal.token);

    expect(heatTreaty.schema).toBe("zeta.qsharp.heat-signals.v1");
    expect(heatTreaty.readoutSchema).toBe(HEAT_READOUT_SCHEMA);
    expect(heatTreaty.temperatureReadoutSchema).toBe(TEMPERATURE_READOUT_SCHEMA);
    expect(heatTreaty.blackBodyReadoutSchema).toBe(BLACK_BODY_READOUT_SCHEMA);
    expect(heatTreaty.qsharpSource).toBe(HEAT_SIGNAL_QSHARP_SOURCE);
    expect(heatTreaty.fsharpSurface).toBe(HEAT_FSHARP_SURFACE);
    expect(heatReadout.qsharpTreaty).toBe(HEAT_SIGNAL_TREATY_PATH);
    expect(heatReadout.signals.every((signal) => publicTokens.includes(signal))).toBe(true);
  });

  it("carries the room temperature lane as one treaty bundle for LLMTV readouts", () => {
    expect(transcriptTemperatureTreaty).toEqual({
      heatReadoutSchema: HEAT_READOUT_SCHEMA,
      temperatureReadoutSchema: TEMPERATURE_READOUT_SCHEMA,
      blackBodyReadoutSchema: BLACK_BODY_READOUT_SCHEMA,
      qsharpTreaty: HEAT_SIGNAL_TREATY_PATH,
      qsharpSource: HEAT_SIGNAL_QSHARP_SOURCE,
      fsharpSurface: HEAT_FSHARP_SURFACE,
      referenceOracle: TEMPERATURE_REFERENCE_ORACLE,
      referenceFeedback: [],
      temperature: transcriptTemperatureReadout,
      blackBody: transcriptBlackBodyReadout,
    });

    const withoutTreaty: RoomRunTranscript = {
      schema: "zeta.darkhall.room-ui.v1",
      roomName: "darkhall",
      seed: "0x2a",
      generatedBy: "DarkHallScheduler heat-board sim loop",
      controller: transcript.controller,
      ticks: transcript.ticks,
      heatRows,
      heatReadout,
      temperatureReadout: transcriptTemperatureReadout,
      blackBodyReadout: transcriptBlackBodyReadout,
    };
    const html = renderDarkHallRoomHtml(withoutTreaty);

    expect(html).toContain(`data-temperature-treaty="${HEAT_SIGNAL_TREATY_PATH}"`);
    expect(html).toContain(`data-temperature-oracle="${TEMPERATURE_REFERENCE_ORACLE}"`);
    expect(html).toContain(`data-black-body-radiance="${transcriptBlackBodyReadout.radiancePpm.toString()}"`);
  });

  it("keeps temperature as a scalar uncertainty/pressure treaty while attention only records ordering pressure", () => {
    for (const vector of heatTreaty.temperatureCases) {
      expect(thermalPpm(vector.heatPpm, vector.uncertaintyPpm, vector.pressurePpm)).toBe(vector.temperaturePpm);
      expect(temperatureBand(vector.temperaturePpm)).toBe(vector.band);
      expect(
        temperatureReadout({
          source: vector.id,
          heatPpm: vector.heatPpm,
          uncertaintyPpm: vector.uncertaintyPpm,
          pressurePpm: vector.pressurePpm,
          attentionPpm: vector.attentionPpm,
        }),
      ).toMatchObject({
        schema: TEMPERATURE_READOUT_SCHEMA,
        source: vector.id,
        temperaturePpm: vector.temperaturePpm,
        band: vector.band,
        attentionPpm: vector.attentionPpm,
        // The TypeScript encoder must agree with the committed treaty vector on
        // `fidelity` too, not only on the value keys. This is the cross-oracle
        // half: `src/Core/Heat.fs` `TemperatureReadout.fidelityOfPpm` is pinned
        // to the same rows by `QSharpOracle.Tests.fs`.
        fidelity: vector.fidelity,
      });
    }

    const attended = heatTreaty.temperatureCases.find((vector) => vector.id === "attention-does-not-heat-cost");
    expect(attended).toBeDefined();
    expect(attended?.attentionPpm).toBe(1_000_000);
    expect(attended?.temperaturePpm).toBe(125_000);
  });

  it("projects black-body radiance as a finite information-temperature law", () => {
    for (const vector of heatTreaty.blackBodyCases) {
      expect(blackBodyRadiancePpm(vector.temperaturePpm)).toBe(vector.radiancePpm);
      expect(blackBodyPeakFrequencyPpm(vector.temperaturePpm)).toBe(vector.peakFrequencyPpm);
      expect(blackBodyReadout({ source: vector.id, temperaturePpm: vector.temperaturePpm })).toEqual({
        schema: BLACK_BODY_READOUT_SCHEMA,
        source: vector.id,
        temperaturePpm: vector.temperaturePpm,
        radiancePpm: vector.radiancePpm,
        peakFrequencyPpm: vector.peakFrequencyPpm,
      });
    }

    expect(blackBodyRadiancePpm(500_000)).toBe(62_500);
    expect(blackBodyRadiancePpm(1_000_000)).toBe(1_000_000);
  });

  it("renders a no-script document; CSS owns geometry and state projection", () => {
    const doc = renderDarkHallRoomDocument(transcript);

    expect(doc).toContain('data-temperature-readout="zeta.temperature.readout.v1"');
    expect(doc).toContain(`data-temperature-treaty="${HEAT_SIGNAL_TREATY_PATH}"`);
    expect(doc).toContain(`data-temperature-oracle="${TEMPERATURE_REFERENCE_ORACLE}"`);
    expect(doc).toContain('data-temperature-band="warm"');
    expect(doc).toContain('data-black-body-readout="zeta.blackbody.readout.v1"');
    expect(doc).toContain(`data-black-body-radiance="${transcriptBlackBodyReadout.radiancePpm.toString()}"`);
    expect(doc).toContain('data-continuation-status="resumable"');
    expect(doc).toContain("<dt>resume</dt><dd>resumable</dd>");
    expect(doc).toContain('<link rel="stylesheet" href="./darkhall-room.css">');
    expect(doc).not.toContain("<script");
    expect(doc).not.toMatch(/setInterval|requestAnimationFrame|performance\.now|Date\./);
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(css).toContain(".zeta-room-continuation");
    expect(css).toContain('[data-continuation-status="resumable"]');
    expect(css).toContain("transform: scaleX(var(--heat-rejected));");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/\banimation\b/);
  });

  it("projects the same room transcript into an LLMTV dweller frame", () => {
    const llmtv = roomTranscriptToLlmtv(transcript, {
      name: "darkhall-room",
      role: "room loop",
      hat: "runtime readout",
      generatedBy: "test-projector",
    });
    const dweller = llmtv.dwellers[0];
    if (dweller === undefined) {
      throw new Error("room transcript projection should create one dweller");
    }

    expect(llmtv.schema).toBe("zeta.darkhall.llmtv.v1");
    expect(llmtv.seed).toBe(transcript.seed);
    expect(llmtv.generatedBy).toBe("test-projector");
    expect(llmtv.phaseClock).toEqual(transcript.phaseClock);
    expect(llmtv.dwellers).toHaveLength(1);
    expect(dweller.name).toBe("darkhall-room");
    expect(dweller.role).toBe("room loop");
    expect(dweller.hat).toBe("runtime readout");
    expect(dweller.frame).toBe(2);
    expect(dweller.phaseClock).toEqual(transcript.phaseClock);
    expect(dweller.predictions.map((prediction) => prediction.label)).toEqual([
      "heat receipts",
      "backpressure",
      "room progress",
      "continuation",
    ]);
    expect(dweller.predictions[0]?.valueMilli).toBeGreaterThan(0);
    expect(dweller.predictions[3]?.valueMilli).toBe(1000);
    expect(dweller.predictions[3]?.epsilonMilli).toBe(0);
    expect(dweller.temperatureTreaty?.referenceOracle).toBe(TEMPERATURE_REFERENCE_ORACLE);
    expect(dweller.temperatureTreaty?.temperature).toEqual(transcriptTemperatureTreaty.temperature);
    expect(dweller.temperatureTreaty?.blackBody).toEqual(transcriptTemperatureTreaty.blackBody);
    expect(dweller.temperatureTreaty?.heatReceiptSchema).toBe(HEAT_RECEIPT_SCHEMA);
    expect(dweller.temperatureTreaty?.heatReceipts).toHaveLength(2);
    expect(dweller.temperatureTreaty?.heatReceipts?.[0]?.outcome).toBe("denied");
    expect(dweller.temperatureTreaty?.heatReceipts?.[1]?.outcome).toBe("storage-error");

    const doc = renderLlmtvDocument(llmtv);

    expect(doc).toContain('data-schema="zeta.darkhall.llmtv.v1"');
    expect(doc).toContain('data-dweller="darkhall-room"');
    expect(doc).toContain('data-phase-clock="zeta.darkhall.phase-clock.v1"');
    expect(doc).toContain('data-phase-clock-basis="seed-phase"');
    expect(doc).toContain('data-phase="2"');
    expect(doc).toContain('data-phase-skew-bound="0"');
    expect(doc).toContain('data-heat-receipts="2"');
    expect(doc).toContain("continuation");
    expect(doc).not.toContain("<script");
  });

  it("escapes transcript text before it reaches the room surface", () => {
    const hostile: RoomRunTranscript = {
      ...transcript,
      roomName: "darkhall <script>",
      controller: [{ cell: 0, label: "<img src=x onerror=alert(1)>", selected: true }],
      ticks: [{ tick: 1, phase: "measure", event: "heat <b>row</b>", outcome: "ok" }],
      heatRows: [],
    };

    const html = renderDarkHallRoomHtml(hostile);

    expect(html).toContain("darkhall &lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>row</b>");
  });
});

// ── S-lanes: the coordination board (CHSH between claimed identities) ──────────
describe("s-lanes", () => {
  const withLanes: RoomRunTranscript = {
    schema: "zeta.darkhall.room-ui.v1",
    roomName: "darkhall",
    seed: "S4",
    controller: [],
    ticks: [],
    heatRows: [],
    sLanes: [
      { a: "claim-0", b: "claim-1", sMilli: 4000 },
      { a: "claim-0", b: "claim-2", sMilli: 39 },
      { a: "claim-1", b: "claim-2", sMilli: 2000 },
    ],
  };

  it("verdict is one-way: above 2000 convicts, at or below stays open (never 'distinct')", () => {
    expect(sLaneVerdict({ a: "x", b: "y", sMilli: 4000 })).toBe("convicted");
    expect(sLaneVerdict({ a: "x", b: "y", sMilli: -4000 })).toBe("convicted");
    expect(sLaneVerdict({ a: "x", b: "y", sMilli: 2000 })).toBe("open");
    expect(sLaneVerdict({ a: "x", b: "y", sMilli: 0 })).toBe("open");
  });

  it("bandwidth is the estimator f̂ = (|S|−2)/2, clamped: 4→1, 2√2→√2−1, 2→0, 0→0", () => {
    expect(coordinationBandwidth(4000)).toBe(1);
    expect(coordinationBandwidth(2828)).toBeCloseTo(Math.SQRT2 - 1, 2);
    expect(coordinationBandwidth(2000)).toBe(0);
    expect(coordinationBandwidth(0)).toBe(0);
  });

  it("renders one lane per pair with the verdict as a data attribute and the bandwidth as a custom property", () => {
    const html = renderDarkHallRoomHtml(withLanes);
    expect(html).toContain('data-a="claim-0"');
    expect(html).toContain('data-verdict="convicted"');
    expect(html).toContain('data-verdict="open"');
    expect(html).toContain("--s-bandwidth:1.0000");
    expect(html).toContain("S 4.000");
  });

  it("is schema-additive: a transcript without sLanes renders no coordination board", () => {
    const bare: RoomRunTranscript = {
      schema: withLanes.schema,
      roomName: withLanes.roomName,
      seed: withLanes.seed,
      controller: withLanes.controller,
      ticks: withLanes.ticks,
      heatRows: withLanes.heatRows,
    };
    expect(renderDarkHallRoomHtml(bare)).not.toContain("zeta-room-coordination");
    const empty: RoomRunTranscript = { ...withLanes, sLanes: [] };
    expect(renderDarkHallRoomHtml(empty)).not.toContain("zeta-room-coordination");
  });

  it("the css styles the board (panel border, verdict colors, bandwidth fill)", () => {
    expect(css).toContain(".zeta-room-coordination");
    expect(css).toContain('.zeta-s-lane[data-verdict="convicted"]');
    expect(css).toContain("var(--s-bandwidth, 0)");
  });
});
