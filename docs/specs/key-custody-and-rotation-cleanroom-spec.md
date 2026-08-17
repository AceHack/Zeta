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

## Implementation protocol — N-VERSION: two independent derivations, then combine

This spec is deliberately implemented **more than once, independently**, and the results
combined. Aaron 2026-08-09: *"do double work and combine the best of both."*

**The rule that makes it worth doing:** each implementer works from **this spec only** and
**must not read another implementer's branch, diff, or notes** before finishing their own.
Two implementations that saw each other are not two derivations — they are one derivation
and a review, and they will share each other's blind spots.

| Phase | Who | Sees |
|---|---|---|
| **Derivation A** | clean-side implementer #1 | this spec + Zeta's own code |
| **Derivation B** | clean-side implementer #2 (**different agent**) | this spec + Zeta's own code — **NOT A's work** |
| **Combine** | a third pass | **both**, plus this spec |

**Why this is worth the double cost here, specifically:**

- **It is a spec test, not just a code test.** Where A and B diverge, the spec was
  ambiguous. Divergence is the *output* — it localises the requirements that need
  sharpening, which no single implementation can reveal.
- **It strengthens the clean-room position.** Two independent derivations from a
  requirements document is exactly the evidence that the result was derived from
  requirements rather than from anything else.
- **Blind spots are unlikely to coincide.** The failure mode this catches is the one a
  single careful implementer cannot catch by being more careful.

**Combining rule:** prefer the version that is *simpler to falsify*, not the one that is
more complete. Where both are correct, take the one whose tests would fail loudest if the
behaviour regressed. Record what was taken from each and — more importantly — **what the
divergences revealed about this spec**, and fix the spec.

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

---

# AMENDMENTS — post-combine (2026-08-09)

**Everything above this line is the spec as derivations A and B were built against, and is
deliberately left unedited.** Rewriting it would destroy the record of what the two
implementers actually read, which is the evidence the whole N-version exercise produced.
The amendments below are **additive** and bind any *future* derivation.

Each one exists because A and B read the same sentence two different ways. A divergence
between two independent implementations is a **defect in this document**, not in either
implementation. Full evidence: [`key-custody-n-version-combine.md`](key-custody-n-version-combine.md).

## A1 (amends R9) — "agreed phase" must be *derived*, not accepted

R9 said expiry is evaluated against agreed phase. It never said where phase comes from, so
A derived it from an observed causal coordinate while B accepted an opaque scalar from the
caller. Both are honest readings of the text.

> **Phase MUST be derived from an observed causal frame.** An implementation that accepts a
> caller-supplied scalar as "the current phase" does NOT satisfy R9: the caller is precisely
> the party that cannot be trusted to agree with its counterparty, so trusting it assumes
> away the guarantee. Two principals must agree because of the *structure they both observe*,
> never because they were handed the same number.

*(This is the one amendment that resolves a genuine design choice rather than a wording gap.
It is decided on the evidence — a caller-supplied phase cannot make AC6 true — and is
flagged as a judgement call for the maintainer to overturn if he reads it differently.)*

## A2 (amends R8) — "bounded" requires a stated ceiling

R8 required an expiry and a bounded default. A enforced a maximum span; B allowed
`MAX_SAFE_INTEGER`, which carries an expiry and is indefinite in every way that matters.

> **A maximum span MUST be stated as a constant, and no public constructor may yield a grant
> exceeding it.** "Carries an expiry field" does not satisfy R8. The test is that indefinite
> authority is *unconstructible through the public surface*, not merely undefaulted.

## A3 (amends R6) — a retraction must change the fold

R6 required emission and retraction events. It never said the retraction must *do* anything,
so B emitted `key-retracted` events that its own fold ignored.

> **A retraction MUST change the folded result.** Emitting a retraction event that the fold
> does not consume does NOT satisfy R6. The test is executable: **removing every retraction
> event from a stream must change the folded state.** If it does not, the retraction is
> decorative.

## A4 (amends the Acceptance section) — every criterion names its observable

AC3 and AC4 were stated as properties with nothing to run. B satisfied AC3 with a field typed
as the literal `true` — an assertion no test can fail — and AC4 with a validation that cannot
return false for any input that type-checks.

> **Each acceptance criterion MUST name the function whose output demonstrates it, and the
> two inputs that make that output differ.** A criterion satisfiable by a literal, a
> non-optional field, or a type-level constant is not a criterion. If a property cannot be
> made falsifiable, say so and mark it unverified rather than asserting it.

## A5 (amends the implementation protocol) — declare coverage per requirement

A deferred R1–R4/R10/R11 and said so in a header comment. B claimed all twelve. Nothing in
the protocol required either claim to be *earned*, and a header comment is not a checked
artifact.

> **Each derivation MUST declare, per requirement, one of `implemented` / `partial` /
> `deferred`, and MUST NOT round `partial` up to `implemented`.** A requirement whose only
> artifact is a type declaration is `deferred`, not `implemented`. Deferring is a correct and
> expected outcome; misreporting coverage is the failure.

## A6 (amends the clean-room preamble) — house conventions must be given to the clean side

B used exceptions on a path where this repo requires `Result`. The clean side was never told,
and could not have known — the wall blocks prior art, not the repo's own conventions.

> **The clean-room brief MUST carry the host repository's binding conventions** (here:
> Result-over-exception, ordinal collation, `ConfigureAwait(false)`, no ambient wall-clock).
> Withholding them does not protect clean-room integrity; it only guarantees rework.

---

## Still unmet by ANY derivation

**Acceptance criteria 3 and 4 have no real implementation.** A deferred them; B's are
type-level assertions. Custody transfer, the custody fork, and the staking witness remain
**unbuilt** — and one of the two derivations reports otherwise. Any future work must treat
R1–R4 and R10 as green-field.

### STATUS UPDATE 2026-08-17 — A3, and A4 as it applies to AC3, discharged in derivation B

Two of the four filed gaps (081KZMCBDK208QG0R000YE008C) are closed **in derivation B only**;
derivation A is untouched. Both were re-confirmed live by execution on `main` first.

- **A3 (a retraction must change the fold) — CLOSED.** `foldEvents` now consumes
  `key-retracted` and `grant-expired`, moving their subject out of the asserted set and into
  a retained `retiredKeys` / `retiredGrants` (retraction, not erasure — §5). The executable
  test A3 demands now exists: removing every retraction event from a stream changes the
  folded state, and an early-retracted grant stops authorizing.
- **A4 as it applies to AC3 — CLOSED.** `priorCustodianRetainsPreFork: true` is gone. The
  fork names `priorCustodian`, and `evaluateForkRead` is the named observable, with a
  pre-fork ref (allowed) and a post-fork ref (denied) as the two inputs that make its output
  differ.

**Still unmet after that pass, and closed by the follow-up below:** AC4, R8/A2, and R12.
R1–R2 remain green-field.

### STATUS UPDATE 2026-08-17 (second pass) — AC4, A2 and R12 closed in derivation B

- **A2 (bounded span) — CLOSED.** `MAX_GRANT_SPAN_PHASES = 65536` is stated as a constant,
  and `Grant` is now a **branded** type so an object literal will not type-check. That is
  what makes A2's actual wording true — indefinite authority is *unconstructible through the
  public surface*, not merely undefaulted. `tryIssueGrant` is the only way to obtain a
  `Grant` and returns `Result<Grant, GrantError>` (Result-over-exception, per amendment A6).
  `Infinity` and non-positive spans are refused too. The **event stream is not a bypass**:
  `foldEvents` routes `grant-issued` through the same constructor and records a refusal
  rather than admitting an over-long grant. *The value 65536 is taken from derivation A
  rather than independently chosen; it is a policy dial and remains the maintainer's to
  retune.*
- **R12 (deny cites the wrong grant) — CLOSED.** On denial `authorize` now cites the
  **longest-lived** matching grant rather than `matching[0]`, so the citation no longer
  depends on stream order, and a not-yet-issued grant is described as "not yet in force"
  rather than "expired".
- **AC4 (witness stake) — CLOSED, and the original diagnosis was partly wrong.** See below.

**Correction to this document's own record.** §2 of
[`key-custody-n-version-combine.md`](key-custody-n-version-combine.md) states that
`validateTransfer` "cannot return `allowed: false` for any `CustodyTransfer` that
type-checks". Checking that by construction shows it is an over-statement. Of the three
guards, two were unreachable and one was live:

| guard | reachable by a type-checking input? |
|---|---|
| `!transfer.witness` | **no** — `undefined` is not assignable to `WitnessStake` |
| `!transfer.witness.voluntary` | **no** — `false` is not assignable to the literal `true` |
| `!transfer.witness.resource` | **yes** — `resource: ""` type-checks, and did deny |

**The serious defect was one neither guard covered:** nothing checked that the witness was a
party *other than the two transacting*. Alice witnessing her own transfer away, and Bob
witnessing the transfer to himself, both returned `allowed: true` — the one-sided transfer
R10 exists to prevent. `voluntary` is now `boolean` (so a compelled stake is representable
and therefore refusable — a stake must never be coerced), and distinctness from both
custodians is enforced.

**Scope, stated exactly:** `validateTransfer` checks that a transfer *record* names a
distinct, willing witness and a non-empty resource. No attestation is signed, and no stake is
escrowed, held, or slashed. It cannot tell you the named witness actually consented, or that
the staked resource is real or unpurchasable — **which resources count as socially-conferred
and non-purchasable is a policy roster that is deliberately not invented here.**

**Scope of the AC3 claim — read this before citing it.** `evaluateForkRead` is an
authorization *decision over declared lineage*. It is not a confidentiality mechanism: no
content is encrypted, no key is cryptographically revoked, and nothing stops a party holding
post-fork bytes from reading them. AC3's "unable to read" is demonstrated **as a decision the
module returns**, not as an enforced impossibility. Nothing in this module is cryptographic —
see the header comment in `key-custody.ts`.

**N-version note.** The work item filed these gaps rather than fixing them, on the ground that
patching B would make the reviewer a third derivation touching the second. That constraint
governed the *pre-combine* window: independence buys its evidence at combine time, and the
combine has since landed (amendments A1–A6 above). Fixing B afterwards cannot retract evidence
already extracted. Disclosure per the clean-room handoff discipline: the agent making this
change read `key-custody-n-version-combine.md`, which describes A's approach in prose, and did
**not** open A's source. The retirement-set design used here differs from A's described
slot-clearing, and is **not** offered as a third independent derivation.
