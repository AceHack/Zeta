# secp256k1 re-score of the HSM/FIDO survey — FIPS mode disables the curve, and unattended signing is the crux

**Date:** 2026-08-20 (all liveness checked this date) · **Register:** Beacon · **Author:** Mateo

> **EXTENDS, does not replace,
> [`2026-08-14-open-source-hsm-and-fido-devices-we-can-fabricate-and-modify-plus-research-fpga-class.md`](2026-08-14-open-source-hsm-and-fido-devices-we-can-fabricate-and-modify-plus-research-fpga-class.md).**
> Its §1 (integrity self-rootable, authenticity not), §2 (**open ≠ secure**), §4 (fabrication cost)
> and all of §5 (Class B FPGA) stand unchanged and are not re-argued. This re-scores §3 against one
> new column and revises §6(3).

## 0. What changed since 2026-08-14

| # | Change | Register |
|---|---|---|
| 1 | **secp256k1 on-chip became a hard criterion.** The word does not appear anywhere in the 2026-08-14 doc. | requirement (owner) |
| 2 | The attached YubiHSM 2 fw 2.4.1 was enumerated; `eck256` is present. | **measured** (in-repo, 2026-08-20) |
| 3 | **FIPS mode DISABLES `eck256`** — so §6(3) "buy the FIPS SKU for custody" is incompatible with criterion 1 *on the same device*. | **checked** vs vendor doc |
| 4 | Aaron removed FIPS from scope mid-task: *"i purposely didn't choose fips hsm … main Zeta i don't care about fips compliance"*. | owner scope decision |

Findings 3 and 4 arrived **independently** and point the same way. That is convergence, not a
confirmation loop — one is a vendor algorithm table, the other a scope call, neither derived from
the other.

**Register key:** **measured** (hardware/machine-readable artifact exercised) · **checked**
(primary source at a named URL+date) · **cited** (secondary only) · **unknown** (named, not
omitted). Nothing is rounded up.

## 1. Why the criterion is structural

x402 settles USDC via **ERC-3009 `transferWithAuthorization`**, authorised by an **EIP-712
typed-data signature** ([eips.ethereum.org/EIPS/eip-3009](https://eips.ethereum.org/EIPS/eip-3009)),
verified on-chain by `ecrecover` = **secp256k1 ECDSA**. No curve-agility knob exists. Pass/fail on
the wallet-signer role only.

**The Mac is the forcing case.** Secure Enclave is P-256 only — `SecureEnclave.P256` is the whole
surface — and has no AES key-wrap primitive of the shape `frost-share-adapter` needs. Both already
recorded in `tools/setup/persona-keys/frost-hardware-probe.ts`.

**The Linux nodes do not rescue it.** secp256k1 is **not in the TCG Algorithm Registry** — there is
no `TPM_ECC_SECP_P256_K1` to ask for. Evidence: [wolfSSL/wolfTPM#356](https://github.com/wolfSSL/wolfTPM/issues/356)
(*"P256K1 is not part of TCG Algorithm Registry"*) and the TCG Algorithm Registry v2.0 (2025-07-28),
which lists NIST/BN/SM2 only.

> **CITED, not measured.** A registry absence is not a device enumeration; vendors may add curves.
> **Falsifier: `tpm2_getcap ecc-curves` on each Linux node.** Not run — no Linux node reachable.

## 2. The headline finding, and the owner's scope call

### 2.1 FIPS mode disables `eck256`

Yubico's own guide lists the algorithms unavailable in FIPS-approved mode:

> "FIPS approved mode means the following algorithms are no longer available: rsa-pkcs1-decrypt,
> rsa-pkcs1-sha1, rsa-pss-sha1, ecdsa-sha1, **eck256**."
> — [Set FIPS Mode, docs.yubico.com](https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-option-fips-guide.html)

Corroborated on the product overview, which annotates it directly — *"eck256 — Support for EC keys
with curve secp256k1"* among those **"disallowed by FIPS"**. Also checked: the device is **not** in
FIPS mode after factory reset; leaving FIPS mode requires deleting all objects or a factory reset.
Register: **checked** (vendor doc), **not measured** — entering FIPS mode is a device operation and
not ours to run.

> **On a YubiHSM 2 FIPS you may have the validation or the curve, never both at once.**

`docs/inventory/hardware-to-buy.md` currently says *"For real custody use the FIPS SKU ($950), not
the $650 one"* — which under the new criterion buys a device that **cannot sign an x402 payment
while operating under the validation it was bought for.** This is not a defect in the 2026-08-14
survey; it answered its question correctly with the criteria it had. It is a **criterion collision**.

### 2.2 Aaron's steer, applied — contradiction left visible

Verbatim: *"i purposely didn't choose fips hsm, we can have special code for that, we likely need a
different repo that's fully fips compliant, main Zeta i don't care about fips compliance"*

Applied: (1) FIPS SKU **not** recommended for main Zeta; (2) FIPS validation scored
**out-of-scope**, never as a plus column — a device attractive only for validation is scored on its
non-FIPS merits, with certification noted as *relevant to the future FIPS repo*; (3) the
**open/auditable axis carries more weight**, since the reason for the open anchor was vendor
diversity and no-backdoor-verifiability, not compliance.

**The contradiction is recorded, not resolved.** `hardware-to-buy.md` says buy FIPS; the owner says
FIPS is out of scope. Both are on file; this doc follows the owner because scope is his call, and
§8 flags the inventory line for his own edit. **Silently overwriting a procurement note would erase
the disagreement rather than surface it.**

**What did *not* change:** §2 of the prior survey ("open ≠ secure") is intact. Dropping compliance
as a criterion removes a *purchasing filter*; it adds no tamper mesh, epoxy, side-channel
countermeasure or fault-injection hardening to anything.

## 3. Re-scored §3 Class A table — new column: on-chip secp256k1 signing

| Device | secp256k1 on-chip? | Source (checked 2026-08-20) | Liveness | Role if it fails |
|---|---|---|---|---|
| **YubiHSM 2** (non-FIPS v2.4 / fw 2.4.1) | **YES** | **measured**: `eck256` + `ecdsa-sha256` in `get-device-info`; store page lists `secp256k1` | **$650**, purchasable | — (passes) |
| **YubiHSM 2 FIPS** v2.4 | **YES in non-approved mode; NO in FIPS mode** | [Set FIPS Mode](https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/hsm2-option-fips-guide.html) | **$950**, cert #5302 | Out of scope (§2.2); keep for the FIPS repo |
| **Tillitis TKey (TK1)** | **NO shipped app.** Architecturally possible (PicoRV32 soft-core) — **nobody has written one** | shipped signer is Ed25519 only | **Very live** — pushed 2026-08-20, 442★ | Self-rooted measured boot, fully open toolchain; plus §5.3 |
| **OpenSK** (nRF52840) | **NO** — FIDO2/CTAP2, ES256 | [google/OpenSK](https://github.com/google/OpenSK) | Live — 2026-08-06, 3,398★ | FIDO2; cheapest reference device ($10) |
| **SoloKeys Solo 2** | **NO** | — | **Hardware still dead** — pushed 2022-04-18 | FIDO2; hardware-modifiability claim still false |
| **Nitrokey 3A/3C** (LPC55S69 + SE050) | **YES — but only via the OpenPGP application** | Nitrokey blog, fw v1.8.2 — *"now supports the Bitcoin curve (secp256k1) using the SE050"*; page date ambiguous (DD.MM.YYYY) — **flagged, not resolved** | Live — fw 2026-08-19; **€60** in stock | FIDO2 + most completely published MCU-key hardware. **Not recommended as wallet signer** (Q4) |
| **Nitrokey HSM 2** (SmartCard-HSM) | **YES** | vendor: *"Bitcoin Koblitz curve secp192k1, **secp256k1**, secp521k1"*; OpenSC wiki; **third-party working integration** — Ethereum PoA sealing via PKCS#11 (coinfabrik, 2019) | **€109.** **Availability contradictory** — category page in stock, product page *"by inquiry only"* | — (passes). **Openness does not reach the security core** |
| **Nitrokey NetHSM** | **YES**, and the only one here that also does **BIP-340 Schnorr** | **machine-read from the shipped OpenAPI spec** @ `f2adb502`: `KeyType ∋ EC_P256K1`; `KeyMechanism ∋ ECDSA_Signature, BIP340_Signature` | Live — EUPL-1.2. **PRICE FINDING: NetHSM 2 = €11,898.81** — repo's `~$1,200` wrong by **~10×** | — (passes technically; §7.3) |
| **CrypTech Alpha** | **NO** (nothing ships) | — | Dormant | none |
| **pico-hsm** (RP2040/RP2350) | **YES** | [docs.picokeys.com](https://docs.picokeys.com/picohsm/features/) | **Very live** — 2026-08-20, 559★ | **Lab tool only.** Keys in flash under a PIN-derived MKEK. Great at $4 for wiring PKCS#11. **Never for value** |
| **CanoKey** | **unknown** | not established here | core live | FIDO2 key |
| **OpenTitan** | **NO in the shipped cryptolib** — P-256/P-384/Brainpool/X25519/Ed25519. OTBN is programmable ⇒ implementable; nobody shipped it | [cryptolib API](https://opentitan.org/book/doc/security/cryptolib/cryptolib_api.html) | Very live — 3,601★ | Silicon RoT; taping out is an ASIC run |
| **Caliptra** | **NO** | — | Very live | datacenter RoT IP |
| **TROPIC01** | **NO** — Ed25519 + P-256 only | [tropicsquare.com](https://www.tropicsquare.com/tropic01) | GA, DigiKey | Best purchasable SE **with published architecture**. **Irony:** Tropic Square is Trezor's sister company and the part omits the Bitcoin curve |
| **Precursor** | **unknown** (soft-core ⇒ software secp256k1 possible) | — | $512, Crowd Supply | user-verifiable-trust demonstrator |

**One device changed category, and it is the one on the desk.** The non-FIPS YubiHSM 2 was scored as
the *development* SKU with FIPS as the custody answer. Under criterion 1 + §2.2 that **inverts**: the
non-FIPS SKU is the custody device and the FIPS SKU is the one that cannot do the job. Correct
procurement action: **spend nothing.**

## 4. New candidates

**4.1 Nitrokey HSM 2 / CardContact SmartCard-HSM — the parity buy.** €109, USB CCID, PKCS#11 via
OpenSC, secp256k1 confirmed three ways, PIN-authenticated, **no button** ⇒ unattended-capable.
Limits, all of them: openness **does not reach the SE** (buys *diversity*, not *auditability* — do
not let it stand in for the open anchor); **throughput unmeasured** (falsifier: `pkcs11-tool --sign`
in a loop — **this may be the binding constraint at payment rates**); availability contradictory.

**4.2 NetHSM — technically the best fit, ~10× the recorded price.** The only candidate that is
open-source system software (EUPL-1.2, MirageOS/OCaml on a Muen separation kernel), network-attached,
secp256k1 **+ BIP-340**, and carries **namespaces**: *"R-Administrators can not see keys in a
Namespace"* — a **stronger** per-agent partition than YubiHSM domains, because **root is excluded by
construction rather than by delegation discipline.** And it costs **€11,898.81**. ⇒ **the
open/auditable secp256k1 axis is now UNFILLED under ~€12k.**

**4.3 SoftHSM — testing only, loudly.** **It is software. There is no chip. "The key never leaves
hardware" is false by construction.** Named solely so nobody later mistakes it for a tier.

**4.4 Ledger / Trezor / Coldcard / Jade / Frostsnap.** All do secp256k1 natively; that was never the
question — §5 is. The fleet **already owns** Coldcard MK4, Coldcard Q, Trezor, Ledger Nano S Plus and
Jade Plus, so this class costs nothing and still cannot do the job. **Frostsnap** genuinely does
**FROST in firmware** — the thing the YubiHSM measurably cannot — but is **Bitcoin-only** and signing
means *"visit the required number of devices one at a time."* Existence proof, not a candidate.

**4.5 Cloud KMS — excluded, stated rather than omitted.** Both support the curve: GCP
`EC_SIGN_SECP256K1_SHA256` (*"only supported for HSM protection level"*) and AWS `ECC_SECG_P256K1`.
Either would work today with policy-gated unattended signing and no button. **Excluded because they
are remote custody — the thing being replaced.** The discriminator is **exit**: a cloud KMS key
cannot be exercised without the provider and cannot be moved out — not an oracle you chose, a hub
that holds you. **The honest cost:** cloud KMS is cheaper, more available, better logged and better
attested than anything below. **We are giving up real operational quality to keep custody local.
Make that trade with eyes open.**

## 5. The crux — unattended signing

**Class 1 — credential-gated (unattended-capable).** Authorisation is *something the daemon holds*.

| Device | Gate |
|---|---|
| **YubiHSM 2** | auth-key session; **no button, no biometric exists** |
| **Nitrokey HSM 2** | PKCS#11 User PIN; CCID card, no user-presence element |
| **NetHSM** | HTTP Basic, `Operator` role, `/keys/{KeyID}/sign` |
| **pico-hsm** | PIN (lab only) |

Precisely: this class protects against **key exfiltration**, not against **the holder of the
credential.** That is the definition of unattended, and it moves the whole security argument onto
*credential scoping* — which is why YubiHSM `--domains` / `--capabilities` / `--delegated` and NetHSM
namespaces are load-bearing, not nice-to-have.

**Class 2 — presence-gated (fine human-consent device, non-starter as agent wallet signer).**
**Ledger** is building *explicitly for AI agents* — model *"Agents propose, you approve, signers
enforce"* — and states *"signing only happens when you press the buttons on the device"*; async and
"bounded autonomy" are listed **coming soon**, i.e. not available. **Trezor / Coldcard / Jade /
Frostsnap**: on-device confirmation, air-gap, or per-device visit. **Secure Enclave**: Keychain ACL +
biometric (and P-256 only anyway).

> This is not a lesser class — it is the correct implementation of a *different* requirement this
> repo already holds (*"nothing operator-run, only operator-approved via biometric"*). **The Secure
> Enclave and the owned wallets are the right devices for the human-consent gate and the wrong
> devices for the agent's payment key.** Conflating the two roles is the error.

**Dead lead, recorded so nobody re-walks it.** **GridPlus Lattice1** looked like the exception —
multiple secondary sources describe spending limits allowing automatic signing. **Primary docs
contradict them**: both Security Features and the Firmware Reference state *"all signing requests
must be authorized by the user by approving on the device screen."* Register:
**cited-secondary, contradicted-by-primary ⇒ treat as NO.**

**Class 3 — the TKey, which is neither, and that is the interesting result.** Touch is a property of
*the app you compiled*: the signer can be built with `TKEY_SIGNER_APP_NO_TOUCH` — and, from the same
README, *"this changes the signer app binary and as a consequence the derived private key and
identity will change."*

Because `CDI = BLAKE2s(UDS ‖ USS ‖ BLAKE2s(app))`, **the no-touch build is a different identity** —
a verifier distinguishes a touch-required signer from a no-touch signer **by its public key alone**,
with no attestation, no CA, no policy database. Every other device has physical presence as a fixed
hardware fact; the TKey is the only one where it is a **declared, cryptographically-bound choice.**
Novel, unused anywhere in the repo, and it does **not** make the TKey an x402 signer today.

## 6. What the failing devices retain

FIDO2/WebAuthn (OpenSK, Solo 2, CanoKey, Nitrokey 3, YubiKey 5) — the attestation-gated
relying-party path; unchanged and still needed. **Secure Enclave** — human consent gate + per-machine
sealing. **TPM 2.0** — measured boot + per-node sealing; note it binds to *a node*, and **a node runs
many agents, so it structurally cannot supply the per-agent split** (it is not "the cheap HSM").
**OpenTitan / Caliptra** — silicon RoT. **TROPIC01** — auditable SE for storage/device identity.
**Owned wallets** — human-approved treasury ops, i.e. the right place for the funds an agent's hot
key is topped up *from*.

## 7. Recommendation for the Mac

**7.1 Buy nothing.** Use the YubiHSM 2 already attached (serial 39160506, fw 2.4.1, non-FIPS, $650
already spent). `eck256` + `ecdsa-sha256` are **measured present on that exact unit**; it is Class 1
unattended (no button exists); per-agent partitioning is a device feature (one auth key per
container, own `--domain`, `sign-ecdsa` only, never `exportable-under-wrap`, `--delegated` makes
privilege monotone-decreasing). **Do not buy the FIPS SKU** — §2.1 and §2.2. Three non-blocking
client-side adaptations: keccak256 **off-device** (submit the 32-byte digest), recover `v` by testing
both candidates, normalize low-`s` for EIP-2.

**7.2 Fleet parity is a real problem.** Mac Studio + Linux x86 + Max's node. The USB HSM is per-host;
Linux TPMs almost certainly do not help (cited); Max's node is a third party's machine and nothing
here should assume physical access.

- **(a) One USB HSM per node — 3× Nitrokey HSM 2 @ €109 ≈ €327.** Cheap, keeps custody local
  everywhere, adds the vendor-diversity axis. Limits per §4.1.
- **(b) Share the Mac's YubiHSM over the network via `yubihsm-connector`.** **Recommended against as
  default:** it recreates exactly the shape §4.5 excludes — one box holds every agent's key and every
  node must route through it, an **appointed hub with no second one to use.** It also has advisory
  history: **CVE-2021-28484 / YSA-2021-02**, CVSS 7.5 DoS in `yubihsm-connector` ≤ 3.0.0.

**⇒ Recommended: (a).** At €109/node the cost argument does not survive contact with parity.

**7.3 The gap that cannot be closed.** With NetHSM at €11,898.81 there is **no open/auditable
secp256k1 HSM inside a sane budget** — and §2.2 makes that axis *more* important, not less. Two
candidate fills: **(1) NetHSM Software Container** on owned hardware (price unknown, "by inquiry
only") keeps the auditable stack and **gives up the hardware boundary entirely** — *a downgrade
wearing the open badge, and it must be labelled that way if proposed.* **(2) A secp256k1 device app
for the TKey** (≈$238): the only path to an **open-design, open-toolchain, self-rooted, unattended**
secp256k1 signer. It is unwritten software on a device whose own threat model puts **all physical and
electrical attacks out of scope** — so if built, it holds a **capped hot-wallet float, never a
treasury.** Worth a spike; not worth promising.

**7.4 Limits, so this cannot be over-read.**

- Nothing here reaches *"as mathematically safe as coinbase."* **Dropping FIPS did not change that**:
  institutional custody is certification + split quorums + insurance + audited procedure; we have one
  USB device.
- Single-device custody protects against **exfiltration**, not against **the holder of the device**.
- **FROST remains unavailable in hardware on everything recommended.** YubiHSM cannot produce a
  partial (measured). **NetHSM cannot either**: `/keys/{KeyID}/sign` takes `{mode, message}` and
  nothing else — **no parameter supplies an external nonce or group commitment** (machine-read from
  the shipped spec; **checked vs spec, PROPOSED for a running appliance**). The only FROST-in-firmware
  device is Frostsnap: Bitcoin-only and presence-gated.
- **NEW operational finding — the audit log will not survive payment traffic.** The device reported
  `2/62` slots used (measured). Yubico documents the two options: with `force-audit` off, *"new
  operations will overwrite old ones, losing the trail"*; on, the HSM *"will refuse further operations
  until the logs are exported"*. **At x402 frequency 62 entries is seconds of history.** An x402
  signer therefore needs a **log drainer** exporting entries to durable storage on a schedule —
  otherwise the choice is between **losing the tamper-evident trail** and **the device DoSing itself
  mid-payment.** Nobody has designed it, and it is not optional if the audit log is counted as a
  security property.

## 8. Corrections owed to `docs/inventory/hardware-to-buy.md` (not applied — §2.2 is a live disagreement)

1. **NetHSM `~$1,200` → €11,898.81.** Materially changes the "~$3,150 four-guard root" plan.
2. **"For real custody use the FIPS SKU ($950)"** — contradicted on two independent grounds (§2.1
   curve, §2.2 scope).
3. **Add a `secp256k1?` column to the Tier-1 table** — it is now the first filter; a table without it
   invites the same collision again.
4. **Add Nitrokey HSM 2 (€109)** as the parity/vendor-diversity row, with the openness caveat and the
   in-stock/by-inquiry contradiction attached.
5. **Nitrokey 3A NFC €59 → €60**; 3A (no NFC) €48; 3C NFC €65.

## 9. Open questions, each with its falsifier

1. **Any TPM in the fleet exposing secp256k1?** → `tpm2_getcap ecc-curves` per Linux node. Until run,
   §1's TPM claim stays **cited**.
2. **Nitrokey HSM 2 throughput** → `pkcs11-tool --sign` loop, ops/sec. Decides viable-signer vs
   key-custodian-only.
3. **Nitrokey HSM 2 availability** — in stock or by inquiry? Contradictory vendor pages.
4. **Is Nitrokey 3's secp256k1 reachable outside OpenPGP (PIV/PKCS#11), and does it need touch?**
   **unknown** — decides whether a €60 key is a wallet signer.
5. **NetHSM ECDSA over `EC_P256K1`: which digest length?** The spec pairs ECDSA hashes with
   P256/P384/P521 and **says nothing about P256K1**. A 32-byte keccak256 digest *should* be accepted
   as for P256 — **that is inference.**
6. **Would a TKey secp256k1 app fit** in RAM/flash, at what latency? All of §7.3(2) rests on it.
7. **The audit-log drainer** (§7.4) — unowned design work, **blocking any claim that HSM operations
   are auditable.**

## Anchors (Beacon)

ERC-3009 + EIP-712 — why the curve is not negotiable · **SEC 2** (Certicom, 2010) defines secp256k1
vs secp256r1 as *different curves*; **Koblitz (1991)**, *CM-curves with good cryptographic
properties* — the lineage `eck256` is named for · **TCG Algorithm Registry v2.0** (2025-07-28) — the
registry secp256k1 is absent from · **FIPS 140-3 / ISO-IEC 19790**, CMVP #5302 — a validation is a
statement about a *bounded algorithm set*, so **"more validated" and "more capable" are different
axes**; §2.1 is a specific instance · **Komlo & Goldberg (2020)**, *FROST* (SAC 2020) — the protocol
no recommended device implements · **Wuille/Nick/Ruffing, BIP-340** — NetHSM's `BIP340_Signature` is a
checked instance · **Hirschman (1970)**, *Exit, Voice, and Loyalty* — the discriminator §4.5 and §7.2
both run on · **Goguen & Meseguer (1982)** noninterference — the credential-scoping argument applied
to a signing oracle.

## Pointers

`docs/research/2026-08-14-open-source-hsm-and-fido-devices-…` (§1/§2/§4/§5 unchanged; §3 re-scored;
§6(3) revised) · `docs/research/2026-08-20-yubihsm2-mechanism-enumeration-…` (the measurement this
builds on) · `tools/setup/persona-keys/frost-hardware-probe.ts` (the SEP / no-button facts) ·
`tools/setup/persona-keys/frost-partial-signer.ts` (§7.4 extends its finding to NetHSM) ·
`docs/inventory/hardware-to-buy.md` (five corrections, §8) ·
`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` (exit-not-degree: excludes cloud KMS,
argues against the shared connector) · `.claude/rules/toy-is-free-metered-must-be-earned.md` (why
every row carries a register, not a bare yes).

---

### Verification note (Otto, landing this)

Two claims were re-checked independently before landing. **§2.1 confirmed verbatim** against
Yubico's live page: *"FIPS approved mode means the following algorithms are no longer available:
rsa-pkcs1-decrypt, rsa-pkcs1-sha1, rsa-pss-sha1, ecdsa-sha1, eck256."* **The NetHSM €11,898.81 price
could NOT be independently re-verified** — the shop page renders prices via JavaScript, so a plain
fetch returns the product line-up (NetHSM 2, Software Container, Replacement Service, Slide Rail) but
no figure. It stands as the author's **checked** claim with a URL, **not** as an Otto-confirmed one,
and §8's correction should be applied only after someone loads that page in a browser.
