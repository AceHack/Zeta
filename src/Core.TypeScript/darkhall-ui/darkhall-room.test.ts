import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BLACK_BODY_READOUT_SCHEMA,
  classifyHeatKind,
  HEAT_FSHARP_SURFACE,
  coordinationBandwidth,
  HEAT_READOUT_SCHEMA,
  HEAT_SIGNAL_QSHARP_SOURCE,
  HEAT_SIGNAL_TREATY_PATH,
  TEMPERATURE_READOUT_SCHEMA,
  sLaneVerdict,
  blackBodyPeakFrequencyPpm,
  blackBodyRadiancePpm,
  blackBodyReadout,
  heatSignals,
  normalizeHeatSignals,
  normalizeControllerCells,
  renderDarkHallRoomDocument,
  renderDarkHallRoomHtml,
  summarizeHeatRows,
  temperatureBand,
  temperatureReadout,
  thermalPpm,
  type HeatReadout,
  type HeatRow,
  type RoomRunTranscript,
} from "./darkhall-room";

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
      continuation: "spawn:darkhall-heat-board:2:2:saves/darkhall/darkhall-heat-board/lap-2-tick-2.heat-board",
    },
  ],
  heatRows,
  heatReadout,
  temperatureReadout: transcriptTemperatureReadout,
  blackBodyReadout: transcriptBlackBodyReadout,
};

describe("Dark Hall CSS room UI", () => {
  it("projects a transcript into a stable 4x4 controller surface", () => {
    const html = renderDarkHallRoomHtml(transcript);

    expect((html.match(/class="zeta-room-cell"/g) ?? []).length).toBe(16);
    expect(html).toContain('data-selected="true"');
    expect(html).toContain('data-cell="13"');
    expect(html).toContain("darkhall.play.meta-cart-host");
    expect(html).toContain("spawn:darkhall-heat-board");
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
    expect(html).toContain('data-signals="denied"');
    expect(html).toContain('data-heat-signals="denied"');
    expect(html).toContain("<dd>denied</dd>");
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
    expect(doc).toContain('data-temperature-band="warm"');
    expect(doc).toContain('data-black-body-readout="zeta.blackbody.readout.v1"');
    expect(doc).toContain(`data-black-body-radiance="${transcriptBlackBodyReadout.radiancePpm.toString()}"`);
    expect(doc).toContain('<link rel="stylesheet" href="./darkhall-room.css">');
    expect(doc).not.toContain("<script");
    expect(doc).not.toMatch(/setInterval|requestAnimationFrame|performance\.now|Date\./);
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr));");
    expect(css).toContain("transform: scaleX(var(--heat-rejected));");
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/\banimation\b/);
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
