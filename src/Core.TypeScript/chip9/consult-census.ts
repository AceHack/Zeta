/**
 * **Does the CHIP-8 CONSULT path post-select?** (Aaron 2026-08-17; register row R-1.)
 *
 * `Chip8CrossRunStore` retains endings as first-class verdicts — a halted orbit is recorded *as* halted,
 * and budget exhaustion is `open-at-bound`, a distinct constructor that cannot be misread as closure. So
 * the **write** path cannot post-select; the artifact set is complete with respect to how orbits end.
 *
 * **Store completeness does not imply an unbiased sample.** If only *continuing* orbits are ever READ —
 * because those are the ones a room asks for, or the ones that pay off — the effective sample is
 * post-selected even though the stored set is not. A criterion of the form *"useful = the run continues"*
 * evaluated against a read-set already filtered for continuation measures its own filter, not the world.
 *
 * This module reports two empirical distributions over the same four verdict buckets — one over the
 * artifacts *stored*, one over the artifacts *read* — plus their total-variation distance. It attaches
 * **no threshold** and returns **no verdict**. "How different is too different" is a policy question with
 * no defensible constant, and inventing one here would be the same hidden-oracle defect one layer up.
 *
 * **Anchors (checked, not gestured at):**
 *   - `d_TV(p,q) = (1/2) * sum_i |p_i - q_i|` — Levin, Peres & Wilmer, *Markov Chains and Mixing Times*,
 *     2nd ed. (AMS 2017) §4.1. Parameter-free, which is exactly why it is the statistic used.
 *   - Berkson, *"Limitations of the application of fourfold table analysis to hospital data"*, Biometrics
 *     Bulletin **2**, 47–53 (1946) — selection/collider bias: conditioning on an outcome makes the
 *     conditioned history look designed, with no backward influence anywhere in the mechanism.
 *   - Carse, *Finite and Infinite Games* (1986) — the source of the "useful = the game continues"
 *     criterion this guards. Named because it is the claim at risk, not as evidence for it.
 *
 * F# parity: `src/Core/Chip8ConsultCensus.fs` (same buckets, same statistic, same refusals).
 */
import { keyText, type OrbitArtifact, type RunKey, type Verdict } from "./chip8-cross-run-store";

/** The four buckets, taken directly off `Verdict` — a census that merges buckets is blind to the skew it exists to see. */
export type Bucket = "halt" | "awaiting-input" | "cycle" | "open-at-bound";

/**
 * Every bucket, fixed order. Distributions are always reported over ALL FOUR: a bucket with count zero
 * is a measurement, not an absence, and dropping it would hide the skew.
 */
export const ALL_BUCKETS: readonly Bucket[] = ["halt", "awaiting-input", "cycle", "open-at-bound"] as const;

export function bucketOf(v: Verdict): Bucket {
  return v.kind === "open-at-bound" ? "open-at-bound" : v.terminal;
}

/**
 * The mechanical partition, named by the mechanism rather than by the value word.
 *
 * `halt` and `awaiting-input` are both `lambda = 1` — literal fixed points of the pure step map. `cycle`
 * (`lambda > 1`) and `open-at-bound` are not. Whether "fixed point" *means* "the game ended" is a caller's
 * oracle call this module refuses to make: an `FX0A` stall is revivable by an input the store deliberately
 * does not model, so calling it an ending would be a claim about a world outside the artifact.
 */
export function isFixedPoint(b: Bucket): boolean {
  return b === "halt" || b === "awaiting-input";
}

/** Integer counts per bucket, never pre-divided shares: the sample size stays visible beside every proportion. */
export type Tally = Readonly<Record<Bucket, number>>;

export const EMPTY_TALLY: Tally = { halt: 0, "awaiting-input": 0, cycle: 0, "open-at-bound": 0 };

export function tallyOf(buckets: readonly Bucket[]): Tally {
  const t: Record<Bucket, number> = { ...EMPTY_TALLY };
  for (const b of buckets) t[b] += 1;
  return t;
}

export function total(t: Tally): number {
  return ALL_BUCKETS.reduce((acc, b) => acc + t[b], 0);
}

/** `0` when the tally is empty — an empty read-set has no distribution, and is reported as such rather than as a uniform one. */
export function share(t: Tally, b: Bucket): number {
  const n = total(t);
  return n === 0 ? 0 : t[b] / n;
}

// ── the instrument ──────────────────────────────────────────────────────────────────────────────────

/**
 * A read-path event. Deliberately carries no timestamp: `local-time-never-enters-the-shared-fold` — the
 * census is a pure function of the event *set*, and no wall clock may weight it.
 */
export type ReadEvent = { readonly kind: "hit"; readonly verdict: Verdict } | { readonly kind: "miss" };

export interface Census {
  readonly stored: Tally;
  readonly read: Tally;
  /** Lookups that found nothing. Not a bucket — a miss has no verdict to be biased about. */
  readonly misses: number;
}

export function censusOf(stored: readonly OrbitArtifact[], events: readonly ReadEvent[]): Census {
  return {
    stored: tallyOf(stored.map((a) => bucketOf(a.verdict))),
    read: tallyOf(events.flatMap((e) => (e.kind === "hit" ? [bucketOf(e.verdict)] : []))),
    misses: events.filter((e) => e.kind === "miss").length,
  };
}

/**
 * Total variation distance between the read and stored distributions, in `[0, 1]`. **Zero parameters, so
 * nothing here is an unattributed gating constant.**
 *
 * `NaN` when either side is empty — *no distribution exists*, and returning `0` there would report "no
 * skew detected" for a measurement that never ran: a check that did not run wearing the face of one that
 * passed.
 */
export function totalVariation(c: Census): number {
  if (total(c.stored) === 0 || total(c.read) === 0) return Number.NaN;
  return 0.5 * ALL_BUCKETS.reduce((acc, b) => acc + Math.abs(share(c.read, b) - share(c.stored, b)), 0);
}

/**
 * Exact equality of the two empirical distributions, by integer cross-multiplication — no float tolerance,
 * therefore no invented epsilon. `false` when either side is empty: an absent read-set is not a match, it
 * is an absence.
 *
 * Deliberately strict. It answers *"are these the same distribution?"*, never *"are these close enough?"* —
 * the second question has no answer this module is entitled to give.
 */
export function sharesIdentical(c: Census): boolean {
  const ns = total(c.stored);
  const nr = total(c.read);
  if (ns === 0 || nr === 0) return false;
  return ALL_BUCKETS.every((b) => c.read[b] * ns === c.stored[b] * nr);
}

/**
 * Signed per-bucket share deltas, `read - stored`. The whole result, not a summary: positive deltas on
 * `cycle`/`open-at-bound` against negative deltas on `halt`/`awaiting-input` is the post-selection
 * signature, and a reader should see the pattern rather than be handed a conclusion about it.
 */
export function shareDeltas(c: Census): ReadonlyArray<readonly [Bucket, number]> {
  return ALL_BUCKETS.map((b) => [b, share(c.read, b) - share(c.stored, b)] as const);
}

/**
 * Share of NON-fixed-point (`cycle` + `open-at-bound`) orbits on each side — the pair Aaron's criterion is
 * stated over. Derived from the four buckets and never replacing them: the two-bucket view is the
 * coarsening that can hide a skew *within* a group.
 */
export function nonFixedPointShares(c: Census): { readonly stored: number; readonly read: number } {
  const f = (t: Tally): number => {
    const n = total(t);
    return n === 0 ? 0 : (t.cycle + t["open-at-bound"]) / n;
  };
  return { stored: f(c.stored), read: f(c.read) };
}

/**
 * Fixed-width, culture-invariant report lines. Text, so it is diffable and pasteable without a rendering step.
 *
 * When the read side is EMPTY, the read share and the delta print as `n/a`, never as `0.000` / `-0.400`.
 * `share` returns `0` on an empty tally because a proportion of nothing is not a number — and rendering that
 * `0` as a share would make an *absence* look like a measured skew away from endings. Same refusal as
 * `totalVariation` returning `NaN`, applied to the column a human actually reads.
 */
export function report(c: Census): readonly string[] {
  const pct = (x: number): string => x.toFixed(3);
  const noRead = total(c.read) === 0;
  const cell = (x: number): string => (noRead ? "  n/a" : pct(x));
  const rows = ALL_BUCKETS.map(
    (b) =>
      `${b.padEnd(14, " ")} | stored ${String(c.stored[b]).padStart(4, " ")} (${pct(share(c.stored, b))})` +
      ` | read ${String(c.read[b]).padStart(4, " ")} (${cell(share(c.read, b))})` +
      ` | delta ${cell(share(c.read, b) - share(c.stored, b))}`,
  );
  const tv = totalVariation(c);
  return [
    ...rows,
    `stored total = ${total(c.stored)} | read total = ${total(c.read)} | misses = ${c.misses}`,
    `total variation = ${Number.isNaN(tv) ? "n/a (one side empty)" : pct(tv)}`,
    `shares identical = ${sharesIdentical(c) ? "yes" : "no"}`,
  ];
}

// ── the consult log: the shape the read side must emit when it is enabled ───────────────────────────

/**
 * One line per consult, JSONL. The line carries **only the run key text** — never the verdict — so the log
 * cannot drift from, or lie about, what the store actually holds. The verdict is resolved by joining
 * against the stored artifacts, which makes the census a pure join and keeps the honest failure mode
 * (a key nobody stored) visible as a miss rather than as a fabricated bucket.
 *
 * No timestamp, by construction: `local-time-never-enters-the-shared-fold`.
 */
export interface ConsultLogLine {
  readonly key: string;
}

/** `{ key }` per line; blank lines ignored; a malformed line is REFUSED, never skipped. */
export function parseConsultLog(text: string): { ok: true; value: ConsultLogLine[] } | { ok: false; detail: string } {
  const out: ConsultLogLine[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (line.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { ok: false, detail: `line ${i + 1}: not JSON` };
    }
    if (typeof parsed !== "object" || parsed === null || typeof (parsed as { key?: unknown }).key !== "string") {
      return { ok: false, detail: `line ${i + 1}: missing string field "key"` };
    }
    out.push({ key: (parsed as { key: string }).key });
  }
  return { ok: true, value: out };
}

/** Resolve logged keys against the stored artifacts. A key nobody stored is a MISS, never a guess. */
export function eventsFromLog(stored: readonly OrbitArtifact[], log: readonly ConsultLogLine[]): ReadEvent[] {
  const index = new Map<string, Verdict>();
  for (const a of stored) index.set(keyText(a.key), a.verdict);
  return log.map((l) => {
    const v = index.get(l.key);
    return v === undefined ? ({ kind: "miss" } as const) : ({ kind: "hit", verdict: v } as const);
  });
}

/** The key text a consult path must log. Exported so the writer and the census cannot disagree on it. */
export function consultLogKey(k: RunKey): string {
  return keyText(k);
}
