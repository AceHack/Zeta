---
id: 081KRHWGX0008QG0R0008EYYCA
priority: P1
status: open
title: "Formal-verification sub-axis evaluation — per-property-class split vs co-locate decision"
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
  - 081KRHWGX0008QG0R002893S6E
  - 081KRHWGX0008QG0R0023DWW8D
  - memory/feedback_aaron_repo_split_third_orthogonal_axis_code_vs_english_formal_verification_maybe_split_ruleset_divergence_is_smell_2026_05_13.md
---

# Formal-verification sub-axis evaluation — per-property-class split vs co-locate decision

## Purpose

Aaron named formal verification as a "maybe split" in 081KRFA460008QG0R000VKJF0H:

> "maybe even formal verification is split out"

Per the 081KRFA460008QG0R000VKJF0H design notes, this requires a **per-property-class evaluation**
(Soraya formal-verification-expert authority). This row produces that evaluation:
for each FV tool class, should the artifacts live in the main Zeta repo, a
dedicated FV repo, or alongside the substrate they verify?

This row can run in parallel with 081KRHWGX0008QG0R002893S6E after 081KRHWGX0008QG0R000M9RFY2 completes.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] 081KRHWGX0008QG0R000M9RFY2 output doc reviewed
- [ ] Check whether any FV substrate is already documented as "candidate for split"
- [ ] Invoke the `formal-verification-expert` skill (Soraya) for routing guidance

## FV tool classes to evaluate

| Tool class | What it produces | Current location in Zeta |
|------------|-----------------|--------------------------|
| **TLA+** | `.tla` / `.cfg` specification files | TBD — search `find . -name '*.tla' -not -path './references/*'` |
| **Lean 4** | `.lean` proof files | TBD — search `find . -name '*.lean' -not -path './references/*'` |
| **Z3 / F* refinements** | SMT constraint files / `.fst` | TBD |
| **FsCheck** | Property-test source (in `.fs` test projects) | Within `tests/` alongside source |
| **Stryker.NET** | Mutation test configuration | `stryker-config.json`; results in CI |
| **Alloy** | `.als` model files | TBD |
| **CodeQL custom queries** | `.ql` files | `.github/codeql/` or `tools/` |
| **Semgrep custom rules** | `.yaml` rule files | `tools/semgrep/` or `.semgrep/` |

## Evaluation criteria per tool class

For each tool class, answer:

### 1. Co-location argument

Does this FV artifact need to live next to the code it verifies to be
maintainable? (FsCheck properties are compiled F# — tightly coupled to source.
TLA+ specs describe protocol-level behavior — more loosely coupled.)

### 2. Change-rate argument (DV2.0)

Does this artifact change at the same rate as the code it verifies?

- FsCheck properties → change when the API changes → same rate → co-locate
- TLA+ specs → change when the protocol changes → potentially different rate
- CodeQL rules → change when vulnerability classes change → could diverge

### 3. Ruleset argument (composes with 081KRHWGX0008QG0R000BS8Y4R)

Does this FV tool class require different GitHub rulesets than the main code?
Example: Lean proofs might require a theorem-prover CI runner that the main
repo doesn't need.

### 4. Audience argument

Is there an audience that would consume only the FV artifacts without the
source? (e.g., formal-methods researchers reading the TLA+ specs without
caring about the F# source)

### 5. Dependency graph argument

Can the FV artifacts be versioned independently of the source they verify?
If yes → split candidate. If no (FV artifact imports from source) → co-locate.

## Recommended evaluation matrix (to be filled in)

| Tool class | Co-location arg | Change-rate arg | Ruleset arg | Audience arg | Dep-graph arg | **Recommendation** |
|------------|----------------|----------------|------------|-------------|--------------|-------------------|
| TLA+ | … | … | … | … | … | … |
| Lean 4 | … | … | … | … | … | … |
| Z3/F* | … | … | … | … | … | … |
| FsCheck | Strong (compiled F#) | Same as source | Same | Dev only | Tightly coupled | **Co-locate** |
| Stryker | Weak (config only) | Slower | Same | Dev only | Config only | TBD |
| Alloy | … | … | … | … | … | … |
| CodeQL | … | … | … | … | … | … |
| Semgrep | … | … | … | … | … | … |

## Special case: FsCheck

FsCheck properties are F# source code compiled into the test project.
They are tightly coupled to the API they verify — splitting them would
mean cross-repo source dependencies. **Strong prior for co-locate.**
This is not speculative; it can be decided without Soraya consultation.

## Output

A research document at:

```
docs/research/2026-05-14-formal-verification-repo-split-evaluation-b0478.md
```

Containing:

- Per-tool-class evaluation (all 5 criteria)
- Recommendation: split / co-locate / hybrid
- For any "split" recommendation: proposed repo name and scope
- FsCheck co-locate pre-decision (documented with rationale)
- Any cases deferred to 081KRHWGX0008QG0R0023DWW8D ADR for final decision

## Definition of done

- [ ] All 8 FV tool classes evaluated (5 criteria each)
- [ ] FsCheck co-locate decision documented
- [ ] Split vs co-locate recommendation produced for each class
- [ ] Any "split" cases include proposed repo scope
- [ ] Output doc committed and referenced from 081KRFA460008QG0R000VKJF0H
- [ ] 081KRHWGX0008QG0R0008EYYCA closed with PR link

## Why P1

- Aaron explicitly named FV as a "maybe split" requiring evaluation
- Per-property-class evaluation is Soraya's authority — invoke her
- Can run in parallel with 081KRHWGX0008QG0R002893S6E after 081KRHWGX0008QG0R000M9RFY2
- Result directly informs 081KRHWGX0008QG0R0023DWW8D ADR
