# The full dependency graph is ONE constructable `.zeta` file (temple of everything) — defined, not calculated; installs carve a static subset (Aaron, 2026-06-07)

The capstone of the dependency/Ace arc (#6940/#6959/#6960/#6971). Aaron:

> *"the full graph of all deps should be a constructable .ace / .zeta file with all dependson, and then the
> graph is DEFINED not CALCULATED based on desired state — a temple of everything — and you carve out niches and
> can install a subset of everything, because the full graph is known statically."*

## The inversion: dependencies are DEFINED (a static graph), not SOLVED (a per-install computation)

Conventional package managers **calculate** the dependency graph at install time — a SAT/PubGrub *solve* per
install (npm/cargo/pip), which is slow, can fail, and discovers conflicts only when you try. Zeta inverts it:

- **The full graph of all `dependson` edges (#6971) is ONE constructable `.zeta`/`.ace` file** — the "**temple
  of everything**": every package/dep/version and every edge, *defined as data* (the infinite file, #6969;
  the n-dimensional dependency space, 081KSGS9H0008QG0R0031PBNGA, made explicit). The whole graph is **known statically.**
- **Defined, not calculated.** You don't *solve* the graph at install; it's *already there*. Desired-state: you
  state your roots, and the answer is a **lookup into the defined graph**, not a search. (Nixpkgs is the closest
  existing thing — one giant *defined* expression graph; Zeta generalizes it to all ecosystems.)
- **Installs = carving a niche = a static subgraph.** "Install a subset of everything" = take the **reachable
  subgraph** from your desired roots in the known full graph — a *slice/reachability*, not a solve. The full
  graph is the superset; any environment is a deterministic sub-selection of it (Bazel: one static build graph,
  build any target = its reachable subgraph).

## Why this is powerful (what static-known buys)

- **Conflicts are known statically (strengthens #6940).** Because the *whole* graph is defined, version/lib
  conflicts are visible **in the graph itself**, not discovered at install. The compile-time conflict resolution
  (#6940) becomes "read the conflict off the static graph" — pre-resolved, before any install.
- **Installs are deterministic + fast + reproducible.** No solver nondeterminism, no "works today, fails
  tomorrow when a new version publishes." Carving a subgraph from a fixed graph is a pure, content-addressed
  (#6960) operation — same roots → same subgraph → same env, replayable (DST, #6958).
- **Subset = niche.** You never install "everything"; you carve the niche you need (reachability from roots) —
  minimal, but cut from a known whole, so it's guaranteed consistent with the whole (no hidden incompatibility
  surfaces later).
- **It IS the dependson graph (#6971) materialized.** The short `seam verb noun dependson` statements *are* the
  edges; the temple of everything is the full accumulation of them in the infinite file (#6969). The graph isn't
  a separate artifact — it's the file.

## Honest scope / peel

- **"Full graph of everything" is the desired-state IDEAL, bounded by what's ingested.** You can't have
  *literally every package ever* statically; the "temple" is the **known universe** of deps Zeta has ingested/
  defined (which *grows* — the infinite append-only file #6969). The claim is: *within the known graph*, install
  = static subset, defined not solved; and the graph is one constructable file you keep extending. Honest: it's
  "the full *known* graph," made static and complete-as-of-now, not omniscient.
- **Adding a new dep = extending the defined graph** (append to the file, content-addressed) — a *definition*
  step, separate from *install* (the carve). Ingestion solves/defines once; installs never solve again.
- **Scale:** a literal single in-memory graph of *all* packages is huge — so "one .zeta file" is the
  *logical/content-addressed* graph (DAG in the store, #6969), queried by reachability, not a loaded blob. Same
  peel as #6969 (the file is the store rendered as one file).
- Doesn't abolish solving entirely — it **moves** it: solve/define *once* at ingestion (or curate, Nixpkgs-
  style), then every install is a pure subgraph carve. The hard work is the curated/defined whole.

## Ties

- **dependson statements / edges (#6971)** — the full graph IS all dependson edges accumulated.
- **One infinite .zeta file / cyclic graph (#6969)** — the temple of everything is that file; installs slice it.
- **Compile-time conflict resolution (#6940)** — conflicts read off the static graph, pre-resolved.
- **Ace ensure / declarative / content-addressed layers (#6959/#6960)** — `ensure` carves the subgraph;
  content-addressing makes the carve reproducible/deduped.
- **n-dim dependency space / holographic projection (081KSGS9H0008QG0R0031PBNGA)** — the full graph; a niche = a projection/slice.
- **DST test seam (#6958)** — static subgraph carve replays deterministically.

## Beacon anchors

- **Nixpkgs / Nix** — one giant *defined* (not solved) expression graph; `nix build .#pkg` carves a derivation
  subgraph; the canonical "temple of everything, carve what you need." · **Bazel / monorepo build graphs** —
  one static whole-repo dependency graph; build a target = its reachable subgraph (defined, not solved). ·
  **Reachability / tree-shaking / dead-code-elimination** (subset = reachable-from-roots). · **SAT/PubGrub
  resolvers** (the *calculated* approach Zeta inverts) — moved from per-install to once-at-ingestion. ·
  **Desired-state / declarative config** (state roots, look up the graph). Honest novelty: none (Nixpkgs/Bazel
  prove "defined whole graph, carve subsets"); the contribution is **generalizing it across all ecosystems as
  one content-addressed `.zeta` file of `dependson` edges** (the temple of everything, #6969/#6971), so
  dependency resolution is graph *reachability over a statically-known whole* — defined not calculated — with
  conflicts pre-visible (#6940) and carves reproducible (#6960/#6958).
