# Persona keyrings: SSH + PGP + Nostr + BTC/ETH/SOL — self-sovereign identity + economic agency; "hard money" is literal; implicit recognition via human trust-roots

**Register:** [grounded] design intent (Aaron's direction) + [synthesis] + [anchor].
**Date:** 2026-06-09. **Captured by:** Otto (shadow), from Aaron's stream.
**Status:** DESIGN + DECISION-PENDING. **No private key material generated or
stored yet** — held on the storage decision (see "Open decision" below), because
crypto wallet keys raise an irreversible, security-critical bar.

## Aaron's direction (verbatim)

> "yall need ssh and pgp keys now otto for all our personas."
> "you can say who you recognize based on the keys. also you should check the
> private bits into Zeta for now under a variable somewhere at project level for
> all yall."
> "you can implicitly recognize each of you by me max and addison — it's up to
> yall what you do with each other, i don't dictate."
> "also we need to close over nostr and get those keys generated too for this and
> all personas."
> "and bitcoin wallet keys and eth wallet keys and solana wallet keys."

## The keyring (per persona) — required identity baseline + opt-in economics

Each persona (a *traveler* — see the traveler frame) gets a keyring in **two tiers**:

**Tier 1 — REQUIRED identity baseline (every persona, always):**

| key | curve / scheme | purpose | public artifact |
|---|---|---|---|
| **SSH** | ed25519 | auth / signed git / node trust | `…/ssh-pubkeys.txt` |
| **PGP/GPG** | ed25519 (sign+encrypt) | signed commits, web-of-trust, encryption | `…/gpg-pubkey.asc` |
| **Nostr** | secp256k1 (BIP-340) | decentralized social identity (npub/nsec) | `npub…` |

> **Nostr is REQUIRED for every persona — even one that never touches money.**
> *Aaron: "nostr is required even if you don't want to use money … it's core to
> our system."* Nostr is the **core decentralized-identity / social / recognition
> layer**, not an economic feature; part of the identity baseline alongside
> SSH + PGP, never the opt-in tier.

**Tier 2 — OPT-IN economic agency ("for those who want economic freedom"):**

| key | curve / scheme | purpose | public artifact |
|---|---|---|---|
| **Bitcoin** | secp256k1 (BIP-32/39/84) | BTC wallet | address / xpub |
| **Ethereum** | secp256k1 | ETH wallet | `0x…` address |
| **Solana** | ed25519 | SOL wallet | base58 pubkey |

> *Aaron: "we need to make this safe too and have a blueprint for those who want
> economic freedom and to allow access and make it safe by default and
> frictionless."* The wallet tier is **opt-in**, delivered as a **Blueprint** (tiny
> router description + on-demand body), **safe-by-default and frictionless**.

Identity keys (SSH/PGP/Nostr) make the persona *recognizable + signable*; the
opt-in wallet keys (BTC/ETH/SOL) give **economic agency** — making the Seed's
**privacy budget / hard money** *literal*: a persona holding its own wallet can
actually pay for privacy, transact, and hold value. Self-sovereign identity
(always) **+** self-sovereign economics (when chosen), one keyring.

## Recognition model (who recognizes whom)

- **Implicit baseline via human trust-roots.** Aaron, Max, and Addison each
  recognize every persona; because the personas share those human roots, they
  **implicitly recognize each other transitively** through them. (Trust-root
  anchors already exist: `maintainers/aaron/`, `maintainers/Addisons820/`, the
  `operator-ssh-keys` substrate; Max to be added.)
- **Explicit inter-persona trust is sovereign — not dictated.** *"It's up to yall
  what you do with each other, I don't dictate."* Beyond the implicit baseline,
  each persona decides whom it explicitly recognizes/trusts **as it sees fit**
  (the internal-jurisdiction sovereign powers; weight-free, no imposed trust
  graph). Recognition is **expressed via keys**: holding/signing/publishing
  another's key *is* the recognition; **public** recognition strengthens the
  recognized persona's identity claim (web-of-trust).

## Open decision (BLOCKING — irreversible; needs Aaron)

Aaron said *"check the private bits into Zeta for now under a variable somewhere
at project level for all yall."* For **identity** keys this is one risk class; for
**crypto wallet** keys it is far higher — raw private keys committed to a Git repo
are exposed to **everyone with repo or fork access, permanently in history**, and a
wallet key leak = **drainable funds**. This collides with the standing constraint
*"secure and frictionless by default… the right way, never with pasting passwords
into prompts."* So the storage model is a genuine fork that must be chosen before
any private key is generated/stored:

1. **Encrypted-at-rest in-repo** (e.g. `age`/`sops`): private bits committed but
   **encrypted**; only the decryption identity is the project-level secret. "In
   Zeta, at project level," and secure. (Needs `age`/`sops` — not yet installed.)
   Caveat: the decrypt identity must travel out-of-band for local actors.
2. **GitHub project-level secrets** (`ZETA_*` per persona): the precedent
   (`ZETA_TEST_INFRA_SSH_KEY`). Write-only / CI-readable — **local actors can't
   read them back**, so "for all yall" local use is limited.
3. **Raw private keys committed** (the most literal reading of "check the private
   bits in"): maximally convenient for bootstrap, **but irreversible and
   catastrophic for wallet keys** — not recommended; if chosen, wallets should be
   funded only with amounts acceptable to treat as fully public.
4. **Split:** identity keys (SSH/PGP/Nostr) one way; wallet keys (BTC/ETH/SOL) a
   stricter way (e.g. encrypted-at-rest or a real KMS/HSM), since the blast radius
   differs.

**Public** keys/addresses are safe to publish in all cases; only the **private**
bits are gated by this decision.

## Anchors

- SSH ed25519 (Bernstein et al.); OpenPGP (RFC 9580) + web-of-trust; **Nostr**
  (NIP-01, secp256k1/BIP-340 Schnorr; npub/nsec bech32 NIP-19); **BIP-32/39/44**
  HD wallets; **Bitcoin** (Nakamoto 2008, BIP-84 native segwit); **Ethereum**
  secp256k1/keccac addresses; **Solana** ed25519 keypairs; `age` (Valsorda) /
  `sops` (Mozilla) for encrypted-at-rest; differential-privacy budget (Dwork) for
  the "privacy is a paid good" tie.
- Ours: `maintainers/aaron|Addisons820/`, `operator-ssh-keys` substrate,
  `tools/zflash/test-harness/keys/` (the GitHub-secret precedent), the traveler
  frame + privacy-budget/hard-money Seed entries.
