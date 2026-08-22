#!/usr/bin/env bun
// audit-rule-cross-refs.ts — detect stale-pointer candidates in `.claude/rules/*.md`
//
// Mechanizes the razor-cadence item 4 (composes-with audit) work that landed
// manually across 12 ticks on 2026-05-14 (50/50 rules, 217/218 LIVE, 1 finding
// captured by 081KRHWGX0008QG0R002E3BCDS). See the cumulative final shard at
// `docs/hygiene-history/ticks/2026/05/14/1920Z.md` for context.
//
// Scope (first slice — mechanical Layer A only):
//
//   - Scan all `.claude/rules/*.md` files
//   - Pull backtick'd path references (`<path>.md`, `<path>.ts`, etc.)
//   - Pull MARKDOWN LINK TARGETS (`[display](target)`) — the target, not the display
//   - Pull backlog ID references (zetaid / 081K…)
//   - Test existence via direct path + glob + per-row backlog file lookup
//   - Report stale-pointer CANDIDATES (failed existence)
//
// Three-state path resolution (added 2026-08-15, after PR #10863):
//
//   The #6676 archive moved 96 rules from `.claude/rules/` to `.claude/rules.bak/`.
//   Before this change a reference to an archived rule was indistinguishable from a
//   reference to nothing, so PR #10863 had to separate the two BY HAND across 23
//   candidates. The auditor now reports three states:
//
//     live     — resolves in `.claude/rules/` (or as written, or via a fallback)
//     archived — resolves ONLY in `.claude/rules.bak/`, and the reference does not
//                say `rules.bak/`. The pointer is MISLEADING, not merely missing:
//                it implies a location the file is not in. Reported separately.
//     dead     — resolves nowhere.
//
//   A reference that already spells `.claude/rules.bak/<name>.md` resolves `live` by
//   plain existence — saying where the file actually is, is the fix, not the defect.
//
// Markdown links (added 2026-08-15, after PR #10863):
//
//   `pullRefs` used to read backticked spans only, so for `[`foo.md`](bar.md)` it
//   inspected the DISPLAY TEXT and never the TARGET — the half that actually has to
//   resolve. Links are now parsed as a single reference carrying both halves: the
//   target (authoritative for existence, resolved RELATIVE TO THE RULE FILE, as a
//   markdown reader would) and the backticked display text (which is what implies a
//   location to a human). Where the two disagree about the DIRECTORY, that is
//   reported as a display/target mismatch — #10863 had to fix both halves of five
//   links for exactly this reason.
//
// Out of scope (Layer B — semantic classification):
//
//   The 9-variant reference-classification taxonomy from the 12-batch manual
//   audit (concrete | glob | template-path | backlog-ID | legacy-noted |
//   transient | anti-pattern | conditional | alternative-location) requires
//   reading the rule's prose context around each reference. ~5% of MISSes are
//   rule-acknowledged-not-exists (healthy). This tool produces the *candidate
//   list* — human / Otto judgment classifies each candidate's variant.
//
//   See `docs/hygiene-history/ticks/2026/05/14/1920Z.md` for the full taxonomy.
//
// Usage:
//
//   bun src/Core.TypeScript/hygiene/audit-rule-cross-refs.ts                # detect-only, exit 0 always
//   bun src/Core.TypeScript/hygiene/audit-rule-cross-refs.ts --report PATH  # write markdown report
//
// Exit codes:
//
//   0   always (detect-only; no enforcement; humans triage stale-pointer candidates)
//   64  argument error
//
// DST-friendliness:
//
//   Read-only audit. The "Generated" timestamp in markdown reports is the only
//   non-deterministic surface. Per `typescript.md` universal-DST gate.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const RULES_DIR = ".claude/rules";
const RULES_ARCHIVE_DIR = ".claude/rules.bak";

// The live/archive pair the resolver works against. Parameterised rather than
// hardcoded so the classifier can be exercised end-to-end against a fixture pair —
// a resolver whose only possible input is the real tree cannot be positive-controlled.
interface RuleDirs {
  readonly rulesDir: string;
  readonly archiveDir: string;
}

const DEFAULT_DIRS: RuleDirs = { rulesDir: RULES_DIR, archiveDir: RULES_ARCHIVE_DIR };
const BACKLOG_DIR = "docs/backlog";
const WORKITEMS_DIR = "workitems";
const ZETA_ID_AT_START = /^(081K[0-9A-Z]{22})/;
const ZETA_ID_FIELD = /^id:\s*(081K[0-9A-Z]{22})\b/m;

type AuditExitCode = 0 | 64;

interface Args {
  readonly report: string | null;
}

// Where a reference was read from. `code-span` is the historical form (a backticked
// path, written repo-root-relative by convention). `link-target` is the target half
// of a markdown link, which a reader resolves RELATIVE TO THE CONTAINING FILE — a
// genuinely different resolution rule, so the origin has to travel with the ref.
type RefOrigin = "code-span" | "link-target";

interface Ref {
  readonly fromRule: string;
  readonly raw: string;
  readonly kind: "path" | "backlog-id";
  // Optional so that pre-existing callers/tests constructing bare Refs still
  // typecheck; absent `origin` is treated as `code-span` (the historical form).
  readonly origin?: RefOrigin;
  // For `link-target` refs: the backticked display text, when the display half is
  // exactly one code span. This is the half that IMPLIES a location to a reader.
  readonly displayText?: string;
}

// Three-state resolution of a path reference. See the header comment.
type PathState = "live" | "archived" | "dead";

interface PathResolution {
  readonly state: PathState;
  // How it resolved — carried into the report so a triager does not have to
  // re-derive which fallback fired.
  readonly via: string;
  // Set when `state === "archived"`: where the file actually is, and what the
  // reference should say instead.
  readonly actualPath?: string;
  readonly shouldSay?: string;
}

interface DisplayMismatch {
  readonly fromRule: string;
  readonly displayText: string;
  readonly target: string;
  readonly displayImpliedDir: string;
  readonly targetDir: string;
}

interface AuditResult {
  readonly rulesScanned: number;
  readonly refsFound: number;
  readonly candidatesStale: Ref[];
  readonly resolvedCount: number;
  // Refs whose only match is in `.claude/rules.bak/` while the reference implies
  // `.claude/rules/`. Misleading, not missing — a distinct class from `candidatesStale`.
  readonly archivedMisleading: readonly (Ref & { readonly resolution: PathResolution })[];
  // Markdown links whose backticked display text and whose target disagree about
  // the directory. Heuristic — see `displayTargetMismatch`.
  readonly displayMismatches: readonly DisplayMismatch[];
}

function parseArgs(argv: string[]): { kind: "args"; args: Args } | { kind: "error"; message: string } {
  let report: string | null = null;
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "--report") {
      const next = argv[i + 1];
      if (!next) return { kind: "error", message: "--report requires a path" };
      report = next;
      i += 2;
    } else {
      return { kind: "error", message: `Unknown argument: ${a}` };
    }
  }
  return { kind: "args", args: { report } };
}

const PATH_EXTENSIONS = "md|ts|sh|fs|fsi|cs|yml|json";
const CODE_SPAN_PATH = new RegExp("`([^`]+\\.(" + PATH_EXTENSIONS + "))`", "g");
// Markdown inline link. The display half is `[...]` (no nested `]`, which is all
// this surface uses); the target half runs to the first whitespace or `)`, with an
// optional `"title"` after it.
const MD_LINK = /\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const LINK_TARGET_IS_PATH = new RegExp("\\.(" + PATH_EXTENSIONS + ")$", "i");
// Targets we deliberately do not resolve: absolute URLs, protocol-relative URLs,
// mailto:, and pure in-document anchors.
const NON_LOCAL_TARGET = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

// A path-shaped span carrying a placeholder is a template, not a pointer.
function isPlaceholder(raw: string): boolean {
  return raw.includes("<") || raw.includes("$");
}

function pullRefs(content: string, ruleFile: string): Ref[] {
  const refs: Ref[] = [];

  // --- Markdown links, FIRST ------------------------------------------------
  // A link is ONE pointer with two halves. Emitting the target as its own ref and
  // the display text as a second ref would double-count every `Pointers` entry, so
  // the display half's character range is recorded and skipped by the code-span
  // scan below. (`pullRefs` used to see the display text ONLY — the blind spot.)
  const consumedSpans: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  MD_LINK.lastIndex = 0;
  while ((m = MD_LINK.exec(content)) !== null) {
    const display = m[1]!;
    const target = m[2]!;
    const displayStart = m.index + 1;
    consumedSpans.push([displayStart, displayStart + display.length]);

    if (NON_LOCAL_TARGET.test(target)) continue;
    // Drop a `#fragment` before testing shape: `foo.md#why` points at `foo.md`.
    const targetPath = target.split("#")[0]!;
    if (targetPath === "" || !LINK_TARGET_IS_PATH.test(targetPath)) continue;
    if (isPlaceholder(targetPath)) continue;

    const displayCodeSpan = display.trim().match(/^`([^`]+)`$/);
    const displayText = displayCodeSpan?.[1];
    refs.push({
      fromRule: ruleFile,
      raw: targetPath,
      kind: "path",
      origin: "link-target",
      ...(displayText === undefined ? {} : { displayText }),
    });
  }

  const insideConsumedSpan = (index: number): boolean =>
    consumedSpans.some(([start, end]) => index >= start && index < end);

  // --- Backtick'd path references (historical form) -------------------------
  CODE_SPAN_PATH.lastIndex = 0;
  while ((m = CODE_SPAN_PATH.exec(content)) !== null) {
    const raw = m[1]!;
    if (isPlaceholder(raw)) continue;
    if (insideConsumedSpan(m.index)) continue;
    refs.push({ fromRule: ruleFile, raw, kind: "path", origin: "code-span" });
  }

  // Backlog ID references (canonical zetaid form)
  const idPattern = /\b(081K[0-9A-Z]{22})\b/g;
  while ((m = idPattern.exec(content)) !== null) {
    refs.push({ fromRule: ruleFile, raw: m[1]!, kind: "backlog-id" });
  }

  // Dedup. Origin is part of the key: the same basename written once as a link
  // target and once as a bare span resolves under different rules, so collapsing
  // them would hide one of the two. Display text is part of the key for the same
  // reason — two links to one target with DIFFERENT display texts are two different
  // claims about where the file is, and deduping on target alone silently discards
  // the second. (Caught by the planted mismatch control, which did not fire until
  // this key included the display half.)
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = `${r.kind}:${r.origin ?? "code-span"}:${r.raw}:${r.displayText ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Escape regex metacharacters except `*`, which we replace with `.*` afterwards.
// Explicitly escapes backslash too (per CodeQL 81 finding).
function escapeForGlobRegex(s: string): string {
  return s.replace(/[\\^$+?.()|[\]{}]/g, "\\$&").replace(/\*/g, ".*");
}

// Expand bash-style brace globs (`{a,b,c}` → 3 alternatives). Caught by Codex
// P2 thread on PR #3202: rules like lost-files-surface.md use brace-expansion
// patterns (e.g., `feedback_rule_number_{one,two,three}_*aaron_*.md`) that
// don't match if `{` and `}` are escaped literally.
//
// Expands the FIRST brace group encountered, then recurses on each expansion.
// Most patterns have only one brace group; nested braces are uncommon in
// practice.
function expandBraces(pattern: string): string[] {
  const idx = pattern.indexOf("{");
  if (idx === -1) return [pattern];
  let depth = 0;
  let close = -1;
  for (let i = idx; i < pattern.length; i++) {
    if (pattern[i] === "{") depth++;
    else if (pattern[i] === "}") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return [pattern];
  const before = pattern.slice(0, idx);
  const after = pattern.slice(close + 1);
  const body = pattern.slice(idx + 1, close);
  const alternatives = body.split(",");
  const results: string[] = [];
  for (const alt of alternatives) {
    const expanded = before + alt + after;
    for (const sub of expandBraces(expanded)) results.push(sub);
  }
  return results;
}

// Resolve a path that may contain `*` wildcards in any segment (not only the
// last). Walks segment-by-segment from the leftmost directory: wildcards in
// earlier segments expand to directory listings, wildcards in the final segment
// match file basenames. Caught by Codex P2 thread on PR #3202. Brace-glob
// support added in second iteration per Codex re-review.
function globResolvesSingle(pattern: string): boolean {
  const segments = pattern.split("/");
  let candidates: string[] = pattern.startsWith("/") ? ["/"] : ["."];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (i === 0 && pattern.startsWith("/")) continue;
    if (seg === "") continue;
    const isLast = i === segments.length - 1;
    const hasWild = seg.includes("*");
    const next: string[] = [];
    for (const base of candidates) {
      if (!hasWild) {
        const child = base === "." ? seg : `${base}/${seg}`;
        if (isLast) {
          if (existsSync(child)) return true;
        } else if (existsSync(child) && statSync(child).isDirectory()) {
          next.push(child);
        }
        continue;
      }
      if (!existsSync(base) || !statSync(base).isDirectory()) continue;
      const regex = new RegExp("^" + escapeForGlobRegex(seg) + "$");
      let entries: string[];
      try {
        entries = readdirSync(base);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!regex.test(entry)) continue;
        const child = base === "." ? entry : `${base}/${entry}`;
        if (isLast) {
          if (existsSync(child)) return true;
        } else if (existsSync(child) && statSync(child).isDirectory()) {
          next.push(child);
        }
      }
    }
    candidates = next;
    if (candidates.length === 0 && !isLast) return false;
  }
  return false;
}

// Public globResolves: expand braces first, then check each expansion via the
// star-only single resolver. Returns true if ANY expansion has a match.
function globResolves(pattern: string): boolean {
  for (const expanded of expandBraces(pattern)) {
    if (existsSync(expanded)) return true;
    if (expanded.includes("*") && globResolvesSingle(expanded)) return true;
  }
  return false;
}

let cachedBacklogIds: Set<string> | null = null;

function collectWorkitemIds(directory: string, ids: Set<string>, recursive: boolean): void {
  if (!existsSync(directory)) return;

  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (recursive) collectWorkitemIds(path, ids, true);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const stemMatch = entry.name.match(ZETA_ID_AT_START);
    if (stemMatch?.[1]) {
      ids.add(stemMatch[1]);
      continue;
    }

    // Legacy rows may carry the canonical ID only in frontmatter. Reading is
    // the fallback, not the hot path: canonical workitem filenames own the ID.
    try {
      const idMatch = readFileSync(path, "utf8").match(ZETA_ID_FIELD);
      if (idMatch?.[1]) ids.add(idMatch[1]);
    } catch {
      // An unreadable row cannot resolve a reference.
    }
  }
}

function basenameOf(p: string): string {
  const parts = p.split("/");
  return parts[parts.length - 1] ?? p;
}

// A reference "implies the live rules directory" when a reader would look for it in
// `.claude/rules/` — either because it is a bare sibling basename (the sibling-rule
// shorthand the auditor already honours) or because it spells `.claude/rules/` out.
// Only these two forms get the archive fallback: a bare `.ts`/`.fs` basename
// elsewhere in the repo is shorthand for something else entirely and must NOT be
// dragged into the rules-archive question.
function impliesLiveRulesDir(raw: string, dirs: RuleDirs): boolean {
  if (!raw.endsWith(".md")) return false;
  if (!raw.includes("/")) return true;
  return dirname(raw) === dirs.rulesDir;
}

// The `archived` half of the three-state resolution: the reference resolves ONLY in
// `.claude/rules.bak/`, so it is misleading rather than missing.
function archiveResolution(raw: string, form: "span" | "link", dirs: RuleDirs): PathResolution | null {
  const base = basenameOf(raw);
  const actualPath = join(dirs.archiveDir, base);
  if (!existsSync(actualPath)) return null;
  return {
    state: "archived",
    via: "rules.bak fallback",
    actualPath,
    // The link form has to stay a working relative link from `.claude/rules/`;
    // the span form is written repo-root-relative by convention.
    shouldSay: form === "link" ? `${relativeFromRules(dirs)}/${base}` : actualPath,
  };
}

// Resolve a `path`-kind reference to one of live / archived / dead.
function relativeFromRules(dirs: RuleDirs): string {
  return relative(dirs.rulesDir, dirs.archiveDir).split(sep).join("/");
}

function resolvePathRef(ref: Ref, dirs: RuleDirs): PathResolution {
  const origin = ref.origin ?? "code-span";

  if (origin === "link-target") {
    // A markdown link target resolves RELATIVE TO THE CONTAINING FILE — every rule
    // scanned here lives in `.claude/rules/`, so that is the base.
    const resolved = join(dirs.rulesDir, ref.raw);
    if (existsSync(resolved)) return { state: "live", via: "link target (file-relative)" };
    // Guarded for robustness; link targets carrying a template marker are not a
    // pointer at a file and cannot be checked.
    if (ref.raw.includes("...") || ref.raw.includes("YYYY")) {
      return { state: "live", via: "template-placeholder" };
    }
    if (dirname(resolved) === dirs.rulesDir) {
      const archived = archiveResolution(ref.raw, "link", dirs);
      if (archived) return archived;
    }
    return { state: "dead", via: "link target (file-relative)" };
  }

  return resolveCodeSpanRef(ref.raw, dirs);
}

function resolveCodeSpanRef(raw: string, dirs: RuleDirs): PathResolution {
  const ref: Ref = { fromRule: "", raw, kind: "path" };
  if (legacyCodeSpanExists(ref, dirs)) return { state: "live", via: "existing resolver cascade" };
  const archived = impliesLiveRulesDir(raw, dirs) ? archiveResolution(raw, "span", dirs) : null;
  if (archived) return archived;
  return { state: "dead", via: "existing resolver cascade" };
}

// HEURISTIC, and deliberately narrow (`toy-is-free-metered-must-be-earned.md` — say
// so rather than let it read as certain). It compares the DIRECTORY a human would
// read off the display text against the directory the link actually resolves to.
//
// Three deliberate limits:
//   - A display text with no `/` states no directory at all — that is the sibling
//     shorthand, and it is NEVER a mismatch. Only a display that spells a directory
//     can contradict its target.
//   - Two display conventions are both accepted: repo-root-relative (the code-span
//     convention: `.claude/rules.bak/foo.md`) and file-relative (the link
//     convention: `../rules.bak/foo.md`). Agreeing under EITHER reading clears it.
//   - It reports that the two halves DISAGREE. It cannot say which half is wrong.
function displayTargetMismatch(ref: Ref, dirs: RuleDirs = DEFAULT_DIRS): DisplayMismatch | null {
  if ((ref.origin ?? "code-span") !== "link-target") return null;
  const display = ref.displayText;
  if (display === undefined || !display.includes("/")) return null;
  const displayImpliedDir = dirname(display.replace(/^\.\//, ""));
  const targetDir = dirname(join(dirs.rulesDir, ref.raw));
  if (displayImpliedDir === targetDir) return null;
  // Second reading: the display written file-relative, exactly like the target.
  if (dirname(join(dirs.rulesDir, display)) === targetDir) return null;
  return {
    fromRule: ref.fromRule,
    displayText: display,
    target: ref.raw,
    displayImpliedDir,
    targetDir,
  };
}

// The pre-existing existence cascade, unchanged, now used as the `live` test inside
// the three-state resolver.
function legacyCodeSpanExists(ref: Ref, dirs: RuleDirs): boolean {
  if (ref.kind === "path") {
    // Template-placeholder patterns: rule-acknowledged-transient per
    // 081KS923C0008QG0R00035KSQA / 9-variant taxonomy. The `...` ellipsis is the canonical
    // template-path marker (e.g., `docs/.../0603Z.md`, `081KRSKQ20008QG0R002TH55X6-...md`,
    // `~/.claude/projects/.../memory/*.md`). The placeholder `YYYY/MM/DD`
    // is the canonical date-template marker. Skip existence check.
    if (ref.raw.includes("...") || ref.raw.includes("YYYY")) return true;
    // Command-snippet detection: when the audit captures a backtick
    // span containing a shell command rather than a path (e.g.,
    // `BACKLOG_WRITE_FORCE=1 bun tools/.../generate-index.ts`,
    // `bun tools/github/poll-pr-gate.ts`, `git add docs/...`), check
    // the embedded path-fragment rather than the literal raw.
    if (/\s/.test(ref.raw)) {
      const tokens = ref.raw.split(/\s+/);
      for (const t of tokens) {
        if ((t.endsWith(".ts") || t.endsWith(".sh") || t.endsWith(".md")) && existsSync(t)) {
          return true;
        }
      }
    }
    if (existsSync(ref.raw)) return true;
    if (ref.raw.includes("*") || ref.raw.includes("{")) return globResolves(ref.raw);
    // Sibling-rule resolution: bare `<filename>.md` references inside
    // `.claude/rules/*.md` typically point to other rules in the same
    // directory. Resolve them via `.claude/rules/<basename>` before
    // declaring stale. Major false-positive class caught by 081KS923C0008QG0R00035KSQA
    // razor-cadence pass (2026-05-23).
    if (ref.raw.endsWith(".md") && !ref.raw.includes("/")) {
      if (existsSync(join(dirs.rulesDir, ref.raw))) return true;
    }
    // Peer-call wrapper resolution: bare `<name>.ts` references in
    // agent-roster-reference-card.md and similar rules typically point
    // to `src/Core.TypeScript/peer-call/<name>` per the established peer-call wrapper
    // convention.
    if (ref.raw.endsWith(".ts") && !ref.raw.includes("/")) {
      if (existsSync(join("src/Core.TypeScript/peer-call", ref.raw))) return true;
    }
    // src/Core.TypeScript/hygiene/ fallback for bare `.ts`/`.sh` references in
    // hygiene-related rules (backlog-item-start-gate.md, rule-0-no-sh-
    // files.md, etc.)
    if ((ref.raw.endsWith(".ts") || ref.raw.endsWith(".sh")) && !ref.raw.includes("/")) {
      if (existsSync(join("src/Core.TypeScript/hygiene", ref.raw))) return true;
    }
    // src/Core.TypeScript/github/ fallback for bare `.ts` references in
    // GitHub/PR-tooling-related rules (refresh-before-decide.md cites
    // `poll-pr-gate-batch.ts` etc.)
    if (ref.raw.endsWith(".ts") && !ref.raw.includes("/")) {
      if (existsSync(join("src/Core.TypeScript/github", ref.raw))) return true;
    }
    // memory/ fallback for bare MEMORY.md (the canonical memory-index)
    if (ref.raw === "MEMORY.md") {
      if (existsSync(join("memory", "MEMORY.md"))) return true;
    }
    return false;
  }
  if (ref.kind === "backlog-id") {
    if (cachedBacklogIds === null) {
      cachedBacklogIds = new Set<string>();
      collectWorkitemIds(WORKITEMS_DIR, cachedBacklogIds, true);
      for (const p of ["P0", "P1", "P2", "P3"]) {
        collectWorkitemIds(join(BACKLOG_DIR, p), cachedBacklogIds, false);
      }
    }
    return cachedBacklogIds.has(ref.raw);
  }
  return false;
}

// Back-compatible boolean view: `live` only. An `archived` reference is NOT live —
// it points at a directory the file is not in — so it stays `false` here and is
// reported through its own class.
function refExists(ref: Ref, dirs: RuleDirs = DEFAULT_DIRS): boolean {
  if (ref.kind === "backlog-id") return legacyCodeSpanExists(ref, dirs);
  return resolvePathRef(ref, dirs).state === "live";
}

// Full three-state resolution, for callers that need to tell `archived` from `dead`.
function resolveRef(ref: Ref, dirs: RuleDirs = DEFAULT_DIRS): PathResolution {
  if (ref.kind === "backlog-id") {
    return legacyCodeSpanExists(ref, dirs)
      ? { state: "live", via: "backlog-row lookup" }
      : { state: "dead", via: "backlog-row lookup" };
  }
  return resolvePathRef(ref, dirs);
}

function audit(rulesDir: string, archiveDir: string = RULES_ARCHIVE_DIR): AuditResult {
  const dirs: RuleDirs = { rulesDir, archiveDir };
  if (!existsSync(rulesDir)) {
    return {
      rulesScanned: 0,
      refsFound: 0,
      candidatesStale: [],
      resolvedCount: 0,
      archivedMisleading: [],
      displayMismatches: [],
    };
  }

  const ruleFiles = readdirSync(rulesDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  let refsFound = 0;
  let resolvedCount = 0;
  const candidatesStale: Ref[] = [];
  const archivedMisleading: Array<Ref & { resolution: PathResolution }> = [];
  const displayMismatches: DisplayMismatch[] = [];

  for (const ruleFile of ruleFiles) {
    const content = readFileSync(join(rulesDir, ruleFile), "utf8");
    const refs = pullRefs(content, ruleFile);
    refsFound += refs.length;
    for (const ref of refs) {
      const resolution = resolveRef(ref, dirs);
      if (resolution.state === "live") resolvedCount++;
      else if (resolution.state === "archived") archivedMisleading.push({ ...ref, resolution });
      else candidatesStale.push(ref);

      const mismatch = displayTargetMismatch(ref, dirs);
      if (mismatch) displayMismatches.push(mismatch);
    }
  }

  return {
    rulesScanned: ruleFiles.length,
    refsFound,
    candidatesStale,
    resolvedCount,
    archivedMisleading,
    displayMismatches,
  };
}

function renderReport(result: AuditResult, now: Date): string {
  const lines: string[] = [];
  lines.push("# `.claude/rules/` cross-reference audit");
  lines.push("");
  lines.push(`Generated: ${now.toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Rules scanned: ${result.rulesScanned}`);
  lines.push(`- References pulled: ${result.refsFound}`);
  lines.push(`- Resolved: ${result.resolvedCount}`);
  lines.push(`- Archived-in-\`rules.bak\` (misleading location): ${result.archivedMisleading.length}`);
  lines.push(`- Stale-pointer candidates: ${result.candidatesStale.length}`);
  lines.push(`- Display/target mismatches: ${result.displayMismatches.length}`);
  lines.push("");
  lines.push("## Archived-in-`rules.bak` (misleading, not missing)");
  lines.push("");
  lines.push("These resolve **only** in `.claude/rules.bak/` while the reference implies");
  lines.push("`.claude/rules/`. The file exists — the pointer names the wrong directory, which is");
  lines.push("why it is reported apart from the dead ones below.");
  lines.push("");
  if (result.archivedMisleading.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Rule | Origin | Reference | Actually at | Should say |");
    lines.push("|------|--------|-----------|-------------|------------|");
    for (const c of result.archivedMisleading) {
      const origin = c.origin ?? "code-span";
      lines.push(
        `| \`${c.fromRule}\` | ${origin} | \`${c.raw}\` | \`${c.resolution.actualPath ?? ""}\` | \`${c.resolution.shouldSay ?? ""}\` |`,
      );
    }
  }
  lines.push("");
  lines.push("## Display/target mismatches");
  lines.push("");
  lines.push("Markdown links whose backticked display text names a different directory than the");
  lines.push("link target resolves to. Heuristic: it says the two halves disagree, not which one");
  lines.push("is wrong. A display text with no `/` states no directory and is never a mismatch.");
  lines.push("");
  if (result.displayMismatches.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Rule | Display text | implies dir | Target | resolves to dir |");
    lines.push("|------|--------------|-------------|--------|-----------------|");
    for (const d of result.displayMismatches) {
      lines.push(
        `| \`${d.fromRule}\` | \`${d.displayText}\` | \`${d.displayImpliedDir}\` | \`${d.target}\` | \`${d.targetDir}\` |`,
      );
    }
  }
  lines.push("");
  lines.push("## 9-variant taxonomy reminder");
  lines.push("");
  lines.push("Candidates listed below failed direct path / glob / backlog-row lookup. Apply the");
  lines.push("9-variant taxonomy from `docs/hygiene-history/ticks/2026/05/14/1920Z.md` to classify");
  lines.push("each candidate before fixing — ~5% are healthy MISSes (rule-acknowledged-transient,");
  lines.push("conditional, alternative-location, legacy-noted, anti-pattern).");
  lines.push("");
  lines.push("## Candidates");
  lines.push("");
  if (result.candidatesStale.length === 0) {
    lines.push("_None — all references resolve._");
  } else {
    lines.push("| Rule | Kind | Origin | Reference |");
    lines.push("|------|------|--------|-----------|");
    for (const c of result.candidatesStale) {
      lines.push(`| \`${c.fromRule}\` | ${c.kind} | ${c.origin ?? "code-span"} | \`${c.raw}\` |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function main(argv: string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "error") {
    console.error(`error: ${parsed.message}`);
    return 64;
  }

  const result = audit(RULES_DIR);
  const report = renderReport(result, new Date());

  if (parsed.args.report) {
    writeFileSync(parsed.args.report, report);
    console.log(`wrote ${parsed.args.report}`);
  } else {
    console.log(report);
  }

  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}

export { audit, displayTargetMismatch, globResolves, pullRefs, refExists, renderReport, resolveRef };
export type { DisplayMismatch, PathResolution, PathState, Ref };
