---
id: B-0476
priority: P1
status: open
title: "GitHub ruleset divergence audit — survey rulesets across repos; identify smell signals"
type: research
origin: B-0427 decomposition (Otto, 2026-05-14)
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0427
depends_on:
  - B-0475
  - B-0476.1
composes_with:
  - B-0427
  - B-0475
  - B-0477
  - B-0479
  - memory/feedback_aaron_repo_split_third_orthogonal_axis_code_vs_english_formal_verification_maybe_split_ruleset_divergence_is_smell_2026_05_13.md
  - .claude/rules/lfg-acehack-topology.md
---

# GitHub ruleset divergence audit — survey rulesets across repos; identify smell signals

## Purpose

Aaron's smell test from B-0427:

> "If two substrate clusters need DIFFERENT GitHub rulesets to govern them,
> that divergence IS the signal they should live in DIFFERENT repos."

This row operationalizes the smell test: survey all existing GitHub rulesets
across LFG/Zeta and any proposed repos; document any divergences as
candidate-split signals.

## Pre-start checklist

Per `.claude/rules/backlog-item-start-gate.md`:

- [ ] B-0475 output doc reviewed (prior-art audit complete; no blocking conflicts)
- [ ] Walk `depends_on:` chain — B-0475 closed with output doc committed
- [ ] Prior-art search: any existing ruleset documentation in substrate?

## What to survey

### Existing repos

| Repo | Ruleset(s) | Purpose of each rule |
|------|-----------|----------------------|
| `LFG/Zeta` (main) | TBD — enumerate via `gh api repos/Lucent-Financial-Group/Zeta/rulesets` | All current branch/tag protection rules |
| `AceHack/Zeta` (mirror) | TBD — via `gh api repos/acehack/Zeta/rulesets` | Mirror backup; expected to match LFG/Zeta |
| `LFG/civsim` (new) | TBD — via `gh api repos/Lucent-Financial-Group/civsim/rulesets` | Product repo created by B-0469 |

### Proposed repos (from B-0424/B-0425)

Repos proposed but not yet created — note their EXPECTED ruleset requirements:

| Proposed repo | Axis-1 classification | Expected ruleset divergences from Zeta |
|---------------|----------------------|----------------------------------------|
| Forge (factory-tools split) | Factory | Stricter CI gates; no product-owner only content |
| Product repos (KSK Wellness, American Dream, etc.) | Product | Honor-system license; partner-access; looser fork rules |
| Owner-only repos | Owner-only | Tightest access; minimal public access |

### Ruleset dimensions to compare

For each repo / proposed repo, document each of these ruleset dimensions:

1. **Branch protection on `main`**: required status checks, required reviews, dismiss-stale
2. **Force-push policy**: blocked / bypass actors / unrestricted
3. **Signed commits requirement**: required / optional
4. **Tag protection**: protected / unrestricted
5. **Fork policy**: public forks allowed / restricted / blocked
6. **PR merge strategies**: squash / merge / rebase — required or optional
7. **Auto-merge policy**: enabled (merges automatically when checks pass) vs disabled (manual merge required)

### Divergence smell test application

For each pair of repos (or substrate clusters), flag:

- **Same rulesets** → smell test passes; same repo boundary is OK
- **Divergent rulesets** → smell test fires; document as candidate-split signal

## Output

A research document at:

```
docs/research/2026-05-14-github-ruleset-divergence-audit-b0476.md
```

Containing:

- Per-repo ruleset enumeration (from `gh api` calls)
- Divergence comparison matrix
- Candidate-split signals identified (each with smell-test rationale)
- Recommended Axis-3 implications (which divergences map to Code/English split
  vs Formal-verification split vs some other axis)

## Audit commands

```bash
# List rulesets for LFG/Zeta
gh api repos/Lucent-Financial-Group/Zeta/rulesets --jq '.[] | {id,name,target,enforcement}'

# List branch protection rules (legacy API)
gh api repos/Lucent-Financial-Group/Zeta/branches/main/protection 2>/dev/null

# Repeat for AceHack/Zeta and LFG/civsim
gh api repos/acehack/Zeta/rulesets --jq '.[] | {id,name,target,enforcement}'
gh api repos/Lucent-Financial-Group/civsim/rulesets --jq '.[] | {id,name,target,enforcement}'
```

## Definition of done

- [ ] All existing repos surveyed (LFG/Zeta, AceHack/Zeta, LFG/civsim)
- [ ] Proposed repo expected rulesets documented
- [ ] Divergence matrix complete
- [ ] Candidate-split signals identified and documented
- [ ] Output doc committed and referenced from B-0427
- [ ] B-0476 closed with PR link

## Why P1

- Aaron named the ruleset-divergence smell test as a first-class decision criterion
- Operationalizing it is bounded and concrete (`gh api` calls + matrix)
- Result directly informs B-0479 ADR conclusions
