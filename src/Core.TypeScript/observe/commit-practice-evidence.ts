/**
 * commit-practice-evidence.ts — the in-repo evidence adapter for `practice-claims.ts`.
 *
 * A practice claim is only admissible where *"did your own record contradict this"* is decidable without
 * anyone's judgement. This module supplies the one evidence stream that already exists in the repo and
 * meets that bar: **the commit record**. Everything here is a pure function of `git log` text — parse
 * and evaluate only, no `child_process`, no filesystem, no clock (§13 noninterference; the process
 * boundary lives in `self-claim-standing.ts`).
 *
 * ## Why the commit record is the right first stream
 *
 * 1. **The subject id is self-supplied.** `subjectOfCommit` reads the `Agent:` trailer — a value the
 *    author wrote about themselves at authoring time. Nothing here maps a committer email or a GitHub
 *    login onto a person: an unsigned commit simply has no subject and is evidence about nobody.
 * 2. **`phase` is a logical position, never a wall clock.** It is the commit's depth in first-parent
 *    order, so it is stable across runs and monotone under new commits
 *    (`local-time-never-enters-the-shared-fold`). A commit date never enters the fold. Note the honest
 *    limit: a history rewrite renumbers phases, which is the same exposure every git-derived ordering
 *    in this repo carries.
 * 3. **Every check below is a total function of one commit.** No check reads another commit, the
 *    working tree, CI results, or a review. Two runs over the same log produce the same verdicts (DST).
 *
 * ## `undetermined` covers "not exercised", and that is deliberately stricter than logic
 *
 * `tests-accompany-source` is an implication: *source changed ⇒ a test changed*. On a docs-only commit
 * the implication is **vacuously true**, and returning `holds` there would be logically defensible. It
 * returns `undetermined` instead, because a conformance count inflated by records that never exercised
 * the practice is the vacuity class in numeric form — a number that goes up when nothing was tested.
 * `undetermined` is counted neither for the subject nor against them, which is the correct treatment of
 * a record that says nothing.
 *
 * ## What is NOT in the registry, and why
 *
 * No check reads a diff for quality, a message for tone, or a path for ownership. Each of those needs a
 * judgement, and a judgement here would be the observer's standard entering through a predicate — the
 * thing `practice-claims.ts` property 1 exists to prevent. The registry is deliberately small and
 * boring: presence of a trailer block, shape of a subject line, a work-item id, a path pairing.
 *
 * A registry entry checks **nothing** until a subject binds it (`bindPractice`). This file is a menu.
 */

import type { CheckRegistry, PracticeCheck, PracticeEvidence, SubjectId } from "./practice-claims.js";

// ═══ The record ═════════════════════════════════════════════════════════════════════════════════════

/** One commit, parsed. Everything a check may look at, and nothing else. */
export interface CommitRecord {
  readonly sha: string;
  /** The first line of the message. */
  readonly subjectLine: string;
  /** Trailer key → value, from the contiguous trailer block at the bottom of the message. */
  readonly trailers: ReadonlyMap<string, string>;
  /** Whether the message had a body at all below the subject line. */
  readonly hasBody: boolean;
  /** Paths touched. Empty when the log was read without `--name-only`, or for a merge commit. */
  readonly paths: readonly string[];
}

/** Record separator emitted by the `git log --format` in `self-claim-standing.ts`. */
export const RECORD_SEP = "\u0001";
/** Field separator within one record. */
export const FIELD_SEP = "\u0002";

/**
 * The `git log` pretty-format this parser expects. Kept beside the parser so the two cannot drift.
 * `--first-parent` and `--name-only` are supplied by the caller; `%B` is the raw body.
 */
export const GIT_LOG_FORMAT = `${RECORD_SEP}%H${FIELD_SEP}%B${FIELD_SEP}`;

/**
 * Parse a trailer block: the trailing run of `Key: value` lines at the bottom of the message.
 *
 * Walks upward from the last non-empty line and stops at the first line that is not a trailer, which is
 * what makes the block *contiguous at the bottom* rather than "a matching line anywhere". A `Key:` line
 * in the middle of a body is therefore not a trailer, and that is the point.
 */
export function parseTrailers(body: string): ReadonlyMap<string, string> {
  const lines = body.split("\n");
  while (lines.length > 0 && (lines[lines.length - 1] ?? "").trim() === "") lines.pop();
  const out = new Map<string, string>();
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i] ?? "";
    const match = /^([A-Za-z][A-Za-z0-9-]*): ?(.*)$/.exec(line);
    if (match === null) break;
    const key = match[1] ?? "";
    const value = match[2] ?? "";
    if (!out.has(key)) out.set(key, value); // nearest-to-bottom wins; repeated keys keep the last
  }
  return out;
}

/** Parse the raw `git log` output. Pure: same text ⇒ same records, in the same order. */
export function parseCommitLog(raw: string): readonly CommitRecord[] {
  const chunks = raw.split(RECORD_SEP).filter((c) => c.length > 0);
  const out: CommitRecord[] = [];
  for (const chunk of chunks) {
    const parts = chunk.split(FIELD_SEP);
    const sha = (parts[0] ?? "").trim();
    if (sha === "") continue;
    const body = parts[1] ?? "";
    const tail = parts.slice(2).join(FIELD_SEP);
    const paths = tail
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const lines = body.split("\n");
    const subjectLine = (lines[0] ?? "").trim();
    const hasBody = lines.slice(1).some((l) => l.trim() !== "");
    out.push({ sha, subjectLine, trailers: parseTrailers(body), hasBody, paths });
  }  return out;
}

/**
 * The subject a commit is evidence about: the `Agent:` trailer, **as the author wrote it**.
 *
 * `undefined` for a commit with no such trailer — evidence about nobody. Deliberately no fallback to the
 * committer identity: attributing a record to a person who never claimed it is the assignment this whole
 * surface refuses.
 */
export function subjectOfCommit(record: CommitRecord): SubjectId | undefined {
  const agent = record.trailers.get("Agent");
  if (agent === undefined) return undefined;
  const trimmed = agent.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Turn parsed commits into evidence.
 *
 * `records` must be newest-first (git's default order). `headPhase` is the first-parent depth of the
 * newest commit, so phase is a repo-stable logical position: the same commit gets the same phase on
 * every run, and later commits get larger phases.
 *
 * Commits with no `Agent:` trailer are dropped — not attributed to a default subject.
 */
export function toEvidence(
  records: readonly CommitRecord[],
  headPhase: number,
): readonly PracticeEvidence<CommitRecord>[] {
  const out: PracticeEvidence<CommitRecord>[] = [];
  records.forEach((record, index) => {
    const subject = subjectOfCommit(record);
    if (subject === undefined) return;
    out.push({ subject, evidenceId: record.sha, phase: headPhase - index, record });
  });
  return out;
}

// ═══ The checks — a menu, inert until bound ═════════════════════════════════════════════════════════

/** The ten AgencySignature v1 fields. A block missing any one of them is not the block. */
export const AGENCY_SIGNATURE_FIELDS: readonly string[] = [
  "Agency-Signature-Version",
  "Agent",
  "Agent-Runtime",
  "Agent-Model",
  "Credential-Identity",
  "Credential-Mode",
  "Human-Review",
  "Human-Review-Evidence",
  "Action-Mode",
  "Task",
];

/**
 * A ZetaId: 26 Crockford base32 symbols (I, L, O, U excluded).
 *
 * Deliberately the same shape as `hygiene/agencysignature-block.ts`'s `ZETA_ID` rather than a stricter
 * one of this file's own. An earlier draft here pinned the leading `081`, which is the ULID *timestamp*
 * prefix of ids minted in this era — it would have started calling honest future commits counterexamples
 * for no reason other than the calendar. A check that decays into a false accusation is worse than no
 * check, and on this surface it accuses a person.
 */
const ZETA_ID = /\b\d[\dA-HJKMNP-TV-Z]{25}\b/;

/** `type(scope): description`, optionally `!` for a breaking change. */
const CONVENTIONAL_SUBJECT = /^[a-z][a-z0-9-]*(\([^)]*\))?!?: \S/;

const TEST_PATH = /(\.test\.|\.spec\.|(^|\/)tests?\/|Tests?\.[A-Za-z]+\/)/;
const SOURCE_EXT = /\.(ts|tsx|js|mjs|cjs|fs|fsx|cs|rs|go|py|zig|c|h|cpp|lean)$/;

function isTestPath(path: string): boolean {
  return TEST_PATH.test(path);
}

function isSourcePath(path: string): boolean {
  return SOURCE_EXT.test(path) && !isTestPath(path);
}

/**
 * "Every commit I author carries the full AgencySignature v1 block."
 *
 * `undetermined` for a commit with no body at all: there is nowhere for a trailer block to be, and a
 * bodiless commit is more plausibly a different kind of artifact than a broken promise.
 */
export const agencySignatureComplete: PracticeCheck<CommitRecord> = {
  checkId: "agency-signature-complete",
  question: "Does this commit carry all ten AgencySignature v1 fields as trailers?",
  evaluate: (record) => {
    if (!record.hasBody) return "undetermined";
    return AGENCY_SIGNATURE_FIELDS.every((f) => record.trailers.has(f)) ? "holds" : "does-not-hold";
  },
};

/**
 * "Every commit I author names the work item it belongs to."
 *
 * Reads the `Task:` trailer only. `undetermined` when there is no signature block: this claim is about
 * what the block says, and a commit without one is a different question (the check above).
 */
export const workItemNamed: PracticeCheck<CommitRecord> = {
  checkId: "work-item-named",
  question: "Does this commit's Task trailer name a ZetaId work item?",
  evaluate: (record) => {
    const task = record.trailers.get("Task");
    if (task === undefined) return "undetermined";
    return ZETA_ID.test(task) ? "holds" : "does-not-hold";
  },
};

/** "Every commit I author has a conventional-commit subject line." */
export const conventionalSubject: PracticeCheck<CommitRecord> = {
  checkId: "conventional-commit-subject",
  question: "Is this commit's subject line `type(scope): description`?",
  evaluate: (record) => {
    if (record.subjectLine === "") return "undetermined";
    return CONVENTIONAL_SUBJECT.test(record.subjectLine) ? "holds" : "does-not-hold";
  },
};

/**
 * "When I change source, I change tests in the same commit."
 *
 * `undetermined` when no paths were read, and — see the header — also when the commit touched no source
 * at all. The practice was not exercised, so the record is evidence neither way.
 */
export const testsAccompanySource: PracticeCheck<CommitRecord> = {
  checkId: "tests-accompany-source",
  question: "Where this commit changed source, did it also change a test?",
  evaluate: (record) => {
    if (record.paths.length === 0) return "undetermined";
    if (!record.paths.some(isSourcePath)) return "undetermined"; // practice not exercised
    return record.paths.some(isTestPath) ? "holds" : "does-not-hold";
  },
};

/**
 * The menu. Binding one of these is the subject's act; listing it here checks nothing about anybody.
 *
 * Order is the declaration order and carries no ranking.
 */
export const COMMIT_CHECKS: CheckRegistry<CommitRecord> = {
  checks: [agencySignatureComplete, workItemNamed, conventionalSubject, testsAccompanySource],
};
