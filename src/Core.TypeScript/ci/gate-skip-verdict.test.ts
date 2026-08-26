import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GATE_YML_PATH,
  ROLLUP_JOB_ID,
  gateYmlJobIds,
  gateYmlJobIfs,
  gateYmlJobNeeds,
} from "./gate-blocking-floor.ts";
import {
  classifyFloorResult,
  decideGate,
  parseDecls,
  parseNeedsJson,
  renderVerdict,
  type WorkflowDecls,
} from "./gate-skip-verdict.ts";

const GATE_YML = readFileSync(GATE_YML_PATH, "utf8");
const decls = parseDecls(GATE_YML);

/** `needs` context shorthand: `{ "path-filter": "success", ... }`. */
const ctx = (o: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(o));

/** The floor as gate.yml declares it, so no test here restates the list by hand. */
const FLOOR = gateYmlJobNeeds(GATE_YML).get(ROLLUP_JOB_ID)!;

// ═══════════════════════════════════════════════════════════════════════════════════
// The subject is real. Every assertion below is about gate.yml; if the path moved or
// the parse silently returned nothing, they would all pass vacuously.
// ═══════════════════════════════════════════════════════════════════════════════════

describe("the parse is against the real gate.yml, and it is not empty", () => {
  test("gate.yml declares the roll-up and a floor of more than a couple of jobs", () => {
    expect(GATE_YML.length).toBeGreaterThan(50_000);
    expect(decls.jobIds.has(ROLLUP_JOB_ID)).toBe(true);
    expect(FLOOR.length).toBeGreaterThan(5);
  });

  test("`gateYmlJobIds` sees the job that declares no `name:` — an absence is not a non-existence", () => {
    // `drift-canary` has no `name:`, so `gateYmlJobNames` cannot see it. If this module
    // asked that function "is `X` a declared job", every nameless job would answer no,
    // and a skip of one would be refused for the wrong reason.
    expect(gateYmlJobIds(GATE_YML)).toContain("drift-canary");
    expect(decls.jobIds.has("drift-canary")).toBe(true);
  });

  test("the `if:` scanner reads JOB-level `if:` only, not the many step-level ones", () => {
    const ifs = gateYmlJobIfs(GATE_YML);
    // Job-level, real, and load-bearing for this whole file:
    expect(ifs.get("full-verify")).toBe("needs.path-filter.outputs.code == 'true'");
    expect(ifs.get(ROLLUP_JOB_ID)).toBe("always()");
    // Not job-level: `build-and-test` and `path-filter` have step-level `if:` in
    // abundance and no job-level one. Reading a step's would hand them a licence to
    // skip that gate.yml never gave them, which is the permissive direction.
    expect(ifs.has("build-and-test")).toBe(false);
    expect(ifs.has("path-filter")).toBe(false);
    expect(GATE_YML).toContain("        if: github.event_name != 'pull_request'");
  });

  test("THE CLOSURE PROPERTY: every prerequisite of a floor job is itself in the floor", () => {
    // This is what makes the one-level upstream check sufficient. If someone adds a job
    // to the floor whose own `needs:` names something the roll-up cannot see, the runtime
    // rule fails closed with a message saying so — but only on the runs where that job
    // skips. This test fails on every run instead, which is where it belongs.
    const floorSet = new Set(FLOOR);
    for (const need of FLOOR) {
      for (const up of gateYmlJobNeeds(GATE_YML).get(need) ?? []) {
        expect({ need, up, visible: floorSet.has(up) }).toEqual({ need, up, visible: true });
      }
    }
  });

  test("`matrix-setup` and `path-filter` are in the roll-up's needs — the change this file guards", () => {
    expect(FLOOR).toContain("matrix-setup");
    expect(FLOOR).toContain("path-filter");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// THE OVER-REACH GUARD. A docs-only PR must stay green. This is the required half:
// a fix that closes the hole by failing every legitimate skip is worse than the hole.
// ═══════════════════════════════════════════════════════════════════════════════════

describe("a docs-only PR stays GREEN", () => {
  // The shape a real docs-only PR produces, verified against gate.yml's declarations:
  // `path-filter` succeeds and emits code=false; `full-verify` alone carries
  // `if: needs.path-filter.outputs.code == 'true'` so it alone skips. `build-and-test`
  // has NO job-level `if:` — it runs and skips its heavy STEPS internally, which is why
  // its rollup result is `success` and not `skipped`.
  const docsOnly = ctx({
    "matrix-setup": "success",
    "path-filter": "success",
    "build-and-test": "success",
    lint: "success",
    "lint-typescript": "success",
    "cross-verify": "success",
    "full-verify": "skipped",
    "test-typescript-hermetic": "success",
  });

  test("the gate passes", () => {
    const gate = decideGate(docsOnly, decls);
    expect(gate.blocked).toEqual([]);
    expect(gate.passed).toBe(true);
  });

  test("and `full-verify`'s skip is reported as LEGITIMATE, naming the condition", () => {
    const v = classifyFloorResult("full-verify", docsOnly, decls);
    expect(v.kind).toBe("legitimate-skip");
    expect(v.reason).toContain("needs.path-filter.outputs.code == 'true'");
    expect(v.reason).toContain("path-filter all succeeded");
  });

  test("the docs-only context covers the whole floor — no floor job is unaccounted for", () => {
    // Without this, the green above could be green because the fixture omitted the job
    // that would have failed. Every entry gate.yml declares is present.
    expect([...docsOnly.keys()].sort()).toEqual([...FLOOR].sort());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// THE DEFECT ITSELF. Same run shape, upstream dead. Was green; must now be red.
// ═══════════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════════
// THE DEFECT, MEASURED. Not a constructed hypothetical. A scan of the last 400
// completed `gate` runs found 23 with a non-success `path filter`; 21 reddened the
// gate anyway (the same cancellation caught another floor job, and `cancelled` was
// already blocking) and TWO were absorbed in silence. Both are below, from their own
// Actions-API job lists, and both are from 2026-08-25.
//
// The trigger in both is `cancelled`, not `failure` — which makes the class more
// reachable than the reasoning behind this change first assumed: `cancel-in-progress`
// fires on every PR push, so no job defect is needed at all.
// ═══════════════════════════════════════════════════════════════════════════════════

const ABSORBED_RUNS: ReadonlyArray<readonly [string, string, string]> = [
  ["32881149945", "gate-run-32881149945-absorbed-skip.json", "claude/tender-hawking-xmcs6m"],
  ["32861098038", "gate-run-32861098038-absorbed-skip-dependabot.json", "a dependabot dependency bump"],
];

describe.each(ABSORBED_RUNS)("REGRESSION — gate run %s (%s), where this actually happened", (runId, file, what) => {
  const RUN_JOBS = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", file), "utf8")) as Array<{
    name: string;
    conclusion: string;
  }>;
  const conclusionOf = (name: string): string | undefined => RUN_JOBS.find((j) => j.name === name)?.conclusion;

  test(`the fixture is the real thing (${what}): path filter CANCELLED, two floor jobs SKIPPED, gate GREEN`, () => {
    // If any of these four drift, the regression below is testing a run that never
    // happened, and the whole block becomes decoration.
    expect(RUN_JOBS.length).toBeGreaterThan(20);
    expect(conclusionOf("path filter")).toBe("cancelled");
    expect(conclusionOf("build-and-test (${{ matrix.os }})")).toBe("skipped");
    expect(conclusionOf("full-verify (7-lang oracle + cost + proofs)")).toBe("skipped");
    expect(conclusionOf("gate (required)")).toBe("success");
  });

  test(`the new verdict turns run ${runId} RED`, () => {
    // The `needs` context the roll-up would have seen, reconstructed from the API
    // conclusions above (they agree for every state that matters here). The four floor
    // jobs that are not derived from the fixture all concluded `success` in both runs.
    const asItHappened = ctx({
      "matrix-setup": conclusionOf("matrix setup") ?? "success",
      "path-filter": "cancelled",
      "build-and-test": "skipped",
      lint: "success",
      "lint-typescript": "success",
      "cross-verify": "success",
      "full-verify": "skipped",
      "test-typescript-hermetic": "success",
    });
    const gate = decideGate(asItHappened, decls);
    expect(gate.passed).toBe(false);
    expect(gate.blocked.map((v) => v.need).sort()).toEqual(["build-and-test", "full-verify", "path-filter"]);
  });

  test(`what run ${runId}'s green covered: no .NET build or test leg, and no 7-language byte-lock`, () => {
    // Named rather than implied, because this is the cost the old rule was paying.
    const skipped = RUN_JOBS.filter((j) => j.conclusion === "skipped").map((j) => j.name);
    expect(skipped).toContain("build-and-test (${{ matrix.os }})");
    expect(skipped).toContain("full-verify (7-lang oracle + cost + proofs)");
  });
});

test("the dependabot instance also carried a RED lint beside its green gate", () => {
  // The sharper half of the second case: it is not only that the build never ran — a
  // floor-adjacent lint was outright failing while the required check reported success.
  const jobs = JSON.parse(
    readFileSync(join(import.meta.dir, "fixtures", "gate-run-32861098038-absorbed-skip-dependabot.json"), "utf8"),
  ) as Array<{ name: string; conclusion: string }>;
  expect(jobs.find((j) => j.name === "lint (Python)")?.conclusion).toBe("failure");
  expect(jobs.find((j) => j.name === "gate (required)")?.conclusion).toBe("success");
});

describe("a dead prerequisite turns the gate RED where it used to be green", () => {
  const pathFilterDead = ctx({
    "matrix-setup": "success",
    "path-filter": "failure",
    "build-and-test": "skipped", // GitHub skips a job whose `needs:` did not succeed
    lint: "success",
    "lint-typescript": "success",
    "cross-verify": "success",
    "full-verify": "skipped",
    "test-typescript-hermetic": "success",
  });

  test("THE OLD LOGIC PASSED THIS. Reproduced exactly, so the delta is not asserted from memory.", () => {
    // The verdict step this replaced, verbatim in its own terms: fail iff some result is
    // `failure` or `cancelled` — over `needs.*.result`, which in the OLD workflow did not
    // include `path-filter` at all. That is the run that shipped a green gate.
    const oldFloor = [...pathFilterDead].filter(([k]) => k !== "path-filter" && k !== "matrix-setup");
    const oldVerdictPassed = !oldFloor.some(([, r]) => r === "failure" || r === "cancelled");
    expect(oldVerdictPassed).toBe(true);
  });

  test("the new logic blocks", () => {
    const gate = decideGate(pathFilterDead, decls);
    expect(gate.passed).toBe(false);
  });

  test("and it blocks for all three separate reasons, each named", () => {
    const gate = decideGate(pathFilterDead, decls);
    const byNeed = new Map(gate.blocked.map((v) => [v.need, v.reason]));
    expect([...byNeed.keys()].sort()).toEqual(["build-and-test", "full-verify", "path-filter"]);
    expect(byNeed.get("path-filter")).toContain("failed");
    // `build-and-test` declares no `if:` at all, so its skip has only one explanation.
    expect(byNeed.get("build-and-test")).toContain("declares no job-level `if:`");
    // `full-verify` DOES declare one — it is refused on the upstream, and says which.
    expect(byNeed.get("full-verify")).toContain("`path-filter` reported `failure`");
  });

  test("a CANCELLED prerequisite is refused the same way as a failed one", () => {
    const cancelled = ctx({ ...Object.fromEntries(pathFilterDead), "path-filter": "cancelled" });
    const v = classifyFloorResult("full-verify", cancelled, decls);
    expect(v.kind).toBe("block");
    expect(v.reason).toContain("`cancelled`");
  });

  test("a SKIPPED prerequisite is refused too — the chain does not launder itself", () => {
    const skippedUp = ctx({ ...Object.fromEntries(pathFilterDead), "path-filter": "skipped" });
    const v = classifyFloorResult("full-verify", skippedUp, decls);
    expect(v.kind).toBe("block");
  });

  test("`matrix-setup` dying takes `build-and-test` down with it", () => {
    const matrixDead = ctx({
      "matrix-setup": "failure",
      "path-filter": "success",
      "build-and-test": "skipped",
      lint: "success",
      "lint-typescript": "success",
      "cross-verify": "success",
      "full-verify": "success",
      "test-typescript-hermetic": "success",
    });
    const gate = decideGate(matrixDead, decls);
    expect(gate.passed).toBe(false);
    expect(gate.blocked.map((v) => v.need).sort()).toEqual(["build-and-test", "matrix-setup"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// FAIL CLOSED. Every state that cannot be classified must block, and the tests must
// say so rather than leaving the direction to be inferred.
// ═══════════════════════════════════════════════════════════════════════════════════

describe("unclassifiable states block", () => {
  test("no gate.yml at all: failures still fail, and NO skip is legitimate", () => {
    expect(classifyFloorResult("lint", ctx({ lint: "failure" }), null).kind).toBe("block");
    expect(classifyFloorResult("lint", ctx({ lint: "success" }), null).kind).toBe("pass");
    const v = classifyFloorResult("full-verify", ctx({ "full-verify": "skipped" }), null);
    expect(v.kind).toBe("block");
    expect(v.reason).toContain("gate.yml could not be read or parsed");
  });

  test("an empty `needs` context blocks — a roll-up that judged nothing must not report a pass", () => {
    const gate = decideGate(new Map(), decls);
    expect(gate.passed).toBe(false);
    expect(gate.blocked[0]?.reason).toContain("judged nothing");
  });

  test("a result GitHub does not document blocks", () => {
    for (const bogus of ["", "neutral", "SUCCESS", "action_required"]) {
      expect(classifyFloorResult("lint", ctx({ lint: bogus }), decls).kind).toBe("block");
    }
  });

  test("a floor entry gate.yml does not declare blocks when skipped", () => {
    const v = classifyFloorResult("a-job-nobody-declared", ctx({ "a-job-nobody-declared": "skipped" }), decls);
    expect(v.kind).toBe("block");
    expect(v.reason).toContain("declares no job");
  });

  test("a skip whose prerequisite the roll-up cannot see blocks, and says how to fix it", () => {
    const partial = ctx({ "full-verify": "skipped" }); // `path-filter` absent from the context
    const v = classifyFloorResult("full-verify", partial, decls);
    expect(v.kind).toBe("block");
    expect(v.reason).toContain("not visible to the roll-up");
    expect(v.reason).toContain(ROLLUP_JOB_ID);
  });

  test("parseNeedsJson refuses everything that is not the object GitHub produces", () => {
    expect(parseNeedsJson("")).toBeNull();
    expect(parseNeedsJson("not json")).toBeNull();
    expect(parseNeedsJson("[]")).toBeNull();
    expect(parseNeedsJson("null")).toBeNull();
    // And a well-formed one round-trips, including the degenerate `result`-less entry.
    const ok = parseNeedsJson('{"lint":{"result":"success"},"x":{}}')!;
    expect(ok.get("lint")).toBe("success");
    expect(ok.get("x")).toBe("<missing>");
    expect(classifyFloorResult("x", ok, decls).kind).toBe("block");
  });

  test("a null parse feeds an empty map, and an empty map blocks — end to end", () => {
    expect(decideGate(parseNeedsJson("garbage") ?? new Map(), decls).passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════
// MUTATION. Each mutant is a plausible weakening of the rule; each must be killed, and
// the test that kills it is named. A rule no mutant can break is not a rule.
// ═══════════════════════════════════════════════════════════════════════════════════

describe("MUTANTS — each one is killed, and by which assertion", () => {
  const docsOnly = ctx({
    "matrix-setup": "success",
    "path-filter": "success",
    "build-and-test": "success",
    lint: "success",
    "lint-typescript": "success",
    "cross-verify": "success",
    "full-verify": "skipped",
    "test-typescript-hermetic": "success",
  });
  const dead = ctx({ ...Object.fromEntries(docsOnly), "path-filter": "failure", "build-and-test": "skipped" });

  test("MUTANT 1 — `skipped` is success again (the pre-change rule). Killed by the dead-prerequisite case.", () => {
    const mutant = (results: ReadonlyMap<string, string>): boolean =>
      ![...results.values()].some((r) => r === "failure" || r === "cancelled");
    // Survives the over-reach guard...
    expect(mutant(docsOnly)).toBe(true);
    // ...and dies on the defect, but ONLY because `path-filter` is now in the context.
    expect(mutant(dead)).toBe(false);
    // The sharper form: strip the two new entries and the mutant is indistinguishable
    // from the real rule on the old floor. That is precisely why they were added.
    const oldFloorOnly = new Map([...dead].filter(([k]) => k !== "path-filter" && k !== "matrix-setup"));
    expect(mutant(oldFloorOnly)).toBe(true);
    expect(decideGate(oldFloorOnly, decls).passed).toBe(false);
  });

  test("MUTANT 2 — `skipped` always fails. Killed by the docs-only case.", () => {
    const mutant = (results: ReadonlyMap<string, string>): boolean =>
      ![...results.values()].some((r) => r !== "success");
    expect(mutant(dead)).toBe(false); // right answer, wrong reason
    expect(mutant(docsOnly)).toBe(false); // WRONG: a docs-only PR is blocked
    expect(decideGate(docsOnly, decls).passed).toBe(true);
  });

  test("MUTANT 3 — drop the `if:` requirement, check only prerequisites. Killed by `build-and-test`.", () => {
    // A job with no `if:` and no `needs:` would then be freely skippable. `lint` is
    // exactly that job, and gate.yml gives it no licence to skip at all.
    const mutantDecls: WorkflowDecls = { ...decls, ifOf: new Map([...decls.ifOf, ["lint", "always()"]]) };
    const lintSkipped = ctx({ ...Object.fromEntries(docsOnly), lint: "skipped" });
    expect(classifyFloorResult("lint", lintSkipped, mutantDecls).kind).toBe("legitimate-skip");
    expect(classifyFloorResult("lint", lintSkipped, decls).kind).toBe("block");
  });

  test("MUTANT 4 — drop the prerequisite check, keep only `if:`. Killed by full-verify + dead path-filter.", () => {
    const mutant = (need: string, results: ReadonlyMap<string, string>): boolean =>
      results.get(need) !== "skipped" || decls.ifOf.has(need);
    expect(mutant("full-verify", docsOnly)).toBe(true); // agrees on the legitimate case
    expect(mutant("full-verify", dead)).toBe(true); // WRONG: upstream is dead
    expect(classifyFloorResult("full-verify", dead, decls).kind).toBe("block");
  });

  test("MUTANT 5 — read STEP-level `if:` as the job's. Killed by build-and-test's skip staying refused.", () => {
    // `build-and-test` is full of step-level `if:` (the docs-only step guards); a scanner
    // that accepted any indent would hand the JOB a licence to skip it never declared.
    expect(gateYmlJobIfs(GATE_YML).has("build-and-test")).toBe(false);
    // Isolated deliberately from the prerequisite rule: both prerequisites are green here,
    // so the ONLY thing that can refuse this skip is the missing job-level `if:`. GitHub
    // cannot actually produce this state, which is exactly the point — with no `if:` and
    // green prerequisites there is no legal way to skip, so a skip is evidence of something
    // the roll-up does not understand, and it must not be waved through.
    const isolated = ctx({ ...Object.fromEntries(docsOnly), "build-and-test": "skipped" });
    const loose = new Map<string, string>([...decls.ifOf, ["build-and-test", "some step condition"]]);
    expect(classifyFloorResult("build-and-test", isolated, { ...decls, ifOf: loose }).kind).toBe("legitimate-skip");
    expect(classifyFloorResult("build-and-test", isolated, decls).kind).toBe("block");
    expect(decideGate(isolated, decls).passed).toBe(false);
  });

  test("MUTANT 6 — an unparseable gate.yml is treated as 'no constraints, allow'. Killed by the null case.", () => {
    // The permissive direction for a parse failure: no declarations, so nothing to
    // violate, so pass. That is the failure mode this whole change exists to remove.
    const emptyDecls: WorkflowDecls = { jobIds: new Set(), needsOf: new Map(), ifOf: new Map() };
    const mutant = classifyFloorResult("full-verify", dead, emptyDecls);
    expect(mutant.kind).toBe("block"); // even with empty decls the real rule refuses
    expect(classifyFloorResult("full-verify", dead, null).kind).toBe("block");
  });

  test("MUTANT 7 — an empty needs context passes vacuously. Killed by the empty-context case.", () => {
    const mutant = (results: ReadonlyMap<string, string>): boolean =>
      [...results.values()].every((r) => r === "success");
    expect(mutant(new Map())).toBe(true); // vacuous truth: nothing failed, so it passed
    expect(decideGate(new Map(), decls).passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════

describe("the rendered verdict names every row, not only the failing ones", () => {
  test("a passing docs-only render says WHY the skip was allowed", () => {
    const text = renderVerdict(
      decideGate(ctx({ "path-filter": "success", "full-verify": "skipped", lint: "success" }), decls),
    );
    expect(text).toContain("[ok  ] lint: success");
    expect(text).toContain("[skip] full-verify: skipped");
    expect(text).toContain("needs.path-filter.outputs.code == 'true'");
  });

  test("a blocking render marks the failing row FAIL", () => {
    const text = renderVerdict(decideGate(ctx({ "path-filter": "failure" }), decls));
    expect(text).toContain("[FAIL] path-filter: failure");
  });
});
