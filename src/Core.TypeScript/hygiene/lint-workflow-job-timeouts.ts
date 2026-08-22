#!/usr/bin/env bun
// lint-workflow-job-timeouts.ts — every GitHub Actions job must declare `timeout-minutes`.
//
// Why: a job with no timeout can hold a runner until the platform cap (6h). On 2026-08-18
// `lint-autofix` / produce-patch held a slot for 90+ minutes and `backlog-index-integrity`
// for 140.5 minutes; both were stalled inside `tools/setup/install.sh` on a hung
// azure.archive.ubuntu.com apt mirror. Slots never freed, new work queued, concurrency
// cancelled the constituent lint jobs, and `gate (required)` read cancelled as failure —
// PRs went red with no real defect. Congestion collapse from one missing bound.
//
// The retry budget is MULTIPLICATIVE, which is why the bound is the only real backstop:
// linux.sh retries apt 3x at 600s each (~30m), and callers wrap install.sh in a 5-attempt
// loop — so the theoretical ceiling of one unbounded job is measured in hours.
// tools/setup/linux.sh says so itself: the job `timeout-minutes` is what finally fires.
//
// GitHub offers NO repo-level or org-level default job timeout, and workflow `defaults:`
// covers only `run` shell/working-directory. Per-job declaration is the only mechanism,
// so this lint is what keeps the class closed as workflows are added.
//
// Exit 0 = every job bounded · 1 = lists the unbounded jobs.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A job that delegates to a reusable workflow (`uses:` at job level) may NOT declare
// timeout-minutes — GitHub rejects it. Those are exempt by shape, not by allowlist.
const WORKFLOW_DIR = ".github/workflows";

// Scan floor: a check that inspects nothing passes vacuously. This repo had 108 jobs
// across 69 workflows when the lint was written; refuse to report success on a scan
// that found implausibly few.
const MIN_JOBS_EXPECTED = 60;

type Job = { file: string; job: string; line: number; bounded: boolean; reusable: boolean };

export function scanWorkflowJobs(dir: string): Job[] {
  const jobs: Job[] = [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort();
  for (const file of files) {
    const lines = readFileSync(join(dir, file), "utf8").split("\n");
    let inJobs = false;
    let cur: Job | null = null;
    const flush = () => { if (cur) jobs.push(cur); cur = null; };
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? "";
      if (/^jobs:\s*$/.test(raw)) { inJobs = true; continue; }
      if (!inJobs) continue;
      // any column-0 key ends the jobs block
      if (/^\S/.test(raw)) { flush(); inJobs = false; continue; }
      const header = raw.match(/^ {2}([A-Za-z0-9_-]+):\s*(#.*)?$/);
      if (header) { flush(); cur = { file, job: header[1] ?? "", line: i + 1, bounded: false, reusable: false }; continue; }
      if (!cur) continue;
      // job-level keys are at indent 4; anything deeper belongs to a step
      if (/^ {4}timeout-minutes:/.test(raw)) cur.bounded = true;
      if (/^ {4}uses:/.test(raw)) cur.reusable = true;
    }
    flush();
  }
  return jobs;
}

if (import.meta.main) {
  const jobs = scanWorkflowJobs(WORKFLOW_DIR);

  if (jobs.length < MIN_JOBS_EXPECTED) {
    console.error(
      `FAIL: scan floor — found only ${jobs.length} job(s) in ${WORKFLOW_DIR} (expected >= ${MIN_JOBS_EXPECTED}).`,
    );
    console.error("  A check that inspects nothing is not a check. Fix the scan, not the floor.");
    process.exit(1);
  }

  const unbounded = jobs.filter((j) => !j.bounded && !j.reusable);
  if (unbounded.length > 0) {
    console.error(`FAIL: ${unbounded.length} workflow job(s) declare no timeout-minutes:`);
    for (const j of unbounded) console.error(`  ${j.file}:${j.line}  job "${j.job}"`);
    console.error("");
    console.error("  An unbounded job can hold a runner until the 6h platform cap. Base the");
    console.error("  value on observed durations from the Actions API, not a guess: a bound");
    console.error("  below the honest p99 turns a slow job into a red one.");
    process.exit(1);
  }

  const reusable = jobs.filter((j) => j.reusable).length;
  console.log(
    `ok: all ${jobs.length - reusable} workflow job(s) declare timeout-minutes` +
      (reusable > 0 ? ` (${reusable} reusable-workflow call(s) exempt by shape)` : ""),
  );
}
