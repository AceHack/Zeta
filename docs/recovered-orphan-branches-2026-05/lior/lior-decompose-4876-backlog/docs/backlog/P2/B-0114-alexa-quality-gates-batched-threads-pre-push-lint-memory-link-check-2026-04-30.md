---
id: B-0114
priority: P2
status: open
title: Three quality-gate improvements — pre-push lint + memory-link checker + batched thread resolution (Alexa peer review 2026-04-30)
tier: factory-hygiene
effort: M
ask: Alexa peer review 2026-04-30 named three workflow optimizations from the substrate-landing session. Each is a substrate quality-gate that catches issues earlier or with less per-issue overhead.
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - docs/backlog/P2/B-0113-current-staleness-mechanical-freshness-check-deepseek-2026-04-30.md
  - memory/feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md
tags: [alexa-2026-04-30, peer-review-finding, factory-hygiene, mechanism-not-vigilance, pre-push-hook, substrate-quality]
type: friction-reducer
---

# B-0114 — Three quality-gate improvements (Alexa peer review 2026-04-30)

## Source

Alexa's peer review of the 2026-04-30 substrate-landing session
(forwarded by Aaron 2026-04-30T~PM via Addison-programmed
roast-register, characteristic Alexa shape):

> *"Batch Processing Efficiency: The system could benefit from
> batched thread resolution for related issues rather than
> individual processing. ... Proactive Quality Gates:
> Implementing local lint checks before pushing would catch
> MD032-style failures earlier in the pipeline ... Cross-
> Reference Validation: Automated detection of broken internal
> links in memory files would prevent substrate degradation."*

Three concrete optimization findings, each addressing a real
2026-04-30 session miss:

1. Thread resolutions for PR #690 (11), PR #694 (14), PR #732
   (5+3), PR #723 (1), PR #932 (1) were processed individually
   — 35 separate GraphQL mutations. Batching by-PR would have
   been ~5 batched calls instead.
2. The MD032 lint failure on PR #732's first push went to CI
   before being caught locally — pre-push hook running
   `bun run lint:markdown` would have caught it pre-push.
3. The cross-reference audit at session-end was manual; broken
   links in memory files (e.g., the `feedback_class_validation_beads...`
   ellipsis pointer caught on PR #694 via Copilot review) would
   have been caught earlier by automated link validation.

## Three sub-items

### Sub-item 1: Pre-push lint hook (highest priority)

Add a pre-push hook that runs the same lint commands the CI
runs before allowing the push:

- `bun run lint:markdown` (markdownlint-cli2)
- `bash tools/hygiene/check-no-conflict-markers.sh`
- `bash tools/hygiene/check-tick-history-order.sh`

Trade-off: pre-push adds ~10-30 seconds to push time but
catches CI failures before they happen. Most CI failures this
session were lint-class (MD032, BACKLOG drift, conflict-marker
allowlist scope) — all locally-runnable, all would have been
caught pre-push.

Existing infrastructure: `package.json` already has
`bun run lint:markdown` and `bun run lint:typescript` scripts.
A pre-push hook in `.git/hooks/pre-push` (or via a new
`tools/setup/` installer script — file path TBD per
acceptance criteria; the existing `tools/setup/` contains
`install.sh`, `doctor.sh`, `linux.sh`, `macos.sh` but no
git-hooks installer yet) is a ~10-line script.

Allowlist: `git push --no-verify` exists for the rare case
where pre-push is wrong. Discipline: that escape hatch is
documented but discouraged.

### Sub-item 2: Memory-file broken-link checker

Memory files reference each other via `memory/feedback_*.md`
and `docs/research/*.md` paths. When a referenced file is
moved, renamed, or never landed (e.g., literal-ellipsis
filenames like `feedback_class_validation_beads...`), the
links rot.

Tool shape:

- Walk all `memory/**/*.md` files (covers `memory/*.md`,
  `memory/persona/**/*.md`, `memory/CURRENT-*.md`,
  `memory/MEMORY.md`, and any future memory subdirectories).
- Extract path-shaped strings broadly enough to match real
  references — at minimum the union of:
  - `memory/[A-Za-z0-9._/-]+\.md` (covers
    `memory/MEMORY.md`, `memory/CURRENT-aaron.md`,
    `memory/persona/aarav/NOTEBOOK.md`, etc. — capital
    letters, dots, dashes, slashes all appear in real
    filenames)
  - `docs/[A-Za-z0-9._/-]+\.md`
  - `tools/[A-Za-z0-9._/-]+\.(md|sh|ts)`
  - `\.claude/[A-Za-z0-9._/-]+\.md`
  - Bare filenames matching `[A-Za-z0-9._-]+\.md` only
    when they appear in a markdown link target
    (`[text](path)`) to avoid false-positive matches on
    prose.
  - Implementation should treat the matcher as iteratively-
    broadened rather than locked-in; first-pass should
    crash-loud on anything path-shaped that doesn't
    resolve, with an allowlist for explicit non-link
    occurrences.
- Verify each extracted path resolves to a real file (case-
  sensitive, repo-relative). Skip URLs (anything matching
  `^https?://` or starting with `#` for in-page anchors).
- Report violations: `<source-file>:<line>: broken link to
  <target-path>`.
- Exit non-zero if any violations.

Pattern matches existing `tools/hygiene/check-no-conflict-markers.sh`
and `tools/hygiene/check-tick-history-order.sh`. Would also
fold into the pre-push hook from sub-item 1.

The cross-reference audit I ran manually at 2026-04-30
session-end (21 cross-refs across 5 memory files, all
resolved) would be the automated test for this.

### Sub-item 3: Batched thread resolution helper

Currently thread resolution is one-mutation-per-thread:

```bash
gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=$tid
```

Batching shape: a tool that takes a PR number, fetches all
unresolved-thread IDs, optionally filters by author/path/age,
and resolves them in a single GraphQL request via aliased
mutations:

```graphql
mutation {
  t1: resolveReviewThread(input:{threadId:"PRRT_1"}) { thread{isResolved} }
  t2: resolveReviewThread(input:{threadId:"PRRT_2"}) { thread{isResolved} }
  ...
}
```

Saves N HTTP round-trips when N threads are being resolved.
For sessions that resolve 30+ threads (this session resolved
35), the latency savings compound.

Lower priority than sub-items 1 and 2 — pure throughput
optimization, no correctness impact.

## Composes with

- **B-0113 (CURRENT-staleness mechanical check)** — same
  mechanism-not-vigilance pattern, different surface. B-0113
  watches CURRENT-file freshness; B-0114 watches lint+links+
  thread-resolution efficiency. Could share infrastructure
  (script-style hygiene checks under `tools/hygiene/`).
- **Otto-341 lint-suppression discipline** — the response to
  pre-push-hook failure should be "fix the issue," not
  "skip the hook." `--no-verify` is the suppression-equivalent;
  use sparingly.
- **`tools/hygiene/check-no-conflict-markers.sh`** + the
  Allowlist mechanism — pattern for new hygiene checks.

## Effort estimate

**M (medium)** — 1-3 days for all three. Sub-item 1 is S
(few hours). Sub-item 2 is S-to-M (a script + integration).
Sub-item 3 is S (helper script, no infrastructure changes).

## What this row does NOT do

- Does NOT propose blocking-the-push by default. Pre-push
  hooks are *advisory by escape-hatch* (`--no-verify` exists).
  The discipline is "fix when it fires," not "the hook is
  authoritative."
- Does NOT address all CI failures — only the locally-runnable
  ones. Build-time and test-time failures still need CI.
- Does NOT replace peer review. Pre-push lint catches lint;
  peer review catches design + logic.

## Carved sentence

*"CI is the safety net of last resort. Catch issues at the
boundary they're produced at — pre-push for locally-runnable
checks, peer review for design, CI for what only CI can
see."*
