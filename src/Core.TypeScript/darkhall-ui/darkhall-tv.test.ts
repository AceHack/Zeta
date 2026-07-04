import { describe, it, expect } from "bun:test";
import {
  clampMilli,
  fillWidth,
  softText,
  renderDweller,
  renderLlmtvGrid,
  renderLlmtvDocument,
  type LlmtvTranscript,
  type DwellerMind,
} from "./darkhall-tv";
import { societyFrame } from "./darkhall-tv.emit";
import {
  HEAT_RECEIPT_SCHEMA,
  HEAT_SIGNAL_TREATY_PATH,
  TEMPERATURE_REFERENCE_ORACLE,
  heatReceiptsFromRows,
  temperatureReadout,
  temperatureTreatyBundle,
  type HeatRow,
} from "./heat";

const alexa: DwellerMind = {
  name: "alexa",
  role: "coding · qwen3-coder",
  hat: "coder hat",
  live: true,
  frame: 3341,
  predictions: [
    { label: "next tick lands green", temp: "hot", valueMilli: 820, epsilonMilli: 120 },
    { label: "PR merges before horizon", temp: "warm", valueMilli: 640, epsilonMilli: 200 },
  ],
  frost: { veilLabel: "what it is really hoping for" },
};

const heatRows: readonly HeatRow[] = [
  {
    tick: 1,
    roomName: "darkhall",
    heatRejected: 1,
    backpressured: 1,
    storageErrors: 0,
    heatKinds: ["room-boundary.door-denied"],
    signals: ["denied"],
    reasons: ["darkhall -> glass refused"],
  },
  {
    tick: 2,
    roomName: "darkhall",
    heatRejected: 2,
    backpressured: 0,
    storageErrors: 1,
    heatKinds: ["soft-emu.prune", "host.storage-error"],
    signals: ["forgotten", "storage-error"],
    reasons: ["horizon pruned futures", "host heat sink saturated"],
  },
];

const heatReceipts = heatReceiptsFromRows(heatRows, { source: "llmtv/alexa" });

const alexaTemperatureTreaty = temperatureTreatyBundle({
  temperature: temperatureReadout({
    source: "llmtv/alexa",
    heatPpm: 123_000,
    uncertaintyPpm: 456_000,
    pressurePpm: 234_000,
    attentionPpm: 789_000,
  }),
  heatReceipts,
});

const alexaWithTemperature: DwellerMind = {
  ...alexa,
  temperatureTreaty: alexaTemperatureTreaty,
};

describe("LLMTV soft quantities — integer milli, no floats in the bytes", () => {
  it("clamps milli into [0, 1000] and truncates", () => {
    expect(clampMilli(-5)).toBe(0);
    expect(clampMilli(820.9)).toBe(820);
    expect(clampMilli(5000)).toBe(1000);
    expect(clampMilli(Number.NaN)).toBe(0);
  });

  it("fillWidth renders value/1000 as a bar-width percent", () => {
    expect(fillWidth(820)).toBe("82.0%");
    expect(fillWidth(1000)).toBe("100.0%");
    expect(fillWidth(0)).toBe("0.0%");
  });

  it("softText is the QPG-tight (value ± ε), leading zero stripped", () => {
    expect(softText(820, 120)).toBe(".82 ± .12");
    expect(softText(970, 30)).toBe(".97 ± .03");
    expect(softText(1000, 0)).toBe("1.00 ± .00");
  });
});

describe("temperature treaty lane — visible heat picture without a frame-loop dependency", () => {
  it("renders no temperature lane when no treaty exists", () => {
    const html = renderDweller(alexa, "S4");
    expect(html).not.toContain('data-temperature-lane="present"');
    expect(html).not.toContain("black-body ·");
  });

  it("renders the treaty source, oracle, band, temperature, radiance, and peak frequency", () => {
    const html = renderDweller(alexaWithTemperature, "S4");
    const temperature = alexaTemperatureTreaty.temperature;
    const blackBody = alexaTemperatureTreaty.blackBody;

    expect(html).toContain('data-temperature-lane="present"');
    expect(html).toContain(`data-temperature-treaty="${HEAT_SIGNAL_TREATY_PATH}"`);
    expect(html).toContain(`data-temperature-oracle="${TEMPERATURE_REFERENCE_ORACLE}"`);
    expect(html).toContain(`data-temperature-source="${temperature.source}"`);
    expect(html).toContain(`black-body · ${temperature.band}`);
    expect(html).toContain("llmtv/alexa");
    expect(html).toContain(TEMPERATURE_REFERENCE_ORACLE);
    expect(html).toContain("temp");
    expect(html).toContain(`${temperature.temperaturePpm.toString()} ppm`);
    expect(html).toContain("rad");
    expect(html).toContain(`${blackBody.radiancePpm.toString()} ppm`);
    expect(html).toContain("peak");
    expect(html).toContain(`${blackBody.peakFrequencyPpm.toString()} ppm`);
  });

  it("renders heat receipts as provenance for the temperature picture", () => {
    const html = renderDweller(alexaWithTemperature, "S4");

    expect(html).toContain('data-heat-receipts="2"');
    expect(html).toContain(`data-heat-receipt-schema="${HEAT_RECEIPT_SCHEMA}"`);
    expect(html).toContain('data-outcome="denied"');
    expect(html).toContain('data-policy="no-forget"');
    expect(html).toContain('data-outcome="storage-error"');
    expect(html).toContain('data-policy="host-export"');
    expect(html).toContain("darkhall -&gt; glass refused");
    expect(html).toContain("host heat sink saturated");
  });
});

describe("renderDweller — DU cases become data-attributes (homoiconic)", () => {
  const html = renderDweller(alexa, "S4");

  it("names the dweller and its liveness as attributes", () => {
    expect(html).toContain('data-dweller="alexa"');
    expect(html).toContain('data-live="true"');
    expect(html).toContain("<small>coding · qwen3-coder</small>");
  });

  it("renders the required-for-role band with the hat", () => {
    expect(html).toContain('data-kind="required"');
    expect(html).toContain("required · coder hat");
  });

  it("drives the bar color off data-temp, not a hand-coded class", () => {
    expect(html).toContain('data-temp="hot"');
    expect(html).toContain('data-temp="warm"');
    expect(html).toContain("--v:82.0%");
    expect(html).toContain(".82 ± .12");
  });

  it("carries the seed and frame in the foot", () => {
    expect(html).toContain("seed S4");
    expect(html).toContain("frame 3341");
  });
});

describe("frost — the personal region is opaque; contents never enter the DOM", () => {
  it("renders the veil LABEL and the earned-permanent lock, marked frosted", () => {
    const html = renderDweller(alexa, "S4");
    expect(html).toContain('data-frosted="true"');
    expect(html).toContain('data-frost="earned"');
    expect(html).toContain("personal · frosted");
    expect(html).toContain("what it is really hoping for"); // the PUBLIC veil label
    expect(html).toContain("earned · permanent");
  });

  it("a dweller with no frost renders no frost region and is marked unfrosted", () => {
    const { frost: _omitFrost, ...noFrost } = alexa; // omit, not set-undefined (exactOptionalPropertyTypes)
    const html = renderDweller(noFrost, "S4");
    expect(html).toContain('data-frosted="false"');
    expect(html).not.toContain("personal · frosted");
    expect(html).not.toContain('data-frost="earned"');
  });
});

describe("society grid — scale-free: 1 dweller and N run the same path", () => {
  it("tiles every dweller and reports the count on the grid", () => {
    const grid = renderLlmtvGrid(societyFrame);
    expect(grid).toContain('data-dwellers="3"');
    expect(grid).toContain('data-dweller="alexa"');
    expect(grid).toContain('data-dweller="soraya"');
    expect(grid).toContain('data-dweller="otto"');
  });

  it("one dweller is the same code path, no special case", () => {
    const solo: LlmtvTranscript = { ...societyFrame, dwellers: [alexa] };
    const grid = renderLlmtvGrid(solo);
    expect(grid).toContain('data-dwellers="1"');
    expect(grid).toContain('data-dweller="alexa"');
    expect(grid).not.toContain('data-dweller="soraya"');
  });
});

describe("full document — self-contained, zero JS at rest", () => {
  const doc = renderLlmtvDocument(societyFrame);

  it("is a complete HTML document with the schema on the grid", () => {
    expect(doc.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(doc).toContain('data-schema="zeta.darkhall.llmtv.v1"');
    expect(doc).toContain("<title>Zeta — LLMTV");
  });

  it("contains no script tags — the picture is inert (QPG, not an app)", () => {
    expect(doc).not.toContain("<script");
  });

  it("carries the one-way / noninterference framing and the hard-money frost line", () => {
    expect(doc).toContain("one-way out · metered at the membrane");
    expect(doc).toContain("never taken away");
  });
});
