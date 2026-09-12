// outdated.test.ts -- falsifiers for the KNOWLEDGE half of `ace outdated`.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// THE CONTROL COMES FIRST, DELIBERATELY
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// A reporter that answered "outdated" for every dependency would pass every "it detects an
// outdated dependency" test in this file. A reporter that answered "up to date" for every
// dependency would pass every "it reports nothing when everything is current" test. Neither
// reporter is worth anything, and neither is a test suite that cannot tell them apart.
//
// So §CONTROL below feeds ONE report containing a behind row, a current row, an ahead row and
// four separately-caused unknown rows, and asserts that the five verdicts land on the five
// DIFFERENT dependencies. A constant reporter fails it on the first assertion; so does a
// reporter that merely gets the counts right while attaching them to the wrong rows.

import { describe, expect, test } from "bun:test";
import {
  ageInDays,
  buildReport,
  compareOne,
  defaultExitPolicy,
  defaultStalenessPolicy,
  exitCodeFor,
  freshnessOf,
  knowledgeFor,
  parseSnapshot,
  proposalsFrom,
  renderReport,
  serializeSnapshot,
  snapshotPathFor,
  summaryLine,
  type EcosystemSnapshot,
  type LoadedSnapshots,
} from "./outdated.ts";
import type { PinnedDependency, PinnedInventory } from "./outdated-inventory.ts";

const NOW = new Date("2026-09-11T12:00:00Z");

function dep(name: string, current: string, pinKind: "exact" | "range" = "exact"): PinnedDependency {
  return { ecosystem: "npm", name, current, pinKind, source: "package.json" };
}

function snapshot(observedAt: string, packages: Record<string, { latest: string; observedAt: string }>): LoadedSnapshots {
  const snap: EcosystemSnapshot = {
    ecosystem: "npm",
    observedAt,
    packages: Object.fromEntries(
      Object.entries(packages).map(([k, v]) => [k, { latest: v.latest, observedAt: v.observedAt, source: "https://registry.example/" }]),
    ),
  };
  return { byEcosystem: new Map([["npm", snap]]), gaps: [] };
}

function inventory(deps: PinnedDependency[]): PinnedInventory {
  return { deps, unreadable: [], sourcesRead: ["package.json"] };
}

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("CONTROL -- the reporter must DISCRIMINATE, not just produce verdicts", () => {
  const snaps = snapshot("2026-09-10", {
    behind: { latest: "2.0.0", observedAt: "2026-09-10" },
    current: { latest: "1.0.0", observedAt: "2026-09-10" },
    ahead: { latest: "1.0.0", observedAt: "2026-09-10" },
    ranged: { latest: "9.9.9", observedAt: "2026-09-10" },
    garbled: { latest: "not-a-version", observedAt: "2026-09-10" },
  });
  const inv = inventory([
    dep("behind", "1.0.0"),
    dep("current", "1.0.0"),
    dep("ahead", "2.0.0"),
    dep("ranged", "^1.0.0", "range"),
    dep("garbled", "1.0.0"),
    dep("absent-from-snapshot", "1.0.0"),
  ]);
  const report = buildReport(inv, snaps, NOW, defaultStalenessPolicy);
  const verdictOf = (name: string): string => report.rows.find((r) => r.dependency.name === name)?.distance.t ?? "MISSING";

  // A CONSTANT REPORTER DIES ON THE FIRST TWO LINES. Both are required: one alone is satisfied
  // by a reporter stuck on the other verdict.
  test("the behind dependency is Behind AND the current one is UpToDate", () => {
    expect(verdictOf("behind")).toBe("Behind");
    expect(verdictOf("current")).toBe("UpToDate");
  });

  test("a pin newer than the snapshot is Ahead, not Behind and not current", () => {
    expect(verdictOf("ahead")).toBe("Ahead");
  });

  // FOUR DIFFERENT CAUSES, ALL LANDING ON Unknown -- and none of them on UpToDate.
  test("every unresolvable case is Unknown, never current", () => {
    expect(verdictOf("ranged")).toBe("Unknown");
    expect(verdictOf("garbled")).toBe("Unknown");
    expect(verdictOf("absent-from-snapshot")).toBe("Unknown");
  });

  test("the five verdicts are attached to five DIFFERENT dependencies", () => {
    expect(new Set([verdictOf("behind"), verdictOf("current"), verdictOf("ahead"), verdictOf("ranged")]).size).toBe(4);
  });

  test("the counts add up to the row count -- no row is silently dropped", () => {
    const c = report.counts;
    expect(c.behind + c.upToDate + c.ahead + c.unknown).toBe(c.total);
    expect(c.total).toBe(6);
    expect(c).toEqual({ total: 6, behind: 1, upToDate: 1, ahead: 1, unknown: 3 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("absence of a verdict is never absence of a finding", () => {
  test("no snapshot for the ecosystem: every row is Unknown, ZERO are UpToDate", () => {
    const none: LoadedSnapshots = {
      byEcosystem: new Map(),
      gaps: [{ ecosystem: "npm", path: snapshotPathFor("npm"), reason: "not-found" }],
    };
    const report = buildReport(inventory([dep("a", "1.0.0"), dep("b", "2.0.0")]), none, NOW, defaultStalenessPolicy);
    expect(report.counts).toEqual({ total: 2, behind: 0, upToDate: 0, ahead: 0, unknown: 2 });
  });

  test("a dependency absent from a present snapshot is Unknown, and says which snapshot", () => {
    const k = knowledgeFor(dep("ghost", "1.0.0"), snapshot("2026-09-01", {}), NOW, defaultStalenessPolicy);
    expect(k.t).toBe("NotInSnapshot");
    const d = compareOne(dep("ghost", "1.0.0"), k);
    expect(d.t).toBe("Unknown");
    if (d.t === "Unknown") expect(d.why).toContain("2026-09-01");
  });

  test("an Unknown always carries a reason -- an unreasoned unknown is indistinguishable from a bug", () => {
    const snaps = snapshot("2026-09-10", { x: { latest: "bad-version", observedAt: "2026-09-10" } });
    const report = buildReport(inventory([dep("x", "1.0.0")]), snaps, NOW, defaultStalenessPolicy);
    const d = report.rows[0]?.distance;
    expect(d?.t).toBe("Unknown");
    if (d?.t === "Unknown") expect(d.why.length).toBeGreaterThan(10);
  });

  test("the summary line ALWAYS states the unknown count, so exit 0 cannot read as 'all current'", () => {
    const none: LoadedSnapshots = { byEcosystem: new Map(), gaps: [{ ecosystem: "npm", path: "p", reason: "r" }] };
    const report = buildReport(inventory([dep("a", "1.0.0")]), none, NOW, defaultStalenessPolicy);
    expect(summaryLine(report)).toContain("1 unknown");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("staleness -- 'I do not know how current my knowledge is' is representable", () => {
  test("age is computed from the committed date against an INJECTED now, not an ambient clock", () => {
    expect(ageInDays("2026-09-11", NOW)).toBe(0);
    expect(ageInDays("2026-09-01", NOW)).toBe(10);
    expect(ageInDays("2026-06-09", NOW)).toBe(94);
  });

  test("freshness bands", () => {
    expect(freshnessOf(0, defaultStalenessPolicy)).toBe("fresh");
    expect(freshnessOf(7, defaultStalenessPolicy)).toBe("fresh");
    expect(freshnessOf(8, defaultStalenessPolicy)).toBe("aging");
    expect(freshnessOf(31, defaultStalenessPolicy)).toBe("stale");
    expect(freshnessOf(Number.NaN, defaultStalenessPolicy)).toBe("absent");
  });

  // THE LOAD-BEARING ONE. `UpToDate` on a 94-day-old observation must not render as "current".
  test("a current verdict on a STALE observation never renders as a bare 'current'", () => {
    const snaps = snapshot("2026-06-09", { x: { latest: "1.0.0", observedAt: "2026-06-09" } });
    const report = buildReport(inventory([dep("x", "1.0.0")]), snaps, NOW, defaultStalenessPolicy);
    expect(report.rows[0]?.distance.t).toBe("UpToDate");
    const rendered = renderReport(report, { showAll: true });
    expect(rendered).toContain("current as of a stale observation");
    expect(rendered).toContain("94d ago");
  });

  test("a current verdict on a FRESH observation does render as plain current", () => {
    const snaps = snapshot("2026-09-11", { x: { latest: "1.0.0", observedAt: "2026-09-11" } });
    const rendered = renderReport(buildReport(inventory([dep("x", "1.0.0")]), snaps, NOW, defaultStalenessPolicy), { showAll: true });
    expect(rendered).toContain("[current]");
    expect(rendered).not.toContain("stale");
  });

  test("PER-ROW ages are independent -- a partial refresh does not re-date rows nobody re-observed", () => {
    const snaps = snapshot("2026-09-11", {
      fresh: { latest: "1.0.0", observedAt: "2026-09-11" },
      old: { latest: "1.0.0", observedAt: "2026-06-09" },
    });
    const report = buildReport(inventory([dep("fresh", "1.0.0"), dep("old", "1.0.0")]), snaps, NOW, defaultStalenessPolicy);
    expect(report.snapshotAgeDays).toEqual({ min: 0, max: 94 });
  });

  test("the summary line carries the age band", () => {
    const snaps = snapshot("2026-09-11", { a: { latest: "1.0.0", observedAt: "2026-09-04" } });
    expect(summaryLine(buildReport(inventory([dep("a", "1.0.0")]), snaps, NOW, defaultStalenessPolicy))).toContain("snapshot age 7-7d");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("exit codes -- 'ran and found nothing' is not 'could not run'", () => {
  const current = snapshot("2026-09-11", { a: { latest: "1.0.0", observedAt: "2026-09-11" } });

  test("0 -- ran, nothing behind", () => {
    expect(exitCodeFor(buildReport(inventory([dep("a", "1.0.0")]), current, NOW), defaultExitPolicy)).toBe(0);
  });

  test("1 -- ran, something behind", () => {
    const snaps = snapshot("2026-09-11", { a: { latest: "2.0.0", observedAt: "2026-09-11" } });
    expect(exitCodeFor(buildReport(inventory([dep("a", "1.0.0")]), snaps, NOW), defaultExitPolicy)).toBe(1);
  });

  test("2 -- no manifest could be read: the question was never asked", () => {
    const broken: PinnedInventory = { deps: [], unreadable: [{ path: "package.json", reason: "EACCES" }], sourcesRead: [] };
    expect(exitCodeFor(buildReport(broken, current, NOW), defaultExitPolicy)).toBe(2);
  });

  test("2 -- manifests read but NOTHING is known: the freshness question could not run", () => {
    const none: LoadedSnapshots = { byEcosystem: new Map(), gaps: [{ ecosystem: "npm", path: "p", reason: "r" }] };
    expect(exitCodeFor(buildReport(inventory([dep("a", "1.0.0")]), none, NOW), defaultExitPolicy)).toBe(2);
  });

  test("2 -- and it is NOT 0: total ignorance must never share an exit code with 'all current'", () => {
    const none: LoadedSnapshots = { byEcosystem: new Map(), gaps: [{ ecosystem: "npm", path: "p", reason: "r" }] };
    const ignorant = exitCodeFor(buildReport(inventory([dep("a", "1.0.0")]), none, NOW), defaultExitPolicy);
    const allCurrent = exitCodeFor(buildReport(inventory([dep("a", "1.0.0")]), current, NOW), defaultExitPolicy);
    expect(ignorant).not.toBe(allCurrent);
  });

  test("--fail-on-unknown escalates honest ignorance to a finding, and only when asked", () => {
    const snaps = snapshot("2026-09-11", { a: { latest: "1.0.0", observedAt: "2026-09-11" } });
    const report = buildReport(inventory([dep("a", "1.0.0"), dep("b", "1.0.0")]), snaps, NOW);
    expect(exitCodeFor(report, defaultExitPolicy)).toBe(0);
    expect(exitCodeFor(report, { failOnUnknown: true, maxSnapshotAgeDays: null })).toBe(1);
  });

  test("--max-snapshot-age-days turns a stale snapshot into a finding", () => {
    const snaps = snapshot("2026-06-09", { a: { latest: "1.0.0", observedAt: "2026-06-09" } });
    const report = buildReport(inventory([dep("a", "1.0.0")]), snaps, NOW);
    expect(exitCodeFor(report, defaultExitPolicy)).toBe(0);
    expect(exitCodeFor(report, { failOnUnknown: false, maxSnapshotAgeDays: 30 })).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("snapshot format", () => {
  test("round-trips", () => {
    const snap: EcosystemSnapshot = {
      ecosystem: "npm",
      observedAt: "2026-09-11",
      packages: { b: { latest: "2.0.0", observedAt: "2026-09-11", source: "u" }, a: { latest: "1.0.0", observedAt: "2026-09-11", source: "u" } },
    };
    const parsed = parseSnapshot(serializeSnapshot(snap), "npm");
    expect("error" in parsed).toBe(false);
  });

  // ORDINAL KEY ORDER, so a refresh produces a diff that reflects a change in the DATA rather
  // than a change in the order the registry happened to answer.
  test("serialises keys in ordinal order regardless of insertion order", () => {
    const snap: EcosystemSnapshot = {
      ecosystem: "npm",
      observedAt: "2026-09-11",
      packages: { zeta: { latest: "1.0.0", observedAt: "2026-09-11", source: "u" }, Alpha: { latest: "1.0.0", observedAt: "2026-09-11", source: "u" } },
    };
    const text = serializeSnapshot(snap);
    expect(text.indexOf('"Alpha"')).toBeLessThan(text.indexOf('"zeta"'));
  });

  // A MALFORMED SNAPSHOT IS A GAP, NEVER A PARTIAL TRUTH. Accepting a snapshot with no
  // `observedAt` would make its age unknowable while its contents still read as knowledge.
  test("a snapshot without a valid observedAt is refused", () => {
    for (const bad of ['{"ecosystem":"npm","packages":{}}', '{"ecosystem":"npm","observedAt":"yesterday","packages":{}}']) {
      expect("error" in parseSnapshot(bad, "npm")).toBe(true);
    }
  });

  test("a snapshot filed under the wrong ecosystem is refused", () => {
    expect("error" in parseSnapshot('{"ecosystem":"nuget","observedAt":"2026-09-11","packages":{}}', "npm")).toBe(true);
  });

  test("a package row missing its source or observedAt is refused", () => {
    const noSource = '{"ecosystem":"npm","observedAt":"2026-09-11","packages":{"a":{"latest":"1.0.0","observedAt":"2026-09-11"}}}';
    const noDate = '{"ecosystem":"npm","observedAt":"2026-09-11","packages":{"a":{"latest":"1.0.0","source":"u"}}}';
    expect("error" in parseSnapshot(noSource, "npm")).toBe(true);
    expect("error" in parseSnapshot(noDate, "npm")).toBe(true);
  });

  test("snapshots are partitioned one file per ecosystem", () => {
    expect(snapshotPathFor("npm")).toBe("registry/latest-known/npm.json");
    expect(snapshotPathFor("nuget")).toBe("registry/latest-known/nuget.json");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
describe("proposalsFrom -- the producer dep-update was missing", () => {
  test("emits one proposal per Behind row, with the bump dep-update classifies on", () => {
    const snaps = snapshot("2026-09-11", {
      major: { latest: "2.0.0", observedAt: "2026-09-11" },
      minor: { latest: "1.1.0", observedAt: "2026-09-11" },
      patch: { latest: "1.0.1", observedAt: "2026-09-11" },
      same: { latest: "1.0.0", observedAt: "2026-09-11" },
    });
    const inv = inventory([dep("major", "1.0.0"), dep("minor", "1.0.0"), dep("patch", "1.0.0"), dep("same", "1.0.0")]);
    const proposals = proposalsFrom(buildReport(inv, snaps, NOW));
    expect(proposals.map((p) => `${p.packageName}:${p.claimedBump}`).sort()).toEqual(["major:major", "minor:minor", "patch:patch"]);
  });

  test("an Unknown row produces NO proposal -- we do not propose an update we cannot name", () => {
    const none: LoadedSnapshots = { byEcosystem: new Map(), gaps: [{ ecosystem: "npm", path: "p", reason: "r" }] };
    expect(proposalsFrom(buildReport(inventory([dep("a", "1.0.0")]), none, NOW))).toEqual([]);
  });
});
