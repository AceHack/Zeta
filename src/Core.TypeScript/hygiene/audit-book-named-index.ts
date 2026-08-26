#!/usr/bin/env bun
// audit-book-named-index.ts — catch the case where the derived index UNDER-REPORTS.
//
// THIS IS THE LOAD-BEARING HALF, more than the index is.
//
// `book-named-index.ts` generates "person -> everywhere they appear" from in-text
// `consent:begin` markers. Everything it lists is real. What it cannot tell you is
// what it MISSED — a person named in the prose with no marker on them is simply
// absent from their own index entry, and the entry looks complete either way.
//
// That is the failure class this repo is built against, with one difference that
// matters: here the cost lands on a named third party rather than on CI. Someone is
// shown a page headed "everywhere you appear", they read it, they say yes — and the
// book says something else about them somewhere nobody marked. A silent
// under-report at that moment is worse than having no index, because the index is
// what persuaded them they had seen everything.
//
// So this audit scans the prose for the declared identifying strings of every person
// on the roster and compares against marker coverage:
//
//   UNMARKED_APPEARANCE  a `named` subject appears outside every consent span
//   NAME_LEAK            a `role-only` / `pending` subject appears AT ALL
//   REVOKED_APPEARANCE   a subject whose consent fold is revoked still appears
//   INDEX_STALE          the committed derived index disagrees with the corpus
//   NO_ALIASES_DECLARED  a roster entry the scan cannot see (advisory)
//   ROSTER_EMPTY         nobody is on the roster (advisory, and it says so loudly)
//
// WHAT IT CANNOT CATCH, stated plainly rather than implied away: a person described
// identifiably WITHOUT being named. This is a string matcher. "My business partner
// from the 2007 company" identifies someone precisely and contains no alias, and no
// amount of pattern work fixes that in general — it is a judgement about what a
// reader could infer. The partial mitigation is that `aliases` accepts role phrases
// as well as names, so a declared descriptor IS caught; the residue is human review,
// and NAMED-INDEX-DESIGN.md carries it as an explicit "not claimed" row rather than
// as coverage.
//
// TIERS — the same split `audit-consent-signoff.ts` draws, for the same reason. A
// FALSE CLAIM (the index says this is everywhere you appear, and it is not) is a
// defect at any stakes and fails on every PR. INSUFFICIENT CONSENT (a revoked name
// still in the text) fails at `--publish`, which is where the maintainer draws the
// hard demarcation between a disputable public draft and a distributable book.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-book-named-index.ts
//   bun src/Core.TypeScript/hygiene/audit-book-named-index.ts --publish
//   bun src/Core.TypeScript/hygiene/audit-book-named-index.ts --parser-conformance

import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  type AliasHit,
  collectSpans,
  corpusFiles,
  DEFAULT_CORPUS,
  DEFAULT_LEDGER,
  type IndexPersonRecord,
  MACHINERY_BASENAMES,
  parseRoster,
  readTextOrNull,
  repoRoot,
  RosterError,
  scanAliases,
  type SpanRecord,
  SpanError,
} from "./book-consent-spans.ts";
import { buildSnapshot, deriveRevoked, renderSnapshotJson, renderSnapshotMarkdown } from "./book-named-index.ts";
import { DEFAULT_INDEX_JSON, DEFAULT_INDEX_MD } from "./book-consent-spans.ts";

export type FindingCode =
  | "UNMARKED_APPEARANCE"
  | "NAME_LEAK"
  | "REVOKED_APPEARANCE"
  | "INDEX_STALE"
  | "NO_ALIASES_DECLARED"
  | "ROSTER_EMPTY";

/** Codes that fail only under `--publish`. See the TIERS note in the header. */
export const PUBLISH_ONLY_CODES: ReadonlySet<FindingCode> = new Set<FindingCode>(["REVOKED_APPEARANCE"]);

/** Codes that never fail — they report a weakness in the check itself. */
export const ADVISORY_CODES: ReadonlySet<FindingCode> = new Set<FindingCode>([
  "NO_ALIASES_DECLARED",
  "ROSTER_EMPTY",
]);

export interface Finding {
  code: FindingCode;
  severity: "fail" | "advisory";
  person: string;
  detail: string;
}

export interface Report {
  publishMode: boolean;
  filesScanned: number;
  filesExcluded: string[];
  spansFound: number;
  peopleOnRoster: number;
  aliasesDeclared: number;
  markedAppearances: number;
  unmarkedAppearances: number;
  findings: Finding[];
}

export interface VerifyOptions {
  rosterPath?: string;
  corpusDirs?: readonly string[];
  publish?: boolean;
}

function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function severityOf(code: FindingCode, publish: boolean): "fail" | "advisory" {
  if (ADVISORY_CODES.has(code)) return "advisory";
  if (PUBLISH_ONLY_CODES.has(code) && !publish) return "advisory";
  return "fail";
}

export function verify(opts: VerifyOptions = {}): Report {
  const root = repoRoot();
  const rosterPath = opts.rosterPath ?? DEFAULT_LEDGER;
  const corpus = opts.corpusDirs ?? DEFAULT_CORPUS;
  const publish = opts.publish === true;

  const rosterText = readTextOrNull(resolve(root, rosterPath));
  if (rosterText === null) {
    throw new RosterError(
      `roster not found at ${rosterPath} (root ${root}). Reporting "no findings" with no roster would be a check that never ran.`,
    );
  }
  const { people, rawEvents } = parseRoster(rosterText, rosterPath);
  const { spans } = collectSpans(corpus);
  const revoked = deriveRevoked(rawEvents);

  const spansByFile = new Map<string, SpanRecord[]>();
  for (const s of spans.values()) {
    const list = spansByFile.get(s.file);
    if (list) list.push(s);
    else spansByFile.set(s.file, [s]);
  }

  const all = corpusFiles(corpus);
  const excluded = all.filter((f) => MACHINERY_BASENAMES.includes(basename(f)));
  const scanned = all.filter((f) => !MACHINERY_BASENAMES.includes(basename(f)));

  const hits: AliasHit[] = [];
  for (const rel of scanned) {
    hits.push(
      ...scanAliases(readFileSync(resolve(root, rel), "utf8"), rel, people, spansByFile.get(rel) ?? []),
    );
  }

  const raw: Omit<Finding, "severity">[] = [];

  if (people.size === 0) {
    raw.push({
      code: "ROSTER_EMPTY",
      person: "-",
      detail:
        "zero people on the roster, so this audit looked for nothing and found nothing. THAT IS A COUNT, NOT A CLEARANCE — the book names real people today. `bun src/Core.TypeScript/hygiene/book-named-index.ts --suggest-roster` prints candidate entries read from CONSENT-LEDGER.md.",
    });
  }

  for (const p of [...people.values()].sort((a, b) => ordinal(a.person, b.person))) {
    const state = revoked.has(p.person) ? "revoked" : p.indexState;
    const mine = hits.filter((h) => h.person === p.person);

    if (p.aliases.length === 0) {
      raw.push({
        code: "NO_ALIASES_DECLARED",
        person: p.person,
        detail: `"${p.person}" is on the roster with zero aliases, so the prose scan for them matches nothing and cannot fail. Declare every string that identifies them — names, nicknames, handles, and ROLE PHRASES — or the coverage claim for this person is empty.`,
      });
    }

    if (state === "role-only" || state === "pending") {
      for (const h of unique(mine)) {
        raw.push({
          code: "NAME_LEAK",
          person: p.person,
          detail: `${h.file}:${h.line}: "${p.person}" is \`${state}\` — carried WITHOUT their name — and the alias "${h.alias}" appears here${h.spanId ? ` (inside span \`${h.spanId}\`)` : ""}. ${
            state === "pending"
              ? "Pending means asked and not yet answered; it enforces the same constraint as role-only on purpose, because treating an unanswered ask as probably-fine is the failure this mechanism exists to prevent."
              : "This is a settled disposition, not a soft preference."
          } Line: ${clip(h.lineText)}`,
        });
      }
      continue;
    }

    if (state === "revoked") {
      for (const h of unique(mine)) {
        raw.push({
          code: "REVOKED_APPEARANCE",
          person: p.person,
          detail: `${h.file}:${h.line}: the consent fold leaves "${p.person}" REVOKED with no surviving grant, and the alias "${h.alias}" still appears here. Line: ${clip(h.lineText)}`,
        });
      }
      continue;
    }

    for (const h of unique(mine.filter((x) => x.spanId === null))) {
      raw.push({
        code: "UNMARKED_APPEARANCE",
        person: p.person,
        detail: `${h.file}:${h.line}: "${p.person}" appears here (matched alias "${h.alias}") and the line is inside no consent span, so this appearance is MISSING from their entry in the derived index. A subject shown that entry would be told they had seen everything about them, and they would not have. Wrap the passage in consent:begin/consent:end with person="${p.person}". Line: ${clip(h.lineText)}`,
      });
    }
  }

  // The derived index must actually be derived. A committed copy that no longer
  // matches the corpus is coverage that LOOKS complete and is not — the same defect
  // as an unmarked appearance, arriving through the other door.
  const snap = buildSnapshot({ rosterPath, corpusDirs: corpus });
  for (const [path, expected] of [
    [DEFAULT_INDEX_JSON, renderSnapshotJson(snap)],
    [DEFAULT_INDEX_MD, renderSnapshotMarkdown(snap)],
  ] as const) {
    const committed = readTextOrNull(resolve(root, path));
    if (committed === null) {
      raw.push({
        code: "INDEX_STALE",
        person: "-",
        detail: `${path} is missing. The derived index must be committed, or nothing can detect its drift.`,
      });
    } else if (committed !== expected) {
      raw.push({
        code: "INDEX_STALE",
        person: "-",
        detail: `${path} disagrees with the corpus. Regenerate with \`bun src/Core.TypeScript/hygiene/book-named-index.ts --write\`; do not hand-edit it.`,
      });
    }
  }

  const findings = raw
    .map((f) => ({ ...f, severity: severityOf(f.code, publish) }) as Finding)
    .sort((a, b) => ordinal(a.code, b.code) || ordinal(a.person, b.person) || ordinal(a.detail, b.detail));

  return {
    publishMode: publish,
    filesScanned: scanned.length,
    filesExcluded: excluded,
    spansFound: spans.size,
    peopleOnRoster: people.size,
    aliasesDeclared: [...people.values()].reduce((n: number, p: IndexPersonRecord) => n + p.aliases.length, 0),
    // Counted per (file, line, person), not per raw alias hit: a person with three
    // declared aliases that all match one sentence appears ONCE there, and a count
    // inflated by alias-list length would misreport how much of the book is covered.
    markedAppearances: unique(hits.filter((h) => h.spanId !== null)).length,
    unmarkedAppearances: unique(hits.filter((h) => h.spanId === null)).length,
    findings,
  };
}

/** One entry per (file, line, person) — an alias list with overlaps must not multiply. */
function unique(hits: readonly AliasHit[]): AliasHit[] {
  const seen = new Set<string>();
  const out: AliasHit[] = [];
  for (const h of [...hits].sort((a, b) => ordinal(a.file, b.file) || a.line - b.line || ordinal(a.person, b.person))) {
    const key = `${h.file}:${h.line}:${h.person}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function clip(s: string): string {
  return s.length <= 120 ? s : `${s.slice(0, 117)}...`;
}

export function exitCodeFor(report: Report): number {
  return report.findings.some((f) => f.severity === "fail") ? 1 : 0;
}

export function formatReport(report: Report): string {
  const L: string[] = [];
  L.push(`named-index coverage audit — mode: ${report.publishMode ? "PUBLISH GATE" : "repo (false-claim checks)"}`);
  L.push(`  prose files scanned        : ${report.filesScanned}`);
  L.push(`  book-machinery files SKIPPED: ${report.filesExcluded.length} — ${report.filesExcluded.join(", ") || "(none present)"}`);
  L.push(`    (the whole exclusion list, present or not: ${MACHINERY_BASENAMES.join(", ")})`);
  L.push(`  consent spans found        : ${report.spansFound}`);
  L.push(`  people on roster           : ${report.peopleOnRoster}`);
  L.push(`  identifying strings declared: ${report.aliasesDeclared}`);
  L.push(`  alias hits inside a span   : ${report.markedAppearances}`);
  L.push(`  alias hits outside any span: ${report.unmarkedAppearances}`);
  L.push(
    "  NOT CHECKED: a person described identifiably but not named. This is a string matcher; that case is human review. See NAMED-INDEX-DESIGN.md.",
  );
  if (report.findings.length === 0) {
    L.push("  findings : none");
    return L.join("\n");
  }
  const fails = report.findings.filter((f) => f.severity === "fail").length;
  L.push(`  findings : ${report.findings.length} (${fails} failing, ${report.findings.length - fails} advisory)`);
  for (const f of report.findings) {
    L.push(`    [${f.severity === "fail" ? "FAIL" : "advisory"}] ${f.code} (${f.person})`);
    L.push(`      ${f.detail}`);
  }
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Parser conformance against audit-consent-signoff.ts (#15619)
// ---------------------------------------------------------------------------

export interface ConformanceResult {
  /** 0 agree · 1 disagree · 3 counterpart absent, which is UNCHECKED and never a pass */
  code: 0 | 1 | 3;
  message: string;
}

/**
 * Compare this module's `collectSpans` against `audit-consent-signoff.ts`'s over the
 * real corpus.
 *
 * #15619 was open and unmerged when this landed, so the counterpart is normally
 * absent and the answer is **3, UNCHECKED — never 0**. That is the honest report:
 * a check whose subject is not present has not passed, and the exit-3 convention is
 * already how `audit-consent-signoff.ts` reports an unfetched review. When the file
 * arrives this becomes a live comparison with no edit here.
 */
export async function checkParserConformance(counterpartPath: string): Promise<ConformanceResult> {
  const root = repoRoot();
  const abs = resolve(root, counterpartPath);
  if (!existsSync(abs)) {
    return {
      code: 3,
      message:
        `UNCHECKED: ${counterpartPath} is not in the tree, so the two span parsers were not compared. ` +
        "That file arrives with PR #15619; until it does this is a check that did not run, and exit 3 is not a pass. " +
        "The golden vector in book-consent-spans.golden.json is what constrains the parser in the meantime.",
    };
  }
  const mod = (await import(abs)) as { collectSpans?: (dirs: readonly string[]) => { spans: Map<string, unknown> } };
  if (typeof mod.collectSpans !== "function") {
    return { code: 1, message: `${counterpartPath} exports no collectSpans — the parsers cannot be compared.` };
  }

  const mine = collectSpans(DEFAULT_CORPUS).spans;
  const theirs = mod.collectSpans(DEFAULT_CORPUS).spans;

  const diffs: string[] = [];
  const ids = [...new Set([...mine.keys(), ...theirs.keys()])].sort(ordinal);
  for (const id of ids) {
    const a = mine.get(id);
    const b = theirs.get(id) as { sha256?: string; file?: string; beginLine?: number } | undefined;
    if (!a) {
      diffs.push(`${id}: seen by audit-consent-signoff.ts, NOT by book-consent-spans.ts`);
    } else if (!b) {
      diffs.push(`${id}: seen by book-consent-spans.ts, NOT by audit-consent-signoff.ts`);
    } else if (a.sha256 !== b.sha256) {
      diffs.push(`${id}: passage hash differs — ${a.sha256} vs ${b.sha256}`);
    } else if (a.file !== b.file || a.beginLine !== b.beginLine) {
      diffs.push(`${id}: location differs — ${a.file}:${a.beginLine} vs ${b.file}:${b.beginLine}`);
    }
  }
  if (diffs.length > 0) {
    return {
      code: 1,
      message:
        `the two span parsers DISAGREE on ${diffs.length} span(s). One vocabulary, two readings, is the Babel failure in miniature — collapse them per NAMED-INDEX-DESIGN.md "Integration point".\n  ` +
        diffs.join("\n  "),
    };
  }
  return { code: 0, message: `span parsers agree on all ${ids.length} span(s) in the corpus.` };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface CliIo {
  out: (s: string) => void;
  err: (s: string) => void;
}

export const COUNTERPART = "src/Core.TypeScript/hygiene/audit-consent-signoff.ts";

export async function main(argv: readonly string[], io: CliIo): Promise<number> {
  const args = [...argv];
  const has = (f: string): boolean => args.includes(f);
  const valueOf = (f: string): string | undefined => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };

  if (has("--parser-conformance")) {
    const res = await checkParserConformance(valueOf("--counterpart") ?? COUNTERPART);
    (res.code === 0 ? io.out : io.err)(`parser conformance: ${res.message}\n`);
    return res.code;
  }

  let report: Report;
  try {
    report = verify({ rosterPath: valueOf("--roster") ?? DEFAULT_LEDGER, publish: has("--publish") });
  } catch (e) {
    if (e instanceof SpanError || e instanceof RosterError) {
      io.err(`configuration error: ${e.message}\n`);
      return 2;
    }
    io.err(`error: ${(e as Error).message}\n`);
    return 2;
  }

  io.out(has("--json") ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
  return exitCodeFor(report);
}

if (import.meta.main) {
  process.exit(
    await main(process.argv.slice(2), {
      out: (s) => process.stdout.write(s),
      err: (s) => process.stderr.write(s),
    }),
  );
}
