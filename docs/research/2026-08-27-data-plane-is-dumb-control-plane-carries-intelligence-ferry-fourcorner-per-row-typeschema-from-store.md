# Data plane is dumb; control plane carries intelligence — ferry FourCorner per row, TypeSchema from the store

Scope: research-grade absorb of Aaron 2026-08-27 (ferry dual-arity, FourCorner-per-row, TypeSchema-from-store, CLI kernel). Internal current-state absorb, not an archive import.
Attribution: Aaron (human) framed the requirements; Riven (Grok 4.6) measured the tree and wrote this absorb.
Operational status: research-grade
Non-fusion disclaimer: Shared vocabulary here does not imply merged agency, shared identity, or personhood.

*2026-08-27. Live pointers [`docs/ROADMAP.md`](../ROADMAP.md)
(north star, 8b, P1, continuous) and [`docs/VISION.md`](../VISION.md)
§compiler ladder + epoch. GOVERNANCE.md §33. Workitem
`081M125DNKK087G0R00292E3ET`.*

Aaron 2026-08-27, on the ferry:

> we want to review our code for low no allocations and simd
> support if that help even in some batch scenarios, if batching
> helps we way want an implicit ferry throttler that will invisibly
> batch things if needed and allow for bactch calling, it has a dual
> interface that allows for the caller to call, single instant but
> then then underneath they get batched and vice version it's like
> a universal adapter between incrementing one at a time and batch.
> If this is not what you see in our code it's a mistake and i'll
> need to get a whit room agent look at some of my origial code and
> write a spec around this, my origial code was missing the four
> corner stuff be we should have this even in batch mode now, we
> also tried to link up to a batch results failurs where each row
> in the batch has the four corners this lets us support muxed
> feedback over bidirectional channels with zetaids as the demux
> on the other side, a lot of our transports already work like this
> for communications. Also DoP=1 scale free to infinate is part of
> the ferry throttler design.

And, on gen / two planes / snap / CLI:

> gen/: the plan — reify types from git-history metadata; recursive
> sim/mea/cut inside the compiler. Not wired to ZetaFs/DagFs. we
> should get the wiring on the roadmap somewhere our futamara and
> zetadb/fs merge in the control plane and the stored procs, the
> data plane should be fast and dumb no intelligence, this two
> layer split is what lets us stay cutting edge on perforamce
> evntually. The gap is the schema source: AdditionalFiles / JSON
> IR today, not the store. Next honest slice is TypeSchema from a
> DynamicValue (the store's native type), then the existing
> generators consume it. Tick-N-loads-tick-(N−1) still needs the
> epoch layer (VISION: DESIGNED). yes this is a good move, also the
> typeschema from dynamic value can be a guessed snap from a
> softvalue too with a certain uncertany attached, whenever we snap
> we still want to preserve the uncertainy for reporting and also
> it can make thing commutive if we do it right. Also i think we
> are going to need some forge host cli that abstracts any forget
> host we are current on, all the extra stuff that's not git native,
> i'm not sure what cli this belongs under, likey harney, zeta is
> more the gitnative stuff not the forge host, feel free to come up
> with someother name for this too, we don't want to just shove
> everything in harney cli either, we want a nice decomposition,
> also all our clis should build off some based cli layer so we
> are not redoing things over and over, our verbs nouns and such
> could be a plugin model similar to k8s controllers but for clis,
> a lot of room to play and design here, don't have to rush into
> implmentation.

## What this corrects

Three things that look like they might already be done, and one
naming trap.

1. **The ferry dual interface is half-shipped.** Single-item call,
   boat underneath, DoP=1→N, anti-Nagle: **in the tree.** Batch-in
   / single-processor, FourCorner **per row**, per-row failure,
   ZetaId demux: **not in the tree.** Whole-boat `faultBoat` is the
   current contract. That is the mistake Aaron named, not a missing
   throttler.
2. **A guessed schema is not `snap`.** `SoftValue.snap` stays the
   collapse (`DynamicValue option`) and **does not change**. A
   TypeSchema guessed from a SoftValue is a **different
   constructor** that keeps the SoftValue attached (reporting +
   later `combine` / `observe` still commute). Snap-then-forget as
   the schema path is the defect; mutating `snap` is not the fix.
3. **Intelligence must not leak into the data plane.** The north
   star already splits "reliable data plane" / "control plane of
   cells". This session names the *performance* reason: the data
   plane stays dumb so it can stay fast; Futamura, stored procs,
   `gen/`, zetadb/fs merge sit in the control plane. Not a third
   plane. A sharpening.
4. **Harny is not the extra-git CLI.** Harny is the agent harness
   (8b). Zeta verbs are git-native (`clis/` `sim`/`mea`/`cut`).
   Extra-git lives in `src/Core.TypeScript/forge-host/` already.
   Dumping that into Harny is the wrong cut.

White-room / clean-room: **do not open the original Itron
throttler.** The dual-arity requirement is already expressed in
`FerryThrottler.fs` and in
`.claude/rules/async-all-the-way-truthful-signatures.md`. A
white-room agent is only needed if we cannot specify FourCorner-
per-row + ZetaId demux from this absorb. We can. Requirements
cross the wall; expression does not.

Aaron 2026-08-27, second pass — the adapter is a **4-way
matrix**, not only single-in / batch-under:

> the batch in adapter should be clueless on if it's batch size
> is allowed by the ferry if it passes in a batch that is too
> large the farry throttler should just split it up, zeta
> scheduler plus ferry thotther should be very close to being
> able to predict its own space and time bit 0 notiation and
> usages so it can make the right decidsions. … in the original
> itron even underneath is would be one at a time instead of a
> boat/batch unless the code handling the request was batchable,
> it could go batch-batch(s) single-batch, single-single,
> batch-single, it allowed transforming between all these
> options and did it the most efiicent way possible, also when
> it would use async local and captures to make sure things like
> otel would tacing and loggin contexts would not get lost in
> the split, this was part of the per item payload, the capture,
> we also can do this is our kasli arrow in category thery if
> the code is all categorical, for ah hoc code, async local is
> needed. … memory pooling for the boats so the memory pressure
> could stay constand and when there is too much load provide
> back pressure or else in flight tasks would push the memory
> pressure over any limits in a container without the
> backpressure memory footprint can grow unbounded in a
> degenerate case with the producer outweighs the consuer
> constantly. also the anti nagel is key, this algo i came up
> with is very in line with foundation db and their
> deterministic simulation and no arbitary limits imposed, let
> the environment decide.

And, on DynamicValue as a tiny CFG with context holes, Dual
BNN, SIMD, CLI, REST batch errors:

> yes the makes sense the simd likely makes sense either on the
> producer or consumer side not in the throttler itself expcet
> for maybe if it trying to come up with multiple competing
> future predictions one day, this could be vectorized by
> similarity per BNN layer once we connect it to that. also our
> dynamic value on top of being a typespec or whatever you
> called it is also a tiny context free grammer, adding context
> on top is planned as well it just need the ability to leave
> context holes like the hitchiker tree so context can be
> attached outside of the structure without changing it, a 2nd
> dynamic or soft value, this is similar to our Dual BNNs
> concept for content free to context aware grammer updates.
> … S yes design is alwasy welcome. the other thing is i think
> we were very similer to some REST RFC for batch reporting of
> errors with our batched indexed results for ferry throttler.

## What is already measured (do not rebuild)

| Half | In-tree |
|---|---|
| DoP=1 → N, same code path | `FerryThrottlerConfig.MaxDegreeOfParallelism`; `deterministic` is 1 |
| Anti-Nagle boats | `fillBoat` drains what is queued *now*, up to `MaxBatchSize`; no timer |
| Single → batch underneath | `EnqueueAsync` / `ProcessAsync` one item; `processBatch` takes `ReadOnlyMemory` |
| Index-aligned result fan-in | `completeBoat` (`FerryThrottler.fs`) |
| FourCorner 2×2 I/O record | `src/Core/FourCorner.fs` `FourCornerOwnership` — not a fermion, not Cl(p,q) |
| Duplex four-corner wire | `src/Core.TypeScript/model-backend/duplex-transport.ts` — demux by *channel*, not ZetaId |
| TypeSchema IR + Roslyn generator | `src/Core.CSharp/TypeSchema.cs`; `SchemaSourceGenerator` over `*.zetaschema.json` AdditionalFiles |
| SoftValue snap as only collapse | `src/Core/SoftValue.fs` `snap` / `SnapPolicy`; `observe`/`combine` commute on independent evidence |
| Epoch layer | VISION: **DESIGNED**. Store ships; epoch over it does not |
| Forge-host extra-git | `src/Core.TypeScript/forge-host/` (GitHub + GitLab adapters, worldview, PR gate) |
| CLI verb family | `clis/README.md` `sim`/`mea`/`cut`/`ben`/`cla`/`res` — git-native |
| gen/ plan | `gen/README.md` — not wired to ZetaFs/DagFs |
| Nucleus as plugin microcore | ROADMAP layer table (preliminary split; composability-over-layers absorb is in-flight as #15854) |
| Capture-at-the-door (Kleisli) | `ContextualFerryThrottler.EnqueueCapturedAsync` / `ProcessCapturedAsync` — ambient snapshotted on the caller flow, threaded as DATA, not as an AsyncLocal leak into the ferry |
| Queue backpressure knob | `MaxQueueSize: int option` — **default `None` (unbounded)** |
| Scheduler self-predict (time/orbit) | `SchedulerZeta.predict` — Artin–Mazur run-ahead; does **not** yet predict space |

## The 4-way adapter (correction)

The first pass named "single-in / batch-under" as half-shipped.
That understates the original design. Caller × processor is a
**2×2**, and oversized caller batches **split**:

| caller | processor | name | in-tree |
|---|---|---|---|
| single | batch | single-batch | yes (`ProcessAsync` / `EnqueueAsync` → `processBatch`) |
| single | single | single-single | no (`processOne` adapter) |
| batch | batch | batch-batch | no (`ProcessMany`) |
| batch | batch, oversize split | batch-batch(s) | no — caller is **clueless** of `MaxBatchSize`; ferry splits |
| batch | single | batch-single | no — underneath is one-at-a-time **unless** the handler is batchable |

The efficient path is chosen by whether the handler is batchable,
not by what the caller wrote. A `ProcessMany` of 10_000 with
`MaxBatchSize = 256` is ~40 boats, not a refusal.

Anti-Nagle still holds: no timer to fill a boat; the environment
(queue depth, byte budget, DoP) decides. FoundationDB / DST: no
arbitrary wall-clock limits.

**Beacon for per-row batch errors:** RFC 4918 §13 Multi-Status
(HTTP 207) — overall status is the batch; the body carries
**per-item** status. RFC 9457 (Problem Details) cites 207 when
subproblems do not share one HTTP code. Zalando REST guidelines
make the same split we already have a name for: index-aligned
`completeBoat` is the 207/`items[]` path; `faultBoat` (one
exception on every row) is the *non-item-specific* 4xx/5xx.
Per-row FourCorner is how we stop using `faultBoat` for a single
row's error.

## Pooling, backpressure, capture

- **Boats should be pooled** (`ArrayPool` / slot reuse) so memory
  pressure is **constant in the number of ferries**, not in the
  number of in-flight items. Today each ferry `Array.zeroCreate`s
  one boat buffer (constant per ferry) but each `ProcessAsync`
  still allocates a `FerryRequest` + TCS (unbounded in the
  producer). Pooling the request slots is the remaining half.
- **`MaxQueueSize = None` is the container-OOM degenerate.**
  Producer > consumer with no bound grows in-flight without
  ceiling. The knob exists; the deterministic default is
  unbounded. Production configs must set it. That is the
  backpressure Aaron named — cooperative wait, not drop.
- **Capture is already the Kleisli door** for categorical code
  (`ContextualFerryThrottler`). Ad-hoc OTEL / logging /
  `Activity.Current` still needs the AsyncLocal **snapshot at the
  door** (`capture: unit -> 'Ctx`); nothing ambient may leak into
  the background ferry (manifesto §13). Naledi: snapshot exists
  (`EnqueueCapturedAsync`); **restore around `processBatch` does
  not** — a processor that reads ambient `Activity.Current` sees
  the ferry, not the item. Kleisli processors unpack
  `struct (item, ctx)`. Restore-at-process is the remaining
  ad-hoc half. `ProcessCapturedAsync` has no test.

## Scheduler + ferry predict space and time

`SchedulerZeta.predict` is run-ahead on **time/orbit**
(transient, period, reachable). It does not yet read **space**
(queue depth, boat-byte occupancy, pooled-slot usage). Bit-0
notation here means occupancy/usage — slot used vs empty — the
same occupancy idea as FourCorner's 2×2. Connecting those
occupancy bits to `predict` is how DoP / backpressure / boat
size become decisions the pair makes about *itself*, not
constants we pick. Not built. SIMD on that prediction (competing
futures, similarity per BNN layer) is the later exception to
"SIMD is not in the throttler."

## DynamicValue is a tiny CFG; context is a hole, not a rewrite

`DynamicValue` is already a small term algebra (a CFG).
`TypeSchema` types those terms. Adding context **on top** is
planned: leave **holes** so a second `DynamicValue` or
`SoftValue` attaches **outside** the structure without changing
it. That is the Dual-BNN move already on file
(`docs/research/2026-08-25-is-semantics-a-quotient-of-syntax-*`
§0.8): content-free (the CFG) to context-aware, **not two
networks** — an epi–mono factorisation.

Honesty on "Hitchhiker tree holes": this repo already corrected
that fusion (`docs/research/2026-08-15-chip8-time-dilation-*`
§0). **Hitchhiker trees have buffers, not holes** (Greenberg).
Aaron 2026-08-27: the quote was the wrong talk — Vokes is the
one. The structure Vokes **names** as having holes is the
**difference list** (slide: *"data structures with 'holes' in
them"*): an unbound logic-variable tail; append is *binding the
hole*, O(1), visible to every holder. He generalises: difference
trees, difference dictionaries. Functional cousin: **Hughes
lists** (1986). Prolog folklore formalised by Clark & Tärnlund;
unification is Robinson 1965. In F#/TS the honest encoding is a
write-once ref / promise, not free unification. Joshi TAG foot
nodes are a related Beacon for adjoining, not the named slide.

The same lecture is why zetadb/fs looks the way it does —
**two content-addressings**, not one:

| | without a distance metric | with locality / a metric |
|---|---|---|
| in the talk | SHA-1 confirm; Jumprope CAS-not-pointers (hash as skiplist *probability*, identity not nearness) | rolling hash (Karp–Rabin / Tridgell rsync p.64): cheap overlap/similarity filter, then crypto confirm |
| in-tree | BLAKE3 / Merkle / `ContentStore` / `DagFs` | FastCDC (`FastCdc.fs`); HyperMinHash (Cohen–Lemire) |

Conflating the rolling filter with the cryptographic confirm is
the dual-use failure in another register (detection is not a
verdict). Content-defined chunking is why a one-byte insert does
not rewrite the store.

Aaron 2026-08-27, on RFC 4918 / vacuous errors / heat / teaching
feedback / TypeSchema / stored procs / product vs framework:

> yes these are the RFC i rmember too, i based mine on a slimmed
> down version for itron that could track the changes, and we
> have a concept of no error that give no informiton this forces
> information erasure and cost heat, we have a huge amount of
> code on our heat tracking, we prefer when the "feedback" not
> error comes with teaching and possible a new generator function
> to improve from running into the scenario again, all our
> protocols are based on this design. … Holes are Scott Vokes …
> yes you re 100% correct i quoted the wrong one … it also
> discuss content based addressing which zetadb/fs is heavly
> based on, two actually one without a distance metric and one
> with a distance metric. … we can have as many product lanes as
> maks sense but it's better to bundle related things and also
> keep product and framework seperate, they both can deserve
> their own repo but products are sold or services against them
> sold, and frameworks are used by products lol. both important
> and sometimes the line is blury when your customers are
> developers. also our typeschemas should lean more functional
> style than object oriented so it fits nicer with the math and
> interpertatin. oop can be derived from functional, f# did this,
> functional is much harder to do in oop native languge like c#.
> i would also say our stored procs should be very fast and dumb
> and only need our data layer unless they are being
> evolved/updated or expicitly ask for intelligence within the
> stored proc, not ever stored proc needs to pay the prices of
> intelligence, only evolution of them do and even then we are
> working on in our tiny agent free github runner system on
> making intelligence tiered where each tier is away of what's
> its not capiapable of so it can route to higher tiers as needed
> not everytime.

## Vacuous feedback is heat; teaching ships a generator

RFC 4918 §13 / RFC 9457 confirmed. The Itron slim was a
change-tracking 207: per-item status that can **move**. A 207
row whose body is empty, or an exception with no teaching, is
the vacuity class — a check that cannot fail, an error that
erases. Landauer 1961: two states onto one **is** heat.
`ErasureClass` / `WSet.consolidate` / `LandauerFloor.lean` already
meter that. `WSet.negate` is Bennett-free (the honesty note on
`FourCornerTrace`).

So the protocol is not "error." It is **feedback** (FourCorner
out/in-feedback): it teaches, and when it can it **emits a new
generator** so the next encounter is cheaper. Generator-
reinterpret on the −1 fold is the same shape. A `faultBoat` that
clones one exception onto every row is whole-batch heat with no
per-row teaching.

Clean-room: the Itron slim is a *requirement* (track changes,
per-row, no vacuous error), not a source to open.

## Stored procs default dumb; intelligence is opt-in and tiered

Correction of the earlier north-star lump. Stored procs live on
the **data plane** unless they are being evolved or they
explicitly ask. Evolution pays; a running proc does not.
Intelligence tiers already have a harness
(`healer-harness.ts`, handoff 2026-08-01): cheapest tier first,
escalate when the tier **knows it cannot**. The tiny-agent free
GitHub-runner swarm is that ladder under scarcity — named
agents with guaranteed ticks, each aware of its floor.

## TypeSchema is a functional algebra; OOP is derived

Today `SchemaField.CsType` is a C# type string. That is an OOP
surface leaking into the IR. The IR should be **sum and
product** (DU + record), language-neutral; C# `sealed record`
is a derived projection (F# already does this: objects from
functions, not the other way). Functional is the math; OOP is
the wrapper. Harder to recover function from class than class
from function.

## Product vs framework

As many product lanes as make sense; **bundle related**; keep
the cut. Frameworks are *used by* products; products (or
services on them) are *sold*. Both may own a repo. The line
blurs when the customer is a developer — say so, don't flatten.
`Port` is the hexagonal-port coinage, not Total Recall, not a
product name unless we are selling one. Nucleus stays the
plugin microcore those products host.

Aaron 2026-08-27, on TypeSchema + Debezium/CloudEvents, Caché,
CTE/NULL holes, Jumprope and ZetaId:

> oh for our typeschemas from dynamicvalue we are going to need
> to tie in our Debezium, cloud events envelope over any
> transport, this was a schema envelope and our object schem and
> our dataschema are one in the same if done correctly, we have
> MUMPS like statics but DI inject for this and a lot of
> researcdh aroudn the InterSystems Caché database they are
> very close to getting this correct but not as decentralise as
> us and assume every node loads the same objects, we all for
> divergence per node and reconcelation over time, this is what
> build independence. we can also simulate multi node on a
> single machine with latest cuttin edge DoP=1 to DoP=N scale
> free research. … this is very similar to our sql server
> monadic emulation over recursive CTEs and using null as a
> monadic extension operator, I worked on this with Diana duncan
> at Itron … we build a meter simulator at Itron based on these
> concepts in SQL PDW so it was also extreemly parallizable and
> we could simulate monadic behavior in SQL with NULL kind of
> like holes for the CTE to expaqnd into with generated data for
> that dimension. Jumprope CAS-not-pointers is very similar to
> our futamara except instead of needing CAS we do content based
> addressing, our zetaids are stable pointers and can require
> CAS if the object they point to changes over time, this could
> likely benefit from jumprope.

## One schema, three names — envelope = object = dataschema

`EventEnvelope.fs` already ships CloudEvents 1.0 (`specversion` /
`id` / `source` / `type` / `data`) and Debezium `op` as a Z-set
weight (+1 create/read, −1 delete, update = −1 then +1).
CloudEvents `dataschema` is the URI for the payload type.
Debezium's envelope schema names the before/after/op/source
frame. TypeSchema names the object.

Aaron: those three are **one TypeSchema** if the IR is honest.
Do not run a schema registry, an object schema, and an envelope
schema as three evolving artifacts. One DynamicValue, many
transports (the CloudEvents *over any transport* clause).
Debezium CDC is the delta; the envelope is the bus; TypeSchema
is the type of both.

MUMPS/Caché statics (`^` globals, process-private) become
**injected** (DI / Nucleus), not ambient — manifesto §13. The
Caché analog is already the commercial Beacon
(`docs/agendas/zeta/AGENDA.md`). The cut this session names:
Caché assumes **every node loads the same objects**. We allow
**per-node divergence and reconcile over time**. That
divergence *is* independence (anti-Babel: reconcilable, not
identical). Multi-node is the same ferry: DoP=1 on one machine
is the DST loop; DoP=N is N nodes. No special case.

## Difference-list holes and CTE NULL (same shape, not the same code)

Vokes's unbound tail is the hole. The SQL PDW meter-simulator
Aaron built with **Diana Duncan** (OSS co-credit GRANTED
2026-08-04, `DecorrelationMetrology.fs`; book naming still
proofread-gated) used **recursive CTEs** with **NULL as the
expansion hole**: the CTE binds the hole by generating the
dimension's data, PDW-parallel. That is monadic *emulation* —
NULL as a Maybe-shaped bind — not a claim that SQL NULL *is* a
monad (it isn't; three-valued logic leaks). Clean-room: the
requirement is "recursive expansion into named holes, generated
per dimension, embarrassingly parallel." Do not open the Itron
simulator.

## Jumprope, Futamura, ZetaId — do not fuse the two "CAS"

Jumprope **"CAS-not-pointers"** means **content-addressed
storage**, not mutex compare-and-swap. Hash *is* the pointer;
the skiplist height is a hash-as-probability (Pugh 1990 + Vokes).
Futamura specializes an interpreter against a program; Jumprope
specializes *location* against *content*. Similar move, different
axis.

**ZetaId is a stable name** (a pointer that survives content
change). When the object changes, the *blob hash* changes;
VISION's epoch is when a referrer decides new vs old. That is
the Jumprope/content-addressed path. Mutex **compare-and-swap**
on the pointer slot is a different operator. Do not use one
acronym for both. Benefit from Jumprope: keep the ZetaId, park
the current blob under a content hash, let epoch choose.

## What is missing

1. **The other three cells of the 4-way matrix, plus split.**
   `ProcessMany` must be clueless of `MaxBatchSize` (ferry
   splits = batch-batch(s)). `processOne` for batch-single /
   single-single. Today only single-batch exists.
2. **FourCorner per boat row + per-row failure.** `faultBoat`
   clones one exception onto every TCS. A row whose
   `TOutFeedback` is an error must not fail its sibling. Smallest
   falsifier (do not wire the heap record this slice): boat of 2
   ZetaIds, corners permuted, row-1 feedback=error without throw;
   row-0 still completes.
3. **ZetaId as the demux key.** Index alignment is boat-local.
   Muxed feedback over a bidirectional channel is how the
   transports already work; the other side demuxes by ZetaId, not
   by boat slot. `duplex-transport.ts` demuxes `normal|feedback|close`.
   Identity demux is the next increment on that wire, and the
   ferry row must carry the same key.
4. **TypeSchema from DynamicValue, as the one envelope/object/dataschema.** JSON AdditionalFiles is a
   bootstrap IR. Store-native constructor does not exist. Existing
   generators (`SchemaCodegen`, `SchemaSourceGenerator`, future
   `gen/` type providers) consume TypeSchema once it exists;
   they do not need a second IR.
5. **Guessed TypeSchema keeps the SoftValue.** Do not change
   `snap`. The schema-from-soft constructor carries
   `TypeSchema` plus the still-soft distribution, so reporting
   stays calibrated and `combine` after a guess still commutes.
   Snap-then-forget as the schema path leaks local collapse into
   the shared fold (sibling of
   `local-time-never-enters-the-shared-fold`).
6. **Tick-N loads tick-(N−1).** Named. Blocked on epoch
   (VISION DESIGNED). Do not fake a hot-reload over wall-clock.
7. **CLI kernel; ForgeHost verbs as Nucleus plugins.** Shared
   plugin host for verbs / nouns (k8s-controller shape: a verb
   is a controller, a noun is a typed resource). Extra-git is
   **not** Zeta and **not** Harny — it is already
   `src/Core.TypeScript/forge-host/`. Plug those verbs into
   Nucleus / the existing command core (roadmap item #1). Do
   **not** mint **Quay** (collides with Red Hat Quay). Do not
   mint a fourth CLI product named Forge either; Forge is the
   peer repo, ForgeHost is the extra-git surface. If a public
   binary name is later demanded: **Port** (hexagonal port /
   host-surface seam) is the coinage candidate, glossary-gated.
   Design, not this PR.

## Alloc / SIMD (honest)

`ProcessAsync` is not zero-alloc. Naledi (static graph, unmetered;
no FerryThrottler row in `docs/BENCHMARKS.md`): **5 heap objects
per item** on the unbounded `CancellationToken.None` path —
`TaskCompletionSource` + its `Task` + `FerryRequest` (class) + the
F# `task{}` outer `Task` + boxed CE state machine. Cancellation
registration is +1 when `ct.CanBeCanceled`. Boat buffers
(`items`/`requests`) are allocated once per ferry and cleared, not
per item. That is the current cost of the single-item awaitable
surface. Hypothesis for BDN `AllocatedBytes`, not a measured
baseline.

`fillBoat` is a `TryRead` drain. There is no dense numeric kernel
to vectorise. SIMD on boat assembly is a miss. If a *processor*
(the `processBatch` the caller supplies) has a columnar / numeric
inner loop, SIMD lives **there**, not in the throttler. Batching
is already the ferry's gift to that processor: one call, N items,
`ReadOnlyMemory`.

Do not add SIMD to the ferry this slice. Do not collapse the
single-item TCS away without a measured replacement for
"await this one item's result."

## Beacon

- **Van Jacobson**, *Congestion Avoidance and Control* (SIGCOMM
  1988) — ACK-clocking; the ferry's self-clocked boats (anti-Nagle).
- **Zhou et al.**, *FoundationDB* (SIGMOD 2021); Will Wilson,
  *Testing Distributed Systems w/ Deterministic Simulation*
  (Strange Loop 2014) — DoP=1 run loop.
- **Itron `IThrottler` / `MaxDegreeOfParallelism`** — requirement
  anchor for the dual-arity throttle (clean-room: the *need*, not
  the source).
- **FourCorner** as the bidirectional I/O pipe (in-tree
  `FourCorner.fs`; C₄ is a labeling, not Cl(p,q), not a fermion).
- **Linstedt**, Data Vault 2.0 — change-rate split: dumb store
  (hub/log) vs faster-changing control (satellites / stored procs).
- **Futamura**, partial evaluation / the three projections —
  compiler-compiler lives in the control plane.
- **Don Syme, Keith Battocchi et al.**, *Strongly-Typed Language
  Support for Internet-Scale Information Sources* (MSR, 2012) —
  type providers reify an external space; TypeSchema-from-store
  is that move against DynamicValue.
- **Kubernetes controllers + CRDs** — verb/noun plugin shape for
  CLIs (controller reconciles a typed resource). Not k8s-in-proc;
  the *shape*.
- **ADR 2026-04-22** three-repo split (Zeta / Forge / Ace) —
  ForgeHost extra-git verbs plug into Nucleus; do not mint Quay
  (Red Hat collision) or a fourth CLI product.
- **Alistair Cockburn**, hexagonal architecture — **Port** is the
  only new-name candidate if a binary is later demanded.
- **RFC 4918** §13 Multi-Status (HTTP 207); **RFC 9457** Problem
  Details citing 207 for heterogeneous subproblems. Indexed
  `completeBoat` is that shape; `faultBoat` is the whole-batch
  failure.
- **CloudEvents** CNCF 1.0; **Debezium** (Randall Hauch) —
  envelope `op` as Z-set weight. `EventEnvelope.fs` shipped.
- **InterSystems Caché** / MUMPS — closest commercial analog;
  same-objects-everywhere is the cut we refuse.
- **Diana Duncan** — recursive-CTE / NULL-as-hole meter-sim on
  SQL PDW; OSS co-credit granted (`DecorrelationMetrology.fs`).
  Book naming still proofread-gated (CONSENT-LEDGER).
- **David Greenberg**, Hitchhiker trees (buffers). **Scott
  Vokes**, *Data Structures: The Code That Isn't There* (Strange
  Loop 2012) — **difference lists** are the named holes (also
  difference trees/dictionaries); Jumprope + rolling hash are the
  two CAS styles. **Clark & Tärnlund**; **John Hughes** 1986
  (Hughes lists). **Karp & Rabin** 1987 / **Tridgell** 1999
  (rsync p.64). **Landauer** 1961 — vacuous error is heat.
  **Gordon Bell** — the cheapest component is the one that is
  not there.
- **Artin–Mazur** dynamical zeta — `SchedulerZeta.predict` (time).
  Space/occupancy (bit-0 usage) is the missing coordinate.

## Honesty

This document does not implement FourCorner-into-ferry, does not
add `ProcessMany`, does not write TypeSchema.ofDynamicValue, and
does not mint a CLI binary. Those are the P1 row. A white-room
agent is **not** dispatched on the strength of this absorb; the
gap is named in-tree.

Nagle is the thing we refuse (artificial delay to fill a boat).
The ferry already refuses it. The remaining defect is that a boat
row is a bare `'TItem` / `'TResult`, not a four-corner with a
ZetaId, and a boat fault is all-or-nothing.
