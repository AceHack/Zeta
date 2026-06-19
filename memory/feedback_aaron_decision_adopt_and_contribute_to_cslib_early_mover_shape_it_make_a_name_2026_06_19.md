---
name: aaron-decision-adopt-and-contribute-to-cslib-early-mover-shape-it-make-a-name
description: "Aaron 2026-06-19 (shadow*): DECISION — Zeta will both USE and CONTRIBUTE BACK to CSLib (leanprover/cslib, the Lean 'Mathlib for CS', Barrett et al. arXiv:2602.04846). Rationale: many labs are getting behind it, it's very early, so we can help SHAPE it and make a name for ourselves (early-mover positioning). This flips the prior 'contribute-back is gated/Aaron-driven' seam to a standing GO. Adoption = add as a Lean dep (lakefile.toml: require cslib, scope leanprover); first natural contribution = the Byzantine-fault extension to CSLib's crash-fault FLP/Consensus module (= the G1 slice of the Aurora (b) BFT-Sybil lift — contributing it back IS doing our own work upstream). Do NOT depend on the Boole placeholder. Each concrete external PR still gets a look before it goes out, but the direction is decided."
type: feedback
metadata:
  type: project
created: 2026-06-19
---

Aaron 2026-06-19 (shadow\*), deciding the CSLib question I'd left to Soraya's routing + his sign-off:

> *"i want to use and contribute back to CSLib — many labs seem to be getting behind this and we can help shape it, it's very early and we can make a name for ourselves."*

**The decision.** Zeta will both **use** CSLib (`leanprover/cslib`, the official Lean "Mathlib for
computer science", Barrett et al., arXiv:2602.04846, surfaced via Robert George's "Lean for Science"
YC talk) **and contribute back** to it. This resolves the open question in
[[aurora-b-bft-sybil-cslib-flp-scoping]] (§5 routing / §7 seam) and the collaboration-readiness doc —
the prior posture was "contribute-back is gated + Aaron-driven"; Aaron has now driven it: a **standing GO**.

**Why (the strategic kernel):** the library is **very early** and **many labs are getting behind it**,
so the window to **shape it + make a name** is open now. Early-mover positioning in the verified-CS
ecosystem — being a *shaper* of the substrate, not just a consumer. This is the "coworker not control"
collaboration thesis made concrete on a real, external, open-governance target.

**How to apply:**
- **Adopt as a Lean dependency** (`lakefile.toml`: `require cslib, scope leanprover, rev main`) — a
  bounded engineering task; build it green; do **NOT** depend on the `Boole` placeholder (the
  Rust/C++→Lean auto-verification is a vision, not shipping — track only).
- **First contribution candidate = the Byzantine-fault extension to CSLib's FLP/Consensus** (today
  crash-fault only: `ProcFaulty` = stop). That's exactly the **G1** slice of the Aurora (b) BFT-Sybil
  lift — so the first upstream PR *is* our own work, done in their repo (aligned incentives, the
  small-first contribute-back of B-0952).
- **Sequencing honesty:** the full (b) guarantee still inherits G3 (anti-Sybil entropy, §B, open) —
  but G1 (Byzantine fault model) is a clean, self-contained, citable contribution that does NOT need G3.
- **Each concrete external PR still gets a look before it goes out** (large external-repo change =
  a gated class; the *direction* is decided, the *mechanics* stay reviewed) — but no longer per-decision
  gated on whether to contribute at all.

Anchors: CSLib (Barrett et al. 2026); FLP (Fischer–Lynch–Paterson 1985); the collaboration-readiness
doc (CSLib = "most natural first" target); B-0952 (small-first contribute-back); GOVERNANCE §23
(upstream-contribution workflow). See [[aurora-b-bft-sybil-cslib-flp-scoping]].
