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
  type ChannelFidelity,
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

// ═══════════════════════════════════════════════════════════════════════════
// The receipt rails must not paint a blind counter as a genuine zero.
// Work-item 081M01400RZ087G0R000PS3VJG.
//
// Measured on unmodified `main`, the two dwellers below rendered BYTE-IDENTICAL
// HTML, and the un-measured one carried the word `cold` — the healthy word on a
// reading nothing produced. Every `it` in this block fails against that revision.
// ═══════════════════════════════════════════════════════════════════════════

describe("heat receipt rails — observed nothing vs observed zero", () => {
  const quiet = {
    tick: 1,
    roomName: "atrium",
    heatRejected: 0,
    backpressured: 0,
    storageErrors: 0,
    heatKinds: [] as readonly string[],
    reasons: [] as readonly string[],
  };

  const dwellerWith = (rows: readonly HeatRow[]): DwellerMind => ({
    ...alexa,
    temperatureTreaty: temperatureTreatyBundle({
      temperature: temperatureReadout({
        source: "llmtv/alexa",
        heatPpm: 0,
        uncertaintyPpm: 0,
        pressurePpm: 0,
        attentionPpm: 0,
      }),
      heatReceipts: heatReceiptsFromRows(rows, { source: "llmtv/alexa" }),
    }),
  });

  const measuredZeroHtml = renderDweller(dwellerWith([{ ...quiet, signals: [] }]), "S4");
  const observedNothingHtml = renderDweller(dwellerWith([quiet]), "S4");

  it("renders a blind receipt differently from a measured-quiet one (pre-fix: byte-identical)", () => {
    expect(observedNothingHtml).not.toBe(measuredZeroHtml);
  });

  it("says it in WORDS, not only in colour — a quiet receipt already renders muted", () => {
    expect(observedNothingHtml).toContain("NOT MEASURED");
    expect(observedNothingHtml).toContain("0 observations");
    expect(observedNothingHtml).toContain("unknown, not cold");
  });

  it("emits the reading as an attribute the CSS and an auditor can both read", () => {
    expect(observedNothingHtml).toContain('data-signal-reading="unknown"');
    expect(observedNothingHtml).toContain('data-signal-source="inferred"');
    expect(observedNothingHtml).toContain('data-signal-observations="0"');
    expect(measuredZeroHtml).toContain('data-signal-reading="measured"');
    expect(measuredZeroHtml).toContain('data-signal-source="reported"');
  });

  it("leaves a measured receipt unworded — no false alarm, and no chartjunk", () => {
    expect(measuredZeroHtml).not.toContain("NOT MEASURED");
    expect(renderDweller(alexaWithTemperature, "S4")).not.toContain("NOT MEASURED");
  });

  it("carries a CSS rule that repaints an unknown receipt", () => {
    const doc = renderLlmtvDocument({
      schema: "zeta.darkhall.llmtv.v1",
      seed: "S4",
      generatedBy: "test",
      dwellers: [dwellerWith([quiet])],
    });
    expect(doc).toContain('.heat-receipt[data-signal-reading="unknown"]');
  });

  it("does not move the treaty-locked outcome token — the third state is a separable channel", () => {
    expect(observedNothingHtml).toContain('data-outcome="cold"');
    expect(measuredZeroHtml).toContain('data-outcome="cold"');
  });
});

// Fidelity on the RENDERED surface — 081M010WYE5087G0R003J89QVF §1.
//
// 081M00TYT8N087G0R003MPMRX9 put `fidelity` on the value. No renderer read it, so
// the picture stayed exactly as silent as before: a blind sensor and an idle room
// both paint `cold`, in the same muted colour, with the same text. The value knew;
// the screen did not.
//
// Every test below FAILS against `origin/main@0cb3642eb`.
// ═══════════════════════════════════════════════════════════════════════════

describe("temperature lane — a dead sensor must not render as a calm room", () => {
  const laneFor = (heatPpm: number, upstream?: readonly ChannelFidelity[]) =>
    renderDweller(
      {
        ...alexa,
        temperatureTreaty: temperatureTreatyBundle({
          temperature: temperatureReadout({
            source: "llmtv/alexa",
            heatPpm,
            uncertaintyPpm: 0,
            pressurePpm: 0,
            attentionPpm: 0,
            ...(upstream === undefined ? {} : { upstreamFidelity: upstream }),
          }),
        }),
      },
      "S4",
    );

  it("emits the fidelity as an attribute the CSS and an auditor can both read", () => {
    expect(laneFor(0)).toContain('data-temperature-fidelity="exact"');
    expect(laneFor(Number.NaN)).toContain('data-temperature-fidelity="out-of-domain"');
  });

  it("renders a blind room differently from an idle room (pre-fix: byte-identical)", () => {
    const blind = laneFor(Number.NaN);
    const idle = laneFor(0);

    // Both are band `cold` — that is precisely why the picture had to change.
    expect(blind).toContain('data-temperature-band="cold"');
    expect(idle).toContain('data-temperature-band="cold"');
    expect(blind).not.toBe(idle);
  });

  it("says the fault in words, not only in colour", () => {
    expect(laneFor(Number.NaN)).toContain("SENSOR FAULT");
    expect(laneFor(Number.NaN)).toContain("no reading");
  });

  it("labels a pinned gauge as pinned rather than as a high reading", () => {
    const pinned = laneFor(0, ["saturated"]);
    expect(pinned).toContain('data-temperature-fidelity="saturated"');
    expect(pinned).toContain("PINNED");
  });

  it("leaves a healthy lane unmarked — no false alarm, and no chartjunk", () => {
    const healthy = laneFor(123_000);
    expect(healthy).toContain('data-temperature-fidelity="exact"');
    expect(healthy).not.toContain("SENSOR FAULT");
    expect(healthy).not.toContain("PINNED");
    expect(healthy).toContain("black-body · warm");
  });

  // `fidelity` is OPTIONAL on the value, so "never classified" is a THIRD state
  // beside faithful and faulty. Rendering it with the empty `exact` suffix would
  // reproduce this file's own bug one level up — a readout claiming a
  // cleanliness nobody ever checked. Unreported and clean are different claims.
  it("does not paint a never-classified channel as a verified-clean one", () => {
    const { fidelity: _dropped, ...unclassified } = temperatureReadout({
      source: "llmtv/alexa",
      heatPpm: 123_000,
      uncertaintyPpm: 0,
      pressurePpm: 0,
      attentionPpm: 0,
    });

    const unreported = renderDweller(
      {
        ...alexa,
        temperatureTreaty: temperatureTreatyBundle({ temperature: unclassified }),
      },
      "S4",
    );

    expect(unreported).toContain("fidelity not reported");
    // Not smeared into the fault vocabulary either — we do not know it is broken.
    expect(unreported).not.toContain("SENSOR FAULT");
    expect(unreported).not.toContain("PINNED");
    // The whole point: it must not be byte-identical to the verified-clean lane.
    expect(unreported).not.toBe(laneFor(123_000));
  });

  it("carries a CSS rule that repaints an out-of-domain lane", () => {
    const doc = renderLlmtvDocument(societyFrame);
    expect(doc).toContain('.temp-lane[data-temperature-fidelity="out-of-domain"]');
  });
});
