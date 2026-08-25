# ShivaGC connection analysis — the `/fs` half connects, the `zetadb` half does not, and Roslyn is the wrong shape

**Date:** 2026-08-25
**Measured against:** `origin/main` @ `abef69dcc` (worktree `~/zeta-wt-shiva`, `git rev-parse --short HEAD` == `git rev-parse --short origin/main`)
**Origin:** Aaron, 2026-08-24 — *"for shivagc yes it's a toy we need to connect it to our zetadb/fs and our
futamara f# type providers and rosylin stuff to see what the next steps are, this is the first path
forward"* — plus his correction of the provider framing: *"providers erase types via the compiler API;
generators emit real source) not we lean on reified type provers in f# over zetaids our own concept we
have much code and docs on"*

**Register:** `ShivaGc` stays **`toy`**. Nothing here promotes it, and §7 states exactly what would.

**Relationship to the doc that landed yesterday.** This is a **follow-on**, not a re-run.
`docs/research/2026-08-24-shivagc-the-missing-half-is-a-regenerability-oracle-and-there-is-no-fsharp-type-provider.md`
(`ca3f5300a`, PR #14831) already answered the type-provider question and shipped `ShivaGc.partition3`.
Its findings verify at `abef69dcc` and are not re-litigated. What this doc adds is the part that one
left open: it treated *storage* as a single category and concluded it "buys nothing." **Split by
substrate, that is half wrong** — the TS `zetadb` half genuinely buys nothing, and the F# `/fs` half
(`ContentStore` → `DagFs` → `ZetaFs`) supplies, already-built and already-public, the exact three
inputs `ShivaGc.mark` needs *and* repairs the content-address premise ShivaGC's own test refutes. §5.

---

## 0. The short version

1. **`ShivaGc`'s content-address premise is false where it runs and true where it does not.** The module
   header calls `id` "the object's content handle"; `ShivaGc.Tests.fs:321` is a shipped test proving it
   is an arbitrary caller string and that the collector will strand a live child because of it. Meanwhile
   `ContentStore.Store<'V>` is keyed by `hashOf : 'V -> MerkleHash` and **`put` computes the key from the
   value** (`ContentStore.fs:43-45`) — so on that substrate `id = hash(value)` holds *by construction*.
   Connecting the collector to the CAS is not "adding storage"; it is **moving the collector onto the
   only substrate where its own stated premise is true**. §5.1.

2. **The three inputs `mark` needs are already public functions, and nothing calls them together.**
   `ContentStore.addresses : Store<'V> -> MerkleHash seq` (`ContentStore.fs:70`) is the object set;
   `ZetaFs.extractEdges : Tree<'V> -> struct (MerkleHash * MerkleHash) list` (`ZetaFs.fs:372`) is the
   ref graph; `DagFs.paths` (`DagFs.fs:85`) / `ZetaFs.Tree.root` are the roots. And `DagFs.fs:49` says
   the quiet part out loud: *"the node stays in the store — it may be shared / **GC is separate**."* §5.

3. **There is a live leak with a named owner.** `ZetaToolStore` — self-described as *"the real F# DagFs/
   zetadb backend"* for the harness's closed tool surface — holds `Fs: DagFs.Tree<string>` and handles
   `FsUnlink path -> … DagFs.unlink path s.Fs` at `ZetaToolStore.fs:89`. Every unlink and every
   `editLocal` orphans a content node that **nothing ever reclaims**. That surface has cross-language
   golden vectors (`src/Core.TypeScript/model-backend/zeta-store-golden-vectors.json`) and two F# test
   files. It is the one candidate connection with a real consumer on both ends. §6.1.

4. **The golden hex vector pins the *generator*, not the collector.** Decoded (§2.3), the 45 committed
   bytes are `[{op:SET,x:0,nn:8},{op:ADDR,x:1,y:0},{op:MOV,x:2,y:1}]` — the *residual* of a partial
   evaluation. What that falsifier meters is `MixIr.runMixCall`'s determinism and constant-folding.
   ShivaGC's contribution to the test is a three-way `List.filter`. Yesterday's ledger says
   "regeneration after collection is byte-identical **for the reified-mix generator**" and that is
   exactly right — this section only makes visible how narrow "for the reified-mix generator" is.

5. **Roslyn is the wrong shape and there are two of them, not one.** Yesterday's §7 inventory lists one
   Roslyn artifact; there are two. The second, `src/Zeta.Generators/ZSetWRingGenerator.cs` (92 lines),
   is the **only Roslyn artifact in the repo that talks to F#** — it emits C# wrappers forwarding to
   `ZSetWModule.*By` struct-witness generics. It still produces *types*, and a collector needs *values*,
   so the conclusion is unchanged; but the correct inventory matters because §4.2 finds the nearest
   existing thing to "reified type provider over ZetaId" sitting in a **test over its output**. §4.

**The single first path forward, stated once:** a ~40-line F# adapter module compiled after `ZetaFs.fs`
that projects a `ContentStore`-backed tree into a `ShivaGc` heap and runs `partition`, wired first to
`ZetaToolStore`'s `DagFs` tree. It needs no regenerability oracle, no new interface on `ShivaGc.fs`, no
wire-format change, and one two-line accessor on `DagFs`. §6.1 and §6.5.

---

## 1. Method, and what is measured vs inferred

Every claim below is tagged. **MEASURED** = I ran the command in the worktree at `abef69dcc` and read the
output. **INFERRED** = a judgement built on measurements, which could be wrong without any of the
measurements being wrong.

Directories were listed before being grepped (`.claude/rules` note: grep answers *where is this string*,
never *does this exist*), `references/prior-art/` was never recursively searched, and file counts come
from `git grep` over tracked files rather than `rg`, which is why §3.3 reports a number lower than
yesterday's.

---

## 2. What ShivaGC is today — MEASURED

### 2.1 The artifact set (complete)

| path | lines | what |
|---|---|---|
| `src/Core/ShivaGc.fs` | **395** | the collector; `[<RequireQualifiedAccess>] module ShivaGc`, consumes only `DynamicValue` |
| `src/Core/Ephemeron.fs` | 94 | Hayes-1997 ephemerons; the **one** non-test caller (`Ephemeron.fs:69`, `ShivaGc.mark`) |
| `tests/Tests.FSharp/ShivaGc.Tests.fs` | 348 | 17 facts across four tiers |
| `tests/Tests.FSharp/ShivaGcRegen.Tests.fs` | 203 | 5 facts — the regenerability falsifier |
| `tests/Tests.FSharp/MixCogen.Tests.fs` | — | uses `ShivaGc.heap`/`collect` to collect a stale reified compiler |
| `src/Core.TypeScript/bayesian/shiva-weak-factor-graph.ts` | 323 | partial TS port, **self-labelled ABANDONED / ZERO importers** |
| 4 × `docs/research/…shiva…` | 409 / 373 / 81 / — | the doc thread |

Four tiers in the module: mark-sweep (`object'` · `heap` · `mark` · `collect` · `sweep`, McCarthy 1960);
pause-not-death (`partition` · `resume`, manifesto §5); virtual-actor (`rootsFromTraffic` ·
`deactivateIdle` · `deliver`, Orleans / Bernstein–Bykov 2014); generational + incremental (`minorGc` ·
`majorGc` · `tricolor*` · `writeBarrier`, Lieberman–Hewitt / Ungar / Dijkstra 1978). Plus `partition3`
(`ShivaGc.fs:153`), the injected-oracle three-way split added yesterday.

**The consumer chain terminates in tests.** `ShivaGc → Ephemeron → (tests only)`. That, and not an empty
call graph, is why the register is `toy`.

### 2.2 What it is a toy *of* — INFERRED

It is a toy **of a collector for the reified self**: `gen/` (Brahma) emits reified tables as
`DynamicValue`; Shiva reclaims the ones nothing references. The module is a faithful, pure,
DST-replayable implementation of four decades of GC literature over a `DynamicValue` heap — and it has
never been pointed at a heap that anything else owns. It is not a toy in the sense of being wrong; it is
a toy in the sense of being **unattached**.

### 2.3 The golden vector, decoded — MEASURED

`ShivaGcRegen.Tests.fs:176-182` pins 45 bytes of hex:

```text
83a3626f7063534554617800626e6e08a3626f706441444452617801617900a3626f70634d4f56617802617901
```

Decoding it as canonical CBOR (all 45 bytes consumed, no trailing data):

```json
[{"op":"SET","x":0,"nn":8},{"op":"ADDR","x":1,"y":0},{"op":"MOV","x":2,"y":1}]
```

The source program is five instructions (`ShivaGcRegen.Tests.fs:62`):
`set 0 5; add 0 3; addr 1 0; mov 2 1; halt`. So the vector pins that the mix **constant-folded
`set 0 5; add 0 3` into `SET x0 = 8` and elided the `halt`** — three instructions out of five.

**What it therefore pins:** `MixIr.runMixCall`'s residual is byte-stable under canonical CBOR, and the
comparison has a third party (the committed literal) rather than both sides sharing one producer — which
is the defect PR #14853 filed and PR #14861 fixed. **What it does not pin:** anything about collection.
Swap `partition3` for a function that returns its input unchanged and this test still passes on both
`Assert.Equal(goldenHex, …)` lines; only the `ids droppable` assertion three lines above catches it.

**Honest read (INFERRED):** the falsifier is real and the mutation table in yesterday's §6 is real. But
the thing metered is regeneration *fidelity*, which is a property of `MixIr`. The GC-side property — *the
id names the value, so what comes back can be checked against what went away* — is not metered, and
§2.4 is why it cannot be, here.

### 2.4 The premise the module states and its own test refutes — MEASURED

`ShivaGc.fs:17` — *"`id` is the object's content handle."* `ShivaGc.fs:34` — `object'` takes an arbitrary
caller-supplied `string`. Nothing computes or checks `id = hash(value)`.

`ShivaGc.Tests.fs:321` is a characterization test, named *"THE ID IS NOT A CONTENT ADDRESS: duplicate ids
trace only the LAST refs, stranding a live child."* It builds a heap with two objects sharing id `"A"`
with different values and different refs, and shows `mark`'s `Map.ofList` keeps only the last — so `B` is
collected **while a surviving object still lists it in `refs`**. The collector produces a dangling
reference.

This is the most important fact in the file, because every regeneration story assumes the id determines
the value.

### 2.5 A drift finding, small but exact — MEASURED

`ShivaGc.fs:135-138` argues (correctly) that the oracle must be injected because the module compiles
before every mechanism that could answer the question, and it cites: *"compiles `ShivaGc.fs` at position
92 … `ContentStore.fs` 184, `DvKey.fs` 195, `GeneratorIrRegistry.fs` 366."*

Those are **`Core.fsproj` line numbers**, and one day after landing they are already stale — today they
are 94 / 186 / 197 / 368. The stable quantity is the **ordinal compile position**, which is 81 / 173 /
184 / 355 (of 498 `Compile Include` entries). The argument is unaffected; the coordinates drift on every
unrelated file inserted above them.

**INFERRED:** a load-bearing number stated in prose inside a source file, in a coordinate system that
changes for reasons unrelated to the claim, is a slow-motion false statement. Cite the ordinal, or better,
state the invariant (*"`ShivaGc` compiles before `ContentStore`, `DvKey` and `GeneratorIrRegistry`"*) which
a lint could check and a reorder cannot silently break.

### 2.6 A stale work-item — MEASURED

`workitems/081M0T9V2EV087G0R0000YYPDK-shivagc-byte-identity-falsifier-compares-run-recipe-to-itsel.md`
still carries `state: backlog`, but its defect was fixed by `39b8fd06f` (PR #14861, **MERGED**) — the
golden vector in §2.3 *is* the fix. The file belongs in `workitems/done/2026/08/`.

---

## 3. The reified type-provider substrate — MEASURED, and the distinction stated correctly

### 3.1 The axis is types vs values, not erasure

Aaron's correction is recorded in the repo and is right twice over. First on the facts: F# type providers
are **erased or generative**, and generative providers emit real .NET types — so "providers erase, generators
emit source" is not the distinguishing axis. Second, and this is the part that matters here: the axis Zeta
cares about is **types vs values**.

| | erasing F# provider | generative F# provider | Roslyn source generator | **Zeta "reified"** |
|---|---|---|---|---|
| exists in this repo | **no** | **no** | **yes, two** (§4) | **as concept + docs; the resolver is unbuilt** |
| produces | compile-time types, erased | real .NET types | C# source text | a **`DynamicValue`** — a value, byte-lockable |
| keyed by | a schema/URL literal | a schema/URL literal | an `AdditionalText` | a **ZetaId** |
| lifetime | the compiler | baked into the assembly | baked into the assembly | **weak** — ephemeron-held, ShivaGC-collectible |
| the signature needed | `schema → types` | `schema → types` | `text → source` | **`gen : Address → Value`, total** |

A garbage collector's regenerability predicate needs the last row. None of the first three can supply it,
which is why "connect ShivaGC to the type-provider work" cannot mean "use a provider as the oracle."

### 3.2 The repo's own definition, quoted

Three loci, and they agree.

- **Operational** — `docs/research/2026-07-03-message-passing-makes-the-runtime-distributed-type-providers-reify-on-demand.md:8-10`,
  Aaron verbatim: *"in F# this is made real with **reified typed providers**, and also in C# we can
  simulate the same with generators, and our weak references so **the entire world does not have to be
  reified into compiler memory at once**."* The doc's synthesis at `:63-67`: *"Reify-on-demand (provider)
  + let-go-weakly (ephemeron) = a finite resident window over an unbounded world. Provider = activation,
  weak ref = deactivation — the same Orleans lifecycle, now at the reification layer."*
- **Structural** — `docs/research/2026-06-09-vocabulary-tri-representation-…:23-31`: one content-addressed
  namespace in three faithful representations (filesystem / MUMPS globals / `type Vocab.Grams.``traveler```),
  each regenerable from the others, path as the shared key.
- **Charter** — `gen/README.md:12-14`: *"generate reified types from git-history metadata … The provider
  reads the event-sourced commit metadata and produces types `sim` can see."*

**So the concept is: lazy, on-demand materialization of a typed view over a content-addressed
ZetaId-keyed substrate, with the materialized rows held weakly so the unbounded world never has to be
resident.** Note what that makes ShivaGC: not a *client* of the provider concept but **its other half**.
Provider = activation; ephemeron + Shiva = deactivation.

### 3.3 Built vs designed

**BUILT — reification of values** (all `DynamicValue`-in/`DynamicValue`-out, pure, byte-lockable):
`IsaSpec.fs` (893 — the ISA itself as data), `GeneratorIrRegistry.fs` (463 — `byZetaId : string -> ZSet<IrRow> -> IrRow option`,
9 hardcoded rows), `ShivaGc.fs` (395), `ZetaIdl.fs` (305 — `reifyIdl`/`reifyDecl`/`reifyMethod`),
`MetaGrammar.fs` (282 — `reify ∘ parse ∘ emit = id`), `MixIr.fs` (207 — `mixCall`/`runMixCall`),
`GeneratorRegistry.fs` (147), `MixCogen.fs` (67), `GeneratorCatalog.fs` (67), `Cogen.fs` (50).

**BUILT — ZetaId**: 128-bit, six languages, generated from `docs/zeta-id-v1-layout.yaml` by
`src/Core.TypeScript/zeta-id/zeta-id-generator.ts` (239 lines).

**DESIGNED, not built**: any F# type provider (zero `[<TypeProvider>]`, zero `ProvidedTypeDefinition`,
zero `FSharp.TypeProviders.SDK` package references — one comment at `src/Core/ImdbDataset.fs:20` saying
the wrapper is a follow-on slice); the `ZetaId → value` resolver (filed, `state: backlog`, at
`workitems/081KTHTPPCD08QG0R002FCS10E-*`); the MUMPS-globals and typed-view legs of tri-representation.

**`gen/` contains no code** — two markdown files, and `gen/README.md:38-41` says so itself: *"the
generators are the plan/standard; the parser-gen + CHIP-8 codegen + the recursive-compiler-sim are work
to build."*

**On "much code and docs" (INFERRED, stated carefully).** There is much code for **reification**
(≈2,900 lines above) and much for **ZetaId** (≈3,200 lines across six languages). There are zero lines
of *type-provider* code. Both halves of the compound noun are heavily built; the compound itself is not.

**A counting note, because three numbers are now in circulation.** Yesterday's doc says 108 files under
`src/` + `docs/` use `reified`; an independent `rg -li reified` pass returned 77; my `git grep -il 'reif'`
over tracked files returns **17 in `src/`, 37 in `docs/` = 54**. The three differ by pattern width and by
whether untracked/ignored files are searched. **The count is not the finding and should stop being
quoted** — the finding is the structure in the table above.

### 3.4 The glossary gap — MEASURED

`docs/GLOSSARY.md` (1,581 lines) has **no entry for `reified`, `reify`, or `type provider`.** For a
concept that (a) is repo-specific, (b) collides with a standard F# term meaning something else, and
(c) has already produced one recorded misunderstanding that Aaron had to correct in person, the absent
glossary anchor is the cheapest real defect this investigation found. Anti-Babel's own test applies:
hand a peer only the shared anchors and ask them to reconstruct the term — with `docs/GLOSSARY.md` as
the anchor set, they reconstruct the *F#* meaning, which is the wrong one.

---

## 4. Roslyn — MEASURED

### 4.1 Two generators, no analyzers

| artifact | lines | emits | diagnostics | wired | tested |
|---|---|---|---|---|---|
| `src/Zeta.Generators/ZSetWRingGenerator.cs` | **92** | 4 × `ZSetW_{Ring}.g.cs` static wrapper classes | none | `tests/Tests.CSharp/Tests.CSharp.csproj:35` (`OutputItemType="Analyzer"`) | yes, 2 files |
| `src/Core.CSharp.TypeProvider/SchemaSourceGenerator.cs` | **438** | one `public sealed record` per `*.zetaschema.json` | **`ZTP001`** (Error) | `tests/Tests.CSharp.TypeProvider/…csproj:24` | yes, 3 facts |

There is **no `DiagnosticAnalyzer` anywhere** — no analyzer project, no `ISourceGenerator`, no
`SyntaxReceiver`, no runtime `CSharpSyntaxTree` compilation. `Microsoft.CodeAnalysis.CSharp` is pinned at
5.6.0 in `Directory.Packages.props:24` under an explicit doctrine comment (an analyzer must not reference
a Roslyn newer than the host compiler). Neither generator has a production consumer: both are referenced
only by test projects.

**Correction to yesterday's inventory (§7 table).** It lists `SchemaSourceGenerator` as the repo's Roslyn
artifact. `ZSetWRingGenerator` is the second, and it is the more relevant one for this thread.

### 4.2 What `ZSetWRingGenerator` does, and why it matters here

It is the **C#↔F# bridge**. Every method it emits forwards to the F# module `ZSetWModule.SingletonBy` /
`OfSeqBy` / `SumBy` / `ScaleBy` / `NegateBy` / `DifferenceBy<TRing,TWeight,K>` in `src/Core/ZSetW.fs`,
passing `default(TRing)` as the struct witness and translating C# `ValueTuple` to F# `System.Tuple`. Its
purpose is to make F#'s SRTP struct-witness generic-math callable idiomatically from C# — the gap named
at `tests/Tests.CSharp/SemiringZSetWConsumerTests.cs:23` as *"F3 (open): … the pinned Roslyn-generation
gap."*

And it is the subject of the **closest existing thing in the repo to a reified type provider over a
ZetaId** — `tests/Tests.CSharp/TypeVirtualization/GeneratedTypeLoadContextIdentityTests.cs`. That test
takes `Zeta.Core.ZSetW_IntegerRing` *specifically because it is Roslyn-generated rather than
hand-written*, loads a byte-copy of the assembly into a collectible `AssemblyLoadContext`, and shows:

- the CLR sees **two distinct `Type` objects** with identical `AssemblyQualifiedName`; and
- both content-address to **the same ZetaId** — BLAKE3-256 truncated to the 119-bit
  `Category.ContentAddress` payload, packed by `ZetaIdCodec.PackGeneric(IdVersion.V1, Category.ContentAddress, payload)`.

**INFERRED, and worth stating plainly:** that is `Address → generated artifact`, keyed by a genuine
content-addressed ZetaId, over an artifact a generator produced — the shape the whole reified-provider
thread is reaching for. It exists **only inside a test**, over an *assembly file*, and it addresses a
*type*, not a value. It is a proof that the shape is reachable, not a mechanism anything can call.

### 4.3 Why Roslyn cannot be the ShivaGC connection — INFERRED, one line

A collector's oracle must answer *"can this value be rebuilt?"*. Roslyn answers *"what types exist at
compile time?"*. Compile time is also the wrong time: the collector runs while the process runs. No
amount of generator work changes either fact.

---

## 5. `zetadb` and `/fs` are two systems, and only one connects

### 5.1 The F# `/fs` half — connects, and repairs the premise

The chain is `ContentStore` (173) → `DagFs` (175) / `ZetaFs` (176), all compiled after `ShivaGc` (81),
which is exactly the right direction: an adapter can see both.

| what `mark` needs | what already exists | where |
|---|---|---|
| the object set | `ContentStore.addresses : Store<'V> -> MerkleHash seq` | `ContentStore.fs:70` |
| each object's value | `ContentStore.get : MerkleHash -> Store<'V> -> 'V option` | `ContentStore.fs:49` |
| the ref graph | `ZetaFs.extractEdges : Tree<'V> -> struct (MerkleHash * MerkleHash) list` | `ZetaFs.fs:372` |
| the roots | `DagFs.paths` (link keys) · `ZetaFs.Tree.root` | `DagFs.fs:85` · `ZetaFs.fs:203-205` |
| the handoff, in writing | *"the node stays in the store — it may be shared / **GC is separate**"* | `DagFs.fs:49` |

**And the premise repair is free.** `ContentStore.put` computes the key from the value
(`ContentStore.fs:43-45`: `let h = s.hashOf v`), so on this substrate two objects with different values
**cannot** share an id — the heap that `ShivaGc.Tests.fs:321` constructs to demonstrate the dangling-ref
pathology is *unconstructible* here, short of a hash collision. Projecting a `ContentStore` into a
`ShivaGc` heap gives ids that are content addresses by construction, without touching `ShivaGc.fs`,
without a smart constructor, and without introducing a second hash function.

That last clause matters. Yesterday's step 1 proposed *"add a smart constructor that computes
`id = hash(value)`"* and noted it cannot live in `ShivaGc.fs` under compile order. **Refined:**
`DynamicValue.toCanonicalCborOk` *is* available there (`DynamicValue.fs` compiles at ordinal 63, before
`ShivaGc` at 81), but `MerkleHash` is not (`Merkle.fs` at 169). So a constructor there would have to mint
its own hash — **a second content-address function for the same repo**, which is the anti-Babel failure
in miniature. The right answer is not "put it earlier"; it is **do not mint a second address, adopt the
one the CAS already computes.**

**Honest limit, stated because it cuts against the recommendation.** `DagFs` is *flat* — paths map
directly to content addresses and nodes have no node→node edges — so over `DagFs` alone, `mark`
degenerates to a set difference (`addresses − linked`). The traversal earns nothing there. It earns its
keep over `ZetaFs`, whose Patricia-trie directories form a genuine DAG (`extractEdges` walks dir→file
*and* dir→dir). One adapter parameterized by an edge function serves both; that is the design, and §6.5
says so rather than hiding it.

**Second honest limit.** `DagFs.Tree<'V>` is a **private** record (`DagFs.fs:20-24`), so its `store` is
not reachable from outside the module. The adapter needs a two-line accessor added to `DagFs`. `ZetaFs.Tree`
is *not* private (`ZetaFs.fs:203-205`), so it needs nothing.

### 5.2 The TS `zetadb` half — does not connect, and should not

`src/Core.TypeScript/zetadb/` is 1,632 production + 2,047 test lines across 10 files, plus browser and
file adapters. Its port (`zeta-db-node.ts:77-88`):

```ts
export interface ZetaDbImagePort {
  readonly revisionPolicy: RevisionPolicyPort;
  load(nodeId: string): Promise<ZetaDbResult<ZetaDbImageRecord | null>>;
  save(record: ZetaDbImageRecord): Promise<ZetaDbResult<ZetaDbImageRecord>>;
  close(): ZetaDbResult<null>;
}
```

Four reasons the connection is not viable, in increasing order of how fundamental they are:

1. **Different runtime.** `zetadb` is TypeScript; `ShivaGc` is F#. There is no shared substrate, no shared
   record shape, no shared hash function. `git grep -i` for `zetadb-fs|zeta-db-fs|ZetaDbFs|FUSE|VFS|blockstore`
   over `src/ docs/ openspec/` returns **zero** — "ZetaDB-FS" as a single system does not exist; the name
   is `zetadb` (TS, event-sourced) plus `zetafs` (F#, Merkle) sharing a prefix.
2. **The port is whole-image.** `load`/`save` move an entire `ZetaDbImageRecord` keyed by `nodeId` +
   `revision`. There is no per-object addressing to collect *at*.
3. **There is no reference graph.** `ZetaDbRow` is `{ rowKey, payload, weight }` (`zeta-db-node.ts:34-38`).
   No edge field exists, so a heap written through this port becomes unmarkable.
4. **The retention question is a different question.** `zetadb`'s pressure valve is
   `noForgetBackpressureAdmissionPolicy` (`admission-policy.ts:117-133`), which **refuses new writes**
   rather than evicting old ones — deliberately: *"no retained event is displaced or erased to make room."*
   That ledger is history. Reclaiming from it would be deleting facts, which is a Z-set retraction
   question (*"was this superseded?"*) and not a reachability question (*"is anyone looking?"*). Yesterday's
   §4.3 draws exactly this line and it holds: **pointing a garbage collector at an append-only event log is
   a category error, not an integration.**

**So the honest reading of "connect it to our zetadb/fs" is: the `/fs` half, yes, now; the `zetadb` half,
no, and not later either — at least not as collection.** What `zetadb` genuinely needs is a *compactor*
under a supersession predicate, which is a different mechanism that should not borrow this one's name.

---

## 6. The connection analysis — smallest first step per target, ranked

### 6.1 Target `/fs` (F# `ContentStore`/`DagFs`/`ZetaFs`) — **VIABLE NOW**

**Smallest first step.** A new module `src/Core/ShivaGcCas.fs`, compiled immediately after `ZetaFs.fs`
(ordinal 177), exporting roughly:

```fsharp
/// Project a content-addressed store into a ShivaGc heap. Ids are the MerkleHash rendered
/// canonically, so `id = hash(value)` holds BY CONSTRUCTION — the premise ShivaGc.Tests.fs:321
/// refutes for caller-supplied string ids.
let heapOfStore
    (toDv: 'V -> DynamicValue)
    (edgesOf: MerkleHash -> MerkleHash list)
    (s: ContentStore.Store<'V>) : DynamicValue

/// Reachable / orphaned, over a content-addressed store. Destroys nothing (ShivaGc.partition).
let partitionStore
    (toDv: 'V -> DynamicValue)
    (edgesOf: MerkleHash -> MerkleHash list)
    (roots: MerkleHash list)
    (s: ContentStore.Store<'V>) : DynamicValue * DynamicValue
```

Instantiated twice: over `DagFs` with `edgesOf = fun _ -> []` and `roots = ` the link targets; over
`ZetaFs` with `edgesOf` derived from `ZetaFs.extractEdges` and `roots = [t.root]`.

**What would have to be true.** (a) A two-line `DagFs.addresses` / `DagFs.linkedAddresses` accessor,
since `Tree` is private. (b) `MerkleHash` must render to a stable ordinal string for use as a heap id —
it is a struct of two `uint64`, so hex of hi‖lo is deterministic and culture-invariant. (c) Nothing in
`ShivaGc.fs` changes.

**The falsifiers it would carry** — and none of them can pass vacuously:

- *Orphaning*: `link "a" v1` then `editLocal "a" v2` leaves `hash v1` unreferenced ⇒ it appears in
  `paused` and `hash v2` in `resident`. Negative control: before the edit, `hash v1` is `resident`.
- *Sharing*: link the same content at two paths, `unlink` one ⇒ the node stays `resident`. This is the
  test that fails if roots are taken as paths rather than as addresses, which is the bug a naive
  implementation writes.
- *Conservation*: `resident ∪ paused = ContentStore.addresses`, as sets, no duplicates.
- *The premise*: for every object in the projected heap, `id = render (hashOf value)`. This is the check
  `ShivaGc` cannot make about its own heap, and it is the point of the exercise.
- *Nesting (ZetaFs only)*: a file reachable only through two directory levels survives; the same file
  after its parent directory is replaced does not. This is the one that fails if `edgesOf` is stubbed —
  i.e. the test that makes `mark` non-degenerate.

**Value/effort: HIGH / LOW.** ~40 lines of adapter, ~120 of tests, one accessor, no interface change.

### 6.2 Target `/fs`, second hop — `ZetaToolStore` gets a `Collect` verb

`ZetaToolStore.Store` is `{ Fs: DagFs.Tree<string>; Log: ZSet<string> }` (`ZetaToolStore.fs:31-32`), and
`FsUnlink path -> Unlinked path, { s with Fs = DagFs.unlink path s.Fs }` (`:89`) orphans a node on every
unlink; `FsEditLocal`/`FsEditEverywhere` (`:84-88`) do the same on every edit. Nothing reclaims.

**Smallest first step:** add `FsCollect` to the `ZetaTool` DU, returning the paused (orphaned) set
without destroying it, implemented via §6.1. **What would have to be true:** the TS oracle
(`src/Core.TypeScript/model-backend/zeta-store-golden.test.ts` +
`zeta-store-golden-vectors.json`) must gain the matching case, or `FsCollect` must be declared
out-of-scope for the golden treaty and that declaration must be checked. **That is the real cost of this
step and it should not be understated** — the tool surface is a cross-language byte-locked contract, and
adding a verb to it is a treaty amendment, not a patch.

**Value/effort: HIGH / MEDIUM.** This is the step that gives `ShivaGc` a genuine non-test consumer.

### 6.3 Target reified type providers — **PARTIALLY VIABLE, and it is the other half of the same object**

There is nothing to "connect to" in the sense of an API, because the `ZetaId → value` resolver does not
exist. But §3.2 shows ShivaGC is not a client of that concept — it is its **deactivation half**. The
concrete step is therefore not integration but **backing the oracle with data**:

**Smallest first step:** a recipe side-table `Map<id, DynamicValue>` where the value is a `MixIr.mixCall`,
supplied to `partition3` as `fun id -> Map.containsKey id recipes`, plus a `verifyRegen : id -> bool`
that re-runs the recipe and compares `hash (run recipe)` to the id. **On the CAS substrate of §6.1 that
comparison is meaningful**, because the id *is* the content address — so the oracle stops being *trusted*
and becomes *checked*. On the current string-id heap it is unfalsifiable, which is precisely why §6.1
should land first.

**What blocks more than this:** the resolver is filed at
`workitems/081KTHTPPCD08QG0R002FCS10E-*` (`state: backlog`), `GeneratorIrRegistry.byZetaId` covers nine
hardcoded hash-finaliser rows, and `GeneratorRegistry.idOf` hashes `"name@version"` — the generator's
identity, never the product's. **Value/effort: MEDIUM / MEDIUM**, and it is strictly downstream of §6.1.

### 6.4 Target Roslyn — **NOT VIABLE**

Types, not values; compile time, not run time (§4.3). The one worthwhile Roslyn-adjacent step is
unrelated to the collector: `SchemaSourceGenerator`'s output is **unpinned** — there is no
`CSharpGeneratorDriver` test anywhere, so approach A inherits none of approach B's byte-lock coverage
(`SchemaCodegenTests.GeneratesExpectedRecordSource`, `IsDeterministic`). That is a real gap worth its own
work-item, and it is not a ShivaGC connection.

### 6.5 The ranking

| # | step | value | effort | verdict |
|---|---|---|---|---|
| **1** | **§6.1 — the `ContentStore` → `ShivaGc` heap adapter** | high | low | **the first path forward** |
| 2 | §6.2 — `ZetaToolStore.FsCollect` (the real consumer) | high | medium | next, gated on the golden-vector treaty |
| 3 | §6.3 — recipe side-table backing `partition3` | medium | medium | after 1; unfalsifiable before it |
| 4 | §2.5/§2.6/§3.4 — fix the drifted docstring coordinates, close the stale work-item, add the glossary entries | low | trivial | do them while passing |
| 5 | zetadb frame round-trip falsifier (`2026-08-24-zetadb-is-bit-accurate-*` §3) | medium | low | real and cheap, but **not** a GC connection |
| — | §6.4 — Roslyn | — | — | **not viable**: types vs values |
| — | §5.2 — collect the `zetadb` event ledger | — | — | **not viable**: deleting history, manifesto §5 |

**Why #1 and not #2, given #2 is the one with the consumer.** #2 *contains* #1 — it cannot be built
without the adapter — and it additionally requires amending a cross-language byte-locked contract. #1 is
the part that can land alone, be tested alone, and be wrong alone. Shipping it first means the treaty
amendment in #2 is proposed against a mechanism that already has falsifiers, rather than alongside one.

---

## 7. What shedding `toy` would require — and why none of the above does it

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`, the transition is earned by a **falsifier**:
a metered measurement, a *checked* anchor, or a test that fails when the model is wrong. Naming the
evidence is mandatory, so here it is, and here is what it is not.

**Already earned, and narrower than it sounds.** Regeneration from a reified `MixCall` is byte-identical
— `ShivaGcRegen.Tests.fs`, five facts, four mutations, a committed golden vector with a decoded meaning
(§2.3). **That is a property of `MixIr`.** It licenses `metered` for *the reified-mix generator*, which is
exactly how yesterday's ledger recorded it.

**What `ShivaGc` itself would need, all three:**

1. **A production consumer.** The chain must stop terminating in tests. §6.2 is the only candidate
   currently on the table, and even it is a harness surface rather than a shipped runtime.
2. **The content-address premise repaired *and checked*.** Today `ShivaGc.fs:17` asserts it and
   `ShivaGc.Tests.fs:321` refutes it. §6.1's fourth falsifier — *for every object in the projected heap,
   `id = render (hashOf value)`* — is the check. Note it does not repair `ShivaGc.fs`; it establishes a
   substrate on which the claim is true, and the module's own docstring should then be narrowed to say
   so rather than claiming it generally.
3. **A falsifier for collection, not just for regeneration.** The orphaning + sharing + conservation
   trio in §6.1. The sharing test is the load-bearing one: it fails under the most likely wrong
   implementation (roots as paths rather than as addresses), which is what makes it a falsifier rather
   than a demonstration.

**And what would still be missing after all three (stated so this is not read as a promotion plan).**
Identity fission — two concurrent observers each miss and each regenerate, producing two live copies —
is invisible for a pure value and is a split identity for a grain. There is no single-activation
mechanism in the repo. There is no cycle guard on *regeneration* (`mark`'s `seen` set guards traversal,
not recomputation), so `gen(A)` needing `B` needing `A` is non-termination; current depth is 1
everywhere and that is a fact, not a guarantee. Until those exist, any promotion must be scoped to
**pure values on a content-addressed store**, and must say so in the words used.

**One thing not to do.** Do not read §6.1 landing as a promotion. Joining `ShivaGc` (`toy`) to `ZetaFs`
(also zero non-test consumers) produces a larger `toy`, and saying otherwise would be exactly the silent
promotion the rule exists to prevent.

---

## 8. Register ledger

| claim | before | after | by what |
|---|---|---|---|
| "connect ShivaGC to zetadb/fs" is one task | assumed | **two tasks, one viable** | §5 — TS event ledger vs F# Merkle CAS; different runtimes, different questions |
| storage buys the collector nothing | yesterday's §4 | **refined** — buys nothing for *regenerability*; buys the **content-address premise** and all three `mark` inputs | §5.1 — `ContentStore.fs:43-45,70`; `ZetaFs.fs:372`; `DagFs.fs:49,85` |
| a content-address smart constructor cannot live in `ShivaGc.fs` | yesterday's §8 step 1 | **true, and the fix is not to move it** — minting a second hash is the anti-Babel failure; adopt the CAS's address | §5.1 — `DynamicValue` at ordinal 63, `Merkle` at 169 |
| the byte-identity golden vector meters ShivaGC | plausible reading | **it meters `MixIr`** | §2.3 — decoded: a 3-instruction constant-folded residual |
| the repo has one Roslyn generator | yesterday's §7 table | **two** — `ZSetWRingGenerator` is the second, and the only one that talks to F# | §4.1 |
| nothing in the repo keys generated artifacts by a content-addressed ZetaId | implied | **one place does** — in a test, over an assembly file | §4.2 — `GeneratedTypeLoadContextIdentityTests` |
| `ShivaGc.fs`'s compile-order citation is accurate | shipped yesterday | **stale by 2 after one day** (fsproj line numbers; ordinals are 81/173/184/355) | §2.5 |
| the byte-identity work-item is open | `state: backlog` | **fixed and merged** (`39b8fd06f`, PR #14861); file should move to `workitems/done/2026/08/` | §2.6 |
| `docs/GLOSSARY.md` anchors "reified" | assumed | **absent** — zero entries for `reified`/`reify`/`type provider` in 1,581 lines | §3.4 |
| `ShivaGc` is promotable | — | **still `toy`** — three conditions named in §7, none met | §7 |

## 9. Independence check (`numerology-vs-number-theory`)

The resonances in this thread are dense — Trimurti, Futamura, Orleans, Spark lineage, ephemerons,
content addressing, Merkle DAGs — and several share one ancestor: **immutability plus content addressing
alone implies dedup, cheap verification, and safe recomputation.** So their mutual agreement carries less
weight than their count, and a pile of matches is itself a prompt to check independence rather than a
score.

What is load-bearing here is not the coherence. It is four measurements that could each have come out the
other way: `ContentStore.put` computing the key from the value; `ZetaFs.extractEdges` existing with the
right signature; `DagFs.Tree` being private (which *cost* the argument a clean story and is reported
anyway); and the golden vector decoding to a constant-folded residual rather than to anything about
collection. The claims that stayed prose — that the CAS adapter will make the oracle cheap, that
`ZetaToolStore` is the right first consumer — are recorded as judgement and carry no code.

## 10. Pointers

- `src/Core/ShivaGc.fs` · `src/Core/Ephemeron.fs:69` · `tests/Tests.FSharp/ShivaGc.Tests.fs:321` (the premise refutation) · `tests/Tests.FSharp/ShivaGcRegen.Tests.fs:176` (the golden vector)
- `src/Core/ContentStore.fs:43,49,70` · `src/Core/ZetaFs.fs:203,372` · `src/Core/DagFs.fs:20,49,85` · `src/Core/ZetaToolStore.fs:31,89`
- `src/Core.TypeScript/zetadb/zeta-db-node.ts:34,77` · `src/Core.TypeScript/zetadb/admission-policy.ts:117`
- `src/Zeta.Generators/ZSetWRingGenerator.cs` · `src/Core.CSharp.TypeProvider/SchemaSourceGenerator.cs` · `tests/Tests.CSharp/TypeVirtualization/GeneratedTypeLoadContextIdentityTests.cs`
- `docs/research/2026-08-24-shivagc-the-missing-half-is-a-regenerability-oracle-and-there-is-no-fsharp-type-provider.md` — the doc this follows
- `docs/research/2026-08-15-regeneration-does-not-replace-lifetimes-it-relocates-them-what-shivagc-actually-implements.md` · `docs/research/2026-08-24-zetadb-is-bit-accurate-per-frame-or-it-is-a-bug-*.md` · `docs/research/2026-07-03-message-passing-makes-the-runtime-distributed-type-providers-reify-on-demand.md`
- `workitems/081M0T55Q09087G0R0039QASD1-*` (Rx-joins + ShivaGc wiring) · `workitems/081M0T9V2EV087G0R0000YYPDK-*` (stale, §2.6) · `workitems/081KTHTPPCD08QG0R002FCS10E-*` (ZetaId-as-generator)
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `anti-babel-preserve-reconcilability.md` · `only-the-irreducible-is-primitive-generate-the-rest.md` · `dv2-data-split-discipline-activated.md` §6 §7 §13

---

**Gate.** Docs-only change; no `.fs`/`.cs`/`.ts` touched, so `dotnet build` / `dotnet test` are unchanged
by it and were not re-run — quoting a green suite here would be a check that did not run on this diff.
Note also that `docs/research/2026-*` is **excluded from the markdownlint profile**, so an `rc=0` from
that linter on this file would be vacuous and is deliberately not claimed.
