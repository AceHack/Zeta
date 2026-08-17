# `sim` as the room runner — the injected-dependency seam is the product thesis, not a test-harness detail

**Date:** 2026-08-17 · **Author:** Otto (shadow) · **Work item:** `081M08802CZ087G0R0010ZE6FQ`
**Register:** design + one shipped increment. Every capability claim below is marked
**BUILT** / **DESIGNED** / **UNMEASURED**. Nothing here claims the entropy metering is sufficient.

---

## 0. The ask, verbatim

Aaron, 2026-08-17:

> "sim should be our room runner eventually, we have sim(ulate) mea(sure) cut like DNA but for our
> zsets/gsets over our rooms uncertainty, and cause inject real or deterministic simulation
> dependencies for the interfaces injected so they can be measured or simulated. and even in some
> simulation we want to allow for reticulum communications within the simulation once we can measure
> it accurate enough we are getting closer on the metering there for accidental entropy even from the
> system clock/interrupt by having our own IScheduler Zeta scheduler"

And the framing that decides what this document is *for*:

> "Think of rooms as a normal non tech person's way of understanding test frameworks and we are
> pushing rooms even further so they can handle prod traffic too via dependency injection so once a
> regular human sets up AI within rooms within their vaults of rooms this is basically the new
> programming interfaces for regular non technical humans. Addison is not technical and she came up
> with these concepts she has a dictionary around this."

Note the tense in both. "**eventually**" and "**we are pushing**" are statements of direction. This
document treats them as direction, not as claims that the capability has arrived.

---

## 1. The human anchor — Addison Cooper, *Genesis Concepts*

The vocabulary in this design is **not** factory shorthand, and the `anchor-to-human-prior-art` rule
requires naming its author rather than paraphrasing it into a parallel dialect.

**Addison Cooper**, *Genesis Concepts — Complete Index*, 2026-06-20 (privacy reconciliation
2026-07-02). Published at `lucent-financial-group.github.io/concepts.html`; **in-repo copy at
`docs/design/root-site-iris/Genesis Concepts.dc.html`**, which I verified matches the published text
for every definition quoted here. Framed there as "the base class library of meaning between
intelligences."

The four definitions this design answers to, verbatim:

| Concept | Definition (verbatim) |
|---|---|
| **Room** | *"uncertainty engine — not a folder"*, maintaining ledgers of *"known, unknown, assumed, disputed, and decided"* states |
| **Vault** | *"not an app — an institution"* — persistent container for work, agents, rooms, assets, governance |
| **Z-set** | *"reversible live state — the future stays flexible"* |
| **G-set** | *"grow-only history — the past cannot be un-happened"* |
| **DST** | *"requirement for truth"* |

**Register discipline:** *Genesis Concepts* is a **specification of intent**. It is cited throughout
this document as *the definition the code must answer to*, and **never** as evidence that a
capability exists. Where the implementation falls short of the definition, this document says so.

### 1a. Why the Z-set / G-set pair is the load-bearing half

Aaron's "sim(ulate) mea(sure) cut like DNA but for our zsets/gsets" and Addison's pair are the same
statement. The two sets are **the reversible present and the irreversible past**, and the verbs split
cleanly across them:

| verb | touches | why |
|---|---|---|
| `sim` | **Z-set** | drives the room; the live claim ledger stays retractable — "the future stays flexible" |
| `cut` | **Z-set** (reads only) | the boundary decision; it *reads* the live ledger to decide continue/close and must never *set* a claim's state |
| `mea` | **G-set** (writes) | banks the measurement; union-folded, idempotent, commutative — "the past cannot be un-happened" |

`mea` committing ΔU is therefore a **G-set write, irreversible by construction** — which is exactly
what `db/uncertainty/README.md` already independently requires of the uncertainty ledger
("commutative + order-free … idempotent / DST"). Two documents written for different reasons landed
on the same algebra; that agreement is the reason to trust it.

---

## 2. What I measured on `origin/main` — the brief's claims, verified and corrected

### 2.1 Verified as stated

| Claim | Status | Evidence |
|---|---|---|
| `clis/Verbs.fs:6` says the family is "PURE INTERFACE STUBS" | **TRUE** | verbatim at line 6 |
| `ISim<'a>` is `interface end` at line 31 | **TRUE** | verbatim |
| `ISim` has **zero** implementations | **TRUE** | the only references to `ISim` in the entire tree are the seven other lines of `clis/Verbs.fs` itself |
| `measure.ts` is the shipped half, `sim` the unwired half | **TRUE** | and `db/uncertainty/README.md` §Status says so in its own words |
| `SimFramework.fs` and `SimLoop.fs` exist | **TRUE** | 133 and 157 lines |

### 2.2 Corrections to the brief

**(a) `clis/` is not merely unwired — it is not compiled by anything.** No `.fsproj` or `.sln` in the
tree references `clis/`. So `ISim` is not an unimplemented interface; it is an interface that no
compiler has ever type-checked. This matters for §4: a defect in those signatures could not have been
caught.

**(b) `SchedulerZeta.fs` is not "our own IScheduler Zeta scheduler."** The brief identifies it as
Aaron's referent. Reading it, `SchedulerZeta` is about **Artin–Mazur zeta functions over scheduler
orbits** — recurrence detection, orbit period, `runToHorizon` fast-forward. The soft `IScheduler`
Aaron is describing is **`src/Core/SoftScheduler.fs`**. Both exist and both are real; they are
different things, and the naming collision is a live trap for the next reader.

**(c) The 10-file `IScheduler` list is right in count, wrong in kind.** The files listed do reference
`IScheduler`, but most reference it in a *docstring* (Rx `IScheduler` as the design anchor) rather
than implementing one. The actual injectable-scheduler substrate is `SoftScheduler.fs` +
`SimFramework.fs` + `SimLoop.fs` + `RecordedSource.fs` + `Clock.fs`.

---

## 3. **The headline finding: the room runner already exists**

The brief asked me to answer explicitly whether a runner already exists and, if so, what `ISim` adds.

**It exists, it is load-bearing, and it is good.**

### `src/Core/SimLoop.fs` — the `sim → mea → cut → loop` runner (BUILT)

`SimLoop.run` is *literally* the loop Aaron describes, already shipped:

```
sim  = drive the room's handlers for a bounded burst of ticks   (SimLoop.fs:86, SoftScheduler.driveK)
mea  = measure the state, banked BEFORE the cut                 (SimLoop.fs:94)
cut  = the boundary decision: continue or close                 (SimLoop.fs:99)
loop = repeat, under three finite rails                         (SimLoop.fs:100-102)
```

It is bounded by construction (laps / ticks / generator-millis, each clamped to ≥1 so no input can
disable a rail), its clock is **injected** (`clock: int -> int64`), and it has a real consumer —
`src/Core/DarkHallScheduler.fs` calls it at line 473 and threads its continuation tokens.

### `src/Core/SimFramework.fs` — the hexagonal port (BUILT)

`ISimHarness` + `Room<'S>` + `withSource`. Its docstring already states the doctrine: *"rooms do not
run ON a test framework; test frameworks adapt to ROOMS"*, with xUnit as one adapter at the edge.
This is the same idea as Aaron's reframe, written 2026-06-11.

### `src/Core/SoftScheduler.fs` — the seam itself (BUILT)

```fsharp
type Source = int -> InterruptKind list
```

**The dependency-injection point Aaron asked for is already built and already flag-free.** Three
membranes, one code path:

| membrane | what it is | where |
|---|---|---|
| `SoftScheduler.seedSource seed` | deterministic simulation, null I/O | `SoftScheduler.fs:46` |
| `RecordedSource.replay r` | recorded real I/O, replayed identically | `RecordedSource.fs:40` |
| any live source | production | caller-supplied |

I searched for an `isSimulated`-style flag on this path and found none. The substitution *is* the
mechanism.

### So what does `ISim` add? — the honest answer

**Over `SimLoop`/`SimFramework`: `ISim` as declared in `clis/Verbs.fs` adds nothing, and it could not
be implemented as written.** Two independent reasons:

1. **It is uninhabitable as a composition target.** `ISimVerb.Sim: ISeed * TimeSpan -> unit` returns
   `unit`. `IMeaVerb.Mea<'a>: IEffects * ISim<'a> -> IMeasurement` consumes an `ISim<'a>`. Nothing in
   the family produces an `ISim<'a>`. **The documented loop `sim |> mea |> cut` does not typecheck**
   — and because `clis/` is in no project (§2.2a), nothing ever told us. This is the concrete cost of
   an interface that no compiler reads.
2. **Its supporting types are empty where real types already exist.** `IDelta<'a> = interface end`
   while `ZSet<'K>` is a full DBSP Z-set with `sub`, `weightedCount`, and `support`. Reifying
   `IDelta` as anything other than `ZSet` would be a second, worse Z-set.

**This is not a criticism of `clis/Verbs.fs`.** Per
`.claude/rules/interfaces-free-classes-earned-under-rules.md`, pure interfaces are the *correct*
free default, and that file is doing exactly what the rule asks. The finding is narrower and worth
stating plainly: **the room runner was never the missing piece. `mea` was.**

---

## 4. The actual gap — `mea` has no shape

`SimLoop.run` takes:

```fsharp
(mea: 'S -> 'M)   // 'M entirely unconstrained
```

For an arbitrary `'M`, **nothing forces a lap's measurement to be a measurement of uncertainty**, and
nothing makes the lap ledger commutative or idempotent. Its one production consumer,
`DarkHallScheduler`, instantiates `'M = string list`. That is a log line, not a measurement.

So the loop is real and the ledger discipline is real, and **the two are not connected**. This is the
same seam `db/uncertainty/README.md` names as unbuilt:

> "**Not shipped:** `sim`, the ephemeral half of the pair, is an unwired pure-interface stub… Related
> but separate: `Finalizer.fs`, `ComputeReceipt.fs` and `SocietyUsefulWork.fs` all compute a ΔU, but
> **in memory, per tick or per computation** — none of them is keyed to a bug-fix and none reads or
> writes this folder."

---

## 5. **The gap that matters more: the five-way ledger does not exist**

The coordinator asked me to check whether the existing loop preserves Addison's five-way state or
collapses it. The answer is worse than "collapses":

> **Before this PR, `known / unknown / assumed / disputed / decided` had no representation anywhere in
> the tree.** I grepped every `.fs` and `.ts` file for `Disputed` and for `Assumed`. `Disputed`:
> **zero hits**. `Assumed`: two hits, both in `src/Core/TravelerRankLedger.fs:88,91`, and both are the
> unrelated statistics term *Assumed Density Filtering*.

The published definition of a Room — the load-bearing one, the one a non-technical user is told they
are getting — is *"uncertainty engine … known, unknown, assumed, disputed, and decided."* The
implementation had a bounded tick loop with an unconstrained `'M`. **That is a gap between the
published concept and the code, and it is larger than any single missing verb.**

Sharpest instance: **`Disputed` and `Decided` are the two states the substrate most needs and had
neither.** `Disputed` is conflicting evidence *held open* — the refusal to collapse. `Decided` is a
commitment made *under* uncertainty — a decision is not a proof. Collapse those into a boolean and
you have destroyed precisely the distinction a room exists to preserve.

### 5a. Answering the coordinator's second question: is `GLOSSARY.md` a parallel dialect?

**Partially reconciled, with the hole exactly where the runner lives.** `docs/GLOSSARY.md:1259`
carries a real section — *"Society identity (Genesis Concepts — Iris / Addison UI)"* — citing the
in-repo copy and defining **Cluster**, **Federation**, **Universal Exit Principle**, **Lodge**. So
this is not a fleet that ignored Addison's dictionary.

But:

- **`GLOSSARY.md` has no `Room` entry at all.** The string "room" appears **twice** in the whole
  file, neither time as a definition — while `Room` is the central type of `SimFramework`, `SimLoop`,
  `DarkHallRoomLoop`, `WheelRoom`, and now `SimVerb`.
- **No `Vault` entry.** Aaron's "rooms within their vaults of rooms" implies nesting; nothing in the
  glossary or the runner expresses containment.
- **`GLOSSARY.md:46` defines `Z-set`** — but as the DBSP construct, without Addison's
  reversible-present framing or its `G-set` pair.
- **DST** is defined in the engineering register (manifesto §7, "replays deterministically") and not
  in Addison's stronger register (*"a requirement for truth"*).

**The pattern:** the *society* half of the dictionary was reconciled; the *state and truth* half —
the half the runner is built from — was not. That is a documentation gap with teeth, because the
runner's authors and the dictionary's author were describing the same object with no shared entry.

---

## 6. The design

### 6.1 The seam, stated as the product thesis

The DI seam is not a testing convenience. **It is the reason one artifact can be both the user's test
and the user's production system**, which is the entire claim of rooms-as-programming-interface:

> If the simulated path and the production path diverge anywhere in the code, then a non-technical
> user's "test" no longer tells them anything about their "prod", and the interface stops meaning what
> it claims.

This is why an `isSimulated` flag is not a style violation but a **product defect**. A branch on such
a flag means there are two programs; the user validated one and is running the other. Manifesto §1
(scale-free: same code path, no special cases) and §7 (DST) are the engineering names for the same
requirement.

**The rule that follows:** real-vs-simulated is expressed **only** by which value is injected into a
room's `Source` and `Clock` fields. No type carries a mode discriminant; no function branches on one.

### 6.2 Every entropy door, named (§13 noninterference)

| door | type | seed / DST value | production value |
|---|---|---|---|
| **membrane** | `Source = int -> InterruptKind list` | `seedSource seed` | live source, or `RecordedSource.replay` |
| **generator clock** | `Clock = int -> int64` | synthetic (`fun _ -> 0L`) | injected monotonic reading |
| **the seed** | `int64` | the run parameter | the run parameter |

Doors **refused**, with an existing enforcer rather than a promise: ambient wall clocks, unseeded
RNG, `NewGuid`, `Stopwatch`, `Task.Run`, threadpool reach-through. See §8.3 — this is machine-checked
on every build by a lint I did not write and did not know existed until it failed on me.

### 6.3 Types

```fsharp
type Epistemic = Known | Unknown | Assumed | Disputed | Decided   // Addison's five, uncollapsed
type Claim<'Q>      = { Question: 'Q; State: Epistemic }
type Uncertainty<'Q> = ZSet<Claim<'Q>>                            // the reversible present
type Census = { Known: Weight; Unknown: Weight; Assumed: Weight
                Disputed: Weight; Decided: Weight }               // the neutral five-way fact

type Room<'S,'Q> =
    { Name: string
      Initial: int64 -> 'S
      Handlers: SoftScheduler.HandlerK<'S> list
      Source: int64 -> SoftScheduler.Source     // ← the seam
      Clock: int -> int64                       // ← the other door
      Ledger: 'S -> Uncertainty<'Q>             // ← the uncertainty lens
      Oracle: ResolutionOracle                  // ← the chosen reading (§11)
      TicksPerLap: int
      Budget: AttributedBudget }                // ← attributed, never bare
```

`Room` is a **record of functions, not a class** — no instance state, nothing captured, so the
`interfaces-free-classes-earned` rule is satisfied without earning anything. The one interface,
`ISimVerb`, is implemented by an object expression.

### 6.4 The collapse is an injected oracle, never baked in

Reducing five states to "did uncertainty go down" is a **judgement**. Hardcoding one would re-commit
the premature collapse Addison's definition forbids, and would have the substrate holding a morality
it is not allowed to hold (§11 Multi-Oracle; `dual-use-detection-is-neutral-oracle-decides`).

So `ResolutionOracle` is injected and carries an `Attribution` string, the **neutral `Census` travels
beside every verdict**, and the default oracle's five integers are labelled a **toy** in the code
because nothing falsifies them. A test asserts an inverted oracle reaches the *opposite* verdict from
the *identical* census — the dual-use test, in the form this rule prescribes.

### 6.5 Budgets are attributed (the hidden-oracle rule)

`AttributedBudget` cannot be constructed without naming provenance — `HumanAuthorized` /
`InheritedFrom` / `ToyDefault`, no fourth case and no silent default — and the attribution is encoded
into the run's text record, so a run's rails are auditable in a diff.

This also puts a marker on an existing instance: **`SimLoop.defaultBudget` (`SimLoop.fs:38-41`) is
three bare constants** — `1_000` laps, `1_000_000` ticks, `300_000L` ms — with no attribution. They
are *reachable* here only through `toyBudget`, which says so out loud. I did not change `SimLoop`;
the numbers are load-bearing for `DarkHallScheduler` and re-attributing them is someone's authorized
decision, not mine. Candidate for the sibling agent's 112-constant audit as #113.

---

## 7. What I built (BUILT) vs what I only designed (DESIGNED)

### BUILT — `src/Core/SimVerb.fs` (~470 lines) + `tests/Tests.FSharp/SimVerb.Tests.fs` (12 tests)

- `Epistemic` — Addison's five-way state, **first representation of it in the tree**
- `Claim` / `Uncertainty` / `Census` — the Z-set-shaped live ledger and its neutral census
- `ResolutionOracle` + `defaultResolutionOracle` — the injected, attributed collapse
- `AttributedBudget` + three constructors — the hidden-oracle guard
- `Room` / `withSource` / `withClock` / `withOracle` / `withLedger` — the seam, as substitution
- `ISimVerb` + `sim` — **the first real implementation of a `sim` verb**, an object expression over
  the existing `SimLoop.run`. No new loop, no new scheduler, no `Task.Run`.
- `measureLaps` — per-lap ΔU **derived** by pairwise Z-set difference, never accumulated in a closure
- `ledgerOf` / `mergeLedgers` — the G-set fold: idempotent, commutative, grow-only
- `encodeMea` / `encodeRun` — canonical **text** encoding (no binary in the proof lineage); this is
  the byte-lock surface the DST tests compare

### DESIGNED, NOT BUILT — deliberately

- **Reticulum-in-simulation.** Out of scope by Aaron's own gate; see §9.
- **Reconciling `clis/Verbs.fs`.** The signature defect (§3) is *reported*, not fixed. Fixing it means
  either compiling `clis/` or deleting the stubs — both are larger decisions than this PR earns.
- **Vault / room nesting.** Addison defines Vault as the container and Aaron says "vaults of rooms",
  so composition is expected. `Room` is currently flat. Nesting is a real piece of work: a nested
  room's `Source` is presumably its parent's membrane, which makes containment an entropy-routing
  question, not a data-structure question.
- **Writing `mea` through to `db/uncertainty/`.** `SimVerb`'s G-set is in-memory. The bridge to the
  on-disk ledger via `measure.ts` is the obvious next increment and is not built.
- **Retiring `SimLoop.defaultBudget`'s bare constants.** Named, not changed.

---

## 8. Verification — real output

### 8.1 Build gate

```
$ dotnet build Zeta.sln -c Release
Build succeeded.
    0 Warning(s)
    0 Error(s)
Time Elapsed 00:01:28.02
```

### 8.2 Tests

```
$ dotnet test tests/Tests.FSharp/Tests.FSharp.fsproj -c Release --no-build
Passed!  - Failed: 0, Passed: 5284, Skipped: 6, Total: 5290, Duration: 4 m 54 s
```

### 8.3 Mutation — the falsifiers, including the one that failed

A DST claim with no failing mutant is the vacuity class. Both mutants below were applied to
`src/Core/SimVerb.fs`, built, and run.

**Mutant 1 — ambient entropy leaks past the injected membrane.** The runner appends a
`Random.Shared`-gated crossing to whatever the injected `Source` returns.

| attempt | result |
|---|---|
| **first attempt** | **SURVIVED the DST byte-lock.** 1/11 failed — and it was the *seam* test, not the DST test. |
| **after fixing the lens** | **KILLED.** 3/11 failed, including `DST: same room, same seed replays BYTE-IDENTICALLY`. |

The first result is the honest finding. My byte-lock compares the **measured** run, and the test
room's lens was three threshold-shaped claims (`Ticks > 0`, `Messages > 0`, `Ticks > 200`). Extra
ambient crossings never moved those thresholds, so the encoding was identical and the DST assertion
was **vacuous — it could not have failed**. The fix was to put the crossing count in the claim *key*
(`crossings-seen-N`), making the Z-set delta sensitive to the trajectory rather than to a bucket.

> **The transferable lesson: a byte-lock is only as discriminating as the lens it measures through.**
> "Same seed ⇒ same bytes" sounds airtight and is not, if the bytes are a lossy projection. This is
> the `D_f = 1.322` failure in a new costume — the number looked right, so nobody asked what produced
> it. The comment recording this is in the test file at the lens, not only here.

**Mutant 2 — the runner reads an ambient wall clock instead of the injected `room.Clock`.**

| attempt | result |
|---|---|
| **first attempt** | **SURVIVED. 0/11 failed.** |
| **after tightening** | **KILLED. 2/12 failed.** |

Also honest, and a different defect from mutant 1. Two of my tests were vacuous against it:

- `an exhausted clock stops the run on the clock rail` asserted `ClockBudget` — but under the mutant
  *every* run stops on `ClockBudget`, so the assertion passed for the wrong reason.
- `no room runs forever` matched `LapBudget | TickBudget | ClockBudget` — a deliberately loose match
  that **accepted the mutant's output**.

The fix was to make the rails **exact** rather than "any finite rail", and to add a test where two
*injected* clocks force two *different* rails from the same room — an outcome pair no self-supplied
time source can reproduce. Both tests are stable on any machine at any hour because neither consults
wall time.

### 8.4 The refusal already existed — and it caught me

The brief asked me to "make an ambient clock reachable and confirm something refuses it." Something
did, and it was not my test:

```
Error Message:
   SimVerb.fs:55 uses 'DateTime.Now' — ambient entropy in Core; seed it, fence it behind
   IEnvironment, or add a justified allowlist row
   at Zeta.Tests.DeterminismLintTests.THE DETERMINISM LINT: no ambient entropy in src/Core
      outside the named, justified edges() ... DeterminismLint.Tests.fs:line 57
```

`tests/Tests.FSharp/DeterminismLint.Tests.fs` scans every file in `src/Core` for ambient-entropy
tokens against a justified allowlist, and it **scans comments too** on the stated ground that "a
commented-out wall clock is a wall clock waiting to return." It failed on **prose in my module
docstring** — my code had no ambient clock; the sentence naming one was enough.

Two things follow. **The §13 guard is machine-checked on this path, not aspirational** — which is a
stronger answer to the brief's question than my own test provides. And I resolved it by **rewording
the comment, not by adding an allowlist row**: `SimVerb.fs` is not on that allowlist and does not
need to be.

---

## 9. Reticulum-in-simulation — DESIGNED ONLY, and what would gate it

Aaron gates this himself: *"once we can measure it accurate enough."* Not built. What the design
needs, and what "accurate enough" would have to mean:

1. **A Reticulum crossing must be an `InterruptKind` case**, so it enters through the same membrane
   as every other crossing and is recorded by `RecordedSource` as text. No second door.
2. **Record-then-replay must be exact for network crossings**, as it already is for timers and
   operator messages. Today `RecordedSource.Recording` is `Map<int, InterruptKind list>` — tick-indexed,
   with no notion of *latency*. A simulated network needs the crossing's arrival tick to be a
   *derived* quantity (send tick + modelled delay), and that model is the thing that must be metered.
3. **The metering accuracy question, stated so it can be answered:** how much of a run's observed
   variance is attributable to the modelled channel versus to unaccounted ambient influence? That is
   a number. **It does not exist in this repo.**

> **I searched for a measurement of current entropy-metering accuracy and found none.** Not a poor
> number — *no* number. The metering discipline is enforced structurally (the determinism lint, the
> injected `Source`/`Clock`, DST replay) and its **accuracy is unquantified**. Aaron's "getting
> closer" is consistent with what I can see; "arrived" is not something the repo can currently
> support either way, and this document does not claim it.

Note also the standing guard: `local-time-never-enters-the-shared-fold`. A simulated network makes
per-node receive-time available for the first time, and it must never filter or weight the evidence
entering a shared fold. Worth stating before the code exists, which is that rule's whole point.

---

## 10. Open questions for Aaron

1. **`clis/Verbs.fs` — compile it, or retire it?** As written the family cannot typecheck its own
   documented loop (§3), and nothing catches that because no project includes it. `SimVerb.ISimVerb`
   now occupies the same conceptual slot with types that compile. Reconciling them is a decision I
   should not make unilaterally.

   > **ANSWERED 2026-08-17 — compile it.** Aaron: *"clis/Verbs.fs this is our ultimate dogfood
   > surface plus our universal interfaces."* Shipped under `081M08VM385087G0R001DTM0K6`:
   > `clis/Zeta.Clis.fsproj`, in `Zeta.sln`, with a composition witness at
   > `tests/Tests.FSharp/Clis/Verbs.Tests.fs`.
   >
   > Two halves of this question remain open and were **not** answered by that ruling:
   > **(a) what `Sim` returns** — still undecided, and §3's break is worse than recorded here. A
   > **second, independent** break was measured: `ICutVerb.Cut` consumes `ISim<'a>`, not `mea`'s
   > `IMeasurement`, so `sim |> mea |> cut` fails to typecheck *even given* an `ISim` from
   > elsewhere. Fixing the missing producer alone would not make the pipe compose.
   > **(b) the reconciliation with `SimVerb.ISimVerb`** — still mine-not-to-make. Aaron's stated
   > preference is the free-object reading (*"one arena where they can all work together"*,
   > `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`); the shapes are
   > *consistent with* it but no instance has been exhibited, so it stays a shape correspondence.
2. **Should `Room` and `Vault` get `GLOSSARY.md` entries reconciled to Addison's definitions?** §5a
   says the society half was reconciled and the state-and-truth half was not. This looks like a real
   omission rather than a deliberate split, but confirming that is yours.
3. **Is the default resolution oracle's ranking right?** I ranked `Disputed` above `Assumed` — a
   surfaced conflict beats an unexamined assumption. That is a judgement with no falsifier, labelled
   a toy in the code. If you have a different reading, it is one record literal.
4. **`SimLoop.defaultBudget`'s three bare constants** — re-attribute, or leave? They have a live
   consumer, so changing them is not mine to do.

---

## 11. Anchors (Beacon)

- **Addison Cooper**, *Genesis Concepts* (2026-06-20) — Room / Vault / Z-set / G-set / DST. The
  in-house anchor; in-repo at `docs/design/root-site-iris/Genesis Concepts.dc.html`.
- **Budiu, Chandy, McSherry, Ryzhyk et al.**, *DBSP: Automatic Incremental View Maintenance for Rich
  Query Languages* (VLDB 2023) — Z-sets with integer multiplicities; `+1` assert / `−1` retract.
- **Shapiro, Preguiça, Baquero, Zawirski**, *Conflict-Free Replicated Data Types* (SSS 2011) — the
  G-set join: idempotent, commutative, associative. Why `mea`'s ledger survives a lossy link.
- **Codd** (1970) — relations, the substrate Z-sets generalise with multiplicities.
- **Zhou et al.**, *FoundationDB* (SIGMOD 2021); **Will Wilson**, *Testing Distributed Systems with
  Deterministic Simulation* (Strange Loop 2014) — DoP=1 single-threaded determinism; the reference
  standard `SoftScheduler.drive` follows.
- **Goguen & Meseguer**, *Security Policies and Security Models* (1982) — noninterference; §13's
  anchor, and the reason "declared, metered channels" is a technical term rather than a slogan.
- **Meijer** — Rx `IScheduler` / `HistoricalScheduler`: time as an injectable parameter. The direct
  ancestor of the `Clock` door.
- **Lamport** (1978) — logical clocks; `Clock.fs`'s anchor.

## 12. Pointers

- `src/Core/SimVerb.fs` — this increment
- `tests/Tests.FSharp/SimVerb.Tests.fs` — the 12 tests, including the two mutation-hardened ones
- `src/Core/SimLoop.fs` — **the room runner that already existed**
- `src/Core/SimFramework.fs` — the hexagonal port · `src/Core/SoftScheduler.fs` — the seam
- `src/Core/RecordedSource.fs` — record/replay at the membrane
- `tests/Tests.FSharp/DeterminismLint.Tests.fs` — the §13 enforcer that caught me
- `clis/Verbs.fs` — the uncompiled stub family (§3)
- `db/uncertainty/README.md` — the ledger discipline `mea` must eventually write to
- `docs/GLOSSARY.md:1259` — the partially-reconciled Genesis Concepts section (§5a)
