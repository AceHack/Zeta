import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  auditText,
  CORPUS_GATHER,
  corpus,
  corpusReadsFromDisk,
  ROUTES,
  runAudit,
  SELF_EXCLUDED,
  type Route,
} from "./audit-scan-floor-routes.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..");

// THE TREE IS READ IN A HOOK, NOT IN A TEST, AND THE HOOK SAYS ITS OWN BUDGET.
//
// Every test below reads the whole tracked source tree. bun's per-test cap is 5,000 ms and
// is never declared anywhere -- `bunfig.toml` documents at length that its `[test] timeout`
// key does nothing -- so 5,000 is a default nobody in this repo chose, sitting under a scan
// whose cost grows with the tree.
//
// WHAT A BREACH LOOKS LIKE, WHICH IS THE REASON THIS HOOK EXISTS. A timed-out test is
// reported by its NAME, and this file's names are claims:
//
//     (fail) route named-min-constant contributes at least one site by itself
//
// That is indistinguishable in a CI summary from this audit's genuine dark-route finding,
// whose stated remedy is "Fix the recognizer, never the floor." On 2026-08-22 it was read as
// exactly what it claims -- two recognizers reported as having gone silent on `main` -- and
// the proposed repair was to retire them. Both were alive: the same hour, CI had all four
// routes passing in 99-222 ms. The instrument was fine; the clock was the finding. Moving
// the read into a hook does not make it faster, it makes a breach SAY SO: the failure now
// names the hook instead of accusing a live recognizer.
//
// MEASURED 2026-08-22, and the cause is the host, not this repo. On the fleet's machine one
// bun process reading the 2,896 tracked sources costs ~17.5 s on its FIRST pass and ~350 ms
// on every pass after -- reproduced identically in a months-old checkout and a minutes-old
// clone, so it is neither tree's property. The cause is Microsoft Defender: `mdatp health`
// reports `real_time_protection_enabled: true`, and an EndpointSecurity client authorises
// each open per (process, file), which is precisely a large first-pass cost and a free
// second. Under load (`wdavdaemon_unprivileged` at ~500% CPU) the same read measured 132 s.
// CI has no such scanner and reads the same tree in ~100 ms per pass.
//
// So the fix is NOT a number big enough to outrun an antivirus -- that is the same move as
// raising a baseline to outrun a regression, and 60,000 was already outrun once while this
// was being written. Two guards, neither of them a tuned constant:
//   1. `corpus()` memoises per root, so the tree is read ONCE per process rather than once
//      per `runAudit` call -- eleven reads in this file become one, on every host including
//      CI. That is the host-independent half, and the test below is its falsifier.
//   2. The one remaining read happens HERE, bounded and visible. The budget is 120,000 ms --
//      INHERITED, not tuned: it is what `lint-no-culture-sensitive-collation.test.ts` already
//      carries for the same whole-tree class. A host slow enough to breach it still breaches
//      it, and should; it will simply be reported as a slow hook rather than a dead route.
//
// Module scope was the other candidate for that read and is worse: it is untimed, so a hang
// there burns the whole job cap instead of failing -- the exact objection `bunfig.toml`
// raises against a global `--timeout` raise.
//
// `beforeAll`'s timeout argument is honoured and its default is the same silent 5,000 ms --
// MEASURED, not assumed: a 6.5 s hook fails at 5000.55 ms bare, fails at 2000.18 ms under
// `beforeAll(fn, 2000)`, and passes under `beforeAll(fn, 20000)`.
beforeAll(() => {
  corpus(REPO);
}, 120_000);

describe("the corpus is read once per process — the memo that keeps the clock out of the verdict", () => {
  test("a second full audit reads no further files from disk", () => {
    runAudit(REPO);
    const readsBefore = corpusReadsFromDisk();
    runAudit(REPO);
    runAudit(REPO, SELF_EXCLUDED, [ROUTES[0] as Route]);
    // Delta zero, not "smaller": one re-read is the whole defect, at any size.
    expect(corpusReadsFromDisk() - readsBefore).toBe(0);
    // Anti-vacuity: a memo over an EMPTY corpus also reports a delta of zero. This is the
    // assertion that separates "read nothing twice" from "read everything once".
    expect(readsBefore).toBeGreaterThan(500);
  });
});

describe("the recognizers each still recognize — this IS the per-route floor", () => {
  // Run the audit with ONE route enabled at a time. A route that finds nothing on its
  // own is a dead recognizer, and in the full run its zero would be hidden by the other
  // three — which is the whole defect this file is about. Four tests, not one.
  for (const route of ROUTES) {
    test(`route ${route.id} contributes at least one site by itself`, () => {
      const { report, exitCode } = runAudit(REPO, SELF_EXCLUDED, [route]);
      expect(report.perRoute.get(route.id) ?? 0).toBeGreaterThanOrEqual(1);
      expect(report.darkRoutes).toEqual([]);
      expect(exitCode).toBe(0);
    });
  }

  test("a route that cannot match is reported DARK and sets exit 3 — naming it", () => {
    const impossible: Route = {
      id: "impossible",
      why: "a recognizer that cannot fire",
      pattern: /zzz-this-string-is-not-in-the-repository-zzz/g,
      requiresCorpusGather: false,
    };
    const { report, exitCode } = runAudit(REPO, SELF_EXCLUDED, [...ROUTES, impossible]);
    expect(report.darkRoutes).toEqual(["impossible"]);
    expect(exitCode).toBe(3);
  });

  test("the aggregate is NOT what decides — 56 live sites do not rescue one dark route", () => {
    // Stated as its own test because it is the claim the whole change rests on: a total
    // in the dozens says nothing about whether a particular instrument is alive.
    const impossible: Route = {
      id: "impossible",
      why: "a recognizer that cannot fire",
      pattern: /zzz-this-string-is-not-in-the-repository-zzz/g,
      requiresCorpusGather: false,
    };
    const { report, exitCode } = runAudit(REPO, SELF_EXCLUDED, [...ROUTES, impossible]);
    expect(report.sites.length).toBeGreaterThan(20);
    expect(exitCode).toBe(3);
  });
});

describe("self-exclusion is load-bearing, not tidiness", () => {
  test("the excluded pair self-satisfies THREE of the four routes — measured, not assumed", () => {
    // The first version of this test asserted all FOUR and failed: received 1 for the
    // source alone. The exclusion is still load-bearing — three floors that could never
    // go dark are three blind instruments — but the claim is pinned at its true size. If
    // this number moves, the header comment has gone stale and someone must notice.
    const routesHit = new Set(
      SELF_EXCLUDED.flatMap((own) => auditText(own, readFileSync(join(REPO, own), "utf8"))).map(
        (s) => s.route,
      ),
    );
    expect([...routesHit].sort()).toEqual(["count-assertion", "floor-prose", "named-min-constant"]);
    expect(routesHit.size).toBe(ROUTES.length - 1);
  });

  test("the source alone would keep floor-prose alive forever — the concrete harm", () => {
    const own = SELF_EXCLUDED[0] as string;
    const found = auditText(own, readFileSync(join(REPO, own), "utf8"));
    expect(found.filter((s) => s.route === "floor-prose").length).toBeGreaterThanOrEqual(1);
  });

  test("the audit excludes its own source by default", () => {
    const { report } = runAudit(REPO);
    expect(report.sites.some((s) => SELF_EXCLUDED.includes(s.file))).toBe(false);
  });

  test("and its test file too — this file quotes the patterns as well", () => {
    const { report } = runAudit(REPO);
    expect(
      report.sites.some((s) => s.file === "src/Core.TypeScript/hygiene/audit-scan-floor-routes.test.ts"),
    ).toBe(false);
  });
});

describe("a threshold is not a scan floor unless a corpus was gathered", () => {
  const flasher = `const MIN_ISO_BYTES = 200 * 1024 * 1024;
if (size < MIN_ISO_BYTES) throw new Error("iso too small");`;

  test("a MIN_ constant in a file that walks nothing is not reported", () => {
    expect(CORPUS_GATHER.test(flasher)).toBe(false);
    expect(auditText("zflash/flash.ts", flasher)).toEqual([]);
  });

  test("the same comparison in a file that walks the tree IS reported", () => {
    const linter = `const files = readdirSync(root);
if (files.length < MIN_FILES_EXPECTED) process.exit(2);`;
    const found = auditText("hygiene/lint.ts", linter);
    expect(found.map((s) => s.route)).toContain("named-min-constant");
  });
});

describe("the live inventory", () => {
  test("the repo audit is green and every route is alive", () => {
    const { report, exitCode } = runAudit(REPO);
    expect(exitCode).toBe(0);
    expect(report.darkRoutes).toEqual([]);
    expect(report.filesScanned).toBeGreaterThan(500);
  });

  test("the multi-route hint is INFORMATIONAL — it never changes the exit code", () => {
    // A heuristic that gates a build is a heuristic that gets tuned until it is silent.
    // This one only points; the judgement of union-vs-intersection stays with a reader.
    const { report, exitCode } = runAudit(REPO);
    expect(exitCode).toBe(0);
    expect(Array.isArray(report.multiRouteCandidates)).toBe(true);
  });

  test("the checks converted in this change are in the inventory", () => {
    const { report } = runAudit(REPO);
    const files = new Set(report.sites.map((s) => s.file));
    expect(files.has("src/Core.TypeScript/hygiene/no-agent-gate-bypass.test.ts")).toBe(true);
    expect(files.has("full-ai-cluster/tools/k8s-manifests.test.ts")).toBe(true);
    expect(files.has("src/wasm-dla/bytelock/run-bytelock-ci.mjs")).toBe(true);
  });
});
