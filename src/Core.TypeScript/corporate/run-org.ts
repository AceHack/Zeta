#!/usr/bin/env bun
/**
 * corporate/run-org.ts — the production entry point. One organizational cycle, end to end.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `runOrgRuntime`, `buildOrgChart` and `SEED_HATS` were reachable only from tests. An entry point
 * nothing outside a test suite invokes is a library nobody has shipped, and "it runs end to end" is
 * a claim about a code path nothing in production takes.
 *
 * This is that path. It builds the seeded organization, feeds it external reports, runs the whole
 * pipeline, and prints what happened and how the organization stands afterwards.
 *
 * Usage:
 *   bun src/Core.TypeScript/corporate/run-org.ts
 *   bun src/Core.TypeScript/corporate/run-org.ts --qa-fails       (QA rejects; nothing delivers)
 *   bun src/Core.TypeScript/corporate/run-org.ts --churn          (repeated failure → escalation)
 *   bun src/Core.TypeScript/corporate/run-org.ts --json           (the full report, for a pipe)
 *   bun src/Core.TypeScript/corporate/run-org.ts --cycle          (the delivery loop alone)
 *   bun src/Core.TypeScript/corporate/run-org.ts --admin          (also exercise the operator surface)
 *
 * By default every port is SIMULATED, and the run says so. To make one of them real:
 *   --inbox <dir>      read inbound events from a directory of JSON files
 *   --work-cmd <exe> [--work-arg <a> ...]   perform each work item as <exe> <a...> <workId>
 *   --test-cmd <exe> [--test-arg <a> ...]   run each test case as <exe> <a...> <testCaseId>
 *   --git <dir> [--base <branch>]   open and merge real branches in <dir>
 *   --worktrees <dir>               give every change its own checkout under <dir> (concurrency-safe)
 *   --review-queue <dir>            gates decided by verdicts filed under <dir>/<workId>/<gate>.json
 *   --review-cmd <exe> [--review-arg <a> ...]   gates decided by <exe> <a...> <gate> <workId>
 *   --review-model <model>          gates judged by a local model; an unclear answer is REFUSED
 *   --tracker <url> [--tracker-items <path>] [--tracker-map <field>=<path> ...]
 *                                   [--tracker-header <k:v> ...] [--tracker-source <name>]
 *                                   inbound work fetched from a real tracker, e.g. for Jira:
 *                                     --tracker-items issues --tracker-map externalId=key
 *                                     --tracker-map title=fields.summary
 *   --work-agent <exe> --work-verify <exe>   an agent performs each item and a DIFFERENT command
 *                                   decides whether it worked; the agent never votes on itself
 *
 * Any of these makes the run UNREPLAYABLE, which the fidelity block prints without being asked.
 *
 * Exit codes: 0 delivered · 1 not delivered · 2 the organization could not be built.
 */

import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { agentsFromChart, gateStaffing, runOrgRuntime, staffingReadout } from "./org-runtime";
import { firstContributorUnder, runOrgCycle } from "./org-cycle";
import {
  anchorIsCloseable,
  cascadeHealth,
  escalationPreview,
  meetingHealth,
  authorityOf,
  historyOf,
  lineActivity,
  moreUrgent,
  orgStatus,
  REFERENCE_WHITEWASH_THRESHOLD,
  shardHolder,
  traceHealth,
} from "./org-status";
import { IntakeKind, Severity, normalize, type ExternalEvent } from "./intake";
import { fidelityLine, type ProviderSet } from "./providers";
import {
  agentWorkExecutor,
  autoApproveReview,
  commandProposal,
  modelProposal,
  commandReview,
  commandTestRunner,
  commandWorkExecutor,
  directoryIntake,
  directoryReview,
  gitChangeControl,
  gitWorktreeChangeControl,
  httpIntake,
  modelReview,
  simulatedChangeControl,
  simulatedIntake,
  simulatedTestRunner,
  simulatedWorkExecutor,
} from "./adapters";
import { RunOutcome } from "./qa";
import { ollamaBackend } from "../accelerator/local-llm.ts";
import {
  approvePendingBinding,
  beat,
  decideGate,
  briefFor,
  cadenceAuthority,
  cancelBlock,
  dropAnchor,
  escalationOptions,
  gateOptionsFor,
  handBack,
  ingestThenTriage,
  menuForHatNow,
  normalizedSignal,
  previewSignal,
  priorityOptions,
  proposedOwner,
  revokeHat,
  validateChart,
} from "./org-admin";
import { EscalationAction, EscalationTrigger } from "./escalation";
import { ScheduleBlockType } from "./work-schedule";
import { observeForHat } from "./work-batch";
import { isLeafType, WorkType as WorkTypeValue } from "./goal-cascade";
import { associateGoal, EMPTY_BOOK, openPortfolio, PortfolioKind, retirePortfolio } from "./portfolio";
import { appendRun, deliveryRate, readEvents } from "./org-store";
import { runUntilSettled } from "./autonomy";
import { decideSupply, endorseRecommendation } from "./rmo";
import { authorityFor, pressureBoard } from "./schedule-pressure";
import { isFullyMeasured, renderDora } from "./dora";
import { contextFor, runDispatchedCycle, statusSurfaceFrom } from "./agent-loop-bridge";
import { dispatcherFor, evaluatePromotionGate } from "./slot-dispatch";
import { compareToLegacy, foldObserveActWindow, legacySelection, type ObserveActTick } from "./observe-act-window";
import { deliverWorkItem } from "./work-delivery";
import { gitDataSource, unionOf } from "./git-data-source";
import type { DataSourcePort } from "./providers";
import { DEFAULT_PIPELINE } from "./pipeline";
import { foldObserveActTicks } from "./org-fold";
import { emit } from "./org-event";
import type { AgentState } from "../workflow-engine/agent-loop/state-machine";
import { GateKind, GateOutcome, NO_PROPOSER } from "./quality-gate";
import type { OrgChart } from "./org-chart";
import type { OrgRuntimeDeps, OrgRuntimeReport } from "./org-runtime";
import type { NextAction } from "../observe/observe";

/** The reports this run feeds in. Three deliberately: one good, one duplicate, one incomplete. */
const REPORTS: readonly ExternalEvent[] = [
  {
    source: "portal",
    externalId: "T-1",
    kind: IntakeKind.Defect,
    severity: Severity.High,
    title: "checkout double-charges when a coupon is applied twice",
    reproduction: "add a coupon, refresh, add it again",
    evidenceRefs: ["log/503", "trace/checkout"],
  },
  // The same upstream report, retried. De-duplicated on the idempotency key.
  {
    source: "portal",
    externalId: "T-1",
    kind: IntakeKind.Defect,
    title: "checkout double-charges (resent)",
    reproduction: "as above",
    evidenceRefs: ["log/503"],
  },
  // A defect with no reproduction steps. Refused at the door.
  { source: "support", externalId: "S-9", kind: IntakeKind.Defect, title: "it is broken" },
];

export interface Args {
  readonly qaFails: boolean;
  readonly churn: boolean;
  readonly json: boolean;
  readonly cycleOnly: boolean;
  readonly admin: boolean;
  /** Where to persist the run's history. Absent means the run leaves no trace on disk. */
  readonly store: string | undefined;
  /**
   * Which adapter answers each port. Absent means the SIMULATED one — explicitly, and the run says
   * so in its own output. Reaching reality is opt-in and visible at the command line.
   */
  readonly inbox: string | undefined;
  readonly workCmd: string | undefined;
  readonly testCmd: string | undefined;
  /**
   * Fixed leading arguments for those commands, in order. The work item's id (or the test case's)
   * is APPENDED after them, so `--work-cmd bun --work-arg build.ts` runs `bun build.ts <workId>`.
   * Supplied by the operator, never by a work item — see `providersFromArgs`.
   */
  readonly workArgs: readonly string[];
  readonly testArgs: readonly string[];
  /**
   * Who decides the six gates that are not runtime validation.
   *
   * Absent means AUTO-APPROVE, which is what the register always did — six of seven gates could not
   * fail — and which the fidelity block now prints rather than leaving implied.
   */
  readonly reviewQueue: string | undefined;
  readonly reviewCmd: string | undefined;
  readonly reviewArgs: readonly string[];
  /** A model judges the six reviewable gates. Its unparseable answers are refused, never defaulted. */
  readonly reviewModel: string | undefined;
  /** A tracker endpoint, and how to find the events inside its response. */
  readonly tracker: string | undefined;
  readonly trackerItems: string | undefined;
  readonly trackerHeaders: readonly string[];
  readonly trackerMap: readonly string[];
  readonly trackerSource: string;
  /** An agent performs the work; a separate command decides whether it worked. */
  readonly workAgent: string | undefined;
  /**
   * A MODEL performs the work, in the same split as `--work-agent`: it proposes, the verifier
   * decides. Its proposal is prose, so a verifier that checks for a file will refuse it — which is
   * the correct outcome and not a defect. The register's job is to record that a model was asked and
   * that the check said no, rather than to accept testimony as work.
   */
  readonly workModel: string | undefined;
  readonly workAgentArgs: readonly string[];
  readonly workVerify: string | undefined;
  readonly workVerifyArgs: readonly string[];
  readonly git: string | undefined;
  readonly baseBranch: string;
  /**
   * Where per-change worktrees live. Absent means the SHARED checkout, which moves HEAD and is
   * therefore sequential-only — correct today, and a limit held by the caller rather than by the
   * adapter. Supplying this makes each change its own directory.
   */
  readonly worktrees: string | undefined;
  /**
   * The window the goal is supposed to land inside, as two ISO instants.
   *
   * Absent means the run declares no schedule, and the pace is reported as unmeasured rather than
   * as healthy — the same three-state honesty the fidelity block uses.
   */
  /**
   * Keep cycling until the organization settles, up to this many cycles.
   *
   * Absent means ONE cycle, which is what this CLI has always done. The bound is required when the
   * flag is used — a defaulted bound is a bound nobody chose, and it is the only number between an
   * autonomous loop and an unbounded one.
   */
  readonly until: string | undefined;
  readonly windowStart: string | undefined;
  readonly windowTarget: string | undefined;
  /**
   * The instant this run happens, ISO-8601. Defaults to epoch 0 — the frozen clock this CLI has
   * always used, so nothing changes for a caller who does not pass it.
   *
   * A DECLARED channel for time, not an ambient one. `Date.now()` here would make every run
   * unreplayable and would quietly let wall-clock drift into the observe-act window, which is the
   * failure `local-time-never-enters-the-shared-fold` names. Passing the instant means a soak can
   * be demonstrated deterministically: the same flags always produce the same window.
   */
  readonly now: string | undefined;
  /**
   * Leave the work for the AGENT to deliver instead of delivering it in the runtime's own loop.
   *
   * Off by default, so the CLI behaves exactly as it always has. On, the runtime staffs and
   * schedules and runs QA, and the delivery happens because an agent CHOSE the item — which is the
   * only arrangement in which the choice is load-bearing rather than decorative.
   */
  readonly agentDelivers: boolean;
  /**
   * A git repository agents READ from, as `<dir>` or `<dir>@<ref>`.
   *
   * Absent means grooming stays judgement-only. Repeatable: several repositories become one
   * G-Set union, which is what an organization whose domain spans repositories actually has.
   */
  readonly sourceRepos: readonly string[];
  /** Restrict each source repository to a subtree — `docs/`, say, rather than the whole tree. */
  readonly sourceSubdir: string | undefined;
}

/** The value after a flag, or undefined. A flag with nothing after it is the same as absent. */
function valueAfter(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

/**
 * Every value after every occurrence of a repeatable flag, in the order given.
 *
 * Order is preserved because these become argv entries for a real process, where `--work-arg run
 * --work-arg build` and its reverse are different commands. Taking only the last occurrence — the
 * usual shortcut — would silently drop arguments a caller wrote down.
 */
function valuesAfter(argv: readonly string[], flag: string): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (argv[i] === flag && value !== undefined) out.push(value);
  }
  return out;
}

export function parseArgs(argv: readonly string[]): Args {
  return {
    inbox: valueAfter(argv, "--inbox"),
    workCmd: valueAfter(argv, "--work-cmd"),
    testCmd: valueAfter(argv, "--test-cmd"),
    workArgs: valuesAfter(argv, "--work-arg"),
    testArgs: valuesAfter(argv, "--test-arg"),
    reviewQueue: valueAfter(argv, "--review-queue"),
    reviewCmd: valueAfter(argv, "--review-cmd"),
    reviewArgs: valuesAfter(argv, "--review-arg"),
    reviewModel: valueAfter(argv, "--review-model"),
    tracker: valueAfter(argv, "--tracker"),
    trackerItems: valueAfter(argv, "--tracker-items"),
    trackerHeaders: valuesAfter(argv, "--tracker-header"),
    trackerMap: valuesAfter(argv, "--tracker-map"),
    trackerSource: valueAfter(argv, "--tracker-source") ?? "tracker",
    workAgent: valueAfter(argv, "--work-agent"),
    workModel: valueAfter(argv, "--work-model"),
    until: valueAfter(argv, "--until"),
    windowStart: valueAfter(argv, "--window-start"),
    windowTarget: valueAfter(argv, "--window-target"),
    now: valueAfter(argv, "--now"),
    agentDelivers: argv.includes("--agent-delivers"),
    sourceRepos: valuesAfter(argv, "--source-repo"),
    sourceSubdir: valueAfter(argv, "--source-subdir"),
    workAgentArgs: valuesAfter(argv, "--work-agent-arg"),
    workVerify: valueAfter(argv, "--work-verify"),
    workVerifyArgs: valuesAfter(argv, "--work-verify-arg"),
    git: valueAfter(argv, "--git"),
    baseBranch: valueAfter(argv, "--base") ?? "main",
    worktrees: valueAfter(argv, "--worktrees"),
    qaFails: argv.includes("--qa-fails") || argv.includes("--churn"),
    churn: argv.includes("--churn"),
    json: argv.includes("--json"),
    store: ((i) => (i >= 0 ? argv[i + 1] : undefined))(argv.indexOf("--store")),
    cycleOnly: argv.includes("--cycle"),
    admin: argv.includes("--admin"),
  };
}

/** `a.b.c` into a nested object. Returns undefined at the first missing hop rather than throwing. */
export function atPath(body: unknown, path: string): unknown {
  let cursor: unknown = body;
  for (const hop of path.split(".")) {
    if (typeof cursor !== "object" || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[hop];
  }
  return cursor;
}

/** `k:v` pairs into headers. A pair with no colon is IGNORED rather than becoming a header named "". */
export function headersFrom(pairs: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const at = pair.indexOf(":");
    if (at <= 0) continue;
    out[pair.slice(0, at).trim()] = pair.slice(at + 1).trim();
  }
  return out;
}

/**
 * `--tracker-map field=path` pairs into an `ExternalEvent` mapper.
 *
 * This is what makes a real tracker reachable from a command line rather than only from code. Jira's
 * search response, for instance:
 *
 *   --tracker-items issues --tracker-map externalId=key --tracker-map title=fields.summary
 *
 * It REFUSES rather than guessing. An item with no `externalId` or no `title` throws, naming the
 * field and the path that was tried, and `httpIntake` turns that into a refusal carrying the item's
 * index. Substituting a placeholder id would put an unidentifiable ticket into the queue, which is
 * worse than not accepting it: nobody could ever match it back to the tracker.
 */
export function trackerMapper(source: string, pairs: readonly string[]): (item: unknown) => ExternalEvent {
  const paths = new Map<string, string>();
  for (const pair of pairs) {
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    paths.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
  }
  const read = (item: unknown, field: string, fallback: string): string | undefined => {
    const path = paths.get(field) ?? fallback;
    const value = atPath(item, path);
    return typeof value === "string" ? value : undefined;
  };
  return (item) => {
    const externalId = read(item, "externalId", "externalId");
    const title = read(item, "title", "title");
    if (externalId === undefined) {
      throw new Error(`no externalId at '${paths.get("externalId") ?? "externalId"}'`);
    }
    if (title === undefined) throw new Error(`${externalId} has no title at '${paths.get("title") ?? "title"}'`);
    const severity = read(item, "severity", "severity");
    return {
      source,
      externalId,
      title,
      kind: IntakeKind.Defect,
      // An unrecognised severity becomes `Low` rather than being invented upward: over-stating
      // urgency from a field nobody mapped would let the tracker's noise set this org's priorities.
      severity: severity === Severity.Critical || severity === Severity.High || severity === Severity.Medium
        ? severity
        : Severity.Low,
      reproduction: read(item, "reproduction", "reproduction") ?? "",
      evidenceRefs: [`${source}/${externalId}`],
    };
  };
}

/**
 * What the flags ask for but cannot be given, said out loud instead of quietly downgraded.
 *
 * THE DEFECT THIS CLOSES. `--work-agent claude` with no `--work-verify` fell through every branch to
 * `simulatedWorkExecutor(true)` — an executor that reports success without doing anything. An
 * operator who asked for a real agent and forgot the verifier got a run that said every item
 * succeeded, and the only sign was one line in the fidelity block reading `simulated`. That is the
 * fallback this port layer exists to refuse, arriving through the argument parser instead of through
 * the registry.
 *
 * Stated as REASONS rather than a boolean, because "your flags are wrong" is not actionable and the
 * caller has to be told which half is missing.
 */
export function argRefusals(args: Args): readonly string[] {
  const out: string[] = [];
  if (args.workAgent !== undefined && args.workVerify !== undefined && args.workModel !== undefined) {
    out.push("--work-agent and --work-model both name a performer; supply one, because the run can only have done the work one way");
  }
  for (const [flag, value] of [["--work-agent", args.workAgent], ["--work-model", args.workModel]] as const) {
    if (value !== undefined && args.workVerify === undefined) {
      // NOT a default. The performer only ever produces testimony; without a verifier there is
      // nothing to turn testimony into an outcome, and the honest answer is that this run cannot be
      // configured — never that it silently becomes a simulation that reports success.
      out.push(`${flag} needs --work-verify — the performer only gives testimony, and something else has to decide whether it worked`);
    }
  }
  if (args.until !== undefined) {
    const n = Number.parseInt(args.until, 10);
    if (Number.isNaN(n) || n < 1) {
      out.push("--until takes a cycle bound of at least 1; an unbounded autonomous loop is not on offer");
    }
  }
  const startMs = args.windowStart === undefined ? undefined : Date.parse(args.windowStart);
  const targetMs = args.windowTarget === undefined ? undefined : Date.parse(args.windowTarget);
  if ((args.windowStart === undefined) !== (args.windowTarget === undefined)) {
    // HALF a window is not a window. Silently ignoring the supplied half would report the run as
    // having no schedule when the operator plainly meant to give it one.
    out.push("--window-start and --window-target come as a pair; one without the other declares no window");
  }
  for (const [flag, ms] of [["--window-start", startMs], ["--window-target", targetMs]] as const) {
    if (ms !== undefined && Number.isNaN(ms)) out.push(`${flag} is not a parseable ISO-8601 instant`);
  }
  if (startMs !== undefined && targetMs !== undefined && !Number.isNaN(startMs) && !Number.isNaN(targetMs) && targetMs <= startMs) {
    out.push("--window-target must be after --window-start; a window that ends before it begins has no pace");
  }
  for (const spec of args.sourceRepos) {
    // A repository is a DIRECTORY, and an empty spec is a flag someone meant to fill in. Refused
    // rather than skipped: a silently-dropped source is an organization grooming against less than
    // its operator believes it is reading.
    if (spec.trim() === "") out.push("--source-repo needs a directory, optionally as <dir>@<ref>");
  }
  if (args.sourceSubdir !== undefined && args.sourceRepos.length === 0) {
    out.push("--source-subdir narrows a source that was never declared: add --source-repo");
  }
  if (args.now !== undefined && Number.isNaN(Date.parse(args.now))) {
    out.push("--now is not a parseable ISO-8601 instant");
  }
  if (args.workVerify !== undefined && args.workAgent === undefined && args.workModel === undefined) {
    out.push("--work-verify was given with nothing to verify: add --work-agent or --work-model");
  }
  return out;
}

/**
 * Choose the adapter for every port from the flags.
 *
 * Note what this does NOT do: fall back. A flag naming a real adapter always produces that adapter,
 * and a port with no flag always produces the simulated one — there is no case where asking for
 * reality quietly yields a simulation, which is the failure `providers.ts` exists to prevent.
 *
 * The command adapters pass exactly ONE argument: the work item's id, or the test case's. Never the
 * title, never anything a reporter typed. A work item arrives from intake, which with `--inbox` is a
 * directory somebody else can write to; its text is untrusted input to this process.
 */
export function providersFromArgs(args: Args, events: readonly ExternalEvent[], qaFallback: RunOutcome): ProviderSet {
  return {
    intake:
      args.tracker !== undefined
        ? httpIntake({
            url: args.tracker,
            ...(args.trackerItems === undefined ? {} : { itemsAt: (body) => atPath(body, args.trackerItems ?? "") }),
            mapper: trackerMapper(args.trackerSource, args.trackerMap),
            headers: headersFrom(args.trackerHeaders),
          })
        : args.inbox === undefined
          ? simulatedIntake(events)
          : directoryIntake(args.inbox),
    work:
      args.workModel !== undefined && args.workVerify !== undefined
        ? agentWorkExecutor({
            // A model proposes. Same split, same refusal to let the proposer judge itself.
            perform: modelProposal(
              ollamaBackend({ model: args.workModel, seed: 42 }),
              (node) =>
                `You are implementing work item ${node.workId}: ${node.title}.
` +
                `Describe, in one or two sentences, the change you would make. Do not write code.`,
            ),
            verify: {
              command: args.workVerify,
              argsFor: (node) => [...args.workVerifyArgs, node.workId],
              cwd: args.git ?? process.cwd(),
            },
            name: "model",
          })
      : args.workAgent !== undefined && args.workVerify !== undefined
        ? agentWorkExecutor({
            // The agent proposes: whatever it prints is testimony, never a verdict.
            perform: commandProposal({
              command: args.workAgent,
              argsFor: (node) => [...args.workAgentArgs, node.workId],
              cwd: args.git ?? process.cwd(),
            }),
            // The verifier decides. A different command on purpose — the same one would be the
            // agent marking its own homework, which is the whole thing this port refuses.
            verify: {
              command: args.workVerify,
              argsFor: (node) => [...args.workVerifyArgs, node.workId],
              cwd: args.git ?? process.cwd(),
            },
          })
        : args.workCmd === undefined
          ? simulatedWorkExecutor(true)
          : commandWorkExecutor({
            command: args.workCmd,
            argsFor: (node) => [...args.workArgs, node.workId],
            cwd: args.git ?? process.cwd(),
          }),
    tests:
      args.testCmd === undefined
        ? simulatedTestRunner(new Map(), qaFallback)
        : commandTestRunner({
            command: args.testCmd,
            argsFor: (tc) => [...args.testArgs, tc.testCaseId],
            cwd: args.git ?? process.cwd(),
          }),
    review:
      args.reviewModel !== undefined
        ? modelReview(
            ollamaBackend({ model: args.reviewModel, seed: 42 }),
            (request) =>
              `You are reviewing the '${request.gate}' gate for work item ${request.workId}.
` +
              `Evidence: ${request.evidence.map((e) => e.ref).join("; ") || "none"}
` +
              `Answer with exactly one word, either approve or reject.`,
          )
        : args.reviewQueue !== undefined
          ? directoryReview(args.reviewQueue)
          : args.reviewCmd !== undefined
          ? commandReview({
              command: args.reviewCmd,
              // The gate and the work id, in that order, after any fixed arguments. Never a title.
              argsFor: (request) => [...args.reviewArgs, request.gate, request.workId],
              cwd: args.git ?? process.cwd(),
            })
          : autoApproveReview(),
    change:
      args.git === undefined
        ? simulatedChangeControl()
        : args.worktrees === undefined
          ? gitChangeControl({ cwd: args.git, baseBranch: args.baseBranch })
          : gitWorktreeChangeControl({ cwd: args.git, baseBranch: args.baseBranch, worktreeRoot: args.worktrees }),
  };
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);

  // Before the organization is built, because a misconfigured run that reaches the cascade has
  // already printed a page of output an operator will read as progress.
  const refusals = argRefusals(args);
  if (refusals.length > 0) {
    for (const reason of refusals) console.error(`refused: ${reason}`);
    return 2;
  }

  const built = buildOrgChart(SEED_HATS);
  if (!built.ok) {
    console.error(`[org] the seeded organization is not valid: ${built.reason}`);
    return 2;
  }
  const chart = built.chart;
  const agents = agentsFromChart(chart);

  // Every gate must have an owner before anything is promised. A gate nobody holds blocks the
  // pipeline, and finding that out at the release gate is later than an operator needs to know.
  const staffing = gateStaffing(chart);
  const unstaffed = Object.entries(staffing).filter(([, owners]) => owners.length === 0);
  if (unstaffed.length > 0) {
    console.error(`[org] no hat holds the approval scope for: ${unstaffed.map(([g]) => g).join(", ")}`);
    return 2;
  }

  let n = 0;
  const createId = (p: string): string => `${p}-${String(++n).padStart(3, "0")}`;
  // Epoch 0 unless the caller declares otherwise — see `--now`. Never `Date.now()`: an ambient
  // clock would make this run unreplayable and would leak wall time into the observe-act window.
  const nowMs = args.now === undefined ? 0 : Date.parse(args.now);

  // ── The delivery loop alone ───────────────────────────────────────────────
  if (args.cycleOnly) {
    const report = runOrgCycle({
      chart,
      plan: {
        goalTitle: "cut checkout abandonment",
        acceptingHatId: "cto",
        initiativeTitles: ["fix the coupon path"],
        projectTitles: ["coupon service hardening"],
        taskTitles: ["stop the double-apply", "add the regression test"],
      },
      createId,
      nowMs,
      workBlockMs: 3_600_000,
      resourceAuthorityHatId: "rmo_office",
      contributorFor: (task) => firstContributorUnder(chart, task.ownerHatId),
      outcomeFor: () => "done",
    });
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else {
      report.events.forEach((e, i) => console.log(`  ${String(i + 1).padStart(2)}. ${e}`));
      report.refusals.forEach((r) => console.log(`   ! ${r}`));
      // BEFORE the verdict, not after. This path prints "passed the gates" and "DELIVERED" in the
      // same voice as the run that reaches a real repository, and until this line a reader had
      // nothing to tell them apart. A label under the conclusion is a label people have already
      // stopped reading.
      console.log(`\n--- fidelity ---`);
      console.log(`  ${report.fidelity.summary}`);
      for (const d of report.fidelity.decisions) {
        console.log(`  ${d.decision.padEnd(13)} ${d.from.padEnd(11)} ${d.detail}`);
      }
    }
    return report.delivered ? 0 : 1;
  }

  // ── The whole organization ────────────────────────────────────────────────
  // ── THE DATA SOURCES THIS RUN READS ───────────────────────────────────────
  // `<dir>` or `<dir>@<ref>`. The ref defaults inside `gitDataSource` to `origin/main` rather than
  // HEAD, because HEAD is a property of one checkout and the organization's context is not.
  const dataSource = args.sourceRepos.length === 0 ? undefined : sourceFromArgs(args);

  const providers = providersFromArgs(args, REPORTS, args.qaFails ? RunOutcome.Failed : RunOutcome.Passed);
  const runtimeDeps = {
    chart,
    externalEvents: REPORTS,
    agents,
    observations: [],
    acceptingHatId: "cto",
    resourceAuthorityHatId: "rmo_office",
    priorityDeciderHatId: "cto",
    createId,
    nowMs,
    workBlockMs: 3_600_000,
    // The declared window, if the operator gave one. Absent means the run reports its pace as
    // unmeasured rather than as healthy.
    ...(args.windowStart === undefined || args.windowTarget === undefined
      ? {}
      : { missionWindow: { startsAtMs: Date.parse(args.windowStart), targetAtMs: Date.parse(args.windowTarget) } }),
    // Nothing delivered by the runtime when the agent lane owns delivery, so the work is still live
    // when the loop is offered it — otherwise the loop sees an empty candidate list and `PickWork`
    // is not on the menu at all.
    ...(args.agentDelivers ? { deliverSelf: [] } : {}),
    // WHAT AGENTS READ FROM. Absent leaves grooming judgement-only; one or more repositories
    // become a G-Set union, which is the merge the agent-bus already proves is commutative and
    // idempotent.
    ...(dataSource === undefined ? {} : { dataSource }),
    leaseMs: 300_000,
    ...(args.qaFails ? { qaFallback: RunOutcome.Failed } : {}),
    ...(args.churn ? { churnThreshold: 2, maxGateAttempts: 5 } : {}),
    providers,
    priorityInputsFor: (item: { readonly severity?: unknown }) => ({
      executivePriority: 0.5,
      customerImpact: item.severity === Severity.Critical || item.severity === Severity.High ? 1 : 0.4,
      severity: item.severity === Severity.Critical ? 1 : item.severity === Severity.High ? 0.8 : 0.3,
      releaseRisk: 0.2,
      blockedDownstreamCount: 2,
      dependencyFanOut: 1,
      queueAgeMs: 0,
      hatScarcity: 0,
      budgetBurn: 0,
      estimatedEffort: 0.2,
    }),
  } satisfies OrgRuntimeDeps;

  // ── ONE CYCLE, OR UNTIL IT SETTLES ────────────────────────────────────────
  // Absent `--until`, this is the single cycle the CLI has always run. With it, the driver keeps
  // going and reports WHY it stopped — delivered, an escalation halted a task, a cycle changed
  // nothing, or the bound. "It stopped" and "it finished" are the two sentences a caller must
  // never confuse, so the reason is printed rather than folded into the exit code.
  const settled =
    args.until === undefined
      ? undefined
      : await runUntilSettled(
          runtimeDeps,
          {
            maxCycles: Number.parseInt(args.until, 10),
            // The clock advances between cycles: the runtime keys its ids on the instant, so a
            // frozen clock would mint colliding ids across cycles and fold two runs into one.
            nextNowMs: (_c, prev) => prev + 1,
          },
          runOrgRuntime,
        );
  const report = settled?.last ?? (await runOrgRuntime(runtimeDeps));

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return report.delivered ? 0 : 1;
  }

  console.log(`\n=== ${report.delivered ? "DELIVERED" : "NOT DELIVERED"} ===`);
  console.log(`levels engaged: ${report.levelsEngaged.join(" → ")}`);

  // Printed on EVERY run, not only the interesting ones. A run that reached a shell and did not
  // mention it is the claim this whole layer exists to make unsayable, and a block that only
  // appeared when something was real would train a reader to skip it.
  console.log(`\n--- fidelity ---`);
  // TWO STATEMENTS, because they answer different questions and can differ. `replayable` is about
  // the SET — a real adapter in it means the next run could reach, whether or not this one did.
  // The line beneath is about THIS run, and says which of those ports it actually called.
  console.log(`  DST-replayable: ${report.fidelity.replayable ? "yes" : "no"}`);
  console.log(`  ${fidelityLine(report.fidelity)}`);

  // PACE, beside fidelity and for the same reason: "DELIVERED" says nothing about whether it
  // arrived when it was supposed to, and an organization that only reports completion discovers
  // its schedule at the deadline.
  // WHY THE LOOP STOPPED, when there was a loop. Printed before the rest, because every line that
  // follows describes the LAST cycle and a reader needs to know whether that cycle was the end.
  if (settled !== undefined) {
    console.log(`
--- autonomy ---`);
    console.log(`  ${settled.stoppedBecause.toUpperCase()}: ${settled.summary}`);
  }

  console.log(`
--- pace ---`);
  console.log(
    report.trajectory === undefined
      ? "  no window declared — pace UNMEASURED (pass --window-start and --window-target)"
      : `  ${report.trajectory.status.toUpperCase()}: ${report.trajectory.basis}`,
  );
  for (const port of report.fidelity.ports) {
    console.log(`  ${port.port.padEnd(15)} ${port.name.padEnd(12)} ${port.fidelity.padEnd(10)} ${port.describes}`);
  }
  // What the port DID, printed next to what the organization decided. Under the simulated adapter
  // the two always agree, and the line is worth its space for the runs where they do not.
  console.log(
    `  changes: ${String(report.changes.length)} projected, ${String(report.changesLanded.length)} landed` +
      (report.changesLanded.length === 0 ? "" : ` (${report.changesLanded.join(", ")})`),
  );
  console.log(`\n--- what happened ---`);
  report.events.forEach((e, i) => console.log(`  ${String(i + 1).padStart(2)}. ${e}`));
  if (report.refusals.length > 0) {
    console.log(`\n--- refused ---`);
    report.refusals.forEach((r) => console.log(`   ! ${r}`));
  }

  // ── How the organization stands afterwards ────────────────────────────────
  const status = orgStatus({
    chart,
    cascade: report.cascade,
    bindings: report.bindings,
    calendar: report.calendar,
    board: report.board,
    queue: report.queue,
    testCases: report.testCases,
    testRuns: report.qa.flatMap((q) => q.runs),
    gateEvaluations: report.gateEvaluations,
    priorities: report.priorities,
    observations: [],
    agentIds: agents.map((a) => a.agentId),
    ...(report.goalWorkId === undefined ? {} : { goalWorkId: report.goalWorkId }),
    nowMs: Math.max(...report.bindings.map((b) => b.warmupEndsMs), nowMs),
  });

  // -- the reactor: did the organization actually MOVE, and what did it hand up --
  const rx = report.reactor;
  console.log(`\n--- movement ---`);
  console.log(
    `  loop:        ${rx.quiesced ? "quiesced" : "STOPPED BY THE STEP BOUND"} after ${rx.steps} action(s)` +
      (rx.pending.length === 0 ? "" : `, ${rx.pending.length} left undone`),
  );
  console.log(`  batches:     ${rx.batches.map((b) => `${b.batchId}=${b.state}`).join(", ") || "(none)"}`);
  for (const b of rx.batches) {
    if (b.blockedOn !== undefined) console.log(`    waiting on: ${b.blockedOn.dep}`);
    if (b.paused !== undefined) console.log(`    paused:     ${b.paused.reason}`);
  }
  for (const m of rx.metrics) {
    console.log(
      `    ${m.batchId}: ${m.done}/${m.total} done, ${m.unstaffed} unstaffed, ` +
        `${m.stalled} stalled, ${m.gateBounceBacks} bounce-back(s)`,
    );
  }
  if (rx.stalledBatchIds.length > 0) console.log(`  STALLED:     ${rx.stalledBatchIds.join(", ")}`);
  // Per-hat readouts: the SAME batches seen at three different scopes. An IC sees its own items, a
  // director its department, the CTO the organization — derived from the chart, not configured.
  for (const hatId of ["backend_implementer", "engineering_director", "cto"]) {
    const ro = observeForHat(chart, hatId, {
      batches: rx.batches,
      cascade: report.cascade,
      testRuns: report.qa.flatMap((q) => q.runs),
      gateEvaluations: report.gateEvaluations,
      nowMs,
    });
    if (ro === undefined) continue;
    console.log(
      `    ${hatId.padEnd(22)} scope=${ro.scope.padEnd(13)} ` +
        `${ro.batches.length} batch(es), ${ro.rollup.done}/${ro.rollup.total} done`,
    );
  }
  if (rx.raised.length > 0) {
    // Raised, not performed: these belong to a hat. Printing them as work the run did would claim
    // a decision nobody made.
    console.log(`  raised for a hat:`);
    for (const a of rx.raised) console.log(`    ${a.kind.padEnd(16)} -> ${a.byHatId} (${a.causedBy ?? "seeded"})`);
  }

  // -- the DORA surface, and one turn of the canonical agent loop over it --
  //
  // The organization supplies a status surface; the loop does not know it exists. Unmeasurable
  // fields say so rather than printing a plausible zero.
  const surface = statusSurfaceFrom({
    queue: report.queue,
    gateEvaluations: report.gateEvaluations,
    qa: report.qa,
    cascade: report.cascade,
    priorities: report.priorities,
    snapshotIso: new Date(nowMs).toISOString(),
    // The trace is what makes an incident's restoration time readable — and so MTTR measurable.
    trace: report.trace,
    // The organization models work as titles; lanes are defined over PATHS. Supplying them is what
    // turns `substrateRatio` and the per-hat ratios from declared-unmeasured into measurements, so
    // the demo supplies a plausible path per task rather than leaving the whole term dark.
    pathsFor: (node) =>
      isLeafType(node.workType) ? [`src/Core/${node.workId}.fs`] : [],
  });
  console.log(`\n--- dora (fully measured: ${isFullyMeasured(surface.dora)}) ---`);
  for (const line of renderDora(surface.dora)) console.log(`  ${line}`);

  console.log(`\n--- agent loop ---`);
  console.log(
    `  surface:     ${surface.candidates.length} candidate(s), ` +
      `${surface.snapshot.hotTrajectories.length} hot / ${surface.snapshot.coolingTrajectories.length} cooling, ` +
      `${surface.snapshot.explorationCandidates.length} worth exploring`,
  );
  // ── WHICH MODE THIS LANE HAS EARNED ───────────────────────────────────────
  // The gate decides, not the caller. A fresh window has no soak, so it resolves to SHADOW — and
  // shadow dispatches nothing and produces no result, which is what leaves the agent in
  // `ExecutingWork`: picked up, outstanding. The line this replaced handed the loop
  // `{ success: true, doraContribution: 0.5 }`, so every cycle reported work nobody did.
  // The window is FOLDED from durable ticks, not declared. With no store there are no prior ticks
  // and the window is empty — which still resolves to shadow, but now for the true reason (nothing
  // has soaked) rather than because the number was hardcoded to zero.
  const priorTicks = args.store === undefined ? [] : foldObserveActTicks(readEvents(args.store));
  const readout = foldObserveActWindow(priorTicks, nowMs);
  const verdict = evaluatePromotionGate(readout.window);
  // ── WHAT A CHOSEN SLOT ACTUALLY DOES ──────────────────────────────────────
  // `deliverWorkItem` RUNS THE PIPELINE for the item the agent picked — opens a change, walks the
  // phases, merges what passed. It does not read the report of a run that already happened.
  //
  // That distinction is the whole point and the previous version of this line failed it. Replacing
  // the hardcoded `{ success: true }` with a LOOKUP into `report` still left the agent's decision
  // decorative: the pipeline ran because the runtime iterated its own list, and the choice was
  // consulted by nobody. A dispatcher reporting an outcome it did not cause is the same lie, told
  // more quietly.
  //
  // A node the cascade does not have is a REFUSAL, not a failure — the agent picked something this
  // organization does not know about, which is a different problem from work that did not land.
  const dispatcher = dispatcherFor(verdict, async (workId) => {
    const node = report.cascade.nodes.find((n) => n.workId === workId);
    if (node === undefined) {
      return {
        succeeded: false,
        evidenceRefs: [],
        summary: `no cascade node for '${workId}'; nothing was delivered`,
        doraContribution: 0,
      };
    }
    const outcome = await deliverWorkItem({
      chart,
      node,
      pipeline: DEFAULT_PIPELINE,
      providers,
      atMs: nowMs,
      proposerHatId: node.assigneeHatId ?? "unassigned",
      // The tests this run ACTUALLY produced decide runtime_validation — not an assumption, and
      // not an approval handed over because no runs were found.
      qaVerdict: qaVerdictFrom(report),
      branch: `agent-work/${workId}`,
    });
    return {
      succeeded: outcome.landed,
      evidenceRefs: outcome.evidenceRefs,
      summary: outcome.summary,
      doraContribution: outcome.doraContribution,
    };
  });
  console.log(`  mode:        ${verdict.mode}${verdict.blockedBy.length === 0 ? "" : ` — ${verdict.blockedBy[0]!}`}`);
  console.log(`  window:      ${readout.summary}`);

  let loopState: AgentState = { tag: "Idle", context: contextFor("alexa", 1, new Date(nowMs).toISOString()) };
  const ticks: ObserveActTick[] = [];
  for (let cycle = 1; cycle <= 3; cycle += 1) {
    const turn = await runDispatchedCycle({ state: loopState, surface, dispatcher });
    // THE COMPARISON, run every tick. The legacy lane is the priority-ordered assignment path the
    // organization already has — a genuinely different selector from the menu generator, which
    // weighs trajectory heat, balance and interest. They can disagree, which is what makes the
    // divergence rate a measurement rather than a tautology over one selector consulted twice.
    const compared = compareToLegacy(
      {
        slot: turn.chosen?.tag ?? "(none)",
        ...(turn.dispatch?.workId === undefined ? {} : { workId: turn.dispatch.workId }),
      },
      legacySelection(surface.candidates),
    );
    ticks.push({
      tickId: `tick-${String(cycle)}`,
      // AT the run's instant, not after it. `nowMs + cycle` stamped ticks in the future relative to
      // the run's own clock, and the window's future guard then dropped every one of them — a fold
      // that correctly refused evidence the emitter had mislabelled.
      atMs: nowMs,
      mode: verdict.mode,
      slot: turn.chosen?.tag ?? "(none)",
      ...(turn.dispatch?.workId === undefined ? {} : { workId: turn.dispatch.workId }),
      performed: turn.dispatch?.performed ?? false,
      // A clamped choice is the chooser having reached outside the menu — the illegal selection the
      // gate counts. `runDispatchedCycle` reports it as a refusal rather than hiding the clamp.
      illegalSelection: turn.refusals.some((r) => r.startsWith("chooser clamped")),
      // Nothing in this register refuses at act time yet, so this is HONESTLY false rather than
      // absent — no dispatch was authorized and then stopped.
      controlBypassRejected: false,
      ...compared,
    });
    console.log(
      `  cycle ${cycle}:     ${turn.menu.length} option(s) -> ${turn.chosen?.tag ?? "(none)"}` +
        ` -> ${turn.state.tag}${turn.nonCoercive ? "" : "  COERCIVE MENU"}` +
        (turn.abandonedWorkId === undefined ? "" : `  (abandoned ${turn.abandonedWorkId})`) +
        (turn.dispatch === undefined ? "" : `  [${turn.dispatch.performed ? "dispatched" : "not dispatched"}]`) +
        `  {legacy ${compared.comparison}}`,
    );
    for (const r of turn.refusals) console.log(`   ! ${r}`);
    loopState = turn.state;
  }
  // The ticks join the run's own trace, so storing the run stores them and the NEXT run folds a
  // window that includes this one. That is the whole mechanism: without this line the window is
  // empty forever and the gate is unfalsifiable.
  const tickEvents = ticks.map((tick, i) =>
    // Keyed by the run's instant AND the cycle. Two runs at different instants store distinct
    // ticks; re-running the SAME instant re-stores the same shard, which is an upsert — the
    // idempotency discipline, and the reason a repeated run cannot inflate its own soak window.
    emit(chart, `evt-tick-${String(nowMs)}-${String(i + 1)}`, {
      kind: "observe_act_tick",
      subjectId: tick.workId ?? tick.slot,
      decision: `observe-act tick: ${tick.slot} in ${tick.mode} (legacy ${tick.comparison})`,
      atMs: tick.atMs,
      evidenceRefs: [`observe-act-tick:${tick.tickId}`],
      fact: { kind: "observe_act_tick", tick },
    }),
  );

  // -- persist the run, if asked --
  //
  // The trace IS the append-only log; storing it is one shard per event, so two runs never contend
  // for a path and re-storing a run is an upsert. Off by default: writing to disk is a side effect
  // and a reporting CLI should not have one unless told.
  if (args.store !== undefined) {
    const stored = appendRun(
      {
        atMs: nowMs,
        delivered: report.delivered,
        levelsEngaged: report.levelsEngaged,
        refusals: report.refusals,
        trace: [...report.trace, ...tickEvents],
        // The run's own fidelity, written down. Without it the summary cannot tell a history where
        // everything shipped from one where nothing did.
        replayable: report.fidelity.replayable,
        realPorts: report.fidelity.realPorts,
      },
      args.store,
    );
    const rate = deliveryRate(args.store);
    console.log(`\n--- stored ---`);
    console.log(`  ${stored.eventPaths.length} event(s) + 1 run summary under ${args.store}`);
    console.log(`  history: ${rate.delivered}/${rate.runs} run(s) delivered`);
  }

  // -- resource management: how many wearers each hat is authorized, and whose week is impossible --
  //
  // Supply is a RECOMMENDATION from priority-weighted workload and an AUTHORIZATION from a quorum
  // of the hat's own supervisors. Pressure is the question a calendar could not answer: a week can
  // be conflict-free and still impossible.
  console.log(`
--- resource management ---`);
  const wearers = new Map<string, number>();
  for (const b of report.bindings) wearers.set(b.hatId, (wearers.get(b.hatId) ?? 0) + 1);
  const staffedHats = [...new Set(report.cascade.nodes.map((n) => n.assigneeHatId).filter((h): h is string => h !== undefined))];
  for (const hatId of staffedHats) {
    const decision = decideSupply({
      chart,
      hatId,
      currentWearers: wearers.get(hatId) ?? 0,
      supply: { cascade: report.cascade, priorities: report.priorities },
      voteBy: endorseRecommendation("workload"),
    });
    console.log(
      decision.ok
        ? `  ${hatId.padEnd(22)} ${decision.decision.action.padEnd(8)} target ${decision.decision.target}` +
            ` (now ${decision.decision.currentWearers}, ${decision.decision.votesCast}/${decision.decision.voters.length} voted)`
        : `  ${hatId.padEnd(22)} no decision: ${decision.reason}`,
    );
  }
  const board = pressureBoard(staffedHats, {
    chart,
    calendar: report.calendar,
    cascade: report.cascade,
    supply: { cascade: report.cascade, priorities: report.priorities },
    currentWearers: 1,
  });
  if (board.length === 0) {
    console.log(`  no hat is under schedule pressure`);
  } else {
    for (const p of board) {
      console.log(`  PRESSURE ${p.hatId} ${(p.score * 100).toFixed(0)}% -> ${p.correctives.join(", ")}`);
      for (const c of p.correctives) {
        console.log(`    ${c.padEnd(22)} may be done by: ${authorityFor(chart, p.hatId, c).slice(0, 3).join(", ") || "(nobody)"}`);
      }
    }
  }

  console.log(`\n--- status ---`);
  console.log(`  chart:       ${status.chart.levels.map((l) => `${l.level}=${l.hats}`).join(" ")}`);
  console.log(`  worn hats:   ${status.chart.wornHats.join(", ") || "(none)"}`);
  console.log(`  qa:          ${(status.qa.passRate * 100).toFixed(0)}% pass over ${status.qa.totalRuns} run(s), ` +
    `${status.qa.regressions} regression(s), ${status.qa.failedFeatures} unbuilt, ${status.qa.untested} untested`);
  console.log(`  queue:       ${status.queue.ready} ready, ${status.queue.inFlight} in flight, ` +
    `${status.queue.merged} merged, ${status.queue.awaitingReview.length} awaiting review, ` +
    `${status.queue.staleClaims.length} stale`);
  for (const g of status.gates) {
    console.log(`  gates ${g.workId}: ${(g.progress * 100).toFixed(0)}%` +
      `${g.merged ? " (merged)" : ` — next ${g.nextGate}, recovery ${g.recoveryIfRejected}`}` +
      `${g.unauthorizedEvaluations > 0 ? `  !! ${g.unauthorizedEvaluations} unauthorized` : ""}`);
  }
  for (const c of status.churn.filter((x) => x.bounceBacks > 0)) {
    console.log(`  churn ${c.workId}: ${c.bounceBacks} bounce-back(s)` +
      `${c.churning ? ` — CHURNING at ${c.stuckAt}` : ""}`);
  }
  for (const s of status.schedules) {
    console.log(`  schedule ${s.hatId}: ${s.booked} block(s), ${(s.reliability * 100).toFixed(0)}% kept` +
      `${s.busyNow ? `, busy on ${s.doingNow}` : ", free"}`);
  }
  const owing = status.deliberation.filter((d) => d.owing.length > 0);
  console.log(`  anchors:     ${owing.length} hat(s) owe an output on an open anchor`);
  console.log(`  whitewash:   threshold ${status.exposure.whitewashThreshold} ` +
    `(reference ${REFERENCE_WHITEWASH_THRESHOLD}; ` +
    `${status.exposure.agentsWhoGainByRestarting.length} agent(s) would gain by restarting)`);

  // The brief a dev carries — the thing that tells it how to talk upward.
  const dev = report.bindings[0]?.hatId;
  if (dev !== undefined) {
    const brief = briefFor(chart, dev, "rmo_office");
    if (brief.ok) {
      console.log(`\n--- ${dev}'s communication brief ---`);
      console.log(`  duty:       ${brief.value.duty}`);
      console.log(`  supervisor: ${brief.value.supervisorHatId ?? "(none)"}`);
      console.log(`  escalates:  ${brief.value.escalationHatId ?? "(nobody)"}`);
      console.log(`  may:        ${authorityOf(chart, dev).join(", ") || "(nothing)"}`);
      for (const t of brief.value.tools) {
        console.log(`    ${t.tool.padEnd(20)} → ${t.targetHatId ?? "(nowhere)"}` +
          `${t.evidenceAnyOf.length > 0 ? `   needs: ${t.evidenceAnyOf.join("|")}` : ""}`);
      }
    }
    const who = staffingReadout(chart, dev, agents, report.bindings, nowMs);
    if (who !== undefined) {
      console.log(`\n--- who could wear ${dev} ---`);
      console.log(`  eligible: ${who.eligible.map((c) => c.agentId).join(", ") || "(nobody)"}`);
      for (const x of who.excluded.slice(0, 5)) console.log(`  excluded: ${x.agentId} — ${x.reason}`);
    }
  }

  // ── Leaves of the status the summary above does not compose ──────────────
  const firstTask = report.cascade.nodes.find((n) => n.assigneeHatId !== undefined);
  if (firstTask !== undefined) {
    const ch = cascadeHealth(report.cascade, firstTask.workId);
    if (ch !== undefined) {
      console.log(`\n--- accountability for ${ch.workId} ---`);
      console.log(`  chain:     ${ch.accountableChain.join(" → ")}`);
      console.log(`  rung:      ${ch.rung ?? "?"}   children: ${ch.children}   delivered: ${ch.delivered}`);
    }
  }
  const firstShard = report.queue.shards[0];
  if (firstShard !== undefined) {
    const holder = shardHolder(report.queue, firstShard.shardId, nowMs);
    if (holder !== undefined) {
      console.log(`  shard ${firstShard.shardId} held by ${holder.agentId}${holder.stale ? " (STALE)" : ""}`);
    }
  }
  const meetingId = report.calendar.blocks.find((b) => b.blockType === ScheduleBlockType.Meeting)?.meetingId;
  if (meetingId !== undefined) {
    const m = meetingHealth(report.calendar, meetingId);
    console.log(
      `  meeting:   ${m.attendees.length} attendee(s)` +
        `${m.conflicted.length > 0 ? `, CONFLICTED: ${m.conflicted.join(", ")}` : ", no conflicts"}`,
    );
  }
  for (const a of report.board.anchors.filter((x) => x.state === "open").slice(0, 3)) {
    console.log(
      `  anchor ${a.anchorId}: ${anchorIsCloseable(report.board, a.anchorId) ? "closeable" : "still owes its output"}`,
    );
  }
  const [p0, p1] = report.priorities;
  if (p0 !== undefined && p1 !== undefined) {
    console.log(`  priority:  ${p0.workId} ${moreUrgent(p0, p1) ? "outranks" : "does not outrank"} ${p1.workId}`);
  }

  const th = traceHealth(report.trace);
  console.log(`
--- trace ---`);
  console.log(`  ${th.total} event(s) from ${th.actors.length} actor(s); ` +
    `${th.gateVerdicts} gate verdict(s), ${th.escalations} escalation(s)`);
  console.log(`  unattributed: ${th.unattributed.length === 0 ? "none" : th.unattributed.join(", ")}`);
  for (const hatId of ["cto", "coo"]) {
    const a = lineActivity(report.trace, hatId);
    console.log(`  ${hatId}'s line: ${a.line} event(s) (${(a.share * 100).toFixed(0)}% of the run), ${a.own} decided directly`);
  }
  const firstStaffed = report.cascade.nodes.find((n) => n.assigneeHatId !== undefined);
  if (firstStaffed !== undefined) {
    console.log(`  history of ${firstStaffed.workId}:`);
    for (const e of historyOf(report.trace, firstStaffed.workId)) {
      console.log(`     ${e.kind.padEnd(24)} ${e.actorHatId ?? "-"}`);
    }
  }

  console.log(`
--- change control ---`);
  for (const c of report.changes) {
    console.log(`  ${c.workId}: ${c.projection.state.tag}` +
      `   (${c.projection.applied.map((a) => a.tag).join(" → ")})`);
    for (const d of c.disagreements) console.log(`     !! ${d}`);
  }

  if (args.admin) adminWalkthrough(chart, report, nowMs);

  return report.delivered ? 0 : 1;
}

/**
 * Exercise the operator surface against the organization this run produced.
 *
 * Every call is one an operator genuinely makes, and each authority check is shown REFUSING as well
 * as succeeding — a surface that only demonstrates its happy path has not shown the thing that makes
 * it safe.
 */
function adminWalkthrough(chart: OrgChart, report: OrgRuntimeReport, nowMs: number): void {
  console.log(`\n--- operator surface ---`);
  console.log(`  seeded chart valid: ${validateChart(SEED_HATS).ok}`);

  const owner = proposedOwner(chart, "cto", "director", "manager");
  console.log(`  a director under the cto: ${owner.ok ? owner.value.id : owner.reason}`);

  const binding = report.bindings[0];
  if (binding !== undefined) {
    const stranger = revokeHat(chart, report.bindings, {
      bindingId: binding.bindingId,
      byHatId: "qa_engineer",
      nowMs,
      reason: "policy",
    });
    console.log(`  revoke by a stranger:   ${stranger.ok ? "ALLOWED (wrong)" : "refused"}`);
    const boss = revokeHat(chart, report.bindings, {
      bindingId: binding.bindingId,
      byHatId: "tech_lead",
      nowMs,
      reason: "incident",
    });
    console.log(`  revoke by a supervisor: ${boss.ok ? "done" : boss.reason}`);
    const approved = approvePendingBinding(chart, report.bindings, {
      bindingId: binding.bindingId,
      byHatId: "tech_lead",
      nowMs,
    });
    console.log(`  approve an ACTIVE binding: ${approved.ok ? "ALLOWED (wrong)" : "refused (not pending)"}`);
  }

  // An operator driving a gate goes through `evaluateGate` like anyone else. Shown twice on
  // purpose: the same call refuses when the proposer is the evaluator, so the admin path is a way
  // to USE the gate rather than a way around it.
  const gateTask = report.cascade.nodes.find((n) => n.assigneeHatId !== undefined);
  if (gateTask !== undefined) {
    const asReviewer = decideGate(chart, {
      workId: gateTask.workId,
      gate: GateKind.ImplementationReview,
      evaluatorHatId: "tech_lead",
      passed: new Set([GateKind.CustomerRfpReview, GateKind.BrdApproval, GateKind.ArchitectureApproval]),
      outcome: GateOutcome.Approved,
      atMs: nowMs,
      proposerHatId: gateTask.assigneeHatId ?? NO_PROPOSER,
    });
    console.log(`  operator drives a gate:      ${asReviewer.ok ? "approved" : asReviewer.reason}`);
    const asAuthor = decideGate(chart, {
      workId: gateTask.workId,
      gate: GateKind.ImplementationReview,
      evaluatorHatId: gateTask.assigneeHatId ?? NO_PROPOSER,
      passed: new Set([GateKind.CustomerRfpReview, GateKind.BrdApproval, GateKind.ArchitectureApproval]),
      outcome: GateOutcome.Approved,
      atMs: nowMs,
      proposerHatId: gateTask.assigneeHatId ?? NO_PROPOSER,
    });
    console.log(`  the AUTHOR drives the same gate: ${asAuthor.ok ? "APPROVED (wrong)" : "refused"}`);
  }

  // Winding a product down is a DELIBERATE act, and it is refused while its goals are live —
  // shown both ways, because the refusal is the part that makes retirement mean anything.
  const pfOpen = openPortfolio(EMPTY_BOOK, chart, {
    portfolioId: "checkout",
    title: "Checkout",
    kind: PortfolioKind.Product,
    ownerHatId: "engineering_director",
  });
  if (pfOpen.ok) {
    const goalId = report.cascade.nodes.find((n) => n.workType === WorkTypeValue.Goal)?.workId;
    const withGoal = goalId === undefined ? pfOpen : associateGoal(pfOpen.book, goalId, "checkout");
    if (withGoal.ok) {
      const retired = retirePortfolio(withGoal.book, report.cascade, "checkout", "product sunset");
      console.log(
        `  retire the portfolio: ${retired.ok ? "done — every goal was delivered" : `refused — ${retired.reason}`}`,
      );
      const junior = openPortfolio(EMPTY_BOOK, chart, {
        portfolioId: "p2",
        title: "P2",
        kind: PortfolioKind.Product,
        ownerHatId: "backend_implementer",
      });
      console.log(`  portfolio owned by an IC: ${junior.ok ? "ALLOWED (wrong)" : "refused"}`);
    }
  }

  const block = report.calendar.blocks[0];
  if (block !== undefined) {
    console.log(`  cancel own block: ${cancelBlock(chart, report.calendar, { blockId: block.blockId, byHatId: block.hatId }).ok ? "done" : "refused"}`);
    const menu: readonly NextAction[] = [
      { kind: "do_item", item: { id: "x", title: "t", ready: true, ambiguous: false } },
      { kind: "explore", reason: "curiosity" },
    ];
    const m = menuForHatNow(report.calendar, block.hatId, block.startMs, menu);
    console.log(`  ${block.hatId} now: work ${m.workInScope ? "in" : "out of"} scope, ${m.offered.length} option(s)`);
  }

  const cadence = cadenceAuthority(chart, "engineering_manager", ScheduleBlockType.Review);
  if (cadence.ok) {
    console.log(`  review cadence owned by ${cadence.value.owner}; a manager may set it: ${cadence.value.permitted}`);
  }

  const claim = report.queue.claims[0];
  if (claim !== undefined) {
    console.log(`  heartbeat a finished claim: ${beat(report.queue, claim.claimId, nowMs).ok ? "accepted (wrong)" : "refused"}`);
    console.log(`  hand back a finished claim: ${handBack(report.queue, { claimId: claim.claimId, nowMs, reason: "stuck" }).ok ? "done" : "refused"}`);
  }

  const mgr = gateOptionsFor(chart, "engineering_manager");
  const dir = gateOptionsFor(chart, "qa_director");
  if (mgr.ok) console.log(`  a manager's gate verdicts:  ${mgr.value.mine.join(", ")}`);
  if (dir.ok) console.log(`  a director's:              ${dir.value.mine.join(", ")}`);

  const esc = escalationOptions(chart, "engineering_manager", EscalationTrigger.RepeatedGateRejection);
  if (esc.ok) {
    console.log(`  escalation options: ${esc.value.actions.join(", ")}`);
    for (const p of escalationPreview([EscalationAction.AddAgents, EscalationAction.Pause])) {
      console.log(`    ${p.action} → ${p.effect}`);
    }
  }

  const prio = priorityOptions(chart, "tech_lead");
  if (prio.ok) {
    console.log(`  a lead's priority options: ${prio.value.length === 0 ? "(none — it raises a signal instead)" : prio.value.join(", ")}`);
  }
  const sig = normalizedSignal(5);
  console.log(`  a signal of 5 → ${sig.ok ? sig.value : sig.reason};  NaN → ${normalizedSignal(Number.NaN).ok ? "accepted (wrong)" : "refused"}`);

  const preview = previewSignal(chart, {
    fromHatId: "backend_implementer",
    tool: "report_blocker",
    evidence: [],
    resourceAuthorityHatId: "rmo_office",
  });
  if (preview.ok) {
    console.log(`  a blocker with no evidence: routes to ${preview.value.targetHatId}, evidence ok: ${preview.value.evidenceOk}`);
  }

  const open = report.board.anchors.find((a) => a.state === "open");
  console.log(`  drop an open anchor: ${open === undefined ? "(none open)" : dropAnchor(report.board, open.anchorId).ok ? "done" : "refused"}`);

  // Repairing a stuck report: which step refused?
  const bare = normalize({ source: "support", externalId: "S-9", kind: IntakeKind.Defect, title: "it is broken" });
  if (bare.ok) {
    const steps = ingestThenTriage(bare.value, { itemId: "repair", nowMs, seen: new Set() });
    const triaged = steps.triaged;
    console.log(
      `  repair S-9: ingested ${steps.ingested.ok}, triaged ${triaged === undefined ? "(not reached)" : triaged.ok}` +
        `${triaged !== undefined && !triaged.ok ? ` — ${triaged.refusal.reason}` : ""}`,
    );
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`[fatal] ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    },
  );
}

/**
 * What the run's own test evidence says, for the one gate decided by evidence rather than opinion.
 *
 * NO RUNS IS A REJECTION. An organization that ran no tests has not validated anything, and the
 * tempting default — treat "no failures found" as a pass — is the vacuity class exactly: a check
 * that cannot fail because it never looked. The reason string says which of the two it was, so a
 * reader can tell an untested item from a failing one.
 */
function qaVerdictFrom(report: OrgRuntimeReport): { readonly outcome: GateOutcome; readonly reason: string } {
  const runs = report.qa.flatMap((q) => q.runs);
  if (runs.length === 0) {
    return { outcome: GateOutcome.Rejected, reason: "no test runs were recorded; nothing was validated" };
  }
  const failed = runs.filter((r) => r.outcome !== RunOutcome.Passed);
  return failed.length === 0
    ? { outcome: GateOutcome.Approved, reason: `${String(runs.length)} test run(s) passed` }
    : {
        outcome: GateOutcome.Rejected,
        reason: `${String(failed.length)} of ${String(runs.length)} test run(s) did not pass`,
      };
}

/**
 * The data source this run reads, built from `--source-repo` specs.
 *
 * One repository is that repository; several are their G-Set union, which is exact and
 * conflict-free because documents are keyed by `<source>:<sha>:<path>` — the property
 * `agent-bus/g-set-view.ts` establishes for the bus and this reuses rather than re-derives.
 */
function sourceFromArgs(args: Args): DataSourcePort {
  const sources = args.sourceRepos.map((spec, i) => {
    // Split on the LAST `@`, so a Windows path or a directory containing one still parses.
    const at = spec.lastIndexOf("@");
    const hasRef = at > 0;
    return gitDataSource({
      repoDir: hasRef ? spec.slice(0, at) : spec,
      ...(hasRef ? { ref: spec.slice(at + 1) } : {}),
      ...(args.sourceSubdir === undefined ? {} : { subdir: args.sourceSubdir }),
      // Named by position as well as path, because `register` refuses a duplicate (port, name) and
      // two specs for one repository at two refs are two legitimate sources.
      name: `git-${String(i + 1)}`,
    });
  });
  return sources.length === 1 ? sources[0]! : unionOf(sources);
}
