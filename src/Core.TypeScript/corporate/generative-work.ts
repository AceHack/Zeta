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
import {
  accountableHatsFor,
  isLeafType,
  nextRung,
  ownerForRung,
  liveWorkSet,
  supportRequirementFor,
  WorkType,
  type CascadeNode,
} from "./goal-cascade";
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
import { escalationDeciderFor } from "./escalation";
import { financeAuthorities, type SpendProposal } from "./spend-decision";

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
  /**
   * Say the work is finished, and let the organization decide whether it is.
   *
   * The last thing `org-cycle.ts` could do that a tick could not, and the reason a cadence's later
   * days had nothing but restatements in them: work was created, staffed, documented and priced,
   * and never completed. A company that cannot finish anything has no second week — every domain
   * stays occupied by its first goal forever, so the C-suite is never asked what is next.
   */
  SubmitWork: "submit_work",
  /**
   * Decide what to DO about work that keeps coming back from the gates.
   *
   * The last act `org-cycle.ts` could perform that a tick could not, and the writer for a reader
   * the drive already had: bounding resubmission and reporting exhaustion as a blocker told
   * somebody the work was stuck and left the deciding to a script. `escalation.ts` chooses between
   * adding agents, bringing in an architect, re-scoping, pausing and the rest, from the legal set
   * for this trigger and this level — a manager's act, on a manager's menu.
   */
  EscalateChurn: "escalate_churn",
  /**
   * Get the chain accountable for a piece of work into one room.
   *
   * The last of `org-cycle.ts`'s phases a tick could not reach. The drive could convene over a
   * DIVERGED ARTIFACT — two heads and no agreed version — and that is a repair, not a plan. A
   * booking across every accountable level's calendar, before the work is in trouble, is the act
   * that makes the levels of this chart address each other rather than merely report upward.
   */
  ConveneChain: "convene_chain",
  /**
   * Rule on money: is paying worth it, or is there a free way?
   *
   * The CFO's own act. Every other verb here disposes of PEOPLE and TIME; this one disposes of
   * money, and it is the only decision in the register whose first question is whether it should be
   * made at all — `spend-decision.ts` refuses to rule on a proposal where nobody looked for an
   * open-source or already-owned answer.
   */
  DecideSpend: "decide_spend",
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
  /**
   * For `set_direction`, whether this REPLACES a direction that already exists.
   *
   * An explicit flag rather than "the register will notice the id is taken", because a restatement
   * and a first statement are different acts by different rules — and the version of this that
   * inferred it would have been a silent overwrite, which this register has already shipped once.
   */
  readonly restates?: boolean;
  /** Why this is open — the gap that was measured, in the words of whatever measured it. */
  readonly because: string;
}

/**
 * How often a direction must be restated, and what time it is.
 *
 * Both, or neither. A `nowMs` with no interval cannot say what is old and an interval with no
 * `nowMs` cannot say when — so they travel together, exactly as `OrgView.assigned` carries its
 * clock beside its heartbeats for the same reason.
 */
export interface DirectionClock {
  readonly nowMs: number;
  readonly reviewIntervalMs: number;
}

/**
 * Work that still counts as live.
 *
 * ── WHY THIS READS THE WHOLE SUBTREE ─────────────────────────────────────────
 * It used to be `state === Open || state === InProgress`, which is true of every goal this
 * organization has ever set — because nothing marks a goal done. `isDelivered` derives that from
 * the leaves and had no reader here, so a domain whose entire cascade was finished still looked
 * occupied, and the C-suite was never asked what to do next.
 *
 * Measured: over seven simulated days the organization delivered thirteen tasks and set ZERO new
 * directions. Days two through seven were sixteen restatements and nothing else — a company that
 * finishes its work and then has nothing to say about it.
 *
 * So completion rolls up by DERIVATION rather than by anybody writing a state: a node whose
 * children are all finished-with is not live, whatever its own row says. That is the same
 * discipline this register applies to `degraded`, `completeness` and `replayable` — the fact is
 * computed from what happened, never declared alongside it.
 *
 * IT ASKS `liveWorkSet`, NOT `deliveredSet`, and the difference is a defect that got as far as a
 * test. Delivered means the work SUCCEEDED, and a node whose children were all cancelled is
 * correctly not delivered — so asking that question left an abandoned cascade looking neither
 * finished nor live, and its domain stayed occupied forever by work nobody would ever do again.
 * Measured: a run where every ruling was PAUSE cancelled its way through three days and set zero
 * new directions.
 */
function isLive(live: ReadonlySet<string>, node: CascadeNode): boolean {
  return live.has(node.workId);
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
  // ABLE TO STAFF IT FIRST, then nearest, then ordinal. Three rules, each added because the one
  // before it produced a measurably wrong answer:
  //
  //   ordinal alone       -> all sixteen domains came out the CEO's, engineering included, because
  //                          "ceo" sorts before "cto". The alphabetical routing this whole register
  //                          was rewritten to end, reintroduced one module later.
  //   nearest, then ordinal -> operations came out the CFO's, because `cost_controller` sits in the
  //                          operations department and reports to the CFO — one hat, one level up,
  //                          beating the COO who is two away from the director that runs it. The
  //                          CFO's line contains no contributors at any depth, so every operations
  //                          direction it accepted was one nobody could do, reported week after
  //                          week as a rung gap.
  //
  // So the first question is whether this executive can reach anybody in the department who does
  // the work. A domain's direction belongs to the executive whose line can execute it; an executive
  // that cannot is not a nearer answer, it is a wrong one.
  const contributors = hatsAtLevel(chart, "individual_contributor").filter((h) => h.departmentId === departmentId);
  const staffs = (id: string): boolean => contributors.some((c) => c.id !== id && reportsUpTo(chart, c.id, id));

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
    .sort((a, b) => {
      const byStaffing = Number(staffs(b[0])) - Number(staffs(a[0]));
      if (byStaffing !== 0) return byStaffing;
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    })
    .map(([id]) => chart.byId.get(id))[0];
}

/**
 * Domains with nothing live in them, and who would say what they are for.
 *
 * A domain with no live work is not idle capacity; it is a part of the company nobody has pointed
 * anywhere. That is precisely the fact a C-suite exists to change, and until now the only thing
 * that could change it was a script.
 */
export function directionOpenings(
  chart: OrgChart,
  cascade: readonly CascadeNode[],
  clock?: DirectionClock,
): readonly GenerativeOpening[] {
  const live = liveWorkSet({ nodes: cascade });
  const occupiedDomains = new Set(
    cascade
      .filter((n) => isLive(live, n))
      .map((n) => n.domain)
      .filter((d): d is Domain => d !== undefined),
  );
  const out: GenerativeOpening[] = [];

  // ── A DIRECTION GOES STALE, WHICH IS WHAT MAKES THIS A CADENCE ───────────
  // Without this, direction is set once per domain and never revisited: the C-suite decides the
  // company's shape in round one and has nothing to say for the rest of its life. "Over a week the
  // C-suite will maintain and shift and adjust company direction" is a claim about TIME PASSING,
  // and nothing in this register could observe time passing until the goal carried a reading.
  //
  // NO CLOCK MEANS NO RESTATEMENTS, never a default interval. An organization that does not know
  // what time it is cannot know anything is old, and inventing a `now` here would make every
  // clockless caller's directions spontaneously stale.
  if (clock !== undefined) {
    for (const node of cascade) {
      if (node.workType !== WorkType.Goal) continue;
      if (!isLive(live, node)) continue;
      // A direction with no reading is not stale, it is UNDATED. Treating it as old would make the
      // first restatement a fact about the missing field rather than about the passage of time.
      if (node.directedAtMs === undefined) continue;
      if (clock.nowMs - node.directedAtMs < clock.reviewIntervalMs) continue;
      out.push({
        kind: GenerativeKind.SetDirection,
        byHatId: node.ownerHatId,
        // THE PROMPT MUST NOT QUOTE THE TITLE. A deterministic driver answers a prompt with the
        // prompt, so a restatement whose question embeds the current objective writes that
        // objective back inside the new one — measured at 363 characters and six levels of nesting
        // after a single simulated week, growing without bound. The question names the SUBJECT
        // instead, which is stable under any number of restatements.
        prompt: `is ${node.domain ?? node.workId} still pointed the right way?`,
        subjectId: node.workId,
        ...(node.domain === undefined ? {} : { domain: node.domain }),
        restates: true,
        because: `stated ${String(clock.nowMs - node.directedAtMs)}ms ago, and the review interval is ${String(clock.reviewIntervalMs)}ms`,
      });
    }
  }

  for (const domain of Object.values(Domain)) {
    if (occupiedDomains.has(domain)) continue;
    // ── DIRECTION IS PACED BY THE CALENDAR, NEVER BY THE ROUND LOOP ─────────
    //
    // Once delivery rolls up, a domain that finishes its cascade is empty again — and without this
    // it is handed a new direction on the very next round, which cascades, delivers, and empties
    // again. Measured: 162 goals and 643 work items in TWO simulated days, neither of which
    // settled. Not a livelock — every round did real work and refused nothing — but an organization
    // that re-plans itself eighty times a day is not one either.
    //
    // A company decides what it is for on a CLOCK. So a domain that has had a direction gets its
    // next one no sooner than one review interval after the last was stated.
    //
    // AND WITH NO CLOCK, IT GETS NONE. That is the honest reading rather than the convenient one:
    // an organization that cannot tell time cannot know an interval has passed, and setting a new
    // direction anyway would pace the company by how fast its loop happens to run — which is not a
    // pace at all. Clockless callers therefore see what they always saw: one direction per domain.
    const stamps = cascade
      .filter((n) => n.domain === domain && n.workType === WorkType.Goal)
      .map((n) => n.directedAtMs);
    if (stamps.length > 0) {
      if (clock === undefined) continue;
      // An UNDATED prior direction blocks too: it exists, and nothing can say how long ago it was
      // set. Treating unknown as "long enough" is the reading that manufactures a fact.
      if (stamps.some((t) => t === undefined)) continue;
      const latest = Math.max(...stamps.filter((t): t is number => t !== undefined));
      if (clock.nowMs - latest < clock.reviewIntervalMs) continue;
    }
    const executive = executiveOver(chart, departmentFor(domain));
    if (executive === undefined) continue;
    out.push({
      kind: GenerativeKind.SetDirection,
      byHatId: executive.id,
      prompt: `what should ${departmentFor(domain)} be working towards for ${domain}?`,
      // DERIVED FROM THE DOMAIN AND HOW MANY DIRECTIONS IT HAS ALREADY HAD.
      //
      // The domain alone was enough while a direction was set once and never finished. Now that
      // delivery rolls up, a domain whose cascade is complete reopens — and reusing the id would
      // have `acceptGoal` refuse a duplicate every round forever, which is this drive's recurring
      // livelock arriving through the very change meant to give the C-suite a second week.
      //
      // Still DERIVED rather than minted: the same gap in the same organization yields the same id,
      // so a re-offer within a round is the same opening rather than a new one.
      subjectId: `direction-${domain}-${String(cascade.filter((n) => n.domain === domain && n.workType === WorkType.Goal).length + 1)}`,
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
  const live = liveWorkSet({ nodes: cascade });
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(live, node)) continue;
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
  const live = liveWorkSet({ nodes: cascade });
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(live, node)) continue;
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
    // KEYED ON THE STRUCTURAL FACT, not on the work item. A fallback is a property of (this
    // domain, this department) — "engineering_management work keeps landing in architecture" — and
    // one report per work item buries it under a hundred copies of itself as the weeks run. The
    // same mistake was made twice before, for missing rungs and for hollow leads, and fixed the
    // same way both times; measured here at 42 reports for a handful of distinct facts.
    const subjectId = `domain-fallback:${r.domain}:${r.ownerDepartmentId}`;
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
  const live = liveWorkSet({ nodes: cascade });
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(live, node)) continue;
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
    // THE SAME QUESTION `decompose` ASKS, asked of the same function. This used to be a second copy
    // of the formula, and a mutation-free rewrite of the ladder made the two disagree — the menu
    // would have gone on offering breakdowns the effect path had started refusing, which is this
    // drive's recurring livelock arriving by a new route.
    const owner = ownerForRung(
      chart,
      rung.ownerLevel,
      node.ownerHatId,
      supportRequirementFor(rung.workType),
      node.domain,
    );
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

/**
 * Assigned leaf work its assignee believes is done.
 *
 * OFFERED TO THE ASSIGNEE, never to the owner: the hat that did the work is the only one that can
 * say it is finished, and the gates that follow are evaluated by everyone EXCEPT that hat. That
 * separation is `runGateChain`'s, and this offer is shaped so it cannot be sidestepped — an owner
 * who could submit its report's work would be proposing and approving in one act.
 *
 * `attempts` bounds the re-offer. A turned-back submission leaves the work OPEN, which would put
 * the same act back on the same menu next round — the livelock this drive has produced three times
 * — so the count is read from the organization and the opening closes when the bound is reached.
 * That bound is the churn threshold under another name, and reaching it is the escalation's cue
 * rather than a reason to keep trying.
 */
export function submissionOpenings(
  cascade: readonly CascadeNode[],
  attempts: ReadonlyMap<string, number>,
  maxAttempts: number,
): readonly GenerativeOpening[] {
  const live = liveWorkSet({ nodes: cascade });
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(live, node)) continue;
    if (!isLeafType(node.workType)) continue;
    if (node.assigneeHatId === undefined) continue;
    const tried = attempts.get(node.workId) ?? 0;
    if (tried >= maxAttempts) continue;
    out.push({
      kind: GenerativeKind.SubmitWork,
      byHatId: node.assigneeHatId,
      prompt: `submit '${node.title}' for review`,
      subjectId: node.workId,
      ...(node.domain === undefined ? {} : { domain: node.domain }),
      because:
        tried === 0
          ? `'${node.workId}' is assigned and open`
          : `'${node.workId}' came back from the gates ${String(tried)} time(s)`,
    });
  }
  return out;
}

/**
 * Work that reached the bottom of the ladder and has nobody to do it.
 *
 * ── THE MEASUREMENT ──────────────────────────────────────────────────────────
 * A full simulated week produced four tasks and delivered ONE. The other three sat open forever,
 * and nothing anywhere said why. The reason is a fact about the chart that nothing was reporting:
 *
 *   team_lead              -> 0 individual contributors
 *   mission_control_lead   -> 0
 *   customer_feedback_lead -> 0
 *   tech_lead              -> 2
 *
 * Tasks are owned at LEAD level — `CASCADE_RUNGS` says so — and three of the seed's four leads
 * supervise nobody. So `assignableBy` correctly offered nothing, the work correctly stayed
 * unassigned, and the organization looked settled while three quarters of what it had decided to do
 * was unstaffable. Every step right, the aggregate wrong, and silent: this register's whole subject.
 *
 * A DIFFERENT GAP FROM `breakdownOpenings`', and kept separate for that reason. That one is "no hat
 * exists at the rung below"; this is "the rung's hat exists and has nobody under it". Same owner —
 * the RMO — and different repairs, so collapsing them would report a hiring problem as a
 * reorganization one.
 */
export function staffingOpenings(
  chart: OrgChart,
  cascade: readonly CascadeNode[],
  resourceAuthorityHatId: string,
  alreadyRaised: ReadonlySet<string>,
): readonly GenerativeOpening[] {
  if (chart.byId.get(resourceAuthorityHatId) === undefined) return [];
  const live = liveWorkSet({ nodes: cascade });
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(live, node)) continue;
    if (!isLeafType(node.workType)) continue;
    if (node.assigneeHatId !== undefined) continue;
    const contributors = hatsAtLevel(chart, "individual_contributor").filter(
      (h) => h.id !== node.ownerHatId && reportsUpTo(chart, h.id, node.ownerHatId),
    );
    // WORK THAT SIMPLY HAS NOT BEEN ASSIGNED YET IS NOT A GAP. The owner has somebody and will
    // place it; reporting that as a shortfall would fire on the ordinary case, and a signal that
    // fires on the ordinary case stops being read.
    if (contributors.length > 0) continue;
    // Keyed on the OWNER, not the work item: every task a hollow lead owns is one hiring problem.
    const subjectId = `staff:${node.ownerHatId}`;
    if (alreadyRaised.has(subjectId)) continue;
    if (out.some((o) => o.subjectId === subjectId)) continue;
    out.push({
      kind: GenerativeKind.SizeHatSupply,
      byHatId: resourceAuthorityHatId,
      prompt: `no individual contributor reports up to '${node.ownerHatId}'`,
      subjectId,
      ...(node.domain === undefined ? {} : { domain: node.domain }),
      because: `'${node.workId}' is an open ${node.workType} nobody under '${node.ownerHatId}' can do`,
    });
  }
  return out;
}

/**
 * Work that has exhausted the gates and has not yet been escalated.
 *
 * ── ONE ESCALATION PER ITEM, AND THAT IS THE WHOLE BOUND ─────────────────────
 * An escalation whose effect `changes_the_input` gives the work another run at the gates. Offer a
 * second one and the pair becomes a pump: exhaust, escalate, reset, exhaust, escalate — real work
 * every round, refusing nothing, forever. This drive has produced that shape four times and it is
 * always the same mistake, so the guard is stated as a rule rather than discovered again: a hat
 * escalates a given item ONCE. If the changed input still cannot pass, the exhaustion blocker
 * stands and a human is the next reader.
 *
 * DECIDED BY A MANAGER OR ABOVE — `escalationDeciderFor` walks up from the owner until it finds a
 * level that holds the authority, and `decideEscalation` refuses anyone who does not. The owner
 * deciding its own escalation would be the churn assessing itself.
 */
export function escalationOpenings(
  chart: OrgChart,
  cascade: readonly CascadeNode[],
  gates: { readonly attempts: ReadonlyMap<string, number>; readonly maxAttempts: number },
  alreadyEscalated: ReadonlySet<string>,
): readonly GenerativeOpening[] {
  const live = liveWorkSet({ nodes: cascade });
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(live, node)) continue;
    if ((gates.attempts.get(node.workId) ?? 0) < gates.maxAttempts) continue;
    if (alreadyEscalated.has(node.workId)) continue;
    const decider = escalationDeciderFor(chart, node.ownerHatId);
    if (decider === undefined) continue;
    out.push({
      kind: GenerativeKind.EscalateChurn,
      byHatId: decider.id,
      prompt: `'${node.title}' keeps coming back from the gates — what changes?`,
      subjectId: node.workId,
      ...(node.domain === undefined ? {} : { domain: node.domain }),
      because: `'${node.workId}' has spent all ${String(gates.maxAttempts)} of its gate attempts`,
    });
  }
  return out;
}

/**
 * Staffed work whose accountable chain has never sat down together.
 *
 * ── OFFERED TO THE OWNER, ONCE, AND ONLY WHEN THERE IS A CHAIN ───────────────
 * `accountableHatsFor` walks from the work's own owner up to the goal's, so the attendee list is
 * derived from the cascade rather than chosen — the same discipline as every routing decision
 * here. A chain of one is not a meeting and is skipped: `scheduleMeeting` refuses a single
 * attendee, and offering an act the organization will refuse is the livelock this drive has
 * produced four times.
 *
 * ONCE, because a meeting that exists is a meeting that happened. The calendar is the record, so
 * the opening reads its own effect back rather than keeping a second list.
 */
export function meetingOpenings(
  chart: OrgChart,
  cascade: readonly CascadeNode[],
  alreadyMet: ReadonlySet<string>,
): readonly GenerativeOpening[] {
  const live = liveWorkSet({ nodes: cascade });
  const out: GenerativeOpening[] = [];
  for (const node of cascade) {
    if (!isLive(live, node)) continue;
    if (!isLeafType(node.workType)) continue;
    // STAFFED WORK ONLY. A chain convening over work nobody is doing yet is a meeting about an
    // intention, and the rung below it has not been decided.
    if (node.assigneeHatId === undefined) continue;
    if (alreadyMet.has(node.workId)) continue;
    const attendees = accountableHatsFor({ nodes: cascade }, node.workId);
    if (attendees.length < 2) continue;
    if (attendees.some((id) => chart.byId.get(id) === undefined)) continue;
    out.push({
      kind: GenerativeKind.ConveneChain,
      byHatId: node.ownerHatId,
      prompt: `walk '${node.title}' through with the ${String(attendees.length)} levels accountable for it`,
      subjectId: node.workId,
      ...(node.domain === undefined ? {} : { domain: node.domain }),
      because: `'${node.workId}' is staffed and its accountable chain has not met`,
    });
  }
  return out;
}

/**
 * Spend nobody has ruled on, offered to the hats that hold the money.
 *
 * DERIVED FROM `blocker-taxonomy`, not declared: that policy already names who owns
 * `budget_exceeded` — the CFO first — and reading it beats a second answer that could disagree.
 * Offered to the most specific authority the chart has, and never to the hat that proposed the
 * spend: `decideSpend` refuses self-approval, and the menu must not offer what the organization
 * will refuse.
 */
export function spendOpenings(
  chart: OrgChart,
  cascade: readonly CascadeNode[],
  priced: ReadonlySet<string>,
  proposals: readonly SpendProposal[],
  alreadyRuled: ReadonlySet<string>,
): readonly GenerativeOpening[] {
  const live = liveWorkSet({ nodes: cascade });
  const authorities = financeAuthorities(chart);
  const out: GenerativeOpening[] = [];
  for (const proposal of proposals) {
    if (alreadyRuled.has(proposal.proposalId)) continue;
    // A COST THAT IS NOT A COST IS NOT A PROPOSAL. `decideSpend` refuses it rather than ruling —
    // there is no proposer to hand a malformed number back to — so offering it would be an act the
    // organization turns away, and a refused act leaves its own opening standing. That is this
    // drive's recurring livelock, and it has now arrived by five different routes.
    if (!Number.isFinite(proposal.cost) || proposal.cost <= 0) continue;

    // ── UNPRICED WORK IS NOT-YET, NOT A FAULT ───────────────────────────────
    // `decideSpend` cannot weigh worth against work nobody has valued, and it hands such a proposal
    // back to whoever raised it. But in a drive the price arrives a tick or two later — the CFO
    // ticks before the supervisor who sets it — so offering here returned proposals the
    // organization was about to be able to rule on properly. Measured: two of three sent back for
    // "no decided priority", both of which had a real answer waiting one round away.
    //
    // So the offer WAITS. Work that exists and is not yet priced is simply not ready to be ruled
    // on, and waiting is what the organization would do.
    // ── WAIT FOR A PRICE, UNLESS THERE IS NOTHING LEFT TO WAIT FOR ─────────
    // A proposal that arrives before its work does — which is every proposal in a drive that starts
    // from an empty cascade — waits rather than being handed straight back.
    //
    // But only while the work is still LIVE. Pricing is offered on live work alone, so a proposal
    // whose goal completed before anybody got to it would wait for something that will never
    // happen. Measured: a memory-tooling proposal sat through three simulated days while its goal
    // was decomposed, delivered and superseded twice. Finished work is ruled on, and the ruling is
    // that there is nothing left to buy for.
    //
    // AND WORK THAT DOES NOT EXIST YET ALSO WAITS. Every proposal in a drive that starts empty
    // names work the first round has not created — offering them produced three rulings of "not
    // work this organization holds" on the opening tick, for goals that appeared moments later.
    //
    // HONEST LIMIT: a proposal naming work that NEVER appears therefore waits forever. It is not
    // lost — `run-org --week` reports it by difference against the rulings — but nothing in the
    // organization raises it, and telling "not yet" from "never" needs a clock this opening does
    // not have. `decideSpend` still rules on it if called directly, which is where that guard lives.
    const exists = cascade.some((n) => n.workId === proposal.workId);
    if (!exists) continue;
    if (!priced.has(proposal.workId) && live.has(proposal.workId)) continue;
    const decider = authorities.find((h) => h.id !== proposal.proposedByHatId);
    if (decider === undefined) continue;
    out.push({
      kind: GenerativeKind.DecideSpend,
      byHatId: decider.id,
      prompt: `is '${proposal.what}' worth ${String(proposal.cost)}, or is there a free way?`,
      subjectId: proposal.proposalId,
      because: `'${proposal.proposalId}' proposes spending on '${proposal.workId}' and nobody has ruled`,
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
  /** Absent means no direction is ever revisited — see `directionOpenings`. */
  readonly directionClock?: DirectionClock;
  /**
   * How many times each work item has been through the gates, and how many times it may be.
   *
   * ABSENT MEANS NOTHING IS EVER SUBMITTED. A register that does not track attempts cannot bound
   * them, and offering an unbounded submission is offering a loop — so the honest default is to
   * offer nothing rather than to assume a bound nobody set.
   */
  readonly gates?: { readonly attempts: ReadonlyMap<string, number>; readonly maxAttempts: number };
  /** Work items a manager has already ruled on. See `escalationOpenings` for why one is the bound. */
  readonly escalated?: ReadonlySet<string>;
  /**
   * Work whose accountable chain has already met.
   *
   * Absent means NO MEETING IS EVER CONVENED, the same honest default as the gate counts: a
   * register that cannot tell whether a meeting happened cannot offer to hold one without offering
   * it again every round.
   */
  readonly met?: ReadonlySet<string>;
  /**
   * Money somebody has asked to spend, and what has already been ruled on.
   *
   * Absent means NO SPEND DECISION IS OFFERED. The register does not invent costs — a proposal is
   * something a hat or an operator raises, exactly as a blocker is — so having none is the ordinary
   * state of an organization nobody has asked to buy anything.
   */
  readonly spend?: { readonly proposals: readonly SpendProposal[]; readonly ruled: ReadonlySet<string> };
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
    ...directionOpenings(input.chart, input.cascade, input.directionClock),
    ...draftingOpenings(input.chart, input.cascade, input.artifactIds),
    ...priorityOpenings(input.chart, input.cascade, input.pricedWorkIds),
    ...supplyOpenings(input.chart, input.resourceAuthorityHatId, raised),
    ...outOfDomainOpenings(input.routings ?? [], input.resourceAuthorityHatId, raised),
    ...breakdownOpenings(input.chart, input.cascade, input.resourceAuthorityHatId, raised),
    ...staffingOpenings(input.chart, input.cascade, input.resourceAuthorityHatId, raised),
    ...(input.gates === undefined
      ? []
      : submissionOpenings(input.cascade, input.gates.attempts, input.gates.maxAttempts)),
    ...(input.gates === undefined
      ? []
      : escalationOpenings(input.chart, input.cascade, input.gates, input.escalated ?? new Set<string>())),
    ...(input.met === undefined ? [] : meetingOpenings(input.chart, input.cascade, input.met)),
    ...(input.spend === undefined
      ? []
      : spendOpenings(
          input.chart,
          input.cascade,
          input.pricedWorkIds,
          input.spend.proposals,
          input.spend.ruled,
        )),
  ];
  return all
    .filter((o) => o.byHatId === hatId)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
      return a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0;
    });
}
