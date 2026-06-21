---
name: alias-pattern Greek-primary + English-secondary for substrate-named primitives (Aaron 2026-05-28 ratification of Meno.fsx pattern; applies to all future Greek-named F# substrate)
description: Aaron 2026-05-28 explicit ratification "alias is good" of the side-by-side alias pattern shipped in experiments/meno-persist-as-bridge/Meno.fsx — Greek identifier (μένω) is canonical primary; English ASCII identifier (meno) is alias that binds to same value at zero runtime cost. Pattern applies to all future Greek-named F# substrate (λάμπω + νοέω + μνάω + future Greek-substrate naming). Composes with audience-adjusted-language discipline + honor-those-that-came-before (Greek-substrate Amara taught Aaron 2025-09 + Otto-309 first formal definition) + Meno.fsx canonical PoC + 081KSNY2Z0008QG0R00075C7CH Lampo.fsx target.
type: feedback
created: 2026-05-28
authors: [aaron, otto]
composes_with:
  - .claude/rules/harm-by-grammar-discriminator-and-audience-adjusted-language.md
  - .claude/rules/honor-those-that-came-before.md
  - .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md
  - .claude/rules/substrate-smoothness-as-load-bearing-property.md
  - experiments/meno-persist-as-bridge/Meno.fsx
  - docs/backlog/P2/081KSNY2Z0008QG0R00075C7CH-lase-as-bridge-coherent-emission-on-phase-shift-error-class-discovery-companion-to-persist-prism-aaron-2026-05-28.md
related_prs:
  - 5778  # μένω F# PoC (canonical alias-pattern PoC)
  - 5780  # 081KSNY2Z0008QG0R00075C7CH Lase-as-bridge (composes; same pattern applies)
related_backlog:
  - 081KSNY2Z0008QG0R00075C7CH  # Lase-as-bridge primitive Lampo.fsx Slice A
tags: [alias-pattern-greek-primary-english-secondary, fsharp-unicode-identifiers-utf8, zero-runtime-cost-binding-aliases, audience-adjusted-language-at-code-naming-scope, honor-those-that-came-before-via-greek-substrate-preservation, applies-to-meno-lampo-noeo-mnao-future-greek-substrate]
---

## Aaron's substantive ratification (2026-05-28 verbatim)

Aaron: *"alias is good"*

Response to question: "Should F# Greek-named substrate (μένω etc.) use side-by-side alias OR inherit?"

## The pattern Aaron ratified

```fsharp
/// μένω computation-expression builder. Workflows compose Persist
/// operations via Result.bind; feedback short-circuits the workflow
/// substrate-honestly (caller acknowledges via match).
let μένω<'T> = MenoBuilder()

/// English alias for the Greek (per audience-adjusted-language discipline).
let meno<'T> : MenoBuilder = μένω<'T>
```

Both names bind to the SAME value at zero runtime cost. Both forms work identically in consumer code:

```fsharp
let result1 = μένω<int> { let! x = Ok 42 in return x }
let result2 = meno<int>  { let! x = Ok 42 in return x }  // identical
```

## Why this is correct over OO-inheritance

F# DOES support `inherit` syntax for class hierarchies, but for substrate-named primitives this is:

- **Heavier**: requires class hierarchy + virtual dispatch
- **Less idiomatic**: F# convention is to use let-bindings + alias for naming-equivalents
- **Same runtime cost as alias** when methods don't actually override
- **Adds ambiguity**: which one do consumers prefer? (Both should work identically.)

The alias pattern (`let <english> = <greek>`) gives:

- Zero runtime cost
- Both forms work identically
- Consumers choose based on input-method availability (Greek IME or ASCII)
- No virtual dispatch / class hierarchy overhead
- Tool-friendly (autocomplete works on both)
- Honor-those-that-came-before: Greek canonical preserves substrate-lineage (Amara taught Aaron 2025-09 → Otto-309 framework's first formal definition → continuous 8-month substrate use → today's F# implementation)

## Operational application (future Greek-named F# substrate)

When authoring new Greek-named substrate primitive in F#:

1. **Greek identifier is canonical primary** (honor-those-that-came-before)
2. **English ASCII identifier is alias** (`let <english> = <greek>`)
3. **Same TFeedback / monad-shape** (per monad-propagation-pattern)
4. **Same audience-adjusted documentation** — Greek docstring with English etymology note (per harm-by-grammar-discriminator + audience-adjusted-language rule)
5. **Zero runtime cost** (alias, not inheritance)

Future Greek-named primitives ready to use this pattern:
- **λάμπω** (lampō, "I shine") = Lase-as-bridge (081KSNY2Z0008QG0R00075C7CH Lampo.fsx Slice A) — companion to μένω
- **νοέω** (noeō, "I perceive with mind") = potential Observe-as-bridge / Attention primitive
- **μνάω** (mnaō, "I remember") = potential Memory primitive (PIE sibling of μένω; same root *men-)
- Any future Greek-substrate primitive

## F# Unicode caveats (substrate-honest)

- F# allows Greek letters as identifiers ✓
- Source files MUST be UTF-8 (with or without BOM)
- Some tooling has rough edges on Greek IDs (autocomplete completion, some doc-generators); alias pattern gives consumers an ASCII fallback
- Backtick quoting (`` ` ``) works as escape mechanism if needed; not required for our cases

## Composes with

- `.claude/rules/harm-by-grammar-discriminator-and-audience-adjusted-language.md` — alias pattern IS audience-adjusted-language at code-naming scope
- `.claude/rules/honor-those-that-came-before.md` — Greek canonical preserves Amara-taught + Otto-309-defined substrate lineage
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md` — alias-pattern is one specific instance of cross-language substrate-shape (same shape multiple identifier-surfaces)
- `experiments/meno-persist-as-bridge/Meno.fsx` — canonical PoC of the pattern (already shipped)
- `docs/backlog/P2/081KSNY2Z0008QG0R00075C7CH-lase-as-bridge-*.md` — Lampo.fsx Slice A applies same pattern

## Future-Otto cold-boot inheritance

When authoring new Greek-named F# substrate primitive:

1. Define value with Greek identifier as primary
2. Add `let <english> = <greek>` alias on next line
3. Document both in single docstring (Greek-first, English etymology note)
4. NO inheritance / class hierarchy unless ACTUAL OO-pattern semantics needed

Aaron 2026-05-28: "alias is good" — operator ratification anchored.

μένω.
