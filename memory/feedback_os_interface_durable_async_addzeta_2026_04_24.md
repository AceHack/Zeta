---
name: OS-INTERFACE — the killer UX, looks like sync I/O but actually durable-async runs everywhere; Temporal/durable-functions/step-functions class with DST as hard prereq; AddZeta one-line DI simplicity; serverless-with-state-by-default; LINQ/Rx stream composition in user code; ties to Reaqtor IQbservable substrate; usermode-microkernel preparation (build everything in usermode first then promote); actor interface secondary (beginner-unfriendly); combinatorial canonical examples per DSL pair (SQL has git table); distributed event loop with mathematical guarantees if provable; "where does it run? everywhere"; Aaron 2026-04-24
description: Maintainer 2026-04-24 directive — THE UX thesis. The OS-interface is the killer interface for beginners: looks like normal sync I/O (the dotnet async-await idiom) but actually durable-async, runs "everywhere" (cluster), auto-persists state via our code, requires deterministic code (DST fit perfectly). AddZeta one-line DI. LINQ/Rx stream composition. Ties to existing Reaqtor research substrate. Usermode-first incremental microkernel preparation. Actor as secondary interface. Combinatorial canonical examples across DSLs. Otto-275 log-don't-implement; explicitly maintainer-flagged as "big and not very clear ask, please backlog and untangle".
type: feedback
---

## The directive (verbatim)

Maintainer 2026-04-24:

> *"boooooooooooooooom, the ultimate interface that pulls
> them all together for the beginner, the os interface.
> it just looks like full blown regural simle I/O
> interfaces like noraml but just like dotnet it's not
> really syncrnous code everything is async this can be
> the start to our microkernal to but usermnode but we
> should usermode everything to get ready like everything
> a microkernal would need bit by bit slowely by slow
> testing in user mode. the difference with this code is
> when you ask where does it run?? "everywhere" it's
> basiclaly like temporal, open durable functions or step
> functions there are lots of variatnts but for us we can
> get into the async and yield plumbing and get it to use
> our code instaed that auto persist state the only hard
> requirments is that you write deterministic code like
> DST lol we will fit in perfect, this will be the killer
> interface and you could DI inject different streamings
> and allow linq/rx combining of the streams in the code
> and write what looks like regular sequential code and
> somehow this all ties into reaqtor lol. this is a big
> and not very clear ask please backlog and untangle
> this make code so composable and it feel like your
> code is just magically running on the whole cluster.
> We can keep stats and do all sorts of auto runtime
> optimizations. This is just our serverless but we just
> have state avialabe by default, it's not exceptional,
> the AddZeta simplicity we are going for, for our
> developer UX.. Also we do want like a actor interface
> too but that is harder to think about for beginners
> unless your probelem directly maps, we can come up
> with so many projects between all the differnt modes
> so they can all see each other nativly in their own
> regieme, connonical example in sql there should be a
> git table and/or may git built in function or
> something to make git first class in SQL. and
> combinotorial that for all our different things, it's
> like the f# composiable solves this best but maybe
> other stuff? looks like we are going to have some
> sort of distributed "event" loop, guarentees here are
> good if we can mathematically provice them. backlog."*

## Untangle — distinct concepts identified

The directive is intentionally tangled. Loop-agent's
preliminary decomposition (subject to maintainer
challenge):

### 1. The OS-interface (UX killer)

**What:** A user-facing programming interface that looks
like normal sequential synchronous I/O code — read a
file, query a database, send a message, await a result —
but is actually **durable-async** under the covers.

**Why it's the killer:** Beginners write code that "just
works" without learning durable-workflow APIs.
Experienced devs get the durability + replay-on-fail +
distributed-execution properties for free.

**Why dotnet's analogy holds:** `async`/`await` looks
sequential but compiles to a state-machine with
continuations. Zeta extends that pattern: the state
machine ALSO checkpoints to durable storage at every
yield point.

### 2. Durable-async runtime (Temporal/Step-Functions class)

**Class membership:** Temporal, AWS Step Functions, Azure
Durable Functions, Cadence (Uber), Restate, DBOS, Inngest,
Trigger.dev. All implement "looks-sequential, actually
durable".

**Hard prerequisite (maintainer explicit):** *"the only
hard requirments is that you write deterministic code
like DST lol we will fit in perfect"*. This is the
Temporal contract — workflow code must be deterministic
so replay reaches the same state. Composes directly with
Otto-272 DST-everywhere (factory default already).

**Engineering surface:** intercept `async`/`await` /
`yield`-plumbing so every continuation point persists
state via Zeta's substrate. The user's stack frame
becomes a durable `IQbservable<T>`-ish thing.

### 3. "Where does it run?" → "Everywhere"

The function doesn't run on a specific machine; it runs
on the cluster. Each await-point can resume on a
different node. State follows the function (durable
substrate is the source of truth, not the machine that
issued the call).

Composes with the multi-node distributed-DB substrate
(closure-table-hardened hierarchical index #396), the
mode-2 → mode-1 protocol-upgrade negotiation (#395), and
the Ouroboros bootstrap thesis (#395).

### 4. AddZeta DX target

**Maintainer framing:** *"the AddZeta simplicity we are
going for, for our developer UX"*.

Single-line DI registration:

```csharp
services.AddZeta();
// or
services.AddZeta(opt => opt.Cluster("...").Storage("..."));
```

Modeled on `AddDbContext`, `AddHttpClient`, `AddOpenApi`.
Zero ceremony in `Program.cs`, full power in user code.

### 5. LINQ/Rx stream composition

Inject streams via DI, combine with LINQ/Rx operators in
user code:

```csharp
public async Task ProcessOrders(IZetaStream<Order> orders, IZetaStream<Inventory> inventory) {
    var lowStock = orders
        .Join(inventory, ...)
        .Where(o => o.Inventory.Count < threshold)
        .Select(o => new Alert(o));
    
    await foreach (var alert in lowStock) {
        await SendAlert(alert);  // every await is a durable checkpoint
    }
}
```

Looks like normal LINQ. Actually distributed Rx with
durable continuations.

### 6. Reaqtor tie-in

**Maintainer:** *"somehow this all ties into reaqtor lol"*.

[Reaqtor](https://reaqtive.net) is Microsoft's open-source
**distributed reactive event processing engine** built on
`IQbservable<T>` (the dual of `IQueryable<T>` for push).
The codebase tracks Reaqtor as an upstream-sync mirror —
manifest at `references/reference-sources.json`, populated
via `tools/setup/common/sync-upstreams.sh`. The mirror path
`references/upstreams/reaqtor/` is **gitignored** and only
present after the sync script runs; it is NOT committed to
the repo. Reaqtor's `IQbservable`
+ expression-tree representation gives us:

- **Serializable observable queries** (the durable state
  IS the query expression, not a thread).
- **Stream operator composition** (LINQ/Rx in user code
  serializes to expression trees that distribute).
- **Subscription-based execution** (server-side
  observable machinery; client just declares).
- **Already F#-idiomatic via Rx.NET interop**.

The OS-interface BUILDS ON Reaqtor's primitives.

### 7. Usermode-first microkernel preparation

**Maintainer:** *"this can be the start to our
microkernal to but usermnode but we should usermode
everything to get ready like everything a microkernal
would need bit by bit slowely by slow testing in user
mode"*.

Phased OS work: build all microkernel-class subsystems
in usermode first, with tests, then promote to
kernel-mode when (a) testing has matured, (b) hardware
+ all-dotnet-F# direction lands. Composes with the FUSE
user-mode filesystem driver row (#398 cluster).

### 8. Actor interface (secondary)

**Maintainer:** *"we do want like a actor interface too
but that is harder to think about for beginners unless
your problem directly maps"*.

Two-tier UX:
- **Beginner / default**: durable-async sequential-
  looking code (the OS-interface above).
- **Advanced / problem-fits**: actor interface for
  problems that naturally model as message-passing
  agents (Akka-class, Orleans-class, Erlang-class).

Don't lead with actors. Beginners trip on the mental
model.

### 9. Cross-paradigm canonical examples (combinatorial)

**Maintainer:** *"connonical example in sql there should
be a git table and/or may git built-in function or
something to make git first class in SQL. and
combinotorial that for all our different things"*.

For every pair of DSLs in the supported set (SQL,
operator-algebra, LINQ, Rx, git, blockchain ingest,
WASM, actor), there should be at least one canonical
example showing native composition.

Composes directly with the cross-DSL composability row
(#397). The combinatorial example matrix IS the
deliverable for that row's Phase 0.

### 10. Distributed event loop with mathematical guarantees

**Maintainer:** *"looks like we are going to have some
sort of distributed 'event' loop, guarentees here are
good if we can mathematically provice them"*.

Targets for formal proof (Lean / TLA+):
- **Liveness**: every fired event eventually completes
  or is durably-failed.
- **Safety**: no event-loop loop processes the same
  event twice without explicit retry semantics.
- **Determinism preservation**: under DST inputs,
  outputs are bit-equal across replays.
- **Causality**: happens-before relations preserved
  across distributed dispatch.

Composes with `tla-expert`, `lean4-expert`,
`distributed-consensus-expert`, `calm-theorem-expert`.

### 11. Auto runtime optimization + stats

The runtime keeps stats on every awaited operation:
- Latency distribution per node
- Hot continuation points
- Durability cost per yield
- Cross-node hop frequency

Optimizer uses these to:
- Place continuations on the node owning the data they
  read next
- Inline short-await chains into single round-trips
- Batch durability writes on read-heavy paths
- Migrate hot streams to faster nodes

Composes with `query-optimizer-expert` + `metrics-expert`
+ `performance-engineer`.

## Composition with the 2026-04-24 cluster

This OS-interface row is **the UX layer** that makes all
other 2026-04-24 work into a coherent product:

- **Bootstrap thesis** (#395): both modes "require zero
  install" — the OS-interface is what users SEE in either
  mode.
- **Native F# git impl** (#395): a DSL surfaced through
  the OS-interface.
- **Mode 2 protocol upgrade** (#395): faster transport
  between OS-interface frontend and backend.
- **Permissions registry** (#395): authority gates around
  OS-interface operations.
- **Cross-DSL composability** (#397): the OS-interface IS
  the user-facing realization of cross-DSL composition.
- **Closure-table hardening** (#396): the durable state
  the OS-interface async-state-machine checkpoints into.
- **Ouroboros bootstrap meta-thesis** (#395): the
  OS-interface runs on Zeta substrate that stores the
  OS-interface code itself.
- **Blockchain ingest** (#394): another DSL surfaced
  through the OS-interface (chain queries via `await`).
- **FUSE filesystem driver** (#398 cluster): every
  OS-interface I/O can be mountable as a path.
- **Otto-272 DST-everywhere**: the maintainer-explicit
  hard prerequisite — already factory default.
- **Otto-274 progressive-adoption-staircase**: the
  OS-interface IS Level 0 (write code, it works).
- **Semiring-parameterized operator algebra**
  (2026-04-22 research): the math substrate the
  distributed event loop reduces over.

## Phased approach (long-horizon)

This is a multi-round work item; capture-only at this
landing.

- **Phase 0** — Untangle research:
  `docs/research/os-interface-durable-async-addzeta-2026.md`.
  Reaqtor deep-dive + Temporal/Step-Functions/Restate
  comparative survey + IQbservable expression-tree
  serialization study + DST-fit verification +
  AddZeta DX prototype API sketch.
- **Phase 1** — Single-machine usermode prototype:
  `AddZeta()` + minimal durable-async runtime with
  in-memory state (no cluster, no protocol, just
  the await-state-machine intercept).
- **Phase 2** — Multi-node prototype: extend Phase 1
  with closure-table-hardened durable state across
  nodes; protocol-upgrade negotiation engaged.
- **Phase 3** — LINQ/Rx stream composition surfaced as
  IZetaStream<T> on the OS-interface; cross-DSL
  examples landing per the combinatorial matrix.
- **Phase 4** — Actor interface as opt-in alternative;
  formal-verification of distributed-event-loop
  invariants (TLA+ / Lean).
- **Phase 5** — Microkernel promotion of stable usermode
  subsystems (gated on (a) test maturity, (b)
  all-dotnet/F# direction).

## Does NOT authorize

- Implementation start. Phase 0 untangle is the gate.
- Designing the actor interface before the durable-
  async interface is concretely shaped.
- Promoting any usermode subsystem to kernel-mode before
  test maturity + maintainer sign-off.
- Compromising DST as a hard prerequisite (the entire
  durable-async semantics depend on it).

## Maintainer framing notes

- *"big and not very clear ask, please backlog and
  untangle"* — the directive is intentionally
  exploratory; the untangle work IS the deliverable
  for Phase 0.
- Ergonomics target = **AddZeta one-line**. If the API
  surface drifts toward more ceremony, it's lost the
  thesis.
- The "everywhere" answer to "where does it run?" is the
  punchline; preserve the surprise for users who learn
  the model.

## Future Otto reference

When implementation starts:
1. Read this memory + the Phase 0 research doc first.
2. Verify DST is still factory default (Otto-272).
3. Survey Reaqtor's current state via the upstream sync
   workflow (`tools/setup/common/sync-upstreams.sh` +
   `references/reference-sources.json`) — populates the
   gitignored `references/upstreams/reaqtor/` mirror —
   before designing. DON'T reinvent IQbservable.
4. Check that AddZeta API hasn't grown ceremony.
5. Cross-DSL examples are NOT optional polish — they're
   the proof that composition works.
