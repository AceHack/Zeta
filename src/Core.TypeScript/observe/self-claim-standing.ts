#!/usr/bin/env bun
/**
 * self-claim-standing.ts — the consumer. Reads real commit evidence and shows a subject their own
 * standing claims back to them.
 *
 * ## Why this file exists: a computed signal nothing reads is the vacuity class
 *
 * `self-claims.ts` computes a reliability score whose three intended consumers are, as measured on
 * 2026-08-18, all unbuilt or forbidden (see that file's header). A detector nobody consults looks like
 * a working mechanism and constrains nothing — the same failure as a test that cannot fail. This is the
 * smallest **real** consumer for the widened surface: it reads bindings that a subject actually
 * authored, evidence that actually exists in this repo's history, and it prints something whose content
 * changes with both.
 *
 * ## It is ADVISORY BY CONSTRUCTION, and that is a design constraint rather than a shortcut
 *
 * **This process always exits 0 on a successful read.** A non-zero exit would make self-claim drift a
 * build failure, and a build failure is a sanction — the one thing this surface must never become.
 * Aaron's frame is *"detect self claim drift and **help repair**"*, and his correction on what repair
 * feels like from the inside is that people do not experience *repair*, they experience **expansion of
 * choice**. So what this consumer does with the observation is widen the menu, and the widening is the
 * behaviour change: `offeredPracticeMoveKinds` returns strictly more moves once the record shows
 * repetition, and this program prints them.
 *
 * For the same reason this deliberately does **not** publish into `hygiene/drift-ledger.ts`. That
 * ledger carries an MTTH SLO and healing pressure; routing a person's account of themselves into it
 * would convert *"your own record disagrees with your own claim"* into a hygiene finding with a clock
 * on it. Different kind of drift, different consequences, kept apart on purpose.
 *
 * ## Structure (noninterference §13)
 *
 * All process boundaries are here: `git log`, `git rev-list`, and one JSON read. Everything downstream
 * (`commit-practice-evidence.ts`, `practice-claims.ts`) is a pure function of the text they produce, so
 * the fold replays deterministically from a captured log (DST) and no clock, network, or working-tree
 * state enters the result.
 *
 * ## Usage
 *
 *   bun src/Core.TypeScript/observe/self-claim-standing.ts [--subject <id>] [--max-count N]
 *                                                          [--bindings <path>] [--repo <path>] [--json]
 *
 * With no `--subject`, every subject that has bound something is reported. A subject with no bindings
 * is never reported on, whatever their commits contain — that is property 1, visible at the surface.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  COMMIT_CHECKS,
  GIT_LOG_FORMAT,
  parseCommitLog,
  toEvidence,
  type CommitRecord,
} from "./commit-practice-evidence.js";
import {
  EMPTY_PRACTICE_LEDGER,
  acknowledgeException,
  bindPractice,
  findCheck,
  observePractice,
  offeredPracticeMoveKinds,
  practiceReadingGloss,
  releasePractice,
  supersedePractice,
  type Counterexample,
  type PatternReading,
  type PracticeBinding,
  type PracticeEvidence,
  type PracticeException,
  type PracticeLedger,
  type PracticeRefusal,
  type PracticeRelease,
  type PracticeReport,
  type PracticeSupersession,
  type SubjectId,
} from "./practice-claims.js";

/** Where a subject's own bindings live, relative to the repo root. */
export const DEFAULT_BINDINGS_PATH = join("db", "self-claims", "practice-bindings.json");

/** Ordinal comparison. Never `localeCompare`. */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ═══ Bindings file ══════════════════════════════════════════════════════════════════════════════════

/**
 * The on-disk shape: the whole ledger, not only the bindings.
 *
 * Every entry is applied with `actor = entry.subject`, because the file **is** the subjects' own
 * declarations — there is no field here through which one subject writes about another, and the
 * `not-your-claim` refusal still guards the API for callers that are not this file.
 *
 * The repair lists are present so that the moves `offeredPracticeMoveKinds` names are moves a subject
 * can actually make: a menu whose entries nothing can apply would be its own vacuity.
 */
export interface BindingsFile {
  readonly bindings: readonly PracticeBinding[];
  /** "I no longer claim this." */
  readonly releases?: readonly PracticeRelease[];
  /** "I claim this differently now" — `replacementId` must name a binding declared above. */
  readonly supersessions?: readonly PracticeSupersession[];
  /** "I saw that record and I am keeping the claim." */
  readonly exceptions?: readonly PracticeException[];
}

/** One rejected entry, with the entry itself so the subject can see what was not applied. */
export interface RefusedEntry {
  readonly what: string;
  readonly refusal: PracticeRefusal;
}

export interface LoadedBindings {
  readonly ledger: PracticeLedger;
  /** Entries the ledger refused, with the reason. Surfaced, never silently dropped. */
  readonly refusals: readonly RefusedEntry[];
}

/**
 * Fold a declarations file into a ledger. Pure — takes the parsed value, not a path.
 *
 * Refusals are collected rather than thrown: a binding to a check this build cannot evaluate is a fact
 * worth showing the subject, and it is exactly the `unknown-check` falsifier doing its job. Every write
 * goes through the guarded functions, so the file cannot reach a state the API forbids.
 */
export function loadBindings(file: BindingsFile): LoadedBindings {
  let ledger = EMPTY_PRACTICE_LEDGER;
  const refusals: RefusedEntry[] = [];
  const apply = (what: string, result: ReturnType<typeof bindPractice>): void => {
    if (result.ok) ledger = result.ledger;
    else refusals.push({ what, refusal: result.refusal });
  };

  for (const binding of file.bindings) {
    apply(`binding ${binding.practiceId} (${binding.subject})`, bindPractice(ledger, COMMIT_CHECKS, binding.subject, binding));
  }
  for (const supersession of file.supersessions ?? []) {
    const replacement = file.bindings.find(
      (b) => b.subject === supersession.subject && b.practiceId === supersession.replacementId,
    );
    const what = `supersession ${supersession.supersededId} → ${supersession.replacementId} (${supersession.subject})`;
    if (replacement === undefined) {
      refusals.push({
        what,
        refusal: { kind: "unknown-practice", subject: supersession.subject, practiceId: supersession.replacementId },
      });
      continue;
    }
    apply(
      what,
      supersedePractice(
        ledger,
        COMMIT_CHECKS,
        supersession.subject,
        supersession.subject,
        supersession.supersededId,
        replacement,
        supersession.at,
      ),
    );
  }
  for (const release of file.releases ?? []) {
    apply(`release ${release.practiceId} (${release.subject})`, releasePractice(ledger, release.subject, release));
  }
  for (const exception of file.exceptions ?? []) {
    apply(
      `exception ${exception.practiceId}/${exception.evidenceId} (${exception.subject})`,
      acknowledgeException(ledger, exception.subject, exception),
    );
  }
  return { ledger, refusals };
}

// ═══ Rendering ══════════════════════════════════════════════════════════════════════════════════════

function shortSha(sha: string): string {
  return sha.slice(0, 10);
}

/**
 * The subject's own claim, their own record, and what they may do — in that order and nothing else.
 *
 * No verdict line, no score, no ratio. The counts are printed because they are the denominators the
 * subject needs to judge their own record; the judging is theirs.
 */
function renderStanding(standing: PracticeReport<CommitRecord>["standings"][number]): readonly string[] {
  const check = findCheck(COMMIT_CHECKS, standing.binding.checkId);
  return [
    "",
    `  claim "${standing.binding.text}"`,
    `    check: ${standing.binding.checkId}${check === undefined ? " (not evaluable here)" : ""}`,
    `    in the window it applies to — held: ${String(standing.conforming)}` +
      `, did not hold: ${String(standing.counterexamples)}` +
      `, unsettled: ${String(standing.undetermined)}`,
    `    records that predate the claim, not examined: ${String(standing.precedingBinding)}`,
  ];
}

function renderCounterexample(c: Counterexample<CommitRecord>, indent: string): readonly string[] {
  return [
    `${indent}${shortSha(c.evidence.record.sha)}  ${c.evidence.record.subjectLine}`,
    `${indent}  against your claim: "${c.binding.text}"`,
  ];
}

/** The readings, always in full — "this is the whole list" is a claim the rendering has to honour. */
function renderReadings(readings: readonly PatternReading[]): readonly string[] {
  return [
    "  What that may mean — and this is the whole list:",
    ...readings.map((reading) => `    · ${reading}: ${practiceReadingGloss(reading)}`),
  ];
}

function renderObservation(observation: PracticeReport<CommitRecord>["observation"]): readonly string[] {
  switch (observation.kind) {
    case "no-counterexample":
      return ["  Your own record does not contradict anything you claimed."];
    case "counterexample":
      return [
        "  One of your records does not match one of your claims:",
        ...renderCounterexample(observation.counterexample, "    "),
        ...renderReadings(observation.readings),
      ];
    default:
      return [
        `  ${String(observation.counterexamples.length)} of your records do not match your claims:`,
        ...observation.counterexamples.flatMap((c) => renderCounterexample(c, "    ")),
        ...renderReadings(observation.readings),
      ];
  }
}

export function renderReport(report: PracticeReport<CommitRecord>): string {
  const lines: string[] = [
    `subject: ${report.subject}`,
    `  commits examined (yours only): ${String(report.evidenceVolume)}`,
    ...report.standings.flatMap(renderStanding),
    "",
    ...renderObservation(report.observation),
  ];

  const { observation } = report;
  if (report.held.length > 0) {
    lines.push(`  Seen and kept by you: ${String(report.held.length)} (no longer unresolved).`);
  }

  const moves = offeredPracticeMoveKinds(observation);
  if (moves.length > 0) {
    lines.push("  Yours to do, all optional, none expiring:");
    for (const move of moves) lines.push(`    · ${move}`);
    lines.push("  Doing nothing is also a permitted outcome.");
  }
  return lines.join("\n");
}

// ═══ Edge — the only I/O in the pipeline ════════════════════════════════════════════════════════════

function git(repo: string, args: readonly string[]): string {
  // sonarjs/no-os-command-from-path suppression rationale: this is a developer-run CLI that reads the
  // repo it is pointed at; resolving git through PATH is the only portable option across the fleet
  // machines and CI images, and no argument here is attacker-supplied (they are literals plus a path
  // the operator passed).
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

/** First-parent depth of HEAD: the phase of the newest commit. Stable, and not a clock. */
export function headPhaseOf(repo: string): number {
  const raw = git(repo, ["rev-list", "--count", "--first-parent", "HEAD"]).trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`could not read first-parent depth: ${raw}`);
  return n;
}

export function readCommitLog(repo: string, maxCount: number): string {
  return git(repo, [
    "log",
    "--first-parent",
    `--max-count=${String(maxCount)}`,
    `--format=${GIT_LOG_FORMAT}`,
    "--name-only",
  ]);
}

interface Options {
  readonly repo: string;
  readonly maxCount: number;
  readonly bindingsPath: string;
  readonly subject: SubjectId | undefined;
  readonly json: boolean;
}

/** Argument parsing. An unrecognised flag is refused before any read. */
export function parseArgs(argv: readonly string[], cwd: string): Options {
  let repo = cwd;
  let maxCount = 400;
  let bindingsPath: string | undefined;
  let subject: SubjectId | undefined;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    const next = argv[i + 1];
    if (arg === "--repo" && next !== undefined) { repo = next; i += 1; }
    else if (arg === "--max-count" && next !== undefined) { maxCount = Number.parseInt(next, 10); i += 1; }
    else if (arg === "--bindings" && next !== undefined) { bindingsPath = next; i += 1; }
    else if (arg === "--subject" && next !== undefined) { subject = next; i += 1; }
    else if (arg === "--json") json = true;
    else throw new Error(`unrecognised argument: ${arg}`);
  }
  if (!Number.isFinite(maxCount) || maxCount <= 0) throw new Error("--max-count must be a positive integer");
  return { repo, maxCount, bindingsPath: bindingsPath ?? join(repo, DEFAULT_BINDINGS_PATH), subject, json };
}

/**
 * Who gets reported on.
 *
 * With no `--subject`, exactly the subjects who bound something — **never** everyone who appears in the
 * log. That is property 1 at the surface: a subject who never claimed anything is not a row with zero
 * findings, they are absent, because there is nothing about them to report.
 *
 * An explicit `--subject` is honoured even with no bindings, and then reports nothing found; asking
 * about yourself and being told "you have claimed nothing" is a real answer.
 */
export function selectSubjects(ledger: PracticeLedger, subject: SubjectId | undefined): readonly SubjectId[] {
  if (subject !== undefined) return [subject];
  return [...new Set(ledger.bindings.map((b) => b.subject))].sort(ordinal);
}

/**
 * The whole textual output, as a pure function of what was read. Extracted from `main` so the output
 * is testable: a mutation sweep (2026-08-18) showed the empty-subject branch survived every mutant
 * precisely because it lived inside the I/O shell, where nothing could see it.
 */
export function renderRun(
  loaded: LoadedBindings,
  evidence: readonly PracticeEvidence<CommitRecord>[],
  subject: SubjectId | undefined,
  json: boolean,
): string {
  const lines = loaded.refusals.map(({ what, refusal }) => `refused ${what}: ${refusal.kind} — not applied.`);
  const subjects = selectSubjects(loaded.ledger, subject);
  if (subjects.length === 0) {
    return [...lines, "No subject has bound a practice. Nothing is checked."].join("\n");
  }
  const reports = subjects.map((s) => observePractice(loaded.ledger, COMMIT_CHECKS, s, evidence));
  if (json) return [...lines, JSON.stringify({ reports }, null, 2)].join("\n");
  return [...lines, reports.map(renderReport).join("\n\n")].join("\n");
}

function main(): void {
  const options = parseArgs(process.argv.slice(2), process.cwd());

  if (!existsSync(options.bindingsPath)) {
    process.stdout.write(
      `No bindings file at ${options.bindingsPath}.\n` +
        "Nobody has claimed anything, so there is nothing to check. That is the default state.\n",
    );
    return;
  }

  const parsed = JSON.parse(readFileSync(options.bindingsPath, "utf8")) as BindingsFile;
  const loaded = loadBindings(parsed);
  const records = parseCommitLog(readCommitLog(options.repo, options.maxCount));
  const evidence = toEvidence(records, headPhaseOf(options.repo));
  process.stdout.write(`${renderRun(loaded, evidence, options.subject, options.json)}\n`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    // A usage or read error is a real failure and exits non-zero. A *finding* never does.
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
