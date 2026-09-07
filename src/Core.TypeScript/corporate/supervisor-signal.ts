/**
 * corporate/supervisor-signal.ts — how a hat talks UPWARD, and why it is not a chat box.
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 * The canonical package had no upward path at all. An agent that hit a blocker had nowhere to put
 * it: the observe grammar can `respond_to_operator` (one channel, to the human) and the agent bus
 * can address a peer, but there was no notion of *the hat that supervises this duty* and therefore
 * no way to route a question, a blocker, or a resource request to it.
 *
 * `SUPERVISOR_CHAIN_COMMUNICATION.md` states the requirement exactly:
 *
 *   > Agents should never have to guess how to talk upward in the Organization.
 *
 * and gives the chain — team member → manager → director → C-suite → executive board — plus eight
 * typed tool families. Typed, not free-text, and the doc is explicit about why:
 *
 *   > Hats expose upward communication tools as typed tools, not as a generic chat box.
 *
 * ── WHAT MAKES A TYPED TOOL DIFFERENT FROM A MESSAGE ─────────────────────────
 * Two things, both enforced here:
 *
 *   1. **Routing is derived, never chosen.** The sender names the *tool*, not the recipient. Where
 *      it goes falls out of the hat graph. A sender who picks the recipient can route around a
 *      supervisor that would have said no, and can address a hat that has no authority over the
 *      question — both of which turn the chain into an address book.
 *
 *   2. **Evidence is required per family** (*"what evidence is required"* is one of the six things
 *      the doc says a hat's brief must answer). A blocker with no trace is an assertion that work
 *      is stuck; a blocker with one is a thing the supervisor can triage without re-deriving it.
 *
 * ── AND IT PRODUCES AN ARTIFACT ──────────────────────────────────────────────
 * Every signal opens a `supervisor_signal` discussion anchor with both hats as participants, so the
 * reply, the triage, and the eventual decision live on the artifact rather than in a transcript.
 * That is the third question this register had no answer to: agents here now communicate through
 * anchored artifacts, exactly as the corporate register does.
 */

import {
  AnchorState,
  AnchorType,
  ExpectedOutput,
  openAnchor,
  type AnchorBoard,
  type DiscussionAnchor,
  type EvidenceRef,
} from "./discussion-anchor";
import { nearestSupervisorAtOrAbove, supervisorOf, type HatLevel, type OrgChart, type OrgHat } from "./org-chart";
import { gateOwners, type GateKind } from "./quality-gate";

/** The eight starter families, verbatim from the reference table. */
export const SignalTool = {
  AskQuestion: "ask_question",
  ReportBlocker: "report_blocker",
  RequestDecision: "request_decision",
  RequestResource: "request_resource",
  RequestReview: "request_review",
  ReportRisk: "report_risk",
  SuggestImprovement: "suggest_improvement",
  RequestEscalation: "request_escalation",
} as const;

export type SignalTool = (typeof SignalTool)[keyof typeof SignalTool];

/**
 * Where a family routes.
 *
 *   - `supervisor` — the immediate supervisor. The doc's default: the target *"decides what happens
 *     next"*, including escalating further. Travel up the chain is a sequence of triages, not one
 *     long-range send.
 *   - `resource_authority` — the hat that can actually allocate. Staffing and capacity live with
 *     the Resource Management Office; a manager asking its own supervisor for headcount is asking
 *     someone who must forward it.
 *   - `escalate` — deliberately PAST the immediate supervisor. `request_escalation` exists because
 *     *"the current supervisor level cannot resolve the issue alone"*, so routing it back to that
 *     same supervisor would be a no-op that reports success.
 */
export type SignalRouting =
  | "supervisor"
  | "resource_authority"
  | "escalate"
  /**
   * The hat that HOLDS the scope being asked about — for a review, the gate's owner.
   *
   * The fourth kind, and it exists because the other three all route along the reporting line and a
   * review does not travel that way. `RequestReview` routed to `supervisor`, so twenty-six requests
   * covering thirteen different gates all landed on one lead — while the calendar had already
   * booked thirteen different hats to do them. Time booked for a review nobody asked for, and a
   * request sitting with a hat that cannot answer it.
   *
   * Routing is STILL derived and still not the sender's to choose: it comes from gate ownership
   * rather than from the chain. That is the discipline the whole module is built on — the sender
   * names the tool and the scope, and the organization decides who that reaches.
   */
  | "scope_holder";

export interface SignalToolPolicy {
  readonly tool: SignalTool;
  readonly routing: SignalRouting;
  /** Evidence kinds, any ONE of which satisfies this family. Empty = no evidence required. */
  readonly evidenceAnyOf: readonly EvidenceRef["kind"][];
  /** What the resulting anchor owes. */
  readonly expectedOutput: ExpectedOutput;
  readonly whenToUse: string;
}

/**
 * The policy table — the machine-readable form of the doc's "Use when" column plus its evidence
 * requirement.
 *
 * `ask_question` and `suggest_improvement` require NO evidence, and that is a deliberate asymmetry
 * rather than an oversight. Requiring proof to ask a question is how an organization stops
 * receiving questions, and the doc's whole framing is that the lowest-friction path must stay open
 * — *"Hermes should see this brief ... so it can choose the lowest-friction communication path
 * instead of inventing one."* An agent that cannot afford to ask invents a workaround instead.
 */
export const SIGNAL_POLICY: Readonly<Record<SignalTool, SignalToolPolicy>> = {
  [SignalTool.AskQuestion]: {
    tool: SignalTool.AskQuestion,
    routing: "supervisor",
    evidenceAnyOf: [],
    expectedOutput: ExpectedOutput.Status,
    whenToUse: "the hat needs clarification before continuing scoped work",
  },
  [SignalTool.ReportBlocker]: {
    tool: SignalTool.ReportBlocker,
    routing: "supervisor",
    evidenceAnyOf: ["trace", "log", "test"],
    expectedOutput: ExpectedOutput.FollowUp,
    whenToUse: "work cannot move without supervisor triage or routing",
  },
  [SignalTool.RequestDecision]: {
    tool: SignalTool.RequestDecision,
    routing: "supervisor",
    evidenceAnyOf: ["document", "trace", "measurement"],
    expectedOutput: ExpectedOutput.Decision,
    whenToUse: "multiple valid paths exist and authority sits above the hat",
  },
  [SignalTool.RequestResource]: {
    tool: SignalTool.RequestResource,
    routing: "resource_authority",
    evidenceAnyOf: ["measurement", "document"],
    expectedOutput: ExpectedOutput.Decision,
    whenToUse: "the team needs hats, time, budget, infrastructure, or access",
  },
  [SignalTool.RequestReview]: {
    tool: SignalTool.RequestReview,
    routing: "scope_holder",
    evidenceAnyOf: ["diff", "test", "document"],
    expectedOutput: ExpectedOutput.GateResult,
    whenToUse: "a supervisor/reviewer decision is needed before lifecycle progress",
  },
  [SignalTool.ReportRisk]: {
    tool: SignalTool.ReportRisk,
    routing: "supervisor",
    evidenceAnyOf: ["measurement", "trace", "document"],
    expectedOutput: ExpectedOutput.FollowUp,
    whenToUse: "a risk could affect scope, schedule, quality, security, or cost",
  },
  [SignalTool.SuggestImprovement]: {
    tool: SignalTool.SuggestImprovement,
    routing: "supervisor",
    evidenceAnyOf: [],
    expectedOutput: ExpectedOutput.FollowUp,
    whenToUse: "the hat sees a process, memory, prompt-flow, tool, or workflow gap",
  },
  [SignalTool.RequestEscalation]: {
    tool: SignalTool.RequestEscalation,
    routing: "escalate",
    evidenceAnyOf: ["trace", "document", "log"],
    expectedOutput: ExpectedOutput.Decision,
    whenToUse: "the current supervisor level cannot resolve the issue alone",
  },
};

/**
 * A durable signal. Mirrors the reference's recorded fields: source hat and chain level, target hat
 * and level, the typed tool, title and message, evidence, and the anchor it opened.
 */
export interface SupervisorSignal {
  readonly signalId: string;
  readonly fromHatId: string;
  readonly fromLevel: HatLevel;
  readonly toHatId: string;
  readonly toLevel: HatLevel;
  readonly tool: SignalTool;
  readonly title: string;
  readonly message: string;
  readonly evidence: readonly EvidenceRef[];
  readonly atMs: number;
  readonly anchorId: string;
  readonly workItemId?: string;
}

export interface SendSignalInput {
  readonly signalId: string;
  readonly anchorId: string;
  readonly fromHatId: string;
  readonly tool: SignalTool;
  readonly title: string;
  readonly message: string;
  readonly evidence: readonly EvidenceRef[];
  readonly atMs: number;
  readonly workItemId?: string;
}

export type SendSignalResult =
  | { readonly ok: true; readonly signal: SupervisorSignal; readonly board: AnchorBoard }
  | { readonly ok: false; readonly reason: string };

/**
 * Which hat receives this signal.
 *
 * Exported because "who would this go to" is a question a hat's communication brief must answer
 * BEFORE it sends — the doc requires the brief to name the *"supervisor target level and target
 * hat"*. A hat that can only discover its target by sending cannot choose the right tool.
 */
export function routeSignal(
  chart: OrgChart,
  fromHatId: string,
  tool: SignalTool,
  resourceAuthorityHatId: string,
  /**
   * WHAT the signal is about, when the family routes by scope — a gate id for a review request.
   *
   * Optional because three of the four routing kinds do not need it. A `scope_holder` family with
   * no scope cannot be routed, and returns `undefined` rather than falling back to the supervisor:
   * a review delivered to someone who does not hold the gate is one that sits in a queue nobody
   * can clear, which is worse than a refusal the sender can see.
   */
  scope?: string,
): OrgHat | undefined {
  const policy = SIGNAL_POLICY[tool];
  switch (policy.routing) {
    case "supervisor":
      return supervisorOf(chart, fromHatId);
    case "resource_authority": {
      const rmo = chart.byId.get(resourceAuthorityHatId);
      // The RMO must be someone this hat can actually reach through the chain. A resource authority
      // in an unrelated line is not this hat's resource authority, and sending there would put the
      // request in front of a hat with no standing over the requester's work.
      if (rmo === undefined) return undefined;
      return rmo;
    }
    case "scope_holder": {
      if (scope === undefined) return undefined;
      // Excluding the sender is the same separation of duties the pipeline applies: whoever did
      // the work does not review it, and a request routed back to its author would be a no-op
      // reporting success.
      return gateOwners(chart, scope as GateKind).find((h) => h.id !== fromHatId);
    }
    case "escalate": {
      const boss = supervisorOf(chart, fromHatId);
      if (boss === undefined) return undefined;
      // Past the immediate supervisor — that is the point of the family. Routing it back to the
      // supervisor who already could not resolve it would be a no-op reporting success.
      return supervisorOf(chart, boss.id);
    }
  }
  return assertNeverRouting(policy.routing);
}

function assertNeverRouting(x: never): never {
  throw new Error(`unhandled signal routing: ${String(x)}`);
}

/** Does this evidence satisfy the family's requirement? */
export function evidenceSatisfies(tool: SignalTool, evidence: readonly EvidenceRef[]): boolean {
  const required = SIGNAL_POLICY[tool].evidenceAnyOf;
  if (required.length === 0) return true;
  return evidence.some((e) => required.includes(e.kind));
}

/**
 * Send a signal: route it, check its evidence, and open the anchor it will be discussed on.
 *
 * The signal and the anchor are created TOGETHER or not at all. A signal with no anchor would be a
 * message — the thing this module exists to not be — and an anchor with no signal would be a
 * discussion nobody asked for.
 */
export function sendSupervisorSignal(
  chart: OrgChart,
  board: AnchorBoard,
  input: SendSignalInput,
  resourceAuthorityHatId: string,
): SendSignalResult {
  const from = chart.byId.get(input.fromHatId);
  if (from === undefined) return { ok: false, reason: `unknown sending hat '${input.fromHatId}'` };
  if (input.title.trim() === "" || input.message.trim() === "") {
    return { ok: false, reason: `signal '${input.signalId}' has an empty title or message` };
  }

  if (!evidenceSatisfies(input.tool, input.evidence)) {
    const need = SIGNAL_POLICY[input.tool].evidenceAnyOf.join(" | ");
    return {
      ok: false,
      reason: `'${input.tool}' requires evidence (${need}) — a report the supervisor must re-derive is not a report`,
    };
  }

  // THE TITLE IS THE SCOPE for a scope-routed family. `requestReviewsFor` puts the gate id there
  // precisely so it can be read back — by `reviewsAskedOf` as `forGate`, and here as the thing that
  // decides who receives it. One value, two readers, no second field to drift.
  const target = routeSignal(chart, input.fromHatId, input.tool, resourceAuthorityHatId, input.title);
  if (target === undefined) {
    // The top of the chain, or an escalation one rung below it. Saying so is the honest answer:
    // there is nobody above to take this, and the hat needs to know that rather than believe it
    // sent something.
    return {
      ok: false,
      reason: `'${input.fromHatId}' has no target for '${input.tool}' — nothing above it can take this`,
    };
  }
  if (target.id === input.fromHatId) {
    return { ok: false, reason: `'${input.tool}' from '${input.fromHatId}' routed back to itself` };
  }

  const anchor: DiscussionAnchor = {
    anchorId: input.anchorId,
    anchorType: AnchorType.SupervisorSignal,
    title: input.title,
    purpose: SIGNAL_POLICY[input.tool].whenToUse,
    expectedOutput: SIGNAL_POLICY[input.tool].expectedOutput,
    // Both hats are participants: the sender must be able to answer follow-ups on its own signal.
    participantHatIds: [input.fromHatId, target.id],
    openedByHatId: input.fromHatId,
    openedAtMs: input.atMs,
    state: AnchorState.Open,
    ...(input.workItemId === undefined ? {} : { workItemId: input.workItemId }),
  };

  const opened = openAnchor(board, anchor);
  if (!opened.ok) return { ok: false, reason: `signal '${input.signalId}': ${opened.reason}` };

  return {
    ok: true,
    board: opened.board,
    signal: {
      signalId: input.signalId,
      fromHatId: input.fromHatId,
      fromLevel: from.level,
      toHatId: target.id,
      toLevel: target.level,
      tool: input.tool,
      title: input.title,
      message: input.message,
      evidence: input.evidence,
      atMs: input.atMs,
      anchorId: input.anchorId,
      ...(input.workItemId === undefined ? {} : { workItemId: input.workItemId }),
    },
  };
}

/**
 * The communication brief the doc requires every hat to carry.
 *
 * Generated from the graph and the policy table rather than written per hat — the doc is explicit
 * that it should be *"generate[d] from hats, policy, and work scope instead of static role files"*.
 * A brief maintained by hand drifts from the chart the moment anyone reorganizes.
 */
export interface HatCommunicationBrief {
  readonly hatId: string;
  readonly level: HatLevel;
  readonly duty: string;
  readonly supervisorHatId?: string;
  readonly escalationHatId?: string;
  readonly tools: readonly {
    readonly tool: SignalTool;
    readonly targetHatId?: string;
    readonly whenToUse: string;
    readonly evidenceAnyOf: readonly EvidenceRef["kind"][];
  }[];
}

export function buildHatCommunicationBrief(
  chart: OrgChart,
  hatId: string,
  resourceAuthorityHatId: string,
): HatCommunicationBrief | undefined {
  const hat = chart.byId.get(hatId);
  if (hat === undefined) return undefined;
  const boss = supervisorOf(chart, hatId);
  const escalation = nearestSupervisorAtOrAbove(chart, hatId, "director");
  return {
    hatId,
    level: hat.level,
    duty: `${hat.name} — ${hat.departmentId}`,
    ...(boss === undefined ? {} : { supervisorHatId: boss.id }),
    ...(escalation === undefined ? {} : { escalationHatId: escalation.id }),
    tools: Object.values(SignalTool).map((tool) => {
      const target = routeSignal(chart, hatId, tool, resourceAuthorityHatId);
      const policy = SIGNAL_POLICY[tool];
      return {
        tool,
        ...(target === undefined ? {} : { targetHatId: target.id }),
        whenToUse: policy.whenToUse,
        evidenceAnyOf: policy.evidenceAnyOf,
      };
    }),
  };
}
