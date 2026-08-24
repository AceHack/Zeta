/**
 * forge-host/github/check-observations.ts — the GitHub Actions implementation of the
 * `CheckObservationSource` half of the forge-host plugin contract.
 *
 * GitHub is *a* forge host, never *the* forge host. Everything specific to it lives
 * behind this file; the dashboard's fold never sees a workflow, a run id, or a
 * conclusion string.
 *
 * THE MEASUREMENT THAT DICTATES THE SHAPE (2026-08-22, this repo):
 *   • 81 active workflows.
 *   • `gh run list --branch main --limit 200` contained runs from **22** of them —
 *     heartbeat traffic saturates the window; its oldest run was from 15:25 the SAME DAY.
 *   • Latest-run-per-workflow immediately surfaced four workflows failing unseen,
 *     one of them red since 08-16.
 * A window sample is not a slow instrument. It is a structurally blind one, and its
 * blindness renders as green. So: roster first, then one query per roster entry, and
 * never a global window.
 *
 * CANCELLED IS NOT GREEN AND IT IS NOT RED. `platform-drift-report.ts` measured 265 of
 * 300 recent `gate` push runs `cancelled` — main pushes arrive faster than a run takes
 * and Actions cancels the older pending one. A cancelled run's legs never execute, so
 * it establishes NO verdict. Reporting it as anything but "we did not learn anything"
 * would be the vacuity class with an API response attached.
 */

import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { FerryThrottler, withFerries } from "../../ferry-throttler/ferry-throttler.ts";
import { err, forgeError, ok } from "../result.ts";
import type {
  CheckDefinition,
  CheckObservation,
  CheckObservationFailure,
  CheckObservationOpts,
  AttemptSummary,
  CheckExpectation,
  CheckObservationPass,
  ForgeError,
  Result,
  TriggerClass,
  Verdict,
} from "../types.ts";
import { runGhJsonAsync } from "./gh-cli.ts";
import { expectationFromWorkflow } from "./workflow-triggers.ts";

/** One workflow as the Actions API reports it. Satellite data — never folded on. */
export interface GhWorkflow {
  readonly id: number;
  readonly name: string;
  readonly path: string;
  readonly state: string;
}

/** One run as the Actions API reports it. Satellite data. */
export interface GhRun {
  readonly id: number;
  readonly status: string;
  readonly conclusion: string | null;
  readonly created_at: string;
  readonly updated_at?: string;
  readonly html_url?: string;
  readonly run_attempt?: number;
  /** Which event produced the run: `schedule`, `push`, `pull_request`, … */
  readonly event?: string;
}

/**
 * GitHub event name → the substrate-neutral trigger class.
 *
 * Only `schedule` counts as periodic. That is the whole point: a workflow whose cron
 * has never fired accumulates runs from `pull_request` and `workflow_dispatch` and
 * looks alive, and calling any of those "periodic" would launder exactly the fact the
 * dashboard needs to report.
 */
export function triggerClassForEvent(event: string | undefined): TriggerClass {
  if (event === undefined) return "unknown";
  if (event === "schedule") return "periodic";
  if (event === "push" || event === "merge_group") return "on-change";
  return "on-request";
}

/**
 * The CheckId a workflow maps to: its file's basename without extension.
 *
 * The workflow *name* is prose and churns; the numeric *id* is reissued when a file is
 * deleted and recreated. The path is what survives, and — the point — it is a name a
 * future author/verifier attestation can carry unchanged, which is what lets the same
 * check keep the same identity across the substrate migration.
 */
export function checkIdForWorkflow(path: string): string {
  return basename(path).replace(/\.(ya?ml)$/i, "");
}

/** Is this conclusion an actual verdict, or merely an outcome? */
export function isConclusive(conclusion: string | null): boolean {
  return conclusion !== null && ["success", "failure", "timed_out", "startup_failure", "action_required", "stale", "skipped", "neutral"].includes(conclusion);
}

/** One run → one verdict. Pure; the whole GitHub→neutral mapping is here. */
export function verdictForRun(run: GhRun): Verdict {
  if (run.status !== "completed") {
    return run.status === "in_progress" || run.status === "queued" || run.status === "waiting" || run.status === "requested" || run.status === "pending"
      ? { kind: "running" }
      : { kind: "unknown", reason: "not-observed-this-pass", detail: `run in state '${run.status}' establishes no verdict` };
  }
  switch (run.conclusion) {
    case "success":
      return { kind: "green" };
    case "failure":
    case "timed_out":
    case "startup_failure":
    case "action_required":
      return { kind: "red", detail: `run ${run.id} concluded '${run.conclusion}'` };
    case "skipped":
      return { kind: "skipped", detail: `run ${run.id} was skipped` };
    case "neutral":
      return { kind: "skipped", detail: `run ${run.id} concluded 'neutral'` };
    case "cancelled":
      // Its legs never executed. Absence of a verdict, not a passing one.
      return { kind: "unknown", reason: "not-observed-this-pass", detail: `run ${run.id} was CANCELLED — its jobs never executed, so it established no verdict` };
    case "stale":
      return { kind: "unknown", reason: "not-observed-this-pass", detail: `run ${run.id} concluded 'stale'` };
    default:
      return { kind: "unknown", reason: "not-observed-this-pass", detail: `run ${run.id} completed with conclusion '${String(run.conclusion)}'` };
  }
}

/**
 * Newest-first runs for one workflow → at most one observation.
 *
 * Prefers the newest run that actually ESTABLISHED a verdict, stepping past cancelled
 * runs and naming how many it stepped past — so a lane that is being continuously
 * cancelled reports its real last verdict *and* says the queue is eating it. When no
 * run in the fetched slice was conclusive, the newest run's own (unknown/running)
 * verdict is reported: still not green.
 *
 * An empty run list yields `null` — never a green. That omission is what the
 * dashboard's fold turns into a typed unknown or a red, against the persisted roster.
 */
export function observationForRuns(
  checkId: string,
  runs: readonly GhRun[],
  source: string,
): CheckObservation | null {
  if (runs.length === 0) return null;
  const conclusiveIndex = runs.findIndex((r) => r.status === "completed" && isConclusive(r.conclusion));
  const chosen = conclusiveIndex === -1 ? runs[0] : runs[conclusiveIndex];
  if (chosen === undefined) return null;
  const skipped = conclusiveIndex === -1 ? 0 : conclusiveIndex;
  const verdict: Verdict = verdictForRun(chosen);

  // What we saw while looking. A verdict alone cannot say "a newer run is in flight"
  // or "nothing has concluded here for weeks", and both of those hid a real failure in
  // this repo on 2026-08-22.
  const newer = runs.slice(0, Math.max(skipped, 0));
  const newerTimes = newer.map((r) => Date.parse(r.updated_at ?? r.created_at)).filter((t) => Number.isFinite(t));
  const attempts: AttemptSummary = {
    inspected: runs.length,
    withoutVerdict: runs.filter((r) => !(r.status === "completed" && isConclusive(r.conclusion))).length,
    newerThanVerdict: newer.length,
    newerSpanSeconds:
      newerTimes.length === 0
        ? 0
        : Math.round((Math.max(...newerTimes) - Math.min(...newerTimes, Date.parse(chosen.updated_at ?? chosen.created_at))) / 1000),
    recheckInFlight: runs[0] !== undefined && runs[0].status !== "completed",
    // Outcomes WITH their timestamps, newest first. Counts alone are time-blind: for a
    // rarely-run lane a 20-run window can reach back a quarter, and one old incident
    // then dominates the verdict permanently. The fold owns the windowing policy.
    concluded: runs
      .filter((r) => r.status === "completed" && isConclusive(r.conclusion) && r.conclusion !== "skipped" && r.conclusion !== "neutral")
      .map((r) => ({ at: r.updated_at ?? r.created_at, passed: r.conclusion === "success" })),
  };

  return {
    attempts,
    checkId,
    verdict,
    observedAt: chosen.updated_at ?? chosen.created_at,
    source,
    trigger: triggerClassForEvent(chosen.event),
    sourceDetail: {
      runId: String(chosen.id),
      status: chosen.status,
      conclusion: String(chosen.conclusion),
      ...(chosen.html_url === undefined ? {} : { url: chosen.html_url }),
      ...(chosen.event === undefined ? {} : { event: chosen.event }),
      ...(skipped > 0 ? { steppedPastInconclusiveRuns: String(skipped) } : {}),
    },
  };
}

/**
 * Workflow path + its source (or `null` if not in the tree) → its expectation.
 *
 * Pure, so the three-way classification below is exercised without a filesystem — the
 * first version of this logic lived inline in the enumeration loop and its only test
 * asserted string prefixes, which a mutation run correctly reported as surviving.
 *
 * **A path outside `.github/workflows/` is a HOST-MANAGED check** — `dynamic/pages/…`,
 * `dynamic/dependabot/…`, `dynamic/github-code-scanning/codeql`, the Copilot agents.
 * It was never declared in this repository, so calling it "absent from the repository"
 * would be a false red, and a false red is how a dashboard teaches people to stop
 * reading reds. Measured 2026-08-22: 11 active workflows had no file on `main` and 7
 * were host-managed; keeping them out of `definition-absent` is what leaves that class
 * meaning the one thing it should mean — the 4 genuine cases.
 */
export function expectationForWorkflow(
  path: string,
  source: string | null,
  ref: string,
): CheckExpectation {
  if (source !== null) return expectationFromWorkflow(source, ref);
  if (!path.startsWith(".github/workflows/")) {
    return {
      kind: "unknown",
      reason: "underivable",
      detail: `host-managed check '${path}' — never declared in this repository, so its trigger cannot be read from the tree`,
    };
  }
  return {
    kind: "unknown",
    reason: "definition-absent",
    detail: `workflow file '${path}' is registered ACTIVE on the forge host but is ABSENT from the repository`,
  };
}

/**
 * Attach a newer, different-trigger verdict to an observation as qualifying evidence.
 *
 * Only attaches when the rival is genuinely NEWER and genuinely from a DIFFERENT
 * trigger — otherwise it is the same fact twice and adds noise to a row whose whole
 * job is to be readable.
 */
export function withSuperseding(
  primary: CheckObservation,
  rival: CheckObservation | null,
): CheckObservation {
  if (rival === null) return primary;
  if (rival.trigger === primary.trigger) return primary;
  if (!(rival.observedAt > primary.observedAt)) return primary;
  return {
    ...primary,
    supersededBy: {
      verdict: rival.verdict,
      observedAt: rival.observedAt,
      trigger: rival.trigger ?? "unknown",
      detail: `a later ${rival.sourceDetail?.event ?? rival.trigger ?? "non-scheduled"} run concluded '${rival.verdict.kind}'`,
    },
  };
}

// ─── I/O edge ───────────────────────────────────────────────────────────────

export interface GhCheckSourceOptions {
  /** Root of the working tree, for reading workflow sources to derive expectations. */
  readonly repoRoot: string;
  /**
   * How many recent runs to inspect per workflow when looking for a real verdict.
   *
   * 20, not 5. `gate`'s last concluded verdict sat behind two `in_progress` and two
   * `cancelled` runs; `tlaps-proof` had 33 cancelled runs in its last 40. A window too
   * short to reach past the inconclusive ones reproduces the very defect this file
   * exists to remove, one layer down.
   */
  readonly runsPerCheck?: number;
}

/**
 * Enumerate every ACTIVE workflow — the denominator.
 *
 * `per_page=100` with explicit pagination: a roster that silently truncates is the
 * same defect as a window sample, one layer down.
 */
/** Read a file, or `null` if it is not there. One syscall, one answer, no TOCTOU window. */
export function readFileOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT" || (e as NodeJS.ErrnoException).code === "EISDIR") return null;
    throw e;
  }
}

/**
 * Parse `git log --diff-filter=A --name-only --format=C%aI` output into
 * path → when the path was first added.
 *
 * Pure, so the parse is testable without a repository, and separated from the spawn so
 * the **one spawn** is a property a test can hold the implementation to.
 *
 * Commits arrive newest-first, so the LAST record naming a path is its earliest add;
 * this simply overwrites and ends holding the oldest.
 */
export function parseFirstAddDates(logOutput: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  let current: string | null = null;
  for (const raw of logOutput.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("C")) {
      current = line.slice(1);
      continue;
    }
    if (current !== null) out.set(line, current);
  }
  return out;
}

/**
 * When did each workflow file first land? **ONE `git log`, for every path at once.**
 *
 * The shape of this function is the fix for a measured failure, so the measurement is
 * recorded here rather than in a commit message nobody will find. The first version
 * called `git log --diff-filter=A --follow` **once per workflow**, inside a phase with
 * no degree-of-parallelism knob at all, via blocking `spawnSync`:
 *
 *   * measured with a counting shim on PATH: **73 `git` spawns + 87 `gh` spawns = 160
 *     subprocesses per pass**;
 *   * one `--follow` call costs ~0.22s here, so ~16s of pure serial subprocess time on
 *     an idle machine — and the first user of this tool, on a loaded machine with
 *     on-access AV scanning every spawn, **timed out at 540s and went back to their
 *     hand-rolled scan**;
 *   * the bulk call below costs **~0.22s for all 80 paths**.
 *
 * The lesson generalises past this function, and the sibling incident makes it a rule:
 * `src/Core.TypeScript/search/grep.ts` was built for exactly the incident it was meant
 * to prevent and failed because it was too slow to use. **A guard slower than the
 * unsafe path selects for the unsafe path** — being correct does not exempt a tool
 * from being reached for.
 *
 * **Honest limit:** the bulk form cannot use `--follow`, so a RENAMED workflow reports
 * the rename date rather than its original creation. That biases `definitionSince`
 * YOUNGER, which biases the verdict toward `not-yet-due` — the direction that declines
 * to alarm. Given `not-yet-due` exists precisely because a false alarm gets the guard
 * muted, trading rename fidelity for a usable tool is the right way round, and a
 * renamed workflow re-earns its full age one period later.
 */
export type GitLogRunner = (args: readonly string[]) => string | null;

const spawnGitLog: GitLogRunner = (args) => {
  const proc = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  return proc.exitCode === 0 ? new TextDecoder().decode(proc.stdout) : null;
};

export function definitionSinceForPaths(
  repoRoot: string,
  paths: readonly string[],
  // Injected so a test can COUNT the spawns. "One subprocess regardless of check
  // count" is the property that was violated; a property that matters is one a test
  // holds you to, not one a comment claims.
  run: GitLogRunner = spawnGitLog,
): ReadonlyMap<string, string> {
  if (paths.length === 0) return new Map();
  const out = run(["-C", repoRoot, "log", "--diff-filter=A", "--name-only", "--format=C%aI", "--", ".github/workflows/"]);
  return out === null ? new Map() : parseFirstAddDates(out);
}

export async function listGitHubCheckDefinitions(
  nwo: string,
  ref: string,
  options: GhCheckSourceOptions,
  sourceName: string,
): Promise<Result<readonly CheckDefinition[], ForgeError>> {
  const workflows: GhWorkflow[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await runGhJsonAsync<{ total_count: number; workflows: GhWorkflow[] }>([
      "api", `repos/${nwo}/actions/workflows?per_page=100&page=${page}`,
    ]);
    if (!res.ok) return res;
    workflows.push(...res.value.workflows);
    if (workflows.length >= res.value.total_count || res.value.workflows.length === 0) break;
  }

  // ONE git log for every path, before the map — not one per workflow inside it.
  const firstAdds = definitionSinceForPaths(options.repoRoot, workflows.map((w) => w.path));

  const definitions = workflows
    .filter((w) => w.state === "active")
    .map((w): CheckDefinition => {
      const abs = join(options.repoRoot, w.path);
      // Read and interpret the failure, never `existsSync`-then-read: the answer to the
      // check is already stale when the read runs (CWE-367), and "the workflow is
      // registered but has no file here" is a REAL and load-bearing state — it is the
      // `registered-but-absent` verdict — so it must come from the read itself.
      const source = readFileOrNull(abs);
      const expectation = expectationForWorkflow(w.path, source, ref);
      const definitionSince = source === null ? undefined : firstAdds.get(w.path);
      return {
        checkId: checkIdForWorkflow(w.path),
        displayName: w.name,
        expectation,
        source: sourceName,
        ...(definitionSince === undefined ? {} : { definitionSince }),
        sourceDetail: { workflowId: String(w.id), path: w.path, state: w.state },
      };
    });

  return ok(definitions.sort((a, b) => (a.checkId < b.checkId ? -1 : a.checkId > b.checkId ? 1 : 0)));
}

/**
 * Latest verdict per definition on `ref` — one query per check, never a window.
 *
 * Parallelised through `FerryThrottler`, whose `maxDegreeOfParallelism` **degrades to
 * 1** (`.claude/rules/async-all-the-way-truthful-signatures.md`): at DoP=1 this is a
 * single cooperative loop and the pass is deterministic and replayable; at DoP=N the
 * same code path drains the same queue. No `Task.Run`-shaped unthrottled fan-out — the
 * knob is the point, and results are sorted ordinally afterwards so the report does not
 * depend on completion order at any DoP.
 */
export async function listGitHubCheckObservations(
  nwo: string,
  ref: string,
  definitions: readonly CheckDefinition[],
  options: GhCheckSourceOptions,
  sourceName: string,
  opts?: CheckObservationOpts,
): Promise<Result<CheckObservationPass, ForgeError>> {
  const perCheck = options.runsPerCheck ?? 20;
  const branch = ref.replace(/^refs\/heads\//, "");
  const observations: CheckObservation[] = [];
  const failures: CheckObservationFailure[] = [];

  const dop = Math.max(1, opts?.maxDegreeOfParallelism ?? 1);
  const ferry = new FerryThrottler<CheckDefinition>(
    { ...withFerries(dop), maxBatchSize: 1 },
    async (boat) => {
      for (const def of boat) {
        const workflowId = def.sourceDetail?.workflowId;
        if (workflowId === undefined) {
          failures.push({ checkId: def.checkId, detail: "no workflowId in the definition's sourceDetail" });
          continue;
        }
        // For a PERIODIC check, ask the declared trigger DIRECTLY (`event=schedule`)
        // before asking "what ran most recently". A workflow whose cron has never
        // fired still accumulates pull_request and workflow_dispatch runs, and a
        // "latest run" query happily reports one of those as the check's verdict —
        // which is how a dead cadence renders green. `chart-version-refresh` is the
        // live instance: every run in its history is `event=pull_request` against a
        // declared `7 17 * * 0`.
        //
        // **But we now fetch BOTH.** Reporting only the scheduled verdict is the
        // stronger and correct claim, and suppressing the other one entirely is what
        // made this dashboard and a hand-rolled scanner tell different stories about
        // three cadence lanes on 2026-08-22 with no way for a reader to see why: the
        // lanes were fixed and manually re-run green, while this reported their last
        // SCHEDULED failure with a `detail` that read like a plain latest-verdict.
        // The scheduled verdict stays the verdict; the dispatch becomes `supersededBy`.
        if (def.expectation.kind === "periodic") {
          const [sched, other] = await Promise.all([
            runGhJsonAsync<{ workflow_runs: GhRun[] }>([
              "api",
              `repos/${nwo}/actions/workflows/${workflowId}/runs?event=schedule&per_page=${perCheck}`,
            ]),
            runGhJsonAsync<{ workflow_runs: GhRun[] }>([
              "api",
              `repos/${nwo}/actions/workflows/${workflowId}/runs?branch=${encodeURIComponent(branch)}&per_page=${perCheck}`,
            ]),
          ]);
          if (sched.ok && sched.value.workflow_runs.length > 0) {
            const obs = observationForRuns(def.checkId, sched.value.workflow_runs, sourceName);
            if (obs !== null) {
              const rival = other.ok ? observationForRuns(def.checkId, other.value.workflow_runs, sourceName) : null;
              observations.push(withSuperseding(obs, rival));
              continue;
            }
          }
          // No scheduled run at all. Fall through to the ordinary result, whose
          // observation carries a NON-periodic trigger — which is precisely what makes
          // the fold report "the declared schedule has never fired".
          if (!other.ok) {
            failures.push({ checkId: def.checkId, detail: `${other.error.kind}: ${other.error.message.slice(0, 160)}` });
            continue;
          }
          const fallback = observationForRuns(def.checkId, other.value.workflow_runs, sourceName);
          if (fallback !== null) observations.push(fallback);
          continue;
        }

        const res = await runGhJsonAsync<{ workflow_runs: GhRun[] }>([
          "api",
          `repos/${nwo}/actions/workflows/${workflowId}/runs?branch=${encodeURIComponent(branch)}&per_page=${perCheck}`,
        ]);
        if (!res.ok) {
          // A producer that could not answer is an ABSENCE, never an all-clear. It is
          // reported as a named failure, not dropped, so the fold can say WHICH check
          // we failed to learn about instead of quietly shrinking its own denominator.
          failures.push({ checkId: def.checkId, detail: `${res.error.kind}: ${res.error.message.slice(0, 160)}` });
          continue;
        }
        const obs = observationForRuns(def.checkId, res.value.workflow_runs, sourceName);
        if (obs !== null) observations.push(obs);
      }
    },
  );

  for (const def of definitions) await ferry.enqueue(def);
  await ferry.complete();

  if (failures.length > 0 && observations.length === 0 && definitions.length > 0) {
    // Nothing was learned at all. That is a source-level failure, not a set of
    // per-check ones, and it must not read as "a pass in which nothing was wrong".
    return err(forgeError("internal", `every check query failed (${failures.length}): ${failures.slice(0, 3).map((f) => `${f.checkId}: ${f.detail}`).join(" | ")}`));
  }
  const ord = (a: { checkId: string }, b: { checkId: string }): number => (a.checkId < b.checkId ? -1 : a.checkId > b.checkId ? 1 : 0);
  observations.sort(ord);
  failures.sort(ord);
  return ok({ observations, failures });
}
