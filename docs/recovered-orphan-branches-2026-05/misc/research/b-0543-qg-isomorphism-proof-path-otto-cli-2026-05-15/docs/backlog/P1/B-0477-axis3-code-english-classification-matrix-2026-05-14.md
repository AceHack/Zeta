---
id: B-0477
priority: P1
status: closed
title: "Axis-3 Code/English classification matrix — per-repo two-tier classification with engineering-docs exception"
type: research
origin: B-0427 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0427
depends_on:
  - B-0475
composes_with:
  - B-0427
  - B-0475
  - B-0476
  - B-0478
  - B-0479
  - memory/feedback_aaron_repo_split_third_orthogonal_axis_code_vs_english_formal_verification_maybe_split_ruleset_divergence_is_smell_2026_05_13.md
  - memory/feedback_orthogonal_axes_factory_hygiene.md
  - .claude/rules/dv2-data-split-discipline-activated.md
---

# Axis-3 Code/English classification matrix — per-repo two-tier classification with engineering-docs exception

## Purpose

Produce the per-repo Axis-3 classification matrix: for every existing and
proposed repo, determine whether its primary content is **Code** or **English**,
applying the engineering-docs exception (docs that belong with code stay with code).

This is the substrate-honest application of Aaron's Code/English split:

> "we should also likely start to split based on code vs english except
> some docs belong in repo via best engineering practices"

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [x] B-0475 output doc reviewed (prior-art audit complete; no blocking conflicts)
- [x] Walk `depends_on:` chain — B-0475 closed
- [x] Check B-0476 progress — ruleset audit can run in parallel; note any
  divergences already found that constrain classification

## Axis-3 tier definitions

### Code tier

Content whose primary purpose is executable, compilable, or directly testable:

- F# / C# / TypeScript / Python source
- Build scripts (`dotnet build`, `bun`, `Makefile`, CI yaml)
- Tests and test fixtures
- F# computation expressions
- Peer-call wrappers, hooks, validators
- Configuration files (`.editorconfig`, `Directory.Build.props`, etc.)

**Engineering-docs exception** — these stay with Code:

- README, CONTRIBUTING, CHANGELOG
- ADRs and architecture diagrams
- API documentation, GLOSSARY-for-code
- Build/run/test instructions
- CI config documentation
- Security policies, CODE_OF_CONDUCT
- Any doc that would be meaningless without the code alongside it

### English tier

Content whose primary purpose is discursive, philosophical, or substrate-narrative:

- Research documents (`docs/research/**`)
- Philosophy and narrative substrate
- Memory files (`memory/**`)
- Persona notebooks
- Conversation absorbs and retained substrate
- Trajectory documents without code
- Long-form rationale docs (beyond the ADR format)

## Classification matrix to produce

For every existing and proposed repo, produce a row in this matrix:

| Repo | Axis-1 | Axis-2 | Axis-3 primary | Axis-3 English content | Split recommendation |
|------|--------|--------|----------------|------------------------|----------------------|
| LFG/Zeta | Factory | TBD (B-0472) | Mixed | `docs/research/`, `memory/` | Candidate for English split |
| LFG/civsim | Product | TBD | Code | Minimal | Stay co-located |
| Forge (proposed) | Factory-tools | TBD | Code | Minimal | Stay co-located |
| … | … | … | … | … | … |

For each repo where the "English" content exceeds a threshold, produce a
split recommendation with reasoning.

## Threshold for recommending a split

A repo is a candidate for the English/Code split when:

1. The English-tier content has its own change rate (per DV2.0 satellite discipline)
   that is SIGNIFICANTLY faster or slower than the Code-tier content
2. The English-tier content has different audience requirements (internal substrate
   vs external-facing docs vs research archive)
3. The English-tier content has different ruleset requirements (per B-0476 smell test)

All three criteria needed for a concrete recommendation; one or two criteria
→ "candidate with caveats."

## Output

A research document at:

```
docs/research/2026-05-14-axis3-code-english-classification-matrix-b0477.md
```

Containing:

- Precise Axis-3 tier definitions (Code + English + engineering-docs exception)
- Per-repo classification matrix (all existing and proposed repos)
- Split recommendations with DV2.0 change-rate rationale
- Any ambiguous cases flagged for ADR resolution (B-0479)

## Definition of done

- [x] Tier definitions written (Code/English/engineering-docs exception)
- [x] All existing repos classified (LFG/Zeta, AceHack/Zeta, LFG/civsim)
- [x] All proposed repos classified (Forge, product repos from B-0425)
- [x] DV2.0 change-rate analysis performed for each candidate
- [x] Split recommendations stated (or "co-locate" with rationale)
- [x] Ambiguous cases flagged for B-0479
- [x] Output doc committed and referenced from B-0427
- [x] B-0477 closed with PR link

## Why P1

- Directly produces the classification matrix that B-0479 (ADR) needs
- Bounded and concrete (enumerate repos + apply criteria)
- Can run in parallel with B-0476 (ruleset audit) after B-0475 completes
