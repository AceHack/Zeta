// drift-loud.test.ts -- falsifiers for the loud-but-non-blocking drift fold.
//
// Every test here fails if the line of the fold it covers is removed or inverted. The
// four that carry the design are:
//
//   * a STEP-level swallow (green job, red step) is detected -- the class that had no
//     detector anywhere in the repo, and the class the live canary is a specimen of;
//   * a long clean streak DEMOTES a band to `HEALED` -- the structural fix for the
//     unbounded-window alarm that stayed lit for twelve days after its defect was gone;
//   * the window is BOUNDED before anything is counted, so an old failure cannot be
//     resurrected by adding history;
//   * `assertDetectorLive` goes RED when the canary is absent -- silence fails the
//     check, which is the only thing keeping this surface from becoming the next one
//     that quietly stops working.
//
// And one that is about what this must NOT do: a failure that sat beside a RED rollup is
// not absorbed, because it blocked the merge and is somebody else's problem.

import { describe, expect, test } from "bun:test";

import {
  annotationLines,
  assertDetectorLive,
  bandOf,
  CANARY_JOB_NAME,
  censusOfRun,
  DEFAULT_THRESHOLDS,
  foldAbsorption,
  oldestRunId,
  orderNewestFirst,
  publicationIsStale,
  renderMarkdown,
  ROLLUP_JOB_NAME,
  isInstrument,
  severityOf,
  SWALLOWED_STEP,
  type JobRecord,
  type RunRecord,
  type Thresholds,
} from "./drift-loud.ts";

const WIN = "build-and-test (windows-2025)";
const MD = "lint (markdownlint)";

function job(name: string, conclusion: string, steps: readonly (readonly [string, string])[] = []): JobRecord {
  return { name, conclusion, steps: steps.map(([n, c]) => ({ name: n, conclusion: c })) };
}

function run(id: number, jobs: readonly JobRecord[], conclusion = "failure"): RunRecord {
  return { id, at: `2026-08-23T00:00:${String(id % 60).padStart(2, "0")}Z`, sha: `sha${id}`, conclusion, jobs };
}

const greenRollup = job(ROLLUP_JOB_NAME, "success");
const redRollup = job(ROLLUP_JOB_NAME, "failure");

/**
 * The canary EXACTLY as the live API reports it (gate run 32651748761, 2026-08-23).
 *
 * Note what this fixture encodes and why it is not a convenience: every step reads
 * `success`, INCLUDING the one that exited 1 under `continue-on-error`. The only trace
 * of the failure is the `failure`-level check-run annotation. A test that gave the step
 * a `failure` conclusion would be testing a payload GitHub does not produce, and would
 * have passed against the exact bug the live canary caught on its first run.
 */
function canaryJob(failing = true): JobRecord {
  return {
    name: CANARY_JOB_NAME,
    conclusion: "success",
    id: 97224512630,
    steps: [
      { name: "Set up job", conclusion: "success" },
      { name: "drift canary -- deliberate non-blocking failure", conclusion: "success" },
      { name: "Explain the green", conclusion: "success" },
      { name: "Complete job", conclusion: "success" },
    ],
    failureAnnotations: failing ? ["Process completed with exit code 1."] : [],
  };
}

describe("censusOfRun -- what counts as absorbed", () => {
  test("a job that failed beside a GREEN rollup is absorbed", () => {
    const c = censusOfRun(run(1, [greenRollup, job(WIN, "failure")]));
    expect(c.map((a) => a.subject)).toEqual([WIN]);
    expect(c[0]?.kind).toBe("job-red-gate-green");
  });

  test("a job that failed beside a RED rollup is NOT absorbed -- it blocked the merge", () => {
    expect(censusOfRun(run(1, [redRollup, job(WIN, "failure")]))).toEqual([]);
  });

  test("STEP-level: a green job carrying a FAILURE ANNOTATION is absorbed -- the only visible trace", () => {
    // The channel that works. Every step conclusion in `canaryJob()` reads `success`;
    // the annotation is the whole evidence. Delete the annotation branch of
    // `censusOfRun` and this goes to zero findings, which is precisely the state the
    // live canary was red about.
    const c = censusOfRun(run(1, [greenRollup, canaryJob()]));
    expect(c).toHaveLength(1);
    expect(c[0]?.kind).toBe("step-red-job-green");
    expect(c[0]?.job).toBe(CANARY_JOB_NAME);
    expect(c[0]?.step).toBe(SWALLOWED_STEP);
    expect(c[0]?.detail).toEqual(["Process completed with exit code 1."]);
  });

  test("step CONCLUSIONS alone find nothing -- the API blind spot, pinned", () => {
    // This is the falsifier for the header's central claim. If GitHub ever starts
    // reporting a swallowed step as `failure`, this test goes red and the claim in the
    // header must be corrected rather than quietly kept.
    const noAnnotations: JobRecord = { ...canaryJob(), failureAnnotations: [] };
    expect(censusOfRun(run(1, [greenRollup, noAnnotations]))).toEqual([]);
  });

  test("the secondary channel still names the STEP when a source does supply it", () => {
    // Kept live so the branch is not dead code guarded by optimism.
    const withStep = job("legacy", "success", [["a real failed step", "failure"]]);
    const c = censusOfRun(run(1, [greenRollup, withStep]));
    expect(c[0]?.step).toBe("a real failed step");
    expect(c[0]?.subject).toBe("legacy › a real failed step");
  });

  test("a step-level swallow is absorbed even when the rollup is RED -- no job surface can see it", () => {
    // Deliberate asymmetry with the job-level case above. A green job hides its failed
    // step regardless of what else in the run was red, so `permitted` must not gate it.
    const c = censusOfRun(run(1, [redRollup, canaryJob()]));
    expect(c).toHaveLength(1);
    expect(c[0]?.kind).toBe("step-red-job-green");
  });

  test("a job whose annotations were NEVER FETCHED yields no finding -- unknown stays unknown", () => {
    // `undefined` (did not look) must not read as `[]` (looked, found none). Without
    // this distinction every unfetched run would count as a clean execution and inflate
    // the clean streaks that demote bands to HEALED.
    const unfetched: JobRecord = { name: CANARY_JOB_NAME, conclusion: "success", steps: [] };
    expect(censusOfRun(run(1, [greenRollup, unfetched]))).toEqual([]);
  });

  test("runner-injected steps are never drift", () => {
    const c = censusOfRun(run(1, [greenRollup, job("x", "success", [["Set up job", "failure"]])]));
    expect(c).toEqual([]);
  });

  test("the rollup's own failure is never itself an absorption", () => {
    expect(censusOfRun(run(1, [redRollup]))).toEqual([]);
  });

  test("with no rollup at all, the RUN conclusion stands in for it", () => {
    expect(censusOfRun(run(1, [job(MD, "failure")], "success"))).toHaveLength(1);
    expect(censusOfRun(run(1, [job(MD, "failure")], "failure"))).toEqual([]);
  });
});

describe("bandOf -- proportionality, and the twelve-day-alarm guard", () => {
  const t = DEFAULT_THRESHOLDS;

  test("no failures is UNOBSERVED, deliberately not `healthy`", () => {
    expect(bandOf(0, 40, 40, t)).toBe("UNOBSERVED");
  });

  test("failing most executions, unhealed, is SUSTAINED", () => {
    expect(bandOf(8, 10, 0, t)).toBe("SUSTAINED");
  });

  test("a long clean streak DEMOTES a would-be SUSTAINED to HEALED", () => {
    // Same failure count and rate as the SUSTAINED case above; the ONLY difference is
    // that it has since been clean for `healStreak` executions. Delete the healStreak
    // branch and this test goes SUSTAINED -- which is the twelve-day alarm, exactly.
    expect(bandOf(8, 18, t.healStreak, t)).toBe("HEALED");
  });

  test("one clean run short of the heal streak is still loud", () => {
    expect(bandOf(8, 18, t.healStreak - 1, t)).not.toBe("HEALED");
  });

  test("a high rate with too few failures is FLAPPING, not SUSTAINED", () => {
    // Rate alone would call 2/2 the loudest band. Two samples is not evidence of
    // sustained anything, so `sustainedMinFailures` is a real constraint.
    expect(bandOf(2, 2, 0, t)).toBe("FLAPPING");
  });

  test("exactly one failure is ONE_OFF", () => {
    expect(bandOf(1, 30, 0, t)).toBe("ONE_OFF");
  });

  test("severity ladder: only SUSTAINED is an error; healed and unobserved are silent", () => {
    expect(severityOf("SUSTAINED")).toBe("error");
    expect(severityOf("FLAPPING")).toBe("warning");
    expect(severityOf("ONE_OFF")).toBe("notice");
    expect(severityOf("HEALED")).toBeNull();
    expect(severityOf("UNOBSERVED")).toBeNull();
  });
});

describe("foldAbsorption", () => {
  test("the window is BOUNDED before anything is counted", () => {
    const tight: Thresholds = { ...DEFAULT_THRESHOLDS, windowRuns: 3 };
    const records = [
      run(9, [greenRollup, job(WIN, "success")]),
      run(8, [greenRollup, job(WIN, "success")]),
      run(7, [greenRollup, job(WIN, "success")]),
      run(1, [greenRollup, job(WIN, "failure")]), // outside a 3-run window
    ];
    const report = foldAbsorption(records, tight);
    expect(report.runs).toBe(3);
    expect(report.totalAbsorbed).toBe(0);
    expect(report.subjects).toEqual([]);
  });

  test("clean streak counts EXECUTIONS, so cancelled runs cannot inflate it", () => {
    const records = [
      run(5, [], "cancelled"),
      run(4, [], "cancelled"),
      run(3, [greenRollup, job(WIN, "success")]),
      run(2, [greenRollup, job(WIN, "failure")]),
    ];
    const report = foldAbsorption(records);
    const win = report.subjects.find((s) => s.subject === WIN);
    expect(win?.executions).toBe(2);
    expect(win?.cleanStreak).toBe(1);
    expect(report.cancelledRuns).toBe(2);
    expect(report.coverage).toBeCloseTo(0.5, 5);
  });

  test("a subject that never executed in a run is not counted as clean there", () => {
    // The run has a rollup but no WIN job at all -- a docs-only path filter, say. If
    // that counted as a clean execution, every skipped run would dilute a real rate.
    const records = [run(4, [greenRollup]), run(3, [greenRollup, job(WIN, "failure")])];
    const win = foldAbsorption(records).subjects.find((s) => s.subject === WIN);
    expect(win?.executions).toBe(1);
    expect(win?.failures).toBe(1);
    expect(win?.failureRate).toBe(1);
  });

  test("job-level and step-level subjects are folded side by side and keyed apart", () => {
    const records = [run(2, [greenRollup, job(MD, "failure"), canaryJob()])];
    const report = foldAbsorption(records);
    expect(report.subjects.map((s) => s.kind).sort()).toEqual(["job-red-gate-green", "step-red-job-green"]);
    expect(report.totalAbsorbed).toBe(2);
  });

  test("is a pure function of the records -- order in, same report out (DST §7)", () => {
    const records = [run(3, [greenRollup, job(WIN, "failure")]), run(2, [greenRollup, job(WIN, "success")])];
    expect(foldAbsorption(records)).toEqual(foldAbsorption(orderNewestFirst([...records].reverse())));
  });

  test("re-folding the same records is byte-identical (idempotency §6)", () => {
    const records = [run(3, [greenRollup, canaryJob()])];
    expect(JSON.stringify(foldAbsorption(records))).toBe(JSON.stringify(foldAbsorption(records)));
  });
});

describe("assertDetectorLive -- falsifier #2, silence fails the check", () => {
  test("with the canary's annotation present, the detector is live", () => {
    const v = assertDetectorLive(run(3, [greenRollup, canaryJob()]));
    expect(v.live).toBe(true);
    expect(v.reason).toContain("annotation channel");
  });

  test("with the canary ABSENT from the run, the detector is declared dead -- not healthy", () => {
    // The shape of the whole rule: a report with nothing in it is exactly what a broken
    // detector produces, so "no findings" must never be allowed to read as green.
    const v = assertDetectorLive(run(3, [greenRollup, job(WIN, "success")]));
    expect(v.live).toBe(false);
    expect(v.reason).toContain("DETECTOR WENT QUIET");
    expect(v.reason).toContain("did not appear in run 3");
  });

  test("a canary that stopped failing also fails liveness, and says so specifically", () => {
    const v = assertDetectorLive(run(3, [greenRollup, canaryJob(false)]));
    expect(v.live).toBe(false);
    expect(v.reason).toContain("carrying 0 failure annotation(s)");
  });

  test("annotations never fetched is reported as UNVERIFIED, not as clean", () => {
    const unfetched: JobRecord = { name: CANARY_JOB_NAME, conclusion: "success", steps: [] };
    const v = assertDetectorLive(run(3, [greenRollup, unfetched]));
    expect(v.live).toBe(false);
    expect(v.reason).toContain("never fetched");
  });

  test("no current run at all is NOT live -- unverified is not working", () => {
    const v = assertDetectorLive(null);
    expect(v.live).toBe(false);
    expect(v.reason).toContain("DETECTOR WENT QUIET");
  });

  test("deleting the annotation channel would be caught: this is the live regression", () => {
    // Simulates the exact defect the canary caught on 2026-08-23 -- a payload in which
    // every step reads `success` and only the annotation carries the failure. With the
    // annotation branch removed, `censusOfRun` returns nothing and liveness fails.
    const stripped: JobRecord = { ...canaryJob(), failureAnnotations: [] };
    expect(assertDetectorLive(run(3, [greenRollup, stripped])).live).toBe(false);
  });
});

describe("publicationIsStale -- the surface that itself went quiet", () => {
  test("a watermark older than every run in the window is stale", () => {
    expect(publicationIsStale(100, 200)).toBe(true);
  });

  test("a watermark inside the window is a race, not a stoppage", () => {
    expect(publicationIsStale(250, 200)).toBe(false);
  });

  test("nothing published yet is NOT stale -- a new artifact is a different claim", () => {
    expect(publicationIsStale(0, 200)).toBe(false);
  });

  test("oldestRunId respects the window bound", () => {
    const records = [run(9, []), run(8, []), run(1, [])];
    expect(oldestRunId(records, 2)).toBe(8);
    expect(oldestRunId(records, 99)).toBe(1);
    expect(oldestRunId([], 10)).toBe(0);
  });
});

describe("loudness is emitted, and is proportional", () => {
  function sustainedRecords(): readonly RunRecord[] {
    return Array.from({ length: 6 }, (_, i) => run(20 - i, [greenRollup, job(WIN, "failure")]));
  }

  test("a SUSTAINED subject emits an ::error:: annotation", () => {
    const lines = annotationLines(foldAbsorption(sustainedRecords()));
    expect(lines.some((l) => l.startsWith("::error ") && l.includes(WIN))).toBe(true);
  });

  test("a HEALED subject emits NO annotation at all", () => {
    const records = [
      ...Array.from({ length: DEFAULT_THRESHOLDS.healStreak }, (_, i) => run(60 - i, [greenRollup, job(WIN, "success")])),
      ...Array.from({ length: 6 }, (_, i) => run(20 - i, [greenRollup, job(WIN, "failure")])),
    ];
    const report = foldAbsorption(records);
    expect(report.subjects.find((s) => s.subject === WIN)?.band).toBe("HEALED");
    expect(annotationLines(report)).toEqual([]);
  });

  test("every annotation says out loud that it blocks nothing", () => {
    for (const line of annotationLines(foldAbsorption(sustainedRecords()))) {
      expect(line).toContain("blocks nothing");
    }
  });

  test("the summary states the non-blocking half, so the surface cannot be misread as a gate", () => {
    const md = renderMarkdown(foldAbsorption(sustainedRecords()), { live: true, reason: "ok" }, null);
    expect(md).toContain("not in the `gate (required)` floor");
    expect(md).toContain("never a merge block");
  });
});

describe("instruments are never alarms", () => {
  test("a permanently-failing canary emits NO annotation -- it would be a self-inflicted false alarm", () => {
    const records = Array.from({ length: 6 }, (_, i) => run(20 - i, [greenRollup, canaryJob()]));
    const report = foldAbsorption(records);
    expect(report.subjects.some(isInstrument)).toBe(true);
    expect(annotationLines(report)).toEqual([]);
  });

  test("but it is still in the CENSUS, so liveness can depend on it", () => {
    const report = foldAbsorption([run(3, [greenRollup, canaryJob()])]);
    expect(report.totalAbsorbed).toBe(1);
    expect(assertDetectorLive(run(3, [greenRollup, canaryJob()])).live).toBe(true);
  });

  test("a real drift subject beside the canary is still annotated", () => {
    const records = Array.from({ length: 6 }, (_, i) => run(20 - i, [greenRollup, canaryJob(), job(WIN, "failure")]));
    const lines = annotationLines(foldAbsorption(records));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(WIN);
  });

  test("the summary does not list the canary as a finding", () => {
    const md = renderMarkdown(foldAbsorption([run(3, [greenRollup, canaryJob()])]), { live: true, reason: "ok" }, null);
    expect(md).toContain("No absorbed failure in the window");
  });
});

describe("the reporter must not report itself -- the self-amplifying latch", () => {
  const REPORTER = "drift (loud)";

  test("this reporter's own failures are not annotated", () => {
    // Observed live on gate run 32654127165: `drift (loud)` appeared in its own table at
    // 2/3. Every loud run would raise its own rate, converging on SUSTAINED regardless
    // of real drift — an ::error:: that is always present is one nobody reads.
    const records = Array.from({ length: 6 }, (_, i) => run(20 - i, [greenRollup, job(REPORTER, "failure")]));
    const report = foldAbsorption(records);
    expect(report.subjects.some((s) => s.job === REPORTER)).toBe(true);
    expect(annotationLines(report)).toEqual([]);
  });

  test("and cannot latch this job red by itself", () => {
    // The exit-code path must agree with the annotation path, or the job goes red with
    // nothing to show for it — the worst of both halves.
    const records = Array.from({ length: 6 }, (_, i) => run(20 - i, [greenRollup, job(REPORTER, "failure")]));
    const report = foldAbsorption(records);
    expect(report.subjects.filter((s) => !isInstrument(s) && s.band === "SUSTAINED")).toEqual([]);
  });

  test("a genuinely SUSTAINED non-instrument subject is still loud beside it", () => {
    // The falsifier for the exclusion: it must remove the self-reference and nothing else.
    const records = Array.from({ length: 6 }, (_, i) =>
      run(20 - i, [greenRollup, job(REPORTER, "failure"), job(WIN, "failure")]),
    );
    const lines = annotationLines(foldAbsorption(records));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("::error ");
    expect(lines[0]).toContain(WIN);
  });
});
