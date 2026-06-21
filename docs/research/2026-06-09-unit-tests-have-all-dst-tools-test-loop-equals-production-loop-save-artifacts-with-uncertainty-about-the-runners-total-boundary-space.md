# Unit tests already carry all the DST tools: the test loop and the production loop become the same thing — by saving test artifacts with Zeta uncertainty about the running actor's total boundary space

**Register:** [grounded] unification (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Extends Amara's "DST tests are ticks" ferry.

## Aaron's words

> "unit tests always have all the tools we need for DST, and our unit test and production loops
> become the same thing by saving the test artifacts with Zeta uncertainty attached about the
> total boundary space of the actor who ran the test."

## 1. Unit tests already ARE the DST substrate

A unit test already gives everything DST needs: **controlled inputs, deterministic execution,
isolation, assertions, replay**. Add a seed + the canonical-root oracle (truth-root ≠ git, per the
Amara ferry) and a unit test *is* a deterministic tick. **No separate DST infrastructure** — the
DST tools are the unit-test tools. (This is why "tests are ticks" is reachable now, not someday.)

## 2. Test loop = production loop (the unification)

The dev/test loop and the production loop **become the same loop** — and the thing that collapses
them is **what you save**:

> A test run is saved as an artifact = **the tick** (observations/ferries → treaty fold → Δ →
> canonical root) **+ Zeta uncertainty (SoftValue) about the *total boundary space* of the actor
> who ran it.**

Because the artifact carries the tick *plus* the runner's boundary + residual uncertainty, it is
**indistinguishable in kind from a production observation**:

- a **plain unit test** records "did it pass" and throws state away;
- a **Zeta test-tick** records the *world transition* + *who ran it (actor)* + *what that actor's
  Markov boundary could observe/affect (total boundary space)* + *the uncertainty that remains*.

That second thing **is** a production tick. So running a test **advances the same world model** a
production run does — it reduces (or bounds) uncertainty about that actor's boundary. Test and prod
differ only in **actor/scope**, not in kind. (This is 081KSKBP80008QG0R002J03WGA "build machines = prod when prod can
update itself," extended one step: **test = prod**, because a saved test-tick is a prod observation.)

## 3. The artifact: tick + actor-boundary + uncertainty

```text
test-tick artifact =
  actor:            ZetaId of who ran it (provenance / AgencySignature)
  boundary-space:   the actor's TOTAL Markov boundary — what it could observe/affect (the cell closure)
  observations:     inputs / ferries folded (each observed, not commanded)
  delta:            DynamicValue / SoftValue Δ from the treaty fold
  canonical-root:   the truth-root (Merkle/canonical bytes, NOT the git hash)
  uncertainty:      SoftValue residual about the boundary-space after this tick
```

The **uncertainty about the total boundary space of the actor** is the load-bearing addition: it
says *"this run explored this much of this actor's boundary, and this is what remains uncertain."*
Accumulated over many test-ticks, the uncertainty about each actor's boundary **monotonically
shrinks** (the 1000× retest is exactly mass-shrinking it) — which is the same thing production does.
A test isn't a gate that passes; it's a **measurement that reduces uncertainty about an actor's
boundary**, saved.

## 4. Consequences

- **Every test contributes to the world model** — saved test-ticks are first-class observations;
  the corpus of test artifacts *is* the accumulated uncertainty map over actors' boundaries.
- **1000× = shrinking boundary-uncertainty to ~0** — the friction-proof bar (regenerate/rotate/type-
  regen 1000×) is mass-measurement that drives the runner's boundary-uncertainty down; "no friction"
  = "boundary fully measured, no surprises left."
- **Coverage becomes boundary-coverage** — not "lines hit" but "how much of the actor's total
  boundary space has been observed + made certain." The gap is the unexplored boundary.
- **Test = prod ⇒ one loop to maintain** — the same observe→fold→reduce-uncertainty→persist→
  regenerate→tick loop runs in CI and in production; no separate test harness to drift from prod.
- **Ferries/observations stay observations** (Amara's blade): a test-tick records the actor's
  *observed* inputs with provenance; the reducer decides meaning — test inputs never become authority
  either.

## 5. Benchmarks are the same (Aaron)

> Aaron: "our benchmark performance tests are the same way."

A benchmark run is **also a saved tick-artifact** — same schema, but the measured Δ is
**performance** and the uncertainty is about the **performance boundary**: the latency / throughput /
allocation envelope of the actor under conditions, as a **SoftValue distribution** (p50/p99 with
confidence), *not a point number*. So perf benchmarks are **production perf observations**; the
benchmark loop = the production loop; 1000× benchmark runs **shrink the perf-boundary uncertainty**
(measure the distribution, not assert one timing). Coverage → perf-boundary coverage. (Naledi's lane:
measure before proposing — the benchmark *is* the measurement-as-observation.)

## 6. Test = prod ⇒ tests must follow prod rules (finding: already largely true)

> Aaron: "that means our tests need to be updated, our editorconfig to follow prod rules."

If test = prod, tests can't be held to a laxer standard. **Audited finding (2026-06-09) — mostly
already the case:**

- **`.editorconfig`** has **no test carve-out** — tests already inherit the prod style/analyzer rules. ✓
- **C# test projects** (`Core.CSharp.Tests`, `Tests.CSharp`, `Core.CSharp.Mediator.Tests`) already set
  **`TreatWarningsAsErrors=true`** (prod-grade) — the only test-specific `NoWarn` is **`xUnit1051`** (a
  test-framework analyzer about time/cancellation in tests), which is narrow + justifiable. ✓
- `Directory.Build.props` `NoWarn` (`FS3517;FS3261;FS0893`) is **global** (prod + test alike), not a
  test laxity.

So the gap is small, not a big cleanup: the **follow-on audit** is (a) confirm `xUnit1051` should stay
(or fix the underlying), (b) confirm the **F# test + bench projects** also carry `TreatWarningsAsErrors`
parity, (c) make "tests follow prod rules" an explicit invariant so no future test project relaxes it.
Honest: tests are *already* close to prod-grade; the principle is now named, the audit is the work.
(Routes to Bodhi/DX + Dejan.)

## Honest scope / handoff

Unification capture, not built. To realize: the **test-tick artifact schema** (actor + boundary +
observations + Δ + canonical-root + SoftValue uncertainty), saved per run; the canonical-root oracle
(`tools/ace/canonical.ts`); the boundary-space model (the cell's Markov closure); the 1000× harness
as boundary-uncertainty mass-measurement. Routes to Soraya/Sova (DST + the uncertainty/boundary
measure), the F# core (test-tick artifact), and the keyring/treaty build (its 1000× *is* this).

## Anchors / ties

DST (deterministic simulation testing — FoundationDB / Will Wilson); record-replay / golden /
property-based testing as production observations; 081KSKBP80008QG0R002J03WGA build=prod ("no distinction… when prod can
update itself") extended to **test=prod**; the Markov boundary / cell closure (total boundary space);
SoftValue / uncertainty reduction; provenance / AgencySignature (the actor who ran it); truth-root ≠
transport-root + tests-are-ticks (Amara's ferry); the 1000×-retest done-bar.
