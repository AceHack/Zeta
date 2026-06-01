import { pack, unpack, DETERMINISTIC_ENV } from "./zeta-id";
import type { ZetaObservation, Authority, Momentum } from "./types";
import { parse } from "../yaml/dom";
import type { YamlValue } from "../yaml/dom";

interface FlatVector {
  id: string;
  version: number;
  timestamp: number;
  chromosome: number;
  category: number;
  firefly: number;
  authority_type: string;
  authority_raw: number | null;
  persona: number;
  momentum_type: string;
  momentum_raw: number | null;
  location: number;
  expected_hex: string;
}

// --- YamlValue → FlatVector[] navigation (own-the-interface: route through our port,
// not Bun.YAML). The fixture is a top-level Map with a `vectors:` Seq of flat Maps. ---

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

// Int is a bigint in our DOM; Bun.YAML produced JS numbers. Every value in this fixture
// is within Number.MAX_SAFE_INTEGER (max timestamp 281474976710655 < 2^53-1), so
// Number(bigint) preserves the same values the old path used.
function asNum(v: YamlValue, ctx: string): number {
  if (v.t !== "Int") throw new Error(`expected Int at ${ctx}, got ${v.t}`);
  return Number(v.value);
}

function asNumOrNull(v: YamlValue, ctx: string): number | null {
  if (v.t === "Null") return null;
  return asNum(v, ctx);
}

function yamlValueToFlatVectors(root: YamlValue): FlatVector[] {
  const top = expectMap(root, "<root>");
  const vectorsVal = field(top, "vectors", "<root>");
  if (vectorsVal.t !== "Seq") throw new Error(`expected Seq at vectors, got ${vectorsVal.t}`);
  return vectorsVal.items.map((item, i) => {
    const ctx = `vectors[${i}]`;
    const m = expectMap(item, ctx);
    return {
      id: asStr(field(m, "id", ctx), `${ctx}.id`),
      version: asNum(field(m, "version", ctx), `${ctx}.version`),
      timestamp: asNum(field(m, "timestamp", ctx), `${ctx}.timestamp`),
      chromosome: asNum(field(m, "chromosome", ctx), `${ctx}.chromosome`),
      category: asNum(field(m, "category", ctx), `${ctx}.category`),
      firefly: asNum(field(m, "firefly", ctx), `${ctx}.firefly`),
      authority_type: asStr(field(m, "authority_type", ctx), `${ctx}.authority_type`),
      authority_raw: asNumOrNull(field(m, "authority_raw", ctx), `${ctx}.authority_raw`),
      persona: asNum(field(m, "persona", ctx), `${ctx}.persona`),
      momentum_type: asStr(field(m, "momentum_type", ctx), `${ctx}.momentum_type`),
      momentum_raw: asNumOrNull(field(m, "momentum_raw", ctx), `${ctx}.momentum_raw`),
      location: asNum(field(m, "location", ctx), `${ctx}.location`),
      expected_hex: asStr(field(m, "expected_hex", ctx), `${ctx}.expected_hex`),
    };
  });
}

function toAuthority(v: FlatVector): Authority {
  if (v.authority_type === "Raw") return { type: "Raw", value: v.authority_raw! };
  return { type: v.authority_type as Authority["type"] } as Authority;
}

function toMomentum(v: FlatVector): Momentum {
  if (v.momentum_type === "Raw") return { type: "Raw", value: v.momentum_raw! };
  return { type: v.momentum_type as Momentum["type"] } as Momentum;
}

function toObservation(v: FlatVector): ZetaObservation {
  return {
    version: v.version as any,
    timestamp: v.timestamp as any,
    chromosome: v.chromosome as any,
    category: v.category as any,
    firefly: v.firefly as any,
    authority: toAuthority(v),
    persona: v.persona as any,
    momentum: toMomentum(v),
    location: v.location as any,
  };
}

const parsed = parse(await Bun.file("vectors.yaml").text());
if (!parsed.ok) {
  console.error(`FAIL: our YAML port declined vectors.yaml: ${parsed.feedback}`);
  process.exit(1);
}
const vectors = yamlValueToFlatVectors(parsed.value);

const results: Record<string, { hex: string; roundtripOk: boolean; matchesExpected: boolean }> = {};
let unpackMismatches = 0;
let hexMismatches = 0;

for (const v of vectors) {
  const obs = toObservation(v);
  const packed = pack(obs, DETERMINISTIC_ENV);
  const hex = packed.toString(16).padStart(32, "0");

  const unpacked = unpack(packed);
  const roundtripOk = Bun.deepEquals(unpacked, obs);
  const matchesExpected = hex === v.expected_hex;

  results[v.id] = { hex, roundtripOk, matchesExpected };

  if (!roundtripOk) {
    unpackMismatches++;
    console.error(`Roundtrip MISMATCH for ${v.id}`);
  }
  if (!matchesExpected) {
    hexMismatches++;
    console.error(`Hex MISMATCH for ${v.id}: got ${hex}, expected ${v.expected_hex}`);
  }
}

await Bun.write("ts-output.json", JSON.stringify(results, null, 2));
console.log(
  `Cross-verify: ${vectors.length} vectors. Roundtrip ${vectors.length - unpackMismatches}/${vectors.length} OK. Hex matches expected ${vectors.length - hexMismatches}/${vectors.length}.`,
);

// Enforce: non-zero exit on any mismatch so CI / automation catches regressions.
// Per Codex P1 finding (PR #4517 cross-verify.ts:72) — silent-non-enforcing
// harness is a known antipattern.
if (unpackMismatches > 0 || hexMismatches > 0) {
  console.error(`FAIL: ${unpackMismatches} roundtrip mismatch + ${hexMismatches} hex mismatch`);
  process.exit(1);
}
