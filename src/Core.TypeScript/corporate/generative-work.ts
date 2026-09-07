/**
 * generative-work.ts — the acts that make new work, offered to the hats that may perform them.
 *
 * ── THE MEASUREMENT THAT FORCED THIS ─────────────────────────────────────────
 * Driven for 200 rounds against the full chart, this organization SETTLES. That was reported as a
 * success, and for `drive-livelock.test.ts` it is — a loop that re-reports one unresolved state
 * forever is not an organization working. But settling is only half the property. Read the other
 * way, the same measurement says something worse:
 *
 *   > **Every verb on the menu advances work that already exists. None of them makes any.**
 *
 * `review_artifact`, `respond_to_artifact`, `convene_meeting`, `request_information`,
 * `assign_work` — five peer verbs, all convergent by construction. Hand this organization a
 * cascade and it will staff it, review it, escalate it and deliver it, and then stop, because
 * nothing a hat can choose produces the next thing to do. The acts that DO produce it —
 * `acceptGoal`, `decidePriority`, `decideSupply`, `requestReviewsFor` — exist and work and are
 * reachable only from `org-cycle.ts`, a nine-phase script that calls them in a fixed order.
 *
 * So the C-suite does not set direction; the script sets direction and the C-suite is named as the
 * hat it happened to. That is the difference between an organization and a recording of one.
 *
 * ── OPENINGS ARE DERIVED, NEVER DECLARED ─────────────────────────────────────
 * An opening is a GAP the register already computes, addressed to the hat the chart says owns it.
 * Nothing here decides that a direction is needed; it observes that a domain has no live work and
 * reports who would be the one to say so. That matters because the alternative — a queue of
 * generative tasks somebody schedules — is the script again, wearing a menu.
 *
 * Each opening also CLOSES ITSELF when taken: setting a direction gives the domain live work, so
 * the opening is gone next round. That is not a nicety. Two livelocks have already been found in
 * this drive, both of them an act that was offered, chosen, applied and left its own precondition
 * standing — so an opening that survives its own act is the known failure of this loop, and the
 * falsifiers assert the absence of it directly.
 *
 * ── WHAT THE OPENING SUPPLIES, AND WHAT IT DOES NOT ──────────────────────────
 * An opening carries a `prompt`: the question the hat is being asked. It is NOT the answer. A
 * deterministic driver takes the prompt verbatim, which is what keeps a drive replayable; a driver
 * with a model behind it answers the prompt and passes its own text. Both go through the same
 * effect, so the organization cannot tell — and must not be able to tell — whether the hat that
 * set its direction was thinking.
 */

import { Domain, DomainMatch, departmentFor, type DomainRouting } from "./domain-ontology";
import { isLeafType, nextRung, ownerForRung, WorkState, WorkType, type CascadeNode } from "./goal-cascade";
import {
  hatsAtLevel,
  reportsUpTo,
  supervisorChainOf,
  supervisorOf,
  type OrgChart,
  type OrgHat,
} from "./org-chart";
import { PRIORITY_ORDER, type PriorityClass } from "./prioritization";
import { routingCoverage } from "./routing-coverage";

/** The four acts that make new work rather than advancing existing work. */
export const GenerativeKind = {
  /** State or restate what this part of the company is for. C-suite only. */
  SetDirection: "set_direction",
  /** Write the document a piece of work is missing. The business side's primary act. */
  DraftBusinessDoc: "draft_business_doc",
  /** Say how urgent something is. Until somebody does, half the register's guardrails are inert. */
  DecidePriority: "decide_priority",
  /** Say the organization is missing a hat. The RMO's act, and the only one that changes the chart. */
  SizeHatSupply: "size_hat_supply",
  /**
   * Turn a direction into the rung below it. The verb that makes the ladder run.
   *
   * Added after measuring the first four: the drive set sixteen directions, priced all sixteen,
   * and then stopped with sixteen root goals and nothing under any of them. Direction without
   * decomposition is an organization that decides what it wants and never asks anyone to do it.
   */
  BreakDownWork: "break_down_work",
} as const;

export type GenerativeKind = (typeof GenerativeKind)[keyof typeof GenerativeKind];

/**
 * One generative act, open to one hat.
 *
 * `byHatId` is on the opening rather than implied by who asked, because these are the acts most
 * worth auditing after the fact: the record of who set a direction is the record of who the
 * organization was following.
 */
export interface GenerativeOpening {
  readonly kind: GenerativeKind;
  readonly byHatId: string;
  /** The question this hat is being asked. Never the answer — see the module docstring. */
  readonly prompt: string;
  /** What the act would create or decide. Deterministic, so a re-offer is the same opening. */
  readonly subjectId: string;
  readonly domain?: Domain;
  /** For `decide_priority`, the classes it may choose between. Ordinal, most urgent first. */
  readonly options?: readonly PriorityClass[];
  /** Why this is open — the gap that was measured, in the words of whatever measured it. */
  readonly because: string;
}

/** Work that still counts as live. Delivered and cancelled work leaves no gap behind it. */
function isLive(node: CascadeNode): boolean {
  return node.state === WorkState.Open || node.state === WorkState.InProgress;
}

/**
 * The c-suite hat a department answers to.
 *
 * Walked from the department's own hats rather than declared, because a chart where a department
 * reports somewhere unexpected should route there — that is what the chart IS. Returns undefined
 * when the department reaches no executive at all, which is a real gap and is reported by the
 * caller rather than defaulted to the CEO.
 */
function executiveOver(chart: OrgChart, departmentId: string): OrgHat | undefined {
  const inDept = chart.hats.filter((h) => h.departmentId === departmentId);
  const executives = new Set(
    chart.hats.filter((h) => h.level === "c_suite" || h.level === "executive_board").map((h) => h.id),
  );
  // NEAREST FIRST, then ordinal. The first version of this sorted ordinally alone, and every one of
  // the sixteen domains came out owned by the CEO — including engineering, which reports to the
  // CTO, because "ceo" sorts before "cto". That is precisely the alphabetical routing this whole
  // register was measured against and rewritten to end, reintroduced one module later.
  //
  // Distance is the shortest chain from ANY hat in the department, so a department whose director
  // reports to the CTO answers to the CTO even though the CEO is also above it.
  const distance = new Map<string, number>();
  for (const hat of inDept) {
    const chain = supervisorChainOf(chart, hat.id);
    for (let i = 0; i < chain.length; i += 1) {
      const up = chain[i]!;
      if (!executives.has(up)) continue;
      const known = distance.get(up);
      if (known === undefined || i < known) distance.set(up, i);
    }
  }
  return [...distance.entries()]
    .sort((a, b) => (a[1] !== b[1] ? a[1] - b[1] : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([id]) => chart.byId.get(id))[0];
}

/**
 * Domains with nothing live in them, and who would say what they are for.
 *
 * A domain with no live work is not idle capacity; it is a part of the company nobody has pointed
 * anywhere. That is precisely the fact a C-suite exists to change, and until now the only thing
 * that could change it was a script.
 */
export function directionOpenings(chart: OrgChart, cascade: readonly CascadeNode[]): readonly GenerativeOpening[] {
  const live = new Set(cascade.filter(isLive).map((n) => n.domain).filter((d): d is Domain => d !== undefined));
  const out: GenerativeOpening[] = [];
  for (const domain of Object.values(Domain)) {
    if (live.has(domain)) continue;
    const executive = executiveOver(chart, departmentFor(domain));
    if (executive === undefined) continue;
    out.push({
      kind: GenerativeKind.SetDirection,
      byHatId: executive.id,
      prompt: `what should ${departmentFor(domain)} be working towards for ${domain}?`,
      // DERIVED FROM THE DOMAIN, so the same gap yields the same id every round. A minted id would
      // make the opening look new each time and let one domain accumulate parallel directions
      // nobody reconciled.
      subjectId: `direction-${domain}`,
      domain,
      because: `no live work carries the domain '${domain}'`,
    });
  }
  return out;
}

/**
 * Live work with no document behind it, and who in the owning department would write it.
 *
 * The author is chosen by the SAME ranking that picks a rung's owner — nearest in the line, in the
 * work's own department, ordinal tie-break — rather than by a second rule invented here. Two rules
 * for "who in this department does this" would disagree eventually, and the disagreement would be
 * silent because both would look right in isolation.
 */
export function draftingOpenings(
  chart: OrgChart,
  cascade: readonly CascadeNode[],
  artifacts: ReadonlySet<string>,
): readonly GenerativeOpening[] {
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(node)) continue;
    if (node.domain === undefined) continue;
    if (node.workType === WorkType.Goal) continue;
    const artifactId = `doc-${node.workId}`;
    if (artifacts.has(artifactId)) continue;
    const author = authorFor(chart, node.ownerHatId, node.domain);
    if (author === undefined) continue;
    out.push({
      kind: GenerativeKind.DraftBusinessDoc,
      byHatId: author.id,
      prompt: `write the document '${node.title}' needs`,
      subjectId: artifactId,
      domain: node.domain,
      because: `'${node.workId}' is live and has no artifact`,
    });
  }
  return out;
}

/** Nearest IC under this owner, preferring the work's own department. */
function authorFor(chart: OrgChart, ownerHatId: string, domain: Domain): OrgHat | undefined {
  const owningDept = departmentFor(domain);
  const under = hatsAtLevel(chart, "individual_contributor").filter(
    (h) => h.id !== ownerHatId && reportsUpTo(chart, h.id, ownerHatId),
  );
  const inDomain = under.filter((h) => h.departmentId === owningDept);
  const pool = inDomain.length > 0 ? inDomain : under;
  return [...pool].sort((a, b) => {
    const da = supervisorChainOf(chart, a.id).indexOf(ownerHatId);
    const db = supervisorChainOf(chart, b.id).indexOf(ownerHatId);
    if (da !== db) return da - db;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}

/**
 * Live work nobody has priced, and the supervisor accountable for pricing it.
 *
 * THE SUPERVISOR, not the owner. An owner setting the priority of its own work is not a decision,
 * it is a preference — and `alternate-work.ts` already refuses work that bypasses the priority
 * policy, which would be a check against a number the same hat chose. Where a hat has no
 * supervisor it prices its own work, because the top of a chart has nobody to ask and refusing
 * there would leave the company's own goals permanently unpriced.
 */
export function priorityOpenings(
  chart: OrgChart,
  cascade: readonly CascadeNode[],
  priced: ReadonlySet<string>,
): readonly GenerativeOpening[] {
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(node)) continue;
    if (priced.has(node.workId)) continue;
    const decider = supervisorOf(chart, node.ownerHatId) ?? chart.byId.get(node.ownerHatId);
    if (decider === undefined) continue;
    out.push({
      kind: GenerativeKind.DecidePriority,
      byHatId: decider.id,
      prompt: `how urgent is '${node.title}'?`,
      subjectId: node.workId,
      ...(node.domain === undefined ? {} : { domain: node.domain }),
      options: PRIORITY_ORDER,
      because: `'${node.workId}' is live and has no decided priority`,
    });
  }
  return out;
}

/**
 * Routings that reach nobody, offered to the hat that can do something about it.
 *
 * Read from `routing-coverage.ts` rather than measured again here. That module exists because I
 * once claimed several blocker routings fell back for want of a hat, and had measured nothing —
 * the answer was zero. A second, independent count of the same thing would restore exactly the
 * situation that made the first claim possible.
 */
export function supplyOpenings(
  chart: OrgChart,
  resourceAuthorityHatId: string,
  alreadyRaised: ReadonlySet<string>,
): readonly GenerativeOpening[] {
  if (chart.byId.get(resourceAuthorityHatId) === undefined) return [];
  return routingCoverage(chart)
    .findings.filter((f) => !alreadyRaised.has(f.policy))
    .map((f) => ({
      kind: GenerativeKind.SizeHatSupply,
      byHatId: resourceAuthorityHatId,
      prompt: `the organization has no hat for '${f.policy}'`,
      subjectId: f.policy,
      because: f.detail,
    }));
}

/** Where a domain's work went, as a reason to revisit supply rather than as a report. */
export function outOfDomainOpenings(
  routings: readonly DomainRouting[],
  resourceAuthorityHatId: string,
  alreadyRaised: ReadonlySet<string>,
): readonly GenerativeOpening[] {
  const out: GenerativeOpening[] = [];
  for (const r of routings) {
    if (r.match !== DomainMatch.OutOfDomain) continue;
    // An out-of-domain row with NO domain is the broken-chart case `domainRouting` folds in — an
    // owner the chart does not hold. That is not a supply gap and staffing a new hat would not fix
    // it, so it belongs to whoever repairs the chart rather than on this menu.
    if (r.domain === undefined) continue;
    const subjectId = `domain-fallback:${r.workId}`;
    if (alreadyRaised.has(subjectId)) continue;
    out.push({
      kind: GenerativeKind.SizeHatSupply,
      byHatId: resourceAuthorityHatId,
      prompt: `'${r.workId}' is owned outside the department that owns its domain`,
      subjectId,
      domain: r.domain,
      because: `'${r.ownerHatId}' is in '${r.ownerDepartmentId}', not '${departmentFor(r.domain)}'`,
    });
  }
  return out;
}

/**
 * Live work with no rung beneath it, offered to the hat that owns it.
 *
 * Leaves are excluded because they ARE the bottom — offering a task's owner the chance to decompose
 * it would be an opening nothing could close, and this drive has already produced two of those.
 *
 * The children are NOT invented here. The opening says one rung is missing; how many children and
 * what they are called is the answering hat's business, and a deterministic driver answers with
 * one. That is the same division as every other opening: the register finds the gap, the hat fills
 * it.
 */
export function breakdownOpenings(
  chart: OrgChart,
  cascade: readonly CascadeNode[],
  resourceAuthorityHatId: string,
  alreadyRaised: ReadonlySet<string>,
): readonly GenerativeOpening[] {
  const hasChild = new Set(cascade.map((n) => n.parentWorkId).filter((id): id is string => id !== undefined));
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(node)) continue;
    if (hasChild.has(node.workId)) continue;
    // ONE GUARD FOR THE BOTTOM OF THE LADDER, not two. This read `if (isLeafType(...)) continue;`
    // first, and a mutation run showed that deleting it killed nothing: `nextRung` already returns
    // undefined for every leaf type, so the check was dead code sitting exactly where a
    // load-bearing one appears to be. A second guard that cannot fail is not defence in depth, it
    // is a reader's false impression that something is being checked here twice.
    const rung = nextRung(node.workType);
    if (rung === undefined) continue;

    // ASKED OF THE SAME FUNCTION `decompose` WILL ASK. Offering a breakdown the effect path would
    // refuse is the livelock this drive has now produced three times, and the third was this verb:
    // 257 choices for 31 successful breakdowns, the rest refused every round for a hat the chart
    // does not have.
    // EQUIVALENT TO `rung.workType === Task` TODAY, and recorded rather than left unexplained: a
    // mutation run swapping the two killed nothing, because `CASCADE_RUNGS` has exactly one leaf
    // entry so `nextRung` can only ever hand back `task`. `isLeafType` is kept because it says what
    // is being asked — is this the bottom — and stays right if the ladder ever ends somewhere else,
    // which the `===` spelling would not. Same expression as `decompose`'s, deliberately.
    const mustSupport = isLeafType(rung.workType) ? ("individual_contributor" as const) : nextRung(rung.workType)?.ownerLevel;
    const owner = ownerForRung(chart, rung.ownerLevel, node.ownerHatId, mustSupport, node.domain);
    if (owner === undefined) {
      // AND THE REFUSAL IS NOT DISCARDED. Work that cannot be broken down for want of a hat is a
      // SUPPLY gap, which is a different hat's act — so the organization notices it cannot staff a
      // rung and routes that to the RMO rather than retrying forever and reporting nothing.
      //
      // Keyed on the missing RUNG, not on the work item: forty-seven items stuck behind one absent
      // manager are one gap, and forty-seven identical requests would bury it.
      const subjectId = `rung:${node.ownerHatId}:${rung.ownerLevel}`;
      if (alreadyRaised.has(subjectId)) continue;
      if (out.some((o) => o.subjectId === subjectId)) continue;
      if (chart.byId.get(resourceAuthorityHatId) === undefined) continue;
      out.push({
        kind: GenerativeKind.SizeHatSupply,
        byHatId: resourceAuthorityHatId,
        prompt: `no ${rung.ownerLevel} hat reports up to '${node.ownerHatId}'`,
        subjectId,
        ...(node.domain === undefined ? {} : { domain: node.domain }),
        because: `'${node.workId}' is a live ${node.workType} that cannot be broken down`,
      });
      continue;
    }
    out.push({
      kind: GenerativeKind.BreakDownWork,
      byHatId: node.ownerHatId,
      prompt: `what has to happen for '${node.title}'?`,
      subjectId: node.workId,
      ...(node.domain === undefined ? {} : { domain: node.domain }),
      because: `'${node.workId}' is a live ${node.workType} with nothing under it`,
    });
  }
  return out;
}

export interface GenerativeInput {
  readonly chart: OrgChart;
  readonly cascade: readonly CascadeNode[];
  readonly artifactIds: ReadonlySet<string>;
  readonly pricedWorkIds: ReadonlySet<string>;
  readonly resourceAuthorityHatId: string;
  readonly routings?: readonly DomainRouting[];
  /**
   * Supply gaps this organization has ALREADY been told about.
   *
   * Without it the RMO is offered the same gap every round for as long as the gap exists — and it
   * exists until somebody creates a hat, which no tick can do. Measured before this parameter
   * existed: `size_hat_supply` chosen 2199 times across 18 rounds, changing nothing and refusing
   * nothing. That is the livelock `drive-livelock.test.ts` was written for, reintroduced by the
   * change that was supposed to make this organization generative.
   *
   * You raise a gap ONCE. The same rule, and the same fix, as `unraisedBlockers`.
   */
  readonly raisedSupplySubjects?: ReadonlySet<string>;
}

/**
 * Every generative act open to one hat, ordinally.
 *
 * ORDINAL BY (kind, subject), not by which derivation ran first. A menu whose order depends on the
 * order the deriving functions are called in makes a deterministic driver's choice an artifact of
 * this file's layout, and this drive's `choose` defaults to taking the first item.
 */
export function generativeOpeningsFor(input: GenerativeInput, hatId: string): readonly GenerativeOpening[] {
  const raised = input.raisedSupplySubjects ?? new Set<string>();
  const all = [
    ...directionOpenings(input.chart, input.cascade),
    ...draftingOpenings(input.chart, input.cascade, input.artifactIds),
    ...priorityOpenings(input.chart, input.cascade, input.pricedWorkIds),
    ...supplyOpenings(input.chart, input.resourceAuthorityHatId, raised),
    ...outOfDomainOpenings(input.routings ?? [], input.resourceAuthorityHatId, raised),
    ...breakdownOpenings(input.chart, input.cascade, input.resourceAuthorityHatId, raised),
  ];
  return all
    .filter((o) => o.byHatId === hatId)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
      return a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0;
    });
}
