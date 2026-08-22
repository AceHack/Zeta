import { describe, expect, test } from "bun:test";

import {
  main,
  ordinal,
  parsePage,
  parseRegistry,
  PAGE_VARIANTS,
  PUBLISHED_PAGE,
  REGISTRY,
} from "./audit-concept-registry-drift";

/**
 * A registry fragment in the exact shape the real file uses. Note the trailing `### Sources`
 * heading: the parser must stop there, because the real file carries further tables
 * (Addison's own §4 ontology) that are documentation and must NOT be read as registry rows.
 */
const REGISTRY_FIXTURE = `# Concept registry

Preamble prose that is not a table.

## 1. The registry

| Term | Definition | Author | Added | On page |
|---|---|---|---|---|
| Room | an uncertainty engine — not a folder | Addison Cooper | 2026-06-20 | yes |
| Lodge | A federation charter. | Addison Cooper | 2026-07-31 | no |

### Sources for each row

| Term(s) | Source |
|---|---|
| Everything | somewhere else |
`;

const pageConcept = (term: string, definition: string): string =>
  `<details><summary>` +
  `<span style="background:#5EC8C2"></span>` +
  `<span style="font-weight:600">${term}</span>` +
  `<span style="color:#94A0BC">${definition}</span>` +
  `<span class="cx-chev">+</span>` +
  `</summary><div>body</div></details>`;

describe("parseRegistry", () => {
  test("reads term, definition, author, date and published flag", () => {
    const rows = parseRegistry(REGISTRY_FIXTURE);
    expect(rows).toHaveLength(2);
    const [room, lodge] = rows;
    expect(room?.term).toBe("Room");
    expect(room?.definition).toBe("an uncertainty engine — not a folder");
    expect(room?.author).toBe("Addison Cooper");
    expect(room?.added).toBe("2026-06-20");
    expect(room?.onPage).toBe(true);
    expect(lodge?.onPage).toBe(false);
  });

  test("stops at the ### heading so later documentation tables are not read as rows", () => {
    const terms = parseRegistry(REGISTRY_FIXTURE).map((r) => r.term);
    expect(terms).not.toContain("Everything");
  });

  test("refuses an On-page value that is not exactly yes or no", () => {
    const bad = REGISTRY_FIXTURE.replace("| 2026-06-20 | yes |", "| 2026-06-20 | Yes |");
    expect(() => parseRegistry(bad)).toThrow(/must be exactly "yes" or "no"/);
  });

  test("refuses a file with no registry section", () => {
    expect(() => parseRegistry("# nothing here")).toThrow(/no "## 1\. The registry" section/);
  });
});

describe("parsePage", () => {
  test("extracts the term and its one-line definition, ignoring the chevron", () => {
    const html = pageConcept("Vault", "not an app — an institution");
    expect(parsePage(html)).toEqual([{ term: "Vault", definition: "not an app — an institution" }]);
  });

  test("extracts every concept on a multi-concept page", () => {
    const html =
      pageConcept("Agent", "a persistent AI identity") + pageConcept("Hat", "a temporary role");
    expect(parsePage(html).map((c) => c.term)).toEqual(["Agent", "Hat"]);
  });
});

describe("ordinal", () => {
  test("orders by code unit, not by locale", () => {
    expect(ordinal("a", "b")).toBe(-1);
    expect(ordinal("b", "a")).toBe(1);
    expect(ordinal("a", "a")).toBe(0);
    // The case that culture-sensitive collation gets 'wrong' for our purposes: uppercase
    // sorts before lowercase under ordinal. Pinned so nobody 'fixes' it to localeCompare.
    expect(ordinal("Z", "a")).toBe(-1);
  });
});

describe("the audit against the real repository", () => {
  test("passes — registry and published page agree today", () => {
    expect(main()).toBe(0);
  });

  test("names the surfaces it guards", () => {
    expect(REGISTRY).toBe("docs/CONCEPT-REGISTRY.md");
    expect(PUBLISHED_PAGE).toBe("docs/design/root-site-iris/site/concepts.html");
    expect(PAGE_VARIANTS.length).toBeGreaterThan(0);
  });
});
