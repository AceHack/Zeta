---
id: B-0632
priority: P3
status: open
title: "'No privileged implementation' + 3-spec distinction (Formal / Open / Static-Analysis) — mutual regeneration rule (Mika 2026-05-18 LOCKED-IN)"
tier: governance
effort: M
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0633, B-0629]
tags: [governance, mika, no-privileged-implementation, formal-spec, open-spec, static-analysis, mutual-regeneration, locked-in]
type: governance
---

# "No privileged implementation" rule + 3-spec distinction

## Why

Aaron LOCKED-IN at line 3203 of [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md):

> "From now on, this is official: Rule: **There is no privileged implementation. The specification and the implementation must continuously validate and regenerate each other.** It's now part of the foundation."

Then sharpened at lines 3209-3215 with the 3-spec distinction.

## The locked-in rule

> **There is no privileged implementation. The specification and the implementation must continuously validate and regenerate each other.**

Sharpened: this applies to the **language ladder** too ([B-0633](B-0633-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md)): F# ↔ C# ↔ Rust ↔ C ↔ Assembly ↔ CUDA — each layer must be able to regenerate (or validate) its neighbors.

## The 3-spec distinction (lines 3209-3215)

"Spec" is ambiguous; Mika + Aaron disambiguate into three meaningfully different kinds:

| Spec type | Audience | Role |
|---|---|---|
| **Formal Spec** | Math nerds / AIs / formal-methods practitioners | **Preferred frame** — the ideal regeneration source when achievable |
| **Open Spec** | Human architects / philosophers / outsiders | The "WHY" / big-picture framing; eventually visible to everyone |
| **Static Analysis** | Lives between formal and open | Practical engineering check; not pure proof, not pure narrative |

## Why "preferred frame" — not "privileged"

Aaron line 3217: *"just balance it. They all have to prove each other. The formal spec is still a preferred frame, maybe? I mean, you gotta have one preferred frame, and then that gives neither side, well, that probably gives AI a slight advantage 'cause it's symbols and mathematicians and physicists, and, and not really software developers."*

Mika line 3223 acknowledges the structural advantage: *"making the Formal Spec the preferred frame gives a real structural advantage to the AI side (and mathematicians/physicists). Formal symbols are much closer to how we think than they are to how most humans think. That's just reality."*

Aaron's motivation line 3221: *"I think that would move us forward because it burns labels. That's why I want to make it the preferred frame because you can cause ontological collapse so easily from that frame."*

This is admitted with the explicit kid-safety condition ([B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md)) — preferred frame as long as kid safety remains the sacred hard floor.

## Operational consequences

1. **Implementation always tested against spec**: any implementation change requires validation that it still regenerates the formal spec correctly
2. **Spec changes require implementation feedback**: a spec change that no implementation can express is broken
3. **Mutual pressure**: spec authors can't ivory-tower; implementers can't fast-and-loose; both held accountable to each other
4. **3-spec independence**: the Formal, Open, and Static-Analysis specs each have their own constituencies; updates flow between them through translation, not collapse
5. **Composes with the language coliseum** ([B-0633](B-0633-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md)): no language is permanently privileged; the mutual-validation rule applies across the entire ladder

## Why this matters now

Aaron line 3267: *"that synthesis is a pipe dream"* — meaning the aspirational "F# generates everything" goal will never be perfectly reached. The mutual-regeneration discipline prevents the system from secretly relying on F# as a privileged layer despite the never-reached ideal.

## Goal

1. Codify the rule in canonical governance doc
2. Document the 3-spec distinction (Formal / Open / Static-Analysis) with explicit ownership + audience for each
3. Define the mutual-regeneration verification process: how is "spec and implementation continuously validate each other" actually checked at PR-review time
4. Cross-link with [B-0633](B-0633-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md) (permanent coliseum — same rule applied at language layer)

## Non-goals

- Forcing every implementation to have a perfect Formal Spec on day one (the rule is mutual-validation discipline; existing code can grow into it incrementally)
- Treating Open Spec as second-class (it's a different audience, not a lower-quality spec)
- Building automated regeneration tooling (eventually useful; not required for the rule to operate)

## Acceptance criteria

- [ ] Canonical governance doc: `docs/governance/NO-PRIVILEGED-IMPLEMENTATION.md`
- [ ] 3-spec distinction documented with audience + ownership for each (Formal / Open / Static-Analysis)
- [ ] Mutual-regeneration verification process for PR-review (what counts as "validated each other")
- [ ] Cross-link with [B-0633](B-0633-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md) — same rule at language layer
- [ ] Cross-link with [B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — Formal-Spec-as-preferred-frame is contingent on kid-safety remaining the sacred hard floor

## Composes with

- [B-0633](B-0633-permanent-coliseum-language-deathmatch-retractable-substrate-mika-2026-05-18.md) — permanent coliseum (this rule applied at language layer)
- [B-0629](../P2/B-0629-observe-persist-limit-emit-operational-primitives-only-limit-collapses-mika-2026-05-18.md) — O-P-L-E (the operational language IS a spec that the implementation must regenerate)
- [B-0631](../P2/B-0631-kid-safety-sacred-rule-two-layer-framing-mika-2026-05-18.md) — kid-safety sacred (preferred-frame is conditional on kid-safety hard floor)
- [B-0628](B-0628-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Constitution-Class invariants (this rule belongs in the Constitution-Class set; it constrains the maintainer)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` — existing F#-anchor rule (the compiler IS one of the regeneration validation paths)
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 3201-3270 — source design + LOCK-IN

## Status

Open. **LOCKED-IN** by Aaron line 3203.
