/**
 * wset-four-corner-trace.ts — the TS parity oracle for `FourCornerTrace` (F# `src/Core/WSet.fs`).
 *
 * The F# module landed 2026-08-16 (#10992, Vera) and existed in exactly ONE oracle. This is the
 * mirror. The F# side is the SOURCE OF TRUTH: it locks the semantics, this conforms. Do not
 * "improve" anything here without moving the F# side first.
 *
 * ── What the loop is ────────────────────────────────────────────────────────────────────────
 * The standard monadic interface puts feedback on the OUTPUT channel only. `FourCornerOwnership`
 * puts it on the INPUT channel too (`tInFeedback`, the co-owned corner). Bending that arrow back
 * around is the TRACE of a traced monoidal category (Joyal–Street–Verity 1996): feedback flows
 * backward into the GENERATOR, the generator REINTERPRETS THE SAME HISTORY, and the difference is
 * emitted as a delta carrying RETRACTIONS (`negate`, weight −1 over ℤ — Budiu et al. 2022, DBSP).
 *
 * ── HONESTY, carried verbatim in substance from the F# docstrings ───────────────────────────
 * • PSEUDO-retrocausality, not time travel. Nothing physical is sent backwards. The stored
 *   history is immutable; only its READING moves, and the superseded emission is retracted
 *   (+w then −w annihilate in consolidation) while the new one is emitted.
 * • The ℂ corner is the AMPLITUDE RING, an algebraic bridge only — `−1 = i²` puts the retraction
 *   corner and the amplitude corner on one C₄ phase {1, i, −1, −i}. That is an identity in the
 *   ring. It is NOT a claim that this substrate is physically quantum.
 * • `negate` is a self-inverse bijection, so by Bennett 1973 it erases nothing and is
 *   Landauer-FREE. The erasure is in CONSOLIDATION (the annihilating pair and the empty set both
 *   land on []). Negation is free; annihilation is what pays. Those two read as one operation and
 *   are not one operation.
 * • Which corners admit the trace: the retraction needs an ADDITIVE INVERSE, so the trace exists
 *   exactly on the RING corners — ℤ (DBSP) and ℂ (amplitudes). The normalized ℝ≥0 (Markov),
 *   Boolean and tropical corners are inverse-free SEMIrings: there is no `−w` to un-emit with, so
 *   the loop does not instantiate there. F# refuses this at the type level via `IStarRing`; the
 *   TS mirror refuses it at the type level via `TraceRing` (see below) — a compile error, never a
 *   runtime throw.
 *
 * ── Three decisions that are load-bearing and must not be "simplified" ──────────────────────
 * 1. `TraceTurn` is ONE APPEND-ONLY OBSERVATION. `sequence` is LOGICAL ORDER, NOT WALL TIME: a
 *    later turn may retract an earlier interpretation, but it cannot rewrite this record. (This
 *    is also `.claude/rules/local-time-never-enters-the-shared-fold.md` — no clock is read here.)
 * 2. The trace is RETURNED TO THE CALLER rather than retained in `Traced`, so storage and
 *    forgetting stay EXPLICIT POLICY DECISIONS AT THE BOUNDARY. This module keeps no log. That is
 *    Bennett's reversible-computation boundary: keeping history costs nothing, forgetting is where
 *    the Landauer cost lands, so forgetting must be something a caller CHOOSES.
 * 3. EMPTY DELTAS ARE STILL RECORDED. Receiving idempotent feedback is part of the causal record
 *    even when it does not change the materialized view. A fold that skips no-op turns is WRONG.
 *
 * ── Parity / treaty ─────────────────────────────────────────────────────────────────────────
 * `traceTurnToLine` / `traceStateToLine` are the canonical TEXT wire form for the
 * string-key / ℤ-weight instantiation. Both oracles MUST produce byte-identical lines against
 * ./wset-four-corner-trace-golden-vectors.lines
 * (F# conformer: tests/Tests.FSharp/WSetFourCornerTraceTreaty.Tests.fs).
 *
 * Collation: ordering is ORDINAL (`ordinalCompareKeys`), never `localeCompare` and never
 * `Intl.Collator`. The golden vectors carry keys whose ordinal order differs from every linguistic
 * order (`B` before `a`), so a locale-sensitive sort makes the byte-lock go red. See
 * `.claude/rules/culture-invariant-by-default.md` and 081KT07NV0008QG0R001YDB73K.
 *
 * ORDINAL HERE MEANS UTF-16 CODE UNIT, and that is a deliberate, measured choice, not a slip.
 * F#'s structural `compare` on `string` is `String.CompareOrdinal` — UTF-16 code UNIT order — and
 * `WSet.consolidate` sorts with it (`List.sortBy fst`). The repo's *canonical* collation is
 * `collation.ts`'s `stringCompare`, which is code POINT order. Those two agree across the entire
 * BMP and DISAGREE above it (measured: F# sorts U+1F600 before U+FFFD; `stringCompare` sorts
 * U+FFFD before U+1F600 — the surrogate lead unit D83D sorts below FFFD). Matching F# is what
 * makes the byte-lock TRUE; switching this to `stringCompare` would put the two oracles silently
 * out of order on astral keys while still calling itself parity. The gap belongs to
 * `WSet.consolidate`, is filed as 081M060AYN9087G0R0006E6FWZ, and is pinned by a test on BOTH
 * sides rather than left as prose.
 *
 * Anchors (Beacon): Joyal–Street–Verity 1996 (traced monoidal categories); Budiu et al. 2022
 * (DBSP, the −1 retraction); Aji–McEliece 2000 (GDL — one circuit, N rings); Bennett 1973 /
 * Landauer 1961 (reversibility and the erasure cost); Fritz 2020, Cho–Jacobs 2019 (the corners).
 */

import type { FourCornerOwnership } from "../workflow-engine/types.ts";
import { consolidateWSet, plusWSet, type StarRing, type WElement, type WSet } from "./wset.ts";

// ─── The ring corner that admits a trace ─────────────────────────────────────────────────────

/**
 * A `StarRing` whose additive inverse is REQUIRED — i.e. an actual ring, not merely a semiring.
 *
 * This is the TS analogue of F#'s `IStarRing` refusal: `wset.ts`'s `StarRing` makes `negate`
 * OPTIONAL (correctly — `TropicalRing` and `BooleanRing` genuinely have no additive inverse), so
 * passing one of those to the trace is a COMPILE ERROR here rather than a runtime surprise.
 * Correcting a belief in an inverse-free corner is re-normalisation, not retraction; do not paper
 * over the difference.
 */
export interface TraceRing<W> extends StarRing<W> {
  readonly negate: (a: W) => W;
}

/**
 * The mechanical services F# gets for free from structural comparison and TS does not:
 * a key→string identity for grouping, and a TOTAL ORDER for the canonical sort.
 *
 * `compareKeys` MUST be ordinal to match F#'s `List.sortBy fst` — see the collation note in the
 * module header for exactly which ordinal (UTF-16 code unit) and why it is not `stringCompare`.
 */
export interface TraceOps<K, W> {
  readonly ring: TraceRing<W>;
  /** the ring's zero test — the caller supplies it, because exact cancellation is the ring's business */
  readonly isZero: (w: W) => boolean;
  /** injective key identity, used for grouping (F# uses structural equality) */
  readonly keyToString: (k: K) => string;
  /** total order on keys, ORDINAL (F# uses structural `compare`, which is ordinal on strings) */
  readonly compareKeys: (a: K, b: K) => number;
}

/**
 * Ordinal (UTF-16 CODE UNIT) string comparison — the exact parity of .NET `String.CompareOrdinal`,
 * which is what F#'s structural `compare` and therefore `WSet.consolidate`'s `List.sortBy fst` use.
 *
 * NOT `collation.ts`'s `stringCompare` (code POINT order, the repo's canonical collation): the two
 * agree on the whole BMP and diverge above it, and this function's job is to match the F# oracle,
 * not to be canonical. 081M060AYN9087G0R0006E6FWZ carries the gap.
 */
export function ordinalCompareKeys(a: string, b: string): number {
  // Deliberately NOT localeCompare / Intl.Collator: those are linguistic and machine-dependent.
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Numeric comparison for number keys — the parity of F#'s structural `compare` on `int`. */
export function numericCompareKeys(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ─── The types Vera locked in F# ─────────────────────────────────────────────────────────────

/**
 * The generator: an interpretation `I` reads a stored history `H` and emits a `WSet`.
 * Feedback never edits `H` — it only ever moves `I`. That is the whole honesty claim.
 */
export type Generator<H, I, K, W> = (interpretation: I, history: H) => WSet<K, W>;

/**
 * The traced loop's state: the generator's current interpretation, plus the CUMULATIVE emission
 * downstream has observed (already consolidated, so annihilated pairs are GONE, not merely paired).
 */
export interface Traced<I, K, W> {
  /** what the input-channel feedback updates (the four-corner `tInFeedback` lands here) */
  readonly interpretation: I;
  /** the consolidated running sum of the opening emission plus every delta since */
  readonly emitted: WSet<K, W>;
}

/**
 * ONE APPEND-ONLY OBSERVATION of the loop. `sequence` is LOGICAL ORDER, NOT WALL TIME: a later
 * turn may retract an earlier interpretation, but it cannot rewrite this record.
 *
 * `bigint`, not `number`: F# uses `bigint` deliberately ("keeps the sequence total without
 * introducing an overflow exception at a long-lived boundary"). A `number` is an IEEE double and
 * stops being an exact integer at 2^53, which would silently make two distinct turns compare
 * equal — exactly the rewrite this type exists to forbid.
 *
 * Runtime enforcement: `foldRecorded` freezes every turn it emits, so an attempt to rewrite one
 * THROWS in module (strict-mode) code. `readonly` alone is erased at compile time and would leave
 * the append-only claim unfalsifiable at runtime.
 */
export interface TraceTurn<F, K, W> {
  readonly sequence: bigint;
  readonly feedback: F;
  readonly delta: WSet<K, W>;
}

/**
 * A finite recorded batch. The trace is RETURNED TO THE CALLER rather than retained in `Traced`,
 * so storage and forgetting remain explicit policy decisions at the boundary. Nothing in this
 * module holds on to `turns` after it returns them.
 */
export interface RecordedFold<I, F, K, W> {
  readonly state: Traced<I, K, W>;
  readonly nextSequence: bigint;
  readonly turns: readonly TraceTurn<F, K, W>[];
}

/**
 * An opt-in witness for modeling execution in either direction. Exact rewind is possible because
 * the state before consolidation is retained; it is not inferred from a non-injective output.
 * The ordinary trace does not pay this storage cost.
 *
 * `I` and the values reachable from it must follow the module's immutable-state contract. The
 * witness retains those values; it cannot make an arbitrary caller-defined interpretation deeply
 * immutable.
 */
export interface WitnessedTurn<I, F, K, W> {
  readonly sequence: bigint;
  readonly feedback: F;
  readonly before: Traced<I, K, W>;
  readonly after: Traced<I, K, W>;
  readonly delta: WSet<K, W>;
}

/** A finite batch of witnessed turns. As with `RecordedFold`, the caller owns retention. */
export interface WitnessedFold<I, F, K, W> {
  readonly state: Traced<I, K, W>;
  readonly nextSequence: bigint;
  readonly turns: readonly WitnessedTurn<I, F, K, W>[];
}

/**
 * An immutable-history read boundary. The caller supplies the retained history value and the
 * last logical sequence it contains. The shell is frozen; generic `H` follows the module's
 * immutable-state contract because TypeScript cannot deeply freeze an arbitrary caller value.
 */
export interface HistorySnapshot<H> {
  readonly throughSequence: bigint;
  readonly history: H;
}

/** Typed refusal for a correction placed at or before the history it reads. */
export interface CausalOrderError {
  readonly kind: "correction-does-not-follow-history";
  readonly throughSequence: bigint;
  readonly correctionSequence: bigint;
}

/** A correction appended in the only execution direction. */
export interface CausalCorrection<I, F, K, W> {
  readonly sequence: bigint;
  readonly reinterpretsThrough: bigint;
  readonly feedback: F;
  readonly before: Traced<I, K, W>;
  readonly after: Traced<I, K, W>;
  readonly delta: WSet<K, W>;
}

export type AppendCorrectionResult<I, F, K, W> =
  | { readonly ok: true; readonly correction: CausalCorrection<I, F, K, W> }
  | { readonly ok: false; readonly error: CausalOrderError };

/** Pair a retained history value with the logical boundary it contains. */
export function captureHistory<H>(throughSequence: bigint, history: H): HistorySnapshot<H> {
  return Object.freeze({ throughSequence, history });
}

/**
 * F# returns `Traced * WSet` from `start` and `step`. TS has no structural tuple-record sugar
 * worth the ambiguity, so the pair is named. Mechanical divergence, no semantic content.
 */
export interface TraceStep<I, K, W> {
  readonly state: Traced<I, K, W>;
  /** the opening emission (`start`) or the turn's delta (`step`) */
  readonly delta: WSet<K, W>;
}

// ─── Consolidation with the canonical order ──────────────────────────────────────────────────

/**
 * F# `WSet.consolidate` ends with `List.sortBy fst`; TS `consolidateWSet` does NOT sort (it
 * returns `Map` insertion order). That is a PRE-EXISTING divergence in the mirrored primitive,
 * filed as 081M05ZZG6A087G0R001PBBKDX and deliberately NOT patched here — `consolidateWSet` has
 * other callers and belongs to the algebra lane, not to a mirroring change. This module sorts on
 * top instead, so the trace's own output order matches F# exactly without moving anyone's ground.
 */
function consolidateOrdered<K, W>(ops: TraceOps<K, W>, set: WSet<K, W>): WSet<K, W> {
  const consolidated = consolidateWSet(ops.ring, ops.isZero, ops.keyToString, set);
  return [...consolidated].sort((a, b) => ops.compareKeys(a.key, b.key));
}

// ─── Pure assembly functions shared by the reference trace and source-owned adapters ─────────
// F# marks these `internal` (assembly-visible). TS has no `internal`; they are exported so the
// heat/metering adapters can meter the destructive consolidation phase themselves, which is the
// stated reason they exist. Consolidation stays at the CALLER boundary in all three.

export function openingUnconsolidated<H, I, K, W>(
  gen: Generator<H, I, K, W>,
  history: H,
  interpretation: I,
): WSet<K, W> {
  return gen(interpretation, history);
}

export function deltaUnconsolidated<H, I, K, W>(
  ring: TraceRing<W>,
  gen: Generator<H, I, K, W>,
  history: H,
  before: I,
  after: I,
): WSet<K, W> {
  return plusWSet(negateWSet(ring, gen(before, history)), gen(after, history));
}

export function cumulativeUnconsolidated<K, W>(emitted: WSet<K, W>, delta: WSet<K, W>): WSet<K, W> {
  return plusWSet(emitted, delta);
}

/**
 * THE RETRACTION (`w ↦ −w`). Mirrors F# `WSet.negate`, which `wset.ts` had not yet ported.
 * Self-inverse bijection ⇒ Landauer-free (Bennett 1973); the erasure is in consolidation.
 */
export function negateWSet<K, W>(ring: TraceRing<W>, set: WSet<K, W>): WSet<K, W> {
  return set.map((e): WElement<K, W> => ({ key: e.key, weight: ring.negate(e.weight) }));
}

// ─── The loop ────────────────────────────────────────────────────────────────────────────────

/**
 * Open the loop: read the history once under the starting interpretation and EMIT it.
 * Opening is an emission like any other, so `emitted = consolidate (gen interpretation history)`
 * holds from turn zero — an opener that emitted nothing would leave the first retraction unmatched.
 */
export function start<H, I, K, W>(
  ops: TraceOps<K, W>,
  gen: Generator<H, I, K, W>,
  history: H,
  interpretation: I,
): TraceStep<I, K, W> {
  const emitted = consolidateOrdered(ops, openingUnconsolidated(gen, history, interpretation));
  return { state: { interpretation, emitted }, delta: emitted };
}

/**
 * The reinterpretation DELTA: `−gen(before, history) + gen(after, history)`, consolidated.
 * Rows the reinterpretation did not touch cancel exactly (`w + (−w) = 0`) and are dropped; what
 * survives is precisely the retractions of superseded rows and the new emissions.
 */
export function delta<H, I, K, W>(
  ops: TraceOps<K, W>,
  gen: Generator<H, I, K, W>,
  history: H,
  before: I,
  after: I,
): WSet<K, W> {
  return consolidateOrdered(ops, deltaUnconsolidated(ops.ring, gen, history, before, after));
}

/**
 * ONE TURN: feedback arrives on the input channel, `update` moves the interpretation, the
 * generator re-reads the SAME history, and the delta (retractions + new emissions) is both
 * returned and folded into the cumulative emission.
 *
 * Invariant: after `start` and after any step, `emitted = consolidate (gen after history)` — the
 * retraction exactly cancels the superseded output, so the cumulative view is always the CURRENT
 * reading of the past, never a pile of stale rows. It follows that the emission is a pure function
 * of the final interpretation (path-independent) and that idempotent feedback emits an EMPTY delta.
 */
export function step<H, I, F, K, W>(
  ops: TraceOps<K, W>,
  gen: Generator<H, I, K, W>,
  update: (interpretation: I, feedback: F) => I,
  history: H,
  fb: F,
  st: Traced<I, K, W>,
): TraceStep<I, K, W> {
  const after = update(st.interpretation, fb);
  const d = delta(ops, gen, history, st.interpretation, after);
  const emitted = consolidateOrdered(ops, cumulativeUnconsolidated(st.emitted, d));
  return { state: { interpretation: after, emitted }, delta: d };
}

/**
 * Append a correction that reinterprets a retained history snapshot. The correction is a new
 * forward event: its sequence must be strictly greater than the snapshot boundary. Invalid order
 * returns before `update` or `gen` runs, so no partial correction can escape.
 */
export function appendCorrection<H, I, F, K, W>(
  correctionSequence: bigint,
  ops: TraceOps<K, W>,
  gen: Generator<H, I, K, W>,
  update: (interpretation: I, feedback: F) => I,
  snapshot: HistorySnapshot<H>,
  feedback: F,
  before: Traced<I, K, W>,
): AppendCorrectionResult<I, F, K, W> {
  if (correctionSequence <= snapshot.throughSequence) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        kind: "correction-does-not-follow-history",
        throughSequence: snapshot.throughSequence,
        correctionSequence,
      }),
    });
  }

  const result = step(ops, gen, update, snapshot.history, feedback, before);
  const correction = freezeCausalCorrection({
    sequence: correctionSequence,
    reinterpretsThrough: snapshot.throughSequence,
    feedback,
    before,
    after: result.state,
    delta: result.delta,
  });
  return Object.freeze({ ok: true, correction });
}

/**
 * Run a whole feedback sequence through the loop, keeping every emitted delta IN ORDER.
 * Deterministic (a left fold over the given order): DST replays it byte-identically. No clock is
 * read — logical order only.
 */
export function fold<H, I, F, K, W>(
  ops: TraceOps<K, W>,
  gen: Generator<H, I, K, W>,
  update: (interpretation: I, feedback: F) => I,
  history: H,
  feedbacks: readonly F[],
  st0: Traced<I, K, W>,
): { readonly state: Traced<I, K, W>; readonly deltas: readonly WSet<K, W>[] } {
  let st = st0;
  const deltas: WSet<K, W>[] = [];
  for (const fb of feedbacks) {
    const r = step(ops, gen, update, history, fb, st);
    st = r.state;
    deltas.push(r.delta);
  }
  return { state: st, deltas };
}

/**
 * Run a finite feedback batch and attach an APPEND-ONLY logical sequence to every turn.
 *
 * EMPTY DELTAS ARE STILL RECORDED: receiving idempotent feedback is part of the causal history
 * even when it does not change the current materialized view. Skipping them would make the record
 * unfaithful — and would be the vacuity failure, a record that cannot show a no-op ever happened.
 *
 * `bigint` keeps the sequence total without an overflow boundary. Turns are frozen on the way out
 * so the append-only property is enforced at RUNTIME, not merely asserted by `readonly`.
 */
export function foldRecorded<H, I, F, K, W>(
  firstSequence: bigint,
  ops: TraceOps<K, W>,
  gen: Generator<H, I, K, W>,
  update: (interpretation: I, feedback: F) => I,
  history: H,
  feedbacks: readonly F[],
  st0: Traced<I, K, W>,
): RecordedFold<I, F, K, W> {
  let st = st0;
  let sequence = firstSequence;
  const turns: TraceTurn<F, K, W>[] = [];

  for (const fb of feedbacks) {
    const r = step(ops, gen, update, history, fb, st);
    st = r.state;
    turns.push(freezeTurn({ sequence, feedback: fb, delta: r.delta }));
    sequence += 1n;
  }

  return Object.freeze({ state: st, nextSequence: sequence, turns: Object.freeze(turns) });
}

/**
 * Run a finite batch while retaining the information required for exact rewind and replay.
 *
 * This models bidirectional traversal over an immutable trace. It never edits an earlier turn and
 * never sends information to an earlier logical step. Empty deltas are retained because receipt of
 * feedback remains part of the execution record even when the materialized view does not change.
 */
export function foldWitnessed<H, I, F, K, W>(
  firstSequence: bigint,
  ops: TraceOps<K, W>,
  gen: Generator<H, I, K, W>,
  update: (interpretation: I, feedback: F) => I,
  history: H,
  feedbacks: readonly F[],
  st0: Traced<I, K, W>,
): WitnessedFold<I, F, K, W> {
  let before = st0;
  let sequence = firstSequence;
  const turns: WitnessedTurn<I, F, K, W>[] = [];

  for (const fb of feedbacks) {
    const r = step(ops, gen, update, history, fb, before);
    turns.push(
      freezeWitnessedTurn({
        sequence,
        feedback: fb,
        before,
        after: r.state,
        delta: r.delta,
      }),
    );
    before = r.state;
    sequence += 1n;
  }

  return Object.freeze({ state: before, nextSequence: sequence, turns: Object.freeze(turns) });
}

/** Move the modeled cursor to the state retained before this turn. */
export function rewind<I, F, K, W>(turn: WitnessedTurn<I, F, K, W>): Traced<I, K, W> {
  return turn.before;
}

/** Move the modeled cursor forward to the state retained after this turn. */
export function replay<I, F, K, W>(turn: WitnessedTurn<I, F, K, W>): Traced<I, K, W> {
  return turn.after;
}

/** The compensating delta for traversing a witnessed turn backward. */
export function inverseDelta<I, F, K, W>(ops: TraceOps<K, W>, turn: WitnessedTurn<I, F, K, W>): WSet<K, W> {
  return consolidateOrdered(ops, negateWSet(ops.ring, turn.delta));
}

/**
 * Package one traced turn as the literal four-corner object: `tIn` = the history being reread,
 * `tOut` = the emitted delta, `tInFeedback` = the co-owned feedback that caused the reread.
 * `tOutFeedback` is absent — this loop authors no forward control-flow of its own.
 *
 * NOTE the option encoding: F# has `TOut: 'TOut option` (`None` is a value). TS models the same
 * corner as an OPTIONAL property under `exactOptionalPropertyTypes`, so F# `None` is a property
 * that is ABSENT, not one set to `undefined`. `tOutFeedback` is therefore omitted rather than set.
 */
export function toFourCorner<H, F, K, W>(
  history: H,
  fb: F,
  emitted: WSet<K, W>,
): FourCornerOwnership<H, WSet<K, W>, never, F> {
  return { tIn: history, tOut: emitted, tInFeedback: fb };
}

// ─── Append-only, enforced ───────────────────────────────────────────────────────────────────

/**
 * A recorded turn is immutable in fact, not only in type. `readonly` is erased at runtime, so
 * without this the "cannot rewrite this record" claim would have no falsifier in TS.
 */
function freezeTurn<F, K, W>(turn: TraceTurn<F, K, W>): TraceTurn<F, K, W> {
  for (const element of turn.delta) Object.freeze(element);
  Object.freeze(turn.delta);
  return Object.freeze(turn);
}

/** Freeze the witness shell and its owned delta; generic state values remain caller-owned. */
function freezeWitnessedTurn<I, F, K, W>(turn: WitnessedTurn<I, F, K, W>): WitnessedTurn<I, F, K, W> {
  for (const element of turn.delta) Object.freeze(element);
  Object.freeze(turn.delta);
  return Object.freeze(turn);
}

/** Freeze the correction shell and its owned delta; generic state values remain caller-owned. */
function freezeCausalCorrection<I, F, K, W>(correction: CausalCorrection<I, F, K, W>): CausalCorrection<I, F, K, W> {
  for (const element of correction.delta) Object.freeze(element);
  Object.freeze(correction.delta);
  return Object.freeze(correction);
}

// ─── The TREATY codec (string keys × ℤ weights) ──────────────────────────────────────────────
// Canonical text wire form for the string-key instantiation. The F# conformer builds the SAME
// scenarios and must emit byte-identical lines against ./wset-four-corner-trace-golden-vectors.lines
//
//   wsettrace/turn/1 <TAB> {sequence} <TAB> {rawKey}:{label} <TAB> {set}
//   wsettrace/state/1 <TAB> {nextSequence} <TAB> {interpretation} <TAB> {emitted}
//
// where a set/map field is "-" when EMPTY and "+" + "k=v" pairs joined by ";" otherwise. The
// empty marker is what makes "empty deltas are still recorded" visible in the golden file: a
// recorded no-op turn is a line ending in "-", and a fold that skipped no-ops would drop a whole
// line. Escaping is the RecordedSource house style extended with the two field separators:
//   \\  \t  \n  \r  \;  \=

function esc(s: string): string {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll("\t", "\\t")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll(";", "\\;")
    .replaceAll("=", "\\=");
}

function pairsToText(pairs: readonly (readonly [string, string])[]): string {
  if (pairs.length === 0) return "-";
  return `+${pairs.map(([k, v]) => `${esc(k)}=${esc(v)}`).join(";")}`;
}

/** A ℤ-weighted, string-keyed WSet in canonical order → the treaty field. */
export function wsetToText(set: WSet<string, bigint>): string {
  return pairsToText(set.map((e) => [e.key, e.weight.toString()] as const));
}

/** A relabelling interpretation → the treaty field, ORDINAL-sorted by raw key. */
export function interpretationToText(interp: ReadonlyMap<string, string>): string {
  const entries = [...interp.entries()].sort(([a], [b]) => ordinalCompareKeys(a, b));
  return pairsToText(entries.map(([k, v]) => [k, v] as const));
}

/** One recorded turn → its canonical treaty line (byte-identical across oracles). */
export function traceTurnToLine(turn: TraceTurn<readonly [string, string], string, bigint>): string {
  const [raw, label] = turn.feedback;
  return `wsettrace/turn/1\t${turn.sequence.toString()}\t${esc(raw)}:${esc(label)}\t${wsetToText(turn.delta)}`;
}

/** The post-fold state → its canonical treaty line. */
export function traceStateToLine(
  nextSequence: bigint,
  interpretation: ReadonlyMap<string, string>,
  emitted: WSet<string, bigint>,
): string {
  return `wsettrace/state/1\t${nextSequence.toString()}\t${interpretationToText(interpretation)}\t${wsetToText(emitted)}`;
}

// ─── The ℤ corner, and the worked relabelling loop the treaty locks ──────────────────────────

/** The ℤ '*'-ring over `bigint` — exact, so `w + (−w) = 0` is a real cancellation, never an epsilon. */
export const IntegerTraceRing: TraceRing<bigint> = {
  zero: 0n,
  one: 1n,
  add: (a, b) => a + b,
  mul: (a, b) => a * b,
  negate: (a) => -a,
};

/** The ops bundle for string keys over ℤ — ORDINAL collation, per culture-invariant-by-default. */
export const stringKeyIntegerOps: TraceOps<string, bigint> = {
  ring: IntegerTraceRing,
  isZero: (w) => w === 0n,
  keyToString: (k) => k,
  compareKeys: ordinalCompareKeys,
};

/** A relabelling interpretation: "what we now think observation x means". */
export type Relabel = ReadonlyMap<string, string>;

/**
 * The generator of the worked loop: re-read the WHOLE history under the current labels, one unit
 * of weight per observation. Unlabelled observations read as themselves.
 */
export const rereadRelabelled: Generator<readonly string[], Relabel, string, bigint> = (interp, history) =>
  history.map((x): WElement<string, bigint> => ({ key: interp.get(x) ?? x, weight: 1n }));

/** Upsert-by-key — idempotent by construction (discipline #6), which is what makes L2 hold. */
export function updateRelabel(interp: Relabel, [raw, label]: readonly [string, string]): Relabel {
  return new Map(interp).set(raw, label);
}
