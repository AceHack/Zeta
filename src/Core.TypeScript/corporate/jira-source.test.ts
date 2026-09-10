/**
 * jira-source.test.ts — the parsing that decides whether a real ticket is accepted or refused.
 *
 * None of this talks to Jira. What it pins is the layer where a real ticket becomes something this
 * organization can act on, and the two ways that quietly goes wrong: reproduction steps lost inside
 * a nested document so a genuine defect is refused, and a search box that can write query syntax.
 */

import { describe, expect, test } from "bun:test";

import { Severity } from "./intake";
import {
  flattenAdf,
  issueToEvent,
  queryFor,
  readJiraCredentials,
  reproductionFrom,
  severityOf,
  STANDARD_QUERIES,
  type JiraIssue,
} from "./jira-source";

function issue(over: Partial<JiraIssue> = {}): JiraIssue {
  return {
    key: "AIAGENT-1639",
    summary: "Improve marketplace skill creation flow UX",
    issueType: "Story",
    status: "Selected for Development",
    statusCategory: "indeterminate",
    priority: "Medium",
    assignee: "Max.Chadaev",
    updatedMs: 1_700_000_000_000,
    url: "https://example.atlassian.net/browse/AIAGENT-1639",
    description: "",
    ...over,
  };
}

describe("ADF IS A TREE — flattening only the top level loses the steps", () => {
  test("text inside a paragraph comes out", () => {
    expect(flattenAdf({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] }).trim()).toBe("hello");
  });

  test("text nested inside a bullet list comes out — this is where repro steps live", () => {
    const adf = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "open the page" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "click archive" }] }] },
          ],
        },
      ],
    };
    const out = flattenAdf(adf);
    expect(out).toContain("open the page");
    expect(out).toContain("click archive");
  });

  test("a code block survives", () => {
    expect(flattenAdf({ type: "codeBlock", content: [{ type: "text", text: "npm run build" }] })).toContain("npm run build");
  });

  test("null, undefined and junk flatten to nothing rather than throwing", () => {
    expect(flattenAdf(null)).toBe("");
    expect(flattenAdf(undefined)).toBe("");
    expect(flattenAdf(42)).toBe("");
    expect(flattenAdf({ type: "unknownPanel" })).toBe("");
  });
});

describe("REPRODUCTION IS FOUND, NEVER INVENTED", () => {
  test("a steps-to-reproduce section is extracted", () => {
    const steps = reproductionFrom("Some intro.\n\nSteps to reproduce\n1. open it\n2. click archive\n");
    expect(steps).toContain("open it");
    expect(steps).toContain("click archive");
  });

  test("a following section ENDS the steps, so an expected-result is not read as one", () => {
    const steps = reproductionFrom("Repro\n1. do it\n\nExpected\nit works\n");
    expect(steps).toContain("do it");
    expect(steps).not.toContain("it works");
  });

  test("a heading also ends the section", () => {
    const steps = reproductionFrom("## Reproduction\n1. do it\n\n## Notes\nsomething else\n");
    expect(steps).not.toContain("something else");
  });

  test("no reproduction section means UNDEFINED, so intake can refuse the defect", () => {
    // The refusal is the point. A bug with no steps should be declined at the door and appear in
    // the declined list where the person who filed it can see why — not silently accepted with
    // invented steps.
    expect(reproductionFrom("Just a description with no steps at all.")).toBeUndefined();
    expect(reproductionFrom("")).toBeUndefined();
  });

  test("a heading with no body under it is not a reproduction", () => {
    expect(reproductionFrom("Steps to reproduce\n\nExpected\nx")).toBeUndefined();
  });
});

describe("AN ISSUE BECOMES SOMETHING THE ORGANIZATION CAN BE ASKED TO DO", () => {
  test("the source is 'jira' and the id is the key — identity minted the same way as any source", () => {
    const event = issueToEvent(issue());
    expect(event.source).toBe("jira");
    expect(event.externalId).toBe("AIAGENT-1639");
  });

  test("a Bug is a defect; a Story is not", () => {
    expect(issueToEvent(issue({ issueType: "Bug" })).kind).toBe("defect");
    expect(issueToEvent(issue({ issueType: "Story" })).kind).toBeUndefined();
  });

  test("the ticket's URL travels as evidence, so a reviewer can open the original", () => {
    expect(issueToEvent(issue()).evidenceRefs).toEqual(["https://example.atlassian.net/browse/AIAGENT-1639"]);
  });

  test("a defect with steps carries them; one without does not", () => {
    const withSteps = issueToEvent(issue({ issueType: "Bug", description: "Repro\n1. click it\n" }));
    expect(withSteps.reproduction).toContain("click it");
    expect(issueToEvent(issue({ issueType: "Bug", description: "no steps here" })).reproduction).toBeUndefined();
  });

  test("priority maps to severity, and an unknown priority does not guess upward", () => {
    expect(severityOf("Highest")).toBe(Severity.Critical);
    expect(severityOf("High")).toBe(Severity.High);
    expect(severityOf("Low")).toBe(Severity.Low);
    expect(severityOf(undefined)).toBe(Severity.Medium);
    expect(severityOf("Wibble")).toBe(Severity.Medium);
  });
});

describe("THE SEARCH BOX IS UNTRUSTED INPUT", () => {
  test("an issue key becomes a key lookup", () => {
    expect(queryFor("AIAGENT-1639")).toBe("key = AIAGENT-1639");
    expect(queryFor("aiagent-1639")).toBe("key = AIAGENT-1639");
  });

  test("free text becomes a quoted text search", () => {
    expect(queryFor("archival broken")).toBe('text ~ "archival broken" ORDER BY updated DESC');
  });

  test("a quote in the search cannot end the literal and start writing query syntax", () => {
    // Without the escape, `" OR project = SECRET` would leave the string and be read as JQL.
    const jql = queryFor('" OR project = SECRET');
    expect(jql).toContain('\\"');
    expect(jql.startsWith('text ~ "')).toBe(true);
    // Every quote after the opener is escaped, so the literal ends exactly where we put it.
    expect(jql.slice('text ~ "'.length, jql.lastIndexOf('"'))).not.toMatch(/(^|[^\\])"/);
  });

  test("a backslash is escaped too, so it cannot escape our escape", () => {
    expect(queryFor('a\\"b')).toContain('\\\\');
  });

  test("an empty box falls back to a named query rather than searching everything", () => {
    expect(queryFor("   ")).toBe(STANDARD_QUERIES["assigned_open"] ?? "");
  });
});

describe("CREDENTIALS", () => {
  test("a missing file refuses with the path, not with a stack trace", () => {
    const r = readJiraCredentials("./definitely-not-here.json");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain("definitely-not-here.json");
  });
});

describe("A REPRODUCTION IN PROSE IS STILL A REPRODUCTION", () => {
  // Verbatim from ELERA-149570, which carried 1485 characters saying exactly how the fault was
  // produced and was refused as `missing_reproduction` because it used no heading.
  const REAL = [
    "QA identified that SAF-eligible VISA cards do not obtain a local approval when the original",
    "Moneris Authorize & Capture response is not received by the terminal.",
    "",
    "The test uses a controlled relay. The relay forwards the original A&C request to Moneris and",
    "suppresses only its response to the terminal. This reproduces a host-response timeout; it is",
    "not a complete store connectivity outage.",
    "",
    "In both executions, Pay entered the timeout flow and created a timeout reversal plus a queued",
    "Store Stand-In.",
  ].join("\n");

  test("prose that says how the fault was produced is found", () => {
    const got = reproductionFrom(REAL);
    expect(got).toBeDefined();
    expect(got).toContain("controlled relay");
  });

  test("it returns ONLY the paragraphs that carry it, never the whole ticket", () => {
    // Handing a reviewer the entire description as "the reproduction" tells them nothing about
    // which sentences to follow — and would reduce the guard to "does this ticket have text".
    const got = reproductionFrom(REAL) ?? "";
    expect(got).not.toContain("QA identified that SAF-eligible");
    expect(got.length).toBeLessThan(REAL.length);
  });

  test("A COMPLAINT IS STILL REFUSED — the guard must stay able to fire", () => {
    // The case `missing_reproduction` exists for. If this ever returns a value the check has
    // become "has a description", which is a weaker test wearing the same name.
    expect(reproductionFrom("It is broken. Please fix it urgently, customers are affected.")).toBeUndefined();
    expect(reproductionFrom("The archive button does not work and the rows disappear.")).toBeUndefined();
    expect(
      reproductionFrom("Expected: one row.\n\nActual: two rows.\n\nThis is a serious problem."),
    ).toBeUndefined();
  });

  test("a HEADING still wins, and an empty one still refuses rather than falling through", () => {
    // A ticket that announces steps and gives none is worse than one that never claimed any. It
    // must not quietly succeed via the prose path on some other paragraph.
    const withEmptyHeading = "The test uses a controlled relay.\n\nSteps to reproduce\n\nExpected\nx";
    expect(reproductionFrom(withEmptyHeading)).toBeUndefined();
  });

  test("prose and a heading do not both fire — the heading is the answer", () => {
    const both = "The test uses a controlled relay.\n\nSteps to reproduce\n1. open it\n2. click archive\n";
    const got = reproductionFrom(both) ?? "";
    expect(got).toContain("click archive");
    expect(got).not.toContain("controlled relay");
  });

  test("EVERY signal phrase is exercised, so the list cannot rot unnoticed", () => {
    // A named list nothing tests is a list that quietly stops matching. Each of these is a real
    // phrasing a bug report uses instead of a heading; if one is removed from the production list
    // this goes red naming which.
    const phrasings = [
      "To reproduce, run the importer twice against the same file.",
      "This reproduces the host-response timeout every time.",
      "The test uses a controlled relay in front of the host.",
      "We ran the same sale twice with the pinpad detached.",
      "The card was tested against both terminals in sequence.",
      "Two independent VISA cards were tested in the same session.",
      "The steps taken are listed in the attached transcript.",
    ];
    for (const phrasing of phrasings) {
      expect(reproductionFrom(phrasing)).toBe(phrasing);
    }
  });

  test("an empty description is refused, as before", () => {
    expect(reproductionFrom("")).toBeUndefined();
    expect(reproductionFrom("   \n\n  ")).toBeUndefined();
  });
});
