#!/usr/bin/env bun
/**
 * corporate/run-agent.ts — an agent working a REAL organization, and resuming.
 *
 * ── THE TWO HALVES THAT DID NOT MEET ─────────────────────────────────────────
 * `agent-loop/cli.ts` had persistence and a participant, and always ran against `emptySurface` with
 * no candidates — so the model that drove it was choosing over an organization with no work in it.
 * `corporate/run-org.ts` produced a real surface from `agent-loop-bridge.ts`, and had neither
 * persistence nor a participant.
 *
 * Both halves were built, tested and mutation-checked, and neither was connected to the other. This
 * is the join, and it is the point at which the end-to-end claim means something: a model picking
 * REAL work off a REAL organization, recorded to disk, resuming from that disk on the next
 * invocation.
 *
 * ── THE DIRECTION IS THE ONE THE ADR FIXES ───────────────────────────────────
 * The core cannot reach for an organization; `register-boundary.test.ts` enforces that. So the core
 * offers `MainDeps.surface` and this register fills it. The loop still does not know an organization
 * exists — it knows it was handed a snapshot and some candidates.
 *
 *   bun run-agent.ts --agent alexa --at 2026-09-03T10:00:00.000Z --root .agent-loop
 *   bun run-agent.ts --agent alexa --at ... --participant local-llm
 *   bun run-agent.ts --agent alexa --at ... --qa-fails --participant local-llm --store .org-history
 *   bun run-agent.ts --agent alexa --at ... --history
 *
 * ── WHY THE ORGANIZATION IS RE-RUN EACH INVOCATION ───────────────────────────
 * The org runtime is deterministic and in-memory: given the same inputs it produces the same
 * cascade, and `--at` fixes the clock. So re-running it is a pure recomputation of the SAME
 * organization rather than a second, different one — and it is what lets the agent's own state
 * resume from disk while the surface it looks at is rebuilt beside it.
 *
 * That was honest AND INCOMPLETE, and `--resume` is the other half. With it, `resumedSurface`
 * folds the cascade, the calendar, the priorities, the gate verdicts, the queue and the QA history
 * out of the stored trace — no runtime, no recomputation — so the second process reads what the
 * first one DID rather than recomputing what it would have done.
 *
 * The paragraph above used to end "and it is the next thing", which stayed on the page for two
 * passes after the thing was built. In a register where a stated limit is a promise about the
 * code, a stale one sends the next reader to build what already exists — so the limits here are
 * checked against the code when they are edited, and the ones that survive say what is still true.
 */

import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { agentsFromChart, defaultProviderSet, runOrgRuntime, type OrgRuntimeDeps, type OrgRuntimeReport } from "./org-runtime";
import { statusSurfaceFrom } from "./agent-loop-bridge";
import { appendRun, deliveryRate, readEvents } from "./org-store";
import { everyRunWasSimulated, foldOrganization } from "./org-fold";
import { idlePortfolios, PortfolioKind, portfolioHistory, portfolioOf } from "./portfolio";
import { emptyQueue, type WorkQueue } from "./work-market";
import { fidelityLine } from "./providers";
import { argRefusals, parseArgs, providersFromArgs, type Args } from "./run-org";
import { IntakeKind, Severity, type ExternalEvent } from "./intake";
import { isLeafType, WorkType } from "./goal-cascade";
import type { OrgEvent } from "./org-event";
import { mainAsync, type LoopSurface, type MainDeps } from "../workflow-engine/agent-loop/cli";
import { deliverWorkItem, type DeliveryOutcome } from "./work-delivery";
import { DEFAULT_PIPELINE } from "./pipeline";
import { GateOutcome } from "./quality-gate";
import { RunOutcome } from "./qa";

/** The inbound event the demo organization works. A real caller supplies its own. */
const DEFECT: ExternalEvent = {
  source: "portal",
  externalId: "T-1",
  kind: IntakeKind.Defect,
  severity: Severity.High,
  title: "checkout double-charges when a coupon is applied twice",
  reproduction: "apply the same coupon twice at checkout",
  evidenceRefs: ["log/checkout-1"],
};

export interface AgentRunArgs {
  /** Fixed by `--at`, so the organization recomputes identically on every invocation. */
  readonly atMs: number;
  readonly qaFails: boolean;
  /**
   * Work the organization as an INCIDENT rather than a defect.
   *
   * Not decoration: an incident is the only work type that carries a restoration time, so it is the
   * only configuration in which the run's trace makes `mttrMedianSeconds` measurable. Without it
   * every run reports MTTR unmeasured, and the trace passed to the surface changes nothing — a
   * pass-through that looks load-bearing and is not.
   */
  readonly incident: boolean;
  /**
   * Rebuild the organization from the STORE instead of re-running it.
   *
   * The difference this makes is the whole of "the organization resumes": without it every
   * invocation recomputes the organization from its arguments, which works only because the runtime
   * is deterministic and stops working the moment a run depends on anything not in them. With it,
   * the second process reads what the first one DID.
   *
   * Requires `--store`, and refuses when the store holds no facts rather than silently recomputing:
   * a resume that quietly falls back to a fresh run is indistinguishable from a resume that worked.
   */
  readonly resume: boolean;
  /** Where the organization's own history goes. Absent means the run is not persisted. */
  readonly store?: string;
  /**
   * WHICH ADAPTER ANSWERS EACH PORT — the same flags `run-org.ts` takes, parsed by the same code.
   *
   * THE BOUNDARY THIS CLOSES, measured before it existed:
   *
   *     bun run-agent.ts --agent alexa --at ... --store S
   *       deliveryRate = {"runs":1,"delivered":1,"deliveredForReal":0,"deliveredSimulated":1,...}
   *       run: delivered=true replayable=true realPorts=[]
   *
   * and NO flag could change that number. The two CLIs each held half of the end-to-end claim:
   * `run-org.ts` reaches real repositories and has nothing choosing; this one has a model choosing
   * real work off a real cascade and could only ever record runs that performed nothing. The
   * choosing was real in one and the doing was real in the other, and no single invocation had
   * both — which is the thing "end to end" was supposed to mean.
   *
   * Absent means every port simulated, exactly as before, and the run says so in its own output.
   */
  readonly ports?: Args;
}

/**
 * One queue holding every folded queue's shards, claims and approvals.
 *
 * The surface takes a single `WorkQueue`, and a log spanning several runs holds one per hat. Taking
 * the first would drop the rest — so they are unioned, which is safe because a shard id is unique
 * to its shard and a claim to its claim, making the merge a SET UNION and therefore idempotent:
 * folding the same log twice yields the same queue.
 *
 * `revision` becomes the max rather than a fresh count, because a revision that went BACKWARDS
 * would make an optimistic-concurrency check pass against a stale expectation.
 *
 * An empty fold gives an empty queue — the same value `resumedSurface` used to hardcode, now the
 * answer for a log that genuinely holds no market rather than for every log.
 */
export function mergeQueues(queues: readonly WorkQueue[]): WorkQueue {
  const first = queues[0];
  if (first === undefined) return emptyQueue("resumed", "rmo_office");
  return {
    ...first,
    queueId: "resumed",
    revision: Math.max(...queues.map((q) => q.revision)),
    shards: queues.flatMap((q) => q.shards),
    claims: queues.flatMap((q) => q.claims),
    approvals: queues.flatMap((q) => q.approvals),
  };
}

/**
 * Rebuild the surface from a stored log — no runtime, no recomputation.
 *
 * THIS DOCSTRING SAID THE OPPOSITE OF THE CODE UNTIL 2026-09-05. It read "`queue` and `qa` are
 * EMPTY and that is stated rather than hidden", three lines above a comment reading "The queue and
 * the QA history come from the LOG, not from an empty stand-in" — the limit was closed and the
 * stated limit was not. In a register where "stated rather than hidden" makes a limit a promise
 * about the code, a stale one sends the next reader to build something that already exists.
 *
 * It carries the organization's WORK — cascade, calendar, priorities, gate verdicts — and its
 * QUEUE and QA history, folded from the log rather than stood in for.
 */
export function resumedSurface(store: string, atMs: number): {
  readonly surface: LoopSurface;
  readonly folded: ReturnType<typeof foldOrganization>;
} {
  const events = readEvents(store);
  const folded = foldOrganization(events);
  // The queue and the QA history come from the LOG, not from an empty stand-in.
  //
  // What an empty queue cost: `statusSurfaceFrom` derives its candidates partly from shards and
  // claims, so a resumed organization offered nothing to do and reported zero deployments — it read
  // as an organization that had never worked rather than one that had been interrupted. And with no
  // QA history a regression has no "before", so every regression came back as a feature that was
  // never built.
  //
  // MANY queues fold out of a log that spans runs, one per hat that held one. They are merged into
  // the surface's single queue rather than one being picked: choosing would silently hide the work
  // of every other hat, and a resumed run that quietly drops half the market is the failure this
  // whole boundary is about.
  const built = statusSurfaceFrom({
    queue: mergeQueues(folded.queues),
    gateEvaluations: folded.gateEvaluations,
    qa: folded.qa,
    cascade: folded.cascade,
    priorities: folded.priorities,
    snapshotIso: new Date(atMs).toISOString(),
    trace: events,
    pathsFor: (node) => (isLeafType(node.workType) ? [`src/Core/${node.workId}.fs`] : []),
  });
  return {
    surface: { snapshot: built.snapshot, candidates: built.candidates, heartbeatLane: "operational" },
    folded,
  };
}

/** Run the organization and turn it into the surface the loop looks at. */
export async function organizationSurface(args: AgentRunArgs): Promise<{
  readonly surface: LoopSurface;
  readonly delivered: boolean;
  readonly candidates: number;
  readonly unmeasured: readonly string[];
  readonly trace: readonly OrgEvent[];
  /** What this run COULD do, derived from the adapters it was given. Never declared. */
  readonly fidelity: OrgRuntimeReport["fidelity"];
  /**
   * Deliver one work item for real — the seam that makes a chosen slot DO something.
   *
   * Returned as a closure rather than as its ingredients because the ingredients are this run's:
   * its chart, its providers, its clock. Handing a caller the parts would let it assemble a
   * delivery against a different organization than the surface it is looking at.
   */
  readonly deliver: (workId: string) => Promise<DeliveryOutcome>;
}> {
  const chart = buildOrgChart(SEED_HATS);
  if (!chart.ok) throw new Error(chart.reason);

  let n = 0;
  // Hoisted, because the intake ADAPTER needs the same list the runtime does. `simulatedIntake`
  // replays exactly these; a real `--inbox` or `--tracker` ignores them and reaches for its own.
  const events: readonly ExternalEvent[] = [
    {
      ...DEFECT,
      // A different inbound ticket per run: the same product receives many reports over time, and
      // reusing one external id would make every run the same ticket arriving again.
      externalId: `T-${String(args.atMs)}`,
      ...(args.incident ? { kind: IntakeKind.Incident, title: "checkout is down" } : {}),
    },
  ];

  // ONE provider set for this run, named — so the delivery a chosen slot triggers runs against the
  // same adapters the runtime did. Building a second set here would let an agent's work be
  // simulated while the run reported real ports, or the reverse, with nothing to notice it.
  const chosenProviders =
    args.ports === undefined
      ? undefined
      : providersFromArgs(args.ports, events, args.qaFails ? RunOutcome.Failed : RunOutcome.Passed);
  const deps: OrgRuntimeDeps = {
    chart: chart.chart,
    externalEvents: events,
    agents: agentsFromChart(chart.chart),
    observations: [],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    // SCOPED TO THE RUN'S INSTANT. A bare counter mints the same ids on every invocation, so two
    // genuinely different runs sharing a store would collide: the fold would merge their work into
    // one organization and report one goal where two happened. The instant is already the thing
    // that distinguishes the runs, and it is passed in, so the ids stay deterministic.
    createId: (p) => `${p}-${String(args.atMs)}-${String(++n).padStart(3, "0")}`,
    nowMs: args.atMs,
    workBlockMs: 3_600_000,
    leaseMs: 300_000,
    priorityInputsFor: () => ({
      executivePriority: 0.5, customerImpact: 1, severity: 1, releaseRisk: 0.2,
      blockedDownstreamCount: 2, dependencyFanOut: 1, queueAgeMs: 0, hatScarcity: 0,
      budgetBurn: 0, estimatedEffort: 0.2,
    }),
    ...(args.qaFails ? { qaFallback: RunOutcome.Failed } : {}),
    // Built from the SAME function `run-org.ts` uses. A second mapping from flags to adapters would
    // be a second set of defaults to drift, and the one thing both CLIs must agree on is what
    // "unspecified" means — because that is the answer that decides whether a run touched anything.
    ...(chosenProviders === undefined ? {} : { providers: chosenProviders }),
    // The goal is about a long-lived product. Emitted as facts, so with `--store` the portfolio
    // accumulates goals across runs — which is the only thing a container buys that a per-run value
    // does not.
    portfolio: {
      portfolioId: "checkout",
      title: "Checkout",
      kind: PortfolioKind.Product,
      ownerHatId: "engineering_director",
    },
  };

  const report = await runOrgRuntime(deps);
  const built = statusSurfaceFrom({
    queue: report.queue,
    gateEvaluations: report.gateEvaluations,
    qa: report.qa,
    cascade: report.cascade,
    priorities: report.priorities,
    snapshotIso: new Date(args.atMs).toISOString(),
    trace: report.trace,
    pathsFor: (node) => (isLeafType(node.workType) ? [`src/Core/${node.workId}.fs`] : []),
  });

  if (args.store !== undefined) {
    appendRun(
      {
        atMs: args.atMs,
        delivered: report.delivered,
        levelsEngaged: report.levelsEngaged,
        refusals: report.refusals,
        trace: report.trace,
        // The run's own fidelity, written down. Without it the summary cannot tell a history where
        // everything shipped from one where nothing did.
        replayable: report.fidelity.replayable,
        realPorts: report.fidelity.realPorts,
      },
      args.store,
    );
  }

  // The run's own test evidence, for the one gate decided by evidence rather than opinion.
  // NO RUNS IS A REJECTION: an organization that ran no tests has validated nothing, and treating
  // "no failures found" as a pass is a check that cannot fail because it never looked.
  const runs = report.qa.flatMap((q) => q.runs);
  const failed = runs.filter((r) => r.outcome !== RunOutcome.Passed);
  const qaVerdict =
    runs.length === 0
      ? { outcome: GateOutcome.Rejected, reason: "no test runs were recorded; nothing was validated" }
      : failed.length === 0
        ? { outcome: GateOutcome.Approved, reason: `${String(runs.length)} test run(s) passed` }
        : {
            outcome: GateOutcome.Rejected,
            reason: `${String(failed.length)} of ${String(runs.length)} test run(s) did not pass`,
          };

  return {
    surface: { snapshot: built.snapshot, candidates: built.candidates, heartbeatLane: "operational" },
    delivered: report.delivered,
    candidates: built.candidates.length,
    /** Carried out so a caller can see WHICH fields the run could not measure, not just the numbers. */
    unmeasured: built.dora.unmeasured.map((u) => u.field),
    trace: report.trace,
    fidelity: report.fidelity,
    // WHAT A CHOSEN SLOT DOES. Bound to THIS run's chart, providers and clock, so the delivery
    // happens in the organization the agent is looking at rather than one assembled beside it.
    deliver: async (workId) => {
      const node = report.cascade.nodes.find((n) => n.workId === workId);
      if (node === undefined) {
        return {
          workId,
          complete: false,
          landed: false,
          blockedAt: undefined,
          evaluations: [],
          evidenceRefs: [],
          refusals: [`no cascade node for '${workId}'`],
          summary: `'${workId}' is not work this organization knows about; nothing was delivered`,
          doraContribution: 0,
        };
      }
      return deliverWorkItem({
        chart: chart.chart,
        node,
        pipeline: DEFAULT_PIPELINE,
        providers:
          deps.providers ??
          defaultProviderSet({ externalEvents: events, qaFallback: args.qaFails ? RunOutcome.Failed : RunOutcome.Passed }),
        atMs: args.atMs,
        proposerHatId: node.assigneeHatId ?? "unassigned",
        qaVerdict,
        branch: `agent-work/${workId}`,
      });
    },
  };
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv: readonly string[]): Promise<number> {
  const at = flagValue(argv, "--at");
  if (at === undefined || Number.isNaN(Date.parse(at))) {
    // Same rule as the loop's: the timestamp decides the record's address, so it is never defaulted.
    console.error("refused: --at <iso8601> is required — neither the organization nor the loop reads a clock");
    return 1;
  }
  // The SAME parser `run-org.ts` uses, over the SAME argv. An agent run and an organization run
  // that were given identical port flags must reach identical adapters, and the only way to be sure
  // of that is for there to be one place that decides.
  const ports = parseArgs(argv);
  const refusals = argRefusals(ports);
  if (refusals.length > 0) {
    for (const reason of refusals) console.error(`refused: ${reason}`);
    return 2;
  }

  const args: AgentRunArgs = {
    atMs: Date.parse(at),
    qaFails: argv.includes("--qa-fails"),
    incident: argv.includes("--incident"),
    resume: argv.includes("--resume"),
    ...(flagValue(argv, "--store") === undefined ? {} : { store: flagValue(argv, "--store")! }),
    ports,
  };

  // `--history` asks the loop about the agent, not the organization: no run is needed to answer it,
  // and running one would make reading the past have a side effect.
  if (argv.includes("--history")) return mainAsync(argv);

  if (args.resume) {
    if (args.store === undefined) {
      console.error("refused: --resume needs --store — there is nothing to resume from");
      return 1;
    }
    const { surface, folded } = resumedSurface(args.store, args.atMs);
    if (folded.factCount === 0) {
      // Falling back to a fresh run here would make a failed resume indistinguishable from a
      // successful one, which is the whole thing this flag exists to demonstrate.
      console.error(`refused: the store at ${args.store} holds no facts to resume from`);
      return 1;
    }
    console.log(
      `organization RESUMED from ${folded.factCount} fact(s): ` +
        `${folded.cascade.nodes.length} work item(s), ${folded.calendar.blocks.length} block(s), ` +
        `${surface.candidates.length} candidate(s) on the surface` +
        (folded.refusals.length === 0 ? "" : `  UNACCOUNTED: ${folded.refusals.join("; ")}`),
    );
    // WHAT THE INHERITED WORK WAS MADE OF. How much was recovered is a different question from
    // whether any of it was real, and the second one is the one a resumed organization cannot
    // answer for itself: before this line a store built from real merges printed exactly what a
    // pure simulation printed.
    console.log(`  inherited from ${String(folded.fidelities.length)} recorded run(s): ` +
      (folded.fidelities.length === 0
        ? "no run recorded its fidelity — UNKNOWN, not simulated"
        : everyRunWasSimulated(folded.fidelities)
          ? "every one simulated; nothing here was performed or reached"
          : `real port(s) touched: ${[...new Set(folded.fidelities.flatMap((f) => f.realPorts))].join(", ")}`));
    return mainAsync(argv, { surface: () => surface });
  }

  const org = await organizationSurface(args);
  console.log(
    `organization: ${org.delivered ? "DELIVERED" : "NOT DELIVERED"}, ` +
      `${org.candidates} candidate(s) on the surface, ` +
      `dora ${org.unmeasured.length === 0 ? "FULLY MEASURED" : `unmeasured: ${org.unmeasured.join(", ")}`}` +
      (args.store === undefined ? "" : `, history ${JSON.stringify(deliveryRate(args.store))}`),
  );
  // BESIDE the verdict, not under it. "DELIVERED" reads identically whether the work reached a
  // repository or reached nothing, and this is the only line that tells the two apart.
  console.log(`  DST-replayable: ${org.fidelity.replayable ? "yes" : "no"}`);
  // The same sentence the log gets, from the same function. Two wordings of one fact is two
  // chances to overstate it, and overstating it is the defect this line exists to prevent.
  console.log(`  ${fidelityLine(org.fidelity)}`);

  // What the PORTFOLIO has seen — across every stored run, which is the question a single run
  // cannot answer because each goal is its own tree.
  if (args.store !== undefined) {
    const folded = foldOrganization(readEvents(args.store));
    for (const pf of folded.portfolios.portfolios) {
      const h = portfolioHistory(folded.portfolios, folded.cascade, pf.portfolioId);
      console.log(
        `portfolio '${pf.title}' (${pf.kind}, owned by ${pf.ownerHatId}): ` +
          `${h.delivered}/${h.goals} goal(s) delivered` +
          (h.unknownGoals.length === 0 ? "" : `, ${h.unknownGoals.length} unaccounted`),
      );
    }
    // Which product THIS run's goal was about, and which products have nothing live.
    const goalId = folded.cascade.nodes.find((n) => n.workType === WorkType.Goal)?.workId;
    const about = goalId === undefined ? undefined : portfolioOf(folded.portfolios, goalId);
    if (about !== undefined) console.log(`  this goal was about '${about.title}'`);
    const idle = idlePortfolios(folded.portfolios, folded.cascade);
    // Idle is ATTENTION, not a wind-down: a product between goals is entirely normal.
    if (idle.length > 0) console.log(`  idle (all goals delivered): ${idle.map((p) => p.title).join(", ")}`);
  }

  // ── THE JOIN, AT THE RETURN AND NOT ONLY AT THE SURFACE ───────────────────
  // `surface` is what the agent SEES; `dispatch` is what its choice DOES. Until this line the
  // second half did not exist: a participant choosing `PickWork` advanced to `ExecutingWork` and
  // nothing ran, so the work was never done and never reported done.
  //
  // A non-`PickWork` slot dispatches nothing and returns `undefined` — heartbeats, pauses and free
  // time are changes to the agent's own state and the state machine already applies them. Returning
  // a manufactured success for those would be the defect this replaces, one slot over.
  const deps: MainDeps = {
    surface: () => org.surface,
    dispatch: async (option) => {
      if (option.tag !== "PickWork") return undefined;
      const outcome = await org.deliver(option.work.id);
      for (const r of outcome.refusals) console.error(`  ! ${r}`);
      console.log(`  dispatched: ${outcome.summary}`);
      return {
        workId: option.work.id,
        lane: option.work.lane,
        // WHAT LANDED, not what was attempted. A pipeline that passed every gate over a merge the
        // port refused is the organization and the repository disagreeing, and reporting that to
        // the agent as success would hide the one thing change control exists to catch.
        success: outcome.landed,
        doraContribution: outcome.doraContribution,
        notes: outcome.summary,
      };
    },
  };
  return mainAsync(argv, deps);
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
