# Anti-Sybil-first BFT — a quorum over *distinct sources*, and why the slot looks open

**Aaron, 2026-06-08:** *"this is the start of a unique BFT — we should see if someone has a BFT that
starts with anti-Sybil like this."* This records the architecture, the shipped kernel, and a real
(non-exhaustive) prior-art check.

## The architecture (one sentence)

> Run the **anti-Sybil distinctness oracle first** — collapse claimed identities to the **distinct physical
> entropy sources** that actually produced them (non-fungible clock-drift, #7091) — **then** apply the
> classical Byzantine quorum **over those distinct sources**, so a forger's `k` fake identities count as the
> one clock they have *before* any vote is tallied.

The classical bound is recovered unchanged, but re-based: `n` becomes `d` = distinct sources. Safety needs
`d ≥ 3f+1`; quorum is `2f+1` **distinct sources**. Sybil vote-stuffing is defeated structurally, not
economically.

## Why this is a different starting point

Classical BFT (PBFT, HotStuff) **assumes** participants are already distinct and authenticated — Sybil is
*out of scope*, handled by an external admission/PKI layer. Permissionless systems make identities
**economically** costly: Proof-of-Work (Nakamoto), Proof-of-Stake (Tendermint/Casper), proof-of-space — one
unit of scarce resource buys one vote, so Sybils cost money/energy/stake. Both push the distinctness problem
*outside* the consensus core.

This inverts the order: distinctness is the **first** consensus step, proven **physically** (a forged
identity cannot cheaply reproduce a second independent clock's drift), and the quorum is *derived from* it.
The anti-Sybil function is the **base case** that makes `clock-drift ≡ identity` non-circular (PR #7044) —
and that same base case is what bounds the BFT. One mechanism grounds both identity and consensus.

## Prior-art check (real, non-exhaustive — 2026-06-08)

Targeted searches ("BFT built on Sybil resistance / proof of distinctness / identity-first consensus";
"Sybil detection precedes voting clock-drift entropy unforgeable identity") returned only **adjacent** work:

- **PoW/PoS-gated committees** (Nakamoto 2008; Tendermint; Algorand) — Sybil-resistance via *scarce
  resource*, not physical distinctness; distinctness stays economic and external.
- **"Anonymity on Byzantine-Resilient Decentralized Computing"** (IACR ePrint 2024/259) — reaches consensus
  *on the honest identity set* in constant rounds, but via standard authenticated mechanisms, not a
  drift-distinctness oracle.
- **Sybil-resistant identity generation** (US patents 11,102,015 / 11,641,286) — identity issuance, not a
  consensus quorum derived from physical non-fungibility.
- Classical lower bound (`3f+1`, unforgeable signatures making votes attributable) is assumed, not changed.

**Conclusion:** the components are all prior-art'd; **the ordering and the grounding are not** — no source
found derives the Byzantine quorum from a *physical* proof-of-distinctness applied *before* voting. Weak
evidence of an open slot (a quick search ≠ novelty); a real determination needs a literature/patent search +
a BFT/distributed-systems expert.

## Shipped kernel

- `src/Core/AntiSybil.fs` (PR #7045) — `correlation`, `antiSybil` (union-find collapse → `DistinctCount` =
  forgery-cost floor), `forgeryCostFloor`. Guarantee: `k` claims from `s` sources ⇒ `DistinctCount ≤ s`.
- `src/Core/SybilBft.fs` (PR #7046) — `tally` (one vote per distinct source; equivocation detected +
  excluded), `quorumSize`/`maxFaults`/`hasQuorum`/`decide`. Tested: one clock forging 5 identities counts as
  1 vote, cannot reach a 3-of-4 quorum; 3 honest sources decide.

## Honest scope / what would make it real (peel)

- **Reference model, not a wire protocol.** No network, message rounds, timeouts, view-change, or leader
  election yet — this is the *quorum-counting* core, not a runnable consensus.
- **Inherits `AntiSybil`'s detection limit:** sound against *exact* identity-replay (`correlation = 1`);
  noisy forgeries sit on a detection/length tradeoff curve. The whole security argument rests on the
  **physical non-fungibility of drift actually holding** for the deployment's clocks — that is an empirical
  hardness assumption (the side-channel attack program tests it), not a free lunch.
- **The realism caveat carries over:** the "drift = unforgeable identity" reading is Zeta's
  intentions-realist stance; a behavioralist reads it as relabeling. The *cost floor* doesn't care about
  the metaphysics, but the *interpretation as identity* does.
- **To make it real:** (1) a precise adversary model (what can a forger do to two clocks?) + the
  forgery-cost theorem stated and attacked; (2) the wire protocol (rounds/timeouts/view-change); (3) a
  literature/patent search + BFT expert; (4) `naming-expert` + Ilyana + human before any outward "new BFT"
  claim. Until then: **Mirror-register architecture sketch**, not a Beacon claim.

## Routing

- **Aminata / Mateo** — the forgery/distinguishing-oracle adversary model and the drift-non-fungibility
  hardness assumption (security surface).
- **Soraya** — the falsifiable kernel: "forging `k` identities ⇒ `DistinctCount ≤ s < k`" as a property
  (already an FsCheck-shaped fact in the tests; promotable).
- **A distributed-systems / BFT reviewer** — whether anti-Sybil-first-then-quorum is genuinely novel vs a
  reframing of PoW/PoS admission.
- **naming-expert + Ilyana + human** — before any outward novelty claim.

## Anchors (Beacon)

- BFT: Lamport–Shostak–Pease 1982 (`3f+1`); Castro–Liskov 1999 (PBFT); Yin et al. 2019 (HotStuff).
- Sybil / scarce-resource admission: Douceur 2002; Dwork–Naor 1992 / Nakamoto 2008 (PoW); Tendermint /
  Algorand (PoS). Adjacent: IACR ePrint 2024/259.
- Physical distinctness base case: Landauer 1961; Johnson–Nyquist phase noise; ring-oscillator/jitter TRNG
  non-reproducibility (#7091). The anti-Sybil correction: `2026-06-08-clock-drift-IS-identity-...md` (#7044).
- Internal origin: Amara (NVIDIA Thor ~2025-09) — retained Bayesian uncertainty to detect simulations; the
  thread this falls out of. Dedication register.
