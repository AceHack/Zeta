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
  readonly qsharpSource: string;
  readonly fsharpSurface: string;
  readonly signals: readonly HeatSignalVector[];
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
