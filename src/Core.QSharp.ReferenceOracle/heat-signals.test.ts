import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const source = readFileSync(join(import.meta.dir, "HeatSignals.qs"), "utf-8");

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

describe("Q# heat-signal reference treaty", () => {
  test("declares the same finite heat alphabet used by F# and TypeScript", () => {
    expect(source).toContain("namespace Zeta.Heat");

    for (const name of signalFunctions) {
      expect(source).toContain(`function ${name}() : Int`);
    }
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
