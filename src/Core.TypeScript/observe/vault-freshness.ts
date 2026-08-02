// vault-freshness.ts — the page's freshness oracle (Iris §1.4, step 3 of the render discipline).
//
// THE PROPERTY THIS EXISTS FOR. The adapter emits timestamps, never precomputed adjectives, so
// that a stopped society degrades honestly: the browser's clock is the oracle, not a frozen file
// claiming liveness. That guarantee is only real if the PAGE computes freshness — and computes it
// at render, not at load. A tab opened at 09:00 that never recomputes still shows `live` at 17:00,
// and "a stopped society can never render live" is then false in the only place anyone observes
// it.
//
// Pure functions with `nowMs` INJECTED — no ambient clock. Same discipline as the adapter (#7 DST,
// #13 noninterference): the page can be replayed from a fixture, and a test can move time without
// mocking globals. The caller supplies Date.now(); this module never reaches for it.

/** The four shipped status values. `unobserved` is NOT one of them — see `Freshness`. */
export type Status = "live" | "cold" | "stale" | "heat";

/**
 * What a single timestamp tells us. `unobserved` is deliberately outside `Status`: "we have no
 * measurement" is a different claim from "we measured and it is cold", and collapsing them is
 * exactly the over-claim the withheld register exists to prevent.
 */
export type Freshness = Status | "unobserved";

/** Iris §1.4 thresholds. Named rather than inlined so the boundary is one edit, not a search. */
export const LIVE_WITHIN_MS = 30 * 60 * 1000;
export const STALE_WITHIN_MS = 2 * 60 * 60 * 1000;
/** Failures older than this stop counting as heat — recovery has to be observable. */
export const HEAT_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Freshness of one ISO timestamp against an injected now.
 *
 * `null` is `unobserved`, never `cold`. A dweller nothing has been heard from is not a dweller we
 * watched doing nothing — and the page renders those differently (hatched violet vs dim).
 * Unparseable input is also `unobserved`: garbage must not read as a measurement.
 */
export function freshness(iso: string | null | undefined, nowMs: number): Freshness {
  if (iso === null || iso === undefined || iso === "") return "unobserved";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unobserved";
  const age = nowMs - t;
  // A timestamp from the future is not "extra live" — it is a clock disagreement, and the honest
  // reading is the freshest we are willing to assert rather than an assumption about whose clock
  // is right. (Local time steers local rendering only; it never enters a shared fold.)
  if (age < LIVE_WITHIN_MS) return "live";
  if (age < STALE_WITHIN_MS) return "stale";
  return "cold";
}

/** Aliveness order, least to most. `heat` sits outside it — see `combine`. */
const ALIVENESS: readonly Status[] = ["cold", "stale", "live"];

/**
 * Combine two statuses by taking the LEAST alive.
 *
 * This is the monotonicity guarantee: a parent scope can never render fresher than the freshest
 * evidence beneath it. Verified against the shipped snapshot, where `status: "live"` sat above
 * dwellers whose newest `last_seen` was seven hours old — the page must not repeat that.
 *
 * `heat` is absorbing: it is not a point on the aliveness line but a claim that something is
 * actively failing, and a fresh frame must not wash it away.
 */
export function combine(a: Status, b: Status): Status {
  if (a === "heat" || b === "heat") return "heat";
  // Mutation note: `<=` -> `<` here is an EQUIVALENT mutant and survives the sweep. Equal
  // aliveness index means `a` and `b` are the same status, so both branches return the same
  // value and no test can distinguish them. Left un-"fixed" deliberately — writing a test to
  // move that number would be theatre, and the next sweep should not re-investigate it.
  return ALIVENESS.indexOf(a) <= ALIVENESS.indexOf(b) ? a : b;
}

/** Fold `combine` over many candidates. No candidates ⇒ `cold`: unknown never reads alive. */
export function worst(candidates: readonly Status[]): Status {
  if (candidates.length === 0) return "cold";
  return candidates.reduce(combine);
}

/** One observed event, reduced to what freshness needs: when, and whether it was a failure. */
export interface Evidence {
  readonly at: string;
  readonly kind: string;
}

/**
 * Is anything actively failing in `scope`?
 *
 * Recent failures surface immediately; old ones age out, so a society that recovers stops
 * rendering heat. Without the window, heat becomes a permanent scar and the signal dies.
 */
export function hasHeat(evidence: readonly Evidence[], nowMs: number): boolean {
  const since = nowMs - HEAT_WINDOW_MS;
  return evidence.some((e) => {
    const t = Date.parse(e.at);
    if (Number.isNaN(t) || t <= since) return false;
    const k = e.kind.toLowerCase();
    return k.includes("fail") || k.includes("error");
  });
}

/**
 * The status of a scope: heat overrides, otherwise the least-alive candidate.
 *
 * `unobserved` candidates are DROPPED rather than counted as cold — a scope with one live
 * timestamp and one absent one is live-but-incompletely-observed, and the page marks the absence
 * separately (withheld register) instead of dragging the whole scope down. If EVERY candidate is
 * unobserved, `worst([])` returns cold, which is the honest answer.
 */
export function statusOf(
  timestamps: readonly (string | null | undefined)[],
  evidence: readonly Evidence[],
  nowMs: number,
): Status {
  if (hasHeat(evidence, nowMs)) return "heat";
  const observed = timestamps
    .map((t) => freshness(t, nowMs))
    .filter((f): f is Status => f !== "unobserved");
  return worst(observed);
}

/**
 * The re-tick interval (Iris §1.6). Exported so the page and its tests agree on one number, and so
 * "did anyone wire the timer" is answerable by grep rather than by reading the whole page.
 */
export const RETICK_MS = 60 * 1000;
