// Independent TS oracle: compute SplitMix64 over the canonical inputs and emit
// ts-output.json. Recomputes the mixer with BigInt masked to u64 (does not
// import the zeta port) so the cross-verification is a genuine independent oracle.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const MASK = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;
const A = 0xbf58476d1ce4e5b9n;
const B = 0x94d049bb133111ebn;

function mix(x: bigint): bigint {
  let z = (x * GOLDEN) & MASK;
  z = (((z ^ (z >> 30n)) & MASK) * A) & MASK;
  z = (((z ^ (z >> 27n)) & MASK) * B) & MASK;
  return (z ^ (z >> 31n)) & MASK;
}

const inputs: Record<string, bigint> = {
  "x-0": 0n,
  "x-1": 1n,
  "x-2": 2n,
  "x-10": 10n,
  "x-255": 255n,
  "x-u64max": 18446744073709551615n,
  "x-golden": 11400714819323198485n,
  "x-2pow63": 9223372036854775808n,
  "x-12345678901234567890": 12345678901234567890n,
  "x-1e18": 1000000000000000000n,
};

const out: Record<string, string> = {};
for (const [id, x] of Object.entries(inputs)) out[id] = mix(x).toString();

const target = join(dirname(import.meta.dir), "ts-output.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log("wrote ts-output.json");
