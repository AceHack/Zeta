# Some deps are PUSH-DOWN (eager/global, not delayed) — a push-down cascade over `dependson`; OS + compiler packages (Aaron, 2026-06-07)

The eager counterpart to the lazy/JIT default (#6976). Aaron:

> *"for some dependencies they can be declared as push-down — and then they are not delayed/executed; the others
> are [delayed] unless it depends on one, then that one is also pushed down. It's a push-down cascade. You can do
> OS and compiler packages this way — that are system or user global."*

## The kernel: two execution strategies — delayed (default) vs push-down (eager, global)

Resolution/install runs JIT/delayed by default (assemble per timestep, #6976). Some deps opt out:

- **Push-down = eager + global, NOT delayed.** A dep declared **push-down** executes **early** — pushed *down*
  to the **system- or user-global** layer (the base), not lazily resolved per-niche per-timestep. (Term:
  database **predicate/projection push-down** — push the operation *down toward the source* so it happens early
  at the base; here the dep is pushed down to the global/system base layer.)
- **Default stays delayed.** "The others are [delayed]" — ordinary deps remain lazy/JIT (#6976), scoped to the
  niche that needs them.
- **Scope: system-global or user-global.** Push-down deps live at a shared scope — system-wide (all users/cells)
  or user-wide (all of one user's niches) — not per-niche. The canonical push-downs: **OS packages and
  compilers** (you want one system/user toolchain, eager and shared, not lazily duplicated per niche).

## The push-down CASCADE (over `dependson`)

Push-down is not a per-dep flag in isolation — it **propagates along `dependson` edges** (#6971): *"unless it
depends on one [a push-down], then that one is also pushed down."*

- **A dep entangled with a push-down dep is itself pushed down.** If a (would-be-delayed) dep is in a
  push-down dependency relationship, it gets pulled into the eager/global layer too — the push-down property
  spreads across the dependency graph (a **push-down closure**), so a push-down dep and everything in its
  push-down-coupled neighborhood land eagerly at the same global scope. (No "half-pushed-down" subgraph — the
  cascade keeps the global base layer consistent.)
- **Why cascade:** a global/eager dep can't sit on a lazy/per-niche dep — its prerequisites must also be present
  eagerly at the global layer, or its dependents must share that base. The cascade enforces that consistency
  across the `dependson` graph (the transitive closure that makes the base coherent).

So: **push-down marks a dep eager + global; the cascade extends that over `dependson` so the whole coupled
subgraph is eager + global — leaving the rest delayed.** OS/compiler = the base layer, pushed down once,
cascaded to keep it consistent.

## The concrete precedents: npx / uvx / pipx / dotnet tool (Aaron, cont.)

> Aaron: *"like npx / uvx / pipx / dotnet tools."*

These existing tool-runners are the precedent for Ace's push-down/delayed knob applied to **tools** (CLI
executables, distinct from libraries) — each runs a tool **isolated per-tool**, at a chosen scope, on-demand or
installed:

- **npx** — run an npm package **on-demand/ephemeral** (no permanent install; cache + execute). The *delayed/JIT
  run* end (#6976) for tools.
- **uvx** (uv) — run a Python tool **ephemerally in an isolated env** (the modern, fast on-demand runner). Also
  the delayed/ephemeral end.
- **pipx** — install a Python CLI tool **user-global, isolated** (its own venv per tool). The *push-down,
  user-global* end (eager, shared across the user's niches, isolated).
- **dotnet tool** — **local** (per-project manifest) **or global** (`-g`) .NET CLI tools, isolated. Spans both:
  local (delayed/per-niche) and global (push-down/user-global).

So the precedents bracket the exact knob: **ephemeral on-demand run (npx/uvx → delayed, #6976) ↔ isolated
user-global install (pipx/dotnet-tool-g → push-down, this doc)** — all with **per-tool isolation** (no global
version pollution). Ace generalizes this across ecosystems: a tool dep is push-down (eager user/system-global,
isolated) or delayed (npx-style on-demand), by declaration + cascade, in the unified resolver — instead of a
separate runner per ecosystem (npx vs uvx vs pipx vs dotnet-tool), one model (`ace`, #6959/#6975) with the
push-down/delayed strategy as the knob.

## Why this matters

- **Right strategy per dep.** Foundational, shared things (OS, toolchain) want **eager + global + once**
  (install the compiler once for everyone, early); leaf/app things want **lazy + per-niche** (#6976). Push-down
  vs delayed is the knob; the cascade makes it sound across the graph.
- **It's a Docker-base-layer / NixOS-system-profile move, generalized.** Base/system layers are eager and shared
  (the bottom Docker layers; NixOS system packages vs home-manager user packages); push-down = "this belongs in
  the base," cascaded so the base is self-consistent. Maps onto the content-addressed layer cache (#6960): the
  pushed-down base layer is shared/deduped across all niches.
- **Composes with the tectonic model (#6937):** pushed-down system/compiler deps are **cratons** (stable, shared
  base, rarely change); delayed per-niche deps are the **active margin**. Push-down literally pushes a dep into
  the craton/base.

## Honest scope / peel

- **Design, not built.** A `push-down` declaration on a dep + the cascade rule (push-down closure over
  `dependson`) + system/user-global scoping are to spec; composes with the lazy/JIT saga resolve (#6976), the
  layer cache (#6960), and scopes.
- **Cascade direction must be pinned precisely.** "It depends on one → that one is also pushed down" — the
  capture reads push-down as propagating across the coupled `dependson` neighborhood (a closure). The exact
  rule (push down *dependencies* of a push-down dep, and/or *dependents* that require it at the base) needs a
  precise definition + a confluence check (the cascade must reach a unique fixpoint regardless of order —
  route to Soraya; ties order-independence #6975). Don't ship an ambiguous cascade.
- **Global scope = shared mutable-ish base** — eager/global deps are a shared resource; conflicts there are
  higher-stakes (one system compiler for all niches). Conflicts still pre-visible in the template (#6940);
  push-down conflicts surface at the base layer, early (which is the point — fail fast at the base, not lazily
  per niche).
- Push-down is *eager* but should stay **idempotent** (#6959) — installing the base toolchain is `ensure`, so
  re-running is safe; non-idempotent base steps are DU/saga-fenced (#6976).

## Ties

- **Delayed/JIT saga resolve (#6976)** — push-down is the eager exception to the lazy default.
- **dependson edges (#6971) + order-from-dependson (#6975)** — the cascade is a closure over `dependson`;
  confluence ties order-independence.
- **Content-addressed layers / Dockerfile (#6960) + cross-OS (#6960)** — pushed-down base layer = shared/deduped
  base; per-OS.
- **Tectonic cratons vs margins (#6937)** — push-down = into the craton/base; delayed = active margin.
- **Compile-time conflicts (#6940)** — base-layer conflicts surface early.
- **Bounded mobility §4** — push-down = relocating a dep to the global/base scope.
- **Idempotent ensure (#6959)** — eager base installs stay idempotent.

## Beacon anchors

- **Tool runners — npx / uvx / pipx / dotnet tool** (the concrete precedents: per-tool isolated; ephemeral
  on-demand run = delayed; user/system-global install = push-down; Ace unifies them as one knob). ·
  **Predicate / projection push-down** (query optimization — push operations toward the source to execute
  early; the term's origin). · **Eager vs lazy evaluation** (call-by-value vs call-by-need; strictness
  annotations — push-down ≈ a strictness/eager annotation on a dep). · **Base layers / system vs user scope** —
  Docker base layers, **NixOS system packages vs home-manager (user)**, apt (system) vs pip `--user`; the
  global-toolchain-once pattern. · **Transitive closure / fixpoint over a graph** (Tarjan; the cascade) +
  **confluence** (unique fixpoint regardless of order, #6975). Honest novelty: none in the primitives; the
  contribution is a **per-dep execution strategy** — **push-down** (eager, system/user-global, not delayed) vs
  the lazy/JIT default (#6976), with a **push-down cascade** (closure over `dependson`) keeping the eager/global
  base consistent — OS/compiler packages as the canonical push-downs into the craton/base layer (#6937/#6960).
