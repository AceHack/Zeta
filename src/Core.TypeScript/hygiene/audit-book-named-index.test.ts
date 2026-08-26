// audit-book-named-index.test.ts — PROVE THE COVERAGE AUDIT CAN FAIL.
//
// The index is only worth having if the under-report is caught, so this file is the
// real deliverable of the pair. Every negative case is a MUTATION of a positive
// control asserted green in the same test: add the unmarked mention, show red;
// remove it, show green. A negative that passes because an earlier guard fired on a
// broken fixture proves nothing.
//
// The last describe block is deliberately a test of what this audit CANNOT do. It
// pins the gap so nobody later reads silence as coverage.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BOOK_DIR } from "./book-consent-spans.ts";
import { buildSnapshot, renderSnapshotJson, renderSnapshotMarkdown } from "./book-named-index.ts";
import {
  ADVISORY_CODES,
  checkParserConformance,
  COUNTERPART,
  type FindingCode,
  main,
  PUBLISH_ONLY_CODES,
  type Report,
  verify,
} from "./audit-book-named-index.ts";

// ---------------------------------------------------------------------------
// Fixture scaffolding
// ---------------------------------------------------------------------------

const roots: string[] = [];
let savedRoot: string | undefined;

function fixture(files: Record<string, string>, opts: { materialize?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-index-audit-"));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body, "utf8");
  }
  if (savedRoot === undefined) savedRoot = process.env["REPO_ROOT"] ?? "";
  process.env["REPO_ROOT"] = root;
  // Start every fixture with the derived artifacts CURRENT, so an INDEX_STALE
  // finding can never be the reason a coverage mutation looks red. Skipped only
  // where the fixture is DELIBERATELY malformed and generating would throw first.
  if (opts.materialize !== false) materialize(root);
  return root;
}

function materialize(root: string): void {
  const snap = buildSnapshot();
  writeFileSync(join(root, BOOK_DIR, "named-index.json"), renderSnapshotJson(snap), "utf8");
  writeFileSync(join(root, BOOK_DIR, "NAMED-INDEX.md"), renderSnapshotMarkdown(snap), "utf8");
}

afterEach(() => {
  if (savedRoot === "" || savedRoot === undefined) delete process.env["REPO_ROOT"];
  else process.env["REPO_ROOT"] = savedRoot;
  savedRoot = undefined;
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function roster(people: unknown[], events: unknown[] = []): string {
  return `${JSON.stringify({ schemaVersion: 1, people, events }, null, 2)}\n`;
}

function codes(r: Report): FindingCode[] {
  return r.findings.map((f) => f.code);
}

function fails(r: Report): FindingCode[] {
  return r.findings.filter((f) => f.severity === "fail").map((f) => f.code);
}

const JORDAN = { person: "Jordan Rivera", aliases: ["Jordan Rivera", "Jordan"] };

const MARKED = [
  "# Chapter one",
  "",
  '<!-- consent:begin id=jordan-door person="Jordan Rivera" -->',
  "Jordan Rivera held the door.",
  "<!-- consent:end id=jordan-door -->",
  "",
].join("\n");

// ---------------------------------------------------------------------------
// THE LOAD-BEARING CASE — an unmarked appearance
// ---------------------------------------------------------------------------

describe("UNMARKED_APPEARANCE — the under-report the whole mechanism exists to catch", () => {
  test("marked-only is green; adding ONE unmarked mention is red; removing it is green again", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: MARKED,
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });

    // POSITIVE CONTROL — the appearance is marked, so the index sees it.
    const green = verify();
    expect(fails(green)).toEqual([]);
    expect(green.markedAppearances).toBe(1);
    expect(green.unmarkedAppearances).toBe(0);

    // MUTATION — one sentence, outside every span.
    const ch2 = join(root, BOOK_DIR, "ch-02.md");
    writeFileSync(ch2, "# Chapter two\n\nYears later Jordan Rivera called it a mistake.\n", "utf8");
    materialize(root); // regenerate the index so ONLY the coverage gap can be red
    const red = verify();
    expect(fails(red)).toEqual(["UNMARKED_APPEARANCE"]);
    expect(red.unmarkedAppearances).toBe(1);
    expect(red.findings[0]?.detail).toContain("ch-02.md:3");
    expect(red.findings[0]?.detail).toContain("Jordan Rivera");

    // REVERT — and the finding is gone.
    rmSync(ch2);
    materialize(root);
    expect(fails(verify())).toEqual([]);
  });

  test("the CLI exits 1 on it, and 0 without it", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: MARKED,
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    const box = { out: "", err: "" };
    const sink = { out: (s: string) => (box.out += s), err: (s: string) => (box.err += s) };
    expect(main([], sink)).resolves.toBe(0);

    writeFileSync(join(root, BOOK_DIR, "ch-02.md"), "Jordan Rivera again.\n", "utf8");
    materialize(root);
    return main([], sink).then((code) => {
      expect(code).toBe(1);
      expect(box.out).toContain("UNMARKED_APPEARANCE");
    });
  });

  test("a mention INSIDE a span is not reported — otherwise every marked passage would fire", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: MARKED,
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    const r = verify();
    expect(codes(r)).not.toContain("UNMARKED_APPEARANCE");
    expect(r.markedAppearances).toBeGreaterThan(0); // the scan DID see it — it is not silent
  });

  test("a mention in a RAW file counts — book material is not machinery", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: MARKED,
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    writeFileSync(join(root, BOOK_DIR, "RAW-2026-01-01-something.md"), "Jordan Rivera said so.\n", "utf8");
    materialize(root);
    expect(fails(verify())).toEqual(["UNMARKED_APPEARANCE"]);
  });
});

// ---------------------------------------------------------------------------
// role-only / pending — the CONTENT constraint, not just a flag
// ---------------------------------------------------------------------------

describe("NAME_LEAK — role-only and pending are enforced on the text", () => {
  test("a pending subject named anywhere is a failure, and marking the passage does NOT fix it", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: "# Chapter\n\nA colleague taught me to ask rather than infer.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([{ ...JORDAN, indexState: "pending" }]),
    });
    expect(fails(verify())).toEqual([]); // POSITIVE CONTROL: not named, so nothing fires

    // MUTATION A — named in ordinary prose.
    writeFileSync(join(root, BOOK_DIR, "ch-01.md"), "# Chapter\n\nJordan Rivera taught me to ask.\n", "utf8");
    materialize(root);
    expect(fails(verify())).toEqual(["NAME_LEAK"]);

    // MUTATION B — named INSIDE a consent span. A marker is not permission: the
    // subject has not answered, so the constraint is on the CONTENT.
    writeFileSync(join(root, BOOK_DIR, "ch-01.md"), MARKED, "utf8");
    materialize(root);
    const marked = verify();
    expect(fails(marked)).toEqual(["NAME_LEAK"]);
    expect(marked.findings[0]?.detail).toContain("inside span");
  });

  test("role-only and pending enforce the IDENTICAL constraint — pending is not the weaker one", () => {
    const files = (state: string): Record<string, string> => ({
      [`${BOOK_DIR}/ch-01.md`]: "Jordan Rivera was there.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([{ ...JORDAN, indexState: state }]),
    });
    fixture(files("role-only"));
    const a = fails(verify());
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
    fixture(files("pending"));
    const b = fails(verify());
    expect(a).toEqual(["NAME_LEAK"]);
    expect(b).toEqual(a);
  });

  test("a role PHRASE declared as an alias is caught — the only reach this audit has past names", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: "She was my UX-research mentor at the time.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([
        { person: "A Private Individual", aliases: ["UX-research mentor"], indexState: "role-only" },
      ]),
    });
    expect(fails(verify())).toEqual(["NAME_LEAK"]);
  });
});

// ---------------------------------------------------------------------------
// REVOKED — derived from #15619's event fold, gated at publish
// ---------------------------------------------------------------------------

describe("REVOKED_APPEARANCE", () => {
  const revokedRoster = roster(
    [JORDAN],
    [
      {
        eventId: "revoke-1",
        type: "revoke",
        person: "Jordan Rivera",
        scope: "naming",
        spanId: "*",
        artifact: { kind: "relayed" },
        phase: "2026-08-26T10:00:00Z",
      },
    ],
  );

  test("advisory at repo tier, FAILING under --publish", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: MARKED,
      [`${BOOK_DIR}/consent-events.json`]: revokedRoster,
    });
    const repo = verify();
    expect(codes(repo)).toContain("REVOKED_APPEARANCE");
    expect(fails(repo)).toEqual([]);

    const pub = verify({ publish: true });
    expect(fails(pub)).toEqual(["REVOKED_APPEARANCE"]);
  });

  test("without the revoke event the same corpus is clean — the finding tracks the fold, not the text", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: MARKED,
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    expect(codes(verify({ publish: true }))).not.toContain("REVOKED_APPEARANCE");
  });
});

// ---------------------------------------------------------------------------
// INDEX_STALE — derived, never hand-maintained
// ---------------------------------------------------------------------------

describe("INDEX_STALE", () => {
  test("a hand-edited NAMED-INDEX.md fails at repo tier", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: MARKED,
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    expect(fails(verify())).toEqual([]); // POSITIVE CONTROL

    const md = join(root, BOOK_DIR, "NAMED-INDEX.md");
    writeFileSync(md, readFileSync(md, "utf8").replace("Jordan Rivera", "Someone Else"), "utf8");
    expect(fails(verify())).toEqual(["INDEX_STALE"]);
  });

  test("prose moving under a committed index is the same defect through the other door", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: MARKED,
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    writeFileSync(join(root, BOOK_DIR, "ch-01.md"), MARKED.replace("held the door.", "held the door,"), "utf8");
    // Both derived artifacts drifted, so both are named. Two facts, two findings.
    expect(fails(verify())).toEqual(["INDEX_STALE", "INDEX_STALE"]);
  });
});

// ---------------------------------------------------------------------------
// The audit reporting its OWN weaknesses
// ---------------------------------------------------------------------------

describe("advisories — the audit says where it is blind", () => {
  test("NO_ALIASES_DECLARED fires, and the same fixture proves WHY it matters", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: "Jordan Rivera is all over this chapter, unmarked.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "Jordan Rivera", aliases: [] }]),
    });
    const r = verify();
    // Zero aliases: the unmarked mention is INVISIBLE to the scan...
    expect(codes(r)).not.toContain("UNMARKED_APPEARANCE");
    // ...and the advisory is the only thing standing between that and a false green.
    expect(codes(r)).toContain("NO_ALIASES_DECLARED");
    expect(fails(r)).toEqual([]);
  });

  test("ROSTER_EMPTY reports a count, not a clearance", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: "Jordan Rivera, Sam Okafor, everybody.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([]),
    });
    const r = verify();
    expect(codes(r)).toEqual(["ROSTER_EMPTY"]);
    expect(fails(r)).toEqual([]);
    expect(r.findings[0]?.detail).toContain("COUNT, NOT A CLEARANCE");
  });

  test("the tier sets are disjoint and every code is classified exactly once", () => {
    const all: FindingCode[] = [
      "UNMARKED_APPEARANCE",
      "NAME_LEAK",
      "REVOKED_APPEARANCE",
      "INDEX_STALE",
      "NO_ALIASES_DECLARED",
      "ROSTER_EMPTY",
    ];
    for (const c of all) expect(!(PUBLISH_ONLY_CODES.has(c) && ADVISORY_CODES.has(c))).toBe(true);
    expect([...PUBLISH_ONLY_CODES]).toEqual(["REVOKED_APPEARANCE"]);
    expect([...ADVISORY_CODES].sort()).toEqual(["NO_ALIASES_DECLARED", "ROSTER_EMPTY"]);
  });
});

// ---------------------------------------------------------------------------
// Matching discipline — over-report rather than under-report, but not blindly
// ---------------------------------------------------------------------------

describe("alias matching", () => {
  test("word boundaries hold: `Jordan` does not match inside `Jordanian`, but `Jordan,` does", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: "# Chapter\n\nA Jordanian passport and a jordanite mineral.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    expect(fails(verify())).toEqual([]); // POSITIVE CONTROL: no false hit

    writeFileSync(join(root, BOOK_DIR, "ch-01.md"), "# Chapter\n\nAnd Jordan, of course, was there.\n", "utf8");
    materialize(root);
    expect(fails(verify())).toEqual(["UNMARKED_APPEARANCE"]); // the real one IS caught
  });

  test("matching is case-insensitive — the safer direction is over-reporting", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: "# Chapter\n\njordan rivera, lowercase, still them.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    expect(fails(verify())).toEqual(["UNMARKED_APPEARANCE"]);
  });

  test("one finding per line even when several aliases match it", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: "# Chapter\n\nJordan Rivera — Jordan to everyone else.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    expect(fails(verify())).toEqual(["UNMARKED_APPEARANCE"]);
  });

  test("a name inside a fenced example is not an appearance, but the same name outside one is", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: "# Chapter\n\n```text\nJordan Rivera in an example\n```\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    expect(fails(verify())).toEqual([]); // POSITIVE CONTROL: an example is not an assertion

    writeFileSync(
      join(root, BOOK_DIR, "ch-01.md"),
      "# Chapter\n\n```text\nJordan Rivera in an example\n```\n\nAnd Jordan Rivera in the prose.\n",
      "utf8",
    );
    materialize(root);
    const r = verify();
    expect(fails(r)).toEqual(["UNMARKED_APPEARANCE"]);
    expect(r.findings[0]?.detail).toContain(":7"); // the PROSE line, not the fenced one
  });

  test("an alias containing regex metacharacters is matched literally", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: "# Chapter\n\nWe called him A.C. back then.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "A.C.", aliases: ["A.C."] }]),
    });
    expect(fails(verify())).toEqual(["UNMARKED_APPEARANCE"]);
  });

  test("book machinery is skipped: the same name in CONSENT-LEDGER.md is not an appearance", () => {
    const root = fixture({
      [`${BOOK_DIR}/CONSENT-LEDGER.md`]: "| Jordan Rivera | friend | GRANTED |\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
    });
    const clean = verify();
    expect(fails(clean)).toEqual([]);
    expect(clean.filesExcluded.some((f) => f.endsWith("CONSENT-LEDGER.md"))).toBe(true);

    // CONTROL: the same string in a chapter IS an appearance, so the skip is a
    // property of the file, not of the matcher failing.
    writeFileSync(join(root, BOOK_DIR, "ch-01.md"), "| Jordan Rivera | friend | GRANTED |\n", "utf8");
    materialize(root);
    expect(fails(verify())).toEqual(["UNMARKED_APPEARANCE"]);
  });
});

// ---------------------------------------------------------------------------
// Configuration errors are exit 2, never a green
// ---------------------------------------------------------------------------

describe("refusals", () => {
  test("a missing roster is a configuration error, not 'no findings'", async () => {
    fixture({ [`${BOOK_DIR}/ch-01.md`]: MARKED, [`${BOOK_DIR}/consent-events.json`]: roster([]) });
    rmSync(join(roots[roots.length - 1] as string, BOOK_DIR, "consent-events.json"));
    const box = { out: "", err: "" };
    const code = await main([], { out: (s) => (box.out += s), err: (s) => (box.err += s) });
    expect(code).toBe(2);
    expect(box.err).toContain("check that never ran");
  });

  test("a malformed span is a configuration error, not a silent skip", async () => {
    fixture(
      {
        [`${BOOK_DIR}/ch-01.md`]: '<!-- consent:begin id=unclosed person="Jordan Rivera" -->\nbody\n',
        [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
      },
      { materialize: false },
    );
    const box = { out: "", err: "" };
    const code = await main([], { out: (s) => (box.out += s), err: (s) => (box.err += s) });
    expect(code).toBe(2);
    expect(box.err).toContain("never closed");
  });
});

// ---------------------------------------------------------------------------
// Parser conformance with #15619
// ---------------------------------------------------------------------------

describe("--parser-conformance", () => {
  const CORPUS = {
    [`${BOOK_DIR}/ch-01.md`]: MARKED,
    [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]),
  };

  test("an ABSENT counterpart is exit 3 — UNCHECKED, and never 0", async () => {
    fixture(CORPUS);
    const res = await checkParserConformance("src/Core.TypeScript/hygiene/does-not-exist.ts");
    expect(res.code).toBe(3);
    expect(res.message).toContain("UNCHECKED");
  });

  test("a counterpart that AGREES is exit 0", async () => {
    const root = fixture(CORPUS);
    const fake = join(root, "fake-agree.ts");
    writeFileSync(
      fake,
      'import { collectSpans as real } from "@shared";\nexport function collectSpans(d: readonly string[]) { return real(d); }\n'.replace(
        "@shared",
        new URL("./book-consent-spans.ts", import.meta.url).pathname,
      ),
      "utf8",
    );
    const res = await checkParserConformance("fake-agree.ts");
    expect(res.code).toBe(0);
    expect(res.message).toContain("agree");
  });

  test("a counterpart that DISAGREES on one hash is exit 1", async () => {
    const root = fixture(CORPUS);
    const fake = join(root, "fake-disagree.ts");
    writeFileSync(
      fake,
      'import { collectSpans as real } from "@shared";\n' +
        "export function collectSpans(d: readonly string[]) {\n" +
        "  const { spans } = real(d);\n" +
        "  for (const s of spans.values()) s.sha256 = `${s.sha256.slice(0, 63)}0`;\n" +
        "  return { spans };\n" +
        "}\n",
      "utf8",
    );
    writeFileSync(
      fake,
      readFileSync(fake, "utf8").replace("@shared", new URL("./book-consent-spans.ts", import.meta.url).pathname),
      "utf8",
    );
    const res = await checkParserConformance("fake-disagree.ts");
    expect(res.code).toBe(1);
    expect(res.message).toContain("DISAGREE");
  });

  test("a counterpart exporting no collectSpans is exit 1, not a pass", async () => {
    const root = fixture(CORPUS);
    writeFileSync(join(root, "fake-empty.ts"), "export const nothing = 1;\n", "utf8");
    const res = await checkParserConformance("fake-empty.ts");
    expect(res.code).toBe(1);
  });

  test("the counterpart path names the file PR #15619 ships", () => {
    expect(COUNTERPART).toBe("src/Core.TypeScript/hygiene/audit-consent-signoff.ts");
  });
});

// ---------------------------------------------------------------------------
// WHAT THIS AUDIT CANNOT DO — pinned, so silence is never read as coverage
// ---------------------------------------------------------------------------

describe("the stated gap: identifiable without being named", () => {
  test("a precise, unmistakable description containing no declared alias is NOT caught", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]:
        "# Chapter\n\nMy co-founder from the 2007 company, the one who later went into medical imaging, still calls.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([{ ...JORDAN, indexState: "role-only" }]),
    });
    const r = verify();
    // This is a REAL gap, asserted rather than hidden. A reader who knows the subject
    // identifies them from that sentence; the audit sees no alias and says nothing.
    expect(fails(r)).toEqual([]);
    expect(r.unmarkedAppearances).toBe(0);
  });

  test("declaring the descriptor as an alias closes THAT instance — and only that one", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]:
        "# Chapter\n\nMy co-founder from the 2007 company, the one who later went into medical imaging, still calls.\n",
      [`${BOOK_DIR}/consent-events.json`]: roster([
        { person: "Jordan Rivera", aliases: ["co-founder from the 2007 company"], indexState: "role-only" },
      ]),
    });
    expect(fails(verify())).toEqual(["NAME_LEAK"]);
    // The mitigation is real and it is not general: it caught this phrasing because a
    // human wrote this phrasing down. A paraphrase escapes it again.
  });

  test("the report SAYS the gap out loud on every run", async () => {
    fixture({ [`${BOOK_DIR}/ch-01.md`]: MARKED, [`${BOOK_DIR}/consent-events.json`]: roster([JORDAN]) });
    const box = { out: "", err: "" };
    await main([], { out: (s) => (box.out += s), err: (s) => (box.err += s) });
    expect(box.out).toContain("NOT CHECKED: a person described identifiably but not named");
  });
});
