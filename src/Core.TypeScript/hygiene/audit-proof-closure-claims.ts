#!/usr/bin/env bun
// audit-proof-closure-claims.ts — find proof files whose PROSE claims closure
// ("no sorry", "no axiom", "the proof chain is CLOSED") while their CODE still
// carries an incompleteness marker (`sorry`, `admit`, `axiom`).
//
// Why this exists
// ---------------
// Live instance, 2026-08-10 (`src/Core.Lean4/ImaginaryStack/PhaseClockErasure.lean`):
// a comment block asserted "The ECC proof chain is CLOSED: no axiom, no sorry,
// non-vacuous" while `xorshift_mod17_in_rsCode`, 24 lines below it, was proven by
// `sorry`. The file's own top-of-file scope note still said OPEN, so the drift was
// between two comments in one file and the code disagreed with the newer one.
//
// The failure mode is specific and worth naming: `sorry` makes Lean ACCEPT the
// file, so a green build is not evidence. A reader greps for "closed", finds a
// sentence saying closed, and never looks at the tactic block. That is the
// vacuity class — a check that cannot fail is not a check — applied to prose.
//
// This is a DRIFT detector, not a gate. It reports; it does not edit, and it does
// not judge whether the `sorry` is justified. A `sorry` with an honest "OPEN"
// note beside it is fine and reports clean. Only the CONTRADICTION is drift.
//
// The one design subtlety
// -----------------------
// The claim sentence itself contains the word "sorry" ("no axiom, no sorry"). So
// markers must be counted in CODE ONLY and claims in COMMENTS ONLY — otherwise
// every honest claim flags itself. Comments are stripped before marker scanning,
// which is why this cannot be a grep.
//
// Rule 0: TypeScript (no .sh) per `.claude/rules/rule-0-no-sh-files.md`.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-proof-closure-claims.ts
//   bun src/Core.TypeScript/hygiene/audit-proof-closure-claims.ts --json
//   bun src/Core.TypeScript/hygiene/audit-proof-closure-claims.ts --surfaces src/Core.Lean4
//
// Exit codes:
//   0   no contradictions
//   1   one or more files claim closure while carrying a marker
//   2   configuration error (requested surface missing)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

const DEFAULT_SURFACES = ["src/Core.Lean4"];
const SKIP_DIRS = new Set([".lake", "node_modules", ".git", "lakefile", "build"]);

/** Incompleteness markers, matched against comment-stripped code. */
const MARKERS: readonly { name: string; re: RegExp }[] = [
  // `sorry` / `admit` as standalone tokens — not `sorryAx`, not part of an identifier.
  { name: "sorry", re: /(?<![A-Za-z0-9_'.])sorry(?![A-Za-z0-9_'])/g },
  { name: "admit", re: /(?<![A-Za-z0-9_'.])admit(?![A-Za-z0-9_'])/g },
  // `axiom foo : ...` — a declaration, so require the trailing name.
  { name: "axiom", re: /(?<![A-Za-z0-9_'.])axiom\s+[A-Za-z_]/g },
];

/**
 * An inductive CONSTRUCTOR named `admit` / `sorry` is not an incompleteness
 * marker. Live false positive: `Safety/ChildFloor.lean` declares
 * `inductive Verdict where | admit | deny` — a capability verdict, the exact
 * opposite of an unfinished proof. A leading `|` is the discriminator.
 */
const CONSTRUCTOR_LINE = /^\s*\|\s*[A-Za-z_]/;

/**
 * A claim that is SCOPED to an enumerated set, or that narrates history, is not
 * a file-wide closure assertion — so a marker elsewhere does not contradict it.
 *
 * Live instance: `FinDataProcessing.lean` says "SORRY-FREE ... — 13 declarations:"
 * (scoped to a list) and separately narrates that an earlier version "contained
 * no `sorry`". Its one real `sorry` is flagged in place as an open obligation.
 * That file is HONEST, and a detector that shouts at it teaches people to ignore
 * the detector.
 */
const SCOPED_CLAIM = [
  /\b\d+\s+declarations?\b/i,
  /\bthe following\b/i,
  /\blisted below\b/i,
  /\bthese\s+(?:\w+\s+)?(?:theorems?|lemmas?|declarations?)\b/i,
  // historical / quoted narration rather than a present-tense assertion
  /\b(?:contained|was|were|previously|used to|originally|earlier)\b/i,
  /\bbanner\s+reading\b/i,
];

/**
 * An incompleteness note near the marker means the marker is DECLARED. That is
 * still not a licence for a file-wide closure claim elsewhere (the live
 * PhaseClockErasure case declares its `sorry` in place AND claims the chain is
 * closed 24 lines above), but it is recorded so the report can say so.
 */
const MARKER_DISCLAIMER =
  /\b(?:OPEN|TODO|pending|not\s+a\s+complete\s+proof|until\s+this\s+is\s+discharged|unproven|open\s+obligation)\b/i;
const DISCLAIMER_WINDOW = 8;

/**
 * Prose assertions that the proof is complete. Deliberately narrow: these must
 * assert ABSENCE or CLOSURE, never merely mention the words. "OPEN: needs the
 * minimal polynomial computation" must NOT match.
 */
const CLAIMS: readonly { name: string; re: RegExp }[] = [
  { name: "no-sorry", re: /\bno\s+`?sorry`?\b/i },
  { name: "no-axiom", re: /\bno\s+`?axioms?`?\b/i },
  { name: "zero-sorry", re: /\bzero\s+`?sorry`?\b/i },
  { name: "sorry-free", re: /\bsorry[-\s]free\b/i },
  { name: "axiom-free", re: /\baxiom[-\s]free\b/i },
  { name: "without-sorry", re: /\bwithout\s+(?:any\s+)?`?sorry`?\b/i },
  { name: "chain-closed", re: /\b(?:proof\s+)?chain\s+is\s+CLOSED\b/i },
  { name: "fully-proven", re: /\bfully\s+(?:proven|proved|mechanized|formalized)\b/i },
];

export interface Finding {
  file: string;
  /** `scoped` claims (enumerated or historical) never trigger on their own. */
  claims: { line: number; kind: string; text: string; scoped: boolean }[];
  /** `declared` = an incompleteness note sits within 8 lines of the marker. */
  markers: { line: number; kind: string; declared: boolean }[];
}

export interface AuditResult {
  scanned: number;
  findings: Finding[];
}

/**
 * Replace Lean comments with equal-length whitespace, preserving newlines so
 * line numbers of the surviving code are unchanged. Handles `--` line comments
 * and NESTED `/- ... -/` blocks (Lean nests; `/-!` is a doc block, same rule).
 */
export function stripLeanComments(src: string): string {
  const out = src.split("");
  let i = 0;
  let depth = 0;
  const blank = (at: number) => {
    if (out[at] !== "\n") out[at] = " ";
  };
  while (i < src.length) {
    if (depth === 0 && src.startsWith("--", i)) {
      while (i < src.length && src[i] !== "\n") blank(i++);
      continue;
    }
    if (src.startsWith("/-", i)) {
      depth++;
      blank(i++);
      blank(i++);
      continue;
    }
    if (depth > 0 && src.startsWith("-/", i)) {
      depth--;
      blank(i++);
      blank(i++);
      continue;
    }
    if (depth > 0) blank(i);
    i++;
  }
  return out.join("");
}

/** Extract only the comment text, line-numbered — the inverse of the above. */
function commentLines(src: string): { line: number; text: string }[] {
  const stripped = stripLeanComments(src);
  const srcLines = src.split("\n");
  const strippedLines = stripped.split("\n");
  const rows: { line: number; text: string }[] = [];
  for (let n = 0; n < srcLines.length; n++) {
    const original = srcLines[n] ?? "";
    const code = (strippedLines[n] ?? "").trim();
    // A line contributes comment text when stripping removed something from it.
    if (original.trim() !== code) rows.push({ line: n + 1, text: original.trim() });
  }
  return rows;
}

export function auditFile(relPath: string, src: string): Finding | null {
  const code = stripLeanComments(src);
  const codeLines = code.split("\n");
  const comments = commentLines(src);

  const markers: { line: number; kind: string; declared: boolean }[] = [];
  for (let n = 0; n < codeLines.length; n++) {
    const text = codeLines[n] ?? "";
    if (CONSTRUCTOR_LINE.test(text)) continue; // inductive constructor, not a tactic
    for (const m of MARKERS) {
      m.re.lastIndex = 0;
      if (!m.re.test(text)) continue;
      const line = n + 1;
      const declared = comments.some(
        (c) => Math.abs(c.line - line) <= DISCLAIMER_WINDOW && MARKER_DISCLAIMER.test(c.text),
      );
      markers.push({ line, kind: m.name, declared });
    }
  }
  if (markers.length === 0) return null;

  const claims: { line: number; kind: string; text: string; scoped: boolean }[] = [];
  for (const row of comments) {
    for (const c of CLAIMS) {
      if (!c.re.test(row.text)) continue;
      claims.push({
        line: row.line,
        kind: c.name,
        text: row.text,
        scoped: SCOPED_CLAIM.some((s) => s.test(row.text)),
      });
    }
  }
  // Only an UNSCOPED, present-tense closure claim is contradicted by a marker.
  if (claims.length === 0 || claims.every((c) => c.scoped)) return null;

  return { file: relPath, claims, markers };
}

function walkLean(dir: string, acc: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkLean(full, acc);
    else if (entry.endsWith(".lean")) acc.push(full);
  }
}

export function runAudit(surfaces: string[]): AuditResult {
  const root = repoRoot();
  const files: string[] = [];
  for (const s of surfaces) walkLean(resolve(root, s), files);

  const findings: Finding[] = [];
  for (const f of files.sort()) {
    let src: string;
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    const finding = auditFile(relative(root, f), src);
    if (finding) findings.push(finding);
  }
  return { scanned: files.length, findings };
}

function renderHuman(out: AuditResult): string {
  if (out.findings.length === 0) {
    return `proof-closure-claims: OK — ${out.scanned} file(s) scanned, no closure claim contradicted by a marker.`;
  }
  const lines: string[] = [
    `proof-closure-claims: DRIFT — ${out.findings.length} file(s) claim closure while carrying an incompleteness marker.`,
    "",
    "A `sorry` makes the file COMPILE, so a green build is not evidence here.",
    "Fix by correcting whichever is wrong — discharge the marker, or retract the claim.",
    "",
  ];
  for (const f of out.findings) {
    lines.push(`  ${f.file}`);
    for (const c of f.claims.filter((c) => !c.scoped)) {
      lines.push(`    claim  :${c.line} [${c.kind}] ${c.text}`);
    }
    for (const m of f.markers) {
      lines.push(`    marker :${m.line} ${m.kind}${m.declared ? " (declared in place)" : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function main(argv: string[]): number {
  const json = argv.includes("--json");
  const sIdx = argv.indexOf("--surfaces");
  const surfaces =
    sIdx >= 0 ? argv.slice(sIdx + 1).filter((a) => !a.startsWith("--")) : [...DEFAULT_SURFACES];

  if (surfaces.length === 0) {
    process.stderr.write("error: --surfaces given with no paths\n");
    return 2;
  }
  const root = repoRoot();
  const missing = surfaces.filter((s) => {
    try {
      return !statSync(resolve(root, s)).isDirectory();
    } catch {
      return true;
    }
  });
  if (missing.length > 0) {
    process.stderr.write(`error: surface(s) not found under ROOT=${root}: ${missing.join(", ")}\n`);
    return 2;
  }

  const out = runAudit(surfaces);
  process.stdout.write(
    (json ? JSON.stringify(out, null, 2) : renderHuman(out)) + "\n",
  );
  return out.findings.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
