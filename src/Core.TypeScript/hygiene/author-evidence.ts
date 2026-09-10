#!/usr/bin/env bun
// author-evidence.ts — the meter for `.authorevidence`, the AI-relevant `.editorconfig`.
//
// ── WHAT THIS IS FOR ──────────────────────────────────────────────────────────────
//
// A commit message ABOUT raw control bytes was refused for CONTAINING one. Asked why an
// LLM would do that, the answer was that the raw byte and its `\u001b` escape are
// adjacent in output space and cost the same to emit, so nothing separates *use* from
// *mention* unless the context supplies it. Aaron, 2026-09-10:
//
//   "for humans typing ESC is much easier than any escape or control characters, these
//    require devious [effort] but i always choose the accidental over the malicious until
//    overwhelmingly proved otherwise ... it seems like we need some super advanced ai
//    relevant .editorconfig like thing tracking this and then it will be easier to agree
//    on what matters when."
//
// The asymmetry, stated precisely. For a HUMAN author, putting a raw 0x1B into source
// takes deliberate effort — Ctrl-V quoting, a hex editor, a paste out of terminal output.
// Effort is evidence. For an LLM author the raw byte and the escape are equidistant and
// both cost one token, so the SAME ARTIFACT carries no intent signal at all. The diff is
// byte-identical either way, and the naive reading — "someone went out of their way to
// put an ESC here" — is exactly wrong for the now-common case.
//
// So this file is a METER (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`).
// It reports: this deviation, at this line, authored by this class, whose effort cost for
// that class is X, therefore whose evidential weight is Y. It emits no verdict, and it has
// no field in which one could be written. The judgement stays with a human or a policy
// layer, and the meter's MOST IMPORTANT OUTPUT IS OFTEN `weight: none` — a declaration
// that this observation discriminates nothing about intent and must not be read as if it
// did.
//
// ── WHY A DECLARATION FILE AND NOT MORE AUDITS ────────────────────────────────────
//
// The audits already exist and already refuse — `audit-no-raw-nul-in-source.ts` is the
// canonical one. What does not exist anywhere is a written-down, machine-checkable answer
// to "what does this deviation MEAN, and how much should it move anyone's belief?" That
// answer currently lives in reviewers' heads, where it is exactly the prior that AI
// authorship has silently inverted. `.authorevidence` makes it text: diffable, arguable
// in a PR, and refused by a parser when it is incoherent.
//
// It COMPOSES with the audits rather than replacing them. Every declaration names the
// `gate` that refuses the deviation. A declaration whose gate is `none` is reported as
// ungated, which is a useful fact and not a failure: it says the repo has an opinion about
// a form nothing yet enforces.
//
// ── THE THREE REFUSALS (what makes this a check and not a document) ───────────────
//
// 1. COHERENCE. `weight` may never exceed what `effort` supports. Zero effort admits only
//    `weight = none`. A declaration reading "LLM + raw ESC ⇒ strong evidence" is REFUSED
//    by the parser. This is the anti-inference rule made mechanical: the format cannot
//    express the belief the thesis says is wrong.
// 2. VOCABULARY. `consequence` states a mechanical outcome. Intent words — malicious,
//    suspicious, sabotage, deliberate — are refused there. A meter that says "suspicious"
//    is an oracle wearing a meter's clothes, and prose is where one sneaks in.
// 3. PROBES. Every declaration ships `probe-deviation` and `probe-canonical`, and the
//    checker runs the detector against both: it MUST fire on the first and MUST NOT fire
//    on the second. A signal whose detector cannot tell its own canonical form from its
//    own deviation is refused. That is the vacuity guard — without it a declaration could
//    name a detector that never fires and look like coverage forever.
//
// ── HONEST LIMITS, STATED UP FRONT ────────────────────────────────────────────────
//
// * Author class is resolved from AgencySignature trailers via `git blame`. Blame
//   attributes a LINE to the commit that last touched it, which is not always the commit
//   that introduced the deviation. Reported as-is; it is a provenance approximation and
//   labelled one in the output.
// * `human` is a declarable class and is, in this repository, nearly unreachable:
//   measured 2026-09-10 over the last 1000 commits, `Credential-Mode: human-only` occurs
//   ZERO times. Every one of those commits was made under a credential that does not
//   identify a human author. That is a fact about the repo, not about people, and it is
//   why the effort-cost prior has so little to bite on here.
// * The effort numbers are DECLARED, not measured. They are a `toy` model in the sense of
//   `.claude/rules/toy-is-free-metered-must-be-earned.md`. What is metered is the
//   COHERENCE of the declarations and the FIRING of the detectors, not the truth of the
//   effort estimates. The doc says so too; saying it in one place only would be the drift.

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { findSignatureBlock, blockValue } from "./agencysignature-block.ts";

// ─────────────────────────────────────────────────────────────────────────────────
// Ordinal scales. Ordinal on purpose (`db/uncertainty/README.md`'s register): these are
// ranks, never numbers to average. Index order IS the order.
// ─────────────────────────────────────────────────────────────────────────────────

export const EFFORT_SCALE = ["zero", "trivial", "moderate", "high"] as const;
export type Effort = (typeof EFFORT_SCALE)[number];

export const WEIGHT_SCALE = ["none", "weak", "moderate", "strong"] as const;
export type Weight = (typeof WEIGHT_SCALE)[number];

/**
 * Author classes the resolver can actually emit. A class the resolver cannot produce
 * would make every weight declared for it a dead letter, so the set is closed to what
 * `resolveAuthorClass` can return.
 */
export const AUTHOR_CLASSES = ["human", "llm", "generator", "unknown"] as const;
export type AuthorClass = (typeof AUTHOR_CLASSES)[number];

/**
 * The ceiling: an effort of rank i admits a weight of at most rank i.
 *
 * The mapping is deliberately the identity on ranks rather than a tuned curve. A tuned
 * curve would be a model asserting how much a given effort licenses, which is exactly the
 * unmeasured quantity; the identity asserts only the monotone claim the thesis actually
 * supports — MORE effort can license MORE weight, and zero effort licenses nothing.
 */
export function weightCeiling(effort: Effort): Weight {
  const idx = EFFORT_SCALE.indexOf(effort);
  return WEIGHT_SCALE[idx] ?? "none";
}

export function effortRank(e: Effort): number {
  return EFFORT_SCALE.indexOf(e);
}

export function weightRank(w: Weight): number {
  return WEIGHT_SCALE.indexOf(w);
}

// ─────────────────────────────────────────────────────────────────────────────────
// Detectors. Built-in and named, never an arbitrary command: a declaration file that can
// name any executable is a declaration file that can run anything, and the point of this
// artifact is that it is cheap and safe enough to sit on a floor job.
// ─────────────────────────────────────────────────────────────────────────────────

export interface DetectedSite {
  /** 1-based line number. */
  readonly line: number;
  /** What was found, in text — never the raw bytes themselves. */
  readonly detail: string;
}

export type Detector = (bytes: Uint8Array) => readonly DetectedSite[];

/**
 * C0 control bytes and DEL, excluding tab / LF / CR.
 *
 * Counts lines by 0x0A over the RAW BYTES rather than decoding first — decoding is the
 * step that could normalise away the thing being looked for, and a check must not be able
 * to lose its own subject on the way in. Same reasoning as
 * `audit-no-raw-nul-in-source.ts`'s `findRawNulSites`, and deliberately the same shape.
 */
export const detectC0ControlBytes: Detector = (bytes) => {
  const perLine = new Map<number, number[]>();
  let line = 1;
  for (const b of bytes) {
    if (b === 0x0a) {
      line += 1;
      continue;
    }
    if (b === 0x09 || b === 0x0d) continue;
    if (b < 0x20 || b === 0x7f) {
      const acc = perLine.get(line) ?? [];
      acc.push(b);
      perLine.set(line, acc);
    }
  }
  return [...perLine.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([l, codes]) => ({
      line: l,
      detail: codes.map((c) => `0x${c.toString(16).toUpperCase().padStart(2, "0")}`).join(" "),
    }));
};

/**
 * Characters that occupy no visual space: zero-width, soft hyphen, BOM, word joiner, and
 * the bidirectional overrides.
 *
 * The bidi set is here because it is the sharpest published instance of the general
 * problem — Boucher & Anderson, *Trojan Source* (2023) — where source that renders one way
 * compiles another. Under the old prior a bidi override in a diff was near-proof of
 * intent, since nobody types one by accident. That inference is exactly what this file
 * exists to stop being made automatically.
 */
export const INVISIBLE_CODEPOINTS: readonly number[] = [
  0x00ad, // SOFT HYPHEN
  0x200b,
  0x200c,
  0x200d, // ZWSP / ZWNJ / ZWJ
  0x200e,
  0x200f, // LRM / RLM
  0x202a,
  0x202b,
  0x202c,
  0x202d,
  0x202e, // bidi embedding + override
  0x2060, // WORD JOINER
  0x2066,
  0x2067,
  0x2068,
  0x2069, // bidi isolates
  0xfeff, // BOM / ZWNBSP
];

const INVISIBLE_SET = new Set(INVISIBLE_CODEPOINTS);

export const detectInvisibleCharacters: Detector = (bytes) => {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const perLine = new Map<number, number[]>();
  let line = 1;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x0a) {
      line += 1;
      continue;
    }
    if (INVISIBLE_SET.has(cp)) {
      const acc = perLine.get(line) ?? [];
      acc.push(cp);
      perLine.set(line, acc);
    }
  }
  return [...perLine.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([l, cps]) => ({
      line: l,
      detail: cps.map((c) => `U+${c.toString(16).toUpperCase().padStart(4, "0")}`).join(" "),
    }));
};

/** A line that ends in space or tab and is not itself blank. */
export const detectTrailingWhitespace: Detector = (bytes) => {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const out: DetectedSite[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.length === 0) continue;
    if (line.trim().length === 0) continue;
    if (line !== line.replace(/[ \t]+$/u, "")) {
      out.push({ line: i + 1, detail: "trailing space/tab" });
    }
  }
  return out;
};

export const DETECTORS: Readonly<Record<string, Detector>> = {
  "c0-control-bytes": detectC0ControlBytes,
  "invisible-characters": detectInvisibleCharacters,
  "trailing-whitespace": detectTrailingWhitespace,
};

// ─────────────────────────────────────────────────────────────────────────────────
// The declaration record.
// ─────────────────────────────────────────────────────────────────────────────────

export interface Declaration {
  /** Path glob this declaration scopes to. */
  readonly glob: string;
  /** Signal id — the thing being declared about. */
  readonly signal: string;
  /** The form that is correct here. */
  readonly canonical: string;
  /** The form that deviates from it. */
  readonly deviation: string;
  /** Built-in detector id; must exist in DETECTORS. */
  readonly detect: string;
  /** Path of the audit that REFUSES this deviation, or the literal "none". */
  readonly gate: string;
  /** Mechanical consequence of the deviation. No intent words — see VERDICT_WORDS. */
  readonly consequence: string;
  /** Whether the deviation is undoable. Aaron's malice threshold is built on this. */
  readonly reversible: boolean;
  readonly effort: Readonly<Record<AuthorClass, Effort>>;
  readonly weight: Readonly<Record<AuthorClass, Weight>>;
  /** A sample the detector MUST fire on, written with \uXXXX escapes. */
  readonly probeDeviation: string;
  /** A sample the detector MUST NOT fire on, written with \uXXXX escapes. */
  readonly probeCanonical: string;
  /** 1-based line of the section header, for error messages. */
  readonly line: number;
}

export interface ParseError {
  readonly line: number;
  readonly message: string;
}

export interface ParseResult {
  readonly version: number | null;
  readonly declarations: readonly Declaration[];
  readonly errors: readonly ParseError[];
}

const SIGNAL_FIELDS = [
  "canonical",
  "deviation",
  "detect",
  "gate",
  "consequence",
  "reversible",
  "probe-deviation",
  "probe-canonical",
] as const;

/**
 * Decode the escape subset the declaration file may use.
 *
 * The file is TEXT and stays text: a probe for a control character is written `\u001b`,
 * six ASCII characters, and becomes the byte only in memory. Writing the raw byte into
 * `.authorevidence` would make the declaration file itself the thing it declares against —
 * and would make it unreadable to the greps that drive every other check here.
 */
export function decodeEscapes(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch !== "\\") {
      out += ch ?? "";
      continue;
    }
    const next = input[i + 1];
    if (next === "u") {
      const hex = input.slice(i + 2, i + 6);
      if (!/^[0-9a-fA-F]{4}$/u.test(hex)) {
        throw new Error(`bad \\u escape at offset ${String(i)}`);
      }
      out += String.fromCharCode(Number.parseInt(hex, 16));
      i += 5;
      continue;
    }
    if (next === "n") {
      out += "\n";
      i += 1;
      continue;
    }
    if (next === "t") {
      out += "\t";
      i += 1;
      continue;
    }
    if (next === "\\") {
      out += "\\";
      i += 1;
      continue;
    }
    throw new Error(`unsupported escape \\${next ?? "<eof>"} at offset ${String(i)}`);
  }
  return out;
}

function isAuthorClass(s: string): s is AuthorClass {
  return (AUTHOR_CLASSES as readonly string[]).includes(s);
}

/**
 * Parse `.authorevidence`.
 *
 * INI-with-globs, deliberately `.editorconfig`-shaped: `[glob]` sections, `key = value`
 * lines, `#` comments. Keys are `<signal>.<field>`, so one section may declare several
 * signals for the same paths.
 *
 * There is NO cascade and NO inheritance between sections. `.editorconfig` merges later
 * sections over earlier ones per key, which is right for formatting preferences and wrong
 * here: it would make a partially-written declaration valid, and a declaration missing its
 * weights is precisely the hole this format exists to close. Every (glob, signal) pair
 * states every field or it is refused.
 */
export function parseDeclarations(text: string): ParseResult {
  const errors: ParseError[] = [];
  const declarations: Declaration[] = [];
  let version: number | null = null;

  const lines = text.split("\n");
  let glob: string | null = null;
  let globLine = 0;
  // signal -> field -> {value, line}
  let pending = new Map<string, Map<string, { value: string; line: number }>>();

  const flush = (): void => {
    if (glob === null) return;
    for (const [signal, fields] of pending) {
      const d = buildDeclaration(glob, globLine, signal, fields, errors);
      if (d !== null) declarations.push(d);
    }
    pending = new Map();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i] ?? "";
    const lineNo = i + 1;
    const trimmed = rawLine.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#") || trimmed.startsWith(";")) continue;

    if (trimmed.startsWith("[")) {
      if (!trimmed.endsWith("]")) {
        errors.push({ line: lineNo, message: "section header does not close with ]" });
        continue;
      }
      flush();
      glob = trimmed.slice(1, -1).trim();
      globLine = lineNo;
      if (glob.length === 0) errors.push({ line: lineNo, message: "empty glob" });
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq < 0) {
      errors.push({ line: lineNo, message: `not a comment, section, or key = value: ${trimmed}` });
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();

    if (glob === null) {
      if (key === "version") {
        const n = Number.parseInt(value, 10);
        if (Number.isNaN(n)) errors.push({ line: lineNo, message: `version is not an integer: ${value}` });
        else version = n;
      } else if (key !== "root") {
        errors.push({ line: lineNo, message: `unknown preamble key: ${key}` });
      }
      continue;
    }

    const dot = key.indexOf(".");
    if (dot < 0) {
      errors.push({ line: lineNo, message: `key must be <signal>.<field>: ${key}` });
      continue;
    }
    const signal = key.slice(0, dot);
    const field = key.slice(dot + 1);
    if (!/^[a-z0-9-]+$/u.test(signal)) {
      errors.push({ line: lineNo, message: `signal id must be [a-z0-9-]+: ${signal}` });
      continue;
    }
    const known =
      (SIGNAL_FIELDS as readonly string[]).includes(field) ||
      /^effort\.[a-z-]+$/u.test(field) ||
      /^weight\.[a-z-]+$/u.test(field);
    if (!known) {
      // A silently-ignored key is the vacuity class wearing a typo. Refuse it.
      errors.push({ line: lineNo, message: `unknown field for signal ${signal}: ${field}` });
      continue;
    }
    const bucket = pending.get(signal) ?? new Map<string, { value: string; line: number }>();
    if (bucket.has(field)) {
      errors.push({ line: lineNo, message: `duplicate field ${signal}.${field}` });
      continue;
    }
    bucket.set(field, { value, line: lineNo });
    pending.set(signal, bucket);
  }
  flush();

  if (version === null) errors.push({ line: 1, message: "missing `version = 1` preamble" });
  else if (version !== 1) errors.push({ line: 1, message: `unsupported version: ${String(version)}` });

  // A (glob, signal) pair declared twice has two answers to one question.
  const seen = new Set<string>();
  for (const d of declarations) {
    const k = `${d.glob}\u0000${d.signal}`;
    if (seen.has(k)) {
      errors.push({ line: d.line, message: `duplicate declaration for (${d.glob}, ${d.signal})` });
    }
    seen.add(k);
  }

  return { version, declarations, errors };
}

function buildDeclaration(
  glob: string,
  globLine: number,
  signal: string,
  fields: ReadonlyMap<string, { value: string; line: number }>,
  errors: ParseError[],
): Declaration | null {
  let ok = true;
  const need = (field: string): string => {
    const f = fields.get(field);
    if (f === undefined) {
      errors.push({ line: globLine, message: `[${glob}] ${signal}: missing required field ${field}` });
      ok = false;
      return "";
    }
    if (f.value.length === 0) {
      errors.push({ line: f.line, message: `[${glob}] ${signal}.${field} is empty` });
      ok = false;
    }
    return f.value;
  };

  const canonical = need("canonical");
  const deviation = need("deviation");
  const detect = need("detect");
  const gate = need("gate");
  const consequence = need("consequence");
  const reversibleRaw = need("reversible");
  const probeDeviationRaw = need("probe-deviation");
  const probeCanonicalRaw = need("probe-canonical");

  const effort: Record<string, Effort> = {};
  const weight: Record<string, Weight> = {};
  for (const cls of AUTHOR_CLASSES) {
    const e = fields.get(`effort.${cls}`);
    if (e === undefined) {
      errors.push({ line: globLine, message: `[${glob}] ${signal}: missing effort.${cls}` });
      ok = false;
    } else if (!(EFFORT_SCALE as readonly string[]).includes(e.value)) {
      errors.push({ line: e.line, message: `effort must be one of ${EFFORT_SCALE.join("|")}: ${e.value}` });
      ok = false;
    } else {
      effort[cls] = e.value as Effort;
    }
    const w = fields.get(`weight.${cls}`);
    if (w === undefined) {
      errors.push({ line: globLine, message: `[${glob}] ${signal}: missing weight.${cls}` });
      ok = false;
    } else if (!(WEIGHT_SCALE as readonly string[]).includes(w.value)) {
      errors.push({ line: w.line, message: `weight must be one of ${WEIGHT_SCALE.join("|")}: ${w.value}` });
      ok = false;
    } else {
      weight[cls] = w.value as Weight;
    }
  }
  for (const [field, f] of fields) {
    const m = /^(effort|weight)\.([a-z-]+)$/u.exec(field);
    if (m !== null && !isAuthorClass(m[2] ?? "")) {
      errors.push({
        line: f.line,
        message: `unknown author class ${m[2] ?? ""} — the resolver can only emit ${AUTHOR_CLASSES.join("|")}`,
      });
      ok = false;
    }
  }

  if (reversibleRaw !== "" && reversibleRaw !== "yes" && reversibleRaw !== "no") {
    errors.push({ line: globLine, message: `[${glob}] ${signal}.reversible must be yes|no: ${reversibleRaw}` });
    ok = false;
  }

  let probeDeviation = "";
  let probeCanonical = "";
  try {
    probeDeviation = decodeEscapes(probeDeviationRaw);
    probeCanonical = decodeEscapes(probeCanonicalRaw);
  } catch (err) {
    errors.push({ line: globLine, message: `[${glob}] ${signal}: ${String(err)}` });
    ok = false;
  }

  if (!ok) return null;
  return {
    glob,
    signal,
    canonical,
    deviation,
    detect,
    gate,
    consequence,
    reversible: reversibleRaw === "yes",
    effort: effort as Record<AuthorClass, Effort>,
    weight: weight as Record<AuthorClass, Weight>,
    probeDeviation,
    probeCanonical,
    line: globLine,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// The three refusals.
// ─────────────────────────────────────────────────────────────────────────────────

export interface Violation {
  readonly glob: string;
  readonly signal: string;
  readonly kind: "coherence" | "vocabulary" | "probe" | "detector" | "gate";
  readonly message: string;
}

/**
 * REFUSAL 1 — weight may not exceed what effort supports.
 *
 * This is the thesis made mechanical. `effort = zero` admits only `weight = none`, so a
 * declaration cannot express "the LLM emitted a raw ESC, therefore that is strong evidence
 * of something". The belief the thesis says is unsupported becomes unwritable.
 *
 * `unknown` is special-cased to `none` for a separate reason: with the author class
 * unresolved there is no effort to condition on, so any nonzero weight would be an
 * inference from an absent premise. An empty result is `unknown`, never a negative.
 */
export function coherenceViolations(d: Declaration): readonly Violation[] {
  const out: Violation[] = [];
  for (const cls of AUTHOR_CLASSES) {
    const e = d.effort[cls];
    const w = d.weight[cls];
    if (weightRank(w) > weightRank(weightCeiling(e))) {
      out.push({
        glob: d.glob,
        signal: d.signal,
        kind: "coherence",
        message:
          `weight.${cls} = ${w} exceeds the ceiling ${weightCeiling(e)} set by effort.${cls} = ${e}. ` +
          "An artifact that costs an author nothing to produce cannot be strong evidence about that author.",
      });
    }
    if (cls === "unknown" && w !== "none") {
      out.push({
        glob: d.glob,
        signal: d.signal,
        kind: "coherence",
        message:
          `weight.unknown = ${w}; it must be none. With the author class unresolved there is no effort ` +
          "to condition on, so any weight here is inference from an absent premise.",
      });
    }
  }
  return out;
}

/**
 * REFUSAL 2 — no intent vocabulary in the neutral field.
 *
 * `consequence` says what mechanically follows from the deviation. These words say what
 * someone meant by it, which is the oracle's half of the split and is never the meter's to
 * write. The list is deliberately short and about INTENT specifically: mechanism words
 * (parser, binary, skipped, hidden) are fine and necessary.
 *
 * The format has no verdict field at all, so this refusal exists for the one place a
 * verdict can still be smuggled: prose nobody re-reads. That is not hypothetical — the
 * worked instance in `dual-use-detection-is-neutral-oracle-decides.md` is exactly an
 * oracle that got in through a word choice rather than through an argument.
 */
export const VERDICT_WORDS: readonly string[] = [
  "malicious",
  "malice",
  "maliciously",
  "suspicious",
  "suspiciously",
  "sabotage",
  "sabotaged",
  "adversary",
  "adversarial",
  "attacker",
  "deliberate",
  "deliberately",
  "intentional",
  "intentionally",
  "guilty",
  "culprit",
  "perpetrator",
  "fraud",
  "fraudulent",
  "evil",
  "hostile",
  "nefarious",
  "bad actor",
  "bad faith",
];

export function verdictVocabularyViolations(d: Declaration): readonly Violation[] {
  const haystack = d.consequence.toLowerCase();
  const out: Violation[] = [];
  for (const w of VERDICT_WORDS) {
    const pattern = new RegExp(`(^|[^a-z])${w.replace(/ /gu, "\\s+")}([^a-z]|$)`, "u");
    if (pattern.test(haystack)) {
      out.push({
        glob: d.glob,
        signal: d.signal,
        kind: "vocabulary",
        message:
          `consequence contains the intent word "${w}". This field states what MECHANICALLY follows ` +
          "from the deviation; what someone meant by it is the oracle's call, not the meter's.",
      });
    }
  }
  return out;
}

/**
 * REFUSAL 3 — the probes. A detector that cannot separate its own declared canonical form
 * from its own declared deviation is not a detector, it is a decoration.
 */
export function probeViolations(d: Declaration): readonly Violation[] {
  const det = DETECTORS[d.detect];
  if (det === undefined) {
    return [
      {
        glob: d.glob,
        signal: d.signal,
        kind: "detector",
        message: `unknown detector "${d.detect}"; known: ${Object.keys(DETECTORS).sort().join(", ")}`,
      },
    ];
  }
  const enc = new TextEncoder();
  const out: Violation[] = [];
  if (det(enc.encode(d.probeDeviation)).length === 0) {
    out.push({
      glob: d.glob,
      signal: d.signal,
      kind: "probe",
      message: "the detector does not fire on probe-deviation — this declaration constrains nothing",
    });
  }
  if (det(enc.encode(d.probeCanonical)).length > 0) {
    out.push({
      glob: d.glob,
      signal: d.signal,
      kind: "probe",
      message: "the detector fires on probe-canonical — it cannot tell the correct form from the deviation",
    });
  }
  return out;
}

/** The named gate must exist, or the composition claim is false. */
export function gateViolations(d: Declaration, exists: (p: string) => boolean): readonly Violation[] {
  if (d.gate === "none") return [];
  if (exists(d.gate)) return [];
  return [
    {
      glob: d.glob,
      signal: d.signal,
      kind: "gate",
      message: `gate path does not exist: ${d.gate}. A declaration naming an absent audit claims a composition it does not have.`,
    },
  ];
}

export function checkDeclarations(decls: readonly Declaration[], exists: (p: string) => boolean): readonly Violation[] {
  const out: Violation[] = [];
  for (const d of decls) {
    out.push(...coherenceViolations(d));
    out.push(...verdictVocabularyViolations(d));
    out.push(...probeViolations(d));
    out.push(...gateViolations(d, exists));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Globs.
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * `.editorconfig`-style glob: `*` within a segment, `**` across segments, `?` one char,
 * `{a,b}` alternation. Anchored whole-path.
 */
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i] ?? "";
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if (c === "{") {
      const close = glob.indexOf("}", i);
      if (close < 0) {
        out += "\\{";
      } else {
        const alts = glob.slice(i + 1, close).split(",");
        out += `(?:${alts.map((a) => a.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})`;
        i = close;
      }
    } else if (".+^$()|[]\\".includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`, "u");
}

/**
 * `.editorconfig`'s scoping rule, kept exactly: a glob containing no `/` is matched
 * against the BASENAME, so `*.ts` means "any .ts anywhere" rather than "a .ts at the repo
 * root". A glob containing `/` is anchored to the whole path.
 *
 * Kept because the point of the format is that whoever has written an `.editorconfig` can
 * read this one without learning new scoping rules.
 */
export function matchesGlob(glob: string, path: string): boolean {
  const subject = glob.includes("/") ? path : (path.split("/").pop() ?? path);
  return globToRegExp(glob).test(subject);
}

// ─────────────────────────────────────────────────────────────────────────────────
// Author class resolution — the replacement signal that IS measurable today.
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * `Agent-Model` values that name a toolchain rather than a model. Measured on this repo's
 * last 1000 commits: `bun + git + gh CLI` is the live one, 227 occurrences.
 *
 * The distinction matters because a generator's output is REPRODUCIBLE — you can re-run it
 * and diff — which is a genuinely different evidential situation from an LLM's, even
 * though both cost zero effort.
 */
const TOOLCHAIN_MODEL = /\b(cli|bun|git|gh|script|workflow|action|make|node)\b/iu;

export interface AuthorEvidence {
  readonly authorClass: AuthorClass;
  readonly commit: string;
  readonly agent: string | null;
  readonly agentModel: string | null;
  readonly credentialMode: string | null;
  /** Why the class came out the way it did — the meter shows its work. */
  readonly basis: string;
}

/**
 * Resolve an author class from a commit message.
 *
 * The ONLY thing this reads is the AgencySignature block. The git `Author:` header is
 * deliberately ignored: `Credential-Mode: shared` is the repo's own statement that the
 * credential does not identify a human, and reading a name off a shared credential is the
 * inference this whole file argues against.
 *
 * Absence resolves to `unknown`, never to `human`. An empty grep is unknown, never a
 * negative result — and treating "no agent trailer" as "therefore a person" would
 * manufacture exactly the human-authorship premise the effort prior needs.
 */
export function resolveAuthorClass(commitMessage: string, commit = ""): AuthorEvidence {
  const block = findSignatureBlock(commitMessage);
  if (block === null) {
    return {
      authorClass: "unknown",
      commit,
      agent: null,
      agentModel: null,
      credentialMode: null,
      basis: "no AgencySignature block on the commit",
    };
  }
  const text = block.join("\n");
  const agent = blockValue(text, "Agent") || null;
  const agentModel = blockValue(text, "Agent-Model") || null;
  const credentialMode = blockValue(text, "Credential-Mode") || null;

  if (credentialMode === "human-only") {
    return { authorClass: "human", commit, agent, agentModel, credentialMode, basis: "Credential-Mode: human-only" };
  }
  if (agentModel !== null && TOOLCHAIN_MODEL.test(agentModel)) {
    return {
      authorClass: "generator",
      commit,
      agent,
      agentModel,
      credentialMode,
      basis: `Agent-Model names a toolchain, not a model: ${agentModel}`,
    };
  }
  if (agentModel !== null) {
    return { authorClass: "llm", commit, agent, agentModel, credentialMode, basis: `Agent-Model: ${agentModel}` };
  }
  return {
    authorClass: "unknown",
    commit,
    agent,
    agentModel,
    credentialMode,
    basis: "AgencySignature block present but names no Agent-Model",
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// The observation the meter emits. NOTE WHAT IS ABSENT: there is no verdict field, and
// there is no place to put one.
// ─────────────────────────────────────────────────────────────────────────────────

export interface Observation {
  readonly path: string;
  readonly line: number;
  readonly signal: string;
  readonly observedForm: string;
  readonly canonicalForm: string;
  readonly detail: string;
  readonly consequence: string;
  readonly reversible: boolean;
  readonly gate: string;
  readonly authorClass: AuthorClass;
  readonly authorBasis: string;
  readonly agent: string | null;
  readonly agentModel: string | null;
  readonly effort: Effort;
  readonly weight: Weight;
  /**
   * True exactly when weight is `none`. Stated as its own field because it is the
   * headline, not a footnote: this observation licenses no belief about intent.
   */
  readonly intentUnobservable: boolean;
  /** Blame attributes a LINE to the commit that last touched it, not necessarily the one that introduced the deviation. */
  readonly provenanceIsApproximate: true;
}

export function observationsFor(
  path: string,
  bytes: Uint8Array,
  decls: readonly Declaration[],
  author: AuthorEvidence,
): readonly Observation[] {
  const out: Observation[] = [];
  for (const d of decls) {
    if (!matchesGlob(d.glob, path)) continue;
    const det = DETECTORS[d.detect];
    if (det === undefined) continue;
    for (const site of det(bytes)) {
      const effort = d.effort[author.authorClass];
      const weight = d.weight[author.authorClass];
      out.push({
        path,
        line: site.line,
        signal: d.signal,
        observedForm: d.deviation,
        canonicalForm: d.canonical,
        detail: site.detail,
        consequence: d.consequence,
        reversible: d.reversible,
        gate: d.gate,
        authorClass: author.authorClass,
        authorBasis: author.basis,
        agent: author.agent,
        agentModel: author.agentModel,
        effort,
        weight,
        intentUnobservable: weight === "none",
        provenanceIsApproximate: true,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Repo I/O. Kept below the pure core so every rule above is testable without a git tree.
// ─────────────────────────────────────────────────────────────────────────────────

export const CONFIG_PATH = ".authorevidence";

export function trackedFiles(): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const res = spawnSync("git", ["ls-files", "-z"], { encoding: "buffer", maxBuffer: 1 << 28 });
  if (res.status !== 0) throw new Error(`author-evidence: git ls-files failed (status ${String(res.status)})`);
  return res.stdout
    .toString("utf8")
    .split("\u0000")
    .filter((p) => p.length > 0);
}

/** Commit that last touched a given line, via `git blame -L`. */
export function blameLine(path: string, line: number): AuthorEvidence {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const blame = spawnSync("git", ["blame", "-L", `${String(line)},${String(line)}`, "--porcelain", "--", path], {
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  const first = (blame.stdout || "").split("\n")[0] ?? "";
  const sha = first.split(" ")[0] ?? "";
  if (!/^[0-9a-f]{40}$/u.test(sha)) {
    return {
      authorClass: "unknown",
      commit: "",
      agent: null,
      agentModel: null,
      credentialMode: null,
      basis: "git blame did not resolve a commit for this line",
    };
  }
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const show = spawnSync("git", ["log", "-1", "--format=%B", sha], { encoding: "utf8", maxBuffer: 1 << 26 });
  return resolveAuthorClass(show.stdout || "", sha);
}

function usage(): string {
  return [
    "author-evidence.ts — the meter for .authorevidence",
    "",
    "  --check              validate the declarations; exit 1 on any refusal",
    "  --report [--json]    report observations over the tracked tree; ALWAYS exit 0",
    "",
    "--report never fails. It is a meter: it reports facts and their evidential weight.",
    "The audits named in each declaration's `gate` are what refuse a deviation.",
  ].join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const wantCheck = argv.includes("--check");
  const wantReport = argv.includes("--report");
  const asJson = argv.includes("--json");

  if (!wantCheck && !wantReport) {
    console.log(usage());
    process.exit(0);
  }

  // Read and interpret the failure rather than checking first: an `existsSync` gate in
  // front of a read answers a question that is already stale by the time the read runs,
  // and reads as defensive while preventing nothing (CWE-367, and this file tripped
  // `lint-check-then-use-file-races.ts` on exactly this line in its first CI run).
  let configText: string;
  try {
    configText = readFileSync(CONFIG_PATH, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error(`author-evidence: ${CONFIG_PATH} not found (run from the repo root)`);
      process.exit(1);
    }
    throw err;
  }
  const parsed = parseDeclarations(configText);

  if (wantCheck) {
    const violations = checkDeclarations(parsed.declarations, existsSync);
    const total = parsed.errors.length + violations.length;
    if (total === 0) {
      console.log(
        `author-evidence --check: ${String(parsed.declarations.length)} declaration(s) coherent — ` +
          "every weight is within its effort ceiling, every consequence is verdict-free, " +
          "every detector separates its own probes, every gate exists.",
      );
      process.exit(0);
    }
    console.error(`author-evidence --check: ${String(total)} refusal(s) in ${CONFIG_PATH}\n`);
    for (const e of parsed.errors) console.error(`  ${CONFIG_PATH}:${String(e.line)}  ${e.message}`);
    for (const v of violations) console.error(`  [${v.glob}] ${v.signal} (${v.kind}): ${v.message}`);
    process.exit(1);
  }

  // --report
  if (parsed.errors.length > 0) {
    console.error("author-evidence --report: the declarations do not parse; run --check.");
    process.exit(1);
  }
  const observations: Observation[] = [];
  const blameCache = new Map<string, AuthorEvidence>();
  for (const path of trackedFiles()) {
    const applicable = parsed.declarations.filter((d) => matchesGlob(d.glob, path));
    if (applicable.length === 0) continue;
    let bytes: Uint8Array;
    try {
      bytes = readFileSync(path);
    } catch {
      continue;
    }
    // Detect first, blame only the lines that produced a finding — blame is the expensive half.
    const unattributed = observationsFor(path, bytes, applicable, {
      authorClass: "unknown",
      commit: "",
      agent: null,
      agentModel: null,
      credentialMode: null,
      basis: "not yet resolved",
    });
    for (const o of unattributed) {
      const key = `${path}\u0000${String(o.line)}`;
      let ev = blameCache.get(key);
      if (ev === undefined) {
        ev = blameLine(path, o.line);
        blameCache.set(key, ev);
      }
      const decl = applicable.find((d) => d.signal === o.signal);
      if (decl === undefined) continue;
      const effort = decl.effort[ev.authorClass];
      const weight = decl.weight[ev.authorClass];
      observations.push({
        ...o,
        authorClass: ev.authorClass,
        authorBasis: ev.basis,
        agent: ev.agent,
        agentModel: ev.agentModel,
        effort,
        weight,
        intentUnobservable: weight === "none",
      });
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ observations }, null, 2));
    process.exit(0);
  }

  const byWeight = new Map<Weight, number>();
  const byClass = new Map<AuthorClass, number>();
  const bySignal = new Map<string, number>();
  for (const o of observations) {
    byWeight.set(o.weight, (byWeight.get(o.weight) ?? 0) + 1);
    byClass.set(o.authorClass, (byClass.get(o.authorClass) ?? 0) + 1);
    bySignal.set(o.signal, (bySignal.get(o.signal) ?? 0) + 1);
  }
  console.log(`author-evidence --report: ${String(observations.length)} observation(s).\n`);
  for (const o of observations) {
    console.log(
      `  ${o.path}:${String(o.line)}  ${o.signal}  [${o.detail}]\n` +
        `      observed=${o.observedForm} canonical=${o.canonicalForm} gate=${o.gate} reversible=${String(o.reversible)}\n` +
        `      author=${o.authorClass} (${o.authorBasis}) effort=${o.effort} weight=${o.weight}` +
        (o.intentUnobservable ? "  <- carries NO information about intent" : ""),
    );
  }
  console.log("\n  by signal:            " + [...bySignal].map(([k, v]) => `${k}=${String(v)}`).join(" "));
  console.log("  by evidential weight: " + [...byWeight].map(([k, v]) => `${k}=${String(v)}`).join(" "));
  console.log("  by author class:      " + [...byClass].map(([k, v]) => `${k}=${String(v)}`).join(" "));
  const informative = observations.filter((o) => !o.intentUnobservable).length;
  console.log(
    `\n  ${String(informative)} of ${String(observations.length)} observation(s) carry ANY information about intent.`,
  );
  console.log(
    "\n  This is a meter. It attaches no verdict, and `weight: none` means the observation\n" +
      "  discriminates nothing about intent — not that nothing happened.",
  );
  process.exit(0);
}
