// divergence-shard.ts — writer for substrate-divergence shard files.
//
// Implements the tooling glue for B-0164.1 (PR-review disagreement-
// preservation protocol, dual-loop AC #2). Given two loops' conclusions on
// the same substrate-class commitment (e.g. a PR-review thread), this module
// produces a divergence shard conforming to the schema landed in B-0164 AC #4
// (docs/hygiene-history/divergences/README.md, PR #2475) and writes it to the
// canonical path under the fail-closed-OR-idempotent rule.
//
// This is the UNBLOCKED slice of B-0164.1: building + filing a shard given two
// conclusions needs no concurrent-loop harness, so it is fully testable in
// isolation. The end-to-end protocol (detecting that two loops reviewed the
// same thread; morning reconciliation) remains the blocked impl child pending
// B-0160.
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
import { RECONCILIATION_DECISIONS, reconciliationBody, stripHtmlComments, } from "./divergence-reconcile.js";
// Re-export the canonical reconciliation vocabulary so existing importers of
// divergence-shard (the test suite, downstream callers) keep a stable surface.
// Single-sourced in divergence-reconcile.ts to stop the two modules drifting on
// order/value/doc -- the read half here and the fill half there now share one
// definition of the four decisions (Copilot PR #6130).
export { RECONCILIATION_DECISIONS };
const TICK_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
const DIVERGENCE_ROOT = "docs/hygiene-history/divergences";
/**
 * 8 hex chars from sha256(loopABody + loopBBody) per the README naming rule.
 * Content-addressing: identical bodies → identical hash → identical path
 * (enables the idempotent re-write case).
 */
export function shortContentHash(loopABody, loopBBody) {
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
export function divergenceShardRelPath(tick, loopABody, loopBBody) {
    const m = TICK_RE.exec(tick);
    if (!m) {
        throw new Error(`invalid tick "${tick}": expected ISO 8601 UTC seconds precision, e.g. 2026-05-10T11:48:00Z`);
    }
    const [, yyyy, mm, dd, hh, min, ss] = m;
    const hash = shortContentHash(loopABody, loopBBody);
    return `${DIVERGENCE_ROOT}/${yyyy}/${mm}/${dd}/${hh}${min}${ss}Z-${hash}.md`;
}
/** YAML double-quoted scalar (JSON escaping is a valid YAML subset). */
function yamlString(value) {
    return JSON.stringify(value);
}
function nonBlank(value, field) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        throw new Error(`${field} must be non-blank`);
    }
    return trimmed;
}
function normalizedConclusion(value) {
    return nonBlank(value, "review conclusion").toLowerCase();
}
function perspectiveFromObservation(observation) {
    const conclusion = nonBlank(observation.conclusion, "review conclusion");
    return {
        identity: observation.identity,
        body: `Conclusion: ${conclusion}\n\n${nonBlank(observation.body, "review body")}`,
    };
}
/**
 * Detect whether two loop observations on a PR review thread disagree.
 *
 * This is the pure detector slice for B-0164.1: it does not talk to GitHub and
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
export function detectReviewThreadDisagreement(input) {
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
            disagreementSummary: `Both loops reviewed the same PR thread; ` +
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
export function buildDivergenceShard(input) {
    if (!TICK_RE.test(input.tick)) {
        throw new Error(`invalid tick "${input.tick}": expected ISO 8601 UTC seconds precision`);
    }
    const a = input.loopA;
    const b = input.loopB;
    const attrib = (p) => `${p.identity.agent} (${p.identity.model}, ${p.identity.harness})`;
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
export function writeShardAtPath(absPath, content) {
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
    for (let n = 2;; n++) {
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
function tryExclusiveWrite(absPath, content) {
    mkdirSync(dirname(absPath), { recursive: true });
    let fd;
    try {
        // openSync with the "wx" flag (O_CREAT | O_EXCL) is the canonical exclusive
        // create: a single kernel op that fails with EEXIST rather than following a
        // pre-planted symlink or racing a competing writer. Using the dedicated
        // descriptor form (rather than writeFileSync's options-object flag) is what
        // the CodeQL insecure-temporary-file dataflow query models as a secure
        // create, so it clears the finding substantively, not by suppression.
        fd = openSync(absPath, "wx");
    }
    catch (err) {
        if (err.code === "EEXIST") {
            return false;
        }
        throw err;
    }
    try {
        writeSync(fd, content);
    }
    finally {
        closeSync(fd);
    }
    return true;
}
/**
 * Build + write a divergence shard under `repoRoot`. Enforces AC #2's intent:
 * a divergence shard records a CONFLICT, so byte-identical loop bodies (no
 * divergence to preserve) are rejected.
 */
export function writeDivergenceShard(repoRoot, input) {
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
 * Operational unit of B-0164.1 AC #2 ("a divergence shard is filed whenever
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
export function fileReviewThreadDisagreement(repoRoot, input) {
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
function extractReconciliationSection(markdown) {
    const body = reconciliationBody(markdown);
    if (body === null) {
        throw new Error('malformed divergence shard: missing "## Reconciliation" section');
    }
    return body;
}
/** Earliest-occurring recognized decision keyword in `text` (already lowercased
 *  by the caller), or null if none is present. Earliest-wins is deterministic
 *  when a note mentions more than one keyword. */
function findEarliestDecision(lowerText) {
    let earliest = null;
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
 * morning workflow (and B-0164.1 AC #4) depends on.
 *
 * Decision keyword matching is case-insensitive (consistent with
 * normalizedConclusion). The returned `note` is the section's text after the
 * placeholder HTML comments are stripped (same fixpoint strip as the empty-
 * check) then trimmed; case is preserved for human readability. It is the
 * maintainer's prose, not a byte-for-byte copy of the raw section.
 */
export function parseReconciliationStatus(markdown) {
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
