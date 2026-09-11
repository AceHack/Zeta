/**
 * corporate/org-chart.ts — the reporting graph. Who supervises whom, and how far apart two hats are.
 *
 * ── WHY THIS MODULE EXISTS ───────────────────────────────────────────────────
 * `observe/room/hat-gate.ts` already carries `HatLevel`, and says so plainly: *"mirrors
 * agentic-organization HatLevel"*. But a level is a RANK, not an ORGANIZATION. Before this module
 * the canonical package had six tiers and no graph: no `reportsTo`, no departments, no named hats,
 * no way to ask who a blocker goes to. `grep -r reportsTo src/Core.TypeScript` returned nothing.
 *
 * That absence is what made three separate things impossible, all of which the corporate register
 * specifies and none of which can be built on a bare rank:
 *
 *   - **Escalation** (`SUPERVISOR_CHAIN_COMMUNICATION.md`) routes to *"who supervises that duty"* —
 *     a specific hat, not "someone senior".
 *   - **A goal cascade** must hand a rung to an owner who actually reports to the rung above,
 *     otherwise the tree is an org chart drawn twice and agreeing by luck.
 *   - **Schedule ownership** (`AGENT_WORK_RHYTHM_AND_PROMPT_FLOWS.md`) is per-layer: a supervising
 *     hat may adjust a subordinate's schedule. "Supervising" is an edge, and there were no edges.
 *
 * ── THIS IS THE CORPORATE REGISTER, NOT THE SOVEREIGN CORE ───────────────────
 * Per `docs/DECISIONS/2026-05-31-observe-act-16-direction-universal-action-grammar-local-no-cloud-llm.md`,
 * the observe-algebra is CANONICAL and the corporate workflow *retrofits onto it*. So everything in
 * `corporate/` composes over the canonical substrate and nothing in the sovereign core may import
 * it — a hierarchy is one register's policy, not a property of the machine. That direction is
 * enforced by a test (`register-boundary.test.ts`), not asserted in a comment.
 */

import type { HatLevel } from "../observe/room/hat-gate";

export type { HatLevel };

/**
 * Authority rank, most senior first. Used for the ordering questions a bare string union cannot
 * answer: is this hat above that one, and may this hat adjust that one's schedule.
 *
 * Lower number = more senior. The order is the corporate register's chain verbatim
 * (`SUPERVISOR_CHAIN_COMMUNICATION.md`): team member → manager → director → C-suite → board.
 */
export const LEVEL_RANK: Record<HatLevel, number> = {
  executive_board: 0,
  c_suite: 1,
  director: 2,
  manager: 3,
  lead: 4,
  individual_contributor: 5,
};

/** Most senior first. Derived from `LEVEL_RANK` so the two can never disagree. */
export const LEVELS_SENIOR_FIRST: readonly HatLevel[] = (Object.keys(LEVEL_RANK) as HatLevel[]).sort(
  (a, b) => LEVEL_RANK[a] - LEVEL_RANK[b],
);

/** Is `a` strictly more senior than `b`? */
export function outranks(a: HatLevel, b: HatLevel): boolean {
  return LEVEL_RANK[a] < LEVEL_RANK[b];
}

/** One hat in the chart. */
export interface OrgHat {
  readonly id: string;
  readonly name: string;
  readonly level: HatLevel;
  readonly departmentId: string;
  /** The hat this one reports to. Absent ONLY for the single root. */
  readonly reportsTo?: string;
  /**
   * What this hat is authorized to approve — quality gates, and any other scoped approval.
   *
   * Kept ON THE HAT rather than in a separate gate→owners roster so there is one source of truth.
   * The reference organization keeps both and requires both; two lists that must agree are two
   * lists that can disagree, and the disagreement is silent in the permissive direction the moment
   * a hat is added to one and not the other.
   */
  readonly approvalScopes?: readonly string[];
  /** Binding timing (`hat-binding.ts`). Absent fields take that module's defaults. */
  readonly warmupMs?: number;
  readonly ttlMs?: number;
  readonly cooldownMs?: number;
  readonly successionPolicy?: "rotate" | "renew" | "appoint" | "none";
  /**
   * How many agents may wear this hat AT ONCE.
   *
   * Absent means one, which is what the binding rules already enforced implicitly. Stating it makes
   * capacity a property of the hat rather than an accident of the binding check — and makes it
   * something an operator can raise for a hat that genuinely takes a team, or lower to throttle one.
   */
  readonly maxWearers?: number;
}

export interface OrgChart {
  readonly hats: readonly OrgHat[];
  readonly byId: ReadonlyMap<string, OrgHat>;
  readonly rootId: string;
}

export type OrgChartResult =
  | { readonly ok: true; readonly chart: OrgChart }
  | { readonly ok: false; readonly reason: string };

/**
 * Build a validated chart, or REFUSE with the reason.
 *
 * Four things are checked, and each is a shape that would otherwise produce a chart that reads fine
 * and routes wrongly:
 *
 *   1. **ids are unique** — a duplicate id silently shadows a hat, so signals route to whichever
 *      copy the map happened to keep.
 *   2. **every `reportsTo` resolves** — a dangling supervisor truncates the chain, and a truncated
 *      chain looks exactly like "reached the top" to any caller that walks it.
 *   3. **exactly one root** — two roots means two organizations, and escalation from one can never
 *      reach the other. Zero roots means a cycle.
 *   4. **no hat reports DOWNWARD** — a director reporting to an IC type-checks and is not an
 *      organization.
 *
 * Rule 4 is deliberately *not* "reports to a strictly higher level", which is what this module
 * checked first. The reference organization refutes that: in `agentic-organization`'s seed the CTO
 * reports to the CEO and **both are `c_suite`**, and the Chief Architect (also `c_suite`) reports to
 * the CTO. Peer reporting inside the C-suite is how the real chart is shaped, so the strict rule
 * would have rejected the very organization this register exists to run.
 *
 * That relaxation is why the reach-the-root walk below is load-bearing rather than belt-and-braces:
 * once same-level edges are legal, `ceo → cto → ceo` is a cycle the level rule cannot see, and the
 * walk is the only thing that catches it.
 *
 * Returning a reason rather than throwing keeps a malformed chart a value the caller can inspect;
 * throwing would make the most interesting case the hardest to test.
 */
export function buildOrgChart(hats: readonly OrgHat[]): OrgChartResult {
  if (hats.length === 0) return { ok: false, reason: "an organization with no hats is not an organization" };

  const byId = new Map<string, OrgHat>();
  for (const hat of hats) {
    if (byId.has(hat.id)) return { ok: false, reason: `duplicate hat id '${hat.id}'` };
    byId.set(hat.id, hat);
  }

  const roots: string[] = [];
  for (const hat of hats) {
    if (hat.reportsTo === undefined) {
      roots.push(hat.id);
      continue;
    }
    const boss = byId.get(hat.reportsTo);
    if (boss === undefined) {
      return { ok: false, reason: `hat '${hat.id}' reports to '${hat.reportsTo}', which is not a hat` };
    }
    if (outranks(hat.level, boss.level)) {
      return {
        ok: false,
        reason: `hat '${hat.id}' (${hat.level}) reports to '${boss.id}' (${boss.level}), which it outranks`,
      };
    }
  }

  if (roots.length === 0) {
    return { ok: false, reason: "no root hat — every hat reports to another, so the chart is cyclic" };
  }
  if (roots.length > 1) {
    return {
      ok: false,
      reason: `${roots.length} root hats (${roots.join(", ")}) — that is ${roots.length} organizations, not one`,
    };
  }

  const rootId = roots[0];
  if (rootId === undefined) return { ok: false, reason: "no root hat" };

  // THE CYCLE CHECK. Same-level reporting is legal (see rule 4), so the level rule alone cannot
  // rule out `ceo → cto → ceo`: a peer cycle passes every check above, produces no root among its
  // members, and would still leave a root elsewhere in the chart — so `roots.length === 1` does not
  // catch it either. Every hat must actually REACH the root.
  for (const hat of hats) {
    const chain = walkUp(hat.id, byId);
    if (chain[chain.length - 1] !== rootId) {
      return { ok: false, reason: `hat '${hat.id}' does not reach the root '${rootId}'` };
    }
  }

  return { ok: true, chart: { hats, byId, rootId } };
}

/** Walk `reportsTo` upward, self first, root last. Cycle-safe by construction. */
function walkUp(hatId: string, byId: ReadonlyMap<string, OrgHat>): readonly string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = hatId;
  while (cursor !== undefined && !seen.has(cursor)) {
    chain.push(cursor);
    seen.add(cursor);
    cursor = byId.get(cursor)?.reportsTo;
  }
  return chain;
}

/** The chain from `hatId` up to the root, self first. Empty if the hat is unknown. */
export function supervisorChainOf(chart: OrgChart, hatId: string): readonly string[] {
  if (!chart.byId.has(hatId)) return [];
  return walkUp(hatId, chart.byId);
}

/** The immediate supervisor, or undefined at the root. */
export function supervisorOf(chart: OrgChart, hatId: string): OrgHat | undefined {
  const reportsTo = chart.byId.get(hatId)?.reportsTo;
  return reportsTo === undefined ? undefined : chart.byId.get(reportsTo);
}

/**
 * Does `descendantId` sit under `ancestorId` (or equal it)?
 *
 * Reflexive on purpose: a hat is trivially within its own line of responsibility, and the cascade
 * uses this to ask "is this owner inside the accepting hat's organization", where the accepting hat
 * itself qualifies.
 */
export function reportsUpTo(chart: OrgChart, descendantId: string, ancestorId: string): boolean {
  return supervisorChainOf(chart, descendantId).includes(ancestorId);
}

/** Every hat that reports DIRECTLY to `hatId`. */
export function directReportsOf(chart: OrgChart, hatId: string): readonly OrgHat[] {
  return chart.hats.filter((h) => h.reportsTo === hatId);
}

/**
 * The nearest hat at or above `level` on `hatId`'s chain, excluding `hatId` itself.
 *
 * This is escalation's routing primitive: "who do I take this to". Excluding self matters — a
 * manager escalating a decision it cannot make must not be handed back its own hat, which is the
 * shape that turns an escalation into a no-op that reports success.
 */
export function nearestSupervisorAtOrAbove(chart: OrgChart, hatId: string, level: HatLevel): OrgHat | undefined {
  const chain = supervisorChainOf(chart, hatId);
  for (const id of chain.slice(1)) {
    const hat = chart.byId.get(id);
    if (hat !== undefined && LEVEL_RANK[hat.level] <= LEVEL_RANK[level]) return hat;
  }
  return undefined;
}

/** Every hat at `level`, in chart order. */
export function hatsAtLevel(chart: OrgChart, level: HatLevel): readonly OrgHat[] {
  return chart.hats.filter((h) => h.level === level);
}
