// verdict-drought.test.ts -- falsifiers for the main gate-verdict drought fold.
//
// HERMETIC BY CONSTRUCTION. Every test builds its observations in-process and injects
// `now` as a literal string. No network, no clock, no fixture file that could drift out
// from under the assertions -- so the whole suite replays deterministically (§7 DST).
//
// The two that carry the design, and the two the change was asked to prove:
//
//   1. A WINDOW OF ONLY `cancelled` RUNS IS `unknown` -- never `ok`, never green, and
//      loud at `::error::`. That is the exact defect: `cancelled` reads as neither pass
//      nor fail, so every surface that folds outcomes finds nothing and prints green.
//   2. A `failure` IS A VERDICT. The check is about verdict PRESENCE, not verdict
//      COLOUR. Getting this backwards would make a red `main` -- which is being checked
//      and is therefore in a KNOWN state -- look like an unchecked one.
//
// Discrimination was proved by inversion, not by assertion: with `isVerdict` widened to
// accept `cancelled`, test 1 goes red ("expected unknown, received ok") and with it
// narrowed to `success` alone, test 2 goes red. Both were restored. A test that passes
// under the inverted implementation is not a falsifier.

import { describe, expect, test } from "bun:test";

import {
  assertDroughtDetectorLive,
  constrainCount,
  constrainId,
  constrainSha,
  DEFAULT_DROUGHT_THRESHOLDS,
  detectStaleWindow,
  droughtAnnotations,
  foldDrought,
  isVerdict,
  median,
  minutesBetween,
  orderNewestFirst,
  renderDroughtMarkdown,
  RUNNING,
  selfIsInsideWindow,
  selfWitnessFromEnv,
  severityOfRegister,
  shortSha,
  toObservation,
  UNRECOGNISED_CONCLUSION,
  UNRECOGNISED_ID,
  UNRECOGNISED_INSTANT,
  UNRECOGNISED_SHA,
  type DroughtThresholds,
  type GateRunObservation,
} from "./verdict-drought.ts";

const NOW = "2026-08-23T17:35:00Z";

/** Minutes before NOW, as an ISO instant. Keeps the fixtures readable. */
function ago(minutes: number): string {
  return new Date(Date.parse(NOW) - minutes * 60_000).toISOString().replace(".000Z", "Z");
}

function obs(id: number, conclusion: string, endedMinutesAgo: number, durationMin = 14): GateRunObservation {
  return {
    id,
    sha: `${String(id).padStart(8, "0")}deadbeef`,
    conclusion,
    startedAt: ago(endedMinutesAgo + durationMin),
    endedAt: ago(endedMinutesAgo),
  };
}

/** The live storm, reduced: merges outrunning a ~14 min gate, everything cancelled. */
function allCancelled(count: number): GateRunObservation[] {
  return Array.from({ length: count }, (_, i) => obs(1000 + i, "cancelled", i * 2, 1));
}

describe("isVerdict -- the strict allow-list", () => {
  test("success and failure are verdicts; nothing else is", () => {
    expect(isVerdict("success")).toBe(true);
    expect(isVerdict("failure")).toBe(true);
    // The whole point. Each of these has been observed on this repo's gate runs.
    for (const notAVerdict of ["cancelled", "skipped", "timed_out", "stale", "neutral", "action_required", RUNNING, "unknown", ""]) {
      expect(isVerdict(notAVerdict)).toBe(false);
    }
  });
});

describe("FALSIFIER 1 -- a window of only `cancelled` runs is UNKNOWN, never ok", () => {
  const report = foldDrought(allCancelled(20), 20, NOW);

  test("the register is `unknown` and is NOT `ok`", () => {
    // Inverting `isVerdict` to accept `cancelled` turns this line red: the fold then
    // finds a "verdict" 0 min old and returns `ok`. That is the discrimination proof.
    expect(report.register).toBe("unknown");
    expect(report.register).not.toBe("ok");
  });

  test("no verdict is reported, and the count of verdicts is honestly zero", () => {
    expect(report.lastVerdict).toBeNull();
    expect(report.lastSuccess).toBeNull();
    expect(report.verdictRuns).toBe(0);
    expect(report.cancelledRuns).toBe(20);
    // Elapsed time is `null`, NOT 0. A drought you cannot measure is not a zero drought.
    expect(report.minutesSinceVerdict).toBeNull();
    expect(report.minutesSinceSuccess).toBeNull();
  });

  test("it reaches the LOUD surface as an ::error::, not a warning and not silence", () => {
    const lines = droughtAnnotations(report, assertDroughtDetectorLive(report));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toStartWith("::error ");
    expect(lines.join("\n")).toContain("NO COMPLETED VERDICT");
  });

  test("severity never DECREASES as knowledge decreases", () => {
    // `unknown` is less known than `drought`, so it may never be the quieter of the two.
    expect(severityOfRegister("unknown")).toBe("error");
    expect(severityOfRegister("drought")).toBe("error");
    expect(severityOfRegister("ok")).toBeNull();
  });

  test("the rendered summary says UNKNOWN and never claims the lane is ok", () => {
    const md = renderDroughtMarkdown(report, assertDroughtDetectorLive(report));
    expect(md).toContain("UNKNOWN -- main has NO completed verdict in the window");
    expect(md).toContain("`unknown`");
    expect(md).not.toContain("OK -- main has a recent completed verdict");
  });

  test("the DETECTOR is live even though the LANE is silent -- they are different claims", () => {
    // Conflating them is how a working detector gets muted for reporting bad news.
    const liveness = assertDroughtDetectorLive(report);
    expect(liveness.live).toBe(true);
    expect(liveness.reason).toContain("the LANE is the thing that is silent");
  });
});

describe("FALSIFIER 2 -- a `failure` IS a verdict (presence, not colour)", () => {
  const window: GateRunObservation[] = [
    obs(2005, "cancelled", 1, 1),
    obs(2004, "cancelled", 3, 1),
    obs(2003, "failure", 6),
    obs(2002, "cancelled", 30, 1),
    obs(2001, "success", 60),
  ];
  const report = foldDrought(window, 2, NOW);

  test("the newest failure satisfies the check -- register `ok`, no drought", () => {
    // Narrowing `isVerdict` to `success` alone turns this red: the fold then measures
    // from run 2001 (60 min) and returns `drought`.
    expect(report.register).toBe("ok");
    expect(report.lastVerdict?.runId).toBe(2003);
    expect(report.lastVerdict?.conclusion).toBe("failure");
    expect(report.minutesSinceVerdict).toBe(6);
  });

  test("a red main is a KNOWN main -- and the success drought is reported SEPARATELY", () => {
    // These are two different facts and the report refuses to collapse them.
    expect(report.lastSuccess?.runId).toBe(2001);
    expect(report.minutesSinceSuccess).toBe(60);
    expect(report.minutesSinceSuccess).not.toBe(report.minutesSinceVerdict);
  });

  test("the ok register emits no REGISTER annotation -- an alarm always lit is muted", () => {
    // 3 cancelled of 5 = 60%, so the RATE band fires; the register band must not.
    const lines = droughtAnnotations(report, assertDroughtDetectorLive(report));
    expect(lines.some((l) => l.includes("main gate-verdict"))).toBe(false);
  });

  test("a quiet lane with a low cancellation rate emits NOTHING at all", () => {
    const calm = foldDrought([obs(2101, "success", 3), obs(2102, "success", 20)], 1, NOW);
    expect(calm.register).toBe("ok");
    expect(droughtAnnotations(calm, assertDroughtDetectorLive(calm))).toEqual([]);
  });
});

describe("the two drought axes are independent", () => {
  test("TIME: an old verdict with few commits on top is still a drought", () => {
    const report = foldDrought([obs(3001, "success", 50), ...allCancelled(5)], 2, NOW);
    expect(report.register).toBe("drought");
    expect(report.minutesSinceVerdict).toBe(50);
    expect(report.reasons.join(" ")).toContain("LAST COMPLETED VERDICT");
  });

  test("COMMITS: a fresh verdict with a large unverified pile on top is still a drought", () => {
    // The live 2026-08-23 shape: a `failure` verdict 4 min old with 13 commits on top.
    const report = foldDrought([obs(3002, "failure", 4), ...allCancelled(8)], 13, NOW);
    expect(report.register).toBe("drought");
    expect(report.minutesSinceVerdict).toBe(4);
    expect(report.unverifiedCommits).toBe(13);
    expect(report.reasons.join(" ")).toContain("13 commit(s) have landed on main");
  });

  test("`50 minutes quiet` and `50 minutes with 20 unverified commits` are different reports", () => {
    const quiet = foldDrought([obs(3003, "success", 50)], 0, NOW);
    const loaded = foldDrought([obs(3003, "success", 50)], 20, NOW);
    expect(quiet.unverifiedCommits).toBe(0);
    expect(loaded.unverifiedCommits).toBe(20);
    expect(loaded.reasons.length).toBeGreaterThan(quiet.reasons.length);
  });
});

describe("an unmeasured commit count is never rendered as zero", () => {
  const report = foldDrought([obs(4001, "success", 5)], null, NOW);

  test("`null` survives the fold and is named out loud", () => {
    expect(report.unverifiedCommits).toBeNull();
    expect(report.unverifiedCommits).not.toBe(0);
    expect(report.reasons.join(" ")).toContain("COMMIT COUNT NOT MEASURED");
  });

  test("the summary prints `not measured`, not `0`", () => {
    const md = renderDroughtMarkdown(report, assertDroughtDetectorLive(report));
    expect(md).toContain("**not measured**");
  });

  test("an unmeasured count cannot by itself trip the commit threshold", () => {
    // The honest direction: unknown does not manufacture an alarm, it manufactures a
    // stated unknown. The register stays `ok` on the time axis and the reason says why.
    expect(report.register).toBe("ok");
  });
});

describe("the detector is loud about its OWN silence", () => {
  test("an empty window is `unknown` AND the detector reports itself not live", () => {
    const report = foldDrought([], null, NOW);
    expect(report.register).toBe("unknown");
    expect(report.windowRuns).toBe(0);
    const liveness = assertDroughtDetectorLive(report);
    expect(liveness.live).toBe(false);
    expect(liveness.reason).toContain("DROUGHT DETECTOR WENT QUIET");
    const lines = droughtAnnotations(report, liveness);
    // TWO errors: the lane is unknown, and the instrument cannot prove it looked.
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain("went quiet");
  });

  test("commits landing with ZERO runs is named as a broken trigger, not a slow gate", () => {
    const report = foldDrought([obs(5001, "success", 5)], 7, NOW);
    expect(report.runsSinceVerdict).toBe(0);
    expect(report.triggerLooksBroken).toBe(true);
    expect(report.reasons.join(" ")).toContain("TRIGGER MAY BE BROKEN");
  });

  test("runs firing after the verdict is NOT a broken trigger", () => {
    const report = foldDrought([obs(5002, "success", 5), obs(5003, "cancelled", 1, 1)], 7, NOW);
    expect(report.runsSinceVerdict).toBe(1);
    expect(report.triggerLooksBroken).toBe(false);
  });
});

describe("cancellation rate and window bounding", () => {
  test("the rate is over the observed window and is called out at the threshold", () => {
    const report = foldDrought([...allCancelled(6), obs(6001, "success", 2)], 1, NOW);
    expect(report.cancelledRuns).toBe(6);
    expect(report.windowRuns).toBe(7);
    expect(report.cancelRate).toBeCloseTo(6 / 7, 6);
    expect(report.reasons.join(" ")).toContain("CANCELLATION RATE");
  });

  test("the window is BOUNDED before anything is counted -- old history cannot leak in", () => {
    const t: DroughtThresholds = { ...DEFAULT_DROUGHT_THRESHOLDS, windowRuns: 3 };
    // Run 900 is the only verdict and it is the OLDEST (lowest id); the bound excludes it.
    const report = foldDrought([obs(900, "success", 90), ...allCancelled(5)], 4, NOW, t);
    expect(report.windowRuns).toBe(3);
    expect(report.register).toBe("unknown");
    expect(report.lastVerdict).toBeNull();
  });

  test("a still-running run is counted as a non-verdict, never as absence", () => {
    const report = foldDrought([obs(8001, RUNNING, 0, 3), ...allCancelled(3)], 4, NOW);
    expect(report.runningRuns).toBe(1);
    expect(report.verdictRuns).toBe(0);
    expect(report.register).toBe("unknown");
  });

  test("`skipped` and `timed_out` land in `other`, and still do not satisfy the check", () => {
    const report = foldDrought([obs(9001, "skipped", 1, 0), obs(9002, "timed_out", 2)], 1, NOW);
    expect(report.otherRuns).toBe(2);
    expect(report.verdictRuns).toBe(0);
    expect(report.register).toBe("unknown");
  });
});

describe("purity -- the fold is deterministic and takes its clock as an argument", () => {
  test("same observations + same now => byte-identical report (§6 idempotency, §7 DST)", () => {
    const window = [...allCancelled(4), obs(9101, "failure", 20)];
    const a = JSON.stringify(foldDrought(window, 3, NOW));
    const b = JSON.stringify(foldDrought([...window].reverse(), 3, NOW));
    expect(a).toBe(b);
  });

  test("advancing the injected clock is what moves the register -- no ambient time", () => {
    const window = [obs(9201, "success", 0)];
    expect(foldDrought(window, 0, NOW).register).toBe("ok");
    const later = new Date(Date.parse(NOW) + 60 * 60_000).toISOString();
    expect(foldDrought(window, 0, later).register).toBe("drought");
  });

  test("reasons are never empty -- the report always states why it says what it says", () => {
    expect(foldDrought([obs(9301, "success", 1)], 0, NOW).reasons.length).toBeGreaterThan(0);
    expect(foldDrought([], null, NOW).reasons.length).toBeGreaterThan(0);
  });
});

describe("helpers", () => {
  test("orderNewestFirst is by run id, not by timestamp", () => {
    const ordered = orderNewestFirst([obs(1, "success", 1), obs(9, "success", 90), obs(5, "success", 45)]);
    expect(ordered.map((r) => r.id)).toEqual([9, 5, 1]);
  });

  test("minutesBetween returns null on an unparseable instant rather than NaN", () => {
    expect(minutesBetween("2026-08-23T17:00:00Z", "2026-08-23T17:30:00Z")).toBe(30);
    expect(minutesBetween("not-a-date", NOW)).toBeNull();
  });

  test("median of an empty sample is null, not 0", () => {
    expect(median([])).toBeNull();
    expect(median([14, 2, 30])).toBe(14);
  });

  test("toObservation maps an in-flight run to RUNNING, never to its null conclusion", () => {
    const running = toObservation({
      id: 1,
      head_sha: "abc",
      status: "in_progress",
      conclusion: null,
      created_at: NOW,
      updated_at: NOW,
    });
    expect(running.conclusion).toBe(RUNNING);
    expect(isVerdict(running.conclusion)).toBe(false);

    const done = toObservation({
      id: 2,
      head_sha: "def",
      status: "completed",
      conclusion: "cancelled",
      created_at: NOW,
      updated_at: NOW,
    });
    expect(done.conclusion).toBe("cancelled");
    expect(isVerdict(done.conclusion)).toBe(false);
  });
});

describe("the live 2026-08-23 measurement, replayed from its own numbers", () => {
  // last SUCCESS 10fbd9a4 ended 16:43:22Z; last 8 runs 6 cancelled / 2 running / 0 success;
  // three merges inside 24 s. Injected now = 17:33:54Z, as measured.
  const liveNow = "2026-08-23T17:33:54Z";
  const window: GateRunObservation[] = [
    { id: 33645, sha: "6426eacf", conclusion: RUNNING, startedAt: "2026-08-23T17:30:37Z", endedAt: "2026-08-23T17:30:38Z" },
    { id: 33644, sha: "3f0e0c99", conclusion: "cancelled", startedAt: "2026-08-23T17:30:29Z", endedAt: "2026-08-23T17:30:38Z" },
    { id: 33643, sha: "087b6508", conclusion: "cancelled", startedAt: "2026-08-23T17:30:13Z", endedAt: "2026-08-23T17:30:30Z" },
    { id: 33634, sha: "60180789", conclusion: "cancelled", startedAt: "2026-08-23T17:28:07Z", endedAt: "2026-08-23T17:30:14Z" },
    { id: 33632, sha: "f6f5c971", conclusion: "cancelled", startedAt: "2026-08-23T17:27:37Z", endedAt: "2026-08-23T17:28:08Z" },
    { id: 33631, sha: "2627ef96", conclusion: "cancelled", startedAt: "2026-08-23T17:27:13Z", endedAt: "2026-08-23T17:27:39Z" },
    { id: 33624, sha: "3168e541", conclusion: RUNNING, startedAt: "2026-08-23T17:24:18Z", endedAt: "2026-08-23T17:25:10Z" },
    { id: 33623, sha: "5e035ef2", conclusion: "cancelled", startedAt: "2026-08-23T17:24:10Z", endedAt: "2026-08-23T17:24:19Z" },
  ];

  test("the eight-run window the human counted by hand is `unknown`, and would have been green", () => {
    const report = foldDrought(window, 20, liveNow);
    expect(report.register).toBe("unknown");
    expect(report.cancelledRuns).toBe(6);
    expect(report.runningRuns).toBe(2);
    expect(report.verdictRuns).toBe(0);
    expect(report.cancelRate).toBeCloseTo(0.75, 6);
  });

  test("adding the 16:43:22Z success back turns it into a MEASURABLE 50 min drought", () => {
    const withSuccess = [
      ...window,
      { id: 33569, sha: "10fbd9a4", conclusion: "success", startedAt: "2026-08-23T16:29:06Z", endedAt: "2026-08-23T16:43:22Z" },
    ];
    const report = foldDrought(withSuccess, 20, liveNow);
    expect(report.register).toBe("drought");
    expect(report.minutesSinceVerdict).toBe(51);
    expect(report.unverifiedCommits).toBe(20);
    expect(report.medianVerdictMinutes).toBe(14);
  });
});


// ---------------------------------------------------------------------------
// The API -> model boundary. CodeQL `js/http-to-file-access` on the two file writes.
// ---------------------------------------------------------------------------
//
// The alert was substantive: the sinks' PATHS are constants ($GITHUB_STEP_SUMMARY from
// the runner, --out from argv), but the CONTENT came from the Actions API and landed, by
// string concatenation, in two STRUCTURED formats -- a markdown table and an
// `::error title=...::` workflow command. A `|` splits a cell, a newline ends the table
// or forges a second workflow command.
//
// The fix is structural, not a blocklist: every network-derived value is matched against
// an anchored shape and REPLACED by a fixed constant on failure, so the injection is not
// filtered, it is unexpressible. These are the falsifiers for that claim -- each one
// fails if a `constrain*` call is removed from `toObservation`.

describe("the API -> model boundary constrains every network-derived value", () => {
  /** Exactly the shapes a compromised or changed API could return. */
  const hostile = {
    id: Number.NaN,
    head_sha: "abc | ROW-BREAK\n| forged | row | here |",
    status: "completed",
    conclusion: "success\n::error title=forged::injected workflow command",
    created_at: "2026-08-23T00:00:00Z\n| another | forged | row |",
    updated_at: "not-an-instant",
  };

  test("each field is REPLACED by a self-describing constant, not escaped or repaired", () => {
    const o = toObservation(hostile);
    expect(o.id).toBe(UNRECOGNISED_ID);
    expect(o.sha).toBe(UNRECOGNISED_SHA);
    expect(o.conclusion).toBe(UNRECOGNISED_CONCLUSION);
    expect(o.startedAt).toBe(UNRECOGNISED_INSTANT);
    expect(o.endedAt).toBe(UNRECOGNISED_INSTANT);
  });

  test("a well-formed payload passes through UNCHANGED -- the constraint is not a filter", () => {
    const o = toObservation({
      id: 32654718640,
      head_sha: "3168e5411a2b3c4d5e6f708192a3b4c5d6e7f809",
      status: "completed",
      conclusion: "failure",
      created_at: "2026-08-23T17:24:18Z",
      updated_at: "2026-08-23T17:37:52.123Z",
    });
    expect(o.id).toBe(32654718640);
    expect(o.sha).toBe("3168e5411a2b3c4d5e6f708192a3b4c5d6e7f809");
    expect(o.conclusion).toBe("failure");
    // CANONICALISED, not passed through: instants are re-emitted from parsed epoch ms, so
    // `…:18Z` and `…:18.000Z` stop being two different strings in a diffed table.
    expect(o.endedAt).toBe("2026-08-23T17:37:52.123Z");
    expect(o.startedAt).toBe("2026-08-23T17:24:18.000Z");
  });

  test("an instant is canonicalised to one format regardless of which the API sent", () => {
    const withZ = toObservation({ id: 1, head_sha: "abcdef1", status: "completed", conclusion: "success", created_at: "2026-08-23T17:24:18Z", updated_at: "2026-08-23T17:24:18Z" });
    const withMillis = toObservation({ id: 1, head_sha: "abcdef1", status: "completed", conclusion: "success", created_at: "2026-08-23T17:24:18.000Z", updated_at: "2026-08-23T17:24:18.000Z" });
    expect(withZ.endedAt).toBe(withMillis.endedAt);
  });

  test("AN UNRECOGNISED CONCLUSION IS NEVER A VERDICT -- the direction that turns a drought green", () => {
    expect(isVerdict(UNRECOGNISED_CONCLUSION)).toBe(false);
    const report = foldDrought([toObservation(hostile)], 5, NOW);
    expect(report.register).not.toBe("ok");
    expect(report.lastVerdict).toBeNull();
  });

  // The fixture above never reaches the RENDERER: its conclusion is not a verdict, so
  // the fold discards it before the table is built. That makes it useless as a falsifier
  // for the injection surface, which is a lesson worth keeping -- a hostile input that
  // the code never looks at proves nothing. THIS one is the realistic case: a perfectly
  // ordinary `success` whose sha and timestamp are hostile, old enough to be a drought,
  // so its values land in BOTH the table and the `::error::` annotation.
  const hostileButVerdict = {
    id: 4242,
    head_sha: "deadbee | ROW-BREAK\n| forged | table | row |",
    status: "completed",
    conclusion: "success",
    created_at: "2026-08-23T16:29:06Z",
    updated_at: "2026-08-23T16:43:22Z\n::error title=forged::injected workflow command",
  };

  test("the hostile-but-valid verdict DOES reach the renderer -- the fixture is exercised", () => {
    const report = foldDrought([toObservation(hostileButVerdict)], 5, NOW);
    expect(report.lastVerdict).not.toBeNull();
    expect(report.lastVerdict?.sha).toBe(UNRECOGNISED_SHA);
    expect(report.lastVerdict?.endedAt).toBe(UNRECOGNISED_INSTANT);
    // Age is unmeasurable once the timestamp is replaced, so the register is `unknown`
    // rather than a confidently-wrong `ok`.
    expect(report.register).toBe("unknown");
  });

  test("nothing that reaches the SUMMARY can break the markdown table", () => {
    const report = foldDrought([toObservation(hostileButVerdict)], 5, NOW);
    const md = renderDroughtMarkdown(report, assertDroughtDetectorLive(report));
    expect(md).not.toContain("forged");
    expect(md).not.toContain("ROW-BREAK");
    // Every table row is one line with a fixed column count -- no injected structure.
    const rows = md.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| ---"));
    for (const row of rows) expect(row.split("|").length).toBe(4);
  });

  test("nothing that reaches an ANNOTATION can forge a second workflow command", () => {
    const report = foldDrought([toObservation(hostileButVerdict)], 5, NOW);
    for (const line of droughtAnnotations(report, assertDroughtDetectorLive(report))) {
      expect(line).not.toContain("\n");
      expect(line).not.toContain("forged");
      // One `::sev title=...::` prefix and nothing that could open another.
      expect(line.split("::").length).toBe(3);
    }
  });

  // TWO SEPARATE PROTECTIONS, and this test asserts both rather than conflating them:
  // `JSON.stringify` guarantees the STRUCTURE (a newline is escaped to `\\n`, so no field
  // can ever break out of the document -- this sink was never structurally injectable),
  // and the boundary constraint guarantees the CONTENT (no hostile value is carried at
  // all). Never build this string by concatenation.
  test("the JSON artifact is structurally safe via JSON.stringify AND carries no hostile content", () => {
    const report = foldDrought([toObservation(hostileButVerdict)], 5, NOW);
    const encoded = JSON.stringify({ report, liveness: assertDroughtDetectorLive(report) });
    expect(JSON.parse(encoded)).toBeTruthy();
    expect(encoded).not.toContain("forged");
  });

  // The two functions that used to hand back the ARGUMENT now re-emit -- shas from
  // `HEX_DIGITS`, ids through `Math.trunc`. There is NO behavioural falsifier for that:
  // in JavaScript a re-emitted string is indistinguishable from the one it copies, which
  // is exactly the property that makes it safe. What IS falsifiable is that the copy is
  // exact, which is the risk the loop introduces, so that is what these assert.
  test("a re-emitted sha is byte-for-byte its argument, at both ends of the length range", () => {
    const sha1 = "3168e5411a2b3c4d5e6f708192a3b4c5d6e7f809";
    const sha256 = "0123456789abcdef".repeat(4);
    expect(constrainSha(sha1)).toBe(sha1);
    expect(constrainSha(sha256)).toBe(sha256);
    expect(constrainSha("0000000")).toBe("0000000");
    expect(constrainSha("f".repeat(64))).toBe("f".repeat(64));
    // One character past the ends of the shape, in both directions.
    expect(constrainSha("000000")).toBe(UNRECOGNISED_SHA);
    expect(constrainSha("0".repeat(65))).toBe(UNRECOGNISED_SHA);
  });

  test("a re-emitted id is its argument, and a non-integer is still the sentinel", () => {
    expect(constrainId(32654718640)).toBe(32654718640);
    expect(constrainId(0)).toBe(0);
    expect(constrainId(1.5)).toBe(UNRECOGNISED_ID);
    expect(constrainId(Number.NaN)).toBe(UNRECOGNISED_ID);
  });

  test("shortSha does not slice a sentinel into something that reads like a real sha", () => {
    expect(shortSha("3168e5411a2b3c4d5e6f708192a3b4c5d6e7f809")).toBe("3168e541");
    expect(shortSha(UNRECOGNISED_SHA)).toBe(UNRECOGNISED_SHA);
    expect(shortSha(UNRECOGNISED_SHA)).not.toBe("(unrecog");
  });
});

// ---------------------------------------------------------------------------
// The COUNT boundary -- `compare.ahead_by`, the field the alert was actually about
// ---------------------------------------------------------------------------
//
// The block above hardened every field of `toObservation` and the CodeQL alert did not
// move, because the reported flow never went through `toObservation`: it went through the
// SECOND api call, `compare`, whose `ahead_by` reached the fold behind nothing but
// `typeof x === "number"`. These tests pin the two halves of the fix -- that a non-count
// becomes the NOT-MEASURED register, and that a real count is passed through untouched.

describe("a count that is not a count is NOT MEASURED, never a number that compares false", () => {
  const verdictFiveMinAgo = [obs(5001, "success", 5)];

  test("`NaN`, `Infinity`, negative and fractional counts all become `null`", () => {
    expect(constrainCount(Number.NaN)).toBeNull();
    expect(constrainCount(Number.POSITIVE_INFINITY)).toBeNull();
    expect(constrainCount(-1)).toBeNull();
    expect(constrainCount(1.5)).toBeNull();
    expect(constrainCount("12")).toBeNull();
    expect(constrainCount(undefined)).toBeNull();
  });

  test("a real count is a COPY, not a repair -- the constraint is not a filter", () => {
    expect(constrainCount(0)).toBe(0);
    expect(constrainCount(37)).toBe(37);
  });

  // THE FALSIFIER. This is the defect the constraint removes, demonstrated on the fold
  // itself rather than asserted: `NaN` claims to be measured and then silences every
  // surface that would have reported it.
  test("an unconstrained `NaN` reads as MEASURED and refuses to fire -- the constrained one does not", () => {
    const raw = foldDrought(verdictFiveMinAgo, Number.NaN, NOW);
    expect(raw.unverifiedCommits).not.toBeNull();
    expect(raw.reasons.join(" ")).not.toContain("COMMIT COUNT NOT MEASURED");
    expect(renderDroughtMarkdown(raw, assertDroughtDetectorLive(raw))).toContain("NaN");

    const constrained = foldDrought(verdictFiveMinAgo, constrainCount(Number.NaN), NOW);
    expect(constrained.unverifiedCommits).toBeNull();
    expect(constrained.reasons.join(" ")).toContain("COMMIT COUNT NOT MEASURED");
    expect(renderDroughtMarkdown(constrained, assertDroughtDetectorLive(constrained))).toContain("**not measured**");
  });

  test("a `NaN` count cannot trip -- or suppress -- the commit threshold", () => {
    // Both directions matter. `NaN >= threshold` is `false`, so an over-threshold drought
    // measured as `NaN` would have rendered `ok`; `null` renders `ok` too, but says so.
    const overThreshold = DEFAULT_DROUGHT_THRESHOLDS.maxUnverifiedCommits + 1;
    expect(foldDrought(verdictFiveMinAgo, Number.NaN, NOW).register).toBe("ok");
    expect(foldDrought(verdictFiveMinAgo, overThreshold, NOW).register).toBe("drought");
    expect(foldDrought(verdictFiveMinAgo, constrainCount(overThreshold), NOW).register).toBe("drought");
  });
});

describe("an unmeasurable age is `unknown`, never `ok` (the hole the boundary work exposed)", () => {
  test("a verdict whose timestamp does not parse cannot report as healthy", () => {
    // Reachable the moment `updated_at` is replaced by a sentinel. Before this branch
    // existed the fold computed `overTime = false` and returned `ok`: an unmeasurable
    // drought reading as a healthy one, inside the detector built to catch exactly that.
    const report = foldDrought(
      [{ id: 1, sha: "abcdef1", conclusion: "success", startedAt: NOW, endedAt: UNRECOGNISED_INSTANT }],
      0,
      NOW,
    );
    expect(report.minutesSinceVerdict).toBeNull();
    expect(report.register).toBe("unknown");
    expect(report.reasons.join(" ")).toContain("AGE CANNOT BE MEASURED");
  });

  test("an unparseable injected `now` is likewise `unknown`", () => {
    const report = foldDrought([obs(1, "success", 1)], 0, "not-a-clock");
    expect(report.register).toBe("unknown");
  });
});


describe("the cancellation rate is annotated INDEPENDENTLY of the register", () => {
  // The live gap, found by the first CI run rather than by a test: `drift (loud)` run
  // 32657724476 reported register `ok` with a 60% cancellation rate and a 112-minute
  // success drought, and emitted NO annotation at all. The rate is the leading indicator
  // of the drought -- merges outrunning the gate is the mechanism that produces one -- so
  // it must not be silent just because a verdict happens to be recent.
  const okButOutrun = foldDrought([obs(9401, "failure", 1), ...allCancelled(9)], 4, NOW);

  test("register `ok` with a high cancellation rate STILL emits a loud line", () => {
    expect(okButOutrun.register).toBe("ok");
    expect(okButOutrun.cancelRate).toBeGreaterThanOrEqual(DEFAULT_DROUGHT_THRESHOLDS.cancelRateWarn);
    const lines = droughtAnnotations(okButOutrun, assertDroughtDetectorLive(okButOutrun));
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("::warning title=gate cancellation rate::");
    expect(lines[0]).toContain("CANCELLED");
  });

  test("it is a WARNING, not an error -- the rate is a forecast, the register is the fault", () => {
    const lines = droughtAnnotations(okButOutrun, assertDroughtDetectorLive(okButOutrun));
    expect(lines[0]).not.toContain("::error");
  });

  test("it is NOT emitted twice when the register is already loud", () => {
    // A drought's own reason list already carries the rate; annotating it again is how a
    // real signal gets tuned out.
    const drought = foldDrought(allCancelled(12), 4, NOW);
    const lines = droughtAnnotations(drought, assertDroughtDetectorLive(drought));
    expect(lines.filter((l) => l.includes("gate cancellation rate")).length).toBe(0);
    expect(lines[0]).toContain("CANCELLATION RATE");
  });
});


/**
 * THE STALE-LISTING GUARD -- the falsifiers for the 2026-08-27 false drought.
 *
 * Live instance: `drift (loud)` in gate run 33080913662 reported a 35,703-minute /
 * 6,029-commit drought while `main` had been verdicted 19 minutes earlier. The code was
 * correct; its INPUT was a ~25-day-stale page that the Actions API served with a 200 and
 * no error, intermittently, from the same credential that returned fresh pages minutes
 * either side. Nothing in the reporter could tell the two apart, so the loudest detector
 * in the repo was loud about a fact that was not true, on 44 of the last 60 pushes.
 *
 * These pin the one fact a stale listing cannot fake: the reporter is itself a run the
 * listing must contain.
 */
describe("a window that cannot see the caller is stale, not a drought", () => {
  const IN_WINDOW = {
    runId: "33080913662",
    eventName: "push",
    refName: "main",
    workflowRef: "Lucent-Financial-Group/Zeta/.github/workflows/gate.yml@refs/heads/main",
  };

  test("the live 2026-08-27 shape: caller absent from a stale page => STALE, never drought", () => {
    // The page the API actually served: newest run ~25 days old, caller nowhere in it.
    const stalePage = [obs(30763213560, "success", 35_700), obs(30762762709, "success", 35_703)];
    const msg = detectStaleWindow(stalePage, IN_WINDOW);
    expect(msg).not.toBeNull();
    expect(msg).toMatch(/STALE LISTING, NOT A DROUGHT/);
    expect(msg).toContain("33080913662");
  });

  test("caller PRESENT => the guard stands down and the fold is trusted", () => {
    const freshPage = [obs(33080913662, "failure", 1), obs(33078983023, "failure", 20)];
    expect(detectStaleWindow(freshPage, IN_WINDOW)).toBeNull();
  });

  test("an EMPTY window is stale too — the case that renders identically to a healthy one", () => {
    expect(detectStaleWindow([], IN_WINDOW)).toMatch(/the window was empty/);
  });

  test("outside Actions the guard never fires — it reports what it sees, never guesses", () => {
    expect(detectStaleWindow([], null)).toBeNull();
    expect(selfWitnessFromEnv({})).toBeNull();
    expect(selfWitnessFromEnv({ GITHUB_RUN_ID: "" })).toBeNull();
  });

  test("the guard is SCOPED — drift-sweep's schedule run is legitimately absent", () => {
    // Same reporter, different host: `drift-sweep` calls it with `--report-only` from a
    // `schedule` run of another workflow. Its run id is not in a `push`-filtered listing
    // and never should be, so firing there would be a check that always fires.
    const sweep = { ...IN_WINDOW, eventName: "schedule", workflowRef: "o/r/.github/workflows/drift-sweep.yml@refs/heads/main" };
    expect(detectStaleWindow([], sweep)).toBeNull();
    expect(selfIsInsideWindow(sweep)).toBe(false);
  });

  test("each scope condition is load-bearing on its own", () => {
    expect(selfIsInsideWindow(IN_WINDOW)).toBe(true);
    expect(selfIsInsideWindow({ ...IN_WINDOW, eventName: "pull_request" })).toBe(false);
    expect(selfIsInsideWindow({ ...IN_WINDOW, refName: "shadow/x" })).toBe(false);
    expect(selfIsInsideWindow({ ...IN_WINDOW, workflowRef: "o/r/.github/workflows/other.yml@refs/heads/main" })).toBe(false);
  });

  test("a non-numeric run id is unknown, not stale — an unparseable fact proves nothing", () => {
    expect(detectStaleWindow([], { ...IN_WINDOW, runId: "not-a-number" })).toBeNull();
  });
});

/**
 * THE WIRING, not the guard.
 *
 * Every test above proves `detectStaleWindow` decides correctly. None of them proved
 * `main()` ASKS it — unhooking the call left all sixty green, which is the same vacuity
 * one level up that the guard itself exists to catch. This drives the real entry point in
 * a subprocess with a fixture window and a forged Actions environment, so the stale page
 * has to travel the whole path and come out as `unmeasured` rather than `drought`.
 */
describe("main() is WIRED to the guard", () => {
  const SCRIPT = new URL("./verdict-drought.ts", import.meta.url).pathname;

  /** The 2026-08-27 page: two ~25-day-old runs, caller absent. */
  const STALE_FIXTURE = JSON.stringify([
    { id: 30763213560, sha: "a48ffa5cdeadbeef", conclusion: "success", startedAt: "2026-08-02T19:10:07Z", endedAt: "2026-08-02T19:23:30Z" },
  ]);

  async function run(env: Record<string, string>): Promise<{ code: number; out: string }> {
    const fixture = `${process.env["TMPDIR"] ?? "/tmp"}/vd-wire-${env["GITHUB_RUN_ID"] ?? "x"}.json`;
    await Bun.write(fixture, STALE_FIXTURE);
    const proc = Bun.spawn(["bun", SCRIPT, "--observations", fixture, "--now", "2026-08-27T14:26:24Z"], {
      env: { ...process.env, ...env },
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    return { code, out };
  }

  test("inside a gate push run on main, a stale window exits `unmeasured` and never says DROUGHT", async () => {
    const { code, out } = await run({
      GITHUB_RUN_ID: "33080913662",
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF_NAME: "main",
      GITHUB_WORKFLOW_REF: "o/r/.github/workflows/gate.yml@refs/heads/main",
    });
    expect(out).toMatch(/STALE LISTING, NOT A DROUGHT/);
    expect(out).toMatch(/NOT MEASURED/);
    expect(out).not.toMatch(/DROUGHT -- main's last completed verdict is stale/);
    expect(code).toBe(1);
  });

  test("outside that scope the SAME fixture still folds — the guard did not swallow the lane", async () => {
    const { out } = await run({
      GITHUB_RUN_ID: "999",
      GITHUB_EVENT_NAME: "schedule",
      GITHUB_REF_NAME: "main",
      GITHUB_WORKFLOW_REF: "o/r/.github/workflows/drift-sweep.yml@refs/heads/main",
    });
    expect(out).not.toMatch(/STALE LISTING/);
    expect(out).toMatch(/drought/);
  });
});
