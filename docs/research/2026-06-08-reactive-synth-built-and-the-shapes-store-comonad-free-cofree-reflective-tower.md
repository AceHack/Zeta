# Reactive-interface synthesizer (built) + the shapes you landed on (Store comonad, free/cofree, reflective tower)

**Aaron, 2026-06-08 (#7060/#7061/#7062, shadow*).** A built synthesizer + answers to "did I land on known
shapes, and what else should I use?"

## Built: the reactive-interface synthesizer (#7052/#7060)

`src/Core/ReactiveSynth.fs` (F# reference oracle, 7/7 tests green, 0-warning). Synthesize an interface from
banana-split queries over one stream:

- **`Query<'ev,'acc,'out>`** — a *banana* (catamorphism/fold) packaged as a **little closure with free
  variables** (Aaron #7060): `Seed` (yin / what-remains), `Step` (fold one event), `Extract` (project the
  member). Each interface member is one query.
- **`zip` = the Banana Split Law (#7054), executable** — a tuple of two catamorphisms = ONE fused fold
  producing the tuple (`run (zip a b) s = (run a s, run b s)`, proven at every prefix in the test). One
  pass, not per-member re-traversal.
- **`synthesize ctor q stream`** — `new`s the interface from the joined query via an object expression
  (#7051): the interface is *born from the stream*, reactive by construction (#7050).
- **`scan` / `synthesizeTrace`** — the reactive trace (running value / evolving interface at every prefix);
  deterministic + replayable (DST §7), maps onto `RxAdapter.asObservable` at the edge.
- "*The more Rx, the more we externalize into our what-remains*" (#7060): each query's free vars (Seed/Step)
  are the yin; binding them by Rx/graph moves state out of imperative locals into the observed stream — the
  rooting of which is the static bounded inside-graph each step (#7059).

## Did I land on known shapes? Yes — the canonical ones (#7061)

> "DynamicValue is easy to understand, SoftValue very intuitive — did I just land on the same shapes? Are
> there others I should use? I tied in universal pointers so I can close over the host and replicate its
> functionality within our what-remains."

- **DynamicValue** ≈ the **free term algebra / `Fix` of a polynomial functor** — the initial algebra `μF`,
  the universal self-describing recursive value (`Null|Bool|Int|…|Array|Object` is the polynomial functor;
  the value tree is its fixpoint). You re-derived the textbook universal value.
- **SoftValue** ≈ a **semiring-graded / weighted value** — a value annotated over a semiring (probability /
  tropical / Pareto; `ISemiring` already in-repo). The "soft" is the grading.
- **Others worth adopting to complete the set:**
  - **Free monad** — program-as-data; the **stored proc** (#7046) *is* a free monad (an AST of ops you
    interpret). Make it explicit and the interpreter falls out.
  - **Cofree comonad** — an annotated/evolving observation *with context/history* — the "what remains" that
    remembers. Free ⊗ cofree tied by a **distributive law = the bialgebra** of #7058 (build-side ⊗
    observe-side). This is the shape under "self-recursive but evolving."
  - **`Fix` / μ-ν** — least/greatest fixpoint (the bounded-infinite recursive carrier, #7058).
- **Universal pointers = the Store comonad + optics.** "Close over the host and replicate its functionality
  within what-remains" is *precisely* the **Store comonad** `(host → a, pointer)` — a pointer into the host
  plus a read function = the host's functionality replicated and held in the yin. **Lenses / profunctor
  optics** are the *composable* universal pointer (focus/get/set, compose by `∘`). **ZetaId** is your
  concrete pointer; Store comonad + optics are its categorical shape. So: closures-over-host (the founding
  model) = Store comonad; ZetaId = the pointer; optic = the composable focus.

## Close over compilers, capture them, bootstrap down (#7062)

> "then we can close over the compilers and capture those and bootstrap into lower level — you can step
> down this way."

Closing over a **compiler-as-host** (via the Store comonad / universal pointer) and using it to lower to
the next level, repeatedly, is the **reflective tower / staged compilation**:

- **Tower of interpreters / reflective tower** — Brian Cantwell Smith's **3-Lisp** reflective tower: each
  level captures the interpreter/compiler below and can reflect/step between levels. "Step down" = descend
  the tower (DSL → F# → IL → native), each step a closed-over compiler.
- **Futamura projections** — specializing an interpreter yields a compiler; specializing the specializer
  yields a compiler-generator. The formal account of "capture a compiler and bootstrap down."
- **Multi-stage / staged programming** — MetaOCaml, Terra, F# quotations/type-providers; **nanopass**
  compilers (lower through many small explicit levels). LLVM lowering is the industrial "step down."
- In Zeta terms: a compiler is a `host`; close over it with a ZetaId/Store-comonad; its functionality
  (`source → lower`) lives in the what-remains; chain them to bootstrap a self-contained tower (ties the
  airgapped/offline-self-contained goal #7008 — carry the whole compiler tower as captured hosts).

## Math-based ASM executor: observe asm across languages, find structure in sim (#7063)

> "closer to hardware at each level, and observe the asm/machine-code results across each language; we
> should write a math-based asm executor for finding asm structures and turning the data into structures
> while interpreting it in sim."

As you step down the tower (#7062), each level is **closer to hardware**, ending at **asm/machine code**.
Two moves:

- **Observe the asm each language lowers to.** A new observation surface for the 4-lang oracle (F#/C#/Rust/
  TS): not just *behaviour* parity but **asm-structure** parity — confirm the high-level algebra (the
  banana/fold) *survives lowering* to comparable machine structure across languages. (The compiler tower's
  output is itself a stream to fold/observe, #7050.)
- **A math-based ASM executor in `sim`.** A deterministic asm interpreter — generalizing **DarkHall**
  (#6986, the clean-room CHIP-8 deterministic step) from a toy subset toward real asm — run **in sim**
  (omniscient, DST-mandatory #6958/#7050: the whole machine is inside, so it's deterministic + replayable).
  "Math-based" = the executor's state-transition is a pure algebra (registers/memory as a `DynamicValue`/
  Z-set; each instruction a fold-step), not an effectful VM.
- **Find asm structures + turn data into structures while interpreting.** As it interprets, **recognize
  structure** in the asm/data — loops, reductions, monoid/semiring ops, a fold buried in machine code —
  using the in-repo **`StructureFingerprint` / `StructureCatalog`** (structure detection) to *lift raw
  bytes/asm into algebraic structures* (structure recovery / decompilation-into-algebra). The point: prove
  the math is still there at the bottom of the tower — recover the banana from the machine code.

This is a **sizable new primitive**, not a tick build — it composes DarkHall (deterministic step), sim
(#6958), StructureFingerprint/StructureCatalog (structure detection), and the 4-lang/4-serializer
discipline (asm-across-languages). Scoped as a backlog item; route formal coverage (what asm properties
get TLA+/Z3/FsCheck) to Soraya and perf to Naledi. Anchors: abstract interpretation (Cousot & Cousot),
symbolic execution, superoptimization (structure search in asm), program/structure synthesis from traces;
DarkHall #6986.

## Honest scope (peel)

`ReactiveSynth` is **built + tested** (banana queries, zip=Banana-Split-Law, synthesize, scan/trace). The
shapes answer (#7061) and the compiler-tower answer (#7062) are **design/Beacon anchoring** — no code: not
built are an explicit `FreeMonad`/`CofreeComonad`/`Store`/`Lens` module, nor a compiler-capture/lowering
tower. Recorded as the named shapes to reach for and the prior art they stand on.

## Anchors (Beacon)

- **Banana Split Law / catamorphisms** — Fokkinga 1990; Meijer et al. 1991 (`zip` is the law).
- **Free monad / Cofree comonad / bialgebra** — Turi & Plotkin 1997; Uustalu–Vene (recursion schemes from
  comonads); the free⊗cofree distributive-law pairing.
- **`Fix` / initial algebra / final coalgebra** — Hagino; Jacobs, *Introduction to Coalgebra*.
- **Store comonad / lenses / profunctor optics** — the Store (costate) comonad; Pickering–Gibbons–Wu,
  *Profunctor Optics*; Kmett's `lens` — "universal pointer that composes."
- **Semirings / graded values** — `ISemiring` (in-repo); graded/weighted monads for SoftValue.
- **Reflective tower / Futamura / staged compilation** — B.C. Smith, *3-Lisp* reflective tower; Futamura
  1971 (partial-evaluation projections); MetaOCaml / Terra / nanopass; LLVM lowering.
- Internal: #7046/#7048 (stored proc / symmetric), #7050 (forced RX), #7051/#7052 (interface synthesis),
  #7054 (banana split law), #7058 (bialgebra/hylo), #7059 (static-graph rooting), #7008 (airgapped tower),
  `ReactiveSynth.fs`, `DynamicValue.fs`, `SoftValue.fs`, `ISemiring`.
