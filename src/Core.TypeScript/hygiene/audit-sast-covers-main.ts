#!/usr/bin/env bun
// audit-sast-covers-main.ts — the premise under Scorecard alert #24, enforced.
//
// ALERT #24 SAYS: "SAST tool detected but not run on all commits: 12 commits out of 29 are
// checked with a SAST tool". Score 8, open since 2026-04-27, re-reported on every Scorecard
// run including today's.
//
// IT IS TRUE, AND IT IS NOT A HOLE IN `main`. Measured 2026-09-13, and the reconciliation
// took four attempts, three of which were wrong:
//
//   1. "main commits are unscanned"        -> REFUTED. 30 of the last 30 commits on `main`
//                                             carry a SUCCESSFUL `Analyze (*)` check run.
//   2. "merged PR heads are unscanned"     -> REFUTED. 29 of 29 carry one.
//   3. "Scorecard counts the `github-code-scanning` app's check runs, and we have none"
//                                          -> REFUTED as an explanation. We do have none --
//                                             all 106 check runs on `main` come from
//                                             `github-actions` -- but that model predicted
//                                             ~12 present and measured 0, so it is not what
//                                             Scorecard is counting.
//   4. "intermediate commits inside multi-commit PRs are unscanned"  -> CONFIRMED.
//
// The mechanism is that CodeQL runs per PUSH, not per COMMIT. A PR pushed as one commit has
// that commit scanned; a PR pushed as ten has the tip of each push scanned and the rest not:
//
//     PR #17394   2 commits    2 scanned
//     PR #5323    3 commits    2 scanned
//     PR #17341  10 commits    4 scanned
//
// Scorecard's own wording is "12 COMMITS out of 29", and that is the population: recent
// commits, including the intermediate ones.
//
// WHY THAT IS NOT A DEFECT HERE. This repository squash-merges. An intermediate commit on a
// PR branch is DISCARDED at merge and never becomes part of `main`'s history, so it is code
// that never ships. The property that matters -- every commit that actually lands is scanned
// -- holds, and this file is what keeps that claim honest rather than asserted.
//
// A MEASUREMENT MISTAKE WORTH RECORDING, because it produced a clean-looking false pattern.
// The first pass at hypothesis 4 reported `scanned=0` for every multi-commit PR, which read
// as a crisp all-or-nothing rule. It was a broken loop: a nested `gh api` inside a piped
// `while read` had its stdin consumed, so the inner call returned empty and every commit
// counted as unscanned. The real numbers are above. A measurement that produces a tidier
// story than the truth is the one to re-run.
//
// WHAT THIS CHECKS: every commit reachable from `main` in the sampled window carries at
// least one `Analyze (*)` check run whose conclusion is `success`. It goes red the day that
// stops being true -- which is the day the dismissal of #24 stops being justified.
//
// Run:  bun src/Core.TypeScript/hygiene/audit-sast-covers-main.ts [--window N] [--json FILE]
//
// OFFLINE BY DESIGN when handed `--json`: the network shape is separated from the verdict so
// the rule is unit-testable without a token. See the tests.

export interface CommitScan {
  readonly sha: string;
  /** Successful `Analyze (*)` check runs on this commit. */
  readonly successfulAnalyze: number;
  /** Analyze runs that exist but did not succeed -- cancelled counts here, never as coverage. */
  readonly unsuccessfulAnalyze: number;
}

export interface Verdict {
  readonly ok: boolean;
  readonly scanned: number;
  readonly unscanned: readonly string[];
  readonly degraded: readonly string[];
  readonly message: string;
}

/**
 * A commit is COVERED only when a successful Analyze run exists. A cancelled or failed run
 * is not coverage -- that distinction is the whole point, and counting run EXISTENCE instead
 * of run OUTCOME is how the first measurement of this defect reported 30/30 while a third of
 * the workflow runs on `main` were being cancelled.
 */
export function judge(commits: readonly CommitScan[]): Verdict {
  if (commits.length === 0) {
    return {
      ok: false,
      scanned: 0,
      unscanned: [],
      degraded: [],
      message: "sampled zero commits — the premise was not evaluated, and not-evaluated is not satisfied",
    };
  }
  const unscanned = commits.filter((c) => c.successfulAnalyze === 0).map((c) => c.sha);
  const degraded = commits.filter((c) => c.successfulAnalyze > 0 && c.unsuccessfulAnalyze > 0).map((c) => c.sha);
  const scanned = commits.length - unscanned.length;
  if (unscanned.length > 0) {
    return {
      ok: false,
      scanned,
      unscanned,
      degraded,
      message:
        `${String(unscanned.length)} of ${String(commits.length)} commits on main carry NO successful Analyze run: ` +
        `${unscanned.map((s) => s.slice(0, 9)).join(", ")}. The premise under the dismissal of Scorecard #24 — ` +
        `"every commit that lands is scanned" — no longer holds.`,
    };
  }
  return {
    ok: true,
    scanned,
    unscanned: [],
    degraded,
    message:
      `all ${String(commits.length)} sampled commits on main carry a successful Analyze run` +
      (degraded.length > 0
        ? ` (${String(degraded.length)} also had a non-successful Analyze run alongside it, which is noted, not counted as coverage)`
        : ""),
  };
}

// ── the network half, kept apart from `judge` so the rule is testable without a token ──
//
// API COST IS PART OF THE DESIGN HERE, not an afterthought. This runs in `drift (loud)` on
// every PR and every push, and `.claude/rules/rest-is-the-default-transport-graphql-is-the-
// contested-budget.md` exists because this fleet has exhausted a 5000/hour budget before --
// by OBSERVATION, not action. So the cost is measured and written down.
//
// MEASURED 2026-09-13 with a shim counting every `gh` invocation, window=30:
//
//     first version   77 calls   20 paging the COMMITS list + 57 check-runs
//     this version    31 calls    1 commits (per_page=window) + 30 check-runs
//
// The 20 was a defect, not a cost: the original helper paged the commit list to exhaustion
// -- about 2000 commits -- and THEN sliced to 30. Nineteen calls fetched data that was
// immediately discarded. Asking for exactly `window` commits in one request is the whole fix.
//
// The remaining 30 is irreducible over REST: there is no endpoint that returns check runs for
// many commits at once. GraphQL could do it in one query and is deliberately NOT used --
// that is the contested budget, and this is an observation loop, which is exactly the class
// the rule says must stay on REST.
//
// Per-commit paging stops as soon as a successful Analyze run is found, because that alone
// decides the verdict. A commit whose first page is all non-success and whose `total_count`
// says more exist is paged further rather than assumed unscanned -- a short read must not be
// able to manufacture a failure any more than it can manufacture a pass.

const MAX_WINDOW = 100; // one page; a larger window would reintroduce commit-list paging

interface CheckRunsPage {
  readonly total_count: number;
  readonly check_runs: readonly { readonly name: string; readonly conclusion: string | null }[];
}

async function ghJson(path: string): Promise<unknown> {
  const proc = Bun.spawn(["gh", "api", path], { stdout: "pipe", stderr: "pipe" });
  const text = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new Error(`gh api failed: ${path}`);
  return JSON.parse(text);
}

/** Scan one commit, paging only while the answer is still undecided. */
export async function scanCommit(repo: string, sha: string): Promise<CommitScan> {
  let ok = 0;
  let bad = 0;
  let seen = 0;
  for (let page = 1; page <= 10; page += 1) {
    const body = (await ghJson(
      `repos/${repo}/commits/${sha}/check-runs?per_page=100&page=${String(page)}`,
    )) as CheckRunsPage;
    seen += body.check_runs.length;
    for (const r of body.check_runs) {
      if (!r.name.startsWith("Analyze")) continue;
      if (r.conclusion === "success") ok += 1;
      else bad += 1;
    }
    // Decided: a success is all the verdict needs. Stop paying for pages.
    if (ok > 0) break;
    // Undecided and the page was short of what the forge says exists -> keep going.
    if (seen >= body.total_count || body.check_runs.length === 0) break;
  }
  return { sha, successfulAnalyze: ok, unsuccessfulAnalyze: bad };
}

async function main(argv: readonly string[]): Promise<number> {
  const at = argv.indexOf("--window");
  const window = Math.min(at >= 0 ? Number(argv[at + 1] ?? "30") : 30, MAX_WINDOW);
  const jsonAt = argv.indexOf("--json");

  let commits: CommitScan[];
  if (jsonAt >= 0) {
    const p = argv[jsonAt + 1];
    if (p === undefined) {
      console.error("--json requires a path");
      return 2;
    }
    commits = JSON.parse(await Bun.file(p).text()) as CommitScan[];
  } else {
    const repo = process.env.GITHUB_REPOSITORY ?? "Lucent-Financial-Group/Zeta";
    // ONE call. `per_page` is the window, so nothing is fetched that is not used.
    const listed = (await ghJson(`repos/${repo}/commits?sha=main&per_page=${String(window)}`)) as {
      readonly sha: string;
    }[];
    commits = [];
    for (const { sha } of listed) commits.push(await scanCommit(repo, sha));
  }

  const v = judge(commits);
  console.log(`[sast-covers-main] ${v.message}`);
  for (const s of v.unscanned) console.error(`  UNSCANNED ${s}`);
  return v.ok ? 0 : 1;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
