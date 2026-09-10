#!/usr/bin/env bun
/**
 * Falsifiers for `chart-assertion-census.ts`.
 *
 * The census exists to say what an assertion CANNOT catch, so the first thing to
 * establish is that the census itself can fail. Every negative test below mutates
 * a row and expects a named refusal; the CONTROLS establish that the real tree
 * produces none, without which an always-failing implementation would satisfy all
 * of them.
 *
 * The measured facts these pin, from 2026-09-09:
 *   - `deepseek-coder` and `qwen-coder` are asserted `Synced+Healthy` and every
 *     committed resource is a kind ArgoCD gives no health verdict;
 *   - nine directories are applied by no lane;
 *   - the post-deploy functional assertion count is DERIVED from the workflows,
 *     so it is true in every merge order rather than hand-set.
 */
import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import {
  census,
  censusFailures,
  committedKinds,
  FUNCTIONAL_ASSERTIONS,
  FUNCTIONAL_ASSERTION_MARKER,
  healthVerdict,
  parseFunctionalAssertions,
  readFunctionalAssertions,
  HEALTHY_BY_VACUITY,
  HEALTH_BEARING_KINDS,
  NEVER_APPLIED_COVERAGE,
  renderMarkdown,
  summarise,
  tierOfApplied,
  type CensusRow,
} from "./chart-assertion-census.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** A row shaped for one refusal at a time. */
function row(over: Partial<CensusRow>): CensusRow {
  const base: CensusRow = {
    dir: "example",
    tier: "full",
    healthBearing: 1,
    healthBlind: 0,
    resourcesInTree: true,
    coveredBy: null,
    functional: null,
  };
  return { ...base, ...over };
}

describe("chart assertion census", () => {
  test("CONTROL: the real tree is accounted for -- must SURVIVE the mutations", () => {
    expect(censusFailures(census(REPO_ROOT))).toEqual([]);
  });

  test("CONTROL: the census is non-empty and every tier is represented", () => {
    const rows = census(REPO_ROOT);
    expect(rows.length).toBeGreaterThan(40);
    const tiers = new Set(rows.map((r) => r.tier));
    expect(tiers.has("full")).toBe(true);
    expect(tiers.has("not-applied")).toBe(true);
  });

  test("THE FINDING, now DERIVED: the count matches what this tree's workflows declare", () => {
    // NO LONGER A HAND-SET NUMBER. It was `toBe(0)` against a hand-written map,
    // and that made the census's headline figure depend on MERGE ORDER: the first
    // real functional assertion lives in a different pull request, so whichever
    // landed second owed a hand-edit at an unattended moment -- or `main` would
    // carry a census reporting a count that had stopped being true.
    //
    // Derived, the count is a function of the tree it is read in, so it is correct
    // in every merge order and nobody owes an edit. What this pins instead is the
    // AGREEMENT between the registry and the workflows -- the property that was
    // never checkable while the map was written by hand.
    const declared = readFunctionalAssertions(REPO_ROOT);
    expect(FUNCTIONAL_ASSERTIONS.size).toBe(declared.size);
    const rows = census(REPO_ROOT);
    const counted = rows.filter((r) => r.functional !== null).length;
    expect(counted).toBe(declared.size);
  });

  test("MUTATION: a never-applied chart with no coverage entry is refused", () => {
    const one = row({
      dir: "unregistered",
      tier: "not-applied",
    });
    const failures = censusFailures([one]);
    expect(failures.join(" ")).toContain("belongs to no job");
  });

  test("MUTATION: a health-blind chart asserted Synced+Healthy is refused", () => {
    const one = row({
      dir: "blind-and-asserted",
      healthBearing: 0,
      healthBlind: 3,
    });
    const failures = censusFailures([one]);
    expect(failures.join(" ")).toContain("the Healthy half carries no information");
  });

  test("MUTATION: a coverage entry for a chart a lane now applies is refused as STALE", () => {
    const one = row({
      dir: "longhorn",
      tier: "full",
    });
    const failures = censusFailures([one]);
    expect(failures.join(" ")).toContain("is STALE");
  });

  test("MUTATION: an EMPTY census is refused", () => {
    const failures = censusFailures([]);
    expect(failures.join(" ")).toContain("a check that cannot fail");
  });

  test("the vacuity column never claims coverage it cannot establish", () => {
    const helm = row({
      resourcesInTree: false,
      healthBearing: 0,
    });
    expect(healthVerdict(helm)).toBe("helm-unknown");
    const blind = row({
      healthBearing: 0,
      healthBlind: 2,
    });
    expect(healthVerdict(blind)).toBe(HEALTHY_BY_VACUITY);
    expect(healthVerdict(blind)).toContain("nothing exists that could be unhealthy");
    expect(healthVerdict(row({}))).toBe("reconciliation-only");
  });

  test("tierOfApplied ranks manual-sync and excluded below the full contract", () => {
    expect(tierOfApplied(undefined)).toBe("applied-unasserted");
    const manual = { manualSync: true, excludedFromDev: false };
    expect(tierOfApplied(manual)).toBe("manual-sync");
    const excluded = { manualSync: false, excludedFromDev: true };
    expect(tierOfApplied(excluded)).toBe("applied-unasserted");
    const plain = { manualSync: false, excludedFromDev: false };
    expect(tierOfApplied(plain)).toBe("full");
  });

  test("MEASURED: hat-system is overwhelmingly health-blind, which is why it hid a defect", () => {
    const kinds = committedKinds(REPO_ROOT, "hat-system");
    const bearing = kinds.filter((k) => HEALTH_BEARING_KINDS.has(k));
    expect(kinds.length).toBeGreaterThan(20);
    expect(bearing.length * 5).toBeLessThan(kinds.length);
  });

  test("the rendered table and summary both name the functional gap", () => {
    const rows = census(REPO_ROOT);
    expect(renderMarkdown(rows)).toContain("functional assertion");
    // THE RATIO, not the bare count: "1" would read as "we have post-deploy
    // testing"; "1 of 49" answers what is actually tested.
    expect(summarise(rows)).toContain(" of " + String(rows.length) + " with a POST-DEPLOY FUNCTIONAL assertion");
    expect(summarise(rows)).toContain("healthy-by-vacuity");
  });
});

/**
 * -- THE MODEL-INFO CHARTS ---------------------------------------------------
 * Aaron 2026-09-09, on `deepseek-coder` and `qwen-coder`: "what's special about
 * those charts rather than the way we have our multi harness summoner and our own
 * custom harness both of which can use ollama and others?"
 *
 * The measured answer is "nothing", and these pin the two halves of it so the
 * disposition cannot rot into folklore: the ConfigMaps have no consumer, and the
 * harness reads the same pair from somewhere else.
 */
describe("the model-info charts", () => {
  test("MEASURED: both are healthy-by-vacuity, and both are asserted anyway", () => {
    const rows = census(REPO_ROOT);
    for (const dir of ["deepseek-coder", "qwen-coder"]) {
      const found = rows.find((r) => r.dir === dir);
      if (found === undefined) throw new Error("missing row: " + dir);
      expect(found.tier).toBe("full");
      expect(found.healthBearing).toBe(0);
      expect(healthVerdict(found)).toBe(HEALTHY_BY_VACUITY);
    }
  });

  test("MEASURED: every committed resource is a ConfigMap or a Namespace", () => {
    const kinds = new Set<string>();
    for (const dir of ["deepseek-coder", "qwen-coder"]) {
      for (const k of committedKinds(REPO_ROOT, dir)) kinds.add(k);
    }
    // No Deployment, no StatefulSet, no Service, no image: nothing RUNS here.
    expect([...kinds].sort()).toEqual(["ConfigMap", "Namespace"]);
  });
});

/**
 * -- THE BRANCH NOTHING ASSERTED -------------------------------------------
 * `NEVER_APPLIED_COVERAGE` was IMPORTED into this file and never used. A review
 * flagged it as an unused import, and the flag was right -- but "delete the
 * import" would have been the wrong fix, because the import was not decoration:
 * `censusFailures` carries a THIRD refusal on each registry -- "it names a
 * directory the tree no longer has" -- and only two of the three were ever
 * tested. The import was added for an assertion that never got written.
 *
 * That is a small instance of exactly what this census exists to find: a refusal
 * that is present, reads as coverage, and is falsified by nothing. So the import
 * is USED rather than removed, and the branch gets its falsifier.
 *
 * The `FUNCTIONAL_ASSERTIONS` half could not be reached at all while that map is
 * empty by design, which is why `censusFailures` now takes both registries as
 * injectable parameters -- see its docstring.
 */
describe("the orphan branch", () => {
  test("MUTATION: a coverage entry naming a directory the tree no longer has is refused", () => {
    // DERIVED from the real registry, never a hardcoded name: this test must
    // follow the registry if its contents change.
    const registered = [...NEVER_APPLIED_COVERAGE.keys()];
    expect(registered.length).toBeGreaterThan(0);
    const gone = registered[0];
    if (gone === undefined) throw new Error("registry is empty");
    // A census whose rows omit the registered dir == the dir was deleted.
    const other = row({
      dir: "some-other-chart",
    });
    const failures = censusFailures([other]);
    expect(failures.join(" ")).toContain(gone + ": NEVER_APPLIED_COVERAGE names a directory");
  });

  test("MUTATION: the same refusal on FUNCTIONAL_ASSERTIONS -- reachable only by injection", () => {
    // The real map is empty by design, so this branch could never fire against
    // it. Injecting one is what makes the refusal falsifiable rather than merely
    // written down -- which is the whole subject of this file.
    const injected = new Map([["a-retired-chart", "some functional test"]]);
    const rows = [row({})];
    const failures = censusFailures(rows, new Map(), injected);
    expect(failures.join(" ")).toContain("a-retired-chart: FUNCTIONAL_ASSERTIONS names a directory");
  });

  test("CONTROL: injecting EMPTY registries produces no orphan failure", () => {
    // Without this, both tests above would still pass if the orphan loops were
    // rewritten to report unconditionally.
    const failures = censusFailures([row({})], new Map(), new Map());
    expect(failures.join(" ")).not.toContain("names a directory the tree no longer has");
  });
});

/**
 * -- THE DERIVATION -------------------------------------------------------
 * The registry used to be hand-written, with a docstring promising "an entry must
 * name a path that EXISTS" and NO CODE IMPLEMENTING IT. The promise went unnoticed
 * because the map was empty: unmetered by virtue of being unused.
 *
 * Deriving it from the workflows makes that refusal unnecessary rather than
 * unimplemented -- a derived entry names a step that exists by construction -- and
 * removes the merge-order hand-edit the hand-written map owed.
 */
describe("the derived functional-assertion registry", () => {
  test("a step that DECLARES the marker is found; an unmarked one is not", () => {
    const lines = [
      "jobs:",
      "  live:",
      "    steps:",
      "      - name: the marked step",
      "        env:",
      "          " + FUNCTIONAL_ASSERTION_MARKER + ": hat-system",
      "        run: echo assert",
      "      - name: an ordinary step",
      "        run: echo nothing",
      "",
    ];
    const found = parseFunctionalAssertions(lines.join("\n"), "lane.yml");
    expect(found.size).toBe(1);
    expect(found.get("hat-system")).toBe("lane.yml :: the marked step");
  });

  test("THE GREP TRAP: the marker inside a COMMENT is not a declaration", () => {
    // This repo's workflows carry very long `#` comment blocks that quote their
    // own mechanisms. A grep would count this and report coverage that does not
    // exist -- the same defect `parseMisePin` documents for the dotnet pin.
    const lines = [
      "# a step would declare " + FUNCTIONAL_ASSERTION_MARKER + ": hat-system here",
      "jobs:",
      "  live:",
      "    steps:",
      "      - name: a step with no marker",
      "        run: echo nothing",
      "",
    ];
    const text = lines.join("\n");
    expect(text).toContain(FUNCTIONAL_ASSERTION_MARKER);
    expect(parseFunctionalAssertions(text, "lane.yml").size).toBe(0);
  });

  test("CONTROL: malformed YAML yields nothing rather than throwing", () => {
    const junk = "{{{ not yaml";
    expect(parseFunctionalAssertions(junk, "lane.yml").size).toBe(0);
  });

  test("a declared chart must be a real Application -- otherwise the orphan refusal fires", () => {
    // The refusal the hand-written map promised and never implemented, now
    // reachable: a marker naming a chart the tree does not have is caught.
    const bogus = new Map([["not-a-chart", "lane.yml :: step"]]);
    const failures = censusFailures(census(REPO_ROOT), NEVER_APPLIED_COVERAGE, bogus);
    expect(failures.join(" ")).toContain("not-a-chart: FUNCTIONAL_ASSERTIONS names a directory");
  });
});
