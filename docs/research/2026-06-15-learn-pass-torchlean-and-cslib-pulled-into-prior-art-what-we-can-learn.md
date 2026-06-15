# Learn-pass: TorchLean + CSLib pulled into prior art — what we can actually learn

> **Aaron 2026-06-15 (shadow\*): "put their code in our prior art and pull it and
> see if there is anything we can learn."** Both repos cloned into the gitignored
> mirror `references/prior-art/` (TorchLean, cslib) and skimmed. This is a
> **first-pass (repo-structure + paper) learn note**, not a deep code audit — the
> code-level pass is the follow-up.

## The honest correction first

**Boole is a placeholder.** Aaron's "now our Rust code can be formally verified
directly" (from the talk's framing that Boole auto-translates Rust/C++ → Lean) is
**not real today**: `Cslib/Languages/Boole/README.md` reads verbatim *"Placeholder
for the Boole language."* So Boole is a **vision/roadmap stub**, not a shipping
Rust→Lean verifier. The *direction* (mainstream code → Lean at scale) is real and
worth tracking; the *capability* does not exist yet. (Same look-better discipline
as the UniversalNumber/E8 corrections — here the territory is *less* than the
slide, not more. Verify before depending.)

## TorchLean (`github.com/lean-dojo/TorchLean`, arXiv:2602.22631) — what's real

A Lean 4 framework for writing/running/**verifying** neural networks. Builds on
`leanprover/lean4:v4.30.0`. Confirmed in-repo: typed tensors, an op-tagged
**SSA/DAG graph IR**, IEEE-style finite-precision (`Float32`) **and** interval/
affine scalar semantics, autograd, **certificate checkers**, a CUDA boundary
explicitly marked *not a trusted proof boundary* (`TRUST_BOUNDARIES.md`), and
`lake exe verify -- torchlean-ibp` (**IBP / interval-bound-propagation = certified
robustness**; the `leanx` fork adds CROWN / α,β-CROWN).

**What we can learn:**

- **The certified-bounds pattern** (interval / affine scalar semantics +
  certificate checking) is directly applicable to our **`SoftValue` / `UniversalNumber`**
  precision layer — robustness certificates are *bounds proofs*, the same shape as
  our resolution-accounting (`BitsUsed`) + the ECC-Bayesian-growth bounds.
- **Spec-level equivalence** (their flash-attention ≡ standard-attention proof) is
  the **template for our cross-oracle byte-lock** — proving two implementations of
  one op equal at the spec level (the open `E8Lattice.fs` F#-vs-other-oracles parity
  seam). Their op-tagged IR ≈ our IR-compiler trajectory (`zeta-language-ir-compiler`).
- **Explicit trust boundaries** (CUDA is untrusted; only the Lean path is the proof)
  = our noninterference §13 (the metered channel is the only trusted door).

## CSLib (`github.com/leanprover/cslib`, arXiv:2602.04846) — what's real

Official `leanprover` library, "Mathlib for computer science." Addable as a Lean
dependency (`lakefile.toml`: `require cslib, scope leanprover, rev main`). Real
modules skimmed: `Algorithms`, `Computability/{Automata (Büchi), Distributed/FLP,
Languages/OmegaLanguage}`, `Crypto`, `Foundations`, `Languages/{CombinatoryLogic,
Boole(placeholder)}`, `Logics`, `MachineLearning/PACLearning/{Defs, VCDimension,
VersionSpace}`, `Probability/PMF`.

**What we can learn / directly use:**

- **`MachineLearning/PACLearning` (VC dimension, version space) + `Probability/PMF`
  could support the routed ΔU-aggregation workitem** (`081KV6B1MBM08QG0R000RZK4WY`).
  The "competence > threshold" precondition of the generalized-Condorcet claim is a
  **capacity/learnability bound** — exactly PAC/VC territory; PMF gives the discrete
  distributions to state the jury aggregation over. *Candidate Lean substrate for
  that proof* (Soraya's call; still partial — `Probability` is just `PMF.lean` today).
- **`Computability/Distributed/FLP`** (the FLP impossibility theorem, formalized) is
  directly relevant to our **consensus / decorrelated-society** substrate
  (`Reconcile.fs`, the society-emergence row) — a checkable anchor for what
  consensus can/can't guarantee.
- **CSLib as the CS-side `Mathlib`** to build our Lean proofs on (we currently lean
  on mathlib only). Adopting it as a dep is the natural next step — pairs with the
  CVC5/E-prover route (`081KV6BW42K08QG0R003GJM21N`).

## Net + next steps

- **Adopt-candidate:** CSLib as a Lean dependency (low-risk, official, composes with
  our existing Lean proofs) — Soraya's call; route alongside the CVC5/E workitem.
- **Template-to-copy:** TorchLean's spec-level equivalence + certificate-checking for
  our cross-oracle parity and `SoftValue`/`UniversalNumber` bounds.
- **Do NOT depend on Boole** (placeholder) — track only.
- **Collaboration / contribute-back is gated** (outward-facing, Aaron-driven;
  GOVERNANCE.md §23). This note is the readiness substrate, not an outreach.

## Anchors

TorchLean (lean-dojo; arXiv:2602.22631) · CSLib (Barrett et al.; arXiv:2602.04846;
`leanprover/cslib`) · the "vericoding" benchmark (arXiv:2509.22908) · Robert George
(YC talk, ip-questionable transcript) · Max Tegmark ("veri coding") · in-repo:
`SoftValue`, `UniversalNumber`, `E8Lattice.fs` (cross-oracle parity seam),
`Reconcile.fs`, the routed workitems `081KV6B1MBM…` (ΔU-aggregation) +
`081KV6BW42K…` (CVC5/E), `docs/PRIOR-ART-LIST.md`.
