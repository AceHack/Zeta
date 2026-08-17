# The Bonsai emission edge — arrest lowering at the highest level a target supports

**Date:** 2026-08-15 · **Agent:** shadow · **Status:** one working edge landed; the ladder is not built.

***

## What this implements, and what it deliberately does not

[#10827](https://github.com/Lucent-Financial-Group/Zeta/pull/10827) established that idiomatic emission
needs **no new IR version and no new format**: `Bonsai.Expr.Call of string * Expr list` serializes as
`{"kind":"call","fn":"<any string>","args":[…]}`, no oracle whitelists `fn`, and the byte-lock cost of a
new `fn` is **zero** because it is a new _value_, not a new node _kind_. It also located the real gap:

> `rg -l 'Bonsai' src/Core/ZetaIr*.fs src/Core/MixIr.fs src/Core/Cogen.fs src/Core/GrammarIr.fs` → **empty**

Bonsai has four oracles and **zero emitters**; `ZetaIrV1`–`V4` has six emitters and no expression level.
Two rungs of one nanopass ladder that were never joined.

**This document ships the first edge.** One generator (`rng.splitmix64`, plus two more IRs in the
byte-lock assertions), one target (Rust), one higher-level `fn` pair (`map` + `join`), emitted
idiomatically — with the existing lowered path still passing byte-lock. It is deliberately not a ladder,
not a second target, and not a second program. Proving an edge exists is the whole claim.

Aaron 2026-08-15 confirmed a v5 is available but costly and is **happy with the current op set**;
[#10822](https://github.com/Lucent-Financial-Group/Zeta/pull/10822) separately priced a v5 and
recommended against it. So: **no v5, no new format, no new node kind, no version tag moved.**

***

## The mechanism in one paragraph

One target-independent Bonsai expression is written once:

```text
join(",\n", map(λ(id, x). row(id, mix(x)), inputs))
```

A **target descriptor** — a value living beside the emitter, never in the IR — declares which `fn`s that
target can express natively. `arrest` rewrites the tree downward while any `fn` is neither declared
native nor terminal, and stops the moment none is left. A descriptor declaring `{map, join}` arrests at
**L1** and gets an iterator chain; a descriptor declaring **nothing** arrests at **L0** and gets a
mutable accumulation loop. Same expression, same code path, two readings.

| rung   | vocabulary    | Rust emitted                                                         |
| ------ | ------------- | -------------------------------------------------------------------- |
| **L1** | `map`, `join` | `inputs.iter().map(…).collect::<Vec<_>>().join(",\n")`               |
| **L0** | `loop_accum`  | `let mut s = String::from(…)` + `for … enumerate()` + a comma branch |

`L0` is terminal **without being declared**. That is what "floor" means: the bottom rung is native to
every target by definition, so a descriptor declaring nothing still terminates. (This was a real bug —
requiring the floor to be declared made the empty descriptor un-emittable, and the empty-descriptor test
is what caught it, not review.)

**Where the hint lives, and why.** #10827's carved test is _"would this field change if you deleted a
target from the project?"_ For a target descriptor the answer is trivially **yes**, which is exactly why
it may not be an IR field: an IR carrying it would make a program's bytes a function of the project's
target list, and the four-oracle byte-lock is the thing that pays for. The descriptor is a **parameter**
of `emitRustAt`, read by nothing but the emitter.

***

## Measured (not asserted)

### 1. The existing byte-lock did not move — proven, not assumed

`emitRustAt(ir, TARGET_RUST_PORTABLE)` is asserted **byte-identical** to the existing `emitRust(ir)` for
three IRs spanning both widths and three grammar generations:

| IR               | width | ops                          | byte-identical |
| ---------------- | ----- | ---------------------------- | -------------- |
| `rng.splitmix64` | 64    | `mul`, `xorshr` (v1)         | ✓              |
| `hash.fmix32`    | 32    | `mul`, `xorshr` (v1)         | ✓              |
| `test.rotl_add`  | 64    | `rotl`, `mul`, `add` (v2/v4) | ✓              |

**Be precise about what that guarantee is.** It is a **pin**, not an independent derivation: the L0
renderer is a template written to reproduce those bytes, and the test is what keeps it reproducing them.
Its value is the direction it fails in — edit either side and the two stop agreeing, by name, rather than
by nobody having looked. Mutation M2 below is that failure, observed.

No committed golden vector, `*.ir.json`, or `<lang>-output.json` file is touched by this change.

### 2. Both lanes compile, run, and agree — the executing falsifier

A text assertion passes happily on a program that does not compile; `codegen-from-ir.test.ts` corrected
exactly that defect in itself on 2026-08-15. So `bonsai-emit-lanes.ts` compiles and runs both lanes:

```text
arrest levels: idiomatic=L1 portable=L0
both lanes COMPILED and RAN
lane outputs are byte-identical (L1 === L0)
both lanes reproduce all 10 committed splitmix64 vectors
```

Raw exit code 0. The comparison target is `tests/cross-verification/splitmix64/rust-output.json` — the
**hand-written** port, whose `_source` differs by design and is the only excluded key.

### 3. Idiom, measured — three numbers, not a subset verdict

`cargo clippy -W clippy::pedantic -W clippy::nursery`, cache defeated by `touch`:

| lane                                                | findings | classes                                                            |
| --------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| generated, arrested **L0** (portable)               | **10**   | `format_push_string`, `missing_const_for_fn`, `unreadable_literal` |
| generated, arrested **L1** (idiomatic)              | **9**    | `missing_const_for_fn`, `unreadable_literal`                       |
| **hand-written control** (`splitmix64/_gen/gen.rs`) | **10**   | `format_push_string`, `missing_const_for_fn`, `unreadable_literal` |

The delta is exactly one class — `clippy::format_push_string` — and it is **attributable**, because both
lanes emit a byte-identical `mix` function by construction and a test asserts that. The only difference
between the two programs is the arrest level.

**#10827's warning about the bar, now a measured instance rather than a prediction.** It observed that
`lints(generated) ⊆ lints(hand-written)` is bounded by the control's cleanliness. On this corpus the bar
is not merely weak, it is **vacuous on the exact class the edge removes**: the hand-written control
carries `format_push_string` itself, so the L0 lane passes a subset bar while being no cleaner than the
human, and the L1 lane's genuine improvement is invisible to it. Three numbers say what one verdict
cannot: **the generated idiomatic lane is strictly cleaner than the human-written control.**

Honest limits on that result. It is **one class on one program** — `unreadable_literal` (8 of 9
remaining findings) is literal formatting and would be closed by a digit-grouping rule in the emitter,
not by an arrest; `missing_const_for_fn` is a property of `mix`, which this edge does not touch. And
clippy's finding counts move with clippy versions, which is why the lane script **reports** them and does
not gate on them — pinning a linter's count would be a byte-lock against a moving target.

### 4. Substrate agnostic — the Q#-shaped test

The sharp test is a target with an **empty** native set. Q# has never executed an op outside
`{mul, xorshr}` and its `IrOp` interface carries no `r`/`rs`/`ss` (#10822), so a design that needs the
target to have `map` has found a fact about the four von-Neumann lanes, not about the substrate.
`TARGET_FLOOR` declares `nativeFns: []`, still emits, arrests at L0, and produces bytes identical to the
Rust portable descriptor. Asserted, not argued.

**What this does not claim:** no Q# lane is emitted here. The test is that the _design_ survives an
empty descriptor, which is necessary and not sufficient for a Q# emitter to exist.

### 5. Mutation-proved

Each mutation applied to the emitter, both checks run, raw exit codes recorded, then restored:

| mutation                                                     | unit  | lanes | what named the failure                                                           |
| ------------------------------------------------------------ | ----- | ----- | -------------------------------------------------------------------------------- |
| baseline                                                     | **0** | **0** | —                                                                                |
| **M1** L1 renderer stops reading the separator from the tree | **1** | **1** | `lane "idiomatic (L1)": the program ran but wrote output that is NOT VALID JSON` |
| **M2** L0 template drops the opening brace                   | **1** | **1** | `emitRustAt(TARGET_RUST_PORTABLE) is byte-identical to emitRust` — all three IRs |
| **M3** `arrest` treats every `fn` as native (never lowers)   | **1** | **0** | `a descriptor with nothing native arrests at L0` + the three byte-lock rows      |
| restored                                                     | **0** | **0** | —                                                                                |

**M3 is the informative row.** Under M3 the portable lane also emits the iterator chain, which compiles
and computes the same answer — so the _behavioural_ check passes and only the _byte-lock_ check catches
it. The two instruments are complements, not substitutes: one measures what the program computes, the
other measures what it is allowed to look like.

***

## The parallel constraint, at the level it actually applies

### A correction, flagged: the `if` count was the wrong instrument

An earlier draft of this document framed the constraint as _"no branching `if`s"_ and cited **2401 `if`
occurrences in `src/Core/*.fs`** as evidence the codebase fails it. **That flag is withdrawn.** The count
is real, but it measures the **F# host implementation**, not the IR. Aaron's constraint is on **what the
IR spec permits**, and treating host-language branches as evidence about the spec is a category error.

Aaron's actual formulation (2026-08-15):

> _"the real goal is refusing non-composable control flow structures that trap you — that's
> capture/extraction shaped, we want mutual-empowerment-shaped on all our opcodes. If an 'if' can fit in
> that structure then so be it, but our ifs should never break massively parallel. We only want massively
> parallel algos in our IR. We can have specialization that optimizes for branching and CPUs for
> specialization, but **never in the spec itself**."_

Restated as three checkable rules:

1. **The spec admits only massively-parallel forms.** A conditional is permitted **iff it stays
   parallel**. This is not "eliminate conditionals."
2. **Branch-optimized, CPU-shaped lowering is legitimate — in specialization, never in the spec.**
3. **The razor is composability.** An opcode that traps the caller is capture/extraction-shaped; one
   that leaves the caller free to compose further is mutual-empowerment-shaped. Worth naming as
   **manifesto §3 weight-free applied at instruction semantics** — an existing discipline, not a new
   preference.

### The arrest ladder IS the spec/specialization split

The correction strengthens the design rather than invalidating it, and names what the two rungs are:

|                    | rung               | shape                                                           | who writes it                         |
| ------------------ | ------------------ | --------------------------------------------------------------- | ------------------------------------- |
| **spec**           | L1 — `map`, `join` | parallel: elementwise, and an associative (tree-reducible) fold | the **program**, authored             |
| **specialization** | L0 — `loop_accum`  | sequential accumulation, one `if`                               | the **lowering pass**, never authored |

So the sequential form is not a failure to meet the constraint — it is the constraint's _other half_,
sitting where Aaron puts it. `PARALLEL_FNS` names the authorable set and `assertParallelShaped` refuses
a program that names a sequential form directly, so the split is a **check** and not a convention.
Applied to every `fn` this edge introduces:

| `fn`         | shape                                             | authorable                |
| ------------ | ------------------------------------------------- | ------------------------- |
| `map`        | elementwise, no inter-element ordering            | ✓                         |
| `join`       | fold with an associative combine ⇒ tree-reducible | ✓                         |
| `row`, `mix` | pure elementwise leaves                           | ✓                         |
| `loop_accum` | **sequences**                                     | ✗ — lowering product only |

Nothing here sequences or short-circuits, and no `cond` node appears in the program. The emitted-`if`
counts are still asserted per lane (`L1 ifs=0`, `L0 ifs=1`) — but as a property of the **emitted
specialization**, which is the level at which an `if` is a legitimate thing to count.

### The finding: Bonsai's `Cond` has no agreed arm-evaluation semantics

The question — _is `Cond` predication or divergent control flow?_ — has an answer, and it is worth more
than the edge: **the format does not say, and the repo contains both readings, executing differently on
byte-identical wire bytes.**

First, the byte-lock oracles are silent. All four (`src/Core/Bonsai.fs`, `src/Core.TypeScript/bonsai/`,
`src/Core.CSharp.Bonsai/`, `src/Core.Rust.Bonsai/`) are **serializer-only** — `rg -i 'eval|interpret'`
finds nothing in the C# or Rust oracles. The byte-lock pins bytes and says nothing about evaluation.
Three evaluators exist, none of them one of the four:

| evaluator                                       | arm evaluation                                        | shape                       |
| ----------------------------------------------- | ----------------------------------------------------- | --------------------------- |
| `src/Core/BonsaiSoft.fs` `evalSoft`             | **BOTH** arms, blended by the test's truth-confidence | **predication** — permitted |
| `src/Core/Resume.fs` `Branch`                   | **ONE** — `Eval((if t then thenE else elseE), env)`   | short-circuit — divergent   |
| `src/Core.TypeScript/bonsai/resume.ts` `branch` | **ONE** — `expr: t ? top.then : top.els`              | short-circuit — divergent   |

`BonsaiSoft`'s header states its reading outright: _"`Cond` is evaluated **softly** — both branches are
evaluated and blended by the test's truth-confidence (no hard branch ⇒ branchless / shader-portable)"_,
and warns of the consequence: _"an error in the not-taken branch still propagates."_

**Executed, not inferred.** One expression, serialized once, fed to both:

```json
{
  "v": 1,
  "expr": {
    "kind": "cond",
    "test": { "kind": "const", "value": { "t": "bool", "v": true } },
    "then": { "kind": "const", "value": { "t": "int", "v": 1 } },
    "else": { "kind": "param", "name": "nope" }
  }
}
```

| evaluator                  | result                                                       |
| -------------------------- | ------------------------------------------------------------ |
| `resume.ts` (`start`)      | `{ok: true, value: {kind: "done", value: {t: "int", v: 1}}}` |
| `BonsaiSoft.evalSoft` (F#) | `Error "BonsaiSoft: unbound param 'nope'"`                   |

Same bytes, same node, opposite outcomes — one returns a value, the other refuses, because one arm is
evaluated in one and not in the other.

**This is not a bug in either.** Short-circuiting is _correct_ for `Resume`: an arm may contain an
activity `Call` with real side effects, and evaluating both would invoke an activity that must not run.
That is Aaron's layer split arriving on its own — **`Resume` is a specialization** (sequential,
side-effecting, CPU-shaped) and is right for that layer. The defect is that **the spec never said so**,
so nothing stops a reader taking `Resume`'s semantics as the meaning of the format.

### Aaron's ruling: label, do not choose

> **Aaron, 2026-08-15:** _"yes we just need to make sure everything is labeled honestly and able to be
> reasoned about in the domain in which it is active. Choose the right specialization for the job and
> make sure you don't use one assuming it's the other. In worst case we would need two specs."_

**A correction to my own framing, flagged.** I wrote above that "the _spec_ reading of `Cond` is
`BonsaiSoft`'s" and that short-circuit "belongs to specialization." **Withdrawn.** That was still
picking a winner, dressed as a layering argument. Both readings are legitimate and each is correct in
its own domain — short-circuit is not a lesser form of predication, it is the _required_ form where an
arm holds a side-effecting activity that must not run. There is no demotion to perform.

**So the defect is not disagreement — it is indistinguishability.** `Cond` is **one name for two
functions**, and nothing prevented a program authored under one from reaching the other. That is a known
failure class in this repo, not a novel one:

- `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`, the functional half — _"recognising
  sameness is not assigning identity — they are two different functions."_ Written after a distinctness
  **detector** was nearly repurposed as an identity **provider**. Same shape: two functions, one name,
  silent conflation, corrupted downstream state.
- **#10831** — "time-crystal" carrying four referents across five files: the vocabulary-level version.

### What was built, and the bar it had to clear

The bar was behavioural, not documentary: _can a program authored under one discipline be silently
evaluated under the other?_ Before: **yes**. Now, through the checked path: **it refuses, by name.**

`tests/cross-verification/_harness/bonsai-discipline.ts` does four things:

1. **Names the two disciplines** — `predicated` / `short-circuit` — with what each means.
2. **Registers each evaluator with the discipline it actually has** — and the registration is
   **verified by executing a discriminating probe**, never trusted. This is the load-bearing part: a
   label nothing checks is a comment.
3. **Decides statically whether a program's meaning depends on the discipline.** Most do not, and a
   guard that fires on those is noise — noise is how a guard gets switched off.
4. **Refuses the handoff** when a discipline-**sensitive** program authored under one discipline is
   aimed at an evaluator with the other.

**The labels are metered, not asserted.** `bonsai-discipline-probe.ts` runs `Cond(true, 1, Param "nope")`
through all three evaluators — TypeScript in-process, the two F# ones through the real built
`Zeta.Core.dll` via `dotnet fsi`, not a transcription — and fails if any registration disagrees with
observed behaviour. Executed, exit 0:

```text
BonsaiSoft.evalSoft    error BonsaiSoft: unbound param 'nope'   demonstrates predicated     registered predicated     OK
Resume.run             value 1                                  demonstrates short-circuit  registered short-circuit  OK
resume.ts start        value 1                                  demonstrates short-circuit  registered short-circuit  OK

discipline-sensitive: true ($.else free-param-in-arm)
REFUSED: DISCIPLINE SUBSTITUTION: … authored under `short-circuit` … aimed at `BonsaiSoft.evalSoft` … which is `predicated` …
same program → resume.ts start: ok=true (disciplines match)
a closed/total Cond → predicated evaluator: ok=true (program is not discipline-sensitive)
```

**Sensitivity is decided by the two causes that were _observed_ to differ**, not by speculation: a
`Call` in an arm (the untaken activity never runs under short-circuit; `BonsaiSoft` reaches it and
declines it) and a **free** param in an arm (the executed case). Conservative — it may over-report a
free param that is always bound in practice, and it does not under-report on those two. **Named gaps:**
an ill-typed `Binary` in an arm and arithmetic overflow are both real causes it cannot see, so
`sensitive: false` means _"not sensitive for the two causes checked."_

**Mutation-proved** (raw exit codes; `probe` = the cross-language script):

| mutation | unit | probe | named by |
| --- | --- | --- | --- |
| baseline | **0** | **0** | — |
| D1 guard never refuses | **1** | **1** | `a short-circuit-authored, discipline-sensitive program was ACCEPTED by the predicated evaluator` |
| D2 free-param blinded in the sensitivity analysis | **1** | **1** | the refusal rows plus `a free param in an arm is a cause` |
| D3 the registration lies (`BonsaiSoft` relabelled short-circuit) | **1** | **1** | `REGISTERED short-circuit but DEMONSTRATES predicated — the registration … must be corrected, not the evaluator` |
| restored | **0** | **0** | — |

D3 is the one that matters most: it proves the table cannot quietly go stale, because execution refutes
it.

### What this deliberately does not do

- **It does not move the wire format.** The program↔discipline pairing is a **sidecar**; `serialize`
  produces byte-identical bytes with or without it, asserted in the tests. Carrying the discipline _in_
  the bytes may well be the cleaner end state — it is a property of the program, not of a target, so
  #10827's carved test does not exclude it — but **that is a format change, and a format change is
  gated.** Written up, not landed. This is the "two specs" outcome Aaron sanctioned as
  worst-case-acceptable, and it is available if the sidecar proves too weak.
- **It does not intercept a direct call.** Nothing stops calling `BonsaiSoft.evalSoft` on a
  short-circuit program without going through `checkHandoff`. This guards the checked path and makes
  the unchecked one **nameable**; it is not a sandbox, and calling it one would be the vacuity class.
- **It does not touch the evaluators.** Making them agree would silently pick a reading — ruled out
  explicitly. `BonsaiSoft.fs`, `Resume.fs`, and `resume.ts` are read-only here; a sibling agent holds
  that seam.

***

## Aaron's standing constraints for a v5, **if** one ever happens

Recorded here, dated and attributed, because it currently lives only in a transcript — and **an insight
that lived in one transcript degraded to a wrong recollection in two days** on 2026-08-15 (#10821). A
future agent proposing v5 should inherit these rather than rediscover them.

> **Aaron, 2026-08-15:** _"take all the design goals and include it in v5 if we need a v5"_

The design goals, as given:

1. **Substrate agnostic** — it must work on the exotic target, not only on the four von-Neumann lanes.
   The Q# lane is the test that discriminates.
2. **Minimal instruction set.**
3. **No control logic.**
4. **As parallel as possible.**
5. **No branching `if`s — composable discriminated unions instead.**

**Read #5 through Aaron's own sharpening the same day**, or it will be mis-inherited exactly as it was
mis-inherited into the brief this document answers:

> **Aaron, 2026-08-15:** _"the real goal is refusing non-composable control flow structures that trap
> you — that's capture/extraction shaped, we want mutual-empowerment-shaped on all our opcodes. If an
> 'if' can fit in that structure then so be it, but our ifs should never break massively parallel. We
> only want massively parallel algos in our IR. We can have specialization that optimizes for branching
> and CPUs for specialization, but never in the spec itself."_

So #5 is **not** "eliminate conditionals," and #3 is **not** "no conditionals at any layer." Both are
one rule at one level: **the spec admits only massively-parallel, composable forms; branch- and
CPU-optimized forms are legitimate and belong to specialization.** A v5 proposal that counts `if`s in
the host implementation has measured the wrong thing (see the correction above). The test to apply to a
proposed opcode is: _does it leave the caller free to compose further, and does it stay parallel?_

Two standing facts that travel with them:

- Aaron is **happy with the current op set** (2026-08-15). #10822 priced a v5 for the ops and
  recommended against it. A v5 proposal therefore starts from _"what does the current op set fail to
  express"_, not from _"what would be nicer"_.
- **Language-specific hints may not live in the IR** at any version (#10827). The carved test is
  _"would this field change if you deleted a target from the project?"_ — yes ⇒ target descriptor.
  A v5 that adds a hints field has not solved the problem, it has moved the fork into the wire format.

***

## What this is, in register

**Metered.** The three-IR byte-identity assertion; the compile-and-run agreement of both lanes against
the ten committed splitmix64 vectors; the three clippy counts (command in `bonsai-emit-lanes.ts`,
re-runnable and disagreeable-with); the three mutations with raw exit codes; the emitted-`if` counts;
**the `Cond` arm-evaluation divergence** — one serialized expression, two evaluators run, opposite
results printed.

**Unmetered.** That the arrest generalises past `map`/`join`. Exactly one lowering rule exists
(`join∘map → loop_accum`) and it is guarded to that shape; the second rule is not written, so
"the ladder works" is an implemented-and-used claim with no falsifier yet. Also unmetered: the
parallel-shape claim for `map`/`join` is argued from their algebra (elementwise; associative combine)
and asserted as a name-set membership check — **no test executes them in parallel**, so
`assertParallelShaped` proves a program does not _name_ a sequential form, not that the named forms
_are_ parallel.

**Toy.** That this is the right factoring for a _general_ Bonsai→N-language backend. One edge on one
target is an existence proof, not a design validation. The honest next falsifier is a **second target
that arrests at a different rung** — that is what would show the descriptor is carrying the variation
rather than the two hand-written templates carrying it.

***

## Owned errors

1. **I wrote a measurement that could not fail, and the number is what caught it.** The clippy helper in
   `bonsai-emit-lanes.ts` read `execFileSync`'s **stdout**; clippy writes diagnostics to **stderr** and
   exits 0 when they are warnings. It printed `0 findings / 0 classes` for three crates I had already
   measured by hand as 10 / 9 / 10. A clean-looking zero from a check that never ran — the exact trap on
   the brief, walked into. Fixed with `spawnSync` + stderr, and the function now **throws** on a
   findingless, progress-output-less run rather than reporting a zero.
2. **The floor bug.** `arrest` required a target to declare `loop_accum` native, which made
   `TARGET_FLOOR` — the whole substrate-agnosticism claim — throw. Caught by the empty-descriptor test
   on first run, not by writing the code carefully.
3. **A test that reimplemented its subject.** My first separator test called a local "probe" that
   re-derived the renderer's behaviour, so it would have passed against a renderer that ignores the
   tree. Replaced with a call to the real `renderRustAssembly`, plus a negative assertion that the
   original separator is **gone** — which is what makes it non-vacuous.
4. **I read a `| tail`'d command's exit code once** (`bun … | tail` printed a thrown error at
   `EXIT=0`). Every exit code in this document is raw.
5. **I stated the parallel constraint at the wrong level, and wrote a section around it.** The first
   draft of this document argued branch-freeness from a count of `if`s in the F# host — a category
   error, since the constraint governs what the _IR spec_ permits, not how the host is written. Aaron's
   sharpening arrived mid-task and the section was replaced. The instructive part is that the wrong
   framing _looked_ rigorous: it had a number in it. A number measured at the wrong level is not
   evidence, and this one nearly became a durable claim in the repo.

***

## What remains — precisely

The edge exists; the ladder does not. In dependency order:

1. **A second lowering rule.** One rule is one data point. `map` alone (without `join`) has no rule, so
   a target declaring `join` but not `map` is refused rather than lowered.
2. **A second target arresting at a different rung.** The strongest falsifier of the factoring, and the
   one that would show the descriptor rather than the templates is carrying the variation. F# and C#
   both have combinator forms; Go does not, which makes Go the useful third.
3. **A Q# emitter, or a written refusal.** `TARGET_FLOOR` proves the design tolerates an empty
   descriptor. It does not produce Q#. Either the Q# lane gets an assembly program or the reason it
   cannot is written down.
4. **The discipline guard on the UNCHECKED path.** `checkHandoff` guards call sites that use it;
   nothing stops a direct `BonsaiSoft.evalSoft` call on a short-circuit program. Closing that needs
   either the discipline in the bytes (a gated format change) or a lint that finds direct evaluator
   call sites — neither landed here.
5. **A parallel-shape check with teeth.** `assertParallelShaped` is a name-set membership test. It
   cannot tell that a _newly added_ `fn` is parallel; someone must decide and add the name. The honest
   upgrade is a property the checker can verify (associativity of a fold's combine, under a
   generator), not a longer list.
6. **Digit grouping in the numeric emitters.** 8 of the 9 remaining L1 findings are
   `unreadable_literal`. Purely mechanical, unrelated to the arrest, and it would move the byte-lock —
   so it is a deliberate non-goal here, named so nobody reads its absence as an oversight.

***

## Overlaps reported, not edited

- **#10827** (the finding this implements) — still open. This is its executable half. If it merges after
  this, nothing conflicts; the doc adds no claim that contradicts it.
- **#10822** (`ZetaIr*` irreducible core) and **#10807** (canonical evaluator) — no `src/Core/ZetaIr*.fs`
  file is touched.
- **`src/Core/Bonsai.fs`** — **contended, and not edited.** The `reify` inverse lives there. This edge
  imports the **TypeScript** oracle (`src/Core.TypeScript/bonsai/`) read-only and adds nothing to either.
- **`src/Core/BonsaiSoft.fs`, `src/Core/Resume.fs`, `src/Core.TypeScript/bonsai/resume.ts`** — read to
  establish the `Cond` finding, **not edited**. Anyone holding those files should read the `Cond`
  section before changing arm evaluation on either side; a "fix" that makes them agree silently picks
  the spec, which is the gated call.
- **VISION / roadmap (#10826)** — this change is consistent with "no v5, no new format". A roadmap row
  promising "IR v5 with language hints" contradicts #10827 and this; one of us should be wrong on
  purpose rather than by accident. No roadmap or vision file is edited here.

***

## Anchors (checked, not merely cited)

- **Nanopass** — Sarkar, Waddell & Dybvig, _A Nanopass Infrastructure for Compiler Education_, ICFP 2004.
  Checked for entailment: the paper's claim is that a compiler is better built as many small passes over
  slightly-different IRs than as a few large ones. `arrest` is one such pass — a source-to-source rewrite
  within one grammar. What the paper does **not** supply is the arrest-at-target-capability idea; that is
  not attributed to it.
- **Nuqleon Bonsai / Reaqtor** — the named lineage of the serializer itself (`src/Core/Bonsai.fs` header:
  the weakly-typed, reflection-info-omitted mode). Cited for provenance of the format, not for the edge.
- **Predication vs divergent control flow** — the distinction used in the `Cond` finding is standard and
  is not a coinage: `where`/masking in array languages (APL/NumPy lineage) and predication under SIMT
  execution, where a divergent branch serializes the warp while a predicated one does not. Cited for the
  distinction only; no performance claim about any Zeta target is made from it.
- **Not claimed as an anchor:** nothing here is Futamura. The `gen(gen)=gen` trajectory is adjacent and
  this change does not advance it.

***

## Files

- `tests/cross-verification/_harness/bonsai-emit.ts` — the edge: program, descriptors, `arrest`, renderer.
- `tests/cross-verification/_harness/bonsai-emit.test.ts` — 19 falsifiers (CI-gated by `bun test`).
- `tests/cross-verification/_harness/bonsai-emit-lanes.ts` — the executing check; `--clippy` for the
  three numbers. Manual, because it needs a Rust toolchain.
- `tests/cross-verification/_harness/codegen-from-ir.ts` — **export-only change**: `renderOps` exported
  and the Rust op fragments extracted verbatim to `RUST_OP_RENDERER`, so both arrest lanes emit a
  byte-identical `mix`. No emitted byte changes; the three byte-identity rows are the proof.
