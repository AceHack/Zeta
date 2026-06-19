// nway-diff.ts — the shared N-way cross-language byte-diff harness.
//
// WHY THIS EXISTS
// ---------------
// Zeta's correctness model is "agreement across independent oracles IS the proof":
// a primitive is right-by-construction when every language port produces the
// byte-identical answer on a shared golden fixture. Until now each primitive dir
// carried its own hand-rolled ~160-line `compare.ts` that (a) hard-coded "TS is the
// reference", (b) manually unrolled each of the other five languages, and (c)
// duplicated the same key-set / per-key / canonical-assertion logic. Ten copies,
// drifting independently.
//
// This module collapses all of that into ONE generic N-way differ. A primitive's
// compare.ts becomes a three-line call:
//
//     import { runNWayDiff } from "../_harness/nway-diff.ts";
//     process.exit(await runNWayDiff({ dir: import.meta.dir }));
//
// DESIGN PRINCIPLES (these mirror the traveler-frame / fixed-point thesis)
// -----------------------------------------------------------------------
//   * No privileged oracle. Every `<lang>-output.json` is a PEER. We do not anoint
//     TS (or any language) as "truth"; we look for the common fixed point that all
//     present oracles agree on, and assert it against the canonical vectors. This is
//     stronger than the old "compare everyone to TS" because it catches a wrong TS
//     too, and it reports WHICH oracle(s) sit outside the majority.
//   * Assert against canonical, don't just self-agree. Two oracles can agree WRONGLY;
//     the canonical `expected` from vectors.{yaml,json} is the external ground truth,
//     so a unanimous-but-wrong result still fails (catches a shared-bug Sybil of
//     oracles, e.g. a mis-copied reference vector).
//   * Fail loud, name the culprit. Divergence produces a structured report (vector
//     key, per-oracle value, expected, and the dissenting set) — not a console spray.
//   * Assert-don't-skip. A missing canonical file, zero oracles, or an empty vector
//     set is a FAILURE, never a silent pass.
//
// CODEGEN-FORWARD TRAJECTORY — a Z-set schema over DBSP, evolved zero-downtime
// ----------------------------------------------------------------------------
// Today, this harness diffs independently hand-authored oracles. The target state
// is oracles EMITTED from the homoiconic IR (`src/Core/DynamicValue.fs`) via
// registered generators (`src/Core/GeneratorRegistry.fs`).
//
// The key reframe (Aaron, 2026-06-19): GeneratorRegistry is NOT a sibling
// mechanism — it is ONE schema-registry-over-DBSP relation. DBSP + Rx is the tiny
// core; everything else is a view over it. A registry entry (name@version ->
// content-addressed ZetaId) is a ROW in a Z-set; registering or superseding a
// generator is a Z-set DELTA; rollback is Z-set RETRACTION. So the registry is
// maintained incrementally and evolved with ZERO DOWNTIME by the very same
// machinery the schema-evolution proof uses:
//   * `src/Core/SchemaEvolution.fs` (B-0930): a migration is a total
//     `DynamicValue -> DynamicValue` with `Up` + optional `Down` (rollback);
//     forward/backward compatibility over a compatibility window.
//   * The `full == incremental` theorem IS DBSP's incrementalization soundness
//     (`src/Core/IndexedZSet.fs`, `src/Core/ZSet.fs`): an index is a derived
//     Z-set; reindex == from-scratch. Schema versions are events on the stream.
//   * docs/research/2026-06-07-evolution-schema-and-index-as-proven-projections-...
//     and ...-ddl-as-branchable-canary-... — the "Evolution" proof obligation.
//
// In that future, oracle agreement is TRUE BY CONSTRUCTION — not because humans
// re-derived the same answer, but because every oracle is emitted by a generator
// that is itself a row in a zero-downtime-evolved Z-set schema, and generators are
// total functions (`interface -> artifact`, DST-deterministic, byte-lockable per
// `gen/README.md`). This harness then shifts from "do the hand-ports agree?" to
// "does the generated code match the byte-lock?" — i.e. it becomes the
// GENERATOR-FIDELITY check on that pipeline, with Kestrel's homoiconicity proof as
// the backstop. The byte-lock asserted here is exactly that fidelity invariant.
//
// WHERE THIS HARNESS LANDS — ACE, and "gen(gen) corrects drift across SPACE"
// ----------------------------------------------------------------------------
// ACE is the package-manager-OF-package-managers built on this exact substrate:
// DBSP+Rx (tiny core) + schema evolution + generators + ZetaIds. In ACE, a
// "package" is a distributed deterministic QUASI-TIME-CRYSTAL: its replicated
// data holds a stable structure across nodes because identity is content-addressed
// (ZetaId) and evolution is replayable Z-set deltas, and the package + its
// versions + its forks + the negotiation/merge of forked changes are all the SAME
// object (a DBSP relation under an Eve fusion contract, `GSet.fs`/`ZSet.fs`/
// `Reconcile.fs`), not four bolted-together systems.
//
// The drift-correction is two-axis, and THIS HARNESS IS THE SPACE AXIS. From
// `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md`: "the generator IS the ECC across
// BOTH axes — gen(gen) corrects drift across SPACE (N-oracle byte-lock; 'doesn't
// float apart'), DST corrects drift across TIME (replicated data = quasi-time-
// crystal; deterministic replay)." This harness IS that N-oracle byte-lock — it is
// the space-axis ECC check the register's discharge obligation #1 names.
//
// Honest peel (register, verbatim): "the agent/intelligence is the FREE layer (not
// a time-crystal), only the DATA is the quasi-time-crystal." Tier: the proven part
// is the byte-lock here + the ACE canonical-JSON oracle
// (`src/Core.FSharp.AceCanonical/AceCanonical.fs`, `tests/cross-verification/
// canonical-json/`); the full self-regeneration-from-seed quasi-time-crystal is
// CONJECTURE in register §B with a named falsifier ("if nodes drift apart despite
// gen(gen)/DST → it is metaphor").
//
// THE OTHER AXIS — territory/data is a soft/Bayesian uncertainty hierarchy
// ----------------------------------------------------------------------------
// This harness covers the STRUCTURE axis (gen(gen), zero-uncertainty by
// construction). The complementary TERRITORY/DATA axis — the part that must NOT
// regenerate from seed and instead rides ACE replication — is held in a
// soft/Bayesian GEOSPATIAL memory hierarchy whose placement key is UNCERTAINTY
// over RELATIVISTIC distance (traveler-frame / lightlike-consensus-gravity
// distance, NOT kilometres or wall-clock). It is Stanford Sequoia's hierarchy
// shape (formal, scale-free, deterministic across arbitrary depth — V8 spec) but
// keyed on "how sure are we?" instead of "where are the bytes?":
//   * `src/Core/UncertainClock.fs` — the never-falsely-certain temporal-order leg
//     of the traveler frame (HLC + uncertainty window ε; partial order; ε=0
//     collapses to exact `Versionstamp`).
//   * `src/Bayesian/BayesianAggregate.fs` — conjugate-prior (BetaBernoulli, …)
//     updates AS DBSP stream operators: the belief is maintained incrementally on
//     the same Z-set substrate, so updates converge coordination-free.
//   * `src/Core/Hierarchy.fs` + `MemoryLens.fs` + `MemorySense.fs` — the levels
//     (lens keeps controllable cells; sense watches ranges/seasons/Itron-
//     coincidence/anomaly for what the lens misses).
//   * Relativistic territory: B-0994 earth-twin "lightlike curves over
//     consensus-gravity"; geospatial-core-algebra + world-borders-O(1).
// DST replay + Eve fusion PROMOTE data up the hierarchy as uncertainty collapses.
// Tier: the engine pieces are built/proven; the unified "Sequoia keyed on
// uncertainty-over-relativistic-distance" synthesis is architecture/research tier
// (V8 spec + B-0994), labelled as such.
//
// To track the transition, oracles output a `_source` provenance field
// (`"hand-port"` vs `"generated-from-ir"`).
//
// OUTPUT SHAPES SUPPORTED
// -----------------------
// Each `<lang>-output.json` is `{ _source?: string, [vectorId]: value }` where
// `value` is either a scalar string (e.g. sha256 hex, splitmix64 decimal) or an
// object. Objects are
// compared by canonical JSON (stable key order), so tri-boolean-style record
// outputs work without bespoke field code. The canonical expected for a vector is
// read from vectors.{yaml,json}: a scalar field (expected/expected_hex/result/value)
// when present, else the vector object minus its `id`/`type` bookkeeping keys.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** The six (today) language oracle slots, by output-file prefix and display name. */
const ORACLES: ReadonlyArray<{ file: string; name: string }> = [
  { file: "ts-output.json", name: "TS" },
  { file: "fsharp-output.json", name: "F#" },
  { file: "cs-output.json", name: "C#" },
  { file: "rust-output.json", name: "Rust" },
  { file: "python-output.json", name: "Python" },
  { file: "go-output.json", name: "Go" },
];

/** Bookkeeping keys on a canonical vector that are not part of the compared value. */
const VECTOR_META_KEYS = new Set(["id", "type", "description", "note"]);
/** Scalar fields, in priority order, that carry a canonical expected value. */
const CANONICAL_SCALAR_FIELDS = ["expected", "expected_hex", "result", "value", "hex"];

export interface NWayDiffOptions {
  /** Absolute path to the primitive dir (pass `import.meta.dir`). */
  dir: string;
  /**
   * Minimum number of language oracles that must be present. Defaults to 1
   * (a primitive may legitimately start single-language), but the canonical
   * assertion still runs, so a lone oracle is still checked against ground truth.
   */
  minOracles?: number;
  /** When true, prints the agreeing summary line on success. Defaults to true. */
  verbose?: boolean;
}

type OracleTable = Record<string, unknown>;

interface LoadedOracle {
  name: string;
  file: string;
  table: OracleTable;
}

/** Canonicalise a value to a stable string for byte-equality comparison. */
function canon(value: unknown): string {
  if (value === null || value === undefined) return "\u0000MISSING";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // Object / array: stable-key canonical JSON.
  return stableStringify(value);
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Load whichever oracle output files are present in the dir. */
function loadOracles(dir: string): LoadedOracle[] {
  const out: LoadedOracle[] = [];
  for (const { file, name } of ORACLES) {
    const p = join(dir, file);
    if (!existsSync(p)) continue;
    let table: OracleTable;
    try {
      table = JSON.parse(readFileSync(p, "utf8")) as OracleTable;
    } catch (e) {
      throw new Error(`oracle ${name} (${file}) is not valid JSON: ${(e as Error).message}`);
    }
    out.push({ name, file, table });
  }
  return out;
}

/** Extract the canonical expected value for a vector, or undefined if none. */
function canonicalExpected(vec: Record<string, unknown>): unknown {
  for (const f of CANONICAL_SCALAR_FIELDS) {
    if (f in vec && vec[f] !== undefined) return vec[f];
  }
  // No scalar field: the canonical value is the vector minus bookkeeping keys.
  const rest: Record<string, unknown> = {};
  let any = false;
  for (const [k, v] of Object.entries(vec)) {
    if (VECTOR_META_KEYS.has(k)) continue;
    rest[k] = v;
    any = true;
  }
  return any ? rest : undefined;
}

/** Load the canonical vectors from vectors.json or vectors.yaml. Returns a map id -> expected canon string (or null if no canonical value is defined). */
async function loadCanonical(dir: string): Promise<Map<string, string | null>> {
  const jsonP = join(dir, "vectors.json");
  const yamlP = join(dir, "vectors.yaml");
  let parsed: unknown;
  if (existsSync(jsonP)) {
    parsed = JSON.parse(readFileSync(jsonP, "utf8"));
  } else if (existsSync(yamlP)) {
    // Bun.YAML is available in the bun runtime CI uses for these oracles.
    parsed = (globalThis as { Bun?: { YAML: { parse(s: string): unknown } } }).Bun!.YAML.parse(
      readFileSync(yamlP, "utf8"),
    );
  } else {
    throw new Error(`no canonical vectors.json or vectors.yaml in ${dir} (assert-don't-skip)`);
  }

  // Accept either { vectors: [...] } or a top-level array, or a flat object map.
  const result = new Map<string, string | null>();
  const root = parsed as Record<string, unknown>;
  const list = Array.isArray(parsed)
    ? (parsed as Record<string, unknown>[])
    : Array.isArray(root.vectors)
      ? (root.vectors as Record<string, unknown>[])
      : null;

  if (list) {
    for (const vec of list) {
      const id = vec.id ?? vec.key ?? vec.name;
      if (typeof id !== "string") {
        throw new Error(`canonical vector missing a string id/key/name: ${JSON.stringify(vec)}`);
      }
      const exp = canonicalExpected(vec);
      result.set(id, exp === undefined ? null : canon(exp));
    }
  } else {
    // Flat object map id -> expected scalar.
    for (const [id, exp] of Object.entries(root)) {
      if (id === "description" || id === "version") continue;
      result.set(id, canon(exp));
    }
  }
  if (result.size === 0) {
    throw new Error(`canonical vectors in ${dir} parsed to zero entries (assert-don't-skip)`);
  }
  return result;
}

export interface Divergence {
  vector: string;
  expected: string | null;
  /** value (canon string) per oracle name */
  byOracle: Record<string, string>;
  /** oracle names whose value differs from the agreed majority / canonical */
  dissenting: string[];
}

/**
 * Run the N-way diff for one primitive dir. Returns process exit code:
 * 0 = all present oracles agree with each other AND with the canonical vectors;
 * 1 = any divergence, missing-oracle-below-min, or missing canonical.
 */
export async function runNWayDiff(opts: NWayDiffOptions): Promise<number> {
  const { dir, minOracles = 1, verbose = true } = opts;
  const oracles = loadOracles(dir);
  const canonical = await loadCanonical(dir);

  if (oracles.length < minOracles) {
    console.error(
      `✗ ${dir}: only ${oracles.length} oracle(s) present, need >= ${minOracles} (assert-don't-skip)`,
    );
    return 1;
  }
  if (oracles.length === 0) {
    console.error(`✗ ${dir}: no language oracles present — unchecked primitive`);
    return 1;
  }

  if (verbose) {
    console.log(`N-way cross-verification — ${dir}`);
    const present = oracles.map((o) => {
      const source = typeof o.table._source === "string" ? o.table._source : "hand-port";
      return `${o.name} [${source}]`;
    }).join(", ");
    const absent = ORACLES.filter((o) => !oracles.some((p) => p.file === o.file))
      .map((o) => o.name)
      .join(", ");
    console.log(`  oracles present: ${present}${absent ? `   (absent: ${absent})` : ""}`);
    console.log(`  canonical vectors: ${canonical.size}`);
  }

  const divergences: Divergence[] = [];
  const vectorIds = [...canonical.keys()];

  // 1) Every present oracle must cover exactly the canonical key set.
  for (const o of oracles) {
    const oracleKeys = new Set(Object.keys(o.table));
    for (const id of vectorIds) {
      if (id === "_source") continue;
      if (!oracleKeys.has(id)) {
        divergences.push({
          vector: id,
          expected: canonical.get(id) ?? null,
          byOracle: { [o.name]: "\u0000MISSING" },
          dissenting: [o.name],
        });
      }
    }
    for (const k of oracleKeys) {
      if (k === "_source") continue;
      if (!canonical.has(k)) {
        divergences.push({
          vector: k,
          expected: null,
          byOracle: { [o.name]: canon(o.table[k]) },
          dissenting: [o.name],
        });
      }
    }
  }

  // 2) Per-vector N-way agreement + canonical assertion.
  for (const id of vectorIds) {
    const expected = canonical.get(id) ?? null;
    const byOracle: Record<string, string> = {};
    for (const o of oracles) {
      byOracle[o.name] = id in o.table ? canon(o.table[id]) : "\u0000MISSING";
    }

    // The agreed value: if a canonical expected exists it is the reference;
    // otherwise the majority value among oracles (the fixed point they converge to).
    const reference = expected ?? majority(Object.values(byOracle));
    const dissenting = Object.entries(byOracle)
      .filter(([, v]) => v !== reference)
      .map(([name]) => name);

    if (dissenting.length > 0) {
      // Avoid double-reporting the missing/extra-key rows already pushed above.
      const already = divergences.some(
        (d) => d.vector === id && d.dissenting.length === 1 && byOracle[d.dissenting[0]!] === "\u0000MISSING",
      );
      if (!already) {
        divergences.push({ vector: id, expected, byOracle, dissenting });
      }
    }
  }

  if (divergences.length === 0) {
    if (verbose) {
      console.log(
        `✓ all ${oracles.length} oracles agree with each other and with canonical on ${canonical.size} vectors.`,
      );
    }
    return 0;
  }

  console.error(`✗ ${divergences.length} divergence(s):`);
  for (const d of divergences) {
    console.error(`  vector "${d.vector}"  expected=${fmt(d.expected)}  dissenting=[${d.dissenting.join(", ")}]`);
    for (const [name, v] of Object.entries(d.byOracle)) {
      const flag = d.dissenting.includes(name) ? " <-- DIVERGES" : "";
      console.error(`      ${name.padEnd(7)} ${fmt(v)}${flag}`);
    }
  }
  return 1;
}

function fmt(v: string | null): string {
  if (v === null) return "(no canonical)";
  if (v === "\u0000MISSING") return "MISSING";
  return v.length > 80 ? `${v.slice(0, 77)}...` : v;
}

/** Most common value in a list (the fixed point the oracles converge to). */
function majority(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0]!;
  let bestN = -1;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}
