import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  auditText,
  CORPUS_GATHER,
  ROUTES,
  runAudit,
  SELF_EXCLUDED,
  type Route,
} from "./audit-scan-floor-routes.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..");

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
