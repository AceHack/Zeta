# ShivaGC's missing half is a regenerability **oracle**, not a database — and there is no F# type provider

**Date:** 2026-08-24
**Measured against:** `origin/main` @ `8a8d011de`
**Origin:** Aaron, 2026-08-24 — *"for shivagc yes it's a toy we need to connect it to our zetadb/fs and
our futamara f# type providers and rosylin stuff to see what the next steps are, this is the first path
forward"*
**Goal, as stated:** *see the next steps*. This is an exploratory wiring study, not a production GC.

**Register:** `ShivaGc` stays **`toy`** — it still has no production consumer, and nothing here changes
that. One narrow claim moves to **metered** (§6): regeneration after collection is byte-identical *for
the reified-mix generator*, by a test that fails under four separate mutations.

**Why `docs/research/` and not `docs/DECISIONS/`.** No decision is being recorded. This measures a
state, refutes three premises (two of them mine), and ranks options — the shape of its three sibling
docs on this same thread (`2026-08-15-regeneration-does-not-replace-lifetimes-*`,
`2026-08-24-zetadb-is-bit-accurate-per-frame-*`, `2026-08-24-observably-infinite-nuf-*`). A DECISIONS
entry becomes right at step 2 of §8, when a connection point is actually chosen.

---

## 0. The short version

Three findings, in descending order of how much they change the plan.

1. **There is no F# type provider in this repo — none, in either mode.** Not erased, not generative,
   and no third-party provider is consumed either. `src/Core.CSharp.TypeProvider/` is a Roslyn
   incremental source generator that emits C# **record declarations**. It produces *types*. A garbage
   collector's regenerability predicate needs *values*. §3.

2. **ShivaGC's missing half is not storage — it is an oracle.** Wiring the collector to zetadb or
   zetafs would supply a place to *put* things, and the collector's problem is not where to put things.
   Its problem is that it has no way to know an object can be *rebuilt*. Those stores cannot answer
   that question: none of the three object shapes in the repo carries a generator, recipe, derivation,
   or provenance field. §4.

3. **The predicate `reachable OR NOT regenerable` fits the existing interface without breaking its
   purity — provided the oracle is INJECTED rather than stored on the object.** That is forced by
   compile order, not chosen for elegance, and it is demonstrated rather than asserted: §5 ships
   `ShivaGc.partition3` (a pure 10-line function) and a byte-identity falsifier that fails under four
   mutations.

The one-sentence version of what the collector was missing:

> **Reachability answers "is anyone pointing at this?" The question a regenerating substrate needs
> answered is "could anyone rebuild this?" — and no store in the repo records enough to answer it.**

---

## 1. Corrections to my own brief, flagged first

Per the discipline, the errors I was handed and the ones I made, before anything built on them.

| asserted | measured | who |
|---|---|---|
| "`ShivaGc.fs` has **zero non-test consumers**" | **False as stated.** `src/Core/Ephemeron.fs:69` calls `ShivaGc.mark` — a non-test consumer in `src/`. The precise fact is a **two-hop chain that terminates in tests**: `ShivaGc → Ephemeron → nothing`. `Ephemeron.fs` itself has zero non-test consumers. `toy` is still the right register; the *reason* is the chain's terminus, not an empty call graph | inherited (the claim also contradicts its own evidence table in workitem `081M0T55Q09087G0R0039QASD1`, which lists `Ephemeron.fs` as a mention) |
| "F# type providers erase types; Roslyn generators emit real source — so they are different mechanisms" | **False.** F# type providers are erased **or generative**; generative providers emit real .NET types. Erasure does not distinguish the two things | brief, self-corrected mid-task |
| "determine whether a genuine F# type provider exists" (implying `FSharp.TypeProviders.SDK` is the search target) | **Wrong search target**, and the answer is still NO. The repo's own concept is *"reified type providers over ZetaIds"* — 108 files under `src/` and `docs/` use `reified`. §3 answers both the question asked and the one meant | brief, corrected by Aaron |
| "the abandoned `Rx`+Shiva weak-ref file" | The self-labelled *"ABANDONED · ZERO importers"* file is **`src/Core.TypeScript/bayesian/shiva-weak-factor-graph.ts`** — a Bayesian factor graph, not an Rx file. No Rx dependency for ShivaGC was found; nothing here needs anything from `src/Core/Rx.fs` | inherited |
| "~65 files in `src/` name zetadb/zetafs" | **Confirmed** — 65 exactly. But the count conceals the finding: they are **two unrelated systems sharing a prefix**. §4 | inherited, refined |

**My own near-miss, owned.** The falsifier my brief proposed — *"collect an object, regenerate it,
assert byte-identity"* — is **already in the repo and is already vacuous for this purpose**.
`tests/Tests.FSharp/ShivaGc.Tests.fs:116` is named *"NOTHING DIES: partition then resume reconstructs
the heap byte-identically"*. It is a correct test of `resume`, but `partition` returns the paused
objects **whole** and `resume` concatenates them back, so the byte-identity is trivially guaranteed:
**the value was never dropped.** Writing the proposed test naively would have produced a second
passing check that measured retention and read as evidence of regeneration. §6 is built specifically to
avoid that trap, and says so in its header.

---

## 2. Measured current state of `src/Core/ShivaGc.fs`

346 lines before this change, `[<RequireQualifiedAccess>] module ShivaGc`, consuming only
`DynamicValue`. Pure throughout — no state, no clock, no I/O, no `WeakReference`. Four tiers:

| tier | functions | anchor |
|---|---|---|
| mark-sweep | `object'` · `heap` · `mark` · `collect` · `sweep` | McCarthy 1960 |
| pause-not-death | `partition` · `resume` | manifesto §5 |
| virtual-actor | `rootsFromTraffic` · `message` · `deactivateIdle` · `deliver` | Bernstein/Bykov 2014 (Orleans) |
| generational / incremental | `genHeap` · `allocate` · `minorGc` · `majorGc` · `tricolor*` · `writeBarrier` | Lieberman–Hewitt, Ungar; Dijkstra 1978 |

**Three measured facts that constrain every design below.**

- **`regener*` appears zero times in the module's code.** The retention predicate is pure reachability.
  A heap object is `{ id; value; refs }` and carries no recipe.
- **The `id` is not a content address.** `object'` takes an arbitrary caller-supplied `string`. The
  header says *"`id` is the object's content handle"*; nothing computes or checks `id = hash(value)`.
  This was already **refuted with a shipped test** (`ShivaGc.Tests.fs:310-346`), which constructs a
  heap with two objects sharing an id and shows `mark`'s `Map.ofList` keeps only the last, **collecting
  a child that a surviving object still references — a dangling ref produced by the collector.**
- **Compile order is load-bearing.** `Core.fsproj` compiles `ShivaGc.fs` at position **92**. Every
  mechanism that could answer "is this regenerable?" compiles *later*: `ContentStore.fs` 184,
  `DvKey.fs` 195, `GeneratorRegistry.fs` 365, `GeneratorIrRegistry.fs` 366. Under F#'s compile-order
  rule this module **cannot reference any of them.** `MixIr.fs` (90) is the one generator that *is*
  reachable — and §5 argues it still should not be referenced.

`partition` frees nothing. It returns `(resident, paused)` with paused holding full objects. That is
safe and it is the entire cost: with no way to tell rebuildable garbage from unrebuildable garbage,
**everything unreachable must be kept.**

---

## 3. Is there an F# type provider? **No** — plainly, with the evidence

Asked as posed, and as meant.

**As posed — the `FSharp.TypeProviders.SDK` mechanism: absent.**

- 1,329 `.fs` files grepped for `TypeProviderForNamespaces` / `[<TypeProvider` / `TypeProviderAssembly`
  / `ProvidedTypeDefinition` / `ProvidedProperty` / `ProvidedMethod` / `ProvidedTypes`: **exactly one
  hit, and it is a comment.** `src/Core/ImdbDataset.fs:20` — *"not the design-time `ProvidedTypes`
  wrapper (a follow-on slice)"*, which says the wrapper is not built.
- No file named `ProvidedTypes*` anywhere.
- Every `.fsproj`/`.csproj`/`.props` grepped for `FSharp.TypeProviders.SDK`, `FSharp.Data`,
  `SQLProvider`, `SwaggerProvider`, `FSharp.Data.SqlClient`: **zero.** `Directory.Packages.props` is
  the only version source and holds `FSharp.Core`, `G-Research.FSharp.Analyzers`,
  `FSharp.Analyzers.Build`. So no third-party provider is *consumed* either.
- Assembly attributes in `src/`: only `InternalsVisibleTo`. No `TypeProviderAssembly`.
- Directories matching `*provider*`: exactly two, both C# — `src/Core.CSharp.TypeProvider/` and
  `tests/Tests.CSharp.TypeProvider/`.
  > **[CORRECTED 2026-08-25]** True as stated, and it under-counted the thing §7 then tabulated.
  > `src/Zeta.Generators/` is a Roslyn `IIncrementalGenerator` too and does not match `*provider*`.
  > The name pattern was the wrong probe for "how many Roslyn generators are there" — the probe that
  > answers it is `grep -rl Microsoft.CodeAnalysis --include='*.csproj'`, which returns **two**.
  > See the correction on the §7 table.

**What `src/Core.CSharp.TypeProvider/` actually is.** Four files. `SchemaSourceGenerator.cs` is
`[Generator(LanguageNames.CSharp)] public sealed class SchemaSourceGenerator : IIncrementalGenerator`,
`netstandard2.0`, `IsRoslynComponent`. Input: `AdditionalTextsProvider` filtered to `*.zetaschema.json`.
Output: one `{TypeName}.g.cs` per schema containing a `public sealed record`. One consumer —
`tests/Tests.CSharp.TypeProvider/` — and no production project. **It emits a type declaration.**

Note the repo already considered and rejected this route for the same purpose:
`src/Core.CSharp/SchemaCodegen.cs:10` says in its own comment *"Unlike a Roslyn source generator
(approach A) this is a plain library — no `FSharp.TypeProviders.SDK`, no `Microsoft.CodeAnalysis`…"*.
Approach B is byte-locked (`SchemaCodegenTests.GeneratesExpectedRecordSource`, `IsDeterministic`);
**approach A inherits none of that coverage** — there is no `CSharpGeneratorDriver` test anywhere, so
the generator's output is unpinned.

**As meant — "reified type providers over ZetaIds": the concept is real and pervasive; the
`ZetaId → value` resolver is not built.** This is the finding that matters most for the predicate,
because the appealing hypothesis was that a provider keyed on a content-addressed ZetaId would
*witness* regenerability rather than merely assert it. Two measurements defeat it:

- **`GeneratorRegistry.idOf` hashes the NAME, not the content:**
  `let idOf (name: string) (version: int) : string = hash128 (sprintf "%s@%d" name version)` — FNV-1a
  over `"name@version"`. It addresses the *generator's identity*, never the *product*. A product also
  depends on its **inputs**, which this id does not capture. `GeneratorRegistry.collisions ()` exists
  because the module knows two implementations can share a `name@version`.
- **The 128-bit `ZetaId` proper is ULID-shaped by default.** `BitLayout.cs`: Version(5) ·
  **Timestamp(48)** · Chromosome(5) · Category(4) · Authority(5) · Persona(8) · Momentum(8) ·
  Location(8) · **Randomness(32)**. Content addressing exists as **one opt-in category out of sixteen**
  (`ContentAddress = 9uy`, a truncated BLAKE3 payload). Nothing requires a collected object's id to be
  minted in category 9.

So the premise *"a ZetaId is a content-addressed key, therefore the provider's existence witnesses
regenerability"* does not hold as stated. Stated in the register the repo requires: the resemblance is
real and the mechanism is absent — this is **"consistent with"**, not **"is"**. The nearest real thing
is `GeneratorIrRegistry.byZetaId : string -> ZSet<IrRow> -> IrRow option`, which resolves an id to an
**executable IR document** for nine hardcoded RNG/hash finalisers. That is genuinely
`address → recipe`, and it is the right shape — at nine rows of coverage, for hash finalisers, not
heap objects. It is filed forward at
`workitems/081KTHTPPCD08QG0R002FCS10E-zetaid-as-generator-128-bit-low-bandwidth-agent-regeneration.md`
(`state: backlog`).

---

## 4. zetadb and zetafs are two unrelated systems, and neither can answer the question

The 65-file count hides the structure. Split by language, they do not touch:

- **zetadb is TypeScript.** `src/Core.TypeScript/zetadb/zeta-db-node.ts` (844 lines) plus browser
  adapters. **There is no F# `ZetaDb` type** — the three `.fs`/`.cs` hits are doc prose in
  `src/Core/ZetaToolStore.fs` using "zetadb" as a nickname for a `ZSet<string>` event log.
- **zetafs is F#.** `src/Core/ZetaFs.fs` (387 lines), a Patricia trie over `ContentStore` hashed with
  `MerkleHash`; `ZetaFsDeltaLog.fs` (343) is a git-shaped loose-object store. **There is no TypeScript
  zetafs.**

They share no substrate, no record shape, and no hash function. "Connect ShivaGC to zetadb/fs" is
therefore two different tasks, in two runtimes, and **neither one supplies what the collector lacks.**

### 4.1 The three object shapes, and the field none of them has

| store | record | content-addressed? | carries a generator? |
|---|---|---|---|
| `ShivaGc` heap (in-memory, F#) | `{ id: string; value: DynamicValue; refs: string list }` | **no** — arbitrary caller string (refuted by test) | **no** |
| zetadb row (persisted, TS) | `{ rowKey: string; payload: string; weight: number }` | no — hashing happens *above* it in `zeta-db-storage-port.ts` and lands as a rowKey string | **no** |
| `ContentStore` / zetafs (F#) | `MerkleHash -> 'V` | **yes**, genuinely | **no** — `'V` is opaque |

Grepping `deriv|recompute|regenerat|materializ|recipe|provenance|lineage|rebuild|reconstitut|reclaim`
across `ZetaFs.fs`, `ZetaFsDeltaLog.fs`, `DagFs.fs`, `ShivaGc.fs` and all of
`src/Core.TypeScript/zetadb/*.ts` returns **doc-comment prose only**. zetadb's "materialized rows"
means *the Z-set fold of the ledger*, not a recomputable view.

### 4.2 Two structural obstacles beyond the missing field

- **The reference graph does not survive the crossing.** `refs` is what `mark` traverses; zetadb has no
  edge field at all. A ShivaGC heap written into zetadb becomes an unmarkable blob.
- **Neither store reclaims anything.** `ZetaFsDeltaLog.fs:214` admits it outright: *"The delta blobs
  are still on the disk and nothing collects them."* zetadb's only pressure mechanism is
  `noForgetBackpressureAdmissionPolicy` — it **refuses new writes** rather than forgetting old ones,
  and has a feedback code for `"database-capacity-exhausted"` but none for anything reclaimed.

**So the honest answer to the first path forward is a refusal of its framing:** connecting ShivaGC to
zetadb or zetafs does not produce a working collector, because the collector is not short of storage.
This is the outcome the brief named as a successful one — *connecting these two reveals the interface
is wrong* — with the correction that it is not the interface that is wrong. It is the **premise that
the missing half is a store.**

### 4.3 And the collector must stay distinguishable from Z-set retraction

`ShivaGc`'s own header calls collection *"a Z-set retraction (−1)"*. Keep these apart:

| | Z-set retraction | GC reclamation |
|---|---|---|
| means | **the fact was wrong or superseded** — a correction | the fact is still true, **nobody is looking at it** |
| history | the −1 **is** history; `+1 −1 = 0` is the group law | history is untouched; only the resident projection changes |
| recoverable? | recovering it would be **reasserting a retracted fact** | recovering it is **required** (§5) — pause, or regenerate |

Conflating them makes eviction look like a truth claim. The 2026-08-15 audit already found the
aspiration undischarged in the other direction — `collect` returns a `string list`, not a Z-set delta,
so collection does not currently compose in generation's algebra. **`partition3` deliberately does not
retract anything**: it returns three populations and drops nothing, so it cannot be mistaken for a
correction.

---

## 5. The predicate — and yes, the interface admits it

> **retain ⟺ reachable OR NOT regenerable**

Equivalently: **drop only what is unreachable AND regenerable.** Three classes, where there were two:

| class | condition | disposition |
|---|---|---|
| **resident** | reachable | the working set |
| **droppable** | unreachable ∧ regenerable | genuinely free — rebuild on demand |
| **paused** | unreachable ∧ ¬regenerable | **must** persist (manifesto §5) |

**Today's `partition` is the degenerate case `regenerable = fun _ -> false`.** That reframes the
existing collector: it is not missing a feature, it is running the maximally conservative instance of
this predicate — which is why it is safe and why it frees nothing.

**Does adding the disjunct break purity? No — if and only if the oracle is injected.** And the argument
is structural rather than aesthetic. A `gen` field on the heap object would change `object'`'s
signature (breaking), and a built-in check is **unexpressible**: §2 measured that `ShivaGc.fs` compiles
at 92, before `ContentStore` (184), `DvKey` (195) and `GeneratorIrRegistry` (366). Injection is also
what preserves the three properties the module already has:

- **purity / DST (§7)** — still `DynamicValue -> DynamicValue`, still replayable. A naive wiring to a
  live database would destroy exactly this, which is ShivaGC's main present asset.
- **noninterference (§13)** — the oracle is a *declared, metered channel*. No ambient dependency on a
  store, a clock, or the host GC. Contrast `SpecializationCache`, whose `Hits`/`Misses` are a public
  read-out of host-GC timing (§6.3 of the νF doc calls this the highest-remaining leak on the path).
- **interfaces free, classes earned** — a function argument, not a stateful collaborator.

Shipped in this PR, pure, and the whole of it:

```fsharp
let partition3 (regenerable: string -> bool) (roots: string list) (h: DynamicValue)
    : DynamicValue * DynamicValue * DynamicValue =
    let reachable = mark roots h
    let classify o =
        match objId o with
        | Some id when Set.contains id reachable -> 0   // resident
        | Some id when regenerable id            -> 1   // droppable
        | _                                      -> 2   // paused (incl. id-less)
    let pick k = objects h |> List.filter (fun o -> classify o = k)
    DynamicValue.Array(pick 0), DynamicValue.Array(pick 1), DynamicValue.Array(pick 2)
```

`partition3` **destroys nothing** — `droppable` is a *permission* granted by the oracle, not an act.
Whoever acts on it owes the byte-identity obligation in §6. An object with no `id` cannot be named to
an oracle, so it pauses — matching `partition` exactly.

---

## 6. The falsifier — and what it does and does not buy

`tests/Tests.FSharp/ShivaGcRegen.Tests.fs`, five tests. The generator is the **reified mix**:
`MixIr.mixCall` reifies a whole partial-evaluation invocation as one `DynamicValue` (the recipe);
`MixIr.runMixCall : DynamicValue -> Result<DynamicValue, string>` executes it. Pure, data-in/data-out,
deterministic — Futamura's `mix` over *retained inputs*. Byte-identity is measured with
`DynamicValue.toCanonicalCborOk` (the canonical CBOR that `DvKey` uses as its content address).

The test drops an object and rebuilds it **without reading the dropped value** — the replacement bytes
are produced by re-running the generator, not copied. That is the difference from the vacuous shape in
§1.

**Mutation results — every test fails without the change** (`dotnet test` rc captured directly, never
through a pipe):

| # | mutation | tests killed |
|---|---|---|
| M1 | oracle ignored: `regenerable id` → always droppable | 2 — COMPATIBILITY, THREE-WAY (§5 guard) |
| M2 | droppable/paused classes swapped | 3 — COMPATIBILITY, THREE-WAY, BYTE-IDENTITY |
| M3 | regeneration runs a **different** recipe (unfaithful generator) | 1 — **BYTE-IDENTITY exactly**; proves non-vacuity |
| M4 | `pick` duplicates every class into paused | 4 — all but the negative control |

M3 is the one that matters: it is the mutation the §1 vacuous test would have survived.

**Gate:** `dotnet build -c Release` → rc=0, **0 warnings, 0 errors**. `dotnet test Zeta.sln -c Release`
→ rc=0, **6,405 passed, 0 failed, 6 skipped** (Tests.FSharp 5,524 / 5,530).

**What this promotes, stated narrowly.** Regeneration after collection is byte-identical **for the
reified-mix generator** — `metered`. **`ShivaGc` itself stays `toy`**: still no production consumer,
still not content-addressed, and the oracle in general is only as sound as its caller. A wiring
exercise must not silently promote the thing it wires.

**What it does not touch.** The νF analysis (PR #14800) formalises reclaim as a **weak F-bisimulation**
with the resource envelope as a **high input** under Goguen–Meseguer noninterference, and names leaks
this test says nothing about: reference identity (`Assert.Same` distinguishes a regenerated object
trivially — and `SchedulerZeta.Tests.fs` already silently switched to a key projection to avoid it),
hit/miss counters, allocation failure under pressure (where noninterference is **false**, not merely
abstracted), and **identity fission** — two concurrent observers each miss and each regenerate,
producing two live copies. For a pure value that is invisible; for a grain it is a split identity, and
no bisimulation argument saves it. `partition3` is on the pure-value side of that line and must stay
there until single-activation exists.

---

## 7. Where the pieces actually are

The two halves of "content-addressed **and** regenerable" exist and have never met — the 2026-08-15
audit said so, and it still holds:

| mechanism | keyed by | produces | total? |
|---|---|---|---|
| `ContentStore.get` | `MerkleHash` (real content address) | `'V option` — a **lookup** | no |
| `SpecializationCache` (6 ports) | **nothing** — a retained closure | a delegate | **yes**, by excluding the generator from the collected set |
| `MixIr.runMixCall` | a full `MixCall` value | a residual **value** | yes, pure |
| `Cogen.compile` | grammar text | a serialized parser **value** | yes — `gen(gen)==gen` byte-locked |
| `GeneratorIrRegistry.byZetaId` | FNV id, 9 hardcoded rows | an IR **document** | within those 9 |
| `SchemaSourceGenerator` (Roslyn) | `.zetaschema.json` | a **type** | n/a |
| `ZSetWRingGenerator` (Roslyn) | **nothing** — four ring types hardcoded in `RegisterPostInitializationOutput` | four C# **static wrapper classes** | yes, over those four |

> **[CORRECTED 2026-08-25]** The row above was missing when this table was written, and its absence
> made the table read as "the repo has one Roslyn artifact". It has two, and the second is the more
> relevant one for the regenerability question this section is about:
> `src/Zeta.Generators/ZSetWRingGenerator.cs` (92 lines) is the **only Roslyn artifact in the repo
> that talks to F#** — it emits `ZSetW_{IntegerRing,IntervalRing,TropicalSemiring,RationalRing}.g.cs`,
> each wrapping the F# `ZSetWModule.*By` SRTP struct-witness generics with `default(TRing)` as the
> witness and `ValueTuple`→`System.Tuple` conversion at the boundary. It is the C#↔F# generic-math
> bridge. It takes **no** syntax or semantic input, which is why its `total?` column can say yes:
> the domain is a four-element literal list in the generator's own source.
>
> Consumed by `tests/Tests.CSharp/Tests.CSharp.csproj` (`OutputItemType="Analyzer"`); no production
> project references it — the same test-only status as `SchemaSourceGenerator`. Emits no diagnostics
> (`SchemaSourceGenerator` declares `ZTP001`).
>
> The correction was first written up in
> `docs/research/2026-08-25-shivagc-connection-analysis-zetadb-reified-type-providers-roslyn.md` §4.1,
> and `docs/research/2026-08-15-the-type-system-as-a-virtualized-runtime-collection-at-alc-granularity-and-epochs-as-gits-object-ref-split-lifted-to-types.md`
> had already listed both. This note lands it in the table that was wrong, because a reader who finds
> *this* table has no reason to go looking for a later doc that disagrees with it.

The gap is one signature: **`gen : Address → Value`, total.** Content addressing gives
`hash : Value → Id`, which is **one-way** — it lets you *verify* a value you already hold and can never
*produce* one. That is why §3's ZetaId hypothesis does not close, and why the verification half
(`ContentStore`) and the production half (`MixIr`/`Cogen`) are genuinely different jobs.

---

## 8. Ranked next steps

1. **Make the id a real content address, or stop calling it one** *(cheapest, unblocks everything)*.
   `ShivaGc.Tests.fs:310` already proves the premise false and shows the collector producing a dangling
   ref. Either add a smart constructor that computes `id = hash(value)`, or delete the claim from the
   header. **Everything below assumes the id determines the value; today it does not.** Note the
   constructor cannot live in `ShivaGc.fs` (compile order, §2) — so this is also the forcing function
   for deciding where the module sits.
2. **Give the oracle a real backing.** `partition3` takes `string -> bool`; a caller must supply it.
   The natural first is a `Map<id, MixCall>` recipe side-table — data, byte-lockable, DST-safe. Then
   generalise the recipe to `DynamicValue` so any pure `DynamicValue -> DynamicValue` generator
   qualifies. **Do not wire `SpecializationCache`**: its `WeakReference` puts the host GC on the
   replayed path and its public `Hits`/`Misses` are a declared §13 violation.
3. **Write the ZetaDB frame round-trip test** (`2026-08-24-zetadb-is-bit-accurate-*` §3 — cheap,
   obvious, absent). §6 is the object-granularity form of the same falsifier; the frame-level one
   promotes Aaron's *"bit-accurate per frame or it is a bug"* from assertion to invariant, and it is
   the **prerequisite for the object-generator compression**, not a parallel task.
4. **Version the generator by content hash.** The strong-generator/weak-product pattern requires the
   generator to be immutable for the lifetime of its products. `Invalidate()` is the primitive; the
   versioning discipline is unbuilt. This is where the Merkle DAG earns a role in *totality* — not by
   producing values, but by making "same generator" checkable.
5. **Then, and only then, consider persistence.** Once regenerability is decidable, `paused` is the
   only class that *must* be written down — and it is a much smaller thing to store than the heap. The
   zetafs `ContentStore` is the right home for it, and the ordering matters: §4 shows storage first
   buys nothing.

**Two things not to build.** A `gen` field on `object'` (breaking, and it puts the generator inside the
collected set — the one thing that must stay outside). And chained regeneration: depth is currently 1
everywhere, there is **no cycle guard on regeneration** — `mark`'s `seen` set guards *traversal*, not
*recomputation* — and `gen(A)` needing `B` needing `A` is non-termination, not slowness. If depth ever
exceeds 1, import Spark's `persist`/`checkpoint` and Griewank–Walther `revolve` as the cost model.

---

## 9. Register ledger

| claim | before | after | by what |
|---|---|---|---|
| a genuine F# type provider exists | assumed | **refuted** | §3 — zero attributes, zero package refs, one comment saying it is unbuilt |
| a reified provider over ZetaId witnesses regenerability | hypothesis | **not supported as stated** | §3 — `idOf` hashes `name@version`; ZetaIds are ULID-shaped, content-addressing is one opt-in category |
| zetadb/zetafs can supply the regenerability predicate | hypothesis | **refuted** | §4 — no derivation field in any of the three record shapes |
| ShivaGc has zero non-test consumers | asserted | **corrected** | §1 — one (`Ephemeron.fs:69`), in a chain that terminates in tests |
| the interface admits `reachable OR NOT regenerable` | open | **confirmed, with a constraint** | §5 — yes, iff injected; forced by compile order |
| regeneration after collection is byte-identical | asserted | **metered, for the reified-mix generator only** | §6 — 5 tests, 4 mutations, full suite green |
| `ShivaGc` is production-ready / not a toy | — | **still `toy`** | no production consumer; id still not a content address |
| collection is a Z-set retraction | aspirational | **still undischarged** | `collect` returns `string list`, not a Z-set delta |

## 10. Independence check (`numerology-vs-number-theory`)

The resonances here are dense — Trimurti, Futamura, Spark lineage, Rust `Arc`/`Weak`, weak
bisimulation — so they are triaged rather than counted. **Immutability plus content addressing alone
implies dedup, cheap verification, and safe recomputation**, so several of these share an ancestor and
their agreement carries less weight than their number. What is load-bearing here is not the coherence:
it is the four mutations in §6 and the compile-order measurement in §2, both of which could have come
out the other way. The claims that stayed prose — that a hexagonal port makes regeneration effect-safe,
that emergent structure will make the oracle cheap — are recorded as resonance and are not carrying any
code.

## 11. Pointers

- `src/Core/ShivaGc.fs` — `partition3` added here · `tests/Tests.FSharp/ShivaGcRegen.Tests.fs` — the falsifier
- `docs/research/2026-08-15-regeneration-does-not-replace-lifetimes-it-relocates-them-what-shivagc-actually-implements.md` — the mechanism audit this builds on; §8 first refuted the content-address premise
- `docs/research/2026-08-24-zetadb-is-bit-accurate-per-frame-or-it-is-a-bug-*.md` — the frame-level falsifier (step 3)
- PR #14800 `docs/research/2026-08-24-observably-infinite-nuf-*.md` — reclaim as a weak F-bisimulation; the leak list §6 does not close
- `workitems/081M0T55Q09087G0R0039QASD1-*` — Rx-joins-and-ShivaGc-wiring, stated as built / measured absent
- `workitems/081KTHTPPCD08QG0R002FCS10E-*` — ZetaId-as-generator (`state: backlog`) — where §3's missing resolver is filed
- `src/Core/MixIr.fs` — `mixCall` / `runMixCall`; its `defaultEvalDef` docstring names "The Shiva-GC seed"
- `src/Core.Abstractions/SpecializationCache.cs` + 5 ports — total regeneration, and the §13 counters not to wire
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `only-the-irreducible-is-primitive-generate-the-rest.md` · `interfaces-free-classes-earned-under-rules.md` · `dv2-data-split-discipline-activated.md` §7 §13
