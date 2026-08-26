#!/usr/bin/env bun
// book-named-index.ts — person -> every place they appear in the book, DERIVED.
//
// The question a subject actually has is "what does this book say about me?", and no
// passage-level diff answers it. This generates the answer: one entry per person on
// the roster, listing every marked appearance, with a footprint hash over the whole
// entry so consent can bind to the PORTRAYAL rather than to a sentence.
//
// THE PROPERTY THAT MAKES IT WORTH HAVING:
//
//   > The index is DERIVED. It is never hand-maintained.
//
// A hand-kept index drifts, and a drifted index means somebody approved coverage
// that no longer reflects the text — coverage that LOOKS complete and is not. Here
// the cost of that lands on a named third party rather than on CI, so the generator
// is only half the mechanism. The other half is `audit-book-named-index.ts`, which
// catches the under-report: a person in the prose with no marker on them. Without
// that audit this file is a confident, checkable, incomplete picture.
//
// Nothing in this file reads a clock. The snapshot carries no timestamp, so
// regenerating on any machine at any time produces the same bytes and `--check` is
// a real comparison rather than a diff against "now"
// (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
//
// Usage:
//   bun src/Core.TypeScript/hygiene/book-named-index.ts            # print the markdown
//   bun src/Core.TypeScript/hygiene/book-named-index.ts --write    # regenerate both artifacts
//   bun src/Core.TypeScript/hygiene/book-named-index.ts --check    # committed == regenerated?
//   bun src/Core.TypeScript/hygiene/book-named-index.ts --json
//   bun src/Core.TypeScript/hygiene/book-named-index.ts --delta --baseline <named-index.json>
//   bun src/Core.TypeScript/hygiene/book-named-index.ts --suggest-roster

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  BOOK_DIR,
  collectSpans,
  DEFAULT_CORPUS,
  DEFAULT_INDEX_JSON,
  DEFAULT_INDEX_MD,
  DEFAULT_LEDGER,
  footprintOf,
  type IndexState,
  parseRoster,
  readTextOrNull,
  repoRoot,
  RosterError,
  type SpanRecord,
  SpanError,
} from "./book-consent-spans.ts";

export const INDEX_SCHEMA_VERSION = 1;

export interface Appearance {
  spanId: string;
  file: string;
  beginLine: number;
  endLine: number;
  mode: "named" | "deidentified";
  sha256: string;
}

export interface IndexEntry {
  person: string;
  indexState: IndexState;
  /** sha256 over the ordered `(spanId, sha256)` list — the value consent binds to. */
  footprintSha256: string;
  /**
   * How many identifying strings were declared for this person. Reported because
   * the coverage audit is exactly as strong as this number: a person with zero
   * aliases is a person the unmarked-appearance scan cannot see at all.
   */
  aliasCount: number;
  appearances: Appearance[];
}

export interface IndexSnapshot {
  schemaVersion: number;
  _readme: string;
  corpus: readonly string[];
  roster: string;
  people: IndexEntry[];
}

const SNAPSHOT_README =
  "DERIVED — do not hand-edit. Regenerate with `bun src/Core.TypeScript/hygiene/book-named-index.ts --write`; " +
  "`--check` fails when this file disagrees with the corpus. person -> every marked appearance, with a footprint " +
  "hash over the whole entry. The roster and the consent events live in consent-events.json; this file holds only " +
  "what is computed from the prose. Carries no timestamp on purpose, so the bytes are reproducible on any machine.";

function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Join rendered lines into a document with exactly ONE terminating newline.
 *
 * `NAMED-INDEX.md` lives under `docs/books/**`, which markdownlint covers, so a
 * generator that emits MD012 (consecutive blanks) would make the lint gate red on a
 * file no human wrote. The section builders below each end with a blank line so they
 * compose; this is where that convenience is paid for.
 */
function document(lines: readonly string[]): string {
  const out = [...lines];
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return `${out.join("\n")}\n`;
}

/**
 * `revoked` is DERIVED, never declared. A person is revoked when the consent fold
 * leaves them with at least one revoke and no surviving grant.
 *
 * The fold itself is #15619's (`foldConsent` in `audit-consent-signoff.ts`), and
 * this is deliberately NOT a second implementation of it: it reads the raw event
 * objects for the two fields that decide a person-level rollup — `type` and
 * `person` — and answers only the coarser question "does anything still stand for
 * this person". Per-(person, scope, span) state stays that module's business.
 *
 * Honest limit, stated because a rollup that looks finer than it is would be worse
 * than none: this cannot distinguish "revoked one scope" from "revoked everything",
 * so it reports `revoked` only when NOTHING survives. A partial revoke shows as
 * `named` here and is caught per-span by #15619's `REVOKED_PASSAGE_PRESENT`.
 */
export function deriveRevoked(rawEvents: readonly Record<string, unknown>[]): Set<string> {
  const grants = new Set<string>();
  const revokes = new Set<string>();
  for (const e of rawEvents) {
    const person = e["person"];
    const type = e["type"];
    if (typeof person !== "string") continue;
    if (type === "grant") grants.add(person);
    else if (type === "revoke") revokes.add(person);
  }
  const out = new Set<string>();
  for (const p of revokes) if (!grants.has(p)) out.add(p);
  return out;
}

export interface BuildOptions {
  rosterPath?: string;
  corpusDirs?: readonly string[];
}

export function buildSnapshot(opts: BuildOptions = {}): IndexSnapshot {
  const root = repoRoot();
  const rosterPath = opts.rosterPath ?? DEFAULT_LEDGER;
  const corpus = opts.corpusDirs ?? DEFAULT_CORPUS;

  const rosterText = readTextOrNull(resolve(root, rosterPath));
  if (rosterText === null) {
    throw new RosterError(
      `roster not found at ${rosterPath} (root ${root}). The index is derived from the roster; without one there is nobody to index, and reporting "no findings" would be a check that never ran.`,
    );
  }
  const { people, rawEvents } = parseRoster(rosterText, rosterPath);
  const { spans } = collectSpans(corpus);
  const revoked = deriveRevoked(rawEvents);

  const entries: IndexEntry[] = [];
  for (const p of [...people.values()].sort((a, b) => ordinal(a.person, b.person))) {
    const { sha256, members } = footprintOf(p.person, spans);
    entries.push({
      person: p.person,
      indexState: revoked.has(p.person) ? "revoked" : p.indexState,
      footprintSha256: sha256,
      aliasCount: p.aliases.length,
      appearances: members.map((m: SpanRecord) => ({
        spanId: m.spanId,
        file: m.file,
        beginLine: m.beginLine,
        endLine: m.endLine,
        mode: m.mode,
        sha256: m.sha256,
      })),
    });
  }

  return {
    schemaVersion: INDEX_SCHEMA_VERSION,
    _readme: SNAPSHOT_README,
    corpus: [...corpus],
    roster: rosterPath,
    people: entries,
  };
}

export function renderSnapshotJson(snap: IndexSnapshot): string {
  return `${JSON.stringify(snap, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// The markdown surface — this is what a subject is actually shown
// ---------------------------------------------------------------------------

const STATE_NOTE: Record<IndexState, string> = {
  named: "may be named; every appearance below must sit inside a consent span",
  "role-only": "carried by role, never by name — no alias of theirs may appear anywhere in the prose",
  pending: "asked, no answer yet — same content constraint as role-only, held until they reply",
  revoked: "derived from the consent event fold: a revoke stands and no grant survives it",
};

export function renderSnapshotMarkdown(snap: IndexSnapshot): string {
  const L: string[] = [];
  L.push("# Named index — *You, Born at the Hinge*");
  L.push("");
  L.push("<!-- DERIVED FILE. Do not hand-edit. -->");
  L.push("<!-- Regenerate: bun src/Core.TypeScript/hygiene/book-named-index.ts --write -->");
  L.push("");
  L.push("> **Person -> everywhere they appear.** Generated from the `consent:begin` / `consent:end`");
  L.push("> markers in the prose and the roster in [`consent-events.json`](consent-events.json). It exists so a");
  L.push("> subject can be shown their **whole footprint** — the question they actually have is *\"what does");
  L.push("> this book say about me?\"*, and no passage-level diff answers that. Consent binds to the");
  L.push("> **footprint hash** below, so a revision produces a *delta* to look at rather than a fresh read of");
  L.push("> everything.");
  L.push("");
  L.push("> **This file is derived and is checked.** `book-named-index.ts --check` fails when it disagrees");
  L.push("> with the prose, and `audit-book-named-index.ts` fails when a person appears in the prose with no");
  L.push("> marker on them. The second one is the load-bearing half: without it this index would under-report");
  L.push("> silently, and somebody would consent against an incomplete picture.");
  L.push("");
  L.push("Design and limits: [`NAMED-INDEX-DESIGN.md`](NAMED-INDEX-DESIGN.md). Scope, conditions and reasoning");
  L.push("stay in [`CONSENT-LEDGER.md`](CONSENT-LEDGER.md) — this file holds only what is computed.");
  L.push("");

  if (snap.people.length === 0) {
    L.push("## Nobody is on the roster yet");
    L.push("");
    L.push("`consent-events.json` carries zero people, so this index is empty and the coverage audit has");
    L.push("nothing to look for. **That is a count, not a clearance.** The book names real people today; what");
    L.push("is missing is the roster that would let a machine see them.");
    L.push("");
    L.push("`bun src/Core.TypeScript/hygiene/book-named-index.ts --suggest-roster` reads the subject column of");
    L.push("`CONSENT-LEDGER.md` and prints roster entries to start from. It writes nothing and decides nothing:");
    L.push("aliases and `indexState` are human calls, and the suggestion says so per row.");
    L.push("");
    return document(L);
  }

  L.push("## Roster");
  L.push("");
  L.push("| Person | State | Appearances | Aliases declared | Footprint sha256 |");
  L.push("|---|---|---:|---:|---|");
  for (const e of snap.people) {
    L.push(
      `| ${e.person} | \`${e.indexState}\` | ${e.appearances.length} | ${e.aliasCount} | \`${e.footprintSha256.slice(0, 16)}…\` |`,
    );
  }
  L.push("");
  L.push("**Aliases declared** is how strong the coverage audit is for that person: it scans the prose for");
  L.push("those strings and nothing else. A `0` means the unmarked-appearance check cannot see them at all.");
  L.push("");

  for (const e of snap.people) {
    L.push(`## ${e.person}`);
    L.push("");
    L.push(`- **State:** \`${e.indexState}\` — ${STATE_NOTE[e.indexState]}`);
    L.push(`- **Footprint sha256:** \`${e.footprintSha256}\``);
    L.push(`- **Aliases declared:** ${e.aliasCount}`);
    L.push("");
    if (e.appearances.length === 0) {
      L.push("No marked appearance in the corpus.");
      L.push("");
      continue;
    }
    L.push("| Span | Where | Mode | Passage sha256 |");
    L.push("|---|---|---|---|");
    for (const a of e.appearances) {
      L.push(`| \`${a.spanId}\` | \`${a.file}\`:${a.beginLine}–${a.endLine} | ${a.mode} | \`${a.sha256.slice(0, 16)}…\` |`);
    }
    L.push("");
  }
  return document(L);
}

// ---------------------------------------------------------------------------
// The delta view — what makes many revisions survivable
// ---------------------------------------------------------------------------

export interface PersonDelta {
  person: string;
  baselineFootprint: string | null;
  currentFootprint: string | null;
  added: Appearance[];
  removed: Appearance[];
  changed: { spanId: string; from: string; to: string; file: string; beginLine: number }[];
  stateChange: { from: IndexState; to: IndexState } | null;
}

export function computeDelta(baseline: IndexSnapshot, current: IndexSnapshot): PersonDelta[] {
  const base = new Map(baseline.people.map((p) => [p.person, p]));
  const cur = new Map(current.people.map((p) => [p.person, p]));
  const names = [...new Set([...base.keys(), ...cur.keys()])].sort(ordinal);

  const out: PersonDelta[] = [];
  for (const name of names) {
    const b = base.get(name);
    const c = cur.get(name);
    const bSpans = new Map((b?.appearances ?? []).map((a) => [a.spanId, a]));
    const cSpans = new Map((c?.appearances ?? []).map((a) => [a.spanId, a]));

    const added = [...cSpans.values()].filter((a) => !bSpans.has(a.spanId)).sort((x, y) => ordinal(x.spanId, y.spanId));
    const removed = [...bSpans.values()]
      .filter((a) => !cSpans.has(a.spanId))
      .sort((x, y) => ordinal(x.spanId, y.spanId));
    const changed: PersonDelta["changed"] = [];
    for (const [spanId, ca] of [...cSpans.entries()].sort((x, y) => ordinal(x[0], y[0]))) {
      const ba = bSpans.get(spanId);
      if (ba && ba.sha256 !== ca.sha256) {
        changed.push({ spanId, from: ba.sha256, to: ca.sha256, file: ca.file, beginLine: ca.beginLine });
      }
    }
    const stateChange = b && c && b.indexState !== c.indexState ? { from: b.indexState, to: c.indexState } : null;

    if (added.length === 0 && removed.length === 0 && changed.length === 0 && stateChange === null) continue;
    out.push({
      person: name,
      baselineFootprint: b?.footprintSha256 ?? null,
      currentFootprint: c?.footprintSha256 ?? null,
      added,
      removed,
      changed,
      stateChange,
    });
  }
  return out;
}

export function renderDeltaMarkdown(deltas: readonly PersonDelta[]): string {
  const L: string[] = [];
  L.push("# What changed about you since you approved");
  L.push("");
  if (deltas.length === 0) {
    L.push("Nothing changed. Every footprint hash matches the baseline, so no re-consent is needed.");
    L.push("");
    return `${L.join("\n")}\n`;
  }
  L.push("Only the people below are affected. Everyone else's footprint hash is unchanged, which is the whole");
  L.push("point of hashing the footprint: a revision to one section does not send twenty people a re-read.");
  L.push("");
  for (const d of deltas) {
    L.push(`## ${d.person}`);
    L.push("");
    L.push(`- Footprint: \`${d.baselineFootprint ?? "(not on the baseline)"}\` -> \`${d.currentFootprint ?? "(no longer on the roster)"}\``);
    if (d.stateChange) L.push(`- **State changed:** \`${d.stateChange.from}\` -> \`${d.stateChange.to}\``);
    L.push("");
    if (d.added.length > 0) {
      L.push("**New passages about you:**");
      L.push("");
      for (const a of d.added) L.push(`- \`${a.spanId}\` — \`${a.file}\`:${a.beginLine}`);
      L.push("");
    }
    if (d.changed.length > 0) {
      L.push("**Passages that were edited since you approved them:**");
      L.push("");
      for (const c of d.changed) L.push(`- \`${c.spanId}\` — \`${c.file}\`:${c.beginLine}`);
      L.push("");
    }
    if (d.removed.length > 0) {
      L.push("**Passages removed:**");
      L.push("");
      for (const a of d.removed) L.push(`- \`${a.spanId}\` — was at \`${a.file}\`:${a.beginLine}`);
      L.push("");
    }
  }
  return document(L);
}

// ---------------------------------------------------------------------------
// Roster suggestion — derived from the ledger, decides nothing
// ---------------------------------------------------------------------------

/**
 * Read the subject column of `CONSENT-LEDGER.md` and print roster entries to start
 * from.
 *
 * Provenance matters here: the candidates come from the ledger Aaron already wrote,
 * never from scanning prose for capitalised words and guessing which are people.
 * Guessing would be exactly the inference this repo forbids
 * (`.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md`
 * — ask, do not infer). This writes nothing and gates nothing; `aliases` and
 * `indexState` are human calls and every suggested row says so.
 */
export function suggestRoster(ledgerMarkdown: string): { person: string; deidentifiedInLedger: boolean }[] {
  const out: { person: string; deidentifiedInLedger: boolean }[] = [];
  const seen = new Set<string>();
  for (const line of ledgerMarkdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|");
    const first = (cells[1] ?? "").trim();
    if (first === "" || /^-+:?$/.test(first) || first === "Person") continue;
    // The ledger writes a subject it does not name as `*(mother)*` / `*(a private
    // individual)*`. Those are placeholders, not names — carry them through marked,
    // so a human supplies the real key rather than a machine inventing one.
    const deidentified = /^\*?\(/.test(first);
    const person = first.replace(/^\*+|\*+$/g, "").trim();
    if (person === "" || seen.has(person)) continue;
    seen.add(person);
    out.push({ person, deidentifiedInLedger: deidentified });
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface CliIo {
  out: (s: string) => void;
  err: (s: string) => void;
}

export function main(argv: readonly string[], io: CliIo): number {
  const args = [...argv];
  const has = (f: string): boolean => args.includes(f);
  const valueOf = (f: string): string | undefined => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = repoRoot();

  try {
    if (has("--suggest-roster")) {
      const ledgerText = readTextOrNull(resolve(root, `${BOOK_DIR}/CONSENT-LEDGER.md`));
      if (ledgerText === null) {
        io.err(`CONSENT-LEDGER.md not found at ${BOOK_DIR}/CONSENT-LEDGER.md\n`);
        return 2;
      }
      const rows = suggestRoster(ledgerText);
      io.out(
        `// ${rows.length} candidate subject(s) read from ${BOOK_DIR}/CONSENT-LEDGER.md.\n` +
          "// SUGGESTION ONLY — nothing was written. aliases and indexState are human calls:\n" +
          "//   aliases    every string that identifies them in prose, ROLE PHRASES included\n" +
          "//   indexState named | role-only | pending   (revoked is derived, never declared)\n" +
          "// Every row defaults to a state that WITHHOLDS the name, so applying this file\n" +
          "// verbatim fails loudly rather than quietly permitting. That direction is deliberate:\n" +
          "// a default that relaxes a check is how a check goes quiet.\n",
      );
      io.out(
        `${JSON.stringify(
          rows.map((r) => ({
            person: r.person,
            indexState: r.deidentifiedInLedger ? "role-only" : "pending",
            aliases: [],
            _note: r.deidentifiedInLedger
              ? "the ledger carries this subject UNNAMED — supply the real key and the aliases by hand"
              : "confirm the exact name form and add every alias before this row gates anything",
          })),
          null,
          2,
        )}\n`,
      );
      return 0;
    }

    const snap = buildSnapshot({ rosterPath: valueOf("--roster") ?? DEFAULT_LEDGER });

    if (has("--delta")) {
      const baselinePath = valueOf("--baseline");
      if (baselinePath === undefined) {
        io.err("--delta requires --baseline <named-index.json>\n");
        return 2;
      }
      const baselineText = readTextOrNull(resolve(root, baselinePath));
      if (baselineText === null) {
        io.err(`baseline not found at ${baselinePath}\n`);
        return 2;
      }
      const baseline = JSON.parse(baselineText) as IndexSnapshot;
      const deltas = computeDelta(baseline, snap);
      io.out(has("--json") ? `${JSON.stringify(deltas, null, 2)}\n` : renderDeltaMarkdown(deltas));
      return 0;
    }

    const json = renderSnapshotJson(snap);
    const md = renderSnapshotMarkdown(snap);

    if (has("--write")) {
      writeFileSync(resolve(root, DEFAULT_INDEX_JSON), json, "utf8");
      writeFileSync(resolve(root, DEFAULT_INDEX_MD), md, "utf8");
      io.out(`wrote ${DEFAULT_INDEX_JSON} and ${DEFAULT_INDEX_MD} (${snap.people.length} person entries)\n`);
      return 0;
    }

    if (has("--check")) {
      const problems: string[] = [];
      for (const [path, expected] of [
        [DEFAULT_INDEX_JSON, json],
        [DEFAULT_INDEX_MD, md],
      ] as const) {
        const committed = readTextOrNull(resolve(root, path));
        if (committed === null) {
          problems.push(`${path} is missing — the derived index must be committed, or nothing can detect its drift.`);
          continue;
        }
        if (committed !== expected) {
          problems.push(
            `${path} disagrees with the corpus. The index is DERIVED; a committed copy that no longer matches means a subject could be shown coverage that is not what the book says. Run --write.`,
          );
        }
      }
      if (problems.length > 0) {
        for (const p of problems) io.err(`INDEX_STALE: ${p}\n`);
        return 1;
      }
      io.out(`named index is current (${snap.people.length} person entries)\n`);
      return 0;
    }

    io.out(has("--json") ? json : md);
    return 0;
  } catch (e) {
    if (e instanceof SpanError || e instanceof RosterError) {
      io.err(`configuration error: ${e.message}\n`);
      return 2;
    }
    io.err(`error: ${(e as Error).message}\n`);
    return 2;
  }
}

if (import.meta.main) {
  process.exit(
    main(process.argv.slice(2), {
      out: (s) => process.stdout.write(s),
      err: (s) => process.stderr.write(s),
    }),
  );
}
