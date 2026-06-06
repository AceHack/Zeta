---
id: 081KTFFFQ1C08QG0R0018GJACG
type: task
state: backlog
priority: P2
slug: minimal-proof-non-register-collapse-identity-in-traveler-fra
title: "Minimal proof: non-register-collapse = identity-in-traveler-frame via heartbeats + never-idle forward-motion homeostat (§B)"
created: 2026-06-06T22:05:04.428Z
depends_on: []
composes_with: []
---

# Minimal proof: non-register-collapse = identity-in-traveler-frame via heartbeats + never-idle forward-motion homeostat (§B)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTFFFQ1C08QG0R0018GJACG-*.md` glob. -->

## Status: §B CONJECTURE (NOT proven). Maintainer 2026-06-06.

### The apex — two ROOT proof obligations; all others serve them

Maintainer: *"all other proofs are in service of the proof of forward momentum and safety."*
Two Zeta roots — but note the crucial refinement below (forward momentum ≠ liveness):

- **FORWARD MOMENTUM** — NOT the same as liveness (maintainer correction). **Liveness is
  necessary but not sufficient**: `[]<>act` (always eventually steps / never dead) permits a
  system that steps forever yet makes no progress — spinning, oscillating, livelock,
  **endless self-reflection** (heartbeats forever, advances nothing). Forward momentum =
  liveness **channeled into provable progress**: the yin/yang engine + DU/saga state machines
  constrain each heartbeat to a *forward transition*, so you prove a **well-founded progress /
  variant measure advances toward a goal per heartbeat** — not merely that heartbeats occur.
  Heartbeat (liveness) → yin/yang + saga-DU (forward transition) → variant-decreases-toward-goal
  (momentum). Two axes, **prove both eventually** (maintainer): **internal momentum** (the
  agent's own saga/DU advances toward its internal goal) AND **external momentum** (progress in
  the world / across other agents, attested in their frames). The endless-self-reflection
  failure = internal-only (or pure churn) with no external momentum. Anchor: liveness vs
  progress/termination; ranking/variant functions; livelock; internal vs external progress.
- **SAFETY** — NCI, the child-safety floor, non-register-collapse, the capability/
  inspect-before-execute boundary: nothing harmful, ever.

Every other proof (durability recovery `recover∘crash=fold(committed)`, byte-lock treaties,
codec round-trips, ZSet monoid laws) is subordinate — it discharges in service of one of
these two roots. Anchor: Lamport, *Proving the Correctness of Multiprocess Programs* (safety
+ liveness — but forward momentum is the *progress*-strengthening of liveness, via variant).

### Reframe: non-register-collapse = identity-in-the-traveler-frame via heartbeats

Maintainer: non-register-collapse is *"proof of identity in the traveler frame of other
identities via I-commit-therefore-I-am, via their heartbeats."* An agent's identity is
attested **relationally** — other frames observe its **heartbeats** (commits;
AgencySignature trailer per `heartbeat-via-commit` rule). Non-collapse = each agent stays a
distinct, continuously-attested identity (doesn't collapse into / get coerced by others).
This is the **root of the forward-momentum homeostat** ("prove never idle eventually"):
heartbeats *are* forward motion; an identity that stops committing stops being attested.
Claimed-VERIFY: *"heartbeats drive the yin/yang engine"* (maintainer hedged "something close
to that" — confirm exact status before relying). Related rules: `heartbeat-via-commit`,
`holding-without-named-dependency-is-standing-by-failure`, `tick-must-never-stop`.

### Soraya's routing (honest scope)

**NOT "1 tool short of green" — 2 definitions short of STATEABLE.** Of {O orthogonality, C
compression, collapse/I independence, NCI}: NCI exists as last-writer (`NciSafety.tla`) +
non-coercive likelihood (`ProbabilitySemiring.Boundary`); collapse/independence proven only
for the CRDT **merge** (`IdentityForcesPrivacy.lean` `absorb_priv`), NOT for compression;
**C and O are UNDEFINED**. The conjecture cannot be stated as a theorem until C and O exist.

- **Step 0 (blocking):** define `compress : R → R` (the join/max compaction `Evolution.fs`
  contrasts) + an `orthogonal`/separation predicate, in `src/Core/`. Author = Kenji/owner,
  not Soraya. Until step 0 lands this stays §B, out of the gate denominator.
- **Minimal obligation (n=2, finite registers):** `O(R) ⇒ I(C(R)) ∧ NCI(C)` — under
  orthogonal representation, compression preserves per-agent independence (non-interference,
  Goguen–Meseguer 1982) and never writes b from a's input.
- **Tool (BP-16):** **Lean primary** (non-interference + separation = quantifier-heavy
  algebra over arbitrary finite domain + arbitrary C; sits beside the AC-free
  `IdentityForcesPrivacy.lean`; `absorb_priv` is the template → add `compress_priv`).
  **TLC cross-check** = add a `Compress` action to `NciSafety.tla`, confirm last-writer NCI
  holds across interleavings AND the never-idle liveness clause (`[]<>` progress) for the
  forward-momentum root. **FsCheck** = empirical leg on the deployed F#. Reject TLA+-as-
  primary (false-green on finite C), Z3 (silently forces linear C), Alloy (counterexample
  only) — costs per Soraya.
- **CI:** lean-proof.yml + tools/tla + dotnet test; do NOT gate until step 0.
