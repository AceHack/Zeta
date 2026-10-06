// Every HA chart is either ASSERTED by the multi-node lane or NAMED as not covered, with
// a reason (081M48Z020C087G0R001E6M83V).
//
// "HA chart" = a chart whose correctness needs more than one node. It is derived from two
// sources, because each misses something the other has:
//   - the single-node readiness auditor's extractReplicaClaims() at nodeCount = 1 (reads the
//     manifests; does NOT read a CNPG Cluster's `instances`), and
//   - single-node-budget.json `acknowledgedFalseRedundancy` (hand-kept; carries postgres-shared,
//     which the extractor cannot see, and one dead entry).
//
// What fails here:
//   1. a new HA chart appears and full-ai-cluster/nixos/tests/multinode-ha-coverage.json does
//      not say whether the lane asserts it — the gap would otherwise be silent;
//   2. a `covered` entry names a phase the lane's testScript never runs — a coverage claim with
//      nothing behind it;
//   3. a `staleLedgerEntries` entry has stopped being stale (its Application now exists, or the
//      ledger dropped it) — so the stated reason is false and must be revisited.
//
// NOT PROVEN HERE: that the lane passes. That is CI's `cluster-multinode` job.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_ROOTS, extractReplicaClaims, loadManifests } from "./single-node-readiness.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const COVERAGE = resolve(REPO_ROOT, "full-ai-cluster/nixos/tests/multinode-ha-coverage.json");
const LEDGER = resolve(REPO_ROOT, "full-ai-cluster/k8s/single-node-budget.json");

interface Coverage {
  readonly lane: string;
  readonly covered: Readonly<Record<string, { readonly phase: string; readonly what: string }>>;
  readonly notCovered: Readonly<Record<string, string>>;
  readonly staleLedgerEntries: Readonly<Record<string, string>>;
}

const coverage = JSON.parse(readFileSync(COVERAGE, "utf8")) as Coverage;
const ledger = JSON.parse(readFileSync(LEDGER, "utf8")) as { acknowledgedFalseRedundancy?: string[] };
const lanePath = resolve(REPO_ROOT, coverage.lane);
const laneText = readFileSync(lanePath, "utf8");

/** `full-ai-cluster/<dir>` -> does `full-ai-cluster/k8s/applications/<dir>` exist? */
const appDirExists = (app: string): boolean => {
  const [tree, ...rest] = app.split("/");
  return existsSync(resolve(REPO_ROOT, tree ?? "", "k8s/applications", rest.join("/")));
};

const extracted = new Set(
  loadManifests(DEFAULT_ROOTS, REPO_ROOT)
    .flatMap((m) => extractReplicaClaims(m, 1))
    .filter((c) => c.verdict !== "honest")
    .map((c) => c.app),
);
const acknowledged = new Set(ledger.acknowledgedFalseRedundancy ?? []);
const haCharts = [...new Set([...extracted, ...acknowledged])].sort();

describe("multi-node lane HA coverage", () => {
  test("the derivation finds HA charts at all (an empty set would pass everything below)", () => {
    expect(extracted.size).toBeGreaterThan(0);
    expect(haCharts.length).toBeGreaterThanOrEqual(extracted.size);
  });

  test("every HA chart is covered, not-covered with a reason, or a named stale ledger entry", () => {
    const stated = new Set([
      ...Object.keys(coverage.covered),
      ...Object.keys(coverage.notCovered),
      ...Object.keys(coverage.staleLedgerEntries),
    ]);
    const unstated = haCharts.filter((app) => !stated.has(app));
    expect(unstated).toEqual([]);
  });

  test("the three lists do not overlap", () => {
    const all = [
      ...Object.keys(coverage.covered),
      ...Object.keys(coverage.notCovered),
      ...Object.keys(coverage.staleLedgerEntries),
    ];
    expect(all.length).toBe(new Set(all).size);
  });

  test("every covered entry names a phase the lane actually runs", () => {
    for (const [app, entry] of Object.entries(coverage.covered)) {
      expect({ app, inLane: laneText.includes(`phase("${entry.phase}")`) }).toEqual({ app, inLane: true });
      expect(appDirExists(app)).toBe(true);
    }
  });

  test("every not-covered entry is a real Application and carries a reason", () => {
    for (const [app, reason] of Object.entries(coverage.notCovered)) {
      expect({ app, exists: appDirExists(app) }).toEqual({ app, exists: true });
      expect(reason.trim().length).toBeGreaterThan(20);
    }
  });

  test("every stale ledger entry is still stale: acknowledged, with no Application directory", () => {
    for (const app of Object.keys(coverage.staleLedgerEntries)) {
      expect({ app, acknowledged: acknowledged.has(app), exists: appDirExists(app) }).toEqual({
        app,
        acknowledged: true,
        exists: false,
      });
    }
  });

  test("the lane still derives postgres-shared and Longhorn from the shipped files", () => {
    // If the lane went back to transcribing values, a prod change would stop reaching it.
    expect(laneText).toContain("../../k8s/applications/postgres-shared/cluster.yaml");
    expect(laneText).toContain("../../k8s/applications/longhorn/Application.yaml");
    expect(laneText).toContain("../../k8s/applications/cloudnativepg/Application.yaml");
  });
});
