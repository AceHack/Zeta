/**
 * ir-vs-handwritten.ts — the INDEPENDENT-ORACLE check for the generator IR.
 *
 * WHAT THIS ANSWERS THAT NOTHING ELSE DID
 * ---------------------------------------
 * `cross-verify-ir.ts` generates code in N languages from one IR, runs each, and
 * byte-compares the outputs. That verifies the GENERATORS agree with each other.
 * It cannot verify that the IR captures the intended semantics, because a wrong
 * IR propagates identically into every lane and they agree anyway — N
 * implementations generated from one spec agreeing is one observation counted N
 * times, not N observations (`.claude/rules/numerology-vs-number-theory.md`:
 * "too many correlations is a warning, not a confirmation signal").
 *
 * The HAND-WRITTEN ports are the independent oracle. Each primitive dir under
 * `tests/cross-verification/` carries at least one hand-authored language port
 * (`_gen/gen.{fsx,csx,go,py,rs}`; the older five carry all five, the four added
 * under zeta-ir-v4 carry Python) that re-derives the algorithm from its
 * published reference with no IR in the loop. Diffing IR-GENERATED output
 * against those is what falsifies IR *adequacy* — the rung this file implements.
 *
 * WHAT IT DOES, PER PRIMITIVE
 * ---------------------------
 *   1. Loads the primitive's IR (`_gen/<name>.ir.json`).
 *   2. Classifies every committed `<lang>-output.json` lane as IR-DRIVEN
 *      (`_source === "generated-from-ir"`) or HAND-WRITTEN (anything else).
 *   3. FAILS BY NAME any IR-carrying primitive with ZERO hand-written lanes —
 *      such a primitive has no independent oracle at all, and its `vectors.yaml`
 *      was derived from the very IR it is used to check. `nway-diff.ts` accepts
 *      those at `minOracles = 1`; this harness does not.
 *   4. BAR 1 (behavioural equivalence, shared corpus): freshly emits code from
 *      the IR via the repo's real generator (`codegen-from-ir.ts`), EXECUTES it,
 *      and byte-compares against the committed hand-written lanes — per lane,
 *      per vector, by name. Fresh execution matters: the committed
 *      `<lang>-output.json` files are artifacts, so a stale one would otherwise
 *      pass a comparison that never re-ran anything.
 *   5. BAR 2 (differential / property): builds a seeded corpus far larger than
 *      the ten committed vectors — every power of two, the width edges, and
 *      pseudo-random draws — and runs BOTH sides over it. The hand-written side
 *      is the committed `_gen/gen.py` with ONLY its `INPUTS` literal rewritten,
 *      so the algorithm executed is the hand-written one verbatim, not a
 *      transcription. Guard: the same file run UNMODIFIED must reproduce the
 *      committed `python-output.json` byte-for-byte first, or the whole
 *      comparison is a hard failure rather than a skip.
 *
 * WHICH BAR APPLIED WHERE is reported per primitive and per lane; a weak bar
 * reported as a strong one is the defect this file exists to stop repeating.
 *
 * WHAT IT FOUND (2026-08-15, both fixed in `codegen-from-ir.ts`)
 * -------------------------------------------------------------
 *   * `emitTypeScript`/`emitFSharp`/`emitCSharp`/`emitRust` ignored `ir.width`
 *     and hardcoded 64-bit words, so `hash.fmix32` generated four lanes at width
 *     64 and three at width 32 — and the width-64 lanes disagreed with the
 *     hand-written fmix32 on the very first non-zero vector.
 *   * Every emitter turned an op outside v1's `mul|xorshr` grammar into
 *     `xorshr undefined` instead of refusing, silently mis-compiling the six
 *     v2/v3/v4 IRs (`rotl`, `add`, `xrotxor`, `xshrxor`).
 * Both were invisible because the only IR this generator was ever tested against
 * is splitmix64 — width 64, two-op grammar.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  canonicalInputsFor,
  emitPython,
  emitTypeScript,
  parseIrJson,
  type ZetaIrV1,
} from "./codegen-from-ir.ts";

/** The IR op shape, re-exported so callers can build mutated IRs without a second import. */
export type { IrOp as IrOpLike } from "./codegen-from-ir.ts";

/** Absolute path to `tests/cross-verification`. */
export const CROSS_VERIFICATION_ROOT = dirname(import.meta.dir);

// ─── discovery ───────────────────────────────────────────────────────────────

export interface Primitive {
  /** Directory name, e.g. `fmix32`. */
  readonly name: string;
  /** Absolute path to `tests/cross-verification/<name>`. */
  readonly dir: string;
  /** Absolute path to the committed IR artifact. */
  readonly irPath: string;
  /** The parsed IR, with `width` defaulted to 64 for the one legacy file that omits it. */
  readonly ir: ZetaIrV1;
  /** True when the committed IR file carries no `width` key (legacy splitmix64). */
  readonly widthWasImplied: boolean;
}

/**
 * Every primitive directory that carries a `_gen/<name>.ir.json`.
 *
 * Discovery is by scan, never by a hand-maintained list: a new IR primitive is
 * covered the moment it exists. A list would have exactly the bug it is meant to
 * prevent — someone has to remember to add the row.
 */
export function discoverPrimitives(root: string = CROSS_VERIFICATION_ROOT): Primitive[] {
  const out: Primitive[] = [];
  for (const name of readdirSync(root).sort()) {
    if (name.startsWith("_")) continue;
    const dir = join(root, name);
    const irPath = join(dir, "_gen", `${name}.ir.json`);
    if (!existsSync(irPath)) continue;
    const raw = readFileSync(irPath, "utf-8");
    const ir = parseIrJson(raw);
    const widthWasImplied = ir.width === undefined;
    out.push({
      name,
      dir,
      irPath,
      ir: widthWasImplied ? { ...ir, width: 64 } : ir,
      widthWasImplied,
    });
  }
  return out;
}

// ─── lane classification ─────────────────────────────────────────────────────

/** The committed language-oracle output slots, by file name. */
const LANE_FILES: readonly { file: string; lane: string }[] = [
  { file: "ts-output.json", lane: "ts" },
  { file: "fsharp-output.json", lane: "fsharp" },
  { file: "cs-output.json", lane: "csharp" },
  { file: "rust-output.json", lane: "rust" },
  { file: "python-output.json", lane: "python" },
  { file: "go-output.json", lane: "go" },
];

export interface CommittedLane {
  readonly lane: string;
  readonly file: string;
  /** The `_source` provenance tag, or `"hand-port"` when absent. */
  readonly source: string;
  readonly irDriven: boolean;
  /** vector-id → value, with `_source` stripped. */
  readonly values: Record<string, string>;
}

export function committedLanes(dir: string): CommittedLane[] {
  const out: CommittedLane[] = [];
  for (const { file, lane } of LANE_FILES) {
    const p = join(dir, file);
    if (!existsSync(p)) continue;
    const table = JSON.parse(readFileSync(p, "utf-8")) as Record<string, string>;
    const source = typeof table._source === "string" ? table._source : "hand-port";
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(table)) {
      if (k === "_source") continue;
      values[k] = String(v);
    }
    out.push({ lane, file, source, irDriven: source === "generated-from-ir", values });
  }
  return out;
}

export function handWrittenLanes(dir: string): CommittedLane[] {
  return committedLanes(dir).filter((l) => !l.irDriven);
}

/**
 * Primitives that carry an IR but NO hand-written port in any language.
 *
 * These are not "fine, they just started single-language". Their only lane is
 * generated from the IR, and their `vectors.yaml` expected values were produced
 * by that same lane — so the check is the IR compared against itself. Recorded
 * here explicitly so the set is a visible diff when it changes, and asserted to
 * match the scan EXACTLY in both directions (a primitive that grows a
 * hand-written port must be removed from this list; a new bare one must be added
 * deliberately, not silently).
 *
 * NOW EMPTY, AND THAT IS A CLAIM ABOUT ARITHMETIC ONLY
 * ---------------------------------------------------
 * The four entries that used to sit here — `lcg32_glibc`,
 * `lcg32_numerical_recipes`, `lcg64_mmix`, `murmur3_32_tail` — each now carry an
 * independently written `_gen/gen.py` (from the published recurrence / reference
 * source, never from the IR), so every IR-carrying primitive in the tree has
 * something that can disagree with it: bar 1 on the committed vectors and bar 2
 * over 2000 differential inputs.
 *
 * What that buys is IR ADEQUACY ON ARITHMETIC — a wrong width, a dropped or
 * transposed op, a mistyped constant. It does NOT buy anchor entailment, and the
 * distinction is not academic here, because two of those four are named for
 * anchors they do not implement:
 *
 *   * `rng.lcg32_glibc` is `(x * 1103515245 + 12345) mod 2^32`. glibc's TYPE_0
 *     reduces mod 2^31 AND writes the masked value back into the state —
 *     `int32_t val = ((read_state(state,0) * 1103515245U) + 12345U) & 0x7fffffff;
 *     write_state(state, 0, val);` (glibc `stdlib/random_r.c`, verified against
 *     the current source). Under that reading 4 of the 10 committed vectors
 *     differ: x-2, x-3, x-6, x-7. Further, glibc's default `rand()` is TYPE_3
 *     (degree-31 additive-feedback trinomial, `stdlib/random.c`), not an LCG at
 *     all.
 *   * `hash.murmur3_32_tail` is `rotl(h,13); h = h*5 + 0xe6546b64`, which in
 *     `MurmurHash3_x86_32` is the BODY-block mix-combine (verified against
 *     Appleby's `smhasher/src/MurmurHash3.cpp`). The section that reference
 *     labels `// tail` is the leftover-bytes path and contains none of these
 *     three ops.
 *
 * Neither is renamed here: `idOf name version` is a pure function of the name,
 * so a rename moves the generator's ZetaId and every golden byte derived from
 * it, and it requires editing `src/Core/ZetaIrV4.fs`, which is owned by another
 * agent in flight. Both findings are instead PINNED AS EXECUTABLE ASSERTIONS in
 * `anchor-entailment.test.ts` — prose in a comment is exactly the register that
 * let them sit unnoticed, and a fact that no test holds is a fact that decays.
 * The rename itself is priced and filed as work-item 081M02YCNMA087G0R003TK7AEW.
 *
 * If a new bare IR primitive lands, add it here deliberately; the paired test
 * asserts this list equals the scan in both directions, so it cannot drift.
 */
export const NO_INDEPENDENT_ORACLE: readonly string[] = [];

// ─── the differential corpus ─────────────────────────────────────────────────

/**
 * A deterministic corpus for a given width: edges, every power of two, and
 * seeded pseudo-random draws. No ambient entropy (§13 noninterference) — the
 * seed is a literal, so the corpus replays identically (§7 DST).
 */
export function differentialCorpus(width: number, count = 2000, seed = 0x5eed_1234): [string, string][] {
  const MASK = (1n << BigInt(width)) - 1n;
  const seen = new Set<string>();
  const push = (v: bigint): void => {
    seen.add((v & MASK).toString());
  };
  push(0n);
  push(1n);
  push(2n);
  push(3n);
  push(MASK);
  push(MASK - 1n);
  push(1n << BigInt(width - 1));
  push((1n << BigInt(width - 1)) - 1n);
  push(0xaaaaaaaaaaaaaaaan & MASK);
  push(0x5555555555555555n & MASK);
  push(0x0123456789abcdefn & MASK);
  for (let i = 0; i < width; i++) {
    push(1n << BigInt(i));
    push((1n << BigInt(i)) - 1n);
  }
  // SplitMix64-style stepping, purely to spread the draws deterministically.
  let state = BigInt(seed);
  const U64 = (1n << 64n) - 1n;
  const next = (): bigint => {
    state = (state + 0x9e3779b97f4a7c15n) & U64;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & U64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & U64;
    return (z ^ (z >> 31n)) & U64;
  };
  while (seen.size < count) push(next());
  return [...seen].map((v, i) => [`d-${String(i)}`, v] as [string, string]);
}

// ─── execution ───────────────────────────────────────────────────────────────

/** Lanes this harness can emit AND execute with no extra toolchain beyond bun + python3. */
export const DEFAULT_GENERATED_LANES: readonly string[] = ["ts", "python"];

function runTsLane(ir: ZetaIrV1, inputs: readonly (readonly [string, string])[], tmp: string): Record<string, string> {
  mkdirSync(join(tmp, "gen"), { recursive: true });
  const file = join(tmp, "gen", "gen.ts");
  writeFileSync(file, emitTypeScript(ir, inputs));
  execFileSync("bun", [file], { cwd: join(tmp, "gen"), encoding: "utf-8" });
  return stripSource(JSON.parse(readFileSync(join(tmp, "ts-output.json"), "utf-8")) as Record<string, string>);
}

function runPythonLane(
  ir: ZetaIrV1,
  inputs: readonly (readonly [string, string])[],
  tmp: string,
): Record<string, string> {
  mkdirSync(join(tmp, "gen"), { recursive: true });
  const file = join(tmp, "gen", "gen.py");
  writeFileSync(file, emitPython(ir, inputs));
  execFileSync("python3", [file], { cwd: join(tmp, "gen"), encoding: "utf-8" });
  return stripSource(JSON.parse(readFileSync(join(tmp, "python-output.json"), "utf-8")) as Record<string, string>);
}

function stripSource(t: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) {
    if (k === "_source") continue;
    out[k] = String(v);
  }
  return out;
}

/** Emit + execute the IR through the repo's real generator, for the named lanes. */
export function runGeneratedLanes(
  ir: ZetaIrV1,
  inputs: readonly (readonly [string, string])[],
  lanes: readonly string[] = DEFAULT_GENERATED_LANES,
): Record<string, Record<string, string>> {
  const tmp = join("/tmp", `ir-vs-hw-${ir.generator.replace(/[^a-z0-9]/gi, "-")}-${String(process.pid)}-${String(Date.now())}`);
  try {
    const out: Record<string, Record<string, string>> = {};
    for (const lane of lanes) {
      const laneTmp = join(tmp, lane);
      mkdirSync(laneTmp, { recursive: true });
      if (lane === "ts") out[lane] = runTsLane(ir, inputs, laneTmp);
      else if (lane === "python") out[lane] = runPythonLane(ir, inputs, laneTmp);
      else throw new Error(`ir-vs-handwritten: lane \`${lane}\` is not executable by this harness`);
    }
    return out;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Run the primitive's committed hand-written `_gen/gen.py` in a scratch copy.
 *
 * `inputs === undefined` runs the file UNMODIFIED (the staleness check: the fresh
 * run must reproduce the committed artifact). Otherwise the `INPUTS = { … }`
 * literal — and only that literal — is rewritten, so the mixer body executed is
 * the hand-written one verbatim.
 */
export function runHandWrittenPython(
  p: Primitive,
  inputs?: readonly (readonly [string, string])[],
): Record<string, string> {
  const src = join(p.dir, "_gen", "gen.py");
  if (!existsSync(src)) {
    throw new Error(`ir-vs-handwritten: ${p.name} has no hand-written _gen/gen.py`);
  }
  let text = readFileSync(src, "utf-8");
  if (inputs !== undefined) {
    const literal = `INPUTS = {\n${inputs.map(([id, x]) => `    "${id}": ${x},`).join("\n")}\n}`;
    const before = text;
    text = text.replace(/^INPUTS = \{[\s\S]*?^\}/m, literal);
    if (text === before) {
      throw new Error(
        `ir-vs-handwritten: could not rewrite the INPUTS literal in ${src} — refusing to compare a corpus the hand-written oracle never saw`,
      );
    }
  }
  const tmp = join("/tmp", `ir-vs-hw-hand-${p.name}-${String(process.pid)}-${String(Date.now())}`);
  try {
    mkdirSync(join(tmp, "_gen"), { recursive: true });
    const dst = join(tmp, "_gen", "gen.py");
    writeFileSync(dst, text);
    execFileSync("python3", [dst], { cwd: join(tmp, "_gen"), encoding: "utf-8" });
    return stripSource(JSON.parse(readFileSync(join(tmp, "python-output.json"), "utf-8")) as Record<string, string>);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ─── the comparison ──────────────────────────────────────────────────────────

export interface Divergence {
  readonly primitive: string;
  /** Which comparison produced it, e.g. `ts(generated) vs fsharp(hand-written)`. */
  readonly comparison: string;
  readonly vector: string;
  readonly generated: string;
  readonly handWritten: string;
}

export interface PrimitiveReport {
  readonly primitive: string;
  readonly width: number;
  /** Generated lanes that were emitted AND executed. */
  readonly generatedLanes: string[];
  /** Hand-written lanes compared against, by language. */
  readonly handWrittenLanes: string[];
  /** Vector ids compared under bar 1. */
  readonly sharedVectors: string[];
  /** Number of inputs compared under bar 2 (0 when bar 2 did not apply). */
  readonly differentialInputs: number;
  readonly divergences: Divergence[];
  /** Honest note on which bars actually ran. */
  readonly bars: string[];
}

function diff(
  primitive: string,
  comparison: string,
  generated: Record<string, string>,
  handWritten: Record<string, string>,
): Divergence[] {
  const out: Divergence[] = [];
  for (const [vector, gv] of Object.entries(generated)) {
    const hv = handWritten[vector];
    if (hv === undefined) continue; // key coverage is asserted separately
    if (gv !== hv) out.push({ primitive, comparison, vector, generated: gv, handWritten: hv });
  }
  return out;
}

/**
 * Compare IR-GENERATED output against the primitive's HAND-WRITTEN oracles.
 *
 * Throws (never returns a green) when the primitive has no hand-written lane, or
 * when the hand-written Python oracle does not reproduce its own committed
 * artifact — both are conditions under which a "pass" would mean nothing.
 */
export function compareGeneratedVsHandWritten(
  p: Primitive,
  opts: { lanes?: readonly string[]; differentialCount?: number } = {},
): PrimitiveReport {
  const lanes = opts.lanes ?? DEFAULT_GENERATED_LANES;
  const hand = handWrittenLanes(p.dir);
  if (hand.length === 0) {
    throw new Error(
      `ir-vs-handwritten: ${p.name} carries an IR but has ZERO hand-written lanes — there is no independent oracle to compare against`,
    );
  }

  const bars: string[] = [];
  const divergences: Divergence[] = [];

  // ── BAR 1: behavioural equivalence on the committed vector corpus ──────────
  // The generated lanes use the width's canonical input set, whose ids coincide
  // with the committed vector ids, so the diff is key-for-key with no remapping.
  const sharedInputs = committedInputsFor(p);
  const generated = runGeneratedLanes(p.ir, sharedInputs, lanes);
  const sharedVectors = sharedInputs.map(([id]) => id);

  for (const [lane, table] of Object.entries(generated)) {
    for (const h of hand) {
      const covered = sharedVectors.filter((v) => h.values[v] !== undefined);
      if (covered.length === 0) {
        throw new Error(
          `ir-vs-handwritten: ${p.name} hand-written lane ${h.lane} shares ZERO vector ids with the generated lane — the comparison would be vacuous`,
        );
      }
      divergences.push(...diff(p.name, `${lane}(generated) vs ${h.lane}(hand-written)`, table, h.values));
    }
  }
  bars.push(
    `bar-1 behavioural-equivalence: ${String(sharedVectors.length)} committed vectors x ${String(Object.keys(generated).length)} generated lane(s) x ${String(hand.length)} hand-written lane(s), fresh execution`,
  );

  // ── BAR 2: differential / property corpus, vs the hand-written Python ──────
  let differentialInputs = 0;
  if (existsSync(join(p.dir, "_gen", "gen.py")) && hand.some((h) => h.lane === "python")) {
    // Guard first: the unmodified hand-written file must reproduce its own
    // committed artifact. A stale artifact would otherwise let bar 1 pass on
    // bytes nobody re-derived.
    const fresh = runHandWrittenPython(p);
    const committed = hand.find((h) => h.lane === "python")!.values;
    for (const [k, v] of Object.entries(committed)) {
      if (fresh[k] !== v) {
        throw new Error(
          `ir-vs-handwritten: ${p.name} committed python-output.json is STALE — re-running _gen/gen.py gives ${String(fresh[k])} for ${k}, committed says ${v}`,
        );
      }
    }

    const corpus = differentialCorpus(p.ir.width, opts.differentialCount ?? 2000);
    const handExtended = runHandWrittenPython(p, corpus);
    const genExtended = runGeneratedLanes(p.ir, corpus, lanes);
    for (const [lane, table] of Object.entries(genExtended)) {
      divergences.push(...diff(p.name, `${lane}(generated) vs python(hand-written, extended)`, table, handExtended));
    }
    differentialInputs = corpus.length;
    bars.push(
      `bar-2 differential: ${String(corpus.length)} seeded inputs (edges + every power of two + pseudo-random) vs the verbatim hand-written Python mixer`,
    );
  } else {
    bars.push("bar-2 differential: NOT RUN (no hand-written _gen/gen.py for this primitive)");
  }

  return {
    primitive: p.name,
    width: p.ir.width,
    generatedLanes: Object.keys(generated),
    handWrittenLanes: hand.map((h) => h.lane),
    sharedVectors,
    differentialInputs,
    divergences,
    bars,
  };
}

/**
 * The input set the committed hand-written lanes were evaluated on, taken from
 * the union of their own key sets (so the ids are theirs, not ours) with values
 * decoded from the canonical input list for the width.
 */
function committedInputsFor(p: Primitive): [string, string][] {
  const hand = handWrittenLanes(p.dir);
  const ids = new Set<string>();
  for (const h of hand) for (const k of Object.keys(h.values)) ids.add(k);
  const byId = new Map(canonicalInputsFor(p.ir.width));
  const out: [string, string][] = [];
  for (const id of [...ids].sort()) {
    const v = byId.get(id);
    if (v !== undefined) out.push([id, v]);
  }
  if (out.length === 0) {
    throw new Error(
      `ir-vs-handwritten: ${p.name} — none of the hand-written lanes' vector ids are in the width-${String(p.ir.width)} canonical input set; cannot form a shared corpus`,
    );
  }
  return out;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const primitives = discoverPrimitives();
  const bare = primitives.filter((p) => handWrittenLanes(p.dir).length === 0).map((p) => p.name);
  let failed = 0;

  console.log(`ir-vs-handwritten — ${String(primitives.length)} IR-carrying primitive(s) discovered`);
  console.log(`  no independent oracle (IR-only, vectors derived from the IR): ${bare.join(", ") || "none"}`);

  for (const p of primitives) {
    if (bare.includes(p.name)) {
      console.log(`  ! ${p.name}: SKIPPED-BY-NAME — no hand-written lane exists to compare against`);
      continue;
    }
    try {
      const r = compareGeneratedVsHandWritten(p);
      const status = r.divergences.length === 0 ? "agree" : `DIVERGE (${String(r.divergences.length)})`;
      console.log(
        `  ${r.divergences.length === 0 ? "OK" : "XX"} ${p.name} (width ${String(r.width)}): ${status} — generated [${r.generatedLanes.join(", ")}] vs hand-written [${r.handWrittenLanes.join(", ")}], ${String(r.sharedVectors.length)} vectors + ${String(r.differentialInputs)} differential inputs`,
      );
      for (const b of r.bars) console.log(`       ${b}`);
      for (const d of r.divergences.slice(0, 5)) {
        console.log(`       ${d.comparison} @ ${d.vector}: generated=${d.generated} hand-written=${d.handWritten}`);
      }
      if (r.divergences.length > 0) failed++;
    } catch (e: unknown) {
      console.log(`  XX ${p.name}: ${(e as Error).message}`);
      failed++;
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}
