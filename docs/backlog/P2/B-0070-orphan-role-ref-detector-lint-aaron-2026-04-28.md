---
id: B-0070
priority: P2
slug: orphan-role-ref-detector-lint
status: backlog
created: 2026-04-28
maintainer: aaron
ownership: otto
title: Orphan role-ref detector lint — catch ferry-N without named source on code surfaces (Aaron 2026-04-28)
---

# B-0070 — Orphan role-ref detector lint

## Why

The human maintainer 2026-04-28 (verbatim, /btw aside during PR #24
drain):

> "not sure if you can update to find things like that that don't make
> sense in the future like look for courrier-ferrrrry or whatever IDK
> just thinking out out for your future self and the review agentsd"

Aaron caught a recurring failure mode: when stripping named attribution
from code-surface text per the Otto-279 history-surface-only rule, the
mechanical replacement leaves orphan role-refs that don't carry semantic
weight. The detection should be a lint that catches this pattern at
write-time, before it ships.

Documented in `memory/feedback_orphan_role_ref_after_name_stripping_aaron_2026_04_28.md`.

## What

Lint that scans code-surface files (excluding history-surfaces) for:

1. **Orphan role-ref forms** — text like `courier-ferry-N`, `ferry-N`,
   `ferry-N's` without a resolvable named source nearby. These are
   the over-stripped attributions that should EITHER be removed
   entirely OR replaced with a self-contained principle name.

2. **Un-stripped name attribution on code-surface** — text like
   `Amara ferry-N`, `Grok ferry-N`, `Gemini ferry-N`, `Per <Name>
   2026-MM-DD` on code-surface files (`tools/`, behavioural `docs/`,
   `.claude/skills/`). Should be moved to a history-surface OR
   replaced with role-ref AND self-contained principle name.

Scope:

- **Apply to:** `tools/**` (excluding `tools/lean4/.lake/`),
  behavioural docs in `docs/` (excluding history surfaces),
  `.claude/skills/**/SKILL.md` (skill bodies),
  `src/**`, `*.fsproj`, `*.csproj`
- **Exclude (history surfaces per Otto-279):** `memory/**`,
  `docs/research/**`, `docs/aurora/**`, `docs/ROUND-HISTORY.md`,
  `docs/DECISIONS/**`, `docs/hygiene-history/**`,
  `docs/pr-preservation/**`, `docs/pr-discussions/**`, commit
  messages

## How

Initial implementation: bash script under `tools/hygiene/` matching
the existing audit-* pattern. Wired into CI gate as a soft-fail (warn,
don't block) initially — same pattern as how
`audit-memory-index-duplicates.sh` started before being promoted to
hard-fail.

Detector regex (initial):

```
# Orphan role-ref (no resolvable named source)
\bcourier-ferry-\d+\b
\bferry-\d+\b
\bferry-\d+'s?\b

# Un-stripped name attribution on code-surface
\b(Amara|Grok|Gemini|Codex|Cursor|Aaron|Otto)\s+ferry-\d+\b
\bPer\s+(Amara|Grok|Gemini|Codex|Cursor|Aaron|Otto)\s+2026-
```

Output shape: per-finding row with file:line:column, the matched
text, and a fix-suggestion (one of: remove attribution clause / move
to history surface / replace with self-contained principle name).

## Composes with

- **Otto-279 history-surface carve-out** at
  `docs/AGENT-BEST-PRACTICES.md` ~287-348 — defines WHICH surfaces
  get named attribution
- **`memory/feedback_orphan_role_ref_after_name_stripping_aaron_2026_04_28.md`** — the substrate
  capturing the failure mode
- **`prompt-protector` skill** — invisible-Unicode lint shape;
  orphan-role-ref lint would compose at the same write-time-scan
  layer
- **`tools/hygiene/audit-memory-index-duplicates.sh`** — pattern
  template for the audit-script shape
- **task #296** (commit-message-shape skill update) — the skill body
  is also code-surface; lint catches inadvertent named-attribution in
  the skill prose

## Cadence

When other 0/0/0 work clears OR when an orphan role-ref ships in a PR
that the lint would have caught (whichever fires first). Composes
with the `skill-improver` workflow — when `commit-message-shape` skill
is next updated (task #296), bundle the lint with it.

## Provenance

- Aaron 2026-04-28 verbatim (above) during PR #24 review
- Pattern empirically caught: PR #24 had 4 orphan role-refs after
  mechanical name-strip; cleanup was reactive, not preventive
- Companion memory:
  `memory/feedback_orphan_role_ref_after_name_stripping_aaron_2026_04_28.md`
