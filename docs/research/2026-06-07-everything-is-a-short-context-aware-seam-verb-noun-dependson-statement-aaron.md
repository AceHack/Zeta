# Everything becomes a short, context-aware `[seam] verb noun dependson …` statement (Aaron, 2026-06-07)

Final compaction of the grammar (#6957/#6967) + the edges of the infinite file (#6969). Aaron:

> *"so everything becomes context-aware — short interface, seam verb noun dependson — kind of thing."*

## The statement form

Every statement in the system reduces to a **short, context-aware** form:

```
[seam] verb noun  [dependson <noun …>]
```

- **short interface** — the unit is a tiny, compact interface/statement (the IDL #6955 is *small* interfaces),
  not a verbose blob. Everything is many small statements, not few big ones.
- **`[seam] verb noun`** — the grammar (#6957/#6967): seam = integration plane (implicit by context), verb =
  action, noun = ZetaId/unique-in-scope.
- **`dependson <noun …>`** — the **new piece**: each statement declares **its dependencies** (the nouns it
  depends on). This is what was implicit in `ace ensure` (#6959) made explicit and universal: a statement
  carries its dependency edges.
- **context-aware** — the statement is resolved **in its current context/scope/namespace**: the implicit seam,
  the current cell, the active namespace fill in what's omitted. "Short" *because* context supplies the rest
  (you don't repeat the seam/scope when context already fixes it).

## Why `dependson` is load-bearing: it's the edges of the infinite file

The infinite `.zeta` file is a **cyclic graph** (#6969). A bare `seam verb noun` is a **node**; **`dependson`
is the edge**. So:

- The whole infinite file = **nodes (statements) + dependson edges = the dependency graph.** That graph *is* the
  cyclic content-addressed DAG (#6969); `dependson` makes the edges first-class and explicit.
- **It's the DBSP/dataflow dependency graph at the statement layer** — `dependson` is the operator-input edge;
  the runtime can topologically order, parallelize (DoP knob), incrementally recompute on change (only
  downstream of a changed dependency), and cache per-node (#6960 content-addressed layers) — all because the
  edges are declared.
- **It's already in the substrate's vocabulary** — the workitems carry `depends_on:` / `composes_with:` in
  their frontmatter; Ace files declare deps (#6959/#6960); Nix/Bazel/make declare prerequisites. `dependson`
  universalizes that into the one statement form.

## Why "context-aware" matters

- **Short by construction.** Context (current seam/cell/namespace) supplies the omitted parts, so statements
  stay terse — `ensure npm.foo` not `zeta ace ensure npm.foo dependson … in namespace …` when context already
  fixes seam=ace and the namespace. Same as the implicit-seam rule (#6957), generalized.
- **Resolution is scoped (#6916).** The noun (and dependson nouns) resolve as ZetaId/unique-in-scope within the
  active context — the resolver discipline. Move the context, the same short statement means the right thing
  there (frame-relative, #6893).
- **Composable + cacheable.** Context-aware + dependson lets a statement be lifted/relocated (bounded mobility
  §4) and its result cached by (statement ⊕ resolved-context ⊕ dependency-closure) — content-addressed.

## So the universal reduction is complete

Stacking the arc: **everything is one infinite homoiconic file (#6969), run one step at a time (#6965), where
each step is a short context-aware `[seam] verb noun dependson …` statement** — node + edges, resolved in
scope, idempotent (#6959), homoiconic (#6962), DST-replayable (#6958). The grammar is now small enough to be
universal and rich enough (dependson + context) to form the whole dependency graph.

## Honest scope / peel

- **Grammar/design refinement, not built.** `ZetaCli` (#6967) parses `[seam] verb noun`; adding a **`dependson`
  clause** + **context resolution** (implicit seam/scope/namespace) is the next grammar brick — the *syntax* of
  dependson (`dependson a b c`? a trailing clause? structured?) is a design decision to pin before extending the
  parser.
- "Context-aware" needs a defined **context model** (what's in scope: current seam, cell, namespace, frame) —
  to spec, not assume. Don't over-imply magic; context is explicit state the resolver reads.
- Doesn't replace the full IDL (#6955) — it's the *compact statement* surface of it; rich type/interface
  declarations are the IDL, `seam verb noun dependson` is the operational line.

## Ties

- **ZetaCli seam/verb/noun grammar (#6957/#6967)** — this adds `dependson` + context; next parser brick.
- **Infinite file / cyclic graph (#6969)** — `dependson` = the graph's edges; statements = nodes.
- **ace ensure / deps (#6959/#6960)** — `dependson` universalizes the dep declaration.
- **ZetaId resolver / scope (#6916) + traveler-frame-relativity (#6893)** — context-aware noun resolution.
- **DBSP dataflow graph + incremental recompute** — dependson = operator edges; topological order + DoP +
  per-node cache.
- **workitem `depends_on`/`composes_with`** — the same edges, already in frontmatter.
- **One-step-at-a-time loop (#6965)** — each step is one such statement.

## Beacon anchors

- **Dependency declaration / build graphs** — make (target: prerequisites), **Bazel**, **Nix** (derivation
  inputs), **Cargo/npm** dep edges; the `dependson` lineage. · **Dataflow / DBSP dependency graph** (incremental
  recompute over declared edges; Budiu et al.). · **Lexical scope / context-sensitivity** (statements resolved
  in current scope). · **Universal action grammar** (#6957; observe-16) + ZetaId scope resolution (#6916).
  Honest novelty: none in dep-graphs or scoping; the contribution is the **compaction** — every statement is a
  *short, context-aware* `[seam] verb noun dependson …` (node + edges, scope-resolved), so the infinite file
  (#6969) is exactly a dependency graph of these statements, run one step at a time — the grammar made both
  minimal and graph-complete.
