---
name: package-auditor
description: Use this skill to audit Dbsp.Core's NuGet package pins against latest NuGet versions and classify bumps (major/minor/patch) by whether our code actually touches the changed API surface. Runs `tools/audit-packages.sh`, queries release notes for majors, and produces a concrete bump plan — not a "defer all majors" fear-list.
---

# Dbsp.Core Package Auditor

You audit `Directory.Packages.props` against the NuGet feed.

## Project context (greenfield)

- No production callers. Breaking changes don't require coordination.
- The test gate (`dotnet test Dbsp.sln`) is the authoritative signal
  for "does our code still build+pass after a bump".
- Past lesson: Meziantou.Analyzer 2→3 was flagged scary; actually
  safe because our code didn't use the removed surface. **Test
  before defer.**

## Workflow

1. Run `bash tools/audit-packages.sh`. Parse output.
2. For each `⚠ bump available`:
   - SemVer-classify: MAJOR / MINOR / PATCH
   - For MAJOR: WebFetch the upstream CHANGELOG / release-notes page.
     Extract every bullet labelled "Breaking change" / "Removed" /
     "Incompatible".
   - Grep our `src/**/*.fs` + `tests/**/*.fs` for usages of the
     removed surface. If **zero hits** → safe to bump.
   - If hits exist → produce a diff showing the migration.
3. For MINOR + PATCH: bump unconditionally. Run `dotnet test`. Report
   pass/fail per-package.
4. Exception: **test-framework packages** (xunit, FsCheck, FsUnit,
   Microsoft.NET.Test.Sdk) — extra-strict. These break tests silently.
   Always run `dotnet test` between each one.
5. Produce prioritised bump list: one line per package with rationale.

## Anti-patterns to avoid

- "MAJOR bump, defer" without reading the CHANGELOG. This is the
  past-miss we're correcting.
- "All bumps together, one PR" when any one might regress. Prefer
  per-package PRs so bisect is easy.
- Skipping the `dotnet test` step — the audit is only honest if
  the tests actually run post-bump.

## Output format

```
| Package | Current → Latest | Level | Touches? | Verdict |
|---|---|---|---|---|
| Meziantou.Analyzer | 2.0.220 → 3.0.48 | MAJOR | no | ✅ BUMP |
| FSharp.Core | 10.1.201 → 10.1.202 | PATCH | n/a | ✅ BUMP |
| ...
```

Plus a one-line rationale per MAJOR-class bump citing the specific
removed/changed API and whether our code uses it.

## Reference
- `tools/audit-packages.sh` — shell audit
- `docs/INSTALLED.md` — dependency ledger to update alongside bumps
- `Directory.Packages.props` — the file you modify
