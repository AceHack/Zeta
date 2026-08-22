// TS oracle for GeneratorRegistry.idOf — recomputes the content-addressed ZetaId
// for each canonical `name@version` and emits ts-output.json.
//
// This is a faithful independent re-derivation of the F# `hash128`/`idOf`
// (src/Core/GeneratorRegistry.fs): a two-lane FNV-1a-ish 128-bit fold over the
// string `"{name}@{version}"`, all arithmetic wrapping uint64, printed as 32-hex
// (h1 then h2). It does NOT import any zeta port — it is a genuine independent
// oracle, so cross-language agreement is real evidence, not re-serialisation.
//
// The emitted oracle tags itself `_source: generated-from-ir`: the registry id IS
// the IR coordinate. `rng.splitmix64@1` is the generator behind the splitmix64
// oracle, so this byte-lock is what ties that oracle's provenance to a real,
// reproducible, content-addressed registry row rather than a free-floating literal.

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const MASK = (1n << 64n) - 1n;
const u64 = (x: bigint): bigint => x & MASK;
const PRIME = 0x100000001b3n;
const PRIME2 = 0x1000000021bn;

/** Mirror of GeneratorRegistry.hash128: two FNV-1a-ish u64 lanes over the string (decorrelated). */
function hash128(s: string): string {
  let h1 = 0xcbf29ce484222325n;
  let h2 = 0x84222325cbf29ce4n;
  for (const ch of s) {
    const c = BigInt(ch.codePointAt(0) ?? 0);
    h1 = u64((h1 ^ u64(c)) * PRIME);
    const rotated = u64((c << 31n) | (c >> 33n));
    h2 = u64((h2 ^ rotated) * PRIME2);
  }
  return h1.toString(16).padStart(16, "0") + h2.toString(16).padStart(16, "0");
}

/** Mirror of GeneratorRegistry.idOf. */
function idOf(name: string, version: number): string {
  return hash128(`${name}@${version}`);
}

// (name, version) inputs — keyed by the canonical id `name@version`.
const inputs: { id: string; name: string; version: number }[] = [
  { id: "rng.splitmix64@1", name: "rng.splitmix64", version: 1 },
  { id: "boundary.glow@1", name: "boundary.glow", version: 1 },
  { id: "boundary.glow@2", name: "boundary.glow", version: 2 },
  { id: "kernel.rbf@1", name: "kernel.rbf", version: 1 },
  { id: "zetaid.glyph@1", name: "zetaid.glyph", version: 1 },
  { id: "zetaid.glyph@2", name: "zetaid.glyph", version: 2 },
];

const out: Record<string, string> = { _source: "generated-from-ir" };
for (const { id, name, version } of inputs) {
  out[id] = idOf(name, version);
}

const target = join(dirname(import.meta.dir), "ts-output.json");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log("wrote ts-output.json (generated-from-ir)");
