# Attested key erasure makes "frozen" assertable — not merely observed to date

**Ferried** 2026-08-13 from Aaron, on the limit recorded in
`2026-08-13-canon-is-decided-by-write-keys-*.md` ("abandonment is not observable, so frozen can be
observed to date but never proved"):

> i think there maybe be some ladur erase key hardware we could build that would make froze asseterabe if
> you used trused hardware with secure boot and our software

This is right, and it converts a one-way observation into a **two-way claim** — given a trust root, with
limits that must be stated rather than glossed.

## The gap it closes

The prior doc established that immutability is not a property of a substrate's age but of **key
liveness**, and recorded the honest limit: a key that is merely *unused* is indistinguishable from one
that is *lost*, so "frozen" can be observed-to-date and never asserted. Same one-way shape as the CHSH
oracle — convicts, never acquits.

**Erasure breaks that symmetry.** An unused key and a destroyed key are different physical states, and
the second is attestable. If the author can prove the write key no longer exists, then "nobody holds a
live write key" stops being an inference from silence and becomes a **positive claim**.

## The construction, and it needs both halves

Attested deletion alone is not enough, and this is the part most likely to be got wrong:

**A deletion attestation proves that *this* secure element destroyed *its* copy. It cannot prove no copy
exists elsewhere.** Erasure of a key that was ever extractable is not erasure — it is one copy fewer.

So the chain needs a birth claim as well as a death claim:

1. **Attested non-extractable generation** — the key was generated *inside* the secure element and never
   left it, attested at creation. This is the load-bearing half; without it the death attestation means
   nothing.
2. **Attested destruction** — the element signs that the key material is gone.
3. **Therefore** no live write key exists, and the artefact is provably frozen.

**Real mechanisms, not hypothetical (CHECKED as existing technology, not as in-repo work):** TPM 2.0
non-migratable keys with attested creation, and NV-index / evict operations; Secure Enclave and
StrongBox key attestation with `origin = generated-in-hardware` and non-exportable flags; and the
strongest form — **one-time-programmable eFuses**, which physically and permanently disable a capability
and whose state secure boot can attest. A burnt fuse is not a policy assertion; it is a changed device.

Aaron's deepest unused anchor is directly on point here: the maintainer built Itron mesh
hardware/firmware/PKI/secure-boot. This is that expertise applied to a new object — with the standing
constraint that **those patents are centralized and Zeta is not**, so the design must be per-artefact
owner attestation rather than a central authority vouching for everyone.

## The physics claim, stated carefully — because it is easy to overclaim

"Ladur" is **Landauer**, and Landauer's principle is already load-bearing in this repo
(`tools/Z3Verify/landauer-floor-lemma.smt2`, `src/Core.Lean4/Lean4/LandauerFloor.lean`,
`src/Core.TypeScript/algebra/entropy-tracker.ts`). Erasure is *the* thermodynamically irreversible
operation, which is exactly why it is the right primitive to reach for.

**But the irreversibility that makes this work is not the Landauer bound.** Landauer 1961 gives the
thermodynamic *floor on the energy cost* of erasing a bit (`kT ln 2`); it does not by itself guarantee
that a given erasure cannot be undone. An eFuse is irreversible because of **physical damage to the
device**, and a secure-element key wipe is irreversible because of **memory overwrite plus a
non-extractability property**, neither of which is a `kT ln 2` argument.

Stating this precisely matters: conflating "erasure is thermodynamically irreversible in principle" with
"this specific erasure cannot be reversed by an attacker" is exactly the physics-as-metaphor the
metering-test in `anchor-to-human-prior-art` exists to catch. **Landauer is the right *conceptual* anchor
and the wrong *security* argument.** The security argument is device physics and attestation.

Where Landauer *does* bite, honestly: erasure has a metered energy cost, and this repo already meters
entropy (`entropy-tracker.ts`, `accountFerryCommit`). A key destruction is a **metered irreversible
crossing**, and posting it to the ledger is §13 noninterference applied to key lifecycle — the erasure
becomes an accounted event rather than an unobserved one.

## What this buys beyond proving frozen — freezing becomes a deliberate act

This is the more interesting consequence, and it was not the question asked.

Under the prior doc, an artefact became immutable by **abandonment** — someone lost a key, and canon
froze by accident. With attested erasure, an author can **choose** to freeze: destroy the write key, and
the artefact is permanently canonical *by intent*.

That makes the preservation commitment written about in #10462 — a community deciding a "fun glitch"
stays — enforceable at its strongest form. The prior doc said such a commitment needs a regression test
or it is only a preference. **Key erasure is a stronger mechanism than a test**: the author does not
promise not to patch the glitch away; they destroy their ability to.

It also joins an existing family of irreversible commitments in this substrate:

| act | irreversibility | what it buys |
|---|---|---|
| `frost` (spend privacy budget) | one-way by rule — only the owner may reveal | permanent opacity |
| Z-set retraction | correction, not deletion — history retained | auditable change |
| **attested key erasure** | **one-way by device physics** | **permanent canon** |

Note the row that is *stronger* than the others: frost is one-way **by rule**, and rules are enforced by
the substrate. Erasure is one-way **by physics**, and needs no enforcer. That is a genuinely different
guarantee class and worth having.

## The limits, and they are not small

- **A hardware trust root is a trust dependency (§1).** Every attestation chains to a vendor —
  concretely, to a **self-signed vendor root**: the TPM manufacturer's EK root CA for TPM 2.0
  non-migratable keys, Apple's CA for Secure Enclave attestation, Google's for Android StrongBox,
  AMD's ARK for SEV-SNP, Intel's SGX Root CA for TDX. The prior
  doc's framing — authority scoped to your own artefact, no central seat — is weakened by a vendor who
  vouches for everyone's attestations. `081KTHY32YQ08QG0R000JWHJYN` already settles the layering for this
  class: external anchors are **optional, revocable credence boosters**, never load-bearing for
  existence. Frozen-because-attested should be a *credence booster over* frozen-because-observed, not a
  replacement for it. Both readings should be emitted.
- **Non-extractability is the whole ballgame** and it is a claim about the *past*. A key attested
  non-extractable today says nothing about a copy taken before the attestation existed. This is only
  sound for keys generated under the discipline from birth — retrofitting is not possible, which argues
  for designing it in at the first authored game rather than later.
- **Attestation says the device did it; it does not say the human meant to.** A coerced or mistaken
  erasure is indistinguishable from a deliberate one, and it is permanent. Freezing by accident is now
  possible in a *new* way, and worse than before because it cannot be recovered by finding the old key.
- **It does not cover the frozen substrates we start with.** Atari cartridges have no secure element.
  Their frozen-ness stays observational, which is fine — but it means the Arena needs both readings
  regardless, and should not be designed as though attested erasure were the only path.

## Open

1. **Emit both readings**: `frozen-observed(no write in N)` and `frozen-attested(erasure certificate)`.
   Never collapse them into one boolean — they have different failure modes and different trust roots.
2. Specify the birth half. An erasure certificate without an attested non-extractable-generation
   certificate is **not evidence**, and should be rejected rather than accepted at reduced weight.
3. Decide whether an erasure event is **metered** to the entropy ledger. My read is yes — it is exactly
   the kind of irreversible crossing §13 says must go through a declared, metered channel.
4. Name the coerced/mistaken-erasure hazard somewhere an author will see it *before* burning a key.
   Irreversible by physics means no recovery path exists, and that should be stated at the moment of the
   act, not in a design doc.

## Anchors

Landauer 1961 (thermodynamic cost of erasure — the conceptual anchor, explicitly **not** the security
argument); Bennett 1982 (logical reversibility) for the same lineage. TPM 2.0 non-migratable keys and
attested creation; Android StrongBox / Apple Secure Enclave key attestation; OTP/eFuse secure-boot
locking — all **existing technology, cited from standing knowledge and not page-checked**. In-repo:
`tools/Z3Verify/landauer-floor-lemma.smt2`, `src/Core.Lean4/Lean4/LandauerFloor.lean`,
`src/Core.TypeScript/algebra/entropy-tracker.ts`, `081KTHY32YQ08QG0R000JWHJYN` (external anchors as
revocable credence, never load-bearing).

---

## Correction — erasure *at* the Landauer limit makes the energy itself the receipt (Aaron, 2026-08-13)

> it will be thermodynamicall erased at the lauder limit

I under-read the original claim, and the section above is **partially wrong** as written. It says
"Landauer is the right *conceptual* anchor and the wrong *security* argument." That holds for a
conventional key wipe, where the dissipation is incidental. It does **not** hold for the design Aaron is
describing, where erasure happens *at* the limit — because then the **energy is the evidence**.

### Why "at the limit" is the operative phrase, and it is not about efficiency

Landauer 1961 gives a **lower bound**: erasing one bit dissipates at least `kT ln 2` (≈2.8 × 10⁻²¹ J at
300 K). Ordinary CMOS dissipates on the order of 10⁴–10⁶ `kT` per operation, so in normal hardware the
Landauer term is buried many orders of magnitude below the incidental heat and carries no information.

**Designing to operate near the limit makes the erasure energy the dominant, measurable term.** That is
the engineering point, and it has nothing to do with power saving: it makes the thermodynamic receipt
*legible*. In hardware that already dissipates a million `kT` per op, "I erased 256 bits" is
unfalsifiable by measurement. Near the limit it is not.

### What this buys, stated in the one-way form this repo uses everywhere

The inference is **necessary, not sufficient**, and that is still valuable — it is the same shape as the
CHSH oracle and every other instrument here:

- **No erasure without the energy.** You cannot erase `N` bits while dissipating less than `N · kT ln 2`.
- **Energy without erasure is possible.** Heat can be dissipated for other reasons, so the measurement
  cannot *confirm* an erasure.

Therefore: **metered dissipation below `N · kT ln 2` falsifies an erasure claim.** It convicts, never
acquits — exactly the direction `AntiSybil`'s oracle runs, and the correct direction for an adversarial
claim. An attacker who wants to claim erasure while retaining the key must actually pay the energy, and
physics does the enforcing rather than a vendor's signature.

That is a materially different guarantee from attested deletion. Attestation says *a device asserts it
deleted the key*, and chains to a vendor trust root (§1 dependency, as recorded above). A thermodynamic
receipt is **not an assertion by anyone** — it is a physical quantity. Where both are available they are
independent evidence with independent failure modes, which is the strongest form: the vendor could lie
and the physics could not, and a discrepancy between them is itself a detection.

### Where it sits in the guarantee table

The table above put attested erasure at "one-way by device physics." That was imprecise. Refined:

| act | irreversibility | enforced by | forgeable by |
|---|---|---|---|
| `frost` | one-way by rule | the substrate | a substrate bug |
| attested deletion | one-way by device | vendor attestation chain | a compromised trust root |
| **erasure at the Landauer limit** | **one-way by thermodynamics** | **physics** | **nobody — but only falsifiable, not confirmable** |

### The honest engineering limits, and they are severe

None of these are objections to the direction; they are what has to be true for it to work.

- **The energies are minuscule.** 256 bits × `kT ln 2` ≈ 7 × 10⁻¹⁹ J. Measuring that directly against
  thermal noise is extraordinarily hard. The practical construction likely needs erasure of many bits, a
  calorimetric approach, or an amplification scheme — and **the measurement, not the erasure, is the hard
  part**. This should be scoped before anything is designed around it.
- **Approaching the bound requires slow, quasi-static erasure.** The Landauer minimum is attained in the
  adiabatic limit; fast erasure costs strictly more. So there is a real time-versus-energy tradeoff, and
  a "fast secure erase" cannot be at the limit by construction.
- **This is near the frontier of experimental physics, not off-the-shelf engineering.** Bérut et al.
  (Nature, 2012) experimentally verified the Landauer bound for a single bit in a colloidal-particle
  system; that is the state of the art being invoked, and it is a laboratory result rather than a
  component one can order. Adiabatic/reversible-computing logic (Bennett 1982's lineage) is the design
  family, and it has never been commercially mainstream.

**PROPOSED, and the strongest reason to write it down now:** the *design* implication is clear and cheap
even before any of the physics is achievable — if erasure is ever to carry a thermodynamic receipt, the
erasure path must be **metered from the start** and the energy accounted to the ledger. Retrofitting a
measurement to an unmetered path is not possible. `entropy-tracker.ts` already exists for this, which
means the cheap half can be built long before the expensive half is buildable.

### Anchors (added)

**Bérut, Arakelyan, Petrosyan, Ciliberto, Dillenschneider & Lutz, *Experimental verification of
Landauer's principle linking information and thermodynamics* (Nature 483, 2012)** — the experimental
confirmation this rests on. Bennett 1982 for logical reversibility and the adiabatic-computing lineage.
Koomey et al. on the practical distance between real hardware and the bound. **All cited from standing
knowledge, not page-checked** — Bérut et al. is the one to verify first, since the feasibility argument
leans on it.

---

## Resolution — a family of mechanisms, and the frozen claim must accept any of them (Aaron, 2026-08-13)

> fair enough there are many ways to acheive this, lauder being the physics one

That settles it, and the settlement is better than either of the previous two passes: **irreversibility
is a family, and Landauer is the physics member of it.** There is no winner to pick, and the useful
output was the taxonomy rather than the argument.

| mechanism | irreversible because | enforced by | buildable today |
|---|---|---|---|
| `frost` (spend budget) | the rule forbids reversal | substrate | **yes** |
| key wipe + non-extractability | memory overwritten, never exported | device + vendor attestation | **yes** |
| OTP / eFuse burn | the device is physically damaged | device physics | **yes** |
| erasure at the Landauer limit | thermodynamics charges for it | physics, unforgeable | frontier |

### The design consequence, which is the actionable part

**The frozen claim must be evidence-type-polymorphic — not tied to one mechanism.** Otherwise the
achievable versions cannot ship until the hardest one exists, which would be exactly backwards: the
eFuse path is orderable hardware today, and the Landauer path is a laboratory result.

`081KZ...` — the layering is already settled for this class by
`081KTHY32YQ08QG0R000JWHJYN`: external anchors are **optional, revocable credence boosters** feeding a
credence query, never load-bearing for existence. Frozen-ness should be exactly that shape:

```
frozen-observed(no write in N)          ← always available, weakest, no trust root
  + frozen-attested(deletion cert)      ← vendor trust root
  + frozen-fused(OTP state)             ← device physics
  + frozen-metered(dissipation ≥ bound) ← physics, falsification-only
```

Each is an independent booster with its own failure mode, and **a disagreement between any two is itself
a detection** — a device attesting deletion while the meter shows insufficient dissipation is a finding,
not a tie to be broken. That is the same multi-oracle discipline used everywhere else here, and it is why
collecting several weak independent signals beats waiting for one strong one.

**So the sequencing is: ship the polymorphic claim now with the observational and attested members, and
add the physics member if and when it becomes achievable — without redesign.** The one thing that must be
done early regardless, from the previous section, is metering the erasure path, because a measurement
cannot be retrofitted to an unmetered channel.
