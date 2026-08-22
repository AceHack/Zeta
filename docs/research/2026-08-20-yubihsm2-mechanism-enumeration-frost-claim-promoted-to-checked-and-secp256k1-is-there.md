# YubiHSM 2 mechanism enumeration — the FROST claim promoted from PROPOSED to CHECKED, and secp256k1 is there

**Status:** measurement. **Hardware was exercised** — this is the first claim in the FROST/custody
lineage that is not read from a specification.
**Date:** 2026-08-20 · **Device:** YubiHSM 2, serial 39160506, firmware **2.4.1**, part `78CLUFX5000P`
**Authorization:** Aaron 2026-08-20 — *"yes this sound good to do, yubihsm is hooked up here"*, under
the standing HSM authorization. **No authenticated session was opened and no key material was
created, read, or handled**; `get-device-info` is unauthenticated, and that was sufficient.

## Why this run existed

`tools/setup/persona-keys/frost-partial-signer.ts` carries a carefully-registered claim:

> *"NO HARDWARE WAS EXERCISED FOR ANY CLAIM IN THIS FILE. The PKCS#11 finding is read from the
> specification: **CHECKED** against the spec, **PROPOSED** as applying to any particular token,
> since token mechanism lists vary and vendors add extensions."*

That is the honest register, and it names its own falsifier: *enumerate a real token's mechanism
list.* A device is now attached and authorized, so the falsifier was run.

## The measurement (verbatim device output, regrouped)

| family | mechanisms reported by fw 2.4.1 |
|---|---|
| RSA | `rsa2048` `rsa3072` `rsa4096` · `rsa-pkcs1-sha{1,256,384,512}` · `rsa-pss-sha{1,256,384,512}` · `rsa-oaep-sha{1,256,384,512}` · `rsa-pkcs1-decrypt` · `mgf1-sha{1,256,384,512}` |
| EC curves | `ecp224` `ecp256` `ecp384` `ecp521` · **`eck256`** · `ecbp256` `ecbp384` `ecbp512` |
| EC operations | `ecdsa-sha{1,256,384,512}` · `ecdh` · `ed25519` |
| symmetric / wrap | `aes128` `aes192` `aes256` · `aes-ecb` `aes-cbc` `aes-kwp` · `aes{128,192,256}-ccm-wrap` |
| MAC | `hmac-sha{1,256,384,512}` |
| other | `opaque-data` · `opaque-x509-certificate` · `template-ssh` · `aes{128,192,256}-yubico-otp` · `aes128-yubico-authentication` · `ecp256-yubico-authentication` |

Audit log: **`2/62` used** — the device keeps a tamper-evident log with 62 slots.

## Result 1 — the FROST claim is CHECKED on this device, and it holds

**There is no mechanism in that list that can produce a FROST partial.** The spec-level argument
transfers exactly, and now with a token to point at:

- **No modular scalar arithmetic returning a number.** Nothing in the list operates on a stored
  private scalar and returns a numeric result. `ecdh` is the only operation that touches the scalar
  arithmetically, and it computes a *point multiplication* and yields a key/secret, not an element
  of `Z_L`.
- **The signature mechanisms are all-or-nothing.** `ecdsa-sha{1,256,384,512}` and `ed25519` generate
  their own nonce internally and compute the challenge over *their own* `R`. Neither accepts an
  externally supplied nonce or challenge, so neither can be bound to the group's `R` — which is
  precisely what a FROST partial requires.
- **No vendor extension rescues it.** The falsifier's stated escape hatch was *"vendors add
  extensions"*. Yubico's additions here are `*-yubico-otp`, `*-yubico-authentication` and
  `template-ssh` — OTP, session auth, and SSH certificate templating. **None is threshold-related.**

> **Promotion:** the `frost-partial-signer.ts` finding moves from **CHECKED-vs-spec / PROPOSED-for-any-token**
> to **CHECKED on YubiHSM 2 fw 2.4.1**. The `hardware-boundary` FROST adapter the hexagonal-PKI ADR
> says is missing **cannot be built on this device**, and that is now measured rather than inferred.

**Scope, stated so this does not get over-read:** one device, one firmware. It does not speak for
TPM 2.0, for other HSM vendors, or for future Yubico firmware. It does close the specific question
that was open.

## Result 2 — `eck256` is present, and that is the one that changes what is possible

`eck256` is **secp256k1** (Yubico's naming: `ecp256` = NIST P-256 / secp256r1; `eck256` = the
Koblitz curve). Paired with `ecdsa-sha256`, this device can **hold a secp256k1 private key and sign
with it, without the key ever leaving the hardware.**

That is the curve EVM-family chains use, so it is the curve an **x402** payment authorization needs.
Aaron 2026-08-20: *"we connect this yubikey to x402 but a decentralized form not remote custody
centralised form"* — and the enumeration says the decentralized form is **available on this
hardware**, which was not previously established.

**Three client-side adaptations are required, none of them blocking:**

| need | why | resolution |
|---|---|---|
| **keccak256**, not SHA-256 | EVM hashes with keccak256; the device offers SHA-2 | hash **off-device**, submit the 32-byte digest — ECDSA signs a digest, so the on-device hash label is not load-bearing |
| **recovery id `v`** | the device returns DER `(r,s)`; EVM needs `v` | recover client-side by trying both candidates against the known public key — standard practice |
| **low-`s` normalization** | EIP-2 rejects high-`s` | normalize client-side |

**`ed25519` is also present**, so ed25519-native chains are directly supported as well.

## What this does and does not license

- **Does:** self-custody signing for x402-style agent payments, with the private key non-exportable
  and every use recorded in the device's audit log. This is the **KeyCustody** port's
  `hardware-boundary` tier for *ordinary* signatures — the tier the ADR notes is currently software-only
  (`exposureBoundary: "signer-function"`, which the ADR itself says is *"a narrower window and **not**
  the guarantee"*).
- **Does not:** threshold / n-of-m custody. The `081KRW63S0008QG0R0022SFKPM` cryptographic-sovereignty
  design wants FROST across society key-guards, and **Result 1 says this device cannot do the partial**.
  Single-device custody is a *different* security property: it protects against key *exfiltration*, not
  against the holder of the device.

**The architectural guard still applies.** x402's facilitator is the centralization risk, and the
distinction that keeps it honest is **custody vs settlement**: sharing a settlement rail is fine,
sharing custody is not. A facilitator that only *verifies* a signature the agent produced locally is
an **oracle** — one you can route around. A facilitator that *holds the key* is a **hub**, and per
[`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)
the discriminator is **exit**: if there is no second facilitator you could use, it holds you regardless
of how it got there.

## Result 3 — per-agent key partitioning is a device feature, not something we must build

Aaron 2026-08-20: *"maybe we can have AI's per docker continer restricted to only ceratin keys so
every AI on a node does not need access to all the keys, only their portion … key/process
combination, we may need code signing for this."*

**The access model he is describing is already the device's own.** Verified from the shipped
tooling and library (`yubihsm-shell --help`, capability strings in `libyubihsm`), not from marketing:

| mechanism | what it does |
|---|---|
| **`--domains`** | partitions the object space. An auth key bound to a domain can only see objects in that domain |
| **`--capabilities`** | a per-object bitmask over a **fine-grained** verb set — `sign-*`, `generate-asymmetric-key`, `put-*`, `delete-*`, `export-wrapped`, `exportable-under-wrap`, `get-log-entries`, `get-pseudo-random`, `change-authentication-key`, … |
| **`--delegated`** | **an auth key cannot grant capabilities it does not itself hold.** Privilege is monotone-decreasing by construction — there is no escalation path to close, because there is no escalation primitive |

So the shape is: **one authentication key per agent/container**, bound to **its own domain**, granted
`sign-ecdsa` **and nothing else** — in particular never `exportable-under-wrap` (so the key is
structurally non-exportable) and never `export-wrapped` or `delete-*`. Compromise of one container
yields *signing within one domain*, and cannot exfiltrate the key, reach a sibling's keys, or widen
its own grant. `get-log-entries` is a separate capability, so audit-log access is itself scoped.

**Where the honest limit is, and it is the half Aaron already anticipated.** The `--delegated` chain
binds capability to a **credential**, not to a **process**. A container is *not* a hardware trust
boundary: namespaces and cgroups are kernel-enforced isolation, and anything that escapes to the
host kernel can read a sibling's credential out of memory. So *"key/process combination"* is the
right instinct and the device does **not** supply the process half.

What actually closes it, in increasing order of strength:

1. **Separate credential per container** (available today) — turns "one compromise loses everything"
   into "one compromise loses one domain". This is real risk reduction and costs nothing.
2. **Code signing / measured launch** gating credential release on image identity — the *"we may need
   code signing"* half. On a shared kernel this binds *what was launched*, not *what is running now*.
3. **Per-VM attestation** (SEV-SNP / TDX) — the only tier that makes the process half a hardware
   claim. This is already on file as the "down-the-road" fix in
   `081KRW63S0008QG0R0022SFKPM` (Aaron's *"Xbox-style"* encrypted memory).

**On TPM as the entry tier:** a TPM binds to *the node*, and a node runs many agents — so a TPM
gives you one machine identity, not N agent identities, and the per-agent split still has to come
from domains-and-capabilities above it. That ordering is worth stating plainly, because it is the
opposite of the intuitive one: **the HSM is not merely "the upgrade" from TPM in strength — it is the
piece that supplies multi-tenancy, which the TPM structurally cannot.**

## Reproduce

```bash
yubihsm-connector start &          # daemon on 127.0.0.1:12345
yubihsm-shell -a get-device-info   # unauthenticated; no session, no key material
```

## Pointers

- `tools/setup/persona-keys/frost-partial-signer.ts` — the PKCS#11 finding this promotes; its
  "NO HARDWARE WAS EXERCISED" paragraph is the falsifier that named this run
- `docs/DECISIONS/2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md` — the
  **KeyCustody** port and its conformance note; this device is a candidate adapter for the ordinary-signature tier
- `docs/backlog/P2/081KRW63S0008QG0R0022SFKPM-cryptographic-sovereignty-for-ais-n-of-m-hsm-key-management-.md`
  — the n-of-m design Result 1 constrains
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  — this run is the earning: a claim moved register because a falsifier was executed
