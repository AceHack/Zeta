/**
 * corporate/goal-cascade.ts — a company goal reaching a dev, one accountable rung at a time.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * The canonical package's work items (`backlog/new-workitem.ts`, `work-items/types.ts`) are FLAT:
 * `type` is `"task" | "bug"`, there is no parent pointer, and no work item names an owner. So there
 * was no way to express the thing the corporate register is built around — that a goal held by the
 * C-suite decomposes into initiatives held by directors, projects held by managers, and tasks held
 * by leads, each rung accountable to the one above.
 *
 * Without the edge, "the organization is working on the goal" is an assertion nobody can check, and
 * "the goal is done" is a state someone sets rather than a fact about the work beneath it.
 *
 * ── THE LADDER ───────────────────────────────────────────────────────────────
 *
 *   goal        → C-suite      direction and portfolio priority
 *   initiative  → Director     the department that will carry it
 *   project     → Manager      staffing and sequencing
 *   task        → Lead         short-cycle work sequencing
 *   (execution) → Individual Contributor, by assignment — not a rung
 *
 * The IC is deliberately NOT a rung. A rung is a unit of work that decomposes; an IC does not
 * decompose a task, it does it. Modelling execution as a fifth rung would produce a work item per
 * dev per task that nobody ever closes separately from the task itself.
 *
 * ── OWNERSHIP IS DERIVED, NOT ASSIGNED ───────────────────────────────────────
 * A child's owner must REPORT UP to its parent's owner, walked over the same `reportsTo` edges the
 * chart is validated on. A cascade whose rungs are not connected in the supervisor graph is an org
 * chart drawn twice that agrees by luck — the tree would look right while describing a reporting
 * line that does not exist, and every escalation along it would route into another department.
 */

import {
  hatsAtLevel,
  reportsUpTo,
  supervisorChainOf,
  type HatLevel,
  type OrgChart,
  type OrgHat,
} from "./org-chart";
import { departmentFor, type Domain } from "./domain-ontology";

/** The kinds of work in the cascade. Ordered top-down. */
export const WorkType = {
  Goal: "goal",
  Initiative: "initiative",
  Project: "project",
  // ── THE LEAF TYPES ─────────────────────────────────────────────────────────
  // The bottom rung is not one shape. The reference's own ladder ends at
  // *"Task / Defect / Capability Request / Review / Incident"*, and collapsing them into `Task`
  // destroyed a distinction the organization had ALREADY MADE: `intake.ts` classified an inbound
  // event as a defect, an incident, a service request or a feature, and then mapped all four onto
  // `Task`. A defect needs reproduction evidence and a fix flow, an incident needs a restoration
  // time — and with one leaf type neither is expressible, so MTTR was not merely unmeasured, it was
  // unmeasurable in principle.
  Task: "task",
  Defect: "defect",
  CapabilityRequest: "capability_request",
  Review: "review",
  Incident: "incident",
} as const;

export type WorkType = (typeof WorkType)[keyof typeof WorkType];

/**
 * The types that sit at the bottom rung — executable by an assignee, never decomposed.
 *
 * A SET rather than a check against `Task`, because every place that asked "is this a task" meant
 * "is this a leaf", and the two stopped being the same thing the moment a second leaf type existed.
 */
export const LEAF_TYPES: readonly WorkType[] = [
  WorkType.Task,
  WorkType.Defect,
  WorkType.CapabilityRequest,
  WorkType.Review,
  WorkType.Incident,
];

export function isLeafType(workType: WorkType): boolean {
  return LEAF_TYPES.includes(workType);
}

export const WorkState = {
  Open: "open",
  InProgress: "in_progress",
  Done: "done",
  Canceled: "canceled",
} as const;

export type WorkState = (typeof WorkState)[keyof typeof WorkState];

export interface CascadeRung {
  readonly workType: WorkType;
  readonly ownerLevel: HatLevel;
}

/**
 * The ladder, top-down. Index is depth.
 *
 * ── THE RUNG ORDER, AND WHY IT DIFFERS FROM THE REFERENCE ────────────────────
 * The reference's product shape reads
 *
 *     Goal -> Project -> Initiative -> Work Item -> Task / Defect / ...
 *
 * which puts `Project` ABOVE `Initiative`; this ladder has them the other way round. That looks
 * like a straight contradiction and is not one, because the two documents are using the top arrow
 * for different KINDS of edge.
 *
 * The reference defines a Project as a *"long-lived product, platform, repo family, customer area,
 * or internal system"*. A long-lived product CANNOT be the child of a single goal: goals are
 * accepted and delivered while the product persists across all of them, so `Goal -> Project` there
 * is an ASSOCIATION — this goal concerns that product — not a decomposition. Its `Initiative`, a
 * *"prioritized body of work with owner, scope, budget, required gates"*, is the first rung that
 * actually decomposes.
 *
 * This cascade models decomposition edges ONLY: every node has one parent, and delivery rolls up
 * from the leaves (`isDelivered`). Under that reading the ladder is goal -> initiative -> project
 * -> leaf, where `project` means a unit of delivery inside an initiative rather than a long-lived
 * container. The vocabularies reconcile as:
 *
 *   | here        | reference        |
 *   |-------------|------------------|
 *   | goal        | Goal             |
 *   | initiative  | Initiative       |
 *   | project     | Work Item        |
 *   | leaf types  | Task / Defect / Capability Request / Review / Incident |
 *   | (nothing)   | **Project** — the long-lived container |
 *
 * So the real divergence is not an inverted pair; it is a MISSING RUNG. There is no long-lived
 * container above goals here, and adding one is a portfolio concern rather than a fix to this
 * ladder — recorded as an open gap rather than papered over by renaming a rung that already means
 * something else.
 */
export const CASCADE_RUNGS: readonly CascadeRung[] = [
  { workType: WorkType.Goal, ownerLevel: "c_suite" },
  { workType: WorkType.Initiative, ownerLevel: "director" },
  { workType: WorkType.Project, ownerLevel: "manager" },
  { workType: WorkType.Task, ownerLevel: "lead" },
];

export function rungFor(workType: WorkType): CascadeRung | undefined {
  // Every leaf type shares the bottom rung and its owner level. Looking up by exact type would
  // leave a defect with no rung at all, which reads as "unknown work" rather than "a leaf".
  if (isLeafType(workType)) return CASCADE_RUNGS[CASCADE_RUNGS.length - 1];
  return CASCADE_RUNGS.find((r) => r.workType === workType);
}

/** The rung below `workType`, or undefined at the bottom of the ladder. */
export function nextRung(workType: WorkType): CascadeRung | undefined {
  // A leaf has nothing below it, whichever leaf type it is.
  if (isLeafType(workType)) return undefined;
  const i = CASCADE_RUNGS.findIndex((r) => r.workType === workType);
  return i < 0 ? undefined : CASCADE_RUNGS[i + 1];
}

export interface CascadeNode {
  readonly workId: string;
  readonly workType: WorkType;
  readonly title: string;
  readonly state: WorkState;
  /** The hat accountable for THIS rung. */
  readonly ownerHatId: string;
  /** Absent only for a goal. */
  readonly parentWorkId?: string;
  /** The IC doing it. Only meaningful on a task. */
  readonly assigneeHatId?: string;
  /**
   * What this work is ABOUT — the fact the chart never carried.
   *
   * Optional, because a cascade without one behaves exactly as it always did. Present, it decides
   * which department the owner is drawn from, which is the difference between a product initiative
   * reaching a product director and reaching whichever director sorts first.
   *
   * Children INHERIT it unless they state their own: a project under a product initiative is
   * product work until somebody says otherwise, and making every caller repeat it would guarantee
   * the one that forgot routes alphabetically again.
   */
  readonly domain?: Domain;
  /**
   * When this direction was last STATED. Only meaningful on a goal.
   *
   * Optional because a cascade assembled without a clock has no honest value to put here, and a
   * default would be a lie the staleness check then reads as fact. Absent means nothing can say
   * this direction is old — which is exactly right for an organization that does not know what
   * time it is, and is why `directionOpenings` offers no restatements without a clock.
   */
  readonly directedAtMs?: number;
}

export interface Cascade {
  readonly nodes: readonly CascadeNode[];
}

export const EMPTY_CASCADE: Cascade = { nodes: [] };

export type CascadeResult =
  | { readonly ok: true; readonly cascade: Cascade }
  | { readonly ok: false; readonly reason: string };

export function nodeById(cascade: Cascade, workId: string): CascadeNode | undefined {
  return cascade.nodes.find((n) => n.workId === workId);
}

export function childrenOf(cascade: Cascade, workId: string): readonly CascadeNode[] {
  return cascade.nodes.filter((n) => n.parentWorkId === workId);
}

/**
 * The hat that should own a rung beneath `parentHatId`.
 *
 * Candidates are the hats at `level` that report up to the parent. They are ranked by distance in
 * the reporting line — closest first, which is the hat a real organization would hand it to.
 *
 * `mustSupportLevel` breaks the ties, and it is not a refinement: without it this function picks an
 * owner who cannot carry the rung BELOW, and the cascade dies one step after committing to them.
 * Found by running it — under this chart the CTO has three directors at equal distance, and the
 * first by declaration order (`architecture_director`) has no manager beneath it, so every goal
 * accepted by the CTO decomposed into an initiative that could never become a project. The plan
 * looked staffed and was not.
 *
 * So among the nearest candidates, prefer one that actually has a team at the next level. That is
 * still derived from the graph — "give it to a director who has managers" is what an organization
 * does, not a special case about any particular hat.
 *
 * When NONE of them can support the next rung, the nearest is still returned rather than
 * `undefined`: the honest failure is the specific refusal at the next `decompose` ("no manager hat
 * reports up to X"), which names the real gap, rather than a vaguer one here about a rung that has
 * not been reached yet.
 */
/**
 * What an owner of `workType` must be able to reach, if anything.
 *
 * EXPORTED BECAUSE TWO CALLERS NEED IT AND THERE MAY ONLY BE ONE ANSWER. `decompose` asks it to
 * pick an owner, and `generative-work.breakdownOpenings` asks it to decide whether to OFFER the
 * decomposition at all — and the menu's own rule is that it must never offer an act the
 * organization will refuse. When the two computed it separately they disagreed the moment one
 * changed, and the disagreement is silent in the worse direction: an opening offered for a rung the
 * effect path then refuses, which is this drive's recurring livelock.
 *
 * Only a LEAF carries a requirement, and it is that the owner can reach a contributor. A non-leaf
 * owner needs nothing: with a ladder that bends, a director with no manager and no lead owns its
 * own projects and its own tasks.
 */
export function supportRequirementFor(workType: WorkType): HatLevel | undefined {
  return isLeafType(workType) ? "individual_contributor" : undefined;
}

/**
 * The levels that can OWN a rung of the cascade, most senior first.
 *
 * An individual contributor is deliberately absent. An IC EXECUTES work — it is the assignee — and
 * a task owned by one could never be assigned, because `assignableBy` looks for contributors
 * BENEATH the owner and an IC has none. Ownership and execution are different jobs, and the ladder
 * is about the first.
 */
const OWNING_LEVELS: readonly HatLevel[] = ["executive_board", "c_suite", "director", "manager", "lead"];

/** Can this hat actually reach somebody at `level`? */
function reaches(chart: OrgChart, hat: OrgHat, level: HatLevel): boolean {
  return hatsAtLevel(chart, level).some((c) => c.id !== hat.id && reportsUpTo(chart, c.id, hat.id));
}

/**
 * Who owns the next rung down — searched against the chart the organization ACTUALLY HAS.
 *
 * ── THE MEASUREMENT THAT FORCED THE LADDER TO BEND ───────────────────────────
 * `CASCADE_RUNGS` names one owner level per work type: initiative to director, project to manager,
 * task to lead. That is a six-level organization, and this one is not. Counted across the seeded
 * chart's sixteen departments:
 *
 *   - **six directors have no manager beneath them** (architecture, security, documentation,
 *     observability, the RMO, the policy steward)
 *   - **nine managers have no lead beneath them**
 *   - **only four departments have a lead rung at all**
 *
 * Most departments are director then contributors, directly. That is not a defect in the seed; it
 * is what the reference organization looks like, and inventing an `architecture_manager` to satisfy
 * a table would be fabricating an org chart to make a loop terminate.
 *
 * So the LADDER bends. A rung with nobody at its nominal level is owned by the nearest supervisory
 * level below it, and failing that BY THE PARENT ITSELF — a director with no manager owns its own
 * projects, which is exactly what happens in a small department and exactly what the reference
 * shows. Accountability rolls up; it never evaporates.
 *
 * ── `mustSupportLevel` IS NOW A FILTER, NOT A TIE-BREAK ──────────────────────
 * It used to nudge the sort: a candidate that could carry the next rung sorted ahead of one that
 * could not, and one that could not still won when it was alone. That produced owners who could
 * staff nothing — the failure surfaced a rung later as an assignment refusal naming a hat nobody
 * had chosen. As a filter it makes the search DESCEND instead: if nobody at this level can reach a
 * contributor, the rung belongs further down, and that is a question this function can answer
 * rather than one it should pass on.
 */
export function ownerForRung(
  chart: OrgChart,
  level: HatLevel,
  parentHatId: string,
  mustSupportLevel?: HatLevel,
  domain?: Domain,
): OrgHat | undefined {
  const start = OWNING_LEVELS.indexOf(level);
  const ladder = start < 0 ? [level] : OWNING_LEVELS.slice(start);

  for (const rung of ladder) {
    const candidates = hatsAtLevel(chart, rung).filter(
      (h) =>
        h.id !== parentHatId &&
        reportsUpTo(chart, h.id, parentHatId) &&
        (mustSupportLevel === undefined || reaches(chart, h, mustSupportLevel)),
    );
    if (candidates.length === 0) continue;

    // AMONG EQUALS, PREFER THE ONE THAT CAN DELEGATE FURTHER — a soft preference, not a rule.
    //
    // The first version of the bending ladder dropped this along with the hard requirement it used
    // to be, and a fixture caught the loss immediately: a domainless goal at the CTO went to
    // whichever director sorted first rather than to one with a team beneath it, and the task ended
    // up owned three levels higher than it needed to be. Delegating deeper is better than a
    // director doing the work itself, and it costs nothing to prefer.
    //
    // A PREFERENCE and not a filter, because in ten of the sixteen departments NOBODY satisfies it
    // — that is what made it wrong as a requirement, and it is still right as a tie-break.
    const below = OWNING_LEVELS[OWNING_LEVELS.indexOf(rung) + 1];

    // THE DOMAIN'S OWN DEPARTMENT FIRST, and only among candidates already in the delegating line.
    //
    // This is the whole fix `domain-ontology.ts` exists for: the chart says who reports to whom and
    // never said who does what, so a "ship checkout" initiative went to the Hat Approval Steward
    // because governance sorted first. Preferring the owning department makes the choice a property
    // of the WORK rather than of the alphabet.
    //
    // Falling back when the owning department is unreachable from this parent is deliberate and is
    // reported by `domainMatch` rather than swallowed — a CTO's goal genuinely cannot delegate to a
    // product director who reports to the CEO, and refusing there would stall real work over an
    // org-shape fact the caller cannot fix from the cascade.
    if (domain !== undefined) {
      const owningDept = departmentFor(domain);
      const inDomain = candidates.filter((h) => h.departmentId === owningDept);
      if (inDomain.length > 0) return best(chart, inDomain, parentHatId, below);
    }
    return best(chart, candidates, parentHatId, below);
  }

  // THE PARENT WEARS THE RUNG ITSELF, last and only when it can carry it.
  //
  // Not a consolation prize: in a department with no manager, the director IS the project owner,
  // and saying so is more honest than refusing the decomposition and reporting an organization that
  // cannot plan its own work. The support check still applies — an owner who cannot reach a
  // contributor cannot staff the work, and handing it to them would move the refusal one rung later
  // rather than answering it.
  const parent = chart.byId.get(parentHatId);
  if (parent === undefined) return undefined;
  // AND ONLY IF THE PARENT IS SENIOR ENOUGH TO WEAR IT. Caught by a falsifier the first version
  // failed: `ownerForRung(chart, "manager", "backend_implementer")` handed the manager rung to the
  // individual contributor itself. A hat wearing a rung ABOVE its own level is not a small
  // department improvising, it is the hierarchy inverting — and every guard downstream that asks
  // "does this owner outrank that one" would then be reasoning about a lie.
  const parentRank = OWNING_LEVELS.indexOf(parent.level);
  if (parentRank < 0 || parentRank > OWNING_LEVELS.indexOf(level)) return undefined;
  if (mustSupportLevel !== undefined && !reaches(chart, parent, mustSupportLevel)) return undefined;
  return parent;
}

/**
 * Nearest, then able to delegate further, then ORDINAL.
 *
 * `preferReach` is the level one rung below the one being filled. A candidate that can reach it
 * sorts ahead of one that cannot — but neither is excluded, because in most of this chart's
 * departments nobody can, and a requirement nobody satisfies is a gate that never opens. The HARD
 * requirement lives in `ownerForRung`'s filter and applies only to leaves.
 */
function best(
  chart: OrgChart,
  candidates: readonly OrgHat[],
  parentHatId: string,
  preferReach?: HatLevel,
): OrgHat | undefined {
  const distance = (h: OrgHat): number => supervisorChainOf(chart, h.id).indexOf(parentHatId);
  const delegates = (h: OrgHat): boolean => preferReach !== undefined && reaches(chart, h, preferReach);
  return [...candidates].sort((a, b) => {
    const byDistance = distance(a) - distance(b);
    if (byDistance !== 0) return byDistance;
    const byDelegation = Number(delegates(b)) - Number(delegates(a));
    if (byDelegation !== 0) return byDelegation;
    // STILL EQUAL: ORDINALLY, never by the order the seed happens to declare hats in.
    //
    // With eight departments there was usually one candidate and this never showed. At the
    // reference's sixteen there are many, and the winner was whichever the file listed first — so
    // two organizations of identical SHAPE picked different owners because someone reordered a
    // list.
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  })[0];
}

/**
 * Accept a company goal.
 *
 * Only the C-suite and the Executive Board may. A goal is the statement of company direction, and a
 * manager holding the intake tool would still not be setting it — the authority is what the rung
 * means, not a permission bit that happens to be attached.
 */
export function acceptGoal(
  cascade: Cascade,
  chart: OrgChart,
  input: {
    readonly workId: string;
    readonly title: string;
    readonly acceptingHatId: string;
    /**
     * What this direction is ABOUT.
     *
     * Optional, and its absence is why the first version of this compiled while dropping it: the
     * caller passed `domain` through a spread, TypeScript does not excess-property-check a spread,
     * and every descendant of the goal inherited nothing. A direction whose domain is silently lost
     * routes its whole branch alphabetically — the exact defect `domain-ontology.ts` exists to end,
     * reintroduced at the one verb that creates the branch.
     */
    readonly domain?: Domain;
    /** When the direction was stated. Absent means this organization has no clock. */
    readonly atMs?: number;
  },
): CascadeResult {
  const hat = chart.byId.get(input.acceptingHatId);
  if (hat === undefined) return { ok: false, reason: `unknown hat '${input.acceptingHatId}'` };
  if (hat.level !== "c_suite" && hat.level !== "executive_board") {
    return {
      ok: false,
      reason: `a goal is accepted at the top: '${hat.id}' is ${hat.level}, not c_suite or executive_board`,
    };
  }
  if (input.title.trim() === "") return { ok: false, reason: "a goal with no title states no direction" };
  if (nodeById(cascade, input.workId) !== undefined) {
    return { ok: false, reason: `duplicate work id '${input.workId}'` };
  }
  return {
    ok: true,
    cascade: {
      nodes: [
        ...cascade.nodes,
        {
          workId: input.workId,
          workType: WorkType.Goal,
          title: input.title,
          state: WorkState.Open,
          ownerHatId: hat.id,
          ...(input.domain === undefined ? {} : { domain: input.domain }),
          ...(input.atMs === undefined ? {} : { directedAtMs: input.atMs }),
        },
      ],
    },
  };
}

/**
 * Restate a direction — a new objective on an existing goal, and a new clock reading.
 *
 * A SEPARATE VERB, never `acceptGoal` quietly accepting a duplicate id. This register has already
 * shipped one silent overwrite (`assign` replacing an assignee) and the lesson was that the caller
 * who meant it and the caller who made a mistake are indistinguishable at the call site — so the
 * one who means it says so.
 *
 * The refusals are the same ones `acceptGoal` applies, because a restatement is a direction: it is
 * made at the top, and it says something.
 */
export function restateDirection(
  cascade: Cascade,
  chart: OrgChart,
  input: {
    readonly workId: string;
    readonly title: string;
    readonly byHatId: string;
    readonly atMs: number;
  },
): CascadeResult {
  const node = nodeById(cascade, input.workId);
  if (node === undefined) return { ok: false, reason: `no direction '${input.workId}' to restate` };
  if (node.workType !== WorkType.Goal) {
    return { ok: false, reason: `'${input.workId}' is a ${node.workType}, not a direction` };
  }
  const hat = chart.byId.get(input.byHatId);
  if (hat === undefined) return { ok: false, reason: `unknown hat '${input.byHatId}'` };
  if (hat.level !== "c_suite" && hat.level !== "executive_board") {
    return { ok: false, reason: `a direction is restated at the top: '${hat.id}' is ${hat.level}` };
  }
  // THE HAT THAT HOLDS IT. Any executive could otherwise redirect any other executive's domain,
  // which is not a hierarchy, and the chart already said who owns this one.
  if (node.ownerHatId !== input.byHatId) {
    return { ok: false, reason: `'${input.workId}' is held by '${node.ownerHatId}', not '${input.byHatId}'` };
  }
  if (input.title.trim() === "") return { ok: false, reason: "a restatement with no objective states nothing" };
  return {
    ok: true,
    cascade: {
      nodes: cascade.nodes.map((n) =>
        n.workId === input.workId ? { ...n, title: input.title, directedAtMs: input.atMs } : n,
      ),
    },
  };
}

/**
 * Decompose a node into the rung below it.
 *
 * REFUSES rather than inventing an owner. `ownerForRung` will bend the ladder — down the
 * supervisory levels, then to the parent itself — so by the time it comes back empty there is
 * genuinely nobody in this reporting line who can hold the work, and saying so is the honest
 * answer. Silently attaching it to whoever was nearest would produce a plan the organization cannot
 * execute and, worse, cannot detect that it cannot execute.
 *
 * In practice that leaves ONE cause, and the message names it: a LEAF whose line contains no
 * individual contributor. Every rung above a leaf can always fall back to the parent.
 */
export function decompose(
  cascade: Cascade,
  chart: OrgChart,
  parentWorkId: string,
  children: readonly {
    readonly workId: string;
    readonly title: string;
    readonly workType?: WorkType;
    readonly domain?: Domain;
  }[],
): CascadeResult {
  const parent = nodeById(cascade, parentWorkId);
  if (parent === undefined) return { ok: false, reason: `no work item '${parentWorkId}'` };

  const rung = nextRung(parent.workType);
  if (rung === undefined) {
    return {
      ok: false,
      reason: `a ${parent.workType} is the bottom rung — it is done by an assignee, not decomposed further`,
    };
  }
  if (children.length === 0) {
    // A decomposition into nothing is the shape that lets an organization report progress on work
    // it never created.
    return { ok: false, reason: `'${parentWorkId}' cannot decompose into zero children` };
  }

  // Pass the rung BELOW this one so the owner chosen can actually carry the rest of the ladder.
  // A LEAF'S OWNER MUST BE ABLE TO STAFF IT.
  //
  // `nextRung` is undefined for a leaf, so this passed `undefined` and every candidate "supported"
  // the next rung vacuously — the check that exists to stop an owner who cannot carry the work was
  // switched off at the one rung where the work is actually done. A leaf is executed by an
  // individual contributor (`assign` says so), so that is what its owner must have, and it is
  // derived from `isLeafType` rather than named as a special case.
  // ONLY THE LEAF RUNG CARRIES A SUPPORT REQUIREMENT NOW.
  //
  // It used to demand that a non-leaf owner be able to reach the NEXT RUNG'S level — that a project
  // owner have a lead beneath it, say. With a ladder that bends, that requirement is simply false:
  // a director with no manager and no lead owns its own projects and its own tasks, and its
  // contributors do the work. Keeping the demand would refuse decomposition in ten of the sixteen
  // departments to protect a rung structure the organization does not have.
  //
  // Read from `supportRequirementFor` rather than computed here, because the generative menu asks
  // the same question to decide whether to OFFER this act, and two copies of one rule disagree.
  const mustSupport = supportRequirementFor(rung.workType);
  // The children's domain decides who owns them. They all share one here — a decompose that mixed
  // domains would need one owner per domain, and that is a different verb (delegating ACROSS
  // departments) than splitting work within one.
  const childDomain = children.find((c) => c.domain !== undefined)?.domain ?? parent.domain;
  const owner = ownerForRung(chart, rung.ownerLevel, parent.ownerHatId, mustSupport, childDomain);
  if (owner === undefined) {
    return {
      ok: false,
      // NAMES THE REAL CAUSE, not the nominal rung. It used to read "no lead hat reports up to X",
      // which stopped being true the moment the ladder bent: the search descends past lead and past
      // the parent, so a reader chasing "we need a lead" was chasing a hat that would not have
      // helped. What is actually missing is somebody to DO the work.
      reason:
        mustSupport === undefined
          ? `nobody in '${parent.ownerHatId}'s line can own this ${rung.workType}, so it cannot be staffed`
          : `no ${mustSupport} reports up to '${parent.ownerHatId}', so this ${rung.workType} cannot be staffed`,
    };
  }

  const nodes = [...cascade.nodes];
  for (const child of children) {
    if (nodes.some((n) => n.workId === child.workId)) {
      return { ok: false, reason: `duplicate work id '${child.workId}'` };
    }
    if (child.title.trim() === "") return { ok: false, reason: `child of '${parentWorkId}' has no title` };
    // A child may name its own type, but ONLY within the rung it is being created at — otherwise a
    // caller could smuggle a goal in as the child of a project and invert the ladder.
    const childType = child.workType ?? rung.workType;
    const sameRung = isLeafType(rung.workType) ? isLeafType(childType) : childType === rung.workType;
    if (!sameRung) {
      return {
        ok: false,
        reason: `'${child.workId}' is a ${childType}, which does not belong at the ${rung.workType} rung`,
      };
    }
    const domain = child.domain ?? parent.domain;
    nodes.push({
      workId: child.workId,
      workType: childType,
      title: child.title,
      state: WorkState.Open,
      ownerHatId: owner.id,
      parentWorkId,
      ...(domain === undefined ? {} : { domain }),
    });
  }
  return { ok: true, cascade: { nodes } };
}

/**
 * Assign a task to the individual contributor who will do it.
 *
 * Only a task takes an assignee — the higher rungs are owned and decomposed, not executed. And the
 * assignee must report up to the task's owner: handing work to someone outside the line means the
 * owner cannot follow it up, and the assignee is answering to a hat that is not their supervisor.
 */
export function assign(
  cascade: Cascade,
  chart: OrgChart,
  workId: string,
  assigneeHatId: string,
): CascadeResult {
  const eligible = assignmentEligibility(cascade, chart, workId, assigneeHatId);
  if (!eligible.ok) return eligible;
  const node = eligible.node;
  // AN ASSIGNED ITEM IS NOT ASSIGNED AGAIN HERE. This overwrote the assignee silently, which is a
  // reassignment performed by whoever called first — no trigger, no notice to the previous owner,
  // no preservation of what it had already done. Taking work off a hat is `reassign` below, and it
  // is deliberately a different verb so that path cannot be reached by accident.
  if (node.assigneeHatId !== undefined && node.assigneeHatId !== assigneeHatId) {
    return {
      ok: false,
      reason: `'${workId}' is already assigned to '${node.assigneeHatId}' — reassignment is a controlled move`,
    };
  }
  return { ok: true, cascade: withAssignee(cascade, workId, assigneeHatId) };
}

/**
 * Move an ALREADY-ASSIGNED item to a different contributor.
 *
 * Every eligibility rule `assign` enforces still applies — leaf, IC, reports to the owner — and the
 * one thing that differs is that an existing assignee is permitted rather than refused. The caller
 * is expected to have established that the move is allowed (`work-stealing.ts`); this verb does not
 * re-derive that, it exists so the permitted move has a door of its own and the accidental one does
 * not.
 */
export function reassign(
  cascade: Cascade,
  chart: OrgChart,
  workId: string,
  toHatId: string,
): CascadeResult {
  const eligible = assignmentEligibility(cascade, chart, workId, toHatId);
  if (!eligible.ok) return eligible;
  if (eligible.node.assigneeHatId === undefined) {
    return { ok: false, reason: `'${workId}' has no assignee to take it from — use assign` };
  }
  return { ok: true, cascade: withAssignee(cascade, workId, toHatId) };
}

/**
 * The rules BOTH doors enforce: a leaf, an individual contributor, reporting up to the owner.
 *
 * Shared rather than restated, so `reassign` cannot drift into a laxer version of `assign` — which
 * is exactly how a controlled move becomes the uncontrolled one it replaced.
 */
function assignmentEligibility(
  cascade: Cascade,
  chart: OrgChart,
  workId: string,
  assigneeHatId: string,
): { readonly ok: true; readonly node: CascadeNode } | { readonly ok: false; readonly reason: string } {
  const node = nodeById(cascade, workId);
  if (node === undefined) return { ok: false, reason: `no work item '${workId}'` };
  if (!isLeafType(node.workType)) {
    return { ok: false, reason: `only a task is assigned to a contributor; '${workId}' is a ${node.workType}` };
  }
  const assignee = chart.byId.get(assigneeHatId);
  if (assignee === undefined) return { ok: false, reason: `unknown hat '${assigneeHatId}'` };
  if (assignee.level !== "individual_contributor") {
    return { ok: false, reason: `'${assigneeHatId}' is ${assignee.level}; work is executed by an individual contributor` };
  }
  if (!reportsUpTo(chart, assigneeHatId, node.ownerHatId)) {
    return {
      ok: false,
      reason: `'${assigneeHatId}' does not report up to '${node.ownerHatId}', the owner of '${workId}'`,
    };
  }
  return { ok: true, node };
}

function withAssignee(cascade: Cascade, workId: string, assigneeHatId: string): Cascade {
  return { nodes: cascade.nodes.map((n) => (n.workId === workId ? { ...n, assigneeHatId } : n)) };
}

/** Set a node's state directly. Only leaves may be set to `done` — see `isDelivered`. */
export function setState(cascade: Cascade, workId: string, state: WorkState): CascadeResult {
  const node = nodeById(cascade, workId);
  if (node === undefined) return { ok: false, reason: `no work item '${workId}'` };
  if (state === WorkState.Done && childrenOf(cascade, workId).length > 0) {
    // The rule that makes the edge load-bearing: a goal cannot be closed by closing the goal.
    return {
      ok: false,
      reason: `'${workId}' has children — it is delivered when they are, not by being marked done`,
    };
  }
  if (state === WorkState.Done && isLeafType(node.workType) && node.assigneeHatId === undefined) {
    return { ok: false, reason: `${node.workType} '${workId}' has no assignee — nobody did it` };
  }
  return {
    ok: true,
    cascade: { nodes: cascade.nodes.map((n) => (n.workId === workId ? { ...n, state } : n)) },
  };
}

/**
 * Is this node delivered?
 *
 * A leaf is delivered when its own state is `done`. An internal node is delivered when it HAS
 * children and every one of them is delivered, recursively — so the truth about a goal is a
 * function of the work beneath it rather than a claim made about it.
 *
 * A childless non-task is NOT delivered. Otherwise `every` over an empty list would report a goal
 * nobody decomposed as complete: vacuously true, and the most dangerous kind of green.
 *
 * Canceled children are skipped rather than counted as delivered — but a node whose children are
 * ALL canceled is not delivered, because nothing was done.
 */
export function isDelivered(cascade: Cascade, workId: string): boolean {
  const node = nodeById(cascade, workId);
  if (node === undefined) return false;
  const children = childrenOf(cascade, workId);
  if (children.length === 0) {
    // Only the bottom rung can be delivered on its own account. A goal with no initiatives is a
    // goal nobody started.
    return isLeafType(node.workType) && node.state === WorkState.Done;
  }
  const live = children.filter((c) => c.state !== WorkState.Canceled);
  if (live.length === 0) return false;
  return live.every((c) => isDelivered(cascade, c.workId));
}

/**
 * Every work id whose subtree is delivered, in ONE pass.
 *
 * `isDelivered` answers the same question per item and recurses to the leaves each time. That is
 * fine for a report and ruinous for a menu: the generative surface asks it of every node, for every
 * hat, in every round, so a cadence over a growing cascade went quadratic-and-worse and a seven-day
 * run stopped finishing. Same answer, computed once, memoised on the way up.
 *
 * The semantics are `isDelivered`'s, deliberately and not approximately — a childless node is
 * delivered only if it is a DONE leaf, and a node whose children are all cancelled is not delivered
 * at all. A faster function that answered a slightly different question would be the worse defect.
 */
export function deliveredSet(cascade: Cascade): ReadonlySet<string> {
  const children = new Map<string, CascadeNode[]>();
  for (const node of cascade.nodes) {
    if (node.parentWorkId === undefined) continue;
    const bucket = children.get(node.parentWorkId);
    if (bucket === undefined) children.set(node.parentWorkId, [node]);
    else bucket.push(node);
  }
  const memo = new Map<string, boolean>();
  const walk = (node: CascadeNode): boolean => {
    const known = memo.get(node.workId);
    if (known !== undefined) return known;
    // Guards a cascade whose parent links form a cycle. `buildOrgChart` refuses a cyclic chart and
    // nothing here builds one, but an unguarded recursion over caller-supplied data is a hang
    // waiting for the first malformed input, and a hang is the one failure a test cannot report.
    memo.set(node.workId, false);
    const kids = children.get(node.workId) ?? [];
    let result: boolean;
    if (kids.length === 0) {
      result = isLeafType(node.workType) && node.state === WorkState.Done;
    } else {
      const live = kids.filter((c) => c.state !== WorkState.Canceled);
      result = live.length > 0 && live.every((c) => walk(c));
    }
    memo.set(node.workId, result);
    return result;
  };
  const out = new Set<string>();
  for (const node of cascade.nodes) if (walk(node)) out.add(node.workId);
  return out;
}

/**
 * Every work id with something still to DO — a different question from `deliveredSet`.
 *
 * ── WHY BOTH EXIST, AND WHY CONFLATING THEM WAS A DEFECT ─────────────────────
 * `isDelivered` asks whether work SUCCEEDED, and answers no for a node whose children were all
 * cancelled — correctly, and there is a falsifier pinning it. The generative menu asked that
 * question when it meant a different one, so a goal whose entire cascade had been cancelled was
 * neither delivered nor live: its domain stayed occupied forever by work nobody would ever do
 * again, and the C-suite was never asked to point it somewhere else.
 *
 * Measured: a run where every gate rejected and every ruling was PAUSE cancelled its way through
 * three simulated days and set ZERO new directions.
 *
 * So the two are separate and named for what they answer. Delivered means it worked. Live means
 * somebody could still act on it:
 *
 *   - open or in-progress with NO children yet -> live (it needs breaking down)
 *   - open or in-progress with children        -> live only if some CHILD is live
 *   - done or cancelled                        -> not live, whichever it was
 *
 * A node whose children all finished and a node whose children were all abandoned are both
 * finished-with; the difference between them is what `deliveredSet` is for, and answering "did
 * this succeed" is never the same as answering "is there anything left".
 */
export function liveWorkSet(cascade: Cascade): ReadonlySet<string> {
  const children = new Map<string, CascadeNode[]>();
  for (const node of cascade.nodes) {
    if (node.parentWorkId === undefined) continue;
    const bucket = children.get(node.parentWorkId);
    if (bucket === undefined) children.set(node.parentWorkId, [node]);
    else bucket.push(node);
  }
  const memo = new Map<string, boolean>();
  const walk = (node: CascadeNode): boolean => {
    const known = memo.get(node.workId);
    if (known !== undefined) return known;
    // Cycle guard, for the same reason `deliveredSet` carries one: an unguarded recursion over
    // caller-supplied data is a hang waiting for the first malformed input, and a hang is the one
    // failure a test cannot report.
    memo.set(node.workId, false);
    let result: boolean;
    if (node.state === WorkState.Done || node.state === WorkState.Canceled) {
      result = false;
    } else {
      const kids = children.get(node.workId) ?? [];
      result = kids.length === 0 || kids.some((c) => walk(c));
    }
    memo.set(node.workId, result);
    return result;
  };
  const out = new Set<string>();
  for (const node of cascade.nodes) if (walk(node)) out.add(node.workId);
  return out;
}

/** The chain of work ids from `workId` up to its goal, self first. */
export function cascadeChainOf(cascade: Cascade, workId: string): readonly string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = workId;
  while (cursor !== undefined && !seen.has(cursor)) {
    if (nodeById(cascade, cursor) === undefined) break;
    chain.push(cursor);
    seen.add(cursor);
    cursor = nodeById(cascade, cursor)?.parentWorkId;
  }
  return chain;
}

/**
 * The hats accountable for a piece of work, from its own owner up to the goal's.
 *
 * This is the answer to "who is responsible for this task" that a flat work item could not give:
 * lead, then manager, then director, then C-suite — each named, each reachable.
 */
export function accountableHatsFor(cascade: Cascade, workId: string): readonly string[] {
  return cascadeChainOf(cascade, workId)
    .map((id) => nodeById(cascade, id)?.ownerHatId)
    .filter((id): id is string => id !== undefined);
}

/** Every task with no assignee — what the RMO is being asked to staff. */
export function unstaffedTasks(cascade: Cascade): readonly CascadeNode[] {
  return cascade.nodes.filter(
    (n) => isLeafType(n.workType) && n.assigneeHatId === undefined && n.state !== WorkState.Canceled,
  );
}
