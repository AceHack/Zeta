import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
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
// one a job killed at exactly its `timeout-minutes` (+15-17s runner shutdown).
const KNOWN_ORPHANS = [
  31828395043, 31829982444, 31830257631, 31831632267, 31832877793, 31833360986, 31833735570, 31835015649, 31835303139,
  31835308075,
];

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
  test("supersession is the MAJORITY of cancellations (why the guard pays for itself)", () => {
    const cancelled = RUNS.filter((r) => r.conclusion === "cancelled");
    const superseded = cancelled.filter((r) => isSuperseded(r, RUNS));
    expect(superseded.length).toBe(27);
    // Every one is declined. The REASON is not uniformly "superseded": run 31831794385 was
    // cancelled, superseded, AND already at run_attempt=2 — a rerun that got cancelled a
    // second time — so guard 2 dismisses it first. That ordering is the desired one (the
    // retry ceiling is the stronger claim), and asserting it exactly documents the overlap
    // instead of hiding it behind a looser matcher.
    const reasons = new Map<number, string>(superseded.map((s) => [s.id, decide(s).reason]));
    for (const s of superseded) expect(decide(s).action).toBe("skip");
    expect([...reasons.values()].filter((r) => r === "superseded").length).toBe(26);
    expect(reasons.get(31831794385)).toBe("already-retried");
  });

  test("removing the newer sibling flips the same run to eligible", () => {
    // Falsifier for guard 3: the decision must actually depend on the sibling's presence.
    const cancelled = RUNS.filter((r) => r.conclusion === "cancelled");
    const superseded = cancelled.find((r) => isSuperseded(r, RUNS))!;
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

  test("the policy selects EXACTLY the orphan set — no more, no less", () => {
    // The tight bound. Over-selection (waste / masking) and under-selection (the bug
    // survives) both fail here.
    const selected = RUNS.filter((r) => decide(r).action === "rerun")
      .map((r) => r.id)
      .sort((a, b) => a - b);
    expect(selected).toEqual([...KNOWN_ORPHANS].sort((a, b) => a - b));
  });

  test("selection is a strict subset of cancelled runs", () => {
    for (const r of RUNS) {
      if (decide(r).action === "rerun") expect(r.conclusion).toBe("cancelled");
    }
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
