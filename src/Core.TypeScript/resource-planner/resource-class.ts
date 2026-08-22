/**
 * resource-class.ts — the four resource classes a cross-repo planner can plan over,
 * as a closed discriminated union, each carrying its own conservation law and its
 * own measured verdict.
 *
 * Design doc:
 *   docs/research/2026-08-18-cross-repo-resource-planner-what-is-actually-scarce.md
 *
 * ══ Why the taxonomy is the design ════════════════════════════════════════════
 *
 * The request was "plan based on resource usage, across repos and tick sources".
 * The first question is which resource, and it is not a detail: **the four classes
 * below obey different conservation laws, so a planner that treats them alike
 * misallocates by construction.** You cannot bank a concurrency slot for tomorrow;
 * you cannot race a runner-minute; a mutex is not depleted by being held.
 *
 * Concretely, the failure this taxonomy prevents was live in this repo on
 * 2026-08-18: the obvious build is a runner-minute allocator, and runner minutes
 * are **free and unmetered here** (the repo is public — `billable_ubuntu_ms` has
 * been `0` in every `docs/budget-history/snapshots.jsonl` row since 2026-04-21).
 * A minute-allocator would have rationed an abundant resource while the binding
 * constraint — `window` below — went untouched.
 *
 * ══ The register ══════════════════════════════════════════════════════════════
 *
 * Every class carries a `MeasuredVerdict`, and `unmeasured` is a first-class,
 * honest state rather than an absence. A class may not be called `binding`
 * without naming the evidence; `resource-class.test.ts` checks that, so the
 * evidence field cannot decay into decoration.
 * (`.claude/rules/toy-is-free-metered-must-be-earned.md`.)
 */

// ══ The closed set ═════════════════════════════════════════════════════════════

/**
 * The four resource classes. CLOSED: adding a member is a compile error at every
 * exhaustive site, which is what makes it safe for more than one consumer to
 * close over.
 *
 * The discriminator between them is **what happens to the resource when it is
 * used** — that, and not the units, is what fixes the conservation law.
 */
export type ResourceClass =
  /** Bankable. Depletes as it is spent, refills on a billing cycle. Runner
   *  minutes, cache bytes, API call quota, LLM tokens. */
  | "stock"
  /** Renewable capacity. Occupied, then released; cannot be saved for later.
   *  Concurrent runner slots, open connections, in-flight requests. */
  | "flow"
  /** Exclusive access. One holder at a time; holding it does not consume it.
   *  A repo-wide `concurrency:` singleton guarding a writer. */
  | "mutex"
  /** A raced interval. Not conserved at all — won or lost, never banked or
   *  queued. An uninterrupted stretch long enough for a preemptible job to
   *  reach a conclusion. */
  | "window";

/** The registry. `satisfies` pins each entry to a real variant. */
export const RESOURCE_CLASSES = [
  "stock",
  "flow",
  "mutex",
  "window",
] as const satisfies readonly ResourceClass[];

/** Compile-time proof that RESOURCE_CLASSES covers ResourceClass. Never evaluated. */
type _Missing = Exclude<ResourceClass, (typeof RESOURCE_CLASSES)[number]>;
export type _NoneMissing = _Missing extends never
  ? true
  : ["RESOURCE_CLASSES is missing", _Missing];
/** Exported so the proof is consumed rather than discarded by an operator. */
export const RESOURCE_CLASSES_COMPLETE: _NoneMissing = true;

/** Exhaustiveness helper for `switch` over ResourceClass. */
export function assertNever(x: never, context: string): never {
  throw new Error(`${context}: unhandled variant ${JSON.stringify(x)}`);
}

// ══ Verdicts ══════════════════════════════════════════════════════════════════

/**
 * Whether a class is actually the binding constraint HERE — a claim about this
 * repo at a date, never a property of the class itself.
 *
 * `unmeasured` is not a placeholder. It is the honest default, and a planner that
 * silently promotes it to `not-binding` has manufactured a certainty it does not
 * have. (`.claude/rules/toy-is-free-metered-must-be-earned.md`: unlabelled work
 * is `unmetered`, never "real" by default.)
 */
export type MeasuredVerdict =
  /** Measured, and it is not what limits us. `evidence` names the measurement. */
  | { readonly kind: "not-binding"; readonly evidence: string }
  /** Measured, and it IS what limits us. `evidence` names the measurement. */
  | { readonly kind: "binding"; readonly evidence: string }
  /** Not measured. `needs` names the measurement that would settle it. */
  | { readonly kind: "unmeasured"; readonly needs: string };

/** What is known about a resource class, including how to falsify the verdict. */
export interface ResourceFacts {
  /** The conservation law, stated so it can be checked rather than admired. */
  readonly conservation: string;
  /** Can an unused unit be carried to a later phase? Fixes whether planning ahead
   *  is even meaningful: you can plan a `stock`, you can only pace a `window`. */
  readonly bankable: boolean;
  /** The measurement that settles whether this class binds. Named even when the
   *  verdict is already known, so a future reader can re-run it. */
  readonly settledBy: string;
  /** The verdict for THIS repo, as measured on the date in the design doc. */
  readonly verdict: MeasuredVerdict;
}

/**
 * The measured register for Lucent-Financial-Group/Zeta as of 2026-08-18.
 *
 * Every `evidence` string names a measurement someone can re-run. This table is
 * the reason the planner in `cadence-planner.ts` plans windows and not minutes.
 */
export const RESOURCE_REGISTER: Readonly<Record<ResourceClass, ResourceFacts>> = {
  stock: {
    conservation: "remaining = cap - sum(consumed); refills on the billing cycle",
    bankable: true,
    settledBy:
      "docs/budget-history/snapshots.jsonl -> repos[].agg.billable_{ubuntu,macos,windows}_ms",
    verdict: {
      kind: "not-binding",
      evidence:
        "public repo => GitHub Actions is unmetered; billable_*_ms is 0 in all 17 " +
        "snapshots from 2026-04-21 to 2026-08-09. Nothing in the tree reads a " +
        "minute balance to gate work, so there is no allocator to starve.",
    },
  },
  flow: {
    conservation: "occupied then released; Little's law L = lambda * W; never bankable",
    bankable: false,
    settledBy: "queue delay = run.startedAt - run.createdAt over a run sample",
    verdict: {
      kind: "not-binding",
      evidence:
        "100 runs over 10 minutes on 2026-08-18: queue delay p50 = p90 = max = 0s " +
        "with 30 runs concurrently in_progress. Runners are granted instantly; " +
        "the fleet is nowhere near the concurrent-job ceiling.",
    },
  },
  mutex: {
    conservation: "holders <= 1; holding does not consume, so throughput is 1/holdTime",
    bankable: false,
    settledBy:
      "count of .github/workflows/*.yml with a constant concurrency group and " +
      "cancel-in-progress: false, times their hold time",
    verdict: {
      kind: "unmeasured",
      needs:
        "16 repo-wide singletons exist (agent-heartbeat, tick-metrics-flush, " +
        "mirror-to-fork, lockfile-healer, drift-sweep, pages, ...) but no one has " +
        "measured wait-for-mutex time. Measure: for each singleton group, the gap " +
        "between a run being queued and the prior holder releasing. Until then " +
        "this class is genuinely unknown, not quietly fine.",
    },
  },
  window: {
    conservation:
      "NOT conserved. A window is won iff pushInterval > jobDuration on the same " +
      "ref; a lost window yields nothing and is not refunded",
    bankable: false,
    settledBy:
      "per-ref median push interval vs median gate duration, from " +
      "gh run list --workflow gate.yml (ratio < 1 => the ref can never conclude)",
    verdict: {
      kind: "binding",
      evidence:
        "60 gate runs over 2h41m on 2026-08-18: 42 cancelled, 18 running, ZERO " +
        "concluded. Per-ref ratio pushInterval/gateDuration was 0.79 on " +
        "shadow/second-e8-tower (7 of 8 cancelled) and 0.98 on " +
        "heartbeat/tick-metrics (10 of 11 cancelled). gate p50 duration 18.7 min. " +
        "A ref pushing faster than its own gate duration preempts itself forever.",
    },
  },
};

/**
 * The register is only useful if a `binding` claim is falsifiable, so the check
 * is exported rather than left to review: a verdict that asserts bindingness
 * without evidence is refused.
 *
 * This is the vacuity guard for this module — see
 * `.claude/rules/numerology-vs-number-theory.md` (a claim nothing can refute is
 * not a claim).
 */
export function verdictIsWitnessed(v: MeasuredVerdict): boolean {
  switch (v.kind) {
    case "binding":
    case "not-binding":
      return v.evidence.trim().length > 0;
    case "unmeasured":
      return v.needs.trim().length > 0;
    default:
      return assertNever(v, "verdictIsWitnessed");
  }
}

/**
 * Whether planning AHEAD is meaningful for a class, or whether the only available
 * control is pacing.
 *
 * This is the single most load-bearing consequence of the taxonomy, and the
 * reason `cadence-planner.ts` emits a cadence rather than an allocation: **you
 * can allocate a stock; you can only pace a window.** Offering an "allocation"
 * over a non-bankable resource is offering a plan that cannot be honoured.
 */
export function isAllocatable(c: ResourceClass): boolean {
  switch (c) {
    case "stock":
      return true;
    case "flow":
    case "mutex":
    case "window":
      return false;
    default:
      return assertNever(c, "isAllocatable");
  }
}
