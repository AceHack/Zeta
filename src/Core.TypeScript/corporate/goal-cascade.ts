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
export function ownerForRung(
  chart: OrgChart,
  level: HatLevel,
  parentHatId: string,
  mustSupportLevel?: HatLevel,
  domain?: Domain,
): OrgHat | undefined {
  const candidates = hatsAtLevel(chart, level).filter(
    (h) => h.id !== parentHatId && reportsUpTo(chart, h.id, parentHatId),
  );
  if (candidates.length === 0) return undefined;

  // THE DOMAIN'S OWN DEPARTMENT FIRST, and only among candidates already in the delegating line.
  //
  // This is the whole fix: the chart says who reports to whom and never said who does what, so a
  // "ship checkout" initiative went to the Hat Approval Steward because governance sorted first.
  // Preferring the owning department makes the choice a property of the WORK rather than of the
  // alphabet.
  //
  // Falling back when the owning department is unreachable from this parent is deliberate and is
  // reported by `domainMatch` rather than swallowed — a CTO's goal genuinely cannot delegate to a
  // product director who reports to the CEO, and refusing there would stall real work over an
  // org-shape fact the caller cannot fix from the cascade.
  if (domain !== undefined) {
    const owningDept = departmentFor(domain);
    const inDomain = candidates.filter((h) => h.departmentId === owningDept);
    if (inDomain.length > 0) return best(chart, inDomain, parentHatId, mustSupportLevel);
  }

  return best(chart, candidates, parentHatId, mustSupportLevel);
}

/** Nearest, then able to carry the next rung, then ORDINAL. Shared by both paths above. */
function best(
  chart: OrgChart,
  candidates: readonly OrgHat[],
  parentHatId: string,
  mustSupportLevel?: HatLevel,
): OrgHat | undefined {
  const distance = (h: OrgHat): number => supervisorChainOf(chart, h.id).indexOf(parentHatId);
  const supports = (h: OrgHat): boolean =>
    mustSupportLevel === undefined ||
    hatsAtLevel(chart, mustSupportLevel).some((c) => c.id !== h.id && reportsUpTo(chart, c.id, h.id));

  return [...candidates].sort((a, b) => {
    const byDistance = distance(a) - distance(b);
    if (byDistance !== 0) return byDistance;
    // Equal distance: the one that can carry the next rung wins.
    const bySupport = Number(supports(b)) - Number(supports(a));
    if (bySupport !== 0) return bySupport;
    // STILL EQUAL: ORDINALLY, never by the order the seed happens to declare hats in.
    //
    // With eight departments there was usually one candidate and this never showed. At the
    // reference's sixteen there are many, and the winner was whichever the file listed first — so
    // two organizations of identical SHAPE picked different owners because someone reordered a
    // list. Measured when the seed grew: a lead was chosen that could staff nothing, and the
    // failure surfaced a rung later as an assignment refusal naming a hat nobody had chosen.
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
        },
      ],
    },
  };
}

/**
 * Decompose a node into the rung below it.
 *
 * REFUSES rather than inventing an owner. If no hat at the child rung's level reports up to the
 * parent's owner, the work cannot be staffed inside that reporting line, and saying so is the
 * honest answer — silently attaching it to whoever was nearest would produce a plan the
 * organization cannot execute and, worse, cannot detect that it cannot execute.
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
  const mustSupport = isLeafType(rung.workType)
    ? ("individual_contributor" as const)
    : nextRung(rung.workType)?.ownerLevel;
  // The children's domain decides who owns them. They all share one here — a decompose that mixed
  // domains would need one owner per domain, and that is a different verb (delegating ACROSS
  // departments) than splitting work within one.
  const childDomain = children.find((c) => c.domain !== undefined)?.domain ?? parent.domain;
  const owner = ownerForRung(chart, rung.ownerLevel, parent.ownerHatId, mustSupport, childDomain);
  if (owner === undefined) {
    return {
      ok: false,
      reason: `no ${rung.ownerLevel} hat reports up to '${parent.ownerHatId}', so this ${rung.workType} cannot be staffed`,
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
