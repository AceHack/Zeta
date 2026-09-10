/**
 * forge-host/github/code-scanning-observations.ts — reading code-scanning alerts
 * for a pull request, through the one path that is checked.
 *
 * THE MEASUREMENT THAT DICTATES THE SHAPE (2026-09-10, this repo):
 *
 *   Nothing in this repository read `code-scanning/alerts` from committed code.
 *   Five tranches of security work — roughly eighty alerts closed — ran entirely
 *   on ad-hoc `gh api ... --jq` incantations typed fresh each time. One of them
 *   was wrong in a way that produced a confident false negative:
 *
 *     gh api "…/code-scanning/alerts?ref=refs/pull/17177/head"  ->  []
 *     gh api "…/code-scanning/alerts?ref=refs/pull/17177/merge" ->  1 OPEN
 *
 *   `refs/pull/N/head` returns an empty list for EVERY pull request, always,
 *   because code scanning analyses the MERGE commit and files alerts under
 *   `refs/pull/N/merge`. The empty list reads exactly like "no findings", and on
 *   that basis two review threads were resolved on live alerts.
 *
 * SO THE REF IS NOT A PARAMETER. `alertRefForPr` is the only way to name it, and
 * it cannot spell `/head`.
 *
 * AN EMPTY LIST IS `unknown` UNTIL THE ANALYSIS IS KNOWN TO HAVE RUN. Zero
 * findings and zero analysis are indistinguishable from outside, and the outage
 * of 2026-09-09 made that concrete: CodeQL jobs failed at their toolchain-install
 * step, so `Analyze (csharp)` was `failure` while the alert list was empty. A
 * caller that read the emptiness would have concluded "clean" about an analysis
 * that never happened.
 *
 * The guard and the ref are checked TOGETHER here on purpose. On 2026-09-10 the
 * analysis-ran guard was applied correctly *over the wrong ref*, and a sound
 * guard over a wrong query is still a wrong answer — the emptiness was structural,
 * not observational, so no amount of checking whether CodeQL ran could have
 * surfaced it. Neither half is sufficient alone.
 *
 * `.claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md`
 * — these are REST reads; alerts have no GraphQL form worth spending the budget on.
 */

/** One alert, reduced to what a verdict needs. */
export interface GhAlert {
  readonly number: number;
  readonly state: string;
  readonly rule: { readonly id: string; readonly security_severity_level?: string | null };
}

/**
 * The ONLY ref code scanning files pull-request alerts under.
 *
 * Deliberately not parameterised: a caller that could pass a ref could pass
 * `/head`, which is the defect this module exists to make unspellable.
 */
export function alertRefForPr(prNumber: number): string {
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(`alertRefForPr: pull-request number must be a positive integer, got ${String(prNumber)}`);
  }
  return `refs/pull/${String(prNumber)}/merge`;
}

export type AlertEvidence =
  | { readonly kind: "findings"; readonly open: readonly GhAlert[] }
  | { readonly kind: "none" }
  | { readonly kind: "unknown"; readonly reason: string };

/**
 * Fold an alert list into a verdict, refusing to read emptiness as cleanliness.
 *
 * `analysisConclusion` must come from the CodeQL check-run for the relevant
 * language ON THE SAME HEAD. Deriving it from the alert list would be the
 * circularity this breaks: an empty list cannot testify that it is empty for a
 * good reason.
 */
export function alertEvidence(input: {
  readonly analysisConclusion: string | null;
  readonly analysisName: string;
  readonly alerts: readonly GhAlert[];
}): AlertEvidence {
  if (input.analysisConclusion !== "success") {
    return {
      kind: "unknown",
      reason: `${input.analysisName} concluded '${input.analysisConclusion ?? "not-run"}' on this head — an empty alert list establishes nothing`,
    };
  }
  const open = input.alerts.filter((a) => a.state === "open");
  return open.length > 0 ? { kind: "findings", open } : { kind: "none" };
}

/** Render for a human, keeping `unknown` visibly distinct from `none`. */
export function renderAlertEvidence(e: AlertEvidence): string {
  switch (e.kind) {
    case "findings":
      return `${String(e.open.length)} OPEN: ${e.open.map((a) => `${String(a.number)} ${a.rule.id}`).join(", ")}`;
    case "none":
      return "none open (analysis ran)";
    case "unknown":
      return `UNKNOWN — ${e.reason}`;
  }
}
