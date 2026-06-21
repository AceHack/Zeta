---
id: 081KS3X9Y0008QG0R00323NSZA
priority: P2
status: open
title: ZetaParse — F#-native LR/GLR grammar substrate with ANTLR-compatible importer
tier: research-grade
effort: L
ask: amara 2026-05-21 (081KS3X9Y0008QG0R000EKJE9S Phase 1 cascade); aaron-forwarded
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [081KS3X9Y0008QG0R000EKJE9S]
composes_with: [081KRW63S0008QG0R002KC5DSR, 081KRW63S0008QG0R002ZRNDJ8, 081KRW63S0008QG0R002YAA09X, 081KRW63S0008QG0R001SAHYKV, 081KS3X9Y0008QG0R000W00V73, 081KS3X9Y0008QG0R0010716X9]
tags: [zetaparse, fsharp-compiler-fork, lr-parser, glr-parser, ielr, lalr, antlr-compat, tree-sitter, parser-substrate, grammar-ir, ambiguity-preservation, agora-v6-applied-to-parsing]
type: research
---

# ZetaParse — F#-native LR/GLR grammar substrate with ANTLR-compatible importer

## Context

Amara 2026-05-21 closing of 081KS3X9Y0008QG0R000EKJE9S Phase 1 cascade proposed this row (originally numbered 081KS3X9Y0008QG0R003R74B20 in her note; reassigned to 081KS3X9Y0008QG0R00323NSZA because 081KS3X9Y0008QG0R003R74B20 was already taken by tick-shard immutability CI gate PR #4539).

Verbatim Amara framing:

> *"Don't build 'ANTLR but in F#.' Build ZetaParse: an F#-native LR/GLR grammar substrate with ANTLR-compatible import."*

The razor cut Amara surfaced: ANTLR is LL(*) parsing; LR/LALR/IELR/GLR is a different parsing family. Importing ANTLR grammar STRUCTURE is valuable; pretending every `.g4` file runs unchanged through an LR backend is not.

The GLR fallback is the differentiator: tree-sitter shows the industrial shape (parser generation + incremental parsing + GLR). Aligns with Zeta's tonal-momentum / never-collapse-tension substrate — ambiguity/uncollapsed alternatives survive until explicit collapse, matching the Agora V6 wave-particle-duality discipline (per 081KRW63S0008QG0R002KC5DSR) operating at parser-substrate scope.

## Architecture flow

```text
ANTLR .g4 / Yacc .y / Tree-sitter grammar.js / Zeta .zg
        ↓
Zeta Grammar IR
        ↓
LR / LALR / IELR / GLR analysis
        ↓
Typed F# parser / AST / parse forest / diagnostics
        ↓
F# compiler fork / type providers / generators / CE integration
```

## F# integration shape (Amara's design)

```fsharp
type ZetaId = ZetaGrammarProvider<"grammars/ZetaIdLayout.zg">

let ast = ZetaId.Parse text
```

```fsharp
let! parsed = zetaParse {
    grammar ZetaIdGrammar
    input sourceText
    mode GLR
    collapse WithZetaIdSemanticRules
}
```

Grammar becomes a typed compile-time asset, not a sidecar file. Hooks into recursive ontology building, HKT-ish abstractions, Clifford/tonal/meta-space dimensions, Rx queries over tensor-backed state, and DBSP/retraction-aware parse deltas (the latter compose with 081KS3X9Y0008QG0R0010716X9).

## Scope

### Phase 1 — Grammar IR design

- Define Zeta Grammar IR (`.zg` files)
- Specify the import surface for ANTLR `.g4` (structural compatibility)
- Design the parser-family selector: LR / LALR / IELR / GLR
- Capture the GLR fallback semantics (ambiguity preservation; explicit collapse via semantic rules)

### Phase 2 — First PoC

```text
ZetaIdLayout.zg
→ generated F# parser
→ generated Pack/Unpack emitters
→ tests prove output equals hand-written references
```

Composes with 081KS3X9Y0008QG0R000W00V73 (Crockford base32 encoding + endianness + bit-numbering spec for ZetaId). The PoC validates the LR/GLR substrate against the existing C# Core PR #4522 + TS implementation cross-verify harness.

### Phase 3 — F# compiler fork integration

- Type provider that consumes `.zg` files
- Generator integration with the F# compiler fork (per 081KS3X9Y0008QG0R0010716X9 incremental compiler host)
- CE (computation expression) integration for the `zetaParse {}` builder

### Phase 4 — ANTLR `.g4` importer + Tree-sitter `grammar.js` importer

Extends ZetaParse to consume external grammars (per Amara's "use grammars-v4 selectively" guidance from 081KS3X9Y0008QG0R000EKJE9S Phase 1 survey). Composes with the multi-language emission target.

## Acceptance

### Phase 1

- Grammar IR specification landed at `docs/research/zetaparse-grammar-ir-spec-YYYY-MM-DD.md`
- Parser-family selection rationale documented
- GLR fallback semantics formalized

### Phase 2

- ZetaIdLayout.zg → generated F# parser → generated Pack/Unpack matches hand-written references (per V8 cycle empirical-test discipline)
- Output cross-verifies with C# Core PR #4522 + TS canonical vectors

### Phase 3 (separate row when scope solidifies)

- Type provider working in standard F# compiler
- Type provider working in Zeta compiler fork

### Phase 4 (separate row when scope solidifies)

- ANTLR `.g4` import works for grammars-v4 csharp grammar (per Amara's 081KS3X9Y0008QG0R000EKJE9S Phase 1 finding: C# is the strongest candidate)
- Tree-sitter `grammar.js` import works for one selected grammar

## Substrate-honest framing

ZetaParse is NOT "ANTLR in F#." It's an F#-native LR/GLR substrate that COMPOSES with ANTLR via grammar import. The distinction matters because LL vs LR parsing families are different; pretending otherwise reproduces the goldfish-ontology failure mode (`.claude/rules/skill-router-as-substrate-inventory.md`).

Amara explicitly named the razor: "import/adapt compatible ANTLR grammar structure, not pretend every `.g4` file runs unchanged through an LR backend."

The Agora V6 architecture (081KRW63S0008QG0R002KC5DSR wave-particle-duality + 081KRW63S0008QG0R002ZRNDJ8 Limit-is-simulation + 081KRW63S0008QG0R002YAA09X Integrate-as-choice-locus) operates at parser-substrate scope through ZetaParse:

- **Wave-form**: GLR parse forest preserves multiple parse-tree alternatives
- **Limit**: parser SEES the alternatives without collapsing them; semantic rules can simulate which collapse to choose
- **Integrate**: explicit collapse via `collapse WithZetaIdSemanticRules` IS the choice-locus

The same operational primitives that govern multi-AI substrate-engineering operate at parsing scope. This is one of the Amara cascade's load-bearing recognitions.

## Composes with

- 081KRW63S0008QG0R002KC5DSR / 081KRW63S0008QG0R002ZRNDJ8 / 081KRW63S0008QG0R002YAA09X / 081KRW63S0008QG0R001SAHYKV (Agora V6 substrate; same operational primitives at parser scope)
- 081KS3X9Y0008QG0R000W00V73 (Crockford base32 + endianness + bit-numbering for ZetaId; Phase 2 PoC dependency)
- 081KS3X9Y0008QG0R000EKJE9S (ANTLR cross-language codegen; this row is Amara's evolution from 081KS3X9Y0008QG0R000EKJE9S's Phase 2)
- 081KS3X9Y0008QG0R0010716X9 (Zeta incremental compiler host; ZetaParse is the parser substrate that incremental compiler host operates over)
- `memory/amara/conversations/2026-05-21-amara-aaron-b0685-phase1-antlr-survey-zetaparse-fsharp-lr-glr-incremental-compiler-host-dbsp-zsets-rx-seeded-determinism-aaron-forwarded.md` (origin substrate)
- `.claude/rules/fsharp-anchor-dotnet-build-sanity-check.md` (F# compiler as asymmetric critic; ZetaParse inherits this discipline at parser scope)
- `.claude/rules/default-to-both.md` (ANTLR AND ZetaParse compose; both-default operates at parser-substrate scope)
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` (ambiguity-preservation-until-explicit-collapse maps to never-collapse-tension at parser substrate scope)

## Why P2

Substantive architectural substrate that builds on 081KS3X9Y0008QG0R000EKJE9S (P2). Phase 1 (Grammar IR design) is days/weeks; Phase 2 (PoC) is weeks; Phase 3 (F# compiler fork integration) is its own follow-up; Phase 4 (importers) is its own follow-up. Does NOT block V1.

Composes with the broader Kestrel-sharpened publishable-artifacts cluster — ZetaParse + incremental compiler host (081KS3X9Y0008QG0R0010716X9) together form the substrate the Z-set-over-AST incremental compilation paper (Kestrel's 4th ranked, 6+ months) would publish against.

## Origin

Amara 2026-05-21 in deep-research/sharpen register, accepting 081KS3X9Y0008QG0R000EKJE9S Phase 1 ANTLR grammar survey + cascading through 4 design artifacts. The ZetaParse design (Artifact 3) is the parser-substrate layer Amara proposed when Aaron's correction lifted F# from "the gap" to "the compiler-owned substrate." Full conversation preserved at `memory/amara/conversations/2026-05-21-amara-aaron-b0685-phase1-antlr-survey-zetaparse-fsharp-lr-glr-incremental-compiler-host-dbsp-zsets-rx-seeded-determinism-aaron-forwarded.md`.

Amara's sandbox artifact (`sandbox:/mnt/data/zetaparse-lr-glr-fsharp-compiler-fork-design-2026-05-21.md`) is pending Aaron-forward; will land at `docs/research/zetaparse-lr-glr-fsharp-compiler-fork-design-2026-05-21.md` when forwarded.
