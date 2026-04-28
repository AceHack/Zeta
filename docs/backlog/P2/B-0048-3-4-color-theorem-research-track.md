---
id: B-0048
priority: P2
status: open
title: 3-color / 4-color theorem research track — graph coloring, computer-assisted proof, Gonthier Coq formalization, formal-verification routing
tier: formal-verification-research
effort: L
ask: Aaron 2026-04-21 — *"3 4 color theorm backlog"*
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [B-0050, B-0051, docs/research/chain-rule-proof-log.md, tools/lean4/Lean4/DbspChainRule.lean, .claude/agents/formal-verification-expert.md, feedback_teaching_is_how_we_change_the_current_order_chronology_everything_star.md]
tags: [graph-coloring, four-color-theorem, three-color, gonthier-coq, appel-haken, formal-verification, lean4, alloy, z3, csp, proof-by-reflection, planar-graphs]
---

# B-0048 — 3-color / 4-color theorem research track

## Origin

AceHack commit `2eef721` (2026-04-21). Aaron's five-token ask landing two adjacent-but-distinct research threads in one row.

## What this row owns

(a) **Four-color theorem** — every planar graph is 4-colorable; Appel-Haken 1976 first major computer-assisted proof; Robertson-Sanders-Seymour-Thomas 1996 simplified proof; **Gonthier 2005 Coq formalization** — landmark proof-assistant accomplishment reducing trust to a small kernel.

(b) **3-coloring** — NP-complete decision problem on general graphs; polynomial on restricted classes; boundary with 4-color by the theorem itself on planar graphs.

## Why this matters to Zeta (F1 engineering-first)

Three converging factory-surface pressures:

### 1. Formal-verification portfolio routing

Soraya's routing authority picks Alloy / TLA+ / Z3 / Lean / FsCheck per property class. Graph-coloring is a canonical case study: the same property (k-colorability) has radically different natural encodings in each tool — Alloy first-order relational (natural), Z3 SMT with bit-vector coloring (fast for small k, bounded graphs), Lean with `Mathlib.Combinatorics.SimpleGraph` + chromatic-number definitions (proof-closure, not just model-finding). The 3/4-color boundary gives a clean worked example of "when does decidability shift the tool choice?" — 3-coloring is NP-complete so SAT/SMT dominates; 4-color on planar is theorem-dependent so Lean/Coq with imported results dominates.

### 2. Computer-assisted-proof heritage

Appel-Haken 1976 was the first major result where the community had to decide whether a computer-enumerated case analysis counts as a proof — the same epistemic question Zeta's measurable-alignment time-series poses. Gonthier's 2005 reformalization in Coq closed the loop: the 633 discharging configurations are mechanically checkable, the reducibility predicate is a small trusted kernel, the case-enumeration is reflective. This is the exact shape Zeta's Lean-reflection row (B-0050) is reaching for. **The four-color formalization is the canonical pedagogical target for proof-by-reflection.**

### 3. Constraint-satisfaction ↔ planner cost model

Graph coloring is the paradigmatic CSP. Imani's planner (operator-cost model) already reasons about join-ordering as a CSP; the coloring algorithms (DSATUR, Welsh-Powell, backtracking with constraint-propagation) are structurally cousin to the pipeline-scheduling problems Zeta already solves. Retraction-native twist: can a k-coloring be maintained under additive/subtractive graph deltas without full re-coloring? (Sometimes yes, with bounded recoloring budget — directly relevant to Zeta's incremental-recomputation discipline.)

## Scope (staged)

- **Stage 1 — Alloy-scale finite 3-coloring probe:** small `docs/3Coloring.als` modelling a tiny graph + `check NoMonochromaticEdge for 5`. Effort: S.
- **Stage 2 — Z3 chromatic-number upper-bound search:** `tools/z3/chromatic.smt2` encoding. Test on benchmark graphs (Petersen graph, Mycielski constructions). Effort: S.
- **Stage 3 — Lean 4 + Mathlib chromatic-number reading group:** port a small exercise from `Mathlib.Combinatorics.SimpleGraph.Coloring` into `tools/lean4/Lean4/GraphColoring.lean`. Effort: M.
- **Stage 4 — four-color case study (Gonthier-following):** read Gonthier's paper; trace how the reducibility predicate and discharging method factor through Coq reflection; produce `docs/research/gonthier-four-color-walkthrough-YYYY-MM-DD.md`. **Primary teaching target** — downstream of Stage 1+ of the Lean-reflection row (B-0050). Effort: L.
- **Stage 5 (speculative) — retraction-native incremental coloring:** under graph-delta streams (edge/vertex +1/-1 Z-set weights), what is the cheapest coloring-preservation algorithm? Candidate paper: Bhattacharya-Chakrabarty-Henzinger-Nanongkai 2018 (dynamic graph coloring). Effort: L.

## Three filters

- **F1 engineering-first** ✓ — factory already ships formal-verification routing (Soraya), planner CSP machinery (Imani), and Lean trajectory (chain-rule proof). Graph coloring is reached-for via these surfaces independently.
- **F2 structural-not-superficial** ✓ — the four-color theorem's Gonthier-formalization structurally matches Zeta's proof-by-reflection ambition at the trusted-kernel + reflective-computation layer, not just nominatively.
- **F3 tradition-name-load-bearing** ✓ — Appel-Haken 1976 is a textbook watershed in proof epistemology; Gonthier 2005 is a landmark in proof assistants; Birkhoff-Lewis reducibility (1946) is the tradition lineage. Multi-decade institutional practice (Kempe 1879 attempted proof, Heawood 1890 gap-find, Appel-Haken 1976 breakthrough, Robertson et al 1996 simplification, Gonthier 2005 formalization).

## Math-safety

Ideas-absorption, not code-import. Gonthier's Coq proof is GPL-licensed; if Stage 4 produces reading-notes referencing the proof structure, notes are the factory's own compression. No proof bytes are copied; the `docs/research/` walk-through file is engineering-shape analysis per the same clean-room discipline as the emulator-absorb note. Retractibility preserved.

## Alternate-reading placeholder

If Aaron meant something narrower (e.g., just the three-color problem, or just the four-color visualization, or graph-coloring as a motif without the theorems), this row demotes to S-effort scouting. The broad reading produces more engineering value and aligns with adjacent committed work.

## Owner / effort

- **Owner:** Soraya (formal-verification-expert) for routing evidence; the Lean-reflection effort owner for Stage 4. Kenji schedules.
- **Effort:** S (Stage 1) + S (Stage 2) + M (Stage 3) + L (Stage 4) + L (Stage 5); total multi-round.

## Does NOT commit to

- Re-proving the four-color theorem (Gonthier's proof stands; walkthrough is reading-discipline, not re-derivation).
- Shipping a graph-coloring module in `src/Core` (unless Stage 5 retraction-native streaming result motivates one — speculative).
- Treating graph coloring as foundational to Zeta's algebra (it's case-study surface for routing-calibration, not substrate).

## Cross-reference

- AceHack commit: `2eef721`
- Composes with: B-0050 (Lean reflection), B-0051 (isomorphism catalog — chromatic-polynomial has homomorphism-density structure relevant to IF4 filter); chain-rule proof-log; teaching-discipline memory
