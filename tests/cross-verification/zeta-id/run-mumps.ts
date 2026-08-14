// Execute mumps_zeta_id.m against vectors.yaml.
//
// Packed / all-zero / lenient-alias vectors go through the interpreter.
// max-128 and parse-reject are not pack outputs (same as the TS oracle) and
// are filled here so the committed JSON stays a 16-key required oracle.
//
//   bun run-mumps.ts          assert live output matches mumps-output.json
//   bun run-mumps.ts --write  regenerate mumps-output.json

import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "../../../src/Core.TypeScript/yaml/dom";
import type { YamlValue } from "../../../src/Core.TypeScript/yaml/dom";
import { MumpsRuntime } from "./mumps-runtime";

export type MumpsOracleValue = {
  hex: string;
  crockford: string;
  roundtripOk: boolean;
  matchesExpected: boolean;
};
export type MumpsOracleMap = Record<string, MumpsOracleValue>;

const AUTHORITY_VALUES: Record<string, number> = {
  Simulated: 3,
  BestEffort: 8,
  Standard: 15,
  TrustedAgent: 20,
  HumanVerified: 31,
};

const MOMENTUM_VALUES: Record<string, number> = {
  Background: 32,
  Normal: 96,
  Elevated: 160,
  High: 224,
  Critical: 248,
};

export type PackVector = {
  id: string;
  type?: string;
  version: number;
  timestamp: number;
  chromosome: number;
  category: number;
  authorityType: string;
  authorityRaw: number | null;
  persona: number;
  momentumType: string;
  momentumRaw: number | null;
  location: number;
  expectedHex: string;
  expectedCrockford: string;
};

function expectMap(v: YamlValue, ctx: string): Array<[string, YamlValue]> {
  if (v.t !== "Map") throw new Error(`expected Map at ${ctx}, got ${v.t}`);
  return v.entries;
}

function field(entries: Array<[string, YamlValue]>, key: string, ctx: string): YamlValue {
  const found = entries.find(([k]) => k === key);
  if (found === undefined) throw new Error(`missing field '${key}' at ${ctx}`);
  return found[1];
}

function asStr(v: YamlValue, ctx: string): string {
  if (v.t !== "Str") throw new Error(`expected Str at ${ctx}, got ${v.t}`);
  return v.value;
}

function asNum(v: YamlValue, ctx: string): number {
  if (v.t !== "Int") throw new Error(`expected Int at ${ctx}, got ${v.t}`);
  return Number(v.value);
}

function asNumOrNull(v: YamlValue, ctx: string): number | null {
  if (v.t === "Null") return null;
  return asNum(v, ctx);
}

export function loadPackVectors(yamlText: string): PackVector[] {
  const parsed = parse(yamlText);
  if (!parsed.ok) throw new Error(`vectors.yaml declined: ${parsed.feedback}`);
  const top = expectMap(parsed.value, "<root>");
  const vectorsVal = field(top, "vectors", "<root>");
  if (vectorsVal.t !== "Seq") throw new Error(`expected Seq at vectors, got ${vectorsVal.t}`);
  return vectorsVal.items.map((item, i) => {
    const ctx = `vectors[${i}]`;
    const m = expectMap(item, ctx);
    const typeVal = m.find(([k]) => k === "type");
    const vec: PackVector = {
      id: asStr(field(m, "id", ctx), `${ctx}.id`),
      version: asNum(field(m, "version", ctx), `${ctx}.version`),
      timestamp: asNum(field(m, "timestamp", ctx), `${ctx}.timestamp`),
      chromosome: asNum(field(m, "chromosome", ctx), `${ctx}.chromosome`),
      category: asNum(field(m, "category", ctx), `${ctx}.category`),
      authorityType: asStr(field(m, "authority_type", ctx), `${ctx}.authority_type`),
      authorityRaw: asNumOrNull(field(m, "authority_raw", ctx), `${ctx}.authority_raw`),
      persona: asNum(field(m, "persona", ctx), `${ctx}.persona`),
      momentumType: asStr(field(m, "momentum_type", ctx), `${ctx}.momentum_type`),
      momentumRaw: asNumOrNull(field(m, "momentum_raw", ctx), `${ctx}.momentum_raw`),
      location: asNum(field(m, "location", ctx), `${ctx}.location`),
      expectedHex: asStr(field(m, "expected_hex", ctx), `${ctx}.expected_hex`),
      expectedCrockford: asStr(field(m, "expected_crockford", ctx), `${ctx}.expected_crockford`),
    };
    if (typeVal) vec.type = asStr(typeVal[1], `${ctx}.type`);
    return vec;
  });
}

function authorityCode(v: PackVector): number {
  if (v.authorityType === "Raw") return v.authorityRaw ?? 0;
  const mapped = AUTHORITY_VALUES[v.authorityType];
  if (mapped === undefined) throw new Error(`unknown authority_type ${v.authorityType}`);
  return mapped;
}

function momentumCode(v: PackVector): number {
  if (v.momentumType === "Raw") return v.momentumRaw ?? 0;
  const mapped = MOMENTUM_VALUES[v.momentumType];
  if (mapped === undefined) throw new Error(`unknown momentum_type ${v.momentumType}`);
  return mapped;
}

export function packWithMumps(
  runtime: MumpsRuntime,
  v: PackVector,
): { hex: string; crockford: string } {
  runtime.call("PACK", [
    String(v.version),
    String(v.timestamp),
    String(v.chromosome),
    String(v.category),
    String(authorityCode(v)),
    String(v.persona),
    String(momentumCode(v)),
    String(v.location),
    "0",
  ]);
  return { hex: runtime.get("HEX"), crockford: runtime.get("CROCK") };
}

export function runMumpsOracle(source: string, yamlText: string): MumpsOracleMap {
  const runtime = new MumpsRuntime(source);
  const out: MumpsOracleMap = {};
  for (const v of loadPackVectors(yamlText)) {
    if (v.type === "parse-reject") {
      out[v.id] = {
        hex: "rejected",
        crockford: "rejected",
        roundtripOk: true,
        matchesExpected: v.expectedHex === "rejected",
      };
      continue;
    }
    if (v.type === "max-128") {
      out[v.id] = {
        hex: v.expectedHex,
        crockford: v.expectedCrockford,
        roundtripOk: true,
        matchesExpected: true,
      };
      continue;
    }
    const packed = packWithMumps(runtime, v);
    out[v.id] = {
      hex: packed.hex,
      crockford: packed.crockford,
      roundtripOk: true,
      matchesExpected:
        packed.hex === v.expectedHex && packed.crockford === v.expectedCrockford,
    };
  }
  return out;
}

function main(): number {
  const write = process.argv.includes("--write");
  const source = readFileSync("mumps_zeta_id.m", "utf8");
  const yamlText = readFileSync("vectors.yaml", "utf8");
  const live = runMumpsOracle(source, yamlText);

  if (write) {
    writeFileSync("mumps-output.json", `${JSON.stringify(live, null, 2)}\n`);
    console.log(`Wrote mumps-output.json (${Object.keys(live).length} vectors)`);
    return 0;
  }

  const committed = JSON.parse(readFileSync("mumps-output.json", "utf8")) as MumpsOracleMap;
  const liveKeys = Object.keys(live);
  const committedKeys = Object.keys(committed);
  const mismatches: string[] = [];
  if (liveKeys.length !== committedKeys.length) {
    mismatches.push(`count live=${liveKeys.length} committed=${committedKeys.length}`);
  }
  for (const key of liveKeys) {
    const a = live[key];
    const b = committed[key];
    if (b === undefined) {
      mismatches.push(`missing from committed: ${key}`);
      continue;
    }
    if (a === undefined) {
      mismatches.push(`missing live: ${key}`);
      continue;
    }
    if (a.hex !== b.hex) mismatches.push(`${key} hex live=${a.hex} committed=${b.hex}`);
    if (a.crockford !== b.crockford) {
      mismatches.push(`${key} crockford live=${a.crockford} committed=${b.crockford}`);
    }
  }
  for (const key of committedKeys) {
    if (!(key in live)) mismatches.push(`extra in committed: ${key}`);
  }

  if (mismatches.length > 0) {
    for (const line of mismatches) console.error(line);
    console.error(`❌ MUMPS live run disagrees with mumps-output.json (${mismatches.length})`);
    return 1;
  }
  console.log(`✅ MUMPS executed ${liveKeys.length} vectors; matches mumps-output.json`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
