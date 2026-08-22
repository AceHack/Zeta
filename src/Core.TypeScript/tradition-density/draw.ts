/**
 * draw.ts — the seeded, DST-replayable draw of traditions from an external corpus.
 *
 * The draw is the part that cannot be citation-shopped. A sequence is a pure function of
 * `(corpus, seed, iteration)`, so **anyone can regenerate the draw sheet before any connecting
 * happens** and check afterwards that the ledger contains exactly the codes the seed produced —
 * including the ones that produced nothing. Skipping an inconvenient draw is therefore visible as
 * a missing key, not invisible as an un-run experiment.
 *
 * ## Independent substreams, not one running counter
 *
 * Iteration `i` consumes its own substream `mix(seed + (i+1) * GOLDEN_RATIO)`, and rejection
 * attempts within an iteration walk that substream. This is stronger than a single running counter
 * in the one way that matters to an **append-only, indefinitely-iterated** game: extending a
 * campaign from 12 draws to 200 cannot renumber the first 12, and iteration 7 can be replayed
 * without replaying 0..6. Draws are **with replacement** — each iteration is an independent draw
 * from the whole corpus, which is what makes "the same target recurred across independent draws"
 * mean anything.
 *
 * ## Unbiased selection, no magic numbers
 *
 * `mix` yields a uniform 64-bit word; plain `word % n` is biased whenever `n` does not divide
 * `2^64`. This uses **Lemire-style rejection** (Lemire, *Fast Random Integer Generation in an
 * Interval*, ACM TOMACS 29(1), 2019, §3): reject words at or above the largest multiple of `n`
 * below `2^64`. The only constants are `2^64` (the generator's word width) and `n` (the corpus
 * cardinality) — both structural, neither tuned.
 *
 * SplitMix64 anchor: Steele, Lea & Flood, *Fast Splittable Pseudorandom Number Generators*
 * (OOPSLA 2014); finaliser constants per Vigna, arXiv:1410.0530 §3. Implementation reused from
 * `../splitmix64/splitmix64.ts`, which is byte-locked against the F#/C#/Rust oracles.
 */
import { GOLDEN_RATIO, mix } from "../splitmix64/splitmix64";
import { MSC2020_CORPUS, MSC2020_VERSION, type TraditionEntry } from "./msc2020-corpus";

/** Word width of the SplitMix64 stream. Structural, not tuned. */
const TWO_POW_64 = 1n << 64n;
const MASK64 = TWO_POW_64 - 1n;

/** A corpus the probe can draw from: an identity, a revision, and the entries themselves. */
export interface Corpus {
  readonly name: string;
  readonly version: string;
  readonly entries: readonly TraditionEntry[];
}

/** One drawn tradition, addressed by the seed and iteration that produced it. */
export interface Draw {
  readonly corpus: string;
  readonly corpusVersion: string;
  /** Decimal string: a u64 seed does not survive a JS `number`. */
  readonly seed: string;
  readonly iteration: number;
  readonly code: string;
  readonly title: string;
}

/** Guard on `iteration`: a non-integer or negative index has no substream. */
export class DrawError extends Error {}

/** The substream for one iteration — independent of every other iteration's. */
function substream(seed: bigint, iteration: number): bigint {
  return mix((seed + BigInt(iteration + 1) * GOLDEN_RATIO) & MASK64);
}

/** The `attempt`-th word of an iteration's substream (attempt 0 is the first). */
function wordAt(seed: bigint, iteration: number, attempt: number): bigint {
  return mix((substream(seed, iteration) + BigInt(attempt + 1) * GOLDEN_RATIO) & MASK64);
}

/**
 * Uniform index into `[0, n)` from iteration `i`'s substream, by rejection.
 *
 * Terminates with probability 1 and, since `n <= 63 << 2^64` for any realistic corpus, in one
 * attempt with overwhelming probability — but the loop is written to be correct rather than to
 * assume that, so a pathologically large corpus stays unbiased instead of silently truncating.
 */
export function uniformIndex(seed: bigint, iteration: number, n: number): number {
  // `iteration` is guarded HERE, not only in `drawAt`, because this function is exported and
  // therefore reachable without passing through it. Unguarded, a non-integer index reaches
  // `BigInt(iteration + 1)` as `BigInt(NaN)` and dies with a RangeError naming BigInt rather
  // than the caller's mistake -- and an `undefined` index yields the same NaN silently one
  // frame earlier. The type says `number`; the type is not present at runtime, and a JS
  // caller (or a `JSON.parse`d draw sheet) is exactly the caller this surface will meet.
  if (!Number.isInteger(iteration) || iteration < 0) {
    throw new DrawError(`iteration must be a non-negative integer, got ${String(iteration)}`);
  }
  if (!Number.isInteger(n) || n <= 0) throw new DrawError(`corpus cardinality must be a positive integer, got ${String(n)}`);
  const size = BigInt(n);
  // Largest multiple of `size` at or below 2^64; words at or above it would over-represent
  // the low indices under `% size`.
  const limit = TWO_POW_64 - (TWO_POW_64 % size);
  for (let attempt = 0; ; attempt++) {
    const w = wordAt(seed, iteration, attempt);
    if (w < limit) return Number(w % size);
  }
}

/** Draw the tradition at one iteration. Pure in `(corpus, seed, iteration)`. */
export function drawAt(corpus: Corpus, seed: bigint, iteration: number): Draw {
  if (!Number.isInteger(iteration) || iteration < 0) {
    throw new DrawError(`iteration must be a non-negative integer, got ${String(iteration)}`);
  }
  if (corpus.entries.length === 0) throw new DrawError(`corpus ${corpus.name} is empty`);
  const index = uniformIndex(seed, iteration, corpus.entries.length);
  const entry = corpus.entries[index];
  // Unreachable given the bound above; checked rather than asserted so a future change to
  // `uniformIndex` surfaces as a refusal instead of an `undefined` propagating into a ledger key.
  if (entry === undefined) throw new DrawError(`index ${String(index)} out of range for corpus ${corpus.name}`);
  return {
    corpus: corpus.name,
    corpusVersion: corpus.version,
    seed: seed.toString(),
    iteration,
    code: entry.code,
    title: entry.title,
  };
}

/** The draw sheet for iterations `[from, from + count)`. Regenerable by anyone holding the seed. */
export function drawSheet(corpus: Corpus, seed: bigint, count: number, from = 0): readonly Draw[] {
  if (!Number.isInteger(count) || count < 0) throw new DrawError(`count must be a non-negative integer, got ${String(count)}`);
  const out: Draw[] = [];
  for (let i = 0; i < count; i++) out.push(drawAt(corpus, seed, from + i));
  return out;
}

/** The MSC2020 top-level corpus as a `Corpus`. Built from the vendored list; nothing selected here. */
export function mscCorpus(entries: readonly TraditionEntry[]): Corpus {
  return { name: MSC2020_CORPUS, version: MSC2020_VERSION, entries };
}
