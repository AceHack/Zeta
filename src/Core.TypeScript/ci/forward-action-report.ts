#!/usr/bin/env bun
// forward-action-report.ts — 081M10JB2FJ087G0R00159NYSZ
//
// The READ-ONLY edge for `forward-action-du.ts`. It gathers facts and prints
// proposals. It holds no write token and calls no mutating endpoint.
//
// Every mutating verb is absent BY CONSTRUCTION, not by discipline: the only
// GitHub calls in this file are `gh api` GETs and the only git calls are
// `fetch`, `rev-list`, `merge-tree`, `rev-parse`, and `worktree list`. There is
// no code path that pushes, closes, reruns, arms, or retires. `lint-forward-
// action-registry.ts` asserts that mechanically so a later edit cannot quietly
// add one.
//
// Usage:
//   bun src/Core.TypeScript/ci/forward-action-report.ts            # human table
//   bun src/Core.TypeScript/ci/forward-action-report.ts --json     # machine
//   bun src/Core.TypeScript/ci/forward-action-report.ts --pr 15583 # one PR

import { execFileSync } from "node:child_process";
import {
  type CheckFact,
  type PrFacts,
  type Proposal,
  REQUIRED_CHECK,
  propose,
  renderProposal,
  mayAutoExecute,
} from "./forward-action-du.ts";

const REPO = "Lucent-Financial-Group/Zeta";

/**
 * A GET-only `gh api` wrapper.
 *
 * `stdio: ["ignore", "pipe", "pipe"]` so the exit status is read from the throw,
 * never inferred from a pipeline — `mise` writes unrelated noise to stderr in
 * this repo and a `| head` would mask a real non-zero.
 */
function ghGet<T>(path: string): { ok: true; body: T } | { ok: false; status: number } {
  try {
    const out = execFileSync("gh", ["api", "-X", "GET", path], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, body: JSON.parse(out) as T };
  } catch (e) {
    const err = e as { stderr?: string };
    const m = /HTTP (\d{3})/.exec(err.stderr ?? "");
    return { ok: false, status: m ? Number(m[1]) : 0 };
  }
}

function git(args: readonly string[]): { rc: number; out: string } {
  try {
    const out = execFileSync("git", [...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { rc: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { rc: err.status ?? 1, out: err.stdout ?? "" };
  }
}

interface PullRow {
  number: number;
  draft: boolean;
  auto_merge: unknown | null;
  mergeable_state?: string;
  mergeable?: boolean | null;
  head: { sha: string; ref: string };
  base: { ref: string };
}

interface CheckRunRow {
  name: string;
  status: string;
  conclusion: string | null;
  completed_at: string | null;
  id: number;
  check_suite?: { id: number };
  details_url?: string;
}

/** Branches checked out in ANY worktree of this clone, plus the shared view. */
function heldBranches(): Set<string> {
  const { out } = git(["worktree", "list", "--porcelain"]);
  const held = new Set<string>();
  for (const line of out.split("\n")) {
    if (line.startsWith("branch refs/heads/")) held.add(line.slice("branch refs/heads/".length).trim());
  }
  return held;
}

/**
 * Paginate check-runs. `main`'s tip carries ~110, well past the default page of
 * 30, and a truncated list reads exactly like a PR with fewer checks — i.e. like
 * a healthier one.
 */
function checkRunsFor(sha: string): CheckRunRow[] {
  const rows: CheckRunRow[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = ghGet<{ total_count: number; check_runs: CheckRunRow[] }>(
      `repos/${REPO}/commits/${sha}/check-runs?per_page=100&page=${String(page)}`,
    );
    if (!r.ok) break;
    rows.push(...r.body.check_runs);
    if (r.body.check_runs.length < 100) break;
  }
  return rows;
}

/** Subject paths of a failing check, from its annotations. Empty means NOT DERIVABLE. */
function subjectPathsFor(checkRunId: number): string[] {
  const r = ghGet<{ path: string }[]>(`repos/${REPO}/check-runs/${String(checkRunId)}/annotations?per_page=50`);
  if (!r.ok) return [];
  const paths = new Set<string>();
  for (const a of r.body) {
    // GitHub uses ".github" as the path for run-level annotations with no file.
    if (a.path && a.path !== ".github") paths.add(a.path);
  }
  return [...paths];
}

function runIdFromDetailsUrl(url: string | undefined): number | null {
  if (!url) return null;
  const m = /\/actions\/runs\/(\d+)/.exec(url);
  return m ? Number(m[1]) : null;
}

function gather(pr: PullRow, held: Set<string>, mainTipDate: string, openByRef: Map<string, number>): PrFacts {
  const sha = pr.head.sha;

  // Merge ref: the only honest way to know whether GitHub CAN dispatch a run.
  const mergeRef = ghGet<unknown>(`repos/${REPO}/git/ref/pull/${String(pr.number)}/merge`);
  const mergeRefExists = mergeRef.ok;

  // MEASURE mergeability locally. Never read `mergeable_state` for this.
  git(["fetch", "--quiet", "origin", `pull/${String(pr.number)}/head`]);
  const have = git(["cat-file", "-e", `${sha}^{commit}`]);
  let localMerge: PrFacts["localMerge"] = "unknown";
  let conflictPaths: string[] = [];
  let behindBy = 0;
  let diffPaths: string[] = [];

  if (have.rc === 0) {
    const mt = git(["merge-tree", "--write-tree", "--name-only", "origin/main", sha]);
    if (mt.rc === 0) {
      localMerge = "clean";
    } else if (mt.rc === 1) {
      localMerge = "conflict";
      // Output is <tree-oid>\n then the conflicted path list.
      conflictPaths = mt.out
        .split("\n")
        .slice(1)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("Auto-merging") && !s.startsWith("CONFLICT"));
    } else {
      localMerge = "unknown";
    }
    const rl = git(["rev-list", "--count", `${sha}..origin/main`]);
    if (rl.rc === 0) behindBy = Number(rl.out.trim());
    const mb = git(["merge-base", "origin/main", sha]);
    if (mb.rc === 0) {
      const df = git(["diff", "--name-only", `${mb.out.trim()}..${sha}`]);
      if (df.rc === 0)
        diffPaths = df.out
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
    }
  }

  const runs = checkRunsFor(sha);
  const checks: CheckFact[] = runs.map((r) => {
    const failed = r.conclusion === "failure" || r.conclusion === "timed_out";
    return {
      name: r.name,
      conclusion: r.conclusion as CheckFact["conclusion"],
      status: r.status as CheckFact["status"],
      completedAt: r.completed_at,
      runId: runIdFromDetailsUrl(r.details_url),
      subjectPaths: failed ? subjectPathsFor(r.id) : [],
    };
  });

  // A lane is frozen when its head IS the current remote lane tip and it is the
  // sole open PR for that ref, so no later flush will supersede it.
  const isLane = pr.head.ref.startsWith("heartbeat/");
  const laneTip = isLane ? git(["ls-remote", "origin", `refs/heads/${pr.head.ref}`]) : { rc: 1, out: "" };
  const laneTipSha = laneTip.rc === 0 ? laneTip.out.split("\t")[0]?.trim() : "";
  const isFrozenLane = isLane && laneTipSha === sha && (openByRef.get(pr.head.ref) ?? 0) === 1;

  const remoteMergeable: PrFacts["remoteMergeable"] =
    pr.mergeable === true ? "MERGEABLE" : pr.mergeable === false ? "CONFLICTING" : "UNKNOWN";

  // Workflow-SCOPED, not repo-wide: at ~250 merges/day the repo-wide runs
  // endpoint is minutes deep before it reaches anything relevant.
  const wf = ghGet<{
    workflow_runs: { id: number; run_attempt: number; status: string; conclusion: string | null }[];
  }>(`repos/${REPO}/actions/workflows/gate.yml/runs?head_sha=${sha}&per_page=20`);
  const wfRuns = wf.ok ? wf.body.workflow_runs : [];
  const priorRerunAttempts = Math.max(0, ...wfRuns.map((r) => r.run_attempt - 1), 0);

  // The newest gate RUN for this head, and its JOB COUNT — the two facts that
  // separate "held for approval" (run exists, zero jobs) from "never dispatched"
  // (no run at all). The jobs endpoint is per-run, so this costs one extra GET
  // and only when a run exists.
  const latest = wfRuns[0] ?? null;
  let gateRun: PrFacts["gateRun"] = null;
  if (latest) {
    const jobs = ghGet<{ total_count: number }>(`repos/${REPO}/actions/runs/${String(latest.id)}/jobs?per_page=1`);
    gateRun = {
      id: latest.id,
      status: latest.status,
      conclusion: latest.conclusion,
      // An unanswered jobs probe must not read as zero — zero is the positive
      // signal for the approval class, so defaulting to it would manufacture
      // the diagnosis. -1 means "not measured" and fails the detector's test.
      jobCount: jobs.ok ? jobs.body.total_count : -1,
    };
  }

  return {
    priorRerunAttempts,
    gateRun,
    number: pr.number,
    headSha: sha,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    isDraft: pr.draft,
    autoMergeArmed: pr.auto_merge !== null,
    mergeRefExists,
    localMerge,
    conflictPaths,
    remoteMergeable,
    checks,
    requiredCheckNames: [REQUIRED_CHECK],
    diffPaths,
    behindBy,
    mainTipDate,
    branchHeldElsewhere: held.has(pr.head.ref),
    isFrozenLane,
  };
}

function main(): number {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const only = argv.includes("--pr") ? Number(argv[argv.indexOf("--pr") + 1]) : null;

  git(["fetch", "--quiet", "origin", "main"]);
  const tip = git(["log", "-1", "--format=%cI", "origin/main"]);
  const mainTipDate = tip.rc === 0 ? tip.out.trim() : "";

  const list = ghGet<PullRow[]>(`repos/${REPO}/pulls?state=open&per_page=100`);
  if (!list.ok) {
    console.error(`could not list PRs (HTTP ${String(list.status)})`);
    return 1;
  }

  const openByRef = new Map<string, number>();
  for (const p of list.body) openByRef.set(p.head.ref, (openByRef.get(p.head.ref) ?? 0) + 1);

  const held = heldBranches();
  const targets = only === null ? list.body : list.body.filter((p) => p.number === only);

  const proposals: Proposal[] = [];
  for (const p of targets) {
    // The list endpoint omits `mergeable`; only the single-PR endpoint computes it.
    const one = ghGet<PullRow>(`repos/${REPO}/pulls/${String(p.number)}`);
    const full = one.ok ? one.body : p;
    proposals.push(propose(gather(full, held, mainTipDate, openByRef)));
  }

  if (asJson) {
    console.log(JSON.stringify({ mainTipDate, proposals }, null, 2));
    return 0;
  }

  const auto = proposals.filter((p) => p.autoExecutable);
  const unknown = proposals.filter((p) => p.disposition.kind === "Unknown");
  const escalate = proposals.filter((p) => p.disposition.kind === "NeedsIntelligence");

  console.log(`main tip ${mainTipDate}   ${String(proposals.length)} open PR(s)\n`);
  for (const p of proposals) console.log(renderProposal(p));
  console.log(
    [
      "",
      `ready-to-run (idempotent + reversible): ${String(auto.length)}`,
      `proposals needing a decision:            ${String(proposals.length - auto.length)}`,
      `Unknown (diagnosis failed):              ${String(unknown.length)}`,
      `NeedsIntelligence (remedy escalated):    ${String(escalate.length)}`,
      "",
      "Nothing above was executed. Every row is a proposal; acceptance is the",
      "receiving agent's decision under its own local policy.",
    ].join("\n"),
  );
  return 0;
}

if (import.meta.main) process.exit(main());

export { ghGet, git, mayAutoExecute };
