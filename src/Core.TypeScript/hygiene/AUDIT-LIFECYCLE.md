# Hygiene-audit lifecycle — reusable template

When a recurring class of repo-hygiene defect is identified (dead xrefs after a file migration, broken relative-path links in shards, duplicate IDs across backlog rows, etc.), the path from "this bug shipped twice" to "CI gate prevents recurrence" follows a consistent shape. Two audits in the repo have completed it; this doc summarizes the pattern so future audit authors can follow it deliberately.

## The 7-step pattern

```text
Discovery → Narrow fix → Scanner → Quality iterations → Baseline → CI enforce gate → (Maintenance)
```

| Step | Output | Typical PR count |
|------|--------|------------------|
| 1. Discovery | The bug class is named; an instance is observed in a review comment, a reviewer finding, or production-impact evidence | 0 (review artifact) |
| 2. Narrow fix | The observed instance is fixed; **no audit yet** | 1-N (per-instance fixes) |
| 3. Scanner | A detect-only audit script walks the surface and reports all instances of the bug class | 1 |
| 4. Quality iterations | Reviewer rounds catch real issues with the scanner: false positives, missing edge cases, cross-platform robustness, schema validation, API consistency | 1-3 (fixups on the scanner PR or follow-on PRs) |
| 5. Baseline | A grandfather mechanism (`--baseline <file>`) freezes pre-existing residue that can't / shouldn't be fixed retroactively | 1 |
| 6. CI enforce gate | A non-required `lint (xxx)` job invokes the scanner in `--enforce --baseline` mode; NEW violations fail; baseline residue stays grandfathered | 1 |
| 7. Maintenance | Periodic baseline review: each merged finding-fixing PR shrinks the baseline; eventually the baseline can be deleted and `--enforce` flips to "no baseline needed" | ongoing |

## Why the steps in this order

**Step 2 before step 3**: confirming the bug class via narrow fix proves it's a real defect class, not a one-off. Authoring a scanner before any fix risks building a tool for a non-recurring problem.

**Step 4 before step 5**: the scanner's output IS the input to baseline. If the scanner has false positives, those false positives end up in the baseline forever (or until rebuild). Quality-iterating the scanner before freezing the baseline is cheap; rebuilding the baseline after the fact is expensive (every consumer of the baseline file changes).

**Step 5 before step 6**: if the gate is wired before a baseline exists, the gate fails on pre-existing residue and blocks every PR. The baseline is what makes the gate landable WITHOUT a prior cleanup PR. (Alternatively: a "baseline cleanup PR" can shrink residue to zero before the gate lands — but this only works for mutable surfaces; for immutable artifacts like tick shards, the baseline is the only path.)

**Step 6 as non-required**: the first iteration of the gate is informational. Once it's been quiet for some calendar time (no false-positive flares, no maintenance gotchas), branch-protection can promote it to required.

## Worked example: §33 migration xrefs audit

Documented in `gate.yml` job comments + the `audit-section-33-migration-xrefs.ts` header.

| Step | PR | Output |
|------|-----|--------|
| Discovery | review on PR #3513 | Reviewer P2 catch on the section-33 archive-migration PR |
| Narrow fix | PR #3529 | Per-file backlink update |
| Scanner | PR #3548 | `audit-section-33-migration-xrefs.ts` (detect-only) |
| Quality | inline | (none recorded; first-pass quality was sufficient) |
| Baseline (cleanup-to-zero) | PR #3552 | Cleanup-via-edit (mutable surfaces); baseline shrinks to 0 findings |
| CI enforce | PR #3555 | `--enforce` flag + gate.yml `lint-section-33-migration-xrefs` job (Slice B.3 + B.4) |

Calendar duration: ~4 weeks (PR #3513 → PR #3555).

## Worked example: tick-shard relative-path audit

Documented in `gate.yml` job comments + the `audit-tick-shard-relative-paths.ts` header. Session captured in `docs/hygiene-history/ticks/2026/05/16/` shards from 0210Z onward.

| Step | PR | Output |
|------|-----|--------|
| Discovery | PR #3676 + #3679 | Copilot caught 5-`..` paths landing at `docs/` instead of repo root, twice in one session |
| Narrow fix | PR #3676 fixup + PR #3680 | Per-file dot-count corrections |
| Scanner | PR #3692 | `audit-tick-shard-relative-paths.ts` (detect-only) — 17 baseline findings on 833 shards |
| Quality (filter) | PR #3692 fixup | `isPlaceholderTarget` filter dropped 7 false positives (17 → 10) |
| Quality (round 1) | PR #3692 fixup | sonarjs disable, `main` export + `import.meta.main` guard, generic URI scheme, `--files` validation |
| Quality (round 2) | PR #3692 fixup | Directory-input rejection + Windows `PATH_SEP` |
| Quality (round 3) | PR #3699 fixup | Baseline schema type guard + JSON output API consistency |
| Baseline | PR #3699 | `--baseline <path>` flag + `audit-tick-shard-relative-paths.baseline.json` (10 entries) |
| CI enforce | PR #3708 | Non-required `lint (tick-shard relative-paths)` gate invoking `--enforce --baseline` |

Calendar duration: ~80 min (single autonomous-loop session, 14 ticks).

## Notes for future audit authors

### When pre-existing residue is mutable, prefer cleanup-to-zero over baseline

The §33 audit cleared all 10 pre-existing findings via in-place edits before the gate landed. This is cleaner: no baseline file to maintain, no special-case logic in the audit. Use it when the surface allows in-place edits (rules, memory, backlog rows, source files).

### When pre-existing residue is immutable, baseline is the path

Tick shards live under the Event-Sourcing-style immutability discipline (`docs/hygiene-history/ticks/README.md`). Editing historical shards retroactively violates the discipline. The baseline mechanism is the structural alternative — accept the constraint; ship the gate; gate only blocks NEW.

### Scanner-author bug classes worth pre-empting in step 3

Common findings during step 4 (quality iterations), worth pre-empting:

1. **Tool-side false positives** — examples, placeholders, in-prose pattern illustrations. Add a filter step before resolution.
2. **`spawnSync("git", ...)`** — needs `// eslint-disable-next-line sonarjs/no-os-command-from-path` comment per repo convention.
3. **Top-level `process.exit(main(...))`** — blocks module-import; use `if (import.meta.main) { process.exit(main(...)); }` guard.
4. **URI scheme exclusion** — generic regex `^[A-Za-z][A-Za-z0-9+.-]*:` covers `http(s)`, `mailto`, `ftp`, `file`, `tel`, `data`, etc. — don't enumerate the subset you happen to think of.
5. **`--files` arg validation** — check existence AND `statSync.isFile()`; reject directories upfront with exit 64.
6. **Path-separator portability** — use `sep as PATH_SEP` from `node:path`; never hardcode `/` in path-prefix tests.
7. **JSON output schema discipline** — if the docstring describes a partition (e.g. `baselineMatched` vs `newFindings`), emit BOTH as arrays. Mixed array + scalar invites consumer mismatches.

### Baseline schema validation

The baseline-load function MUST validate each entry:

```ts
function isBaselineEntry(v: unknown): v is BaselineEntry {
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o["file"] === "string"
    && typeof o["line"] === "number"
    && Number.isInteger(o["line"])
    && (o["line"] as number) >= 1
    && typeof o["target"] === "string";
}
```

A blind `as readonly BaselineEntry[]` cast silently fails to match malformed entries — they become "new" findings, breaking `--enforce` semantics without surfacing the schema error.

## Composes with

- `audit-section-33-migration-xrefs.ts` — sibling audit, complete lifecycle
- `audit-tick-shard-relative-paths.ts` — sibling audit, complete lifecycle
- `.github/workflows/gate.yml` — CI enforce gate convention (non-required by default)
- `.claude/rules/blocked-green-ci-investigate-threads.md` — the rule that surfaces audit findings as PR-blocking review threads
