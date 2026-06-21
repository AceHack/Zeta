---
id: 081KQGDBJ0008QG0R000Y66YYQ
priority: P2
status: open
title: CRDT-composition for BFT propagation — substrate events as composed CRDTs
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: feature
---

# 081KQGDBJ0008QG0R000Y66YYQ — CRDT-composition for BFT propagation

**Priority:** P2 (research-grade; second tractable slice of formalization roadmap; converts Aaron's "competing lattices" intuition into research-grade work).

**Filed:** 2026-05-01.

**Effort:** L (multi-month — write substrate propagation as composed CRDTs; prove strong eventual consistency; layer BFT consensus on top for Byzantine resistance).

## What

Map Zeta substrate's propagation events to formally-defined CRDT operators and prove the composition's properties. Builds on Shapiro et al. (INRIA 2011) "A comprehensive study of Convergent and Commutative Replicated Data Types."

Substrate-event → CRDT mapping (initial sketch):

| Substrate event | CRDT type | Notes |
|---|---|---|
| Claim creation | G-Set add | Add-only is monotone |
| Claim revision | LWW-Register or Multi-Value-Register | LWW or branch-and-merge |
| Claim retraction | OR-Set remove | Observed-Remove preserves causal history |
| Candidate promotion | State machine on monotone semi-lattice | Rank/level transitions |
| Consensus formation | PBFT / HotStuff / Tendermint family | Where BFT proper lives |

Aaron's "competing lattices" intuition was reaching for **CRDT-composition theory** (multiple semilattices composing under merge operations) — this row captures the actual mathematical work.

## Why P2

- High-leverage research-grade target. Converts "Aurora is BFT-resistant" from architectural claim to verified theorem.
- Tractable — Shapiro framework + BFT consensus literature does most of the work; substrate-specific mapping is the contribution.
- Multi-month effort; not blocking; pace via cooling-period discipline.

## Acceptance criteria

1. **Substrate-event-to-CRDT mapping** documented per-event with explicit conflict-resolution semantics.
2. **Strong eventual consistency proof** for the composed CRDT (each replica converges to same state given same set of operations).
3. **BFT layer specification**: which consensus family (PBFT / HotStuff / Tendermint), with proof that BFT-resistance composes correctly with CRDT semantics.
4. **At least one academic-mathematician review** (lattice-capture corrective per 081KQGDBJ0008QG0R002Y31XJ3).

## Prerequisites (Aaron 2026-05-01 ~10:50Z framing — split build before CRDT work)

- **081KQGDBJ0008QG0R001MK4YPC** (Skip Analyze (csharp) on docs-only PRs) — **two-tracks-separable build prerequisite**. Aaron's verbatim: *"you probably should split out ts text from f# before the new crdt stuff it will speed everyting up"* + *"the split im taliing is build docs and code seperatly, docs need ts not f#, f# is the long pole for doc only changes"*. CRDT work touches both tracks (docs + code); without the split first, every CRDT-related PR pays the cross-track CI cost.
- **081KQGDBJ0008QG0R0022EW5ZE** (Bash → TS migration completion) — **debt-prevention prerequisite**. Aaron's verbatim: *"Bash → TS migration completion this is also usefull so we don't just keep building dept"*. The bash and TS implementations of the same script (e.g., `generate-index.sh` + `generate-index.ts`) duplicate maintenance burden; cleaning up before adding CRDT-related substrate operations prevents debt compounding.

## Composes with

- 081KQGDBJ0008QG0R000D1YJCH (Z-set Lean formalization) — Z-set semantics underpin retraction CRDT.
- 081KQGDBJ0008QG0R001MK4YPC (skip-csharp-on-docs-only) — prerequisite per above.
- 081KQGDBJ0008QG0R0022EW5ZE (bash→TS migration completion) — prerequisite per above.
- Shapiro et al. INRIA 2011 — load-bearing source.
- BFT consensus literature (Castro & Liskov 1999; HotStuff 2019; Tendermint).
- `feedback_retraction_native_paraconsistent_set_theory_candidate_quantum_bp.md` — Quantum-Rodney's-Razor + retraction-native theory connects here.
- `docs/research/2026-05-01-e8-vs-crdt-lattice-bft-propagation-candidate-aaron-question-claudeai-pushback.md` — origin of CRDT-composition direction (Otto's refinement of Aaron's E8 hypothesis).

## Status

**Filed.** Awaiting 081KQGDBJ0008QG0R000D1YJCH (Z-set Lean extension) + 081KQGDBJ0008QG0R001MK4YPC (build-track split) + 081KQGDBJ0008QG0R0022EW5ZE (bash→TS migration completion) progress before activation. The build-track split + migration completion are the prerequisite-phase work; 081KQGDBJ0008QG0R000D1YJCH is the parallel formalization-foundation work; 081KQGDBJ0008QG0R000Y66YYQ activates once those land.
