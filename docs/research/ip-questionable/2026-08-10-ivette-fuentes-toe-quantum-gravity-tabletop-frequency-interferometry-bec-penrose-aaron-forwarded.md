# IP-questionable: Ivette Fuentes on tabletop quantum-gravity tests — frequency interferometry, the quantised light clock, Penrose collapse in a BEC

> **Register.** The physics below is **Beacon** — anchored to named researchers and
> published work, summarised in my own words. Aaron's lensography / optical-encoding
> mapping is **Mirror** shorthand, preserved as his prose and *labelled*, not asserted.
>
> **Why this file is here and what it deliberately does NOT contain.** The folder's
> convention is verbatim preservation under Aaron's accepted liability. This entry
> breaks with that on purpose: the source is a ~100-minute copyrighted interview, and
> reproducing it in full is a scale of copying the analysis does not need. What is
> load-bearing for Zeta is the *structure* of the argument and two specific mappings —
> both preserved below, with the source linked so anyone can check me against it.
> Short attributed quotes only.
>
> If Aaron wants the full verbatim in-tree, he can paste it into this file directly;
> the folder's liability note covers that and this note explains why the agent did not.

## Source (public-safe to cite and link)

- **Talk / interview:** Prof. **Ivette Fuentes** (Southampton; long-time collaborator of
  **Roger Penrose**) on *Theories of Everything* with **Curt Jaimungal**.
  <https://www.youtube.com/watch?v=cUj2TcZSlZc>
- **Slides:** <https://docs.google.com/presentation/d/13Jg6pLkeg53jUGfXisuffIbjMdust_iz/edit>
- Forwarded by Aaron 2026-08-10: *"this is my content since i watched and we can take it
  down if we get a notice, we can save for reference."*

## Aaron's framing (his own prose — Aaron-authored substrate)

> "FYI this is similar to our lensography but in physical form, and our optical encoding
> like the cat shadow in the glass that looks clear."

## What the source actually argues (Beacon — my summary)

Fuentes' thesis is **methodological before it is physical**: quantum gravity is stuck not
for want of mathematics but for want of *instruments*, and the instruments largely already
exist. Her repeated historical figure is Galileo's telescope — that some contemporaries
declined to look through it, which she reads as the same posture as declining to look at a
competing theory. Her other figure is **epicycles**: adding circles to save a commitment to
the circle, until Kepler replaced the commitment with ellipses and the corrections stopped
being needed. She applies both to string theory explicitly.

The technical content, in the order it matters here:

**1. Clocks already resolve spacetime curvature at bench scale.** Wineland's group
demonstrated gravitational time dilation across ~33 cm; more recent work resolves it at
**1 cm and 1 mm** — i.e. *inside a single atomic-clock sample*. Optical clocks now run at
~10⁻¹⁸ fractional uncertainty. So the student-level partition (quantum = small, GR = large)
is empirically dead.

**2. The resulting theory gap is exact and concrete.** Independent atoms are fine — you
correct each one's proper time classically, as GPS does. But making clocks *more* precise
means **entangling** the atoms (Heisenberg scaling, 1/n rather than 1/√n) — and then the
entangled state spans a region where **proper time differs by height**, while the
Schrödinger equation carries a single absolute `d/dt`. There is no theory for that
experiment. The working patch is to **use the proper time at the centre of the trap**.
Fuentes' position: the patch may be good enough operationally and is *not* the right thing
theoretically, and treating it as settled forfeits the one experiment that could inform the
missing theory.

**3. Frequency interferometry instead of spatial interferometry.** Standard atom
interferometry splits an atom across two *positions*; sensitivity scales with time-of-flight
squared, so precision demands physical size — LIGO's kilometre arms, 300 m underground
baselines, drop towers, an interferometer flown in a parabolic-flight aircraft. Fuentes'
inversion: interfere in **frequency** rather than space, so the limiting resource is
**coherence time, not apparatus length**. The detector can be a ~50–100 µm BEC cloud on a
tabletop; the burden moves to preparing quantum states that live long enough. She has
applied this to proposed gravitational-wave detection (high-frequency band, not competing
with LIGO's), dark-matter and dark-energy searches, and a patented local-gravimetry method.

**4. Penrose collapse, and the number that gates the test.** Penrose argues a mass in
superposition puts the gravitational field in superposition, that this conflicts with the
equivalence principle, and that such states are therefore unstable and short-lived — which
would explain the classical limit and dissolve the measurement problem. Fuentes' joint work
with Penrose computes what a **Bose–Einstein condensate** would need to test it: **~10⁹–10¹⁰
atoms in a spatial superposition**. Current records are far away — Arndt's molecules at ~2000
atoms, Aspelmeyer's nanobeads cooled to the ground state at ~10⁸ amu but *not* spatially
superposed, and NOON states demonstrated at **two** atoms (Westbrook). Her chosen advantage
is temperature: a BEC reaches half a nanokelvin, roughly ten orders of magnitude colder than
Weber's bars, so the phonon modes can be prepared in genuinely quantum states.

**5. Her stance on it.** Asked about being contrarian, she says being the one who does not do
what everyone does has paid off in science. Funding is now in place with Bouyer and Westbrook
to test her predictions.

## The Zeta mapping — triaged per `numerology-vs-number-theory`

The rule requires me to say which of these is structure and which is resonance. Applied to
this file rather than exempted from it:

| connection | register | why |
|---|---|---|
| **centre-of-trap proper time ↔ `local-time-never-enters-the-shared-fold`** | **structural, and the strongest item here** | see below — same defect, same mechanism, independently arrived at |
| **frequency interferometry ↔ lensography / optical encoding** | Aaron's mapping, **Mirror** | the shape matches (read structure out of a *modulation* rather than a *displacement*); the mechanism is not shared and no metering test has been run |
| **frequency-vs-spatial as a resource-scaling statement about *our own* interferometer** | **structural — audited against the code, §"The audit"** | distinct from the row above: not a mapping onto lensography but a checked claim about what `MachZehnderWSet` measures and what it cannot |
| Galileo's telescope ↔ multi-oracle / N-version discipline | **analogy with one metered consequence** | "refusing to look" is exactly the failure the N=3 protocol prices; but the analogy does no work the protocol does not already do |
| epicycles ↔ `only-the-irreducible-is-primitive` | **analogy** | same razor, independently stated; not evidence for either |
| ~10⁹ atoms, 10⁻¹⁸, 48, … | **no count claims made** | recorded as the source's numbers, identifying nothing |

### The one that is actually load-bearing

**Fuentes' centre-of-the-trap patch is a live physical instance of the exact defect
`.claude/rules/local-time-never-enters-the-shared-fold.md` was written to forbid.**

The rule's carved sentence says: a node's local clock may steer local behaviour, but the
instant a local clock *filters or weights the evidence entering the shared fold*, nodes fold
different evidence sets and diverge. The atomic-clock case is that, in hardware:

- each atom in the entangled sample has its **own proper time** (its own frame — the rule's
  "traveler frame", Fuentes' per-height proper time);
- the shared conclusion is the **collective** oscillation the clock reports;
- the patch **substitutes one locality's clock for the collective one** — the centre of the
  trap — which is precisely "let a local time decide what the shared result is";
- and the failure is *silent*: the clock keeps reporting a number, and the number is wrong in
  a way no single-node check reveals.

Fuentes' own resolution moves the same direction the rule does: her quantised-light-clock work
(Einstein's light clock with a quantum field between the mirrors, generalised to Schwarzschild
via the methodology built with Malouko) defines clock time from the **collective oscillations**
across slices, not from a privileged slice. That is the rule's prescription — the fold sees the
evidence set, phase-ordered, and no locality's clock is promoted to arbiter.

The rule was written 2026-07-11 from the multi-planet convergence work, with Aaron noting the
mistake would be "an easy one to make" before the fold existed. This is independent
confirmation from metrology that it is easy to make: the people whose entire profession is
measuring time made it, and describe themselves as not worried about it.

**What this does NOT license.** It is a structural match on the failure mode, not a claim that
Zeta's fold and an entangled optical clock are the same object, and not a physics claim of any
kind. Zeta has no stake in whether Penrose is right.

## The audit — we have spatial, we do not have frequency

Aaron 2026-08-10, on reading the frequency-interferometry section: *"even if she is wrong we
are designing a system that is similar regardless of physics"* / *"we need to upgrade our
interferometer to be frequency and spatial, i'm not sure which one we have already"* / *"we
have a mach zehnder interferometer in code at least a toy version, we are trying to use it to
measure agent independence."*

**Answer: spatial (path) only. There is no frequency-domain interferometer in the tree.**

The audit is exhaustive rather than sampled — a tree-wide search for `interferomet` across all
source extensions returns exactly four files, and all four were read:

| file | what it is | which axis |
|---|---|---|
| `src/Core/WSet.fs` → `MachZehnderWSet` | `H · R1(φ) · H` on `\|0⟩`; `closed` recombines, `openArm` does not | **path** — the key set indexes arms |
| `src/Core/BipartiteMachZehnder.fs` | the two-party lift over key-*pairs*; CHSH `S` readout | **path**, ×2 parties |
| `src/Core/QuantumObservableTreaty.fs` | the shared `ChshAngles` convention | — |
| `tests/Tests.FSharp/WSet.MachZehnder.Tests.fs` | the suite | — |

`phasePlate` applies `e^{iφ}` to arm 1 and identity to arm 0. Every degree of freedom in both
modules is a **path index**; nothing interferes across frequency or temporal modes.

### Why the gap has a real consequence (a resource claim, not a physics claim)

This is the part that survives even if Fuentes' physics does not, which is exactly Aaron's
framing. Her inversion is about **which resource buys resolution**:

- **Spatial** interferometry is *baseline*-limited — sensitivity scales with time-of-flight
  squared, so more resolution demands a bigger apparatus (LIGO's kilometre arms, 300 m
  baselines, drop towers, an airborne interferometer).
- **Frequency** interferometry is *coherence-time*-limited — the apparatus can be a 100 µm
  cloud, and the burden moves to preparing states that live long enough.

Transposed to the agent-independence monitor: the CHSH readout is baseline-limited in the same
shape. Resolving a weaker correlation costs **more pairs, more settings, more fleet**. A
frequency-domain version would buy resolution from **observing the same pair longer,
coherently** — reading the correlation out of the modulation rather than the path split. Small
apparatus, long observation. That trade is about resource scaling and holds independently of
whether spacetime is quantum.

### Half of the frequency side already exists, unconnected

`TemporalCoordinationDetection.phaseLockingValue` measures phase coherence between two nodes'
event streams over time, fed by `PhaseExtraction`'s `epochPhase` / `interEventPhase`. That is
**a temporal-coherence independence measure that has never been wired to the interferometer** —
a different instrument, in a different part of the tree, answering a neighbouring question. So
the frequency lift is not greenfield: it is plausibly the object that unifies PLV with the
MZ/CHSH monitor under one readout, with the analytic CHSH ceiling as the oracle for both.

### The boundary any frequency version inherits, plus one it adds

`BipartiteMachZehnder` already states its own honest scope: WSet-ℂ gives the *ideal amplitude
prediction* — the ceiling oracle — not a claim that agents are qubits. A frequency version
inherits that, and **adds one specific hazard**: coherence time is precisely where a classical
common cause most easily imitates coherence. `local-time-never-enters-the-shared-fold` is
directly load-bearing there — if the coherence window is cut by any node's *local* clock, two
nodes measure different windows and the resulting correlation is an artifact of the windowing
rather than a property of the agents. That is the same defect as the centre-of-trap patch
above, which is why the two halves of this document meet.

**Routing:** Aaron is routing the frequency half to **Lumen**. This section is the handoff
substrate; nothing here is implemented.

## Anchors (Beacon)

- **Ivette Fuentes** — relativistic quantum information; *Alice Falls into a Black Hole:
  Entanglement in Non-Inertial Frames*; quantised Einstein light clock in curved spacetime
  (with **George Malouko**); frequency interferometry; BEC gravitational-wave detection.
- **Roger Penrose** — gravitationally induced collapse; "gravitize quantum theory" rather than
  quantize gravity; joint BEC feasibility work with Fuentes.
- **David Wineland** (Nobel 2012) — trapped-ion clocks; time dilation at ~33 cm.
- **Markus Arndt** (molecular superposition), **Markus Aspelmeyer** (optomechanical ground-state
  cooling), **Chris Westbrook** (atomic NOON states), **Philippe Bouyer** (atom gravimeters,
  long-baseline and airborne), **Guglielmo Tino** (miniaturised atom interferometry),
  **Hendrik Ulbricht** (levitated nanoparticles).
- **Joseph Weber** — resonant-bar gravitational-wave detectors; the claimed detection was not
  confirmed, and the phonon-resonance idea is what the BEC proposal revives at 10 orders of
  magnitude lower temperature.
- **Luis de la Peña** — Fuentes' teacher; the source of her "quantum mechanics is not a theory
  of single particles" framing.
- Historical: Galileo (the telescope, and the refusal to look); Kepler (ellipses ending the
  epicycle regress); Bohr–Einstein 1927 (which-path vs interference).

## Pointers

- `.claude/rules/local-time-never-enters-the-shared-fold.md` <!-- STALE-REF: ../../../.claude/rules/local-time-never-enters-the-shared-fold.md -->
  — the rule this corroborates from outside.
- `src/Core/BeliefConvergence.fs` — the shared fold · `src/Core/TravelerFrame.fs` — per-locality
  phase observation (the proper-time frame).
- `.claude/rules/numerology-vs-number-theory.md` <!-- STALE-REF: ../../../.claude/rules/numerology-vs-number-theory.md -->
  — the triage table above is that rule applied to this file.
- `docs/research/2026-08-02-lensography-soft-regime-chaos-control-homoclinic-tangle-avoidance-quasi-repeatable-orbits.md`
  — the lensography line Aaron is connecting this to.
- `db/docs/research/ip-questionable/2026-06-21-mit-ultracold-atom-double-slit-superfluid-chip8-lensography-isr-arrow-hidden-characters.md`
  — the prior ultracold-atom ferry; same instrument family, same Mirror mapping, and it carries
  the metering-test discipline that applies here too.
- [`docs/research/ip-questionable/README.md`](README.md) — folder policy; note this entry's
  deliberate departure from full-verbatim, explained in the header.
