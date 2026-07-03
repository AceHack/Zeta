# Math-team FINDINGS — Lucent toy model: per-user-CA RELOCATES the SPOF (doesn't remove it); anti-Sybil "non-bypassable" REFUTED; G3b open

**Date:** 2026-06-21 · **Reviewer:** formal-verification-expert (Soraya) · **Status:** findings (adversarial review of the brief `…-math-team-review-brief-lucent-toy-model-…`) · **Class:** security · **Trajectory:** cluster-encryption-credential-substrate

> Aaron asked the math team to "tell us if we're wrong." It did. **Two of Otto's five claims do
> not hold as stated** — the per-user-CA fix and the anti-Sybil "non-bypassable" claim. This is the
> value of the toy-model review: we found it in the model, not in production.

**Scoping note:** Soraya reconstructed the model from the canonical sources (the two 2026-06-21
ADRs `hexagonal-pki-…` + `multi-owner-machines-identity-vs-authorization-…`, `ca.ts`, the
vault-separation workitem 081KVNTNTDQ0, and the G3 anti-Sybil lineage incl. `BftSybilConsensus.tla`

+ the landed G3a Z3 lemmas). Verdicts are scoped to that real model. (She noted the brief PR #9019

wasn't visible in her checkout — view-only/not-pulled; verdicts stand on the ADRs.)

## Verdict per claim

1. **CA-private teardown doesn't invalidate existing certs — HOLDS, with conditions.** Verification
   uses the git-distributed CA *public* key; issued certs verify until `-V` expiry. BUT teardown
   also **destroys the ability to revoke** (KRL deferred/YAGNI) and, at `+52w` default validity,
   becomes **deferred mass invalidation** — any cert needing re-sign after teardown locks out with
   no signer. "Doesn't invalidate" is true but **incomplete**: it converts revocation from possible
   → impossible-until-expiry. (Counterexample: machine D's cert expires the day after teardown →
   aaron/addison lose certified access, no re-issue path.)
2. **CA teardown doesn't orphan user-encrypted data — HOLDS for the CA, NEEDS-CONDITION on vaults.**
   In `ca.ts` the CA only signs *authentication* certs (no key-wrap/KEM) — so CA teardown can't
   orphan ciphertext. BUT this is true only because **CertAuthority ∩ KeyCustody = ∅** (the
   hexagonal separation), and the workitem records a live violation: *interim "CA key MAY be in
   `lucent`"*. Under that interim, the premise is operationally false. **The real orphan risk is
   the derivation seed (the `aaron` vault), NOT the CA** — route the no-orphan invariant at the
   seed, where it's load-bearing, not at the CA, where it's easy.
3. **A single shared CA is an identity SPOF — HOLDS, stronger than stated.** Two SPOFs: availability
   (lose key → no issue/renew/revoke; mitigated by offline backup) and **integrity/forge** (possess
   key → mint a cert for *anyone*; UN-mitigated under interim full-trust). The forge-SPOF is a
   **manifesto §3 weight** (captured authority over all identity), not just a reliability flaw.
4. **Per-user CA REMOVES the SPOF — FAILS. It RELOCATES + PARTITIONS it.** (The load-bearing
   refutation.) Per-user CA shrinks the *forgery* blast radius from global → per-principal (real
   win) and removes the *global availability* SPOF (real win). But **each principal still has
   exactly one key that forges its identity** — the SPOF is **sharded to N single-points, one per
   user**, not eliminated. **never-single-key / ∅-blast-radius at the identity layer is NOT
   achieved.** To actually get it you need **threshold / Shamir k-of-n at each personal root** —
   which the brief did not propose. Plus cross-signing introduces **two new unproven obligations**:
   (a) **org-CA vs user-CA conflict has no resolution rule on file** → the trust graph is
   **non-confluent** (two verifiers can reach opposite verdicts) — a correctness bug; (b)
   **transitive revocation** over the cross-sign closure, with no revocation tooling at all.
   *Restate:* per-user-CA partitions the SPOF + removes the global availability SPOF, at the cost
   of trust-graph confluence + transitive-revocation obligations that don't yet exist.
5. **Entropy anti-Sybil binds / "non-bypassable" — NEEDS-CONDITION; "non-bypassable" REFUTED.**
   G3a (cost-linearity, cost(N) ≥ N·c, no economy of scale) is **LANDED + CI-gated** (Z3 lemmas,
   63 green) — but **its own funded-adversary witness proves Sybil is prohibitive-by-cost, NOT
   impossible.** So "non-bypassable" is false; "prohibitively costly" is what's proven. **G3b (the
   floor `c` is real, conserved, non-forgeable) is OPEN** — and Douceur 2002 says a weight-free /
   no-central-issuer system (which per-user-CA is) *must* supply that costly resource. **Minting a
   fake per-user CA is free (`ssh-keygen`); the only barrier to cross-signing it in is the unproven
   G3b floor at the cross-sign admission gate.** Until G3b grounds, the web of trust is Sybil-exposed.

## Trust-graph blast radius (what provably survives vs orphans)

| Tear down | Survives | Orphans |
|---|---|---|
| **Global CA private** (single-CA) | all issued certs to expiry; user-encrypted data (iff CA≠encryption port) | issue/renew/**revoke** for ALL; mass lockout at expiry — **global blast** |
| **userCA_u private** (per-user) | all other users + data; u's unexpired certs; u's data (diff key) | u's re-issue/revoke + u's **cross-sign closure** (transitive) — **local blast** |
| **orgCA private** | all user *self*-identities; all data | org-level **authorization** only (iff identity↔authz split) |
| **derivation seed** (`aaron` vault) | certs (diff keys) | **everything derived from the seed** — the catastrophic orphan |

Two invariants worth gating: **NoOrphanData** (∀ teardown of a *cert* node ⇒ data recoverable,
*given* CertAuthority ∩ KeyCustody = ∅ — interim CA-in-lucent makes it currently FALSE, the proof
catches it); **IdentityReissuable** (∀ teardown of userCA_u ⇒ ∃ recovery path — FAILS with one key
per user; that failure IS the per-user-CA SPOF, formalized).

## Tool routing (guarded against TLA+-hammer bias)

- **Alloy** (primary) — trust-graph reachability/blast-radius (R1), NoOrphanData disjointness (R3),
  IdentityReissuable/threshold path-existence (R4). *Anti-hammer: these are structural, NOT temporal.*
- **TLA+/TLC** — teardown/rotation/revocation **state machine** safety+liveness (R2); Sybil-on-
  cross-sign admission protocol (R7, extend `BftSybilConsensus.tla`).
- **Z3** — G3a cost arithmetic (R5, *done*); k-of-n share algebra (R4 cross-check).
- **Lean 4 + Mathlib** — G3b floor non-forgeability (R6, the research crux) — but **run a cheap
  FsCheck forging-falsifier FIRST** (can refute the floor in hours before Lean-weeks).
- Cross-check (BP-16): R3 + R4 are **P0** → ≥2 tools each. **Alloy binary not installed** (TECH-RADAR
  = Assess) — prereq to *run* R1/R3/R4 (doesn't block routing).

## What to do (Otto's read on next steps)

1. **Per-user-CA stays — but it's "partition + shrink," not "remove."** To claim ∅-blast-radius at
   identity, add **threshold (Shamir k-of-n) at each personal root** (and at the CA crown jewel) —
   this also satisfies never-single-key honestly. Backlog it.
2. **Define the org-CA vs user-CA conflict-resolution rule** BEFORE proving anything — the
   SDSI/SPKI discipline: *subject's own root authoritative for self-identity; org-root authoritative
   for org-authorization* (the same identity↔authorization split the multi-owner ADR already draws).
   This is a Kenji/Tariq design call, upstream of any tool.
3. **Route the no-orphan invariant at the derivation seed, not the CA**; enforce CertAuthority ∩
   KeyCustody = ∅ (kill the interim CA-key-in-lucent in the end-state).
4. **G3b is the crux** — fund the entropy-floor grounding (info-theory-of-individuality definition);
   run the FsCheck forging-falsifier first.
5. Add a **revocation primitive** (KRL) — already named by the round-trip-harness gap (081KVP2M1QS0).

## Anchors

RFC 5280 / OpenSSH `PROTOCOL.certkeys`; Douceur 2002 (Sybil); Dwork–Naor 1992 / Nakamoto 2008
(cost-per-identity); PGP web-of-trust + **SDSI/SPKI local-name** (Rivest–Lampson 1996 — the right
anchor for cross-signing per-user CAs); Shamir 1979 (threshold). In-repo: the two 2026-06-21 ADRs,
`ca.ts`, 081KVNTNTDQ0, G3 lineage (`…2026-06-19-g3-anti-sybil-entropy-cost-…`, `BftSybilConsensus.tla`,
G3a Z3 lemmas in `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`), TECH-RADAR (Alloy = Assess).
