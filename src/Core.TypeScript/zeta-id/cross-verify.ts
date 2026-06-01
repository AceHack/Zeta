import { pack, unpack, DETERMINISTIC_ENV } from "./zeta-id";
import type { ZetaObservation, Authority, Momentum } from "./types";

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

const vectors = (Bun.YAML.parse(await Bun.file("vectors.yaml").text()) as { vectors: FlatVector[] }).vectors;

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
