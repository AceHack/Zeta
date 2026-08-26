// apt-archive-cache.test.ts — falsifiers for the archive-cache adoption audit.
//
// The audit exists because the mechanism it guards is INVISIBLE when it fails: a job
// with no cache step is green until the mirror is slow, and a job whose cache tier
// disagrees with its install tier gets a cache HIT on a payload that is missing two
// thirds of what it needs. So each test here is written to fail if a specific mutation
// of the audit would make it stop noticing — a check that cannot fail is not a check.
//
// The last block runs the audit against the REAL tree, which is the only assertion that
// can catch the audit going vacuous on the actual workflows (a scope regex that matches
// nothing reports "OK — 0 jobs" and looks identical to success).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { auditWorkflow, inScope, judgeJob, parseJobs, runAudit, renderHuman, ACTION_USES, ACTION_PATH } from "./apt-archive-cache.ts";

const CACHE_STEP = (tier: string) =>
  [
    "      - name: Restore apt archives",
    `        uses: ${ACTION_USES}`,
    "        with:",
    `          tier: ${tier}`,
  ].join("\n");

const wf = (opts: { runsOn?: string; tier?: string | null; cache?: string | null; cacheAfter?: boolean }) => {
  const runsOn = opts.runsOn ?? "ubuntu-24.04";
  const tierEnv = opts.tier === null ? [] : ["        env:", `          ZETA_HOST_TIER: ${opts.tier ?? "slim"}`];
  const install = ["      - name: Install toolchain", ...tierEnv, "        run: ./tools/setup/install.sh"];
  const cache = opts.cache === null ? [] : [opts.cache ?? CACHE_STEP("slim")];
  const steps = opts.cacheAfter ? [...install, ...cache] : [...cache, ...install];
  return ["name: x", "jobs:", "  build:", `    runs-on: ${runsOn}`, "    steps:", ...steps, ""].join("\n");
};

describe("scope", () => {
  test("a job that never runs install.sh is out of scope", () => {
    const src = ["name: x", "jobs:", "  build:", "    runs-on: ubuntu-24.04", "    steps:", "      - run: echo hi", ""].join("\n");
    expect(auditWorkflow("f.yml", src)).toHaveLength(0);
  });

  test("windows and macOS install lanes are out of scope — they have no apt", () => {
    expect(auditWorkflow("f.yml", wf({ runsOn: "windows-2025", cache: null }))).toHaveLength(0);
    expect(auditWorkflow("f.yml", wf({ runsOn: "macos-15", cache: null }))).toHaveLength(0);
  });

  test("a MATRIX runner stays IN scope — `${{ matrix.os }}` may resolve to ubuntu", () => {
    // This is the mutation that would have quietly dropped gate.yml's build-and-test,
    // the single biggest apt consumer in the tree, out of the audit entirely.
    const findings = auditWorkflow("f.yml", wf({ runsOn: "${{ matrix.os }}", cache: null }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.verdict).toBe("absent");
  });

  test("scope is decided by the installer call, not by the presence of the cache step", () => {
    expect(inScope(["    runs-on: ubuntu-24.04", "        run: ./tools/setup/install.sh"])).toBe(true);
    expect(inScope(["    runs-on: ubuntu-24.04", `        uses: ${ACTION_USES}`])).toBe(false);
  });
});

describe("verdicts", () => {
  test("cache step present, tiers agree → ok", () => {
    const findings = auditWorkflow("f.yml", wf({ tier: "slim", cache: CACHE_STEP("slim") }));
    expect(findings.map((f) => f.verdict)).toEqual(["ok"]);
  });

  test("no cache step → absent", () => {
    expect(auditWorkflow("f.yml", wf({ cache: null }))[0]?.verdict).toBe("absent");
  });

  test("tier disagreement → miskeyed, and BOTH tiers are named", () => {
    const f = auditWorkflow("f.yml", wf({ tier: "full", cache: CACHE_STEP("slim") }))[0];
    expect(f?.verdict).toBe("miskeyed");
    expect(f?.declaredTier).toBe("full");
    expect(f?.cachedTier).toBe("slim");
  });

  test("restore AFTER the install it serves → after-install", () => {
    // A restore that runs after the fetch is the vacuity class in its purest form: the
    // step is green, the cache is populated, and it saved nothing at all.
    expect(auditWorkflow("f.yml", wf({ cacheAfter: true }))[0]?.verdict).toBe("after-install");
  });

  test("an undeclared tier does not make a miskey unprovable — it reports ok, never miskeyed", () => {
    // gate.yml build-and-test deliberately leaves the tier to detection because its
    // matrix spans macOS. There is nothing to disagree with, so `ok` is the honest
    // verdict; inventing a comparison against a guessed default would be a check
    // asserting a property it cannot observe.
    const f = auditWorkflow("f.yml", wf({ tier: null, cache: CACHE_STEP("full") }))[0];
    expect(f?.verdict).toBe("ok");
    expect(f?.declaredTier).toBeNull();
  });

  test("a LATER step's tier: cannot vouch for the cache step's key", () => {
    // The naive implementation greps the job for the first `tier:` anywhere. Under that
    // reading, an unrelated `with: tier:` further down would satisfy the check for a
    // cache step that declared nothing.
    const cache = [`        uses: ${ACTION_USES}`, "      - name: something else", "        with:", "          tier: full"].join("\n");
    const f = auditWorkflow("f.yml", wf({ tier: "full", cache }))[0];
    expect(f?.verdict).toBe("miskeyed");
    expect(f?.cachedTier).toBeNull();
  });

  test("the tier is read from the step nearest ABOVE the install call", () => {
    const jobs = parseJobs(wf({ tier: "standard", cache: CACHE_STEP("standard") }));
    expect(judgeJob("f.yml", jobs[0]!).declaredTier).toBe("standard");
  });
});

describe("comments cannot satisfy the audit", () => {
  test("a commented-out cache step is still absent", () => {
    const f = auditWorkflow("f.yml", wf({ cache: `      # uses: ${ACTION_USES}` }))[0];
    expect(f?.verdict).toBe("absent");
  });

  test("an installer call mentioned only in a comment does not put a job in scope", () => {
    const src = ["name: x", "jobs:", "  b:", "    runs-on: ubuntu-24.04", "    steps:", "      # ./tools/setup/install.sh is not run here", "      - run: echo hi", ""].join("\n");
    expect(auditWorkflow("f.yml", src)).toHaveLength(0);
  });
});

describe("the real tree", () => {
  test("the composite action exists and pins actions/cache by commit SHA", () => {
    // Read it and let the read be the existence assertion. An `existsSync` gate in
    // front of a `readFileSync` is check-then-use (CWE-367): the answer is stale
    // before the use runs, so it reads as defensive and prevents nothing — which
    // `lint-check-then-use-file-races.ts` refuses, and refused this very line.
    const src = readFileSync(`${ACTION_PATH}/action.yml`, "utf8");
    // A floating tag here would let the cache implementation change under a key design
    // that assumes v6 semantics (and it is the supply-chain floor besides).
    expect(src).toMatch(/uses: actions\/cache@[0-9a-f]{40} # v\d/);
  });

  test("every Linux job in this repo that runs install.sh restores the archives", () => {
    const r = runAudit();
    expect(r.findings).toEqual([]);
  });

  test("the audit is NOT vacuous on the real tree — it has jobs to judge", () => {
    // Without this, a scope regex that matched nothing would report a clean run.
    const r = runAudit();
    expect(r.jobsInScope).toBeGreaterThan(20);
  });

  test("renderHuman names each offending job, so a red run is actionable", () => {
    const out = renderHuman({
      workflowsScanned: 1,
      jobsInScope: 1,
      findings: [{ file: "a.yml", job: "b", line: 3, verdict: "miskeyed", declaredTier: "full", cachedTier: "slim" }],
    });
    expect(out).toContain("a.yml:3");
    expect(out).toContain("`b`");
    expect(out).toContain("full");
    expect(out).toContain("slim");
  });
});
