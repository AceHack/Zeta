import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchJobs, gateYmlJobNames } from "./gate-scope-summary.ts";
import {
  GATE_YML_PATH,
  ROLLUP_JOB_ID,
  declaredNameMatchesJob,
  gateYmlJobNeeds,
  isNonBlockingJob,
  loadBlockingFloor,
  parseBlockingFloor,
  workflowName,
  type BlockingFloor,
} from "./gate-blocking-floor.ts";

const GATE_YML = readFileSync(GATE_YML_PATH, "utf8");
const floor = parseBlockingFloor(GATE_YML)!;

describe("the subject is real — the file this whole module reads exists and is a workflow", () => {
  // A scan floor. Every assertion below is about `gate.yml`; if the path moved, they would all
  // pass vacuously against an empty string, so the path is checked first and loudly.
  test("gate.yml is present, non-trivial, and names itself `gate`", () => {
    expect(GATE_YML.length).toBeGreaterThan(50_000);
    expect(workflowName(GATE_YML)).toBe("gate");
  });

  test("THE ONE HAND-WRITTEN STRING: gate.yml still declares a `gate-required` job", () => {
    // `ROLLUP_JOB_ID` is the only name this module cannot derive — the floor is defined as
    // "what the roll-up needs", and something has to say which job the roll-up is. Renaming
    // the job id in gate.yml without updating it here would make `parseBlockingFloor` return
    // null forever, i.e. silently disable the demotion. This is the check that fails first.
    const names = gateYmlJobNames(GATE_YML);
    expect(names.has(ROLLUP_JOB_ID)).toBe(true);
    expect(names.get(ROLLUP_JOB_ID)).toBe("gate (required)");
    // And it must be the same string `toolchain-install-stall.ts` keys its roll-up rule on.
    expect(floor.rollupJobName).toBe("gate (required)");
  });

  test("loadBlockingFloor finds it at the default path", () => {
    const loaded = loadBlockingFloor();
    expect(loaded.status).toBe("ok");
    expect(loaded.floor?.workflow).toBe("gate");
  });
});

describe("the derived floor is the floor gate.yml actually declares", () => {
  test("every job in `gate-required.needs:` is blocking", () => {
    // Read off gate.yml's own `needs:` list. If the floor is amended (a treaty amendment,
    // per gate.yml's own consent-path comment) this test is where the amendment is recorded.
    for (const declared of [
      "build-and-test (${{ matrix.os }})",
      "lint (semgrep)",
      "lint (TS)",
      // 2026-08-26: `cross-verify` split into 31 named matrix legs. The JOB ID is unchanged
      // — `gate-required.needs:` still names `cross-verify` — so this is a rename of the
      // floor's declared name, not a treaty amendment: the same 31 audits block, via the
      // matrix result GitHub collapses to `success` only when every leg succeeded.
      // `cross-verify-roster.test.ts` §"the floor is not weakened" is the falsifier.
      "cross-verify (${{ matrix.audit }})",
      "full-verify (7-lang oracle + cost + proofs)",
      "test (TS hermetic)",
      "gate (required)",
    ]) {
      expect(floor.blocking).toContain(declared);
    }
  });

  test("a floor job's own prerequisites block too", () => {
    // HONEST NOTE, 2026-08-26: these two used to be the transitivity witness — they were
    // reached only via `build-and-test`. They are now DIRECT entries in
    // `gate-required.needs:` (the skipped-floor-job fix: the roll-up cannot tell "the path
    // filter said docs-only" from "the path filter is dead" unless it can see the path
    // filter's own result). So this assertion no longer exercises transitivity against the
    // real gate.yml, and saying so matters more than keeping the old sentence: an
    // assertion that passes for a different reason than its name claims is the vacuity
    // class. The synthetic-workflow block at the bottom of this file is what pins
    // transitivity now, and it does so on purpose rather than by accident of the floor's
    // current shape. What this test still checks — and what would go red if either job
    // left the floor — is that both are inside it.
    expect(floor.blocking).toContain("matrix setup");
    expect(floor.blocking).toContain("path filter");
  });

  test("`drift (loud)` is NOT in the floor — this is the whole defect", () => {
    // gate.yml, at the `Report drift, loudly` step: "It blocks nothing. `gate (required)` is
    // the sole required status check ... its `needs:` list above does not contain this job."
    // If someone moves it INTO the floor, this test goes red and the demotion stops applying
    // to it — which is correct, and is why the set is derived rather than written down.
    expect(floor.blocking).not.toContain("drift (loud)");
    expect(floor.declared).toContain("drift (loud)");
  });
});

describe("isNonBlockingJob — the predicate, on real job names from real runs", () => {
  const cases: Array<[string, boolean, string]> = [
    ["drift (loud)", true, "declared, outside the floor — the stranding case"],
    ["lint (semgrep drift)", true, "the non-blocking twin of a floor job"],
    ["drift-canary", true, "declared with no `name:`, so its id is its displayed name"],
    ["lint (TS)", false, "in the floor"],
    ["test (TS hermetic)", false, "in the floor"],
    ["build-and-test (ubuntu-24.04)", false, "a matrix leg of a floor job (prefix match)"],
    ["build-and-test (windows-2025)", false, "continue-on-error, but still inside the floor — conservative"],
    ["matrix setup", false, "transitively in the floor"],
    ["gate (required)", false, "the roll-up itself"],
    ["lint (semgrep) extra", false, "not an exact match for a non-matrix declared name"],
    ["Analyze (csharp)", false, "a real job name, from a DIFFERENT workflow — unknown here"],
    ["a job nobody declared", false, "unknown names never demote"],
  ];
  for (const [name, expected, why] of cases) {
    test(`${expected ? "non-blocking" : "blocking/unknown"}: ${name} (${why})`, () => {
      expect(isNonBlockingJob(name, floor)).toBe(expected);
    });
  }

  test("no floor at all means nothing is provably non-blocking", () => {
    expect(isNonBlockingJob("drift (loud)", undefined)).toBe(false);
  });
});

describe("declaredNameMatchesJob agrees with gate-scope-summary's matcher", () => {
  // Two matchers over the same relation is a divergence waiting to happen, so it is pinned:
  // for every declared name in gate.yml and every job name in the fixture, the two agree.
  const fixture = JSON.parse(
    readFileSync(join(import.meta.dir, "fixtures", "toolchain-install-stall-2026-08-25.json"), "utf8"),
  ) as { cases: Array<{ jobs: Array<{ name: string }> }> };
  const jobNames = [...new Set(fixture.cases.flatMap((c) => c.jobs.map((j) => j.name)))];

  test(`parity over ${jobNames.length} real job names x every declared gate job`, () => {
    expect(jobNames.length).toBeGreaterThan(3);
    for (const declared of floor.declared) {
      for (const jobName of jobNames) {
        const mine = declaredNameMatchesJob(declared, jobName);
        const theirs = matchJobs(declared, [{ name: jobName, conclusion: "failure" }]).length === 1;
        expect([declared, jobName, mine]).toEqual([declared, jobName, theirs]);
      }
    }
  });
});

describe("the `needs:` scanner reads all three spellings GitHub accepts", () => {
  const yaml = [
    "name: w",
    "jobs:",
    "  a:",
    "    name: A",
    "  b:",
    "    name: B",
    "    needs: a",
    "  c:",
    "    name: C",
    "    needs: [a, b]",
    "  d:",
    "    name: D",
    "    needs:",
    "      - b",
    "      - c",
    "    runs-on: ubuntu-24.04",
    "  e:",
    "    name: E",
    "    steps:",
    "      - uses: ./x",
    "        with:",
    "          needs: a",
    "",
  ].join("\n");

  test("scalar, flow sequence and block sequence all parse", () => {
    const needs = gateYmlJobNeeds(yaml);
    expect(needs.get("b")).toEqual(["a"]);
    expect(needs.get("c")).toEqual(["a", "b"]);
    expect(needs.get("d")).toEqual(["b", "c"]);
  });

  test("a `needs:` nested inside a step is NOT read as the job's", () => {
    // The indent check is what makes this true; without it job `e` would inherit `a`.
    expect(gateYmlJobNeeds(yaml).get("e")).toBeUndefined();
  });

  test("a block sequence ends at the next key, not at the next job", () => {
    expect(gateYmlJobNeeds(yaml).get("d")).not.toContain("ubuntu-24.04");
  });
});

describe("FAIL CLOSED — every unparseable shape yields no floor, never an empty one", () => {
  const cannotDerive: Array<[string, string]> = [
    ["no top-level name", "jobs:\n  gate-required:\n    needs:\n      - a\n"],
    ["no roll-up job", "name: gate\njobs:\n  a:\n    name: A\n"],
    ["roll-up with no needs", "name: gate\njobs:\n  gate-required:\n    name: gate (required)\n"],
    ["roll-up with an EMPTY needs list", "name: gate\njobs:\n  gate-required:\n    needs:\n  a:\n    name: A\n"],
    ["not a workflow at all", "{}\n"],
    ["empty file", ""],
  ];
  for (const [why, text] of cannotDerive) {
    test(`${why} -> null (so the caller keeps refusing)`, () => {
      expect(parseBlockingFloor(text)).toBeNull();
    });
  }

  test("an empty floor would be catastrophic, so it is unrepresentable", () => {
    // The failure this guards is specific: a roll-up parsed with zero needs would say
    // "nothing blocks", demoting EVERY red in the workflow. `null` is the only other answer.
    const derived = parseBlockingFloor("name: gate\njobs:\n  gate-required:\n    needs: []\n");
    expect(derived).toBeNull();
  });

  test("an unreadable path reports `unreadable` and hands back no floor", () => {
    const loaded = loadBlockingFloor(join(import.meta.dir, "no-such-workflow-file.yml"));
    expect(loaded.status).toBe("unreadable");
    expect(loaded.floor).toBeUndefined();
  });

  test("a readable but unparseable file reports `unparseable` and hands back no floor", () => {
    const loaded = loadBlockingFloor(join(import.meta.dir, "gate-blocking-floor.ts"));
    expect(loaded.status).toBe("unparseable");
    expect(loaded.floor).toBeUndefined();
  });
});

describe("a floor derived from a synthetic workflow behaves the same way", () => {
  // The real gate.yml is 5000+ lines; this is the same shape at a size a reader can hold.
  const yaml = [
    "name: demo",
    "jobs:",
    "  setup:",
    "    name: setup",
    "  build:",
    "    name: build (${{ matrix.os }})",
    "    needs: setup",
    "  drift:",
    "    name: drift (loud)",
    "    needs: [gate-required]",
    "  gate-required:",
    "    name: gate (required)",
    "    needs:",
    "      - build",
    "",
  ].join("\n");
  const demo = parseBlockingFloor(yaml) as BlockingFloor;

  test("the roll-up's own dependents are NOT dragged into the floor", () => {
    // `drift` needs `gate-required`, which is the opposite edge direction. Following it would
    // make every reporter blocking and re-break the case this change fixes.
    expect(demo.blocking).toEqual(["build (${{ matrix.os }})", "gate (required)", "setup"]);
    expect(isNonBlockingJob("drift (loud)", demo)).toBe(true);
    expect(isNonBlockingJob("build (macos-26)", demo)).toBe(false);
    expect(isNonBlockingJob("setup", demo)).toBe(false);
  });
});
