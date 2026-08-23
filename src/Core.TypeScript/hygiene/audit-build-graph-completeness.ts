#!/usr/bin/env bun
// audit-build-graph-completeness.ts — is `build-graph.json` COMPLETE over the CI domain?
//
// WHY THIS EXISTS, and why it is a gate rather than a report.
//
// `src/Core.TypeScript/ace/build-graph.ts` computes an affected-set: given a diff,
// which targets are reachable and therefore which CI legs must run. That query is
// correct and it works today. Wiring it to job selection is what turns a union-
// provisioning gate (every job installs every toolchain) into a subset one.
//
// But an affected-set query is only sound if the graph it reads is COMPLETE over
// the domain being closed over. The condition, stated by the maintainer:
//
//   "it's only the same operation when your generator is complete over the domain
//    you are trying to close over"                             (Aaron, 2026-08-19)
//
// which is the domain-scoped form of the partial-evaluation correctness condition
// (Jones, Gomard & Sestoft 1993: a specialised program behaves as the original ON
// ALL INPUTS). Applied here: if a target carries no leg, or a leg names a job that
// does not exist, or a job is claimed by no target, then selecting jobs from this
// graph SILENTLY SKIPS work. A job that should have run and did not looks exactly
// like a job that ran and passed — the vacuity class, in the place it costs most.
//
// So this audit is the acceptance gate on wiring the graph, not a nice-to-have.
// It fails CLOSED: any incompleteness is exit 1.
//
// THREE DIRECTIONS, because two of them are not the same check and skipping either
// leaves a class of silent skip:
//
//   A. target -> leg   Every target claims at least one CI leg.
//                      A leg-less target is invisible to job selection: nothing it
//                      contains can ever cause a job to run.
//
//   B. leg -> job      Every claimed leg resolves to a real `workflow/job` that
//                      exists in `.github/workflows/`. A leg naming a job that does
//                      not exist is a dangling selector — it can never fire, so the
//                      targets behind it are unreachable in practice even though
//                      direction A calls them covered.
//
//   C. job -> target   Every job in a leg-bearing workflow is claimed by at least
//                      one target, OR is declared infrastructure below with a
//                      reason. An unclaimed job is one the affected-set query will
//                      never name, so wiring `if:` off the query would stop running
//                      it entirely.
//
// Direction C needs an escape hatch (orchestration jobs genuinely have no target),
// and an escape hatch with no discipline is a licence. So INFRASTRUCTURE_JOBS below
// is checked in BOTH directions: a rostered job that no longer exists is a finding
// (the roster cannot rot), and a job that is both rostered and claimed is a finding
// (the roster cannot quietly shadow real coverage).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-build-graph-completeness.ts
//   bun src/Core.TypeScript/hygiene/audit-build-graph-completeness.ts --json
//
// Exit codes: 0 = complete; 1 = incomplete (findings printed); 2 = usage/IO error.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Finding = {
  readonly direction: "A" | "B" | "C" | "roster";
  readonly code: string;
  readonly subject: string;
  readonly message: string;
};

export type BuildTargetLike = {
  readonly id: string;
  readonly kind: string;
  readonly legs?: readonly string[];
};

/**
 * Jobs that legitimately have no build target, each with the reason.
 *
 * Every entry is orchestration: it decides what runs or reports what ran, and owns
 * no sources. The roster is small on purpose — it is the only place this audit can
 * be weakened, so a growing roster is itself the signal that something is wrong.
 *
 * Checked in both directions (see `auditRoster`): an entry naming a job that no
 * longer exists fails, and an entry that is ALSO claimed by a target fails.
 */
export const INFRASTRUCTURE_JOBS: ReadonlyMap<string, string> = new Map([
  [
    "gate/matrix-setup",
    "Emits the runner matrix. Owns no sources; decides where other jobs run.",
  ],
  [
    "gate/path-filter",
    "Emits code=true/false from the PR diff. It is itself a selector, so claiming " +
      "it from a target would make the selector depend on the thing it selects.",
  ],
  [
    "gate/gate-required",
    "The required-check aggregator. Reports the verdict of the floor jobs; runs no " +
      "check of its own.",
  ],
  [
    "gate/drift-canary",
    "The live specimen for step-level `continue-on-error` detection. Owns no sources " +
      "and MUST NOT be selectable: a canary that a path filter can skip proves nothing " +
      "on the runs it was skipped for, and its absence is what `drift-loud` reads as a " +
      "dead detector. Unconditional by design.",
  ],
  [
    "gate/drift-loud",
    "Reports which non-blocking failures were absorbed across this run and a window of " +
      "recent main runs. Owns no sources, and its subject is every other job — so a " +
      "target claiming it would make the drift reporter selectable by the very diffs " +
      "whose drift it exists to report.",
  ],
]);

/** `workflow/job` for a workflow file path and a job id. */
export function legId(workflowFile: string, jobId: string): string {
  return `${workflowFile.replace(/\.ya?ml$/u, "")}/${jobId}`;
}

/**
 * Job ids declared under `jobs:` in a workflow.
 *
 * Deliberately a line scanner rather than a YAML parse: the audit must run with no
 * dependency beyond node built-ins so it can sit in a bun-only CI leg (which is the
 * whole point of the wiring this gates). Job ids are two-space-indented keys under
 * a top-level `jobs:`, which GitHub's own schema requires, so the shape is stable.
 */
export function parseJobIds(workflowText: string): readonly string[] {
  const ids: string[] = [];
  let inJobs = false;
  for (const raw of workflowText.split("\n")) {
    if (/^jobs:\s*$/u.test(raw)) { inJobs = true; continue; }
    if (!inJobs) continue;
    // Any other top-level key ends the jobs block.
    if (/^[A-Za-z_.-]+:/u.test(raw)) { inJobs = false; continue; }
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/u.exec(raw);
    if (m?.[1] !== undefined) ids.push(m[1]);
  }
  return ids;
}

/** Every `workflow/job` id that exists, for the workflows named in `workflowFiles`. */
export function collectJobs(
  workflowDir: string,
  workflowFiles: readonly string[],
  read: (p: string) => string = (p) => readFileSync(p, "utf-8"),
): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const f of workflowFiles) out.set(f, parseJobIds(read(join(workflowDir, f))));
  return out;
}

/**
 * Targets that genuinely have NO CI at all, each with the reason.
 *
 * This is the one exemption direction A allows, and it is deliberately NOT a way
 * to make the graph look complete. The opposite: a rostered target is a declared
 * COVERAGE GAP, and the soundness obligation moves to the selector --
 *
 *   **A change touching an uncovered target must force FULL mode, never selective.**
 *
 * That is what keeps the exemption from being the vacuity class. "We do not know
 * what checks this" resolves to "run everything", not to "run nothing". An
 * exemption that resolved to skip would be precisely the silent-skip failure this
 * whole audit exists to prevent.
 *
 * Each entry is checked for rot by `auditUncoveredRoster`: a rostered target that
 * has since gained a leg, or that no longer exists, is a finding.
 */
export const UNCOVERED_TARGETS: ReadonlyMap<string, string> = new Map([
  [
    "unit:agda",
    "src/Core.Agda has zero workflow references (CHECKED 2026-08-19: grep over " +
      ".github/workflows/ returns nothing). Real gap, not a modelling artifact.",
  ],
  [
    "tool:alloy",
    "src/Core.Alloy appears only in codeql.yml, which does not run Alloy. No " +
      "analyzer leg exists (CHECKED 2026-08-19).",
  ],
  [
    "lean:src/Core.Lean4.Cslib",
    "Opt-in Mathlib-dependent library, deliberately off the main gate because the " +
      "lake cache is multi-GB; lean-proof.yml builds src/Core.Lean4 only.",
  ],
]);

/** Direction A: every target claims at least one leg, or is a declared coverage gap. */
export function auditTargetsHaveLegs(
  targets: readonly BuildTargetLike[],
  uncovered: ReadonlyMap<string, string> = UNCOVERED_TARGETS,
): readonly Finding[] {
  return targets
    .filter((t) => (t.legs ?? []).length === 0 && !uncovered.has(t.id))
    .map((t) => ({
      direction: "A" as const,
      code: "target-without-leg",
      subject: t.id,
      message:
        `target claims no CI leg, so nothing it contains can ever select a job. ` +
        `Either give it the leg that already covers it, add the leg, or roster it ` +
        `in UNCOVERED_TARGETS with a reason (which forces FULL mode when touched). ` +
        `(kind=${t.kind})`,
    }));
}

/** The uncovered roster's own guards: it may not rot, and it may not hide coverage. */
export function auditUncoveredRoster(
  targets: readonly BuildTargetLike[],
  uncovered: ReadonlyMap<string, string> = UNCOVERED_TARGETS,
): readonly Finding[] {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const findings: Finding[] = [];
  for (const [id, reason] of uncovered) {
    const t = byId.get(id);
    if (t === undefined) {
      findings.push({
        direction: "roster",
        code: "stale-uncovered-entry",
        subject: id,
        message: `UNCOVERED_TARGETS names a target that no longer exists. Remove it. (reason on file: ${reason})`,
      });
      continue;
    }
    if ((t.legs ?? []).length > 0) {
      findings.push({
        direction: "roster",
        code: "uncovered-target-has-leg",
        subject: id,
        message: `target is rostered as having no CI but now claims ${String((t.legs ?? []).length)} leg(s). Drop the roster entry -- a stale gap declaration understates real coverage and keeps the selector in full mode for no reason.`,
      });
    }
  }
  return findings;
}

/** Direction B: every claimed leg resolves to a job that exists. */
export function auditLegsResolve(
  targets: readonly BuildTargetLike[],
  jobsByWorkflow: ReadonlyMap<string, readonly string[]>,
): readonly Finding[] {
  const real = new Set<string>();
  for (const [file, ids] of jobsByWorkflow) for (const id of ids) real.add(legId(file, id));
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const t of targets) {
    for (const leg of t.legs ?? []) {
      if (real.has(leg) || seen.has(leg)) continue;
      seen.add(leg);
      findings.push({
        direction: "B",
        code: "dangling-leg",
        subject: leg,
        message:
          `leg names no job that exists in .github/workflows/. A dangling selector ` +
          `can never fire, so every target behind it is unreachable in practice ` +
          `even though direction A counts it covered. First claimed by ${t.id}.`,
      });
    }
  }
  return findings;
}

/** Direction C: every job is claimed by a target, or declared infrastructure. */
export function auditJobsAreClaimed(
  targets: readonly BuildTargetLike[],
  jobsByWorkflow: ReadonlyMap<string, readonly string[]>,
  infrastructure: ReadonlyMap<string, string> = INFRASTRUCTURE_JOBS,
): readonly Finding[] {
  const claimed = new Set<string>();
  for (const t of targets) for (const leg of t.legs ?? []) claimed.add(leg);
  const findings: Finding[] = [];
  for (const [file, ids] of jobsByWorkflow) {
    for (const id of ids) {
      const leg = legId(file, id);
      if (claimed.has(leg) || infrastructure.has(leg)) continue;
      findings.push({
        direction: "C",
        code: "unclaimed-job",
        subject: leg,
        message:
          `no target claims this job, so the affected-set query can never name it. ` +
          `Selecting jobs from the graph would stop running it entirely — a check ` +
          `that did not run looks like one that passed. Claim it from a target, or ` +
          `add it to INFRASTRUCTURE_JOBS with a reason.`,
      });
    }
  }
  return findings;
}

/** The roster's own guards: it may not rot, and it may not shadow real coverage. */
export function auditRoster(
  targets: readonly BuildTargetLike[],
  jobsByWorkflow: ReadonlyMap<string, readonly string[]>,
  infrastructure: ReadonlyMap<string, string> = INFRASTRUCTURE_JOBS,
): readonly Finding[] {
  const real = new Set<string>();
  for (const [file, ids] of jobsByWorkflow) for (const id of ids) real.add(legId(file, id));
  const claimed = new Set<string>();
  for (const t of targets) for (const leg of t.legs ?? []) claimed.add(leg);
  const findings: Finding[] = [];
  for (const [leg, reason] of infrastructure) {
    if (!real.has(leg)) {
      findings.push({
        direction: "roster",
        code: "stale-roster-entry",
        subject: leg,
        message: `INFRASTRUCTURE_JOBS names a job that no longer exists. Remove it — a roster that outlives its jobs stops being checkable. (reason on file: ${reason})`,
      });
    }
    if (claimed.has(leg)) {
      findings.push({
        direction: "roster",
        code: "roster-shadows-coverage",
        subject: leg,
        message: `job is BOTH declared infrastructure and claimed by a target. The roster must never shadow real coverage; drop the roster entry.`,
      });
    }
  }
  return findings;
}

/** Every workflow file a leg refers to, plus every workflow that any leg could name. */
export function workflowFilesFromLegs(targets: readonly BuildTargetLike[]): readonly string[] {
  const files = new Set<string>();
  for (const t of targets) {
    for (const leg of t.legs ?? []) {
      const slash = leg.indexOf("/");
      if (slash > 0) files.add(`${leg.slice(0, slash)}.yml`);
    }
  }
  return [...files].sort();
}

export function auditAll(
  targets: readonly BuildTargetLike[],
  jobsByWorkflow: ReadonlyMap<string, readonly string[]>,
  infrastructure: ReadonlyMap<string, string> = INFRASTRUCTURE_JOBS,
): readonly Finding[] {
  return [
    ...auditTargetsHaveLegs(targets),
    ...auditLegsResolve(targets, jobsByWorkflow),
    ...auditJobsAreClaimed(targets, jobsByWorkflow, infrastructure),
    ...auditRoster(targets, jobsByWorkflow, infrastructure),
    ...auditUncoveredRoster(targets),
  ];
}

// ---------------------------------------------------------------- CLI

const GRAPH = "src/Core.TypeScript/ace/build-graph.json";
const WORKFLOW_DIR = ".github/workflows";

function main(argv: readonly string[]): number {
  const asJson = argv.includes("--json");
  if (!existsSync(GRAPH)) {
    console.error(`audit-build-graph-completeness: ${GRAPH} not found — run from the repo root.`);
    return 2;
  }
  const graph = JSON.parse(readFileSync(GRAPH, "utf-8")) as { targets: BuildTargetLike[] };
  const targets = graph.targets ?? [];
  if (targets.length === 0) {
    console.error("audit-build-graph-completeness: graph has zero targets — refusing to pass on an empty surface");
    return 2;
  }
  // Union of the workflows legs point at and the workflows the roster points at,
  // so a job in a leg-bearing workflow cannot escape direction C by having no leg.
  const fromLegs = workflowFilesFromLegs(targets);
  const fromRoster = [...INFRASTRUCTURE_JOBS.keys()].map((l) => `${l.slice(0, l.indexOf("/"))}.yml`);
  const files = [...new Set([...fromLegs, ...fromRoster])]
    .filter((f) => existsSync(join(WORKFLOW_DIR, f)))
    .sort();
  if (files.length === 0) {
    console.error("audit-build-graph-completeness: no leg-bearing workflow files found — refusing to pass");
    return 2;
  }
  const jobs = collectJobs(WORKFLOW_DIR, files);
  const findings = auditAll(targets, jobs);

  const jobCount = [...jobs.values()].reduce((a, v) => a + v.length, 0);
  if (asJson) {
    console.log(JSON.stringify({ targets: targets.length, workflows: files, jobs: jobCount, findings }, null, 2));
  } else {
    console.log(`build-graph completeness: ${String(targets.length)} target(s), ${String(jobCount)} job(s) across ${String(files.length)} leg-bearing workflow(s)`);
    if (findings.length === 0) {
      console.log("OK complete over the CI domain — every target claims a leg, every leg resolves, every job is claimed.");
      if (UNCOVERED_TARGETS.size > 0) {
        console.log(`\n${String(UNCOVERED_TARGETS.size)} target(s) declared UNCOVERED (a real gap, not coverage):`);
        for (const [id, reason] of UNCOVERED_TARGETS) console.log(`  ${id}\n      ${reason}`);
        console.log("  A change touching any of these must force FULL mode, never selective.");
      }
    } else {
      const byDir: Record<string, number> = {};
      for (const f of findings) byDir[f.direction] = (byDir[f.direction] ?? 0) + 1;
      console.log(`\n${String(findings.length)} finding(s): ` +
        Object.entries(byDir).map(([d, n]) => `${d}=${String(n)}`).join(" "));
      for (const f of findings) {
        console.log(`  [${f.direction}/${f.code}] ${f.subject}`);
        console.log(`      ${f.message}`);
      }
      console.log("\nThe graph is NOT complete over the CI domain. Wiring job selection to it " +
        "would silently skip work at exactly these points.");
    }
  }
  return findings.length === 0 ? 1 - 1 : 1;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
