---
id: 081KR50HA0008QG0R003B1S5NF
priority: P1
status: partial
title: "Capture model + token usage in commit trailer (git-native, cost derived at query time)"
effort: S
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [cost-governance, model-routing, A/B-testing, enterprise-billing]
---

# 081KR50HA0008QG0R003B1S5NF — Capture model + token usage in commit trailer

## What

Every commit created by the background loop (or foreground
subagents) should include a `Tokens:` trailer in the commit
message — raw token counts only, no cost estimate:

```
Tokens: model=opus input=200420 output=45100 dur=156s
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

**Tokens are the atoms. Cost is derived at query time** from
the current rate card. Never store cost — it changes when
pricing changes. Store the immutable fact (tokens used),
derive the view (dollar cost) when you need it.

Git-native. Survives host migration. Queryable via
`git log --grep="Tokens:"`.

## Why

On enterprise API billing, this data is the evidence for
Kevin's reports. Token counts are the raw material; the
report script multiplies by the current pricing table to
produce cost. No re-pricing hygiene needed — the facts
never rot, only the rate card changes.

## Implementation

1. The `claude` CLI prints token usage to stderr on
   completion. Parse the last line matching
   `"input_tokens": N, "output_tokens": N` from stderr.
2. In `claude-loop-tick.ts`, capture stderr output
   (already done — logged to `ticks.err`), extract
   token counts.
3. Include `Tokens:` trailer in the commit message the
   tick creates, right above the `Co-Authored-By` footer.
4. In `model-rating-report.ts`, add `--git-costs` flag
   that parses `git log --grep="Tokens:"`, multiplies by
   the current pricing table, and aggregates per-model.

## Acceptance criteria

- [ ] Every background-loop commit has `Tokens:` trailer
- [ ] `git log --grep="Tokens:" --oneline` shows usage per commit
- [ ] `model-rating-report.ts --git-costs` derives cost from log
- [ ] Foreground subagent commits also include token trailer

## Composes with

- `docs/ops/COST-REDUCTION-LESSONS.md` (pricing reference)
- `docs/ops/agents/otto-cost-profile.md` (per-agent cost model)
- `tools/ops/model-rating-report.ts` (report consumer)
- 081KR50HA0008QG0R002ZNFQBZ (skill description carving — reduces context cost)
