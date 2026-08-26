// book-named-index.test.ts — falsifiers for the derived index.
//
// Every negative case below is a MUTATION of a positive control that is asserted
// green in the same test. A negative test that passes because an earlier guard fired
// on a broken fixture proves nothing, and that has bitten this repo twice
// (`memory/a-test-can-pass-because-an-EARLIER-guard-fired-only-mutation-finds-it.md`).

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BOOK_DIR,
  canonicalizePassage,
  extractSpans,
  footprintOf,
  hashPassage,
  MACHINERY_BASENAMES,
  parseRoster,
  RosterError,
  type SpanRecord,
} from "./book-consent-spans.ts";
import {
  buildSnapshot,
  computeDelta,
  deriveRevoked,
  type IndexSnapshot,
  main,
  renderSnapshotJson,
  suggestRoster,
} from "./book-named-index.ts";

// ---------------------------------------------------------------------------
// Fixture scaffolding
// ---------------------------------------------------------------------------

const roots: string[] = [];
let savedRoot: string | undefined;

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-named-index-"));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body, "utf8");
  }
  // Saved ONCE per test, not per call: a test that builds two fixtures must restore
  // the process env to what it was before the FIRST one, never to a tmpdir that
  // afterEach is about to delete. A leaked REPO_ROOT pointing at a removed directory
  // breaks the next test FILE in the same bun process, which is a failure that looks
  // like it belongs to someone else's code.
  if (savedRoot === undefined) savedRoot = process.env["REPO_ROOT"] ?? "";
  process.env["REPO_ROOT"] = root;
  return root;
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

function io(): { out: string; err: string; sink: { out: (s: string) => void; err: (s: string) => void } } {
  const box = { out: "", err: "" };
  return {
    get out() {
      return box.out;
    },
    get err() {
      return box.err;
    },
    sink: {
      out: (s: string) => {
        box.out += s;
      },
      err: (s: string) => {
        box.err += s;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// GOLDEN VECTORS — the byte-lock that keeps two parsers honest
// ---------------------------------------------------------------------------

interface GoldenDoc {
  vectors: {
    name: string;
    markdownUtf8Hex: string;
    spans: {
      spanId: string;
      person: string;
      mode: string;
      beginLine: number;
      endLine: number;
      canonicalUtf8Hex: string;
      sha256: string;
    }[];
  }[];
  footprintFold: {
    emptyFootprintSha256: string;
    twoMemberFootprint: { members: [string, string][]; sha256: string };
    orderIsOrdinalNotInsertion: { sha256: string };
  };
}

const golden = JSON.parse(
  readFileSync(new URL("./book-consent-spans.golden.json", import.meta.url), "utf8"),
) as GoldenDoc;

describe("golden vectors — hex-in-JSON, no binary in the proof lineage", () => {
  test("every vector replays to the byte-locked canonical form and sha256", () => {
    expect(golden.vectors.length).toBeGreaterThan(0);
    for (const v of golden.vectors) {
      const markdown = Buffer.from(v.markdownUtf8Hex, "hex").toString("utf8");
      const spans = extractSpans(markdown, `fixture/${v.name}.md`);
      expect(spans.map((s) => s.spanId)).toEqual(v.spans.map((s) => s.spanId));
      for (let i = 0; i < v.spans.length; i += 1) {
        const want = v.spans[i] as GoldenDoc["vectors"][number]["spans"][number];
        const got = spans[i] as SpanRecord;
        expect(Buffer.from(got.text, "utf8").toString("hex")).toBe(want.canonicalUtf8Hex);
        expect(got.sha256).toBe(want.sha256);
        expect(got.person).toBe(want.person);
        expect(got.mode as string).toBe(want.mode);
        expect(got.beginLine).toBe(want.beginLine);
        expect(got.endLine).toBe(want.endLine);
      }
    }
  });

  test("the cross-implementation anchor is the example printed in CONSENT-SIGNOFF-DESIGN.md", () => {
    // This vector is derivable from PR #15619's published design text alone, which is
    // what makes it an anchor rather than a self-portrait: it constrains BOTH parsers.
    const v = golden.vectors.find((x) => x.name === "consent-signoff-design-section-4-example");
    expect(v).toBeDefined();
    const md = Buffer.from((v as GoldenDoc["vectors"][number]).markdownUtf8Hex, "hex").toString("utf8");
    expect(md).toContain('consent:begin id=chris-readers-disease person="Chris King"');
    expect(md).toContain("reader's disease");
  });

  test("a ONE-CHARACTER edit changes the passage hash", () => {
    const base = canonicalizePassage(["Jordan Rivera held the door."]);
    const edited = canonicalizePassage(["Jordan Rivera held the door,"]);
    expect(base).not.toBe(edited);
    expect(hashPassage(base)).not.toBe(hashPassage(edited));
  });

  test("canonicalization absorbs CRLF and trailing whitespace and NOTHING else", () => {
    const noisy = canonicalizePassage(["", "  Jordan Rivera held the door.   \r", "\t", "  And then let it close.\t"]);
    const clean = canonicalizePassage(["  Jordan Rivera held the door.", "", "  And then let it close."]);
    expect(noisy).toBe(clean);
    // LEADING whitespace is content, not noise: it survives.
    expect(clean.startsWith("  Jordan")).toBe(true);
  });

  test("the footprint fold is ordinal by spanId, not insertion order", () => {
    const spanA: SpanRecord = {
      spanId: "alpha-span",
      person: "P",
      mode: "named",
      file: "a.md",
      beginLine: 1,
      endLine: 3,
      text: "a\n",
      sha256: golden.footprintFold.twoMemberFootprint.members[0]?.[1] as string,
    };
    const spanB: SpanRecord = { ...spanA, spanId: "beta-span", sha256: golden.footprintFold.twoMemberFootprint.members[1]?.[1] as string };
    const forward = footprintOf("P", new Map([["alpha-span", spanA], ["beta-span", spanB]]));
    const reverse = footprintOf("P", new Map([["beta-span", spanB], ["alpha-span", spanA]]));
    expect(forward.sha256).toBe(reverse.sha256);
    expect(forward.sha256).toBe(golden.footprintFold.twoMemberFootprint.sha256);
    expect(golden.footprintFold.orderIsOrdinalNotInsertion.sha256).toBe(
      golden.footprintFold.twoMemberFootprint.sha256,
    );
    // Control: the fold is not constant — a different member set folds differently.
    expect(footprintOf("P", new Map([["alpha-span", spanA]])).sha256).not.toBe(forward.sha256);
    expect(footprintOf("nobody", new Map()).sha256).toBe(golden.footprintFold.emptyFootprintSha256);
  });
});

// ---------------------------------------------------------------------------
// Roster parsing — the extension to #15619's schema
// ---------------------------------------------------------------------------

describe("roster — indexState extends #15619's person record", () => {
  test("indexState absent means `named`, the STRICTER reading", () => {
    const { people } = parseRoster(roster([{ person: "P", aliases: ["P"] }]), "t.json");
    expect(people.get("P")?.indexState).toBe("named");
  });

  test("the three declarable states parse", () => {
    for (const s of ["named", "role-only", "pending"]) {
      const { people } = parseRoster(roster([{ person: "P", aliases: [], indexState: s }]), "t.json");
      expect(people.get("P")?.indexState).toBe(s as "named");
    }
  });

  test("`revoked` may NOT be declared — it is derived, and a state that can disagree with itself is a bug", () => {
    expect(() => parseRoster(roster([{ person: "P", aliases: [], indexState: "revoked" }]), "t.json")).toThrow(
      RosterError,
    );
  });

  test("an unknown indexState is refused rather than defaulted", () => {
    expect(() => parseRoster(roster([{ person: "P", aliases: [], indexState: "probably-fine" }]), "t.json")).toThrow(
      RosterError,
    );
  });

  test("#15619's own field set still parses unchanged — the extension is additive", () => {
    const { people } = parseRoster(
      roster([{ person: "Chris King", githubLogin: "chrisking", githubUserId: 4242, aliases: ["Chris King"] }]),
      "t.json",
    );
    const p = people.get("Chris King");
    expect(p?.githubLogin).toBe("chrisking");
    expect(p?.githubUserId).toBe(4242);
    expect(p?.indexState).toBe("named");
  });
});

describe("revoked is derived from the consent event fold", () => {
  test("a revoke with no surviving grant makes the person revoked", () => {
    expect([...deriveRevoked([{ person: "P", type: "revoke" }])]).toEqual(["P"]);
  });

  test("a grant anywhere for that person keeps them out of the person-level rollup", () => {
    // The documented limit: this rollup is coarse ON PURPOSE. A partial revoke is
    // #15619's per-span business, and claiming finer resolution here would be worse
    // than claiming none.
    expect([...deriveRevoked([{ person: "P", type: "grant" }, { person: "P", type: "revoke" }])]).toEqual([]);
  });

  test("no events means nobody is revoked", () => {
    expect([...deriveRevoked([])]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The snapshot — derived, deterministic, no clock
// ---------------------------------------------------------------------------

const CHAPTER = [
  "# Chapter",
  "",
  '<!-- consent:begin id=jordan-door person="Jordan Rivera" -->',
  "Jordan Rivera held the door.",
  "<!-- consent:end id=jordan-door -->",
  "",
].join("\n");

describe("snapshot", () => {
  test("regenerating twice is byte-identical — nothing reads a clock", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER,
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "Jordan Rivera", aliases: ["Jordan Rivera"] }]),
    });
    const a = renderSnapshotJson(buildSnapshot());
    const b = renderSnapshotJson(buildSnapshot());
    expect(a).toBe(b);
    expect(a).not.toContain("202"); // no year-shaped timestamp anywhere in the bytes
  });

  test("an entry lists every marked appearance and folds them into one footprint hash", () => {
    fixture({
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER,
      [`${BOOK_DIR}/ch-02.md`]: [
        '<!-- consent:begin id=jordan-later person="Jordan Rivera" -->',
        "Later, Jordan Rivera let it close.",
        "<!-- consent:end id=jordan-later -->",
        "",
      ].join("\n"),
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "Jordan Rivera", aliases: ["Jordan Rivera"] }]),
    });
    const snap = buildSnapshot();
    expect(snap.people).toHaveLength(1);
    const e = snap.people[0] as IndexSnapshot["people"][number];
    expect(e.appearances.map((a) => a.spanId)).toEqual(["jordan-door", "jordan-later"]);
    expect(e.footprintSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(e.aliasCount).toBe(1);
  });

  test("editing one passage changes the footprint hash — that is what makes re-consent detectable", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER,
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "Jordan Rivera", aliases: ["Jordan Rivera"] }]),
    });
    const before = (buildSnapshot().people[0] as IndexSnapshot["people"][number]).footprintSha256;
    writeFileSync(join(root, BOOK_DIR, "ch-01.md"), CHAPTER.replace("held the door.", "held the door,"), "utf8");
    const after = (buildSnapshot().people[0] as IndexSnapshot["people"][number]).footprintSha256;
    expect(after).not.toBe(before);
  });
});

// ---------------------------------------------------------------------------
// --check: the derived-not-hand-maintained enforcement
// ---------------------------------------------------------------------------

describe("--check refuses a hand-edited index", () => {
  test("green immediately after --write, red after a single hand edit, green again after --write", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER,
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "Jordan Rivera", aliases: ["Jordan Rivera"] }]),
    });

    expect(main(["--write"], io().sink)).toBe(0);
    expect(main(["--check"], io().sink)).toBe(0); // POSITIVE CONTROL

    const md = join(root, BOOK_DIR, "NAMED-INDEX.md");
    writeFileSync(md, `${readFileSync(md, "utf8")}\nHand-added line.\n`, "utf8");
    const red = io();
    expect(main(["--check"], red.sink)).toBe(1); // MUTATION
    expect(red.err).toContain("INDEX_STALE");

    expect(main(["--write"], io().sink)).toBe(0);
    expect(main(["--check"], io().sink)).toBe(0); // and back
  });

  test("a missing derived artifact is INDEX_STALE, not a silent pass", () => {
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER,
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "Jordan Rivera", aliases: ["Jordan Rivera"] }]),
    });
    expect(main(["--write"], io().sink)).toBe(0);
    rmSync(join(root, BOOK_DIR, "named-index.json"));
    const red = io();
    expect(main(["--check"], red.sink)).toBe(1);
    expect(red.err).toContain("is missing");
  });

  test("a NEW unmarked-then-marked passage moves --check from green to red", () => {
    // The drift this guards is not only hand-editing: prose moving underneath a
    // committed index produces the same false completeness.
    const root = fixture({
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER,
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "Jordan Rivera", aliases: ["Jordan Rivera"] }]),
    });
    expect(main(["--write"], io().sink)).toBe(0);
    writeFileSync(
      join(root, BOOK_DIR, "ch-02.md"),
      '<!-- consent:begin id=jordan-new person="Jordan Rivera" -->\nA new passage.\n<!-- consent:end id=jordan-new -->\n',
      "utf8",
    );
    expect(main(["--check"], io().sink)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The delta view — what makes many revisions survivable
// ---------------------------------------------------------------------------

describe("delta", () => {
  function snapOf(files: Record<string, string>): IndexSnapshot {
    fixture(files);
    return buildSnapshot();
  }

  test("an untouched person produces NO delta row — that is the whole point", () => {
    const people = roster([
      { person: "Jordan Rivera", aliases: ["Jordan Rivera"] },
      { person: "Sam Okafor", aliases: ["Sam Okafor"] },
    ]);
    const base = snapOf({
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER,
      [`${BOOK_DIR}/ch-02.md`]:
        '<!-- consent:begin id=sam-one person="Sam Okafor" -->\nSam Okafor was there.\n<!-- consent:end id=sam-one -->\n',
      [`${BOOK_DIR}/consent-events.json`]: people,
    });
    const next = snapOf({
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER.replace("held the door.", "held the door open."),
      [`${BOOK_DIR}/ch-02.md`]:
        '<!-- consent:begin id=sam-one person="Sam Okafor" -->\nSam Okafor was there.\n<!-- consent:end id=sam-one -->\n',
      [`${BOOK_DIR}/consent-events.json`]: people,
    });
    const deltas = computeDelta(base, next);
    expect(deltas.map((d) => d.person)).toEqual(["Jordan Rivera"]);
    expect(deltas[0]?.changed.map((c) => c.spanId)).toEqual(["jordan-door"]);
  });

  test("added, removed and state-change all surface", () => {
    const base = snapOf({
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER,
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "Jordan Rivera", aliases: ["Jordan Rivera"] }]),
    });
    const next = snapOf({
      [`${BOOK_DIR}/ch-02.md`]:
        '<!-- consent:begin id=jordan-two person="Jordan Rivera" -->\nSomething else.\n<!-- consent:end id=jordan-two -->\n',
      [`${BOOK_DIR}/consent-events.json`]: roster([
        { person: "Jordan Rivera", aliases: ["Jordan Rivera"], indexState: "pending" },
      ]),
    });
    const d = computeDelta(base, next)[0];
    expect(d?.added.map((a) => a.spanId)).toEqual(["jordan-two"]);
    expect(d?.removed.map((a) => a.spanId)).toEqual(["jordan-door"]);
    expect(d?.stateChange).toEqual({ from: "named", to: "pending" });
  });

  test("identical snapshots produce an empty delta", () => {
    const files = {
      [`${BOOK_DIR}/ch-01.md`]: CHAPTER,
      [`${BOOK_DIR}/consent-events.json`]: roster([{ person: "Jordan Rivera", aliases: ["Jordan Rivera"] }]),
    };
    expect(computeDelta(snapOf(files), snapOf(files))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Roster suggestion — derived from the ledger, never inferred from prose
// ---------------------------------------------------------------------------

describe("--suggest-roster", () => {
  const LEDGER = [
    "| Person | Relation | Status |",
    "|---|---|---|",
    "| Chris King | friend | GRANTED |",
    "| *(mother)* | mother | GRANTED |",
    "| Chris King | friend | duplicate row |",
    "",
    "## Not a table",
    "Jordan Rivera is mentioned in prose here and must NOT be suggested.",
  ].join("\n");

  test("candidates come from the ledger's subject column, never from scanning prose", () => {
    const rows = suggestRoster(LEDGER);
    expect(rows.map((r) => r.person)).toEqual(["Chris King", "(mother)"]);
    expect(rows.map((r) => r.person)).not.toContain("Jordan Rivera");
  });

  test("a subject the ledger carries unnamed is marked as such rather than given an invented key", () => {
    const rows = suggestRoster(LEDGER);
    expect(rows.find((r) => r.person === "(mother)")?.deidentifiedInLedger).toBe(true);
    expect(rows.find((r) => r.person === "Chris King")?.deidentifiedInLedger).toBe(false);
  });

  test("the suggestion writes nothing", () => {
    const root = fixture({
      [`${BOOK_DIR}/CONSENT-LEDGER.md`]: LEDGER,
      [`${BOOK_DIR}/consent-events.json`]: roster([]),
    });
    const before = readFileSync(join(root, BOOK_DIR, "consent-events.json"), "utf8");
    const box = io();
    expect(main(["--suggest-roster"], box.sink)).toBe(0);
    expect(readFileSync(join(root, BOOK_DIR, "consent-events.json"), "utf8")).toBe(before);
    expect(box.out).toContain("SUGGESTION ONLY");
  });
});

// ---------------------------------------------------------------------------
// The exclusion list is pinned — a silent widening is how coverage goes vacuous
// ---------------------------------------------------------------------------

test("MACHINERY_BASENAMES is exactly the four book-machinery files", () => {
  expect([...MACHINERY_BASENAMES].sort()).toEqual([
    "CONSENT-LEDGER.md",
    "CONSENT-SIGNOFF-DESIGN.md",
    "NAMED-INDEX-DESIGN.md",
    "NAMED-INDEX.md",
  ]);
  // The files that must NEVER be excluded: they are book material, and a name in
  // them is a real appearance.
  expect(MACHINERY_BASENAMES).not.toContain("INTAKE-LOG.md");
  expect(MACHINERY_BASENAMES.some((b) => b.startsWith("RAW-"))).toBe(false);
  expect(MACHINERY_BASENAMES.some((b) => b.startsWith("ch-"))).toBe(false);
});

// ---------------------------------------------------------------------------
// The SHIPPED artifacts are opened and parsed — a vector nothing reads is vacuous
// ---------------------------------------------------------------------------

test("the shipped consent-events.json and named-index.json are read and parsed by this suite", () => {
  const here = new URL("../../../", import.meta.url).pathname;
  const events = readFileSync(join(here, BOOK_DIR, "consent-events.json"), "utf8");
  const { people } = parseRoster(events, "consent-events.json");
  expect(people.size).toBe(0); // a COUNT, not a clearance — see NAMED-INDEX-DESIGN.md
  const snap = JSON.parse(readFileSync(join(here, BOOK_DIR, "named-index.json"), "utf8")) as IndexSnapshot;
  expect(snap.schemaVersion).toBe(1);
  expect(snap.people).toEqual([]);
});
