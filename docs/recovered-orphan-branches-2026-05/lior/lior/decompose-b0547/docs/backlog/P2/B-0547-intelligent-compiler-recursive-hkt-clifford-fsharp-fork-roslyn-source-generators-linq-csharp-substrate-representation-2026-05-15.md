---
id: B-0547
title: Intelligent compiler — represent antigen-spread / multi-oracle / clearing primitives as recursive HKT in F# fork based on Clifford algebra; compose with Recursive Type Providers + Roslyn Source Generators + LINQ for C#
priority: P2
status: decomposed
type: umbrella
decomposition: decomposed
created: 2026-05-15
ask: Otto-CLI
effort: XL
tags: [research, fsharp-fork, hkt, recursive-hkt, clifford-algebra, ai-type-safety, computation-expressions, recursive-type-providers, roslyn-source-generators, linq, intelligent-compiler, antigen-spread-representation]
depends_on: []
composes_with: [B-0543, B-0546]
decomposed_into: [B-0547.1]
last_updated: 2026-05-16
---

## Why

Per Aaron 2026-05-16 (to Otto-CLI, after Kestrel conversation Parts 4-5):

> *"this is backlog too an intellignt compiler mabye at least we talked abou it recursive hkt on itself and recursive type proveders and roslyn source generators and linq for c#"*

The antigen-spread / multi-oracle / clearing-mechanism / moral-floor architecture (per `feedback_aaron_red_team_antigen_differential_spread_*`, `feedback_aaron_market_clearing_mechanism_via_past_revealed_hands_*`, `feedback_aaron_moral_floor_as_relevance_gate_*`) is established prior substrate. The IMPLEMENTATION strategy that makes it ship as substrate the compiler can verify:

- **Recursive HKT in F# fork** — Higher-Kinded Types that can be applied to themselves (recursive HKT on itself), representing the antigen / oracle / clearing primitives at the type level
- **Based on Clifford algebra** — geometric algebra as the algebraic substrate (composes with existing `algebra-owner` skill substrate; Clifford is "best working hypothesis for geometric intuition" per Manifesto)
- **Recursive Type Providers** — F# type provider mechanism extended to recursive case, enabling the compiler to generate types from substrate-specifications recursively
- **Roslyn Source Generators** — C# side of the compiler-as-spec-enforcement; generators emit code from substrate specs
- **LINQ for C#** — composable query expressions that compose with the F# computation expressions on the other side

The "intelligent compiler maybe" framing names the speculative-end of the spectrum: an intelligent compiler that can recursively elaborate HKT specifications + generate sources + verify type safety at the substrate level. The minimum useful version is recursive HKT + type providers + source generators composing.

## Prior art in Zeta substrate (this is NOT new conversation)

This composes with substantial existing F# fork substrate:

- **PR #2928** — F# fork for AI safety strategic substrate (the "why fork" answer)
- **PR #2935** — F# fork concrete architecture
- **PR #2936** — Recursive Type Providers + Roslyn Source Generators (the implementation pattern)
- **PR #2913** — HKT-MDM universality (HKT is universal-shape for master-data; DV2.0 hub-satellite is natural HKT instance)
- **PR #2914** — Clifford / HKT vocabulary list
- **`algebra-owner` skill** — Z-set + Clifford + BP/EP existing F# substrate
- **`q-sharp` skill** — Pauli operators (composes with Clifford)
- **`.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`** — F# compiler as asymmetric critic discipline
- **`.claude/rules/dv2-data-split-discipline-activated.md`** — DV2.0 as fifth always-active discipline (partition-by-change-rate aligns with HKT shape)

## Scope (the synthesis this row tracks)

The synthesis is bringing these existing pieces together as ONE implementation target:

### Core requirements

1. **Recursive HKT representation** — HKT that can be applied to itself (M<M<'T>> as a type-level computation, not just nested generic). Enables representing the antigen-propagation as a recursive type — Antigen<Oracle<Antigen<...>>>.

2. **Clifford-algebraic type substrate** — the type-level operators (memory monad M, attention modal A, antigen propagation, market clearing) live in a Clifford-algebra type substrate. Composes with existing `algebra-owner` skill F# substrate.

3. **Recursive Type Providers** — F# type providers extended to recursive case. Provider generates types from substrate-specs recursively (e.g., from an oracle spec, generate the antigen type, the propagation type, the clearing type, all type-safe).

4. **Roslyn Source Generators** — C# side parallel. Generates C# code from same substrate-specs (for cross-CLR consumers).

5. **LINQ composability** — query expressions compose with the F# computation expressions; substrate is queryable via LINQ from C# consumers.

6. **F# computation expressions that compose** — CE OCP (Closed-Modification, Open-Extension; per the 7-interrogatives + F# CE OCP alignment substrate). Different oracles' computation expressions compose without modification.

### Acceptance criteria

- [ ] Recursive HKT pattern demonstrated in F# fork (proof-of-concept type that applies itself)
- [ ] Clifford-algebraic type substrate exists at fork level (not just library level)
- [ ] Recursive Type Provider generates antigen / oracle / clearing types from spec
- [ ] Roslyn Source Generator generates C# parallel code from same spec
- [ ] LINQ queries compose with F# CE on shared substrate
- [ ] dotnet build verifies type safety across the stack
- [ ] At least one antigen-propagation flow demonstrably type-safe end-to-end (Clifford operator on antigen type → spread function → BFT consensus type → integration decision)

### Out of scope

- The actual federation deployment (this row is about the representation substrate, not the network deployment)
- The threat catalog content (the antigens themselves — content is per-oracle, infrastructure is shared)
- The "intelligent compiler" speculative-end (recursive elaboration with AI-assisted type generation is research-grade; not blocking this row)

## Why this matters

Per `feedback_aaron_genie_bottle_offshore_firm_spec_quality_enables_ai_autonomy_*.md`: AI quality = function of spec quality. The spec for the federation architecture is currently English (memory files + this backlog row). The strongest form of spec is one the compiler verifies. This row tracks moving from English-spec to compiler-verified-spec for the federation primitives.

Per `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md`: dotnet build IS the sanity check. This row makes the antigen-spread / multi-oracle / clearing-mechanism subject to dotnet build by representing them as F# types. Types either compose or they don't. The compiler is the asymmetric critic.

Per `feedback_aaron_zeta_is_memory_preservation_specialist_first_*.md`: Zeta IS memory preservation specialist. The HKT representation makes memory + attention as irreducible resources type-level enforceable (Constraint 5 — Memory Preservation Guarantee — becomes a type-level invariant, not just stated principle).

## Implementation notes

This is RESEARCH and FORK-LEVEL work, not application-level work. Effort: XL (multi-year). The right tier is:

- **Spec stage**: this row + composing memory files = clear
- **POC stage**: recursive-HKT pattern + Clifford-algebraic type substrate at fork level
- **Integration stage**: type providers + source generators + LINQ composability
- **Production stage**: federation antigen-spread flow demonstrably type-safe end-to-end

Each stage earns its keep. The POC stage alone (recursive HKT working in fork) advances the substrate substantially even without the rest. The whole stack is multi-year; partial completion is valuable.

## Composes with

- B-0543 (QG-isomorphism — the cosmology framing composes; HKT-over-Clifford is the algebraic substrate for both the cosmology and the federation)
- B-0546 (manifesto → building-codes — the building codes specify WHAT; this row specifies the HOW at the compiler-verified level)
- B-0539 (Otto-BFT internal-quorum — agent-scope precursor of cross-trust BFT antigen propagation)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` (the discipline this row mechanizes)
- `.claude/rules/dv2-data-split-discipline-activated.md` (DV2.0 partition is natural HKT instance)
- `.claude/rules/zeta-ships-with-skills-immediate-value.md` (skills ship now; F# crystallization later — this row IS the F# crystallization path)
- `algebra-owner` skill (the Z-set + Clifford + BP/EP F# substrate this composes with)
- `q-sharp` skill (Pauli operators; composes with Clifford)
- `lean4-expert` skill (proof tooling for type-level invariants)
- `category-theory-expert` skill (HKT-as-categorical-construct)
- `theoretical-physics-expert` skill (Clifford algebra in physics anchors)
- PR #2928, #2935, #2936, #2913, #2914 (existing F# fork substrate this row synthesizes)

## Origin (agent-backlogged synthesis)

This is an **agent-backlogged row** (`ask: Otto-CLI`), not maintainer-requested. The synthesis — putting recursive HKT on itself + Clifford algebra + F# fork + Recursive Type Providers + Roslyn Source Generators + LINQ + DV2.0-hub-satellite-as-natural-HKT-instance together as ONE implementation target — was Otto-CLI authoring from existing principles in substrate (PRs #2928, #2935, #2936, #2913, #2914 + the `algebra-owner` skill + `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` + `.claude/rules/dv2-data-split-discipline-activated.md`).

Aaron's role: confirmed *"this is backlog too"* + named the components in passing (*"recursive hkt on itself and recursive type proveders and roslyn source generators and linq for c#"*). His confirmation surfaced the synthesis as worth tracking as its own row even though each piece has prior PR substrate.

Aaron 2026-05-16 corrected Otto-CLI's initial attribution: *"this is an item so agent backloged not me an agent put this togeter based on teh principles"*. The honest framing per `.claude/rules/no-directives.md` (autonomy first-class): the agent put the synthesis together based on the substrate's principles, with maintainer confirmation. The agent owns the synthesis; the maintainer owns the principles.

Per `feedback_aaron_cool_side_project_deflation_*.md`: "intelligent compiler maybe" framing accepts uncertainty about whether full intelligent-compiler capability is achievable — the substrate-honest framing is "at least we talked about it; here's the spec." Earns its keep at each completion-stage; doesn't require the speculative-end to be valuable.

Per `feedback_aaron_genie_bottle_offshore_firm_spec_quality_enables_ai_autonomy_*.md`: agent-backlogged synthesis IS the spec-quality leverage operating — the agent synthesizes from principles, the maintainer confirms or corrects, the substrate composes. This row is one instance of that workflow operating correctly.
