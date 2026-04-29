---
id: B-0099
priority: P3
status: open
title: PR-count claims are derived metrics — compute, don't narrate
tier: research-grade
effort: S
ask: Multi-AI synthesis packet 2026-04-29 (Deepseek + Amara filter)
created: 2026-04-29
last_updated: 2026-04-29
composes_with: [B-0098, B-0100, B-0101]
tags: [tick-history, derived-metadata, manual-drift-class, mechanical-guard, projection]
---

# PR-count claims are computed, not remembered

Hand-authored "session PR totals" in tick-history shards (e.g.
"30 PRs total this session arc") drift across shards. The
2026-04-29 session arc had to soften several claims to "approximate"
because the asserted totals diverged from the actual git log.
Same failure class as the tick-ordinal drift (B-0098): derived
metadata authored as prose.

## Resolution

When a tick shard needs to cite a session PR total:

1. **Don't write it as authoritative prose.** No "this is the
   thirty-first PR of the arc" style claims unless computed.

2. **If included, cite the computation.** Use the `gh pr list`
   `--author` CLI flag (not a search-string `author:` clause):

   ```bash
   # Either an explicit GitHub login (preferred for cold
   # readability):
   gh pr list --state merged --author "<your-gh-login>" \
     --search 'merged:>=2026-04-29' \
     --json number,mergedAt,title

   # Or @me (CLI shorthand for the authenticated user; valid
   # but reads ambiguously in prose):
   gh pr list --state merged --author "@me" \
     --search 'merged:>=2026-04-29' \
     --json number,mergedAt,title
   ```

3. **Better: move totals to a generated projection.** A small
   script that walks `docs/hygiene-history/ticks/YYYY/MM/DD/*.md`
   + `gh` API + `git log` and produces a session-summary file
   eliminates the manual drift class entirely.

## Composes with

- B-0098 (tick-ordinal-continuity lint) — sibling derived-metadata
  action item.
- `memory/feedback_bare_main_ambiguity_automation_discipline_explicit_refs_required_amara_2026_04_29.md`
  — same computed-vs-narrated discipline.

## Why P3

Same reasoning as B-0098 — the drift was caught and the prose
softened. Mechanical fix is bounded but research-grade-only per
the maintainer's narrowing.
