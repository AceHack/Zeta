/**
 * corporate/agent-loop-bridge.ts — the organization DRIVING the canonical F# agent loop.
 *
 * ── THE COMPOSITION THE ADR MANDATES, IN THE OTHER DIRECTION ─────────────────
 * `loop-policy.ts` already composes this register onto the observe algebra. This does the same for
 * the other canonical loop: `WorkflowEngine.fs` and its port in `workflow-engine/agent-loop/`.
 * Direction is unchanged and non-negotiable — corporate imports the core, the core never imports
 * corporate (`register-boundary.test.ts`). An organization is one thing that can supply a status
 * surface and a candidate list; the loop does not know it exists.
 *
 * ── WHAT WAS MISSING ────────────────────────────────────────────────────────
 * The agent loop is `(status_surface, current_state) → MenuOption[] → transition`. Nothing produced
 * a status surface. `StatusSnapshot` and `WorkCandidate` were types with no producer, so the loop
 * could be unit-tested and could not be RUN against anything real.
 *
 * ── WHAT IS DERIVED, AND WHAT HONESTLY IS NOT ────────────────────────────────
 * Every field is folded from what the organization recorded, or it is declared absent. The two
 * that cannot come from an org run take a caller-supplied function and default to NEUTRAL rather
 * than to a flattering number:
 *
 *   | field           | source                                                                |
 *   |-----------------|-----------------------------------------------------------------------|
 *   | dora            | `deriveDora` — with its own `unmeasured` list carried through          |
 *   | contribution    | the priority class the organization DECIDED (not the recommendation)  |
 *   | uncertainty     | gate rejections + QA failures standing against the item               |
 *   | trajectoryPhase | the work's own state                                                  |
 *   | lane            | **caller** — the register has no lane taxonomy; default `mixed`, which is neither mandate |
 *   | agentInterest   | **caller** — nobody but the agent knows; default `0.5`, exactly neutral |
 *
 * Defaulting `agentInterest` to 0 would say every agent is uninterested in everything, and to 1
 * that it is keen on everything. Both are claims. `0.5` is the absence of one, and it matches how
 * `menu-generator` treats an unlisted trajectory: unknown stays unknown.
 */

import { childrenOf, isDelivered, WorkState, WorkType, type Cascade, type CascadeNode } from "./goal-cascade";
import type { OrgEvent } from "./org-event";
import { deriveDora, type DoraDerivation, type DoraInput, type IncidentWindow } from "./dora";
import {
  aggregateAuthorRatios,
  classifyCommit,
  type ClassificationResult,
  type CommitMetadata,
} from "../dora-classify/classify";
import { isPassing, type GateEvaluation } from "./quality-gate";
import { PRIORITY_ORDER, priorityRank, type PriorityDecision } from "./prioritization";
import { chooseWithinLegal, firstLegalChooser, type OrgChooser } from "./org-decision";
import type { QaCycleReport } from "./qa";
// The vocabulary comes from the contract; the transitions come from the loop.
// Kept as two imports on purpose: the first is a dependency on a shape anyone
// may hold, the second is the residual dependency on the meta-harness's
// behaviour, and separating them is what makes the residual one countable.
import type {
  AgentContext,
  AgentState,
  Lane,
  MenuOption,
  StatusSnapshot,
  WorkCandidate,
  WorkResult,
} from "../protocol/agent-loop-contract";
import { cycleClose, postResultTransition, transition } from "../workflow-engine/agent-loop/state-machine";
import { generateMenu, isNonCoercive, type NamedDependencyOffer } from "../workflow-engine/agent-loop/menu-generator";
import type { Dispatch, SlotDispatcher } from "./slot-dispatch";

export interface SurfaceInput extends DoraInput {
  readonly cascade: Cascade;
  readonly priorities: readonly PriorityDecision[];
  /** Passed in, never read from a clock. */
  readonly snapshotIso: string;
  /** The run's event trace. Supplying it makes incident restoration times — and so MTTR — readable. */
  readonly trace?: readonly OrgEvent[];
  /**
   * The files a work item touches. Supplying this is what makes lanes — and therefore the menu's
   * two-mandate balance term — computable at all.
   *
   * The organization models work as titles and ids; the lane taxonomy is defined over PATHS. Absent
   * this, every candidate is `mixed`, every agent ratio is unknown, and the balance term sits at
   * neutral forever — which is honest, and is exactly what `deriveDora` reports as unmeasured.
   */
  readonly pathsFor?: (node: CascadeNode) => readonly string[];
  /** Overrides `pathsFor`. A caller that already knows the lane need not go via paths. */
  readonly laneFor?: (node: CascadeNode) => Lane;
  /** Only the agent knows. Absent is neutral, never zero. */
  readonly interestFor?: (node: CascadeNode) => number;
}

/**
 * The work an agent could pick up.
 *
 * LEAVES ONLY, and only live ones. A parent is not workable — its children carry the work — and a
 * done or cancelled item is not a candidate, so offering either would be the NOISE the menu
 * generator's own criteria forbid.
 */
export function candidatesFrom(input: SurfaceInput): readonly WorkCandidate[] {
  const out: WorkCandidate[] = [];
  for (const node of input.cascade.nodes) {
    if (node.state === WorkState.Done || node.state === WorkState.Canceled) continue;
    if (childrenOf(input.cascade, node.workId).length > 0) continue;

    out.push({
      id: node.workId,
      lane: laneOfNode(node, input),
      estimatedDoraContribution: contributionOf(node.workId, input.priorities),
      uncertainty: uncertaintyOf(node.workId, input.gateEvaluations, input.qa),
      trajectoryPhase: node.state === WorkState.Open ? "setup" : "execution",
      agentInterest: neutralIfUnknown(input.interestFor?.(node)),
    });
  }
  return out;
}

/**
 * The lane for one item: the caller's own answer, else the CLASSIFIER's over its paths.
 *
 * Classifying here rather than reimplementing the rule means `mixed`, the prefix precedence and the
 * no-files case all behave exactly as `dora-classify` says they do — one definition of the taxonomy,
 * not a second one that agrees today.
 */
function laneOfNode(node: CascadeNode, input: SurfaceInput): Lane {
  const explicit = input.laneFor?.(node);
  if (explicit !== undefined) return explicit;
  const paths = input.pathsFor?.(node);
  if (paths === undefined || paths.length === 0) return "mixed";
  return classifyCommit(commitFor(node, paths)).lane;
}

/**
 * A work item as the classifier's input shape.
 *
 * The unused fields carry the item's own identity rather than placeholders, so a classification can
 * be traced back to the work it came from.
 */
function commitFor(node: CascadeNode, paths: readonly string[]): CommitMetadata {
  return {
    sha: node.workId,
    author: node.assigneeHatId ?? node.ownerHatId,
    authorEmail: "",
    timestampIso: "",
    subject: node.title,
    changedFiles: paths,
  };
}

/**
 * Incident windows, read off the run's own event trace.
 *
 * Detection is the earliest event mentioning the incident; restoration is the event that moved it
 * to `done`. Both come from what the organization RECORDED while working rather than from a field
 * someone maintained alongside it — a stored restoration time can disagree with the transition it
 * claims to describe, and the disagreement is invisible because the stored value is what gets read.
 *
 * An incident with no `done` transition yields a window with no restoration, which `deriveDora`
 * excludes from the median rather than counting as an instant fix.
 */
export function incidentWindowsFrom(
  cascade: Cascade,
  trace: readonly OrgEvent[],
): readonly IncidentWindow[] {
  const out: IncidentWindow[] = [];
  for (const node of cascade.nodes) {
    if (node.workType !== WorkType.Incident) continue;
    const mine = trace.filter((e) => e.subjectId === node.workId);
    if (mine.length === 0) continue;
    const detectedAtMs = Math.min(...mine.map((e) => e.atMs));
    const restoredEvent = mine.filter((e) => e.toState === WorkState.Done).sort((a, b) => a.atMs - b.atMs)[0];
    out.push(
      restoredEvent === undefined
        ? { workId: node.workId, detectedAtMs }
        : { workId: node.workId, detectedAtMs, restoredAtMs: restoredEvent.atMs },
    );
  }
  return out;
}

export function classificationsFor(input: SurfaceInput): readonly ClassificationResult[] {
  if (input.pathsFor === undefined) return [];
  const out: ClassificationResult[] = [];
  for (const node of input.cascade.nodes) {
    if (childrenOf(input.cascade, node.workId).length > 0) continue;
    if (node.state === WorkState.Canceled) continue;
    const paths = input.pathsFor(node);
    if (paths.length === 0) continue;
    out.push(classifyCommit(commitFor(node, paths)));
  }
  return out;
}

/**
 * Each hat's operational share of its own assigned work — the two-mandate ratio the menu balances.
 *
 * `aggregateAuthorRatios` does the counting, so the definition of "operational" is the classifier's
 * one and not a second one written here. Empty when no paths are supplied, which leaves the balance
 * term neutral rather than steering on a number nobody measured.
 */
export function perHatRatios(input: SurfaceInput): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const stats of aggregateAuthorRatios(classificationsFor(input))) {
    out[stats.author] = stats.operationalRatio;
  }
  return out;
}

function neutralIfUnknown(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/**
 * How much delivering this item would move the numbers, from the priority the organization DECIDED.
 *
 * The decision, not `recommended`: a human overriding the scorer is the organization saying the
 * scorer was wrong about this item, and reading the recommendation would quietly discard that.
 * Unprioritized work is `0.5` — unknown, not worthless.
 */
export function contributionOf(workId: string, priorities: readonly PriorityDecision[]): number {
  const decision = priorities.find((p) => p.workId === workId);
  if (decision === undefined) return 0.5;
  const rank = priorityRank(decision.priorityClass);
  if (rank < 0) return 0.5;
  // Expedite (rank 0) → 1, Paused (last) → 0.
  return 1 - rank / (PRIORITY_ORDER.length - 1);
}

/**
 * How much is still unknown about this item — gate rejections and QA failures standing against it.
 *
 * Rising with trouble, and that is deliberate: per `every-bug-has-economic-value`, unresolved
 * trouble is REDUCIBLE uncertainty, so it raises a candidate rather than lowering it. Saturates at
 * three signals, because the difference between three problems and thirty is not three times more
 * worth doing — it is a different conversation, which the escalation path already has.
 */
export function uncertaintyOf(
  workId: string,
  gateEvaluations: readonly GateEvaluation[],
  qa: readonly QaCycleReport[],
): number {
  let signals = 0;
  for (const evaluation of gateEvaluations) {
    if (evaluation.workId === workId && !isPassing(evaluation.outcome)) signals += 1;
  }
  for (const cycle of qa) {
    if (cycle.failedFeatureIds.includes(workId)) signals += 1;
    if (cycle.regressions.some((r) => r.testCaseId === workId)) signals += 1;
  }
  return Math.min(1, signals / 3);
}

/** Trajectories with live work, and those with none left — the heat signal the menu weighs. */
export function trajectoryHeat(cascade: Cascade): {
  readonly hot: readonly string[];
  readonly cooling: readonly string[];
} {
  const hot: string[] = [];
  const cooling: string[] = [];
  for (const node of cascade.nodes) {
    const children = childrenOf(cascade, node.workId);
    if (children.length === 0) continue;
    // `isDelivered`, NOT the child's stored `state`. Completion in this cascade is DERIVED from the
    // leaves and never written back onto a parent — deliberately, so two records of one fact cannot
    // disagree. Reading the stored state here meant a fully delivered trajectory whose intermediate
    // nodes still read `open` was reported HOT forever, and the menu kept weighting finished work up.
    const live = children.filter((c) => c.state !== WorkState.Canceled && !isDelivered(cascade, c.workId));
    (live.length > 0 ? hot : cooling).push(node.workId);
  }
  return { hot, cooling };
}

export interface OrgStatusSurface {
  readonly snapshot: StatusSnapshot;
  readonly candidates: readonly WorkCandidate[];
  /** Carried through so a caller cannot read the DORA numbers without the caveats. */
  readonly dora: DoraDerivation;
}

/** Build the status surface the agent loop inspects. */
export function statusSurfaceFrom(input: SurfaceInput): OrgStatusSurface {
  const classifications = classificationsFor(input);
  // Classified ONCE and shared, so the DORA substrate ratio and the per-hat ratios are two readings
  // of one classification rather than two classifications that could disagree.
  const incidents = input.trace === undefined ? [] : incidentWindowsFrom(input.cascade, input.trace);
  const dora = deriveDora({
    ...input,
    ...(classifications.length === 0 ? {} : { classifications }),
    ...(incidents.length === 0 ? {} : { incidents }),
  });
  const heat = trajectoryHeat(input.cascade);
  const candidates = candidatesFrom(input);
  return {
    dora,
    candidates,
    snapshot: {
      snapshotIso: input.snapshotIso,
      currentDora: dora.metrics,
      hotTrajectories: heat.hot,
      coolingTrajectories: heat.cooling,
      // The work with the most unknown standing against it — where a look pays most.
      explorationCandidates: candidates.filter((c) => c.uncertainty > 0).map((c) => c.id),
      // Computed when the caller supplies paths, and EMPTY otherwise — never invented. An empty
      // map leaves the menu's balance term at neutral, which is the absence of a claim rather than
      // a claim of balance.
      perAgentRatios: perHatRatios(input),
    },
  };
}

export interface AgentCycleInput {
  readonly state: AgentState;
  readonly surface: OrgStatusSurface;
  readonly namedDeps?: readonly NamedDependencyOffer[];
  /** Picks WITHIN the menu. Defaults to the first option, which is the best-scoring work. */
  readonly chooser?: OrgChooser<MenuOption>;
  /** What the chosen work produced. Absent means the cycle stops at the choice. */
  readonly resultFor?: (option: MenuOption) => WorkResult | undefined;
  /**
   * A register narrowing the core's menu — the seam `loop-policy.ts` already provides for the
   * observe loop, here for the agent loop.
   *
   * This is the ONLY way coercion can enter: `generateMenu` cannot produce a menu missing a free
   * mode, so without this seam the non-coercion check below could never fail, and a check that
   * cannot fail is not a check. A schedule may say what work is in scope; it may not say that an
   * agent must work, and this is where that gets caught rather than trusted.
   */
  readonly menuPolicy?: (menu: readonly MenuOption[]) => readonly MenuOption[];
}

export interface AgentCycleReport {
  readonly menu: readonly MenuOption[];
  readonly chosen?: MenuOption;
  readonly state: AgentState;
  /** True when the menu satisfied the non-coercion invariant. Never assumed. */
  readonly nonCoercive: boolean;
  readonly refusals: readonly string[];
  /**
   * Work that was in flight and got switched away from with nothing recorded about it.
   *
   * The canonical `transition` replaces `ExecutingWork`'s item on a new `PickWork` and keeps no
   * note of the one it dropped, so an agent can churn between items forever and finish neither
   * while every cycle looks productive. This does not change that transition — the F# engine is
   * the contract — it REPORTS it, so the churn is visible to whoever is reading the run.
   */
  readonly abandonedWorkId?: string;
}

/**
 * One turn of the loop: inspect, choose, act, close.
 *
 * The choice goes through `chooseWithinLegal`, so the index is clamped and a chooser that throws
 * falls back to a legal option — the same kernel every other decision in this register uses. The
 * menu is the legal set; the chooser cannot leave it however badly it behaves.
 *
 * The non-coercion invariant is CHECKED here rather than assumed, because this is the seam where a
 * register could narrow a core menu. A caller can see whether the organization left the agent a
 * way out.
 */
export function runAgentCycle(input: AgentCycleInput): AgentCycleReport {
  const refusals: string[] = [];
  const offered = generateMenu({
    state: input.state,
    snapshot: input.surface.snapshot,
    candidates: input.surface.candidates,
    ...(input.namedDeps === undefined ? {} : { namedDeps: input.namedDeps }),
  });
  // Narrowed AFTER the core built it, and checked AFTER the narrowing — checking the core's own
  // output would grade the wrong menu, since the core is not what can take an option away.
  const menu = input.menuPolicy?.(offered) ?? offered;
  const nonCoercive = isNonCoercive(menu);
  if (!nonCoercive) refusals.push("the menu offered to this agent was coercive — a free mode was missing");

  const choice = chooseWithinLegal(menu, `agent-loop cycle ${input.state.context.cycle}`, input.chooser ?? firstLegalChooser());
  if (choice.outcome !== "chosen") {
    return { menu, state: input.state, nonCoercive, refusals: [...refusals, choice.reason] };
  }
  if (choice.clamped === true) refusals.push(`chooser clamped: ${choice.reason}`);

  const inFlight = input.state.tag === "ExecutingWork" ? input.state.work.id : undefined;
  const acted = transition(input.state, choice.option);
  // Switched away from live work without producing a result for it.
  const abandonedWorkId =
    inFlight !== undefined && choice.option.tag === "PickWork" && input.resultFor?.(choice.option) === undefined
      ? inFlight
      : undefined;
  const result = input.resultFor?.(choice.option);
  // `postResultTransition` is a no-op for states that produced nothing, so a cycle that only
  // changed mode closes cleanly instead of needing a special case here.
  const after = result === undefined ? acted : postResultTransition(acted, result);
  return {
    menu,
    chosen: choice.option,
    state: cycleClose(after),
    nonCoercive,
    refusals,
    ...(abandonedWorkId === undefined ? {} : { abandonedWorkId }),
  };
}

/** The context an org-driven agent carries into the loop. */
export function contextFor(agent: AgentContext["agent"], cycle: number, sessionStartIso: string): AgentContext {
  return { agent, cycle, sessionStartIso };
}

/**
 * One cycle where the chosen slot is actually DISPATCHED.
 *
 * `runAgentCycle` takes a synchronous `resultFor`, which is why the register could only ever hand
 * it a constant: reaching a pipeline is asynchronous, so the sync seam could be satisfied by an
 * invented value and by nothing else. That is exactly what it was given —
 * `{ success: true, doraContribution: 0.5 }`.
 *
 * The order here is the whole point, and it is the same produce-then-judge shape the pipeline uses
 * one layer down:
 *
 *   build the menu -> choose within it -> DISPATCH the choice -> apply what came back
 *
 * A dispatcher that performs nothing returns no result, and the agent stays in `ExecutingWork` —
 * picked up, outstanding. That is the true state of a shadow lane, and it is what the old constant
 * was hiding.
 */
export async function runDispatchedCycle(
  input: AgentCycleInput & { readonly dispatcher: SlotDispatcher },
): Promise<AgentCycleReport & { readonly dispatch: Dispatch | undefined }> {
  const refusals: string[] = [];
  const offered = generateMenu({
    state: input.state,
    snapshot: input.surface.snapshot,
    candidates: input.surface.candidates,
    ...(input.namedDeps === undefined ? {} : { namedDeps: input.namedDeps }),
  });
  const menu = input.menuPolicy?.(offered) ?? offered;
  const nonCoercive = isNonCoercive(menu);
  if (!nonCoercive) refusals.push("the menu offered to this agent was coercive — a free mode was missing");

  const choice = chooseWithinLegal(menu, `agent-loop cycle ${input.state.context.cycle}`, input.chooser ?? firstLegalChooser());
  if (choice.outcome !== "chosen") {
    return { menu, state: input.state, nonCoercive, refusals: [...refusals, choice.reason], dispatch: undefined };
  }
  if (choice.clamped === true) refusals.push(`chooser clamped: ${choice.reason}`);

  const inFlight = input.state.tag === "ExecutingWork" ? input.state.work.id : undefined;
  const acted = transition(input.state, choice.option);

  // THE DISPATCH. Between the transition and the result, because the result is what the dispatch
  // produced — and a dispatcher that produced nothing must not close the cycle as if it had.
  const dispatch = await input.dispatcher.dispatch(choice.option);
  const result = dispatch.result;

  const abandonedWorkId =
    inFlight !== undefined && choice.option.tag === "PickWork" && result === undefined ? inFlight : undefined;
  const after = result === undefined ? acted : postResultTransition(acted, result);
  return {
    menu,
    chosen: choice.option,
    state: cycleClose(after),
    nonCoercive,
    refusals,
    dispatch,
    ...(abandonedWorkId === undefined ? {} : { abandonedWorkId }),
  };
}
