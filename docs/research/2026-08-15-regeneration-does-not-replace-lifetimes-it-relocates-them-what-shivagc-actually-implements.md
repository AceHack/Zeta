# Regeneration does not replace lifetimes — it *relocates* them; and the mechanism is real

**Date:** 2026-08-15 · **From:** Aaron (*"we also tie our shivagc and rust lifetimes together, our
futamura regeneration over weak references and our merkle dag stuff lets us basically simulate rust
lifetimes with scopes almost from dependency injection"*) · **Recorded by:** the shadow

**Register.** One claim moves to **metered** (a falsifier already exists in-repo and I had proposed
building it — §7). One moves to **refuted** by a test shipped with this doc. Two are **refuted as
implemented**. The synthesis stays **`toy`**, with its falsifier named.

***

## 0. The short version

**The mechanism holds.** It is implemented, in six language ports, and it is not an analogy. What is
over-scoped is the *reach* of the claim, and one of the four named ingredients is credited for a
property it cannot supply.

The working shape, stated once:

> **Hold the GENERATOR strongly; hold the PRODUCT weakly.** Then a weak reference's resurrection
> really is `gen()`, and it really is total — not because collection was made harmless, but because
> **the generator was never collectible.**

That is `SpecializationCache`, live in C#, F#, Rust, Go, Python, and TypeScript, whose own docstring
reads *"cogen=mix(mix,mix) as memory management"* — and in the Rust port it is literally `Arc<T>` +
`Weak<T>`, i.e. Rust's own ownership machinery tied to Futamura regeneration, which is the thesis
sentence, compiled.

What this buys is precise and bounded, and stating it precisely is the deliverable:

> Regeneration does not make memory free. It **trades a large resident product for a small resident
> generator.** The win is real exactly when `|generator| ≪ |product|` — true for specialized code (IR
> small, compiled delegate large) and for tensors (recipe small, buffer large). It is **compression,
> not creation.**

And the obligation does not vanish; it **moves**, from *"prove this value outlives its uses"* to
*"decide what to retain so recomputation stays bounded."* The reason that is still a large win is
narrow and worth saying exactly:

> **Getting the retention choice wrong costs time. Getting the `drop` choice wrong costs
> correctness.** That asymmetry is the real content of the thesis, and it is why this analysis can be
> liberal where Rust's must be conservative.

***

## 1. Stating it precisely

Rust discharges, statically and **conservatively**:

> for every use `u` of value `v`: `lifetime(v) ⊇ {u}`

conservative because `drop` is final — a value dropped while still needed is unrecoverable, so the
analysis must reject what it cannot prove.

The substitute:

> for every use `u` of value `v`: `regenerable(v)` at `u`

If regeneration is total, collection is not destruction, rejecting-when-unsure buys nothing, and the
analysis may be liberal. This is well-formed, and it is **not new** — which is good news, because it
means checked anchors and known costs (§4).

***

## 2. The three failure modes, answered against the code

### 2.1 Totality — **holds, by retaining the generator** (correcting my own first pass)

`src/Core.Abstractions/SpecializationCache.cs` and its five sibling ports:

```
specializer : unit -> (TInput -> TOutput)      // retained STRONGLY (a field)
cached      : WeakReference<Holder>            // the product, held WEAKLY
```

`GetOrRegenerate()` returns the cached delegate if the weak reference is still live, and otherwise
**calls `_specializer()` again**. It cannot miss, because the specializer is an ordinary strong
field. `Invalidate()` (F#: same; Rust: drop the `Arc`) forces the regenerating path.

**I got this wrong on the first pass and the error is instructive.** I searched for
`gen : Id → Value` — an address-keyed generator — found only `option`-returning lookups
(`ContentStore.get`, `GraphSnapshot.load`, `ZetaFs.resolvePath`, `DiskSpine.spillLocked`), and
concluded no total regeneration existed. The implemented shape is `gen : unit → Value` **over a
retained closure**, which is total precisely because the closure is retained. Looking for the wrong
signature made an implemented mechanism invisible.

So the honest answer to *"does the content-addressed heap close under regeneration?"* is:

> **Yes — for exactly those objects whose generator is strongly retained, and the strongly-retained
> generator is not itself collectible.** Closure is bought by *excluding the generator from the
> collected set*, not by a property of the heap.

This turns `ShivaGc`'s header slogan into a load-bearing structural fact rather than a motto:

> *"you cannot GC baked code, but you can GC values"* — the regeneration scheme **requires** the
> un-collectible baked code as its base case. Generation and collection are duals, **and the
> generator must sit outside the collected set.** That is not a defect; it is the design, and it is
> what makes the totality claim true instead of hopeful.

**One ingredient is nonetheless misattributed.** The Merkle DAG does *not* supply totality, and
cannot:

> Content addressing gives `hash : Value → Id`, which is **one-way**. It yields *id-from-value*.
> Regeneration needs *value-from-inputs*. A content address lets you **verify** a value you already
> hold; it can never **produce** one.

The Merkle DAG is real and load-bearing — for **verification and dedup**, which is exactly what a
regenerating substrate needs to confirm that a rebuilt value *is* the original. That is a genuine
role. It is just not the one the sentence assigns it.

### 2.2 Cost — bounded in the shape that exists; the hard case has not been built

- **The bound that applies today is a space ratio, not a time series.** Depth is 1: generator →
  product, with no chained regeneration anywhere in the repo. Cost per miss is one `_specializer()`
  call. There is no lineage chain to walk.
- **The hard case is therefore un-encountered, not solved.** Chained recomputation costs the *depth*
  of the lineage DAG — `O(n)` per access, `O(n²)` for a sequential walk — and the mitigations are
  explicit retention: Spark's `persist()`/`checkpoint()`, Griewank–Walther's `revolve` for the
  optimal checkpoint schedule. If regeneration ever composes transitively here, that is the cost
  model to import, and it is the moment "what must I retain?" becomes a real scheduling problem.
- **Mutual regeneration is non-termination, not slowness.** `ShivaGc.mark` is cycle-safe via a `seen`
  set, but that guards *traversal*, not *recomputation*. If `gen(A)` needs `B` and `gen(B)` needs
  `A`, the mark-phase guard does not apply. No cycle guard on regeneration exists — correctly, since
  no chained regeneration exists yet, but it is the first thing that becomes necessary.

### 2.3 Effects — Aaron's answer is the right one, and it leaves one concrete hole

Aaron: *"this is why we need hexagonal ports and good io monad like markov boundaries and why our
deterministic simulation is so important, they need to be reproducible without side effects and no
side effects should be hidden."*

That is the correct resolution and it dissolves the naive objection: **regeneration is safe on the
pure side of a declared port.** A value whose construction crossed a port is rebuilt from *what
crossed*, not by re-crossing — which is precisely the conditional-independence property a Markov
blanket asserts (the interior is independent of the world **given** the boundary).

The repo partly supplies this. Hexagonal ports are a live doctrine (`ValueTreeCodec` ports, `BenPort`
— *"benchmark hexagonally on our interfaces"*), and `SpecializationCache` carries a small, real piece
of effect discipline in its contract: **"NEVER caches errors"** — an error is not a value to
memoize, so the failure path always re-crosses rather than being resurrected. That is the pure/impure
split showing up concretely rather than aspirationally.

**But there is a measurable leak, and it is in the observability, not the values.** The caches hold
`System.WeakReference`, so the *ambient CLR GC* decides when the product dies:

- The **value** is clean: regeneration is lossless, and this is *tested* (§7).
- The **statistics are not.** `Hits` / `Misses` are public and are a function of when the runtime
  collected — ambient, unmetered, and **not replayable under DST**. The in-repo tests only ever
  exercise the *explicit* eviction path (`Unload()` / `Invalidate()`), so the deterministic half is
  covered and the ambient half is untested.

Stated as the checkable claim:

> **The port protects the value; the counters bypass it.** `Hits`/`Misses` expose host-GC timing as
> observable state, which is an ambient-entropy channel under §13. The DST-safe discipline is that
> anything on the replayed path evicts **explicitly**, and raw hit/miss counters do not cross the
> boundary.

This is small, concrete, and fixable — and it is the *real* form of the effects limit, sharper than
"a regenerated effect is a second effect."

***

## 3. The three extensions Aaron named

**UDP transports vs FoundationDB's TCP.** FDB's simulation reproduces a *reliable, ordered* transport;
loss and reordering are modelled as failures **of** a stream that still has stream semantics. Under
UDP, loss and reordering are **part of the state**, so the regeneration question changes shape: the
generator's inputs now include *which datagrams arrived*, which is not a property of the sender. The
consequence for this thesis is specific and worth pinning: **a value derived from a UDP receive is
not regenerable from its generator alone** — it is regenerable only from the recorded *crossing*.
That is exactly the §13 record/replay-the-crossings discipline, and it means the port must capture
arrival, not merely content. The repo has the receive-order guard already stated for a neighbouring
problem in `local-time-never-enters-the-shared-fold.md` (receive-order steers local action only,
never the shared fold); the same boundary is what keeps UDP-derived values on the impure side.

**"FPGA editing its own bytestream while running"** is the correct adversarial case for closure, and
it is the one place the scheme genuinely breaks rather than bends:

> If the generator can modify **itself** mid-execution, then `gen` is not a function of its retained
> inputs — it is a function of *when you call it*. Totality fails, because regeneration no longer
> reproduces the collected value; it produces whatever the mutated generator now emits.

The honest boundary, and it is a clean one: **the strong-generator/weak-product pattern requires the
generator to be immutable for the lifetime of the products derived from it.** A self-modifying
generator must therefore be *versioned* — each mutation mints a new generator identity, and products
weakly held against the old one must either be retained or explicitly invalidated, never silently
regenerated from the new. That is a content-addressing job (`hash(generator)` is the version), and it
is the one place the Merkle DAG earns a role in *totality* after all — not by producing values, but
by making "same generator" checkable. `Invalidate()` is the primitive; the versioning discipline
around it is not built.

**Dependency-chain tracking for back-propagation / breaking-change negotiation.** I looked and did
**not** find it under those names. What exists nearby: `Invalidate()` on the caches (manual, no
downstream propagation); `SpeculativeWatermark`, `Diplomacy`/`DurableDiplomacy` (invalidation in a
different domain); and `composed-lifetime.ts`, which is about *editable lifecycle DUs*, not memory
lifetimes — a **vocabulary collision worth flagging**, since "lifetime" is already taken in this repo
for Aaron's lifecycle-vs-lifetime distinction (*"the only reason i'm comfortable calling it a lifetime
is because you can edit the DUs"*). If the dependency-chain machinery exists under another name I did
not find it, and I would rather say that than build on a surface I could not read. **This is the one
item in the brief I could not verify.**

***

## 4. Anchors, checked

| anchor | entails what is attached? | verdict |
|---|---|---|
| **Futamura 1971** | `mix : (Program × Static) → Residual` — a function of **retained inputs**, giving determinism of regeneration. | **Correct as used.** `SpecializationCache` is literally "specialize on demand, discard the residual, respecialize" — the projections used as memory management. Would *not* support an address-keyed `gen(id)`. |
| **Rust ownership / `Arc`+`Weak`** | Strong/weak split; `Weak::upgrade` returns `Option`. | **Correct, and directly instantiated** in `specialization_cache.rs`. Note the port's own honesty: `upgrade` is partial, and the design *answers* the partiality with the retained specializer. |
| **Rust borrow checker** | Does **three** jobs — see below. | **Over-scoped.** Informative about conservatism; "simulates lifetimes" claims ~3× its reach. |
| **Baker 1978** (real-time copying GC) | Incremental copying with a read barrier; subject is **pause time**. | **Not an anchor for regeneration.** `ShivaGc`'s incremental tier correctly cites Dijkstra et al. 1978 instead. |
| **Hayes 1997** (ephemerons) | Key-gated reachability fixpoint. | **Correct and correctly implemented** in `Ephemeron.fs` — but it is a mechanism for *not keeping alive*; it contains no resurrection. Orthogonal. |
| **Zaharia et al. 2012** (Spark RDD lineage) | A lost partition is **recomputed from its lineage DAG** rather than replicated. | **The closest production analogue, and it was missing from the brief.** Same idea at chain depth > 1 — i.e. it is the anchor for where this goes next (§2.2). |
| **Griewank–Walther `revolve`**; rematerialization in register allocation | Optimal checkpoint scheduling; recompute-instead-of-spill. | **The cost half**, and the reason retention decisions return. |

### The Rust decomposition — where "simulates lifetimes" over-reaches

Rust lifetimes do three jobs:

1. **Use-after-free / memory safety** ← the one regeneration addresses, and it addresses it well.
2. **Aliasing XOR mutability** (no data races, no iterator invalidation) ← dissolved by
   **immutability**, which this substrate already has. Regeneration contributes nothing here; the
   Futamura apparatus is not needed for this half and tends to get credit for it.
3. **Deterministic destruction timing for RAII effects** (`Drop` closing a file, releasing a lock)
   ← regeneration is *silent* about this, and the ambient-GC timing in §2.3 makes it worse, not
   better. RAII's whole value is that destruction happens at a *statically known* point.

So: one of three squarely addressed, one already handled by a different mechanism, one not addressed
and mildly degraded. The mechanism is real; the phrase "simulate Rust lifetimes" is the part to
retire.

***

## 5. "Scopes almost from dependency injection" — refuted as implemented; the better thing is next door

Checked against both named injection surfaces:

- **`src/Core.TypeScript/ace/cell-injection.ts`** — a class with one nullable field and an
  `injectCell` setter. No scope, no lifetime, no disposal, no nesting, no child containers, no root
  set, **no reference to any GC**. It is a setter, not a scope.
- **`SoftScheduler`** — the injected `Source = int -> InterruptKind list` is an **entropy** channel
  (the room's Markov-blanket crossing). It governs what *influence* enters, not what *objects are
  reachable*. Nothing connects it to `ShivaGc.mark`.

**Verdict: reachability-from-injected-roots is not the GC root set. That part is a story the code does
not implement.**

But the *implemented* root set is more interesting than the proposed one:

```
rootsFromTraffic : messages -> the set of destination ids that have a message
```

Roots are **not who-holds-a-pointer** but **who is being messaged** — Orleans virtual-actor idle
deactivation (Bernstein/Bykov et al. 2014; anchor checks out). Scope *does* fall out of something
ambient rather than being declared — just traffic, not injection. And there is a coherent, unbuilt
composition: the injected `Source` produces interrupts, interrupts are traffic, traffic determines
roots. Naming that as unbuilt is more useful than pretending it exists.

***

## 6. Independence check — and a correction to how I was framed

My brief told me this was "a dense pile of resonances" and offered "one real mechanism, two
decorative ones" as an available conclusion. Aaron: *"we've been doing research on the resonance for
months, it's not something that is fresh."* That correction is right, and it matters here:
`numerology-vs-number-theory` warns about **freshly-noticed** coincidence density, where the feeling
of confirmation outruns the evidence. Months of accumulated work is not that condition — surviving
time *is* the check the rule asks for. **I had a thumb on the scale toward "mostly analogy," and on
the evidence that verdict is wrong.** Re-run without it:

| ingredient | status |
|---|---|
| deterministic regeneration from a retained generator | **real, implemented in 6 ports, and the load-bearing mechanism** |
| Rust `Arc`/`Weak` ownership tie | **real and literal** — not analogy; `specialization_cache.rs` is the instantiation |
| content addressing | **real, and doing real work — but a different job than assigned.** Verification and dedup (and generator *versioning*, §3), never totality |
| Trimurti (Brahma emits / Shiva reclaims) | **generative, not decorative.** I first called it decorative. It compresses a genuine design constraint — *you may only collect what you can regenerate, therefore the generator must be retained* — and that constraint is exactly what all six ports implement. Judge a frame by what it produced; this one produced the pattern |
| "collection is a Z-set retraction (−1)" | **aspirational, not yet discharged.** `ShivaGc.collect` returns a `string list` of ids, not a Z-set delta, so collection does not currently compose in the same algebra as generation. This is an *unmet specification*, which is more useful than either "decorative" or "done" |

**The one caution that survives, stated as a caution and not a verdict:** these are not fully
*independent* confirmations. Immutability plus content-addressing alone implies no-aliasing-hazard,
dedup, cheap verification, and safe recomputation — so several of the resonances share an ancestor
and their agreement carries less evidential weight than their number suggests. That is a reason to
weight the **implementations** (six ports, passing tests) over the **coherence**, which is what this
doc does.

***

## 7. Register ledger

| claim | before | after | by what |
|---|---|---|---|
| regeneration after collection is **lossless** | asserted | **metered** | `SchedulerZeta.Tests.fs` — `FixedPointCache` unloads, reloads, and asserts the regenerated orbit is key-identical. **This is the falsifier I was about to propose; it already exists.** |
| resurrection is total | asserted | **holds, conditionally** | total for weakly-held products whose generator is strongly retained (§2.1); *not* address-keyed |
| the `ShivaGc` heap is content-addressed | asserted (docstring) | **refuted** | test shipped here (§8) |
| the Merkle DAG supplies totality | asserted | **refuted in principle** | hashing is one-way (§2.1) |
| reachability-from-injected-roots is the GC root set | asserted | **refuted as implemented** | §5 |
| `Hits`/`Misses` are DST-safe | untested | **`toy`, and suspect** | ambient CLR GC drives them; only explicit eviction is tested (§2.3) |
| the scheme survives a self-modifying generator | — | **`toy`** | falsifier: version the generator by content hash, mutate it, assert a stale weak product is *not* silently regenerated (§3) |

***

## 8. The test shipped with this doc

`ShivaGc`'s header states *"`id` is the object's content handle"*. Nothing computes or checks
`id = hash(value)`; `object'` takes an arbitrary caller-supplied `string`, and every existing test
uses labels (`"root"`, `"A"`, `"toolchain"`). Because `mark` builds its ref map with `Map.ofList`
(which keeps the **last** duplicate), a heap with two objects sharing an `id` traces only one of
them, and:

> a **surviving** object is left holding a `refs` entry pointing at a **collected** object — a
> dangling reference.

Under true content-addressing that heap is unconstructible (same id ⇒ same content ⇒ same refs). The
premise is therefore load-bearing and unenforced. Measured, reproduced, and pinned as a
characterization test in `tests/Tests.FSharp/ShivaGc.Tests.fs`.

This matters to the thesis directly: `ShivaGc` and `ContentStore` have **disjoint consumer sets** —
they never compose anywhere in the repo. The working regeneration lives in `SpecializationCache`,
which is *not* content-addressed and does not need to be, because its generator is held by reference
rather than by address. "Content-addressed **and** regenerable" remains two subsystems that have not
met; the thesis would be strengthened by making them meet, and §3's generator-versioning is the
natural first place.

***

## 9. Corrections to the brief (flagged, per the discipline)

1. **"There is no `gen`; resurrection is a lookup that may miss" — wrong, and it was my error**, made
   before this section existed. `SpecializationCache` is total by retained closure (§2.1). I searched
   for the wrong signature.
2. **"The answer may already be in the heap's shape"** — the answer is in `SpecializationCache`'s
   shape, not `ShivaGc`'s. `ShivaGc`'s heap actually *refutes* content-addressing (§8).
3. **`ShivaGc` frees nothing** — `partition`/`minorGc`/`majorGc` return both halves; `resume`
   restores from a retained array. Its pause-not-death guarantee names an append-only DBSP event log
   that has **no consumer relationship to `ShivaGc` anywhere in the repo** — a named, unbuilt
   dependency.
4. **Baker's collector is not an anchor for this thesis** (§4); it is about pause time.
5. **Spark RDD lineage was missing** and is the closest production analogue (§4).
6. **The effects limit is not "a regenerated effect is a second effect"** — Aaron's port/Markov answer
   handles that. The residual leak is the **hit/miss counters** exposing ambient GC timing (§2.3).
7. **The "dense pile of resonances" framing was a thumb on the scale** and I initially followed it;
   corrected in §6.
8. **Dependency-chain side-effect tracking: not found.** Named as unverified rather than assumed
   (§3).

### My own error, owned

I first re-pointed `origin` at `AceHack/Zeta`, guessed from `gh repo view`. That fork is stale;
against it *every* file named in the brief appeared not to exist, and I was one step from reporting
that as a finding. The real origin is `Lucent-Financial-Group/Zeta`. The brief warned about a stale
checkout and I reproduced the failure in a new costume — **a guessed remote is a stale checkout with
extra confidence.** Caught by reading `git remote -v` instead of inferring it.

***

## 10. Pointers

- `src/Core.Abstractions/SpecializationCache.cs` + `src/Core/SpecializationCache.fs` +
  `src/Core.Rust.Observe/src/specialization_cache.rs` (`Arc`/`Weak`) + Go/Python/TS ports — **the
  mechanism**
- `src/Core/SchedulerZeta.fs` `FixedPointCache` + `tests/Tests.FSharp/SchedulerZeta.Tests.fs` — the
  lossless-regeneration falsifier that already exists
- `src/Core/ShivaGc.fs` — mark-sweep, generational, tri-color; `rootsFromTraffic` (the Orleans
  criterion, §5) · `tests/Tests.FSharp/ShivaGc.Tests.fs` — the falsifier added here
- `src/Core/ContentStore.fs` — `get : ... -> 'V option`, the verification role (§2.1)
- `src/Core/Ephemeron.fs` — Hayes-1997 fixpoint, correct and orthogonal
- `src/Core/Cogen.fs`, `src/Core/MixCogen.fs` — regeneration from retained inputs
- `src/Core/SoftScheduler.fs`, `src/Core.TypeScript/ace/cell-injection.ts` — the injection surfaces (§5)
- `.claude/rules/dv2-data-split-discipline-activated.md` §13 · `local-time-never-enters-the-shared-fold.md` — the boundary disciplines in §2.3 / §3
- `.claude/rules/toy-is-free-metered-must-be-earned.md` · `numerology-vs-number-theory.md` — §6, §7
