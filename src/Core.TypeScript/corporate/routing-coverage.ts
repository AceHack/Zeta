/**
 * routing-coverage.ts — does every hat this organization's POLICIES name actually exist?
 *
 * ── THE CLAIM THIS EXISTS TO STOP ANYONE MAKING AGAIN ────────────────────────
 * Several modules route by naming hats: `blocker-taxonomy.ts` gives each of fifteen blocker kinds
 * an ordered owner list, `lag-detection.ts` addresses twelve conditions the same way. Both SKIP an
 * owner the chart does not have — deliberately, because an organization without a security engineer
 * should still reach its security director.
 *
 * That skip is correct and it is silent. So "the chart is a subset, therefore routings are falling
 * back" is a claim anyone would find plausible, and it was asserted in this register's own decision
 * record without being measured. IT WAS FALSE: the 29-hat seed resolved every policy owner, because
 * the policies had been written against the hats that existed.
 *
 * A plausible unmeasured claim about a silent mechanism is the same defect as a silent mechanism —
 * both produce confident statements nobody checked. This module makes the question answerable in
 * one call, and reports it through `observation-ledger.ts` so it is counted alongside every other
 * thing the organization does or does not know about itself.
 *
 * ── WHAT COUNTS AS A FINDING ─────────────────────────────────────────────────
 * Not "this hat is missing" on its own. Three distinct facts, and they cost different amounts:
 *
 *   - **unroutable** — NO owner in the policy exists. The blocker reaches nobody, and
 *     `routeBlocker` correctly refuses. The expensive one.
 *   - **degraded** — the FIRST owner is absent, so the routing silently lands on a later one. The
 *     policy says most-specific-first for a reason; skipping the specialist to reach the director
 *     spends the senior hat's attention on something the first could have answered.
 *   - **complete** — every named owner exists.
 *
 * A run reporting zero findings means every policy in this organization names hats it has.
 */

import { BLOCKER_POLICY, BlockerKind } from "./blocker-taxonomy";
import { ObservationState, type Observation } from "./observation-ledger";
import type { OrgChart } from "./org-chart";

export const RoutingGap = {
  /** No owner named by the policy exists here. The routing reaches nobody. */
  Unroutable: "unroutable",
  /** The first-choice owner is absent, so routing silently lands on a later one. */
  FirstOwnerAbsent: "first_owner_absent",
} as const;

export type RoutingGap = (typeof RoutingGap)[keyof typeof RoutingGap];

export interface RoutingFinding {
  readonly gap: RoutingGap;
  /** The policy row — a blocker kind today. */
  readonly policy: string;
  /** Owners the policy names and this chart does not have, in policy order. */
  readonly absentOwners: readonly string[];
  /** Who it actually reaches, or `undefined` when nobody. */
  readonly reaches: string | undefined;
  readonly detail: string;
}

export interface RoutingCoverage {
  readonly findings: readonly RoutingFinding[];
  /** Policy rows examined. Every one is checked; there is no partial sweep here. */
  readonly policiesChecked: number;
  /** Owner ids the policies name, that this chart does not have. Ordinal and de-duplicated. */
  readonly absentOwners: readonly string[];
  readonly summary: string;
}

/**
 * Check every routing policy against the chart.
 *
 * TOTAL — every policy row is examined on every call, because the check needs nothing but the
 * chart and the policy table. There is no `notChecked` here and that is a fact about this
 * question, not an omission: a coverage check that could itself be skipped would need its own
 * coverage check.
 */
export function routingCoverage(chart: OrgChart): RoutingCoverage {
  const findings: RoutingFinding[] = [];
  const absent = new Set<string>();

  for (const kind of Object.values(BlockerKind)) {
    const owners = BLOCKER_POLICY[kind].ownerHatIds;
    const missing = owners.filter((id) => !chart.byId.has(id));
    for (const id of missing) absent.add(id);
    if (missing.length === 0) continue;

    const reaches = owners.find((id) => chart.byId.has(id));
    if (reaches === undefined) {
      findings.push({
        gap: RoutingGap.Unroutable,
        policy: kind,
        absentOwners: missing,
        reaches: undefined,
        detail: `'${kind}' names ${owners.join(", ")} and this chart has none of them`,
      });
      continue;
    }
    if (owners[0] !== undefined && !chart.byId.has(owners[0])) {
      findings.push({
        gap: RoutingGap.FirstOwnerAbsent,
        policy: kind,
        absentOwners: missing,
        reaches,
        detail: `'${kind}' should reach '${owners[0]}' and reaches '${reaches}' instead`,
      });
    }
  }

  const policiesChecked = Object.values(BlockerKind).length;
  return {
    findings: [...findings].sort((a, b) => ordinal(a.policy, b.policy)),
    policiesChecked,
    absentOwners: [...absent].sort(ordinal),
    summary: `${String(findings.length)} routing gap(s) across ${String(policiesChecked)} policy row(s)`,
  };
}

/**
 * Coverage as an observation, for the register-wide ledger.
 *
 * ALWAYS `observed`: this question needs only the chart, so it can always be answered, and saying
 * otherwise would be manufacturing a blind spot to look thorough.
 */
export function routingObservations(chart: OrgChart): readonly Observation[] {
  const coverage = routingCoverage(chart);
  return [
    {
      subject: "routing-coverage",
      question: "blocker-owners-exist",
      state: ObservationState.Observed,
      findings: coverage.findings.length,
    },
  ];
}

/** ORDINAL. Two runs over one organization must report the same gaps in the same order. */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
