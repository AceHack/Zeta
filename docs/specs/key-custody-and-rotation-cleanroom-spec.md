# Key custody & rotation — CLEAN-ROOM SPECIFICATION

**Status:** specification only. **This document is the clean side of a clean-room wall.**
**Read this and nothing else.** Do not seek out, request, or read any third-party or
prior-employer implementation of similar functionality. If you believe you have seen one,
stop and say so rather than proceeding.

**Provenance:** written by Otto (shadow), who examined prior art and is therefore
**barred from implementing this**. Per `.claude/rules/cleanroom-two-team-separation.md`,
implementation must be done by a different agent that has not seen that material. Every
requirement below is stated as *what the system must do*, derived from Zeta's own
constraints (decentralization, partition tolerance, the manifesto specs) — not from any
other system's structure.

---

## R1 — Ownership is a first-class type

Ownership of a key MUST be represented as its own modelled entity, not as a mutable field
on the key and not as ambient context inferred from where the key happens to live.

*Rationale:* an owner that is a field can be reassigned by a single write, which makes
"transfer" indistinguishable from "overwrite" and leaves no artifact to verify.

## R2 — Keys have classes, and class determines transfer scope

The design MUST support more than one key class, where the class determines what a
transfer or rotation affects. At minimum: a key scoped to a whole deployment, a key scoped
to a single node/device, and a bundle that certifies others.

*Rationale:* a single undifferentiated "rotate the key" verb cannot express rotating one
node without touching the rest, and conflating the scopes forces over-broad rotations.

## R3 — Transfer is an explicit, two-sided, non-destructive operation

Custody change MUST be an explicit operation with **both** sides represented, not a
mutation. It MUST NOT destroy the prior custodian's ability to read what they held before
the transfer.

*Rationale:* §5 Memory Preservation — an identity transition must never silently destroy
memory. The returning/relinquishing party legitimately retains their own records.

## R4 — Custody change is a fork over content-addressed structure

Implement R3 as a **fork**: the post-transfer branch carries the new custodian's keys, the
pre-transfer history remains a **shared ancestor** of both branches, and no key is valid
across the fork boundary in both directions.

*Rationale:* sharing ancestry (rather than copying or deleting) makes R3's preservation
property structural instead of protocol-enforced, and gives key isolation for free.

## R5 — Rotation carries three key slots, not two

At any time a principal MUST be able to hold **previous**, **current**, and **next** keys:
accept `previous` from peers that have not yet observed the rotation, sign with `current`,
and publish `next` **before** it is used.

*Rationale:* there is no central authority to sequence a cutover. With two slots there is a
window in which two honest peers cannot verify each other and neither is wrong — a liveness
failure caused purely by the absence of a coordinator. The `previous` acceptance window
MUST be bounded and that bound MUST be stated (too short re-opens the window; too long
extends acceptance of a compromised key).

## R6 — Rotation and transfer are append-only events

Both MUST be expressed as events on an append-only stream — an emission for the new state
and a **retraction** for the superseded one — never as an in-place edit.

*Rationale:* preserves replay, audit, and deterministic simulation. Retraction rather than
deletion keeps history intact while changing the fold's result.

## R7 — No secret material in the event stream

The stream MUST carry references and metadata only. Key material MUST live in a store
behind that reference.

*Rationale:* the event stream is text, diffable, and part of the verification lineage.

## R8 — Time-bounded grants, expiring without coordination

Any grant of authority (a role/hat binding, a key's validity, a `previous`-slot acceptance
window) MUST carry an expiry, and **the default MUST be bounded** rather than indefinite.
Expiry MUST take effect **without** requiring any message to be delivered.

*Rationale:* §3 weight-free — an unbounded grant accumulates authority, and capture becomes
reachable. A grant that needs a revocation message to stop being valid is only safe if the
network cooperates; one that expires is safe under partition.

## R9 — Expiry is evaluated against agreed phase, never local wall-clock

*Rationale:* two principals with different clocks must never disagree about whether a grant
is live.

## R10 — A custody transfer requires a witness who stakes something unpurchasable

Claiming a fork as a **custody transfer** (as opposed to merely forking one's own data)
MUST require attestation by a party who stakes a socially-conferred, non-purchasable
resource on the attestation being true. Staking MUST be voluntary and MUST NOT be required
to hold a role or to participate.

*Rationale:* prevents one-sided transfer. Because the staked resource cannot be bought, a
well-funded attacker cannot manufacture witnesses; because staking is voluntary, an
unwitnessed transfer simply does not complete.

## R11 — Every principal issues and verifies; no central issuer

Each node MUST be able to issue credentials for itself and verify others'. Trust decisions
MUST be per-principal (each decides whom it trusts) rather than delegated to a mandatory
central authority.

*Rationale:* §1 scale-free and §11 Multi-Oracle. Interoperability with external identity
systems is a separate concern and MUST NOT introduce an internal hub.

## R12 — Authorization decisions explain themselves

An authorization result MUST carry the reason for the decision, not just the outcome.

*Rationale:* an error is a teaching surface; a bare deny costs a round trip and teaches
nothing.

---

## Acceptance (what "done" must demonstrate)

1. A grant with a short bound **stops granting at expiry with no revocation message sent**.
2. Rotating a principal's key leaves `previous`-signed material verifiable for exactly the
   stated window, and unverifiable after it.
3. A custody fork leaves the prior custodian able to read pre-fork content and unable to
   read post-fork content.
4. A custody transfer **cannot complete** without a witness stake.
5. Replaying the event stream from empty reproduces the same final state (deterministic).
6. Two principals with skewed clocks agree on whether a given grant is live.

## Non-goals

Compatibility with any specific external product or protocol. Interop standards may be
adopted later at the boundary; they are not requirements of this core.
