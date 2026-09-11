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
 *   bun src/Core.TypeScript/corporate/run-org.ts --week           (the organization running ITSELF)
 *   bun src/Core.TypeScript/corporate/run-org.ts --week --days 30 (…for longer)
 *   bun src/Core.TypeScript/corporate/run-org.ts --cycle          (one SCRIPTED story; see org-cycle.ts)
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

import { MemoryTier } from "./memory";
import { lifeSummary, lifeTick, writeMemory, type HoldMeeting, type Study } from "./run-life";
import { DEFAULT_STUDY_BUDGET, remainingStudy } from "./study-session";
import { isPresence, type HatPresence } from "./org-life";
import { hasMeetingDemand, meetingDemand } from "./meeting-demand";
import { agentCalibrations, memoryFromCalibration } from "./agent-calibration";
import { raiseBlocker, readBlockers } from "./blocker-outbox";
import { answeredBlockers } from "./human-blocker";

/** A blank line before a section heading. Named because an escape in this file keeps getting eaten. */
const NL = String.fromCharCode(10);
import { openBlockers } from "./human-blocker";
import { directoryMemoryStore } from "./memory-store";
import { citedIdsIn, correlateOutcome, EMPTY_LEDGER, inject, noteInjectionFor, recordCitations, signalFor } from "./memory-loop";
import { departmentOf } from "./org-presentation";
import { spawnSync } from "node:child_process";
import { answerRooms, gateAnswersFromRooms, type Reviser } from "./room-answer";
import { buildOrgChart } from "./org-chart";
import { SEED_HATS } from "./org-seed";
import { agentsFromChart, gateStaffing, runOrgRuntime, staffingReadout } from "./org-runtime";
import { firstContributorUnder, runOrgCycle } from "./org-cycle";
import { DAY_MS, runCadence } from "./org-cadence";
import { openBudget } from "./budget";
import { Adequacy, EffortClass } from "./spend-decision";
import { SignalTool } from "./supervisor-signal";
import { EMPTY_CASCADE, WorkState, type Cascade } from "./goal-cascade";
import { EMPTY_BOARD } from "./discussion-anchor";
import { EMPTY_CALENDAR } from "./work-schedule";
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
import { atPath, externalRefOf, headerSourceFrom, inlineCredentialHeaders, IntakeKind, Severity, normalize, trackerMapper, type ExternalEvent } from "./intake";
// Re-exported where they used to live, so no caller has to move with them. They are INTAKE
// concerns — somebody else's JSON becoming an `ExternalEvent` — and a webhook receiver needs
// the same mapping without importing the whole runner.
export { atPath, headersFrom, trackerMapper } from "./intake";
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
  commandArtifactProducer,
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
import { appendEvent, appendRun, deliveryRate, logHighWater, readEvents } from "./org-store";
import { runUntilSettled } from "./autonomy";
import { humanRejectionEvents, humanRejectionsToRecord } from "./human-verdicts";
import type { ChangeRequestConfig } from "./change-request";
import type { FeedbackDelivery as FeedbackDeliveryT } from "./change-followup";
import {
  commandAnswerer,
  commandDescriber,
  commandFollowUp,
  commandVerifier,
  consumeFeedback,
  pollFeedback,
  readFeedbackDir,
} from "./followup-commands";
import { decideSupply, endorseRecommendation } from "./rmo";
import { authorityFor, pressureBoard } from "./schedule-pressure";
import { isFullyMeasured, renderDora } from "./dora";
import { contextFor, runDispatchedCycle, statusSurfaceFrom } from "./agent-loop-bridge";
import { dispatcherFor, evaluatePromotionGate } from "./slot-dispatch";
import { compareToLegacy, foldObserveActWindow, legacySelection, type ObserveActTick } from "./observe-act-window";
import { deliverWorkItem } from "./work-delivery";
import { directoryDataSource, gitDataSource, unionOf } from "./git-data-source";
import type { DataSourcePort } from "./providers";
import type { CascadeNode } from "./goal-cascade";
import { OrgEventKind, type OrgEvent, type OrgFact } from "./org-event";
import { DEFAULT_PIPELINE } from "./pipeline";
import { foldCalendar, foldOrganization } from "./org-fold";
import { authorIndexFrom, observationsFrom } from "./reputation-from-log";
import type { ReputationObservation } from "./reputation";
import { foldHatsWorn,
  foldActionItems, foldHandedOffChanges, foldLandedChanges, foldObserveActTicks, foldPresence } from "./org-fold";
import { emit } from "./org-event";
import { awaitingHumanReview, describeChangeLine } from "./handoff-report";
import type { AgentState } from "../workflow-engine/agent-loop/state-machine";
import { CHECKPOINT_VALUES, GateKind, GateOutcome, NO_PROPOSER, ORDERED_GATES, humanGatesFor, isHumanCheckpoint, type HumanCheckpoint } from "./quality-gate";
import { queueProblems, readActions } from "./action-queue";
import { groom } from "./grooming";
import { confluenceSource } from "./confluence-source";
import { jiraIntake } from "./jira-source";
import { resolve as resolveSkill, type Resolution, type SkillBinding } from "./skill-binding";
import { orgById, parseRegistry, runReadinessOf } from "./org-registry";
import { HumanActionKind, isPaused, type HumanAction } from "./human-action";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProducerPort } from "./pipeline";
import type { OrgChart } from "./org-chart";
import type { OrgRuntimeDeps, OrgRuntimeReport } from "./org-runtime";
import type { NextAction } from "../observe/observe";
import { guidanceFrom, PracticeSubjectKind, ProcessSetting, resolveSetting, validateSetting, type Directive, type Practice, type SettingBinding } from "./practice";
import { DEFAULT_DIRECTIVES, DEFAULT_PRACTICES } from "./practice-defaults";
import { renderRepoSkills } from "./repo-skills";
import { branchNameIn } from "./branch-topology";

/**
 * The goals a person actually stated, as intake.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `org goal --title ... --reason ...` validated the request through `acceptAction`, appended it to
 * the queue, AND recorded a permanent event for it — then nothing ever read it. Grepping the queue's
 * consumers found three: an agent's inbox view, gate approve/reject answers, and blocker
 * acceptance. `SubmitGoal` had NO consumer at all. So the run always built the hardcoded `REPORTS`
 * fixture instead.
 *
 * MEASURED, end to end: an organization was created, told to "Ship a URL shortener HTTP API", and
 * reported `queued submit_goal`. The run that followed decomposed, staffed, reviewed, gated and
 * merged — all of it correctly — for 'checkout double-charges when a coupon is applied twice'. The
 * customer's goal was never mentioned once. Every part worked; they were not connected.
 *
 * That is a WRITER WITH NO READER — the mirror of the reader-with-no-writer pattern this codebase
 * keeps producing, and harder to see, because the writing end reports success.
 *
 * The fixture is kept as the FALLBACK, not the default: an org with nothing queued still has
 * something to demonstrate, and a run says which of the two it used rather than leaving a person to
 * infer it from the work item titles.
 */
export function statedGoalsAsIntake(actions: readonly HumanAction[]): readonly ExternalEvent[] {
  return actions
    .filter((a) => a.kind === HumanActionKind.SubmitGoal)
    // Oldest first, so the order the organization takes them in is the order they were stated.
    .sort((x, y) => (x.atMs === y.atMs ? (x.actionId < y.actionId ? -1 : 1) : x.atMs - y.atMs))
    .map((a) => ({
      // WHO ASKED, kept as the source. "portal" would make a customer's own words look like a
      // scraped ticket, and the acceptance gate at the end is answering to this person.
      source: `operator:${a.byHuman}`,
      // The action id IS the idempotency key — the same goal queued twice is one goal, and a run
      // repeated against the same store does not fork the cascade.
      externalId: a.actionId,
      kind: IntakeKind.Goal,
      title: a.subjectId,
      // `--reason` is "why it matters and what done looks like", which is exactly what a
      // reproduction field is for on a goal: the statement the final validation is judged against.
      // Intake REFUSES a defect with no reproduction; a goal with no stated done-condition deserves
      // the same treatment, so an empty reason is left absent rather than filled with a placeholder.
      ...(a.reason.trim() === "" ? {} : { reproduction: a.reason }),
      evidenceRefs: [`action/${a.actionId}`],
    }));
}

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

/**
 * A reviser backed by a command.
 *
 * The conversation reaches it on STDIN as JSON and the new document comes back on STDOUT. That way
 * a real model-backed author and this fixture have the same contract, and neither needs the room's
 * text on a command line where a message somebody typed would land in a process listing.
 *
 * THE EXIT CODE DECIDES. A command that prints an apology and exits 0 has produced a revision; one
 * that prints a document and exits 1 has not — the same rule every other spawn adapter here keeps.
 */
export function commandReviser(command: string, args: readonly string[], cwd: string): Reviser {
  return (request) => {
    const run = spawnSync(command, [...args], {
      cwd,
      encoding: "utf-8",
      input: JSON.stringify(request),
      timeout: 120_000,
      shell: false,
    });
    if (run.error !== undefined) return { ok: false, reason: `'${command}' could not run: ${run.error.message}` };
    if (run.status !== 0) {
      return { ok: false, reason: `'${command}' exited ${String(run.status)}: ${(run.stderr ?? "").trim().slice(0, 300)}` };
    }
    const text = String(run.stdout ?? "").trim();
    if (text === "") return { ok: false, reason: `'${command}' produced no document` };
    return { ok: true, text };
  };
}

/** What a life fact is ABOUT, for the event's subject. */
function subjectOfLifeFact(fact: OrgFact): string {
  if (fact.kind === "hat_move" || fact.kind === "self_directed") return fact.hatId;
  if (fact.kind === "memory_written" || fact.kind === "memory_phase") return fact.memoryId;
  // The WORK, not the meeting: a meeting is a response to something, and filing it under its own
  // id would leave the item it is about with no record that anybody met over it.
  if (fact.kind === "meeting_planned") return fact.workItemId ?? fact.meetingId;
  if (fact.kind === "meeting_held") return fact.meetingId;
  return "organization";
}

/** One readable sentence per fact, so the trace is legible without decoding the fact. */
function describeLifeFact(fact: OrgFact): string {
  switch (fact.kind) {
    case "hat_move":
      return `${fact.hatId}: ${fact.move} — ${fact.why}`;
    case "self_directed":
      return `${fact.hatId} spent free time on '${fact.subject}' (${fact.selfDirectedKind})`;
    case "memory_written":
      return `${fact.writtenBy} ${fact.outcome} '${fact.key}' at the ${fact.tier} tier`;
    case "memory_phase":
      return `memory ${fact.from} → ${fact.to} (weight ${fact.weight.toFixed(3)}): ${fact.why}`;
    case "meeting_planned":
      return `${fact.attendeeHatIds.join(" + ")} booked an hour${fact.about === undefined ? "" : `: ${fact.about}`}`;
    case "meeting_held":
      return fact.produced === ""
        ? `${fact.attendeeHatIds.join(" + ")} met and produced NOTHING — ${fact.reason ?? "no reason given"}`
        : `${fact.attendeeHatIds.join(" + ")} met and produced: ${fact.produced.split("\n")[0] ?? ""}`;
    default:
      return "life";
  }
}

/**
 * Every flag this CLI understands.
 *
 * Derived by hand and CHECKED by a test that greps this file for `valueAfter`/`valuesAfter`/`has`
 * calls, so a flag added without being listed here fails the suite rather than becoming a silent
 * no-op the day somebody types it.
 */
export const KNOWN_FLAGS: ReadonlySet<string> = new Set([
  "--actions", "--admin", "--agent-delivers", "--artifact-arg", "--artifact-cmd", "--base",
  "--blockers", "--checkpoint", "--churn", "--org", "--churn-threshold", "--context-limit", "--context-out",
  "--cycle", "--days", "--git", "--inbox", "--json", "--max-gate-attempts", "--meeting-arg",
  "--meeting-cmd", "--memory", "--now",
  "--org-docs", "--port-timeout-ms", "--price", "--qa-fails", "--review-arg", "--review-cmd",
  "--review-model", "--review-queue", "--room-arg", "--room-cmd", "--rooms", "--source-repo",
  "--source-subdir", "--store", "--study-arg", "--study-cmd", "--test-arg", "--test-cmd",
  "--confluence-auth-file", "--confluence-space", "--confluence-cql", "--confluence-limit",
  "--jira-auth-file", "--jira-jql", "--jira-limit",
  "--tracker", "--tracker-header", "--tracker-items", "--tracker-map", "--tracker-severity",
  "--tracker-source", "--until", "--week", "--window-start", "--window-target", "--work-agent",
  "--work-agent-arg", "--work-arg", "--work-cmd", "--work-model", "--work-verify",
  "--work-verify-arg", "--worktrees", "--worktree-setup", "--worktree-setup-arg", "--supply-target", "--resume", "--help", "-h",
  "--handoff-cmd", "--handoff-arg", "--delivery",
  "--describe-cmd", "--describe-arg", "--follow-up-cmd", "--follow-up-arg", "--feedback-dir", "--feedback-cmd", "--feedback-arg",
  "--answer-cmd", "--answer-arg",
]);

/**
 * Flags whose NEXT TOKEN is an opaque value, never a flag of this CLI.
 *
 * These exist to hand an argument verbatim to a child process, and real command arguments start
 * with a dash — `--maxWorkers=2`, `--allow-empty`, `-q`. `unknownFlags` scans every token in argv,
 * so without this set it read those values as flags of its own and refused the run before it
 * started. Measured: `--test-arg --maxWorkers=2` produced `refused: unknown flag --maxWorkers`,
 * exit 2, on the flag combination jest actually requires.
 *
 * DELIBERATELY NARROW. It holds only the pass-through argument flags, not every flag that takes a
 * value. `--store --git` is a typo worth catching — the operator meant to give a path and gave a
 * flag — and widening this set to all value-taking flags would silence that whole class. What is
 * listed here is the case where a leading dash is EXPECTED rather than suspicious.
 */
export const OPAQUE_VALUE_FLAGS: ReadonlySet<string> = new Set([
  "--artifact-arg", "--meeting-arg", "--review-arg", "--room-arg", "--study-arg", "--test-arg",
  "--work-agent-arg", "--work-arg", "--work-verify-arg", "--worktree-setup-arg", "--handoff-arg", "--describe-arg", "--follow-up-arg", "--feedback-arg", "--answer-arg",
  // A header is `Key: value`, which cannot begin with a dash — but it is passed through untouched
  // to a remote service, so the same rule applies: this CLI does not get an opinion about its shape.
  "--tracker-header",
]);

/**
 * Names people actually reach for, and what they meant.
 *
 * AN EXPLICIT TABLE, not a similarity heuristic. `--at` and `--now` share no prefix and no
 * characters worth matching on, so a fuzzy guess cannot connect them — and `--at` is precisely the
 * mistake that motivated this whole check. A table of real mistakes is honest; a heuristic that
 * cannot catch the one case it was written for is decoration.
 */
export const FLAG_ALIASES: Readonly<Record<string, string>> = {
  "--at": "--now",
  "--time": "--now",
  "--date": "--now",
  "--jira": "--jira-auth-file",
  "--out": "--store",
  "--output": "--store",
  "--dir": "--store",
  "--queue": "--actions",
  "--docs": "--org-docs",
};

/**
 * Flags the caller passed that this CLI does not understand.
 *
 * Where the name is a known mistake, the message says what was meant. Otherwise a prefix match is
 * offered — useful for a typo, and honestly absent when there is nothing sensible to suggest.
 */
export function unknownFlags(argv: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    // THE TOKEN AFTER A PASS-THROUGH FLAG BELONGS TO THE CHILD PROCESS. Consumed here rather
    // than merely skipped, so a value that happens to name a real flag of this CLI is not
    // silently honoured as one either.
    if (OPAQUE_VALUE_FLAGS.has(arg)) {
      i += 1;
      continue;
    }
    if (!arg.startsWith("--") && arg !== "-h") continue;
    // `--flag=value` is not this CLI's style, but somebody will type it; name the flag part.
    const flag = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
    if (KNOWN_FLAGS.has(flag)) continue;
    const meant =
      FLAG_ALIASES[flag] ??
      (flag.length > 3
        ? [...KNOWN_FLAGS].find((k) => k !== flag && (k.startsWith(flag) || flag.startsWith(k)))
        : undefined);
    out.push(meant === undefined ? flag : `${flag} (did you mean ${meant}?)`);
  }
  return out;
}

/**
 * Parse `--price <model>=<in>,<out>` into a price table.
 *
 * A malformed entry is DROPPED rather than defaulted to zero. A zero price would render as free
 * work, which is the exact figure `meter.ts` exists to keep off the screen — so an unparseable
 * price leaves that model unpriced, and the total says so by carrying its denominator.
 */
export function pricingFrom(
  entries: readonly string[],
): Record<string, { readonly inPerMillion: number; readonly outPerMillion: number }> {
  const out: Record<string, { inPerMillion: number; outPerMillion: number }> = {};
  for (const entry of entries) {
    const at = entry.indexOf("=");
    if (at <= 0) continue;
    const model = entry.slice(0, at).trim();
    const parts = entry.slice(at + 1).split(",");
    if (model === "" || parts.length !== 2) continue;
    const inPerMillion = Number.parseFloat((parts[0] ?? "").trim());
    const outPerMillion = Number.parseFloat((parts[1] ?? "").trim());
    if (!Number.isFinite(inPerMillion) || !Number.isFinite(outPerMillion)) continue;
    if (inPerMillion < 0 || outPerMillion < 0) continue;
    out[model] = { inPerMillion, outPerMillion };
  }
  return out;
}

export interface Args {
  readonly qaFails: boolean;
  readonly churn: boolean;
  readonly json: boolean;
  readonly cycleOnly: boolean;
  /** Run the organization across a span of days, driving itself. No plan, no script. */
  readonly week: boolean;
  /** How many days `--week` runs. Absent is seven. */
  readonly days?: number;
  readonly admin: boolean;
  /** Where to persist the run's history. Absent means the run leaves no trace on disk. */
  readonly store: string | undefined;
  /**
   * Where a person's requests and answers arrive. Absent = nobody can reach this run.
   *
   * The SAME directory `serve-org --actions` writes to. One inbound door: a second channel for
   * answers would be a second place the run has to look for what a person said, and the first one
   * to be forgotten would be silent.
   */
  readonly actions: string | undefined;
  /** Where the organization leaves questions it cannot answer itself. Absent = it cannot ask. */
  readonly blockers: string | undefined;
  readonly meetingCmd: string | undefined;
  readonly meetingArgs: readonly string[];
  /**
   * Which optional checkpoints are on. EMPTY IS THE DEFAULT and means fully agentic.
   *
   * Empty rather than "both", because a checkpoint nobody asked for stops a run that has nobody
   * waiting to unblock it — and an organization that halts on an unattended machine looks exactly
   * like one that crashed.
   */
  readonly checkpoints: readonly HumanCheckpoint[];
  /** `--checkpoint` values that are neither a checkpoint name nor a gate. Refused, never dropped. */
  readonly unknownCheckpoints: readonly string[];
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
  /** `raw=critical|high|medium|low` pairs translating this tracker's severity vocabulary. */
  readonly trackerSeverity: readonly string[];
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
  /**
   * How long a spawned port may take before it is killed.
   *
   * Every `spawnSync` adapter defaults to two minutes, which is ample for a build command and
   * nowhere near enough for an agent asked to fix a defect in a real codebase. Nothing here used to
   * set it, so a real work agent was killed mid-thought and the register carried on to the gates
   * with an empty diff — every gate then correctly rejected nothing, and the run reported NOT
   * DELIVERED in under two minutes. The organization was not wrong at any step; it was simply never
   * given time to have anything to judge.
   */
  readonly portTimeoutMs: number | undefined;
  /**
   * How many times work may be re-presented to the gates before the churn is called.
   *
   * Three is the right default and stays the default: the bound exists so that repeated rejection
   * is broken structurally instead of endured, and `org-runtime` deliberately halts rather than
   * claim it retried with an input nothing changed.
   *
   * But that reasoning turns on the input NOT changing. When each turn-back produces a genuinely
   * different diff — a different hash, judged afresh — the work is converging, and stopping it at
   * three ends a process that was moving rather than one that was spinning. This makes the number
   * the operator's, because only the operator knows which of those two they are watching.
   */
  readonly maxGateAttempts: number | undefined;
  /**
   * How many turn-backs count as CHURN, at which point the organization stops re-presenting.
   *
   * Three by default, and it fires BEFORE `maxGateAttempts` — which made raising the attempt bound
   * alone do nothing observable, because churn was declared first and halted the loop. The two
   * numbers describe different things (how many tries are allowed; how many rejections mean the
   * process is stuck) and an operator who raises one almost always means to raise both.
   */
  readonly churnThreshold: number | undefined;
  /**
   * What WRITES the document each pre-code gate judges.
   *
   * Eleven of the fourteen gates had no producer, so a reviewer at those phases was choosing
   * between approving nothing and rejecting nothing. Both are the gate failing to evaluate the
   * work, and the run still reported them crossed.
   *
   * Absent leaves those phases judgement-only, which is what they have always been. Supplying a
   * command gives each one a real artifact, so an approval at `brd_approval` means somebody read a
   * BRD rather than a title.
   */
  readonly artifactCmd: string | undefined;
  readonly artifactArgs: readonly string[];
  /**
   * `--price <model>=<inPerMillion>,<outPerMillion>`, repeatable.
   *
   * Empty by default and deliberately so. Without it every crossing is still measured — duration,
   * tokens, which adapter — and the cost is reported ABSENT rather than as a number nobody
   * configured. A price supplied later reprices the history exactly, because the tokens were kept.
   */
  readonly pricing: Record<string, { readonly inPerMillion: number; readonly outPerMillion: number }>;
  /** Where the iteration rooms live. A person waiting in one is answered before anything else runs. */
  readonly rooms: string | undefined;
  /** The memory root. Absent ⇒ the organization has no memory and the run says so. */
  readonly memory: string | undefined;
  /** The command an idle hat runs to study something. Absent ⇒ idle time produces nothing. */
  readonly studyCmd: string | undefined;
  readonly studyArgs: readonly string[];
  /** The command that rewrites a document in a room. Absent ⇒ rooms are read but not answered. */
  readonly roomCmd: string | undefined;
  readonly roomArgs: readonly string[];
  /**
   * Where the organization keeps ITS OWN written record — the BRDs, architecture notes and cost
   * rulings its phases produced on earlier work.
   *
   * Unioned with the read-only corpus, so each new work item is written against both what the
   * company documented and what this organization itself concluded last time. That is how it builds
   * an internal view across many tickets WITHOUT editing anybody's wiki: `DataSourcePort` has
   * `read` and `query` and no write, so the corpus it reads is not a corpus it can touch.
   */
  readonly orgDocs: string | undefined;
  /** How many documents an author may be handed. A prompt is finite; a corpus is not. */
  readonly contextLimit: number | undefined;
  /** Where those documents are put so a command-line author can read them. */
  readonly contextOut: string | undefined;
  readonly git: string | undefined;
  readonly baseBranch: string;
  /**
   * Where per-change worktrees live. Absent means the SHARED checkout, which moves HEAD and is
   * therefore sequential-only — correct today, and a limit held by the caller rather than by the
   * adapter. Supplying this makes each change its own directory.
   */
  readonly worktrees: string | undefined;
  /** What makes a new worktree runnable, run once inside it. See `gitWorktreeChangeControl`. */
  readonly worktreeSetup: string | undefined;
  readonly worktreeSetupArgs: readonly string[];
  /** The command that hands a finished change to people - pushes it and opens its review. */
  readonly handoffCmd: string | undefined;
  readonly handoffArgs: readonly string[];
  /** Who writes a merge request's description in the organization's configured sections. See `followup-commands.ts`. */
  readonly describeCmd: string | undefined;
  readonly describeArgs: readonly string[];
  /** The session that decides about a handed-off change's open action items. */
  readonly followUpCmd: string | undefined;
  readonly followUpArgs: readonly string[];
  /** Where webhook deliveries about handed-off changes are filed. Default: `<store>/feedback`. */
  readonly feedbackDir: string | undefined;
  /** A poller of the review system: given the handed-off changes on stdin, prints deliveries as JSON lines. */
  readonly feedbackCmd: string | undefined;
  readonly feedbackArgs: readonly string[];
  /** Who answers a settled comment on its thread: given one change's items on stdin, prints one result per item. */
  readonly answerCmd: string | undefined;
  readonly answerArgs: readonly string[];
  /** How this organization's merge requests are written and kept current. Read from the registry. */
  readonly changeRequests?: ChangeRequestConfig;
  /** Wearers per hat the RMO authorizes — how many open tasks one contributor hat may carry. */
  readonly supplyTarget: number | undefined;
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
  /**
   * Skills the operator bound to gates, from the organization's own record.
   *
   * NOT a flag: bindings are configuration an org carries, set once by `org skill bind` and read
   * from the registry when `--org` names one. Empty means every gate uses whatever the checkout
   * provides, which is the documented default and still a resolution the agent is told about.
   */
  readonly skillBindings: readonly SkillBinding[];
  /** HOW this organization works, per gate, verb or kind of work. See `practice.ts`. */
  readonly practices: readonly Practice[];
  /** What holds regardless of what is being done. */
  readonly directives: readonly Directive[];
  /**
   * Connected repositories, so an agent can be told what each already offers.
   *
   * Carried as (id, location) pairs rather than as rendered text: a pre-rendered string could not
   * be re-read after a source changed, and the rendering belongs at the point of use.
   */
  readonly repoSources: readonly { readonly sourceId: string; readonly location: string }[];
  /** What the process does at mechanical decisions. See `ProcessSetting`. */
  readonly settings: readonly SettingBinding[];
  /** PATH to the Atlassian credentials file. Never a token — see the parser. */
  readonly confluenceAuthFile: string | undefined;
  /** Space keys to read. Empty reads whatever the CQL matches. */
  readonly confluenceSpaces: readonly string[];
  /** A CQL expression, when the caller knows exactly which pages matter. */
  readonly confluenceCql: string | undefined;
  readonly confluenceLimit: number | undefined;
  /**
   * PATH to the Jira credentials file — never a token. With `jiraJql`, intake is the whole-ticket
   * Jira reader: description, every comment, and the parent the branching settings key on.
   */
  readonly jiraAuthFile: string | undefined;
  /** Which issues this organization takes. Configuration, never built from a ticket's own text. */
  readonly jiraJql: string | undefined;
  readonly jiraLimit: number | undefined;
}

/**
 * What a person has decided about a work item's gate, read from the action queue.
 *
 * READ ONCE, before the run, and closed over — never re-read mid-walk. A run that could pick up new
 * instructions between two gates would be deciding against a moving input and its trace would not
 * replay. The next cycle reads the queue again, which is the right granularity: a person answers,
 * and the organization picks it up on its next pass.
 *
 * Matching is by the work item AND the gate. An approval that named neither would apply to whatever
 * the run happened to be doing, which is the one way a recorded human decision can be worse than no
 * decision at all.
 */
export function humanDecisionsFrom(
  queueDir: string,
): (workId: string, gate: GateKind) => { readonly outcome: GateOutcome; readonly actionRef: string } | undefined {
  const actions = readActions(queueDir);
  return (workId, gate) => {
    // LAST WORD WINS. A person who answers twice has changed their mind, and the later word is the
    // one they meant — ordered by the action's own clock, never by the order files were read.
    const answers = actions
      .filter(
        (a) =>
          (a.kind === HumanActionKind.ApproveGate || a.kind === HumanActionKind.RejectGate) &&
          a.subjectId === workId &&
          a.detail?.["gate"] === String(gate),
      )
      .sort((x: HumanAction, y: HumanAction) => (x.atMs === y.atMs ? (x.actionId < y.actionId ? -1 : 1) : x.atMs - y.atMs));
    const latest = answers[answers.length - 1];
    if (latest === undefined) return undefined;
    return {
      outcome: latest.kind === HumanActionKind.ApproveGate ? GateOutcome.Approved : GateOutcome.Rejected,
      // THE ACTION IS THE EVIDENCE. An approval with no traceable origin is precisely what the
      // audit requirement exists to prevent, so the id travels into the evaluation's own refs.
      actionRef: `human-action/${latest.actionId}`,
    };
  };
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
    trackerSeverity: valuesAfter(argv, "--tracker-severity"),
    workAgent: valueAfter(argv, "--work-agent"),
    workModel: valueAfter(argv, "--work-model"),
    until: valueAfter(argv, "--until"),
    windowStart: valueAfter(argv, "--window-start"),
    windowTarget: valueAfter(argv, "--window-target"),
    now: valueAfter(argv, "--now"),
    agentDelivers: argv.includes("--agent-delivers"),
    sourceRepos: valuesAfter(argv, "--source-repo"),
    sourceSubdir: valueAfter(argv, "--source-subdir"),
    // A PATH, never a token. argv is world-readable; `looksLikeSecret` refuses a value that looks
    // like one, and the file is re-read per call so a rotated credential needs no restart.
    // Empty unless an organization is resolved; `withOrgDefaults` fills it from the registry.
    skillBindings: [],
    practices: [],
    directives: [],
    repoSources: [],
    // `--delivery` is the one setting a run may state on its own command line: who integrates a
    // finished change is a person's statement, and a one-off run must be able to make it without
    // editing the organization. Layered over the organization's settings, never instead of them.
    settings: ((v) =>
      v === undefined
        ? []
        : [{ setting: ProcessSetting.Delivery, value: v, why: "stated on the command line for this run (--delivery)" }])(
      valueAfter(argv, "--delivery"),
    ),
    confluenceAuthFile: valueAfter(argv, "--confluence-auth-file"),
    jiraAuthFile: valueAfter(argv, "--jira-auth-file"),
    jiraJql: valueAfter(argv, "--jira-jql"),
    jiraLimit: ((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))(valueAfter(argv, "--jira-limit")),
    confluenceSpaces: valuesAfter(argv, "--confluence-space"),
    confluenceCql: valueAfter(argv, "--confluence-cql"),
    confluenceLimit: ((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))(
      valueAfter(argv, "--confluence-limit"),
    ),
    workAgentArgs: valuesAfter(argv, "--work-agent-arg"),
    workVerify: valueAfter(argv, "--work-verify"),
    workVerifyArgs: valuesAfter(argv, "--work-verify-arg"),
    portTimeoutMs: ((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))(
      valueAfter(argv, "--port-timeout-ms"),
    ),
    maxGateAttempts: ((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))(
      valueAfter(argv, "--max-gate-attempts"),
    ),
    churnThreshold: ((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))(
      valueAfter(argv, "--churn-threshold"),
    ),
    artifactCmd: valueAfter(argv, "--artifact-cmd"),
    artifactArgs: valuesAfter(argv, "--artifact-arg"),
    pricing: pricingFrom(valuesAfter(argv, "--price")),
    rooms: valueAfter(argv, "--rooms"),
    memory: valueAfter(argv, "--memory"),
    studyCmd: valueAfter(argv, "--study-cmd"),
    studyArgs: valuesAfter(argv, "--study-arg"),
    roomCmd: valueAfter(argv, "--room-cmd"),
    roomArgs: valuesAfter(argv, "--room-arg"),
    orgDocs: valueAfter(argv, "--org-docs"),
    contextLimit: ((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))(
      valueAfter(argv, "--context-limit"),
    ),
    contextOut: valueAfter(argv, "--context-out"),
    git: valueAfter(argv, "--git"),
    baseBranch: valueAfter(argv, "--base") ?? "main",
    worktrees: valueAfter(argv, "--worktrees"),
    worktreeSetup: valueAfter(argv, "--worktree-setup"),
    worktreeSetupArgs: valuesAfter(argv, "--worktree-setup-arg"),
    handoffCmd: valueAfter(argv, "--handoff-cmd"),
    handoffArgs: valuesAfter(argv, "--handoff-arg"),
    describeCmd: valueAfter(argv, "--describe-cmd"),
    describeArgs: valuesAfter(argv, "--describe-arg"),
    followUpCmd: valueAfter(argv, "--follow-up-cmd"),
    followUpArgs: valuesAfter(argv, "--follow-up-arg"),
    feedbackDir: valueAfter(argv, "--feedback-dir"),
    feedbackCmd: valueAfter(argv, "--feedback-cmd"),
    feedbackArgs: valuesAfter(argv, "--feedback-arg"),
    answerCmd: valueAfter(argv, "--answer-cmd"),
    answerArgs: valuesAfter(argv, "--answer-arg"),
    supplyTarget: ((v) => (v === undefined ? undefined : Number.parseInt(v, 10)))(valueAfter(argv, "--supply-target")),
    qaFails: argv.includes("--qa-fails") || argv.includes("--churn"),
    churn: argv.includes("--churn"),
    json: argv.includes("--json"),
    store: ((i) => (i >= 0 ? argv[i + 1] : undefined))(argv.indexOf("--store")),
    actions: valueAfter(argv, "--actions"),
    blockers: valueAfter(argv, "--blockers"),
    // WHO RUNS THE MEETINGS. Absent, meetings are booked and held by nobody, and the run says so
    // rather than reporting outcomes it did not have.
    meetingCmd: valueAfter(argv, "--meeting-cmd"),
    meetingArgs: valuesAfter(argv, "--meeting-arg"),
    // REPEATABLE: a checkpoint name or any gate. An unknown value is REFUSED in `argRefusals`, not
    // dropped here - dropping it silently asked for no checkpoint at all.
    checkpoints: argv
      .map((a, i) => (a === "--checkpoint" ? argv[i + 1] : undefined))
      .filter(isHumanCheckpoint),
    unknownCheckpoints: argv
      .map((a, i) => (a === "--checkpoint" ? argv[i + 1] : undefined))
      .filter((v): v is string => v !== undefined && !isHumanCheckpoint(v)),
    cycleOnly: argv.includes("--cycle"),
    week: argv.includes("--week"),
    // Spread rather than assigned, because `exactOptionalPropertyTypes` is on and an explicit
    // `undefined` is not the same as an absent key.
    ...((v) => (v === undefined ? {} : { days: Number.parseInt(v, 10) }))(valueAfter(argv, "--days")),
    admin: argv.includes("--admin"),
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
  // A REAL REPOSITORY IS NEVER MERGED INTO UNLESS THE OPERATOR SAID SO (`delivery=merge`); every
  // other run hands a finished change to people. Such a run must say HOW, and is told so before it
  // spends hours reaching the point where it needs to. MEASURED on the Agentic Team's first real
  // run: with nothing said, the runtime merged two defects into its clone's master.
  if (args.git !== undefined) {
    const delivery = resolveSetting(args.settings, ProcessSetting.Delivery, []).value;
    if (delivery !== "merge" && (args.worktrees === undefined || args.handoffCmd === undefined)) {
      out.push(
        `this run reaches a real repository (--git) and hands finished changes to people (delivery: ${delivery ?? "unset"}), ` +
          "but nothing says how: give --worktrees and a --handoff-cmd (with --handoff-arg) that pushes a branch and opens " +
          "its review - or state --delivery merge if this organization integrates its own changes",
      );
    }
    // HOW THE REQUEST IS WRITTEN AND KEPT CURRENT IS THE OPERATOR'S TO SAY, and a run that would open
    // one without it is refused now rather than when the first change finishes. See `change-request.ts`.
    if (delivery !== "merge") {
      if (args.changeRequests === undefined) {
        out.push(
          "this organization hands changes to people and has not said how its merge requests are written or kept current: " +
            "run 'org configure' - the hand_off_changes step - or 'org change-requests set'",
        );
      } else {
        if (args.describeCmd === undefined) {
          out.push(`merge requests here must carry ${args.changeRequests.sections.map((x) => x.heading).join(" / ")}: give --describe-cmd (with --describe-arg) to write them`);
        }
        if (args.followUpCmd === undefined) {
          out.push("feedback on this organization's merge requests becomes action items: give --follow-up-cmd (with --follow-up-arg) so somebody decides about them");
        }
        if (args.changeRequests.replies === undefined) {
          out.push(
            "this organization has not said whether a reviewer's comment is answered on its thread once the team has decided about it: " +
              "run 'org change-requests set' with --replies reply_and_resolve|reply|none",
          );
        } else if (args.changeRequests.replies !== "none" && args.answerCmd === undefined) {
          out.push(
            `reviewers here are answered on their threads (replies: ${args.changeRequests.replies}): give --answer-cmd (with --answer-arg) to post the answers`,
          );
        }
      }
    }
  }
  // A stated setting must be a real one: `--delivery merged` is refused, never read as unset.
  for (const b of args.settings) {
    const ok = validateSetting(b);
    if (!ok.ok) out.push(ok.reason);
  }
  for (const v of args.unknownCheckpoints) {
    out.push(`--checkpoint '${v}' is neither a checkpoint nor a gate — expected one of ${CHECKPOINT_VALUES.join(", ")}`);
  }
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
  for (const name of inlineCredentialHeaders(args.trackerHeaders)) {
    // ARGV IS WORLD-READABLE. Refused, not warned: a run that starts has already leaked it.
    out.push(`--tracker-header ${name} carries a credential by value, and argv is readable by every process on the machine — write it to a file and pass ${name}:@<path>`);
  }
  if ((args.jiraAuthFile === undefined) !== (args.jiraJql === undefined)) {
    // HALF a Jira source is not one. Credentials with no query would read nothing; a query with no
    // credentials cannot be sent. Either way the run would look configured and take no work.
    out.push("--jira-auth-file and --jira-jql come as a pair: the file says who is asking, the JQL says which issues this organization takes");
  }
  if (args.jiraAuthFile !== undefined && args.tracker !== undefined) {
    out.push("--jira-auth-file and --tracker both name the intake; supply one, because work can only have arrived one way");
  }
  if (args.supplyTarget !== undefined && (Number.isNaN(args.supplyTarget) || args.supplyTarget < 1)) {
    out.push("--supply-target takes a positive count of wearers per hat");
  }
  if (args.jiraLimit !== undefined && (Number.isNaN(args.jiraLimit) || args.jiraLimit < 1)) {
    out.push("--jira-limit takes a positive count");
  }
  return out;
}

/**
 * How many times work may be re-presented to the gates, given what the operator asked for.
 *
 * `--churn` bundles a whole posture (a lower churn threshold AND a higher attempt bound) for
 * observing churn deliberately. An explicit `--max-gate-attempts` is a narrower, later statement
 * about one number, so it wins; having the bundle silently overwrite it would make the flag look
 * accepted and do nothing, which is the failure mode this file has already been bitten by once.
 */
export function gateAttemptsFor(args: Args): number | undefined {
  return args.maxGateAttempts ?? (args.churn ? 5 : undefined);
}

/**
 * The gates a document is written FOR, in chain order.
 *
 * Everything before `implementation_review`, because those are the phases the runtime has no
 * producer for — the ones that were being crossed on nothing. The later gates already have
 * something real to judge: implementation and runtime validation carry the runtime's own
 * producers, and the final reviews read the diff.
 */
export const PRE_CODE_GATES: readonly GateKind[] = ORDERED_GATES.slice(
  0,
  ORDERED_GATES.indexOf(GateKind.ImplementationReview),
);

/** Is this ref a file an author could open? Refs also carry plan lines, argv and captured output. */
export function isReadableFile(ref: string): boolean {
  if (ref.length > 1024 || ref.includes(String.fromCharCode(10))) return false;
  try {
    return statSync(ref).isFile();
  } catch {
    return false;
  }
}

/**
 * The gates an agent PERFORMS: every pre-code gate, plus any later gate the organization has said HOW
 * it is performed — a practice bound to that gate.
 *
 * A later gate was judgement-only, on the reasoning that it "already has something real to judge".
 * That holds for a final review, which reads the diff. It does not hold for UAT: user acceptance is an
 * ACT — somebody runs the product the way a user would — and with no performer the organization's
 * own `qa_uat` practice ("give the on-screen test steps and run UAT") described work nobody did. So
 * the organization decides, by stating the practice; one that states none keeps the old behaviour.
 * Implementation and runtime validation are never here: the runtime's own producers own them.
 */
export function performedGates(practices: readonly Practice[]): readonly GateKind[] {
  const stated = new Set(
    practices.filter((p) => p.subject.kind === PracticeSubjectKind.Gate).map((p) => p.subject.id),
  );
  return ORDERED_GATES.filter(
    (g) =>
      g !== GateKind.ImplementationReview &&
      g !== GateKind.RuntimeValidation &&
      (PRE_CODE_GATES.includes(g) || stated.has(String(g))),
  );
}

/**
 * What the organization already knows ABOUT THIS ITEM, written where an author can read it.
 *
 * Targeted rather than blanket: `groom` derives search terms from the work item and asks the source
 * about each one, so a step working on link expiry is handed the pages about links and about expiry
 * instead of the first forty documents in the corpus.
 *
 * The terms that matched NOTHING are written into the file too. That is the more useful half for
 * anyone deciding whether a request extends an existing system or introduces a new one: a term the
 * corpus has never heard of is a thing this organization has not built, and an author that can see
 * that asks about scope instead of assuming a system it cannot find.
 *
 * Cached per work item because a run walks several gates over the same item and each would otherwise
 * re-query the source - which for a wiki is a network round trip per gate per term.
 */
export function groundingFor(
  source: DataSourcePort | undefined,
  dir: string | undefined,
  limit: number,
): (node: CascadeNode) => Promise<readonly string[]> {
  if (source === undefined || dir === undefined) return async () => [];
  const cache = new Map<string, readonly string[]>();
  return async (node: CascadeNode) => {
    const hit = cache.get(node.workId);
    if (hit !== undefined) return hit;
    const found = await groom(node, source);
    if (!found.ok) {
      cache.set(node.workId, []);
      return [];
    }
    mkdirSync(dir, { recursive: true });
    const docs = found.value.documents.slice(0, Math.max(0, limit));
    const at = join(dir, `grounding-${node.workId.replace(/[^A-Za-z0-9._-]/g, "-")}.md`);
    const body = [
      `# What this organization already has about: ${node.title}`,
      ``,
      `Searched for: ${found.value.terms.join(", ")}`,
      found.value.termsWithNoMatch.length === 0
        ? `Every term matched something.`
        : `NOTHING was found for: ${found.value.termsWithNoMatch.join(", ")} — this organization has ` +
          `not written about these, so treat them as new ground rather than assuming a system exists.`,
      ``,
      ...docs.flatMap((d) => [`## ${d.ref}`, ``, d.content, ``]),
      docs.length === 0 ? `No existing document matched. This looks like new ground.` : ``,
    ].join("\n");
    writeFileSync(at, body, "utf-8");
    const paths = [at];
    cache.set(node.workId, paths);
    return paths;
  };
}

/**
 * Put the organization's own documents where a shell-based author can read them.
 *
 * The DataSourcePort is the interface — a git repository today, a wiki or a ticket system tomorrow.
 * Everything downstream of this function sees files, so a new source is a new implementation of two
 * methods and nothing here changes.
 *
 * `limit` is not decoration. A source can hold thousands of documents and an author has one prompt;
 * handing it everything would push the material that matters out of the window and cost a fortune
 * doing it. The cap is the caller's, and a run that hit it says so rather than silently truncating.
 */
export async function materialiseContext(
  source: DataSourcePort,
  dir: string,
  limit: number,
): Promise<{ readonly paths: readonly string[]; readonly total: number; readonly capped: boolean }> {
  const read = await source.read();
  if (!read.ok) return { paths: [], total: 0, capped: false };
  mkdirSync(dir, { recursive: true });
  const docs = [...read.value];
  const taken = docs.slice(0, Math.max(0, limit));
  const paths: string[] = [];
  for (const [i, doc] of taken.entries()) {
    // The REF is written into the file, so an author quoting a document quotes something citable
    // and a reviewer can tell which revision was read.
    const safe = doc.path.replace(/[^A-Za-z0-9._-]/g, "-").slice(-80);
    const at = join(dir, `${String(i).padStart(3, "0")}-${safe}`);
    writeFileSync(at, `<!-- ${doc.ref} -->
${doc.content}`, "utf-8");
    paths.push(at);
  }
  return { paths, total: docs.length, capped: docs.length > taken.length };
}

/**
 * What a person has already told this work, from the outbox and the action queue.
 *
 * Derived on every call rather than accumulated, so a run that stopped mid-conversation resumes
 * exactly where the record says it was. Pairs each question with its answer: an answer on its own
 * is unreadable to whoever asked, since the question is what gives it a subject.
 */
export function answersFromOutbox(
  blockersDir: string | undefined,
  actionsDir: string | undefined,
  /**
   * The work, so an answer can reach the rungs BELOW the one that asked.
   *
   * ── WHY ANSWERS INHERIT ──────────────────────────────────────────────────
   * A person told the CTO the expected traffic while it groomed the goal. The next rung down then
   * asked the same question about the initiative, because answers were filed against the work item
   * that asked and nothing carried them further. From the person's side that is being asked the
   * same thing twice by the same company, which is the fastest way to make them stop answering.
   *
   * Downward only, like `brief` and `domain`: a child is about what its parent is about, so what
   * the parent was told applies to it. The reverse does not hold — something said about one leaf is
   * not true of its siblings, and pushing it upward would put one task's answer on all of them.
   *
   * Omitted means node-only, which is the honest behaviour when the caller has no cascade to
   * resolve ancestry against.
   */
  cascade?: Cascade,
): (node: CascadeNode) => readonly { readonly question: string; readonly answer: string }[] {
  if (blockersDir === undefined) return () => [];
  // READ AT EACH ASK, not once at start. A run lasts hours with real agents, and an answer a person
  // files mid-run must reach the next attempt of the step that asked — read once, it could only
  // reach the next RUN, and the step would ask again or proceed on an assumption the person had
  // already corrected.
  const lineage = (node: CascadeNode): ReadonlySet<string> => {
    const ids = new Set<string>([node.workId]);
    if (cascade === undefined) return ids;
    let cur: CascadeNode | undefined = node;
    // Guarded against a cycle in the parent chain: a malformed cascade must not hang the run.
    while (cur?.parentWorkId !== undefined && !ids.has(cur.parentWorkId)) {
      ids.add(cur.parentWorkId);
      cur = cascade.nodes.find((n: CascadeNode) => n.workId === cur?.parentWorkId);
    }
    return ids;
  };
  return (node) => {
    const raised = readBlockers(blockersDir);
    const actions = actionsDir === undefined ? [] : readActions(actionsDir);
    const mine = lineage(node);
    return answeredBlockers(
      raised.filter((b) => mine.has(b.blocking)),
      actions,
    ).map(({ blocker, answer }) => ({
      question: blocker.about,
      // `detail.answer` IS the answer; `reason` is why it was given. `acceptAction` refuses an
      // answer whose `detail.answer` is empty precisely so the two cannot be confused.
      answer: String(answer.detail?.["answer"] ?? answer.reason),
    }));
  };
}

/**
 * How many rounds of questions one piece of work gets before it must proceed regardless.
 *
 * THREE, matching the gate-attempt bound, and for the same reason: the number is not the point, the
 * existence of one is. An organization with no limit on consultation does not converge, and every
 * step that would rather be certain than finished stalls behind a person.
 */
export const MAX_ASK_ROUNDS = 3;

/**
 * Which skill performs this gate for this work item, as the operator configured it.
 *
 * ── WHY THIS FUNCTION HAD TO EXIST ───────────────────────────────────────────
 * `skill-binding.resolve` holds the rule - nearest scoped binding wins, then organization-wide,
 * then whatever the checkout provides - and until now only the CONFIGURE PLANNER and the `org skill
 * list` command ever called it. An operator could bind a skill, see it listed against the right
 * gate, and no agent would ever hear about it.
 *
 * `ancestry` is the work item then its parents, nearest first, because that is the precedence the
 * binding rule is written in: a task overrides its project, a project its organization.
 *
 * The resolution's `because` travels with it. A fallback nobody can see is the thing that makes
 * people stop trusting configuration, and "no binding, so use the repo's own" is a decision worth
 * showing rather than a silence.
 */
export function skillResolverFor(
  bindings: readonly SkillBinding[],
  cascade: Cascade | undefined,
): (gate: GateKind, node: CascadeNode) => Resolution {
  const ancestryOf = (node: CascadeNode): readonly string[] => {
    const out: string[] = [node.workId];
    if (cascade === undefined) return out;
    let cur: CascadeNode | undefined = node;
    while (cur?.parentWorkId !== undefined && !out.includes(cur.parentWorkId)) {
      out.push(cur.parentWorkId);
      cur = cascade.nodes.find((n: CascadeNode) => n.workId === cur?.parentWorkId);
    }
    return out;
  };
  return (gate, node) => resolveSkill(bindings, gate, ancestryOf(node));
}

/**
 * Whether a person has paused the organization, read from the actions queue AT EACH CALL.
 *
 * `pause_run` was replayed into a flag and shown on the dashboard, and the drive loop never asked
 * it — a person could say "stop" and nothing would. Read per call so a pause filed while the run
 * is going stops it at the next cycle boundary.
 */
export function pausedFromActions(actionsDir: string): () => string | undefined {
  return () => {
    const queued = readActions(actionsDir);
    if (!isPaused(queued)) return undefined;
    const last = [...queued].reverse().find((a) => a.kind === HumanActionKind.PauseRun);
    return `paused by ${last?.byHuman ?? "a person"}: ${last?.reason ?? "no reason given"}`;
  };
}

/**
 * What a person said when they turned this work back.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * A rejection reached the runtime as an outcome and an action reference. The REVIEW ITSELF - the
 * sentences explaining what was wrong - stayed on the queued action and reached nobody. The author
 * redoing the step was told it had been rejected and not why.
 *
 * Newest first, because a reviewer who has objected twice means the second one: the first was about
 * a draft that no longer exists.
 *
 * Only REJECTIONS. An approval's reason is a note for the record, not an instruction to change
 * anything, and handing it to an author as feedback would have them revising work somebody just
 * accepted.
 */
export function feedbackFromActions(
  actionsDir: string | undefined,
): (workId: string) => readonly { readonly gate: string; readonly said: string }[] {
  if (actionsDir === undefined) return () => [];
  // READ AT EACH CALL, for the same reason as `answersFromOutbox`: a reviewer's objection filed
  // while the run is still going must reach the rework it is about.
  return (workId) =>
    readActions(actionsDir)
      .filter((a) => a.kind === HumanActionKind.RejectGate && a.subjectId === workId && a.reason.trim() !== "")
      .sort((x, y) => (x.atMs === y.atMs ? (x.actionId < y.actionId ? 1 : -1) : y.atMs - x.atMs))
      .map((a) => ({ gate: String(a.detail?.["gate"] ?? "unknown"), said: a.reason }));
}

/**
 * A producer per pre-code gate, or none at all.
 *
 * DERIVED from the chain rather than listed, so a gate inserted before implementation gets a
 * producer without anyone remembering to add it here — the failure this whole exercise keeps
 * finding is a list that stopped matching the thing it described.
 */
export function artifactProducersFromArgs(
  args: Args,
  contextFor?: (gate: GateKind, node: CascadeNode) => readonly string[],
  /** The work, so an answer given to a parent reaches its children. See `answersFromOutbox`. */
  cascade?: Cascade,
  /** Which skill performs a gate here. See `skillResolverFor`. */
  skillFor?: (gate: GateKind, node: CascadeNode) => Resolution,
  /** How this organization works. See `guidanceFrom`. */
  guidanceFor?: (
    gate: GateKind,
    node: CascadeNode,
  ) => { readonly practice?: string; readonly directives?: string; readonly repoSkills?: string },
): ReadonlyMap<GateKind, ProducerPort> {
  const out = new Map<GateKind, ProducerPort>();
  if (args.artifactCmd === undefined) return out;
  const budget = args.portTimeoutMs === undefined ? {} : { timeoutMs: args.portTimeoutMs };
  for (const gate of performedGates(args.practices)) {
    out.set(
      gate,
      commandArtifactProducer({
        command: args.artifactCmd,
        gate,
        cwd: args.git ?? process.cwd(),
        // The gate, the work id, then what earlier phases produced — so the BRD writer is handed
        // the RFP analysis and the architect the BRD. Never the title: it comes from intake.
        argsFor: (g, node, ctx) => [
          ...args.artifactArgs,
          String(g),
          node.workId,
          // ONLY REFS THAT ARE READABLE FILES, deduped. A later gate's priors include the work
          // executor's own argv and the test runner's evidence - MEASURED on AIAGENT-1660, the
          // release-readiness author was launched with the ENTIRE captured test output as arguments,
          // one Windows 32K command-line limit away from never starting. Anything that is not a
          // document reaches the agent through `observe`, not argv.
          ...[...new Set(ORDERED_GATES.flatMap((prior) => ctx.priorArtifacts.get(prior)?.refs ?? []))].filter(isReadableFile),
        ],
        ...(contextFor === undefined ? {} : { contextFor }),
        // The other half of `ask:` — what a person said last time reaches the agent that asked.
        answersFor: answersFromOutbox(args.blockers, args.actions, cascade),
        ...(skillFor === undefined ? {} : { skillFor: (node: CascadeNode) => skillFor(gate, node) }),
        // AND HOW IT IS DONE. Passed through unchanged: this function routes, it does not render.
        ...(guidanceFor === undefined ? {} : { guidanceFor }),
        // WHY A PERSON TURNED THIS BACK. The other half of a review: an author that cannot see the
        // objection can only guess, and the same document comes back twice.
        feedbackFor: ((by) => (node: CascadeNode) => by(node.workId))(feedbackFromActions(args.actions)),
        // AND THE BOUND ON ASKING. Counted from what this work has already been told, so a step
        // that has been answered twice is on its last round wherever it runs.
        askRoundsLeft: (node) =>
          Math.max(0, MAX_ASK_ROUNDS - answersFromOutbox(args.blockers, args.actions, cascade)(node).length),
        ...budget,
      }),
    );
  }
  return out;
}

/**
 * What the agent that WRITES THE CHANGE is told — the same things every document author already was.
 *
 * The practice and directives for `implementation_review` (the gate its work is judged at), what a
 * person said when they turned this work back, and what they answered when it asked. Each variable
 * is omitted rather than emptied when there is nothing, so an agent can tell silence from an empty
 * statement — the convention `commandArtifactProducer` keeps.
 */
export function performerEnvFrom(
  args: Args,
  guidance: (gate: GateKind, node: CascadeNode) => { readonly practice?: string; readonly directives?: string; readonly repoSkills?: string },
  cascade?: Cascade,
): (node: CascadeNode) => Readonly<Record<string, string>> {
  const feedback = feedbackFromActions(args.actions);
  const answers = answersFromOutbox(args.blockers, args.actions, cascade);
  return (node) => {
    const g = guidance(GateKind.ImplementationReview, node);
    const said = feedback(node.workId);
    const told = answers(node);
    return {
      ORG_GATE: String(GateKind.ImplementationReview),
      ...(g.practice === undefined || g.practice === "" ? {} : { ORG_PRACTICE: g.practice }),
      ...(g.directives === undefined || g.directives === "" ? {} : { ORG_DIRECTIVES: g.directives }),
      ...(g.repoSkills === undefined || g.repoSkills === "" ? {} : { ORG_REPO_SKILLS: g.repoSkills }),
      ...(said.length === 0 ? {} : { ORG_FEEDBACK: JSON.stringify(said) }),
      ...(told.length === 0 ? {} : { ORG_ANSWERS: JSON.stringify(told) }),
    };
  };
}

/** Same precedence as {@link gateAttemptsFor}: the narrow flag beats the posture `--churn` bundles. */
export function churnThresholdFor(args: Args): number | undefined {
  return args.churnThreshold ?? (args.churn ? 2 : undefined);
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
export function providersFromArgs(
  args: Args,
  events: readonly ExternalEvent[],
  qaFallback: RunOutcome,
  /** What the code-writing agent is told about how this organization works. See `performerEnvFrom`. */
  performerEnv?: (node: CascadeNode) => Readonly<Record<string, string>>,
): ProviderSet {
  // Spread rather than assigned: `exactOptionalPropertyTypes` is on, so an explicit `undefined`
  // would not mean "absent" and would override each adapter's own default with nothing.
  const budget = args.portTimeoutMs === undefined ? {} : { timeoutMs: args.portTimeoutMs };
  return {
    intake:
      // THE WHOLE-TICKET READER when Jira is named. `--jira` used to alias the generic field-map
      // tracker, which read four fields and no thread — so the org's own `read-the-whole-ticket`
      // directive was unfollowable from the one path real tickets arrive by.
      args.jiraAuthFile !== undefined && args.jiraJql !== undefined
        ? jiraIntake({
            credentialsPath: args.jiraAuthFile,
            jql: args.jiraJql,
            ...(args.jiraLimit === undefined ? {} : { maxResults: args.jiraLimit }),
          })
        : args.tracker !== undefined
        ? httpIntake({
            url: args.tracker,
            ...(args.trackerItems === undefined ? {} : { itemsAt: (body) => atPath(body, args.trackerItems ?? "") }),
            mapper: trackerMapper(args.trackerSource, args.trackerMap, args.trackerSeverity),
            headers: headerSourceFrom(args.trackerHeaders),
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
              ...budget,
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
              ...(performerEnv === undefined ? {} : { envFor: performerEnv }),
              ...budget,
            }),
            // The verifier decides. A different command on purpose — the same one would be the
            // agent marking its own homework, which is the whole thing this port refuses.
            verify: {
              command: args.workVerify,
              argsFor: (node) => [...args.workVerifyArgs, node.workId],
              cwd: args.git ?? process.cwd(),
              ...budget,
            },
          })
        : args.workCmd === undefined
          ? simulatedWorkExecutor(true)
          : commandWorkExecutor({
            command: args.workCmd,
            argsFor: (node) => [...args.workArgs, node.workId],
            cwd: args.git ?? process.cwd(),
            ...budget,
          }),
    tests:
      args.testCmd === undefined
        ? simulatedTestRunner(new Map(), qaFallback)
        : commandTestRunner({
            command: args.testCmd,
            argsFor: (tc) => [...args.testArgs, tc.testCaseId],
            cwd: args.git ?? process.cwd(),
            ...budget,
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
              ...budget,
            })
          : autoApproveReview(),
    change:
      args.git === undefined
        ? simulatedChangeControl()
        : args.worktrees === undefined
          ? gitChangeControl({ cwd: args.git, baseBranch: args.baseBranch })
          : gitWorktreeChangeControl({
              cwd: args.git,
              baseBranch: args.baseBranch,
              worktreeRoot: args.worktrees,
              ...(args.worktreeSetup === undefined ? {} : { setup: { command: args.worktreeSetup, args: args.worktreeSetupArgs } }),
              ...(args.handoffCmd === undefined ? {} : { handoff: { command: args.handoffCmd, args: args.handoffArgs } }),
            }),
  };
}

/**
 * What the store already knows about who does good work.
 *
 * Derived rather than stored: a gate verdict recorded against an author is the observation, and
 * re-deriving it means a hand-edited or replayed log yields the same reputation as the run that
 * produced it. An absent store is an empty history, which is the honest starting state for an
 * organization that has not done anything yet — every candidate at the same prior, and the
 * exploration bonus is then what breaks the tie.
 */
function priorObservationsFrom(storeDir: string | undefined): readonly ReputationObservation[] {
  if (storeDir === undefined) return [];
  const events = readEvents(storeDir);
  const folded = foldOrganization(events);
  // WHO WORE WHAT, from the assignment events themselves. `HatAssignment` carries the agent in
  // `actorAgentId` and the hat in `toState`, which is the only place the pairing is recorded.
  // Later assignments win: a hat handed to a second agent means the second one did the work.
  const wearerOf = new Map<string, string>();
  for (const e of events) {
    if (e.kind !== OrgEventKind.HatAssignment) continue;
    if (e.toState === undefined || e.actorAgentId === undefined) continue;
    wearerOf.set(e.toState, e.actorAgentId);
  }
  return observationsFrom({
    evaluations: folded.gateEvaluations,
    authorOf: authorIndexFrom(folded.phaseOutputs),
    wearerOf,
  });
}

/**
 * The after-the-handoff dependencies, attached to a run's dependency object.
 *
 * WHAT IS HANDED OFF AND WHAT IS OPEN ARE GETTERS OVER THE LOG, not values read once: the autonomy
 * loop re-spreads the dependencies every cycle, and a value read before cycle 1 would show cycle 2
 * none of the items cycle 1 raised or settled - so it would raise them again and follow them up twice.
 */
export function attachAfterHandoff(deps: Record<string, unknown>, args: Args, feedback: readonly FeedbackDeliveryT[]): void {
  const store = args.store;
  if (store !== undefined) {
    Object.defineProperty(deps, "handedOffChanges", { enumerable: true, configurable: true, get: () => foldHandedOffChanges(readEvents(store)) });
    Object.defineProperty(deps, "actionItems", { enumerable: true, configurable: true, get: () => foldActionItems(readEvents(store)) });
  }
  const cwd = args.git ?? process.cwd();
  const budget = args.portTimeoutMs === undefined ? {} : { timeoutMs: args.portTimeoutMs };
  deps["defaultBase"] = args.baseBranch;
  // HOW MANY CHANGES ARE FOLLOWED UP AT ONCE is the supply the RMO authorized, not a number invented
  // here: a follow-up is a contributor's session like any other piece of work.
  if (args.supplyTarget !== undefined && Number.isFinite(args.supplyTarget) && args.supplyTarget > 0) deps["maxFollowUps"] = args.supplyTarget;
  if (feedback.length > 0) deps["feedback"] = feedback;
  if (args.changeRequests !== undefined) deps["changeRequests"] = args.changeRequests;
  if (args.describeCmd !== undefined) deps["describeChange"] = commandDescriber({ command: args.describeCmd, args: args.describeArgs, ...budget }, cwd);
  if (args.followUpCmd !== undefined) deps["followUp"] = commandFollowUp({ command: args.followUpCmd, args: args.followUpArgs, ...budget }, cwd);
  if (args.workVerify !== undefined) deps["verifyChange"] = commandVerifier({ command: args.workVerify, args: args.workVerifyArgs, ...budget }, cwd);
  if (args.answerCmd !== undefined) deps["answer"] = commandAnswerer({ command: args.answerCmd, args: args.answerArgs, ...budget }, cwd);
}

/**
 * Settings the operator already configured, applied to this run.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 * `org create` records an organization's store, its intake mode, its AUTONOMY, its human
 * checkpoints and its skill bindings — and `run-org` read NONE of it. There was no `--org` flag at
 * all: every setting had to be retyped as a flag on every run, and any that was not retyped simply
 * did not apply. An organization created `--autonomy autonomous --checkpoint cost_approval` ran
 * fully agentic, in whatever store the command line happened to name, because nothing connected the
 * configuration surface to the runtime. Configuration that the thing being configured never reads
 * is not configuration; it is a note to nobody.
 *
 * ── AUTONOMY DECIDES WHETHER THE RUN CONVERGES ───────────────────────────────
 * The autonomy loop existed (`runUntilSettled`, with the right stop reasons) but was opt-in behind
 * `--until N`, so the default was a SINGLE cycle. That is the wrong default for an organization: an
 * org that stops after one pass with work still open has not finished, and a person watching it
 * cannot tell "it is done" from "it stopped". An organization runs until the work is delivered,
 * until it is genuinely blocked, or until it stops making progress — and then says which.
 *
 * So a resolved org CONVERGES by default, and `--until` becomes the bound rather than the switch.
 * An explicit flag always wins: this fills in what the command line left unsaid, and overrides
 * nothing.
 */
export function withOrgDefaults(args: Args, orgId: string, registryJson: string | undefined): { readonly args: Args } | { readonly reason: string } {
  if (registryJson === undefined) return { reason: `no organization registry found — create one with 'org create --id ${orgId} ...'` };
  const parsed = parseRegistry(registryJson);
  if (!parsed.ok) return { reason: parsed.reason };
  const org = orgById(parsed.registry, orgId);
  if (org !== undefined) {
    // READY TO RUN, not merely well formed. Being half-configured is the normal state of something
    // somebody is still setting up; being half-configured and asked to WORK is the mistake, and
    // this is the point at which "would read an empty backlog forever" becomes true.
    const ready = runReadinessOf(org);
    if (!ready.ok) return { reason: ready.reason };
  }
  if (org === undefined) {
    const known = parsed.registry.orgs.map((o) => o.orgId).join(", ") || "none";
    return { reason: `no organization '${orgId}' — configured: ${known}` };
  }
  return {
    args: {
      ...args,
      store: args.store ?? org.storeDir,
      actions: args.actions ?? `${org.storeDir}/actions`,
      // The checkpoints the operator chose. A flag-supplied list wins outright rather than merging:
      // half-honouring a stated checkpoint set is worse than either honouring or ignoring it.
      checkpoints: args.checkpoints.length > 0 ? args.checkpoints : org.humanCheckpoints,
      // CONVERGE. Both autonomy modes run until the work settles — they differ in what work exists
      // (directed works only what it is handed; autonomous also raises its own), never in whether
      // the organization sees it through.
      until: args.until ?? String(DEFAULT_CONVERGENCE_CYCLES),
      // WHAT THIS ORGANIZATION BOUND. Read here rather than passed as flags: an operator who ran
      // `org skill bind` has already said this, and asking them to repeat it per run is how a
      // configuration surface becomes decoration.
      skillBindings: args.skillBindings.length > 0 ? args.skillBindings : org.skills,
      // WHAT THIS ORGANIZATION SAID ITS PROCESS IS. Read here for the same reason the bindings
      // are: an operator who ran `org practice bind` has already said it, and asking them to
      // repeat it per run is how a configuration surface becomes decoration.
      practices: args.practices.length > 0 ? args.practices : (org.practices ?? []),
      directives: args.directives.length > 0 ? args.directives : (org.directives ?? []),
      // LAYERED, not replaced: a setting stated for this run overrides the organization's value for
      // the same setting and scope, and every other organization setting still applies.
      settings: [
        ...(org.settings ?? []).filter(
          (o) => !args.settings.some((a) => a.setting === o.setting && (a.scope ?? "") === (o.scope ?? "")),
        ),
        ...args.settings,
      ],
      ...(args.changeRequests !== undefined
        ? {}
        : org.changeRequests === undefined
          ? {}
          : { changeRequests: org.changeRequests }),
      // GIT SOURCES ONLY: a tracker or a wiki has no skills directory to read.
      repoSources:
        args.repoSources.length > 0
          ? args.repoSources
          : org.sources
              .filter((src) => String(src.kind) === "git")
              .map((src) => ({ sourceId: src.id, location: src.location })),
    },
  };
}

/**
 * How many cycles a resolved organization gets before the bound is reported as the stop reason.
 *
 * A BOUND, NOT A TARGET: delivery, an escalation, or a cycle that changed nothing all fire first,
 * and in practice one of them always does. It exists so a defect that makes the loop productive but
 * non-converging is reported rather than run forever.
 */
export const DEFAULT_CONVERGENCE_CYCLES = 25;

export async function main(argv: readonly string[]): Promise<number> {
  let args = parseArgs(argv);

  // ── THE ORGANIZATION THE OPERATOR ALREADY CONFIGURED ──────────────────────
  const wantedOrg = valueAfter(argv, "--org");
  if (wantedOrg !== undefined) {
    const home = process.env["ORG_HOME"] ?? process.env["HOME"] ?? process.env["USERPROFILE"] ?? ".";
    const registryPath = process.env["ORG_REGISTRY"] ?? join(home, ".agent-org", "registry.json");
    let raw: string | undefined;
    try {
      raw = readFileSync(registryPath, "utf-8");
    } catch {
      raw = undefined;
    }
    const resolved = withOrgDefaults(args, wantedOrg, raw);
    if ("reason" in resolved) {
      console.error(`refused: ${resolved.reason}`);
      return 2;
    }
    args = resolved.args;
    console.log(`  organization '${wantedOrg}': store, checkpoints and autonomy read from the registry`);
  }

  // Before the organization is built, because a misconfigured run that reaches the cascade has
  // already printed a page of output an operator will read as progress.
  // ── AN UNKNOWN FLAG IS A REFUSAL, NOT A SHRUG ─────────────────────────────
  // Before anything else, because the whole point is that the operator finds out BEFORE the run
  // produces a page of output they will read as "it worked".
  const unknown = unknownFlags(argv);
  if (unknown.length > 0) {
    for (const flag of unknown) console.error(`refused: unknown flag ${flag}`);
    return 2;
  }

  const refusals = argRefusals(args);
  if (refusals.length > 0) {
    for (const reason of refusals) console.error(`refused: ${reason}`);
    return 2;
  }

  // ── EVERY AGENT THIS RUN SPAWNS IS TOLD WHERE ITS WORLDVIEW IS ─────────────
  // Not what it contains — HOW TO ASK. An agent is handed who it is and this command, and reads the
  // dashboard, its items, their attachments and their threads for itself (`observe-cli.ts`). Set on
  // this process's environment so every child inherits it: work agents, document authors and
  // reviewers alike, whichever adapter spawned them. Only with a store: without one there is no
  // record to observe, and pointing an agent at an empty one would tell it nothing is going on.
  if (args.store !== undefined) {
    const fwd = (p: string): string => p.split(String.fromCharCode(92)).join("/");
    process.env["ORG_STORE"] = fwd(resolve(args.store));
    process.env["ORG_OBSERVE_CMD"] ??=
      // `bun` by NAME when that is what is running: the children inherit this PATH, and a read-only
      // agent can then be allowed exactly `Bash(bun:*)` rather than a quoted absolute path no
      // permission pattern matches.
      `${/bun(\.exe)?$/i.test(process.execPath) ? "bun" : `"${fwd(process.execPath)}"`} "${fwd(resolve(import.meta.dir, "observe-cli.ts"))}" --store "${fwd(resolve(args.store))}"` +
      (args.actions === undefined ? "" : ` --actions "${fwd(resolve(args.actions))}"`) +
      (args.blockers === undefined ? "" : ` --blockers "${fwd(resolve(args.blockers))}"`);
    // Where authored documents go, so what an agent writes lands beside the record that lists it.
    process.env["ORG_DOCS_DIR"] ??= fwd(join(resolve(args.store), "docs"));
  }
  // THE STEP'S BUDGET, so an agent's own limit is the organization's rather than a number of its
  // own. MEASURED on AIAGENT-1662: the agent stopped itself at 25 minutes inside a 50-minute step.
  if (args.portTimeoutMs !== undefined) process.env["ORG_PORT_TIMEOUT_MS"] ??= String(args.portTimeoutMs);

  // ── SOMEBODY IS WAITING IN A ROOM ─────────────────────────────────────────
  // Before the organization is even built. A person in a conversation is the most valuable thing
  // this run can attend to and the cheapest to get wrong: a room answered after a full pipeline
  // walk is a conversation nobody is having any more.
  if (args.rooms !== undefined && args.roomCmd !== undefined) {
    const reviser: Reviser = commandReviser(args.roomCmd, args.roomArgs, process.cwd());
    const answered = await answerRooms(args.rooms, reviser, args.now === undefined ? Date.now() : Date.parse(args.now));
    if (answered.length > 0) {
      console.log("\n--- rooms ---");
      for (const a of answered) {
        console.log(
          `  ${a.roomId}: ${a.outcome}${a.revision === undefined ? "" : ` → revision ${String(a.revision)}`}` +
            `${a.reason === undefined ? "" : ` (${a.reason})`}`,
        );
      }
    }
  }

  // Built before the runtime so the same store serves the circuit and the life tick — two stores
  // over one directory would each hold a stale view of the other's writes.
  const memoryStore = args.memory === undefined ? undefined : directoryMemoryStore(args.memory);
  let injectionLedger = EMPTY_LEDGER;
  /** Where each work item's recalled memory was written, so the producer can be handed it. */
  const recallPaths = new Map<string, string>();

  // ── WHAT THE WORK IS ABOUT, WRITTEN DOWN WHERE AN AUTHOR CAN READ IT ──────
  // Keyed by `requestRef`, which `acceptGoal` already puts on the goal and `decompose` already
  // inherits down every rung — so a task five levels below the goal can still find the ticket it
  // came from. Without this an author knows only a gate name and a work id.
  //
  // Written from the inbox the run was actually given. An empty inbox produces no briefs and the
  // author is told nothing, which is the honest state for a run with no tracker attached.
  const briefPaths = new Map<string, string>();
  if (args.inbox !== undefined && args.artifactCmd !== undefined) {
    const briefDir = join(args.inbox, ".briefs");
    for (const file of (() => {
      try {
        return readdirSync(args.inbox as string).filter((f: string) => f.endsWith(".json"));
      } catch {
        return [] as string[];
      }
    })()) {
      try {
        const raw: unknown = JSON.parse(readFileSync(join(args.inbox, file), "utf-8"));
        const it = raw as Record<string, unknown>;
        const source = typeof it["source"] === "string" ? it["source"] : undefined;
        const externalId = typeof it["externalId"] === "string" ? it["externalId"] : undefined;
        const title = typeof it["title"] === "string" ? it["title"] : undefined;
        if (source === undefined || externalId === undefined || title === undefined) continue;
        const body = typeof it["body"] === "string" ? it["body"].trim() : "";
        const reproduction = typeof it["reproduction"] === "string" ? it["reproduction"].trim() : "";
        const refs = Array.isArray(it["evidenceRefs"]) ? it["evidenceRefs"].map(String) : [];

        mkdirSync(briefDir, { recursive: true });
        const at = join(briefDir, `${externalId.replace(/[^A-Za-z0-9._-]/g, "-")}.md`);
        // THE ABSENCE IS STATED, not smoothed over. A ticket with no description is common, and an
        // author that is not told the description is missing will fill the gap silently — which is
        // exactly the document that started this. Saying it out loud makes "the requirements are
        // unverified" something the author can write instead of something a reader has to notice.
        writeFileSync(
          at,
          [
            `# ${externalId} — ${title}`,
            "",
            `Source: ${source}`,
            ...(refs.length === 0 ? [] : ["", "Evidence:", ...refs.map((r) => `- ${r}`)]),
            "",
            "## What the request says",
            "",
            body === ""
              ? "**The description is EMPTY in the source system.** Nothing beyond the title above " +
                "was supplied. Do not invent requirements to fill this in — say plainly that the " +
                "description is missing and that anything below it is unverified."
              : body,
            ...(reproduction === "" ? [] : ["", "## Reproduction", "", reproduction]),
            "",
          ].join("\n"),
          "utf-8",
        );
        briefPaths.set(externalRefOf(source, externalId), at);
      } catch {
        // An unreadable inbox file is the intake port's problem to report, not this loop's to
        // guess at. No brief is written and the author is told nothing about that request.
      }
    }
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

  // A RUN OVER A STORE APPENDS TO IT. Its clock starts after the log's last instant and its counter
  // after the log's highest minted id; otherwise every process restarts at epoch 0 and `-001`, and
  // its events interleave with the previous run's instead of following them. See `logHighWater`.
  const history = args.store === undefined ? { atMs: undefined, counter: 0 } : logHighWater(readEvents(args.store));
  let n = history.counter;
  const createId = (p: string): string => `${p}-${String(++n).padStart(3, "0")}`;
  // Epoch 0 unless the caller declares otherwise — see `--now`. Never `Date.now()`: an ambient
  // clock would make this run unreplayable and would leak wall time into the observe-act window.
  // The store's own last instant is not ambient: it is an input, and the same store gives the same
  // start.
  const declaredNow = args.now === undefined ? undefined : Date.parse(args.now);
  if (declaredNow !== undefined && history.atMs !== undefined && declaredNow <= history.atMs) {
    console.error(
      `[org] --now ${args.now} is not after the store's last event (atMs ${String(history.atMs)}); ` +
        "this run's history would interleave with the one already there. Omit --now to continue after it.",
    );
    return 2;
  }
  const nowMs = declaredNow ?? (history.atMs === undefined ? 0 : history.atMs + 1);

  // ── A WEEK OF THE ORGANIZATION RUNNING ITSELF ─────────────────────────────
  // The drive as a SHIPPED path, not only a tested one. Everything below this line and above the
  // `--cycle` branch is what an empty company does when nobody scripts it: sixteen executives
  // decide what their departments are for, directors break that down, the business side documents
  // it, supervisors price it, leads staff what they can, assignees submit through the gates, and
  // the RMO is told about every rung and every lead the chart cannot fill.
  //
  // No plan, no goal title, no phase list — the seeded chart and a calendar.
  if (args.week) {
    const chartHats = chart.hats.map((h) => h.id);
    const result = runCadence(
      {
        view: {
          chart,
          board: EMPTY_BOARD,
          signals: [],
          cascade: [],
          artifacts: new Map(),
          blockers: new Map(),
          // WHAT PEOPLE HAVE SAID. Without this the operator channel can never light up, and a
          // message written into a room would sit in the queue while the hat it was addressed to
          // went on picking work — visible to a reader, invisible to the organization.
          humanActions: args.actions === undefined ? [] : readActions(args.actions),
          gateAttempts: { counts: new Map<string, number>(), maxAttempts: 3 },
          // ── THREE THINGS SOMEBODY WANTS TO BUY ────────────────────────────
          // A FIXTURE, and labelled as one: the register does not invent costs, so a run with
          // nothing to buy would show none of this. These are the three shapes the CFO can be
          // handed, and the week's report shows what it did with each.
          //
          // They name the first Implementation, Security and Memory directions, which is why the
          // ids look derived — they are. Those goals exist by the end of day one and are priced by
          // their executive, and `decideSpend` refuses to rule on unpriced work.
          spend: {
            budget: openBudget({
              budgetId: "fy",
              allowance: 10_000,
              unit: "usd",
              windowStartMs: nowMs,
              windowEndMs: nowMs + 365 * DAY_MS,
            }),
            // How much work a free path may cost before paying wins. The one genuinely subjective
            // input, stated as policy rather than defaulted inside the decision.
            effortTolerance: EffortClass.Small,
            proposals: [
              {
                proposalId: "sp-vector-db",
                workId: "direction-implementation-1",
                what: "a hosted vector database",
                cost: 1_200,
                proposedByHatId: "tech_lead",
                // Somebody looked, and what they found DOES the job cheaply. The free way wins.
                search: {
                  kind: "searched",
                  found: [
                    {
                      what: "pgvector on the postgres we already run",
                      adequacy: Adequacy.Adequate,
                      effort: EffortClass.Small,
                    },
                  ],
                },
              },
              {
                proposalId: "sp-pen-test",
                workId: "direction-security-1",
                what: "an external penetration test",
                cost: 6_000,
                proposedByHatId: "security_director",
                // Somebody looked and found nothing that does the job. A real, different answer
                // from nobody having looked — and this one is approved.
                search: {
                  kind: "searched",
                  found: [
                    {
                      what: "the open-source scanners we already run in CI",
                      adequacy: Adequacy.Partial,
                      effort: EffortClass.Trivial,
                      shortfall: "no adversarial testing of business logic",
                    },
                  ],
                },
              },
              {
                proposalId: "sp-transcription",
                workId: "direction-memory-1",
                what: "a transcription API",
                cost: 400,
                proposedByHatId: "memory_manager",
                // NOBODY LOOKED. The CFO refuses to rule, and the report says so — which is the
                // whole point of asking.
                search: { kind: "not_searched", why: "nobody checked for an open-source model" },
              },
            ],
          },
        },
        cascade: EMPTY_CASCADE,
        calendar: EMPTY_CALENDAR,
      },
      chartHats,
      {
        chart,
        nowMs,
        createId,
        resourceAuthorityHatId: "rmo_office",
        directionReviewMs: DAY_MS,
        // An hour of work and a half-hour review. Declared rather than defaulted, because absent
        // means "this organization does not keep a calendar" and a CLI that ran the whole company
        // without one would be showing a week in which nobody's time was ever spoken for.
        workBlockMs: 60 * 60 * 1000,
        meetingMs: 30 * 60 * 1000,
      },
      { periodMs: DAY_MS, periods: args.days ?? 7, maxRoundsPerPeriod: 80 },
    );
    if (args.json) {
      console.log(JSON.stringify({ summary: result.summary, periods: result.periods.map((p) => ({ index: p.index, atMs: p.atMs, changes: p.changes, settled: p.settled })), cascade: result.state.cascade.nodes }, null, 2));
    } else {
      console.log(result.summary);
      for (const p of result.periods) {
        console.log(`  day ${String(p.index + 1)}: ${String(p.changes)} change(s) over ${String(p.rounds.length)} round(s)${p.settled ? "" : " — DID NOT SETTLE"}`);
      }
      const nodes = result.state.cascade.nodes;
      const byType = new Map<string, number>();
      for (const node of nodes) byType.set(node.workType, (byType.get(node.workType) ?? 0) + 1);
      console.log(`
--- what it built ---`);
      for (const [type, count] of [...byType].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        console.log(`  ${type.padEnd(12)} ${String(count)}`);
      }
      console.log(`  ${"delivered".padEnd(12)} ${String(nodes.filter((node) => node.state === "done").length)}`);
      console.log(`  ${"documents".padEnd(12)} ${String(result.state.view.artifacts.size)}`);
      const blocks = result.state.calendar.blocks;
      console.log(`  ${"work blocks".padEnd(12)} ${String(blocks.filter((b) => b.blockType === "prioritized_work").length)}`);
      console.log(
        `  ${"meetings".padEnd(12)} ${String(new Set(blocks.filter((b) => b.meetingId !== undefined).map((b) => b.meetingId)).size)}`,
      );
      // ── WHAT THE MONEY DID ────────────────────────────────────────────────
      // Printed beside the rest rather than buried: a week's report that shows what an organization
      // built and not what it decided to pay for is missing the half a CFO is for.
      const spent = result.state.view.spend?.budget;
      if (spent !== undefined) {
        console.log(`\n--- what it spent ---`);
        console.log(`  ${String(spent.spent)} of ${String(spent.allowance)} ${spent.unit}`);
        for (const ruling of result.state.view.signals.filter((sig) => sig.tool === SignalTool.RequestDecision)) {
          console.log(`  ${ruling.title.padEnd(22)} ${ruling.workItemId ?? ""}: ${ruling.message}`);
        }
        // A PROPOSAL NOBODY COULD RULE ON IS NOT A PROPOSAL THAT PASSED. Reported by difference,
        // because the refusal leaves no signal — that is what makes it a refusal.
        const ruled = new Set(
          result.state.view.signals
            .filter((sig) => sig.tool === SignalTool.RequestDecision)
            .map((sig) => sig.workItemId),
        );
        for (const p of result.state.view.spend?.proposals ?? []) {
          if (!ruled.has(p.proposalId)) console.log(`  ${"UNRULED".padEnd(22)} ${p.proposalId}: ${p.what}`);
        }
      }
      // THE GAPS, printed beside the achievements rather than under them. A run that shows what an
      // organization built and hides what it could not staff is the report this whole register
      // exists to refuse.
      const raised = result.state.view.signals;
      console.log(`
--- what it could not do ---`);
      // THE SUPPLY AND ROUTING GAPS ONLY. Spend rulings are signals too, and they have their own
      // section above — listing them here as things the organization could not do would report a
      // decision it made as a failure.
      const gaps = raised.filter((signal) => signal.tool !== SignalTool.RequestDecision);
      if (gaps.length === 0) console.log("  (nothing was raised)");
      for (const signal of gaps) console.log(`  ${signal.fromHatId} -> ${signal.toHatId}: ${signal.title}`);
    }
    // A week is not a delivery verdict. It exits 0 if the organization ran; whether it delivered
    // is in the report, and collapsing that to an exit code would answer a question nobody asked.
    return 0;
  }

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
  const dataSource = hasSource(args) ? sourceFromArgs(args) : undefined;

  // ── WHAT THE BUSINESS AUTHORS ARE GIVEN BEFORE THEY WRITE ────────────────
  // Read ONCE, ahead of the run, and handed to every pre-code author. Before this, the data source
  // fed exactly one gate and the other seven authors saw only the defect report — so a BRD was
  // written from three sentences, invented the specifics it needed, and was rejected for inventing
  // them. That loop was not a disagreement about quality; the author was being asked to describe a
  // system nobody had shown it.
  //
  // Materialised to files because the authors are commands. The PORT is still the interface, so a
  // wiki or a ticket system is a new adapter and nothing below changes.
  // ── WHAT THE ORGANIZATION ALREADY HAS ABOUT EACH ITEM ─────────────────────
  // Targeted per work item rather than a blanket read of the corpus, so a step working on link
  // expiry is handed the pages about links and about expiry — and, more usefully, is TOLD which of
  // its own terms the corpus has never mentioned. That is what separates "extend what exists" from
  // "build something new", and an author that cannot tell the difference asks the wrong questions.
  //
  // Computed for the work already on the record, because `contextFor` is consulted synchronously
  // while the run walks. A goal stated for the first time therefore reaches its first gate
  // ungrounded and is grounded from the next cycle on, which is the honest limit of doing this
  // without making every producer call await a search.
  const grounding = new Map<string, readonly string[]>();
  if (dataSource !== undefined && args.contextOut !== undefined && args.store !== undefined) {
    const ground = groundingFor(dataSource, args.contextOut, args.contextLimit ?? 8);
    for (const node of foldOrganization(readEvents(args.store)).cascade.nodes) {
      const paths = await ground(node);
      if (paths.length > 0) grounding.set(node.workId, paths);
    }
    if (grounding.size > 0) {
      console.log(`
--- grounding ---
  ${String(grounding.size)} work item(s) given what this organization already has about them`);
    }
  }

  let contextPaths: readonly string[] = [];
  if (dataSource !== undefined && args.contextOut !== undefined) {
    const got = await materialiseContext(dataSource, args.contextOut, args.contextLimit ?? 40);
    contextPaths = got.paths;
    console.log(
      `
--- context ---
  ${String(got.paths.length)} document(s) given to the business authors` +
        (got.capped ? ` (capped from ${String(got.total)}; raise --context-limit to widen)` : "") +
        `
  source is READ-ONLY: the organization writes its own record and never edits the corpus`,
    );
  }

    // ── WHAT THIS ORGANIZATION HAS BEEN ASKED FOR ─────────────────────────────
  // Stated goals win over the demo fixture. See `statedGoalsAsIntake` for what was broken.
  const stated = args.actions === undefined ? [] : statedGoalsAsIntake(readActions(args.actions));
  if (stated.length > 0) {
    console.log(`  intake: ${String(stated.length)} goal(s) stated by a person; the demo fixture is not used`);
  }

  const intake = stated.length > 0 ? stated : REPORTS;

  // ── HOW THE WORK IS DONE — built ONCE, for every agent that does it ───────
  // It used to be built inline for the document authors only, so the agent writing the code was the
  // one agent in the organization never told the practice it was held to.
  const guidance = guidanceFrom({
    practices: args.practices,
    directives: args.directives,
    defaultPractices: DEFAULT_PRACTICES,
    defaultDirectives: DEFAULT_DIRECTIVES,
    ...(args.store === undefined
      ? {}
      : { cascade: foldOrganization(readEvents(args.store)).cascade }),
    // READ ONCE PER RUN. A repository's skill directory does not change mid-run, and reading
    // it per phase would stat the same files for every gate of every item.
    repoSkills: renderRepoSkills(args.repoSources),
  });
  const providers = providersFromArgs(
    args,
    intake,
    args.qaFails ? RunOutcome.Failed : RunOutcome.Passed,
    performerEnvFrom(args, guidance, args.store === undefined ? undefined : foldOrganization(readEvents(args.store)).cascade),
  );
  // ── A PERSON'S "NO" STANDS AT ANY STEP ─────────────────────────────────────
  // Written into the log once, as the step's newest verdict, before anything reads the verdicts -
  // see `human-verdicts.ts`. MEASURED on AIAGENT-1658: a reproduction approved over a replica of the
  // component, rejected by the requester, and the approval still stood.
  if (args.store !== undefined && args.actions !== undefined) {
    const prior = readEvents(args.store);
    const folded = foldOrganization(prior);
    const hw = logHighWater(prior);
    const toRecord = humanRejectionsToRecord({
      actions: readActions(args.actions),
      evaluations: folded.gateEvaluations,
      known: new Set(folded.cascade.nodes.map((n) => n.workId)),
      checkpointGates: new Set([...humanGatesFor(args.checkpoints)].map(String)),
      atMs: (hw.atMs ?? 0) + 1,
    });
    let minted = hw.counter;
    for (const e of humanRejectionEvents(toRecord, () => `evt-${String(++minted).padStart(3, "0")}`)) {
      appendEvent(e, args.store);
      console.log(`  ${e.decision}`);
    }
  }

  const runtimeDeps = {
    chart,
    externalEvents: intake,
    agents,
    // THE RMO NEEDS A HISTORY TO RANK ON. Empty here meant every candidate scored the same
    // uniform prior, so two assignments in one run both came back `score 0.400` and both went
    // to the same agent out of eighty-five eligible. Derived from the store, so reputation
    // accumulates across runs instead of resetting every process.
    observations: priorObservationsFrom(args.store),
    // WHAT THE PROCESS DOES at mechanical decisions — the branching disposition among them. Read
    // from the register rather than derived: a stabilization epic and a feature epic are the same
    // shape, and only an operator knows which is which.
    //
    // SUPPLIED TO BOTH dependency objects. A field on one only is exactly how `alreadyLanded`
    // stayed undefined on the ordinary path for the whole life of that field.
    ...(args.settings.length === 0 ? {} : { settings: args.settings }),
    // WHAT THIS ORGANIZATION WAS ALREADY DOING. Without it every run re-accepts the same intake
    // under fresh ids, so nothing a run learns - an answer, a verdict, a document - can reach the
    // next one, and no work can outlive the process that started it.
    ...(args.store === undefined
      ? {}
      : { priorCascade: foldOrganization(readEvents(args.store)).cascade }),
    // WHAT HAS ALREADY LANDED. Read from the log for the same reason `priorCascade` is: it is a
    // fact about history and this run has none of its own.
    //
    // THIS LINE WAS MISSING, AND ITS ABSENCE DISABLED A GUARD RATHER THAN A FEATURE. The runtime
    // refuses to call a goal delivered when the cascade says done and no commit exists -- but
    // only when `alreadyLanded` is supplied, because absent it the honest reading is NOT MEASURED
    // and a runtime that judged that as "nothing landed" would fail every store-less run. That
    // clause is right; what was wrong is that the ordinary path never measured. `run-org` builds
    // two dependency objects and only the `--week` one carried this field, so the guard was a
    // reader with no writer on every run the CLI documents.
    //
    // MEASURED 2026-09-10 against a real clone: the change failed to open, nothing merged, `main`
    // never moved -- and the run printed `goal DELIVERED` with the disagreement logged beside it.
    ...(args.store === undefined
      ? {}
      : { alreadyLanded: new Set(foldLandedChanges(readEvents(args.store)).keys()) }),
    // WHAT IS ALREADY IN FRONT OF A REVIEWER, so a resume neither re-walks it nor proposes it twice.
    ...(args.store === undefined
      ? {}
      : { alreadyHandedOff: new Set(foldHandedOffChanges(readEvents(args.store)).keys()) }),
    ...(args.supplyTarget === undefined ? {} : { supplyTarget: args.supplyTarget }),
    // WHAT ALREADY PASSED, so a resumed run does not re-walk approved steps.
    ...(args.store === undefined
      ? {}
      : { priorGateEvaluations: foldOrganization(readEvents(args.store)).gateEvaluations }),
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
    ...((n) => (n === undefined ? {} : { churnThreshold: n }))(churnThresholdFor(args)),
    // The documents each pre-code gate judges. Empty when no command was given, which leaves those
    // phases exactly as they were rather than inventing an artifact nobody wrote.
    // ── WRITE EVENTS AS THEY HAPPEN, so the run can be WATCHED ─────────────
    // `appendRun` still writes the summary at the end. This adds the events on the way past, which
    // is the whole difference between a history and a live view: a run that is still going, or one
    // that crashed, is observable either way because the log is written as it is lived.
    ...(args.store === undefined
      ? {}
      : { onEvent: (event: OrgEvent) => void appendEvent(event, args.store as string) }),
    artifactProducers: artifactProducersFromArgs(
      args,
      // WHAT THE WORK IS, the org's own documents, and what this hat remembers.
      //
      // The brief goes FIRST. These arrive as positional arguments after the gate and the work id,
      // and an author that reads only the first is then reading the ticket rather than whichever
      // document happened to sort earliest.
      (_gate: GateKind, node: CascadeNode) => {
        const brief = node.requestRef === undefined ? undefined : briefPaths.get(node.requestRef);
        const recall = recallPaths.get(node.workId);
        return [
          ...(brief === undefined ? [] : [brief]),
          // WHAT ALREADY EXISTS ABOUT THIS ITEM, before the corpus at large: an author reads the
          // first documents it is given, and the one about its own work should not be behind forty
          // that are not.
          ...(grounding.get(node.workId) ?? []),
          ...contextPaths,
          ...(recall === undefined ? [] : [recall]),
        ];
      },
      // The work as the log has it, so an answer given to a goal reaches the project under it.
      args.store === undefined ? undefined : foldOrganization(readEvents(args.store)).cascade,
      // WHAT THE OPERATOR BOUND. Empty is not nothing: `resolve` still answers, with "use whatever
      // the repository provides", which is the documented default and the thing agents were never
      // told either.
      skillResolverFor(
        args.skillBindings,
        args.store === undefined ? undefined : foldOrganization(readEvents(args.store)).cascade,
      ),
      // ── HOW THE WORK IS DONE, reaching the agent that does it ──────────────
      // The last join, and the one the whole layer is for: a process nothing hands to an agent is
      // a configuration surface that reads as governance and governs nothing.
      guidance,
    ),
    ...((n) => (n === undefined ? {} : { maxGateAttempts: n }))(gateAttemptsFor(args)),
    // ── THE TWO HALVES OF A CHECKPOINT, AND THEY TRAVEL TOGETHER ───────────
    // Checkpoints with no queue to answer them is an organization that stops and cannot be
    // restarted. So the answer path is wired whenever `--actions` is given, and the checkpoints are
    // wired whenever they are named; a run configured with the first and not the second stops for
    // good, which is why the banner below says which of the two it has.
    ...(args.checkpoints.length === 0 ? {} : { checkpoints: args.checkpoints }),
    // ── TWO WAYS A PERSON CAN ANSWER A GATE, AND THEY AGREE ──────────────
    // The action queue (a straight approval) and a CONVERGED ROOM (an approval reached by
    // iterating on the document). A room's approval names the revision it was given for, so it is
    // the stronger of the two — and it wins when both exist, because somebody who sat in the room
    // has read more than somebody who pressed a button.
    ...(args.actions === undefined && args.rooms === undefined
      ? {}
      : {
          humanDecisionFor: (workId: string, gate: GateKind) => {
            if (args.rooms !== undefined) {
              const fromRoom = gateAnswersFromRooms(args.rooms).find(
                (r) => r.workId === workId && r.gate === String(gate),
              );
              if (fromRoom !== undefined) {
                return {
                  outcome: GateOutcome.Approved,
                  // The ROOM is the evidence, and it carries the revision that was approved.
                  actionRef: `room/${fromRoom.roomId}#r${String(fromRoom.revision)}`,
                };
              }
            }
            return args.actions === undefined ? undefined : humanDecisionsFrom(args.actions)(workId, gate);
          },
        }),
    // ── WHICH REFS ARE DOCUMENTS ──────────────────────────────────────────
    // The runtime asks; this answers by looking. A ref that does not resolve to a readable file
    // yields nothing, so the documents view lists only what a reader can open — the same discipline
    // `/api/artifact` keeps at the other end.
    documentAt: (ref: string) => {
      try {
        const stat = statSync(ref);
        return stat.isFile() ? { path: ref, bytes: stat.size } : undefined;
      } catch {
        return undefined;
      }
    },
    // ── THE MEMORY CIRCUIT ────────────────────────────────────────────────
    // Recall before a hat produces anything, credit what it cited afterwards, and — after the run
    // knows how the work ended — tell the memories that were in scope. Without all three the
    // counters that decide what survives never move and the substrate decays on a timer alone.
    ...(memoryStore === undefined
      ? {}
      : {
          recallFor: (workId: string, hatId: string, _gate: string, agentId?: string) => {
            // ORG, HAT, AGENT and WORK. Department is deliberately absent: `scopesFor` supports it
            // and nothing in this register writes a department-tier memory yet, so asking for one
            // would add a scope that is empty by construction — a lookup that cannot succeed reads
            // exactly like one that found nothing.
            const injection = inject(
              memoryStore,
              { hatId, workId, orgId: "org", ...(agentId === undefined ? {} : { agentId }) },
              nowMs,
            );
            injectionLedger = noteInjectionFor(injectionLedger, workId, injection.injectedIds);
            // ── HOW MEMORY REACHES THE AGENT ──────────────────────────────
            // Written to a file and handed over through the SAME context seam the org's own
            // documents already use. A second delivery mechanism would mean a producer that reads
            // documents but not memory, or the reverse, depending on which one it was wired for.
            if (injection.injectedIds.length > 0) {
              try {
                const dir = join(memoryStore.root, ".recall");
                mkdirSync(dir, { recursive: true });
                const path = join(dir, `${workId.replace(/[^A-Za-z0-9._-]/g, "-")}.md`);
                writeFileSync(path, `${injection.text}
`, "utf-8");
                recallPaths.set(workId, path);
              } catch {
                // A recall the producer cannot be handed is a recall that did not happen for it.
                // The injection is still counted, because the memory WAS selected and the counter
                // measures selection; the citation simply will not come.
              }
            }
            return { text: injection.text, injectedIds: injection.injectedIds };
          },
          notedCitations: (
            workId: string,
            _hatId: string,
            injectedIds: readonly string[],
            producedText: readonly string[],
          ) => {
            const cited = citedIdsIn(producedText.join("\n"));
            if (cited.length === 0) return [];
            const result = recordCitations(memoryStore, injectedIds, cited, nowMs, workId);
            if (!result.ok) {
              // A FABRICATED CITATION IS A REFUSAL, not a silent drop. An agent that can claim to
              // have used something it was never shown could manufacture its own grounding.
              console.error(`[memory] ${workId}: ${result.reason}`);
              return [];
            }
            return result.facts;
          },
        }),
    // Absent unless `--price` was given. No table is baked in: see `meter.ts`.
    ...(Object.keys(args.pricing).length === 0 ? {} : { pricing: args.pricing }),
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

  // SAID OUT LOUD, BEFORE THE RUN. A checkpoint that is on and an answer path that is missing is
  // a run that will stop and stay stopped, and the operator has to learn that at the start rather
  // than from a report that says nothing happened.
  // NOT UNDER `--json`. That mode's whole contract is that stdout is ONE parseable document,
  // and a banner printed ahead of it makes the output unparseable — which is how this was
  // caught: the test that reads the report back failed on the first word of this message. The
  // machine-readable half is already in the report, as `awaitingHuman`.
  if (!args.json) {
    if (args.checkpoints.length === 0) {
      console.log("\nhuman checkpoints: none — the organization runs the whole chain agentically");
    } else {
      console.log(`\nhuman checkpoints: ${args.checkpoints.join(", ")}`);
      console.log(
        args.actions === undefined
          ? "  !! no --actions queue: nothing can answer these, so the run WILL stop and stay stopped"
          : `  answers read from ${args.actions}`,
      );
    }
    console.log(
      args.blockers === undefined
        ? "  (no --blockers outbox: a blocker the organization cannot resolve reaches nobody)"
        : `  blockers raised to a person land in ${args.blockers}`,
    );
  }
  // WHAT A PERSON FILED AND THE RUN CANNOT READ, said out loud. MEASURED: three notes to two runs
  // lacked `detail.message`, were dropped by the reader, and neither run said so - the person
  // believed the organization had been told, and nobody had.
  if (args.actions !== undefined) {
    for (const p of queueProblems(args.actions)) {
      console.log(`  !! NOT READ: ${p.file} in ${args.actions} - ${p.reason}`);
    }
  }

  // ── AFTER THE HANDOFF: WHAT PEOPLE SAID ABOUT WHAT IS ALREADY IN FRONT OF THEM ──
  // Webhook deliveries filed in the feedback directory, plus whatever a poller of the review system
  // reports. Both only READ the review system. Each becomes an action item on its work, decided about
  // by the organization - see `change-followup.ts`.
  const feedbackDir = args.feedbackDir ?? (args.store === undefined ? undefined : join(args.store, "feedback"));
  const filed = feedbackDir === undefined ? { deliveries: [], files: [], unreadable: [] } : readFeedbackDir(feedbackDir);
  for (const name of filed.unreadable) console.log(`  feedback file '${name}' in ${String(feedbackDir)} is not a delivery this organization can read - left in place`);
  const polled =
    args.feedbackCmd === undefined || args.store === undefined
      ? { deliveries: [] }
      : pollFeedback(
          { command: args.feedbackCmd, args: args.feedbackArgs, ...(args.portTimeoutMs === undefined ? {} : { timeoutMs: args.portTimeoutMs }) },
          args.git ?? process.cwd(),
          foldHandedOffChanges(readEvents(args.store)),
        );
  if (polled.refusal !== undefined) console.log(`  ${polled.refusal}`);
  attachAfterHandoff(runtimeDeps as unknown as Record<string, unknown>, args, [...filed.deliveries, ...polled.deliveries]);

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
            //
            // PAST EVERYTHING THE CYCLE WROTE, not one tick past where it began. A cycle stamps its
            // reviews ahead of its start (MEASURED: cycle 1 at 0 wrote at 60000), so `prev + 1`
            // started cycle 2 at 1 — before cycle 1's own verdicts in the log.
            nextNowMs: (_c, prev, cycleReport) =>
              cycleReport.trace.reduce((hi, e) => Math.max(hi, e.atMs), prev) + 1,
            // A PERSON'S `pause_run`, read from the queue at each cycle boundary so one filed while
            // the run is going stops it at the next consistent point.
            ...(args.actions === undefined ? {} : { pausedBecause: pausedFromActions(args.actions) }),
          },
          runOrgRuntime,
        );
  const report = settled?.last ?? (await runOrgRuntime(runtimeDeps));
  // Read deliveries are moved aside only once the run that raised them has finished. Raising is
  // idempotent, so a file read twice costs nothing; a file moved before it was raised would be lost.
  if (feedbackDir !== undefined) consumeFeedback(feedbackDir, filed.files);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return report.delivered ? 0 : 1;
  }

  // BEFORE THE VERDICT. "NOT DELIVERED" and "waiting for you" are different sentences, and a
  // reader who sees only the first concludes the run failed.
  // ── WHAT THE ORGANIZATION'S OWN AGENTS ASKED ──────────────────────────────
  // Raised through the SAME channel a blocker uses, because it is one: something the organization
  // cannot resolve from inside itself. The questions are the agent's, verbatim — this layer routes
  // and never authors, so a differently-configured org, with different SDLC steps and different
  // hats, asks entirely different things through exactly this code.
  if (report.questionsForHuman.length > 0) {
    console.log(NL + "=== THE ORGANIZATION IS ASKING YOU ===");
    for (const q of report.questionsForHuman) {
      console.log("  " + q.byHatId + " on " + q.taskId + " at '" + String(q.gate) + "': " + q.question);
    }
    if (args.blockers === undefined) {
      // An honest refusal rather than a silent drop: the questions exist, and without an outbox
      // they reach nobody. Saying so is what keeps "nobody asked" and "nobody answered" apart.
      console.log("  (no --blockers outbox - these reached nobody; pass one so they can be answered)");
    } else {
      for (const q of report.questionsForHuman) {
        // Idempotent by id: the same unanswered question on a later run is one blocker, not two.
        const digest = [...q.question].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000000007, 7);
        raiseBlocker(
          {
            blockerId: "ask-" + q.taskId + "-" + String(q.gate) + "-" + String(digest),
            byHatId: q.byHatId,
            about: q.question,
            blocking: q.taskId,
            // NOT this organization's to decide: the agent doing the step has already established
            // that the answer is not something the chart contains. `human-blocker.ts` documents
            // this as the kind it cannot check, which is exactly right - whether a question is
            // answerable inside the org is a judgement the agent made, not a fact the chart holds.
            exhaustion: { kind: "outside_org_authority", what: "'" + String(q.gate) + "' on " + q.taskId },
            unblocks: "'" + String(q.gate) + "' on " + q.taskId,
            atMs: nowMs,
            why: q.byHatId + " could not complete '" + String(q.gate) + "' without this",
          },
          args.blockers,
        );
      }
      console.log("  raised into " + args.blockers + " - answer them and run again");
    }
  }

  if (report.awaitingHuman.length > 0) {
    console.log(`\n=== WAITING ON A PERSON ===`);
    for (const w of report.awaitingHuman) {
      console.log(`  ${w.taskId} stopped at '${String(w.gate)}' — approve or reject it to continue`);
      console.log(`    --kind approve_gate --subject ${w.taskId} --detail gate=${String(w.gate)}`);
    }
  }

  // HANDED OFF IS NOT DELIVERED, and the banner must not blur them: the work is in front of people,
  // nothing reached the trunk, and the next act is theirs. Asked of the RECORD, not of this run's
  // own handoffs: a run that only followed up on earlier ones hands nothing off anew, and MEASURED
  // 2026-09-11 it printed DELIVERED while three merge requests sat open and unmerged.
  const awaitingReview = awaitingHumanReview({
    changes: report.changes,
    handedOffThisRun: report.changesHandedOff,
    handedOffOnRecord: new Set(args.store === undefined ? [] : foldHandedOffChanges(readEvents(args.store)).keys()),
    landed: report.changesLanded,
  });
  const banner = !report.delivered
    ? "NOT DELIVERED"
    : awaitingReview.length > 0
      ? "HANDED OFF FOR HUMAN REVIEW - nothing was merged"
      : "DELIVERED";
  console.log(`\n=== ${banner} ===`);
  for (const w of awaitingReview) {
    console.log(`  awaiting human review: ${w}${report.changesHandedOff.includes(w) ? "" : " (handed off earlier)"}`);
  }
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
    // THE RMO NEEDS A HISTORY TO RANK ON. Empty here meant every candidate scored the same
    // uniform prior, so two assignments in one run both came back `score 0.400` and both went
    // to the same agent out of eighty-five eligible. Derived from the store, so reputation
    // accumulates across runs instead of resetting every process.
    observations: priorObservationsFrom(args.store),
    // WHAT THE PROCESS DOES at mechanical decisions — the branching disposition among them. Read
    // from the register rather than derived: a stabilization epic and a feature epic are the same
    // shape, and only an operator knows which is which.
    //
    // SUPPLIED TO BOTH dependency objects. A field on one only is exactly how `alreadyLanded`
    // stayed undefined on the ordinary path for the whole life of that field.
    ...(args.settings.length === 0 ? {} : { settings: args.settings }),
    // WHAT THIS ORGANIZATION WAS ALREADY DOING. Without it every run re-accepts the same intake
    // under fresh ids, so nothing a run learns - an answer, a verdict, a document - can reach the
    // next one, and no work can outlive the process that started it.
    ...(args.store === undefined
      ? {}
      : { priorCascade: foldOrganization(readEvents(args.store)).cascade }),
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
      // NAMED BY THE WORK, like every other path. `agent-work/${workId}` marked WHO performed the
      // item, which is a different axis from what the branch holds — and the register already
      // records the performer, so the branch name was spending the one thing a reviewer reads on a
      // fact stored elsewhere. `report.cascade` is in scope, so the collision-aware form is used.
      branch: branchNameIn(report.cascade, node),
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

  // ── HOW THE WORK TURNED OUT, TOLD TO WHAT WAS IN SCOPE FOR IT ─────────────
  // The half that says whether a memory was RIGHT, rather than merely fresh or merely read. Runs
  // before the life tick so the maintenance pass sees this run's correlation rather than the last
  // one's — a memory that just failed should be judged on that today, not tomorrow.
  if (memoryStore !== undefined && injectionLedger.byWork.size > 0) {
    const blockedWork = new Set(report.awaitingHuman.map((a) => a.taskId));
    const deliveredWork = new Set(
      report.cascade.nodes.filter((node) => node.state === WorkState.Done).map((node) => node.workId),
    );
    let correlated = 0;
    for (const [workId, ids] of injectionLedger.byWork) {
      const signal = signalFor(deliveredWork.has(workId), blockedWork.has(workId));
      correlated += correlateOutcome(memoryStore, workId, ids, signal, nowMs).length;
    }
    if (correlated > 0) console.log(`\n--- memory ---\n  ${String(correlated)} memory/memories told how their work went`);
  }

  // The census the LAST run took, narrowed back into the typed shape.
  //
  // The fact stores `presence` as a plain string, because a fact is data on disk and a log written
  // by an older build must still be readable. So a value that is no longer a known state is DROPPED
  // rather than cast: an unrecognised state silently treated as `asleep` would report a hat as
  // sleeping on the strength of not being understood.
  const previousPresence: HatPresence[] = [];
  for (const h of foldPresence(args.store === undefined ? [] : readEvents(args.store))?.hats ?? []) {
    if (!isPresence(h.presence)) continue;
    previousPresence.push({
      hatId: h.hatId,
      presence: h.presence,
      because: h.because,
      ...(h.subject === undefined ? {} : { subject: h.subject }),
    });
  }

  // Read ONCE and reused three times below — the calibration pass, which hats are worn, and what
  // the organisation has a reason to meet about. Reading it three times would let three answers
  // come from three reads of a directory another process may be appending to.
  const priorEvents = args.store === undefined ? [] : readEvents(args.store);
  // Facts produced before the life tick, carried into the same event batch so a calibration and a
  // study memory written on the same day land in one run's history rather than two.
  const lifePreFacts: OrgFact[] = [];

  // ── WHAT EACH ACTOR LEARNED ABOUT ITSELF ──────────────────────────────────
  // Separate from the hat memories the study loop writes: those are what the ROLE knows and are
  // inherited by whoever wears it next. These are about the ACTOR and travel with it across hats,
  // which is what `MemoryTier.Agent` is for — a tier that was readable everywhere and written
  // nowhere until this ran.
  //
  // Fed the PRIOR log plus this run's events, because a run's own gate results are the freshest
  // evidence about how the agent did (`report.trace` is the run's own OrgEvents; `report.events`
  // is their printable form), and excluding them would make every calibration a run behind.
  // ── WHAT THE WORK ITSELF TAUGHT ───────────────────────────────────────────
  // Written at the HAT tier: a lesson about how this codebase is built belongs to the role and is
  // inherited by whoever wears it next. A refusal is a protected memory somebody tried to
  // overwrite, and it stays a refusal.
  let lessonsWritten = 0;
  if (memoryStore !== undefined) {
    for (const l of report.learnings) {
      const written = writeMemory(memoryStore, {
        tier: MemoryTier.Hat,
        scope: l.byHatId,
        key: l.key,
        value: l.value,
        contextHint: `worked out while doing '${String(l.gate)}' on ${l.workId}`,
        writtenBy: l.byHatId,
        atMs: nowMs,
      });
      if (written === undefined) continue;
      lifePreFacts.push(written.fact);
      lessonsWritten += 1;
    }
    if (lessonsWritten > 0) {
      console.log(`${NL}--- what the work taught ---`);
      for (const l of report.learnings) console.log(`  ${l.byHatId} learned '${l.key}' doing '${String(l.gate)}'`);
    }
  }

  let calibrationsWritten = 0;
  if (memoryStore !== undefined) {
    const store = memoryStore;
    for (const calibration of agentCalibrations([...priorEvents, ...report.trace])) {
      const input = memoryFromCalibration(calibration, nowMs);
      if (input === undefined) continue;
      const written = writeMemory(store, input);
      // A refusal is a protected memory somebody tried to overwrite, and it stays a refusal.
      if (written === undefined) continue;
      lifePreFacts.push(written.fact);
      calibrationsWritten += 1;
    }
    if (calibrationsWritten > 0) {
      console.log(`\n--- what each agent learned about itself ---`);
      console.log(`  ${String(calibrationsWritten)} calibration(s) written to agents' own repositories`);
    }
  }

  // ── THE REST OF THE DAY ───────────────────────────────────────────────────
  // Run AFTER the pipeline, so "who is idle" reflects where this run actually got to rather than
  // where it started. A hat that finished its work five minutes ago is idle now, and that is
  // exactly the moment worth giving it something to read.
  let lifeFacts: readonly OrgFact[] = [];
  let lifeEvents: readonly OrgEvent[] = [];

  // WHY THIS IS COMPUTED BEFORE THE GATE BELOW: a meeting is caused by a condition in the log, not
  // by whether anyone configured a memory store. An organisation with rejections piling up should
  // put an hour in the diary whether or not it is also studying in its spare time.
  const demand = meetingDemand({
    events: priorEvents,
    cascade: report.cascade,
    chart,
    nowMs,
    stillHeld: report.awaitingHuman.map((a) => ({ workId: a.taskId, gate: String(a.gate) })),
    ...(args.blockers === undefined
      ? {}
      : {
          blockers: openBlockers(
            readBlockers(args.blockers),
            args.actions === undefined ? [] : readActions(args.actions),
          ),
        }),
    ...(memoryStore === undefined ? {} : { memories: memoryStore.load() }),
  });
  let mintedBlockIds = 0;

  if (args.memory !== undefined || args.studyCmd !== undefined || hasMeetingDemand(demand)) {
    const store = memoryStore;
    const study: Study | undefined =
      args.studyCmd === undefined
        ? undefined
        : (proposal) => {
            // The proposal goes in on STDIN as JSON and what was learned comes back on STDOUT.
            // Same contract as the reviser, and for the same reason: nothing an agent wrote ends
            // up on a command line.
            const run = spawnSync(args.studyCmd as string, [...args.studyArgs], {
              cwd: process.cwd(),
              encoding: "utf-8",
              input: JSON.stringify(proposal),
              timeout: 60_000,
              shell: false,
            });
            if (run.error !== undefined) return { ok: false, reason: run.error.message };
            if (run.status !== 0) {
              return { ok: false, reason: `exited ${String(run.status)}: ${(run.stderr ?? "").trim().slice(0, 200)}` };
            }
            return { ok: true, found: String(run.stdout ?? "").trim() };
          };

    // The proposal goes in on STDIN as JSON and what came out comes back on STDOUT — the same
    // contract as the studier and the reviser, and for the same reason: nothing an agent wrote
    // ends up on a command line.
    const hold: HoldMeeting | undefined =
      args.meetingCmd === undefined
        ? undefined
        : (proposal) => {
            const run = spawnSync(args.meetingCmd as string, [...args.meetingArgs], {
              cwd: process.cwd(),
              encoding: "utf-8",
              input: JSON.stringify(proposal),
              timeout: 60_000,
              shell: false,
            });
            if (run.error !== undefined) return { ok: false, reason: run.error.message };
            if (run.status !== 0) {
              return { ok: false, reason: `exited ${String(run.status)}: ${(run.stderr ?? "").trim().slice(0, 200)}` };
            }
            // An EMPTY stdout is a successful call that produced nothing, which is different from a
            // failed call — and the difference survives into the log.
            return { ok: true, produced: String(run.stdout ?? "").trim() };
          };

    const studyHistory = foldCalendar(priorEvents);
    const tick = await lifeTick({
      chart,
      cascade: report.cascade,
      calendar: report.calendar,
      nowMs,
      // ── STUDY IS BOUNDED, AND THIS IS WHERE THE BOUND IS APPLIED ───────────
      // `study-session.ts` defines a real allowance — two hours a rolling day, sessions of at most
      // one, none shorter than fifteen minutes — and `mayStudy` is optional at every layer that
      // forwards it. Nobody supplied it: `remainingStudy` and `hatsWithStudyLeft` had no callers
      // outside their own module, so the budget was never consulted and study was unbounded. A run
      // put sixty of a hundred and twenty hats into study blocks with nothing stopping them.
      //
      // Measured against the CALENDAR, which already holds the blocks this run and prior runs
      // booked — so the allowance is spent by what was actually scheduled, not by a counter that
      // could disagree with the diary.
      //
      // MEASURED AGAINST THE **FOLDED** CALENDAR, NOT `report.calendar`. The cycle's calendar starts
      // at `EMPTY_CALENDAR` and is rebuilt from scratch every run, so it holds only the blocks this
      // cycle planned — and the study blocks are booked by `lifeTick` itself, after this point. A
      // budget read off it would see zero spent, forever: five consecutive runs against one store
      // all reported `62 studying`, which is what a rolling allowance looks like when nothing can
      // ever spend it. `foldCalendar` replays the log's `block_planned` facts, so the twenty-four
      // hour window is measured against what the organization actually booked.
      mayStudy: (hatId: string) =>
        remainingStudy(studyHistory, hatId, nowMs) >= DEFAULT_STUDY_BUDGET.minSessionMs,
      // Which hats are worn is a fold of the LOG, not a field on this run's report: donning
      // survives across runs, so asking this run alone would forget what the last one put on.
      worn: [...foldHatsWorn(priorEvents)],
      // WHAT HAS ALREADY LANDED, read from the log for the same reason `worn` is: it is a fact
      // about history, and this run has none of its own. Only supplied when there IS a store —
      // without one the honest answer is "not measured", and the runtime treats that as "do not
      // judge" rather than as "nothing has landed".
      ...(args.store === undefined ? {} : { alreadyLanded: new Set(foldLandedChanges(priorEvents).keys()) }),
      ...(args.store === undefined ? {} : { alreadyHandedOff: new Set(foldHandedOffChanges(priorEvents).keys()) }),
      ...(args.store === undefined ? {} : { priorGateEvaluations: foldOrganization(priorEvents).gateEvaluations }),
      ...(store === undefined ? {} : { store }),
      ...(study === undefined ? {} : { study }),
      // Rotates what each hat studies between runs, so it does not read one thing forever.
      cycle: args.store === undefined ? 0 : deliveryRate(args.store).runs,
      departmentOf: (hatId: string) => departmentOf(chart, hatId),
      meetings: demand,
      ...(hold === undefined ? {} : { hold }),
      // Read from the LOG, not carried in memory: a run is a separate process, so "who was asleep
      // last time" has to survive one ending. Without it nothing could ever be reported as waking,
      // and sleep would be a state with no exit anybody could see.
      ...(previousPresence.length === 0 ? {} : { previousPresence }),
      // Derived from the run's own instant, never a random: two runs at the same instant must mint
      // the same block ids, or re-storing a run would book the same meeting twice under new legs.
      createId: (prefix) => {
        mintedBlockIds += 1;
        return `${prefix}-life-${String(nowMs)}-${String(mintedBlockIds)}`;
      },
    });
    lifeFacts = [...lifePreFacts, ...tick.facts];
    lifeEvents = lifeFacts.map((fact, i) =>
      // Keyed by the run's instant and the fact's index, so re-running the same instant re-stores
      // the same shards — an upsert, exactly like the observe-act ticks above.
      emit(chart, `evt-life-${String(nowMs)}-${String(i + 1)}`, {
        kind: OrgEventKind.DecisionRecorded,
        subjectId: subjectOfLifeFact(fact),
        decision: describeLifeFact(fact),
        atMs: nowMs,
        fact,
      }),
    );

    console.log("\n--- the rest of the day ---");
    console.log(`  ${lifeSummary(tick)}`);
    for (const m of tick.met) {
      console.log(`  met: ${m.attendeeHatIds.join(" + ")} — ${m.about}`);
      console.log(`       must produce: ${m.mustProduce}`);
    }
    // Printed as loudly as the booked ones. The organisation still has the reason; it just has no
    // hour, and a calendar too full to answer its own problems is the thing worth seeing.
    for (const u of tick.unmet) console.log(`  NOT met: ${u.meetingId} — ${u.reason}`);
    for (const o of tick.meetingOutcomes) {
      console.log(
        o.produced === ""
          ? `  produced NOTHING: ${o.meetingId} — ${o.reason ?? "no reason given"}`
          : `  produced: ${o.meetingId} — ${o.produced.split("\n")[0] ?? ""}`,
      );
    }
    if (tick.woke.length > 0) {
      console.log(`  woke: ${tick.woke.join(", ")} — work arrived that needs their authority`);
    }
    for (const s2 of tick.studied) {
      console.log(
        `  ${s2.hatId}: ${s2.subject}${s2.wrote ? " → wrote it down" : ` → nothing (${s2.reason ?? "?"})`}`,
      );
    }
    if (store !== undefined) {
      const held = store.load();
      const live = held.filter((m) => m.state.phase !== "archived");
      console.log(`  memory: ${String(live.length)} live, ${String(held.length - live.length)} forgotten, under ${store.root}`);
    }
  } else if (lifePreFacts.length > 0) {
    // The calibrations still have to reach the log. Without this branch a run with a memory store
    // but no study command would write the memories to disk and record nothing about having done
    // so — the store and the log would disagree, and the log is what a resumed run reads.
    lifeFacts = lifePreFacts;
  }

  if (lifeEvents.length === 0 && lifeFacts.length > 0) {
    lifeEvents = lifeFacts.map((fact, i) =>
      emit(chart, `evt-life-${String(nowMs)}-${String(i + 1)}`, {
        kind: OrgEventKind.DecisionRecorded,
        subjectId: subjectOfLifeFact(fact),
        decision: describeLifeFact(fact),
        atMs: nowMs,
        fact,
      }),
    );
  }

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
        // What happened outside the pipeline is part of the run's history too. Without the life
        // events the log would show an organization that only exists while it is being asked for
        // something — which is the complaint this whole tick answers.
        trace: [...report.trace, ...tickEvents, ...lifeEvents],
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
    // The organization's model calls "every gate approved" Merged; a change handed to people instead
    // is printed as what it is.
    console.log(`  ${describeChangeLine(
      { workId: c.workId, state: c.projection.state.tag, applied: c.projection.applied.map((a) => a.tag) },
      awaitingReview,
    )}`);
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
  // THE WIKI IS A PEER SOURCE TOO — read-only, like every source here. A company's requirements
  // live on it, and an organization that can read the ticket but not the page behind it is reading
  // the summary of a decision instead of the decision.
  if (args.confluenceAuthFile !== undefined) {
    sources.push(
      confluenceSource({
        credentialsPath: args.confluenceAuthFile,
        ...(args.confluenceSpaces.length === 0 ? {} : { spaceKeys: args.confluenceSpaces }),
        ...(args.confluenceCql === undefined ? {} : { cql: args.confluenceCql }),
        ...(args.confluenceLimit === undefined ? {} : { limit: args.confluenceLimit }),
      }),
    );
  }
  // The organization's own record joins the corpus as a PEER SOURCE, not as an edit to it.
  if (args.orgDocs !== undefined) {
    sources.push(directoryDataSource({ dir: args.orgDocs, name: "org-record" }));
  }
  return sources.length === 1 ? sources[0]! : unionOf(sources);
}

/** Whether a source was declared at all — `sourceFromArgs` is only meaningful when one was. */
export function hasSource(args: Args): boolean {
  return args.sourceRepos.length > 0 || args.orgDocs !== undefined || args.confluenceAuthFile !== undefined;
}
