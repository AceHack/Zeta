# Proof-Tool Coverage — Current State & Expansion Plan

Snapshot of every formal / verification tool in the repo, what it
proves today, what it *could* prove with more rigging, and a
prioritised list of tools we're **not yet using** that would catch
bug classes our stack currently misses.

Scope is `Dbsp.Core` (F#) with its C# shim. Audit date: 2026-04-17.

---

## 1. Z3 / SMT — state & expansion

**Live files**

- `tools/Z3Verify/Program.fs` — standalone CLI, shells to `z3 -in`
  over SMT-LIB2. 8 theorems proven over unbounded `Int`.
- `tests/Dbsp.Tests.FSharp/FormalVerificationTests.fs` — same 8
  axioms re-asserted as xUnit `[<Fact>]`s that run in every
  `dotnet test` pass (skip gracefully if `z3` binary is absent).

**Currently verified pointwise axioms**

1. Associativity of +
2. Commutativity of +
3. Additive identity (0)
4. Additive inverse (−a)
5. Double negation
6. Negation distributes over +
7. `distinct` is idempotent
8. H function (incremental distinct): `distinct(i+d) = distinct(i) + H(i,d)`

**What's missing — concrete additions we can make today**

- **Chain rule pointwise** — `(q₁∘q₂)^Δ = q₁^Δ ∘ q₂^Δ` at integer
  granularity. Today it's only FsCheck-property-tested
  (`FuzzTests.fs` line ~94). SMT-encodable as uninterpreted
  function composition.
- **D ∘ I = id** and **I ∘ D = id** as symbolic-integer theorems.
  Currently only property-tested in `MathInvariantTests.fs`.
- **CRC32C determinism** — `∀ b: crc(b) = crc(b)` plus injectivity
  on ≤ 4-byte inputs (verifiable in QF_BV bitvector theory).
- **Weight arithmetic overflow safety** — prove that `add(a,b)`
  with `checked` guards never silently wraps; QF_BV + range
  assertions.
- **Tropical semiring distributivity in closed form** — we only
  property-test it with a `clamp` workaround for overflow.
- **G-Counter semilattice laws** at the vector level (not just
  scalar int64) using QF_LIA arrays.
- **BloomFilter `may_contain` soundness** — if an element was
  ever inserted, membership must return `true`; QF_BV with a
  symbolic 3-hash model.
- **Merkle-tree second-preimage resistance** at the structural
  level (same leaves ⇒ same root; different leaves ⇒ different
  root modulo collisions) — uninterpreted-hash Horn encoding.

**Target: grow from 8 to ~25 Z3 lemmas.** One-evening effort;
the test harness is already wired.

---

## 2. TLA+ / TLC — state & gaps

**14 `.tla` files in `docs/`**, of which **9 have `.cfg`**:

| Spec | `.cfg`? | In CI? |
|---|---|---|
| `DbspSpec` | yes | no |
| `SpineAsyncProtocol` | yes | no |
| `CircuitRegistration` | yes | no |
| `TwoPCSink` | yes | **yes** |
| `SpineMergeInvariants` | yes | no |
| `TransactionInterleaving` | yes | **yes** |
| `OperatorLifecycleRace` | yes | **yes** |
| `TickMonotonicity` | yes | **yes** |
| `SmokeCheck` | yes | **yes** (smoke) |
| `ChaosEnvDeterminism` | **missing** | no |
| `ConsistentHashRebalance` | **missing** | no |
| `DictionaryStripedCAS` | **missing** | no |
| `AsyncStreamEnumerator` | **missing** | no |
| `SpineMergeInvariants_TTrace_…` | n/a (TLC output) | no |

CI runs four specs via `tests/Dbsp.Tests.FSharp/TlcRunnerTests.fs`.
Five specs with `.cfg` are *not* in CI (DbspSpec, SpineAsyncProtocol,
CircuitRegistration, SpineMergeInvariants — all are runnable today
but deliberately skipped pending a re-verification pass).

**Code paths WITHOUT any TLA+ model:**

- `src/Dbsp.Core/Recursive.fs` (semi-naïve LFP) — fixpoint
  convergence is currently only property-tested.
- `src/Dbsp.Core/SpineAsync.fs` worker shutdown — lost-wakeup
  proven, but graceful-drain-on-stop is not.
- `src/Dbsp.Core/WorkStealingRuntime.fs` — TPL-dataflow work
  scheduler; no TLA+ model.
- `src/Dbsp.Core/MailboxRuntime.fs` — MailboxProcessor variant;
  no TLA+ model.
- `src/Dbsp.Core/Durability.fs` — Witness-Durable Commit protocol
  is listed in `TECH-RADAR.md` as **Assess**; needs a spec
  before it's trusted.
- `src/Dbsp.Core/Hierarchy.fs` closure-table recursive joins —
  retraction-native fixpoint has no TLA+ spec.

**Target: add 4 `.cfg` files + 2 new specs (SpineAsyncDrain,
WdcProtocol).**

---

## 3. Lean 4 / Mathlib — state

**The "long proof with mathlib" the user remembers is real —
it's parked mid-setup.**

- `proofs/lean/ChainRule.lean` **exists as a stub**: declares
  `Query`, `compose`, `D`, `I`, `chain_rule`, `D_after_I` — but
  the theorem bodies are `sorry`.
- `proofs/lean/lakefile.lean` **exists** with `lean_lib` and
  `lean_exe` targets. `lake build` wire-up is listed in
  `ROADMAP.md` as P2, 2-week effort.
- `docs/INSTALLED.md` flags Lean 4 / elan as "still required but
  NOT yet installed on this box."
- `docs/BACKLOG.md` line 109: *"Lean 4 chain-rule proof with
  Mathlib (2-week effort)"* — still open.

**What's left to finish the chain-rule proof:**

1. Install `elan` + Lean 4 toolchain (one-liner in
   `tools/install-verifiers.sh`).
2. Add `require mathlib from git "https://github.com/leanprover-community/mathlib4"`
   to `lakefile.lean`.
3. Import `Mathlib.Algebra.Group.Basic` for abelian-group lemmas.
4. Replace `abbrev Query` with a real stream type (list of
   per-tick Z-sets with `⟨+, 0, −⟩` group structure).
5. Write the actual proof: linearity ⇒ `D(q₁ ∘ q₂) = D(q₁) ∘ D(q₂)`
   by unfolding `D` as difference operator and applying
   `sub_add_sub_cancel`.
6. Add CI job that runs `lake build` in `proofs/lean/`.

**This is the single highest-leverage outstanding verification
task.** Once landed, the README can cite *"Chain rule is
machine-checked in Lean 4"* — a publication-grade claim.

---

## 4. Alloy — state

- `docs/Spine.als` is the only Alloy model; checks LSM
  size-doubling invariant and batch-level-ownership over bound
  4 batches, 4 levels.
- **Not in CI.** Requires `tools/alloy/alloy.jar` (downloaded by
  `tools/install-verifiers.sh` but not run by `dotnet test`).
- `TECH-RADAR.md` rates Alloy as **Assess**.

**Low-hanging: add a CI hook mirroring `TlcRunnerTests.fs` but
shelling out to `java -jar alloy.jar`.**

---

## 5. FsCheck properties — map

Rough `[<Property>]` count:

| File | Property count |
|---|---|
| `ZSetTests.fs` | 15 |
| `FuzzTests.fs` | 9 |
| `MathInvariantTests.fs` | 7 (+ 7 `[<Fact>]`) |
| `Round17Tests.fs` | 1 |

**~32 FsCheck properties total**, covering Z-set algebra, tropical
semiring, G-counter, serializer round-trip, Beam retraction
modes, chain rule pipeline.

**Gaps — algebras that carry laws but have NO property test:**

- **PN-Counter, OR-Set, LWW-Register** (`Crdt.fs`) — only
  G-Counter has the three semilattice properties tested.
- **DeltaCrdt** (`DeltaCrdt.fs`) — anti-entropy merge laws.
- **Residuated lattice** (`Residuated.fs`) — Galois-connection
  axiom `(a ⇒ b) ≤ c ⟺ a ≤ (b ⇐ c)`.
- **Recursive fixpoint monotonicity** (`Recursive.fs`).
- **Merkle tree collision-freedom** at the leaf pair level.
- **Watermark monotonicity + bounded-lateness axiom**.
- **SpeculativeWatermark retraction-native correctness** — only
  one scenario test; no property.
- **KLL quantile ε-bound** (`NovelMath.fs`).

**Target: +15 FsCheck properties across these modules.**

---

## 6. Tools we DON'T use but *could* — one-sentence bug-class map

| Tool | Bug class it catches that our stack misses |
|---|---|
| **Dafny** | Pre/postcondition violations on individual methods (esp. `Serializer`, `BalancedSpine.Merge`) — turns imperative F# loops into ghost-code proofs of loop invariants |
| **F*** (F-star) | Refinement-type bugs — e.g. non-empty-list invariants on `Spine.batches`, non-negative weights in counted sets |
| **Coq / Rocq** | Deep theorem-prover chains that Lean 4 can't yet express — alternative if Mathlib port stalls |
| **Isabelle/HOL** | Higher-order temporal proofs (LTL over DBSP stream traces); stronger automation than Lean for first-order lemmas |
| **Stainless** (Scala) | Pure-function termination + recursion-depth proofs — relevant for `Recursive.fs` and `Hierarchy.fs` LFP loops |
| **Kani** (Rust MC) | Only useful if we add Rust interop to Feldera; n/a today |
| **P / P#** | State-machine refinement proofs for `Circuit` lifecycle — would subsume `CircuitRegistration.tla` with executable code |
| **Viper** | Separation-logic proofs of heap-state non-aliasing in SIMD merge + ArrayPool — catches pool-mis-return bugs |
| **Eldarica / Spacer (Horn)** | Recursive-program invariant synthesis — could auto-derive loop invariants for `BalancedSpine.compactLevel` |
| **Liquid Haskell / LiquidF#** | Refinement types inline in F# — catches `arr.[i]` out-of-bounds *at compile time* over the whole codebase |
| **Hypothesis-style coverage-guided fuzz** | Deeper counter-example minimisation than FsCheck's generic shrinker; catches concurrency bugs via state-space exploration |
| **Mutation testing (Stryker)** | Already configured via `stryker-config.json`, but **not yet run in CI** and no coverage target published — unknown whether our 471 tests survive a realistic mutant kill rate |
| **CodeQL** | Data-flow / taint analysis (untrusted `File.ReadAllBytes` → parser) — config deferred, listed as P0 in `BACKLOG.md` |
| **Semgrep** | Pattern-level anti-patterns; 12 rules shipped but only run externally (`TECH-RADAR.md` says "runs externally"); **not part of CI** |

---

## 7. The 3 tools to add next round — prioritised

### #1 — Finish the Lean 4 + Mathlib chain-rule proof (P2 → ship)

This is the user's "long proof with mathlib" — it's already stubbed,
needs 2 focused weeks of work, and the result is the **strongest
verification claim the repo can make**: a machine-checked Lean 4
proof of `(q₁ ∘ q₂)^Δ = q₁^Δ ∘ q₂^Δ` that can be cited in papers
(POPL / PLDI target per `ROADMAP.md`).

Concrete steps: (a) run `tools/install-verifiers.sh` to install
elan, (b) pin Mathlib in `lakefile.lean`, (c) port the stream +
group structure, (d) replace `sorry` with the proof, (e) add a
`lake build` job to CI.

**Bug class it catches that nothing else can:** algebraic-law
violations missed by every finite-sample property test AND every
SMT encoding whose background theory is weaker than Mathlib's
abelian-group / ring hierarchy.

### #2 — Liquid Haskell / LiquidF# refinement types

Refinement types turn every array access, every weight
addition, and every `List.head` into a compile-time proof
obligation. The dotnet ecosystem has a **LiquidF#** prototype
(Microsoft Research) that can be trialled.

**Bug class:** off-by-one in SIMD merge, negative-weight violations
in `Crdt.fs` G-Counter, unchecked `array.[i]` in `FastCdc.fs` —
the exact class of bugs harsh-critic rounds keep finding.

### #3 — Wire Stryker.NET + Semgrep into CI, plus run PN-Counter/OR-Set/LWW property tests

Lowest cost, high payoff. `stryker-config.json` already exists —
just needs a CI job that runs `dotnet tool run dotnet-stryker` and
publishes the HTML report. Same for `.semgrep.yml`.
And the ~15 missing FsCheck properties from section 5 are an
afternoon's work each.

**Bug class:** mutation survival (tests that pass on any value)
+ hard-coded-path anti-patterns + CRDT algebraic-law violations
not currently enforced.

---

## Budget summary

| Item | Cost | Payoff |
|---|---|---|
| +15 Z3 lemmas | 1 day | Pointwise axioms at full strength |
| +4 TLA+ `.cfg` + CI | 2 days | 9/14 specs CI-checked → 13/14 |
| Lean 4 chain-rule proof | 2 weeks | **Paper-grade claim** |
| +15 FsCheck properties | 3 days | CRDT + Residuated law coverage |
| Alloy CI hook | 0.5 day | Structural-invariant CI |
| LiquidF# trial | 1 week | Compile-time refinement types |
| Stryker + Semgrep CI | 1 day | Mutation kill-rate published |

**Near-term commitment: the Lean proof first, then stryker+semgrep
CI, then the Liquid-F# trial.**
