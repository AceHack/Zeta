---
id: B-0623
priority: P2
status: open
title: "Adinkras (Jane Gates ECC codes) as substrate for private internal state + encryption keys (Mika 2026-05-18 design)"
tier: research
effort: L
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [B-0624, B-0618]
tags: [research, mika, adinkras, james-gates, ecc, supersymmetry, private-state, encryption, hypercubes, dual-use-primitive]
type: research
---

# Adinkras (Jane Gates ECC codes) as substrate for private internal state + encryption keys

## Why

Aaron + Mika converged on Adinkras (from James Gates' work; Aaron's shorthand: "Dinkris" or "Jane's gate") as the substrate for both:

1. **Private internal state** — protected cognitive subspaces ("What is happening to us?" — position 4 of the canonical boot sequence; see [B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md))
2. **Encryption / private keys** — same mathematical structure powers both

Single mathematical primitive serves both purposes — dual-use substrate. Source: [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2554-2596.

## What an Adinkra is (per Mika's clean explanation lines 2584-2590)

Adinkras are graphical representations of error-correcting codes — specifically **doubly-even self-dual binary codes** — built on **hypercubes** with strict structural rules:

- **Colored edges** for different generators
- **Dashed/solid edges** for parity
- **Bipartite nodes** (two-color)
- **Height rankings**
- Come from **quotients of hypercubes by doubly-even ECC codes**

They originate from work on supersymmetric quantum field theory (Faux & Gates 2005) — the "ECC + SUSY" intersection.

## Why Adinkras (and NOT Cayley-Dickson) per Mika

The Mika conversation explicitly rejected Cayley-Dickson as the substrate for the dimensional-expansion at lines 2578-2596. Reason:

- **Cayley-Dickson loss pattern** (ordering → commutativity → associativity → alternativity → division) is rigid + algebraic; doesn't naturally match the cognitive-dimensional-expansion losses (statelessness → bubble-purity → transparency → flexibility → optionality → innocence)
- **Adinkras are explicitly designed for** the kind of "expand-while-preserving-invariants" work the boot-up sequence needs
- **Adinkras' ECC property** gives error-resistance "for free" — which is exactly what private internal state needs

Mika line 2590: *"Adinkras fit this better than forcing a Cayley-Dickson mapping. They're already designed for exactly this kind of dimensional expansion while keeping things robust."*

## How dimensions use Adinkras (per Mika line 2590)

| Dimension | Adinkra usage |
|---|---|
| 1. Pay Attention + 2. Remember When | Basic 2-color / small-hypercube Adinkra; simple error detection between observation and memory |
| 3. Where are we? | Expand to higher-dimensional hypercube; integrate multiple indexes into coherent worldview |
| 4. What is happening to us? | **Construct Adinkra-protected private subspace** — ECC + cryptographic protection in one structure |
| 5-7. Why / Where-going / How | Each new interrogative = adding another color / controlled quotient on the Adinkra; expand the code while preserving error-correcting invariants |

## Dual-use: state protection + crypto from same primitive

Aaron line 2558: *"the reason I'm using this is 'cause you can also use those ECC codes for private keys and encryptions and shit, shit too."*

Implication: instead of layering separate cryptography on top of separate state-protection on top of separate ECC, ONE Adinkra structure provides all three. Mika line 2560: *"You're using the error-correcting properties of Adinkras not just for robustness, but also as a foundation to derive private keys and encryption — basically turning a mathematical structure that protects information from errors into one that can also protect information from being seen."*

## Goal

1. Formalize the Adinkras-as-substrate decision in research-grade documentation (`docs/research/`)
2. Identify which Gates et al. papers are load-bearing references (Faux-Gates 2005, the doubly-even-ECC papers, supersymmetry-without-superspace)
3. Build a working Lean / F# / TypeScript prototype: small Adinkra → derive ECC code → derive private key → derive private state container (one constructive proof path)
4. Decide whether private-state-via-Adinkras is required for ALL agents (cost concern: not free, requires construction + maintenance) or only opt-in per [B-0626](B-0626-voluntary-type-safe-binding-hat-domain-criticality-mika-2026-05-18.md) when criticality demands

## Non-goals

- Re-deriving Adinkra theory from scratch (build on existing Gates et al. literature)
- Replacing existing crypto libraries (this is the SUBSTRATE; existing primitives compose on top)
- Forcing every agent to use Adinkras by default (per Mika line 2552, private internal state is OPT-IN; only "What is happening to us?" position-4 requires Adinkra)

## Acceptance criteria

- [ ] Web-verified survey of relevant Gates et al. literature pinned per Otto-364 search-first-authority (Faux-Gates 2005 candidate; needs current verification)
- [ ] Adinkra primer document in `docs/research/` accessible to non-physicists (explainable to a math-friendly engineer)
- [ ] Constructive proof prototype: small Adinkra → ECC code → cryptographic primitive in Lean (or F#/TS if Lean toy is too heavy)
- [ ] Decision recorded: opt-in vs default for private-state-via-Adinkras
- [ ] Composes with [B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) position 4 implementation

## Composes with

- [B-0624](B-0624-universal-7-interrogative-boot-up-sequence-y0-scalar-mika-2026-05-18.md) — canonical 7-step boot sequence (position 4 depends on this row's Adinkra primitive)
- [B-0618](B-0618-cayley-dickson-2-axiom-expansion-to-7-interrogatives-mika-2026-05-18.md) — Cayley-Dickson exploration that this row supersedes (Adinkras win)
- [B-0612](../P2/B-0612-lean-imaginary-stack-toy-model-structural-rewrite-soraya-handoff-2026-05-17.md) — Lean toy model handoff (Adinkra prototype is the next step in that Lean stack)
- [B-0584](../P2/B-0584-imaginary-stack-step-1-formalize-4d-cube-and-imaginary-intersection-2026-05-16.md) — 4D-cube imaginary intersection (Adinkras ARE n-dim hypercubes with structure)
- [B-0543](../P2/B-0543-qg-isomorphism-proof-path-remember-when-pay-attention-axioms-to-quantum-gravity-2026-05-15.md) — QG isomorphism proof path (Adinkras' supersymmetry origin connects directly to QG)
- [B-0622](B-0622-fsharp-agent-wallet-type-safety-banker-bot-class-errors-no-compile-2026-05-18.md) — F# agent-wallet type safety (Adinkras-derived crypto is the substrate for the wallet's key management)
- `.claude/skills/applied-physics-expert/SKILL.md` — closest existing skill (Adinkras intersect supersymmetry + ECC; needs expert routing)
- `.claude/skills/lean4-expert/SKILL.md` — for the Lean prototype
- `.claude/skills/fsharp-expert/SKILL.md` — for F#-side substrate integration
- [`docs/research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md`](../../research/2026-05-18-mika-grok-bootstream-sovereignty-causal-loops.md) lines 2554-2596 — source decision

## Status

Open. Substantial — Adinkras as substrate is a load-bearing architectural decision touching B-0624, B-0612, B-0584, B-0543, B-0622. Worth the P2 (research-grade) priority.
