// src/Core.TypeScript/hygiene/report-chart-currency.test.ts
//
// The falsifiers for the currency report. Each block below fails if the
// specific defect it names comes back; a test that could not fail is not a
// test, so the three that matter most are stated as the inversions they guard:
//
//   1. an ABANDONED chart must not read as the healthiest thing in the tree
//   2. a coordinate we could not REACH must not read as up to date
//   3. the generated report must be byte-identical when nothing changed
//
// (1) is not hypothetical -- `minio` is at its newest published version and is
// the most dangerous dependency here, because upstream archived the repository.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ChartCoordinate, RosterEntry } from "./audit-chart-target-revisions.ts";
import {
  serializeChartDates,
  writeChartDatesIfChanged,
  OCI_DATES_UNAVAILABLE,
  type ChartDatesEntry,
} from "./chart-publish-dates.ts";
import {
  classifyActivity,
  classifyBump,
  computeRow,
  countBehind,
  daysBetween,
  DORMANT_AFTER_DAYS,
  newestStableVersion,
  QUIET_AFTER_DAYS,
  renderReport,
  type CurrencyRow,
} from "./report-chart-currency.ts";

const SNAPSHOT_AT = "2026-08-21T20:40:53Z";

function coordinate(overrides: Partial<ChartCoordinate> = {}): ChartCoordinate {
  return {
    manifest: "full-ai-cluster/k8s/applications/x/Application.yaml",
    appName: "x",
    sourceIndex: 0,
    repoURL: "https://charts.example.com",
    chart: "x",
    targetRevision: "1.0.0",
    kind: "helm-index",
    ...overrides,
  };
}

function rosterEntry(versions: readonly string[], overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    repoURL: "https://charts.example.com",
    chart: "x",
    kind: "helm-index",
    fetchedAt: SNAPSHOT_AT,
    versions,
    ...overrides,
  };
}

function dates(created: Record<string, string>): ChartDatesEntry {
  return { source: "helm-index-created", created };
}

describe("gap arithmetic", () => {
  test("newest stable ignores pre-releases", () => {
    expect(newestStableVersion(["1.0.0", "2.0.0-rc1", "1.9.0"])).toBe("1.9.0");
  });

  test("newest stable is semver-ordered, not index-ordered", () => {
    // Helm indexes are not sorted, and `10.4.0` sorts BEFORE `7.7.10` as a
    // string. A lexical `newest` would report argo-cd as 195 releases behind
    // something older than its own pin.
    expect(newestStableVersion(["10.4.0", "7.7.10", "9.0.0"])).toBe("10.4.0");
  });

  test("behind counts only stable versions strictly greater than the pin", () => {
    expect(countBehind("1.0.0", ["0.9.0", "1.0.0", "1.0.1", "1.1.0", "2.0.0-rc1"])).toBe(2);
  });

  test("behind is null -- never 0 -- when the pin is not a plain version", () => {
    // 0 would read as "up to date". The two must not share a value.
    expect(countBehind(">=1.0.0", ["1.0.0", "2.0.0"])).toBeNull();
  });

  test("a v-prefixed pin is still a version", () => {
    expect(countBehind("v1.16.2", ["v1.16.2", "v1.17.0", "v1.21.1"])).toBe(2);
  });
});

describe("bump class -- a major and a patch must never share a column", () => {
  test("major", () => {
    expect(classifyBump("65.5.0", "88.5.3")).toBe("major");
  });
  test("minor", () => {
    expect(classifyBump("1.16.5", "1.20.1")).toBe("minor");
  });
  test("a 0.x minor is called out separately, because semver permits anything below 1.0.0", () => {
    expect(classifyBump("0.10.1", "0.14.2")).toBe("minor-0x");
  });
  test("0.x to 1.x is a major, not a 0.x minor", () => {
    expect(classifyBump("0.10.1", "1.11.1")).toBe("major");
  });
  test("patch", () => {
    expect(classifyBump("1.0.0", "1.0.9")).toBe("patch");
  });
  test("none when the pin is at or past the newest", () => {
    expect(classifyBump("5.4.0", "5.4.0")).toBe("none");
  });
  test("unknown when either side is not a version -- never silently `none`", () => {
    expect(classifyBump("main", "5.4.0")).toBe("unknown");
  });
});

describe("upstream activity", () => {
  test("day count is measured against the snapshot instant", () => {
    expect(daysBetween("2026-08-01T00:00:00Z", "2026-08-21T00:00:00Z")).toBe(20);
  });

  test("a missing date yields null, never 0", () => {
    // 0 days would mean "published today" -- the single most misleading value
    // an absent fact could take.
    expect(daysBetween("", SNAPSHOT_AT)).toBeNull();
    expect(daysBetween("not-a-date", SNAPSHOT_AT)).toBeNull();
  });

  test("bucket boundaries are inclusive at the named thresholds", () => {
    expect(classifyActivity(QUIET_AFTER_DAYS - 1)).toBe("active");
    expect(classifyActivity(QUIET_AFTER_DAYS)).toBe("quiet");
    expect(classifyActivity(DORMANT_AFTER_DAYS - 1)).toBe("quiet");
    expect(classifyActivity(DORMANT_AFTER_DAYS)).toBe("dormant");
  });

  test("unknown is its own bucket and is NOT active", () => {
    expect(classifyActivity(null)).toBe("unknown");
  });
});

describe("THE MINIO CASE -- behind is not unmaintained", () => {
  // The real numbers: charts.min.io published 5.4.0 on 2025-01-02 and nothing
  // since, while the repository that produces it was archived. A pure
  // versions-behind metric scores this the healthiest pin in the tree.
  const row = computeRow(
    coordinate({ appName: "minio", chart: "minio", targetRevision: "5.4.0" }),
    rosterEntry(["5.3.0", "5.4.0"]),
    dates({ "5.3.0": "2024-11-01T00:00:00Z", "5.4.0": "2025-01-02T09:00:00Z" }),
  );

  test("is zero versions behind", () => {
    expect(row.behind).toBe(0);
  });

  test("and is NOT reported as CURRENT", () => {
    expect(row.verdict).not.toBe("CURRENT");
    expect(row.verdict).toBe("DORMANT");
  });

  test("carries the last-publish date and the silence, so a reader can check the call", () => {
    expect(row.newestPublishedAt).toBe("2025-01-02T09:00:00Z");
    expect(row.silentDays).toBeGreaterThan(DORMANT_AFTER_DAYS);
    expect(row.activity).toBe("dormant");
  });

  test("a chart at its newest version WITH a live upstream still reads CURRENT", () => {
    // The control: without this, `DORMANT` could be produced by a rule that
    // simply never says CURRENT, which would pass the assertion above while
    // measuring nothing.
    const live = computeRow(
      coordinate({ targetRevision: "5.4.0" }),
      rosterEntry(["5.4.0"]),
      dates({ "5.4.0": "2026-08-20T00:00:00Z" }),
    );
    expect(live.verdict).toBe("CURRENT");
    expect(live.activity).toBe("active");
  });
});

describe("a check that did not run must never look like a check that passed", () => {
  test("no roster entry at all -> UNREACHABLE", () => {
    const row = computeRow(coordinate(), undefined, undefined);
    expect(row.verdict).toBe("UNREACHABLE");
    expect(row.activity).toBe("unreachable");
    expect(row.behind).toBeNull();
  });

  test("an unreachable repository -> UNREACHABLE, carrying the error verbatim", () => {
    const row = computeRow(
      coordinate({ targetRevision: "9.0.6" }),
      rosterEntry([], { unreachable: "GET https://code.forgejo.org/... -> HTTP 404" }),
      undefined,
    );
    expect(row.verdict).toBe("UNREACHABLE");
    expect(row.note).toContain("HTTP 404");
  });

  test("a roster entry with an empty version list is unreachable, not up to date", () => {
    const row = computeRow(coordinate(), rosterEntry([]), undefined);
    expect(row.verdict).toBe("UNREACHABLE");
  });

  test("versions known but dates never collected -> activity unknown, NOT active", () => {
    const row = computeRow(
      coordinate({ targetRevision: "0.12.1" }),
      rosterEntry(["0.12.1", "0.14.2"]),
      { source: "unavailable", unavailable: OCI_DATES_UNAVAILABLE, created: {} },
    );
    expect(row.activity).toBe("unknown");
    expect(row.silentDays).toBeNull();
    expect(row.behind).toBe(1);
    expect(row.note).toContain("tags, not publish timestamps");
  });

  test("a pin upstream never published is its own verdict, not `behind`", () => {
    const row = computeRow(
      coordinate({ targetRevision: "1.4.5" }),
      rosterEntry(["1.3.4", "3.2.1"]),
      dates({ "3.2.1": "2026-07-20T00:00:00Z" }),
    );
    expect(row.verdict).toBe("PIN-UNPUBLISHED");
  });

  test("a pin that is not a version at all is PIN-UNPARSEABLE, never CURRENT", () => {
    const row = computeRow(coordinate({ targetRevision: "main" }), rosterEntry(["1.0.0"]), dates({}));
    expect(row.verdict).toBe("PIN-UNPARSEABLE");
  });
});

describe("the report is byte-reproducible", () => {
  const rows: readonly CurrencyRow[] = [
    computeRow(
      coordinate({ appName: "minio", chart: "minio", targetRevision: "5.4.0" }),
      rosterEntry(["5.4.0"]),
      dates({ "5.4.0": "2025-01-02T09:00:00Z" }),
    ),
  ];

  test("renders identically twice -- no clock is read", () => {
    expect(renderReport(rows, ["platform"], SNAPSHOT_AT)).toBe(renderReport(rows, ["platform"], SNAPSHOT_AT));
  });

  test("the rendered text contains no instant other than the snapshot's", () => {
    // A `new Date()` anywhere in the renderer would make a weekly job rewrite
    // this file forever, and a diff that appears every week is a diff nobody
    // reads. The only ISO instant permitted in the output is `asOf`.
    //
    // The character class INCLUDES `.`: a first draft of this test used
    // `[\d:]+Z`, and a mutation that injected `new Date().toISOString()`
    // survived it -- the injected instant carries milliseconds, so the pattern
    // meant to catch it did not match it. A falsifier that cannot see the
    // defect it names is the vacuity class, caught here by mutation.
    const markdown = renderReport(rows, ["platform"], SNAPSHOT_AT);
    const instants = markdown.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g) ?? [];
    expect(new Set(instants)).toEqual(new Set([SNAPSHOT_AT]));
  });

  test("the renderer's own source reads no clock", () => {
    // The direct statement of the property, rather than an inference from one
    // sample of the output: two renders in the same millisecond are identical
    // even when the renderer IS reading the clock, so sampling alone cannot
    // establish this.
    const source = renderReport.toString();
    expect(source).not.toContain("new Date");
    expect(source).not.toContain("Date.now");
  });

  test("the DORMANT verdict reaches the rendered table, not just the model", () => {
    expect(renderReport(rows, [], SNAPSHOT_AT)).toContain("`DORMANT`");
  });

  test("git-path applications are named, so the report states its own scope", () => {
    expect(renderReport(rows, ["platform", "orleans"], SNAPSHOT_AT)).toContain("`orleans`");
  });
});

describe("the dates snapshot", () => {
  test("serializes key-sorted, so refreshes diff by content and not by hash order", () => {
    const a = serializeChartDates({ zeta: dates({ "1.0.0": "x" }), alpha: dates({ "1.0.0": "y" }) });
    const b = serializeChartDates({ alpha: dates({ "1.0.0": "y" }), zeta: dates({ "1.0.0": "x" }) });
    expect(a).toBe(b);
    expect(a.indexOf("alpha")).toBeLessThan(a.indexOf("zeta"));
  });

  test("re-writing identical content changes nothing and says so", () => {
    const dir = mkdtempSync(join(tmpdir(), "chart-dates-"));
    const path = join(dir, "published-chart-dates.json");
    const entries = { k: dates({ "1.0.0": "2026-01-01T00:00:00Z" }) };
    expect(writeChartDatesIfChanged(entries, path)).toBe(true);
    const first = readFileSync(path, "utf8");
    expect(writeChartDatesIfChanged(entries, path)).toBe(false);
    expect(readFileSync(path, "utf8")).toBe(first);
  });

  test("a changed date is written and reported as a change", () => {
    const dir = mkdtempSync(join(tmpdir(), "chart-dates-"));
    const path = join(dir, "published-chart-dates.json");
    writeFileSync(path, serializeChartDates({ k: dates({ "1.0.0": "2026-01-01T00:00:00Z" }) }));
    expect(writeChartDatesIfChanged({ k: dates({ "1.0.0": "2026-02-02T00:00:00Z" }) }, path)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("2026-02-02");
  });
});
