# Idiomatic emission: Bonsai is already the right level — the fold node exists today, and the missing pieces cannot live in the IR

**Author:** the shadow (Otto's shadow-work role)
**Date:** 2026-08-15
**Register:** Beacon (load-bearing on a design decision). Mirror terms retained where the codebase owns the name ("lens", "lane").
**Verified at:** `9b21dbd6b` (`origin/main` tip; my clone's HEAD matches).
**Status of every claim:** each is *executed* (a command in this document reproduces it), *read from the code* (file and line given), or explicitly labelled **open**/**toy**.

**The requirement (Aaron 2026-08-15):**

> "this is why our IR may have to come up with our own version of bonsai — we may want language specific hints, or for it to be written in a way that fuses different compilers' output so it can be performant and idiomatic for that language and not just an instruction-for-instruction rewriting from one language to another that loses the idiomatic. This is the same problem when I translated my book from English to other languages: at first it didn't sound like a native speaker in those languages, it sounded like an English translation. We have enough intelligence and tree/graph rewrite capabilities because all our algos are branch-free — we try to avoid if statements everywhere so it can run on any hardware and be specialized on any hardware; we used composable discriminated unions instead, to avoid control flow. Every time a specialized version is generated in a language we want it to feel idiomatic, like a native writer of that computer language, like our book translation."

Reads on, and does not re-derive: PR #10774 (MERGED) [`the idiom axis`](2026-08-15-the-idiom-axis-capability-dispatch-gates-semantics-not-spelling-target-native-emission-and-the-linter-as-the-bar.md) · PR #10822 (OPEN) `the zeta-ir irreducible core` · [`one algebra, many target-optimized instances`](2026-06-07-one-algebra-many-target-optimized-instances-branch-free-swap-serial-sharp-parallel-soft-aaron.md).

***

## 0. The short version

1. **The answer to "do we need our own version of Bonsai" is no, and the reason is stronger than a preference: the fold node already exists in the shipped format.** `Bonsai.Expr.Call of string * Expr list` serializes as `{"kind":"call","fn":"<any string>","args":[…]}`, and **no oracle whitelists the `fn` name** — F#, TypeScript, C#, and Rust all accept an arbitrary string (§3.2). `Call("map",[Lambda…; Param "xs"])` is grammatical, byte-lockable, and round-trips **today**, with zero schema change, zero version bump, and zero churn to the committed golden vectors.

2. **The real gap is not a missing format. It is a missing edge.** `ZetaIrV1`–`V4` (six lowered scalar ops, six emitters, no expression level) and `Bonsai` (an expression level with lambda and application, four oracles, **zero emitters**) are two rungs of the same nanopass ladder, built eighteen months apart, and **nothing connects them**: `rg -l 'Bonsai' src/Core/ZetaIr*.fs` → empty; `rg -l -i 'bonsai' tests/cross-verification/_harness/` → one incidental comment (§3.1). #10774 said "the IR is too low"; the sharper statement is that **the high level was already built and never wired in**.

3. **Language-specific hints cannot live in the IR, and this is forced rather than chosen.** A field that names a target makes the same program serialize to different bytes depending on which targets the project has — which is N forks inside one file, and it destroys the four-oracle byte-lock the IR exists for. The carveable test: **would this field change if you deleted a target from the project?** If yes it is a target preference and it belongs in a **target descriptor** beside the emitter, never in the serialized tree (§5.1). A *program* property (`associative`, `commutative`) is portable and may live in the IR — and even that needs no schema change, because it can be spelled as a wrapper `Call("associative",[e])` (§5.2).

4. **Branch-free is load-bearing, but not for the reason the brief proposes — and Aaron already wrote down the right reason, twice, two months ago.** The record says *"avoid `if` — it is a **composition-killer**"* (2026-06-06) and *"avoid ifs everywhere so it's easy to switch between parallel soft and serial sharp algebra"* (2026-06-07). That is **instance-passing / dictionary-passing**: the target is selected by *passing a different value*, never by a conditional at the call site. Read at emission time instead of run time, that discipline **is** the answer to question 3 — and the 50 hand-written `emit*` functions #10774 counted are precisely the anti-pattern the 2026-06-07 doc names, at a layer it did not look at (§6).

5. **A non-degenerate corpus already exists, hand-written, in six languages, and I measured that it is non-degenerate.** ZSetMerkle is implemented independently in F#, Rust, Go, C#, Python, and TypeScript against shared vectors. `cargo clippy -W pedantic -W nursery` over the Rust ZSet/Bag/GSet crate yields **62 findings across 9 classes** — versus the u64 corpus's **3 classes** — and the classes include `clippy::option_if_let_else` (*"use `Option::map_or` instead of an `if let`/`else`"*), which is Rust's own linter asking for the combinator over the branch. That is the idiom axis and Aaron's branch-free preference in one mechanical check (§7).

6. **What is *not* generated: any of it.** `rg -l 'GENERATED by codegen'` over `.rs/.go/.py/.fsx/.csx` → **0**. And the file whose name and docstring promise it — `codegen-zset-merkle.ts`, *"generate cross-language ZSet Merkle verifiers"* — **generates nothing**: no writer, no emitter, it verifies the TypeScript implementation against golden vectors (§7.1). Correction to the record, flagged.

7. **I found a real idiom defect in the hand-written F#, by an instrument neither #10774 nor any linter has**: cross-lane differential reading. `ZSetMerkle.byteCompare` is 8 lines of mutable loop; Rust spends `a.0.cmp(&b.0)` and Go spends `sort.Strings`. The .NET one-liner exists — `MemoryExtensions.SequenceCompareTo`. **200 000 randomized cases, 0 sign disagreements** (§7.3). No byte-lock and no F# analyzer can see this; a second lane can.

**Recommendation: no new format, no new IR version, no Bonsai fork.** Four artifacts, all data or wiring, priced in §8.

***

## 1. Corrections to the brief and to the record — flagged explicitly, as asked

### C1 (to the brief) — "Aaron says branch-free is for *hardware* portability" is only half of what is on file, and the other half is the half the brief hypothesised as a new finding

The brief frames this as an open question: *"If avoiding `if` is what makes idiomatic re-emission tractable at all, that is a significant finding."* It is a real finding and **it is already on the record, in Aaron's own words, and not as a hardware claim**:

- `docs/research/2026-06-06-zeta-relativistic-agent-database-vision.md:265` — *"**Coding discipline (maintainer 2026-06-06): avoid `if` — it is a composition-killer.**"*
- `docs/research/2026-06-07-one-algebra-many-target-optimized-instances-branch-free-swap-serial-sharp-parallel-soft-aaron.md:4` — *"we try to still avoid ifs everywhere so it's easy to **switch between parallel soft and serial sharp algebra**."*

Composition and switchability, not warp divergence. The hardware reading is present too (`2026-06-08-the-memetic-quantum-observer…:66` derives no-warp-divergence from it), but it is downstream. **So Aaron's two claims are one property, the brief is right about that, and the honest register is that he unified them himself in June.** My contribution is to carry it to the emission layer, which no doc has done (§6).

### C2 (to the brief) — "a branch-free expression tree is freely re-associable" is not the property the repo has, and stated flatly it is false here

Two counts, both executed:

```
cat src/Core/*.fs | grep -v '^\s*//' | grep -oE '\bif\b' | wc -l   → 2401
```

2401 `if` occurrences in non-comment lines of the F# core. And **Bonsai's own grammar contains a branch**: `Cond of Expr * Expr * Expr`, with a golden vector named `factorial` exercising it. So "all our algos are branch-free" is true of a *layer* (the algebra interfaces, the six ZetaIr ops), not of the codebase, and any argument that assumes global branch-freeness is unsound. §6 states the narrower thing that is true and that does the work.

Worth recording because the repo already solved the `Cond` case and the brief did not know: `BonsaiSoft.evalSoft` evaluates **both** branches and blends them by the test's truth-confidence — *"no hard branch ⇒ branchless / shader-portable"* (`src/Core/BonsaiSoft.fs:14-15`). The branch-elimination mechanism Aaron's requirement wants is shipped, at the Bonsai layer, and it has an honest caveat in its own docstring: both branches are real, so an error in the untaken branch still propagates.

### C3 (to the record, not the brief) — `codegen-zset-merkle.ts` does not generate anything

Its header says *"Phase C: **generate** cross-language ZSet Merkle verifiers … The codegen **produces test scripts**."* The file contains no `writeFileSync`, no `emit*`, and no target lanes. `main()` parses `vectors.yaml`, calls the **TypeScript** `root()`, and compares hex. It is a conformance check for one lane wearing a codegen name.

```
grep -nE 'writeFileSync|emit|generate' tests/cross-verification/_harness/codegen-zset-merkle.ts
→ 2: * codegen-zset-merkle.ts — Phase C: generate cross-language ZSet Merkle verifiers.
```

The only hit is the docstring. This matters beyond tidiness: it is the file a reader would consult to answer *"is ZSet generated?"*, and its name answers wrongly. Recommend the header be corrected to what it does. (Same finding-shape as #10774's C4 on `codegen-self-host.ts`, independently arrived at; I am not touching either file in this PR.)

### C4 (to the brief's anchor list) — Venuti is the right vocabulary and argues for the opposite pole

The brief says *"for translation register the term of art is **domestication vs foreignization** (Venuti) — check before citing."* Checked, and the check bites. Venuti (*The Translator's Invisibility*, 1995) introduces the pair **as a critique**, and he advocates **foreignization** — deliberately retaining the source's strangeness — precisely because domestication is *"an ethnocentric reduction of the foreign text to target-language cultural values"* that renders the translator invisible.

Aaron wants **domestication** ("sound like a native speaker"). So Venuti supplies the axis and the names, and **citing him as support for the requirement would be an unchecked anchor asserting the reverse of his thesis**. What the checked anchor does buy is better than agreement — it says the choice is a *real tradeoff with two defensible poles*, which yields a design consequence in §9.

### C5 (to my own brief-reading) — the brief's "an expression tree could be the higher level, in which case the answer is 'use Bonsai earlier'" understates the position

That framing is conditional. The condition holds *and more strongly than stated*: the fold node is not something Bonsai *could* express after work, it is expressible in the frozen wire format with no change at all (§3.2). I flag this as a strengthening rather than a correction, but the difference is the whole cost estimate.

***

## 2. What I verified rather than assumed (deltas only — #10774's survey stands)

| claim | command | result |
|---|---|---|
| no target-capability vocabulary | `rg -ci 'targetCapabilit\|backendCapabilit' tests/cross-verification/_harness/ src/Core/` | **0** (re-confirmed at `9b21dbd6b`) |
| no committed generated corpus | `rg -l 'GENERATED by codegen' --glob '*.rs' --glob '*.go' --glob '*.py' --glob '*.fsx' --glob '*.csx'` | **0** |
| 50 hand-written emitters | `grep -hoE '^(export )?function emit[A-Za-z0-9]+' …/codegen-*.ts \| sort -u \| wc -l` | **50** |
| **Bonsai ↔ ZetaIr: no link** | `rg -l 'Bonsai' src/Core/ZetaIr*.fs src/Core/MixIr.fs src/Core/Cogen.fs src/Core/GrammarIr.fs` | **empty** |
| **Bonsai ↔ emitters: no link** | `rg -l -i 'bonsai' tests/cross-verification/_harness/` | one comment in `nway-diff.test.ts:10` |
| **`call.fn` has no whitelist** | read `src/Core/Bonsai.fs:306-311`, `bonsai.ts`, `lib.rs`, `BonsaiCodec.cs`; `rg 'UnknownFn\|allowedFn\|knownFn'` | **no whitelist in any of the four oracles** |
| ZSetMerkle has six independent lanes | `rg -l 'zset-merkle\|ZSetMerkle'` across language dirs | F#, Rust, Go, C#, Python, TS — all hand-written |

***

## 3. Question 2 first, because it prices everything else: a Bonsai variant, or a level above?

**Neither. Bonsai used earlier, unchanged.**

### 3.1 The two rungs exist and are not joined

| rung | artifact | has | lacks |
|---|---|---|---|
| **expression** | `Bonsai.Expr` + 4 byte-locked oracles + golden vectors | `Lambda`, `Call`, `Cond`, `Binary`, `Param`, `Const`; a soft evaluator (`BonsaiSoft`) | **any emitter** — it serializes and parses, it never produces target source |
| **lowered** | `ZetaIrV1`–`V4` + 6 emitters + 7-lane cross-verify | six total scalar ops; `codegen-from-ir` × 6 targets; the Futamura lenses | **any structure above a straight-line op list** |

`ZetaIrV4.Op` is a straight-line list. `Bonsai.Expr` is a tree with abstraction and application. **These are exactly two levels of a nanopass ladder** (Sarkar–Waddell–Dybvig 2004 — a ladder of small IR levels with the invariants of each made explicit), and the pass between them has never been written. That is why #10774 correctly concluded "you cannot recover `.iter().map().sum()` from a lowered loop": it was reading the bottom rung, and the top rung is in a different directory with no road to it.

**So the deliverable is a pass, not a format.** That is the cheapest possible shape for this requirement and it is the one the repo's own structure already implies.

### 3.2 The fold node exists today — the decisive check

Bonsai's canonical wire form, from the committed goldens (`src/Core.TypeScript/bonsai/golden-vectors.json`, case `call_empty_args`):

```json
{"kind":"call","fn":"p","args":[]}
```

`fn` is a free string. The F# parser (`src/Core/Bonsai.fs:306-311`) reads it and constructs `Call(fn, args)` with **no membership test**; `rg 'UnknownFn|allowedFn|knownFn'` across all four oracles returns nothing. (Contrast: `UnknownKind`, `UnknownConstTag`, and an unknown-`BinOp` decline *are* implemented — so the absence of an `fn` check is a deliberate open extension point, not an oversight.)

Therefore, with **no schema change**:

```json
{"kind":"call","fn":"sum","args":[
  {"kind":"call","fn":"map","args":[
    {"kind":"lambda","params":["x"],"body":{…}},
    {"kind":"param","name":"xs"}]}]}
```

round-trips byte-identically in F#, TypeScript, C#, and Rust today. **What it costs the byte-lock: nothing.** A new `fn` value is not a new node *kind*; the canonical form is "kind first, then fields in declared order", and every existing golden vector stays byte-identical. New combinators are additive vectors, not a version bump.

### 3.3 What it does cost — stated, because Bonsai's own header states it

> *"the weakly-typed / reflection-info-omitted mode — kind-tagged nodes, no .NET type table — the cross-language-portable form."* (`src/Core/Bonsai.fs:8-11`)

`map` is a **name**, not a typed combinator. There is no check that `xs` is a sequence, no element type, and no arity check on the lambda. That is the same portability-for-expressiveness trade #10822 found on the op-set axis (*"admits ops on two criteria and writes down one"*), appearing here as **the property that makes Bonsai portable is exactly the property that limits target-specific expressiveness** — which the brief predicted and which is confirmed.

**The mitigation, and why it does not require typing the wire format:** the type does not need to be *in* the tree; it needs to be *derivable at emission*. The combinator registry (§5.2) carries `map : (a → b) → seq a → seq b` as emitter-side data. The F# host is the typechecker — the v2 design decision #10774 quotes (*"the F# compiler is the typechecker"*), applied one rung up. Emitting a nonsense tree stays possible; so does emitting a nonsense `ZetaIrV4` op list, which is what `validate` is for.

***

## 4. Question 1: what must an IR carry to permit idiomatic emission — read off the three shipped ZSetMerkle lanes

This is the empirical core, and it is not a general theory: three independent hand-written implementations of **one byte-specified algorithm**, by this team, in this repo. Where they diverge *is* the idiom surface, measured rather than imagined.

`src/Core/ZSetMerkle.fs` · `src/Core.Rust.Algebra/src/zset_merkle.rs` · `src/Core.Go/zset_merkle/zset_merkle.go`.

| step | F# | Rust | Go |
|---|---|---|---|
| collect leaves | `[\| for e in z -> struct (encodeKey e.Key, e.Weight) \|]` | `.as_slice().iter().map(…).collect()` | `for _, e := range entries { counts[e.Key] += e.Weight }` |
| order | `Array.sortWith byteCompare` (**8-line hand-rolled comparator**) | `sort_by(\|a, b\| a.0.cmp(&b.0))` (std `Ord` on `Vec<u8>`) | `sort.Strings(keys)` (std, string-typed) |
| hash leaves | `\|> Array.map (fun (struct (kb, w)) -> hash (leafBytes kb w))` | `.iter().map(…).collect()` | indexed `for i, k := range keys` |
| level fold | `let rec fold` + `match level.Length with 0 \| 1 \| n` + `for` | `fn fold` + **`while cur.len() > 1`, iterative** | `func fold` + `if n==0` / `if n==1`, **recursive** |
| element repr | `struct (byte[], Weight)` — struct tuple | `(Vec<u8>, i64)` — owned | `map[string]int64` — keyed |

Two observations that a design argument alone would not have produced:

- **Rust chose iteration where F# and Go chose recursion, for the same fold.** No capability difference explains it (Rust can recurse); it is taste, and Rust's taste is shaped by the absence of guaranteed TCO. A single lowering would give one shape to all three, and two of them would read foreign.
- **Go's lane takes a different *interface*** (`[]Entry`, accumulating weights and dropping zeros) where F#/Rust take an already-normalised `ZSet`. That is a contract divergence hiding inside an "identical algorithm", and it is the kind of thing a generator would have to be told about explicitly.

### 4.1 The five idiom decisions, and where each fact must live

| the decision | fact required | where it must live | Bonsai node today | byte-lock cost |
|---|---|---|---|---|
| traverse a collection | *this is a map over a sequence* | **IR** (program property) | `Call("map",[Lambda…; e])` | **zero** |
| order the leaves | *the order is byte-ordinal* | **IR** (program property — a declared `Collation`, per `culture-invariant-by-default`) | `Call("sortBy",[…])` + a collation wrapper | **zero** (wrapper form, §5.2) |
| fold pairwise with odd-promote | *this is a fold with a stated combining law* | **IR** | `Call("foldPairs",[…])` | **zero** |
| spell the key comparison | *does this target have lexicographic byte ordering in std?* | **target descriptor** | — | **zero, by construction** |
| own vs borrow the element | *does this target distinguish?* | **target descriptor** | — | **zero, by construction** |

Three of five need **no format change at all**. The other two are the ones that must be kept *out* of the IR — which is §5.

**Answer to the brief's specific question** — *"if a fold must survive lowering to be re-emitted as `.iter().map().sum()`, say what node that requires and what it costs the byte-lock"*: the node is `Call("map", [Lambda; seq])` composed with `Call("sum", [·])`, it is already in the frozen Bonsai grammar, and **it costs the byte-lock nothing** — new `fn` values are additive, existing golden vectors are byte-identical, and no version tag moves.

***

## 5. Question 3: how language-specific hints avoid becoming N forks

### 5.1 The structural answer: they cannot live in the IR, so the fork is impossible rather than discouraged

Suppose a hint in the tree:

```json
{"kind":"call","fn":"map","args":[…],"hint":{"rust":"iter","csharp":"Select"}}
```

Three things break at once, and the third is fatal:

1. The canonical form changes → every committed Bonsai golden vector churns → a version bump, which #10822 already priced and rejected on a smaller change.
2. Adding a *seventh target* mutates the bytes of a program whose meaning did not change. The byte-lock's whole job is that identical semantics ⇒ identical bytes across oracles; a target-indexed field makes the bytes a function of the *project's target list*.
3. **One file now contains N target-specific programs.** That is not "avoiding N forks" — it is N forks with a shared brace.

So the carveable rule, and the reason it is a structural argument and not a style preference:

> **A property of the *program* may live in the IR. A preference about a *target* may not.**
> **The test: would this field change if you deleted a target from the project?** If yes, it is a target preference and it belongs in the target descriptor, beside the emitter, never in the serialized tree.

`associative`, `commutative`, `ordinal-collation`, `pure` — all portable, all survive deleting Go. `prefer_iterator_chain`, `use_linq` — all name a target. The rule sorts them mechanically.

This also **re-reads Aaron's ask rather than refusing it**. "Language specific hints" is the right requirement; the hints are real and needed. What this says is *where they go*: in a per-target data file that the emitter is parameterised by, which is the same place his own 2026-06-07 discipline puts the algebra instance.

### 5.2 The mechanism, in four artifacts — none of which is a format

1. **A combinator vocabulary** — a registry of `fn` names with denotations and types (`map`, `filter`, `sortBy`, `foldPairs`, `sum`, `reduce`). Emitter-side data. Zero format change; new names are already grammatical (§3.2).

2. **Property wrappers instead of fields** — a program property is spelled as a combinator, not as a node attribute: `Call("associative",[Call("foldPairs",[…])])`. This is the trick that keeps the cost at zero: an attribute would change the canonical key set of a node kind; a wrapper is an ordinary `call`. Denotationally the identity; operationally a licence for a rewrite.

3. **Target descriptors** — one small data file per target: which combinators it can spell natively, and therefore **at which rung it arrests lowering**. Rust arrests at `map`/`reduce` (`Iterator`); C# at `Select`/`Aggregate` (LINQ); F# at `Seq.map`/`Seq.reduce`; **Go keeps lowering to a loop, because the loop is idiomatic Go** — #10774's load-bearing row, and the reason a structural predicate ("must use an iterator") fails as a general rule.

4. **One emitter, parameterised by the descriptor** — see §6. This is the piece that dissolves the fork risk, and it is not new here.

### 5.3 The alternatives, honestly

The brief asks whether nanopass lowering-arrest is the only answer. It is not; three others are real, and one is worth taking alongside.

| mechanism | how it avoids N forks | verdict here |
|---|---|---|
| **lowering-arrest** (nanopass) | one IR, N stopping points; the descriptor picks the stop | **primary** — matches the ladder the repo already half-built |
| **peephole rewriting at the target** (each backend re-idiomises after a uniform lowering) | one IR, N rewriters | **rejected** — this is the "make it N% different" shape: you must *recover* the fold you deliberately destroyed, and #10774's obstruction says you cannot |
| **specificity dispatch** (CLOS/Julia) over multiple candidate emissions | one IR, a preference order, an always-applicable base case | **complementary, not alternative** — it is *how* a descriptor picks among applicable spellings once more than one exists. #10774 named the precondition: today every site has exactly one candidate, so there is nothing to resolve |
| **N surface dialects** | it does not | rejected |

Lowering-arrest and specificity dispatch are the same mechanism on two axes (vertical: how far down; horizontal: which of several spellings at this rung). Both need the descriptor. Neither needs a format.

***

## 6. Question 4: is branch-free load-bearing? Yes — as the *dispatch* discipline, which is not what the brief guessed

### 6.1 What is true, narrowly

The brief's hypothesis is that a branch-free expression tree is freely re-associable while a branchy program has fixed control structure resisting reshaping. **There is one verified instance of this in the repo**, and it is worth stating precisely because it is the strongest evidence available: PR #10822's canonicalizer rewrites `XShrXor [23;51]` into two `XorShr` ops by **polynomial factorisation over F₂**, and replays the committed nasam vectors exactly. That rewrite is well-defined *only* because each op denotes a total function with a ring denotation — no paths, no dominance, no φ-nodes. Branch-freeness bought an algebraic rewrite with a denotational equivalence check.

But the hypothesis does not generalise to "branch-freeness is what makes idiomatic re-emission tractable." Compilers reshape branchy programs routinely; that is the job. And §1's C2 counts show the repo is not globally branch-free anyway.

The narrow true statement:

> **Branch-freeness keeps a program in the *expression* category.** A branchy program is a statement sequence; a branch-free program is a term. Idiom lives at the term level — `.iter().map().sum()` is a term, not a control-flow graph. **Bonsai is an expression-tree serializer**, so branch-freeness is what makes Bonsai the right carrier at all.

That is a real link between Aaron's two claims, and it is smaller than "freely re-associable".

### 6.2 What is *actually* load-bearing — and it is already Aaron's, from June

The 2026-06-07 doc is not about expressions. It is about **selection**:

> *"One algebra (interface), many implementations — each optimized for an execution target — selected by **passing a different instance**, never by `if`/`match` branches at the call site."*
> *"`if target = Parallel then … else …` scattered through the hot path is the anti-pattern: it couples every call site to the target set … and adding a target edits every site."*

Now read that with `target` meaning *emission target* instead of *execution target*. It is, word for word, the answer to question 3 — and it convicts the current harness:

| the doc's anti-pattern | the harness today |
|---|---|
| "couples every call site to the target set" | 50 `emit*` functions ≈ 7 lenses × 7 targets |
| "adding a target edits every site" | adding a target costs 7 new functions; adding a lens costs 7 |
| the prescription: "the algebra is a **value**… the call site takes the instance as a parameter" | **not done at the emission layer** — no descriptor exists to pass |

#10774 counted the multiplication and reached for nanopass. **The prescription was already written, by Aaron, on 2026-06-07, for a different layer.** The target descriptor of §5.2 *is* the instance; the single emitter that takes it *is* the branch-free call site. So:

> **Aaron's branch-free discipline is not merely compatible with idiomatic emission — it is the mechanism.** "Select the implementation by passing a different instance, never by branching" and "select the emission by the target's declared capabilities, never by `if target == Rust`" are one rule at two times: run time and emission time.

### 6.3 The DU half, checked

*"we used composable discriminated unions instead, to avoid control flow"* — the 2026-06-07 doc calls this **"branch-free dispatch by *structure*, not ad-hoc `if`"**: matching a DU case is exhaustive typed selection, and the combining law (join-semilattice ⇒ CRDT-parallel; total order ⇒ consensus-serial) resolves it rather than a target conditional.

Applied here: `Bonsai.Expr` is exactly such a DU, and an emitter over it is a total exhaustive match — the branch is on the *node's structure*, which is target-blind, not on the target, which would be the smell. **An emitter that matches on `Expr` and reads the descriptor is branch-free in Aaron's sense even though it contains a `match`.** Recording this because the distinction is easy to lose: the discipline forbids branching on the *target*, not the use of pattern matching.

***

## 7. Question 5: the corpus — measured

### 7.1 Are `ZSet`/`Bag` generated today? No, and one filename says otherwise

`rg -l 'GENERATED by codegen'` over `.rs/.go/.py/.fsx/.csx` → **0**. Every ZSetMerkle lane is a hand-written independent oracle. See C3 for the filename that claims otherwise.

**This is good news for the corpus, not bad.** #10774's bar is `lints(generated) ⊆ lints(hand-written)`, which requires a hand-written control. ZSetMerkle already has **six**, cross-verified against shared vectors. The control half of the differential is the expensive half, and it is done.

### 7.2 Is it non-degenerate? Measured — 9 lint classes vs 3

Executed at `clippy 0.1.87 / rustc 1.87.0`, on `src/Core.Rust.Algebra` (the ZSet/Bag/GSet/IndexedZSet crate), after `touch src/zset_merkle.rs` to defeat the cache — because a 0.87 s "Finished" with no output is the check-that-did-not-run trap:

```
cargo clippy --all-features --message-format=json -- -W clippy::pedantic -W clippy::nursery
```

| class | count | idiom-bearing? |
|---|---|---|
| `clippy::use_self` | **25** | yes — Rust-specific spelling, zero semantic content, byte-lock-invariant |
| `clippy::missing_const_for_fn` | 13 | yes |
| `clippy::many_single_char_names` | 5 | yes |
| `clippy::doc_markdown` | 5 | yes |
| `clippy::too_long_first_doc_paragraph` | 5 | yes |
| **`clippy::option_if_let_else`** | **3** | **yes — "use `Option::map_or` instead of an `if let`/`else`"** |
| `clippy::missing_panics_doc` | 2 | yes |
| `clippy::cast_possible_truncation` | 1 | correctness-adjacent |
| **total** | **62 across 9 classes** | |

Against #10774's u64 corpus: **3 classes** (`unreadable_literal`, `missing_const_for_fn`, `format_push_string`), of which two are literal formatting.

**The corpus is non-degenerate, and this is the falsifier for that claim, not an assertion of it.** The `option_if_let_else` row is the one to notice: it is Rust's own linter saying *replace the branch with the combinator* — Aaron's branch-free preference and the idiom axis turning out to be the same mechanical check, on the exact corpus proposed.

Other lanes, honestly: `gofmt -l` empty and `go vet ./...` clean on `src/Core.Go` (Go's canonical form is total and binary — an unusually good bar, and one this corpus already passes). `ruff check` clean on `src/Core.Python` at the repo's configured level. F#/C# still have no mechanical bar, exactly as #10774 reported; nothing has changed there and its `.fsproj`-scoping recommendation stands.

### 7.3 A defect found by a third instrument, which the linter bar does not have

Reading the three lanes side by side, one step costs wildly different amounts:

```fsharp
// src/Core/ZSetMerkle.fs — 8 lines, mutable loop
let private byteCompare (a: byte[]) (b: byte[]) : int =
    let n = min a.Length b.Length
    let mutable i = 0
    let mutable r = 0
    while r = 0 && i < n do
        r <- compare a.[i] b.[i]
        i <- i + 1
    if r <> 0 then r else compare a.Length b.Length
```

```rust
// src/Core.Rust.Algebra/src/zset_merkle.rs — std Ord on Vec<u8>
leaves_temp.sort_by(|a, b| a.0.cmp(&b.0));
```

.NET has the one-liner: `MemoryExtensions.SequenceCompareTo(ReadOnlySpan<byte>, ReadOnlySpan<byte>)`, vectorized, in the BCL. **Executed differential** (`.scratch/bytecmp.fsx`, `dotnet fsi`, seed 20260815, lengths 0–5, alphabet 0–3 to force ties and prefixes):

```
RESULT cases=200000 disagreements=0
```

(The printed `RESULT` line is the guard: `dotnet fsi` exits 0 on a compile error, so the exit code proves nothing and the output does.)

So the shipped F# hand-rolls a BCL primitive. Nothing catches this: no byte-lock (the behaviour is identical), no F# analyzer (none runs on this), no clippy (wrong language), no structural predicate (nobody thought of it). **A second lane caught it.** That is a third measurement instrument worth naming beside #10774's two:

> **Cross-lane idiom differential** — when one lane spends N lines where another spends one, the expensive lane is either doing something the cheap one cannot, or missing a primitive. Both outcomes are worth knowing; only the second is a defect.

This is `toy` as a *general* method — one find is an anecdote, and the obvious failure mode is that genuine capability differences look like defects. It is offered as a hypothesis generator under `numerology-vs-number-theory`, with the promotion path being: each candidate gets a differential test, and the ones that pass are defects.

### 7.4 A measured weakness in #10774's bar, which I can now name because the control is dirty

`lints(generated) ⊆ lints(hand-written)` is sound. But §7.2 shows the ZSetMerkle control carries **25 `use_self` findings of its own**. Under the differential rule, a generator emitting `ZSet<T>` where `Self` belongs is **excused**, because the control shares the class.

> **The differential bar's discriminating power is bounded by the cleanliness of the hand-written control.** Every class the control is dirty in is a class the bar cannot gate.

This is not a reason to drop it — the absolute bar is worse (it fails on properties of the problem, as #10774 measured). It is a reason to state the bar as **two numbers**: the differential (what the generator did worse) *and* the control's own count (how much of the space is currently un-gated). Cleaning the control is then a legible, priced way to sharpen the bar, rather than an invisible ceiling on it.

***

## 8. What I am proposing, and what I am refusing

### Refused, explicitly

- **No IR v5.** #10822 priced it — fifth layout + validator + four-layer firewall, `ofV4`, six emitters, the seven-lane harness, new frozen goldens, both Lean oracles restated — against a benefit negative on portability, with the Q# lane unable to carry four of the six ops it already has. Nothing in this document needs a grammar change; §3.2 is the reason.
- **No Bonsai fork, and no new serialization format.** The fold node exists.
- **No revival of the deleted surface language.** #10774's C1 fork is Aaron's call, not mine, and nothing here depends on it.
- **No hint field in the wire format.** §5.1 — structural.

### Proposed, priced

| artifact | shape | cost | unblocks |
|---|---|---|---|
| 1. combinator registry | data: `fn` name → denotation + type | small; no format change | §4.1 rows 1–3 |
| 2. target descriptors | data: one file per target — which combinators it spells, where it arrests | small; **must not enter the IR** | §4.1 rows 4–5 |
| 3. the Bonsai → ZetaIr lowering pass | the missing ladder edge (§3.1) | the real work | the whole requirement |
| 4. a committed generated corpus | ZSetMerkle emitted per target, next to the six hand-written controls | small, and #10774 already wanted it | the differential bar acquires teeth (§7.2) |

Order matters and is not the order above: **4 first** (cheap, immediately catches #10774's §5.4 defect class, and it is the shared prerequisite another agent may already be landing), then **1–2** (data, no risk), then **3**.

***

## 9. The book-translation analogy — what it licensed, and where it stops

Per `numerology-vs-number-theory`, the analogy is a **generator**, and a good one: it produced the right question (register is lost by faithful transposition) and the right instrument (ask the target community, not the source author). It is not a proof of anything, and one place it actively misleads is worth naming.

Checked against Venuti (C4): translation studies says the domestication/foreignization choice is a genuine tradeoff, not a solved preference. Carried across:

> **Generated code has two legitimate registers, and the right one depends on the artifact's role.**
> **Foreignize** the cross-verification oracles: uniform, visibly generated, structurally identical across lanes — because their job is to be *diffed*, and a lane that reads like native Go is harder to compare against a lane that reads like native Rust.
> **Domesticate** shipped SDK/library code: native, invisible, indistinguishable from hand-written — because its job is to be *read and extended by that language's people*.

That is a non-obvious design output falling straight out of a checked anchor, and it means the target descriptor needs a **register field**, not just a capability list. It also means #10774's linter bar applies to the domesticated artifacts and *not* to the oracles, where uniformity is the requirement and a low lint count would be the wrong goal.

The analogy stops here. A natural language has native speakers who can adjudicate register; a programming language has a linter, which is an *approximation* of its community's taste with known gaps — §7.4 measures one.

***

## 10. Anchors — checked, not merely cited

- **Nanopass** — Sarkar, Waddell, Dybvig, *A Nanopass Infrastructure for Compiler Education*, ICFP '04, pp. 201–212. *Checked:* the paper's claim is that a compiler should be many small passes over a ladder of formally-defined IR levels, aligning implementation with logical organisation. §3.1 uses the ladder; **"arrest lowering at the highest level the target supports" is not in the paper** — it is #10774's move, and mine only in the application. Flagged as ours, as #10774 also flagged it.
- **Nuqleon Bonsai / Reaqtor** — the named lineage in `src/Core/Bonsai.fs`'s own header (Reaqtor's compact serializer for .NET expression trees). *Checked against the code:* the repo implements the **weakly-typed / reflection-info-omitted** mode, and the header says so; §3.3's tradeoff is quoted from it, not inferred.
- **Venuti**, *The Translator's Invisibility: A History of Translation* (1995; 2nd edn 2008) — domestication vs foreignization. *Checked, and the check inverted the citation:* Venuti introduces the pair as a **critique** and advocates foreignization; domestication is his term for *"an ethnocentric reduction of the foreign text to target-language cultural values."* Citing him in support of "make it native" would assert the reverse of his thesis. Used for the axis and the tradeoff (§9), not as endorsement.
- **Multiple dispatch / specificity** — CLOS (Bobrow et al. 1988); Julia (Bezanson et al. 2017). *Checked, with the entailment limited exactly as #10774 limited it:* specificity over an applicability lattice with a most-general fallback. Used in §5.3 as the horizontal axis only; it is not a soundness gate.
- **Typeclass-as-dictionary** — Wadler & Blott (1989), the dictionary-passing translation; GoF Strategy; GraphBLAS; BLAS/cuBLAS. *Checked via the repo's own anchor list* in `2026-06-07-one-algebra-many-target-optimized-instances…` §"Beacon anchors", which already assembled them for the run-time layer. §6.2's contribution is carrying the same dictionary to emission time; the anchors are that doc's, not newly claimed.
- **Linters as codified community idiom** — clippy, gofmt, ruff. *Checked by execution* (§7.2), including the negative: the Rust and Go tools are the authorities for their languages, and F#/C# have none available here, so no bar is claimed for them.
- **Aaron's own record (primary source)** — `2026-06-06-zeta-relativistic-agent-database-vision.md:265` and `2026-06-07-one-algebra-many-target-optimized-instances…:4`. *Checked by reading both:* the "avoid `if`" discipline is stated as composition/switchability first, hardware second. This is the anchor that changed §6's conclusion.

***

## 11. Register — what is metered, what is unmetered, what is toy

Per `toy-is-free-metered-must-be-earned`:

**Metered** (a named falsifier exists and could fail):

- The corpus non-degeneracy claim — 62 findings / 9 classes vs 3 (§7.2). Falsifier: re-run clippy at the pinned version; a different class count refutes it.
- `byteCompare ≡ SequenceCompareTo` — 200 000 randomized cases, 0 sign disagreements (§7.3). Falsifier: a disagreeing input.
- Every survey count in §2 — each is a command, listed so it can be re-run and disagreed with.
- `call.fn` has no whitelist in any of the four oracles (§3.2) — falsifier: exhibit the check. I read all four.

**Unmetered** (implemented-or-argued, nothing has tried to refute it):

- That the four proposed artifacts (§8) actually produce idiomatic output. Nothing is built. The falsifier is named and is not yet run: generate the ZSetMerkle lanes, then `lints(generated) ⊆ lints(hand-written)` **plus** the control's own count (§7.4).
- The register split in §9 (foreignize oracles, domesticate SDKs). Reasoned from a checked anchor; no artifact tests it.

**Toy:**

- Cross-lane idiom differential as a *general method* (§7.3). One find. The failure mode — genuine capability differences masquerading as defects — is real and unaddressed.

**Owned errors and near-misses while doing this:**

1. I read the first `cargo clippy` run as a result. It finished in 0.87 s with no findings printed, which is the cache — i.e. the check-that-did-not-run wearing a green. Corrected by `touch`-ing a source file and re-running; the 62 findings are from the forced run.
2. I nearly asserted `byteCompare` was a defect on inspection alone. `SequenceCompareTo`'s length-tie behaviour is the kind of thing that is *nearly* the same; the 200 000-case differential is what turned an inference into a measurement. Look, don't infer.
3. I began writing §6 around the brief's re-association hypothesis before searching the record for Aaron's own statement of the branch-free rationale. The 2026-06-07 doc reframed the section and made it stronger. The near-miss was presenting as a new finding something the maintainer wrote two months ago — the exact failure `anchor-to-human-prior-art` exists to prevent, applied to an in-house anchor.
4. `docs/VISION.md` has no §4e, though `src/Core/BonsaiSoft.fs:15` cites *"vision §4e 'avoid `if`'"*. The substance is real (§1 C1 gives the two live sources); the pointer is stale. I did not chase or fix it — noting it so the next reader does not conclude the discipline is unanchored when only the section number moved.

***

## 12. Overlaps and boundaries (other agents in flight)

- **VISION / roadmap** — that agent will *state* this requirement; this document owns the *analysis*. Direct overlap to report: §8 recommends **no v5 and no new format**, and §5.1 says target hints cannot live in the IR. A roadmap row promising "a Zeta Bonsai" or "IR v5 with language hints" contradicts this analysis and one of us should be wrong on purpose rather than by accident. **I edited no roadmap or vision file.**
- **PR #10774 (merged)** — its §3.2c (nanopass lowering-arrest) is the mechanism this document prices and locates. Its §5 bar is adopted, with the §7.4 weakness added from measurement. No file overlap; that PR added one document and so does this one.
- **PR #10822 (open)** — its v5 pricing is load-bearing for §8 and I have not re-derived it. It touches `ZetaIrCanonicalizer.fs`, `ZetaIrV4.fs`, `ZetaIrMinimalSet.Tests.fs`; **I touched none of them.**
- **PR #10807 (open, `ZetaIrEval`)** — not touched, not depended on.
- **Playbooks resurrection, lost-B-NNNN sweep** — no overlap.
- **`codegen-zset-merkle.ts` and `codegen-self-host.ts` docstring corrections** (§1 C3, and #10774's C4) — both are one-line header fixes in the codegen harness. I did **not** make them; if a harness-owning agent is in that file, they belong in that agent's change, not in a docs PR.

**This PR adds one document and changes nothing else.**
