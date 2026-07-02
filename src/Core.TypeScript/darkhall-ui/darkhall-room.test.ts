import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyHeatKind,
  coordinationBandwidth,
  sLaneVerdict,
  heatSignals,
  normalizeControllerCells,
  renderDarkHallRoomDocument,
  renderDarkHallRoomHtml,
  summarizeHeatRows,
  type HeatRow,
  type RoomRunTranscript,
} from "./darkhall-room";

const css = readFileSync(join(import.meta.dir, "darkhall-room.css"), "utf-8");

const doorDeniedHeat: HeatRow = {
  tick: 1,
  roomName: "darkhall",
  heatRejected: 1,
  backpressured: 1,
  storageErrors: 0,
  heatKinds: ["room-boundary.door-denied"],
  reasons: ["darkhall -> glass refused"],
};

const horizonHeat: HeatRow = {
  tick: 2,
  roomName: "darkhall",
  heatRejected: 2,
  backpressured: 0,
  storageErrors: 1,
  heatKinds: ["room-horizon.forgotten", "custom.storage"],
  reasons: ["bounded horizon forgot materialized keys", "sink storage failed"],
};

const heatRows: readonly HeatRow[] = [doorDeniedHeat, horizonHeat];

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

  it("renders a no-script document; CSS owns geometry and state projection", () => {
    const doc = renderDarkHallRoomDocument(transcript);

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
    const { sLanes: _omitSLanes, ...bare } = withLanes; // omit, not set-undefined (exactOptionalPropertyTypes)
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
