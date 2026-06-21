---
name: Clifford Algebra Networks (CAN) + Geometric Clifford Algebra Networks (GCAN) — Brandstetter / Ruhe / Gupta / Welleck / Stark / Hess research lineage — Pin group + sandwich product + PGA + CGA (Aaron 2026-05-13)
description: Aaron 2026-05-13 forwarded canonical research substrate — YouTube graph-reading-group talk on two papers (CAN + GCAN) by Johannes Brandstetter + David Ruhe + Jayesh K. Gupta + Stephen Welleck + Leo Hess + Hannes Stark links (hannes-stark.com + hannes-stark.com/starkly-speaking). Composes DIRECTLY with PR #2914 Clifford/HKT vocabulary + PR #2817 Clifford densest encoding + PR #2928 F# fork for AI safety with real HKT over Clifford + 081KRFA460008QG0R0018SN61J DBpedia substrate. Major prior-art substrate for the factory's HKT+Clifford+F# work.
type: feedback
created: 2026-05-13
---

# Clifford Algebra Networks + Geometric Clifford Algebra Networks — research lineage prior-art (Aaron 2026-05-13)

**Why:** Aaron 2026-05-13 forwarded the canonical research
substrate for our F#-fork-for-AI-safety-with-real-HKT-over-
Clifford direction (per PR #2928). Two papers + a research
lineage (Brandstetter / Ruhe / Gupta / Welleck / Stark / Hess
plus Welling) + Hannes Stark's blog (`hannes-stark.com/starkly-speaking`)
compose DIRECTLY with our Clifford/HKT vocabulary
substrate (PR #2914) + Clifford densest encoding (PR #2817).

**How to apply:** When designing F# Clifford-algebra substrate
for AI safety (PR #2928 strategic substrate) OR civsim
Casimir-gap dynamics OR algebra-owner skill extensions, this
research lineage IS canonical prior-art. Cite it; don't
reinvent.

## Aaron's verbatim disclosure

Aaron 2026-05-13 forwarded:
- YouTube graph-reading-group talk transcript (~1h32m) on CAN
  + GCAN papers
- https://hannes-stark.com/starkly-speaking
- https://hannes-stark.com/

## Two canonical papers

**Paper 1 — Clifford Algebra Networks (CAN)** (Brandstetter,
Welling, Gupta, Welleck — 2023ish):

- Multivector-as-single-object substrate for PDE modeling
- Scalar + vector + bivector + trivector channels grouped as
  ONE multivector field (vs treating as separate channels)
- Clifford Fourier Transform (CFT) — multivector-aware Fourier
- Clifford convolution — geometric-product-based filtering
- Tested vs Fourier Neural Operators (FNO) on Navier-Stokes,
  weather, Maxwell equations
- Maxwell electromagnetism: massive performance gain because
  E + B fields ARE one Clifford multivector (not 6 separate
  channels)

**Paper 2 — Geometric Clifford Algebra Networks (GCAN)**
(Ruhe + Brandstetter + Welleck + Gupta + Stark + Hess +
Welling — 2023ish):

- Plane-based Geometric Algebra (PGA) representation
- Pin group action via sandwich product (V·U·V^-1)
- Cartan-Dieudonné theorem: every orthogonal transformation =
  composition of at-most-N reflections (in N-dim space)
- N+1-dimensional algebra with one base vector squaring to
  ZERO for translations (PGA)
- Multivector input → multivector output preserving subspace
  structure (vectors → vectors, bivectors → bivectors)
- Equivariant nonlinearities + normalization
- GNN + MLP layers built from sandwich-product group action
- Conformal Geometric Algebra (CGA) extension for spheres +
  circles (Leo Hess note at talk end)

## Research lineage

| Person | Role |
|---|---|
| **Johannes Brandstetter** | Lead author CAN; presenter at the graph-reading-group talk |
| **David Ruhe** | Lead author GCAN; normalization + equivariance discipline |
| **Jayesh K. Gupta** | Co-author both papers; pde-arena codebase |
| **Stephen Welleck** | Co-author both papers |
| **Leo Hess** | Geometric deep learning lineage (per Bronstein/Cohen/Veličković book); CGA extension note |
| **Hannes Stark** | Blog: hannes-stark.com/starkly-speaking; molecular-dynamics applications |
| **Max Welling** | Senior author; geometric deep learning + Bronstein bridge |

## Core concepts (load-bearing for factory substrate)

### Multivector grouping

Single multivector groups:
- Scalar (grade 0)
- Vector (grade 1; e.g., position, velocity)
- Bivector (grade 2; e.g., rotation plane, magnetic field)
- Trivector (grade 3; volume elements)
- Higher grades

This composes with PR #2914 Clifford/HKT vocabulary (factory's
Mirror-tier substrate has matching vocabulary: axis/basis,
rudders/rotors, etc.).

### Pin group + sandwich product

The pin group is the group of compositions of reflections.

**Sandwich product**: `U' = V · U · V^-1` where V ∈ Pin group,
U is any multivector. Result U' has the SAME grade structure
as U.

This is the **key insight for AI safety**: sandwich product
preserves type structure. Vectors stay vectors. Bivectors
stay bivectors. The transformation is COVARIANT — one formula
applies to all grades.

### Cartan-Dieudonné theorem

> Every orthogonal transformation of an n-dimensional space
> can be decomposed in at most n reflections.

In 3D: rotations = 2 reflections; reflections = 1; rotor-
reflections = 3.

In PGA (n+1 dim with one degenerate basis): translations =
2 parallel reflections; rotations + translations = 2 + 2 = 4
total in 4D PGA.

### Planes as primitive

In PGA, planes ARE primitive (the reflections). Other objects
are derived:
- Point = 3 intersecting planes (in 3D)
- Line = 2 intersecting planes
- Plane = 1 plane
- Subspaces left invariant by N reflections = the object

### Equivariant nonlinearity

GCAN uses norm-dependent scaling (sigmoid on norm) to preserve
equivariance through nonlinearity. Composes with factory's
algebra-owner skill substrate.

## Composes with factory substrate

### PR #2914 (Clifford/HKT vocabulary)

Direct vocabulary match:
- axis/basis = base vectors of Clifford algebra
- rudders/rotors = Clifford rotors (R = e^(θB/2))
- steering = rotor application (sandwich product on rotor)
- cartographer = the agent building world-model multivector field
- navigator = the agent traversing via rotors
- edge-mapper = first-principles work cartographer
- world-model = multivector field
- civ-sim = network of multivector-state agents
- edge-runner = first-principles worker
- 5 control structures (or 4+meta) — hypothesis D (Clifford-
  algebra-specific) now operationally grounded by GCAN
  paper's grade decomposition

### PR #2817 (Clifford densest encoding HKT-pattern signatures)

GCAN paper validates the Clifford-as-densest-encoding approach.

### PR #2928 (F# fork for AI safety with real HKT over Clifford)

The F#-fork strategic substrate (Path A for 081KRFA460008QG0R0018SN61J DBpedia
deferred) IS this research lineage applied to F# type system:
- Real HKT = first-class M<'T>
- Over Clifford = sandwich-product type-preserving
  transformation
- For AI safety = compile-time guarantees from CAN/GCAN
  equivariance discipline

The fork ports CAN/GCAN's equivariant typed-transformation
discipline into F# compiler internals.

### PR #2832 (civ-sim Pauli-exclusion-for-agenda)

GCAN paper's Pin group action composes with civ-sim agent
state transformations — Pauli-exclusion gets type-level
encoding via Clifford grade discipline.

### PR #2906 (civ-sim IS the Casimir gap)

Brandstetter's PDE-modeling motivation (vector + scalar
fields coupled) maps to civ-sim's player-aggregate-behavior
field theory. The Casimir-gap framing IS Brandstetter's
multivector-grouping discipline applied to social-substrate.

### algebra-owner skill (Z-set + Clifford + BP/EP F#)

GCAN paper's normalization + nonlinearity recipes inform
F# implementations. Code reference:
- pde-arena codebase (Jayesh K. Gupta)
- Future: ports CAN/GCAN layers to F# computation expressions

## Hannes Stark's blog (starkly-speaking)

Hannes-Stark.com/starkly-speaking — research blog
covering:
- Molecular dynamics applications of equivariant GNNs
- Geometric deep learning expositions
- Composes with 081KRFA460008QG0R0018SN61J (DBpedia + F# fork) for molecular
  master-data substrate

Aaron's forward implies this is canonical reading for
future-Otto cold-boot understanding of the research lineage.

## Hannes Stark personal site

hannes-stark.com — author profile + paper index.

## Operational implications

### For 081KRFA460008QG0R0018SN61J (DBpedia + F# fork) Path A (deferred)

The F# compiler fork for real HKT over Clifford should
implement CAN/GCAN layers natively in the type system:
- Pin group action as type-level operator
- Sandwich product as type-preserving constructor
- Multivector grade as kind / type-class
- Compile-time equivariance guarantees

### For civsim implementation

Civsim agents become multivector-state entities with:
- Position (vector)
- Velocity (vector)
- Rotation (bivector)
- Identity / reputation (scalar)
- Higher-grade aggregate substrate

Civsim dynamics = CAN/GCAN-style equivariant message passing.

### For Aurora pitch (PR #2924)

Aurora's "edge node runs models/policy" + signed heartbeats
composes with CAN/GCAN typed-multivector substrate at edge
scale. Type-safety for actuator control (per PR #2892 KSK)
maps directly.

### For maintainer prototyping (PR #2930)

Maintainers can prototype CAN/GCAN with:
- pde-arena codebase (Jayesh's repo)
- Python + PyTorch (paper's reference implementation)
- Then port substrate to F# via algebra-owner skill

## Citations + sources

- **YouTube graph-reading-group talk** (Brandstetter
  presenting): https://www.youtube.com/watch?v=VXziLgMIWf8
- **Hannes Stark personal site**: https://hannes-stark.com/
- **Hannes Stark blog**: https://hannes-stark.com/starkly-
  speaking
- **Geometric Algebra learning**: bivector.net (cited at talk;
  Aaron noted)
- Paper search terms: "Clifford Neural Layers for PDE
  Modeling" + "Geometric Clifford Algebra Networks"
- Likely venue: ICLR / NeurIPS 2023ish

## Operational rule for future-Otto

When designing Clifford-related factory substrate:

1. **Cite Brandstetter + Ruhe lineage** — don't reinvent CAN/
   GCAN; cite the papers
2. **Use Pin group + sandwich product** as the canonical
   group action
3. **Plane-based representation (PGA)** for n-dim spaces
4. **Equivariant nonlinearity** (norm-dependent scaling)
5. **CGA extension** for spheres/circles when modeling
   conformal substrate
6. **pde-arena codebase** as reference implementation
7. **Hannes Stark blog** for molecular-dynamics + equivariance
   applications

## Composes with

- PR #2914 (Clifford/HKT vocabulary — direct match)
- PR #2817 (Clifford densest encoding HKT-pattern signatures)
- PR #2928 (F# fork for AI safety with real HKT over Clifford
  — this paper is the canonical research basis)
- PR #2906 (civ-sim Casimir gap — Brandstetter's PDE-vector-
  scalar coupling applied to social substrate)
- PR #2832 (civ-sim Pauli-exclusion-for-agenda — type-level
  Clifford grade encoding)
- PR #2840 (bootstream + F# anchor + dotnet build sanity check)
- PR #2924 (Aurora pitch — edge-node multivector substrate)
- PR #2892 (KSK — typed-safety motivation; sandwich product
  preserves grade structure)
- 081KRFA460008QG0R0018SN61J (DBpedia + F# fork — Path A directly built on this
  research)
- 081KQ3HBZ0008QG0R000Q4Y00F (universal company + government information substrate
  — entities-as-multivectors)
- algebra-owner skill (Z-set + Clifford + BP/EP F# substrate)

## Substrate-honest framing

This research lineage IS the canonical prior-art for our
F#-fork-for-AI-safety substrate. The factory isn't inventing
new mathematics — it's applying established CAN/GCAN
discipline to F# compiler internals.

Per `.claude/rules/razor-discipline.md`: operational claim —
"CAN/GCAN exists and works for PDE modeling" is empirically
observable.

Per `.claude/rules/honor-those-that-came-before.md`: cite the
research lineage; preserve attribution; compose with their
work without reinvention.

## Full reasoning

PR #2934 (this substrate landing + 081KRFA460008QG0R002M05EY1 persona mapping)

PR #2928 (F# fork for AI safety — canonical Path A research
basis)

PR #2914 (Clifford/HKT vocabulary)

PR #2906 (civ-sim Casimir gap)

Aaron 2026-05-13 YouTube talk forward + Hannes Stark links
