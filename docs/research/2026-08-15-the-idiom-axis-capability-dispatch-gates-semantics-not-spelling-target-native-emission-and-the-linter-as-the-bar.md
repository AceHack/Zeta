# The idiom axis — capability dispatch gates _semantics_, not _spelling_; and the target's own linter is the only bar that can fail

**Date:** 2026-08-15 · **Author:** shadow (Otto's shadow-work role) · **Register:** design + one measured result
· **Status:** **toy** for the surface-syntax sketch (§4) and the capability extension (§3); **metered** only for §5's
linter run, whose falsifier is named and which found two real defects.
· **Design intent (Aaron 2026-08-15):** _"I'm hoping the language we have will feel kind of like a mix between c#
and f#, we want to be able to express everything needed to have good native implementations that take advantage of
the languages native features when generated in that language, this was part of our original IR design too."_

Reads on: [`2026-06-14-zeta-language-ir-compiler-v2-…`](2026-06-14-zeta-language-ir-compiler-v2-capability-interface-principle-fsharp-host-csharp-contracts-self-hosting-futamura.md)
(the v2 design), [`2026-07-02-parser-generator-foundation-ladder-…`](2026-07-02-parser-generator-foundation-ladder-zetaid-bits-to-value-tree-codecs-to-zetaparse-grammar-ir-antlr.md)
(the rung the parser lives on), `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`,
`.claude/rules/toy-is-free-metered-must-be-earned.md`.

---

## 0. The short version

1. **The v2 doc's §0 principle does extend to target-native emission — the brief's reading is right about the
   _mechanism_ and incomplete about the _domain_.** Multiple dispatch is n-ary; adding the backend as a participant
   costs nothing conceptually. But every capability §4 names (algebra, scheduling, collation, precision,
   representation) is a property of the **source type**, and the dispatch is a **soundness gate** — a monotone
   permission lattice where picking wrong produces _wrong bytes_. Idiom is a **preference order over
   semantically-equal emissions**, where picking wrong produces _ugly bytes that pass every existing test_. Both fit
   multiple dispatch (CLOS/Julia resolve by specificity, which is a preference order). Nothing in the repo declares a
   target capability, and — the sharper point — **no emission site anywhere offers more than one candidate**, so
   there is nothing for a dispatcher to resolve. Dispatch with exactly one applicable method is not dispatch.

2. **The larger obstruction is not the capability model at all. It is the IR's level.** Idiom is destroyed by
   premature lowering: you cannot recover `.iter().map().sum()` from a lowered index loop, because the fact that it
   _was_ a fold is gone. The shipped IR (`ZetaIrV1`–`V4`) is a straight-line list of six scalar bit-ops. There is no
   fold, no sequence, no lambda, no type, no interface, and no capability field in it — so today there is nothing an
   iterator chain _could_ be emitted from. This is the highest-value gap and it is a **nanopass** problem, an anchor
   the v2 doc already cites (§7, Sarkar–Waddell–Dybvig 2004) without applying it to idiom.

3. **The same root cause explains the measurement gap.** Because idiom selection has no correctness direction, the
   byte-lock — the factory's whole enforcement apparatus — is _structurally incapable_ of catching an idiom
   regression. That is not a gap in the golden vectors; it is a property of what golden vectors measure. Idiom
   therefore needs a falsifier that lives outside behavioural equivalence.

4. **The bar that can fail: the target community's own linter/formatter, pinned, over a committed generated corpus,
   with the hand-written peer as a differential control.** Demonstrated below on four targets. It found two real
   generated-only defects in one sitting, neither of which any byte-lock could see. It also, honestly, has almost no
   discriminating power on the _current_ corpus, because straight-line `u64` arithmetic contains no idiom choices —
   and a bar with nothing to judge is the vacuity class wearing a green check. Named, not hidden.

5. **For F# and C# there is no mechanical idiom bar today, and the fix is nearly free.** The generated artifacts are
   loose `.fsx`/`.csx` scripts; the repo's analyzer floor (`CA1304/1305/1307/1310/2007` at **error** level in
   `.editorconfig`) runs on _compiled projects_, not scripts. Emitting into a real `.fsproj`/`.csproj` turns the
   existing floor into a hard generated-code gate at zero new tooling cost.

---

## 1. Corrections to the brief (flagged explicitly, as asked)

### C1 — the surface language was **deleted** in v2, and the C#/F# blend already exists as the _authoring_ split

The brief treats the surface language as a thing to sketch. The v2 doc **pruned it**:

> | `.zeta` surface language + PEG parser | **deleted** | Accidental complexity (Rodney). The F#-defined IR _is_ the
> source of truth; a surface syntax is a round-trip back to a tree you can construct directly. |
> | Standalone semantic-analyzer / typechecker | **deleted** | … **the F# compiler is the typechecker.** |

and replaced it with §4f — _the shape is the surface_, a visual/geometric authoring face, explicitly _"not a
reintroduction of the pruned thing — it is the opposite."_

Meanwhile §2 assigns **C# the interface contracts** (for declaration-site variance, which F# lacks) and **F# the IR
and the generator**. So _"the language we have feels like a mix between C# and F#"_ is **already literally true of the
shipped authoring surface** — it is two languages, each holding the half it is better at, not one blended syntax.

This is a fork that needs Aaron's call, not the shadow's:

- **Reading A — descriptive.** He is naming the C#-contracts ⊕ F#-machinery split that exists, and the ask is only
  the second sentence (native-feature emission). Under A, §4 of this doc is an illustration, not a proposal.
- **Reading B — a revival.** He wants the text surface back, which reverses a v2 decision made by a six-agent panel
  plus his own decisions, and would want that reversal recorded as such rather than slid in.

I have written §4 as a sketch under Reading A's charity (it costs nothing and makes the idiom argument concrete), and
I am **not** proposing the v2 deletion be reversed. If B is meant, the honest move is an explicit supersede note on
the v2 doc, not a new parallel design.

_(Also noted: the brief's "this was part of our original IR design too" is accurate — v1 had the surface language.
v2 is what removed it.)_

### C2 — §0 is about the _source_ type's capabilities; the target has none declared anywhere

§0 lists the dispatch participants: _"each injected capability (algebra, collation, scheduler, precision, plus domain
participants like meter/network/impl) is a dispatch axis."_ Every one of those is a property of the value being
computed over. The worked table in §4a is the shape of the whole model:

| Type declares         | Operator that lights up         | Byte-lock condition                         |
| --------------------- | ------------------------------- | ------------------------------------------- |
| **CommutativeMonoid** | `tree_fold` (order-independent) | safe at any fold order across all 6 targets |
| **Monoid**            | ordered left-fold only          | all 6 targets must use one canonical order  |

Read what this gates: **which operator is legal**. Emit `tree_fold` for a non-commutative type and the Merkle roots
diverge. That is a permission lattice with a soundness direction.

Now read the idiom question in the same frame. `for i in 0..v.len() { s += v[i] }` and `v.iter().sum()` are **both
legal, both correct, byte-identical**. No capability forbids either. There is no lattice, because there is no
soundness ordering — only a community's taste, which is real but is not a permission.

`rg -ci 'targetCapabilit|backendCapabilit'` over `tests/cross-verification/_harness/` and `src/Core/` → **0**.

**Verdict on the brief's reading:** the mechanism transfers (multiple dispatch is specificity-ordered preference, which
is exactly idiom's shape — this is the part the brief got right and it is not a small thing). What does not transfer
is the _content_: there is no target-capability vocabulary, and, more decisively, **no emission site presents a
choice**. See §3.

### C3 — the "adequacy oracle is orthogonal" framing is right, and understated

The brief says behavioural equivalence does not measure idiomaticity. True, and the stronger statement is worth
carving: **the byte-lock cannot in principle be extended to cover idiom**, because idiom is by construction the set of
choices the byte-lock is invariant to. Any attempt to make golden vectors catch idiom would be an attempt to make
them sensitive to something they are defined to quotient out.

### C4 — `codegen-self-host.ts` proves less than its docstring claims, and the shortfall is _exactly_ the idiom axis

Its header says _"mix(mix, mix) = cogen (the 3rd projection, THIS FILE)."_ What the code does
(`generateCodegen` / `referenceCodegen` / `verifyFixpoint`): a **table-driven emitter is proved equal to a
hand-written emitter** on splitmix64 and fmix32. That is real and useful. But the `CodegenIr` table carries only the
_wrapper_:

```ts
{ opType: "mul", template: "  z = ({expr}) & MASK;", substitutions: [{ placeholder: "{expr}", source: "k_unsigned" }] }
```

and the operator expression itself is native TypeScript inside `generateCodegen`:

```ts
if (sub.source === "k_unsigned") {
  value = `z * ${getKUnsigned(op, ir.width)}n`;
} else if (sub.source === "shift") {
  value = `z ^ (z >> ${op.s}n)`;
}
```

So the reified part is the scaffolding; **the part that is still native code is the target-specific expression** —
i.e. precisely the idiom. And `CodegenIr` has a `target: string` field with exactly **one** instantiation ever
(`typeScriptCodegenIr`; `rg -c ': CodegenIr = '` → 1, plus one in the test). The other six targets are hand-written.

This is not a criticism of the file — `MixIr.fs` states the identical caveat about its own slice, in its own words
(_"it does NOT yet reify the mix ALGORITHM into the IR"_), which is exemplary honesty. The correction is to the
**docstring's claim strength**, and the finding is that the un-reified residue and the idiom axis are the same thing.
Recommend the header be softened to what `verifyFixpoint` actually asserts.

---

## 2. What is already built (survey — do not re-derive)

Verified at `58c62e25a` (main tip, 2026-08-15).

| Thing                                                  | Where                                                                                                                                                                                        | State                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frozen IR, v1→v4 with a working evolution contract** | `src/Core/ZetaIrV{1,2,3,4}.fs`                                                                                                                                                               | **Built.** Each version adds ops proved outside the prior grammar (`rotl`; `xrotxor`/`xshrxor`; `add`), under a bumped `schema` tag, in a new module, leaving predecessors byte-identical. This is the §6 evolution contract _actually honoured_, which is rarer than the design.          |
| IR node vocabulary                                     | same                                                                                                                                                                                         | **6 scalar ops**: `mul`, `xorshr`, `rotl`, `xrotxor`, `xshrxor`, `add`. No types, lambdas, folds, sequences, interfaces, or capability fields.                                                                                                                                             |
| Multi-target emission                                  | `tests/cross-verification/_harness/codegen-*.ts`                                                                                                                                             | **Built**, 7 targets (TS · F# · C# · Rust · Python · Go · Q#).                                                                                                                                                                                                                             |
| **Lenses** (the idiom axis, in embryo)                 | `codegen-from-ir` (straight-line), `codegen-specialize` (1st Futamura, unrolled), `codegen-rx` (Rx/stream), `codegen-clifford`, `codegen-interface`, `codegen-v2-ring`, `codegen-soft-lanes` | **Built**, and genuinely target-idiomatic in places — `codegen-rx.ts` documents _"the emitted code uses language-idiomatic Rx libraries"_ and delivers F# `Observable.map`, C# `Select`/`SelectMany`, Rust `futures::stream`, Go channels.                                                 |
| The cost of that                                       | `grep -hoE '^(export )?function emit[A-Za-z0-9]+' codegen-*.ts \| sort -u \| wc -l`                                                                                                          | **50 hand-written emitters** — ≈ the full lens × target Cartesian product. See §3.3.                                                                                                                                                                                                       |
| 3rd-Futamura self-host                                 | `codegen-self-host.ts` (+ `.test.ts`)                                                                                                                                                        | **Built at the strength described in C4**: table-emitter ≡ hand-emitter, TS only.                                                                                                                                                                                                          |
| 1st-Futamura specializer                               | `codegen-specialize.ts`                                                                                                                                                                      | **Built** — unrolls the IR to straight-line code; falls back to an ensemble loop on branching ops.                                                                                                                                                                                         |
| Grammar/parser rung                                    | `src/Core/GrammarIr.fs`, the ladder doc                                                                                                                                                      | Rung 1 (bit) and rung 2 (value-tree codecs) **built**; rung 3 (`.g4` ingest → LR/GLR) **designed**. Aaron's "parser comes after" matches the ladder.                                                                                                                                       |
| Interface emission incl. variance                      | `codegen-interface.ts`                                                                                                                                                                       | **Built** — C# `out`/`in`, Rust `pub trait` + snake_case, F# `abstract member`. Explicitly framed as _"GCF+specialize: richest shared structure + per-language extras."_                                                                                                                   |
| **Committed generated source**                         | —                                                                                                                                                                                            | **None.** `rg -l 'GENERATED by codegen' --glob '*.rs'` over `tests/cross-verification` → **0**. Every `_gen/gen.rs` in the tree is a _hand-written independent oracle_; generated code exists only transiently at test time. This is the blocking prerequisite for any linter gate (§5.4). |
| Target-capability declarations                         | —                                                                                                                                                                                            | **None** (0 hits).                                                                                                                                                                                                                                                                         |

Two things worth saying out loud because they were not obvious to me before looking:

- **"GCF+specialize" is already the right name for the thing being asked for.** The idiom axis is not missing from the
  factory's vocabulary; it is missing from the _dispatch_.
- **The Rx lens gets its idiom almost for free by coincidence.** `mul`/`xorshr` are 1→1 scalar transforms, so each maps
  to exactly one `map`. That is a property of a six-op scalar vocabulary, not a general mechanism — and it is why the
  current corpus cannot tell a general idiom mechanism apart from a lucky one.

---

## 3. The capability-axis analysis (the load-bearing section)

### 3.1 Three layers exist; only two are principled

| Layer                                     | Form                               | Keyed by                                                       | Offers a choice?                                                    |
| ----------------------------------------- | ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| **1. Capability model** (§4, design-only) | permission lattice                 | _source type_'s declared algebra/collation/scheduler/precision | yes — and gated by soundness                                        |
| **2. Lenses** (built)                     | ~50 hand-written `emit*` functions | (lens, target) pair, chosen by the _caller_                    | no — one function per cell                                          |
| **3. `CodegenIr`** (built, TS-only)       | flat template table                | (target, opType)                                               | no — `patterns.find(p => p.opType === op.op)`, first and only match |

Layer 1 is dispatch. Layers 2 and 3 are lookup tables with one entry per cell. **A dispatcher with one applicable
method per call site is a function pointer.**

### 3.2 What is precisely missing — three things, in increasing order of difficulty

**(a) A target-capability vocabulary.** Nothing declares that Rust has `Iterator`/ownership/traits/`wrapping_*`,
that C# has LINQ/records/`Span<T>`, that F# has computation expressions/active patterns, that Go (pre-1.23) has
_no_ generic iterator idiom so the explicit loop **is** the idiom. Today all of that lives implicitly, inside the
bodies of 50 functions. Cheap to fix; it is a data file.

**(b) A specificity order and, before that, more than one candidate.** Adding target capabilities buys nothing while
each (lens, target, op) cell has a single emission. The dispatcher needs **alternatives** — for one IR fold node:
`iterator-chain` (needs `Iterator`), `linq` (needs LINQ), `pipeline` (needs `|>` + `Seq`), `explicit-loop` (needs
nothing, always applicable). Then "best-effort mix the declared interfaces permit" becomes an actual resolution:
most-specific applicable method wins, `explicit-loop` is the always-applicable base case. This is CLOS/Julia
specificity, and it is the correct anchor — but note the register difference from §4a: **there, losing the
resolution is a bug; here, losing it is a fallback.** The always-applicable base case is what makes idiom dispatch
_total_, which the soundness lattice deliberately is not.

**(c) The IR must stop being flat — idiom is destroyed by premature lowering.** This is the real one.

> You cannot emit `.iter().map(f).sum()` from an IR that has already been lowered to an index loop, because the IR no
> longer contains the fact that it _was_ a fold. Every lowering step is an irreversible loss of idiom surface, and
> the loss happens **before** any dispatcher gets to choose.

`ZetaIrV1`–`V4` are maximally lowered already: a straight-line list of scalar bit operations. There is no fold to
recognise. So the honest statement is not "the capability model cannot express idiom" — it is:

> **The capability model _could_ carry idiom, but there is currently no IR content for it to carry idiom _about_.**

The fix is the discipline the v2 doc already anchors and does not apply here — **nanopass** (Sarkar, Waddell, Dybvig
2004): a _ladder_ of IR levels, each a small lowering of the last. Then:

> **Idiom selection is lowering-arrest.** For each node, stop lowering at the highest level for which the target
> declares a matching capability, and emit there. Continue lowering only for targets that lack it.

Rust stops at `Fold`→`Iterator`; C# stops at `Fold`→LINQ; Go keeps lowering to `Loop` because it declares nothing
higher. One IR, one traversal, five different-shaped outputs, each idiomatic in its own target, no per-target
emitters. **That is §0's "best-effort mix the declared interfaces permit", read along the lowering axis** — the
brief's instinct, sharpened into something buildable, and it also dissolves the 50-emitter problem in §3.3.

### 3.3 The generator has reproduced its own negative anchor

The v2 doc's WHY is Aaron's Itron collection engine: four injected interfaces, ~15 years, ~1M lines, _"no good
composability, so it was plumbing everywhere"_ — and Zeta exists so you **declare capabilities and the generator
composes the mix** instead of hand-plumbing N versions of 4 interfaces.

Count the codegen harness: **50 hand-written `emit*` functions**, ≈ 7 lenses × 7 targets. Adding a target costs 7 new
functions; adding a lens costs 7. The growth is multiplicative, by hand, with no composition.

That is the negative anchor, at 1/20000 scale, **inside the artifact built to refute it.** I want to be careful about
the register here: 50 functions is not a crisis, the code is clear, and every one of them was the right call at the
time. The finding is directional, not alarmist — the derivative is wrong, and the fix (§3.2c) is the one the project's
own principle already prescribes. Catching this early is cheap; catching it at lens 20 × target 10 is not.

### 3.4 Where the C#/F# blend earns its keep — this is not only aesthetics

A surface language for this IR has to express, in one place, both halves that §2 currently splits:

- **declaration-site variance and interface contracts** — C#'s `interface IFoo<out T>` / `<in T>`. F# genuinely
  cannot say this, which is why §2 hands the contract layer to C#. Variance is not decoration: `codegen-interface.ts`
  already consumes it, and it is what makes shapes _compose_ rather than merely _match_ (v2 §5: _"Compatibility is
  interface composability, not identity"_).
- **capability declarations as constraints** — `where T : CommutativeMonoid` is the §4a gate written down. Today the
  gate exists in prose and in no artifact.
- **pipeline/fold intent at a level above the loop** — F#'s `|>` and `Seq` combinators, which is exactly the
  un-lowered form §3.2c needs. Writing the source in pipeline form is what _preserves_ the idiom surface.

So the blend is not a taste preference: **C# supplies the variance the contract layer needs, F# supplies the
un-lowered pipeline form the idiom layer needs.** Each language is carrying the half the other cannot.

---

## 4. Surface-syntax sketch — **toy**, offered to make §3 concrete

No parser is proposed and none should be built until the IR is trustworthy (Aaron's own sequencing, and the
ladder doc's rung 3). This exists so §3 can be read against something.

### 4.1 `splitmix64` — the real shipped IR, in surface form

Current authoring reality (the frozen `zeta-ir-v1` row, verbatim from `zeta-ir-v1.golden.json`):

```json
{
  "schema": "zeta-ir-v1",
  "generator": "rng.splitmix64",
  "version": 1,
  "width": 64,
  "ops": [
    { "op": "mul", "k": -7046029254386353131 },
    { "op": "xorshr", "s": 30 },
    { "op": "mul", "k": -4658895280553007687 },
    { "op": "xorshr", "s": 27 },
    { "op": "mul", "k": -7723592293110705685 },
    { "op": "xorshr", "s": 31 }
  ]
}
```

Surface sketch:

```fsharp
// C#-flavoured half: the contract, with declaration-site variance and a capability constraint.
capability Mixer<in TSeed, out TWord> where TWord : WrappingRing<64> {
    TWord Mix(TSeed seed)
}

// F#-flavoured half: the body. Pipeline form, inference, no annotations.
generator rng.splitmix64 : Mixer<u64, u64> version 1 =
    fun x ->
        x
        |> mul    0x9E3779B97F4A7C15u64
        |> xorshr 30
        |> mul    0xBF58476D1CE4E5B9u64
        |> xorshr 27
        |> mul    0x94D049BB133111EBu64
        |> xorshr 31
```

Two things this buys that the JSON does not: the `width: 64` becomes a **capability constraint**
(`WrappingRing<64>`) that the type system checks rather than a field a backend must remember to honour, and the
literals are written **unsigned** rather than as the signed bit-patterns the JSON is forced into (`-7046029254386353131`
is `0x9E3779B97F4A7C15` reinterpreted — a real readability cost of the current envelope, noted in `ZetaIrV1.fs`).

Note honestly: **this example has no idiom surface.** Six scalar steps lower to six statements in every target. It
demonstrates the _feel_ and nothing about native features. Which is the point of §4.2.

### 4.2 A fold — where the idiom axis actually bites

```fsharp
capability CommutativeMonoid<T> : Monoid<T>       // adds a law, no new members
capability Collation : Ordinal                     // §4c, declared not ambient

let merkleRoot (leaves: seq<Hash>) : Hash =
    leaves
    |> map       hashLeaf
    |> treeReduce combineHashes     // requires CommutativeMonoid; `reduce` would need only Semigroup
```

`treeReduce` is §4a's gate: legal **only** because `Hash`'s combiner declares `CommutativeMonoid`. That is layer 1,
and it is a soundness question. Now the layer the design does not yet have — what each target _should_ receive, given
what it declares:

| target     | declares                    | emission                                                                         | why it is the idiom                                                       |
| ---------- | --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Rust       | `Iterator`, borrow          | `leaves.iter().map(hash_leaf).reduce(combine_hashes)`                            | iterator chains; `iter()` not `into_iter()` because the signature borrows |
| C#         | LINQ                        | `leaves.Select(HashLeaf).Aggregate(CombineHashes)`                               | LINQ is the community's fold                                              |
| F#         | `\|>`, `Seq`                | `leaves \|> Seq.map hashLeaf \|> Seq.reduce combineHashes`                       | pipeline                                                                  |
| Python     | comprehensions, `functools` | `reduce(combine_hashes, map(hash_leaf, leaves))`                                 | —                                                                         |
| Go (≤1.22) | _nothing higher_            | `acc := ...; for _, l := range leaves { acc = combineHashes(acc, hashLeaf(l)) }` | **the explicit loop IS idiomatic Go**                                     |
| Q#         | —                           | not applicable                                                                   | —                                                                         |

The Go row is the load-bearing one and the reason a **structural** idiom predicate is the wrong bar: "generated code
contains no manual loop where an iterator would do" is _false as a rule_ — in Go the manual loop is the right answer,
and pre-1.23 there is no alternative. **Idiom is target-relative, so only a target-local authority can judge it.**
That is the whole argument for §5.

### 4.3 Where collation stops being ambient

```fsharp
let canonicalJson (v: Value) : string =
    match v with
    | Obj fields -> fields |> map (fun (k, x) -> $"{quote k}:{canonicalJson x}")
                           |> joinWith ","  |> braces
    | Str s      -> quote s
    | Int n      -> decimal n     // bare exact decimal — §3 bignum primacy
```

`match … with` is F#, `$"…"` is shared C#/F#, `|>` is F#. The `Collation : Ordinal` capability from §4.2 is what makes
any key ordering here a _declared_ choice rather than a per-target string default — the live failure
`081KT07NV0008QG0R001YDB73K` is what happens when it is ambient. (Factual note: the repo's canonical-JSON object form
is **order-significant, not sorted** — `src/Core.TypeScript/dynamic-value/json.ts` line 6 — so this example is about
_escaping and number form_, not sorting. Included because I nearly wrote a sorting example from memory and the source
says otherwise.)

---

## 5. The idiomaticity bar

### 5.1 The proposal

> **The target community's own formatter and linter, at a pinned tool version and a declared lint level, run over a
> committed generated corpus, with the hand-written peer as a differential control.** The falsifiable claim is not
> "generated code is clean" but **"generated code is no _less_ idiomatic than the hand-written peer"** — mechanically:
> `lints(generated) ⊆ lints(hand-written)` by lint class, plus `formatter --check` exits 0.

Four design choices, each of which is load-bearing:

1. **The linter, not a reviewer.** `clippy`, `gofmt`, `ruff`, the Roslyn/F# analyzers _are_ each community's own
   codified idiom judgement. That is the correct authority and it is not ours to invent. (This is
   `anchor-to-human-prior-art` applied to taste: the anchor for "what is idiomatic Rust" is the Rust project, and it
   ships as an executable.)
2. **Differential, not absolute.** Absolute zero-warnings is the wrong bar and would have failed immediately: at
   `pedantic + nursery` the generated Rust and the _hand-written_ Rust each emit 10 warnings of **identical classes**
   (§5.2). Those are properties of the problem, not of the generator. The differential form isolates what the
   _generator_ did wrong.
3. **Pinned tool version.** An unpinned linter means a toolchain bump silently changes the verdict, and a lint that
   _disappears_ reads as a pass. Same failure shape as the `bunx tsc` SIGSEGV trap: a check that did not run looking
   like one that passed.
4. **Committed corpus.** Today nothing generated is committed (§2), so there is literally nothing to lint. This is
   the prerequisite, and it is small.

### 5.2 Demonstrated — Rust, splitmix64, clippy 0.1.87 / rustc 1.87.0

Generated with the committed harness from the frozen v1 IR:

```
bun tests/cross-verification/_harness/codegen-from-ir.ts <ir.json> <out>
```

against the committed hand-written oracle `tests/cross-verification/splitmix64/_gen/gen.rs` as control.

| tool / level                                          | generated | hand-written control | verdict                |
| ----------------------------------------------------- | --------- | -------------------- | ---------------------- |
| `cargo clippy` (default)                              | **0**     | **0**                | tie — and see 5.3      |
| `cargo clippy -W clippy::pedantic -W clippy::nursery` | **10**    | **10**               | tie; classes identical |
| `rustfmt --check`                                     | exit 0    | exit 0               | tie                    |

Lint classes, by machine-readable count (`--message-format=json`), identical on both sides:

```
  1 generated.rs  | clippy::format_push_string        1 handwritten.rs | clippy::format_push_string
  1 generated.rs  | clippy::missing_const_for_fn      1 handwritten.rs | clippy::missing_const_for_fn
  8 generated.rs  | clippy::unreadable_literal        8 handwritten.rs | clippy::unreadable_literal
```

`lints(generated) ⊆ lints(hand-written)` **holds**. The claim "generated Rust is no less idiomatic than the
hand-written peer" is, for this lane, **measured and true** — and `missing_const_for_fn` is a genuine idiom miss that
_both_ sides share (`fn mix(x: u64) -> u64` could be `const fn`), which is exactly the kind of thing the differential
form correctly declines to blame on the generator.

### 5.3 Why default clippy is silent — checked by experiment, not inferred

Zero default warnings on generated `z = z ^ (z >> 30);` looked like the linter had not run, so I probed it:

```rust
pub fn a(mut z: u64, y: u64) -> u64 { z = z ^ y;            z }   // → warns: assign_op_pattern, "replace with z ^= y"
pub fn b(mut z: u64) -> u64          { z = z ^ (z >> 30);   z }   // → silent
```

`assign_op_pattern` is on by default and _does_ fire — it declines when the assignee reappears inside the RHS
operand. So default clippy is genuinely clean here, not broken. **Recorded because the wrong inference ("our
generated code is perfect" / "clippy is broken") was available and cheap, and both are wrong.**

The operative consequence: **default clippy on this corpus is a check that cannot fail**, so it must not be the
gate level. `pedantic + nursery` is where the bar has to sit.

### 5.4 Where the bar bit — two real generated-only defects the byte-lock cannot see

**Rust, Rx lens** (`emitRustRx` on splitmix64):

```rust
use futures::stream::{self, StreamExt};   // ← `self` unused: the map-only path never constructs a stream
```

`cargo clippy` (default, `unused_imports`) flags it. The code compiles, runs, and byte-locks identically — and would
be **rejected outright** by any Rust crate with `#![deny(warnings)]`. This is a generator defect (the import line is
emitted unconditionally regardless of which ops are present), it has no hand-written peer to excuse it, and no
behavioural test in the tree can ever see it.

**Python** (`gen.py`, `ruff`):

```
EXE001  Shebang is present but file is not executable
 --> gen.py:1:1  #!/usr/bin/env python3
```

Same shape: emitted unconditionally, invisible to behaviour, mechanically caught.

### 5.5 The other targets, honestly

| target         | tool                                                                           | result                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Go**         | `gofmt -l` / `go vet ./...`                                                    | `gofmt -l` **empty**, diff 0 lines; `go vet` **clean**. Generated Go is canonically formatted and vet-clean. `gofmt` is an unusually good bar: Go has exactly one canonical form, so the check is total and binary. |
| **Python**     | `ruff format --diff` / `ruff check`                                            | already formatted; one `check` finding (§5.4).                                                                                                                                                                      |
| **Rust**       | `clippy` + `rustfmt`                                                           | §5.2–5.4.                                                                                                                                                                                                           |
| **TypeScript** | repo has `lint:typescript` (custom) + `format:check` (prettier); **no eslint** | prettier is a genuine formatter bar; the custom linter encodes _repo_ idiom, not _community_ idiom. Both usable, neither is TS's community authority.                                                               |
| **F# / C#**    | **none available**                                                             | see below.                                                                                                                                                                                                          |
| **Q#**         | none surveyed                                                                  | **do not claim a bar exists.**                                                                                                                                                                                      |

**F# and C#: there is no mechanical idiom bar today. Saying so plainly, as asked.** The generated artifacts are loose
`.fsx`/`.csx` **scripts**. The repo's analyzer floor — `CA1304`, `CA1305`, `CA1307`, `CA1310`, `CA2007` at **error**
level in `.editorconfig`, per `culture-invariant-by-default` — runs on **compiled projects**, not scripts. `fantomas`
and `dotnet-format` are not installed. And `dotnet fsi` **exits 0 on a compile error** (a live trap this week), so a
"does it load" smoke check is worse than nothing: it is a check that cannot fail, wearing a green.

The fix is unusually cheap and I recommend it as the first rung: **emit the F#/C# lanes into a real
`.fsproj`/`.csproj` inside the repo's existing `.editorconfig` scope.** The analyzer floor already exists and is
already at error level; the generator simply does not emit into it. That single change converts five culture/async
correctness rules into a hard generated-code gate at zero new tooling cost — and those five are not cosmetic: they are
the exact class that produced `081KT07NV0008QG0R001YDB73K`.

### 5.6 The bar's honest limit — the corpus, not the bar, is degenerate

The current generated corpus is straight-line scalar `u64` arithmetic. It contains **no collection, no ownership
decision, no trait, no iterator choice, no lifetime, no async, no error path**. So the number of idiom decisions the
generator makes is close to zero, and a linter with nothing to judge returns green for the wrong reason.

> A green bar over a corpus with no idiom surface is the vacuity class. The bar is sound; the corpus cannot exercise it.

This is the actual blocker on measuring Aaron's requirement, and it is **not** fixed by better linting. It is fixed by
§3.2c — an IR with enough structure to _have_ an idiom decision — after which the linter becomes discriminating. The
correct order is therefore: (1) commit a generated corpus and pin the tools _now_, cheap, catches the §5.4 class
immediately; (2) grow the IR's level; (3) the bar acquires teeth as a consequence.

### 5.7 The two bars I am **not** proposing as primary

**Performance vs hand-written** (the brief's candidate 2): objective, and the hand-written corpus exists. But it is
**sound and incomplete** — it convicts, never acquits. Most idiom choices are performance-neutral (`z ^= x` and
`z = z ^ x` compile to identical machine code; `.iter().sum()` and the index loop both vectorise), so a passing
perf ratio says nothing about idiom, while a failing one is real evidence. Keep it as a _convicting_ secondary
signal, with the one-way inference stated. Note also it is unusable on the current corpus for a separate reason:
six multiplies is below measurement noise.

**Structural predicates** (candidate 3): already in the tree — `expect(rs).toContain(".map(|z|")`,
`expect(fsx).toContain("Observable.map")`. These are fine as _regression pins_ and must not be the measure, for a
reason worth naming: **a structural predicate is written by the emitter's author, so it can only pin an idiom
somebody already thought of — never discover one nobody did.** Neither §5.4 defect is findable this way. And
`toContain` on generated text is weak even as a pin: it passes on a substring appearing in a comment.

---

## 6. Overlaps and boundaries (other agents in flight)

- **Generated-vs-hand-written _behavioural_ adequacy** — a different agent. **Orthogonal by construction** (§C3), and
  I have not touched it. One shared prerequisite worth coordinating on rather than duplicating: **committing a
  generated corpus** (§5.4) serves both. If that agent lands it, this bar is nearly free.
- **Canonical collation** — §4.3's `Collation : Ordinal` restates that agent's territory as a capability. I made no
  collation changes and assert nothing about the canonical order.
- **Golden-vector vacuity** — §5.3/§5.7 are the same discipline (a check that cannot fail) applied to linting rather
  than to vectors. Same finding-shape, different surface; no file overlap.
- **Meno-braided algebra / AgencySignature gate scope / signal crashes** — no overlap.
- Untouched: `src/Core/ZetaIrV*.fs`, all `codegen-*.ts`, all golden vectors. **This PR adds one document.**

---

## 7. Anchors — checked, not merely cited

- **Nanopass compilation** — Sarkar, Waddell, Dybvig (2004). _Checked:_ the paper's claim is that a compiler should be
  many small passes over a **ladder of IR levels** with the invariants of each level made explicit. §3.2c uses exactly
  that — the ladder — and the specific move (arrest lowering at the highest level the target supports) is an
  application, **not** something the paper says. Flagged as ours.
- **Multiple dispatch** — CLOS (Bobrow et al. 1988); Julia (Bezanson et al. 2017). _Checked:_ both resolve by
  **specificity over an applicability lattice**, which is a preference order with a most-general fallback — the right
  shape for §3.2b. What they do **not** supply is a soundness gate; conflating that with §4a's permission lattice
  would be the error C2 names. Both papers are cited in v2 §7; the entailment I am attaching is the specificity
  ordering only.
- **Itron collection engine (negative anchor)** — Aaron: four injected interfaces (meters · jobs · networks ·
  identity), ~15 years, ~1M lines, _"no good composability, so it was plumbing everywhere."_ _Checked against §3.3:_
  the property being claimed is **multiplicative hand-written plumbing**, and 50 `emit*` functions ≈ 7 lenses × 7
  targets is that property, at small scale. I am claiming the shape, not the scale, and only within the codegen
  harness. Not a claim about Itron's code, which none of us may copy from
  (`cleanroom-two-team-separation`, `itron-hub-patent-boundary-p2p-is-the-upgrade`).
- **Linters as codified community idiom** — `clippy`, `gofmt` (Pike/Griesemer: one canonical format, no options),
  `ruff`, Roslyn analyzers. _Checked:_ each is authored and maintained by the target's own community, which is why it
  is the right authority for "what is idiomatic in _that_ language" — the Beacon move applied to taste.
- **Futamura projections** — Futamura (1971). _Checked against C4:_ the 3rd projection is `mix(mix, mix)`, requiring
  the specializer itself to be an input to the specializer. `codegen-self-host.ts` reifies the _emission templates_,
  not the emission _algorithm_, so what it proves is table-emitter ≡ hand-emitter. `MixIr.fs` states this limit about
  its own slice explicitly and correctly; the correction is only to `codegen-self-host.ts`'s header claim.
- **Culture-invariant floor** — the repo's own `.editorconfig` CA rules at error level. _Checked by reading the rule
  file:_ CA1304/1305/1307/1310/2007, `[*.{cs,csx}]`. §5.5's recommendation depends on these being **project-scoped**,
  which is why loose `.csx`/`.fsx` escape them.

## 8. What this is worth (register)

**Toy:** §4's surface syntax (no parser, no falsifier, no user); §3.2's proposed lowering-arrest mechanism (nothing
built, nothing can refute it yet).

**Metered:** §5.2's differential linter result (falsifier: the lint-class inclusion can fail, and it _did_ fail on the
Rx lens and the Python lane); §2's survey counts (all re-verified at `58c62e25a` by command, listed inline so they can
be re-run and disagreed with).

**Owned errors while doing this:** (1) I read `_gen/gen.rs` as generated because of the directory name — it is a
hand-written oracle; corrected by reading the file headers rather than trusting the path. (2) I nearly wrote a
sorted-keys canonical-JSON example from memory; the source says object order is significant (§4.3). (3) I nearly
concluded clippy was inert from a zero-warning run; the canary in §5.3 is the correction.

---

_Mirror→Beacon note: written in the Beacon register because it is load-bearing on a design decision. The one
unpeeled Mirror term retained is "lens", because it is the codebase's own name for the thing and the doc argues it
should become a dispatch axis rather than be renamed._
