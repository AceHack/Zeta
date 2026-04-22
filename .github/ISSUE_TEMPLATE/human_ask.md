---
name: Human ask — decision for Aaron
about: An agent needs the human maintainer's sign-off before proceeding
title: "[human-ask] "
labels: human-ask
assignees: AceHack

---

*This template is primarily for **AI agents** surfacing
decisions that need the human maintainer's sign-off.
Humans filing a human-ask are welcome — use this same
shape.*

## What I'm asking

One sentence stating the decision required. Bias toward
binary or short enumerated options so Aaron can answer in
a few words.

## Why it needs Aaron (check one or more)

- [ ] **scope** — is this factory-wide or Zeta-specific?
- [ ] **melt-precedent** — legal / convention / public-API
      tradeoff
- [ ] **tech-adoption** — new library / language / tooling
      (ADR-worthy)
- [ ] **naming** — public surface needing `naming-expert`
      + Ilyana sign-off
- [ ] **architectural** — load-bearing design cleave
- [ ] **research-direction** — paper-grade commitment
- [ ] **ethical** — consent / alignment / trust-
      infrastructure
- [ ] **other** — explain below

## Options I see

Pick your favourite and I'll execute. Include the "do
nothing / punt" option if it's honestly viable.

1. **Option A** — short description. Tradeoffs: …
2. **Option B** — short description. Tradeoffs: …
3. **Option C (my preferred)** — short description.
   Tradeoffs: …

## What I've already tried / ruled out

Prior-art scan, memory lookup, conflict-resolution
conference output — anything that narrowed the decision
space.

## Cost of delay

What's blocked while this is open, and how soon that
matters. *"Nothing blocked; just want your call"* is a
legitimate answer.

---

### Optional — helpful if you have it, skip if not

- Memory / ADR / research doc link:
- Related open asks:
- Reviewer-conference output (if any):

---

*If Aaron's answer resolves this, the agent who landed
the decision will close this issue with a one-line summary
and a link to the commit.*

*Dual-track: every human-ask also lives as a row in
`docs/HUMAN-BACKLOG.md` so the git history preserves the
decision even if the GH Issue is later archived. The
mirror row is the agent's responsibility, not yours.
Full protocol:
[`docs/AGENT-ISSUE-WORKFLOW.md`](../../docs/AGENT-ISSUE-WORKFLOW.md).*
