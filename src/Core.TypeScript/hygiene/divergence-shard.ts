// divergence-shard.ts — writer for substrate-divergence shard files.
//
// Implements the tooling glue for 081KR7JY10008QG0R000MH7PJT (PR-review disagreement-
// preservation protocol, dual-loop AC #2). Given two loops' conclusions on
// the same substrate-class commitment (e.g. a PR-review thread), this module
// produces a divergence shard conforming to the schema landed in 081KQJZR90008QG0R002GJAJ19 AC #4
// (docs/hygiene-history/divergences/README.md, PR #2475) and writes it to the
// canonical path under the fail-closed-OR-idempotent rule.
//
// This is the UNBLOCKED slice of 081KR7JY10008QG0R000MH7PJT: building + filing a shard given two
// conclusions needs no concurrent-loop harness, so it is fully testable in
// isolation. The end-to-end protocol (detecting that two loops reviewed the
// same thread; morning reconciliation) remains the blocked impl child pending
// 081KQJZR90008QG0R000FTJ1TC.
//
// Pure functions (no I/O): shortContentHash, divergenceShardRelPath,
//   buildDivergenceShard.
// I/O function: writeDivergenceShard (delegates the 3-way decision to
//   writeShardAtPath, exported for direct testing).
//
// Schema source of truth: docs/hygiene-history/divergences/README.md

import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import {
  RECONCILIATION_DECISIONS,
  type ReconciliationDecision,
  reconciliationBody,
  stripHtmlComments,
} from "./divergence-reconcile.ts";

// Re-export the canonical reconciliation vocabulary so existing importers of
// divergence-shard (the test suite, downstream callers) keep a stable surface.
// Single-sourced in divergence-reconcile.ts to stop the two modules drifting on
// order/value/doc -- the read half here and the fill half there now share one
// definition of the four decisions (Copilot PR #6130).
export { RECONCILIATION_DECISIONS, type ReconciliationDecision };

/** A single loop's identity for attribution in the shard frontmatter. */
export interface LoopIdentity {
  /** Named agent identifier, e.g. "otto", "codex-loop", "vera". */
  readonly agent: string;
  /** Model ID string, e.g. "claude-opus-4-8", "gpt-5.5". */
  readonly model: string;
  /** Harness name, e.g. "claude-code", "codex". */
  readonly harness: string;
}

/** One loop's perspective: who said it + the full framing of the position. */
export interface LoopPerspective {
  readonly identity: LoopIdentity;
  /** Full framing of the position (the body of the perspective section). */
  readonly body: string;
}

/** Everything needed to build a divergence shard. */
export interface DivergenceInput {
  /** ISO 8601 UTC, seconds precision, e.g. "2026-05-10T11:48:00Z". */
  readonly tick: string;
  readonly loopA: LoopPerspective;
  readonly loopB: LoopPerspective;
  /** The substrate path or topic in conflict (e.g. "PR #4147 thread <id>"). */
  readonly topic: string;
  /** One-paragraph neutral summary for morning reconciliation. */
  readonly disagreementSummary: string;
  /** operative-authorization frontmatter value (verbatim quote). */
  readonly operativeAuthorization: string;
}

/** One loop's conclusion about a single GitHub PR review thread. */
export interface ReviewThreadObservation {
  readonly identity: LoopIdentity;
  readonly prNumber: number;
  readonly threadId: string;
  /** Machine-comparable conclusion, e.g. "resolve" or "needs-fix". */
  readonly conclusion: string;
  /** Human-readable evidence/framing for this conclusion. */
  readonly body: string;
}

/** Inputs for detecting whether two loop observations require a shard. */
export interface ReviewThreadDisagreementInput {
  /** ISO 8601 UTC, seconds precision, forwarded to the divergence shard. */
  readonly tick: string;
  readonly loopA: ReviewThreadObservation;
  readonly loopB: ReviewThreadObservation;
  /** operative-authorization frontmatter value for filed divergence shards. */
  readonly operativeAuthorization: string;
}

export type ReviewThreadNoDisagreementReason = "different-thread" | "same-conclusion";

export type ReviewThreadDisagreementResult =
  | {
      readonly kind: "no-disagreement";
      readonly reason: ReviewThreadNoDisagreementReason;
    }
  | {
      readonly kind: "disagreement";
      readonly divergenceInput: DivergenceInput;
    };

/** Outcome of a write attempt. */
export type WriteStatus =
  | "written" // new file created
  | "idempotent-noop" // identical content already at path; left as-is
  | "collision-resolved"; // differing content at path; wrote to unique suffix

export interface WriteResult {
  /** Repo-relative path the shard was (or would have been) written to. */
  readonly relPath: string;
  readonly status: WriteStatus;
}

/**
 * Outcome of detecting two loops' review-thread conclusions and, on a genuine
 * disagreement, filing the divergence shard. "filed" carries the WriteResult
 * (path + written/idempotent/collision status) plus the DivergenceInput that
 * produced it; "no-disagreement" carries the reason and means no shard was
 * written.
 */
export type ReviewThreadShardOutcome =
  | {
      readonly kind: "no-disagreement";
      readonly reason: ReviewThreadNoDisagreementReason;
    }
  | {
      readonly kind: "filed";
      readonly write: WriteResult;
      readonly divergenceInput: DivergenceInput;
    };

const TICK_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
const DIVERGENCE_ROOT = "docs/hygiene-history/divergences";

/**
 * 8 hex chars from sha256(loopABody + loopBBody) per the README naming rule.
 * Content-addressing: identical bodies → identical hash → identical path
 * (enables the idempotent re-write case).
 */
export function shortContentHash(loopABody: string, loopBBody: string): string {
  return createHash("sha256")
    .update(loopABody + loopBBody)
    .digest("hex")
    .slice(0, 8);
}

/**
 * Canonical repo-relative shard path:
 *   docs/hygiene-history/divergences/YYYY/MM/DD/HHMMSSZ-<short-content-hash>.md
 *
 * Parses `tick` by regex (TZ-free, DST-deterministic — the value is already
 * UTC). Throws on a tick that is not ISO 8601 UTC seconds precision.
 */
export function divergenceShardRelPath(tick: string, loopABody: string, loopBBody: string): string {
  const m = TICK_RE.exec(tick);
  if (!m) {
    throw new Error(`invalid tick "${tick}": expected ISO 8601 UTC seconds precision, e.g. 2026-05-10T11:48:00Z`);
  }
  const [, yyyy, mm, dd, hh, min, ss] = m;
  const hash = shortContentHash(loopABody, loopBBody);
  return `${DIVERGENCE_ROOT}/${yyyy}/${mm}/${dd}/${hh}${min}${ss}Z-${hash}.md`;
}

/** YAML double-quoted scalar (JSON escaping is a valid YAML subset). */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

function nonBlank(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} must be non-blank`);
  }
  return trimmed;
}

function normalizedConclusion(value: string): string {
  return nonBlank(value, "review conclusion").toLowerCase();
}

function perspectiveFromObservation(observation: ReviewThreadObservation): LoopPerspective {
  const conclusion = nonBlank(observation.conclusion, "review conclusion");
  return {
    identity: observation.identity,
    body: `Conclusion: ${conclusion}\n\n${nonBlank(observation.body, "review body")}`,
  };
}

/**
 * Detect whether two loop observations on a PR review thread disagree.
 *
 * This is the pure detector slice for 081KR7JY10008QG0R000MH7PJT: it does not talk to GitHub and
 * does not write a shard. Callers can hand the returned divergenceInput to
 * writeDivergenceShard once they have two observations from the same thread
 * whose machine-comparable conclusions differ.
 *
 * Validation is EAGER: every required string field (thread id, conclusion,
 * body) of both observations is checked non-blank up front, before the
 * no-disagreement branch decision and before any downstream I/O. Lazy
 * validation (body only on the disagreement path; conclusion only on the
 * same-thread path) silently accepted malformed observations as clean
 * no-disagreement outcomes -- e.g. a same-conclusion pair with a blank body,
 * or a different-thread pair with a blank conclusion (Copilot PR #6068
 * finding). A malformed observation must be rejected regardless of branch.
 */
export function detectReviewThreadDisagreement(input: ReviewThreadDisagreementInput): ReviewThreadDisagreementResult {
  const aThreadId = nonBlank(input.loopA.threadId, "loopA.threadId");
  const bThreadId = nonBlank(input.loopB.threadId, "loopB.threadId");
  nonBlank(input.loopA.conclusion, "loopA.conclusion");
  nonBlank(input.loopB.conclusion, "loopB.conclusion");
  nonBlank(input.loopA.body, "loopA.body");
  nonBlank(input.loopB.body, "loopB.body");

  if (input.loopA.prNumber !== input.loopB.prNumber || aThreadId !== bThreadId) {
    return { kind: "no-disagreement", reason: "different-thread" };
  }

  const aConclusion = normalizedConclusion(input.loopA.conclusion);
  const bConclusion = normalizedConclusion(input.loopB.conclusion);
  if (aConclusion === bConclusion) {
    return { kind: "no-disagreement", reason: "same-conclusion" };
  }

  return {
    kind: "disagreement",
    divergenceInput: {
      tick: input.tick,
      loopA: perspectiveFromObservation(input.loopA),
      loopB: perspectiveFromObservation(input.loopB),
      topic: `PR #${input.loopA.prNumber} thread ${aThreadId}`,
      disagreementSummary:
        `Both loops reviewed the same PR thread; ` +
        `${input.loopA.identity.agent} concluded ${aConclusion}, while ` +
        `${input.loopB.identity.agent} concluded ${bConclusion}.`,
      operativeAuthorization: input.operativeAuthorization,
    },
  };
}

/**
 * Build the full shard markdown (frontmatter + 4 required body sections) per
 * docs/hygiene-history/divergences/README.md. Pure: no I/O, no clock, no hash
 * of anything other than the explicit inputs.
 */
export function buildDivergenceShard(input: DivergenceInput): string {
  if (!TICK_RE.test(input.tick)) {
    throw new Error(`invalid tick "${input.tick}": expected ISO 8601 UTC seconds precision`);
  }
  const a = input.loopA;
  const b = input.loopB;
  const attrib = (p: LoopPerspective) => `${p.identity.agent} (${p.identity.model}, ${p.identity.harness})`;

  return `---
tick: ${yamlString(input.tick)}
type: divergence
loop-a:
  agent: ${a.identity.agent}
  model: ${yamlString(a.identity.model)}
  harness: ${a.identity.harness}
loop-b:
  agent: ${b.identity.agent}
  model: ${yamlString(b.identity.model)}
  harness: ${b.identity.harness}
topic: ${yamlString(input.topic)}
operative-authorization: ${yamlString(input.operativeAuthorization)}
---

## Loop A perspective

${attrib(a)}: ${a.body}

## Loop B perspective

${attrib(b)}: ${b.body}

## Disagreement summary

${input.disagreementSummary}

## Reconciliation

<!-- Leave blank until morning reconciliation. The human maintainer fills this in. -->
<!-- Options: accept-loop-a | accept-loop-b | accept-both (explicit divergence) | escalate -->
`;
}

/**
 * Write `content` to `absPath` under the fail-closed-OR-idempotent rule:
 *   - path free            → write it ("written")
 *   - exists, identical    → leave as-is ("idempotent-noop")
 *   - exists, differs      → never overwrite; write to the next free
 *                            "-N" suffix path ("collision-resolved")
 *
 * Returns the absolute path actually written (or left) and the status.
 * Exported for direct testing of the 3-way decision without manufacturing a
 * hash collision.
 */
export function writeShardAtPath(absPath: string, content: string): { absPath: string; status: WriteStatus } {
  // Atomic exclusive create ("wx" === O_CREAT | O_EXCL): create-if-absent is a
  // single kernel operation, so there is no existsSync->writeFileSync TOCTOU
  // window for a competing process to win, and it refuses to write through a
  // pre-planted symlink. The EEXIST throw IS the signal that the file already
  // exists -- exceptions-as-signals over a defensive pre-check (per
  // .claude/rules/force-push-with-lease-authorization-policy.md). Resolves the
  // CodeQL "file system race condition" + "insecure temporary file" findings.
  if (tryExclusiveWrite(absPath, content)) {
    return { absPath, status: "written" };
  }
  if (readFileSync(absPath, "utf8") === content) {
    return { absPath, status: "idempotent-noop" };
  }
  // Differing content at the target path: fail closed, never overwrite.
  // Choose the next free unique-suffix path.
  const dotMd = absPath.endsWith(".md") ? absPath.slice(0, -3) : absPath;
  for (let n = 2; ; n++) {
    const candidate = `${dotMd}-${n}.md`;
    if (tryExclusiveWrite(candidate, content)) {
      return { absPath: candidate, status: "collision-resolved" };
    }
    if (readFileSync(candidate, "utf8") === content) {
      return { absPath: candidate, status: "idempotent-noop" };
    }
  }
}

/**
 * Atomically create `absPath` with `content` using an exclusive write flag.
 * Returns true if this call created the file, false if it already existed.
 * Any error other than EEXIST is re-thrown (a genuine I/O failure, not a
 * "someone else has it" signal).
 */
function tryExclusiveWrite(absPath: string, content: string): boolean {
  mkdirSync(dirname(absPath), { recursive: true });
  let fd: number;
  try {
    // openSync with the "wx" flag (O_CREAT | O_EXCL) is the canonical exclusive
    // create: a single kernel op that fails with EEXIST rather than following a
    // pre-planted symlink or racing a competing writer. Using the dedicated
    // descriptor form (rather than writeFileSync's options-object flag) is what
    // the CodeQL insecure-temporary-file dataflow query models as a secure
    // create, so it clears the finding substantively, not by suppression.
    fd = openSync(absPath, "wx");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      return false;
    }
    throw err;
  }
  try {
    writeSync(fd, content);
  } finally {
    closeSync(fd);
  }
  return true;
}

/**
 * Build + write a divergence shard under `repoRoot`. Enforces AC #2's intent:
 * a divergence shard records a CONFLICT, so byte-identical loop bodies (no
 * divergence to preserve) are rejected.
 */
export function writeDivergenceShard(repoRoot: string, input: DivergenceInput): WriteResult {
  if (input.loopA.body === input.loopB.body) {
    throw new Error("refusing to file a divergence shard: loop bodies are byte-identical (no divergence to preserve)");
  }
  const relPath = divergenceShardRelPath(input.tick, input.loopA.body, input.loopB.body);
  const content = buildDivergenceShard(input);
  const result = writeShardAtPath(join(repoRoot, relPath), content);
  // Recompute the repo-relative path in case collision-resolution changed it.
  // path.relative handles the separator boundary + cross-platform normalisation
  // correctly, avoiding the prefix-collision edge cases of a manual slice.
  return { relPath: relative(repoRoot, result.absPath), status: result.status };
}

/**
 * Operational unit of 081KR7JY10008QG0R000MH7PJT AC #2 ("a divergence shard is filed whenever
 * conclusions differ"): detect whether two loops' observations on the SAME PR
 * review thread disagree and, only then, file the divergence shard under
 * `repoRoot`. Composes the pure detector (detectReviewThreadDisagreement) with
 * the I/O writer (writeDivergenceShard) so a caller fires the protocol step in
 * one call instead of hand-threading the DivergenceInput between the two.
 *
 *   - same thread, differing normalized conclusions → file the shard ("filed",
 *     carrying the WriteResult so the caller sees written / idempotent-noop /
 *     collision-resolved).
 *   - same conclusion OR different thread → no write ("no-disagreement").
 *
 * Stays below the blocked end-to-end boundary: it never auto-resolves the
 * GitHub thread (AC #1) and never overwrites a differing shard (the writer's
 * fail-closed-OR-idempotent rule). Validation throws from the detector (blank
 * thread id / conclusion / body) surface BEFORE any I/O. The writer's
 * byte-identical-bodies guard cannot fire on detector output: a "disagreement"
 * means normalized conclusions differ, and each perspective body is prefixed
 * with its trimmed (case-preserving) conclusion, so the two bodies are always
 * distinct.
 */
export function fileReviewThreadDisagreement(repoRoot: string, input: ReviewThreadDisagreementInput): ReviewThreadShardOutcome {
  const detection = detectReviewThreadDisagreement(input);
  if (detection.kind === "no-disagreement") {
    return detection;
  }
  return {
    kind: "filed",
    write: writeDivergenceShard(repoRoot, detection.divergenceInput),
    divergenceInput: detection.divergenceInput,
  };
}

// ---------------------------------------------------------------------------
// Read half of the protocol (AC #4): classify a filed shard's Reconciliation
// section. The schema README's morning-reconciliation workflow ("reads all
// shards with empty Reconciliation sections") needs a primitive that tells an
// empty (awaiting) section from a filled (decided) one. This is the pure
// counterpart to buildDivergenceShard: it consumes exactly the placeholder
// that builder writes. Stays below the blocked end-to-end boundary -- parsing
// an already-filed shard needs no GitHub call and no concurrent-loop harness.
// ---------------------------------------------------------------------------

/**
 * Status of a divergence shard's Reconciliation section.
 *   - unreconciled: the section holds only the maintainer-fills-in placeholder
 *     (the two HTML comments buildDivergenceShard writes) and/or whitespace;
 *     this shard awaits morning reconciliation.
 *   - reconciled: the section is filled and carries a recognized decision
 *     keyword; `note` is the maintainer's prose, case-preserving and trimmed,
 *     with the placeholder HTML comments removed (the same strip the empty-check
 *     applies, so an `<!-- ... -->` block never leaks into the note).
 *   - reconciled-freeform: the section is filled but carries no recognized
 *     keyword. Distinct from `reconciled` because the morning tooling should
 *     flag it for the maintainer to canonicalize rather than treat it as a
 *     clean decision (IMPLICIT-NOT-EXPLICIT: a substantively-distinct state
 *     earns its own variant).
 */
export type ReconciliationStatus =
  | { readonly kind: "unreconciled" }
  | { readonly kind: "reconciled"; readonly decision: ReconciliationDecision; readonly note: string }
  | { readonly kind: "reconciled-freeform"; readonly note: string };

/**
 * Extract the Reconciliation section body: everything after the
 * "## Reconciliation" header up to the next "## " heading or end-of-file. In
 * the canonical shape Reconciliation is the last section, so EOF terminates
 * it; the next-heading terminator is defensive for shards that append further
 * sections. Throws on a shard missing the header (malformed per schema --
 * eager rejection over silent acceptance, matching detectReviewThreadDisagreement).
 *
 * Delegates to divergence-reconcile.ts's `reconciliationBody`, which anchors on
 * the heading as a full line (`/^## Reconciliation[ \t]*$/m`) instead of a bare
 * `indexOf`. The anchored match is deterministic: an "## Reconciliation" mention
 * inside prose or a fenced code block before the real heading can no longer
 * slice the wrong region (Copilot PR #6130). `reconciliationBody` returns null
 * when no heading line exists; we convert that to the eager-rejection throw.
 */
function extractReconciliationSection(markdown: string): string {
  const body = reconciliationBody(markdown);
  if (body === null) {
    throw new Error('malformed divergence shard: missing "## Reconciliation" section');
  }
  return body;
}

/** Earliest-occurring recognized decision keyword in `text` (already lowercased
 *  by the caller), or null if none is present. Earliest-wins is deterministic
 *  when a note mentions more than one keyword. */
function findEarliestDecision(lowerText: string): ReconciliationDecision | null {
  let earliest: { decision: ReconciliationDecision; idx: number } | null = null;
  for (const decision of RECONCILIATION_DECISIONS) {
    const idx = lowerText.indexOf(decision);
    if (idx >= 0 && (earliest === null || idx < earliest.idx)) {
      earliest = { decision, idx };
    }
  }
  return earliest?.decision ?? null;
}

/**
 * Classify a filed divergence shard's Reconciliation section. Pure: no I/O, no
 * GitHub, no clock. Composes with buildDivergenceShard -- feeding that builder's
 * output here returns `{ kind: "unreconciled" }`, which is the foundational read
 * the schema README's "reads all shards with empty Reconciliation sections"
 * morning workflow (and 081KR7JY10008QG0R000MH7PJT AC #4) depends on.
 *
 * Decision keyword matching is case-insensitive (consistent with
 * normalizedConclusion). The returned `note` is the section's text after the
 * placeholder HTML comments are stripped (same fixpoint strip as the empty-
 * check) then trimmed; case is preserved for human readability. It is the
 * maintainer's prose, not a byte-for-byte copy of the raw section.
 */
export function parseReconciliationStatus(markdown: string): ReconciliationStatus {
  const section = extractReconciliationSection(markdown);
  const filled = stripHtmlComments(section).trim();
  if (filled.length === 0) {
    return { kind: "unreconciled" };
  }
  const decision = findEarliestDecision(filled.toLowerCase());
  if (decision === null) {
    return { kind: "reconciled-freeform", note: filled };
  }
  return { kind: "reconciled", decision, note: filled };
}
