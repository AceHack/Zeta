#!/usr/bin/env bun
// report-branch-pigeonholes.ts — categorise every remote branch from evidence the branch
// itself carries, and say what action (if any) each one needs.
//
// WHY THIS FILE EXISTS
// --------------------
// The repo accumulates branches. The obvious response — invent a taxonomy, sort branches
// into it, delete the ones that look stale — is exactly the move
// `.claude/rules/pigeonhole-by-self-claim-never-by-assumption.md` forbids:
//
//     THE SUBJECT SUPPLIES THE CATEGORY, THE EVIDENCE SUPPLIES THE TRUTH VALUE.
//
// So this reporter never asks "does this branch look abandoned". It asks two separable
// questions, and keeps them separable:
//
//   LANE (the branch's own self-claim)   — what did its author declare it to be? Read off the
//                                          ref namespace, which is the author's declaration,
//                                          plus the repo machinery that acts on that namespace.
//   DISPOSITION (the evidence)           — did its content reach `main`, and by what route?
//
// A branch is never deleted by this file. It REPORTS. Deleting 60+ refs is an
// irreversible-shaped bulk action and belongs to the human maintainer.
//
// THE TEST THAT DOES NOT WORK, AND WHY IT IS NAMED HERE
// -----------------------------------------------------
// The tempting content test is `git diff origin/main...<branch>` being empty. It is WRONG, and
// wrong in the dangerous direction — it reports LANDED work as UNLANDED.
//
// The three-dot form diffs from the MERGE-BASE. This repo squash-merges, so a squash-merged
// branch keeps its full diff against its merge-base forever and reads as unlanded every time.
// Measured while writing this: the three-dot test over 40 recently-merged refs returned
// 40 unlanded / 0 landed, including three branches watched merging that same night. A 100%
// false-positive rate, and every false positive argues for keeping a branch that could go —
// or, run the other way by someone trusting it, for deleting work that is genuinely unlanded.
//
// WHAT THIS FILE USES INSTEAD
// ---------------------------
//   PRIMARY    the PR record. `pulls?state=all&head=<owner>:<branch>` is the branch's own
//              self-claim about what it was for and what happened to it — which is precisely
//              what the pigeonhole rule asks us to read. A merged PR whose head SHA equals the
//              branch tip is proof the tip landed.
//
//   SECONDARY  a squash-robust content test, used only as CORROBORATION: take the paths the
//              branch touched, and ask whether the branch's version of THOSE PATHS already
//              matches `main` (`git diff <tip> origin/main -- <paths>`). Empty ⇒ the content is
//              in `main`. The asymmetry is honest and is enforced below: EMPTY IS PROOF OF
//              LANDED, NON-EMPTY PROVES NOTHING — `main` may simply have moved on past those
//              files. So a non-empty result never downgrades a branch on its own.
//
//   ANCESTRY   `merge-base --is-ancestor` still proves a true merge. It is sufficient, never
//              necessary: squash breaks it, which is the whole trap above.
//
// THE UNKNOWN BIN IS MANDATORY
// ----------------------------
// Every classifier that cannot say "I do not know" force-fits, and a force-fit here is a
// deleted branch. `unknown` is a first-class disposition, it is reported with its size, and
// each member carries the specific missing evidence that would resolve it. An empty UNKNOWN is
// a warning about the classifier, not a clean bill of health for the branches.
//
// PROTECTED LANES ARE A MECHANICAL FACT, NOT A JUDGEMENT CALL
// -----------------------------------------------------------
// `heartbeat/*` is covered by ruleset "Heartbeat Branch Protection" with a `deletion` rule and
// an EMPTY bypass-actor list. Those refs cannot be deleted by anyone, including an admin, and
// that is by design: `heartbeat/<lane>` + `heartbeat/<lane>-buffer` are REUSABLE staging refs
// that mint nothing per flush. They are the fix for branch proliferation, not an instance of
// it — the lane they replaced had reached 1,290 refs. This file reads the ruleset live rather
// than hardcoding the pattern, so a change to the protection shows up here instead of rotting.

import { execFileSync } from "node:child_process";
import { stringCompare } from "../collation/collation.ts";

const OWNER_REPO = process.env["ZETA_REPO"] ?? "Lucent-Financial-Group/Zeta";
const OWNER = OWNER_REPO.split("/")[0]!;
const BASE = process.env["ZETA_BASE"] ?? "origin/main";

/** Evidence-derived disposition. `unknown` is first-class and never a fallback for laziness. */
export type Disposition =
  | "in-flight"
  | "landed-merge"
  | "landed-squash"
  | "landed-equivalent"
  | "landed-patch-equivalent"
  | "partially-landed"
  | "retired-by-decision"
  | "unlanded-never-proposed"
  | "unknown";

/** Self-claimed lane, read off the ref namespace the author chose. */
export type Lane = "protected-automation" | "live-ledger" | "legacy-automation" | "work";

export interface PullRecord {
  readonly number: number;
  readonly state: string;
  readonly merged: boolean;
  readonly headSha: string;
  readonly title: string;
}

export interface BranchEvidence {
  readonly name: string;
  readonly tip: string;
  readonly isAncestorOfBase: boolean;
  /** Paths the branch touched, relative to its merge-base with the base ref. */
  readonly touchedPaths: readonly string[];
  /**
   * Whether the branch's version of its own touched paths already matches the base.
   * `true` ⇒ content is in the base (proof). `false` ⇒ proves NOTHING (base may have moved on).
   * `null` ⇒ could not be computed (e.g. unrelated history — no merge base exists).
   */
  readonly contentInBase: boolean | null;
  /**
   * `git cherry` patch-id equivalence: how many of the branch's own commits already have a
   * patch-identical counterpart in the base, out of how many were examined.
   *
   * This catches the case the two tests above both miss: a branch whose commits were
   * cherry-picked or re-landed under a DIFFERENT ref, where ancestry is false (different SHAs),
   * the PR record is empty (this ref never had one), and the content test is inconclusive
   * because the base has since moved past those files. Full equivalence is positive evidence
   * of landing; PARTIAL equivalence is not, and is reported rather than rounded up.
   *
   * `null` when no merge base exists, so the comparison is undefined.
   */
  readonly patchEquivalent: { readonly landed: number; readonly total: number } | null;
  readonly pulls: readonly PullRecord[];
  /** True when a repo ruleset forbids deleting this ref with no bypass actor. */
  readonly deletionProtected: boolean;
}

export interface Verdict {
  readonly name: string;
  readonly tip: string;
  readonly lane: Lane;
  readonly disposition: Disposition;
  /** The specific evidence that produced the disposition. Never a restatement of the label. */
  readonly because: string;
  /** What a human should do. `null` means "nothing — leave it alone". */
  readonly action: string | null;
  /** Only meaningful for `unknown`: what evidence would settle it. */
  readonly missingEvidence: string | null;
}

function git(args: readonly string[], cwd: string): string {
  return execFileSync("git", args as string[], {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function gitOk(args: readonly string[], cwd: string): boolean {
  try {
    execFileSync("git", args as string[], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the branch's self-claimed lane off the namespace its author chose.
 *
 * This is deliberately a reading of the AUTHOR'S declaration, not our opinion of the branch.
 * `deletionProtected` comes from the live ruleset, so a protection change is reflected rather
 * than a hardcoded pattern drifting away from reality.
 */
export function laneOf(name: string, deletionProtected: boolean): Lane {
  if (name.startsWith("heartbeat/")) return deletionProtected ? "protected-automation" : "legacy-automation";
  if (name.startsWith("liveness/")) return "live-ledger";
  if (name === "agent-heartbeats") return "legacy-automation";
  return "work";
}

/**
 * The classifier. Ordered so that the STRONGEST evidence decides first, and so that no rule can
 * conclude "unlanded" from the absence of evidence — absence routes to `unknown` instead.
 */
export function classify(e: BranchEvidence): Verdict {
  const lane = laneOf(e.name, e.deletionProtected);
  const open = e.pulls.filter((p) => p.state === "open");
  const merged = e.pulls.filter((p) => p.merged);
  const mergedAtTip = merged.filter((p) => p.headSha === e.tip);
  const closedUnmerged = e.pulls.filter((p) => p.state === "closed" && !p.merged);

  const protectedNote = e.deletionProtected
    ? " Ref is deletion-protected by a repo ruleset with no bypass actor, so removal is not available in any case."
    : "";

  const mk = (
    disposition: Disposition,
    because: string,
    action: string | null,
    missingEvidence: string | null = null,
  ): Verdict => ({ name: e.name, tip: e.tip, lane, disposition, because, action, missingEvidence });

  // 1. An open PR settles it: the branch is being worked. Nothing to decide.
  if (open.length > 0) {
    return mk(
      "in-flight",
      `open PR ${open.map((p) => `#${p.number}`).join(", ")}`,
      null,
    );
  }

  // 2. True merge — ancestry is proof. Sufficient, never necessary (squash breaks it).
  if (e.isAncestorOfBase) {
    return mk("landed-merge", `tip is an ancestor of ${BASE}`, e.deletionProtected ? null : `safe to delete; restore with \`git push origin ${e.tip}:refs/heads/${e.name}\`${protectedNote}`);
  }

  // 3. A merged PR whose head SHA IS the tip proves the tip landed, squash or not.
  if (mergedAtTip.length > 0) {
    return mk(
      "landed-squash",
      `merged PR ${mergedAtTip.map((p) => `#${p.number}`).join(", ")} has head SHA == tip`,
      e.deletionProtected ? null : `safe to delete; restore with \`git push origin ${e.tip}:refs/heads/${e.name}\`${protectedNote}`,
    );
  }

  // 4. Corroborating content test. Only the EMPTY direction is load-bearing.
  if (e.contentInBase === true) {
    return mk(
      "landed-equivalent",
      `the branch's version of all ${e.touchedPaths.length} path(s) it touched already matches ${BASE}`,
      e.deletionProtected ? null : `safe to delete; restore with \`git push origin ${e.tip}:refs/heads/${e.name}\`${protectedNote}`,
    );
  }

  // 5. Cherry-picked / re-landed under another ref. Requires FULL equivalence — a partial
  //    match means part of the branch is genuinely absent, and that is a forward action.
  if (e.patchEquivalent !== null && e.patchEquivalent.total > 0 && e.patchEquivalent.landed === e.patchEquivalent.total) {
    return mk(
      "landed-patch-equivalent",
      `all ${e.patchEquivalent.total} commit(s) are patch-identical to commits already in ${BASE} (landed under a different ref)`,
      e.deletionProtected
        ? null
        : `safe to delete; name the successor ref in the record first. Restore with \`git push origin ${e.tip}:refs/heads/${e.name}\`${protectedNote}`,
    );
  }

  // 5b. Unrelated history — no merge base, so no content test is even defined. This is the
  //    honest UNKNOWN, not a failure to try.
  if (e.contentInBase === null) {
    return mk(
      "unknown",
      `no merge base with ${BASE} — the ref carries unrelated history, so no content comparison is defined`,
      "leave in place; treat as an independent ledger until its writer is identified",
      `which process writes this ref, and whether anything reads it. Ancestry and content tests are both undefined against ${BASE}.`,
    );
  }

  // 6. Merged PR(s) exist but not at the tip: some landed, some did not. Never a silent delete.
  if (merged.length > 0) {
    return mk(
      "partially-landed",
      `merged PR ${merged.map((p) => `#${p.number}`).join(", ")}, but the tip ${e.tip.slice(0, 10)} is NOT that merge's head — commits were added after`,
      e.deletionProtected
        ? null
        : "FORWARD ACTION: diff the tip against the merged head and either land the remainder or record why it is dropped",
    );
  }

  // 7. Someone explicitly closed a PR on this branch without merging. That is a recorded
  //    decision by the branch's own author/reviewer — the strongest self-claim available.
  if (closedUnmerged.length > 0) {
    return mk(
      "retired-by-decision",
      `PR ${closedUnmerged.map((p) => `#${p.number}`).join(", ")} closed unmerged; content still differs from ${BASE}`,
      e.deletionProtected
        ? null
        : "FORWARD ACTION: confirm the close reason is recorded somewhere durable, then delete; if no reason exists, re-file or re-cut before deleting",
    );
  }

  // 8. No PR ever opened, and content is not in the base. This branch was never proposed. It is
  //    the highest-value bin in the whole report: work nobody ever asked anyone to look at.
  if (e.pulls.length === 0) {
    return mk(
      "unlanded-never-proposed",
      `no PR was ever opened for this ref, and its content is not in ${BASE}` +
        (e.patchEquivalent && e.patchEquivalent.landed > 0
          ? ` (${e.patchEquivalent.landed} of ${e.patchEquivalent.total} commits ARE already in ${BASE} — partially re-landed elsewhere, so the remainder is what needs a decision)`
          : ""),
      e.deletionProtected
        ? null
        : "FORWARD ACTION: open a PR, file a work-item, or explicitly retire it with the reason recorded. NEVER a silent delete.",
    );
  }

  // 9. Evidence present but contradictory. Say so rather than picking.
  return mk(
    "unknown",
    `PRs exist (${e.pulls.map((p) => `#${p.number}`).join(", ")}) but none is open, merged, or closed-unmerged in a way this classifier recognises`,
    "leave in place",
    "a human read of the PR record; the API states did not fall into any recognised combination.",
  );
}

/** Refs whose deletion is forbidden by a repo ruleset carrying a `deletion` rule and no bypass. */
async function deletionProtectedMatcher(): Promise<(ref: string) => boolean> {
  const raw = execFileSync("gh", ["api", `repos/${OWNER_REPO}/rulesets`], { encoding: "utf8" });
  const sets = JSON.parse(raw) as ReadonlyArray<{ id: number; enforcement: string }>;
  const patterns: { include: string[]; exclude: string[] }[] = [];
  for (const s of sets) {
    if (s.enforcement !== "active") continue;
    const d = JSON.parse(
      execFileSync("gh", ["api", `repos/${OWNER_REPO}/rulesets/${s.id}`], { encoding: "utf8" }),
    ) as {
      rules?: { type: string }[];
      bypass_actors?: unknown[];
      conditions?: { ref_name?: { include?: string[]; exclude?: string[] } };
    };
    if (!d.rules?.some((r) => r.type === "deletion")) continue;
    if ((d.bypass_actors ?? []).length > 0) continue; // a bypass exists ⇒ not absolutely protected
    patterns.push({
      include: d.conditions?.ref_name?.include ?? [],
      exclude: d.conditions?.ref_name?.exclude ?? [],
    });
  }
  const glob = (p: string, s: string): boolean =>
    new RegExp(`^${p.split("*").map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`).test(s);
  return (ref: string) => {
    const full = `refs/heads/${ref}`;
    return patterns.some(
      (p) =>
        p.include.some((i) => i === "~ALL" || glob(i, full)) &&
        !p.exclude.some((x) => glob(x, full)),
    );
  };
}

function pullsFor(branch: string): PullRecord[] {
  const raw = execFileSync(
    "gh",
    ["api", `repos/${OWNER_REPO}/pulls?state=all&head=${OWNER}:${branch}&per_page=100`],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return (JSON.parse(raw) as ReadonlyArray<{
    number: number;
    state: string;
    merged_at: string | null;
    head: { sha: string };
    title: string;
  }>).map((p) => ({
    number: p.number,
    state: p.state,
    merged: p.merged_at !== null,
    headSha: p.head.sha,
    title: p.title,
  }));
}

export function gatherEvidence(
  cwd: string,
  name: string,
  tip: string,
  isProtected: boolean,
): BranchEvidence {
  const base = git(["rev-parse", BASE], cwd);
  const isAncestorOfBase = gitOk(["merge-base", "--is-ancestor", tip, base], cwd);

  let touchedPaths: string[] = [];
  let contentInBase: boolean | null = null;
  let patchEquivalent: { landed: number; total: number } | null = null;
  if (gitOk(["merge-base", tip, base], cwd)) {
    // `git cherry` prefixes `-` for a commit with a patch-identical twin in the base, `+` for
    // one without. Merge commits are skipped by design, so `total` is the count it examined.
    const cherry = git(["cherry", base, tip], cwd).split("\n").filter(Boolean);
    patchEquivalent = {
      landed: cherry.filter((l) => l.startsWith("-")).length,
      total: cherry.length,
    };
    touchedPaths = git(["diff", "--name-only", `${base}...${tip}`], cwd).split("\n").filter(Boolean);
    if (touchedPaths.length === 0) {
      contentInBase = true;
    } else {
      // The squash-robust test: does the branch's own version of its own paths match the base?
      // Empty ⇒ landed (proof). Non-empty ⇒ inconclusive, and callers must treat it that way.
      const differing = git(["diff", "--name-only", tip, base, "--", ...touchedPaths], cwd)
        .split("\n")
        .filter(Boolean);
      contentInBase = differing.length === 0;
    }
  }

  return {
    name,
    tip,
    isAncestorOfBase,
    touchedPaths,
    contentInBase,
    patchEquivalent,
    pulls: pullsFor(name),
    deletionProtected: isProtected,
  };
}

async function main(): Promise<number> {
  const cwd = process.cwd();
  const json = process.argv.includes("--json");

  git(["fetch", "origin", "--prune"], cwd);
  const isProtected = await deletionProtectedMatcher();

  const heads = git(["ls-remote", "--heads", "origin"], cwd)
    .split("\n")
    .map((l) => l.split("\t"))
    .filter((p): p is [string, string] => p.length === 2)
    .map(([sha, ref]) => ({ sha, name: ref.replace("refs/heads/", "") }))
    .filter((b) => b.name !== "main");

  const verdicts: Verdict[] = [];
  for (const h of heads) {
    verdicts.push(classify(gatherEvidence(cwd, h.name, h.sha, isProtected(h.name))));
  }

  if (json) {
    process.stdout.write(`${JSON.stringify(verdicts, null, 2)}\n`);
    return 0;
  }

  const byDisposition = new Map<Disposition, Verdict[]>();
  for (const v of verdicts) {
    const list = byDisposition.get(v.disposition) ?? [];
    list.push(v);
    byDisposition.set(v.disposition, list);
  }

  process.stdout.write(`branch pigeonholes against ${BASE} — ${verdicts.length} refs (excluding main)\n\n`);
  for (const [d, list] of [...byDisposition.entries()].sort((a, b) => b[1].length - a[1].length)) {
    process.stdout.write(`${d}  (${list.length})\n`);
    for (const v of list.sort((a, b) => stringCompare(a.name, b.name))) {
      process.stdout.write(`  ${v.tip.slice(0, 10)}  ${v.name}  [${v.lane}]\n`);
      process.stdout.write(`      because: ${v.because}\n`);
      if (v.action) process.stdout.write(`      action:  ${v.action}\n`);
      if (v.missingEvidence) process.stdout.write(`      needs:   ${v.missingEvidence}\n`);
    }
    process.stdout.write("\n");
  }

  const unknown = byDisposition.get("unknown") ?? [];
  process.stdout.write(
    `UNKNOWN = ${unknown.length}. An empty UNKNOWN would mean the classifier force-fit something;\n` +
      `a non-empty UNKNOWN with named missing evidence is the healthy result.\n`,
  );
  return 0;
}

if (import.meta.main) {
  main()
    .then((c) => process.exit(c))
    .catch((err: unknown) => {
      process.stderr.write(`report-branch-pigeonholes: ${String(err)}\n`);
      process.exit(2);
    });
}
