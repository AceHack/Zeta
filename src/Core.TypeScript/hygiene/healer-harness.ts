#!/usr/bin/env bun
// healer-harness.ts — idempotence + closure certification for auto-healers.
// Workitem 081KX3KA3F008QG0R0022EF9R8 (drift-and-heal ADR item 3): a healer
// may not oscillate and may not create new drift. Both laws have live
// counterexamples from 2026-07-08 — the MD032 auto-heal re-split a wrapped
// code span every round (oscillation against another healer's fixed point),
// and its heals staled the generated MEMORY.md index (closure violation:
// the heal itself created drift in a detector it never looked at).
//
// Model: a healer is a PURE function over an in-memory file tree; a detector
// is a pure function from tree to findings. No fs, no clock, no ambient
// anything (noninterference §13) — the harness replays deterministically
// (DST) and the laws are checked as equalities over values:
//
//   IDEMPOTENCE   heal(heal(t)) == heal(t)          (byte-for-byte)
//   CLOSURE       ∀ detector d: d(heal(t)) ⊆ d(t)   (no NEW findings, any class)
//   CONVERGENCE   heal^n(t) reaches a fixed point within budget
//                 (catches period-k oscillators that single-pass idempotence
//                  would miss when k > 1 across interacting healers)
//
// Closure is deliberately ⊆, not =∅: a healer may leave another class's
// pre-existing drift alone; it must never MINT drift. The consuming policy
// (ADR item 3) is: a healer gets write access only if certify() passes over
// the fixture corpus — healers get golden vectors too.
//
// Usage (library-first; the CLI is a thin fixture-corpus runner):
//   bun src/Core.TypeScript/hygiene/healer-harness.ts   # run built-in corpus

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** An immutable snapshot of files: path -> content. */
export type FileTree = ReadonlyMap<string, string>;

export interface Healer {
  readonly name: string;
  readonly heal: (tree: FileTree) => FileTree;
}

export interface Finding {
  readonly path: string;
  readonly rule: string;
  readonly detail: string;
}

export interface Detector {
  readonly name: string;
  readonly detect: (tree: FileTree) => readonly Finding[];
}

export function tree(entries: Record<string, string>): FileTree {
  return new Map(Object.entries(entries));
}

/** Byte-for-byte tree equality (ordinal — no collation, no normalization). */
export function treesEqual(a: FileTree, b: FileTree): boolean {
  if (a.size !== b.size) return false;
  for (const [path, content] of a) {
    if (b.get(path) !== content) return false;
  }
  return true;
}

function findingKey(f: Finding): string {
  return JSON.stringify([f.path, f.rule, f.detail]);
}

/** Findings present in `after` but not in `before` — the minted drift. */
export function newFindings(before: readonly Finding[], after: readonly Finding[]): readonly Finding[] {
  const seen = new Set(before.map(findingKey));
  return after.filter((f) => !seen.has(findingKey(f)));
}

// ---------------------------------------------------------------------------
// The three laws
// ---------------------------------------------------------------------------

export interface LawViolation {
  readonly law: "idempotence" | "closure" | "convergence";
  readonly fixture: string;
  readonly detail: string;
}

export interface Verdict {
  readonly healer: string;
  readonly pass: boolean;
  readonly violations: readonly LawViolation[];
}

export interface Fixture {
  readonly name: string;
  readonly tree: FileTree;
}

export interface HarnessOptions {
  /** Convergence budget: heal^n must reach a fixed point within n iterations. */
  readonly maxIterations?: number;
}

/** Paths whose contents differ between two trees (for violation detail). */
function differingPaths(a: FileTree, b: FileTree): readonly string[] {
  const paths = new Set([...a.keys(), ...b.keys()]);
  const out: string[] = [];
  for (const p of paths) {
    if (a.get(p) !== b.get(p)) out.push(p);
  }
  return out.sort(); // default sort is codepoint order — culture-invariant
}

/** Defensive snapshot: healers and detectors NEVER receive a shared
 * reference. An in-place-mutating healer that returns its input would
 * otherwise satisfy every law trivially (heal(heal(t)) is the same object)
 * and corrupt the fixture for later laws — reviewer P0, #9817. */
function snapshot(t: FileTree): FileTree {
  return new Map(t);
}

export function certify(
  healer: Healer,
  detectors: readonly Detector[],
  fixtures: readonly Fixture[],
  options?: HarnessOptions,
): Verdict {
  // 0 or negative budget would fail convergence unconditionally even at a
  // fixed point — clamp to at least one iteration (reviewer P2, #9817).
  const maxIterations = Math.max(1, options?.maxIterations ?? 4);
  const violations: LawViolation[] = [];

  for (const fixture of fixtures) {
    const original = snapshot(fixture.tree); // immutable reference copy
    const once = healer.heal(snapshot(original));
    const twice = healer.heal(snapshot(once));

    // IDEMPOTENCE — heal(heal(t)) == heal(t)
    if (!treesEqual(once, twice)) {
      violations.push({
        law: "idempotence",
        fixture: fixture.name,
        detail: `second pass changed: ${differingPaths(once, twice).join(", ")}`,
      });
    }

    // CLOSURE — no detector sees findings after the heal that it did not see before
    for (const detector of detectors) {
      const minted = newFindings(detector.detect(snapshot(original)), detector.detect(snapshot(once)));
      if (minted.length > 0) {
        const first = minted[0];
        violations.push({
          law: "closure",
          fixture: fixture.name,
          detail: `minted ${String(minted.length)} new ${detector.name} finding(s), first: ${first ? `${first.path} ${first.rule}` : ""}`,
        });
      }
    }

    // CONVERGENCE — iterating heal reaches a fixed point within budget.
    // `current` is snapshotted before each call so an in-place mutator cannot
    // make next === current by aliasing (reviewer P0, #9817).
    let current = snapshot(original);
    let converged = false;
    for (let i = 0; i < maxIterations; i++) {
      const next = healer.heal(snapshot(current));
      if (treesEqual(next, current)) {
        converged = true;
        break;
      }
      current = next;
    }
    if (!converged) {
      violations.push({
        law: "convergence",
        fixture: fixture.name,
        detail: `no fixed point within ${String(maxIterations)} iterations`,
      });
    }
  }

  return { healer: healer.name, pass: violations.length === 0, violations };
}

/** Certify a PIPELINE of healers as one composite (interacting healers must
 * jointly converge — the 2026-07-08 oscillation was two healers fighting). */
export function composeHealers(name: string, healers: readonly Healer[]): Healer {
  return {
    name,
    heal: (t: FileTree) => healers.reduce<FileTree>((acc, h) => h.heal(acc), t),
  };
}

// ---------------------------------------------------------------------------
// Reference detectors (toy-scale but real-shaped; used by the built-in corpus)
// ---------------------------------------------------------------------------

const LIST_START = /^\s*(?:[-*+]|\d+\.)\s/;

// Ordered-list marker, CommonMark 0.31.2 §List items: 1--9 arabic digits, then
// `.` or `)`, then a space/tab (or end of line for an empty item). Group 2 is
// the item's first-line content — empty content is what "an empty list item
// cannot interrupt a paragraph" turns on.
const ORDERED_MARKER = /^ {0,3}(\d{1,9})[.)](?:[ \t](.*)|())$/;
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;
const INDENTED_CONTINUATION = /^ {2,}\S/;
const HEADING_LINE = /^ {0,3}#{1,6}(?:\s|$)/;

/** MD032-shaped: a list start must have a blank (or list) line above. */
export const blanksAroundListsDetector: Detector = {
  name: "blanks-around-lists",
  detect: (t) => {
    const out: Finding[] = [];
    for (const [path, content] of t) {
      if (!path.endsWith(".md")) continue;
      const lines = content.split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const prev = lines[i - 1] ?? "";
        if (LIST_START.test(line) && prev.trim() !== "" && !LIST_START.test(prev)) {
          out.push({ path, rule: "blanks-around-lists", detail: `line ${String(i + 1)}` });
        }
      }
    }
    return out;
  },
};

/** MD038-shaped: a backtick span opened on a line must close before a blank
 * line (a blank inside a span is the re-splitter's signature damage). */
export const codeSpanIntegrityDetector: Detector = {
  name: "code-span-integrity",
  detect: (t) => {
    const out: Finding[] = [];
    for (const [path, content] of t) {
      if (!path.endsWith(".md")) continue;
      const lines = content.split("\n");
      let open = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const ticks = (line.match(/`/g) ?? []).length;
        if (ticks % 2 === 1) open = !open;
        if (open && line.trim() === "") {
          out.push({ path, rule: "code-span-integrity", detail: `blank line ${String(i + 1)} inside span` });
        }
      }
    }
    return out;
  },
};

/** MEMORY.md-index-shaped: the generated index must list exactly the entry
 * files present under memory/ (the closure counterexample's detector). */
export const memoryIndexDetector: Detector = {
  name: "memory-index-current",
  detect: (t) => {
    const index = t.get("memory/MEMORY.md");
    if (index === undefined) return [];
    const entries = [...t.keys()].filter((p) => p.startsWith("memory/") && p !== "memory/MEMORY.md").sort();
    const expected = entries.map((p) => `- ${p}`).join("\n");
    return index === expected ? [] : [{ path: "memory/MEMORY.md", rule: "memory-index-current", detail: "index stale vs memory/ entries" }];
  },
};

/**
 * MD029-shaped (`ol-prefix`): an ordered list may not start at a number other
 * than 0 or 1.
 *
 * WHY THIS DETECTOR EXISTS, AND WHY ITS ABSENCE WAS THE REAL DEFECT
 * (081M0QZF4QY087G0R000WKDYFZ, 2026-08-23). The closure law already said
 * exactly the right thing — `d(heal(t)) ⊆ d(t)`, a healer may never MINT
 * drift — and the healer that manufactured an ordered list numbered `2007`
 * out of an author's hard-wrapped sentence passed certification anyway. Not
 * because the law was wrong: because **no detector in this set could see
 * MD029**. A law quantified over detectors is only as strong as the detector
 * set, so `∀ d` was satisfied vacuously and the gate granted write access to a
 * transform that was minting the exact drift the gate exists to refuse. That
 * is the vacuity class in its purest form — a check that cannot fail is not a
 * check. The predicate fix (`canInterruptParagraph`) closed the instance; this
 * detector closes the hole the instance came through.
 *
 * IT MODELS COMMONMARK'S INTERRUPTION RULE, WHICH IS LOAD-BEARING HERE, NOT
 * PEDANTRY. A detector that flagged every `<digits>. ` line-start regardless of
 * context would report the finding on the input as well as the output — the
 * minted set would be empty and closure would pass again, vacuously, in a new
 * way. It only discriminates because a hard-wrapped numeral inside a paragraph
 * is NOT a list (0.31.2 §Lists: "we allow only lists starting with `1` to
 * interrupt paragraphs"), so the finding genuinely appears for the first time
 * in the healer's output. Verified against the real linter, not just the spec
 * text: markdownlint-cli2 0.22.1 / markdownlint 0.40.0 reports
 * `MD029/ol-prefix [Expected: 1; Actual: 2007]` on the healed shape and
 * nothing on the authored one; it accepts `0.` and `1.` starts and both `.`
 * and `)` delimiters, which is what the numbers and the marker class below
 * are.
 *
 * Toy-scale like its siblings — block structure only, no inline parsing, no
 * lists nested inside blockquotes. It is a reference detector, not a linter.
 */
export const orderedListPrefixDetector: Detector = {
  name: "ol-prefix",
  detect: (t) => {
    const out: Finding[] = [];
    for (const [path, content] of t) {
      if (!path.endsWith(".md")) continue;
      const lines = content.split("\n");
      let fence: string | null = null;
      let paragraphOpen = false;
      let inOrderedList = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const fenceOpen = FENCE_LINE.exec(line);
        if (fence !== null) {
          if (fenceOpen !== null && (fenceOpen[1] ?? "").startsWith(fence)) fence = null;
          continue;
        }
        if (fenceOpen !== null) {
          fence = fenceOpen[1] ?? "```";
          paragraphOpen = false;
          inOrderedList = false;
          continue;
        }
        if (line.trim() === "") {
          // A blank ends a paragraph but NOT a list (loose lists are lists).
          paragraphOpen = false;
          continue;
        }
        const ordered = ORDERED_MARKER.exec(line);
        if (ordered !== null) {
          const start = Number.parseInt(ordered[1] ?? "", 10);
          const hasContent = (ordered[2] ?? "").trim() !== "";
          if (inOrderedList) {
            // A sibling marker joins the open list; MD029's sequence rule for
            // interior items is out of this reference detector's scope.
            paragraphOpen = false;
          } else if (!paragraphOpen) {
            inOrderedList = true;
            paragraphOpen = false;
            if (start !== 0 && start !== 1) {
              out.push({ path, rule: "ol-prefix", detail: `line ${String(i + 1)} starts an ordered list at ${String(start)}` });
            }
          } else if (start === 1 && hasContent) {
            inOrderedList = true; // the only marker allowed to interrupt a paragraph
            paragraphOpen = false;
          }
          // else: a hard-wrapped numeral inside a paragraph. It is prose, and
          // — this is the part that is easy to get wrong — THE PARAGRAPH IS
          // STILL OPEN. Clearing the flag here would make a SECOND wrapped
          // numeral two lines later look like a fresh list start and mint a
          // finding on the author's untouched text, which is the detector
          // committing the very error it exists to catch.
          continue;
        }
        if (inOrderedList && INDENTED_CONTINUATION.test(line)) continue; // item body
        inOrderedList = false;
        paragraphOpen = !HEADING_LINE.test(line);
      }
    }
    return out;
  },
};

export const trailingSpaceDetector: Detector = {
  name: "trailing-space",
  detect: (t) => {
    const out: Finding[] = [];
    for (const [path, content] of t) {
      if (!path.endsWith(".md")) continue;
      content.split("\n").forEach((line, i) => {
        if (/[ \t]+$/.test(line)) out.push({ path, rule: "trailing-space", detail: `line ${String(i + 1)}` });
      });
    }
    return out;
  },
};

export const REFERENCE_DETECTORS: readonly Detector[] = [
  blanksAroundListsDetector,
  codeSpanIntegrityDetector,
  memoryIndexDetector,
  trailingSpaceDetector,
  // Added 2026-08-23. The set is the quantifier of the closure law: a class no
  // detector here can see is a class the gate cannot refuse.
  orderedListPrefixDetector,
];

// ---------------------------------------------------------------------------
// Named counterexample healers (the 2026-07-08 incidents, reproduced) and one
// lawful healer. These are the harness's own golden vectors: the bad ones
// MUST fail (each for its documented reason), the good one MUST pass.
// ---------------------------------------------------------------------------

/** The re-splitter: fixes blanks-around-lists by inserting a blank line above
 * every list start — including inside an open code span. Lawful-looking,
 * closure-violating (mints code-span-integrity drift), exactly the 2026-07-08
 * hadamard-letter damage. */
export const resplitterHealer: Healer = {
  name: "resplitter-md032-naive",
  heal: (t) => {
    const out = new Map(t);
    for (const [path, content] of t) {
      if (!path.endsWith(".md")) continue;
      const lines = content.split("\n");
      const healed: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const prev = healed[healed.length - 1] ?? "";
        if (i > 0 && LIST_START.test(line) && prev.trim() !== "" && !LIST_START.test(prev)) {
          healed.push("");
        }
        healed.push(line);
      }
      out.set(path, healed.join("\n"));
    }
    return out;
  },
};

/** The unwrapper: rejoins any blank line that sits inside an open code span
 * (my 2026-07-08 counter-heal). Lawful alone — but composed with the
 * re-splitter it oscillates, which is what the convergence law is for. */
export const unwrapperHealer: Healer = {
  name: "code-span-unwrapper",
  heal: (t) => {
    const out = new Map(t);
    for (const [path, content] of t) {
      if (!path.endsWith(".md")) continue;
      const lines = content.split("\n");
      const healed: string[] = [];
      let open = false;
      for (const line of lines) {
        const ticks = (line.match(/`/g) ?? []).length;
        if (open && line.trim() === "") continue; // drop blank inside span
        if (ticks % 2 === 1) open = !open;
        healed.push(line);
      }
      out.set(path, healed.join("\n"));
    }
    return out;
  },
};

/** The memory-toucher: strips trailing spaces everywhere, including memory/
 * entry files, WITHOUT regenerating the index — the MEMORY.md staleness
 * incident. (Toy index tracks entry paths, so this toucher renames-by-content
 * is simulated by touching an entry the index hashes; here the index lists
 * paths, so we model the incident by having the healer also delete an entry's
 * trailing-space-only line, changing the entry set the index was built from.) */
export const memoryToucherHealer: Healer = {
  name: "memory-toucher-no-reindex",
  heal: (t) => {
    const out = new Map(t);
    for (const [path, content] of t) {
      if (!path.endsWith(".md") || path === "memory/MEMORY.md") continue;
      const healed = content
        .split("\n")
        .map((l) => l.replace(/[ \t]+$/, ""))
        .join("\n");
      if (path.startsWith("memory/") && healed === "") {
        out.delete(path); // prunes empty entries…
      } else {
        out.set(path, healed);
      }
    }
    // …and never regenerates memory/MEMORY.md: the index goes stale — closure
    // violation against a detector this healer never looked at.
    return out;
  },
};

/** A lawful healer: trailing-space stripper that touches nothing else. */
export const trailingSpaceHealer: Healer = {
  name: "trailing-space-stripper",
  heal: (t) => {
    const out = new Map(t);
    for (const [path, content] of t) {
      if (!path.endsWith(".md")) continue;
      out.set(
        path,
        content
          .split("\n")
          .map((l) => l.replace(/[ \t]+$/, ""))
          .join("\n"),
      );
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// Built-in fixture corpus
// ---------------------------------------------------------------------------

/** The hadamard shape: a code span wrapped across lines, directly above a
 * list start — the exact bait the re-splitter took. */
export const hadamardFixture: Fixture = {
  name: "wrapped-code-span-above-list",
  tree: tree({
    "docs/letters/lemma.md": [
      "# Lemma",
      "",
      "Consider the identity `Hadamard(uniform-over-C) =",
      "- uniform-over-C`, so the fixed point holds",
      "- **Q2:** does collapse give G>0?",
      "",
      "Trailing text.",
    ].join("\n"),
  }),
};

export const memoryFixture: Fixture = {
  name: "memory-entries-with-index",
  tree: tree({
    "memory/alpha.md": "alpha note ",
    "memory/beta.md": "",
    "memory/MEMORY.md": ["- memory/alpha.md", "- memory/beta.md"].join("\n"),
  }),
};

export const cleanFixture: Fixture = {
  name: "already-clean",
  tree: tree({
    "docs/clean.md": ["# Clean", "", "- a", "- b", ""].join("\n"),
  }),
};

export const BUILTIN_FIXTURES: readonly Fixture[] = [hadamardFixture, memoryFixture, cleanFixture];

// ---------------------------------------------------------------------------
// CLI — run the built-in corpus: the counterexamples MUST fail, the lawful
// healer MUST pass. Exit 0 iff the harness itself behaves as specified.
// ---------------------------------------------------------------------------

export function runBuiltinCorpus(): { readonly ok: boolean; readonly lines: readonly string[] } {
  const lines: string[] = [];
  const expectFail = [resplitterHealer, memoryToucherHealer, composeHealers("unwrapper-then-resplitter", [unwrapperHealer, resplitterHealer])];
  const expectPass = [trailingSpaceHealer, unwrapperHealer, composeHealers("resplitter-then-unwrapper", [resplitterHealer, unwrapperHealer])];
  let ok = true;

  for (const healer of expectFail) {
    const v = certify(healer, REFERENCE_DETECTORS, BUILTIN_FIXTURES);
    const asExpected = !v.pass;
    ok = ok && asExpected;
    lines.push(`${asExpected ? "OK " : "BAD"} ${healer.name}: expected FAIL, got ${v.pass ? "pass" : `fail (${v.violations.map((x) => x.law).join(",")})`}`);
  }
  for (const healer of expectPass) {
    const v = certify(healer, REFERENCE_DETECTORS, BUILTIN_FIXTURES);
    ok = ok && v.pass;
    lines.push(`${v.pass ? "OK " : "BAD"} ${healer.name}: expected PASS, got ${v.pass ? "pass" : v.violations.map((x) => `${x.law}@${x.fixture}: ${x.detail}`).join(" | ")}`);
  }
  return { ok, lines };
}

const invokedDirectly = typeof process.argv[1] === "string" && /healer-harness\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const { ok, lines } = runBuiltinCorpus();
  for (const l of lines) console.log(l);
  console.log(ok ? "healer-harness: corpus behaves as specified" : "healer-harness: CORPUS VIOLATION");
  process.exit(ok ? 0 : 1);
}
