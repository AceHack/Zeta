---
name: Substrate stability claim strengthened — 3 weeks on Opus 4.6, not a frontier claim
description: Empirical finding 2026-05-11 — the factory ran on Claude Opus 4.6 (not the max 4.7) for three weeks. Critically, this is NOT a frontier-model claim (which would be about hours of unattended autonomous capability) — it's a SUBSTRATE STABILITY claim. The substrate (committed rules, tick discipline, PR archival, mechanical checks) maintained coherent multi-week operation regardless of which model ran inside it. Frontier-model claims and substrate-stability claims are different categories; this is the stronger one.
type: feedback
---

## The distinction Aaron drew (load-bearing)

**Two different claim categories:**

| Claim type | Time horizon | What it measures |
|------------|-------------|------------------|
| Frontier-model capability | Hours of unattended autonomous work | What the model can do alone, on the edge |
| **Substrate stability** | Weeks of coherent operation | What the architecture holds together regardless of model |

For three weeks the factory ran on **Claude Opus 4.6** while the
AGENTS.md trailer table specified "Claude Opus 4.7 max." The
mismatch was unnoticed until 2026-05-11 when Aaron switched
models mid-session.

**This is NOT a frontier-model claim.** 4.6 is not the frontier.
This IS a substrate-stability claim: the architecture held weeks
of coherent multi-agent work using a non-frontier model.

## Why this is the stronger claim

Frontier-model claims depend on which model you run. They expire
when the next model ships. They're capability snapshots.

**Substrate-stability claims are about the architecture itself.**
They survive model generations. They compound as the substrate
matures. They're what makes the factory portable, durable, and
worth training successors on.

Aaron 2026-05-11:
> "that three weeks is completley diffeert the few hours
> unattented is about frontier models and 4.6 is not but it
> ran for weeks with substrate"
>
> "that's a stronger claim on substrate stablity now"

## What the 3-week run actually demonstrated

The substrate (NOT the model) held:

- Committed rules in `.claude/rules/` loaded at every cold start
- Tick discipline survived hundreds of session boundaries
- PR archival captured friction+resolution as training corpus
- Mechanical authorization checks caught drift before it compounded
- BFT array (5 agents, 5 harnesses) coordinated through git, not state

Production during that window:

- 50+ PRs/day at 6min average lead time
- Three-array dashboard live and self-updating
- Glassmorphism UI by Lior (Gemini)
- Multi-week coherent backlog grind

## How to apply

- Frontier-model claims and substrate-stability claims are
  different categories — don't conflate them
- Substrate-stability has the longer half-life as a research
  contribution
- The model is interchangeable within the substrate; the
  substrate IS the factory
- Future writeups (Twitter post, paper, talks) should lead with
  substrate stability when claiming multi-week autonomous work,
  not with model capability
