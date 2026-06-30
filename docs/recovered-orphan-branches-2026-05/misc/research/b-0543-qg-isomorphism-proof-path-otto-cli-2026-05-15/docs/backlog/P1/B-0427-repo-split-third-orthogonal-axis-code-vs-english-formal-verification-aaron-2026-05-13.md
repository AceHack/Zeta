---
id: B-0427
priority: P1
status: closed
title: "Repo-split THIRD orthogonal axis — code vs English + formal-verification-maybe-split + ruleset-divergence smell test"
type: planning
origin: Aaron 2026-05-13 (autonomous-loop substrate cascade)
created: 2026-05-13
last_updated: 2026-05-14
closed: 2026-05-14
closed_by: "docs/DECISIONS/2026-05-14-axis3-code-english-formal-verification-design.md"
decomposed_into:
  - B-0475
  - B-0476
  - B-0477
  - B-0478
  - B-0479
decomposed_by: "Otto (otto-cli), 2026-05-14"
composes_with:
  - B-0424
  - B-0425
  - B-0426
  - memory/feedback_aaron_repo_split_third_orthogonal_axis_code_vs_english_formal_verification_maybe_split_ruleset_divergence_is_smell_2026_05_13.md
  - memory/feedback_orthogonal_axes_factory_hygiene.md
  - memory/feedback_aaron_repo_split_orthogonal_mirror_beacon_axis_speculative_fast_forks_vs_governance_citation_gated_another_orthogonality_2026_05_13.md
---

# Repo-split THIRD orthogonal axis — code vs English + formal-verification-maybe-split + ruleset-divergence smell test

## Aaron's directive

Aaron 2026-05-13: *"we should also likely start to split based
on code vs english except some docs belong in repo via best
enginerring practices, maybe even formal verificatino is split
out, kind of like if they need diffeent rulesets in github its
likely a smell for a differnt repo split and time savings and
it will help with composablity of our depdendies."*

## Three-axis repo-split design space (running)

| Axis | Values | Origin |
|---|---|---|
| **Axis 1** | Factory / Product / Owner-only | B-0424 + B-0425 + PR #2905 |
| **Axis 2** | Mirror / Beacon | B-0426 + PR #2910 |
| **Axis 3** | Code / English (+ formal-verification sub-axis) | THIS / B-0427 |

All three axes apply simultaneously per
`.claude/rules/default-to-both.md`.

## Axis 3 decomposition

### Primary cut: Code vs English

- **Code** — F#/C#/TS/Python source, build, tests, F# CE,
  peer-call wrappers, hooks, validators
- **English** — research docs, philosophy, narrative, memory
  files, persona notebooks, conversation absorbs

### Engineering-docs exception (stay with code)

README, ADRs, architecture diagrams, CONTRIBUTING, API docs,
GLOSSARY-for-code, CHANGELOG, build/run/test instructions, CI
config docs, security policies, CODE_OF_CONDUCT.

### Formal-verification sub-axis (maybe split)

Candidates for own repo: TLA+ / Lean / Z3 / FsCheck / Stryker /
Alloy / CodeQL custom / Semgrep rules.

Per Soraya formal-verification-expert authority — per-property-
class evaluation owed.

### Ruleset-divergence smell test

> If two substrate clusters need DIFFERENT GitHub rulesets to
> govern them, that divergence IS the signal they should live
> in DIFFERENT repos.

The smell test IS the substrate-honest decision criterion.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

1. **Prior-art search** — verify the existing three-axis
   substrate composes without conflict
2. **Dependency restructure** — walk composes_with chain
3. **Per-repo three-axis classification** owed for existing
   and proposed repos (Done via B-0477)
4. **Ruleset audit** — survey existing rulesets; document
   divergences as candidate-split signals
5. **Soraya consultation** for formal-verification sub-axis
   (per-property-class evaluation)

## What this row does NOT commit to

- **NOT execution of repo splits this round** — planning + per-
  repo evaluation
- **NOT mandate to split docs from code** — engineering-docs
  exception preserved
- **NOT mandate to split formal verification** — substrate-
  honest "maybe" with per-property-class evaluation owed
- **NOT replacement of Axis 1 or Axis 2** — composes per
  default-to-both

## Composes with

- B-0424 (three-repo split Stage 1 — factory)
- B-0425 (product-repo split planning)
- B-0426 (Axis 2 — Mirror/Beacon)
- PR #2909 (civsim language mirror/beacon governance)
- PR #2910 (Axis 2 substrate)
- PR #2905 (forker-perspective META-discipline)
- `memory/feedback_orthogonal_axes_factory_hygiene.md`
  (orthogonal-axes discipline)
- `.claude/rules/default-to-both.md`
- `.claude/rules/lfg-acehack-topology.md` (ruleset-divergence
  composes here)
- Soraya formal-verification-expert authority

## Definition of done

- Three-axis classification matrix populated for ALL existing
  / proposed repos
- Ruleset audit complete (existing rulesets surveyed; divergence
  candidates identified)
- Per-repo split decisions made
- Formal-verification per-property-class evaluation complete
- ADR recording the three-axis design decision (extends
  2026-04-22 three-repo-split ADR + B-0426 mirror/beacon ADR)
- Backlog row closed with PR link to ADR + per-repo decisions

## Why P1

- Composes with B-0424 + B-0425 + B-0426 (sibling backlog
  rows)
- Aaron has explicitly named the orthogonality
- Composes with substrate cascade from this session (three
  orthogonal axes named within ~30 min)
- Unblocks Stage 1 Factory split (B-0424) by clarifying
  axis-3 classification
- Strategic-substrate (per PR #2902) composes with formal-
  verification governance gate
- Time savings + composability benefits Aaron named

## Decomposition — 5 atomic child rows (Otto, 2026-05-14)

Dependency order:

```
B-0475 (prior-art gate, no deps)
    ├── B-0476 (ruleset divergence audit)   ─┐
    ├── B-0477 (Code/English classification) ─┤→ B-0479 (ADR — terminal)
    └── B-0478 (FV sub-axis evaluation)     ─┘
```

| Row | Title | Type | Deps |
|-----|-------|------|------|
| [B-0475](B-0475-axis3-prior-art-substrate-consistency-audit-2026-05-14.md) | Axis-3 prior-art audit | research | none |
| [B-0476](B-0476-github-ruleset-divergence-audit-2026-05-14.md) | GitHub ruleset divergence audit | research | B-0475 |
| [B-0477](B-0477-axis3-code-english-classification-matrix-2026-05-14.md) | Code/English classification matrix | research | B-0475 |
| [B-0478](B-0478-formal-verification-repo-split-evaluation-2026-05-14.md) | FV sub-axis per-property-class evaluation | research | B-0475 |
| [B-0479](B-0479-axis3-adr-code-english-formal-verification-design-2026-05-14.md) | Axis-3 ADR (terminal) | adr | B-0476, B-0477, B-0478 |

B-0476, B-0477, and B-0478 can be worked in parallel after B-0475 closes.
