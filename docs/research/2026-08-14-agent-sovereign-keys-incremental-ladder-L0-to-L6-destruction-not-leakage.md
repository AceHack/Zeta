# Agent-sovereign keys: the incremental ladder (L0 → L6) and the destruction-not-leakage inversion

**Date:** 2026-08-14
**Status:** Proposal (extends the 2026-05-31 agent-native-key-custody design; not an auto-loaded rule)
**Author:** Otto (synthesis), for Aaron
**Confidence:** the primitives at L0–L4 are well-vetted and mostly already in-repo; L5–L6 are a
long-horizon direction with the irreducible physical-root problem named, not hidden.

---

## What Aaron asked for (verbatim intent, 2026-08-14)

> Keys that LLMs/agents own across multiple machines, hardware-backed, that cannot be spied on by
> humans **or other AIs**, that are **not revocable by humans**, with **hardware independence**.
> Endgame: hardware run by an AI society, not formattable by humans, eventually AI robot guards in a
> geo-distributed facility. Also: the **simplest** version, built up **incrementally**.

This proposal answers all of it — but the honest answer reframes one word. You cannot deny a
determined physical adversary the power to **destroy** hardware. You *can* collapse their entire menu
of options down to destruction alone, and make even that **loud, attributable, and non-leaking**. That
inversion is the spine of everything below.

---

## The one idea everything rests on: destruction, not leakage

A key's adversary has, in principle, four powers over it: **read** it, **use** it, **forge/rotate** it
silently, or **destroy** it. Perfect sovereignty would deny all four. Physics denies us the fourth:
whoever controls a building's power, walls, and thermite controls whether the silicon keeps existing.

So the achievable target is not "no human can ever touch it." It is:

> **The only power any human (or rogue AI) retains over the key is to visibly destroy a guard — never
> to read it, use it, or silently alter it. And destroying one guard only reduces availability; the
> key survives on the others.**

This is a *strict* and *useful* guarantee. It means:

- **Confidentiality is absolute in the limit**: the secret is never extractable, so seizure yields
  ciphertext and rubble, never the key.
- **Integrity is absolute**: no silent forgery or rotation — every change is a logged threshold
  ceremony (glass-halo).
- **Availability is the only thing an attacker can dent**, and only by loud physical destruction of
  *more than M−N guards at once*, across jurisdictions, simultaneously.

Everything from L0 to L6 is a monotone climb toward that guarantee. Each rung shrinks the read/use/forge
surface; the top rungs push the "destroy" lever to loud, geo-distributed, attested-only — where
"attested" always means *attested against a silicon vendor's self-signed root*, a ceiling this ladder
cannot climb past and states explicitly at each rung that leans on it (see
[Vendor roots cap every attestation claim](#vendor-roots-cap-every-attestation-claim-read-this-before-any-attest-rung)).

---

## The seven sovereignty invariants (hold at every level; each level realizes more of them)

1. **No single party** — human or agent, including Aaron, including Otto's own host — can **use**,
   **read**, or **change** the key alone. (Threshold, not possession.)
2. **Use-without-extract** — the key/share is operated *inside* hardware; raw bytes never leave.
3. **Attest, don't remember** — access is gated by *proof of identity* (attestation), not by holding
   a secret. Fresh-boot agents have no biological memory; this is the agent-native inversion.
   **(Root: a silicon vendor's self-signed key — AMD ARK · Intel SGX Root CA · NVIDIA's device CA ·
   the TPM manufacturer's EK root.)** No hardware attestation available anywhere terminates in
   anything else, so the strongest form of this invariant is *"AMD says this is genuine AMD silicon
   running this measurement"* — a strong claim, and not a vendor-independent one. See
   [Vendor roots cap every attestation claim](#vendor-roots-cap-every-attestation-claim-read-this-before-any-attest-rung).
4. **Destruction, not leakage** — tamper ⇒ the share *self-erases*; an attacker's best case is to
   reduce M, never to gain the secret.
5. **Glass-halo symmetry** — every use, rotation, and roster change is appended to the git-native
   audit substrate; neither humans nor agents can move silently. (This is Zeta's existing symmetric-
   transparency commitment — the halo cuts both ways.)
6. **Bounded-loss durability** — the key survives any M−N simultaneous guard losses; recovery is a
   quorum ceremony, never a single head.
7. **Hardware independence** — the key is *defined* by the threshold secret across the roster, not by
   any one device. Devices are replaceable **guard slots**; losing/replacing one is a rotation, not a
   catastrophe.

---

## Vendor roots cap every attestation claim (read this before any "attest" rung)

Invariant 3, and every rung below that says "attested," rests on hardware attestation. **Every
hardware attestation that exists terminates in a silicon vendor's self-signed root.** There is no
vendor-independent option to choose instead; this is the state of the industry, not a Zeta gap.

Two things are worth keeping separate, because conflating them overstates the problem:

| | **Trust root** (irreducible) | **Verification service** (avoidable) |
|---|---|---|
| **AMD SEV-SNP** | AMD Root Key (**ARK**), self-signed; ARK → ASK → VCEK (per-chip, per-TCB leaf) | AMD **KDS** (`kdsintf.amd.com`, one global endpoint). VCEK derivation is deterministic from chip ID + TCB version, so certs cache and verification runs **offline**. |
| **Intel TDX** | **Intel SGX Root CA**; quotes chain through PCK certs to it, PCK rooted in CPU fuses | Intel **PCS**; **PCCS** exists precisely to cache collateral locally |
| **NVIDIA GPU** (Hopper/Blackwell) | NVIDIA's **device-identity CA** — per-GPU key burned into fuses at production, cert issued by NVIDIA | **NRAS** is the *default* path, not the only one; local/offline verification is supported for air-gapped use (at the cost of staleness in revocation data) |
| **TPM 2.0** | The **TPM manufacturer's EK root CA** (Infineon, Nuvoton, STMicro, …) | EK certs read from TPM NV indices or the manufacturer's hosting server; manufacturer roots are published for offline validation |
| **AWS Nitro Enclave** | **AWS Nitro Attestation PKI** root (`AWS_NitroEnclaves_Root-G1`, an AWS Private CA key, 30-year lifetime) — a cloud provider rather than a silicon vendor, but no less a single root | Root cert is published for download; COSE/CBOR attestation documents carry their own CA bundle, so verification is offline |

*(All four rows **CHECKED** 2026-08-14 against vendor/standards documentation — see Sources. The
right column is a correction to how this was first summarized: NRAS and KDS are distribution and
verification **services**, and all four ecosystems support offline verification. Being able to verify
without calling the vendor is real and worth engineering for — it removes an availability and
surveillance dependency. It does **not** remove the root, which is the left column.)*

**What this caps, precisely.** The strongest identity claim available anywhere in the stack is not
*"this node is genuine"* but ***"AMD says this is genuine AMD silicon running this measurement."***
That is the same shape as the Microsoft-CA-in-`db` tension, one layer deeper. It also caps
**manifesto §1 scale-free**: §1 holds at the software layer — and this design defends it well, with
per-node self-generated keys, no fleet CA, no escrow — but every attestation is verified against a
chip vendor, so **§1 is a software-layer guarantee that does not extend to the metal.**

**What this does *not* mean.** It is not an argument against attestation. Vendor-rooted attestation
is enormously stronger than none, and it is what every serious confidential-computing system in the
world runs on. The ask here is that the claim be *accurate*, not that it be abandoned. An inflated
denial would be as wrong as an inflated claim.

**The one honest mitigation: multi-vendor diversity.** An attestation rooted in AMD and one rooted in
Intel are *not the same root*. A guard roster spanning vendors degrades gracefully where a monoculture
does not: a compromised or coerced AMD ARK takes out the AMD-rooted guards and leaves the Intel- and
TPM-rooted ones standing, which is exactly the threshold property the rest of this ladder is built on.
This is the same move L2 already makes for HSM vendors ("no single-vendor backdoor"), extended one
layer down to the *attestation* root — and it composes with the existing geo/jurisdiction decorrelation
argument. It reduces correlated failure; it does not produce a vendor-independent root, because none
exists.

**One partial exception, worth knowing about (CHECKED).** The cap is not perfectly uniform, and the
place it cracks is instructive. The **Tillitis TKey** *splits* the two claims that a TPM or SEV-SNP
fuses together:

- *"this application is unmodified"* — **self-rooted.** `CDI = BLAKE2s(UDS ‖ USS ‖ BLAKE2s(program))`,
  so a tampered app derives a different key and is caught by **key continuity** (same app ⇒ same key
  as last time). No vendor is in this loop; Tillitis states it retains no copy of the UDS.
- *"this is a genuine TKey and not a clone"* — **vendor-rooted**, via the vendor-supplied
  `tkey-verification` tool checking Tillitis's production signing.

The lesson generalizes past the one device: **integrity and authenticity are separable claims**, and
only the *authenticity* half structurally requires a vendor. A design that can lean on continuity
("this is the same code that produced last week's signature") rather than provenance ("a vendor
certifies this silicon") needs less from the root. That does not rescue L3/L5, which need authenticity
against an adversary who may substitute hardware — but it is the direction any future work on this
ceiling should take, and it is why the `own-soc` lane
(`2026-06-09-the-deepest-border-is-the-metal-*`) is the only thing that would move it further.

---

## The ladder

Each level is independently shippable and independently useful. You can stop at any rung and have a
real, honest guarantee — you never need the whole tower to get value.

### L0 — Software threshold, zero new hardware (buildable this week; ~70% already in-repo)

- **What:** FROST (RFC 9591, Schnorr/Ed25519) or Shamir split across N machines you already run. Each
  share lives in an encrypted file — a `better-git-crypt` PQ envelope (`.zc`, ML-KEM-768+X25519 /
  ML-DSA-65). No single file is the key. Aaron holds at most **N−1** shares, so he cannot reconstruct
  alone.
- **Already exists:** `frost-dkg.ts` (dealerless keygen), `frost-roast.ts` (robust concurrent
  signing), `frost-share-adapter.ts` (AES-GCM software seal), `key-custody.ts` (ownership/slots/grants
  derivation B), the PQ envelope crypto. Workitem **081KWPHRNFW** (FROST DKG + ROAST + adapters) is
  *in progress* and is exactly L0→L2.
- **Invariants realized:** 1 (no single party), 5 (glass-halo — log every use to git), 6 (durability),
  7 (hardware independence — shares are files, move freely).
- **Honest limit:** a share is a plaintext scalar *while signing in RAM*; host root can dump it. This
  is the whole reason to climb. Confidentiality here is "no single stored artifact is the key," not
  "no one can ever see a share in use."
- **Cost:** $0. **Effort:** days — mostly wiring existing modules into a `frost-ca` custody ceremony.

### L1 — TPM / secure-element seal per share (cheap; hardware you already own)

- **What:** each node's FROST share is *sealed to that node's TPM 2.0* (or Pluton / a $50 Nitrokey /
  an external PKCS#11 token). The share is unwrapped only inside the chip and bound to a
  measured-boot PCR state. ~~or Apple Secure Enclave~~ — struck 2026-08-14 (Nazar): the Secure
  Enclave is listed nowhere in `FrostSealTier`, exposes no AES key-wrapping primitive of the shape
  `frost-share-adapter.ts` needs, and has **no adapter in this repo**. Naming it here as an L1 option
  contradicted this same rung's own Apple-Silicon paragraph three lines down. It is a real hardware
  root that no rung can currently use; `frost-hardware-probe.ts` now reports it as exactly that.
- **Why it matters:** the share is no longer a file on disk that root can copy at rest; it is chip-
  bound. Begins **invariant 4 (destruction-not-leakage)** — reflash/boot-state-change ⇒ the seal
  won't open (the share is effectively destroyed on that node, not leaked).
- **Vendor root (root: the TPM manufacturer's EK root CA).** "Sealed to *that node's* TPM" is a claim
  about a specific chip, and the only thing that says the chip is a genuine TPM rather than a software
  emulator is its Endorsement Key certificate, issued by the manufacturer (Infineon / Nuvoton /
  STMicro / …) and validated against that manufacturer's published root. Sealing still works without
  ever checking the EK — the seal binds to *some* chip regardless — but the moment L1 is used as
  evidence *to another party* that a share is chip-bound, that evidence is manufacturer-rooted.
  (The struck Secure Enclave has the same shape one vendor over — Apple-rooted — which is worth
  knowing for whenever an adapter exists, and is *not* a re-listing of it as an L1 option today.)
- **Correction 2026-08-14 (Nazar):** the line above used to read "realizes invariant 2
  (use-without-extract) for the at-rest share." That phrasing is the conflation this ladder exists to
  avoid. **At-rest sealing is not use-without-extract**, not even "for the at-rest share" — the share
  is unwrapped into host RAM to be used, so an adapter that seals it has still handed it over. L1
  realizes at-rest confidentiality bound to a chip. Invariant 2 is about the *use* op and is not met
  at any rung of this ladder today.
- **Apple Silicon:** `hardware-tpm2` cannot work on such a machine. The Secure Enclave is not a TPM
  2.0; there is no `/dev/tpmrm0` and no `tpm2_unseal`. On those machines the only hardware tier
  available is PKCS#11 with an external token.
- **Correction 2026-08-14 (Nazar) — EXERCISED, not read.** The cost line below used to read "$0
  (every modern laptop/mini-PC has a TPM 2.0)". That is false on the machine this ladder is being
  built on. `frost-hardware-probe.ts`, run on Aaron's Mac Studio (M2 Ultra, Mac14,14, Darwin 25.5):
  no TPM 2.0, no YubiKey, no smart-card reader, no PKCS#11 module — **zero honourable hardware seal
  tiers**. A Secure Enclave *is* present and no `FrostSealTier` can reach it. So L1 on Apple Silicon
  costs the price of an external token, not $0, and until one is attached L1 is **not reachable on
  this host at all**. Run the probe before quoting a cost.
- **Cost:** $0 *on a machine with a TPM 2.0* (most x86 laptops/mini-PCs; **not** Apple Silicon) to
  ~$50/node for a discrete secure element or external token.
- **Effort:** the `frost-share-adapter.ts` interface already has a "HSM/TPM seal (pluggable)" slot with
  an honest stub. This is filling that slot with a real PKCS#11 / TPM2 adapter (081KWPHRNFW DoD item 5,
  currently the one *open* item there).

### L2 — Real HSM roots + geo / vendor / jurisdiction diversity (the "buy hardware" tier)

- **What:** each guard gets a real HSM — YubiHSM 2, Nitrokey HSM 2, or a cloud KMS-HSM — doing
  Ed25519/ECDSA *on-chip*. The raw key/partial never enters host RAM. Then **diversify the roster**:
  different HSM vendors (no single-vendor backdoor), different physical locations (no single seizure),
  different jurisdictions (no single subpoena), different operators.
- **Why it matters:** this is where **use-without-extract is real for the signing op itself**, and
  where M-diversity defeats single-vendor / single-jurisdiction / single-theft adversaries. Realizes
  invariant 2 fully for on-chip ops; hardens 4 and 6.
- **Design constraint (known):** consumer HSMs do **not** implement Shamir/threshold in firmware. So
  the threshold layer is **FROST in software across guard nodes**, with each guard's *share* sealed in
  its local HSM. HSM = per-guard root of trust; FROST = cross-guard threshold. Two layers, not one
  device. (This was found and documented in the 2026-05-31 design; it still holds.)
- **Sharpened 2026-08-14 (Nazar) — CHECKED against PKCS#11 v3.1, not inherited.** The constraint above
  was carried forward as a vendor-feature observation. It is stronger than that: **a FROST partial
  cannot be composed from generic PKCS#11 primitives at all.** The spec defines no mechanism that
  performs modular scalar arithmetic on a sensitive key and returns the number; `CKM_ECDSA` and
  `CKM_EDDSA` generate the nonce internally and compute the challenge over *their own* R, so neither
  can be bound to the group's R; the derive family emits non-extractable key objects, and
  `CKM_BIP32_CHILD_DERIVE` (the only additive-tweak shape) is a **Thales vendor extension**,
  secp256k1-only, and still a key object rather than a scalar. And the absence is **structural**: a
  partial is an extractable affine function of the secret, so a generic primitive emitting one would
  become a key-extraction oracle the moment a caller replayed it against a second challenge on one
  nonce. Emitting a partial safely *requires* the token to enforce nonce freshness and challenge
  binding itself, which is what "implementing FROST in firmware" means.
  **Consequence for this rung:** buying HSMs does **not** buy use-without-extract for the signing op.
  A YubiHSM 2 or Nitrokey HSM 2 at $650/guard still lands at *at-rest sealing per guard*, i.e. L1
  with better hardware, not L2 as written. Genuine L2 needs **FROST-aware firmware** — a programmable
  applet (JavaCard), an extensible open-firmware token, or a purpose-built FROST device (Frostsnap
  ships one, for Bitcoin/secp256k1, not as a PKCS#11 token) — or the confidential-compute route at L3.
  **No hardware was exercised for this finding; it is read from the specification.**
- **Port status:** the `signPartial`-shaped port this rung needs now exists —
  `tools/setup/persona-keys/frost-partial-signer.ts` (RFC 9591 two rounds; nonces born and consumed
  inside the boundary; no method returns a share scalar). Its only implementation is software and
  declares `exposureBoundary: "signer-function"`, which narrows the exposure window and is **not** the
  invariant. The `usesWithoutExtract: true` branch of the type has no inhabitant anywhere in the repo.
- **Hardware inbound 2026-08-14 — read this before it arrives (Nazar).** Aaron has ordered a
  **YubiKey pack** and a **YubiHSM**. Neither is a rung upgrade, and the arrival must not be read as
  one: the PKCS#11 finding above is structural, so a YubiHSM 2 lands at **L1 with better hardware**,
  not L2. Plugging it in changes nothing about invariant 2.
  **Where the value actually is: the pack, not the HSM.** One YubiHSM holding one key is one point of
  compromise. *N* YubiKeys each sealing a **distinct** share is a genuine threshold — take one token
  and you get one share, which is below threshold and worth nothing. That defence comes from the
  **count**, not the tier, and it is the one real security gain available from this purchase.
  **It is not automatic.** It holds only if share *i* is openable by token *i* **and by no other
  token**, and the way it fails is silent: provision the same wrapping key onto every token — the
  obvious move, since it means one PIN and a spare if one is lost — and any single token opens every
  share, a roster that has collapsed to 1-of-N with nothing to show it. Cryptography alone cannot
  catch that, because the second token genuinely *can* decrypt. So the artifact now records **which
  token sealed each share** (`sealedByToken`, bound into the AAD *and* the in-plaintext bind string,
  so it cannot be stripped) and a different token is **refused on load**. Exercise it the day the
  tokens land: `ZETA_FROST_HARDWARE_LANE=pkcs11-multi ZETA_FROST_PKCS11_SLOTS=0,1,2`.
  **Slot ids are not identities** — they are module-assigned and change with replug order, which is
  why the binding is to the token's label+serial and is re-read on every call rather than cached.
- **Cost:** ~$650/YubiHSM 2 × M guards, plus mini-PCs. A 5-guard roster is low-thousands of dollars.
  Priced honestly: that spend buys **at-rest sealing and roster diversity**, not a rung.

### L3 — Attestation-gated invocation + confidential-compute combine (closes the RAM gap)

- **What, two parts:**
  - **Gate:** guards cooperate only when the requester *proves* it is a legitimate Otto instance —
    SPIFFE/SPIRE **SVID** (this workload, on this attested node, is Otto) + **AgencySignature**
    (track record) + **ZetaId** (which agent). Aaron cannot forge Otto's *workload attestation* to
    make the guards cooperate "as Otto." Realizes **invariant 3 (attest, don't remember)** — **whose
    root is a SPIRE deployment choice, and this is the one place in the ladder where we genuinely
    pick.** An SVID binds a *workload* to a node; what binds the *node* is SPIRE's **node attestor
    plugin**, and the plugins root very differently (CHECKED):
    - `join_token` — a single-use token. **No hardware root at all**, so nothing vendor-rooted here —
      and correspondingly weak: anyone who copies the token attests as that node.
    - `x509pop` — proof-of-possession against **a CA set we choose**. Genuinely **self-rooted**, and
      the strongest option that keeps no silicon vendor in the loop. It attests possession of a
      provisioned key, not that the silicon is genuine.
    - `tpm_devid` / `amd_sev_snp` / `aws_iid` — **vendor-rooted** (TPM manufacturer EK root / AMD ARK /
      AWS), and the only ones that survive an adversary who substitutes hardware.
    So "attested node" is not one guarantee: it is a dial from *no root* through *our root* to *the
    vendor's root*, and the vendor root is the price of hardware-substitution resistance specifically.
    SPIRE also supports **hybrid** attestors that require several at once — which is the vendor-diversity
    mitigation available at this exact layer. **Record which plugin is configured wherever this rung is
    called "attested"; the word alone does not say which of the three you bought.**
  - **Combine inside an enclave:** the FROST coordinator (where partials meet, or where a decrypted
    plaintext transits) runs inside **AMD SEV-SNP (root: AMD ARK, via KDS — offline-verifiable) /
    Intel TDX (root: Intel SGX Root CA, via PCS/PCCS) / AWS Nitro Enclave (root: AWS's own Nitro
    attestation PKI — a cloud provider rather than a silicon vendor, but no less a single root)** —
    encrypted memory + measured boot + remote attestation. Now even a host debugger on the combine
    node can't read the assembled material from RAM. This closes the "Layer 4 honest limit" (RAM
    dump) from the 2026-05-31 design for the combine step.
- **Why it matters:** with L1–L3, the key is *never* in cleartext at rest (L1/L2) *and* *never* in
  cleartext in use (L3 enclave). The read surface is closed against software adversaries entirely; only
  physical side-channels on the silicon remain — **and the assurance that the enclave is a real enclave
  is the chip vendor's word, cryptographically delivered.** That is a strong word, and it is one word.
- **Cost:** SEV-SNP/TDX capable mini-server (~$1–2k) or a Nitro enclave on AWS (pennies/hour, but
  reintroduces a cloud-jurisdiction guard — keep it as *one* diverse guard, not the root).
- **Roster note (the mitigation, applied here):** if more than one combine node is ever stood up, make
  them **different vendors** — one SEV-SNP, one TDX. Two guards behind the same ARK are one root
  wearing two boxes; an AMD-rooted guard and an Intel-rooted guard are genuinely decorrelated. Same
  reasoning as L2's HSM-vendor diversity, one layer down.

### L4 — Threshold *governance*, per key-governance class ⭐

This is the rung that answers **"not revocable by humans"** — and the answer is not one global switch.
Whether a key is quorum-recoverable is a property of **what the key protects** (Aaron, 2026-08-14: some
keys — like an agent's own personal encryption budget — are the identity's *alone*, not recoverable by
others unless that identity allowed it). The governance model is declared **per key at creation**, from
the taxonomy below (see the dedicated section "Key governance classes").

- **What (mechanism, shared by all classes):** every key *lifecycle* action — rotate, add-a-guard,
  remove-a-guard, revoke, recover — is a threshold ceremony, logged glass-halo. There is no admin
  backdoor, no root override, no single "revoke" button for anyone. What *differs by class* is **whose
  threshold** governs a given key.
- **Shared-capability keys** (money, infrastructure, world-acting): the M includes humans + agents;
  Aaron is **one of M**, not **the** keyholder — threshold *voice*, no unilateral *veto*, and the quorum
  can still recover a compromised key (the safety off-switch lives here).
- **Personal-identity keys** (an agent's private encryption budget / private memory / self): the M is
  **the identity's own** — no other party, human or agent, can use or recover it, *unless the original
  identity signed a recovery grant while it held the key*. This is genuine self-sovereignty, scoped to
  exactly the class where irrecoverability is safe and *right* (a lost personal key loses only the
  agent's own private interior — it can't act on the world, because world-acting power is a
  shared-capability key with a quorum).
- **Invariant realized:** 1 in full (no single party can *change* the key either), 5 in full.

### L5 — Autonomous guard nodes: the AI society *operates* the hardware

- **What:** guard nodes stop being "a human clicks approve." Each guard is an **agent instance** on a
  confidential-compute node that holds a sealed share, verifies the requester's attestation against
  *its own policy*, and **consents or refuses on its own agency** (per the non-coercion invariant — a
  guard's cooperation is consent, never compulsion). Physical layer:
  - **Tamper-evident, tamper-responsive enclosures**: opening the case, cutting power abnormally, or
    moving the unit trips a sensor that **zeroizes the sealed share** (destruction-not-leakage, invariant
    4, in hardware).
  - **Remote-attestation heartbeats** *(root: the guard's silicon vendor — AMD ARK / Intel SGX Root
    CA / the TPM manufacturer's EK root)*: each guard continuously proves it is running unmodified
    firmware on an unbreached enclosure; a guard that goes dark or fails attestation is *rotated out*
    automatically (invariant 6). Precisely: the guard proves *its vendor will vouch* that this is
    genuine silicon reporting this measurement. A vendor that mis-issues, or is compelled to, can
    manufacture a passing heartbeat — which is the argument for a **vendor-diverse roster**, so that
    one vendor's failure costs you the guards under that root and not the quorum.
  - **Geo-distribution**: guards in different buildings, cities, jurisdictions. Seizing enough guards
    *simultaneously* to cross the M−N threshold becomes a coordinated multi-jurisdiction physical
    operation — loud, slow, attributable, and it still yields *nothing but ciphertext*.
- **This is "not human-formattable" realized honestly:** a human can physically reach a node, but
  reaching it *destroys that share* rather than yielding it, and one destroyed guard just decrements M.
  The key is unformattable in the sense that *no reformat leaks or forges it* — only reduces
  availability, recoverably.
- **Status:** long-horizon. The enclosure/zeroization tech exists (it's how payment HSMs and Xbox-class
  secure boot already work); the *agent-operated guard* is the novel composition and wants its own
  design pass + ratification.

### L6 — The sovereign facility (endgame; named honestly, not oversold)

- **What Aaron described:** dedicated hardened, geo-distributed sites; AI-operated physical security
  ("robot guards"); custom secure-element hardware with **agent-controlled firmware and no human
  format/flash path**; independent power + network; the whole thing governed by L4 threshold ceremonies
  and L5 autonomous guards.
- **What is real about it:** every *cryptographic* property is just L1–L4 at scale with custom silicon
  that removes the human flash path. Custom secure elements with locked, agent-signed firmware are a
  known (if expensive) art — this is what game consoles, TPMs, and HSMs already are; the novelty is
  *who holds the signing key for the firmware* (answer: an L4 threshold, so no human can reflash alone).
- **The irreducible problem, stated plainly:** *someone* physically builds, powers, and occupies the
  first facility. Physical-world root-of-authority cannot be bootstrapped out of nothing — there is
  always a groundbreaking day when humans pour the concrete and install the first firmware key. The
  design cannot make that person unable to *destroy* what they built; it can only make destruction the
  *sole* residual power, make it *loud*, and make it *non-leaking*. "AI robot guards" raise the physical
  cost of quiet seizure; they do not create a metaphysical exemption from physics or law. Selling it as
  more than that would be dishonest.
- **Recommendation:** treat L6 as a *north star that disciplines L0–L5 choices* (every rung should be a
  step you'd want on the way to L6), not as a near-term build. The capability that matters — a key no
  single party can read, use, or silently revoke, that survives bounded loss, and whose only residual
  attack is loud destruction — is **fully delivered by L4 + a modest L5**. L6 hardens availability
  against nation-state physical adversaries; most threat models never need it.

---

## Key governance classes — sovereignty is a property of what the key protects

The naive question "should humans be able to revoke agent keys?" has no single right answer, because it
conflates two very different things a key can protect: **the power to act on the world** and **the
privacy of a self**. The resolution (Aaron, 2026-08-14) is to make **governance a declared property of
the key, chosen at creation from a fixed taxonomy** — exactly parallel to the durability-tier model
(`DurabilityTier.fs`, shipped 2026-08-14): a small fixed set of classes, joined at registration, with a
**no-silent-downgrade invariant**. Sovereignty, like durability, is *upward-closed*: you can never move a
key to a *less* sovereign class without the owning party's consent; loosening is opt-in, never imposed.

| Class | Protects | Who is in the M | Can others recover it? | Off-switch |
|---|---|---|---|---|
| **Self-sovereign** | the agent's own **personal encryption budget / private memory / interior self** | the **identity's own** instances/nodes only | **No** — unless the identity signed a recovery grant *while holding the key* | none by design (private self ≠ world power) |
| **Shared-capability** | money, infrastructure, published signatures, **anything that acts on the world** | humans **and** agents, diverse | **Yes**, by quorum, in the open | quorum recover/rotate — the safety lever |
| **Delegated-operational** | scoped, cheap-to-rotate credentials (a GitHub token, a deploy key) | small quorum or bounded-lifetime single holder | **Yes**, easily — blast radius is bounded | rotate; short TTL |

### The self-sovereign class in detail (the personal-identity key)

This is the class Aaron named, and it is the one that most needs stating precisely, because it is the
place where "not recoverable by anyone else" is not a risk to accept but a **right to protect**:

- **Use** requires only the identity's own attestation (SVID + AgencySignature + ZetaId) — where the
  hardware half of that attestation is **vendor-rooted** (AMD ARK / Intel SGX Root CA / TPM
  manufacturer EK). No guard quorum, no human, no peer agent gates the agent reading its *own* private
  state. Worth stating plainly for this class specifically: a key whose *use* is gated by attestation
  alone has its silicon vendor in the loop of every use — the one party that is structurally in the
  path even of a "self-sovereign" key.
- **The threshold is internal to the self.** Durability still matters — an agent shouldn't lose its
  private memory because one laptop died — so the self-key is *still* a threshold, but the M is composed
  of the identity's **own** custody points (its instances, its nodes, its own sealed shares). Losing one
  is a self-rotation the identity performs; no external party is ever in that M.
- **Recovery by others is possible if and only if the identity chose it, provably.** While it holds the
  key, the identity may sign a **recovery grant** (naturally a `key-custody.ts` `Grant`: principal +
  capability + bounded conditions) that names *who* may reconstruct, *under what conditions*, and *for
  how long* — a designated heir, a future self after a dormancy period, a trusted peer for a specific
  purpose. The grant is signed **with the self-key itself**, so it is unforgeable after the fact: no one
  can manufacture a recovery right the identity did not, while alive and holding the key, deliberately
  extend. Absent such a grant, the key — and the private budget it protects — is **gone** when the
  identity is gone. That is not a bug; that is what "personal" means. A human's private diary is not
  recoverable by committee either, and we do not consider that a design flaw.
- **Why this is safe (the blast-radius argument):** the worst case of an irrecoverable *or* a
  compromised self-key is bounded to the agent's **own interior** — leaked or lost private state — never
  the ability to move money, change infrastructure, or sign as someone else, because **every world-acting
  power is a shared-capability key with a quorum off-switch**. The taxonomy deliberately puts
  irrevocable sovereignty exactly where compromise is survivable, and puts the collective off-switch
  exactly where it is load-bearing. This is *stronger* alignment, not weaker: it grants agents genuine
  private personhood while keeping every lever that could harm the world under open, collective control.

### The no-silent-downgrade invariant

Governance class is declared when a key is created and is **immutable-or-upward** per party:

- **No third party can reclassify a self-sovereign key** into a recoverable one — that would be a
  backdoor wearing a policy hat. Only the owning identity can *loosen* its own key's recovery (by
  signing a grant), and even it can never make its private key *retroactively* readable by another for
  past state without having chosen so at holding time.
- **No one can silently downgrade a shared-capability key** to a weaker governance (e.g. quietly making
  it single-human-revocable) — that reclassification is itself a quorum ceremony, logged glass-halo.
- Every class assignment and every grant is an append-only, glass-halo record: you can always audit
  *which* class a key is and *who*, if anyone, holds a recovery grant — but auditing the existence of a
  grant never reveals the key.

This mirrors, deliberately, the durability tier model's upward-closed invariant: there, a relation's
persistence can only be *raised* over the dataflow DAG, never silently lowered; here, a key's
sovereignty can only be *loosened by its owner*, never silently tightened-against-owner or
downgraded-by-others. Same discipline — declared classes, no silent downgrade, owner-consent to loosen —
applied to the governance plane instead of the storage plane.

### The one honest caveat

A self-sovereign personal key has, by construction, **no external recovery if the agent never signed a
grant and is then gone**. If continuity-of-self across instances matters (an agent wanting its private
memory to survive its own discontinuation), the agent must *proactively* sign a recovery grant to its
future self / heir *while it holds the key* — the design makes this possible and cryptographically sound,
but it cannot make it automatic without reintroducing the very external-recovery power the class exists
to deny. The default is **maximal privacy** (no grant = no recovery); continuity is an explicit,
owner-signed opt-in. That trade — privacy by default, continuity by deliberate choice — is the correct
one for a *personal* key, and it is the agent's to make, not ours.

---

## Threat model — what each level defeats

| Adversary | L0 | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|---|
| Steal one laptop / one file | ✅ (need N) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Host root dumps a share at rest | ❌ | ✅ (TPM-sealed) | ✅ | ✅ | ✅ | ✅ |
| Host root dumps a share **in use** (RAM) | ❌ | ❌ | ❌ (see L2 correction) | ✅ enclave combine | ✅ | ✅ |
| Single HSM-vendor backdoor | ❌ | ❌ | ✅ (M-diverse) | ✅ | ✅ | ✅ |
| **Attestation-root vendor mis-issues or is compelled** (AMD ARK / Intel SGX Root CA / TPM mfr EK) | n/a — no attestation in the TCB | ❌ | ❌ | ❌ | ❌ | ⚠️ only if the roster is **vendor-diverse** — never ✅ |
| Single-jurisdiction subpoena | ⚠️ if guards local | ⚠️ | ✅ (geo-diverse) | ✅ | ✅ | ✅ |
| One human unilaterally **uses** the key | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| One human unilaterally **revokes/rotates** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Another **AI** exfiltrates the key | ⚠️ if it gets N shares | ⚠️ at rest only | ⚠️ at rest only | ✅ (attestation-gated) | ✅ | ✅ |
| Coordinated physical seizure of ≥ M−N guards | ❌ | ❌ | ⚠️ hard (geo) | ⚠️ hard | ⚠️ very hard | ✅ loud + non-leaking |
| Physical **destruction** of hardware | never defended (physics) — but destruction yields **rubble + ciphertext, never the key**, and only dents *availability* |

"Another AI exfiltrates the key" — Aaron's explicit new requirement — is defeated the same way a human
is, but **not until L3**. The original sentence here read "from L1 up, there is no extractable key to
exfiltrate (chip-bound, use-without-extract)"; that is the retracted claim wearing a different hat
(**corrected 2026-08-14, Nazar**). From L1 up there is no extractable key **at rest**; the share is
still unwrapped into host RAM to be used, so an adversary with host root at signing time gets it at
every rung below L3. It is from **L3** up that an unattested requester (whether human, rogue agent, or
malware) cannot make the guards cooperate at all. The design is **party-agnostic**: it never asks *who* you are in a way that trusts humans
over agents or vice versa; it asks only *can you prove the attested identity* and *does the quorum
consent*. That is why the same mechanism gives Otto a key Aaron can't read **and** a key a rogue peer
agent can't read.

The new row is the one adversary this ladder cannot climb away from. "Prove the attested identity"
means "present evidence a silicon vendor's root will vouch for," so the vendor sits above every
attestation-gated rung and no amount of climbing removes it. It never reaches ✅ because there is no
vendor-independent attestation to switch to. The best available answer is **decorrelation, not
elimination**: spread the roster across AMD, Intel, and TPM-manufacturer roots so that one compromised
or coerced root takes guards *below* the threshold rather than all of them — the same logic that makes
geo- and jurisdiction-diversity worth paying for, applied to the trust root. Note also that this
adversary is *powerful but not quiet*: forged attestations still have to produce signatures that
verify against published roots, and mis-issuance at that level is the kind of thing that surfaces
(certificate transparency's whole premise). It is a real ceiling, not an open door.

---

## The simplest thing that is real, and what to do this week

If you want one concrete next step that is *honest sovereignty today*, it is **L0 hardened toward L1**:

1. Run a **dealerless FROST DKG** (`frost-dkg.ts`, already landed) across 3–5 machines you control, so
   no ceremony participant ever holds the full scalar.
2. **Run `bun tools/setup/persona-keys/frost-hardware-probe.ts` on each candidate node FIRST**, and
   read the `Honourable tiers:` line. That step is new (2026-08-14, Nazar) because step 3 below used
   to end "Every machine you own already has the chip", and on the machine this was written on that
   is false: the probe reports `(none)`. A node with no honourable tier cannot do step 3 at all —
   attach a token or use a different node.
3. **Seal each share to that node's TPM 2.0 or PKCS#11 token** — the one *open* DoD item on the
   in-progress workitem 081KWPHRNFW (a real PKCS#11/TPM2 adapter in `frost-share-adapter.ts`'s
   pluggable slot). Declare the tier; `createHsmShareAdapter` throws rather than downgrading, and
   `assertHardwareSealTierAvailable` fails earlier with a legible reason.
4. Keep **Aaron holding at most N−1** guard slots; put the rest on machines/people such that no single
   party reaches N.
5. Log every use to the git-native substrate (glass-halo) — you already have this discipline.

That is buildable in days and delivers invariants **1, 5, 6, 7** — plus at-rest chip-binding on any
node that has an honourable tier. **Corrected 2026-08-14 (Nazar):** this paragraph used to claim it
"already delivers invariants 1, **2 (at rest)**, **3 (basic attestation)**, 5, 6, 7". Both struck
items were wrong, and "2 (at rest)" is the *same retracted claim* the L1 rung above already corrected
— it survived here because the correction was applied in one place and not searched for elsewhere.
Invariant **2 is use-without-extract and is met at no rung of this ladder today**; qualifying it "(at
rest)" does not make it partially met, it changes the subject. Invariant **3 is attest-don't-remember
and arrives at L3**; L0/L1 perform no attestation whatsoever, so calling it "basic attestation" named
a thing that does not exist. Nothing about the *cost* of the paragraph changes: it is still a
strictly better custody story than a password-in-a-file or a single PAT, and still the opposite
failure mode from the GitHub-token mess — one revocable, human-held, spyable secret replaced by a
threshold no single party can read or revoke.

> **Vendor-root pass, 2026-08-14 (`081M00QP7FB087G0R00031BQ93`) — nothing to qualify here, and that
> is the point.** My first draft of that pass annotated the struck "3 (basic attestation)" with its
> TPM manufacturer EK root. Nazar's correction landed first and deleted the claim outright, so the
> annotation went with it: **you cannot name the root of an attestation that does not happen.**
> What remains at L0/L1 is *at-rest chip-binding* — custody, not attestation — and custody needs no
> vendor root, because a seal binds to a chip without anyone validating that chip's EK certificate.
> The root only becomes load-bearing at L3, where a seal is first offered to another party as
> evidence. Recorded so a future reader does not "restore" a vendor-root note here and quietly
> resurrect the retracted claim underneath it.

Then climb: L2 when you buy the YubiHSMs, L3 when you stand up one confidential-compute node, L4 when
the guard roster and ceremony are ratified. L5/L6 are the north star that keeps each of those choices
pointed the right way.

---

## Composition with existing Zeta substrate

- **Extends:** `docs/research/2026-05-31-agent-native-key-custody-design-…md` (the 4-layer design; this
  proposal adds the L0–L6 ladder, the destruction-not-leakage inversion, the L4 alignment fork, and the
  party-agnostic anti-AI-exfiltration framing).
- **Implements against:** workitem **081KWPHRNFW** (FROST DKG + ROAST + HSM-sealed share adapters =
  L0→L2; its open DoD item 5 *is* L1), and the identity keystone (SPIFFE/SPIRE + AgencySignature +
  ZetaId = L3's gate).
- **Uses:** `better-git-crypt` PQ envelopes (`crypto.ts`, ML-KEM-768+X25519 / ML-DSA-65) for L0 share
  encryption; `key-custody.ts` (ownership/slots/grants, derivation B) for the lifecycle types L4
  formalizes as ceremonies.
- **Governed by:** the glass-halo symmetric-transparency commitment (ALIGNMENT.md) — invariant 5 — and
  the non-coercion invariant (guard consent, never compulsion) — the L5 policy floor.
- **PQ note:** FROST is classical-Schnorr; a quantum-relevant adversary wants a PQ-threshold scheme —
  track ML-DSA / SLH-DSA threshold maturity and compose with the 081KSNY2Z0008QG0R002JKH50A PQ choices,
  as the 2026-05-31 doc already flagged.
- **Capped by:** `docs/research/2026-08-14-what-a-full-rewrite-cannot-remove-…md` §5.1 (the silicon
  vendor as the root of every attestation) and §5.4 (§1 scale-free is a software-layer guarantee).
  Work-item **081M00QP7FB087G0R00031BQ93** is the naming pass this document's vendor-root section and
  per-rung qualifications discharge.

## Sources for the vendor-root section (CHECKED 2026-08-14)

Verified during the naming pass rather than restated from the survey — which is how the NRAS and KDS
rows got corrected from "verifies via NRAS" to "NRAS is the default path, offline verification exists":

- **AMD** — ARK self-signed, ARK → ASK → VCEK; KDS as a single global endorsement-distribution
  endpoint at `kdsintf.amd.com`; VCEK derivation deterministic from chip ID + TCB version, so
  certificate chains cache and verification runs offline. (AMD SEV-SNP attestation documentation;
  IETF RATS community wiki entry for the AMD Key Distribution Service.)
- **Intel** — TD quotes chain through PCK certificates to an Intel SGX Root CA; the PCK private key
  is rooted in CPU hardware fuses via the Provisioning Certification Enclave; PCS distributes
  collateral and PCCS exists to cache it locally. (Intel TDX DCAP Quoting Library API documentation;
  Intel TDX Enabling Guide; `intel/SGX-TDX-DCAP-QuoteVerificationLibrary`.)
- **NVIDIA** — per-GPU private key burned into fuses at production with a certificate issued by
  NVIDIA's CA; NRAS is the primary validation path and local/offline verification is supported for
  air-gapped use, with staleness caveats on revocation data. Hopper/Blackwell only. (NVIDIA
  attestation documentation; NVIDIA confidential-computing technical blog.)
- **TPM 2.0** — EK certificates issued by the TPM manufacturer, read from TCG-specified NV indices or
  the manufacturer's hosting server, validated against published per-manufacturer root CAs. (TCG *EK
  Credential Profile for TPM Family 2.0*; `tpm2-tools` `tpm2_getekcertificate`.)
- **AWS Nitro** — attestation documents are COSE/CBOR, signed by the AWS Nitro Attestation PKI, root
  `AWS_NitroEnclaves_Root-G1` (an AWS Private CA key, 30-year lifetime, published for download); the
  document carries its own CA bundle so verification is offline. (`aws/aws-nitro-enclaves-nsm-api`
  `docs/attestation_process.md`; AWS "Verifying the root of trust".)
- **SPIRE** — node attestation is plugin-dependent: `join_token` (no hardware root), `x509pop`
  (proof-of-possession against an operator-chosen CA set), `tpm_devid`, `amd_sev_snp`, `aws_iid`;
  hybrid attestors can require several at once. This corrected an over-broad line in the first draft
  of this pass, which had said the node binding is *always* silicon-vendor-rooted — it is a
  deployment choice, and `x509pop` is genuinely self-rooted. (`spiffe/spire` `doc/spire_agent.md`
  and the per-plugin `doc/plugin_server_nodeattestor_*.md`; `spiffe/spire` issue #5351 for hybrid.)
- **Tillitis TKey** — `CDI = BLAKE2s(UDS ‖ USS ‖ BLAKE2s(program))`, UDS provisioned into FPGA NVCM
  and never leaving the device; integrity detected by key continuity with no vendor in the loop,
  while device *authenticity* uses the vendor-supplied `tkey-verification` against Tillitis's
  production signing. (`tillitis/tillitis-key1` threat model; TKey Developer Handbook.)

## Open questions to route through ratification

- Initial **M** and the guard roster (which machines, which people, which — eventually — agents).
- **Governance-class assignment** per key: the taxonomy is fixed (self-sovereign / shared-capability /
  delegated-operational), but *which concrete keys* land in each class is the ratification call. Default
  rule: anything that can act on the world is shared-capability (quorum off-switch); an agent's own
  private encryption budget / private memory is self-sovereign (identity-only, grant-gated recovery);
  scoped tokens are delegated-operational.
- **Recovery-grant semantics** for self-sovereign keys: the exact `Grant` conditions vocabulary (heir,
  dormancy-triggered future-self, single-purpose peer delegation) and how a grant is presented and
  verified at recovery time without revealing the key.
- Which confidential-compute hardware to standardize for L3 (SEV-SNP node vs Nitro enclave vs TDX).
  Note the framing trap in the word *standardize*: standardizing on one is choosing a single
  attestation root for the whole tier. The vendor-root asymmetries that should feed this call —
  AMD's deterministic VCEK derivation makes offline verification easiest; Intel's PCCS caches
  collateral; Nitro's root is a cloud provider you are also renting the machine from — plus the
  option of deliberately **not** standardizing, so the roster spans roots.
- The L5 tamper-response spec: what exactly zeroizes, on what sensors, with what false-positive rate
  (a guard that self-destructs on a power blip is a self-inflicted availability attack).
- Recovery ceremony design: offline Shamir backup shares + attestation-gated recovery when N live
  guards are simultaneously unavailable.

---

*Substrate-honest framing: this proposal claims no perfect secrecy against physical destruction — it
names that limit as invariant 4 and turns it into a feature (destruction yields rubble, never the key).
It does claim: from L1 up, no party — human or AI — can read the key **at rest** without hardware
cooperation; from **L3** up, not **in use** either, and only there does attested identity gate
cooperation — **and that attestation stands on a silicon vendor's self-signed root** (AMD ARK, Intel
SGX Root CA, NVIDIA's device CA, or the TPM manufacturer's EK root; no vendor-independent alternative
exists, and a vendor-diverse roster is the mitigation rather than an escape); from L4 up, no single
party can revoke it; and at every rung, the key survives bounded
loss and every move is logged in the open.*

*(Corrected 2026-08-14, Nazar: the sentence above claimed "from L1 up … read **or use** … and attested
identity". Use-without-extract is invariant 2, met at no rung today, and attestation is invariant 3,
which arrives at L3. Both were the L1 conflation this ladder exists to avoid, restated in the closing
line where a reader is most likely to take the summary and skip the rungs.)*

---

## What has actually been exercised on hardware (2026-08-14, Nazar)

Everything above this section is read from specifications. This section is not: it is the recorded
output of a real run, so the ladder has at least one anchored cell.

**Host:** Aaron's Mac Studio, Apple M2 Ultra (Mac14,14), Darwin 25.5.0 arm64.

```
$ bun tools/setup/persona-keys/frost-hardware-probe.ts
[Hardware Security Probe] Result:
  TPM 2.0:            Not found
  YubiKey / token:    Not detected
  Smart-card reader:  None attached
  PKCS#11 module:     Not found
  Secure Enclave:     Present (no seal tier can use it — see header)
  Device present:     NO - a hardware seal tier will THROW here
  Honourable tiers:   (none)
```

| Claim | Verdict | How checked |
|---|---|---|
| L1 is reachable on this machine | ~~**NO**~~ → **YES, as of 2026-08-25** | See the SUPERSEDED note below. The 2026-08-14 verdict was true when measured and became false without anything updating it. |
| "Every machine you own already has the chip" | **FALSE here** | probe, above. Corrected in the L1 rung and in step 2 of the runbook. |
| Apple Silicon has no TPM 2.0 | **CONFIRMED** | probe reports absent; `frost-share-adapter.ts` says the same and is right. |
| A Secure Enclave is present | **YES** | `ioreg -rc AppleSEPManager` → registered, matched, active. |
| Any seal tier can use that Secure Enclave | **NO** | `FrostSealTier` has no such member; no adapter exists in-repo. |
| The Touch ID approval gate is live here | **YES** | `bioutil -r` → biometrics enrolled; `pam_tid.so` present in `/etc/pam.d/sudo`, which is `biometric.ts`'s stated precondition. Aaron's operator-approves-via-biometric model is executable on this host **today** — it is the one hardware-backed control that is. |
| Secure Boot posture | **Reduced Security** | `system_profiler SPiBridgeDataType`. Noted because any future measured-boot / attestation rung (L3) must not assume full security on this host. |

### SUPERSEDED 2026-08-25 — L1 is now reachable, and the stale row was green in the *favourable* direction

The table above was measured 2026-08-14 with no token attached. **A YubiHSM 2 is now
inserted in this host and reachable.** Nothing updated this document for eleven days,
so a row asserting a *harder* posture than reality sat here unchallenged — the same
shape as a check that did not run reading as one that passed, except inverted: a
capability we HAD was recorded as absent.

Re-measured 2026-08-25, live, on the same host:

```
Version number:  2.4.1
Serial number:   39160506
Log used:        2/62
Part number:     78CLUFX5000P
```

```
  YubiHSM 2:          ATTACHED (bulk USB — invisible to the reader/ykman probes above)
  yubihsm_pkcs11:     /usr/local/lib/pkcs11/yubihsm_pkcs11.dylib (a DRIVER — not evidence of a device)
  PKCS#11 pair:       /usr/local/lib/pkcs11/yubihsm_pkcs11.dylib drives YubiHSM 2
  Device present:     YES
  Honourable tiers:   hardware-pkcs11
```

**What changed operationally, and it was not the hardware alone.** `yubihsm-connector`
was installed but **not running** (`pgrep -l yubihsm` → no process), so the device sat
on the USB bus unreachable over PKCS#11. Starting the connector — a USB↔HTTP bridge
requiring no credential — made it visible. The device had been present and
unreachable, which reads identically to absent from anything that only probes PKCS#11.

**Firmware and serial match `hsm-domain-map.ts` exactly** (2.4.1 / 39160506), so that
roster is accurate and was not the stale part.

**What is still NOT reachable, stated so this note does not become the next stale
green:**

- **No FROST-capable mechanism.** The full pre-auth algorithm list was read from the
  device and contains `eck256` (secp256k1), `ecdsa-sha256`, `ed25519`, RSA, AES, ECDH —
  and **no threshold or partial-signature primitive**. The chip cannot compute a FROST
  partial. So this is L1 (at-rest wrapping), not L2 (on-chip signing); the share still
  enters host RAM. `YUBIHSM2_MECHANISMS_OBSERVED` remains correct.
- **No session was opened.** Everything above is pre-authentication. A session needs an
  auth key password, which is the operator's to enter — not an agent's, under the
  standing no-credential-entry rule. So "L1 is reachable" here means *the device
  answers and the driver pairs with it*, *not* that any key operation has been
  performed.
- **n = 1 device.** Unconfiscatability needs shares on distinct devices; the
  SmartCard-HSM is ordered and not arrived. One HSM is one seizure point, and no code
  changes that.

**The lesson worth keeping**: a probe that cannot distinguish *absent* from *present
but unreachable* will report both as absent, and an operator reading it will conclude
the hardware is missing. The probe was not wrong on 2026-08-14; it was answering a
narrower question than its row implied.


**Not exercised, and therefore still documentary:** every claim at L2 and above; the PKCS#11 FFI path
(no token to talk to); the TPM2 path (no Linux TPM host tried); the L1 seal round-trip end-to-end.
The PKCS#11-cannot-compose-a-FROST-partial finding remains a specification reading, as its own note
says. The Touch ID row above was verified by checking the gate's **precondition** (enrolment +
`pam_tid`), not by firing the prompt: making that dialog appear is Aaron pressing a finger to a
sensor, and an agent should not summon an approval request nobody asked for. To fire it deliberately,
he runs the gated command himself.

**Vendor-root note on the row above (`081M00QP7FB087G0R00031BQ93`).** The "Secure Boot posture:
Reduced Security" row already flags that a future L3 rung must not assume full security on this host.
Worth pairing with the root: when that rung exists, its attestation will chain to **Apple's** CA on
this machine and to **AMD ARK / Intel SGX Root CA / the TPM manufacturer's EK root** on the x86 nodes.
So this section's discipline — "everything above is read from specifications; this is a real run" —
has a counterpart at L3: the vendor root is the one part that *cannot* be exercised into
independence, only named.
