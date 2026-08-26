import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chooseRerunEndpoint,
  classifyRerunRefusal,
  decideRerun,
  isSuperseded,
  REFUSAL_REASON,
  type WorkflowRun,
} from "./rerun-cancelled-gate-run.ts";

// The fixture is REAL captured data (100 `gate` runs, 2026-08-14), not synthetic: 37
// cancelled, 2 failure, 44 success, 17 action_required. Testing the policy against the
// population it was derived from is the point — a policy that only passes on hand-made
// examples has not been shown to survive the traffic it will actually see.
const fixture = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", "gate-runs-2026-08-14.json"), "utf8")) as {
  captured_at: string;
  runs: WorkflowRun[];
};

const RUNS = fixture.runs;
// Evaluate as of capture time so the staleness guard is exercised deterministically
// rather than drifting into "everything is stale" as the fixture ages.
const NOW = new Date(fixture.captured_at);
const decide = (r: WorkflowRun) => decideRerun(r, RUNS, { now: NOW });

// The 10 runs that manual triage confirmed were cancelled with no superseding run — each
// one a job killed at exactly its `timeout-minutes` (+15-17s runner shutdown). Every one is
// on a PR branch, and the 2026-08-26 default-branch carve-out leaves this set EXACTLY as it
// was: see "the carve-out is scoped — the PR lane does not move".
const KNOWN_ORPHANS = [
  31828395043, 31829982444, 31830257631, 31831632267, 31832877793, 31833360986, 31833735570, 31835015649, 31835303139,
  31835308075,
];

// The 22 `main` runs the OLD branch-only supersession predicate wrote off as "concurrency
// working as designed". Each is a distinct commit on an append-only history whose gate
// verdict was discarded with a message asserting a replacement that never existed. They are
// the measured population of the 2026-08-26 fix, and enumerating them by id is what makes
// the before/after a count rather than a story: 10 selected before, 32 after, delta 22, all
// on `main`.
const DISPLACED_MAIN_RUNS = [
  31827721951, 31827724403, 31827726351, 31827735557, 31827738708, 31827761900, 31827782906, 31827786301, 31830204832,
  31831575871, 31832169123, 31832249052, 31832252945, 31832770751, 31833316336, 31833388660, 31833546727, 31834048560,
  31834284317, 31834505896, 31834537334, 31834552940,
];

const asc = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

describe("fixture sanity — the data under test is what we think it is", () => {
  test("carries the real observed population", () => {
    expect(RUNS.length).toBe(100);
    const byConclusion = new Map<string, number>();
    for (const r of RUNS) {
      const k = r.conclusion ?? "null";
      byConclusion.set(k, (byConclusion.get(k) ?? 0) + 1);
    }
    expect(byConclusion.get("cancelled")).toBe(37);
    expect(byConclusion.get("failure")).toBe(2);
    expect(byConclusion.get("success")).toBe(44);
  });
});

describe("guard 1 — genuine failures are NEVER re-run", () => {
  test("every failure in the real population is declined", () => {
    const failures = RUNS.filter((r) => r.conclusion === "failure");
    expect(failures.length).toBeGreaterThan(0); // the assertion must have subjects
    for (const f of failures) {
      const d = decide(f);
      expect(d.action).toBe("skip");
      expect(d.reason).toBe("not-cancelled");
    }
  });

  test("a failure that is otherwise PERFECTLY eligible is still declined", () => {
    // The falsifier for guard 1: identical to a known orphan in every respect except
    // conclusion. If the cancelled-only check is deleted, this test fails.
    const orphan = RUNS.find((r) => r.id === KNOWN_ORPHANS[0])!;
    expect(decide(orphan).action).toBe("rerun"); // baseline: eligible as cancelled
    const asFailure: WorkflowRun = { ...orphan, conclusion: "failure" };
    expect(decide(asFailure).action).toBe("skip");
  });

  test("no non-cancelled conclusion anywhere in the population is ever re-run", () => {
    for (const r of RUNS) {
      if (r.conclusion !== "cancelled") expect(decide(r).action).toBe("skip");
    }
  });
});

describe("guard 2 — at most one automatic rerun per run id", () => {
  test("a second attempt is declined", () => {
    const orphan = RUNS.find((r) => r.id === KNOWN_ORPHANS[0])!;
    const retried: WorkflowRun = { ...orphan, run_attempt: 2 };
    const d = decide(retried);
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("already-retried");
  });

  test("the rerun is not self-sustaining: re-deciding its own product stops", () => {
    // The loop-safety property. A rerun bumps run_attempt, so feeding the result back in
    // must terminate — otherwise a systematically-cancelling job burns minutes forever.
    const orphan = RUNS.find((r) => r.id === KNOWN_ORPHANS[0])!;
    let run: WorkflowRun = orphan;
    let reruns = 0;
    for (let i = 0; i < 10; i++) {
      if (decide(run).action !== "rerun") break;
      reruns++;
      run = { ...run, run_attempt: run.run_attempt + 1 }; // what GitHub does on rerun
    }
    expect(reruns).toBe(1);
  });
});

describe("guard 3 — superseded runs are left alone", () => {
  test("supersession survives the carve-out on the lane it was built for", () => {
    const cancelled = RUNS.filter((r) => r.conclusion === "cancelled");
    const superseded = cancelled.filter((r) => isSuperseded(r, RUNS));
    // 5, not the 27 this asserted before 2026-08-26. The 22 that left the set are the
    // `main` runs in DISPLACED_MAIN_RUNS: they were never superseded, they were displaced,
    // and the guard was mislabelling them. The remaining 5 are all on PR branches, where a
    // newer run genuinely IS a newer commit that replaces the old one.
    expect(superseded.length).toBe(5);
    expect(superseded.every((s) => s.head_branch !== "main")).toBe(true);
    // Every one is declined. The REASON is not uniformly "superseded": run 31831794385 was
    // cancelled, superseded, AND already at run_attempt=2 — a rerun that got cancelled a
    // second time — so guard 2 dismisses it first. That ordering is the desired one (the
    // retry ceiling is the stronger claim), and asserting it exactly documents the overlap
    // instead of hiding it behind a looser matcher.
    const reasons = new Map<number, string>(superseded.map((s) => [s.id, decide(s).reason]));
    for (const s of superseded) expect(decide(s).action).toBe("skip");
    expect([...reasons.values()].filter((r) => r === "superseded").length).toBe(4);
    expect(reasons.get(31831794385)).toBe("already-retried");
  });

  test("removing the newer sibling flips the same run to eligible", () => {
    // Falsifier for guard 3: the decision must actually depend on the sibling's presence.
    const cancelled = RUNS.filter((r) => r.conclusion === "cancelled");
    // Skip the one run that guard 2 dismisses FIRST (31831794385, run_attempt=2). Taking
    // `.find` unqualified picked it once the carve-out shrank this set to 5, and the test
    // then measured guard 2 while claiming to measure guard 3.
    const superseded = cancelled.find((r) => isSuperseded(r, RUNS) && decide(r).reason === "superseded")!;
    expect(superseded).toBeDefined();
    expect(decide(superseded).reason).toBe("superseded");
    // Remove ALL superseding siblings, not just the first: 11 of the 27 have more than one
    // (up to 8, from rapid successive pushes to main), so dropping one leaves the run
    // legitimately superseded and the falsifier would silently prove nothing.
    let without = RUNS.filter((r) => r.id !== superseded.id);
    for (;;) {
      const newer = isSuperseded(superseded, without);
      if (!newer) break;
      without = without.filter((r) => r.id !== newer.id);
    }
    const d = decideRerun(superseded, [...without, superseded], { now: NOW });
    expect(d.reason).not.toBe("superseded");
    expect(d.action).toBe("rerun");
  });
});

// ── THE DEFAULT-BRANCH CARVE-OUT ──────────────────────────────────────────────────────────
//
// Measured 2026-08-26: `rerun-cancelled-gate` performed 66 second attempts on
// `pull_request` and exactly 1 on `push` over 600 runs, because guard 3 keyed on
// `head_branch` alone. On `main` every run shares one branch name, so every displaced run
// was written off as "concurrency working as designed" — a guard that cannot fire on the
// population that needs it, wearing a reassuring string.
//
// These four tests are the pin. Each one FAILS if the `head_sha` predicate is deleted, and
// the pair at the top is the mutation test the fix is judged by.
describe("guard 3 on the default branch — a different commit is not a replacement", () => {
  const at = (id: number, sha: string, createdAt: string, branch = "main"): WorkflowRun => ({
    id,
    head_branch: branch,
    head_sha: sha,
    event: branch === "main" ? "push" : "pull_request",
    status: "completed",
    conclusion: "cancelled",
    created_at: createdAt,
    updated_at: createdAt,
    run_attempt: 1,
  });

  // THE FALSIFIER. Two runs, same branch, different SHA, the second created inside the
  // grace window. Under the pre-fix predicate the older is superseded; it must not be.
  test("same branch + DIFFERENT sha on main is NOT supersession", () => {
    const older = at(1, "aaaaaaaa1111", "2026-08-26T09:24:41Z");
    const newer = at(2, "bbbbbbbb2222", "2026-08-26T09:26:09Z");
    expect(isSuperseded(older, [older, newer])).toBeUndefined();
    const d = decideRerun(older, [older, newer], { now: new Date("2026-08-26T09:30:00Z") });
    expect(d.action).toBe("rerun");
    expect(d.reason).toBe("cancelled-orphan");
  });

  // The control. Change ONLY the sha and supersession returns — so the test above is
  // measuring the sha predicate and not some unrelated property of the two runs.
  test("same branch + SAME sha on main IS supersession (a re-dispatch of one commit)", () => {
    const older = at(1, "aaaaaaaa1111", "2026-08-26T09:24:41Z");
    const newer = at(2, "aaaaaaaa1111", "2026-08-26T09:26:09Z");
    expect(isSuperseded(older, [older, newer])?.id).toBe(2);
    expect(decideRerun(older, [older, newer], { now: new Date("2026-08-26T09:30:00Z") }).reason).toBe("superseded");
  });

  // Off the default branch the predicate is deliberately unchanged: a newer run on a PR
  // branch is a newer commit and DOES replace the old one. A fix that required sha equality
  // everywhere would delete guard 3 on the only lane where it does any work.
  test("same branch + different sha OFF the default branch is still supersession", () => {
    const older = at(1, "aaaaaaaa1111", "2026-08-26T09:24:41Z", "heartbeat/tick-metrics");
    const newer = at(2, "bbbbbbbb2222", "2026-08-26T09:26:09Z", "heartbeat/tick-metrics");
    expect(isSuperseded(older, [older, newer])?.id).toBe(2);
  });

  // Unknown is not "same". Six archived fixture runs carry no `head_sha`; an absent value
  // must never be read as a match, because the cost of that mistake is a discarded verdict.
  test("an unknown sha on the default branch cannot establish supersession", () => {
    // `exactOptionalPropertyTypes` is on, so an ABSENT field is built by omission — which is
    // also how the six archived fixture runs actually carry it.
    const drop = (r: WorkflowRun): WorkflowRun => {
      const copy = { ...r };
      delete copy.head_sha;
      return copy;
    };
    const older = drop(at(1, "aaaaaaaa1111", "2026-08-26T09:24:41Z"));
    const newer = drop(at(2, "bbbbbbbb2222", "2026-08-26T09:26:09Z"));
    expect(isSuperseded(older, [older, newer])).toBeUndefined();
    // …and a KNOWN sha on the older side with an unknown one on the newer is also not a
    // match, so the guard is not accidentally one-sided.
    expect(isSuperseded(at(1, "aaaaaaaa1111", "2026-08-26T09:24:41Z"), [newer])).toBeUndefined();
  });

  // The carve-out follows the ACTUAL default branch, not the string "main". If the repo is
  // renamed and the CLI passes the new name, the protection moves with it — and `main`
  // stops being special, which is the honest consequence.
  test("the carve-out tracks the repository's real default branch", () => {
    const older = at(1, "aaaaaaaa1111", "2026-08-26T09:24:41Z", "trunk");
    const newer = at(2, "bbbbbbbb2222", "2026-08-26T09:26:09Z", "trunk");
    expect(isSuperseded(older, [older, newer])?.id).toBe(2); // default is "main" ⇒ trunk unprotected
    expect(isSuperseded(older, [older, newer], 90, "trunk")).toBeUndefined();
  });
});

describe("guard 4 — stale cancellations are history", () => {
  test("an old cancellation is declined", () => {
    const orphan = RUNS.find((r) => r.id === KNOWN_ORPHANS[0])!;
    const later = new Date(Date.parse(orphan.updated_at) + 999 * 60_000);
    const d = decideRerun(orphan, RUNS, { now: later });
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("stale");
  });
});

describe("the positive case — it actually fires", () => {
  test("every manually-triaged orphan is selected for rerun", () => {
    for (const id of KNOWN_ORPHANS) {
      const run = RUNS.find((r) => r.id === id);
      expect(run).toBeDefined();
      const d = decide(run!);
      expect(d.action).toBe("rerun");
      expect(d.reason).toBe("cancelled-orphan");
    }
  });

  test("every displaced `main` run is now selected — the 2026-08-26 recovery", () => {
    // The measured before/after, as a test rather than a claim. Each of these 22 was
    // previously skipped with `reason: superseded`; each is a commit on `main` whose gate
    // verdict was discarded.
    for (const id of DISPLACED_MAIN_RUNS) {
      const run = RUNS.find((r) => r.id === id);
      expect(run).toBeDefined();
      expect(run!.head_branch).toBe("main");
      const d = decide(run!);
      expect(d.action).toBe("rerun");
      expect(d.reason).toBe("cancelled-orphan");
    }
  });

  test("the carve-out is scoped — the PR lane does not move", () => {
    // The regression bound in the other direction. Guard 3 does 100% of its useful work on
    // PR branches, so the fix must leave that selection byte-identical. If a future edit
    // requires sha equality everywhere, this fails and the earlier tests still pass.
    const selectedOffMain = RUNS.filter((r) => r.head_branch !== "main" && decide(r).action === "rerun").map(
      (r) => r.id,
    );
    expect(asc(selectedOffMain)).toEqual(asc(KNOWN_ORPHANS));
  });

  test("the policy selects EXACTLY the orphan set — no more, no less", () => {
    // The tight bound. Over-selection (waste / masking) and under-selection (the bug
    // survives) both fail here. 32 = the 10 PR-lane orphans + the 22 displaced `main` runs.
    const selected = RUNS.filter((r) => decide(r).action === "rerun").map((r) => r.id);
    expect(selected.length).toBe(32);
    expect(asc(selected)).toEqual(asc([...KNOWN_ORPHANS, ...DISPLACED_MAIN_RUNS]));
  });

  test("selection is a strict subset of cancelled runs", () => {
    for (const r of RUNS) {
      if (decide(r).action === "rerun") expect(r.conclusion).toBe("cancelled");
    }
  });
});

// ── ENDPOINT SELECTION ────────────────────────────────────────────────────────────────────
//
// Without this the guard-3 fix is a no-op. MEASURED 2026-08-26 against run 32952848390, a
// displaced `push` run on `main` with `total_count: 0` jobs:
//
//   POST .../rerun-failed-jobs -> 403 "This workflow run cannot be retried"
//   POST .../rerun             -> 201, run_attempt 2, 35 jobs created
//
// And 403 + that sentence is exactly what `classifyRerunRefusal` calls an ordinary,
// unactionable refusal — so the corrected policy would have selected all 22 displaced runs,
// logged 22 cheerful `refused-not-retriable` skips, and recovered nothing.
describe("chooseRerunEndpoint — a displaced run has no failed jobs to re-run", () => {
  test("zero jobs takes the whole-run endpoint (the only one that works)", () => {
    expect(chooseRerunEndpoint(0)).toBe("rerun");
  });

  test("any job at all keeps the cost discipline", () => {
    // The 2026-08-14 orphans had 26-28 green jobs and 1-2 cancelled; re-running the whole
    // run there burns ~28x the minutes needed and discards good results.
    expect(chooseRerunEndpoint(1)).toBe("rerun-failed-jobs");
    expect(chooseRerunEndpoint(28)).toBe("rerun-failed-jobs");
  });

  test("the boundary is exactly zero, and nothing else", () => {
    // A mutant that flips the comparison to `>= 0` or `> 1` fails here. The predicate must
    // be "are there any jobs", not "are there enough of them".
    const endpoints = [0, 1, 2, 3].map(chooseRerunEndpoint);
    expect(endpoints).toEqual(["rerun", "rerun-failed-jobs", "rerun-failed-jobs", "rerun-failed-jobs"]);
  });

  test("the refusal the wrong endpoint produces is one we would have swallowed", () => {
    // The reason this is a test and not a comment: it pins the collision between the two
    // mechanisms. If `classifyRerunRefusal` ever stops recognising this sentence the
    // failure becomes loud instead of silent, and this test says so out loud.
    expect(classifyRerunRefusal(403, "This workflow run cannot be retried")).toBe("not-retriable");
    expect(REFUSAL_REASON["not-retriable"]).toBe("refused-not-retriable");
  });
});

describe("determinism", () => {
  test("same inputs give the same decision (replayable)", () => {
    for (const r of RUNS) {
      expect(decide(r)).toEqual(decide(r));
    }
  });
});

// ── REFUSAL CLASSIFICATION ────────────────────────────────────────────────────────────────
//
// The pure half of the 2026-08-26 fix. GitHub declines reruns in ordinary, unactionable
// cases, and the CLI used to treat every non-2xx identically — so a normal refusal reddened
// the lane. The classifier decides which is which, and its ONLY safe failure direction is
// "call a refusal genuine": that costs one look at a red run. The other direction — calling
// a genuine error a refusal — makes the tool structurally unable to report breakage.
//
// The table is therefore built from the messages, never the status: both refusals AND the
// rate limit AND the permission error all arrive as 403.
describe("classifyRerunRefusal — the allowlist is closed", () => {
  test("recognises the forge's two refusal sentences", () => {
    expect(classifyRerunRefusal(403, "This workflow run cannot be retried.")).toBe("not-retriable");
    expect(classifyRerunRefusal(403, "This workflow is already running.")).toBe("already-running");
  });

  test("tolerates the punctuation and casing GitHub varies between endpoints", () => {
    expect(classifyRerunRefusal(403, "this workflow run cannot be retried")).toBe("not-retriable");
    expect(classifyRerunRefusal(409, "This workflow is already running")).toBe("already-running");
  });

  // THE LOAD-BEARING ROW. Same status as both refusals, opposite verdict. A mutant that
  // classifies on `status === 403` passes every other test in this block and fails here.
  test("a 403 rate limit is GENUINE, not a refusal", () => {
    expect(classifyRerunRefusal(403, "API rate limit exceeded for user ID 1.")).toBeNull();
    expect(classifyRerunRefusal(403, "You have exceeded a secondary rate limit.")).toBeNull();
  });

  test("a 403 permission error is GENUINE", () => {
    expect(classifyRerunRefusal(403, "Resource not accessible by integration")).toBeNull();
    expect(classifyRerunRefusal(401, "Bad credentials")).toBeNull();
  });

  // "Please wait and retry" contains 'retr'. The phrase must stay specific enough that a
  // message telling you to retry LATER is not read as one telling you never to retry.
  test("a message merely mentioning retrying is not a refusal", () => {
    expect(classifyRerunRefusal(403, "Please wait a few minutes and retry your request.")).toBeNull();
    expect(classifyRerunRefusal(403, "retried")).toBeNull();
  });

  test("5xx is an outage, never a refusal — even carrying a refusal phrase verbatim", () => {
    expect(classifyRerunRefusal(500, "This workflow run cannot be retried.")).toBeNull();
    expect(classifyRerunRefusal(502, "This workflow is already running.")).toBeNull();
    expect(classifyRerunRefusal(503, "")).toBeNull();
  });

  test("a 2xx is never a refusal, and a nonsense status is not either", () => {
    expect(classifyRerunRefusal(200, "This workflow run cannot be retried.")).toBeNull();
    expect(classifyRerunRefusal(Number.NaN, "This workflow run cannot be retried.")).toBeNull();
  });

  test("every refusal class maps to its own distinct log reason", () => {
    const reasons = Object.values(REFUSAL_REASON);
    expect(new Set(reasons).size).toBe(reasons.length);
    for (const r of reasons) expect(r.startsWith("refused-")).toBe(true);
  });

  test("pure — same inputs, same verdict", () => {
    expect(classifyRerunRefusal(403, "This workflow is already running.")).toBe(
      classifyRerunRefusal(403, "This workflow is already running."),
    );
  });
});
