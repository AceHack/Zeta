#!/usr/bin/env bun
// lint-tsirelson-constant-caveat.ts — the guard that makes the 2026-08-01 caveat sweep durable.
//
// THE DEFECT CLASS. Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH correlator, and it is
// implemented correctly at `src/Core/Tsirelson.fs` (exact integer matrix algebra; the irrational
// appears only at readout). `1/(3√2) ≈ 0.2357` is a DIFFERENT number that is not that bound and
// is not derived from it: it is the image of `S = 2√2` under the FREELY CHOSEN linear map
// `ρ = S/12`, picked so the Condorcet ρ-regimes and the Bell S-regimes read homoiconically. It
// is a legitimate DESIGN threshold. It is not a physical bound, and calling it "the Tsirelson
// threshold" has a track record: Z-3 and Z-5 were both DEMOTED §A→§B and the Zeta-Conjecture
// keystone claim was REFUTED, all over this one constant wearing a physicist's name.
//
// Aaron 2026-08-23, verbatim: "i hear tsirelson and hear 2sqrt2, why do you hear 1/(3sqrt2)?
// this threshold and limit different thresholds, most 1/(3sqrt2) have turned out to be bugs."
//
// WHY A LINT AND NOT MORE PROSE. The 2026-08-01 audit established the fact and a caveat was
// hand-propagated to the docs someone thought of at the time. That sweep was not idempotent and
// it does not survive new files: the two 2026-07-16 siblings ended up DISAGREEING WITH EACH
// OTHER — `2026-07-16-austrian-economics-*.md` got the banner, `2026-07-16-echolocation-debounce-*.md`
// did not — and neither knew. A prose sweep is a snapshot; the defect is a standing one. Prose
// rots, a check does not. This file is the correction applied to the correction.
//
// WHAT IT REFUSES. A LIVE surface that writes the constant within a few lines of the token
// "Tsirelson" while the file states no caveat. It refuses the NAME, never the NUMBER — the
// constant is a design threshold in good standing and every current use of it is behaviourally
// correct. Nothing here asks anyone to change a value.
//
// HOW THE CAVEAT MARKERS ARE DERIVED (not a hand-maintained allowlist, which would drift the
// same way the sweep did). The markers are read OUT OF the canonical provenance document — the
// one that adjudicated the constant as a design choice. The doc is DISCOVERED by shape, never
// hardcoded, and the lint fails loudly if discovery does not resolve to exactly one file. So if
// that doc is renamed, moved, or has its verdict vocabulary rewritten, the marker set follows it
// automatically and every caveat pointing at the old path goes red — which is correct, because a
// caveat citing a dead document is not a caveat.
//
// Usage: bun src/Core.TypeScript/hygiene/lint-tsirelson-constant-caveat.ts
// Exit:  0 — every live surface naming Tsirelson beside the constant carries the caveat
//        1 — at least one does not
//        2 — the lint could not establish its own ground (provenance doc missing/ambiguous,
//            derived marker set too weak, or no scan surface) — never a silent pass

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// ── The constant, in every form it is written in this repo ──────────────────────────────────
//
// Measured against origin/main rather than imagined: the decimal (`0.2357`, `0.236`), the
// LaTeX/unicode symbolic (`1/(3√2)`), the TypeScript spellings (`1 / (3 * Math.SQRT2)`,
// `1 / (3 * Math.sqrt(2))`), the F# spelling (`1.0 / (3.0 * sqrt 2.0)`), and the reciprocal
// form `3√2` that appears as `L* = 3√2 − 1`.
// Composed from named parts rather than written as one dense literal. Two reasons, both real:
// the spellings differ only in punctuation across five languages, so naming the shared pieces is
// how a reader checks coverage; and every quantifier here is BOUNDED (` {0,2}`, never `\s*`).
// Every span matched lives inside a single line, so unbounded whitespace was never needed, and
// bounding it removes super-linear backtracking instead of merely apologising for it. An earlier
// draft of this lint genuinely hung on a minified bundle — the concern is measured, not theoretical.
const SP = " {0,2}";
/** `√2`, `sqrt`, `Sqrt`, `Math.sqrt`, `Math.Sqrt`, `Math.SQRT2` — the five spellings in the tree. */
const ROOT2 = "(?:√2|Math\\.SQRT2|(?:Math\\.)?[Ss]qrt)";
/** `3` or the F# `3.0`. */
const THREE = `3(?:\\.0{1,3})?`;
/** An optional multiplication sign, in any of the three characters used here. */
const TIMES = "[*·×]?";

export const CONSTANT_FORMS: readonly RegExp[] = [
  /0\.2357/u,
  /0\.236(?!\d)/u,
  // `1 / (3 * Math.sqrt(2))`, `1/(3√2)`, and the F# `1.0 / (3.0 * sqrt 2.0)` — the last is LIVE
  // at `src/Core/MoneyVelocityOracle.fs:320`. An earlier draft required a bare `1` and `3` and
  // silently missed every F# site; this file's own suite is what caught that.
  new RegExp(`1(?:\\.0{1,3})?${SP}/${SP}\\(${SP}${THREE}${SP}${TIMES}${SP}${ROOT2}`, "u"),
  // The bare `3√2` / `3 * Math.SQRT2` form, which appears as `L* = 3√2 − 1`.
  new RegExp(`\\b${THREE}${SP}${TIMES}${SP}(?:√2|Math\\.SQRT2|(?:Math\\.)?[Ss]qrt${SP}\\(?${SP}2)`, "u"),
  // The unparenthesised `ρ_T = 1/3√2` spelling. The trailing root is REQUIRED: without it this
  // matched `ρ* = 1/3`, the CONDORCET limit — a different, entirely legitimate number that this
  // guard has no business flagging. It fired on `cpt-symmetry-emergent-c-rho-lightcone.md:39`
  // before the root was made mandatory.
  new RegExp(`ρ[*_T]?${SP}[=≈]${SP}1${SP}/${SP}\\(?${SP}${THREE}${SP}${TIMES}${SP}${ROOT2}`, "u"),
];

/** The name whose attachment to the constant is the defect. Matches the `TSIRELSON` identifier too. */
export const TSIRELSON_TOKEN = /tsirelson/i;

/**
 * Lines of slack between the name and the number.
 *
 * Calibrated on the real instances, not guessed: every measured defect puts the two on the SAME
 * line (`const TSIRELSON = 1 / (3 * Math.SQRT2)`, `The Tsirelson threshold (1/(3√2) ≈ 0.2357)`,
 * `| √2 | ≈ 0.414 | SharedState (S=2√2) | Tsirelson point.`). The window is kept small on
 * purpose: a document that discusses the real `2√2` bound in one section and uses the design
 * threshold in another, far apart, is not making the conflation this guard is about.
 */
export const PROXIMITY_LINES = 3;

// ── Frozen records: read, never rewritten ───────────────────────────────────────────────────
//
// Shape and rationale mirror `audit-attestation-vendor-root.ts`'s allowlist: each entry is a
// CLAIM that the path is a record of what was said, not a live surface asserting it now. Editing
// an archived PR review, a generated GitHub mirror, a quarantined `.void` artifact, or another
// agent's notebook to make this lint green would be falsifying a record to improve a score —
// the exact move the repo's own doctrine refuses. These are excluded from the SCAN, not from
// the finding: the defect in them is real and stays legible where it happened.
export const FROZEN_RECORDS: readonly { prefix: string; reason: string }[] = [
  { prefix: "docs/history/", reason: "archived PR reviews — a frozen record of what was said, not a live claim surface" },
  { prefix: "docs/github/", reason: "generated GitHub API mirror" },
  { prefix: "docs/pr-discussions/", reason: "verbatim PR discussion archive" },
  { prefix: "docs/letters/", reason: "verbatim correspondence archive" },
  { prefix: "docs/amara-full-conversation/", reason: "verbatim conversation archive — others' memory, never edited" },
  { prefix: "docs/research/ip-questionable/", reason: "verbatim forwarded transcripts — preserved, not curated" },
  { prefix: "docs/recovered-orphan-branches-2026-05/", reason: "historical branch-recovery snapshot" },
  { prefix: "memory/", reason: "agent notebooks — others' memory, preserved not curated" },
  { prefix: "docs/research/void-discharges-2026-08-01/", reason: "quarantined void discharges — the artifacts this audit condemned" },
];

/** Directories scanned. Everything else in the tree is not a claim surface for this constant. */
export const SCAN_DIRS: readonly string[] = ["docs", "src", "demo", "tests", "universal", "workitems", ".claude"];

// `.js`/`.jsx` are deliberately absent: in this tree they are build output and vendored
// bundles, never authored claim surfaces, and a minified bundle is a pathological input.
const SCAN_EXTENSIONS = /\.(md|ts|tsx|fs|fsx|cs|html|py|rs)$/u;

/** Never authored claim surfaces; walking them costs time and finds nothing. */
const SKIP_DIRS: ReadonlySet<string> = new Set(["node_modules", "bin", "obj", "dist", "artifacts"]);

/**
 * Above this a file is generated, not authored. Checked on the STRING after reading rather than
 * on a `statSync` size before it — same protection, and no second syscall to race against
 * (CWE-367; lint-check-then-use-file-races.ts went red on the earlier `statSync` form).
 */
const MAX_FILE_CHARS = 2_000_000;

export function isFrozenRecord(path: string): string | null {
  const norm = path.replace(/\\/gu, "/");
  for (const { prefix, reason } of FROZEN_RECORDS) if (norm.startsWith(prefix)) return reason;
  if (norm.endsWith(".void")) return "quarantined artifact";
  return null;
}

// ── Deriving the caveat markers from the canonical provenance doc ────────────────────────────

/** The doc that adjudicated the constant. Discovered by shape; a rename must not disable the lint. */
export function discoverProvenanceDoc(
  list: (d: string) => readonly string[] = (d) => readdirSync(d),
): string {
  const dir = "docs/research";
  const hits = list(dir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => f.includes("rho-t") && f.includes("design-choice") && f.includes("homoiconic"))
    .map((f) => join(dir, f))
    .sort();
  if (hits.length !== 1) {
    throw new Error(
      `lint-tsirelson-constant-caveat: expected exactly 1 provenance doc under ${dir} ` +
        `matching rho-t + design-choice + homoiconic, found ${String(hits.length)}` +
        (hits.length > 1 ? `: ${hits.join(", ")}` : "") +
        `.\nThe caveat markers are DERIVED from that doc, so the lint cannot establish its own ` +
        `ground without it. If the doc moved, this failure is the lint telling you the caveats ` +
        `in the tree now point at nothing.`,
    );
  }
  const only = hits[0];
  if (only === undefined) throw new Error("lint-tsirelson-constant-caveat: unreachable — hits.length === 1");
  return only;
}

export interface CaveatMarkers {
  readonly provenancePath: string;
  readonly patterns: readonly { name: string; re: RegExp }[];
}

/**
 * Read the provenance doc and derive what counts as "this file carries the caveat".
 *
 * Four families, every one of them sourced FROM THE DOC rather than from a list kept here.
 * That is the whole point: the 2026-08-01 sweep failed because it was a hand-maintained set of
 * places, so this guard refuses to keep a hand-maintained set of anything that can drift.
 *
 *   1. CITATION — the doc's own basename. A file that points a reader at the adjudication has
 *      discharged the caveat by reference. Derived from the DISCOVERED path, so a rename
 *      invalidates every stale citation in the tree, loudly.
 *   2. VERDICT VOCABULARY — the doc's own words for what the constant IS, harvested from its
 *      emphasized sentences and title ("design choice", "homoiconic"). Restate the verdict in
 *      different words in the doc and the accepted markers change with it.
 *   3. THE MAP — the freely chosen linear identification the doc derives (`ρ = S/12`). A file
 *      that writes the map has stated the provenance in its strongest form: the number's actual
 *      origin. Harvested from the doc's derivation lines, not typed here.
 *   4. THE NEGATION — an explicit denial whose OBJECT is the name. Deliberately anchored on
 *      `Tsirelson` and not on the constant: an earlier draft accepted "a negation near the
 *      number", which matched the incidental sentence "not ρ* = 1/3 … but ρ_T ≈ 0.236" in
 *      `cpt-symmetry-emergent-c-rho-lightcone.md` — the single worst offender in the tree, and
 *      it would have been passed by its own defect. A marker that green-lights the file it was
 *      written for is the vacuity class, so that family was measured and dropped.
 */
export function deriveCaveatMarkers(provenancePath: string, text: string): CaveatMarkers {
  const esc = (x: string): string => x.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const patterns: { name: string; re: RegExp }[] = [];

  // 1. citation by basename
  const base = provenancePath.split("/").pop() ?? provenancePath;
  patterns.push({ name: `cite:${base}`, re: new RegExp(esc(base), "u") });

  // 2. verdict vocabulary, harvested from emphasized spans + the title block
  const spans: string[] = [];
  for (const m of text.matchAll(/\*\*([^*\n]{3,120})\*\*/gu)) {
    const inner = m[1];
    if (inner !== undefined) spans.push(inner.toLowerCase());
  }
  for (const line of text.split("\n").slice(0, 6)) spans.push(line.toLowerCase());
  const vocabulary = new Set<string>();
  for (const span of spans) {
    for (const term of ["design choice", "homoiconic"]) if (span.includes(term)) vocabulary.add(term);
  }
  for (const term of [...vocabulary].sort()) {
    // PREDICATED OF THE NAME, never bare. Measured 2026-08-23: a bare `/homoiconic/i` passed
    // `sensor-fusion-oracle.ts` and `2026-08-10-lumen-8h-review-addison.md` — two files that
    // carry the defect and merely use the word elsewhere for unrelated reasons. A marker that
    // green-lights a real defect on an incidental word is the vacuity class. Requiring the
    // verdict to sit in the same sentence as `Tsirelson` is what makes it a claim about the
    // name rather than a word that happens to be in the file.
    const t = esc(term);
    patterns.push({
      name: `vocab:${term}`,
      re: new RegExp(`(?:\\btsirelson\\b[^.]{0,140}${t}|${t}[^.]{0,140}\\btsirelson\\b)`, "iu"),
    });
  }

  // 3. the freely chosen linear map, harvested from the doc's derivation lines
  if (/\bS\s*\/\s*12\b/u.test(text)) {
    patterns.push({ name: "map:S/12", re: /\bS\s*\/\s*12\b/u });
  }

  // 4. explicit negation of the NAME
  patterns.push({
    name: "negation:not-a-tsirelson-bound",
    re: /\b(?:not|never|neither)\b[^.]{0,80}\btsirelson\b/iu,
  });

  if (patterns.length < 4) {
    throw new Error(
      `lint-tsirelson-constant-caveat: derived only ${String(patterns.length)} caveat marker(s) from ` +
        `${provenancePath} (expected the citation, the verdict vocabulary, the map and the negation). ` +
        `The derivation has lost its grip on the doc — refusing to run rather than passing everything ` +
        `vacuously. A guard that cannot fail is not a guard.`,
    );
  }
  return { provenancePath, patterns };
}

/** Whitespace-flattened: real caveats wrap across lines and comment prefixes. */
export function flatten(text: string): string {
  return text.replace(/^[ \t]*(?:\/\/\/?|\*|#|--)[ \t]?/gmu, " ").replace(/\s+/gu, " ");
}

export function carriesCaveat(text: string, markers: CaveatMarkers): boolean {
  const flat = flatten(text);
  return markers.patterns.some((p) => p.re.test(flat));
}

// ── The scan ─────────────────────────────────────────────────────────────────────────────────

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

function hasConstant(line: string): boolean {
  return CONSTANT_FORMS.some((r) => r.test(line));
}

/** Lines where the NAME and the NUMBER sit within `PROXIMITY_LINES` of each other. */
export function collidingLines(text: string): readonly Finding[] {
  const lines = text.split("\n");
  const out: Finding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const named = lines[i];
    if (named === undefined || !TSIRELSON_TOKEN.test(named)) continue;
    const lo = Math.max(0, i - PROXIMITY_LINES);
    const hi = Math.min(lines.length - 1, i + PROXIMITY_LINES);
    for (let j = lo; j <= hi; j++) {
      const candidate = lines[j];
      if (candidate !== undefined && hasConstant(candidate)) {
        out.push({ file: "", line: j + 1, text: candidate.trim().slice(0, 160) });
        break;
      }
    }
  }
  return out;
}

export function scanText(file: string, text: string, markers: CaveatMarkers): readonly Finding[] {
  if (text.length > MAX_FILE_CHARS) return [];
  if (isFrozenRecord(file)) return [];
  if (file.replace(/\\/gu, "/") === markers.provenancePath) return [];
  // Cheap line-wise scan FIRST. `carriesCaveat` flattens the whole file, and flattening a
  // 900 kB generated artifact into one line and running span-bounded regexes over it is the
  // pathological case that hung an earlier draft of this lint on a vendored bundle.
  const hits = collidingLines(text);
  if (hits.length === 0) return [];
  if (carriesCaveat(text, markers)) return [];
  // De-duplicate to one finding per line.
  const seen = new Set<number>();
  const out: Finding[] = [];
  for (const h of hits) {
    if (seen.has(h.line)) continue;
    seen.add(h.line);
    out.push({ ...h, file });
  }
  return out;
}

function walk(p: string, acc: string[] = []): string[] {
  // `withFileTypes` so the entry's KIND arrives with the listing. Asking `statSync` again would
  // be a check-then-use race (CWE-367): an entry can vanish or change kind between the listing
  // and the stat, and the listing already knew. Caught by lint-check-then-use-file-races.ts,
  // which went red twice on the earlier form — once on the cross-verify floor, once inside the
  // hygiene suite's no-NEW-race assertion.
  let entries;
  try {
    entries = readdirSync(p, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(p, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".git")) continue;
      walk(full, acc);
    } else if (e.isFile() && SCAN_EXTENSIONS.test(full)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Candidate files: those TRACKED BY GIT that contain the token at all.
 *
 * This is a speed change and NOT a narrowing, and the equivalence is exact rather than
 * approximate: `collidingLines` iterates lines matching `TSIRELSON_TOKEN` and returns nothing
 * when there are none, so a file without the token cannot produce a finding under any input.
 * Restricting to files that contain it therefore yields the identical result set.
 *
 * It matters because the naive tree walk stats and reads every file under `docs`, `src`, `demo`,
 * `tests` and `.claude` — measured at 2m15s wall, against a 5-minute budget shared with every
 * other structural guard in the job. `git grep` does the same filtering in one process.
 *
 * Falls back to the tree walk when git is unavailable (a tarball export), so the lint keeps
 * working without a repository — `git clone` at a tag must stay sufficient, and so must less.
 */
export function candidateFiles(dirs: readonly string[] = SCAN_DIRS): readonly string[] {
  // A pathspec naming a directory that does not exist makes `git grep` fail, which would drop
  // the whole run onto the 2-minute tree walk without saying why. Filter first.
  const present = dirs.filter((d) => existsSync(d));
  if (present.length === 0) return [];
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const out = execFileSync("git", ["grep", "-lIi", "--", "tsirelson", ...present], {
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const files = out.split("\n").filter((f) => f.length > 0 && SCAN_EXTENSIONS.test(f));
    if (files.length > 0) return files;
  } catch {
    // `git grep` exits 1 on no match and non-zero outside a repo; both fall through to the walk.
  }
  const acc: string[] = [];
  for (const d of dirs) walk(d, acc);
  return acc;
}

export function scanRepo(
  dirs: readonly string[] = SCAN_DIRS,
  read: (p: string) => string = (p) => readFileSync(p, "utf-8"),
): { readonly findings: readonly Finding[]; readonly scanned: number; readonly markers: CaveatMarkers } {
  const provenancePath = discoverProvenanceDoc();
  const markers = deriveCaveatMarkers(provenancePath, read(provenancePath));
  const findings: Finding[] = [];
  let scanned = 0;
  for (const f of candidateFiles(dirs)) {
    scanned++;
    let text: string;
    try {
      text = read(f);
    } catch {
      continue;
    }
    findings.push(...scanText(f, text, markers));
  }
  return { findings, scanned, markers };
}

function main(): number {
  let result;
  try {
    result = scanRepo();
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    return 2;
  }
  const { findings, scanned, markers } = result;
  if (scanned === 0) {
    console.error("lint-tsirelson-constant-caveat: scanned 0 files — run from the repo root.");
    return 2;
  }
  if (findings.length === 0) {
    console.log(
      `tsirelson-constant-caveat: OK — every live surface that writes 1/(3√2) beside the name ` +
        `"Tsirelson" carries the caveat (${String(scanned)} files scanned; ` +
        `${String(markers.patterns.length)} markers derived from ${markers.provenancePath}).`,
    );
    return 0;
  }
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  console.error(
    `tsirelson-constant-caveat: ${String(findings.length)} uncaveated collision(s) in ` +
      `${String(byFile.size)} file(s) — the constant 1/(3√2) is written within ${String(PROXIMITY_LINES)} ` +
      `line(s) of the name "Tsirelson":\n`,
  );
  for (const [file, hits] of [...byFile.entries()].sort()) {
    console.error(`  ${file}`);
    for (const h of hits) console.error(`    :${String(h.line)}  ${h.text}`);
  }
  console.error(
    `\nTsirelson's bound is S ≤ 2√2 ≈ 2.828 on the CHSH correlator (src/Core/Tsirelson.fs).\n` +
      `1/(3√2) ≈ 0.2357 is NOT that bound and is not derived from it — it is the image of\n` +
      `S = 2√2 under the freely chosen linear map ρ = S/12, adjudicated as a DESIGN CHOICE in\n` +
      `${markers.provenancePath}.\n\n` +
      `The number is fine. Do NOT change any value or any behaviour — the design threshold is in\n` +
      `good standing. Attach the standing caveat so the name stops asserting a physical bound.\n` +
      `Track record for why this is not pedantry: Z-3 and Z-5 were DEMOTED §A→§B and the\n` +
      `Zeta-Conjecture keystone claim was REFUTED, all over this constant.`,
  );
  return 1;
}

if (import.meta.main) process.exit(main());
