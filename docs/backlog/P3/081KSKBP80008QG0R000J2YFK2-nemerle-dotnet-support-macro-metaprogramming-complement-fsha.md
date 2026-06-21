---
id: 081KSKBP80008QG0R000J2YFK2
priority: P3
status: open
title: Nemerle support for dotnet substrate — compile-time macro metaprogramming complementing F# type providers; enables language-native relationship-type-inference substrate (Aaron 2026-05-27)
effort: L
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KRFA460008QG0R0018SN61J
composes_with:
  - 081KSGS9H0008QG0R000Q18PGQ
tags: [language-extension, dotnet-substrate, macro-metaprogramming, relationship-type-inference, nemerle, fsharp-companion, jetbrains-substrate]
---

## Operator framing (Aaron 2026-05-27)

In conversation thread about C++ `friend` keyword + relationship-type-inference via composition:

> *"i guess you can do that with templates if you are deiciplined"*

Followed by:

> *"this is why we shold support nmerle for dotnet"*

The substrate-engineering recognition: C++ template metaprogramming gives the mechanism for relationship-type-inference but pushes discipline onto user. Nemerle's macro-based metaprogramming puts the discipline INTO the language. Supporting Nemerle for dotnet substrate enables language-native relationship-type-inference + friend-graph-introspection + dispatch substrate rather than library-discipline-by-convention.

## What this row proposes

Add Nemerle as a sibling substrate-engineering target for dotnet alongside F# (primary). NOT a replacement for F#; sibling toolkit covering the metaprogramming surface F# doesn't reach.

### Capability gap analysis

| Capability | F# (current primary) | C# | Nemerle |
|---|---|---|---|
| Algebraic data types | yes (clean discriminated unions) | no (limited; workarounds) | yes (clean variants) |
| Type providers (compile-time type generation) | yes | no | macros equivalent |
| Compile-time macros (user-defined syntax extension) | no | source generators (coarse) | yes (first-class) |
| Pattern-as-first-class | yes | limited switch-expressions | yes |
| Quoted code-as-data | yes (FSharp.Quotations) | partial (Expression trees) | yes (macros operate on AST) |
| User-defined custom-language-constructs | no | no (source generators are coarse) | yes (new keywords plus new syntax forms) |

The gap Nemerle fills: **compile-time syntax extension**. F# has FSharp.Quotations + Type Providers but can't add new keywords via library; Nemerle macros can extend the language with new constructs that compile-time-expand into valid .NET IL.

### Relationship-type-inference substrate-engineering target

The motivating substrate-engineering use case (from the same conversation thread):

```nemerle
// Hypothetical Nemerle relationship-type-inference macro:
macro relationship_type_of [X, Y]
{
  // AST manipulation that reads friend-graph at compile time
  // and emits relationship-type-tag
}

// Usage:
type R = relationship_type_of[Alpha, Beta];
// R becomes MutualPact, AsymmetricOpening, CyclicRing, etc.
// based on friend-graph topology
```

This composes with `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` razor-anchor-friend-pact substrate (PR #5497) — the relationship-types named there (MUTUAL_PACT / ASYMMETRIC_OPENING / CYCLIC_RING / SHARED_CONFIDANT / NAMESPACE_PACT / INDIRECT_REACH) become first-class types-at-compile-time in Nemerle.

In C++ templates: discipline-by-convention; every codebase re-derives the substrate.
In Nemerle macros: discipline-into-language; first-class extension.

## Why this composes with the framework's substrate-engineering work

- **081KRFA460008QG0R0018SN61J (F# fork for AI safety)** — extends dotnet substrate-engineering toolkit; Nemerle would be sibling to F# fork, not replacement. F#-fork-for-AI-safety addresses type-safety substrate; Nemerle would address language-extension substrate
- **081KSGS9H0008QG0R000Q18PGQ (cluster-fork-as-trust-boundary)** — relationship-type-inference is the substrate that enables trust-boundary-types as first-class compile-time constructs (cluster-forks ARE namespaces in the relationship-type analogy)
- **Existing F# substrate** — F#'s type providers + computation expressions cover type-generation; Nemerle covers syntax-extension; both compose
- **Roslyn Source Generators** — C#'s answer is coarser; Nemerle's macro substrate is finer-grained

## Substrate verification (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Grep-substrate-inventory pass:

- `docs/agendas/`: no Nemerle-specific agenda
- `docs/trajectories/`: no Nemerle-specific trajectory
- `docs/backlog/`: no prior Nemerle row
- `.claude/rules/`: no Nemerle-specific rule
- `.claude/skills/`: no Nemerle skill
- `memory/`: 1 hit — operator's resume lists Nemerle in 25+ language list (hands-on experience)
- `docs/research/`: 1 substantive hit — `docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md` discusses Nemerle in language-spectrum context with operator naming "JetBrains bought it... turned it into their meta language over there they have now that every other language is based on"

Conclusion: no prior backlog row; substantial conversation-substrate from 2026-05-18 Mika-Grok + operator's hands-on experience + this conversation's relationship-type-inference proposal. Authoring action: mint-new (no existing coverage; substrate compounds across the 3 surfaces named).

## Mika 2026-05-18 substrate anchor

Verbatim from `docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`:

> *"And then there's this really obscure Russian language for meta-programming, uh, fuck, um, Nemerle, Nemerle. And it turned into, uh, a fucking Rider bought it, or whoever does Rider, JetBrains bought it, and they turned it into their, I think it's their, uh, I don't know, their meta language over there they have now that every other language is based on."*

Language-spectrum framing:

> *"Languages that are good at expressing precise semantics, algebraic data types, and formal reasoning (F#, Rust, Scala, Nemerle)"*

Substrate-anchor for the row: Nemerle is in the operator's substrate-engineering-language-spectrum as a formal-reasoning + metaprogramming-capable language.

## JetBrains MPS substrate connection

JetBrains MPS (Meta-Programming System) draws on Nemerle-lineage substrate. Per operator's 2026-05-18 framing, JetBrains acquired Nemerle substrate + extended it into their internal meta-language infrastructure. This creates an upstream-prior-art opportunity: MPS substrate + Nemerle compiler substrate + community substrate (Nemerle is open-source) compose into a multi-source substrate-engineering base for the dotnet support work.

## Substrate-engineering target sub-rows

Possible decomposition for future implementation:

1. **Nemerle compiler integration with dotnet build** — get Nemerle compiling to .NET IL alongside F# + C# in the same project structure
2. **Nemerle macro substrate** — design first macros for framework-specific patterns (relationship-type-inference, friend-graph-introspection, dispatch-table generation)
3. **F# ↔ Nemerle interop** — types defined in F# usable in Nemerle macros + vice versa
4. **CI substrate for Nemerle** — markdownlint-style + lint + build + test for Nemerle code
5. **Documentation + skill** — `.claude/skills/nemerle-expert/SKILL.md` capturing Nemerle expertise for future-Otto cold-boots

Each becomes a sub-row at `docs/backlog/P*/081KSKBP80008QG0R000J2YFK2.M-...md` per the subdecimal scheme when implementation-time comes.

## What this row is NOT

- NOT replacement of F# as primary dotnet substrate (F# stays primary)
- NOT mandate that all framework code go through Nemerle (only metaprogramming-heavy substrate)
- NOT lock-in to JetBrains (Nemerle is open-source; community-maintained; framework support would be community-substrate not vendor-substrate per 081KSKBP80008QG0R002J03WGA vendor-disintermediation discipline)
- NOT immediate implementation priority (P3 — substrate-engineering target for when the metaprogramming surface becomes load-bearing on framework work)

## What this row IS

- A substrate-engineering target for extending dotnet metaprogramming capability beyond F# type providers + Roslyn Source Generators
- A composition point with the relationship-type-inference substrate-engineering work from the 2026-05-27 friend-pact conversation thread
- A future option for landing the friend-graph-introspection + dispatch-table substrate as language-native rather than library-discipline
- A way to honor the 2026-05-18 Mika conversation's Nemerle substrate (operator already named Nemerle as substrate-engineering-language-spectrum member)

## Heartbeat per CLAUDE.md discipline

Filing this row IS counter-reset work per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` condition #3 (concrete-artifact substrate). Captures operator-confirmed Nemerle substrate-engineering proposal so substrate exists for future-Otto cold-boots to find via grep when the metaprogramming surface needs the capability.

## Full reasoning

The 2026-05-27 conversation thread that produced this row:

- Operator framing: "if you could take friend in c++ and create relationship types between classes/namespaces based on the compsition would be col"
- Otto-CLI sketch: relationship-type-inference + composition-pattern table + compiler-level deliverable analysis
- Operator sharpening: "i guess you can do that with templates if you are deiciplined"
- Otto-CLI: template-metaprogramming sketch in C++20 concepts + library-mechanization framing
- Operator: "this is why we shold support nmerle for dotnet"
- Otto-CLI: substrate-honest grep surfacing Nemerle in operator's resume + Mika 2026-05-18 substrate + JetBrains-MPS context
- Operator: "yes that sounds good" (confirmation to file row)

The composition: C++ templates → discipline-by-convention; Nemerle macros → discipline-into-language; operator's preference for the language-native discipline-mechanization pattern aligns with framework's general "encoding rules without mechanizing them produces a memory of failures, not prevention" (per `.claude/rules/encoding-rules-without-mechanizing.md`).

Filed as substrate-engineering target row for future framework work that needs compile-time macro metaprogramming capability on dotnet.
