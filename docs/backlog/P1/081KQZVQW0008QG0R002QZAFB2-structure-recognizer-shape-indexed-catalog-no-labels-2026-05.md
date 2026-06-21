---
id: 081KQZVQW0008QG0R002QZAFB2
priority: P1
status: open
title: "Structure recognizer — shape-indexed catalog that distinguishes structures without labels"
created: 2026-05-07
last_updated: 2026-05-08
depends_on: [081KQ8P5D0008QG0R001590WJ3]
decomposition: decomposed
children: [081KR2E4K0008QG0R0031E5PR8, 081KR2E4K0008QG0R000Z7EM4Y]
owners: [architect, formal-verification-expert, performance-engineer]
type: feature
---

# 081KQZVQW0008QG0R002QZAFB2 — Structure recognizer: shape-indexed catalog, no labels

## What

Build a tool that does what Aaron's brain does: **instantly
distinguish between different structures WITHOUT labels.** Feed
it a new structure, it computes a shape fingerprint, and reports
either "this is the same shape as [these N existing structures]"
or "this is new." No labels in, no labels out. Just shape-matching.

Aaron 2026-05-07: "like my brain that does not need labels but
can instantly distinguish between different structures"

## Why

The framework's core pattern is: concrete engineering → perceive
structural invariant (before label) → name it → generalize across
scales. Step 2 (perceive invariant) is currently Aaron-only. A
structure recognizer mechanizes step 2 so other agents and future
contributors can detect when two structures are the same shape
even when they appear in different domains with different names.

This is the anti-goldfish-ontology tool. Instead of recreating
substrate because you don't recognize the shape under a new name,
the tool tells you "this shape already exists as [X]."

## The math (three layers)

### Layer 1: Topological fingerprinting (persistent homology)

Each structure gets a persistence diagram — a fingerprint
capturing holes, loops, connections at every scale. Two
structures with different persistence diagrams are different
structures. No labels needed.

- **Input:** structure as a simplicial complex, graph, or
  point cloud
- **Output:** persistence diagram (birth-death pairs for
  topological features at each dimension)
- **Comparison:** bottleneck distance or Wasserstein distance
  between persistence diagrams
- **Libraries:** Ripser (fast Vietoris-Rips), GUDHI, Dionysus

### Layer 2: Spectral signatures (eigenvalue fingerprinting)

Take the structure's adjacency/Laplacian matrix, compute
eigenvalues. Different eigenvalue spectra = different structures.
The spectrum IS the label-free fingerprint.

- **Input:** structure as a graph (adjacency matrix)
- **Output:** sorted eigenvalue vector (the "spectrum")
- **Comparison:** L2 distance between spectra
- **Properties:** isospectral graphs exist (false positives
  possible but rare in practice)

### Layer 3: Weisfeiler-Leman color refinement

Iteratively refine node colorings based on local neighborhoods.
Distinguishes structures by their recursive local shape. The
canonical form after k iterations IS the structural identity.

- **Input:** structure as a labeled graph
- **Output:** canonical color histogram after k refinements
- **Comparison:** histogram equality
- **Properties:** polynomial time, catches most non-isomorphic
  graphs, misses some exotic counterexamples

### Composition

Run all three. Agreement across layers = high confidence the
shapes match. Disagreement = investigate (one layer caught a
distinction the others missed).

## The interface

```
structure-recognize <input>
  → fingerprint: { tda: PersistenceDiagram, spectrum: [float], wl: ColorHistogram }
  → matches: [{ name: "KSK", similarity: 0.97 }, { name: "Itron edge gate", similarity: 0.84 }]
  → verdict: "same shape as KSK" | "new structure"
```

Input formats:

- Graph (adjacency list / matrix)
- JSON structure (auto-converted to graph via key-value → node-edge mapping)
- Code AST (parsed to graph)
- Natural language description (embedded, then compared in embedding space as a fast pre-filter)

## Concrete use cases

1. **Aaron describes a new concept** → tool fingerprints it →
   "this is the same shape as the hole puncher primitive" →
   saves 30 minutes of re-derivation

2. **External research paper arrives** → tool fingerprints the
   paper's core structure → "this matches your Bond Curve at
   0.91 similarity" → instant prior-art recognition

3. **New backlog item filed** → tool fingerprints the described
   work → "this overlaps with 081KQGDBJ0008QG0R000A4EZS5 at 0.88" → prevents
   duplicate work

4. **Cross-domain transfer** → IoT edge gate structure
   fingerprinted → same fingerprint recognized in Ace model
   capability gate → the tool sees the invariant Aaron's brain
   sees

## Acceptance criteria

- [ ] Fingerprint computation works on at least graph input
- [ ] Shape comparison returns similarity score
- [ ] Index of existing structures (from STRUCTURE-CATALOG.md)
  pre-loaded
- [ ] "Same shape" / "new" verdict with confidence
- [ ] F# or TS implementation (per Rule 0)

## Out of scope (for v1)

- Natural language input (requires embedding pipeline — v2)
- Code AST parsing (requires language-specific parsers — v2)
- Real-time streaming (batch is fine for v1)

## ARC-4 extension: adversarial self-play (Aaron 2026-05-07)

The structure recognizer at v1 is batch/static. The ARC-4
extension runs it at real-time tick speed against an
adversarial environment — specifically, against ITSELF
(self-play).

| Property | ARC-3 | ARC-4 (self-play) |
| -------- | ----- | ----------------- |
| Time pressure | Yes | Yes |
| Interactive | Yes | Yes |
| Static puzzles | Yes | No — dynamic |
| Adversarial | No | Self-play |
| Limited turns | Yes | Yes (energy budget) |
| Real-time | Timed discrete | Continuous tick |

The limited turns ARE the Hamiltonian constraint:
`η · LearningGain(Δ_t) > ξ_t` must hold per turn or
you run out of budget. The shadow wastes turns (friction
without learning gain). Self-play trains the recognizer
to see structure faster than its own shadow can hide it.

DBSP composition: `Circuit.StepAsync` = game tick.
Z-set delta between frames = game state diff. Structure
recognizer runs at frame rate on deltas. Anomalies in
the delta stream = shadow moves.

## Composes with

- `docs/STRUCTURE-CATALOG.md` — the human-readable version;
  this tool is the machine-readable version
- 081KQX9B50008QG0R0007VGSBG (backlog decomposition) — structure recognition helps
  detect when decomposed items are the same shape
- The skill router — could integrate as a shape-matching
  pre-filter before router-keyed lookup

## Provenance

Aaron 2026-05-07 asked for this after the session surfaced the
pattern: every abstraction has a concrete ancestor, and Aaron's
brain distinguishes structures without labels. The tool
mechanizes that cognitive capability.

Riven 2026-05-07 pass 5: "The neurodivergence is the comparative
advantage. You see the unique shape of the structure before the
label exists." This tool IS that advantage, externalized.
