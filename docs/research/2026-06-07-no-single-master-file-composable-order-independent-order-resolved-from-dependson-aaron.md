# No single master file needed — composable + order-independent; order resolved from `dependson` (Aaron, 2026-06-07)

Refines "one infinite/master file" (#6969/#6972/#6973). Aaron:

> *"we don't have to have one master file — it can be composable and not order-dependent, because order can also
> be resolved based on dependson."*

## The sharpening (Aaron, cont.): tiny files, one per dep — an infinite ASSEMBLY over time, not one file

> Aaron: *"you can write it in multiple files so each dependency declares its own dependencies … so tiny files …
> per dep … instead of one infinite file, it's an infinite assembly over time."*

The crisp form:

- **One tiny `.ace` file per dependency.** Each dep is its own small file that declares **its own `dependson`**
  (#6971). A dep = a node = a tiny file; the node owns its out-edges. (Same discipline as the memory
  one-fact-per-file / carved-sentence rule, and DV2.0 partition-by-unit — small, single-purpose, composable.)
- **"Infinite file" was the wrong word — it's an infinite ASSEMBLY over time.** Not a monolithic growing file
  (#6969 corrected): an **assembly** of tiny per-dep units, *assembled* (composed, order-free) and **accreting
  over time** (the temporal index alpha→omega, #6973; each tiny file added = one act/change, #6936/#6965;
  event-sourced). "Assembly" carries both senses: the *act* of assembling many parts, and the *assembled whole*
  (the temple of everything, #6972, as a composition — never a single file).
- **Locality of declaration.** Because each dep declares its own deps in its own file, the graph is **maximally
  local + composable**: add/remove a dep = add/remove one tiny file; the edges live with the node, not in a
  central manifest. No master file to edit; the assembly re-derives.

So: **the temple of everything (#6972) = an infinite assembly of tiny per-dep files, each owning its `dependson`,
composed order-free, accreting over time.** Not a file — an assembly.

## The kernel: one graph (logically), many files (physically), zero ordering (derived)

The "temple of everything" / infinite file (#6969/#6972) is **one graph logically — but not one physical file**:

- **Composable.** The graph is assembled from **many `.ace` files** (seams-are-Ace-files #6961; each repo's own
  registry #6974) — compose them, no monolith. The "one infinite file" (#6969) is the *logical union*, not a
  single artifact on disk (the honest reading already noted there).
- **Order-independent.** The files — and the statements within them — can appear in **any order**. Nothing
  depends on file order or line order.
- **Order is RESOLVED from `dependson` (#6971).** Execution order is a **topological sort of the dependency
  graph**, derived from the `dependson` edges — not from how the text is arranged. You declare *what depends on
  what*; the runtime computes *when to run what*.

So it's the full declarative property: **state the edges (dependson), the system derives the order.** No master
file to maintain, no "put this before that" — composability + dependson = order falls out.

## Why order-independence is the same property as CRDT/idempotent (it composes safely)

- **Order-free ⇒ commutative ⇒ composes conflict-free.** If the result doesn't depend on order (because order
  is derived from dependson, not arrangement), then composing files/statements is **commutative** — the same
  shape as CRDT convergence (#6964 no-operators) and idempotent `ensure` (#6959). Merge two `.ace` files in
  either order → same graph → same topo-order → same result. This is *why* you can drop the master file: the
  pieces commute.
- **It's declarative, like the build tools.** make/Bazel/Nix never need a "master ordered file" — you declare
  targets + prerequisites and the tool topo-sorts. Ace is that: `dependson` = prerequisites; topo-sort = the
  plan. (Cycles: real `dependson` cycles need fixpoint handling — the graph is *cyclic* #6969, so it's
  topo-sort over SCCs / fixpoint iteration #6974, not a strict DAG sort. Honest: cyclic deps resolve by
  fixpoint, acyclic by topo-sort.)
- **Composes with the resolve.** Order-from-dependson feeds the bounded lockfile resolve (#6974, iterate over
  template ∩ niches) and the carve (#6972): you compose niches in any order, the dependson graph determines
  execution + the intersection resolution.

## Honest scope / peel

- **Refines #6969/#6972/#6973**: "one infinite/master file" is the *logical graph*; physically it's
  **composable, order-independent shards**, order derived from dependson. (Peel any literal "one big ordered
  file" reading — there isn't one, and there doesn't need to be.)
- **Order-independence requires the statements actually be order-free** — i.e. idempotent (#6959) and their only
  ordering constraints expressed as `dependson`. A statement with a hidden, undeclared ordering dependency breaks
  it (just as a non-hermetic build step breaks reproducibility, #6960). The discipline: *all* real ordering must
  be a declared `dependson` edge; nothing relies on text order.
- **Cycles aren't a strict topo-sort** — the graph is cyclic (#6969), so order resolution is fixpoint over SCCs,
  not a pure DAG sort; for non-idempotent effectful cycles you need the DU/saga (#6959). Don't overclaim "just
  topo-sort everything."

## Ties

- **dependson edges (#6971)** — the edges order is derived from; nodes compose order-free.
- **One infinite file / temple (#6969/#6972) + alpha/omega master (#6973)** — logical graph; this says physical
  form is composable shards, no single master file.
- **Seams-are-Ace-files / composable (#6961)** — composition is the model; per-repo registries (#6974) compose.
- **CRDT / no-operators (#6964) + idempotent ensure (#6959)** — order-free = commutative = conflict-free compose.
- **Bounded lockfile resolve (#6974)** — compose in any order; dependson gives execution order + the intersection
  to resolve.

## Beacon anchors

- **Topological sort** (Kahn 1962) over the dependency graph — order derived from edges. · **Declarative build
  ordering** (make targets+prerequisites; **Bazel** / **Nix** — no master ordered file, the graph orders
  itself). · **CRDT commutativity / order-independence** (Shapiro et al. — composes regardless of order) +
  idempotency (#6959). · **Strongly-connected components / fixpoint over cycles** (Tarjan) — for the cyclic case
  (#6969/#6974). Honest novelty: none — it refines the "one file" model: the graph is **composable
  (many `.ace` shards) and order-independent**, with execution order **resolved from `dependson`** (topo-sort,
  or fixpoint over cycles) — declarative ordering, the same commutativity that makes idempotent/CRDT composition
  safe; no single master file required.
