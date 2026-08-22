# substrate-claim-checker

Substrate-claim-checker per the verify-then-claim discipline memo
(`memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md`).

Catches 6 081KQNJ500008QG0R003SCWBDV check-types:

- **Count drift** (v0.4.4) — between narrative claims (e.g. "18+ drift
  instances", "13-row table", "5 procedure skills") and the actual
  count of structured rows the claims reference. Implemented in
  `check-counts.ts`.
- **Existence drift** (v0.5) — claims that a file or directory exists
  when it doesn't on disk. Implemented in `check-existence.ts`.
- **Path-form drift** (v0.7) — same physical file referenced with
  inconsistent path forms within a single document. Implemented in
  `check-path-forms.ts`.
- **Cross-surface count drift** (v0.8) — count claims in YAML
  frontmatter `description:` fields that don't match any body table.
  Catches eval-set instances #19 and #20 (frontmatter claims a count
  that diverges from the actual table row count). Implemented in
  `check-cross-surface.ts`.
- **Convention drift** (v0.9) — claims that a current ADR supersedes
  an earlier ADR when the earlier ADR lacks the reciprocal top-of-file
  `Superseded by` marker naming the superseding ADR. Implemented in
  `check-convention.ts`.
- **Self-recursive drift** (v0.9.1) — a memo declaring itself ABOUT a
  drift sub-class violates that same discipline within its own body.
  Opt-in via a `self-check:` frontmatter directive. Implemented in
  `check-self-recursive.ts`. Supported topics: `count`, `existence`.

The remaining deferred check-types are semantic-equivalence and
empirical-output drift.

## Usage

```bash
bun src/Core.TypeScript/substrate-claim-checker/check-counts.ts <file>
bun src/Core.TypeScript/substrate-claim-checker/check-counts.ts memory/feedback_*.md
bun src/Core.TypeScript/substrate-claim-checker/check-convention.ts docs/DECISIONS/*.md
```

Exit code 0 = no drift detected (warnings alone are non-blocking per the v0.6 severity model — see "v0.6 — gitignore awareness for existence-drift" below). Exit code 1 = drift detected (or
input error).

## What it does (v0)

- Scans narrative for patterns: `N <noun>` where `<noun>` is one of
  drift instances / rows / items / procedure skills / named-persona
  experts / tools / sub-classes.
- Counts `^| ... |$` data rows in the nearest markdown table within
  50 lines below the claim.
- Reports drift if claimed N differs from actual. **Special case for `N+` minimum-count claims:** drift fires only when `actual < N` (the `+` suffix indicates "at least N", so an undercount is drift but an overcount is not).

## Known v0 limitations

- **Nearest-table heuristic**: when a memo has multiple tables, the
  tool grabs the FIRST table below the claim. If a claim like "4
  named-persona experts" is followed by a procedure-skills table
  (7 rows) and then an experts table (4 rows), the tool flags the
  first as drift incorrectly. v1 should noun-match to the right
  table.
- **Rhetorical numbers**: `"100 rows"` in `"you can close 100 rows
  without invoking..."` is rhetorical, not a count claim. v0 flags
  these as false positives. v1 should distinguish summary-claim
  from rhetorical-illustration via context analysis.
- **Lists not counted**: only markdown-table data rows are counted.
  Bulleted lists with N items aren't counted yet (v1 candidate).
- **Top-level tables only**: lines must start with `|` in column 1 to
  be recognized as table rows. Indented tables (inside nested lists
  or blockquotes) aren't recognized yet. v1 candidate: relax the
  leading-anchor in `findTables` from `^\|` to `^\s*\|`.

## Drift classes

- **Count drift** (claimed markdown-table row count doesn't match) — shipped v0
- **Existence drift** (file/dir/tool claimed to exist; doesn't) — shipped v0.5
- **Path-form drift** (fully-qualified vs bare paths inconsistent) — shipped v0.7
- **Convention drift** (recommended pattern doesn't match canonical) — shipped v0.9
- **Self-recursive drift** (the memo about drift contains its own drift) — shipped v0.9.0 (count-topic only; others deferred per 081KQNJ500008QG0R003SCWBDV.3 slice)
- **Semantic-equivalence drift** (command substitution claims) — v1
- **Empirical-output drift** (run-the-command-and-compare) — v1

## Composes with

- `memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md` —
  the discipline this tool mechanizes
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` —
  rule 2 (no dynamic commands in skills; use TS files); this tool
  IS one of the TS files for that purpose
- 081KQNJ500008QG0R003SCWBDV (the backlog row this tool implements; see
  `docs/backlog/P1/081KQNJ500008QG0R003SCWBDV-substrate-claim-checker-ts-tool-aaron-2026-05-03.md`)

## Eval set (drift instances catalogued in the verify-then-claim memo)

The verify-then-claim memo
(`memory/feedback_verify_then_claim_discipline_dominant_failure_mode_substrate_authoring_otto_2026_05_03.md`)
catalogues historical drift instances across 9+ PRs as the empirical
eval-set; the table-row count in that memo's body is the canonical
count (it grows with each new instance caught). v0 catches the count-drift sub-class
specifically; instances marked count-drift in the memo's
"Recurring sub-classes" section are this tool's primary regression
suite.

Frozen on-disk fixtures live in `fixtures/`. Each fixture is a minimal
markdown file reproducing one historical drift instance, paired with
a regression test in `fixtures.test.ts`. The fixture seed is one
count-drift case from PR #1259; additional sub-classes land
incrementally per 081KQNJ500008QG0R003SCWBDV.4. See `fixtures/README.md` for the index
and the "adding a new fixture" procedure.

## Hooks integration (planned, not v0)

Per the verify-then-claim memo's mechanization-path section:

- **pre-commit** hook: validate staged-file content (memos, docs)
- **commit-msg** hook: validate the commit message itself
- **CI check**: validate PR descriptions on host

These will land in subsequent PRs once the tool's check-types are
mature enough to trust as gates.

## v0.5 — `check-existence.ts` (existence drift)

The `check-existence.ts` tool is the second sub-class checker, covering the **existence drift** sub-class (per the verify-then-claim memo's 7-class taxonomy).

### What it catches

Claims that a file or directory exists when it doesn't:

- Backtick-quoted paths: `` `path/to/X.md` ``
- Markdown link targets: `text <!-- STALE-REF: relative/path -->` — relative paths only

### Resolution order

For each path claim, tries three candidate roots:

1. The file's own directory (cross-references within the same dir)
2. The parent directory (bare-filename references for files in subdirs)
3. The repository root (repo-relative paths)

Stops on first hit. Emits a finding only if NO candidate root resolves.

### Future-state context detection

Claims marked future-state are exempt:

- `(proposed)`, `(planned)`, `(future)`, `(would be)`, `(not yet)`, `(tbd)`, `(deferred)`, `(pending)`
- Phrasings: "would be", "will be", "to be authored", "not yet exists", "doesn't yet exist", "future-state", "row deliverable", "I'm guessing", "concretely something like", "will probably", "lower confidence"

Detected within the line + ±1 line context window.

### Skipped automatically

- Glob patterns (`*`, `?`, `[...]`) — not real paths
- URLs (http://, https://, mailto:) — not file-system
- Anchor-only links (`#section`) — same-page anchors
- Absolute paths (`/etc/...`) — system paths, out of repo scope
- Short strings (<3 chars) — unlikely to be paths
- Placeholders (`<...>`, `{...}`, `XXX`)
- Fenced code blocks — example paths in code shouldn't false-positive

### Known limitations (v0.5)

- Calibration-delta tables that cite path-forms as discussion topics (not claims of existence) may false-positive. Mitigated by future-marker context detection but imperfect.
- Section-level future-state markers (e.g., a section header `## (Proposed) X`) don't propagate to claims further down. Use inline markers per claim or per paragraph.

### Usage

```
bun src/Core.TypeScript/substrate-claim-checker/check-existence.ts <file>
bun src/Core.TypeScript/substrate-claim-checker/check-existence.ts <file1> <file2> ...
```

Exit codes match check-counts.ts: `0` clean, `1` drift detected or input error.

## v0.6 — gitignore awareness for existence-drift

Extends `check-existence.ts` to flag a new sub-class: paths that exist on disk but are gitignored. Per substrate convention, references should point to git-tracked paths or stable URLs, NOT to local-mirror sync state (e.g., `references/prior-art/*` which is gitignored per the upstream-mirror sync convention).

### Empirical seed

PR #1322 review found `references/prior-art/efcore/.github/workflows/copilot-setup-steps.yml` referenced in a tick shard. The path exists on disk (synced from upstream efcore) but is gitignored. Pre-v0.6, `check-existence.ts` reported "no drift" because the path resolved on disk; v0.6 emits a warning.

### Severity model (new in v0.6)

- **drift** (severity `"drift"`): path doesn't exist anywhere — exit code 1
- **warning** (severity `"warning"`): path exists on disk but is gitignored — exit code 0 (substrate-quality concern but not blocking)

If both are present, drift wins for exit code (1).

### Implementation

Uses `git check-ignore --quiet <path>` via `spawnSync` (no shell — avoids command injection) to ask git directly. Exit code 0 from git = path IS gitignored; exit code 1 = NOT gitignored. The 5-second timeout guards against pathological cases.

## v0.7 — `check-path-forms.ts` (path-form drift)

The third sub-class checker, covering **path-form drift** — when the same physical file is referenced with inconsistent path forms within a single document.

### What it catches

A document references the same file using different string forms:

- `src/Core.TypeScript/substrate-claim-checker/check-counts.ts` on line 3
- `check-counts.ts` on line 7

Both resolve to the same on-disk file, but a reader may not realize they're the same, and a grep for the full path misses the bare form.

### How it works

1. Extracts all path claims via `findPathClaims()` (reused from `check-existence.ts`)
2. Resolves each claim to an absolute path using the same 3-root resolution (file dir → parent dir → repo root)
3. Groups claims by resolved absolute path
4. For groups with >1 distinct string form, emits a path-form drift finding

Non-resolving paths are skipped (that's `check-existence.ts`'s domain).

### Usage

```bash
bun src/Core.TypeScript/substrate-claim-checker/check-path-forms.ts <file>
bun src/Core.TypeScript/substrate-claim-checker/check-path-forms.ts <file1> <file2> ...
```

Exit codes: `0` clean, `1` drift detected or input error.

### Known limitations (v0.7)

- **Same-directory prose vs usage-example forms**: a README documenting
  its own directory naturally uses bare filenames in prose (`check-counts.ts`)
  and fully-qualified paths in usage examples
  (`src/Core.TypeScript/substrate-claim-checker/check-counts.ts`). Both are intentional.
  v1 candidate: exempt paths inside fenced code blocks from grouping, since
  usage examples conventionally show repo-root-relative invocations.

## v0.8 — `check-cross-surface.ts` (cross-surface count drift)

The fourth sub-class checker, covering **cross-surface count drift** —
when the YAML frontmatter `description:` field claims a count that
doesn't match any table in the document body.

### Empirical eval-set (from the verify-then-claim memo)

- **Instance #19**: frontmatter description said "9 drift instances"
  but the body table had 15+ rows.
- **Instance #20**: frontmatter description updated to "18+" but the
  body table still had only 15 rows — the count-drift fix itself
  introduced opposite-direction drift.

### How it works

1. Parses YAML frontmatter (leading `---` block)
2. Extracts count claims from the `description:` field using the
   same noun vocabulary as `check-counts.ts`
3. Finds all markdown tables in the document body
4. For each count claim, checks if ANY body table satisfies it
   (exact match for `N noun`; at-least match for `N+ noun`)
5. Reports drift if no table satisfies the claim

### "Any-table" semantics

Frontmatter precedes the entire body, so the "nearest table within
50 lines" heuristic used by `check-counts.ts` is inapplicable. Instead,
any table in the body can satisfy the claim. A multi-table file
(drift-instances table + sub-classes table) passes if either table
matches.

### Usage

```bash
bun src/Core.TypeScript/substrate-claim-checker/check-cross-surface.ts <file>
bun src/Core.TypeScript/substrate-claim-checker/check-cross-surface.ts <file1> <file2> ...
```

Exit codes: `0` clean, `1` drift detected or input error.

### Known limitations (v0.8)

- **Only `description:` field scanned**: other frontmatter fields
  (e.g., `title:`, custom fields) are not checked. v0.9 candidate.
- **Body-only tables**: section headings that embed counts
  (e.g., `## 7 sub-classes`) are not compared. v0.9 candidate.
- **No table semantics**: the checker doesn't know which table
  corresponds to which claim — it uses any-table permissive
  matching. A document with a 15-row drift table and a 3-row
  sub-classes table would pass a "15 sub-classes" claim
  (false negative). v0.9 noun-matching would address this.

## v0.9.0 — `check-self-recursive.ts` (self-recursive drift)

The sixth sub-class checker, covering **self-recursive drift** —
the meta-failure where a memo declares itself ABOUT a drift
sub-class and then violates that same discipline within its own
body. Per the verify-then-claim memo's taxonomy: "the memo about
drift contains its own drift."

### Opt-in via frontmatter

Files declare their self-check topic explicitly:

```yaml
---
self-check: count
---
```

OR list form (v0.9.1+ supports multiple topics in one directive):

```yaml
---
self-check: [count, existence]
---
```

The directive is operationally honest — no heuristic topic
detection. A file only participates in self-recursive checks if
it opts in.

### Supported topics (v0.9.1)

- `count` — composes `check-counts.ts`; a memo about count drift
  should not contain its own count drift.
- `existence` (v0.9.1) — composes `check-existence.ts`; a memo
  about existence drift should not reference paths that don't
  exist. Only drift-severity findings are surfaced from the
  existence checker; the `warning` severity for
  exists-on-disk-but-gitignored is a distinct sub-class concern
  and not treated as a self-recursive violation.

Adding additional topics (path-forms, cross-surface, convention)
is a 1-line dispatch each; deferred to follow-up slices per the
081KQNJ500008QG0R003SCWBDV done-criteria.

### Usage

```bash
bun src/Core.TypeScript/substrate-claim-checker/check-self-recursive.ts <file>
bun src/Core.TypeScript/substrate-claim-checker/check-self-recursive.ts <file> ...
```

Exit codes: `0` clean (or no `self-check:` directive); `1` drift
detected or input error.

### Behavior notes

- Files without frontmatter or without `self-check:` are no-ops
  (exit 0).
- Unknown topic tokens are dropped with a stderr warning so
  misspellings do not silently disable the check.
- A directive containing only unknown topics is a no-op (exit 0).
