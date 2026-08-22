import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const source = readFileSync(join(import.meta.dir, "HeatSignals.qs"), "utf-8");
const treaty = JSON.parse(
  readFileSync(join(import.meta.dir, "heat-signals-treaty.json"), "utf-8"),
) as HeatSignalsTreaty;

interface HeatSignalVector {
  readonly token: string;
  readonly qsharpFunction: string;
  readonly code: number;
  readonly public: boolean;
}

interface HeatCase {
  readonly token: string;
  readonly code: number;
}

interface HeatSignalsTreaty {
  readonly schema: string;
  readonly readoutSchema: string;
  readonly temperatureReadoutSchema: string;
  readonly blackBodyReadoutSchema: string;
  readonly qsharpSource: string;
  readonly fsharpSurface: string;
  readonly signals: readonly HeatSignalVector[];
  readonly temperatureBands: readonly {
    readonly token: string;
    readonly qsharpFunction: string;
    readonly code: number;
    readonly maxPpm: number;
  }[];
  readonly temperatureCases: readonly {
    readonly id: string;
    readonly heatPpm: number;
    readonly uncertaintyPpm: number;
    readonly pressurePpm: number;
    readonly attentionPpm: number;
    readonly temperaturePpm: number;
    readonly band: string;
    readonly code: number;
    readonly fidelity: string;
  }[];
  readonly blackBodyCases: readonly {
    readonly id: string;
    readonly temperaturePpm: number;
    readonly radiancePpm: number;
    readonly peakFrequencyPpm: number;
  }[];
  readonly kindCases: readonly { readonly kind: string; readonly token: string }[];
  readonly qsharpCounterCases: readonly HeatCase[];
  readonly qsharpReadoutLossCases: readonly HeatCase[];
}

const signalFunctions = [
  "HeatSignalCold",
  "HeatSignalForgotten",
  "HeatSignalBackpressure",
  "HeatSignalDenied",
  "HeatSignalStorageError",
  "HeatSignalInvalid",
  "HeatSignalExpired",
  "HeatSignalStale",
  "HeatSignalOther",
] as const;

function functionBody(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start, `missing function ${name}`).toBeGreaterThanOrEqual(0);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart + 1, index);
    }
  }
  return "";
}

function functionReturnCode(name: string): number {
  const pattern = new RegExp(`function\\s+${name}\\(\\)\\s*:\\s*Int\\s*{\\s*return\\s+(-?\\d+);\\s*}`);
  const match = pattern.exec(source);
  if (match === null) {
    throw new Error(`missing integer-return function ${name}`);
  }

  return Number.parseInt(match[1] ?? "NaN", 10);
}

describe("Q# heat-signal reference treaty", () => {
  test("declares the same finite heat alphabet used by F# and TypeScript", () => {
    expect(source).toContain("namespace Zeta.Heat");
    expect(treaty.schema).toBe("zeta.qsharp.heat-signals.v1");
    expect(treaty.readoutSchema).toBe("zeta.heat.readout.v1");
    expect(treaty.temperatureReadoutSchema).toBe("zeta.temperature.readout.v1");
    expect(treaty.blackBodyReadoutSchema).toBe("zeta.blackbody.readout.v1");
    expect(treaty.qsharpSource).toBe("src/Core.QSharp.ReferenceOracle/HeatSignals.qs");
    expect(treaty.fsharpSurface).toBe("src/Core/Heat.fs");

    for (const name of signalFunctions) {
      expect(source).toContain(`function ${name}() : Int`);
    }

    expect(treaty.signals.map((signal) => signal.qsharpFunction)).toEqual([...signalFunctions]);
    expect(treaty.signals.filter((signal) => signal.public).map((signal) => signal.token)).toEqual([
      "forgotten",
      "backpressure",
      "denied",
      "storage-error",
      "invalid",
      "expired",
      "stale",
      "other",
    ]);

    expect(treaty.temperatureBands.map((band) => band.token)).toEqual(["cold", "warm", "hot", "critical"]);
  });

  test("pins Q# signal codes to the committed treaty vector", () => {
    for (const signal of treaty.signals) {
      expect(functionReturnCode(signal.qsharpFunction)).toBe(signal.code);
    }

    expect(treaty.qsharpCounterCases.map((item) => item.token)).toEqual([
      "cold",
      "denied",
      "backpressure",
      "storage-error",
    ]);

    expect(treaty.qsharpReadoutLossCases.map((item) => item.token)).toEqual(["cold", "invalid", "expired", "stale"]);
  });

  test("pins Q# temperature bands and ppm classifier to treaty vectors", () => {
    for (const band of treaty.temperatureBands) {
      expect(functionReturnCode(band.qsharpFunction)).toBe(band.code);
    }

    const thermal = functionBody("ThermalPpm");
    expect(thermal).toContain("ClampPpm(heatPpm)");
    expect(thermal).toContain("ClampPpm(uncertaintyPpm)");
    expect(thermal).toContain("ClampPpm(pressurePpm)");
    expect(thermal).not.toContain("attention");

    const bandForPpm = functionBody("TemperatureBandForPpm");
    expect(bandForPpm).toContain("ppm == 0");
    expect(bandForPpm).toContain("ppm <= 333333");
    expect(bandForPpm).toContain("ppm <= 666666");
    expect(bandForPpm).toContain("TemperatureBandCritical");

    const declaredBands = treaty.temperatureBands.map((band) => band.token).toSorted();
    const reachedBands = [...new Set(treaty.temperatureCases.map((item) => item.band))].toSorted();
    expect(reachedBands).toEqual(declaredBands);

    for (const band of treaty.temperatureBands) {
      expect(bandForPpm).toContain(`${band.qsharpFunction}()`);
      expect(treaty.temperatureCases.some((item) => item.code === band.code && item.band === band.token)).toBe(true);
    }

    expect(treaty.temperatureCases.map((item) => item.id)).toContain("attention-does-not-heat-cost");
    expect(treaty.temperatureCases.map((item) => item.band)).toEqual([
      "cold",
      "warm",
      "hot",
      "critical",
      "warm",
      "critical",
      "critical",
      "cold",
    ]);
  });

  test("pins fidelity as a treaty key that carries what no other published key can", () => {
    // The vectors added with the `fidelity` key are pairs chosen so that every
    // OTHER published key is identical within the pair. If `fidelity` were
    // dropped, each pair would collapse to one indistinguishable reading — which
    // is the whole reason the key exists, stated as a vector rather than as
    // prose. (A key whose vectors all say the same thing is the vacuity class.)
    const byId = new Map(treaty.temperatureCases.map((item) => [item.id, item]));

    const pairs: readonly (readonly [string, string])[] = [
      ["at-ceiling-is-exact", "above-ceiling-is-saturated"],
      ["cold", "blind-counter-is-out-of-domain"],
    ];

    for (const [leftId, rightId] of pairs) {
      const left = byId.get(leftId);
      const right = byId.get(rightId);
      expect(left).toBeDefined();
      expect(right).toBeDefined();
      if (left === undefined || right === undefined) continue;

      // Identical in every published key except fidelity...
      expect(left.temperaturePpm).toBe(right.temperaturePpm);
      expect(left.band).toBe(right.band);
      expect(left.code).toBe(right.code);

      // ...and separable only by it.
      expect(left.fidelity).not.toBe(right.fidelity);
      expect(left.fidelity).toBe("exact");
    }

    // The key is non-vacuous: more than one token is actually reached.
    expect([...new Set(treaty.temperatureCases.map((item) => item.fidelity))].toSorted()).toEqual([
      "exact",
      "out-of-domain",
      "saturated",
    ]);
  });

  test("pins Q# black-body information-radiance helpers to treaty vectors", () => {
    const radiance = functionBody("BlackBodyRadiancePpm");
    expect(radiance).toContain("ClampPpm(temperaturePpm)");
    expect(radiance).toContain("temperature * temperature");
    expect(radiance).toContain("square * square");

    const peak = functionBody("BlackBodyPeakFrequencyPpm");
    expect(peak).toContain("ClampPpm(temperaturePpm)");

    const fromThermal = functionBody("BlackBodyRadianceFromThermalPpm");
    expect(fromThermal).toContain("ThermalPpm(heatPpm, uncertaintyPpm, pressurePpm)");
    expect(fromThermal).not.toContain("attention");

    expect(treaty.blackBodyCases.map((item) => item.id)).toEqual([
      "cold",
      "uncertainty-warm",
      "pressure-hot-attended",
      "heat-critical",
      "attention-does-not-heat-cost",
      "saturation",
    ]);
    expect(treaty.blackBodyCases.map((item) => item.radiancePpm)).toEqual([0, 3906, 62500, 656100, 244, 1000000]);
    expect(treaty.blackBodyCases.map((item) => item.peakFrequencyPpm)).toEqual([
      0,
      250000,
      500000,
      900000,
      125000,
      1000000,
    ]);
  });

  test("normalizes future heat codes to Other instead of silently dropping them", () => {
    const body = functionBody("HeatSignalFromKindCode");
    expect(body).toContain("HeatSignalForgotten");
    expect(body).toContain("HeatSignalBackpressure");
    expect(body).toContain("HeatSignalStorageError");
    expect(body).toContain("return HeatSignalOther();");
  });

  test("maps row counters and oracle readout loss without becoming a runtime sink", () => {
    expect(functionBody("HeatSignalForCounters")).toContain("storageErrors > 0");
    expect(functionBody("HeatSignalForCounters")).toContain("backpressured > 0");
    expect(functionBody("HeatSignalForCounters")).toContain("heatRejected > 0");

    const loss = functionBody("HeatSignalForOracleReadoutLoss");
    expect(loss).toContain("rejectedFrames > 0");
    expect(loss).toContain("HeatSignalInvalid");
    expect(loss).toContain("expiredFrames > 0");
    expect(loss).toContain("HeatSignalExpired");
    expect(loss).toContain("staleFrames > 0");
    expect(loss).toContain("HeatSignalStale");

    expect(source).not.toMatch(/\boperation\b/);
    expect(source).not.toMatch(/\bM\s*\(/);
    expect(source).not.toMatch(/\bReset(?:All)?\s*\(/);
    expect(source).not.toMatch(/IHeatSink|EmitHeat|HeatSink/);
  });
});
