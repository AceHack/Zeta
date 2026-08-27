import { describe, expect, it } from "bun:test";

import type { FleetLivenessVerdict } from "./heartbeat-liveness";
import {
  LEDGER_BRANCH,
  type GitResult,
  type LivenessObservation,
  appendObservation,
  assessObserverContinuity,
  buildObservation,
  classifyOutcome,
  commitLedger,
  isNonFastForward,
  ledgerDayPath,
  parseLedger,
  pushLedger,
  renderCommitSubject,
  renderObservationLine,
  verdictFromInputs,
} from "./liveness-ledger";

const NOW = new Date("2026-08-27T01:00:00Z");

function verdict(partial: Partial<FleetLivenessVerdict>): FleetLivenessVerdict {
  return {
    alive: true,
    summary: "fleet alive",
    sources: [],
    consideredObservations: 1,
    ...partial,
  };
}

function observation(partial: Partial<LivenessObservation> = {}): LivenessObservation {
  return {
    ...buildObservation({
      now: NOW,
      observer: "github-actions/.github/workflows/heartbeat-liveness.yml",
      observerRunId: "1",
      thresholdMinutes: 60,
      verdict: verdict({}),
    }),
    ...partial,
  };
}

describe("classifyOutcome", () => {
  it("separates degraded from alive rather than flattening both to a boolean", () => {
    // The whole reason this exists: `assessFleetLiveness` returns alive:true the moment ONE
    // source is fresh, so a fleet on its last legs and a fully healthy fleet are the same bit.
    // Recording the bit would make a slow collapse invisible in the ledger.
    const degraded = verdict({
      alive: true,
      sources: [
        { source: "a", lastAt: "2026-08-27T00:55:00Z", ageMinutes: 5, fresh: true },
        { source: "b", lastAt: "2026-08-26T20:00:00Z", ageMinutes: 300, fresh: false },
      ],
    });
    expect(classifyOutcome(degraded)).toBe("degraded");
  });

  it("reports alive only when every source is fresh", () => {
    expect(
      classifyOutcome(
        verdict({ alive: true, sources: [{ source: "a", lastAt: "x", ageMinutes: 5, fresh: true }] }),
      ),
    ).toBe("alive");
  });

  it("reports not-alive when the fleet verdict is negative", () => {
    expect(classifyOutcome(verdict({ alive: false }))).toBe("not-alive");
  });
});

describe("buildObservation", () => {
  it("records a blind observation instead of nothing when the observer cannot see", () => {
    // THE POINT OF THE WHOLE CHANNEL. An annotation-only observer that dies before its verdict
    // leaves silence, and silence reads identically to health. `blind` is a written record that
    // says "nobody knows", which is a different and much louder fact.
    const blind = buildObservation({
      now: NOW,
      observer: "obs",
      thresholdMinutes: 60,
      blindReason: "runs.json does not exist",
    });
    expect(blind.outcome).toBe("blind");
    expect(blind.summary).toContain("OBSERVER BLIND");
    expect(blind.summary).toContain("runs.json does not exist");
    expect(blind.sources).toEqual([]);
  });

  it("refuses a record that carries neither a verdict nor a reason", () => {
    // A ledger slot filled with a content-free record is worse than a gap: the gap is readable
    // as "nobody observed", the empty record is not.
    expect(() => buildObservation({ now: NOW, observer: "obs", thresholdMinutes: 60 })).toThrow(
      /needs either a verdict or a non-empty blindReason/,
    );
    expect(() =>
      buildObservation({ now: NOW, observer: "obs", thresholdMinutes: 60, blindReason: "   " }),
    ).toThrow(/needs either a verdict or a non-empty blindReason/);
  });

  it("refuses a record that claims both a verdict and blindness", () => {
    expect(() =>
      buildObservation({
        now: NOW,
        observer: "obs",
        thresholdMinutes: 60,
        verdict: verdict({}),
        blindReason: "also blind",
      }),
    ).toThrow(/mutually exclusive/);
  });

  it("never invents a run id", () => {
    expect(buildObservation({ now: NOW, observer: "obs", thresholdMinutes: 60, verdict: verdict({}) }).observerRunId).toBeNull();
  });
});

describe("ledgerDayPath", () => {
  it("partitions by UTC day, never by the runner's local day", () => {
    // Local-time day boundaries would put two runs a minute apart into different files depending
    // on which runner took them — local time steering a shared artifact.
    expect(ledgerDayPath("2026-08-27T23:59:59Z")).toBe("observations/2026-08-27.jsonl");
    expect(ledgerDayPath("2026-08-28T00:00:01Z")).toBe("observations/2026-08-28.jsonl");
  });

  it("throws on an unparseable timestamp rather than filing it under today", () => {
    expect(() => ledgerDayPath("not-a-time")).toThrow(/unparseable timestamp/);
  });
});

describe("appendObservation", () => {
  it("appends to an existing day file", () => {
    const first = appendObservation(null, observation({ observerRunId: "1" }));
    const second = appendObservation(first, observation({ observerRunId: "2" }));
    expect(parseLedger(second).observations).toHaveLength(2);
  });

  it("upserts rather than duplicating when the same run records twice", () => {
    // Idempotency (#6). A retried step must not inflate the ledger, or `assessObserverContinuity`
    // could not trust that a record means a run happened.
    const once = appendObservation(null, observation({ observerRunId: "42", summary: "first" }));
    const twice = appendObservation(once, observation({ observerRunId: "42", summary: "second" }));
    const parsed = parseLedger(twice);
    expect(parsed.observations).toHaveLength(1);
    expect(parsed.observations[0]?.summary).toBe("second");
  });

  it("keeps observations from different observers with the same run id apart", () => {
    const a = appendObservation(null, observation({ observer: "actions", observerRunId: "7" }));
    const b = appendObservation(a, observation({ observer: "launchd/otto", observerRunId: "7" }));
    expect(parseLedger(b).observations).toHaveLength(2);
  });

  it("PRESERVES corrupt lines instead of silently dropping them", () => {
    // A rewriter that discards what it cannot parse turns a corrupt ledger into a clean-looking
    // one. The corruption must survive and stay countable.
    const withGarbage = "{not json}\n";
    const after = appendObservation(withGarbage, observation({ observerRunId: "1" }));
    expect(after).toContain("{not json}");
    expect(parseLedger(after).unreadableLines).toBe(1);
    expect(parseLedger(after).observations).toHaveLength(1);
  });

  it("emits exactly one line per record, newline-terminated", () => {
    const text = appendObservation(null, observation());
    expect(text.endsWith("\n")).toBe(true);
    expect(text.trimEnd().split("\n")).toHaveLength(1);
    expect(renderObservationLine(observation())).not.toContain("\n");
  });
});

describe("parseLedger", () => {
  it("counts unreadable lines rather than hiding them", () => {
    const parsed = parseLedger(`${renderObservationLine(observation())}\nnope\n{"observedAt":1}\n`);
    expect(parsed.observations).toHaveLength(1);
    expect(parsed.unreadableLines).toBe(2);
  });
});

describe("assessObserverContinuity", () => {
  const records = (minutesAgo: number, outcome: LivenessObservation["outcome"] = "alive"): LivenessObservation[] => [
    observation({ observedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(), outcome }),
  ];

  it("reports observing when the newest record is inside the window", () => {
    const v = assessObserverContinuity(records(10), NOW, 60);
    expect(v.observing).toBe(true);
    expect(v.ageMinutes).toBe(10);
    expect(v.newestOutcome).toBe("alive");
  });

  it("still reports OBSERVING when the fleet itself is down", () => {
    // The two facts are orthogonal and must not be collapsed: a fresh ledger full of `not-alive`
    // means observation is working perfectly. Reporting that as "not observing" would send an
    // operator to fix the watchdog while the fleet burns.
    const v = assessObserverContinuity(records(5, "not-alive"), NOW, 60);
    expect(v.observing).toBe(true);
    expect(v.newestOutcome).toBe("not-alive");
  });

  // THE ALARM PATHS.

  it("fires when nobody has observed inside the window", () => {
    const v = assessObserverContinuity(records(200), NOW, 60);
    expect(v.observing).toBe(false);
    expect(v.summary).toContain("NOBODY HAS OBSERVED THE FLEET IN 200 MINUTES");
  });

  it("treats an EMPTY ledger as an alarm, never as a pass", () => {
    const v = assessObserverContinuity([], NOW, 60);
    expect(v.observing).toBe(false);
    expect(v.summary).toContain("NO records at all");
  });

  it("treats an all-unparseable ledger as an alarm, never as a pass", () => {
    const v = assessObserverContinuity([observation({ observedAt: "not-a-time" })], NOW, 60);
    expect(v.observing).toBe(false);
    expect(v.summary).toContain("carries a parseable timestamp");
  });

  it("clamps a future-dated record so clock skew cannot silence the alarm forever", () => {
    const v = assessObserverContinuity(records(-500), NOW, 60);
    expect(v.ageMinutes).toBe(0);
    expect(v.observing).toBe(true);
  });
});

describe("verdictFromInputs", () => {
  it("recomputes the verdict from the same arrays the alarm uses, so the two cannot drift", () => {
    const runs = {
      workflow_runs: [
        { created_at: new Date(NOW.getTime() - 5 * 60_000).toISOString(), status: "completed", conclusion: "success" },
      ],
    };
    const v = verdictFromInputs(runs, [], NOW, 60);
    expect(v.alive).toBe(true);
    expect(v.sources[0]?.ageMinutes).toBe(5);
  });

  it("propagates an unrecognised payload rather than manufacturing an empty verdict", () => {
    // Empty means "the lane is stopped" — a real finding. A parser giving up must never
    // fabricate it; the caller turns this throw into a `blind` record instead.
    expect(() => verdictFromInputs({ nope: true }, [], NOW, 60)).toThrow(/unrecognised Actions API payload/);
  });
});

describe("pushLedger", () => {
  const okResult: GitResult = { status: 0, stdout: "", stderr: "" };
  const raced: GitResult = {
    status: 1,
    stdout: "",
    stderr: "! [rejected] HEAD -> liveness/observations (non-fast-forward)",
  };
  const denied: GitResult = {
    status: 128,
    stdout: "",
    stderr: "remote: Permission to Lucent-Financial-Group/Zeta.git denied to github-actions[bot].",
  };

  it("pushes to the ledger branch, never to main", () => {
    const seen: string[][] = [];
    pushLedger({
      git: (args) => {
        seen.push([...args]);
        return okResult;
      },
    });
    expect(seen[0]).toEqual(["push", "origin", `HEAD:${LEDGER_BRANCH}`]);
    expect(seen[0]?.join(" ")).not.toContain("main");
  });

  it("re-syncs onto the winner's tip before retrying a lost race", () => {
    // Without the resync a retry re-pushes an unchanged commit at a ref that moved, which fails
    // identically forever — three copies of one failure wearing the costume of resilience.
    let call = 0;
    let resyncs = 0;
    const result = pushLedger({
      git: () => {
        call += 1;
        return call === 1 ? raced : okResult;
      },
      resync: () => {
        resyncs += 1;
        return okResult;
      },
    });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(resyncs).toBe(1);
  });

  it("aborts when the resync itself fails, rather than pushing over it", () => {
    const failedResync: GitResult = { status: 1, stdout: "", stderr: "could not fetch liveness/observations" };
    let pushes = 0;
    const result = pushLedger({
      git: () => {
        pushes += 1;
        return raced;
      },
      resync: () => failedResync,
    });
    expect(result.ok).toBe(false);
    expect(pushes).toBe(1);
    expect(result.last.stderr).toContain("could not fetch");
  });

  it("does NOT retry a denied credential — it reports it on the first attempt", () => {
    // Retrying a permission failure converts a legible refusal into a slow quiet one. Same defect
    // family as a retry loop probing over the transport it is saturating.
    let calls = 0;
    const result = pushLedger({
      git: () => {
        calls += 1;
        return denied;
      },
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(1);
    expect(result.last.stderr).toContain("Permission to");
  });

  it("gives up loudly after exhausting retries rather than reporting success", () => {
    const result = pushLedger({ git: () => raced, maxAttempts: 3 });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
  });

  it("never reports ok when git was never run", () => {
    const result = pushLedger({ git: () => raced, maxAttempts: 0 });
    expect(result.ok).toBe(false);
    expect(result.last.stdout).toBe("");
  });
});

describe("commitLedger", () => {
  const okResult: GitResult = { status: 0, stdout: "", stderr: "" };
  /** `git diff --cached --quiet` exits 1 when something IS staged. */
  const dirtyIndex: GitResult = { status: 1, stdout: "", stderr: "" };

  it("refuses an empty stage instead of succeeding on it", () => {
    // The false-green shape this whole subsystem exists to stop believing: a step concluding
    // success having committed nothing. `agent-heartbeat.yml` legitimately tolerates an empty
    // stage; this recorder must not, because it just wrote a fresh `observedAt`.
    const result = commitLedger((args) => (args[0] === "diff" ? okResult : okResult), "msg.txt");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("nothing staged");
  });

  it("commits when the write did land", () => {
    const seen: string[][] = [];
    const result = commitLedger((args) => {
      seen.push([...args]);
      return args[0] === "diff" ? dirtyIndex : okResult;
    }, "msg.txt");
    expect(result.status).toBe(0);
    expect(seen.at(-1)).toEqual(["commit", "-F", "msg.txt"]);
  });

  it("surfaces a failing `git add` rather than committing over it", () => {
    const result = commitLedger(() => ({ status: 128, stdout: "", stderr: "fatal: not a git repository" }), "msg.txt");
    expect(result.stderr).toContain("not a git repository");
  });
});

describe("isNonFastForward", () => {
  it("matches git's own rejection wording", () => {
    expect(isNonFastForward({ status: 1, stdout: "", stderr: "hint: Updates were rejected because the remote contains work" })).toBe(true);
    expect(isNonFastForward({ status: 1, stdout: "", stderr: "! [rejected] (fetch first)" })).toBe(true);
  });

  it("does NOT swallow a permission denial into the retry path", () => {
    expect(isNonFastForward({ status: 128, stdout: "", stderr: "remote: Permission to X denied" })).toBe(false);
    expect(isNonFastForward({ status: 128, stdout: "", stderr: "remote: Protected branch update failed" })).toBe(false);
  });
});

describe("renderCommitSubject", () => {
  it("carries the outcome so `git log --oneline` alone is a usable read", () => {
    expect(renderCommitSubject(observation({ outcome: "not-alive" }))).toBe(
      `liveness(not-alive): observed ${NOW.toISOString()}`,
    );
  });
});
