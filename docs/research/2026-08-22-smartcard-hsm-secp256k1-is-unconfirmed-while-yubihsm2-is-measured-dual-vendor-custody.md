# SmartCard-HSM: secp256k1 is UNCONFIRMED — while YubiHSM 2 is measured. And the pair is complementary anyway.

**Status:** research from vendor + middleware documentation. **No CardContact hardware was exercised** —
that is the falsifier this note names and does not run.
**Prompted by** Aaron 2026-08-21, considering a dual-vendor HSM pair per node: *"maybe we have yubikey
and SmartCard-HSM 180K USB Token … can you research and make sure it supports crypto wallet keys."*

## The short answer

| device | secp256k1 (wallet curve) | basis |
|---|---|---|
| **YubiHSM 2** | **YES — measured** | `eck256` in the fw 2.4.1 mechanism list, enumerated on Aaron's own device (serial 39160506). See `2026-08-20-yubihsm2-mechanism-enumeration-...md` |
| **SmartCard-HSM 180K** | **UNCONFIRMED, and the evidence leans NO** | vendor page states only "RSA and ECC keys"; OpenSC's own documentation lists NIST and Brainpool curves and **never names secp256k1** |

## Why the product listing does not settle it

The CardLogix listing carries *"Bitcoin Wallet"* in its application list and *"Up to 4096 bit RSA,
521 bit ECC and 256 bit AES"* in its specs. Neither is a curve list, and the second is the tell:

> **"521 bit ECC" describes the NIST prime family** (P-192/224/256/384/**521**). **secp256k1 is a
> Koblitz curve, not a NIST prime curve**, and it is 256-bit — so it is not implied by *any* upper
> bound on ECC bit length. A device can support P-521 and still have no secp256k1 at all.

This is the exact confusion the curve names invite: **secp256r1** (NIST P-256) and **secp256k1**
(Bitcoin/Ethereum) differ by one character and are different curves with different parameters. An
HSM supporting the first tells you nothing about the second.

What the technical documentation actually names (OpenSC wiki, SmartCard-HSM page): `ECC-SECP192`,
`ECC-SECP256`, `ECC-BP224`, `ECC-BP320` — NIST prime and **Brainpool** families. `ECC-SECP256` is
itself ambiguous between r1 and k1 in that listing, and it appears in **example key output**, not in
a capability table. So it is not evidence either way.

**Register:** this is *absence of confirmation*, not *confirmation of absence*. CardContact may well
have added secp256k1 in later firmware — several PKCS#11 tokens did, under pressure from exactly this
use case. The claim that must not be made is the one the marketing bullet invites: that "Bitcoin
Wallet" in a feature list means the curve is present.

## The falsifier, which is already written for the other vendor

`2026-08-20-yubihsm2-mechanism-enumeration-...md` exists because a claim in
`tools/setup/persona-keys/frost-partial-signer.ts` registered its own honest limit — *"CHECKED
against the spec, PROPOSED as applying to any particular token, since token mechanism lists vary and
vendors add extensions"* — and then someone attached a device and enumerated it.

**Aaron 2026-08-22: *"okay it's cheap i'm going to buy to test it out."*** So the falsifier below is
**scheduled**, not merely named — this row is UNCONFIRMED with a date on it rather than indefinitely.

**The same falsifier applies here and has not been run:** acquire one SmartCard-HSM 180K, enumerate
its mechanism list with `pkcs11-tool -M` / `sc-hsm-tool`, and read the curve OIDs. Until then this
row stays UNCONFIRMED. At **$79.26** the falsifier costs less than an hour of arguing about it.

### Two devices were ordered, which makes the *second* falsifier runnable too

Aaron 2026-08-22: *"okay i just ordered two one for me and max."*

That matters more than redundancy. **One device tests only the mechanism list.** Two devices test the
thing this note actually argues for — **DKEK n-of-m backup and restore across devices** — because a
threshold scheme cannot be exercised against a single token. So the acquisition promotes two claims
at once:

| claim | testable with 1 | testable with 2 |
|---|---|---|
| secp256k1 present | **yes** — enumerate mechanisms | yes |
| **DKEK share import → key restore onto a second token** | **no** | **yes** |

And two *holders* — Aaron and Max — makes it a **custody** test rather than a lab exercise. A 2-party
DKEK arrangement is the smallest real instance of the n-of-m story, and it is worth noting that the
failure it protects against (one device lost, destroyed, or held by someone unavailable) is only
observable when the shares are genuinely in different hands.

**Consent note:** Max is on file in `docs/books/you-born-at-the-hinge/CONSENT-LEDGER.md` as a
business partner with a standing agreement, but **holding a custody share is not a book mention** —
it is an operational role with real obligations (availability, secure storage, and a say in any
threshold change). Nothing here assigns him that role; Aaron and Max settle it between them.

### The exact enumeration, for when the devices arrive

Unauthenticated where possible — the YubiHSM run established that precedent deliberately: *"no
authenticated session was opened and no key material was created, read, or handled."* Do the same
here; a mechanism list does not require a login, and not logging in is what keeps the measurement
free of custody consequences.

```bash
# 1. does the host see it at all
opensc-tool --list-readers

# 2. device identity + firmware version -- record verbatim, the way the YubiHSM note does
sc-hsm-tool

# 3. THE ANSWER: the mechanism list. Grep is not the check -- read the whole list.
pkcs11-tool --module /usr/lib/opensc-pkcs11.so -M

# 4. the curve question specifically. secp256k1 has OID 1.3.132.0.10;
#    secp256r1/P-256 is 1.2.840.10045.3.1.7 -- these differ by one character in NAME
#    and are different curves. Read the OID, not the label.
pkcs11-tool --module /usr/lib/opensc-pkcs11.so -M | grep -iE 'EC|ECDSA'
openssl ecparam -list_curves | grep -iE 'secp256k1|prime256v1'   # host-side name reference only
```

**What each outcome means:**

- `secp256k1` / OID `1.3.132.0.10` present → the row promotes to CHECKED and the device can hold
  wallet keys directly.
- absent → the device is still worth having **for DKEK n-of-m recoverability**, and wallet keys stay
  on the YubiHSM 2, which is already measured to carry `eck256`. The pair still works; only the
  division of labour changes.
- ambiguous label (`ECC-SECP256` with no r1/k1 qualifier) → **not an answer.** Resolve it by OID or
  by generating a test key and reading its parameters; a label that could mean either is exactly the
  confusion this note exists to prevent.

## Why the pair is still the right shape — for a reason better than diversity

Even if secp256k1 turns out to be absent, the two devices are **complementary on recoverability**,
which is the property the metal-bring-up work identified as the whole custody problem:

| | TPM 2.0 / YubiHSM 2 | SmartCard-HSM |
|---|---|---|
| key export | non-exportable by design | **DKEK-wrapped backup and restore** |
| device loss | key is gone with the device | **restore onto a replacement token** |
| threshold | — | **n-of-m DKEK share scheme — OpenSC documents a worked 3-of-5** |

The DKEK n-of-m scheme is **confirmed in documentation** (unlike the curve question). That is the
mechanism that makes Aaron's own resolution implementable at the device layer:

> *"in the start with one machine this is scary, when we have n-of-m no so scary anymore"*

A TPM-only design has **no** device-layer recovery — losing the board loses the key, which is why
`credential-binding-model.ts` tests `tpmSeal × machine_swap → decrypts: false`. Pairing it with a
DKEK-capable token means the threshold exists **before** the cluster is large enough to provide it
across nodes, which is precisely the window where the single-machine risk bites.

## The actual inventory reframes the design — two TIERS, not two-per-node

Aaron 2026-08-22: *"so we have one yubihsm and two of these comming, we will order what makes sense
next, we are trying to create mini distributed conputer fleets with nation state resistant security
like Itron."*

**One YubiHSM 2 and two SmartCard-HSMs is not a shortfall of the two-per-node design — it is a
better shape**, because the two device classes are not interchangeable:

| tier | device | where it lives | role |
|---|---|---|---|
| **online / node** | YubiHSM 2 (1) | attached to a node, always powered | operational signing; secp256k1 **measured present** |
| **offline / human** | SmartCard-HSM (2) | in Aaron's and Max's hands, unpowered | **DKEK threshold shares** — recovery, not operation |

Two-per-node buys **vendor diversity against a firmware defect**. Two *tiers* buys something the
custody problem actually needs: a key that is online and non-exportable, and a recovery path that is
**offline, portable, and in separate hands**. The offline tier is the one that survives the failure
the metal work identified — board loss — and it survives it *because* it is not in the board.

So the near-term arrangement writes itself, and it needs no further hardware to be coherent:
**YubiHSM signs, SmartCard-HSMs hold the threshold.** What to order next is then a real question with
a shape — more YubiHSMs to extend the online tier as nodes are added, versus more SmartCard-HSMs to
widen the threshold — rather than a shopping guess.

## "Nation-state resistant like Itron" — the boundary, stated because it is load-bearing

Aaron built Itron's mesh hardware, firmware, PKI and secure boot, and the security posture is the
right target. **The topology is not**, and the distinction is already carved:
`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` records that the hub-and-agent
patent (US10834144B2) is **assigned to Itron**, and — more importantly — that a mediating hub solves
an asymmetry Zeta does not have. *Take the posture; never take the hub.*

**And an honest limit on what an HSM buys against that adversary.** An HSM resists **key
extraction**. A nation-state adversary does not have to extract a key:

- **coercion of the holder** — which is precisely what a threshold across separate people mitigates and a single HSM does not
- **supply-chain compromise** — which is why two vendors with different silicon and firmware lineage is the relevant diversity, and why Knight & Leveson's correlation warning below is not academic
- **compromise of the host that asks the HSM to sign** — the HSM signs what it is asked; it does not judge

So the hardware is necessary and nowhere near sufficient, and the parts of this design that actually
carry the claim are the **threshold** and the **separation of hands**, not the tokens. Any writeup
that leads with the HSM brand has the argument backwards.

## The threshold choice, which is not a detail

Two HSMs per node is not one design, it is two, and they trade in opposite directions:

| | availability | security |
|---|---|---|
| **1-of-2** (either unseals) | up — one dies, node still boots | **DOWN** — an attacker need only break the *weaker* vendor |
| **2-of-2** (both required) | **DOWN** — either failure bricks the node | up — must break both independently |

Neither buys both. The composition that does is **dual-vendor per node** (correlated-vendor-failure
resistance) **× n-of-m across nodes** (availability) — which is where Aaron already arrived.

**Anchor, including its refutation.** This is N-version programming applied to hardware roots of
trust (**Avizienis 1977**), and the honest half is **Knight & Leveson (1986)**: independently
developed versions fail on **correlated** inputs far more often than independence predicts. Two HSM
vendors sharing a certification regime, a reference design, or a common crypto library are less
independent than the word "different vendor" suggests. For this pair the diversity looks real —
different silicon, different firmware lineage, different middleware — but that is an observation, not
a measurement, and no test here establishes it.

## COULD NOT CHECK

- whether SmartCard-HSM firmware supports secp256k1 at any version (no device, no firmware changelog reached)
- the 180K token's key-slot capacity, exact curve OID list, or CC certification level (the product page truncated before its spec table)
- whether the two devices' PKCS#11 modules coexist on one Linux host without provider conflicts

## Pointers

- `docs/research/2026-08-20-yubihsm2-mechanism-enumeration-frost-claim-promoted-to-checked-and-secp256k1-is-there.md` — the measured half, and the template for the falsifier above
- `docs/research/2026-08-21-hands-off-metal-what-a-node-can-provision-for-itself-...md` — the custody problem this pair is proposed against
- `tools/setup/persona-keys/frost-partial-signer.ts` — the FROST claim whose honest limit started this lineage
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why UNCONFIRMED is written in capitals rather than smoothed
- `.claude/rules/manifesto-13-specifications.md` §11 — multi-oracle at the hardware layer is the same principle
