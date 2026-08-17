# The CHIP-8 cross-run store: run 1's whole timeline, readable at run 2's step 0

**Date:** 2026-08-17 · **Work item:** `081M087DVKF087G0R002DDHMPR` · **Author:** Otto (shadow)
**Status:** design + shipped F# core. TypeScript reader parity: see §10.

---

## 1. What Aaron asked for (verbatim, Mirror register)

> "we do this in our chip8 rooms where we can do superdeterministic calculations based on one run
> and then save the results for future runs, we have been able to compute over all chip8 4k memory
> space cause it's tractable, but other calculations may not be tractable, it's a
> calculation-by-calculation basis. this is how we can let the 'future' affect the past in a 2nd
> retrocausal way because the 1st run of the game all the way up until the end can affect the start
> of the 2nd run of the game through superdeterministic calculations in chip8 memory space"

and on routing the build:

> "lets route the half unbuilt to be design and pushed forward and built, make sure it integrates
> nice with our rooms concepts and dark hall, i don't know how much dark hall is typescript and how
> much is fsharp but we want to support both anyways"

Note his own scare quotes on "future" and his own scope limit — *"other calculations may not be
tractable, it's a calculation-by-calculation basis."* Both are load-bearing and both are honored
below: the limit is a first-class field of the artifact, not an assumption of the design.

## 2. The Beacon register — what is actually happening

**This is memoization of a deterministic transition function over a finite state space. Nothing
propagates backward in time.** Run 1 *computes* results; the results are *written down*; run 2
*reads* them. The only thing that crosses from "later" to "earlier" is a file, and it crosses
forward in ordinary wall-clock time like every other file.

What is genuinely interesting — and what makes Aaron's framing apt rather than decorative — is
that a *finite* description can answer questions about an *unbounded* future. That is a real
property, and it has a name and a proof.

**Anchors (checked, not gestured at):**

- **Memoization.** Donald Michie, *"Memo functions and machine learning"*, **Nature 218, 19–22
  (1968)**. Michie coined "memo function": a function that stores its computed input→output pairs
  in a table and consults the table before recomputing. This artifact is a memo table for
  `step^n`, keyed by state. *Entailment check:* Michie's paper is about caching the results of a
  deterministic function so later calls are lookups; that is exactly and only what is claimed here.
- **Eventual periodicity of iterated maps on a finite set.** For any function `f : S → S` with `S`
  finite and any `s₀ ∈ S`, the sequence `s₀, f(s₀), f²(s₀), …` is **eventually periodic**: there
  exist `μ ≥ 0` (tail) and `λ ≥ 1` (cycle) with `f^(μ+λ)(s₀) = f^μ(s₀)`, and `μ + λ ≤ |S|`. The
  proof is the pigeonhole principle: among `s₀ … s_{|S|}` — that is `|S|+1` values in a set of size
  `|S|` — two must coincide, and determinism makes the sequence repeat from there. The shape is
  called a **"rho"** for the obvious reason.
- **Detecting `(μ, λ)` in O(1) memory.** Floyd's tortoise-and-hare, first published in **Knuth,
  *TAOCP* Vol. 2, §3.1 exercise 6 (attributed there to R. W. Floyd)**; and **R. P. Brent, *"An
  improved Monte Carlo factorization algorithm"*, BIT 20, 176–184 (1980)**, §7, which is the variant
  used here (fewer `f` evaluations than Floyd). *Entailment check:* Brent §7 gives exactly
  `λ` then `μ` for an iterated map on a finite set, which is the quantity stored.
- **Statistics of the rho, for the honest expectation.** Bernard Harris, *"Probability
  distributions related to random mappings"*, **Ann. Math. Statist. 31(4), 1045–1062 (1960)** —
  for a *random* map on `n` points, `E[μ + λ] ~ √(πn/2)`. Cited as the reason **not** to
  extrapolate from our ROMs: CHIP-8's step map is not a random map, and our measured orbits (§4)
  are many orders of magnitude below any such estimate. It is a warning against numerology here,
  not a prediction.

**What the design does NOT claim:** no physical retrocausality, no superdeterminism in the
Bell/'t Hooft sense, no influence of any kind travelling backward. "Superdeterministic" in Aaron's
sentence is a Mirror-register word for *"the whole trajectory is fixed by the seed, so it can be
computed once."* That is true and it is all the design uses. No code comment or identifier in the
shipped module claims otherwise.

## 3. The structural fact that makes it tractable — and the one that does not

CHIP-8's state is finite, so §2's theorem applies. But the naive reading of "tractable because 4K"
is wrong twice, and the design turns on both corrections:

**Correction 1 — it is not 4096 states, it is 2^32768 and more.** `Chip8Cow.Frame` carries 4096
bytes of memory (`Mem`), 16 registers, `I`, `PC`, a stack, two timers, a 2048-pixel display, the
CHIP-9 `Plane`/`Extra` planes, a fault register, **and a 64-bit `Rng`**. The configuration space is
astronomically large. Exhaustive enumeration of the state space is not on the table and never was.

**What is tractable is orbit enumeration from a starting state** — walking `s₀, s₁, s₂, …` until it
closes. That is `O(μ + λ)` work and `O(1)` memory with Brent. For the ROMs we actually run, `μ + λ`
is **at most 17** (§4).

**Correction 2 — `Rng` is a 2^64 counter, so some orbits provably do not close.** `Chip8Cow`'s
`nextRand` does `Rng ← Rng + GoldenRatio` on every `CXNN`. The `Rng` field is *part of the state*.
So a ROM that executes `RND` in a loop cannot revisit a state until that additive counter wraps —
`λ ≥ 2^64`. Measured, not assumed (§4). **This is precisely Aaron's "other calculations may not be
tractable," and it is why the artifact records a *verdict* rather than always a `(μ, λ)` pair.**

## 4. Measurements (this repo, `Chip8Cow.step`, seed 0)

All five committed ROMs in `roms/chip8/`, orbit of the pure no-input step map:

| ROM | μ (tail) | λ (cycle) | orbit = μ+λ | how it closes |
|---|---|---|---|---|
| `zeta-selfloop.ch8` | 0 | 1 | **1** | `1200` self-jump — fixed point at step 0 |
| `zeta-arith.ch8` | 3 | 5 | **8** | genuine 5-cycle through the ROM |
| `zeta-draw-h.ch8` | 4 | 1 | **5** | `1208` self-jump halt |
| `mikolay-delay-timer-test.ch8` | 16 | 1 | **17** | **`F40A` — blocked awaiting input** |
| `mikolay-random-number-test.ch8` | 15 | 1 | **16** | **`F00A` — blocked awaiting input** |

And the forcing case, hand-authored (ours, CC0): `C0FF 1200` = `RND V0,0xFF` then `JP 0x200`.

| bound | result |
|---|---|
| 1 000 | OPEN — no cycle |
| 100 000 | OPEN — no cycle |
| 1 000 000 | OPEN — no cycle (6.4 s) |

100 000 steps produced **100 000 distinct full states, zero repeats**. `Rng` after 100 000 steps =
`12902344461069763984`, still strictly advancing. Orbit ≥ 2^64.

**Two findings that shape the design:**

1. **Three of the five "fixed points" are not halts.** Two are `FX0A` (wait-for-key), which
   `Chip8Cow` models as a no-advance stall — so under the *pure, no-input* step map they are
   literal fixed points. The orbit did not end; **the deterministic segment ended at an input
   branch**, which is exactly the seam `SoftChip8.branchesOnInput` already names. Recording these
   as "cycle of length 1" without saying *why* would be a store that lies by omission. The verdict
   type distinguishes them.
2. **Every orbit is seed-tagged even when the seed is inert.** `zeta-selfloop.ch8` never executes
   `RND`, yet its frame at seed 0 and seed 42 are unequal — because `Rng` sits in the frame
   regardless. So the seed is part of the run key, unconditionally. There is no seed-independence
   claim anywhere in this design, and there must not be one.

## 5. What is stored

One text artifact per run key, under `db/emus/chip8/orbits/`.

**The run key (the hub, DV2.0):** `romSha256 ⊕ seed ⊕ loadAddr ⊕ dialect ⊕ stepMapVersion`.
Content-derived, no wall clock, no counter, no path. The filename is the run key's own digest.
`stepMapVersion` is in the key because a change to `Chip8Cow.step` invalidates every memo — a
memo table keyed without the function's identity is a correctness bug waiting for a refactor.

**The body:**

| field | what | why |
|---|---|---|
| `verdict` | `Closed` \| `OpenAtBound` \| `Faulted` | see §7 — the anti-hidden-oracle field |
| `mu`, `lambda` | tail and cycle length | only present under `Closed` |
| `terminalKind` | `Halt` \| `AwaitingInput` \| `Cycle` | finding 1 of §4 |
| `budget` | `{ maxSteps, attribution }` | see §7 |
| `checkpoints` | `[{ step, stateDigest, snapshotHex? }]` | the memo rows |
| `bodyDigest` | SHA-256 over the canonical body | the reader's refusal test |

**Everything is hex-in-JSON text** (`no-binary-in-proof-lineage`). A frame snapshot encodes as a
canonical string: sparse `addr:byte` hex pairs for `Mem` (the COW map is sparse, so a real ROM's
snapshot is small), 16 hex bytes for `V`, hex scalars for `I`/`PC`/timers, a sorted lit-pixel index
list for `Display`, sparse pairs for `Extra`. Sorted with `StringComparer.Ordinal`, formatted with
`CultureInfo.InvariantCulture`. Diffable and mergeable in a `git` diff, which is the whole point.

We do **not** attempt the "artifact under test" exception of `no-binary-in-proof-lineage`. We would
fail its five conditions — nothing *executes* the store, so condition 1 alone disqualifies it. It
is evidence, and evidence is text.

## 6. How run 2 consults run 1

Two lookups, and the second is the one that earns Aaron's framing.

**(a) Prefix fast-forward.** Digest the current frame; if it is a recorded checkpoint at step `i`,
and a checkpoint with a full snapshot exists at step `i+n`, return that snapshot. Run 2 skips `n`
steps of work it never performs.

**(b) Cycle reduction — the finite description of an unbounded future.** Under a `Closed` verdict
with `(μ, λ)`, the state at *any* step `n ≥ μ` is the state at step `μ + ((n − μ) mod λ)`. So the
store answers "where is this machine at step 10^18?" from an artifact with 17 rows. **This is the
literal content of "the 1st run of the game all the way up until the end can affect the start of
the 2nd run"** — the end of run 1 is the thing run 2 reads at its step 0.

**The falsifier for both:** the result of a lookup must be **byte-equal** to actually stepping the
machine. That is the same shape as the existing T1 test (`lookAhead n` IS the real timeline `n`
steps later, byte-equal), extended across the run boundary. A store that returns anything else is
refused, not trusted.

## 7. The bound is the oracle, so the bound is on the record

Aaron, today: *"always be on the lookout where the measurement or the limit/budget becomes the
oracle silently — this is accidental hierarchy or control."*

In this design the hidden-oracle defect has an exact form, and it is tempting:

> A precompute that stops at `maxSteps` and writes `lambda = 1` because it never saw a repeat has
> silently promoted **its own budget** into a **claim about the machine**. Run 2 then reduces
> modulo a cycle that does not exist and returns a wrong state with total confidence.

Three guards, all mechanical:

1. **`OpenAtBound` is a distinct verdict.** Budget exhaustion can never be read as closure, because
   it is a different constructor. The reader's cycle-reduction path is unreachable from
   `OpenAtBound` — the type makes the silent promotion unrepresentable.
2. **The budget is injected and attributed.** `PrecomputeBudget = { MaxSteps; Attribution }`, and
   an empty attribution is **refused with an error before any work is done**. There is no default,
   no fallback constant, no `let maxOrbit = 100000` anywhere in the module. Whoever set the limit
   has to say so and sign it.
3. **The budget is written into the artifact.** A later reader sees which limit produced this
   result and can judge whether an `OpenAtBound` is a fact about the ROM or an artifact of a
   stingy caller. The oracle is legible on the record rather than lost at the call site.

## 8. The seven disciplines

- **#1 scale-free** — one artifact per run key; no index, no registry, no coordinator. Adding a
  ROM adds a file.
- **#2 lock/wait-free** — the store is immutable-once-written and content-addressed; readers never
  block, and two writers producing the same key produce the same bytes.
- **#3 weight-free** — the core module holds no state and performs no IO; it is functions over
  values.
- **#4 / §7 DST** — same `(rom, seed)` ⇒ byte-identical artifact. Tested (§9).
- **#5 DV2.0** — run key = hub (stable, content-derived); checkpoints = satellite (grow with
  budget); the capability ledger `db/emus/chip8/capabilities.lines` is the link.
- **#6 idempotency** — `encode` is a pure function of the run key and the budget; writing twice is
  an upsert of identical bytes. Tested (§9).
- **#13 noninterference** — **the store is a declared channel, injected, never fetched.** The core
  module performs **zero file IO**: the reader is a `Reader` record the room *receives*. A room
  cannot reach out for a memo it was not handed, so a memo cannot become an ambient side door into
  a deterministic run. This is also what keeps DST intact — the injected reader is part of the
  simulated world, not a hole in it.
- **local-time rule** — no wall clock in the key, the filename, the body, or anything entering a
  fold. Step index is logical phase.

## 9. Verification and mutation

Every claim above has a test that fails when the claim is false; the mutation numbers are in the
PR body. Specifically: corrupt one nibble of a stored snapshot ⇒ the reader **refuses** (digest
mismatch, `Error`, never a silent wrong answer); make the writer non-idempotent ⇒ the byte-equality
test fails; delete the `OpenAtBound` guard ⇒ the cycle-reduction test on the RND-loop ROM fails.

## 10. Scope — what is explicitly NOT in this slice

- **Input branches are not memoized.** The store covers the *deterministic segment* only. At an
  `FX0A`/`EX9E`/`EXA1` branch the memo stops, by construction, because the successor depends on
  input that is not in the key. Memoizing the branch tree is a separate work item (it needs the
  input sequence in the run key, and that is a different hub).
- **No exhaustive state-space enumeration.** §3 correction 1. Anyone who reads "we computed over
  all CHIP-8 4K memory space" as "we enumerated the state space" has read it wrong; what is
  enumerated is a single orbit.
- **No eviction / GC policy.** Artifacts are small and text; when that stops being true it is a
  separate decision with its own hidden-oracle risk (a size cap is a budget, so it would need §7
  treatment).
- **Room-loop auto-consult and the IO adapter.** `fastForward` is proven byte-equal to
  `SoftChip8.lookAhead`, but no handler calls it yet, and nothing reads `db/emus/chip8/orbits/` off
  disk. Both are deliberate: auto-consult changes what the metered tank pays for (a memo hit is nearly
  free), which is a *metering* change needing its own ΔU story, not a caching change to slip in.
- **A TypeScript writer.** TS can read and verify these artifacts but cannot produce them:
  `src/Core.TypeScript/chip9/chip9.ts` is a treaty conformer for the DRAW subset whose `Frame` has no
  `delay`, `sound`, `keys`, or `rng`, and which mutates in place. A TS writer needs a full-state
  `Chip8Cow` equivalent — its own byte-lock exercise.

Deferred work is 081M089ZPAY087G0R001MYXM7N.

## 10a. The Dark Hall split, measured — and why the guessed seam was wrong

Aaron: *"i don't know how much dark hall is typescript and how much is fsharp but we want to support
both anyways."* Measured:

| side | files | role |
|---|---|---|
| **F#** | `DarkHall.fs`, `DarkHallScheduler.fs`, `DarkHallRoomLoop.fs`, `DarkHallRoomTranscript.fs`, `DarkHallCabinetRuntime.fs` — 2 854 lines | the engine |
| **TypeScript** | `src/Core.TypeScript/darkhall-ui/` — 32 files | the browser surface |

The natural guess for the TS persistence seam is `darkhall-browser-durable-runtime.ts`. **That is the
wrong seam, and the reason is DV2.0.** That module manages *mutable, per-session* IndexedDB checkpoints
of a room transcript, with a causal-correction/invalidation ledger. An orbit artifact is the opposite
lifecycle: *immutable, content-addressed, committed, shared, read-only*. Those are different change
rates, so they are different storage shapes; routing an immutable artifact through
checkpoint-invalidation machinery would couple two things with no reason to change together, and would
hand the store a mutable-cache failure mode it does not have.

**The right seam is the same one F# uses, in both languages: injection.** A room *receives* a reader
(`Chip8CrossRunStore.Reader` / `CrossRunReader`, defaulting to the empty one that knows nothing). That
is §13 noninterference, and it is why the TS module also performs no IO — no `fetch`, no IndexedDB, no
filesystem. Whoever constructs the room decides whether to hand it a store.

## 11. Pointers

- `src/Core/Chip8CrossRunStore.fs` — the module (pure; encode / decode / orbit / lookup).
- `tests/Tests.FSharp/Chip8CrossRunStore.Tests.fs` — the falsifiers.
- `src/Core/SoftChip8.fs` — `lookAhead`, the *within-run* half this completes.
- `tests/Tests.FSharp/Chip8SelfSim.Tests.fs` — T1 byte-equality, the shape §6's falsifier extends.
- `.claude/rules/no-binary-in-proof-lineage.md` · `.claude/rules/dv2-data-split-discipline-activated.md`
  · `.claude/rules/local-time-never-enters-the-shared-fold.md` · `.claude/rules/toy-is-free-metered-must-be-earned.md`
