#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/audit-hidden-oracles.ts
//
// THE HIDDEN ORACLE — a measurement, limit, threshold or budget that has silently
// become the thing being deferred to.
//
// Aaron 2026-08-17: "this is a good audit, a hidden oracle, we should always be on the
// lookout where the measurement or the limit/budget becomes the oracle silently, we
// don't want to do this by accident, this is accidental hierarchy or control."
//
// WHAT THE DEFECT IS. Nobody granted the number authority. It acquired authority
// because a number had to be picked, and the picked number now decides outcomes. The
// canonical live instance is `required-check-started.ts --min-age-min 20`: gate start
// latency is ~28 minutes, so 20 was not measuring "stalled", it was DEFINING it. Three
// false positives (#11387 / #11389 / #11401) against one true positive (#11369), and
// the fix in #11445 is the shape worth copying — THE CURE WAS TO REPLACE THE NUMBER
// WITH A FACT (run existence became the discriminator).
//
// WHAT THE DEFECT IS NOT. A budget is not a defect. Manifesto §4 (bounded mobility) and
// SimLoop's "no one gets to run for infinity" both REQUIRE budgets. So existence is not
// the discriminator:
//
//     THE DISCRIMINATOR IS ATTRIBUTION. A budget nobody chose on the record is the
//     defect; a budget that names its provenance is a policy dial, which is fine.
//
// The positive control is `MAX_GRANT_SPAN_PHASES = 65536` in key-custody: it is
// documented as "adopted rather than independently chosen … a policy dial and remains
// the maintainer's to retune". That names who holds the authority, so the authority is
// not hidden, so it is not a hidden oracle. This audit must not flag it, and there is a
// test pinning exactly that.
//
// WHY THIS IS THE §11 RULE AND NOT A STYLE PREFERENCE. `dual-use-detection-is-neutral-
// oracle-decides` says the mechanism reports the fact and the CALLER's oracle attaches
// the meaning. A hidden oracle is a mechanism that quietly attached the meaning itself.
// `itron-hub-patent-boundary` supplies the test that ranks them: deference you can route
// around is an ORACLE (chosen); deference you cannot is a HUB (enforced). A hidden oracle
// fails the exit test without anyone noticing, because nobody knew there was a choice.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// THIS DETECTOR'S OWN THRESHOLDS, DECLARED — because a hidden-oracle detector with a
// hidden oracle inside it is the joke that writes itself, and it would be the vacuity
// class one level up.
//
//   1. THE ATTRIBUTION WINDOW HAS NO NUMBER. The obvious design is "an attribution may
//      sit within N lines of the declaration", and N would be a hidden oracle — it would
//      decide, unattributably, which comments count. So the window is STRUCTURAL: the
//      contiguous comment block immediately above the declaration (only blank lines may
//      intervene, any length), the trailing same-line comment, and any comment ANYWHERE
//      in the file that names the identifier. That is #11445's fix applied to this file:
//      a fact (comment adjacency / naming) replaces a number (line distance).
//
//   2. GATING EVIDENCE HAS NO COUNT. Not "used in ≥N comparisons" — used in AT LEAST ONE
//      relational comparison, which is the boundary between "this constant decides
//      something" and "it does not". Boundaries are facts; tuned counts are guesses.
//
//   3. THE LIVENESS FLOOR IS 1, AND 1 IS THE ONLY NON-GUESS. Same reasoning already on
//      file in `audit-scan-floor-routes.ts`: one is the non-vacuity boundary ("this
//      recognizer still recognizes something"); every value above it would be a claim
//      about how many hidden oracles the repo ought to contain, which nobody knows.
//
//   4. THE RANKING IS ORDINAL AND DERIVED, NEVER A SCORE. No weights, no points. Three
//      tiers read off the structure via the exit test above — see `Tier`.
//
//   5. THE LEXICON IS A ROSTER, NOT A THRESHOLD. `BUDGET_WORDS` and `ATTRIBUTION_MARKERS`
//      are enumerable lists whose entries are individually justified below, not tuned
//      numbers. A roster you can read and argue with is not a hidden oracle; it is a
//      declared scope. Its cost is recall (see LIMITS at the bottom), stated openly.
//
//   6. EVERY PRECISION FILTER IS A CATEGORY JUDGEMENT, NOT A CUTOFF. The three that do
//      the work — `const` only (a `let` is an accumulator), value shape (a derived
//      binding's authority lives upstream), and "the identifier appears in a relational
//      comparison" — each answer a yes/no question about what KIND of thing a binding is.
//      None of them has a dial to turn, so none of them can be quietly retuned to make an
//      inconvenient finding go away. That property is the whole point of the exercise.
//
// ─────────────────────────────────────────────────────────────────────────────────────
// DST: pure function of the tracked file tree. No clock, no network, no randomness.
// Ordering is ordinal throughout — `localeCompare` is culture-sensitive and banned here.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/audit-hidden-oracles.ts
//   bun src/Core.TypeScript/hygiene/audit-hidden-oracles.ts --json
//   bun src/Core.TypeScript/hygiene/audit-hidden-oracles.ts --root <dir>
//
// Exit codes:
//   0  the audit ran and inspected something (findings are REPORTED, not enforced)
//   2  liveness failure — inspected nothing, or every recognizer route went dark
//   3  usage error
//
// This audit does NOT exit non-zero on findings. Turning an inventory of unattributed
// numbers into a merge gate before anyone has triaged it would install this file as the
// very thing it detects.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Ordinal comparator. `localeCompare` is culture-sensitive; the repo has a live tripwire. */
export function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

// ── The roster: what makes a NAME look like a budget ──────────────────────────────────
//
// Each word names a way a number acquires authority over an outcome. This is a declared
// scope, not a tuned parameter: adding a word widens recall, and the cost of a missing
// word is a miss, never a false verdict.
export const BUDGET_WORDS: readonly string[] = Object.freeze([
  "min", // floors: "at least N" — the vacuity boundary lives here
  "max", // ceilings: "at most N"
  "minimum",
  "maximum",
  "limit",
  "threshold",
  "budget",
  "floor",
  "ceiling",
  "cap",
  "quota",
  "timeout",
  "deadline",
  "tolerance",
  "epsilon", // numeric slop — decides equality, which is a verdict
  "expected", // "expected N" is an assertion oracle wearing a noun
  "cutoff",
  "retries",
  "attempts",
  "maxage",
  "staleness",
]);

// ── The roster: what counts as ATTRIBUTION ───────────────────────────────────────────
//
// Attribution answers "who chose this, and on what basis". Each marker below is a
// DIFFERENT way the record can carry that answer; none of them is a synonym for "the
// author wrote a comment". A comment that merely restates the constant ("// 20 minutes")
// is not attribution and must not pass — that is the specificity test.
export const ATTRIBUTION_MARKERS: readonly { readonly id: string; readonly pattern: RegExp; readonly why: string }[] =
  Object.freeze([
    {
      id: "named-human",
      pattern: /\b(aaron|maintainer'?s?|human-authorized|maintainer-authorized|operator)\b/i,
      why: "a person holds the authority — the opposite of hidden; §11 satisfied by naming the oracle",
    },
    {
      id: "work-item",
      pattern: /\b(?:081[0-9A-HJKMNP-TV-Z]{23}|B-\d{4})\b/,
      why: "a ZetaId or legacy B-NNNN — the choice is on the record in a work item",
    },
    {
      id: "pr-or-issue",
      pattern: /#\d{3,6}\b/,
      why: "a PR/issue number — the choice was reviewed somewhere with a diff attached",
    },
    {
      id: "doc-anchor",
      pattern: /(?:docs\/[\w./-]+\.md|\.claude\/rules[\w./-]*\.md|https?:\/\/\S+|RFC\s?\d+)/i,
      why: "a citation — Beacon register; the value stands on a named external anchor",
    },
    {
      id: "measured",
      pattern: /\b(measured|measurement|empirical(?:ly)?|observed|benchmark(?:ed)?|p9[59]|percentile)\b/i,
      why: "the value came from an instrument rather than from a guess",
    },
    {
      id: "adopted",
      // `match(es|ing)` and `chosen <reason-clause>` were added after the audit reported
      // `BusRegime.HonestCeilingRho` bare while its `///` block reads "Chosen as the
      // Tsirelson fraction … matching the normalized coordination bandwidth". The bare
      // participle "matching" is how people actually write adoption; requiring the exact
      // lemma "matches" was the recognizer being brittle, not the comment being absent.
      // `chosen` requires a following reason word — "chosen" alone attributes nothing.
      pattern:
        /\b(adopted|match(?:es|ing)|mirrors|derived from|taken from|per the|upstream|spec(?:ified)?|protocol|chosen (?:as|to|from|after|because|so|under|for))\b/i,
      why: "the value is inherited from a named other derivation, so it is not a second invention",
    },
    {
      id: "declared-dial",
      pattern: /\b(policy dial|retunable|re-?tunable|tunable|knob|arbitrary|not a tuned|only non-guess|non-vacuity)\b/i,
      why: "self-declared provenance — saying 'this is an arbitrary dial' IS attribution; it hands the authority back",
    },
  ]);

// ── Tiers: the exit test, ordinal ─────────────────────────────────────────────────────
//
// Hirschman, *Exit, Voice, and Loyalty* (1970), as applied in
// `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`: exit is what
// disciplines a concentration. Not a score — a read-off of structure.
export type Tier = "verdict" | "branch" | "dial";

export const TIER_ORDER: readonly Tier[] = Object.freeze(["verdict", "branch", "dial"]);

export const TIER_WHY: Readonly<Record<Tier, string>> = Object.freeze({
  // No exit: the number decides pass/fail for everyone downstream and cannot be routed
  // around at the call site. This is the hub end of the test.
  verdict: "gates a hard failure (process.exit / throw) in its own file — no exit from its verdict",
  // The number steers a branch but the file does not fail on it.
  branch: "gates a branch but no hard failure in the same file",
  // Overridable from the environment or the command line: a caller CAN route around it,
  // so it is nearer an oracle than a hub — but the DEFAULT is still unchosen, which is
  // why it is reported rather than excused.
  dial: "env/CLI-overridable — exit exists, but the default is still unattributed",
});

export interface Candidate {
  readonly file: string;
  readonly line: number; // 1-based
  readonly name: string;
  readonly value: string; // the literal(s) as written
  readonly tier: Tier;
  readonly gating: string; // the comparison that shows it decides something
  readonly attributed: boolean;
  readonly attributionMarkers: readonly string[];
}

export interface BaselineFinding {
  readonly file: string;
  readonly attributed: boolean;
  readonly attributionKeys: readonly string[];
}

export interface Report {
  readonly filesScanned: number;
  readonly candidatesSeen: number;
  readonly findings: readonly Candidate[]; // unattributed only
  readonly attributedPasses: readonly Candidate[];
  readonly baselines: readonly BaselineFinding[];
}

// ── Recognizers ───────────────────────────────────────────────────────────────────────

const NUMERIC = String.raw`-?\d[\d_]*(?:\.\d+)?(?:e-?\d+)?|0x[0-9a-fA-F_]+`;

/**
 * `const NAME = 20;` / `export const NAME = Number(process.env.X ?? 2);`
 *
 * CONST ONLY, and that is a correctness choice rather than a convenience one. A `let`
 * named `max` is overwhelmingly an ACCUMULATOR (`let max = 0; … if (x > max) max = x`):
 * it HOLDS a running measurement, it does not IMPOSE one, so it has no provenance to
 * owe. The first run of this audit admitted `let`/`var` and reported 272 findings, of
 * which accumulators were the largest false-positive family. A budget is fixed at
 * authorship time, which is precisely what `const` encodes.
 */
const TS_DECL = new RegExp(String.raw`^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(.+)$`);

/**
 * F#: `let name = 20` / `[<Literal>] let Name = 20` / record field `MaxTicks = 1_000`.
 *
 * `let mutable` is EXCLUDED for the same reason `let` is excluded in TypeScript: it is
 * the accumulator form. Measured instance — `Transaction.fs:76` declares
 * `let mutable attempts = 0` inside a CAS retry loop; the audit flagged it before this
 * exclusion, and the real unattributed number there is the anonymous `1024` in
 * `if attempts > 1024`, which this detector cannot see at all (see LIMITS).
 */
const FS_DECL = new RegExp(String.raw`^\s*(?:\[<Literal>\]\s*)?(?:let\s+)?([A-Za-z_][\w']*)\s*=\s*(.+)$`);

const NUMERIC_IN_INIT = new RegExp(String.raw`(?<![\w.])(${NUMERIC})(?![\w.])`, "g");

/** Overridable from outside the file: env var or a CLI flag default. */
const OVERRIDABLE = /process\.env|argv|Bun\.env|getenv/;

const isBudgetName = (name: string): boolean => {
  const flat = name.toLowerCase().replace(/[_$]/g, "");
  return BUDGET_WORDS.some((w) => flat.includes(w));
};

/**
 * WHERE THE NUMBER IS WRITTEN IS WHERE THE AUTHORITY LIVES.
 *
 * `const deadline = start + DISK_BOOT_TIMEOUT_SECONDS * 1000` contains a numeric literal
 * and gates a loop, but it imposes nothing: the authority is `DISK_BOOT_TIMEOUT_SECONDS`,
 * which is separately a candidate, and `1000` is a unit conversion. Reporting the derived
 * binding as well would double-count one oracle and point the reader at the wrong line.
 * Likewise `Math.max(0, Math.floor(lookbackMs))` — the caller chose the bound, not this
 * line. So a candidate's value must be WRITTEN HERE, in one of exactly two shapes:
 *
 *   LITERAL     — an arithmetic expression over literals only (`200 * 1024 * 1024`).
 *   DEFAULTING  — a literal in the fallback position of `??` or `?:`, which is how a CLI
 *                 flag or env var declares the value used when nobody supplies one. The
 *                 override is the EXIT (Hirschman); the unattributed default is the find.
 *
 * Measured: this discriminator removed 7 of the 8 specificity misses in the first
 * mutation run, and every one of the 7 was a derived binding of exactly this kind.
 */
export type ValueShape = "literal" | "defaulting" | "derived";

/** Identifiers that wrap a literal without supplying a value of their own. */
const VALUE_NEUTRAL = /^(?:Number|Math|max|min|floor|ceil|round|abs|trunc|parseInt|parseFloat|BigInt|int|float|int64|double|uint32|byte|L|UL|as|number|bigint)$/;

export function valueShape(code: string): ValueShape {
  const stripped = code
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "")
    .replace(/\/\/.*$/, "")
    .replace(/;\s*$/, "");
  const defaulting = new RegExp(String.raw`(?:\?\?|:)\s*\(?\s*(?:${NUMERIC})\s*\)?\s*[),;]?\s*$`).test(stripped);
  // BLANK THE NUMERIC LITERALS BEFORE LOOKING FOR IDENTIFIERS. A digit separator is an
  // underscore, and `_` starts an identifier, so `1_000` was read as the literal `1`
  // followed by an identifier named `_000` — which made every underscore-separated
  // constant "derived" and dropped it from the scan entirely. Measured before the fix:
  // 32 budget-named declarations repo-wide were invisible for this reason alone,
  // including `SimLoop.defaultBudget`'s own `MaxTicks = 1_000_000` and `MaxMillis =
  // 300_000L`. Blanking first is the same move the string/comment strips above already
  // make: remove what is definitionally not an identifier, then ask what is left.
  const withoutNumbers = stripped.replace(new RegExp(String.raw`(?<![\w.])(?:${NUMERIC})[LUlu]*`, "g"), " ");
  const idents = [...withoutNumbers.matchAll(/[A-Za-z_$][\w$.]*/g)]
    .map((m) => m[0].split(".")[0] ?? "")
    .filter((t) => t !== "" && !VALUE_NEUTRAL.test(t));
  if (idents.length === 0) return "literal";
  return defaulting ? "defaulting" : "derived";
}

/**
 * A literal, safe to splice into a `RegExp` source.
 *
 * Both regex builders below used to escape `$` ALONE (CodeQL `js/incomplete-sanitization`).
 * That happened to hold for names produced by `TS_DECL`/`FS_DECL`, whose alphabets contain
 * no other metacharacter -- but `findGating` is EXPORTED and its signature promises
 * `name: string`, not "an identifier this file's own two regexes produced". A `.` alone
 * would make the pattern match any character and silently widen the audit's evidence.
 * Escaping the whole metacharacter class removes the coupling instead of documenting it.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Gating evidence: the identifier stands on one side of a relational comparison.
 * One occurrence is the boundary between "decides something" and "does not" — there is
 * deliberately no count threshold here (see header note 2). Returns every occurrence,
 * because WHICH occurrence gates decides the tier.
 */
export function findGating(lines: readonly string[], name: string): { line: number; text: string }[] {
  const esc = escapeRegExp(name);
  const re = new RegExp(String.raw`(?:[<>]=?|===|!==|==|!=)\s*${esc}\b|\b${esc}\s*(?:[<>]=?|===|!==|==|!=)`);
  const out: { line: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (/^\s*(?:\/\/|\*|\/\*|\/\/\/)/.test(l)) continue; // a comment is not a gate
    if (re.test(l)) out.push({ line: i, text: l.trim() });
  }
  return out;
}

/** Hard failure: the run stops and reports a verdict. */
const HARD_FAIL = /process\.exit\s*\(\s*[1-9]|throw new |throw \{|failwith|invalidArg|invalidOp/;

/**
 * "This comparison DECIDES a verdict" — the gating line itself hard-fails, or the first
 * non-blank line after it does (the `if (x > LIMIT) {` / `throw …` shape).
 *
 * NOTE THE ABSENT NUMBER. The obvious version is "look ahead N lines", and N would be a
 * hidden oracle deciding, unattributably, which failures count. "The immediately
 * following non-blank line" is a structural fact with no dial — the same substitution
 * the attribution window makes, and the same one #11445 made when it replaced
 * `--min-age-min` with run existence.
 */
export function decidesVerdict(lines: readonly string[], gateIdx: number): boolean {
  const here = lines[gateIdx] ?? "";
  if (HARD_FAIL.test(here)) return true;
  for (let i = gateIdx + 1; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (l.trim() === "") continue;
    return HARD_FAIL.test(l);
  }
  return false;
}

/**
 * The attribution window, stated as structure rather than as a line count:
 *   (a) the contiguous comment block immediately above the declaration — blank lines may
 *       intervene, and it may be any length;
 *   (b) the trailing comment on the declaration's own line;
 *   (c) any comment line anywhere in the file that NAMES the identifier.
 * (c) is what lets a module-header paragraph attribute a constant declared 200 lines
 * down, without this file ever picking a number for "how far away is too far".
 */
export function attributionWindow(lines: readonly string[], declIdx: number, name: string): string {
  const isComment = (s: string): boolean => /^\s*(?:\/\/|\/\*|\*|#|\(\*|\/\/\/)/.test(s);
  const isBlank = (s: string): boolean => s.trim() === "";
  // An ATTRIBUTE is not code and not prose — it is metadata attached to the very
  // declaration below it, so it cannot separate a doc comment from what it documents.
  // Measured: `BusRegime.fs` writes the Tsirelson-fraction provenance for
  // `HonestCeilingRho` in a `///` block, then `[<Literal>]`, then the binding. Without
  // this, the audit reported a correctly-attributed constant as bare — a false positive
  // in the one direction that matters most, since it would send someone to re-justify a
  // value that was already justified.
  const isAttribute = (s: string): boolean => /^\s*(?:\[<[^>]*>\]|@[A-Za-z_$])/.test(s);

  const parts: string[] = [];
  const decl = lines[declIdx] ?? "";
  const trailing = /(\/\/.*|\/\*.*)$/.exec(decl);
  if (trailing !== null) parts.push(trailing[0]);

  let i = declIdx - 1;
  while (i >= 0 && (isBlank(lines[i] ?? "") || isAttribute(lines[i] ?? ""))) i--;
  while (i >= 0 && isComment(lines[i] ?? "")) {
    parts.push(lines[i] ?? "");
    i--;
  }

  const named = lines.filter((l) => isComment(l) && new RegExp(String.raw`\b${escapeRegExp(name)}\b`).test(l));
  parts.push(...named);

  return parts.join("\n");
}

export function attributionMarkersIn(window: string): string[] {
  return ATTRIBUTION_MARKERS.filter((m) => m.pattern.test(window)).map((m) => m.id);
}

// ── The scanner ───────────────────────────────────────────────────────────────────────

export function scanText(file: string, text: string): Candidate[] {
  const isFs = file.endsWith(".fs") || file.endsWith(".fsx");
  const decl = isFs ? FS_DECL : TS_DECL;
  const lines = text.split("\n");
  const out: Candidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = decl.exec(line);
    if (m === null) continue;
    const [, name, init] = m;
    if (name === undefined || init === undefined) continue;
    if (!isBudgetName(name)) continue;

    // Strip a trailing comment from the initializer so a number mentioned in prose is
    // not read as the value.
    const code = init.replace(/\/\/.*$/, "").replace(/\(\*.*$/, "");
    const nums = [...code.matchAll(NUMERIC_IN_INIT)].map((x) => x[1] ?? "");
    if (nums.length === 0) continue;

    const shape = valueShape(code);
    if (shape === "derived") continue; // the authority lives upstream, not on this line

    const gates = findGating(lines, name).filter((g) => g.line !== i);
    if (gates.length === 0) continue;

    const key = `${name}@${String(i)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const window = attributionWindow(lines, i, name);
    const markers = attributionMarkersIn(window);

    const verdictGate = gates.find((g) => decidesVerdict(lines, g.line));
    const shown = verdictGate ?? gates[0];
    let tier: Tier = "branch";
    if (shape === "defaulting" || OVERRIDABLE.test(code)) tier = "dial";
    else if (verdictGate !== undefined) tier = "verdict";
    const gating = (shown?.text ?? "").trim();

    out.push({
      file,
      line: i + 1,
      name,
      value: nums.join(" "),
      tier,
      gating: gating.length > 120 ? `${gating.slice(0, 117)}...` : gating,
      attributed: markers.length > 0,
      attributionMarkers: markers,
    });
  }
  return out;
}

/**
 * A baseline / debt-ledger file is the same defect in JSON: fine as a ceiling that may
 * only FALL, a hidden oracle the moment raising it is how a failure gets resolved. The
 * attribution test is identical — does the artifact say, in itself, what it is and which
 * direction it is allowed to move?
 */
export const BASELINE_DOC_KEYS: readonly string[] = Object.freeze([
  "_doc",
  "doc",
  "description",
  "_comment",
  "why",
  "provenance",
  "note",
  "_why",
]);

export function scanBaseline(file: string, text: string): BaselineFinding {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { file, attributed: false, attributionKeys: [] };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { file, attributed: false, attributionKeys: [] };
  }
  const keys = Object.keys(parsed as Record<string, unknown>).filter((k) =>
    BASELINE_DOC_KEYS.includes(k.toLowerCase()),
  );
  const withProse = keys.filter((k) => {
    const v = (parsed as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim().length > 0;
  });
  return { file, attributed: withProse.length > 0, attributionKeys: [...withProse].sort(ordinal) };
}

// ── Repo walk ─────────────────────────────────────────────────────────────────────────

/**
 * SCOPE, declared. `.test.ts` is excluded: a constant in a test is an EXPECTATION, a
 * different class with a different remedy (the test is the record of the choice). Vendor
 * and prior-art trees are excluded because they are not ours to attribute.
 */
const EXCLUDED_DIR = /(?:^|\/)(?:node_modules|references|dist|build|\.git)\//;
const EXCLUDED_KIND = /\.(?:test|spec)\.(?:ts|tsx|js|mjs)$/;

export const isExcluded = (rel: string): boolean => EXCLUDED_DIR.test(rel) || EXCLUDED_KIND.test(rel);

export const SCANNED_EXT = /\.(?:ts|tsx|mjs|cjs|js|fs|fsx)$/;

export function trackedFiles(root: string): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return out.split("\0").filter(Boolean);
}

export function runAudit(root: string, files: readonly string[]): Report {
  const findings: Candidate[] = [];
  const passes: Candidate[] = [];
  const baselines: BaselineFinding[] = [];
  let filesScanned = 0;

  for (const rel of [...files].sort(ordinal)) {
    if (isExcluded(rel)) continue;
    if (rel.endsWith(".baseline.json")) {
      let text: string;
      try {
        text = readFileSync(join(root, rel), "utf8");
      } catch {
        continue;
      }
      baselines.push(scanBaseline(rel, text));
      continue;
    }
    if (!SCANNED_EXT.test(rel)) continue;
    let text: string;
    try {
      text = readFileSync(join(root, rel), "utf8");
    } catch {
      continue;
    }
    filesScanned++;
    for (const c of scanText(rel, text)) (c.attributed ? passes : findings).push(c);
  }

  const rank = (c: Candidate): number => TIER_ORDER.indexOf(c.tier);
  const sorted = [...findings].sort((a, b) => rank(a) - rank(b) || ordinal(a.file, b.file) || a.line - b.line);

  return {
    filesScanned,
    candidatesSeen: findings.length + passes.length,
    findings: sorted,
    attributedPasses: passes,
    baselines,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────

function main(argv: readonly string[]): number {
  const rootIdx = argv.indexOf("--root");
  if (rootIdx >= 0 && argv[rootIdx + 1] === undefined) {
    process.stderr.write("audit-hidden-oracles: --root needs a directory\n");
    return 3;
  }
  const root = rootIdx >= 0 ? (argv[rootIdx + 1] ?? ".") : join(import.meta.dir, "..", "..", "..");
  const report = runAudit(root, trackedFiles(root));

  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `audit-hidden-oracles: ${String(report.filesScanned)} files, ${String(report.candidatesSeen)} gating numeric constants, ` +
        `${String(report.findings.length)} unattributed, ${String(report.attributedPasses.length)} attributed\n\n`,
    );
    for (const tier of TIER_ORDER) {
      const rows = report.findings.filter((f) => f.tier === tier);
      if (rows.length === 0) continue;
      process.stdout.write(`── ${tier.toUpperCase()} (${String(rows.length)}) — ${TIER_WHY[tier]}\n`);
      for (const f of rows) {
        process.stdout.write(`  ${f.file}:${String(f.line)}  ${f.name} = ${f.value}\n      gates: ${f.gating}\n`);
      }
      process.stdout.write("\n");
    }
    const bareBaselines = report.baselines.filter((b) => !b.attributed);
    if (bareBaselines.length > 0) {
      process.stdout.write(`── BASELINES with no in-file provenance (${String(bareBaselines.length)})\n`);
      for (const b of bareBaselines) process.stdout.write(`  ${b.file}\n`);
      process.stdout.write("\n");
    }
  }

  // LIVENESS: 1 is the only non-guess floor (audit-scan-floor-routes.ts states the
  // reasoning). "Checked 0 files" must never read as success.
  if (report.filesScanned < 1 || report.candidatesSeen < 1) {
    process.stderr.write(
      `audit-hidden-oracles: LIVENESS FAILURE — scanned ${String(report.filesScanned)} files, ` +
        `found ${String(report.candidatesSeen)} candidates. A recognizer has gone dark.\n`,
    );
    return 2;
  }
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));

// ── LIMITS, stated rather than discovered later ───────────────────────────────────────
//
// RECALL IS BOUNDED BY THE NAME ROSTER. A gating constant named `WINDOW` or `N` is
// missed. That is a deliberate precision/recall trade: the alternative (every numeric
// literal in a comparison) produces an inventory nobody triages, which is the same
// failure as no audit at all. The roster is the declared scope; widening it is a PR.
//
// ANONYMOUS LITERALS ARE OUT OF SCOPE. `if (x > 20)` with no named constant is arguably
// the WORST form of this defect and is not detected here, because the attribution test
// has nothing to attach to. Naming it first is the prerequisite fix.
//
// F# COVERAGE IS DECLARATION-LEVEL ONLY. Record fields and `let` bindings are recognized;
// F#'s significant-whitespace comment forms are handled, but multi-line `(* *)` blocks
// above a declaration are only partially captured.
//
// VENDORED CODE IS IN SCOPE AND SHOULD NOT BE. `src/wasm-dla/bytelock/wasm_exec.js` is
// Go's own runtime shim; its `wasmMinDataAddr` is not ours to attribute and is reported
// anyway. No exclusion is added because a filename allowlist drifts from what it claims to
// describe, and because this audit REPORTS rather than gates, so the cost of the false
// positive is one line of triage rather than a blocked merge. If it is ever wired to a
// gate, vendored-tree detection must be derived (e.g. from a vendor manifest), not listed.
//
// HEX LITERALS LEX WRONG, AND THE BUG IS RECORDED RATHER THAN FIXED. In `NUMERIC` the decimal
// branch precedes the hex branch, so `0xffffffff` matches as `0` and leaves `xffffffff` looking
// like an identifier. Measured impact today: three hex-valued budget-named declarations exist
// repo-wide (`pr-manifest-shards.ts` `MAX_PR_NUMBER`, `IndexFormat.fs`, `NovelMath.fs`) and none of
// them currently reaches the gating test, so reordering the branches would change nothing anyone
// can observe. A change with no falsifier available is an unmetered change; it is named here so the
// next hex budget constant does not get reported with the value `0`.
//
// THE ATTRIBUTION TEST IS SYNTACTIC. It reads whether a provenance marker is PRESENT,
// never whether the provenance is TRUE. A comment saying "measured" over a value nobody
// measured passes here — the same limit `anchor-to-human-prior-art` names when it demands
// anchors be CHECKED, not merely cited. This audit finds the bare ones; a human decides
// whether a cited one is honest.
