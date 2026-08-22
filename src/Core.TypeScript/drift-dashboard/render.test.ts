/**
 * render.test.ts — falsifiers for the surface, not the model.
 *
 * The presentation is half the requirement: an unknown that is displayed but not
 * DISTINGUISHED has not been surfaced. These tests fail if the rendering ever buries
 * an unknown, hides coverage, or lets green outrank red on the page.
 */

import { describe, expect, it } from "bun:test";

import type { CheckDefinition, CheckObservation } from "../forge-host/types.ts";
import { foldDashboard } from "./fold.ts";
import { renderHtml, renderJson, renderMarkdown } from "./render.ts";
import { emptyRoster, mergeDefinitions, recordObservations } from "./roster.ts";

const NOW = "2026-08-22T18:00:00.000Z";

function def(checkId: string, expectation: CheckDefinition["expectation"]): CheckDefinition {
  return { checkId, displayName: checkId, expectation, source: "s" };
}
function obs(checkId: string, verdict: CheckObservation["verdict"], observedAt: string): CheckObservation {
  return { checkId, verdict, observedAt, source: "s" };
}

function sample() {
  let roster = mergeDefinitions(emptyRoster("main", "2026-08-01T00:00:00.000Z"), [
    def("red-old", { kind: "on-change", detail: "push to main" }),
    def("quiet-6d", { kind: "on-change", detail: "push to main" }),
    def("never", { kind: "on-change", detail: "push to main" }),
    def("green-one", { kind: "on-change", detail: "push to main" }),
    def("pr-only", { kind: "on-demand", detail: "pull_request" }),
  ], "2026-08-01T00:00:00.000Z");
  roster = recordObservations(roster, new Map([["quiet-6d", { observedAt: "2026-08-16T18:00:00.000Z", kind: "green" as const }]]));
  return foldDashboard({
    roster,
    observations: [
      obs("red-old", { kind: "red", detail: "failing since the 16th" }, "2026-08-16T00:00:00.000Z"),
      obs("green-one", { kind: "green" }, "2026-08-22T17:00:00.000Z"),
    ],
    now: NOW,
  });
}

describe("markdown", () => {
  const md = renderMarkdown(sample());

  it("puts coverage in the headline, not in a corner", () => {
    const first = md.split("\n").slice(0, 4).join("\n");
    expect(first).toContain("coverage 2/4");
    expect(first).toContain("SHORTFALL 2");
    expect(first).toContain("NOT OK");
  });

  it("orders the sections red → unknown → … → green", () => {
    expect(md.indexOf("## RED")).toBeLessThan(md.indexOf("## UNKNOWN"));
    expect(md.indexOf("## UNKNOWN")).toBeLessThan(md.indexOf("## Green"));
  });

  it("collapses green and does NOT collapse red or unknown", () => {
    const greenSection = md.slice(md.indexOf("## Green"));
    expect(greenSection).toContain("<details>");
    const redSection = md.slice(md.indexOf("## RED"), md.indexOf("## UNKNOWN"));
    expect(redSection).not.toContain("<details>");
    const unknownSection = md.slice(md.indexOf("## UNKNOWN"), md.indexOf("## Not applicable"));
    expect(unknownSection).not.toContain("<details>");
  });

  it("ages every unknown ON the row — a grey block of identical rows is the failure mode", () => {
    const unknownSection = md.slice(md.indexOf("## UNKNOWN"), md.indexOf("## Green"));
    expect(unknownSection).toContain("**NEVER observed**");
    expect(unknownSection).toContain("6d");
    expect(unknownSection).toContain("never-observed");
    expect(unknownSection).toContain("not-observed-this-pass");
    // never-observed above the 6d silence, above nothing shorter
    expect(unknownSection.indexOf("`never`")).toBeLessThan(unknownSection.indexOf("`quiet-6d`"));
  });

  it("does not call not-applicable green", () => {
    const naSection = md.slice(md.indexOf("## Not applicable"), md.indexOf("## Green"));
    expect(naSection).toContain("`pr-only`");
    const greenSection = md.slice(md.indexOf("## Green"));
    expect(greenSection).not.toContain("`pr-only`");
  });

  it("is readable in a terminal — no HTML outside the collapsed sections", () => {
    const beforeNa = md.slice(0, md.indexOf("## Not applicable"));
    expect(beforeNa).not.toContain("<");
  });
});

describe("html", () => {
  const html = renderHtml(sample());

  it("is self-contained: no external asset, CDN, or script fetch", () => {
    expect(html).not.toContain("http://");
    // Case-insensitive on purpose: `/<script[\s>]/` without `i` does not match
    // `<SCRIPT>`, so the assertion would pass on a page that had one. CodeQL flagged
    // exactly that (`js/bad-tag-filter`, high) — in the FALSIFIER, not the code, which
    // is the more expensive place to have a hole.
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).not.toMatch(/<link[\s>]/i);
    expect(html).not.toContain("https://fonts");
    expect(html).not.toContain("cdn.");
  });

  it("carries the headline and the coverage number", () => {
    expect(html).toContain("NOT OK");
    expect(html).toContain("SHORTFALL 2");
  });

  it("marks a never-observed row as NEVER rather than as a blank cell", () => {
    expect(html).toContain("<b>NEVER</b>");
  });

  it("escapes check names rather than interpolating them into markup", () => {
    const report = foldDashboard({
      roster: mergeDefinitions(emptyRoster("main", NOW), [def("<img src=x onerror=1>", { kind: "on-change", detail: "d" })], NOW),
      observations: [],
      now: NOW,
    });
    expect(renderHtml(report)).not.toContain("<img src=x");
    expect(renderHtml(report)).toContain("&lt;img");
  });
});

describe("json", () => {
  it("is text, ends with a newline, and round-trips", () => {
    const text = renderJson(sample());
    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text).coverage.shortfall).toBe(2);
  });
});

describe("the generated markdown must pass the repo's own lint — a rule the generator owns", () => {
  it("escapes the asterisks in a cron, which Markdown would otherwise read as emphasis (MD037)", () => {
    // `7 17 * * 0` contains `* *`. Caught by markdownlint on the first generated file.
    const report = foldDashboard({
      roster: mergeDefinitions(emptyRoster("main", NOW), [
        def("chart-version-refresh", { kind: "periodic", periodSeconds: 7 * 86_400, detail: "schedule: '7 17 * * 0'" }),
      ], NOW),
      observations: [],
      now: NOW,
    });
    const md = renderMarkdown(report);
    expect(md).toContain("7 17 \\* \\* 0");
    expect(md).not.toContain("* * 0'");
  });

  it("never emits two consecutive blank lines (MD012)", () => {
    expect(renderMarkdown(sample())).not.toMatch(/\n\n\n/);
  });

  it("leaves text inside a code span alone, so no backslash leaks into what a reader sees", () => {
    const report = foldDashboard({
      roster: mergeDefinitions(emptyRoster("main", NOW), [
        def("x", { kind: "on-change", detail: "matches `a*b` exactly" }),
      ], NOW),
      observations: [],
      now: NOW,
    });
    expect(renderMarkdown(report)).toContain("`a*b`");
  });
});

describe("the escapes escape their own escape character", () => {
  function reportWithDetail(detail: string) {
    return foldDashboard({
      roster: mergeDefinitions(emptyRoster("main", NOW), [def("x", { kind: "on-change", detail })], NOW),
      observations: [],
      now: NOW,
    });
  }

  it("a backslash in producer text cannot smuggle a bare pipe out of its cell", () => {
    // Without escaping `\` first, `\|` becomes `\\|` — an escaped backslash followed
    // by a BARE pipe, which ends the table cell and corrupts every column after it.
    const md = renderMarkdown(reportWithDetail("path C:\\| and more"));
    const row = md.split("\n").find((l) => l.startsWith("| `x`"));
    expect(row).toBeDefined();
    expect((row ?? "").split(/(?<!\\)\|/).length).toBe(7); // 5 columns ⇒ 6 separators + trailing ""
  });

  it("a backslash in producer text cannot smuggle a bare asterisk past escText", () => {
    const md = renderMarkdown(reportWithDetail("cron \\* * 0"));
    expect(md).not.toMatch(/[^\\]\* \* 0/);
  });
});

describe("escaping holds inside code spans too", () => {
  it("a backslash inside a code span cannot smuggle a bare pipe out of the cell", () => {
    const report = foldDashboard({
      roster: mergeDefinitions(emptyRoster("main", NOW), [
        def("x", { kind: "on-change", detail: "matches `a\\|b` exactly" }),
      ], NOW),
      observations: [],
      now: NOW,
    });
    const row = renderMarkdown(report).split("\n").find((l) => l.startsWith("| `x`"));
    expect((row ?? "").split(/(?<!\\)\|/).length).toBe(7);
  });
});
