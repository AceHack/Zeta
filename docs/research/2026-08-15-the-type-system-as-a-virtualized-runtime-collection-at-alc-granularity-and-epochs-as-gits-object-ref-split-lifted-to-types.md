# The type system as a virtualized runtime — lazy yes, collection only at ALC granularity, and epochs are git's object/ref split lifted to types

**Date:** 2026-08-15
**Author:** the shadow (Otto's shadow-work role) — survey, falsifier, honest register.
**Provenance:** Aaron, 2026-08-15, in four parts, offered as one idea.

> "we can gc code generated with type providers, computational expressions and roslyn to some degree,
> or at least it does not all have to be loaded at once, and we use zetaid for our generated types too."

> "this makes type routing much more like virtualized actors from orleans but in our own type system
> runtime that can be described just by the compiler loading different parts of the database into the
> type system, or the same ones if parallelism is needed, not just distribution."

> "it will be via zetaid — all our types could content address to a zetaid, and if the code changes the
> zetaid changes. it's like built in versioning"

> "i think we are going to need some epoch based type addressing, because we are going to load types at
> a certain point in time and as types evolve so will their zetaids and the other types that reference
> those. So like when type A references B and then B changes, its zetaid changes, and then A will have
> to decide to point at the new or old one in the next epoch. things like that. this is a dynamic
> evolving type system over dynamic value and soft value and rx bonsai tree expressions that can all
> evolve in real time, independent for each agent, with coordination only on the git repos they share,
> and each agent has its own agent git repo."

**Register:** `toy` throughout, except the three claims the shipped test moves to `metered` (§4).
Falsifier: `tests/Tests.CSharp/TypeVirtualization/GeneratedTypeLoadContextIdentityTests.cs`.

***

## 0. The answer, before the reasoning

The thesis has parts, and they do not all hold. Naming which part holds is worth more than a unified
story, so:

| claim | verdict | where |
|---|---|---|
| **"it does not all have to be loaded at once"** (lazy materialisation) | **holds, and is how the mechanism already works** — erasing type providers expand types *only on demand*, by design | §2a |
| **"we can GC code generated with type providers, CEs and Roslyn"** | **holds in a much weaker form than it sounds**, and today, in this repo, **nowhere** — nothing generates a type at runtime | §2 |
| **"we use zetaid for our generated types too"** | **design intent, not as-built** — the ContentAddress ZetaId ships in four oracles; no type is keyed by one | §1, §10 |
| **Orleans virtual-actor mapping** | **holds on activation, deactivation, placement and multi-activation; breaks at the collector** | §3 |
| **content-addressing settles type identity** | settles **logical** identity by construction; leaves **runtime** identity untouched, and the CLR casts on runtime identity | §4 |
| **epoch-based addressing** | **the right shape, and it is git's** — immutable content-addressed objects + mutable named refs; and the repo already ships that split one layer down, in `ace` | §6, §7 |
| **git subsumes the Orleans framing** | **no — orthogonal, and both are needed.** The join is that an activation key is the *pair* (type ZetaId, epoch) | §7 |
| **epochs can be wall-clock** | **no, and the temptation is already in the tree** — `deps.ts` resolves "which version applies now" from an ambient `new Date()` | §8 |

Two sentences worth carrying:

> **Orleans virtualizes objects, and objects are GC-granular. Types are not GC-granular on .NET —
> the smallest collectable unit is an `AssemblyLoadContext`. The mapping breaks at the granularity of
> the collector, not at the identity of the thing.**

> **An epoch is not a new mechanism. It is a lockfile — a snapshot of the name→content-hash binding
> set — made content-addressed and given parents. `ace` already ships the lockfile; the work is
> lifting it from packages to types.**

***

## 1. What exists (surveyed, not assumed)

Every path below was opened and read on `origin/main` at `5f7bb5885`.

**The collector.** `src/Core/ShivaGc.fs` — mark-sweep over `DynamicValue` heaps with the Orleans
lifecycle already in it (`deactivateIdle`, `rootsFromTraffic`, `deliver`, `resume`, `minorGc`/`majorGc`,
tri-color incremental marking). Its carved sentence is load-bearing:

> *"you cannot GC baked code, but you can GC values."*

§2 is essentially a careful unpacking of which generation path produces "baked code".

**The generators — two, both compile-time.**

- `src/Core.CSharp.TypeProvider/SchemaSourceGenerator.cs` — a real Roslyn `IIncrementalGenerator`
  emitting a `sealed record` per `*.zetaschema.json`. Despite the project name it is **not** an F#
  type provider.
- `src/Zeta.Generators/ZSetWRingGenerator.cs` — emits `Zeta.Core.ZSetW_*` ring wrappers.
- `src/Core.CSharp/SchemaCodegen.cs` (+ TS/Rust siblings) — "approach B", a plain library rendering
  source; not a compiler component at all.

**There is no F# type provider in this repository.** No `[<TypeProvider>]`, no
`ProvidedTypeDefinition`, no `FSharp.TypeProviders.SDK` reference. The files naming an "IMDb/Wikipedia
type provider" (`src/Core/ImdbDataset.fs`, `LiveLegs.fs`, `TtlCache.fs`) are a dataset, live legs, and
a cache — the provider front end scoped in the 2026-06-19 doc was never built. Worth stating plainly,
because the thesis leans on type providers doing work that here nothing is doing.

**No runtime code generation of any kind.** Zero hits for `Reflection.Emit`, `AssemblyBuilder`,
`DynamicMethod`, `ILGenerator`. `AssemblyLoadContext` appears **only in prose** — threat models, memory
files, `docs/PRIMITIVE-REGISTRY.md` — and in **no** source file under `src/`. The brief's check comes
back: **collectible load contexts are used nowhere.**

**The ZetaId side.** `Category.ContentAddress = 9` is registered in `registry/categories.yaml` and
implemented in all four oracles. The payload is **119 bits** of a truncated BLAKE3-256 (`packGeneric`
spreads it over bits 0–64 and 69–122); `ContentHash256` is the full 256-bit proof tier. **Nothing
content-addresses a type**: `SchemaSourceGenerator.cs` and `SchemaCodegen.cs` contain no ZetaId
reference, and the nearest thing to a type registry, `src/Core/SchemaRegistry.fs`, is
`Map<string, Migration list>` — keyed by a hand-chosen string.

**The object/ref split already ships, one layer down, in `ace`.** This is the most important survey
finding for the epoch half:

- `src/Core.TypeScript/ace/package-hash.ts` — `packageHash(pkg)` = `blake3:` of
  `canonicalBytes({ manifest − signature, files })`. **Content identity, deliberately separated from
  authenticity.** This is a git object hash in all but name.
- `src/Core.TypeScript/ace/semver.ts` — ranges (a conjunction of comparators). The *named, mutable*
  half of the reference.
- `src/Core.TypeScript/ace/lockfile.ts` — `LockNode = { name, version, url, package_hash }`, built by
  `buildLockfile` from a successful resolve. **A lockfile is a snapshot of the whole name→content-hash
  binding set.** That is an epoch, already implemented, for packages.
- `src/Core.TypeScript/ace/solver.ts` / `resolve.ts` — the resolution itself.

**The breaking-change primitive exists too.** `src/Core/SchemaEvolution.fs`:

```fsharp
type Migration =
    { From: int
      To: int
      Up: DynamicValue -> DynamicValue
      Down: (DynamicValue -> DynamicValue) option }
```

`Down = None` **is** "this change is not invertible" — a typed, computable marker for a breaking
change, together with explicit forward-compat (old reader ignores unknown fields) and backward-compat
(new reader supplies defaults) semantics.

**The expression substrate is real.** `src/Core.TypeScript/bonsai/` (+ `src/Core/BonsaiSoft.fs`, the
F#/C#/Rust oracles) is a cross-language expression-tree serializer with a **canonical byte form**
(compact JSON, fixed key order per node kind, integer-only literals) and `golden-vectors.json`. A
canonical byte form is precisely what a content address needs, so Rx-bonsai expressions are
content-addressable *today* with no new machinery.

**The convergence discipline is already written down.** `src/Core/BeliefConvergence.fs` carries the
local-time invariant inline at `observeAll`, and states its own non-idempotence out loud
(*"NOT IDEMPOTENT — stated here because the omission reads as a guarantee"*). Both facts matter in §8.

***

## 2. What is actually collectable

Three ways, and conflating them makes "GC generated code" sound either trivial or impossible depending
on which one you had in mind.

### 2a. Erasing type providers — lazy and collectable, but nothing exists at runtime

Microsoft's type-provider documentation, checked:

> "A Type Provider can also ensure that groups of types are only expanded on demand; that is, they are
> expanded if the types are actually referenced by your program."

> "Erasing Type Providers produce types that … are **ephemeral**; that is, they are **not written into
> an assembly** … They can contain *delayed* members, allowing you to use provided types from a
> **potentially infinite information space**."

That entails Aaron's weaker claim exactly: **it genuinely does not all have to be loaded at once**, and
that is documented design, not aspiration. It also entails something the thesis should claim and does
not: the `ProvidedTypeDefinition` objects an erasing provider builds are **ordinary managed objects in
the compiler process**, collected by the ordinary GC. So on this path "GC the generated types" is
already true and trivially so — because they are *values, not types*, which is `ShivaGc`'s sentence
arriving from the other side.

The price: an erased type **does not exist at runtime at all**. Nothing to activate, route to, or
collect. Whatever a virtualized runtime type system is, erasure is not it.

### 2b. Generative providers, Roslyn generators, computation expressions — baked

A generative provider writes real .NET types into the assembly; a Roslyn generator contributes source
to the compilation; an F# CE is desugared into builder calls. All three finish before the program runs.
There is no "loaded" state to be lazy about and no "unloaded" state to collect into.

**This is where the whole repo sits.** On today's code the collection half of the thesis is not
partially true — it is not applicable. `Zeta.Core.ZSetW_IntegerRing` is as baked as `System.String`.
(A CE *builder* is an object and is collected normally; nothing about a CE makes a *type* collectable.)

### 2c. Runtime emit — collectable at exactly one granularity

Emit at runtime and the types can be unloaded **if and only if** the load context was built
`isCollectible: true`, and **only** by unloading the whole context. There is no API to collect one
type. The repo does none of this; the §4 test is the first collectible ALC in Zeta, and it exists to
falsify, not to build.

| path | lazy? | collectable? | exists at runtime? | in this repo? |
|---|---|---|---|---|
| erasing type provider | **yes, by design** | yes — as *compiler heap objects* | **no** | no |
| generative provider / Roslyn generator / CE | no | **no — baked** | yes | **yes, exclusively** |
| runtime emit into a collectible ALC | yes | **yes, per-context only** | yes | no |
| `DynamicValue` schema rows (`ShivaGc`) | yes | **yes, per-object** | yes | **yes** |

The last row is the only one where lazy **and** collectable **and** per-object granularity hold at once.

***

## 3. The Orleans mapping — structural on five properties, broken on one

| Orleans property | maps to types? | note |
|---|---|---|
| **Perpetual logical existence** — a grain always exists | **yes, strongest correspondence** | a schema-described type "exists" whether materialised or not; `ShivaGc`'s pause-not-death is this, for values |
| **On-demand activation** | **yes** | this *is* what an erasing type provider does, at compile time |
| **Idle deactivation** | **yes in principle** — `ShivaGc.rootsFromTraffic` is already the criterion | but see the collector row |
| **Transparent placement** | **yes** | argued in the 2026-07-03 doc via `ShivaGc.deliver`; Objective-C `forwardInvocation:` / Erlang `!` lineage |
| **Single activation by default, `[StatelessWorker]` for multi** | **yes, and better than expected** | below |
| **Activation is GC-granular** | **NO** | *this is the break* |

**The multi-activation point is a real match, checked.** Aaron's "or the same ones if parallelism is
needed" is `[StatelessWorker]`, and the documented semantics fit more closely than the analogy needed:
the runtime "can and does create multiple activations … on different silos"; it "automatically creates
additional activations … if the existing ones are busy", bounded per silo by CPU-core count; idle ones
"are eventually deactivated by the standard activation collection process"; and — the clause that makes
it coherent — **"stateless worker grain activations aren't individually addressable."** You address the
*type*, never the *activation*. Which is the content-addressing answer, arriving from Orleans' side.

**Where it breaks.** Orleans deactivates a grain by dropping the last reference to an **object**; the GC
then reclaims it individually, uncoordinated. Types do not have that property. So:

- **Addressing granularity is per-type** (one ZetaId per type — the whole point).
- **Collection granularity is per-load-context** (many types, unloaded together or not at all).

A design wanting both must either put **one type per ALC** — a loader heap, a resolution path and an
identity boundary *per type* — or batch types into **collection regions** and accept that a region is
retained by its hottest member. The second is a region collector for types, which is a real design and
is not what "virtual actors" means; the first is what it means and is prohibitively expensive.

***

## 4. The identity split, machine-checked

**Logical identity: solved by construction.** Same ZetaId ⇒ same type, necessarily. A changed type is a
*different* type with a *different* id (versioning free); two independently generated identical types
collapse to one id (structural dedup free). No convention, registry, or coordination.

**Runtime identity: untouched.** The CLR identifies a type by `RuntimeTypeHandle` *within an
`AssemblyLoadContext`*. Two activations in two contexts are two `Type` objects — casts fail,
`typeof(X) == typeof(X)` is false, generics do not unify.

Both are now **metered** rather than asserted.
`tests/Tests.CSharp/TypeVirtualization/GeneratedTypeLoadContextIdentityTests.cs` takes
`Zeta.Core.ZSetW_IntegerRing` — a type that exists *only* because the Roslyn generator ran — copies its
assembly to a second file, loads that into a collectible ALC, and asserts:

1. **`OneGeneratedTypeActivatedTwiceIsTwoDistinctClrTypes`** — identical `AssemblyQualifiedName`, **not**
   the same `Type`, neither `IsAssignableFrom` the other. The split is invisible to every name-based
   identity scheme, which is why it bites in production.
2. **`BothActivationsContentAddressToTheSameZetaId`** — two different files, byte-identical, BLAKE3 →
   119-bit payload → `Category.ContentAddress` ZetaId: **equal**. Flip one byte: **not equal**. Logical
   identity and versioning both hold, in the same test that shows runtime identity failing.
3. **`CollectibleLoadContextUnloadsWhenNothingReferencesIt`** — a collectible ALC does unload.

**Falsifiers, not decoration.** Mutation-checked: adding one static field that keeps the context alive
turns test 3 red with its own message (`Failed: 1, Passed: 2`); removing it turns it green. Five
consecutive runs, no flake.

### Two honest limitations of the test — both load-bearing

- **It content-addresses the assembly, not the type.** That is the only per-type-stable artifact
  available today and it is the *wrong* granularity: adding an unrelated type changes every type's
  address. A real implementation must address a **canonical per-type form**, which the repo already has
  in two places (`TypeSchema` / `*.zetaschema.json`, and the Bonsai canonical byte form). The test
  demonstrates the mechanism, not the right key.
- **119 bits is collision-resistant, not injective.** "Unique by construction" is true modulo a birthday
  bound near 2⁵⁹·⁵ distinct types. Comfortable; not a proof. The register should say
  "collision-resistant". The 256-bit `ContentHash256` tier exists if the compact form stops being enough.

***

## 5. The trilemma

> **Static CLR types · collectable · one identity — pick two.**

| you want | you get | what it costs | who does this |
|---|---|---|---|
| static types + one identity | **baked** | no collection, no runtime laziness | **the repo today** (Roslyn generators) |
| static types + collectable | **collectible ALCs** | identity splits per context | nobody here yet; §4 is the demonstration |
| collectable + one identity | **types as data, interpreted** | no static checking at the consumer | **`ShivaGc` + `SchemaRegistry` today** |

The repo already occupies two corners, in different places, for good reasons. Nothing here says the
middle corner is wrong — collectible ALCs are the standard plugin-host answer and they work. It says the
middle corner has a named, measured cost that content-addressing does not remove, landing on exactly the
operation Aaron singled out.

***

## 6. Epochs — the problem content-addressing creates, stated precisely

Content-addressing propagates change **upward**. If A's content includes B's id, changing B changes A's
id, and every referrer of A, transitively. That is the Merkle property: a leaf edit rewrites every
ancestor hash. So "built-in versioning" is not free — **any change re-identifies its entire dependency
cone.**

The resolution is that there are two reference disciplines, and they behave completely differently:

| discipline | A embeds | when B changes | property |
|---|---|---|---|
| **direct** | B's **hash** | A's id changes; propagates transitively | immutable, verifiable, reproducible, no ambiguity |
| **indirect** | B's **name**, resolved by an epoch | A's id is unchanged; A's *meaning* changes | evolvable, adoption is a decision |

Neither alone is sufficient. Direct-only means every upstream edit rewrites the world and nothing can
ever evolve in place. Indirect-only means nothing is reproducible and "which B did that build use" has no
answer. **Every mature system uses both**, under different names: git tree/commit hashes plus refs; npm
`package.json` ranges plus `package-lock.json` pins; Nix derivations plus channels.

**So an epoch is the indirection layer, materialised**: a snapshot of the name→content-hash binding set
that A resolves through. Aaron's "A will have to decide to point at the new or old one in the next epoch"
is exactly "the next lockfile either bumps B's pin or does not."

And the repo already has both halves at the package layer: `packageHash` (direct) and
`semver.ts` + `lockfile.ts` (indirect + pinned snapshot). **Epochs are not new machinery. They are
`buildLockfile`, lifted from packages to types.**

One refinement that matters and is easy to miss: **an epoch should itself be content-addressed and carry
its parents.** A bare integer epoch is a mutable global counter — a central point of coordination, which
§1 of the manifesto forbids and which the per-agent-repo design cannot supply anyway. A content-addressed
epoch with parent pointers is a *commit*: it has an id, it is immutable, it dedups, and its ancestry is a
partial order. That is the whole of §8's answer.

***

## 7. The git mapping, evaluated

The coordinator's read is that the shape of the answer is git's. It is, and closely — but not
everywhere, and the places it fails are informative.

| git | type system | holds? |
|---|---|---|
| **object** (blob/tree, content-addressed, immutable) | **type** (ZetaId over a canonical form) | **yes** — `packageHash` is already this, one layer down |
| **commit** (content-addressed snapshot + parents) | **epoch** | **yes**, and this is the refinement §6 argues for |
| **ref** (mutable name → hash) | the name→type binding an epoch resolves | **yes** — `semver` range + `lockfile` entry |
| **repo per developer** | **type system per agent** | **yes, literally** — the design says so, and `shared-checkout-is-view-only.md` already institutionalises clone-per-writer |
| **merge / conflict as a first-class outcome** | type-system reconciliation | **partially** — see below |
| **worktree** (one checkout at one commit) | **`AssemblyLoadContext`** | **yes, and this is the surprise** |
| **`git gc`** (unreferenced objects reclaimed) | type collection | **shape yes, granularity no** — git reclaims per object; the CLR cannot |

**The worktree correspondence is the payoff, and it validates the coordinator's reframe.** Two ALCs
holding different epochs of one logical type are not a bug; they are two worktrees checked out at
different commits — a normal, expected DVCS state. And the cost transfers with the correspondence:
**you cannot hand an object from one worktree to another and expect it to be the same thing.** You name
`(epoch, path)` and resolve, every time. Which is precisely the Orleans indirection — hold a reference
the runtime resolves, never a raw `Type` — arriving as a consequence rather than a workaround. The
reframe survives contact with the runtime.

It survives with one bill attached, which §4 already counted: an interface can cross an ALC boundary only
if the interface itself lives in a shared context, so the shared contracts cannot be among the virtualized
types. In git terms: the two worktrees must agree on the *protocol* for exchanging files even when they
disagree about the files. Nothing about epochs removes that.

**Where merge only partially transfers.** Git merges *trees*, with three-way text merge and a common
ancestor. What transfers is the **shape** — three-way against a merge base, conflict as a legitimate
outcome rather than an error — not the algorithm; a semantic type merge is not a line diff. And Zeta has
stronger primitives available: Z-set/CRDT merge is commutative *and* idempotent, which git's text merge is
not. That is a genuine upgrade, with one trap named in §8.

### Does git subsume the Orleans framing?

**No, and the coordinator's instinct is right: they are orthogonal and the design needs both.**

- **Git answers identity and evolution**: which B do I mean, how did it change, how do two diverged views
  reconcile. It says nothing about memory residency — a git object is either in the object store or it is
  not, and "activation" is not a concept.
- **Orleans answers activation and placement**: when is it resident, where, how many copies, what wakes it.
  It says nothing about versioning — a grain's *type* is fixed at deploy time, and Orleans' own version
  story (heterogeneous silos, grain interface versions) is a bolt-on precisely because the core model has
  no notion of an evolving type.

**The join is the key.** An activation is keyed by the **pair** `(type ZetaId, epoch id)`, and both
components are content addresses. This resolves the multi-activation question completely:

- two activations of the **same** `(id, epoch)` are interchangeable — the `[StatelessWorker]` case, and
  the CLR identity split between them is a genuine cost with no upside;
- two activations of **different** epochs are **different grains and ought to be distinct** — here the
  CLR's per-context identity is not a defect at all, it is the correct behaviour, and the §4 test is
  measuring the runtime doing the right thing for the wrong reason.

That is the sharpest thing in this document: **the ALC identity split is a bug for parallelism and a
feature for versioning, and epochs are what let you tell the two cases apart.**

***

## 8. The wall-clock hazard — and it is already in the tree

`.claude/rules/local-time-never-enters-the-shared-fold.md` is the standing guard: local wall-clock steers
local behaviour only; the shared conclusion sees agreed phase / logical order. **An epoch must be a
logical clock.** If two agents derive epochs from local time they load different type sets and their
shared fold diverges — the exact failure that rule was carved to prevent, arriving in a new place.

**The tempting surface exists today, and it is the only "which version applies now" resolver in the
repo.** `src/Core.TypeScript/ace/deps.ts`:

```ts
export function getResolvedVersion(node: DependencyNode, asOf?: Date): string {
  ...
  const refDate = asOf || new Date();
```

Same shape in `getMigrationPhase` and `checkRollbackSafety`. A `TemporalVersionSpec` carries
`{ current, future, migration-window: { start, end, mode } }` and the resolution compares an **ambient
local wall-clock** against those bounds.

Stated precisely, because the honest register matters more than the alarm:

- **This is not currently a violation.** `deps.ts` sits above Helm and below Flux/ArgoCD; it generates
  deployment manifests. Wall-clock migration windows are the right model for a scheduled rollout, and the
  function is *correctly parameterised* — `asOf` is injectable, which is what makes it testable and what
  keeps the entropy declared. Credit where due.
- **It is precisely the wrong shape to lift.** It is named "temporal version", it answers "which version
  applies now", and it defaults to `new Date()`. If epochs are built by generalising this function, the
  rule breaks silently — and silently is how it breaks, because each agent's answer looks locally correct.
- **The correct mechanism is already in the design**: the epoch DAG. Ancestry is a partial order, and a
  partial order by ancestry *is* the causal happens-before relation (Lamport). An epoch's parents are its
  logical clock; no timestamp is needed and none should be consulted.

**Git itself demonstrates both the right mechanism and the tempting wrong one, which is the most useful
form of the warning.** A commit carries author and committer dates that are ordinary metadata — settable,
skewable, non-authoritative — while the *authoritative* structure is the parent DAG. `git log` accordingly
offers `--date-order` ("show commits in the commit timestamp order") and `--topo-order` ("show no parents
before all of its children are shown"). The timestamp order is the default and convenient view; the
topological order is the true one. Any epoch design should treat a timestamp exactly as git does: fine for
display, never for resolution.

**A second, subtler trap, from the shipped code.** If epoch reconciliation is expressed as a fold over
evidence, note that `BeliefConvergence.observe` is **commutative and associative but explicitly NOT
idempotent** — the module says so in its own docstring. Merging the same epoch's evidence twice moves the
result. Git merge is idempotent (merging an already-merged commit is a no-op); a belief fold is not. If
epoch reconciliation borrows the belief fold, it needs an idempotency key (discipline #6), and if it
borrows Z-set/CRDT merge it gets idempotence for free. Naming which one a future implementation picks is
a real design decision, not a detail.

***

## 9. The judgment question — the machinery that exists

With hashes instead of semver, identity is unambiguous but **policy** is not: when B changes, does A pin
old B or adopt new B? Aaron's note is that the machinery exists — *"we track dependency chain side effects
of updates for back propagation and negotiation of breaking changes."* Found, and it is in two pieces of
very different maturity:

**Specified but not built.** `docs/backlog/P1/081KSGS9H0008QG0R0031PBNGA-…` — "Ace as package manager of
package managers", `status: open`, `decomposition: decomposed`, effort L. Sub-target 3 is exactly the
named thing: *"AI-rate continuous upstream negotiation (push-forward + absorb-forward at AI cadence — no
existing PM does this)"*, with Aaron's own framing quoted in the item: *"no package manager does ongoing
negotiation of trying to force people forward while sucking in upstream changes at the rate of AI …
helm needs time modeled in the dependencies like no others."* The item explicitly preserves operator
authority under `no-directives.md` — Ace surfaces the push, never overrides. So the negotiation frame is
**specified, decomposed, and unbuilt**, and epochs are the name its addressing layer was missing.

**Built, and better than expected.** The *computable* half of the policy is already shipped in
`SchemaEvolution.fs`. A migration carries `Down: (DynamicValue -> DynamicValue) option`, and
`Down = None` is a typed, checkable statement that a change is non-invertible. Combined with the module's
forward-compat (old reader ignores unknown fields) and backward-compat (new reader supplies defaults)
semantics, this gives a real decision procedure:

> If B_new is reachable from B_old by migrations that are invertible and compat-preserving, **A may adopt
> automatically in the next epoch**. If any step has `Down = None`, adoption is a **breaking change** and
> must be negotiated rather than inferred.

That turns "does A adopt?" from a declared intent (semver's major-version promise, which is a human
assertion and is routinely wrong) into a **computed property of the migration ops** — which is strictly
better, and is the thing hash-based identity was accused of losing. It does not lose it; it relocates it
from the version string to the migration algebra, where it can be checked.

**The honest limit, which must be stated because it is the failure mode.** `SchemaEvolution` compatibility
is about **data shapes**, not **use sites**. A change can be perfectly compat-preserving for the data and
still break a referrer — a widened numeric range, a semantic redefinition of a field that keeps its type,
a removed invariant nothing declared. So computed compatibility is **necessary, not sufficient**, and an
epoch adoption policy that treats it as sufficient will ship silent breakage. The sufficient version needs
use-site evidence, which is the part nothing in the repo has.

***

## 10. Is there a path today from a ZetaId to a materialised type?

No. Verified: no producer keys a type by a content address; `SchemaRegistry` keys by a hand-chosen string.

**The seam is one line wide.** `src/Core/SchemaRegistry.fs`:

```fsharp
/// The catalog: schema-id → ordered migrations.
type Registry = { Schemas: Map<string, Migration list> }
```

That `string` is the entire gap between "schemas as rows" and "types are content-addressed". Replacing it
with a ContentAddress ZetaId over the schema's canonical form gives, at once: content-addressed types,
free versioning, free structural dedup, and an idempotency key for materialisation — all at the **schema**
layer, where no CLR type exists to fight with.

**Smallest demonstrations, ascending cost:**

1. **Key `SchemaRegistry` by a ContentAddress ZetaId over the canonical schema form.** No new machinery;
   makes "built-in versioning" checkable with a golden vector. Squarely inside the free corner.
2. **An epoch as a content-addressed lockfile over those keys**, with parent ids — i.e. `buildLockfile`'s
   shape with `package_hash` → type ZetaId, plus parents. The falsifiable claim: two agents that fold the
   same epoch DAG resolve the same type set, and neither consults a clock.
3. **A resident-set experiment over schema rows** — materialise on reference, `deactivateIdle` the rest
   through `ShivaGc`, measure that the resident set tracks the referenced set. The virtual-actor lifecycle
   for types, executed at the layer where collection is per-object.
4. **Only then**, if static CLR types are genuinely wanted at runtime: one collectible ALC per
   *collection region* (never per type), consumers holding `(ZetaId, epoch)` + resolver rather than `Type`,
   cross-boundary contracts deliberately baked. The §4 test is the pre-written regression.

Steps 1–3 need no new concepts and would move real claims. Step 4 is a different project.

***

## 11. Corrections to the brief, stated explicitly

- **"Any existing type-provider work in the repo"** — the `TypeProvider` suite is a **Roslyn source
  generator**; there is **no F# type provider** at all. The distinction matters because the entire lazy
  half of the thesis is a property of *erasing type providers*, which do not exist here.
- **"The Orleans mapping does not hold"** — it *does* hold, on five of six properties, and multi-activation
  holds better than expected. It breaks on **collector granularity**, which is a sharper and more useful
  failure than "partial".
- **The framing that type identity being globally unique is the tension** — content-addressing settles the
  logical half and the CLR half survives, as the coordinator said. The refinement: **the identity split is
  a symptom; the granularity mismatch is the disease.** Even if the CLR unified type identity across
  contexts tomorrow, you still could not collect one type. And §7 adds the counterweight — for *versioning*
  the split is correct behaviour, not a defect.
- **"we use zetaid for our generated types too"** — recorded as design intent, not as-built.
- **`Category.ContentAddress` truncates to 119 bits** — "unique by construction" is collision-resistance,
  not injectivity. A peel, not a defect.
- **On the negotiation machinery: it is half-built, and the halves are uneven.** The negotiation *frame*
  (081KSGS9H0008QG0R0031PBNGA Sub-target 3) is specified and open; the *decision procedure* is shipped in
  `SchemaEvolution`. Building on the shipped half is the cheaper path and this doc recommends it.

***

## 12. Register — what moved, and what did not

- **`toy` → `metered`:** *"a generated type loaded into two collectible ALCs is two distinct CLR types with
  the same qualified name, while its bytes content-address to one ZetaId"* — falsifier shipped,
  mutation-checked.
- **`toy` → `metered`:** *"a collectible `AssemblyLoadContext` holding a generated type actually unloads"* —
  falsifier shipped, mutation-checked.
- **stays `toy`:** the virtualized-type runtime as a whole, and epoch-based addressing. Nothing materialises
  a type from a ZetaId, so there is no system to falsify — only a mechanism and an intent.
- **stays `unmetered`:** the claim that lazy materialisation gives a bounded resident set over an unbounded
  type space. Documented behaviour of type providers; **not measured here**, on anything.
- **owned uncertainty (1):** the §5 trilemma is a framing, not a theorem. It is falsified by any mechanism
  that collects a single CLR type without unloading its context. None is known to the shadow on .NET 10 —
  an absence of evidence, stated as such.
- **owned uncertainty (2):** the git mapping in §7 is an **analogy with named consequences**, and by the
  standard this repo applies to analogies (`numerology-vs-number-theory.md`) that is a generator, not a
  result. What makes it more than resonance is that one row is *checked* — `packageHash` + `lockfile` is
  literally the object/ref split, already implemented in this codebase for packages. The rest of the table
  is proposed, not demonstrated.
- **owned error:** the first draft of this document treated the Orleans identity split as purely a cost.
  §7 corrects that — for versioning it is the correct behaviour. I had the evidence in hand and drew the
  one-sided conclusion.

***

## 13. Anchors (checked, per `anchor-to-human-prior-art.md`)

- **Bernstein, Bykov, Geller, Kliot, Thelin** — *Orleans: Distributed Virtual Actors for Programmability
  and Scalability*, Microsoft Research MSR-TR-2014-41 (March 2014). Checked for the entailment used:
  perpetual logical existence + on-demand activation + idle deactivation. The `[StatelessWorker]` semantics
  quoted in §3 are from the current Orleans documentation.
- **Syme et al.** — F# type providers (MSR, 2012). The erased/generative distinction and the
  "expanded on demand" / "not written into an assembly" / "potentially infinite information space" language
  in §2a is from the current F# type-provider documentation, and is what the lazy claim rests on.
- **.NET `AssemblyLoadContext`** — collectibility and per-context type identity. Not taken on documentation:
  both are **measured** by the shipped test.
- **Lamport (1978)** — *Time, Clocks, and the Ordering of Events in a Distributed System*. The entailment
  used in §8: causal order is a partial order induced by the happens-before relation, and a DAG of parents
  is exactly that. Physical clocks are not required and are not authoritative.
- **Git's object model** (Torvalds, Hamano) — content-addressed immutable objects + mutable refs; the
  commit DAG as the authoritative order, with committer timestamps as non-authoritative metadata. Checked
  against `git log`'s own documented `--date-order` vs `--topo-order` distinction.
- **Merkle (1979)** — hash trees; the upward-propagation property §6 is a restatement of it.
- **Hewitt (1973)** — the actor model; **Alan Kay** — messaging as the core idea; **Armstrong** —
  location-transparent send. Already anchored in `ShivaGc.fs`; not re-argued.
- **McCarthy (1960)** — GC born alongside code-as-data: the duality this doc keeps meeting from the other
  end. What is *data* is collectable; what is *compiled* is not.

***

## 14. Scope — what this PR does not do, said plainly

The epoch material expanded the task well past one PR. What is here is the analysis and one falsifier;
what is **left**, deliberately and named rather than covered thinly:

- **No epoch implementation.** Not a type, not a schema, not a golden vector. §10 lists the ladder; step 1
  is a small, well-defined next PR and should be its own.
- **No change to `deps.ts`.** The wall-clock finding in §8 is a hazard for a *future* design, not a present
  bug — `asOf` is injectable and the function is correct for deployment scheduling. Changing it now would be
  fixing something that is not broken. It is recorded here so a future epoch design does not lift it.
- **No use-site dependency analysis.** §9's honest limit — compat is about data shapes, not use sites — is
  the largest unaddressed gap in the adoption story, and nothing in the repo covers it.
- **No `ShivaGc.fs` edits.** A sibling agent owns the lifetime/regeneration argument; this doc owns
  type-materialisation. Where they meet — that `ShivaGc`'s value-granular collection is *why* the third
  trilemma corner is free — is stated here as a finding about types, not a claim about lifetimes.
- **Not addressed:** whether Reticulum routing changes any of this (it does not — the break is in-process),
  and the design of a canonical per-type form for content addressing (named as required in §4, not
  specified; the Bonsai canonical byte form is the strongest existing candidate).
- **Prior work not duplicated:** `docs/research/2026-07-03-message-passing-makes-the-runtime-distributed-type-providers-reify-on-demand.md`
  already establishes messaging → distribution transparency and reify-on-demand + weak refs. This doc adds
  what was missing: which generation path is collectable, the CLR identity split, the collector-granularity
  break, and the epoch/git analysis.

***

## 15. Reproducing

```bash
dotnet build tests/Tests.CSharp/Tests.CSharp.csproj -c Release -m:1
dotnet test  tests/Tests.CSharp/Tests.CSharp.csproj -c Release --no-build \
  --filter "FullyQualifiedName~TypeVirtualization"
```

Three tests, ~70 ms. Note for whoever runs this next: `dotnet build` hit
`MSBUILD : error MSB4166: Child node "3" exited prematurely` once on this machine today; retrying with
`-m:1` succeeded immediately and cleanly. Recorded because a build that *crashes* and a build that *fails*
look identical in a log tail, and the exit code is the only thing that tells them apart.
