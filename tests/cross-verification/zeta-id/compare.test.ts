import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  compareOracles,
  expectedCrockfordForOutput,
  loadCanonicalVectors,
  type CanonicalVector,
  type OracleMap,
} from "./compare";
import { packWithMumps, runMumpsOracle } from "./run-mumps";
import { MumpsRuntime } from "./mumps-runtime";

const here = import.meta.dir;

function loadJson(name: string): OracleMap {
  return JSON.parse(readFileSync(join(here, name), "utf8")) as OracleMap;
}

describe("zeta-id compare.ts fixture pin", () => {
  const fixture = loadCanonicalVectors(readFileSync(join(here, "vectors.yaml"), "utf8"));

  test("vectors.yaml loads the packed + edge set", () => {
    const ids = fixture.map((v) => v.id);
    expect(ids).toContain("authority-human-verified");
    expect(ids).toContain("all-zero");
    expect(ids).toContain("max-128");
    expect(ids).toContain("overflow-reject-1");
    expect(ids).toContain("lenient-alias-1");
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("parse-reject pins output crockford to rejected, not the input", () => {
    const reject = fixture.find((v) => v.type === "parse-reject");
    expect(reject).toBeDefined();
    expect(reject?.expectedCrockford).toBe("80000000000000000000000000");
    expect(expectedCrockfordForOutput(reject as CanonicalVector)).toBe("rejected");
  });

  test("committed oracles agree with vectors.yaml", () => {
    const result = compareOracles(
      fixture,
      {
        TS: loadJson("ts-output.json"),
        "F#": loadJson("fsharp-output.json"),
        "C#": loadJson("cs-output.json"),
        Rust: loadJson("rust-output.json"),
        Py: loadJson("python-output.json"),
        Go: loadJson("go-output.json"),
        Mumps: loadJson("mumps-output.json"),
      },
      ["Mumps"],
    );
    expect(result.mismatches).toEqual([]);
    expect(result.implCounts.Mumps).toBe(fixture.length);
  });

  test("missing required MUMPS output fails closed", () => {
    const result = compareOracles(
      fixture,
      {
        TS: loadJson("ts-output.json"),
        Mumps: null,
      },
      ["Mumps"],
    );
    expect(result.mismatches.some((m) => m.includes("Mumps output missing"))).toBe(
      true,
    );
  });

  test("stale MUMPS extra key is drift", () => {
    const mumps = {
      ...loadJson("ts-output.json"),
      "workitem-v1-standard": {
        hex: "080cb77ed58d18107813000000000000",
        crockford: "081JVQXNCD308QG4R000000000",
      },
    };
    const result = compareOracles(fixture, {
      TS: loadJson("ts-output.json"),
      Mumps: mumps,
    });
    expect(result.mismatches.some((m) => m.includes("workitem-v1-standard"))).toBe(
      true,
    );
  });

  test("stale-but-consistent outputs fail the fixture pin", () => {
    const stale: OracleMap = {
      "authority-human-verified": {
        hex: "00000000000000000000000000000000",
        crockford: "00000000000000000000000000",
      },
    };
    const result = compareOracles(
      [
        {
          id: "authority-human-verified",
          expectedHex: "080cb77ed58d19c0f80b000800000000",
          expectedCrockford: "081JVQXNCD370FG2R010000000",
        },
      ],
      { TS: stale, "F#": stale },
    );
    expect(result.mismatches.some((m) => m.includes("fixture="))).toBe(true);
    expect(result.mismatches.some((m) => m.includes("TS=") && m.includes("F#="))).toBe(false);
  });

  test("a TS key missing from vectors.yaml is drift", () => {
    const result = compareOracles(
      [
        {
          id: "only-in-fixture",
          expectedHex: "00",
          expectedCrockford: "00",
        },
      ],
      {
        TS: {
          "only-in-ts": { hex: "ff", crockford: "FF" },
        },
      },
    );
    expect(result.mismatches.some((m) => m.includes("not present in vectors.yaml"))).toBe(
      true,
    );
    expect(result.mismatches.some((m) => m.includes("missing from TS"))).toBe(true);
  });
});

describe("zeta-id MUMPS runtime executes the committed .m", () => {
  const source = readFileSync(join(here, "mumps_zeta_id.m"), "utf8");
  const yamlText = readFileSync(join(here, "vectors.yaml"), "utf8");

  test("live PACK matches mumps-output.json and the fixture", () => {
    const live = runMumpsOracle(source, yamlText);
    const committed = loadJson("mumps-output.json");
    const result = compareOracles(
      loadCanonicalVectors(yamlText),
      { TS: committed, Mumps: live },
      ["Mumps"],
    );
    expect(result.mismatches).toEqual([]);
  });

  test("a weight edit in the .m file changes packed hex", () => {
    const mutated = source.replace("+(CAT*2)", "+(CAT*4)");
    expect(mutated).not.toBe(source);
    const live = runMumpsOracle(source, yamlText);
    const broken = runMumpsOracle(mutated, yamlText);
    const key = "authority-best-effort";
    const liveHex = live[key]?.hex;
    const brokenHex = broken[key]?.hex;
    expect(brokenHex).not.toBe(liveHex);
  });

  test("PACK writes HEX and CROCK for the human-verified vector", () => {
    const runtime = new MumpsRuntime(source);
    const packed = packWithMumps(runtime, {
      id: "authority-human-verified",
      version: 1,
      timestamp: 1747780809123,
      chromosome: 7,
      category: 0,
      authorityType: "HumanVerified",
      authorityRaw: null,
      persona: 1,
      momentumType: "Normal",
      momentumRaw: null,
      location: 1,
      expectedHex: "080cb77ed58d19c0f80b000800000000",
      expectedCrockford: "081JVQXNCD370FG2R010000000",
    });
    expect(packed.hex).toBe("080cb77ed58d19c0f80b000800000000");
    expect(packed.crockford).toBe("081JVQXNCD370FG2R010000000");
  });
});
