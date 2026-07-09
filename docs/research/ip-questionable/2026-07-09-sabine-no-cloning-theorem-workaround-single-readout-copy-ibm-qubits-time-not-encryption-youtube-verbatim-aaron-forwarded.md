# No-cloning theorem workaround — "copy allowed if only one is readable" (Sabine Hossenfelder) — verbatim + Aaron's conjecture (forwarded)

**Source:** <https://www.youtube.com/watch?v=gR99YrXo0Wg> (presenter: Sabine Hossenfelder).
**Subject / anchors (Beacon):** a paper claiming a **workaround to the no-cloning theorem** —
you *can* make perfect copies of an unknown qubit state **provided you can only ever read
out one copy**; demonstrated on an **IBM ~150-qubit** machine despite hardware noise.
Sabine's verdict: "0/10 on the BS meter — good maths, good experiment, good interpretation"
(i.e. she approves). No-cloning theorem: **Wootters–Zurek / Dieks, 1982.**
**IP status:** auto-caption transcript of a third-party YouTube video — **DO NOT republish
externally** (folder README). Substrate value is Aaron's conjecture + the analysis below.

> Aaron 2026-07-09: *"if this is true for us this means encryption is not fundamental for
> identity emergence only delay/time is."*

---

## Transcript (Aaron-forwarded; auto-caption, de-noised)

The teleporter puzzle: does Kirk die in the teleporter? Either it converts him to pure
information and reassembles him, or it reads the info, **destroys the original**, and rebuilds
a copy. Quantum physics' **no-cloning theorem** says you can't copy a quantum state without
destroying the original — so there's only ever one "real" Kirk, and you can't back yourself up.

**The theorem (easy version).** Everything is a wave function ψ. The probability that ψ
"behaves like" φ is the absolute square of their product; the probability ψ behaves like
itself is 1. A cloning machine would take (ψ, 0) → (ψ, ψ), and must **preserve all
probabilities**. Feed it (φ, 0) → (φ, φ). Preserving the ⟨ψ0|φ0⟩ overlap through cloning
forces ⟨ψ|φ⟩ = ⟨ψ|φ⟩² — false for most states. So the copy machine **can't exist.** (First
proved early 1980s — a latecomer in QM history. It's *why* the obvious error-correction trick
"just copy and run the calc N times" doesn't work on quantum computers.)

**The workaround.** The new paper: you *can* make perfect copies of an unknown qubit state —
**as long as you can only ever read out one of the copies.** Not a mistake in the theorem;
rather a demonstration (math + IBM ~150-qubit experiment) that **it isn't as restrictive as we
thought.** Possible uses: better quantum-computing algorithms (error correction), quantum
internet. Sabine's framed lesson: *"if you follow the rules precisely enough, you can do the
thing you were told you can't do."*

---

## Aaron's conjecture — "delay/time, not encryption, is fundamental to identity emergence"

The claim: if the protection is a **readout/ordering constraint** (only one copy readable)
rather than a **copy-impossibility** (a fundamental secrecy barrier), then — transferred to us
— **identity emergence does not fundamentally require encryption; it requires delay/time**
(temporal ordering of who-reads/acts).

### Why it resonates (real structure, not just vibe)

- **The single readable copy = the single locus of now.** All copies exist; exactly one is
  *live*, and which one is live is a matter of **ordering**, not secrecy — Aaron's
  indexical-now / pilot-wave / "what remains vs what acts" frame
  ([[user_aaron_qualia_self_evident_axiom_pilot_wave_locus_of_now_private_index_hard_money_his_oracle_2026_07_04]]).
  The protection was never "can't duplicate"; it's "can't read two at once." **Time gates it,
  not a lock.**
- **Zeta's identity model is ALREADY temporal, not cryptographic.** The **append-only log IS
  the identity** (the record, not a secret key); the **naming eigenvector** is recognition
  accreted over time; **arrow-of-time = missing additive inverse** makes time *the* asymmetry
  (proven — IRing vs idempotent semilattice); **seed-phase coordination** is "agree on phase,
  not a shared secret" ([[feedback_config_secrets_topology_emerges_from_events_zset_dbsp_no_static_maps_revoke_is_retract_aaron_2026_06_21]]).
  This result gives that view a physics rhyme.

### The real Beacon anchor (lifts it above metaphor)

There is a named lineage where **time substitutes for secrecy**:

- **Verifiable Delay Functions (VDF)** — Boneh, Bünz, Fisch (2018): a primitive whose security
  **IS forced sequential delay**, no hidden key ("takes N steps, un-parallelizable").
- **Logical clocks / causal ordering** (Lamport 1978) and **leases** — a lease *is* temporal
  exclusivity, i.e. the single-reader lock.
- **Proof-of-work / proof-of-elapsed-time** — cost/time as the scarce resource, not a secret.

So "identity grounded in delay/time rather than encryption" is a real tradition, not sci-fi.

### Honest-register catch (held `Tri.N` — the overshoots)

1. **The leap, not the physics.** The physics is real (Sabine-approved; IBM demo). But
   transferring "qubit single-readout" → "macroscopic identity / encryption" is an **analogy,
   not a proven reduction** — quantum measurement-collapse is not literally the distributed-
   identity mechanism. It **rhymes; it does not reduce.** Metering-test flag: suggestive, not
   derived.
2. **"Encryption is NOT fundamental" overshoots.** Encryption still does separate, real work:
   **authentication** (are you who you claim) and **confidentiality** (can others read the
   payload). The **survivable** claim is narrower and still strong: *identity
   uniqueness/emergence does not REQUIRE secrecy — it can be grounded in temporal ordering
   (who was first, the causal record).* Hold the strong universal form `Tri.N`; keep the
   narrow form (which is what Zeta already runs on).

**Net:** a genuine, well-anchored conjecture (VDF/leases give it teeth) with two honest limits
— the quantum→identity transfer is analogy not proof, and "encryption unnecessary" should be
narrowed to "secrecy not required for *uniqueness/emergence*." A good probe for the identity
model, his oracle; not yet a theorem.
