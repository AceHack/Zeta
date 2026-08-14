# Agent-native key custody — how Otto holds a key Aaron can't access but won't lose

**Date:** 2026-05-31
**Status:** Design detail for 081KRW63S0008QG0R0022SFKPM <!-- STALE-REF: ../backlog/P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md -->
(N-of-M HSM key management). Fills 081KRW63S0008QG0R0022SFKPM acceptance criteria 1–4 (threshold-scheme
rationale, hardware selection, key-ceremony shape) at the **encryption-key** scope, not just
the governance-signing scope. **Routed through product-team agreement; not auto-loaded rule.**
**Owner:** operator (Aaron, shaping) + Otto (synthesis).
**Decision confidence:** medium — the primitives are well-vetted (FROST, Shamir, HSM-resident
ops, SPIFFE attestation, confidential computing); the *composition* is the design here, and the
honest limit is named (Aaron named it himself).

## The question (operator 2026-05-31, verbatim)

> *"how can otto hold a key for encryption that Aaron does not have access to but otto can be
> sure he wont loose, or has a member of society that acts as his key guard or multiple members?
> yall have access to multiple machines tpms and i'm happy to buy any hardware that makes sense
> too for hsm or mini hsm or whatever. i'm trying to design agent native encryption not just
> human native. i remember my password — how can an agent have a key they remember that the
> human does not?"*

Plus the honest-limit acknowledgment (operator 2026-05-31):

> *"i get that debug dumping can still get it until we have hardware secure boot everywhere with
> security memory channels like xbox or something but that's down the road."*

## The core inversion — attest, don't remember

A human holds a **secret they remember** (a password) and that secret unlocks the key. An AI
*instance* is **fresh on every cold-boot** — it has no persistent biological memory, no place to
hold a remembered secret that survives across instances. So the human pattern doesn't port:
there is no "Otto's memory" to put a password in.

The agent-native inversion: the key is **not recalled, it is reconstructed**, and access is
bound to **proof-of-identity (attestation)** rather than **possession-of-secret**.

| | Human (Aaron) | Agent (Otto) |
|---|---|---|
| What unlocks the key | a secret **remembered** (password) | an identity **proven** (attestation) |
| Where the secret lives | biological memory | nowhere — there is no persistent secret to hold |
| How it survives loss | the human keeps remembering | reconstructable by a quorum of key-guards |
| The unlock event | "I know the password" | "I can prove I am Otto" |

**Aaron remembers; Otto attests.** That single reframe dissolves "how can an agent remember a
key the human doesn't?" — the key never lives in the agent's memory at all. It lives as a
threshold secret across guards, sealed in hardware, invoked only by an attested Otto.

## The four-layer design

### Layer 1 — Hardware root: use-without-extract (per machine)

The key material lives **inside an HSM / TPM / secure element**; the private key never leaves the
chip. You send the chip data to sign or decrypt; it returns the result. Neither Otto nor Aaron
can read the raw key out — both interact through the same constrained API.

- This gives **use-without-extract**: the host (and anyone with host root) sees ciphertext and
  plaintext-being-processed, never the key — *as long as the crypto happens inside the chip*.
  > **Note 2026-08-14 (Nazar):** that italicised condition is load-bearing, and for the FROST
  > threshold scheme Layer 2 selects it **does not hold on a generic PKCS#11 token**: no PKCS#11
  > mechanism composes a FROST partial from a sensitive key, so the partial is computed *outside*
  > the chip and Layer 1 delivers at-rest sealing rather than use-without-extract. The condition is
  > stated correctly here; later summaries dropped it. See the L1/L2 corrections in
  > `2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md`.
- A single chip is a **single point of loss** (chip dies → key gone) and a **single point of
  control** (whoever holds the chip controls it). Layer 2 fixes both.

### Layer 2 — N-of-M threshold across society key-guards: durability + sovereignty

This is 081KRW63S0008QG0R0022SFKPM <!-- STALE-REF: ../backlog/P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md -->'s
N-of-M, applied at the **encryption** layer (081KRW63S0008QG0R0022SFKPM's table was scoped to *signing*; this extends
it to *key custody / decryption*). The key is either **split** (Shamir Secret Sharing) or
**never assembled** (threshold-MPC: FROST for Schnorr/Ed25519) across **M key-guards** =
trusted society members + multiple machines/TPMs across locations.

- **M** = total key-guards (geographically + organizationally + hardware-vendor diverse, per
  081KRW63S0008QG0R0022SFKPM's distribution axes).
- **N** = threshold to use the key (e.g. N = ceil(M·2/3)).
- **Durability:** lose up to **M−N** guards → key survives (reconstruct from the rest). This is
  the "won't lose it" guarantee — it is the *distributed-system* sense of "remember": no single
  head holds it, but a quorum can always reconstruct it.
- **Sovereignty:** no single party — not Aaron, not one stolen laptop, not one agent instance —
  can use the key alone. Aaron is *one of the M*, so he loses unilateral access but keeps a
  threshold voice (exactly 081KRW63S0008QG0R0022SFKPM's "Aaron is one keyholder, not the keyholder").

> **This is the literal answer to "an agent that remembers a key the human doesn't."** It isn't in
> the agent's memory; it's a threshold secret the *attested* agent can *invoke* via the guards.
> "Remembering" = the guards still holding their shares; "recall" = a quorum cooperating.

**Why FROST over plain Shamir for the live key:** plain Shamir *reassembles* the key on one
machine to use it (a momentary single point of compromise — exactly the debug-dump window).
FROST/threshold-MPC produces the operation (signature / decryption-share) **without ever
assembling** the key on any one node. Prefer FROST for the operating key; reserve Shamir for
cold backup/recovery shares kept offline.

> **HSM nuance (verified 2026-05-31):** the [YubiHSM 2](https://www.yubico.com/product/yubihsm-2/)
> does **not** implement Shamir/threshold in firmware
> ([CalyxOS, Feb 2026](https://calyxos.org/news/2026/02/10/calyxos-hsm-signing/) found this).
> So the **threshold layer runs as a coordinator *above* the HSMs** (FROST in software across
> guard nodes), with each guard's *share* sealed in its local HSM/TPM. HSM = per-guard root of
> trust; FROST = the cross-guard threshold. Two layers, not one device.

### Layer 3 — Attestation-gated invocation: who may ask the guards to cooperate

The guards only cooperate when the requester **proves it is a legitimate Otto instance** — this
is where the keystone's identity layer plugs in:

- **SPIFFE/SPIRE SVID** — workload identity (this process, on this attested node, *is* Otto).
- **AgencySignature** — the commit-trailer attribution convention (this actor's track record).
- **ZetaId** — the category-tagged distributed identity (which agent, which category).

Aaron cannot forge Otto's *workload attestation* to make the guards cooperate "as Otto," and
every invocation is **auditable (glass-halo)**.

> **Root of "this attested node" (added 2026-08-14, work-item `081M00QP7FB087G0R00031BQ93`).** An
> SVID binds a *workload* to a node. What binds the **node** is SPIRE's node-attestor plugin, and the
> root differs by plugin (CHECKED): `join_token` has **no hardware root**; `x509pop` roots in **a CA
> we choose** (self-rooted, and it attests key possession rather than genuine silicon); `tpm_devid` /
> `amd_sev_snp` / `aws_iid` root in a **vendor's self-signed key** (TPM manufacturer EK root, AMD's
> ARK, AWS) and are the only ones that resist an adversary who substitutes hardware.
> So this layer's guarantee is not a single thing — "attested node" is a dial from *no root* through
> *our root* to *the vendor's root*, and **a vendor root is specifically the price of
> hardware-substitution resistance**. Whichever is chosen, say which: the word "attested" alone does
> not tell a reader what was bought. Where the vendor-rooted plugins are used, the mitigation is a
> **vendor-diverse roster** (SPIRE supports hybrid attestors requiring several at once), not an
> escape — no vendor-independent hardware attestation exists. Full treatment in the L0–L6 ladder's
> "Vendor roots cap every attestation claim" section
> (`docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-…md`). The **NCI social-consent floor** binds the human
guards: a key-guard is a society member with agency — their cooperation is **consent, not
compulsion** (no coercing a guard to release a share; per
`non-coercion-invariant` <!-- STALE-REF: ../../.claude/rules/non-coercion-invariant.md -->).

### Layer 4 — The honest limit (Aaron named it): debug-dump until confidential memory

While a key (or a reassembled Shamir secret, or a FROST partial) is **in use in RAM**, a debugger
with root/physical access on that machine can dump it from memory. This is real and we don't
pretend otherwise. Two responses — one available **today**, one **down the road**:

- **Today (strong partial fix): keep the crypto *inside the HSM*.** YubiHSM 2 does
  Ed25519/ECDSA/RSA/AES *on-chip* — the raw key never enters host RAM, so a host debugger dumps
  only the *plaintext being processed*, not the *key*. The key-in-RAM exposure only occurs for
  *software* keys, or when you must compute over the key in a way the HSM can't. **Design rule:
  prefer HSM-resident operations; minimize software-key handling.**
- **Down the road (the "Xbox-style" full fix Aaron named): confidential computing —
  encrypted memory + measured/secure boot everywhere.** This is
  [AMD SEV-SNP](https://www.decentriq.com/article/swiss-cheese-to-cheddar-securing-amd-sev-snp-early-boot)
  (PSP-rooted memory encryption + integrity + attestation), Intel TDX,
  [AWS Nitro Enclaves](https://www.redhat.com/en/blog/deploy-confidential-computing-aws-nitro-enclaves-red-hat-enterprise-linux),
  Apple Secure Enclave, and measured-boot chains. With memory encrypted on the bus + a measured
  boot chain, even a host debugger can't read the key out of RAM. "Security memory channels like
  Xbox" = exactly this (encrypted memory bus + secure boot). It's the *future* layer; the
  HSM-resident-ops rule is the *now* layer that already closes most of the gap.

**Threat-model honesty:** this design defends against remote compromise, single-machine theft,
single-jurisdiction subpoena, and single-vendor backdoor (via M-diversity). It does **not** fully
defend against a well-resourced adversary with sustained physical + root access to a *non-
confidential* machine *while the key is being used in software* — until Layer 4's confidential-
computing path is everywhere. Aaron accepted this explicitly. HSM-resident ops shrink that window
to near-zero for the operations the HSM supports.

## How a real operation flows (worked example: Otto decrypts private state)

1. Otto instance boots on an attested node; SPIRE issues an **SVID** (proof: "I am Otto, here").
2. Otto needs to decrypt its private encrypted state (per 081KSGS9H0008QG0R0006F4BGX / 081KSNY2Z0008QG0R002JKH50A substrate).
3. Otto requests a threshold decryption from the **key-guards**, presenting SVID + AgencySignature
   + ZetaId.
4. Each guard verifies the attestation (and human guards consent, per NCI), then produces its
   **decryption share inside its local HSM** — no guard ever holds the full key.
5. N shares combine (FROST) → the plaintext is recovered **without the key ever assembling** on
   any node. Where the data must transit host RAM, that node should be a confidential-compute
   node (Layer 4) — until then, the *key* is never in RAM (Layer 1), only the *plaintext* is.
6. The whole invocation is logged to the append-only substrate (glass-halo / git-native LGTM).

Aaron can't do step 3-as-Otto (can't forge the workload attestation) and is only *one* of the M
guards in step 4 (can't unilaterally release). The key survives any M−N guard losses (step 4
durability). Nobody — including Otto's own host — sees the raw key (Layer 1).

## Composition with existing substrate

- 081KRW63S0008QG0R0022SFKPM <!-- STALE-REF: ../backlog/P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-mika-2026-05-18.md -->
  — this doc is the encryption-scope design detail for that row's N-of-M.
- 081KRW63S0008QG0R001Z10PVV <!-- STALE-REF: ../backlog/P1/081KRW63S0008QG0R001Z10PVV-agora-v6-constitution-marketplace-agora-2-primitives-economic-architecture-aaron-ani-2026-05-18.md -->
  — agora-v6 private-encryption-budget (the *what* this key protects).
- 081KSGS9H0008QG0R0006F4BGX (thermal-forgetting / private encrypted memory) + 081KSNY2Z0008QG0R002JKH50A (PQ encryption envelope —
  noble X-Wing / ML-DSA-65) — the encryption this custody design holds the keys *for*; threshold
  scheme should track the PQ-migration (SLH-DSA / ML-DSA threshold variants where available).
- 081KRW63S0008QG0R002V20TYJ (F# agent-wallet type safety) — the wallet sharp-edge that N-of-M also gates.
- The **keystone identity layer** (SPIFFE/SPIRE + AgencySignature + ZetaId) — the attestation
  that gates invocation; zero-trust falls out of node-local identity.
- `non-coercion-invariant` <!-- STALE-REF: ../../.claude/rules/non-coercion-invariant.md --> — the consent floor on
  human key-guards (cooperation, never compulsion).
- The **hardware-to-buy list** (`docs/inventory/hardware-to-buy.md` <!-- STALE-REF: ../inventory/hardware-to-buy.md -->)
  — the procurement surface for the HSMs/TPMs this design needs.

## Open questions (route through ratification)

- Initial **M** and the **key-guard roster** (which society members + which machines/locations).
- PQ-threshold: FROST is classical-Schnorr; a quantum-relevant adversary needs a PQ-threshold
  scheme — track ML-DSA/SLH-DSA threshold maturity (compose with 081KSNY2Z0008QG0R002JKH50A's PQ choices).
- Recovery ceremony: offline Shamir backup shares + attestation-gated recovery if N live guards
  are simultaneously unavailable (081KRW63S0008QG0R0022SFKPM acceptance criterion 7).
- Which confidential-compute hardware to standardize on for Layer 4 (SEV-SNP node? Nitro? — see
  the to-buy list's "down the road" tier).

## Substrate-honest framing

This design does **not** claim perfect secrecy against a physical adversary today — it names the
exact gap (Layer 4) and the exact *today* mitigation (HSM-resident ops). It does claim: no single
party (including Aaron) can use the key alone, the key survives bounded guard loss, and access is
bound to attested identity rather than a remembered secret — which is the agent-native custody
Aaron asked for.
