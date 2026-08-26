import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { worthFetchingLogs, toJob, main } from "./rerun-toolchain-install-stall-cli.ts";
import type { Job, WorkflowRun } from "./toolchain-install-stall.ts";

const fixture = JSON.parse(
  readFileSync(join(import.meta.dir, "fixtures", "toolchain-install-stall-2026-08-25.json"), "utf8"),
) as { cases: Array<{ run: { id: number }; jobs: Job[] }> };
const jobsOf = (id: number) => fixture.cases.find((c) => c.run.id === id)!.jobs;

describe("worthFetchingLogs — the cheap pre-filter that decides whether to pay for a log", () => {
  test("fires on the runs that carry an install-step failure", () => {
    for (const id of [32890184155, 32890329848, 32889687326, 32896165119]) {
      expect(worthFetchingLogs(jobsOf(id))).toBe(true);
    }
  });

  test("does NOT fire on a run whose only failure is a tsc type error", () => {
    // This is the cost guard: on a normal red the sweep pays one jobs API call and stops.
    expect(worthFetchingLogs(jobsOf(32896987670))).toBe(false);
  });

  test("does not fire on the Windows installer step", () => {
    const jobs: Job[] = [
      {
        id: 1,
        name: "build-and-test (windows-2022)",
        conclusion: "failure",
        steps: [{ number: 3, name: "Install toolchain via three-way-parity script (Windows; GOVERNANCE §24)", conclusion: "failure" }],
      },
    ];
    expect(worthFetchingLogs(jobs)).toBe(false);
  });

  test("does not fire when the installer failed AFTER something else did", () => {
    const jobs: Job[] = [
      {
        id: 1,
        name: "j",
        conclusion: "failure",
        steps: [
          { number: 2, name: "Checkout", conclusion: "failure" },
          { number: 3, name: "Install toolchain via three-way-parity script", conclusion: "failure" },
        ],
      },
    ];
    expect(worthFetchingLogs(jobs)).toBe(false);
  });

  test("a pre-filter false positive costs a log fetch and never a rerun", () => {
    // Stated as a test so the claim in the header is checkable: the pre-filter's only power
    // is to SKIP work. Everything it lets through still faces the full policy, which needs
    // the log signature the pre-filter never looked at.
    const jobs: Job[] = [
      {
        id: 1,
        name: "j",
        conclusion: "failure",
        steps: [{ number: 3, name: "Install toolchain via three-way-parity script", conclusion: "failure" }],
      },
    ];
    expect(worthFetchingLogs(jobs)).toBe(true);
  });
});

describe("toJob — a job the API returned with no steps array must not crash the sweep", () => {
  test("missing steps becomes an empty list, which classifies as unexplained", () => {
    const j = toJob({ id: 7, name: "x", conclusion: "failure" });
    expect(j.steps).toEqual([]);
  });
});

describe("the module writes no files — the taint sink is gone, not sanitised", () => {
  // CodeQL flagged two drafts of a $GITHUB_STEP_SUMMARY writer (js/http-to-file-access). The
  // resolution was to delete the sink rather than reshape a sanitiser until the analyser was
  // quiet. This pins that: a reader who re-adds a file write has to delete this test first.
  test("the source names no filesystem write API", () => {
    const src = readFileSync(join(import.meta.dir, "rerun-toolchain-install-stall-cli.ts"), "utf8");
    // Strip the block comments, which DISCUSS the removed sink by name.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const banned of ["appendFileSync", "writeFileSync", "Bun.write", "node:fs", "GITHUB_STEP_SUMMARY"]) {
      expect(code).not.toContain(banned);
    }
  });

  test("the assertion above has a subject (the file is real and non-trivial)", () => {
    // A scan floor: if the path ever moves, the test must fail rather than vacuously pass on
    // an empty string.
    const src = readFileSync(join(import.meta.dir, "rerun-toolchain-install-stall-cli.ts"), "utf8");
    expect(src.length).toBeGreaterThan(4000);
    expect(src).toContain("toolchain-install-stall-decision");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// THE WIRING IS ITS OWN FALSIFIER (2026-08-26).
//
// The `non-blocking` demotion lives in `toolchain-install-stall.ts` and is exercised there,
// but the sweep only benefits if this CLI actually LOADS the floor and HANDS it to the
// policy. That wiring is one spread in one call, and a mutation run confirmed it: deleting
// `blockingFloor` from the `decideRerun` call left all 80 unit tests green. So `main` is
// driven end to end here over a stubbed `fetch`, with no network and no mock of the policy —
// the fixture data goes in, the decision line comes out.
// ─────────────────────────────────────────────────────────────────────────────────────────
describe("main — the sweep, driven end to end over a stubbed GitHub API", () => {
  interface FullCase {
    run: WorkflowRun & { workflow_id?: number };
    jobs: Job[];
    logExcerpts: Record<string, { excerpt: string }>;
  }
  const full = JSON.parse(
    readFileSync(join(import.meta.dir, "fixtures", "toolchain-install-stall-2026-08-25.json"), "utf8"),
  ) as { cases: FullCase[] };
  const caseOf = (id: number) => full.cases.find((c) => c.run.id === id)!;

  /** Serve one fixture case; anything unexpected 404s, so a missed route cannot pass quietly. */
  async function runMain(id: number): Promise<Array<Record<string, unknown>>> {
    const c = caseOf(id);
    const realFetch = globalThis.fetch;
    const lines: Array<Record<string, unknown>> = [];
    const realLog = console.log;
    // The staleness limit is not what is under test here, and the fixture runs are days old by
    // now. Derived from the run's own timestamp rather than guessed, so it cannot rot.
    const ageMinutes = Math.ceil((Date.now() - Date.parse(c.run.updated_at)) / 60_000) + 60;
    try {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
        if (url.endsWith(`/actions/runs/${id}`)) return body(c.run);
        if (url.includes(`/actions/runs/${id}/jobs`)) return body({ jobs: c.jobs });
        const log = url.match(/\/actions\/jobs\/(\d+)\/logs$/);
        if (log) return new Response(c.logExcerpts[log[1]!]?.excerpt ?? "", { status: 200 });
        if (url.includes("/actions/workflows/")) return body({ workflow_runs: [] });
        return new Response("not found", { status: 404 });
      }) as typeof fetch;
      console.log = (line: string) => void lines.push(JSON.parse(line) as Record<string, unknown>);
      const rc = await main(["--run-id", String(id), "--max-age-minutes", String(ageMinutes)]);
      if (rc !== 0) throw new Error(`main exited ${rc}`);
    } finally {
      globalThis.fetch = realFetch;
      console.log = realLog;
    }
    return lines;
  }

  test("the floor is loaded from gate.yml and announced", async () => {
    const lines = await runMain(32886176743);
    const floor = lines.find((l) => l.kind === "toolchain-install-stall-floor")!;
    expect(floor.status).toBe("ok");
    expect(floor.workflow).toBe("gate");
    expect(floor.blocking).toContain("lint (TS)");
    expect(floor.blocking).not.toContain("drift (loud)");
  });

  test("THE WIRING: the stranded run reaches `rerun` through the real CLI path", async () => {
    // This is the test that dies if the CLI stops handing the floor to the policy.
    const lines = await runMain(32886176743);
    const decision = lines.find((l) => l.kind === "toolchain-install-stall-decision")!;
    expect(decision.action).toBe("rerun");
    expect(decision.reason).toBe("toolchain-install-stall");
    expect(decision.applied).toBe(false); // dry run by default: nothing was POSTed
    expect(decision.detail).toContain("drift (loud)");
  });

  test("and the run mixing a stall with REAL reds still declines through the same path", async () => {
    const lines = await runMain(32896165119);
    const decision = lines.find((l) => l.kind === "toolchain-install-stall-decision")!;
    expect(decision.action).toBe("skip");
    expect(decision.reason).toBe("mixed-failure");
  });
});

describe("argument handling for the replay flags", () => {
  test("--attempt without --run-id is refused", async () => {
    expect(await main(["--attempt", "1"])).toBe(2);
  });

  test("--attempt with --apply is refused (a verdict from an old attempt must not act)", async () => {
    // `rerun-failed-jobs` acts on the LATEST attempt, so applying a decision computed from an
    // earlier one would be a decision about data that is no longer the run's state.
    expect(await main(["--run-id", "1", "--attempt", "1", "--apply"])).toBe(2);
  });

  test("a non-numeric --attempt is refused", async () => {
    expect(await main(["--run-id", "1", "--attempt", "zero"])).toBe(2);
  });
});
