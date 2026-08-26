// Falsifiers for the CLI's handling of what the forge says back.
//
// THE DEFECT (rerun-cancelled-gate red on `main`, 2026-08-26T08:06). `api()` threw on any
// non-2xx, so GitHub's ORDINARY refusals to re-run — which a tool that exists to re-run
// cancelled runs meets constantly — presented as crashes, and the workflow surfaced only a
// stack trace with neither the status code nor the API's own sentence in it.
//
// The fix has to hold TWO properties at once, and either alone is worthless:
//
//   1. An unactionable refusal is a SKIP with a named reason, exit 0.
//   2. A genuine error — auth, rate limit, 5xx, anything unrecognised — still FAILS.
//
// Property 2 is why the tests below spend more assertions on the failures than the skips.
// A blanket `catch` would satisfy property 1 completely while destroying the tool's ability
// to report real breakage, which is this repository's defining failure mode: a check that
// cannot fail. Every "still throws" test here is a mutation target for that exact edit.
//
// These drive `main()` end-to-end through an injected `fetch`, so the seam under test is the
// real control flow (which call is wrapped, what exit code comes out, what gets logged) and
// not a re-statement of the pure classifier. The classifier's own table lives beside the
// policy in rerun-cancelled-gate-run.test.ts.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { extractApiMessage, GitHubApiError, main } from "./rerun-cancelled-gate-run-cli.ts";
import type { WorkflowRun } from "./rerun-cancelled-gate-run.ts";

const RUN_ID = 424242;

/**
 * A run the policy WILL want to rerun: completed, cancelled, first attempt, recent.
 *
 * `updated_at` is anchored to the present because the staleness guard is real (180 min) and
 * a hardcoded 2026 timestamp would make every test here silently take the `stale` branch a
 * few hours after it was written — a test that passes for the wrong reason. This reads the
 * clock but awaits no timer, so no verdict depends on elapsed time.
 */
function cancelledOrphan(branch = "some/branch"): WorkflowRun {
  const now = Date.now();
  return {
    id: RUN_ID,
    head_branch: branch,
    head_sha: "0123456789abcdef0123456789abcdef01234567",
    event: branch === "main" ? "push" : "pull_request",
    status: "completed",
    conclusion: "cancelled",
    created_at: new Date(now - 15 * 60_000).toISOString(),
    updated_at: new Date(now - 60_000).toISOString(),
    run_attempt: 1,
  };
}

interface StubOptions {
  /** Status + body returned for the rerun POST. 201/202 mean the rerun was accepted. */
  readonly rerunStatus: number;
  readonly rerunBody?: string;
  /**
   * How many jobs the run created. The DEFAULT IS NON-ZERO on purpose: the pre-2026-08-26
   * population this file was written against is timed-out PR jobs, and defaulting to 0 would
   * quietly move every existing test onto the whole-run endpoint.
   */
  readonly jobCount?: number;
  /** Branch of the run under test — `main` exercises the default-branch carve-out. */
  readonly branch?: string;
  /**
   * A newer sibling run on the same branch. Without one guard 3 CANNOT fire, so every test
   * that leaves this empty is silent about whether the CLI threads the measured default
   * branch into the policy at all — which is exactly the gap the mutation run found.
   */
  readonly newerSiblingSha?: string;
  /** What `GET /repos/{owner}/{repo}` reports. */
  readonly defaultBranch?: string;
}

interface Recorded {
  readonly logs: string[];
  readonly posts: string[];
}

const realFetch = globalThis.fetch;
const realLog = console.log;
const realError = console.error;

let recorded: Recorded;

function installStub(options: StubOptions): void {
  const run = cancelledOrphan(options.branch);
  const jobCount = options.jobCount ?? 28;
  globalThis.fetch = ((input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.href;
    const method = init?.method ?? "GET";
    // BOTH endpoints are recorded, and the recorded value is the full URL, so a test can
    // assert WHICH call was made. Matching only `/rerun-failed-jobs` here would let a
    // regression that always posts `/rerun` fall through to the 200-with-a-run-body branch
    // below and read as a success — the stub itself would have become a check that cannot
    // fail.
    if (method === "POST" && (url.endsWith("/rerun-failed-jobs") || url.endsWith("/rerun"))) {
      recorded.posts.push(url);
      return Promise.resolve(new Response(options.rerunBody ?? "", { status: options.rerunStatus }));
    }
    if (url.includes("/jobs")) {
      return Promise.resolve(new Response(JSON.stringify({ total_count: jobCount, jobs: [] }), { status: 200 }));
    }
    if (url.includes("/actions/workflows/")) {
      // Siblings. Empty by default, so the supersession guard cannot fire unless a test
      // asks for it.
      const siblings: WorkflowRun[] =
        options.newerSiblingSha === undefined
          ? []
          : [
              run,
              {
                ...run,
                id: run.id + 1,
                head_sha: options.newerSiblingSha,
                created_at: new Date(Date.parse(run.created_at) + 60_000).toISOString(),
                updated_at: new Date(Date.parse(run.created_at) + 60_000).toISOString(),
              },
            ];
      return Promise.resolve(new Response(JSON.stringify({ workflow_runs: siblings }), { status: 200 }));
    }
    if (!url.includes("/actions/")) {
      // `GET /repos/{owner}/{repo}` — the measured default branch guard 3 is scoped by.
      return Promise.resolve(
        new Response(JSON.stringify({ default_branch: options.defaultBranch ?? "main" }), { status: 200 }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ ...run, workflow_id: 7 }), { status: 200 }));
  }) as unknown as typeof fetch;
}

/**
 * Drive `main()` and hand back whatever it threw, or `null` if it returned.
 *
 * A helper rather than `.rejects.toThrow(...)` so each test can interrogate the ERROR'S
 * FIELDS — status and the forge's own sentence — which is the half of the 2026-08-26 defect
 * that was never about exit codes: the failure printed a stack trace and named no cause.
 */
async function failureOf(argv: readonly string[]): Promise<unknown> {
  try {
    await main([...argv]);
  } catch (err) {
    return err;
  }
  return null;
}

beforeEach(() => {
  recorded = { logs: [], posts: [] };
  console.log = (...args: unknown[]): void => {
    recorded.logs.push(args.map((a) => String(a)).join(" "));
  };
  console.error = (): void => undefined;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.log = realLog;
  console.error = realError;
});

interface DecisionLine {
  action: string;
  reason: string;
  detail: string;
  applied: boolean;
  endpoint: string | null;
}

/** The one structured decision line the CLI emits per evaluation. */
function decisionLine(): DecisionLine {
  const line = recorded.logs.find((l) => l.includes("gate-rerun-decision"));
  expect(line).toBeDefined();
  return JSON.parse(line ?? "{}") as DecisionLine;
}

describe("unactionable refusals — skip, say so, exit 0", () => {
  // Observed by hand against the live API: CodeQL default-setup runs carry `event: dynamic`
  // and the Actions API refuses `rerun-failed-jobs` on them outright.
  test("'This workflow run cannot be retried' is a named skip, not a failure", async () => {
    installStub({ rerunStatus: 403, rerunBody: JSON.stringify({ message: "This workflow run cannot be retried." }) });
    expect(await main(["--run-id", String(RUN_ID), "--apply"])).toBe(0);
    const d = decisionLine();
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("refused-not-retriable");
    expect(d.applied).toBe(false);
    // The refusal must be LEGIBLE: the status and the forge's own sentence both survive
    // into the log line. This is the half of the defect that had nothing to do with exit
    // codes — the old failure printed a stack trace and named no cause at all.
    expect(d.detail).toContain("403");
    expect(d.detail).toContain("cannot be retried");
  });

  test("'This workflow is already running' is a named skip, not a failure", async () => {
    installStub({ rerunStatus: 403, rerunBody: JSON.stringify({ message: "This workflow is already running." }) });
    expect(await main(["--run-id", String(RUN_ID), "--apply"])).toBe(0);
    const d = decisionLine();
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("refused-already-running");
  });

  // The two refusals group under DIFFERENT keys on purpose: "nothing to re-run, ever" and
  // "a rerun is already in flight" have different causes, and a rising rate of one says
  // something a rising rate of the other does not.
  test("the two refusal classes do not collapse into one reason", async () => {
    installStub({ rerunStatus: 403, rerunBody: JSON.stringify({ message: "This workflow run cannot be retried." }) });
    await main(["--run-id", String(RUN_ID), "--apply"]);
    const first = decisionLine().reason;
    recorded = { logs: [], posts: [] };
    installStub({ rerunStatus: 403, rerunBody: JSON.stringify({ message: "This workflow is already running." }) });
    await main(["--run-id", String(RUN_ID), "--apply"]);
    expect(decisionLine().reason).not.toBe(first);
  });
});

describe("genuine errors STILL FAIL — the property a blanket catch would destroy", () => {
  // The sharpest one. A rate limit arrives as 403, exactly like both refusals above, so
  // anything keying on the STATUS rather than the message swallows it. Mutating
  // classifyRerunRefusal to `return status === 403 ? "not-retriable" : null` passes every
  // test in the block above and fails here.
  test("a 403 RATE LIMIT is not a refusal — it throws", async () => {
    installStub({
      rerunStatus: 403,
      rerunBody: JSON.stringify({ message: "API rate limit exceeded for installation ID 12345." }),
    });
    const err = await failureOf(["--run-id", String(RUN_ID), "--apply"]);
    expect(err).toBeInstanceOf(GitHubApiError);
    expect((err as GitHubApiError).apiMessage).toMatch(/rate limit/iu);
  });

  test("a 403 SECONDARY rate limit is not a refusal — it throws", async () => {
    installStub({
      rerunStatus: 403,
      rerunBody: JSON.stringify({ message: "You have exceeded a secondary rate limit. Please wait and retry." }),
    });
    expect(await failureOf(["--run-id", String(RUN_ID), "--apply"])).toBeInstanceOf(GitHubApiError);
  });

  test("401 Bad credentials throws — a broken token must never read as a quiet skip", async () => {
    installStub({ rerunStatus: 401, rerunBody: JSON.stringify({ message: "Bad credentials" }) });
    const err = await failureOf(["--run-id", String(RUN_ID), "--apply"]);
    expect(err).toBeInstanceOf(GitHubApiError);
    expect((err as GitHubApiError).apiMessage).toBe("Bad credentials");
  });

  test("500 throws even when its body carries a refusal phrase — 5xx is an outage, not a refusal", async () => {
    installStub({
      rerunStatus: 500,
      rerunBody: JSON.stringify({ message: "This workflow run cannot be retried." }),
    });
    const err = await failureOf(["--run-id", String(RUN_ID), "--apply"]);
    expect(err).toBeInstanceOf(GitHubApiError);
    expect((err as GitHubApiError).status).toBe(500);
  });

  test("an unrecognised 4xx throws — the allowlist is closed, not a starting point", async () => {
    installStub({ rerunStatus: 422, rerunBody: JSON.stringify({ message: "Unprocessable Entity" }) });
    expect(await failureOf(["--run-id", String(RUN_ID), "--apply"])).toBeInstanceOf(GitHubApiError);
  });

  // The refusal boundary is one call. A read failing with a refusal-shaped message is
  // nonsense and must not be laundered into a skip.
  test("a refusal phrase on the READ path still throws — only the rerun POST is classified", async () => {
    globalThis.fetch = ((): Promise<Response> =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "This workflow run cannot be retried." }), { status: 403 }),
      )) as unknown as typeof fetch;
    expect(await failureOf(["--run-id", String(RUN_ID), "--apply"])).toBeInstanceOf(GitHubApiError);
  });
});

describe("observability — a failure must name its own cause", () => {
  // The 2026-08-26 log gave a stack trace and nothing else. These pin the two facts that
  // were missing from it.
  test("the thrown error carries the status code AND the forge's sentence", async () => {
    installStub({ rerunStatus: 401, rerunBody: JSON.stringify({ message: "Bad credentials" }) });
    const caught = await failureOf(["--run-id", String(RUN_ID), "--apply"]);
    expect(caught).toBeInstanceOf(GitHubApiError);
    const e = caught as GitHubApiError;
    expect(e.status).toBe(401);
    expect(e.apiMessage).toBe("Bad credentials");
    expect(e.message).toContain("401");
    expect(e.message).toContain("Bad credentials");
    expect(e.message).toContain("rerun-failed-jobs");
  });

  test("a non-JSON body is reported raw, never as an empty message", () => {
    expect(extractApiMessage("<html>upstream timed out</html>")).toContain("upstream timed out");
    expect(extractApiMessage("")).toBe("(empty response body)");
  });

  test("extractApiMessage prefers the API's message field", () => {
    expect(extractApiMessage(JSON.stringify({ message: "Bad credentials", documentation_url: "x" }))).toBe(
      "Bad credentials",
    );
  });
});

describe("the happy path is unchanged", () => {
  // FOUND BY WRITING THIS TEST, and it is the same defect class pointed at success:
  // `rerun-failed-jobs` answers 201 with NO BODY, and the old `api()` special-cased only
  // 204 — so the single call this tool exists to make threw `SyntaxError: Unexpected end
  // of JSON input` on its happy path, landing in exactly the undiagnosable red the
  // refusals produced. The empty body below is the regression pin.
  test("an accepted rerun posts once and logs applied=true (201, EMPTY body)", async () => {
    installStub({ rerunStatus: 201 });
    expect(await main(["--run-id", String(RUN_ID), "--apply"])).toBe(0);
    expect(recorded.posts).toHaveLength(1);
    const d = decisionLine();
    expect(d.action).toBe("rerun");
    expect(d.applied).toBe(true);
  });

  // OVER-REACH GUARD, not proof of the fix: this passes under both the fixed and the
  // pre-fix CLI, because dry-run never reaches the POST. It is here so a later refactor
  // cannot make `--apply` optional by accident, and it is labelled so nobody counts it
  // as evidence that refusals are handled.
  test("[over-reach guard] dry-run never posts", async () => {
    installStub({ rerunStatus: 201 });
    expect(await main(["--run-id", String(RUN_ID)])).toBe(0);
    expect(recorded.posts).toHaveLength(0);
  });

  test("a missing --run-id is a usage error (exit 2), not a crash", async () => {
    installStub({ rerunStatus: 201 });
    expect(await main([])).toBe(2);
  });
});

// ── THE 2026-08-26 RECOVERY PATH, END TO END ──────────────────────────────────────────────
//
// Two changes had to land together or the fix is a no-op wearing a correct classification:
//
//   1. Guard 3 stops writing off displaced `main` runs (they differ in `head_sha`).
//   2. The POST goes to `/rerun`, because a displaced run has ZERO jobs and the forge
//      answers `/rerun-failed-jobs` with 403 "This workflow run cannot be retried" —
//      measured against run 32952848390, whose `/rerun` succeeded and created 35 jobs.
//
// Ship (1) alone and the tool selects every displaced run, meets that 403, classifies it as
// an ordinary refusal, and logs a cheerful skip. Ship (2) alone and nothing is ever selected
// on `main`. These tests fail if either half is reverted.
describe("displaced runs on the default branch are recovered, not written off", () => {
  test("a zero-job cancelled run on `main` posts /rerun and is applied", async () => {
    installStub({ rerunStatus: 201, jobCount: 0, branch: "main" });
    expect(await main(["--run-id", String(RUN_ID), "--apply"])).toBe(0);
    expect(recorded.posts).toHaveLength(1);
    expect(recorded.posts[0]?.endsWith("/rerun")).toBe(true);
    const d = decisionLine();
    expect(d.action).toBe("rerun");
    expect(d.reason).toBe("cancelled-orphan");
    expect(d.applied).toBe(true);
    expect(d.endpoint).toBe("rerun");
  });

  // The control for the test above: same run, same branch, jobs present. The endpoint must
  // move back, which is what shows the choice depends on the job count and not on the branch.
  test("a cancelled run WITH jobs still posts /rerun-failed-jobs (cost discipline kept)", async () => {
    installStub({ rerunStatus: 201, jobCount: 28, branch: "main" });
    expect(await main(["--run-id", String(RUN_ID), "--apply"])).toBe(0);
    expect(recorded.posts[0]?.endsWith("/rerun-failed-jobs")).toBe(true);
    expect(decisionLine().endpoint).toBe("rerun-failed-jobs");
  });

  // The measured 403. If the endpoint choice regresses, THIS is what production would do:
  // exit 0, log a skip, recover nothing. Pinning it means the no-op has a name.
  test("[regression pin] the old endpoint on a zero-job run is the silent no-op", async () => {
    installStub({
      rerunStatus: 403,
      rerunBody: JSON.stringify({ message: "This workflow run cannot be retried" }),
      jobCount: 0,
      branch: "main",
    });
    expect(await main(["--run-id", String(RUN_ID), "--apply"])).toBe(0);
    const d = decisionLine();
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("refused-not-retriable");
    expect(d.applied).toBe(false);
  });

  test("the dry-run names the endpoint it would have used", async () => {
    installStub({ rerunStatus: 201, jobCount: 0, branch: "main" });
    expect(await main(["--run-id", String(RUN_ID)])).toBe(0);
    expect(recorded.posts).toHaveLength(0);
    expect(decisionLine().endpoint).toBe("rerun");
  });

  // ADDED AFTER A SURVIVING MUTANT. Replacing `decideRerun(run, siblings, { defaultBranch })`
  // with a hardcoded wrong branch left every other test in this file green, because none of
  // them supplied a sibling — so guard 3 could not fire and the CLI's plumbing of the
  // MEASURED default branch was never exercised. These two supply one.
  test("the MEASURED default branch reaches the policy — a newer main run does not write it off", async () => {
    installStub({ rerunStatus: 201, jobCount: 0, branch: "main", newerSiblingSha: "ffffffff".repeat(5) });
    expect(await main(["--run-id", String(RUN_ID), "--apply"])).toBe(0);
    const d = decisionLine();
    expect(d.action).toBe("rerun");
    expect(d.reason).toBe("cancelled-orphan");
  });

  // The control, and the reason the carve-out is scoped rather than global: on a branch that
  // is NOT the default, the very same newer-sibling shape is still a genuine supersession.
  test("off the default branch the same shape is still superseded", async () => {
    installStub({
      rerunStatus: 201,
      jobCount: 0,
      branch: "heartbeat/tick-metrics",
      newerSiblingSha: "ffffffff".repeat(5),
    });
    expect(await main(["--run-id", String(RUN_ID), "--apply"])).toBe(0);
    expect(decisionLine().reason).toBe("superseded");
    expect(recorded.posts).toHaveLength(0);
  });
});
