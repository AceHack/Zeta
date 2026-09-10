/**
 * pr-base-staleness.ts — is this PR failing because of ITSELF, or because of its BASE?
 *
 * ## Why this exists
 *
 * On 2026-09-09 eight open PRs each showed 19-24 failing checks. Read one at a time
 * they look like eight broken branches. They were one event: every one sat on base
 * `cf6de5aa`, fifteen commits behind `main`, and every failure was the same step —
 * `Install toolchain via three-way-parity script`. A rolling dependency pin had gone
 * bad and been re-pinned ON MAIN, after their base. The branches were never broken;
 * they were STRANDED, and the fix was a base refresh, not a code change.
 *
 * The diagnosis had been reached ad hoc, with shell pipelines, more than once — and
 * gotten wrong more than once. Aaron 2026-09-09: "the lesson is not [to] rely on ad
 * hoc commands ever, write a ts script that's reproducible and rate limit friendly …
 * ad hoc commands are never safe really, you get them wrong 1000s of times a day."
 * This module is that script's decision core.
 *
 * ## What it refuses to do
 *
 * The failure class this repo names as its worst is "a check that did not run looking
 * like one that passed." A PR whose checks are queued, in progress, or CANCELLED has
 * produced NO VERDICT — and an empty failure list under those conditions establishes
 * nothing. So `classifyBase` returns `unknown` with a reason rather than `current`
 * whenever the evidence did not arrive. Absence of a failure is not presence of health.
 *
 * It also declines to call a PR stranded merely because it is behind. Being behind is
 * necessary and NOT sufficient: the failing step must be one the base can actually
 * explain. A PR that is fifteen commits behind and failing its own unit test is failing
 * its own unit test, and refreshing the base would hide that rather than fix it.
 *
 * ## Transport
 *
 * Callers must reach GitHub over REST (`gh api repos/{owner}/{repo}/…`). GraphQL is the
 * one contested 5000/hour budget in this fleet, and `gh pr view` / `gh pr list` are
 * GraphQL. See `.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md`.
 */

/** A check-run as returned by the REST check-runs API, narrowed to what we judge on. */
export interface CheckRun {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly startedAt: string;
}

export interface BaseStalenessInput {
  /** Commits on the base branch that the PR's base does not contain. 0 == current. */
  readonly behindBy: number;
  /** Every check-run on the head SHA — ALL attempts, not pre-filtered. */
  readonly checkRuns: readonly CheckRun[];
  /** Step names a stale base is capable of explaining. */
  readonly baseAttributableSteps: readonly string[];
}

export type BaseVerdict =
  | { readonly kind: "current" }
  | { readonly kind: "stranded"; readonly behindBy: number; readonly failingChecks: readonly string[] }
  | { readonly kind: "own-failure"; readonly behindBy: number; readonly failingChecks: readonly string[] }
  | { readonly kind: "unknown"; readonly reason: string };

/**
 * Keep only the LATEST attempt per check name.
 *
 * A re-run leaves the earlier attempt in the API response. Taking any matching run
 * quoted a stale 08:29 failure as current when the 08:46 attempt had succeeded — a
 * measured error from this repo, 2026-09-09. Ordering is by `startedAt`, compared
 * ordinally: these are ISO-8601 UTC strings from GitHub, where lexicographic order IS
 * chronological order, and an ordinal compare cannot drift with the machine's locale.
 */
export function latestPerName(runs: readonly CheckRun[]): readonly CheckRun[] {
  const latest = new Map<string, CheckRun>();
  for (const run of runs) {
    const held = latest.get(run.name);
    // Ordinal (code-unit) compare, NOT localeCompare — localeCompare is linguistic and
    // culture-sensitive, which `.claude/rules/culture-invariant-by-default.md` forbids in
    // primitives. A bare `>` on strings is codepoint order, which is what we want here.
    if (held === undefined || run.startedAt > held.startedAt) {
      latest.set(run.name, run);
    }
  }
  return [...latest.values()];
}

/**
 * `cancelled` is not a failure and not a pass — it is the ABSENCE of a verdict.
 *
 * Measured on this repo: 88% of gate runs on `main` were cancelled by concurrency, and
 * `gh pr checks` renders cancelled as a failure, which sent a rerun filter past exactly
 * the runs that needed rerunning. A cancelled run tells you nothing about the code.
 */
export function hasVerdict(run: CheckRun): boolean {
  if (run.status !== "completed") return false;
  return run.conclusion !== null && run.conclusion !== "cancelled" && run.conclusion !== "skipped";
}

export function isFailing(run: CheckRun): boolean {
  return hasVerdict(run) && (run.conclusion === "failure" || run.conclusion === "timed_out");
}

/**
 * Decide whether a PR's failures belong to the PR or to the ground it stands on.
 *
 * Returns `unknown` — never a clean verdict — when no check on the head has reached a
 * conclusion. That is the refusal this module exists for: with nothing decided, an
 * empty failure list is not evidence of health.
 */
export function classifyBase(input: BaseStalenessInput): BaseVerdict {
  const latest = latestPerName(input.checkRuns);
  const decided = latest.filter(hasVerdict);

  if (decided.length === 0) {
    const queued = latest.length;
    return {
      kind: "unknown",
      reason:
        queued === 0
          ? "no check-runs exist on this head — nothing has been scheduled, so nothing has been established"
          : `all ${String(queued)} check-run(s) on this head are queued, in progress, or cancelled — no verdict was reached, and an empty failure list under those conditions establishes nothing`,
    };
  }

  const failing = decided.filter(isFailing).map((r) => r.name);

  if (input.behindBy === 0) return { kind: "current" };
  if (failing.length === 0) return { kind: "current" };

  // Behind is necessary but NOT sufficient. The failing step must be one the base can
  // actually explain — otherwise refreshing the base would bury a real defect.
  const attributable = failing.some((name) =>
    input.baseAttributableSteps.some((step) => name.includes(step)),
  );

  return attributable
    ? { kind: "stranded", behindBy: input.behindBy, failingChecks: failing }
    : { kind: "own-failure", behindBy: input.behindBy, failingChecks: failing };
}

/** Human-readable one-liner; the CLI prints this, so the reason for `unknown` survives. */
export function describeVerdict(prNumber: number, verdict: BaseVerdict): string {
  const pr = `#${String(prNumber)}`;
  switch (verdict.kind) {
    case "current":
      return `${pr} current — base is up to date, or nothing is failing`;
    case "stranded":
      return `${pr} STRANDED — ${String(verdict.behindBy)} commits behind, failing at a base-attributable step (${verdict.failingChecks.slice(0, 3).join(", ")}); refresh the base`;
    case "own-failure":
      return `${pr} own failure — ${String(verdict.behindBy)} commits behind, but failing at (${verdict.failingChecks.slice(0, 3).join(", ")}), which a stale base does not explain; refreshing would HIDE this`;
    case "unknown":
      return `${pr} unknown — ${verdict.reason}`;
  }
}
