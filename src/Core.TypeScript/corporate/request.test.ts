/**
 * request.test.ts — the spine, and the two ways it can quietly lie.
 *
 * A request key is an IDENTITY. The two failures that matter are a key that resolves to the wrong
 * source (so work is attributed to a system that never asked for it), and a link invented from a
 * source name (so a page sends somebody to somebody else's tracker). Both are silent, and both look
 * like the feature working.
 */

import { describe, expect, test } from "bun:test";

import {
  parseRequestRef,
  parseShorthand,
  requestLabel,
  requestTitle,
  requestUrl,
  sourceLabel,
} from "./request";
import { externalRefOf } from "./intake";

describe("A KEY ROUND-TRIPS, or it does not resolve at all", () => {
  test("what intake minted is what comes back", () => {
    const ref = parseRequestRef(externalRefOf("jira", "AIAGENT-1637"));
    expect(ref?.source).toBe("jira");
    expect(ref?.externalId).toBe("AIAGENT-1637");
  });

  test("ANY source round-trips — the scheme knows nothing about Jira", () => {
    // The whole point. A directory drop, a webhook and a row in someone's spreadsheet are peers.
    for (const [source, id] of [
      ["directory", "2026-09-08-outage.md"],
      ["github", "412"],
      ["alerts", "pagerduty/PD-99"],
      ["service_now", "INC0012345"],
    ] as const) {
      const ref = parseRequestRef(externalRefOf(source, id));
      expect(ref?.source).toBe(source);
      expect(ref?.externalId).toBe(id);
    }
  });

  test("a delimiter INSIDE a source or an id cannot forge another key", () => {
    // This is why the format is length-prefixed rather than `source|id`. Without the lengths, a
    // source called "a|b" and a source called "a" with an id starting "b|" produce the same string,
    // and two systems' work merges under one heading.
    const a = externalRefOf("a|b", "1");
    const b = externalRefOf("a", "b|1");
    expect(a).not.toBe(b);
    expect(parseRequestRef(a)?.source).toBe("a|b");
    expect(parseRequestRef(b)?.source).toBe("a");
  });

  test("a key whose declared length disagrees is REFUSED, not coerced", () => {
    // Accepting it would let `4:jira|…` and a renamed source collide, which merges two systems'
    // work under one request silently.
    expect(parseRequestRef("9:jira|12:AIAGENT-1637")).toBeUndefined();
    expect(parseRequestRef("4:jira|99:AIAGENT-1637")).toBeUndefined();
  });

  test("A WRONG SEPARATOR IS REFUSED — the bar is checked, not assumed", () => {
    // `4:jira/12:AIAGENT-1637` parses its source and its id perfectly well; only the byte between
    // them is wrong. Without that check the key resolves, and a key built by something else becomes
    // a request this organization claims to be working on.
    expect(parseRequestRef("4:jira/12:AIAGENT-1637")).toBeUndefined();
    // AND THE DISCRIMINATING CASE: a bar somewhere ELSE in the key. The first assertion above passes
    // even for an implementation that only checks "is there a bar anywhere" — this one does not,
    // because here there is one, just not between the source and the id.
    expect(parseRequestRef("4:jira/12:AIAGENT|1637")).toBeUndefined();
  });

  test("TRAILING BYTES ARE REFUSED, or two keys resolve to one request", () => {
    expect(parseRequestRef(`${externalRefOf("jira", "AIAGENT-1637")}X`)).toBeUndefined();
    expect(parseRequestRef(`${externalRefOf("jira", "AIAGENT-1637")}|extra`)).toBeUndefined();
  });

  test("a key from another scheme returns undefined rather than a guess", () => {
    // A guessed source attributes work to a system that never asked for it.
    expect(parseRequestRef("jira/AIAGENT-1637")).toBeUndefined();
    expect(parseRequestRef("")).toBeUndefined();
    expect(parseRequestRef("nonsense")).toBeUndefined();
    expect(parseRequestRef("0:|0:")).toBeUndefined();
  });
});

describe("LINKS ARE SUPPLIED, NEVER GUESSED", () => {
  const ref = parseRequestRef(externalRefOf("jira", "AIAGENT-1637"))!;

  test("a configured source gets a link", () => {
    expect(requestUrl(ref, { jira: "https://x.atlassian.net/browse/{id}" }))
      .toBe("https://x.atlassian.net/browse/AIAGENT-1637");
  });

  test("AN UNCONFIGURED SOURCE GETS NOTHING", () => {
    // The default state of every install. A link invented from the word "jira" points at somebody
    // else's tenant, and a page that produces plausible wrong links is worse than one with none.
    expect(requestUrl(ref, {})).toBeUndefined();
    expect(requestUrl(ref, { github: "https://gh/{id}" })).toBeUndefined();
  });

  test("a template with no {id} is refused rather than linking to the index", () => {
    expect(requestUrl(ref, { jira: "https://x.atlassian.net/browse" })).toBeUndefined();
  });

  test("an id that would break a URL is encoded", () => {
    const odd = parseRequestRef(externalRefOf("directory", "2026 outage/report.md"))!;
    const url = requestUrl(odd, { directory: "https://x/{id}" });
    expect(url).toContain("2026%20outage%2Freport.md");
  });
});

describe("names read like names, for a source nobody has listed", () => {
  test("known sources get their real capitalisation", () => {
    expect(sourceLabel("jira")).toBe("Jira");
    expect(sourceLabel("github")).toBe("GitHub");
    expect(sourceLabel("JIRA")).toBe("Jira");
  });

  test("AN UNKNOWN SOURCE STILL READS — a new adapter needs no change here", () => {
    expect(sourceLabel("service_now")).toBe("Service Now");
    expect(sourceLabel("customer_portal")).toBe("Customer Portal");
  });

  test("the label a person pastes into a search box is the id alone", () => {
    const ref = parseRequestRef(externalRefOf("jira", "AIAGENT-1637"))!;
    expect(requestLabel(ref)).toBe("AIAGENT-1637");
    expect(requestTitle(ref)).toBe("Jira AIAGENT-1637");
  });
});

describe("shorthand is INPUT, never identity", () => {
  test("what somebody types resolves to a source and an id", () => {
    expect(parseShorthand("jira:AIAGENT-1637")).toEqual({ source: "jira", externalId: "AIAGENT-1637" });
    expect(parseShorthand("GITHUB: 412 ")).toEqual({ source: "github", externalId: "412" });
  });

  test("an id containing a colon keeps everything after the first one", () => {
    expect(parseShorthand("alerts:pagerduty:PD-99")?.externalId).toBe("pagerduty:PD-99");
  });

  test("nonsense is refused, so a typo cannot mint a second request", () => {
    // Only `externalRefOf` mints identity. If this returned something for "AIAGENT-1637" it would
    // create a source called "" and a request nothing else can find.
    expect(parseShorthand("AIAGENT-1637")).toBeUndefined();
    expect(parseShorthand(":1")).toBeUndefined();
    expect(parseShorthand("jira:")).toBeUndefined();
  });
});
