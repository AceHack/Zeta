# Soft PriorityFerryThrottler — Math Team REPORT (answers the 2026-06-12 handoff)

**Status:** delivered 2026-06-12 (math-team agent, shelled out by otto at Aaron's request).
**Answers:** docs/research/2026-06-12-soft-priority-ferry-throttler-math-handoff.md
**Note:** the LaneSnapshot widening proposed in the handoff is ALREADY LANDED
(drain-scheduler.ts / priority-ferry-throttler.ts) — item 4 below audits the landed code.

## Headlines (act on these first)

**P0-1 — Admission gating direction is unspecified; one reading is provably broken.** If the
per-lane sigmoid gates the DRAIN (the wrapHandler reading), the loop is positive feedback:
queue grows → pressure grows → admission decays exponentially → drains stop while the queue
keeps growing; Σpₙ < ∞ kills Borel–Cantelli and the lane drains only finitely often with
positive probability — a soft livelock; no soft no-drop property can hold. RESOLUTION: admission
gates ENQUEUE (load shedding), drains are gated only by tank + scheduler, AND admission carries
a floor pMin > 0.

**P0-2 — "DRR weights adapting to throughput" is a feedback loop whose natural update rule is a
Pólya urn** — it converges a.s. to a RANDOM, path-dependent limit (capture; manifesto-§3
"weight" failure, literally). If adaptive weights are wanted, name the target functional (e.g.
equalize per-lane sojourn) and use Robbins–Monro decaying gains. Until then ship FIXED
Dirichlet α; mark adaptation research-grade.

**Four REQUIRED fixes to the landed hard code (verified against sources):**

1. `WeightedFairScheduler.selectLane` MUTATES deficits on every call, including idle ferry-loop
   iterations that never drain — DRR's bounded-lag theorem assumes credit accrual is 1:1 with
   service opportunities; peek-mutation breaks every fairness bound. Make selectLane pure (state
   transitions live in recordDrain).
2. Deficit WINDUP: idle (hasWork=false) lanes accrue deficit, then monopolize ~T·w consecutive
   drains on refill — unbounded transient starvation. Classic DRR resets deficit on queue-empty.
3. The fairness UNIT: recordDrain subtracts flat 1.0 ignoring batchSize/bytes, so "proportion"
   means boat-count, not throughput. Pin the unit (recommend BYTES — it's what the heat ledger
   meters anyway).
4. LOGICAL TIME ONLY: RateEwma/DrainSeq driven by the selection counter, never wall clock
   (Property 3 dies otherwise). Landed code is clean today; pin it in the spec.

## 1. SoftPriorityThrottle module shape (delivered as concrete F# signatures)

Seed discipline is load-bearing: counter-based, DOMAIN-SEPARATED streams (Philox/Salmon et al.
SC'11; SoftThrottle.admit's mix(seed + tick·φ) is already the pattern). One master seed; each
decision SITE gets siteSeed = mix(masterSeed ^ tag(site)); draw n = mix(siteSeed + n·φ). Every
soft decision is a pure function of (masterSeed, site, counter) — with a shared sequential RNG,
collapse order would change behavior; with counter-based streams it provably cannot.

Sites: AdmissionSite(lane) · WeightCollapseSite · OrderCollapseSite(lane) · TankSite(lane).
Per-lane: sigmoid steepness k_i, target sojourn L*_i, rate EWMA r̂_i (updated in recordDrain
only), per-lane Tank (HeatBudget = capacity), pMin floor. Pressure_i = q_i / (max(r̂_i,ε)·L*_i)
— Little's law (1961): dimensionless, 1 = at-target, composes with SoftThrottle unchanged.
admitEnqueue gates enqueue: draw < pMin + (1−pMin)·logistic(k_i, p_i).

Tanks: Independent | Coupled of C (constraints §3). Soft DRR weights: Dirichlet over the
simplex (α_i > 0), ONE deterministic simplex sample per drain — each collapsed vector sums to 1
BY CONSTRUCTION. Soft drain order: implicit Plackett–Luce ensemble, collapsed via Gumbel-max
(Gumbel 1954; Maddison 2014) — top-1 ≡ softmax lane choice, so soft-order and soft-selection
are ONE mechanism. NEVER materialize the N! permutation ensemble (SoftEmu lesson — implicit
form required; explicit lists only in tests, N ≤ 4). selectionEntropy exposed as the
never-collapse-silently observable. wrapHandler composes unchanged per lane.

## 2. Soft variants of the 12 hard properties (defensible forms)

- Strict priority → P(top lane) ≥ 1 − (N−1)e^(−βΔmin), → 1 EXPONENTIALLY as β→∞ (the hard
  scheduler is the β→∞ limit, exactly as admitHard is k→∞ — one mechanism, both registers).
- No-starvation → (a) starvation-free a.s. for any β < ∞ (softmax floor + Borel–Cantelli II);
  (b) proportional convergence is CONDITIONAL: all lanes backlogged + FIXED weights + fixes
  §4b/4c/4d ⇒ drains_i(n)/n → α_i/Σα a.s., O(1/√n) CLT fluctuation. The handoff's unconditional
  form is FALSE (P1-3) — state it conditionally or it fails on the first idle lane.
- DST determinism: unchanged in strength; drain order = f(masterSeed, config, enqueue sequence).
- Single-lane equivalence: k→∞, β→∞, pMin→0, Cap→∞ reproduces hard FerryThrottler exactly.
- Backpressure isolation: exact in independent mode; in coupled mode influence flows ONLY
  through C, bounded by ‖C‖ — a declared, metered channel (noninterference §13).
- No-drop → NO-SILENT-DROP: admitted ⇒ processed a.s. (needs the pMin floor — P0-1); rejections
  explicit Results.
- Dispose/cancel/invalid-priority: stay hard (error paths gain nothing from softening).
- Serialization: float params REQUIRE shortest-round-trip decimal encoding (Ryū/Grisu class) or
  four-oracle golden parity breaks (culture-invariant + no-binary rules).

## 3. Coupled tanks — two modes; do not conflate

**(a) SHIP: first-order diffusive transfer** (the existing Tank is RC, not LC, despite the doc
comment). Drain d from lane j: Q_j −= d; Q_i += C_ij·d (clamp at Cap_i); heat_j += d·(1−Σ_i C_ij)
— the lost column mass IS the dissipated heat (lane-local Bekenstein ledger with explicit
transfer entries; resolves the Aaron-answer-#3 vs #4 tension, P1-1). Constraints on C:
C_ij ≥ 0, C_ii = 0, **column-substochastic (Σ_i C_ij ≤ 1)** = energy conservation in bookkeeping
form; ρ(C) < 1 so (I−C)⁻¹ converges and steady state is well-defined. Symmetry NOT required —
asymmetric C is the point (priority is directional).

**(b) RESEARCH: second-order LC with coupling** — needs a flow variable; energy conserved iff
undriven, undamped, K symmetric PSD (graph Laplacian); discrete stability needs
0 < η < 2/λmax(S); driven response at resonance scales 1/γ — undamped resonance is an
INSTABILITY, not a feature (P1-4: the spec's claims must be about the diffusive system until
the second-order mode is built and damped). Gate behind the A/B config Aaron asked for.

**Detailed balance — definitive: it FAILS in general and you should not want it.** The
operating throttler is DRIVEN (arrivals inject, drains dissipate) ⇒ nonequilibrium steady state
with circulating currents; reversibility is structurally violated for ANY coupling matrix. For
the undriven OU model: stationary Gaussian exists iff the drift is Hurwitz; detailed balance
additionally needs Onsager (K symmetric under isotropic noise). THE WEAKER CONDITION THAT
SUFFICES (write this in the spec): **positive Harris recurrence / geometric ergodicity via a
Foster–Lyapunov drift condition** (Meyn & Tweedie) — holds under the §2 hygiene (bounded state,
pMin/1−ε admission bounds, aperiodicity) and delivers a unique stationary distribution +
a.s.-convergent time averages — everything the soft properties consume. Write "ergodic," not
"equilibrium." DST caveat: a fixed seed is one deterministic orbit approximating the chain;
SoftEmu.stationary/softDistance is the right convergence harness.

## 4. Findings index

P0-1 admission-direction livelock · P0-2 Pólya-urn capture in adaptive weights ·
P1-1 coupled-tanks vs lane-local heat (resolved by column-substochastic ledger) ·
P1-2 normalization survives composition ONLY via whole-point collapses + domain-separated
streams (collapse order then provably irrelevant) · P1-3 the handoff's convergence property is
false as stated (conditional form given) · P1-4 RC-not-LC (Mirror name stays; claims must match
the diffusive object). ASSUMPTION flagged: InternalChannel snapshot atomicity at DoP>1
unverified (irrelevant to DST claims, which are DoP=1).

## Sources verified

SoftThrottle.fs · SoftEmu.fs · FerryThrottler.fs · ferry-throttler.ts · drain-scheduler.ts ·
priority-ferry-throttler.ts · .kiro/specs/ferry-throttler-priority-lanes/{design,requirements}.md
(line-level claims checked against landed code; read-only).
