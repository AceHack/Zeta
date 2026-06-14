import { pack, unpack, DETERMINISTIC_ENV } from "./zeta-id";
import { format as formatB32, parse as parseB32, isCanonical } from "./encoding";
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
  expected_crockford: string;
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
      expected_crockford: asStr(field(m, "expected_crockford", ctx), `${ctx}.expected_crockford`),
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

const results: Record<
  string,
  { hex: string; crockford: string; roundtripOk: boolean; matchesExpected: boolean }
> = {};
let unpackMismatches = 0;
let hexMismatches = 0;
let crockfordMismatches = 0;

for (const v of vectors) {
  const obs = toObservation(v);
  const packed = pack(obs, DETERMINISTIC_ENV);
  const hex = packed.toString(16).padStart(32, "0");
  const crockford = formatB32(packed);

  const unpacked = unpack(packed);
  const roundtripOk = Bun.deepEquals(unpacked, obs);
  const matchesExpected = hex === v.expected_hex;
  const parsedId = parseB32(crockford);
  const parseOk = parsedId === packed;
  const canonicalOk = isCanonical(crockford);
  const crockfordMatches = crockford === v.expected_crockford;

  results[v.id] = {
    hex,
    crockford,
    roundtripOk: roundtripOk && parseOk && canonicalOk,
    matchesExpected: matchesExpected && crockfordMatches,
  };

  if (!roundtripOk || !parseOk || !canonicalOk) {
    unpackMismatches++;
    console.error(`Roundtrip/CrockfordParse/Canonical MISMATCH for ${v.id}`);
  }
  if (!matchesExpected) {
    hexMismatches++;
    console.error(`Hex MISMATCH for ${v.id}: got ${hex}, expected ${v.expected_hex}`);
  }
  if (!crockfordMatches) {
    crockfordMismatches++;
    console.error(`Crockford MISMATCH for ${v.id}: got ${crockford}, expected ${v.expected_crockford}`);
  }
}

await Bun.write("ts-output.json", JSON.stringify(results, null, 2));
console.log(
  `Cross-verify: ${vectors.length} vectors. Roundtrip ${vectors.length - unpackMismatches}/${vectors.length} OK. Hex matches expected ${vectors.length - hexMismatches}/${vectors.length}. Crockford matches expected ${vectors.length - crockfordMismatches}/${vectors.length}.`,
);

if (unpackMismatches > 0 || hexMismatches > 0 || crockfordMismatches > 0) {
  console.error(`FAIL: ${unpackMismatches} roundtrip mismatch + ${hexMismatches} hex mismatch + ${crockfordMismatches} crockford mismatch`);
  process.exit(1);
}
