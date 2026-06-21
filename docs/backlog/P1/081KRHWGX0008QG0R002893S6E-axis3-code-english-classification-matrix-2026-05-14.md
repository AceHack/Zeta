---
id: 081KRHWGX0008QG0R002893S6E
priority: P1
status: open
title: "Axis-3 Code/English classification matrix — per-repo two-tier classification with engineering-docs exception"
type: research
origin: 081KRFA460008QG0R000VKJF0H decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R000VKJF0H
depends_on:
  - 081KRHWGX0008QG0R000M9RFY2
composes_with:
  - 081KRFA460008QG0R000VKJF0H
  - 081KRHWGX0008QG0R000M9RFY2
  - 081KRHWGX0008QG0R000BS8Y4R
  - 081KRHWGX0008QG0R0008EYYCA
  - 081KRHWGX0008QG0R0023DWW8D
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

- [ ] 081KRHWGX0008QG0R000M9RFY2 output doc reviewed (prior-art audit complete; no blocking conflicts)
- [ ] Walk `depends_on:` chain — 081KRHWGX0008QG0R000M9RFY2 closed
- [ ] Check 081KRHWGX0008QG0R000BS8Y4R progress — ruleset audit can run in parallel; note any
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
| LFG/Zeta | Factory | TBD (081KRHWGX0008QG0R002DP6AZN) | Mixed | `docs/research/`, `memory/` | Candidate for English split |
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
3. The English-tier content has different ruleset requirements (per 081KRHWGX0008QG0R000BS8Y4R smell test)

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
- Any ambiguous cases flagged for ADR resolution (081KRHWGX0008QG0R0023DWW8D)

## Definition of done

- [ ] Tier definitions written (Code/English/engineering-docs exception)
- [ ] All existing repos classified (LFG/Zeta, AceHack/Zeta, LFG/civsim)
- [ ] All proposed repos classified (Forge, product repos from 081KRFA460008QG0R003JQ46J4)
- [ ] DV2.0 change-rate analysis performed for each candidate
- [ ] Split recommendations stated (or "co-locate" with rationale)
- [ ] Ambiguous cases flagged for 081KRHWGX0008QG0R0023DWW8D
- [ ] Output doc committed and referenced from 081KRFA460008QG0R000VKJF0H
- [ ] 081KRHWGX0008QG0R002893S6E closed with PR link

## Why P1

- Directly produces the classification matrix that 081KRHWGX0008QG0R0023DWW8D (ADR) needs
- Bounded and concrete (enumerate repos + apply criteria)
- Can run in parallel with 081KRHWGX0008QG0R000BS8Y4R (ruleset audit) after 081KRHWGX0008QG0R000M9RFY2 completes
