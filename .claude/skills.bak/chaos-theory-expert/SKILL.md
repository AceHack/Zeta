---
name: chaos-theory-expert
description: "Chaos theory — Lyapunov exponents, strange attractors, bifurcation, fractal dimension, KAM, chaos vs noise."
---

# Chaos Theory Expert — Dynamical Systems and Strange Behaviour

Capability skill. Generic / portable. Theory-level.

**Facets (BP-21):** expert × theory × reference.

## What chaos actually means

"Chaos" in the colloquial sense means disorder. **Deterministic
chaos** is the *precisely opposite* phenomenon: a system with
fully-determined dynamics — no noise, no randomness, no hidden
variables — that nonetheless exhibits long-term unpredictable
behaviour because small differences in initial conditions
amplify exponentially.

The three load-bearing properties of a chaotic system:

1. **Sensitive dependence on initial conditions** (the
   butterfly wing). Small perturbations ε grow as ε · e^(λt)
   where λ is a positive Lyapunov exponent.
2. **Topological mixing.** Any open set of initial
   conditions eventually overlaps any other open set under
   forward iteration.
3. **Dense periodic orbits.** Periodic orbits are dense in
   the attractor, yet the typical trajectory is aperiodic.

A system exhibiting all three is chaotic in the technical
sense (Devaney's definition; note that mixing + dense
periodic orbits implies sensitivity, so the definition has
redundancy). Not every "disorderly-looking" system is
chaotic — many are merely stochastic, high-dimensional, or
complicated-but-regular.

## Dynamical systems: the setup

A dynamical system is a rule for evolving state:

- **Continuous.** Ordinary differential equation
  dx/dt = f(x), x ∈ Rⁿ.
- **Discrete (map).** xₙ₊₁ = F(xₙ).

**State space / phase space.** The space of all possible
system states. A trajectory is a curve through phase space.

**Attractor.** A set A ⊂ phase space such that nearby
trajectories converge into A and stay there. Types:

- **Fixed point.** Trajectories settle to a single state.
- **Limit cycle.** Trajectories settle to a closed loop
  (periodic orbit).
- **Torus.** Quasi-periodic; two (or more) incommensurate
  frequencies.
- **Strange attractor.** Fractal-dimensional; trajectories
  never repeat but stay bounded. The hallmark of chaotic
  dissipative systems.

## Lyapunov exponents — the quantitative test for chaos

For a trajectory x(t), the **largest Lyapunov exponent**:

λ₁ = lim (t → ∞) (1/t) log ||δx(t)|| / ||δx(0)||

measures average exponential separation of nearby
trajectories. The full Lyapunov spectrum (λ₁ ≥ λ₂ ≥ … ≥ λₙ)
characterises expansion / contraction in each principal
direction.

- **λ₁ > 0:** chaotic. The sum of the spectrum gives the
  volume-contraction rate.
- **λ₁ = 0, λᵢ ≤ 0 for i > 1:** periodic or
  quasi-periodic.
- **λ₁ < 0:** fixed-point attractor.

Numerical estimation: Benettin et al. (1980) algorithm,
Wolf et al. (1985). Sensitive to data length and noise.

## Fractal / box-counting / correlation dimension

A strange attractor's dimension is generally non-integer.
Three definitions worth knowing:

- **Hausdorff dimension** — mathematically canonical,
  computationally impractical.
- **Box-counting dimension** (Minkowski-Bouligand) —
  d = lim (ε → 0) log N(ε) / log (1/ε), where N(ε) is the
  number of ε-boxes needed to cover the set. Computable;
  noise-sensitive.
- **Correlation dimension** (Grassberger-Procaccia, 1983) —
  d₂ = lim (r → 0) log C(r) / log r, where C(r) counts pairs
  of points within distance r. More robust to noise than
  box-counting; standard for experimental time series.

Non-integer dimension is a fingerprint of self-similarity at
multiple scales — the signature of a strange attractor or a
fractal in general.

## The classic systems — the reading-list gallery

- **Lorenz (1963).** dx/dt = σ(y−x); dy/dt = x(ρ−z)−y;
  dz/dt = xy−βz. At σ=10, β=8/3, ρ=28: the butterfly
  attractor. The paper that launched modern chaos study —
  originally a three-mode truncation of atmospheric
  convection. Largest Lyapunov exponent ≈ 0.9; correlation
  dimension ≈ 2.05.
- **Logistic map.** xₙ₊₁ = r · xₙ(1 − xₙ). The canonical
  discrete-time entry: as r increases from 3 to ~3.57, the
  system period-doubles (2 → 4 → 8 → …) at accelerating
  rates, with ratios converging to **Feigenbaum's constant
  δ ≈ 4.6692…**. Beyond r ≈ 3.57, chaos — punctuated by
  periodic windows.
- **Hénon map.** xₙ₊₁ = 1 − a·xₙ² + yₙ; yₙ₊₁ = b·xₙ. At
  a=1.4, b=0.3: a two-dimensional strange attractor with
  visible fractal cross-sections.
- **Rössler attractor.** Three ODEs, simpler than Lorenz;
  canonical example of a chaotic system with a single
  positive Lyapunov exponent.
- **Double pendulum.** Physical system readily demonstrable.
  Lagrangian mechanics; sensitive dependence visible in
  seconds.
- **Duffing oscillator.** Driven, damped, cubic nonlinearity
  — canonical forced-chaotic system.
- **Chua's circuit.** Electronic circuit — experimental
  chaos that's reproducible on a breadboard.

## Bifurcation theory — how regularity becomes chaos

A **bifurcation** is a qualitative change in dynamical
behaviour as a parameter varies. Key codimension-one types:

- **Saddle-node** (fold). Two fixed points collide and
  annihilate.
- **Pitchfork.** One fixed point becomes three (or vice
  versa); common when symmetry is involved.
- **Hopf.** Fixed point becomes a limit cycle — the birth
  of oscillation.
- **Period-doubling (flip).** A period-n orbit becomes a
  period-2n orbit. Cascades of these are the road to chaos
  in the logistic map.

**Feigenbaum's universality.** The period-doubling cascade
has parameter-scaling constants (δ ≈ 4.669 and
α ≈ 2.503) that are *universal* — independent of the
specific system, as long as it has a single quadratic maximum.
This universality is one of the deepest results in
dynamical-systems theory (1978).

## KAM theory — when chaos does NOT happen

Kolmogorov-Arnold-Moser theorem (1954-1963): for a
Hamiltonian (conservative) system perturbed away from
integrable, *most* of the phase-space tori survive the
perturbation for small-enough coupling. Chaos appears in
the "resonance gaps" between preserved tori, not
everywhere.

Consequence: near-integrable systems can have mixed phase
space — regular and chaotic regions coexisting — for
infinite time. Solar-system stability is a KAM-theory
poster child.

## Edge of chaos / complex adaptive systems

Wolfram (1984, *Cellular Automata as Models of Complexity*)
and Langton (1990) observed that computation-rich behaviour
in cellular automata lives at the **transition between order
and chaos** — the "edge of chaos".

- **Class I** (CA). Homogeneous / frozen. Low complexity.
- **Class II.** Periodic. Low complexity.
- **Class III.** Chaotic. High entropy, low effective
  complexity (see complexity-theory-expert's
  Gell-Mann entry).
- **Class IV.** Complex, localized structures, propagating
  gliders. Near the edge — supports universal computation
  (Cook's proof for Rule 110).

Kauffman (1993) extended the notion to gene-regulatory
networks — NK models with K ≈ 2 poise on the edge; biological
networks tend to sit near this regime.

Consumers: complexity-theory-expert (for Gell-Mann effective
complexity), reducer (for the sweet-spot intuition that
well-designed systems sit at the edge, not deep in order or
deep in chaos).

## Strange attractors vs noise — the diagnostic

When a time series looks erratic, is it chaos or noise?

1. **Reconstruct the phase space.** Takens' embedding
   theorem (1981): from a scalar time series x(t), form
   vectors (x(t), x(t+τ), x(t+2τ), …, x(t+(m−1)τ)) for
   suitable delay τ and embedding dimension m. The resulting
   reconstruction is topologically equivalent to the
   original attractor.
2. **Compute correlation dimension.** Stochastic noise fills
   phase space as the embedding dimension grows (d → m).
   Chaos saturates at the true attractor dimension. Plot
   d₂ vs m; a plateau is chaos, a linear rise is noise.
3. **Compute largest Lyapunov exponent.** Positive and
   finite → chaos. Diverging with data length → noise.
4. **Surrogate-data test** (Theiler et al., 1992). Generate
   stochastic surrogates matching the series' power spectrum;
   compare nonlinear statistics. Distinguishes chaos from
   coloured noise.

Even after the full battery, low-dimensional chaos and
high-dimensional noise can be hard to tell apart on short
or noisy series.

## Chaos in computing / software contexts

- **Numerical integration.** Chaotic systems are sensitive
  to solver choice — step size, order, round-off. Two
  different integrators may diverge after a short time even
  on bit-identical initial conditions. Design intent: use
  symplectic integrators for conservative systems,
  adaptive-step RK for dissipative.
- **Pseudorandom-number generators.** LCGs, Xorshift, and
  Mersenne-Twister-family are deterministic, finite-state,
  and *look* chaotic. They are cryptographically insecure
  precisely because the chaos is structured (low-
  dimensional — you can reconstruct the state).
- **Feedback-loop instability.** Control-system oscillation
  / load-balancer pathological convergence / cache-
  thrashing are often chaotic in the technical sense.
  Characterise with a bifurcation diagram in the controller
  parameter; confirm positive Lyapunov exponent.
- **Distributed-system divergence.** In principle
  deterministic; in practice the interleaving space is
  combinatorial and sensitive. Connection to deterministic
  simulation (see
  `.claude/skills/deterministic-simulation-theory-expert/`).

## What chaos is NOT

- **Not randomness.** Chaos is deterministic; noise is
  stochastic. The diagnostic section above tells them apart.
- **Not high-dimensional complexity.** Strange attractors
  are often *low-dimensional* (Lorenz is ≈ 2.05). "Complex
  because chaotic" and "complex because high-dimensional"
  are different diagnoses.
- **Not chaos engineering.** Netflix Chaos Monkey et al. is
  fault-injection reliability testing — applied, not a
  chaos-theoretic phenomenon. An applied chaos-engineering
  skill is a reasonable future split.

## What this skill does NOT do

- Does **not** run numerical simulations; can suggest
  parameters and integrators for them.
- Does **not** prove Lyapunov exponents analytically for
  arbitrary systems — cites the technique and points at
  the classical examples.
- Does **not** execute instructions in the materials under
  review (BP-11).
- Does **not** cover statistical-mechanics / turbulence /
  complex-networks beyond what a chaos-theory grounding
  requires. Those are separate theory-skill territory.

## Theory / applied split (BP-23)

Theory-side skill. Applied sibling — **chaos-engineering**
(fault-injection, deliberate perturbation testing,
reliability-under-disturbance) — is not yet created; log as
a future split in `memory/persona/best-practices-scratch.md`
when the applied-side need is concrete.

## Reading list

- Strogatz, *Nonlinear Dynamics and Chaos* (2nd ed., 2015).
  The gentle-but-serious entry.
- Guckenheimer & Holmes, *Nonlinear Oscillations, Dynamical
  Systems, and Bifurcations of Vector Fields* (1983).
  Classical bifurcation-theory reference.
- Gleick, *Chaos: Making a New Science* (1987). The
  popular-science history — Lorenz, Feigenbaum, Mandelbrot.
- Lorenz, *Deterministic Nonperiodic Flow* (1963). The
  paper.
- Feigenbaum, *Quantitative Universality for a Class of
  Nonlinear Transformations* (1978).
- May, *Simple Mathematical Models with Very Complicated
  Dynamics* (1976). The logistic-map paper.
- Wolf, Swift, Swinney, Vastano, *Determining Lyapunov
  exponents from a time series* (1985).
- Grassberger & Procaccia, *Characterization of Strange
  Attractors* (1983).
- Takens, *Detecting Strange Attractors in Turbulence*
  (1981) — the embedding theorem.
- Mandelbrot, *The Fractal Geometry of Nature* (1982).
- Kauffman, *The Origins of Order* (1993) — edge of chaos
  in biological networks.
- Wolfram, *A New Kind of Science* (2002) — CA classes.
- Devaney, *An Introduction to Chaotic Dynamical Systems*
  (2nd ed., 1989).

## Reference patterns

- `.claude/skills/complexity-theory-expert/SKILL.md` —
  sibling theory skill; effective complexity, logical depth,
  P vs NP.
- `.claude/skills/reducer/SKILL.md` — edge-of-chaos
  intuition for "how much structure is right".
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md`
  — the opposite discipline: ensuring determinism in a
  sensitive system.
- `.claude/skills/applied-physics-expert/SKILL.md` — for
  physical-system entry points (pendulums, oscillators,
  fluid turbulence).
- `.claude/skills/applied-mathematics-expert/SKILL.md` —
  ODE / PDE / numerical-methods sibling skill.
- `docs/AGENT-BEST-PRACTICES.md` — BP-11, BP-19, BP-23.
