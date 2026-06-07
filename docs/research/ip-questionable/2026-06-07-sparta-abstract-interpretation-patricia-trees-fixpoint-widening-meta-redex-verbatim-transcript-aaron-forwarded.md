# Sparta — "Making Abstract Interpretation Easy" (Meta / ReDex; Jezz & Arnaud) — verbatim transcript (Aaron-forwarded)

**Source:** <https://www.youtube.com/watch?v=_fA7vkVJhF8> (Meta's Sparta abstract-interpretation library;
ReDex Android optimizer).
**IP status:** auto-caption transcript of a third-party talk — DO NOT republish externally (folder README).
Substrate value is the framework-composition analysis below.

> Aaron 2026-06-07: *"this is our nod … relevant."*

## Framework-composition analysis (what this means for Zeta)

Two pieces land directly on Zeta: **Patricia trees** (persistent maps — our COW/structural-sharing family)
and **lattice fixed-point + widening** (the theory under DBSP's fixpoint iteration + our convergence work).

- **Patricia trees = the integer-keyed persistent-map cousin of our HAMT.** Immutable, structural sharing:
  to change one binding you allocate only the spine (gray nodes), share the rest → "copying is effectively
  free; modify is O(bindings on the path)." Sparta swapped a hash table → Patricia tree behind a clean
  abstraction in **4 lines** for a **90% memory / 60% time** reduction. This is exactly our
  `ContentStore`/`DagFs` (`ImmutableDictionary` = HAMT) + `ZSet`/`IndexedZSet` story; **Patricia (Okasaki &
  Gill, "Fast Mergeable Integer Maps") is the right structure for our INT-keyed maps** (register/index/seq
  keyed) where HAMT is the general-key choice. A candidate for `IndexedZSet`/seq-keyed state.
- **Abstract interpretation = lattice + fixed-point + widening — the theory under DBSP.** DBSP's "iterate
  to a fixed point" (`Circuit/Incremental`, `RecursiveSemiNaive`) **is** a monotone fixpoint over a lattice
  (Z-sets under union/order). Abstract interpretation generalizes it: abstract domains (sign, interval),
  ⊤ ("no idea") / ⊥ ("no value" = dead code / empty Z-set), and **widening** = big lattice jumps to force
  termination on tall/infinite lattices, then **narrowing** to recover precision. Directly relevant if we
  do static analysis over our circuits, and a sharpening of how our recursive/semi-naive eval converges.
- **Bourdoncle WTO (weak topological ordering)** — recursive SCC decomposition so you iterate innermost
  loops to fixpoint first, then outer, instead of re-analyzing the whole method. **The right scheduling for
  DBSP recursive eval** (`RecursiveSemiNaive`) + circuit fixpoint ordering; Sparta even parallelizes per-loop
  (our scale-free/DoP-knob stance).
- **Generic graph + pluggable interface + one fixed-point engine** — Sparta's `Program` interface is just a
  graph; swap a CFG for a call graph and the same engine gives interprocedural analysis. That's our
  hexagonal/plugin pattern (one engine over a pluggable graph) = the circuit-over-streams shape.
- **⊥ = unreachable / dead code; ⊤ = unknown** — maps onto our empty-Z-set (no support) and the
  soft/uncertain value (everything possible). Belief-convergence / SoftValue is a lattice join to a fixpoint.

Net: Patricia trees join HAMT/RRB/Jumprope/Hitchhiker as a persistent-structure anchor (the int-keyed one),
and abstract interpretation names the lattice-fixpoint-widening theory our DBSP fixpoint + convergence work
already lives in.

## Beacon anchors

- **Abstract interpretation** — Patrick & Radhia Cousot (POPL 1977); widening/narrowing. · **Patricia
  trees** — Okasaki & Gill, *Fast Mergeable Integer Maps* (1998); Morrison PATRICIA (1968). · **Bourdoncle**
  — *Efficient chaotic iteration strategies with widenings* (WTO, 1993). · **Sparta** / **ReDex** (Meta).
  · Tarjan SCC. Ties: `ImmutableDictionary`/HAMT (the persistent-map family), `ZSet`/`IndexedZSet`,
  `Circuit/Incremental` + `RecursiveSemiNaive` (DBSP fixpoint), BeliefConvergence/SoftValue (lattice join),
  the HAMT/RRB/Jumprope/Hitchhiker prior-art notes.

---

## Verbatim transcript (lightly cleaned from auto-captions; Aaron-forwarded 2026-06-07)

[Meta] We've been working on bytecode optimization for ~3 years using abstract interpretation extensively.
I manage the compilers team — we build compiler tool chains; in particular the optimizer **ReDex**, which
takes Android Dex bytecode and makes it smaller and faster. Optimizing = make a program smaller/faster
while preserving observable behavior; to do that you need a model of its behavior — that's where abstract
interpretation comes in.

Semantics = the behaviors a program exhibits; we want to model all of them, but we can't simulate every
execution (Turing-complete). So we map **concrete values** (integers) to more general **abstract values**
(intervals), representing many concrete states with one abstract state, then simulate execution in an
interpreter over abstract values **until we reach a fixed point**.

**Sign domain** example: answers "does this function always return > 0? ever null?" Each abstract element
represents one-or-more concrete values; some elements are *more general* (≥0 covers both 0 and >0), drawn
higher in the lattice. Every domain has a **⊤** (encompasses all values — "no idea what it holds") and **⊥**
(no possible value — arises in **dead-code detection**: a never-executed block assigns no values). Stepping
through code: `a=0` → {0}; `b=1` → ">0" (no exact-1 element, use the next best); inside an `if`, `b=0`; after
the `if`, b is the most general value covering both branches (≥0). Loops: `a=0` → [0,0]; +1 → [1,1]; back at
the loop head a = [0,1] (covers prior + body); repeat → [0,2] … eventually [0,9]; in the body a stays [0,8]
(entered only when a<9); next time at the head a is unchanged → **fixed point**, analysis done.

**Making it fast.** Classic dataflow re-iterates *all* basic blocks on any change — inefficient. Instead
iterate **innermost loops to fixpoint first**, then outer, then the method — decompose the CFG into loops
via **Bourdoncle's algorithm** (recursive SCC: collapse each small SCC to a node, find the next-larger SCC
containing it). Sparta also has a **parallel** implementation (analyze independent loops in parallel).

**Patricia trees.** At a fixpoint you must store program state at every basic block — expensive (many
blocks, large programs). Hash tables copy the whole table per block; but most states are *similar* (each
block touches 2–3 of dozens/hundreds of variables). So store only the **differences** using immutable
**Patricia trees** (integer keys → any value; here register# → value). To rebind key 5 from "foo" to "bar",
allocate only the spine nodes (gray); share the rest. **Copying is effectively free if unmodified; modify is
O(bindings on the path).** Not every app is big enough — small apps may prefer hash tables — but Sparta
makes switching trivial (clean abstractions). ReDex's register allocator: a hash table was faster for
liveness at first; a year later (app growth) the Patricia tree won — the switch was **4 lines**, giving a
**90% memory / 60% runtime** reduction.

**Widening.** A loop with a huge bound can't be iterated to a fixpoint cheaply (the interval lattice is
infinite). Abstract interpretation lets you take **big strides**: when convergence stalls, **widen** (e.g.
jump to ⊤); the theory guarantees that after a *finite* sequence of widenings you reach a (post-)fixpoint.
⊤ is imprecise, but you then recover precision by re-analyzing (a form of **narrowing**): re-enter the loop
knowing a<99, and the theory says the result is still a sound over-approximation, converging to the precise
set after finitely many steps. (Narrowing is more complex/costly; not yet in Sparta then, planned.)

**Using Sparta.** Encode the sign lattice: define an enum of symbols, then declare the partial order
(edges: ⊥ < {<0,0,>0} < {≤0,≥0} < ⊤, etc.) declaratively; Sparta builds an efficient **bit-vector**
representation and **verifies the lattice axioms** (you can't define an invalid lattice — you get an error).
Wrap it via `FiniteAbstractDomain`. Program *state* = variables → signs: an abstract **environment** mapping
variables to the sign domain, built with a hash table or **Patricia tree** map. To run an analysis: provide
a `Program` interface — a generic **control-flow graph** (nodes + edges); Sparta is independent of the
analyzed language (bridge the interface to Dex bytecode / an AST / LLVM IR). Then instantiate the
**fixed-point iterator** and implement `analyze_node` (statement/block semantics — e.g. `v = 0` sets v to
EqualZero) and `analyze_edge` (branch semantics — e.g. on `v > 0`, **meet** v's sign with >0; if it meets to
⊥ the branch is unreachable → dead code). Because `Program` is just a graph, **swap a CFG for a call graph**
and the same engine gives **interprocedural** analysis (Sparta implements interprocedural constant
propagation this way). On GitHub: facebook/SPARTA and facebook/redex.
