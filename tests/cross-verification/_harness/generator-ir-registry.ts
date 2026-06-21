// generator-ir-registry.ts — the TS-side view of the generator-IR relation.
//
// This is the bun-side twin of `src/Core/GeneratorIrRegistry.fs`. The F# module carries
// each generator's IR as the PAYLOAD of a row on a real `ZSet<IrRow>` (register = +1
// delta, retract = -1 delta, full == incremental, ZetaId = content-address). The TS
// oracles run under bun (no .NET), so this module gives the generators the SAME
// relation semantics they need: rows keyed by their content-addressed ZetaId, looked up
// via `byZetaId`. The committed `*.ir.json` documents are the rows' serialised payloads
// (the materialised view) — and the F# `GeneratorIrRegistry.Tests` pin that those files
// reproduce the relation rows byte-for-byte, so this TS view and the F# relation are the
// SAME relation, not two parallel ones.
//
// The point: a "generated-from-ir" oracle obtains its IR from the RELATION
// (`byZetaId(idOf(name, version))`), not by reading a free-floating file path. The IR is
// a tuple on the registry, addressed by the same id the rest of the system uses.

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── content-address (faithful mirror of GeneratorRegistry.hash128 / idOf) ──
// Identical to tests/cross-verification/generator-registry-id/_gen/gen.ts, which is
// byte-locked against the REAL shipping F# registry. Kept inline (not imported) so each
// oracle/relation view stays an independent peer.
const MASK = (1n << 64n) - 1n;
const u64 = (x: bigint): bigint => x & MASK;
const PRIME = 0x100000001b3n;

function hash128(s: string): string {
  let h1 = 0xcbf29ce484222325n;
  let h2 = 0x84222325cbf29ce4n;
  for (const ch of s) {
    const c = BigInt(ch.codePointAt(0) ?? 0);
    h1 = u64((h1 ^ u64(c)) * PRIME);
    h2 = u64((h2 ^ u64(c * 31n)) * PRIME);
  }
  return h1.toString(16).padStart(16, "0") + h2.toString(16).padStart(16, "0");
}

/** The content-addressed ZetaId for a generator name@version (pure function of identity). */
export function idOf(name: string, version: number): string {
  return hash128(`${name}@${version}`);
}

/** A row on the generator-IR relation (mirrors F# `GeneratorIrRegistry.IrRow`). */
export interface IrRow {
  readonly name: string;
  readonly version: number;
  readonly zetaId: string;
  /** The IR as the exact canonical-JSON bytes the oracle folds (the row payload). */
  readonly irCanonicalJson: string;
}

const HARNESS_DIR = import.meta.dir; // tests/cross-verification/_harness
const CROSS_VERIFY_DIR = join(HARNESS_DIR, ".."); // tests/cross-verification

/** Where each known generator's committed IR document (its row payload) lives. */
const KNOWN: ReadonlyArray<{ name: string; version: number; primitive: string; file: string }> = [
  { name: "rng.splitmix64", version: 1, primitive: "splitmix64", file: "splitmix64.ir.json" },
  { name: "hash.fmix32", version: 1, primitive: "fmix32", file: "fmix32.ir.json" },
  { name: "hash.fmix64", version: 1, primitive: "fmix64", file: "fmix64.ir.json" },
  { name: "rng.xoshiro256ss", version: 1, primitive: "xoshiro256ss", file: "xoshiro256ss.ir.json" },
  { name: "hash.nasam", version: 1, primitive: "nasam", file: "nasam.ir.json" },
  { name: "rng.lcg64_mmix", version: 1, primitive: "lcg64_mmix", file: "lcg64_mmix.ir.json" },
  { name: "rng.lcg32_numerical_recipes", version: 1, primitive: "lcg32_numerical_recipes", file: "lcg32_numerical_recipes.ir.json" },
  { name: "hash.murmur3_32_tail", version: 1, primitive: "murmur3_32_tail", file: "murmur3_32_tail.ir.json" },
  { name: "rng.lcg32_glibc", version: 1, primitive: "lcg32_glibc", file: "lcg32_glibc.ir.json" },
];

function loadRow(entry: (typeof KNOWN)[number]): IrRow {
  const path = join(CROSS_VERIFY_DIR, entry.primitive, "_gen", entry.file);
  const irCanonicalJson = readFileSync(path, "utf8").trim();
  return {
    name: entry.name,
    version: entry.version,
    zetaId: idOf(entry.name, entry.version),
    irCanonicalJson,
  };
}

/** The full known generator-IR relation (all rows, weight +1). */
export const relation: ReadonlyArray<IrRow> = KNOWN.map(loadRow);

/** Look a row up on the relation by its content-addressed ZetaId (id -> IR row). */
export function byZetaId(zetaId: string): IrRow | undefined {
  return relation.find((r) => r.zetaId === zetaId);
}

/** Convenience: look up by name@version (re-derives the id, then resolves the row). */
export function byNameVersion(name: string, version: number): IrRow | undefined {
  return byZetaId(idOf(name, version));
}
