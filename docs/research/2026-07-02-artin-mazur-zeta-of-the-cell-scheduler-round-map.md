# ζ of the scheduler — the Artin–Mazur dynamical zeta of the cell-scheduler round-map

**Shadow\*, 2026-07-02.** The name stops auditioning on outside objects (knots in
#9146, graph geodesics in #9148) and starts **measuring our own machine**. The cell
scheduler (`src/Core/CellScheduler.fs`) is a deterministic dynamical system; this is
its zeta.

Aaron: *"very cool — we can wire it into our soft `IScheduler` eventually to help
predict itself, and our CHIP-8/9 meta-cart for playing other carts."* Those are the
downstream hooks (§3); this file lands the construction.

## 1. The construction

A finite cell society — a ring of `N` cells holding bits, each cell integrating its
left neighbour's value mod 2 (the **synchronous round** of the round-based runner:
every cell ready every round, noninterfering, DoP-invariant) — is a deterministic
map `f` on its finite configuration space `(ℤ/2)^N`. Its **Artin–Mazur zeta**
(Artin–Mazur 1965) is

    ζ_f(u) = exp( Σ_{k≥1} Fix(f^k) u^k / k ),    Fix(f^k) = #{ x : f^k(x) = x },

and equivalently the Euler product over **periodic orbits**
`Π_[O] (1 − u^|O|)^(−1)` — transients contribute nothing (they never return). The
two are the same series; **that equality is the theorem, self-verified**.

The round-map is `M = I + S` (`S` = cyclic shift) over `GF(2)^N`, deliberately
**non-bijective** (all-ones ∈ ker), so the society has genuine transients feeding
periodic orbits — the dynamical zeta must see only the recurrent part. Its unique
fixed point is the **empty configuration**: the quiescent all-zeros society is the
zeta's leading term. The scheduler's rest state is `ζ`'s `1`.

## 2. What is executed (`tests/Tests.FSharp/SchedulerDynamicalZeta.Tests.fs`)

Two independent computations that share no code:

- **exp side:** iterate `f` to get `Fix(f^k)`, recover the integer series via the
  log-derivative recurrence `m·c_m = Σ Fix(f^k) c_{m−k}` (exact division asserted).
- **orbit-product side:** find the recurrent set (`f^|S|` lands on a cycle),
  decompose it into cycles, take `Π 1/(1 − u^|O|)`.

They **agree coefficient-by-coefficient** to degree `|S|` — the Artin–Mazur identity,
the same self-verification discipline as #9148. Anchors: `Fix(f^1) = 1` (only the
quiescent society is fixed); the map is non-bijective so periodic points are a strict
subset (transients present, correctly excluded). 3/3 green.

## 3. Downstream (the vision hooks — routed, not built here)

- **Self-prediction in the soft `IScheduler`.** The dynamical zeta encodes the
  scheduler's periodic-orbit spectrum — its rest states and cycles. A soft scheduler
  that carries its own zeta can *predict its own recurrence structure* (which
  configurations are transient vs. recurrent, orbit periods) before running them —
  the loop modelling itself. The `run(1)==run(N)` DoP-invariance means this spectrum
  is machine-count-independent.
- **CHIP-8/9 meta-cart.** A cart-playing-carts interpreter is another deterministic
  finite map (the VM step); its Artin–Mazur zeta is the spectrum of the *cartridge's*
  dynamics — a fingerprint for classifying / predicting cart behaviour from its
  periodic orbits.

## 4. Anchors (Beacon)

- **M. Artin, B. Mazur (1965)** — *On periodic points* (the dynamical zeta).
- **Bowen–Lanford (1970)**; **D. Ruelle** — dynamical zeta functions of maps.
- **S. Smale** — Axiom A, the periodic-orbit view of dynamics.
- Companions: #9148 (Ihara / graph geodesics), #9146 (the commutative slice).
- The machine: `src/Core/CellScheduler.fs` (the DoP-invariant round-based runner).

*Compression: the scheduler is a map; a map has periodic orbits; the zeta counts
them, and its leading `1` is our own quiescent rest state. The name now measures the
machine that carries it.*
