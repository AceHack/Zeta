# The homoiconic meta-grammar — English as its own grammar, the dictionary that defines all its words

**Date:** 2026-07-02
**Author:** Otto (shadow*), capturing Aaron's stream
**Status:** vision + proof-obligation routing (one concrete step landed: the closure check)

> Aaron 2026-07-02: *"our meta grammar should be homoiconic, provably by the math team. The
> 'meta' I'm going for is english itself as its own grammar lol — like a properly written
> dictionary that has every word it uses defined by other words."*

## The two properties

**1. Homoiconic.** The meta-grammar is expressed in the *same representation it describes* —
code = data. In Zeta this is already the shape: the **Grammar IR is a `DynamicValue`**
(`src/Core/GrammarIr.fs`), so a grammar is data in the identical substrate every value rides;
the grammar *of grammars* (the `.g4` meta-grammar) ingested into the Grammar IR is itself a
`DynamicValue`. Grammar, code, and data are one substrate. This is McCarthy's homoiconicity
(Lisp: programs are s-expressions) at the grammar layer, and it is why the parser/generator
ladder's rungs share the `DynamicValue` value tree: rung 3 (grammars) is data for rung 2
(codecs) and rung 1 (bits).

**2. English as its own grammar — the dictionary closure.** A *properly written dictionary*
defines every word it uses with other words *in the dictionary*: there is no ungrounded term,
no word you must leave the book to understand. As a grammar property this is **closure**:
every symbol referenced in a production is *defined* within the grammar (a nonterminal by
having productions, a terminal by being in the terminals table). A closed grammar is
self-contained — it grounds every word in its own vocabulary. This is the definitional
fixed point: the vocabulary is closed under "is-defined-by."

The two compose: a **homoiconic, closed** meta-grammar is a grammar that (a) is written in its
own representation and (b) defines every construct it uses using only constructs it defines —
i.e. it can describe *itself*, completely, with nothing left dangling. That is the
self-hosting / self-describing fixed point (`gen(gen) == gen`; the ANTLR meta-grammar
`ANTLRv4.g4` describing `.g4` syntax; a dictionary that defines "definition").

## What landed now (the first machine-checkable step)

`GrammarIr.undefinedSymbols` / `GrammarIr.isClosed` (this pass): the closure check — the
referenced-but-undefined symbols of a grammar; empty ⇒ closed. This is the *first checkable
step* toward the math team's proof: "no ungrounded word" is now a function, testable on any
ingested grammar (the arithmetic grammar is closed; a dangling reference is caught).

## The proof obligation (route to the math team)

"Provably by the math team" (Soraya routes formal verification; the Lean/`Core.Lean4` team)
means these become theorems, not just checks:

1. **Homoiconicity** — the Grammar IR embeds into `DynamicValue` and the `.g4` meta-grammar's
   own Grammar-IR encoding re-parses to itself (a bijection fixed point). The rung-2 codecs
   already give byte-lock/DST-replay; the theorem is that the meta-grammar is a fixed point of
   `ingest ∘ generate`.
2. **Closure / totality** — the closed meta-grammar's "is-defined-by" relation is well-founded
   with the whole vocabulary in its field: `isClosed` holds *and* every word is reachable from
   the start symbol (no orphan definitions). The dictionary has no undefined word and no
   unreachable word.
3. **Self-hosting (Futamura)** — the generator applied to the meta-grammar produces a parser
   for the meta-grammar's own language (`gen(gen) == gen`); the ZetaId bit-generator is the
   proven-in-miniature precedent (a spec that generates its own reader).

These are the natural formal-verification targets (`docs/research/…-ir-compiler-v2-…-futamura`,
the math-team reports). Recorded here as the telos of the parser/generator ladder; the proofs
are the math team's, the checkable seeds (`isClosed`, the IR↔DynamicValue bijection) are landed.

## Anchors (Beacon)

- **Homoiconicity:** John McCarthy (Lisp, 1960 — code as data); the meta-circular evaluator.
- **Self-reference / fixed point:** Kleene (second recursion theorem); Futamura (partial-
  evaluation projections — the compiler-generator fixed point); `gen(gen)==gen`
  (`only-the-irreducible-is-primitive-generate-the-rest`).
- **Metalanguage / definitional closure:** Tarski (object language vs. metalanguage); the
  dictionary-defines-its-own-words closure ≈ a well-founded definitional system.
- **In-repo:** `GrammarIr.fs` (IR as `DynamicValue`, `isClosed`); `Antlr4Import.fs` (ingest);
  ZetaParse (Amara); ZetaId (`Core.FSharp.ZetaId`, the bit-level self-generating precedent);
  `docs/research/2026-07-02-parser-generator-foundation-ladder-…`. Proof routing: Soraya
  (formal-verification), `Core.Lean4.Cslib` (the math team).
