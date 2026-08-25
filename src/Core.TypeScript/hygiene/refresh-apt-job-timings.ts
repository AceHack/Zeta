#!/usr/bin/env bun
// refresh-apt-job-timings.ts — MEASURE the non-apt wall time of every job the
// apt-budget audit governs, from real GitHub Actions runs.
//
// WHY THIS EXISTS. `audit-apt-budget-fits-job-timeout.ts` asks whether a job's
// `timeout-minutes` can hold the apt wall budget PLUS everything else that job
// does. "Everything else" is not a constant — it is 71s for the local-LLM lane
// and 571s for the 1-vCPU low-memory lane — so the audit cannot carry a single
// number for it without guessing for the other 44 jobs. This script measures it
// instead, per job, and writes `apt-job-timings.measured.json`.
//
// WHAT IS MEASURED, exactly:
//
//     nonApt(run) = (job wall seconds) - (longest single apt phase in that run)
//
// An apt phase is delimited in the job's own log by the markers `tools/setup/linux.sh`
// prints: `↓ installing apt packages` ... `✓ apt packages up to date`. The LONGEST
// phase is subtracted rather than the sum because the budget bounds ONE invocation:
// the docker legs run install.sh three times per job, and the worst case the audit
// has to survive is one of those three spending its whole budget while the other
// two cost what they normally cost.
//
// THE AUDIT NEVER RUNS THIS. It reads the committed JSON and nothing else — no
// network, no token, no rate limit. A check whose data source can fail open is the
// vacuity class, and an audit that silently passes when the API is down is exactly
// the failure the audit itself was written to stop. The cost of that choice is
// stated where it lands: the committed measurement can go stale, so the JSON
// carries `measuredAt`, the sampled run ids, and the sample window, and the audit
// FAILS on any governed job the file does not mention at all.
//
// Rule 0: TypeScript, no new .sh files (`.claude/rules/rule-0-no-sh-files.md`).
//
// Usage:
//   gh auth status                      # this script needs a working `gh`
//   bun src/Core.TypeScript/hygiene/refresh-apt-job-timings.ts            # rewrite the JSON
//   bun src/Core.TypeScript/hygiene/refresh-apt-job-timings.ts --dry-run  # print, write nothing
//   RUNS=40 SAMPLES=20 ZETA_APT_TIMING_CACHE=.cache/apt-timings bun ...
//
// Exit codes: 0 = wrote (or printed) a table; 1 = could not measure anything.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { auditRepo, TIMINGS_PATH, type InstallerJob } from "./audit-apt-budget-fits-job-timeout";

const REPO = process.env["ZETA_TIMING_REPO"] ?? "Lucent-Financial-Group/Zeta";
/** How many recent workflow runs to list per workflow file. */
const RUNS = Number(process.env["RUNS"] ?? "40");
/** How many successful runs of each job to open logs for. */
const SAMPLES = Number(process.env["SAMPLES"] ?? "20");

const TS = String.raw`(\d{4}-\d\d-\d\dT[\d:.]+Z)`;
const APT_START = new RegExp(TS + String.raw`.*↓ installing apt packages`);
const APT_END = new RegExp(TS + String.raw`.*✓ apt packages up to date`);
/** Lines worth keeping out of a multi-megabyte log. */
const APT_MARKER = /↓ installing apt packages|✓ apt packages up to date/;

/**
 * Read a file, or null when it is not there. `existsSync` then `readFileSync` is a
 * check-then-use race (the file can vanish between the two calls, and the read then
 * throws where the caller was promised a miss); one guarded read has no window.
 */
function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function cacheDir(kind: string): string | null {
  const base = process.env["ZETA_APT_TIMING_CACHE"];
  if (!base) return null;
  const dir = join(base, kind);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function ghJson(path: string): unknown {
  const dir = cacheDir("cache");
  const file = dir === null ? null : join(dir, `${path.replace(/[^\w.-]/g, "_")}.json`);
  const cached = file === null ? null : readIfPresent(file);
  if (cached !== null) return JSON.parse(cached);
  const res = spawnSync("gh", ["api", path], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (res.status !== 0) {
    process.stderr.write(`gh api ${path} failed: ${(res.stderr ?? "").slice(0, 300)}\n`);
    return null;
  }
  if (file !== null) writeFileSync(file, res.stdout);
  return JSON.parse(res.stdout);
}

/** The apt-marker lines of one job's log, cached; "" when the log could not be read. */
function jobLogMarkers(jobId: number): string {
  const dir = cacheDir("aptcache");
  const file = dir === null ? null : join(dir, `${String(jobId)}.txt`);
  const cached = file === null ? null : readIfPresent(file);
  if (cached !== null) return cached;
  const res = spawnSync("gh", ["api", `/repos/${REPO}/actions/jobs/${String(jobId)}/logs`], {
    encoding: "utf8",
    maxBuffer: 1 << 29,
  });
  const kept = (res.stdout ?? "")
    .split("\n")
    .filter((l) => APT_MARKER.test(l))
    .join("\n");
  if (file !== null) writeFileSync(file, kept);
  return kept;
}

/** Seconds of every start..end apt phase in one job log, in order. */
export function aptPhaseSeconds(markerLines: string): number[] {
  const out: number[] = [];
  let open: string | null = null;
  for (const line of markerLines.split("\n")) {
    const s = APT_START.exec(line);
    if (s?.[1] !== undefined) {
      open = s[1];
      continue;
    }
    const e = APT_END.exec(line);
    if (e?.[1] !== undefined && open !== null) {
      out.push((Date.parse(e[1]) - Date.parse(open)) / 1000);
      open = null;
    }
  }
  return out;
}

/** Nearest-rank p90 — the value at or below which 90% of the samples fall. */
export function p90(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(0.9 * s.length) - 1))] ?? Number.NaN;
}

/**
 * The name the Actions API reports for a YAML job key, and its literal prefix.
 * A matrix job's `name:` carries `${{ }}`, so only the literal head can be matched.
 */
export function apiNameMatcher(workflowYaml: string, jobKey: string): (apiName: string) => boolean {
  const doc = parseYaml(workflowYaml) as { jobs?: Record<string, { name?: unknown }> } | null;
  const declared = doc?.jobs?.[jobKey]?.name;
  const display = typeof declared === "string" ? declared : jobKey;
  const literalHead = (display.split("${{")[0] ?? display).trim();
  return (apiName: string): boolean => {
    if (apiName === display) return true;
    if (literalHead.length === 0 || !apiName.startsWith(literalHead)) return false;
    // A matrix expands to macOS and Windows legs too; the apt phase is Linux-only.
    const low = apiName.toLowerCase();
    return !low.includes("macos") && !low.includes("windows");
  };
}

interface Sample {
  readonly runId: number;
  readonly jobId: number;
  readonly created: string;
  readonly jobSeconds: number;
  readonly aptSeconds: number;
}

function samplesFor(job: InstallerJob, root: string): Sample[] {
  const yaml = readFileSync(join(root, ".github/workflows", job.workflow), "utf8");
  const matches = apiNameMatcher(yaml, job.job);
  const runs = ghJson(`/repos/${REPO}/actions/workflows/${job.workflow}/runs?per_page=${String(RUNS)}`) as {
    workflow_runs?: { id: number; created_at: string }[];
  } | null;
  const out: Sample[] = [];
  for (const run of runs?.workflow_runs ?? []) {
    if (out.length >= SAMPLES) break;
    const jobs = ghJson(`/repos/${REPO}/actions/runs/${String(run.id)}/jobs?per_page=100`) as {
      jobs?: { id: number; name: string; conclusion: string; started_at: string; completed_at: string }[];
    } | null;
    for (const jb of jobs?.jobs ?? []) {
      if (out.length >= SAMPLES) break;
      if (jb.conclusion !== "success" || !matches(jb.name)) continue;
      const phases = aptPhaseSeconds(jobLogMarkers(jb.id));
      // No apt phase in the log = the job short-circuited (path gate, cache-only leg)
      // and measured nothing about this invariant. Skipping it is not a skipped CHECK;
      // a job with zero usable samples is reported as unmeasured below.
      if (phases.length === 0) continue;
      out.push({
        runId: run.id,
        jobId: jb.id,
        created: run.created_at,
        jobSeconds: (Date.parse(jb.completed_at) - Date.parse(jb.started_at)) / 1000,
        aptSeconds: Math.max(...phases),
      });
    }
  }
  return out;
}

/**
 * The text a demotion carries until a human investigates it.
 *
 * WHY IT IS AN EXPLICIT SENTINEL RATHER THAN JUST A STRING. This generator can see THAT
 * a job could not be measured; only a human can say WHY. The honest interim value is a
 * marker — but a marker that reaches the committed artifact is the vacuity class in one
 * of its purest forms: a `reason` field that says nothing while looking filled in, and
 * reads to every later reviewer as an investigated, documented decision. Every downstream
 * consumer of this file treats `unmeasured[].reason` as evidence; the placeholder is
 * evidence-shaped and carries none.
 *
 * So the sentinel exists to be REFUSED, not to be shipped. `main` will not write the file
 * — not even under `--dry-run` — while any demotion still carries it.
 */
export function placeholderReason(): string {
  return `no successful run in the last ${String(RUNS)} carried an apt phase in its log — WRITE THE REAL REASON HERE BY HAND`;
}

/**
 * Recognise the placeholder in a reason that may have been lightly edited around it.
 * Substring, not equality: a human who prepends context but leaves the shout intact has
 * not supplied a reason, and equality would let that through.
 */
export function isPlaceholderReason(reason: string): boolean {
  return reason.includes("WRITE THE REAL REASON HERE BY HAND");
}

export function main(argv: string[]): number {
  const root = resolve(process.env["REPO_ROOT"] ?? process.cwd());
  const governed = auditRepo(root, { skipAdjudication: true }).jobs;
  // Hand-written reasons survive a refresh. The generator can see THAT a job could not
  // be measured; only a human can say why, and overwriting that with a machine sentence
  // every time would turn the honest admission back into a shrug.
  const priorText = readIfPresent(join(root, TIMINGS_PATH));
  const prior =
    priorText === null
      ? {}
      : (JSON.parse(priorText) as { $comment?: unknown; unmeasured?: { key: string; reason: string }[] });
  const priorReason = new Map((prior.unmeasured ?? []).map((u) => [u.key, u.reason]));
  const measured: Record<string, unknown>[] = [];
  const unmeasured: { key: string; reason: string }[] = [];
  // Ordinal, never `localeCompare`: the emitted file is a committed artifact and its row
  // order must not depend on the locale of whoever refreshed it
  // (`.claude/rules/culture-invariant-by-default.md`).
  const ordinal = (a: InstallerJob, b: InstallerJob): number => {
    const ka = `${a.workflow}:${a.job}`;
    const kb = `${b.workflow}:${b.job}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
  for (const j of [...governed].sort(ordinal)) {
    const key = `${j.workflow}:${j.job}`;
    const s = samplesFor(j, root);
    if (s.length === 0) {
      const carried = priorReason.get(key);
      unmeasured.push({
        key,
        // A prior reason that IS the placeholder is not a reason; treat it as absent so
        // a placeholder that somehow reached the file cannot launder itself into a
        // "hand-written reason survives a refresh" on the next run.
        reason: carried !== undefined && !isPlaceholderReason(carried) ? carried : placeholderReason(),
      });
      process.stderr.write(`${key}: UNMEASURED\n`);
      continue;
    }
    const nonApt = s.map((x) => x.jobSeconds - x.aptSeconds);
    measured.push({
      key,
      samples: s.length,
      nonAptP90Seconds: Math.ceil(p90(nonApt)),
      nonAptMaxSeconds: Math.ceil(Math.max(...nonApt)),
      aptP90Seconds: Math.ceil(p90(s.map((x) => x.aptSeconds))),
      window: `${s[s.length - 1]?.created ?? "?"} .. ${s[0]?.created ?? "?"}`,
      runIds: s.map((x) => x.runId),
    });
    process.stderr.write(`${key}: n=${String(s.length)} nonApt p90=${String(Math.ceil(p90(nonApt)))}s\n`);
  }
  if (measured.length === 0) {
    process.stderr.write("measured nothing — refusing to write a file that would make the audit vacuous\n");
    return 1;
  }
  // REFUSE TO SHIP THE PLACEHOLDER. See `placeholderReason` for why this is a refusal
  // and not a warning. The refusal comes BEFORE the write and covers `--dry-run` too:
  // a dry run that printed the document and exited 0 would let a caller read success
  // from a document that must not be committed.
  const stillPlaceholder = unmeasured.filter((u) => isPlaceholderReason(u.reason)).map((u) => u.key);
  if (stillPlaceholder.length > 0) {
    process.stderr.write(
      `refusing to emit ${String(stillPlaceholder.length)} demotion(s) whose reason is still the placeholder:\n` +
        stillPlaceholder.map((k) => `  ${k}\n`).join("") +
        `Investigate each, then write the real reason into the \`unmeasured\` entry in ${TIMINGS_PATH}\n` +
        "and re-run. A generated file is not written until every demotion says something true.\n",
    );
    return 1;
  }
  // The prose header is hand-written and explains what the numbers mean; a refresh
  // must not silently delete it.
  const doc = {
    $comment: prior.$comment,
    measuredAt: new Date().toISOString().slice(0, 10),
    generator: "src/Core.TypeScript/hygiene/refresh-apt-job-timings.ts",
    jobs: measured,
    unmeasured,
  };
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  if (argv.includes("--dry-run")) process.stdout.write(text);
  else writeFileSync(join(root, TIMINGS_PATH), text);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
