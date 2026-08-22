/**
 * drift-rate.ts — is the society's CI getting BETTER or WORSE over time?
 *
 * ## What this is, and what it is deliberately not
 *
 * There are two honest questions about CI health and they need two instruments:
 *
 * | question | instrument | shape |
 * |---|---|---|
 * | *"what is true right now, and what have I failed to observe?"* | `src/Core.TypeScript/drift-dashboard/` | **state** — last verdict per check, coverage-as-output |
 * | *"is it getting better or worse?"* | **this module** | **rate** — sliding windows over recorded outcomes |
 *
 * They are complementary, not duplicates, and the reason is structural: the dashboard
 * reads the forge host's *current* answer per check and can therefore say
 * `never-observed` about a check that has produced nothing ever; it cannot say whether
 * last week was worse, because a per-check "latest verdict" has no history in it. This
 * module folds an append-only log and therefore has history; it cannot say
 * `registered-but-absent`, because a log only ever contains what someone recorded.
 *
 * **So they must share a check identity vocabulary or they will tell two disagreeing
 * health stories about the same repository** — which is worse than having one. They do:
 * this module keys on `CheckId` from `../forge-host/types.ts` (the dashboard's own hub
 * type — the workflow file's basename without extension) and takes the dashboard's
 * persisted roster as its **denominator**. A check named in one is the same check in
 * the other, mechanically, because it is the same type minted by the same rule.
 *
 * ## The three failures this module is built against — all three measured, not imagined
 *
 * Measured 2026-08-22 against the previous implementation of this file (probe output
 * reproduced in `drift-rate.test.ts`):
 *
 * **1. Cancelled laundering a dark lane into green.** The old `greenRatio` was
 * `green / (green + red)`, i.e. cancelled runs were *dropped from the denominator*. A
 * lane with 33 cancelled runs and 2 stale successes reported `greenRatio: 1` — **100%
 * green for a lane that has not concluded anything in weeks.** `tlaps-proof` is the
 * live shape (33 cancelled + 7 failure in its last 40 runs, last success 2026-07-01,
 * seven weeks dark). Here `cancelled` is its own state, it stays in the denominator,
 * and it can never move the green ratio up.
 *
 * **2. A trend called on a handful of runs.** The old code reported `"7d: 100% green
 * (1/1)"` off a single sample and `trend: stable` off two. That is numerology in
 * telemetry clothing: a count of 1 is consistent with every hypothesis. Here every rate
 * carries its own interval (Wilson) and **`insufficient-data` is the default verdict** —
 * a trend is only ever named when the two halves' intervals are disjoint.
 *
 * **3. A lane that stops reporting vanishes from the denominator.** The old windows
 * filtered the log by time, so a lane that went silent ten days ago simply left the
 * 24h/7d windows and the headline improved to 100%. Silence read as health. Here the
 * roster is the denominator: a rostered check with zero samples in the window is
 * present with `status: "no-data"`, and one that used to report and stopped is
 * `"went-silent"`. Absence is a row, never a gap.
 *
 * ## The SDV framing (retained from the original)
 *
 * This is the SDV model (Static Driver Verifier): you earn the right to be a gate by
 * driving your false-alarm rate below a threshold. Until then you are a measurement,
 * not a blocker.
 *
 * ## Forge-agnostic by construction
 *
 * Reads `data/ci-runs.jsonl`, an append-only log of outcomes. Any forge host — GitHub,
 * GitLab, Codeberg, or sovereign-mode author/verifier attestations — can produce this
 * file. Nothing here imports an adapter; the only import is the host-agnostic type
 * vocabulary, which is the plugin contract's whole purpose.
 *
 * ## File format: `data/ci-runs.jsonl`, one JSON object per line
 *
 *   { "checkId": "gate", "outcome": "green", "at": "2026-08-22T20:00:00.000Z",
 *     "lane": "otto", "runId": "123" }
 *
 * `lane` is a **satellite**: a substrate-specific sub-identity (which agent's tick
 * produced it) carried for humans and never folded on as a key. `checkId` is the
 * **hub**. That split is DV2.0 (`.claude/rules/dv2-data-split-discipline-activated.md`)
 * and it is what lets three agents record against one workflow without minting three
 * checks the roster has never heard of.
 *
 * Legacy shape (`workflow` + `conclusion: success|failure|cancelled`) still parses —
 * see `normalizeRun`. Nothing is silently reinterpreted: a legacy `workflow` value that
 * is not a rostered `checkId` shows up as `unrostered`, loudly, rather than being
 * guessed at.
 *
 * ## Anchors (Beacon)
 *
 * - **Wilson, E. B. (1927), "Probable Inference, the Law of Succession, and Statistical
 *   Inference", *JASA* 22(158):209–212** — the score interval used for every rate here.
 *   Checked, not merely cited: the entailment is direct. Wilson's interval is defined
 *   for a binomial proportion and is specifically the one that stays inside [0,1] and
 *   stays sane at small `n` and at `p̂ ∈ {0,1}`, where the normal-approximation
 *   (Wald) interval degenerates to zero width and would report a *certain* 100% off a
 *   single green run. That degeneracy is exactly failure (2) above, so the anchor is
 *   load-bearing rather than decorative. (Brown, Cai & DasGupta 2001, "Interval
 *   Estimation for a Binomial Proportion", *Statistical Science* 16(2):101–133, is the
 *   modern comparison that recommends Wilson over Wald for precisely this reason.)
 * - **Ball, T. & Rajamani, S. K. (2002), SLAM/SDV** — the earn-your-gate framing above.
 *
 * ## Register
 *
 * `unmetered → metered` for the properties the test file falsifies (cancelled never
 * green; insufficient-data is the default; a silent lane keeps its slot). The
 * *thresholds* (`MIN_SAMPLES_FOR_TREND`, `DARK_AFTER_MS`) remain **toy**: they are
 * chosen, not derived, and nothing yet measures whether they are the right ones.
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`.
 */

import { readFileSync } from "node:fs";

import type { CheckId } from "../forge-host/types.ts";

// ═══ Vocabulary ═══════════════════════════════════════════════════════════════

/**
 * What a recorded run concluded.
 *
 * Deliberately NOT `VerdictKind` from the dashboard, and the difference is real: a
 * dashboard verdict is *"what do we believe about this check now"* and admits
 * `unknown`/`not-yet-due`, which are statements about **observation**. A log entry is
 * *"this run finished this way"*, a statement about an **event**. Widening this union
 * to the dashboard's would invite recording an unknown as if it were an outcome.
 *
 * `cancelled` is first-class and can never aggregate into green — the same discipline
 * the dashboard states for `unknown`, applied to the outcome axis.
 */
export type Outcome = "green" | "red" | "cancelled";

/** Forge-native conclusion strings this module knows how to normalize. */
const OUTCOME_ALIASES: ReadonlyMap<string, Outcome> = new Map([
  ["green", "green"], ["success", "green"], ["succeeded", "green"],
  ["red", "red"], ["failure", "red"], ["failed", "red"], ["timed_out", "red"],
  ["cancelled", "cancelled"], ["canceled", "cancelled"], ["skipped", "cancelled"],
]);

export interface CIRun {
  /** Stable check identity — the same `CheckId` the drift-dashboard roster uses. */
  readonly checkId: CheckId;
  readonly outcome: Outcome;
  /** ISO-8601. When the run CONCLUDED, per its producer — never when we looked. */
  readonly at: string;
  /** Satellite: sub-identity within the check (e.g. which agent's tick). Never a key. */
  readonly lane?: string;
  /** Satellite: substrate-specific run identity. Never folded on. */
  readonly runId?: string;
}

/** A rate with its uncertainty. A point estimate is never returned without one. */
export interface RateEstimate {
  /** Sample size the estimate is computed over. `0` ⇒ `point` is meaningless. */
  readonly n: number;
  /** Successes in `n`. */
  readonly k: number;
  /** Point estimate `k/n`, or `null` when `n === 0`. **`null`, never `0`.** */
  readonly point: number | null;
  /** Wilson score interval, 95%. `[0,1]` when `n === 0` — total ignorance, stated. */
  readonly lo: number;
  readonly hi: number;
}

export type TrendVerdict = "improving" | "stable" | "worsening" | "insufficient-data";

export type CheckStatus =
  /** Rostered and sampled in this window. */
  | "reporting"
  /** Rostered, sampled at some point in the log, but NOT in this window. */
  | "went-silent"
  /** Rostered and never sampled at all. Different fact from `went-silent`. */
  | "no-data"
  /**
   * Sampled but NOT in the roster. Either a new check the dashboard has not seen, or a
   * `checkId` minted by a rule the dashboard does not share — which is the vocabulary
   * drift this module exists to make impossible. Loud on purpose.
   */
  | "unrostered";

export interface DriftWindow {
  /** Window label (e.g. `"24h"`, `"7d"`). */
  readonly label: string;
  readonly windowMs: number;
  /** Every run in the window, all outcomes. */
  readonly total: number;
  readonly green: number;
  readonly red: number;
  /** Its own state. Counted in `total`. Never counted toward green. */
  readonly cancelled: number;
  /**
   * Green over **all** runs including cancelled — `k=green, n=total`.
   *
   * This is the headline rate, and cancelled is in the denominator on purpose: that is
   * the single line that makes failure (1) above unrepresentable. `point` is `null`
   * when nothing was sampled, so "no data" cannot render as "0%".
   */
  readonly green_of_all: RateEstimate;
  /**
   * Green over runs that actually CONCLUDED — `k=green, n=green+red`.
   *
   * Reported beside `green_of_all` rather than instead of it, because the two together
   * are what separate *"this lane is failing"* from *"this lane is not running"*, and
   * `gate` — cancelled by its own concurrency group on ~88% of pushes and perfectly
   * alive — is why neither number alone is honest.
   */
  readonly green_of_concluded: RateEstimate;
  /** Cancelled share of `total`. High + healthy is normal; high + dark is not. */
  readonly cancelled_rate: RateEstimate;
}

export interface CheckDrift {
  readonly checkId: CheckId;
  readonly status: CheckStatus;
  /** Runs in the reporting window. `0` for `no-data` / `went-silent`. */
  readonly samples: number;
  readonly green: number;
  readonly red: number;
  readonly cancelled: number;
  readonly green_of_all: RateEstimate;
  readonly green_of_concluded: RateEstimate;
  /** ISO-8601 of the newest run of ANY outcome, over the whole log. `null` ⇒ never. */
  readonly lastRunAt: string | null;
  /** ISO-8601 of the newest run that CONCLUDED (green or red). `null` ⇒ never. */
  readonly lastConcludedAt: string | null;
  /**
   * Milliseconds since this check last concluded anything. `null` ⇒ never concluded.
   *
   * **Time, not count, is the darkness discriminator** — the same call the dashboard
   * makes (`fold.ts` `verdictForDarkLane`). A lane cancelled 88% of the time but
   * concluding hourly is churning, not dark; a lane cancelled 82% of the time that last
   * concluded seven weeks ago is a gate that is switched off.
   */
  readonly sinceConcludedMs: number | null;
  /** `sinceConcludedMs > DARK_AFTER_MS`, or never concluded while runs exist. */
  readonly dark: boolean;
  readonly trend: TrendVerdict;
}

export interface DriftSnapshot {
  readonly computedAt: string;
  readonly overall: readonly DriftWindow[];
  /** Every rostered check plus every unrostered one seen. Sorted worst-first. */
  readonly byCheck: readonly CheckDrift[];
  readonly trending: TrendVerdict;
  /**
   * Why the trend is `insufficient-data`, when it is. `null` when a trend was named.
   * A refusal that does not say why is indistinguishable from a bug.
   */
  readonly insufficientReason: string | null;
  /** Rostered checks with no sample in the reporting window — the coverage shortfall. */
  readonly silent: readonly CheckId[];
  /** Checks seen in the log that the roster has never heard of. */
  readonly unrostered: readonly CheckId[];
  /** Checks that have not concluded anything for longer than `DARK_AFTER_MS`. */
  readonly darkChecks: readonly CheckId[];
  readonly summary: string;
}

// ═══ Thresholds (TOY — chosen, not derived) ═══════════════════════════════════

/**
 * Minimum concluded runs in EACH half before a trend may be named at all.
 *
 * Toy. At one heartbeat per 15 minutes a lane produces ~96 samples/day, so 8 is a
 * couple of hours — long enough that a trend is not one bad tick, short enough to be
 * reached the same day. Nothing has measured whether 8 is right; when something does,
 * this constant sheds `toy` and says what measured it.
 */
export const MIN_SAMPLES_FOR_TREND = 8;

/** A check that has not concluded anything in this long is dark. Toy: 72h. */
export const DARK_AFTER_MS = 72 * 60 * 60 * 1000;

/** z for a 95% two-sided normal interval. Standard, not chosen. */
const Z_95 = 1.959963984540054;

// ═══ Rates ════════════════════════════════════════════════════════════════════

/**
 * Wilson score interval for a binomial proportion (Wilson 1927).
 *
 * Chosen over the Wald interval specifically because Wald degenerates to zero width at
 * `p̂ ∈ {0,1}` — it would report 100% ± 0 off a single green run, which is failure (2)
 * this module exists to prevent. `n === 0` returns the honest `[0,1]` with a `null`
 * point: total ignorance, said out loud rather than encoded as `0`.
 */
export function wilson(k: number, n: number, z: number = Z_95): RateEstimate {
  if (n <= 0) return { n: 0, k: 0, point: null, lo: 0, hi: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    n, k, point: p,
    lo: Math.max(0, centre - half),
    hi: Math.min(1, centre + half),
  };
}

/**
 * Name a trend only when it is earned. **`insufficient-data` is the default** and every
 * early return below is a refusal, not a fallback.
 *
 * Earned means BOTH: each half carries at least `MIN_SAMPLES_FOR_TREND` samples, AND
 * the two Wilson intervals are disjoint. Overlapping intervals mean the data is
 * consistent with no change, and reporting "improving" there is asserting a difference
 * the sample cannot support — the numerology failure, in telemetry clothing.
 * `.claude/rules/numerology-vs-number-theory.md`.
 */
export function trendFrom(earlier: RateEstimate, later: RateEstimate): TrendVerdict {
  if (earlier.n < MIN_SAMPLES_FOR_TREND || later.n < MIN_SAMPLES_FOR_TREND) return "insufficient-data";
  if (later.lo > earlier.hi) return "improving";
  if (later.hi < earlier.lo) return "worsening";
  return "stable";
}

// ═══ Loading ══════════════════════════════════════════════════════════════════

/**
 * Normalize one parsed line into a `CIRun`, or `null` if it is not one.
 *
 * Accepts the legacy `{workflow, conclusion}` shape as well as `{checkId, outcome}`.
 * An unrecognised conclusion string is **dropped, not guessed** — inventing an outcome
 * for a string we do not understand is how a log starts lying.
 */
export function normalizeRun(raw: unknown): CIRun | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const checkId = typeof r["checkId"] === "string" ? r["checkId"]
    : typeof r["workflow"] === "string" ? r["workflow"] : null;
  const rawOutcome = typeof r["outcome"] === "string" ? r["outcome"]
    : typeof r["conclusion"] === "string" ? r["conclusion"] : null;
  const at = typeof r["at"] === "string" ? r["at"] : null;
  if (checkId === null || rawOutcome === null || at === null) return null;
  if (checkId.length === 0) return null;
  if (Number.isNaN(Date.parse(at))) return null;
  const outcome = OUTCOME_ALIASES.get(rawOutcome.toLowerCase());
  if (outcome === undefined) return null;
  return {
    checkId,
    outcome,
    at,
    ...(typeof r["lane"] === "string" ? { lane: r["lane"] } : {}),
    ...(typeof r["runId"] === "string" ? { runId: r["runId"] } : {}),
  };
}

/** Parse the JSONL log. A missing file is an empty log, which is a legitimate state. */
export function loadCIRuns(path: string): CIRun[] {
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const out: CIRun[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.length === 0) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(t); } catch { continue; }
    const run = normalizeRun(parsed);
    if (run !== null) out.push(run);
  }
  return out;
}

/**
 * Read the check ids the drift-dashboard roster declares — the shared denominator.
 *
 * Deliberately tolerant: a missing or unreadable roster yields `[]`, which degrades
 * this module to "report what I saw" and marks everything `unrostered`. It never
 * throws, because a telemetry reporter that dies on a missing sibling artifact is the
 * `|| true` problem wearing a stack trace. The `unrostered` label is what makes the
 * degradation visible rather than silent.
 */
export function loadRosterCheckIds(path: string): CheckId[] {
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch { return []; }
  try {
    const parsed = JSON.parse(text) as { checks?: readonly { checkId?: unknown; retired?: unknown }[] };
    const checks = parsed.checks ?? [];
    return checks
      .filter((c) => typeof c.checkId === "string" && c.retired !== true)
      .map((c) => c.checkId as CheckId);
  } catch { return []; }
}

// ═══ Computation ══════════════════════════════════════════════════════════════

function tally(runs: readonly CIRun[]): { green: number; red: number; cancelled: number } {
  let green = 0, red = 0, cancelled = 0;
  for (const r of runs) {
    if (r.outcome === "green") green++;
    else if (r.outcome === "red") red++;
    else cancelled++;
  }
  return { green, red, cancelled };
}

function inWindow(runs: readonly CIRun[], windowMs: number, nowMs: number): CIRun[] {
  const cutoff = nowMs - windowMs;
  return runs.filter((r) => Date.parse(r.at) > cutoff);
}

export function computeWindow(
  runs: readonly CIRun[], label: string, windowMs: number, nowMs: number,
): DriftWindow {
  const w = inWindow(runs, windowMs, nowMs);
  const { green, red, cancelled } = tally(w);
  const total = w.length;
  return {
    label, windowMs, total, green, red, cancelled,
    green_of_all: wilson(green, total),
    green_of_concluded: wilson(green, green + red),
    cancelled_rate: wilson(cancelled, total),
  };
}

/**
 * Per-check drift over `reportWindowMs`, with the roster as the denominator.
 *
 * The roster half is the whole point: `byCheck` is built by iterating the UNION of
 * (rostered ids, ids seen in the log), never just the ids seen. That is what stops a
 * lane that went silent from improving the numbers by leaving.
 */
export function computeCheckDrift(
  runs: readonly CIRun[],
  roster: readonly CheckId[],
  nowMs: number,
  reportWindowMs: number,
): CheckDrift[] {
  const byCheck = new Map<CheckId, CIRun[]>();
  for (const r of runs) {
    const list = byCheck.get(r.checkId);
    if (list === undefined) byCheck.set(r.checkId, [r]); else list.push(r);
  }

  const rosterSet = new Set<CheckId>(roster);
  const universe = new Set<CheckId>([...rosterSet, ...byCheck.keys()]);

  const half = reportWindowMs / 2;
  const result: CheckDrift[] = [];

  for (const checkId of universe) {
    const all = byCheck.get(checkId) ?? [];
    const windowed = inWindow(all, reportWindowMs, nowMs);
    const { green, red, cancelled } = tally(windowed);

    const times = all.map((r) => Date.parse(r.at));
    const concludedTimes = all.filter((r) => r.outcome !== "cancelled").map((r) => Date.parse(r.at));
    const lastRunMs = times.length > 0 ? Math.max(...times) : null;
    const lastConcludedMs = concludedTimes.length > 0 ? Math.max(...concludedTimes) : null;
    const sinceConcludedMs = lastConcludedMs === null ? null : nowMs - lastConcludedMs;

    const rostered = rosterSet.has(checkId);
    const status: CheckStatus = !rostered ? "unrostered"
      : windowed.length > 0 ? "reporting"
      : all.length > 0 ? "went-silent"
      : "no-data";

    // Dark = has run at all, and has not CONCLUDED anything recently enough.
    // Never-concluded-while-runs-exist is the worst case of the same fact.
    const dark = all.length > 0 && (sinceConcludedMs === null || sinceConcludedMs > DARK_AFTER_MS);

    // Trend within the reporting window: first half vs second half, concluded only.
    const mid = nowMs - half;
    const earlier = windowed.filter((r) => Date.parse(r.at) <= mid && r.outcome !== "cancelled");
    const later = windowed.filter((r) => Date.parse(r.at) > mid && r.outcome !== "cancelled");
    const trend = trendFrom(
      wilson(earlier.filter((r) => r.outcome === "green").length, earlier.length),
      wilson(later.filter((r) => r.outcome === "green").length, later.length),
    );

    result.push({
      checkId, status,
      samples: windowed.length, green, red, cancelled,
      green_of_all: wilson(green, windowed.length),
      green_of_concluded: wilson(green, green + red),
      lastRunAt: lastRunMs === null ? null : new Date(lastRunMs).toISOString(),
      lastConcludedAt: lastConcludedMs === null ? null : new Date(lastConcludedMs).toISOString(),
      sinceConcludedMs,
      dark,
      trend,
    });
  }

  result.sort(compareChecks);
  return result;
}

/**
 * Worst-first ordering, and the band order is the claim: **a check we know nothing
 * about outranks a check we know is failing.** An unmeasured lane is an unbounded
 * number of unknown failures; a red lane is a known, bounded one.
 *
 * Ties break on `checkId` ordinally
 * (`.claude/rules/culture-invariant-by-default.md`) so the order is the data and never
 * the platform's collation.
 */
export function compareChecks(a: CheckDrift, b: CheckDrift): number {
  const band = (c: CheckDrift): number =>
    c.dark ? 0
    : c.status === "no-data" ? 1
    : c.status === "went-silent" ? 2
    : c.status === "unrostered" ? 3
    : 4;
  const ba = band(a), bb = band(b);
  if (ba !== bb) return ba - bb;
  // Within a band, lower green_of_all first; a null point sorts before any number.
  const pa = a.green_of_all.point, pb = b.green_of_all.point;
  if (pa === null && pb !== null) return -1;
  if (pb === null && pa !== null) return 1;
  if (pa !== null && pb !== null && pa !== pb) return pa - pb;
  return a.checkId < b.checkId ? -1 : a.checkId > b.checkId ? 1 : 0;
}

/** Percentage with its interval, or an explicit refusal when there is no sample. */
export function formatRate(r: RateEstimate): string {
  if (r.point === null) return "no data";
  const pct = (x: number): string => (x * 100).toFixed(0);
  return `${pct(r.point)}% [${pct(r.lo)}–${pct(r.hi)}] n=${r.n}`;
}

export interface DriftOptions {
  readonly nowMs?: number;
  /** Rostered check ids — the denominator. Empty ⇒ everything reads `unrostered`. */
  readonly roster?: readonly CheckId[];
  /** Window the per-check report and the headline trend are computed over. Default 7d. */
  readonly reportWindowMs?: number;
}

export function computeDrift(runs: readonly CIRun[], options: DriftOptions = {}): DriftSnapshot {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const now = options.nowMs ?? Date.now();
  const roster = options.roster ?? [];
  const reportWindowMs = options.reportWindowMs ?? 7 * DAY;

  const overall = [
    computeWindow(runs, "1h", HOUR, now),
    computeWindow(runs, "24h", DAY, now),
    computeWindow(runs, "7d", 7 * DAY, now),
  ];

  const byCheck = computeCheckDrift(runs, roster, now, reportWindowMs);

  // Headline trend: first half of the reporting window vs second, concluded runs only,
  // across every check. Insufficient-data unless BOTH halves earn it.
  const windowed = inWindow(runs, reportWindowMs, now);
  const mid = now - reportWindowMs / 2;
  const earlierRuns = windowed.filter((r) => Date.parse(r.at) <= mid && r.outcome !== "cancelled");
  const laterRuns = windowed.filter((r) => Date.parse(r.at) > mid && r.outcome !== "cancelled");
  const earlier = wilson(earlierRuns.filter((r) => r.outcome === "green").length, earlierRuns.length);
  const later = wilson(laterRuns.filter((r) => r.outcome === "green").length, laterRuns.length);
  const trending = trendFrom(earlier, later);

  const insufficientReason = trending !== "insufficient-data" ? null
    : runs.length === 0
      ? "no runs recorded — data/ci-runs.jsonl empty or missing"
      : `need >= ${MIN_SAMPLES_FOR_TREND} concluded runs in each half of the window; have ${earlier.n} earlier / ${later.n} later`;

  const silent = byCheck.filter((c) => c.status === "went-silent" || c.status === "no-data").map((c) => c.checkId);
  const unrostered = byCheck.filter((c) => c.status === "unrostered").map((c) => c.checkId);
  const darkChecks = byCheck.filter((c) => c.dark).map((c) => c.checkId);

  const week = overall.find((w) => w.label === "7d")!;
  const day = overall.find((w) => w.label === "24h")!;

  const summary = trending === "insufficient-data"
    ? `INSUFFICIENT DATA — no trend. ${insufficientReason ?? ""}. 7d green ${formatRate(week.green_of_all)}, 24h green ${formatRate(day.green_of_all)}`
    : `7d green ${formatRate(week.green_of_all)} (cancelled ${week.cancelled}/${week.total}), 24h green ${formatRate(day.green_of_all)}, trend: ${trending}`;

  const flags: string[] = [];
  if (darkChecks.length > 0) flags.push(`dark: ${darkChecks.length}`);
  if (silent.length > 0) flags.push(`silent: ${silent.length}`);
  if (unrostered.length > 0) flags.push(`unrostered: ${unrostered.length}`);

  return {
    computedAt: new Date(now).toISOString(),
    overall,
    byCheck,
    trending,
    insufficientReason,
    silent,
    unrostered,
    darkChecks,
    summary: flags.length > 0 ? `${summary} | ${flags.join(", ")}` : summary,
  };
}

/** One-line form for CI logs. */
export function formatDrift(snapshot: DriftSnapshot): string {
  return `[drift-rate] ${snapshot.summary}`;
}
