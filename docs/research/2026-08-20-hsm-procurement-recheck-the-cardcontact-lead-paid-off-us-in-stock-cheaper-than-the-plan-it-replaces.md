# HSM procurement re-check: the CardContact lead paid off — US, in stock, $79.26, cheaper than the plan it replaces

**Mateo / security-researcher.** **Date:** 2026-08-20 (all liveness checked this date).
**Register key:** **measured** (artifact exercised) · **checked** (primary source, URL + date, read)
· **cited** (secondary only) · **unknown** (named, not omitted). Nothing rounded up.

> **Headline:** §7.2(a) of the landed re-score is dead — **but not primarily for the reason given, and
> the replacement is strictly better on every axis.** The core silicon is sold in the US, in stock,
> add-to-cart, at **$79.26** — cheaper than the €109 Nitrokey, same vendor-diversity value. **The
> shipping question turns out to be the less important of the two blockers.**

## 1. The shipping verdict: NOT VERIFIED as a shipping block — a different, harder blocker is confirmed

| Surface | What it says | Register |
|---|---|---|
| [HSM 2 product page](https://shop.nitrokey.com/shop/nkhs2-nitrokey-hsm-2-7) | Availability: **"By inquiry only"**. €109. Shipping block: *"Currently the delivery of devices containing a battery outside of the EU is temporary restricted."* | **checked** |
| [FAQ](https://www.nitrokey.com/faq) · [GTC](https://www.nitrokey.com/general-terms-and-conditions) · [News](https://www.nitrokey.com/news) | **No** US-specific entry, no export-control clause, no customs entry. Newest news item 2026-08-04, nothing about shipping or the USA | **checked** |
| [Support: "United States shipping costs"](https://support.nitrokey.com/t/united-states-shipping-costs/4607) | Staff: *"currently we are using UPS exclusively."* Complaints are about **cost, not refusal.** **Latest post 2026-04-15** | **checked** |

**Ruled out with evidence:** not an export-control block — no notice exists, mass-market crypto
tokens fall under the Wassenaar Cat. 5 Pt 2 exemption, and **CardContact's product is presently
sitting in a US warehouse, which falsifies that hypothesis directly.** Not a US-side restriction on
the class — Yubico ships YubiHSM 2 in the US today.

**Could NOT determine, stated plainly:** no public Nitrokey notice of a US shipping suspension. **I
did not run a checkout** — placing an order to probe the country selector is not something to do on
the owner's behalf.

**Three candidates, honestly ranked, none confirmed:**

1. **The battery banner, misread onto the wrong product (most likely).** That restriction is on
   **every** Nitrokey product page and genuinely blocks NitroPhone/NitroPad/NitroPC. **The HSM 2 has
   no battery** — it is a bus-powered CCID token — **so it should not apply.**
2. **"By inquiry only" read as unavailability** — also on the page, and a real blocker (§1.1).
3. **De minimis fallout.** Section 321 was suspended for all countries effective 2025-08-29 (EO
   14324), and from 2026-07-24 postal imports ≤$2,500 need a heavier entry process. **US-side, would
   hit every small EU direct-ship purchase** — the only cause that widens past Nitrokey. They ship
   **UPS, not post**, so it should route around it. **No evidence they suspended US orders.**

**The one-round-trip falsifier, cost zero:** email Nitrokey sales — they *are* the "inquiry" in "by
inquiry only" — for a quote on 3× shipped to a US address. **One message resolves stock and shipping
together.** Until then this stays **unknown**.

### 1.1 The blocker that IS confirmed, and it kills §7.2(a) on its own

> The Nitrokey HSM 2 is marked **"By inquiry only"** on the vendor's own page as of 2026-08-20.

**Independent of any shipping question, you cannot buy three at €109 off the shelf.** The landed
doc's Open Question #3 is answered: **by inquiry.** §7.2(a) — *"3× Nitrokey HSM 2 @ €109 ≈ €327"* —
**is not an executable purchase order.**

## 2. The lead paid off — CardContact via CardLogix, US, in stock, cheaper

CardContact's own reseller page names exactly one US distributor: **"CardLogix (US)"**
([smartcard-hsm.com/buy.html](https://www.smartcard-hsm.com/buy.html)). Machine-read from CardLogix's
JSON-LD product schema:

```
"name": "SmartCard-HSM 180K USB Token"    "brand": "CardContact"
"price": "79.26" USD  (list 92.96)        "availability": InStock
"seller": "CardLogix Corporation"
```

Rendered with **"Add to cart"**, not "Request quote". The bare **ID-1 card is $37.27–$39.27**.

**This is the same product family the Nitrokey HSM 2 wraps** — same vendor, same applet, same OpenSC
driver. **Register: checked**, and deliberately *not* stated as "identical silicon", which was not
verified.

**secp256k1 evidence — three independent sources, none of them Nitrokey:**

1. **Vendor primary:** *"The SmartCard-HSM has build-in support for the secp256k1 Elliptic Curve, the
   cryptographic algorithm used by Bitcoin."* ([applications.html](https://www.smartcard-hsm.com/applications.html))
2. **Source code, machine-read.** OpenSC master `src/libopensc/pkcs15-sc-hsm.c`, `static struct
   ec_curve curves[]` — **line 199** carries OID bytes `2B 81 04 00 0A` commented `// secp256k1`
   (= 1.3.132.0.10), with full prime/A/B/basepoint/order/cofactor beside it, **because the
   SmartCard-HSM takes explicit domain parameters via CVC rather than a named-curve identifier.**
   Register: **checked (source read)**, not measured.
3. Reseller description lists "Bitcoin Wallet" — weakest, **cited** only.

**Class 1 confirmed:** CCID/PKCS#11 User PIN, **no button, no user-presence element exists.**

**Throughput — the landed doc's Open Question #2, now answerable:** ECDSA-256 ≈ **80 ms/op without
hashing (≈12 ops/s)**; ≈125 sig/min with on-card SHA-256 over 1 KB. **The relevant figure is 12 ops/s,
because the x402 path already hashes keccak256 off-device and submits a 32-byte digest.**
**Verdict: throughput is not the binding constraint at agent payment rates.** It would be at
web-scale; it is not here.

**Residual risk, named:** the 180K variant's **applet version** is not stated on the CardLogix page,
and secp256k1 tracks it. **Falsifier before money moves:** ask CardLogix for the SmartCard-HSM
software version (want 4.x), or on arrival run `pkcs11-tool --list-mechanisms`. **Do not treat a
datasheet as an enumeration.**

## 3. NEW FINDING — the FIPS/secp256k1 collision reproduces on a second, independent vendor

Machine-read from Entrust's own **Application Notes: nShield Support for Cryptographic Algorithms,
02 June 2026** ([PDF](https://nshielddocs.entrust.com/app-notes/nshield-support-for-cryptographic-algorithms.pdf)),
§5.4/§5.5, the "ECC domain parameters" row:

| Feature | Unrestricted | **FIPS 140 Level 3** | CC CMTS |
|---|---|---|---|
| ECC domain parameters | *(no restriction)* | **"224 minimum; SECP256K1 forbidden; non-named curves forbidden"** | *(blank)* |

> **This is genuinely independent corroboration.** Yubico's `eck256`-disabled-in-FIPS and Entrust's
> `SECP256K1 forbidden` are **two different vendors, two silicon families, two documents** — saying
> the same thing. **The collision is not a Yubico quirk; it is what a FIPS 140-3 approved-algorithm
> set does to a non-NIST curve.** The landed §2.1 promotes from vendor-specific to **structural**.

**And one correction to the record:** a secondary source claimed secp256k1 is forbidden in *both* FIPS
L3 and CC CMTS. **The primary PDF's CMTS column is blank** — unrestricted. **The secondary was wrong.**

## 4. Monoculture — answered plainly

**You do not have to buy more YubiHSMs, and you should not.** The monoculture escape survived the
Nitrokey problem intact, because **the thing supplying vendor diversity was never Nitrokey** —
Nitrokey resells CardContact's applet on NXP JCOP. **The reseller became unreachable; the diversity
did not.**

| Plan | 3 nodes | Silicon vendor | Availability |
|---|---|---|---|
| 3× YubiHSM 2 | **$1,950** | Infineon (all three) | purchasable |
| 3× Nitrokey HSM 2 (landed §7.2a) | ~€327 | NXP JCOP | **by inquiry** |
| **3× SmartCard-HSM 180K via CardLogix** | **$237.78** | **NXP JCOP 3** | **in stock, US** |

**$1,712 cheaper than the monoculture, and cheaper than the plan it replaces**, while keeping a
genuinely different secure-element vendor. **If it had come out the other way the answer would have
been "buy more YubiHSMs." It did not.**

### 4.1 EUCLEAK, worked — and it kills the mitigation people reach for first

**CVE-2024-45678 / YSA-2024-03** — ECDSA key extraction by EM side channel, non-constant-time modular
inversion. Affects **YubiKey 5 < 5.7.0 and YubiHSM 2 < fw 2.4.0**.

> **The vulnerable component was the Infineon cryptographic library, not Yubico's firmware.** It sat
> **below** the firmware-version boundary, spanned two entirely different product lines
> simultaneously, and survived **~14 years and roughly 80 top-tier Common Criteria evaluations.**

**Therefore "different firmware versions across units" would not have helped.** A fleet on 2.3.1,
2.3.2 and 2.3.4 was **uniformly vulnerable**, because the flaw was in a component all three shared
and none of them versioned. Worse, holding units back on older firmware means **deliberately
retaining known-fixed bugs** — scored **net negative**.

| Mitigation | Works? | Cost |
|---|---|---|
| **Different silicon vendor** (NXP vs Infineon) | **Yes — the only one that defeats EUCLEAK-class events** | **$237.78, and it is also the cheap option.** No principle-vs-constraint tradeoff at all |
| Different firmware versions | **No** — defeated by the worked example, and ships known-vulnerable units on purpose | Negative |
| Separate purchase batches / lots | **Partially** — defends against interdiction and one bad lot; nothing against a design flaw | Free |
| **Ceremony device separate from signing devices** | **Yes — highest-value free control on the list.** A compromised signer must not reach the device holding root/wrap authority | Free |

**Honest limit:** mixing vendors doubles the toolchain (`yubihsm-shell` **and** OpenSC), doubles the
advisory feeds, and means two failure modes to learn. **That cost is paid in attention, which this
fleet is shorter on than money.**

## 5. Adversarial verdict — treasury-on-Coldcard / float-on-HSM

### 5.0 Dead on a fact before the security argument

> **Coldcard MK4 and Coldcard Q are Bitcoin-only. They cannot hold USDC.** Jade Plus likewise
> (Bitcoin/Liquid).

x402 settles **USDC via ERC-3009 on an EVM chain.** Of the owned devices, **only the Trezor and the
Ledger Nano S Plus** can custody an ERC-20 treasury. **Not a quibble — the proposal names a device by
name and that device cannot hold the asset.**

### 5.1 Bounds per-incident loss. Does NOT bound total loss.

By construction of Class 1 the daemon holds the auth credential, so an attacker who owns the host
gets an authenticated session. And then:

> **The YubiHSM signs 32-byte digests. It has no policy engine, no transaction parser, no notion of a
> recipient or an amount.** It cannot distinguish an EIP-712 digest paying $0.001 for an API call
> from one paying the entire float to the attacker.

**So the failure mode is not "the float is drained in small amounts between refills." It is: the
entire float leaves in one transaction, within seconds of compromise, and again within seconds of
every refill.** Any per-signature reasoning about amounts happens on the compromised host and is
worth nothing.

**Per-incident loss ≤ float** — genuine, and the difference between losing $50 and losing the
treasury. **Total loss = float × refills-before-detection.** The bound on the quantity anyone cares
about is set entirely by **detection latency**, and **the design contains no detector.**

### 5.2 The human approval is a rubber stamp BY CONSTRUCTION, not by human weakness

> **The refill request carries zero information about the thing being defended against.** *"The float
> is empty, top it up?"* looks **byte-identical** whether the float went on 4,000 legitimate x402
> calls or one theft. **There is no signal a maximally attentive human could read to tell them apart.**

An approval gate whose input cannot discriminate the attack from normal operation is **the vacuity
class in operational clothing** — a check that cannot fail. **Degradation into a rubber stamp is the
correct behaviour given the information presented; blaming the human would be blaming them for not
hallucinating evidence.**

To make it real the human must see a **reconciliation, not a request** — expected outflow vs actual
on-chain outflow. But the agent's record lives **on the compromised host**, so the attacker edits it.
**Reconciliation is only meaningful if the expected-spend side comes from off-host, independently
attested evidence.** That is buildable, it is what would make this design work, and **it is not what
"human approval to refill" currently means.**

### 5.3 Needs an on-chain mechanism — and x402 structurally cannot provide one yet

- **An EOA cannot be velocity-limited.** ERC-3009 is authorised **solely** by the signature — no hook,
  no allowance, no cap, no destination allowlist. **A hot EOA's authority is exactly its balance**,
  which is why capping the balance is the only operational lever available.
- **The real mechanism exists and is standardised:** a modular smart account (ERC-7579 / Safe7579)
  with a session-key validator + SpendingLimitHook enforces caps, allowlists and expiry **in code the
  host compromise cannot reach.**
- **The catch:** x402 today is EOA-shaped — *"this model does not fully support smart contract
  wallets, meta-transactions, account abstraction flows"* — with an **open, unmerged** feature request
  ([coinbase/x402#639](https://github.com/coinbase/x402/issues/639)). **Falsifier: name the facilitator,
  read its accepted-payload spec.** Do not build on the assumption.

### 5.4 Verdict

> **Not killed. Demoted** — from *"the control that bounds loss"* to *"a cheap cap on blast radius
> that does not bound total loss and whose approval step is currently uninformative."*

Ship it, because it is free and the devices are owned — but **labelled honestly**, and **do not let
it be counted as the off-host velocity limit** the connector doc identifies as the only real control
under host compromise. **It is a smaller bucket, not a valve.**

Three things would make it real, ascending cost: **(1) an independent detector** comparing on-chain
outflow against an expected-spend feed that does not originate on the signing host — *the single
highest-value unbuilt piece in the whole design*; **(2) priced refill discipline** — a hard stop after
N refills in a window that forces a look rather than a click; **(3) a smart account with an on-chain
spending-limit hook** — the only thing converting *"we chose to keep the float small"* into *"the key
cannot spend more than X per period."*

**And one thing that must not happen: the ceremony/treasury device must never be the signing device**,
and the approval gate must never be reachable from the signing host. If one machine holds the hot
credential and can also initiate and approve the refill, **the entire structure collapses to a single
compromise.** That constraint is free, and it is the one part defended without qualification.

## 6. Corrections owed to the landed re-score

1. **§7.2(a) — replace.** 3× Nitrokey @ €109 → **3× CardContact SmartCard-HSM 180K via CardLogix @
   $79.26 = $237.78.** Same applet, same driver, same silicon family, lower price, no shipping
   question, no inquiry gate.
2. **§3 availability resolved** → **"By inquiry only."** Open Question #3 closes.
3. **Open Question #2 closes at `checked`** — ≈12 ops/s, **not** the binding constraint.
4. **§2.1 promotes to structural** — Entrust's own note says **"SECP256K1 forbidden"** under FIPS
   140 L3. Note the CC CMTS column is **blank**, so a secondary claiming otherwise is wrong.
5. **§4.4 factual correction.** True of the *curve*, misleading about *the asset*: **Coldcard and
   Jade are Bitcoin-only and cannot custody USDC.**
6. **New §7.4 limit.** **The HSM signs digests and cannot see amounts or recipients**, so
   `--capabilities sign-ecdsa` on a single domain still authorises signing away the entire balance of
   whatever address that key controls.

No device touched. No secret, key, PIN or credential read, printed or handled. `op` not invoked.
