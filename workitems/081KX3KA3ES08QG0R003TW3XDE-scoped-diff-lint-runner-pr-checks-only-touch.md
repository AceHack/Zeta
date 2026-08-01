---
id: 081KX3KA3ES08QG0R003TW3XDE
type: task
state: in-progress
priority: P1
slug: scoped-diff-lint-runner-pr-checks-only-touch
title: "Scoped-diff lint runner — PR checks report only files the PR touches"
created: 2026-07-09T14:08:50.000Z
depends_on: []
composes_with: []
---

# Scoped-diff lint runner — PR checks report only files the PR touches

<!-- ZetaId-keyed work item. Minted 2026-07-09 by Otto (cowork) from the
     drift-and-heal ADR build-out (docs/DECISIONS/2026-07-09-drift-and-heal-
     replaces-pre-merge-gates-reconciliation-at-ai-speed.md). -->

ADR decision item 4: a PR reports drift only in files it touches;
whole-repo state never blocks an unrelated lane (kills the 2026-07-08
priority inversion: clean PRs blocked ~2.5h by other lanes' drift).

Deliverable: wrap the gate's lint jobs so findings are filtered to the
merge-ref DIFF paths (git diff --name-only base...head). Full-tree runs
continue on main as drift detectors (separate item). Start with
markdownlint + semgrep + the inventory checks — the classes that caused
the inversion.

## Progress (2026-08-01)

Filter core landed: `src/Core.TypeScript/hygiene/scoped-lint.{ts,test.ts}` —
pure parse/classify/filter over any linter's output (markdownlint, tsc/dotnet
paren format, shellcheck gcc format, generic path: prefix) against a
`git diff --name-only` changed-set; in-scope findings exit 1, out-of-scope
findings print as informational (the continuous detector on main owns them);
optional `--tracked` guard keeps path-shaped prose from misclassifying.
Composable pipe contract — no per-linter integration:
`<linter> 2>&1 | scoped-lint.ts --changed changed.txt [--tracked ls-files.txt]`.

Remaining before done: wire the gate's lint jobs through the filter (compute
the merge-ref diff once per run, thread it to markdownlint / semgrep /
inventory steps) — a workflow change that should land with fleet eyes on it.
