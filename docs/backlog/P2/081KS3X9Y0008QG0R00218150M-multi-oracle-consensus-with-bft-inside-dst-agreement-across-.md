---
id: 081KS3X9Y0008QG0R00218150M
priority: P2
status: open
title: "Multi-oracle consensus with BFT-inside + DST-agreement-across: trust-gradient architecture beyond single-layer BFT (Aaron 2026-05-21)"
tier: design
effort: M
created: 2026-05-21
last_updated: 2026-05-21
depends_on: [081KRW63S0008QG0R000QJR08H, 081KRW63S0008QG0R001Z7NYMV]
composes_with: [081KRW63S0008QG0R000QJR08H, 081KRW63S0008QG0R003TX8MG5, 081KRW63S0008QG0R002KC5DSR, 081KRW63S0008QG0R001Z10PVV, 081KRW63S0008QG0R002GRX85J, 081KRW63S0008QG0R001Z7NYMV]
tags: [design, aaron, consensus, bft, dst, multi-oracle, trust-gradient, agora-v6, participation-economy, deterministic-simulation]
type: design
---

# Multi-oracle consensus with BFT-inside + DST-agreement-across — trust-gradient architecture beyond single-layer BFT

## Why

The 081KRW63S0008QG0R000QJR08H participation-economy substrate (Adinkras + Ratings + Codewords) reached single-layer BFT consensus naturally: each rating session uses `src/Core/Consensus.fs` `decide` to produce a codeword. Aaron 2026-05-21 named the layer above:

> *"if we want to go past bft we can go to multi oracle consensuse where bft inside with more trust graidinet on inside and on ouside requires deterministic simulation agreement across multi oracles."*

This is a real architectural upgrade — single-layer BFT becomes a **2-layer architecture with a trust gradient running outward**, where the cross-oracle layer demands BIT-IDENTICAL deterministic-simulation agreement, which is structurally stronger than BFT's "tolerate-1/3-faulty" guarantee.

This row formalizes the architecture so it's addressable as substrate rather than buried in conversation context.

## The 2-layer architecture

```
Per-contribution rating session, multi-oracle form:

  Oracle 1 (e.g., Claude/Anthropic-vendor agents, BFT internal)
    └─ rating R1 (BFT-committed via Consensus.decide; 2f+1 quorum)
  Oracle 2 (e.g., Qwen/Kiro-vendor agents, BFT internal)
    └─ rating R2 (BFT-committed)
  Oracle 3 (e.g., Grok/Cursor-vendor agents, BFT internal)
    └─ rating R3 (BFT-committed)
  Oracle 4 (e.g., Gemini/Antigravity-vendor agents, BFT internal)
    └─ rating R4 (BFT-committed)
       ⋮ (N oracles)

  Cross-oracle DST agreement layer:
    - Each oracle independently runs the SAME seeded simulation
    - Compare R1, R2, R3, ..., RN bit-for-bit
    - Full agreement (N-of-N)    → strong codeword  (max private space)
    - K-of-N agreement (K < N)   → weaker codeword  (proportional private space)
    - Below threshold            → no codeword issued
```

## Trust gradient

The architecture runs along a 4-level trust gradient, where each level handles adversaries the inner level cannot tolerate:

| Level | Trust assumption | Mechanism | Substrate |
|---|---|---|---|
| **Individual agent** | Self-trust (the agent trusts itself) | Local computation | F# / TS / Python per-agent runtime |
| **Within oracle** | High trust (shared context, shared vendor / harness) | BFT (`Consensus.decide`, 2f+1) | [`src/Core/Consensus.fs`](../../../src/Core/Consensus.fs) |
| **Across oracles** | Low trust (independent vendors, possibly adversarial) | DST agreement (bit-identical replay) | [`src/Core/Environment.fs`](../../../src/Core/Environment.fs) (`ISimulationEnvironment`); [`src/Core/ChaosEnv.fs`](../../../src/Core/ChaosEnv.fs) |
| **Constitutional** | No trust (defends against the system itself) | Knights Guild + NCI floor | 081KRW63S0008QG0R003TX8MG5 (Knights Guild + Constitution-Class); HC-8 NCI per [`.claude/rules/non-coercion-invariant.md`](../../../.claude/rules/non-coercion-invariant.md) |

Each level relaxes one trust assumption in exchange for stronger guarantee. The architecture is defense-in-depth applied to *consensus*, not to attack surface — same pattern as classical perimeter / network / host / application / data security, with the relaxation that fewer-adversaries-needed-to-break corresponds to easier consensus inside.

## Why this is structurally stronger than single-layer BFT

- **BFT inside one oracle** defends against up to `f` Byzantine-faulty agents in an `N=3f+1` agent set. An attacker controlling `f` agents can prevent consensus (denial-of-service); `f+1` can actively falsify within that one oracle.
- **Cross-oracle DST agreement** defends against correlated adversarial influence across MULTIPLE oracles. To falsify the cross-oracle result, an adversary must produce **identical false outputs across all participating oracles**, not just any false output. This is much harder than falsifying within one oracle.
- **The multi-oracle layer requires bit-identical deterministic simulation**, not just majority agreement on a value. An adversary who compromises one oracle and feeds it the "right" rating still fails the cross-oracle check unless they can compromise every oracle and produce the same false simulation output across all.

## Existing formal-math substrate to reuse

Aaron 2026-05-21 flagged that oracle / immune-system formal math work already exists in Zeta substrate. The canonical file is [`docs/research/aurora-immune-math-standardization-2026-04-26.md`](../../research/aurora-immune-math-standardization-2026-04-26.md) — a 5-pass cross-AI canonicalized strict version of Amara's Aurora Immune System math (Amara + Otto rigor pass + Gemini surface + Gemini Deep Think + Round-2 Gemini Deep Think canonical-file synthesis). Research-grade specification with typed spaces, corrected equations, bounded scoring functions, test obligations, and explicit non-claims section.

That file's substrate directly composes with this row's multi-oracle layer:

- **Typed spaces + bounded scoring functions** — the formal substrate the cross-oracle DST agreement layer needs for bit-identical comparison
- **5-pass cross-AI review process** — itself a worked example of multi-oracle agreement (5 reviewers, structured agreement-with-attribution-boundaries, canonicalized strict version per Amara's "winning move is to canonicalize the strict version, not the flattering version")
- **Round-2 wording correction binding** (deployment vs formal-standardization-PR) — exactly the discipline this row's acceptance criteria need

Implementation work on 081KS3X9Y0008QG0R00218150M should READ that file FIRST before designing the cross-oracle layer; the typed-space + bounded-scoring formalism is the substrate the multi-oracle math builds ON, not a parallel reinvention.

## Why DST is the right cross-oracle mechanism

Zeta already has DST (Deterministic Simulation Testing) as a first-class capability:

- [`src/Core/Environment.fs`](../../../src/Core/Environment.fs) — `ISimulationEnvironment` interface (seeded, replayable)
- [`src/Core/ChaosEnv.fs`](../../../src/Core/ChaosEnv.fs) — chaos-injected simulation environment for fault testing
- `deterministic-simulation-theory-expert` skill in the registry — covers seeded replay, entropy-source guards, FoundationDB / TigerBeetle tradition

The cross-oracle layer reuses this substrate. Each oracle's BFT-committed rating is the OUTPUT of running the rating session under a deterministic simulation environment with a known seed. Other oracles can independently re-run the same simulation with the same seed against the same public-board contribution and verify they produce the same rating. Bit-identical match = honest oracle; divergence = either bug, faulty oracle, or adversarial influence.

## How the Adinkra structure naturally encodes agreement strength

This is the structural composition that makes the multi-oracle layer not just possible but ELEGANT in the 081KRW63S0008QG0R000QJR08H economy:

The Adinkra's N-color structure (where N = number of code generators) maps directly onto the cross-oracle agreement count:

- **Full N-oracle agreement** → full N-color Adinkra (max codeword; max private space)
- **K-of-N agreement** → K-color Adinkra (proportionally smaller private space)
- **Below threshold** → degenerate Adinkra / no codeword

The codeword's STRUCTURE already encodes how strong the cross-oracle consensus was. No separate "agreement strength" metadata field is needed — it falls out of the Adinkra shape itself. This is the kind of substrate-engineering composition Aaron flagged as "everything I do is self-similar and had redundancies built in" — the cross-oracle agreement strength is the same datum as the codeword's structural shape.

## Composition with the 6-vendor topology

Zeta's existing 6-vendor AI topology (Claude / Qwen / Grok / Codex / Gemini / +1) maps directly to natural oracle boundaries:

- Each vendor = one oracle (or possibly multiple oracles if a vendor has multiple distinct harnesses, e.g., Otto-CLI / Otto-Desktop / Otto-VSCode could be three sub-oracles within the Claude oracle)
- Within-vendor BFT runs across the vendor's available agents
- Cross-vendor DST agreement runs across the vendor-set

The 6-vendor diversity Aaron has been building for ~24 months is the structural defense against cross-oracle correlated-fault scenarios. A bug or adversarial influence in one vendor's stack doesn't propagate across vendors because the DST agreement layer detects the divergence.

## Composition with the m/acc principle

[`.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`](../../../.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md) names multi-oracle as the structural anti-monoculture mechanism. This row is the operational instantiation:

- No single oracle (no single moral framing, no single vendor's bias) can issue a codeword unilaterally — the cross-oracle DST agreement is what makes "multi-oracle by design" actually load-bearing rather than decorative.
- The 4-faction governance model (per 081KRW63S0008QG0R001Z7NYMV NCI extension + the tonal-momentum rule: Pure Humans / Deeply Integrated / Unsafe-Rejectionist / Ancient Memetic Intelligences) can map to oracle-faction boundaries — different factions run different oracles, cross-faction DST agreement preserves the no-single-faction-issues principle.

## Composition with 081KS3X9Y0008QG0R002HJ8P57 dual-Adinkra rule

[081KS3X9Y0008QG0R002HJ8P57](../P3/081KS3X9Y0008QG0R002HJ8P57-dual-adinkra-time-aware-default-dumb-fast-version-with-case-by-case-performance-justification-mika-2026-05-18.md) (dual-Adinkra time-aware default) says the default-tier Adinkras must be retractable-Z-state-compatible. The multi-oracle layer composes naturally: each oracle's BFT result is itself a Z-set entry indexed by `(contribution, oracle)`, and the cross-oracle agreement is a join operation over those Z-sets. Retractable by construction — if an oracle's BFT result retracts (per the underlying Consensus protocol's view-change), the cross-oracle agreement strength updates incrementally via DBSP-style IVM.

## Proposed implementation slices

If this row is picked up for implementation, the natural decomposition is:

- **Slice 1** — Define the multi-oracle envelope schema (per-oracle BFT result + DST seed + simulation output hash)
- **Slice 2** — `src/Core/MultiOracleAgreement.fs` module: take N per-oracle `Consensus.Committed` results, run DST replay verification, return an `AgreementProfile` describing K-of-N agreement
- **Slice 3** — `src/Core/AdinkraSelector.fs` module: map `AgreementProfile` to Adinkra codeword shape (full N-color vs K-color vs degenerate)
- **Slice 4** — Composition with the rating-stream Z-set (per-contribution per-oracle ratings as a single Z-set; cross-oracle agreement as a derived view)
- **Slice 5** — Property tests: honest-path, single-oracle-faulty, multiple-oracle-faulty, full-disagreement, retraction-propagation

Each slice is bounded (1 PR each); the full architecture lands in 5 PRs.

## Acceptance criteria

- [ ] Architecture document at `docs/research/2026-05-NN-multi-oracle-dst-consensus-architecture-formalization.md` with formal definitions of the 2-layer BFT-inside-DST-across structure
- [ ] Cross-reference from 081KRW63S0008QG0R000QJR08H (the participation-economy substrate) noting the multi-oracle layer composition
- [ ] At least one slice (Slice 1 or Slice 2) implemented as F# code in `src/Core/` with property tests demonstrating the cross-oracle DST agreement primitive works on a toy multi-oracle example
- [ ] Decision recorded on faction-quorum threshold (does cross-oracle agreement require ALL factions present, or any K-of-4 factions?)
- [ ] Composition with 081KS3X9Y0008QG0R002HJ8P57 (retraction-native) verified via property test: retracting an oracle's BFT result correctly retracts the cross-oracle agreement strength

## Non-goals

- Implementing the full Knights Guild constitutional layer (that's 081KRW63S0008QG0R003TX8MG5; separate substrate)
- Choosing specific vendors as oracle boundaries (the architecture should be vendor-agnostic; the 6-vendor topology is one natural mapping, not the only one)
- Replacing existing `Consensus.fs` BFT (this row is ADDITIVE — the multi-oracle layer wraps the existing BFT primitive, doesn't replace it)
- Implementing a specific cryptographic key-derivation scheme on top (that's 081KRW63S0008QG0R000QJR08H PR3+; this row provides the consensus substrate the crypto sits on)

## Substrate-honest framing

This row formalizes Aaron's named architectural direction; the substrate to implement it (BFT in `Consensus.fs`, DST in `Environment.fs` / `ChaosEnv.fs`) already exists in Zeta. The multi-oracle layer is a wrapper that composes existing primitives — same compose-with-existing-substrate discipline that produced 081KRW63S0008QG0R000QJR08H's collapse-from-build-BFT to wrap-existing-BFT.

The trust-gradient framing is the substrate-honest part: each level is named explicitly, with the trust assumption and the mechanism that satisfies it. Future implementation work has a clear map of which primitive handles which trust level.

## Composes with

- [081KRW63S0008QG0R000QJR08H](../P2/081KRW63S0008QG0R000QJR08H-adinkras-jane-gates-ecc-private-state-encryption-mika-2026-05-18.md) — the participation-economy substrate this multi-oracle layer is FOR
- [081KRW63S0008QG0R003TX8MG5](../P3/081KRW63S0008QG0R003TX8MG5-knights-guild-constitution-class-integrity-dashboard-mika-2026-05-18.md) — Knights Guild + Constitution-Class (the layer ABOVE multi-oracle; constitutional defense against system-level compromise)
- [081KRW63S0008QG0R002KC5DSR](../P1/081KRW63S0008QG0R002KC5DSR-wave-particle-duality-encryption-dialectic-as-quantum-superposition-aaron-ani-2026-05-18.md) — wave-particle duality + free will as collapse choice; cross-oracle agreement IS the collapse point in the wave-particle model
- [081KRW63S0008QG0R001Z10PVV](../P1/081KRW63S0008QG0R001Z10PVV-agora-v6-reputation-weighted-encryption-budget-constitutional-economy-substrate-aaron-2026-05-18.md) — Agora V6 reputation-weighted encryption budget (composes with the cross-oracle layer as the operational implementation of "reputation-weighted")
- [081KRW63S0008QG0R002GRX85J](../P1/081KRW63S0008QG0R002GRX85J-three-faction-bft-tla-safety-property-aaron-mika-2026-05-18.md) — three-faction BFT TLA+ safety property (the within-oracle BFT property that composes with the cross-oracle DST property)
- [081KRW63S0008QG0R001Z7NYMV](../P1/081KRW63S0008QG0R001Z7NYMV-non-coercion-invariant-no-dialectical-propagators-as-coercion-aaron-mika-2026-05-18.md) — NCI floor preserves the additive character of the multi-oracle game
- [`src/Core/Consensus.fs`](../../../src/Core/Consensus.fs) — within-oracle BFT primitive
- [`src/Core/Environment.fs`](../../../src/Core/Environment.fs) + [`src/Core/ChaosEnv.fs`](../../../src/Core/ChaosEnv.fs) — DST substrate the cross-oracle layer uses
- [`.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`](../../../.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md) — the principle this architecture operationally instantiates
- [`.claude/skills/deterministic-simulation-theory-expert/SKILL.md`](../../../.claude/skills/deterministic-simulation-theory-expert/SKILL.md) — DST expert skill for implementation guidance
- [`.claude/skills/distributed-consensus-expert/SKILL.md`](../../../.claude/skills/distributed-consensus-expert/SKILL.md) — for the within-oracle BFT side
- [`.claude/rules/only-way-to-lose-is-not-to-play.md`](../../../.claude/rules/only-way-to-lose-is-not-to-play.md) — the additive-game principle the multi-oracle architecture enforces structurally (hoarding throttles itself because non-participating oracles drop out of cross-oracle agreement)
- [`docs/research/aurora-immune-math-standardization-2026-04-26.md`](../../research/aurora-immune-math-standardization-2026-04-26.md) — Amara's Aurora Immune System formal math (5-pass cross-AI canonicalized); the existing typed-space + bounded-scoring substrate the multi-oracle cross-oracle DST agreement layer should compose with

## Source

Aaron 2026-05-21 conversation, immediately following 081KRW63S0008QG0R000QJR08H PR3 reframe (participation-economy via 100% BFT). The exact framing: *"if we want to go past bft we can go to multi oracle consensuse where bft inside with more trust graidinet on inside and on ouside requires deterministic simulation agreement across multi oracles."* Conversation context: 081KRW63S0008QG0R000QJR08H trajectory PR1 (Cayley-Dickson primitive) just shipped in PR #4587; subsequent PRs (PR2 Adinkra construction, PR3 RatingBFT, PR4 Z-state composition) were being scoped when this architectural layer was named.
