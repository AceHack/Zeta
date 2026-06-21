# Zeta Identity & Crypto Substrate — one seed → HD keychain, dual rotation, vault-separated, schema-evolvable over Z-sets, hexagonal

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** synthesis (pulls existing pieces together) · **Trajectory:** cluster-encryption-credential-substrate

## The ask (Aaron 2026-06-21)

> *"How does onboarding get the crypto part too — our whole keychain of derived keys and dual
> rotation from the start? We have a bunch on this, we just have not mashed it all together;
> might as well, and make it secure — investors are going to want it secure. Separate CA / Lucent
> / Zeta / User vaults for now. We want it all to be able to be wrong and updatable in the future,
> evolvable with our SchemaEvolution math, 0 downtime over Z-sets — but for our identity and
> crypto too. Can we pull all this together?"*

Yes — and the pieces already exist; this doc mashes them into ONE substrate. **Nothing new is
invented; five shipped components are unified.**

## The five pieces (already in the repo)

1. **One seed → full HD keychain** — `tools/setup/persona-keys/derive.ts`: a BIP-39 mnemonic →
   `HDKey.fromMasterSeed` derives, from the SAME master, every identity AND crypto key by
   coin-typed BIP-44 path:
   | Key | Path | Curve |
   |---|---|---|
   | Ethereum wallet | `m/44'/60'/0'/0/0` | secp256k1 |
   | Solana wallet | `m/44'/501'/0'/0'` | ed25519 |
   | Nostr | `m/44'/1237'/0'/0/0` | secp256k1 |
   | SSH | `m/44'/1110'/0'/0'` | ed25519 |
   | PGP | `m/44'/1111'/0'/0'` | ed25519 |
   So **crypto is already part of the keychain** — onboarding just needs to *derive and custody
   all of them*, not only SSH/PGP. One seed = identity + crypto.
2. **Dual rotation (zero-downtime ID rotation)** — `docs/DECISIONS/2026-06-15-zero-downtime-id-rotation-pattern-overlap-window-dual-key.md`:
   the overlap-window dual-key pattern. Apply it from the start to EVERY derived key (and the CA)
   — old+new valid during an overlap window, then retire the old. No flag-day.
3. **SchemaEvolution over Z-sets** — schemas-as-rows + grammar-as-versioned-events: the layout
   (derivation paths, vault mapping, rotation policy, key set) is *data that evolves* via Z-set
   deltas with 0 downtime. So the whole identity/crypto layout can be **wrong and fixed later**.
4. **Hexagonal ports** — `docs/DECISIONS/2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md`:
   SecretStore / KeyCustody / CertAuthority / Consent behind stable ports; adapters swap to the
   **DB-as-first-class-PKI** endgame.
5. **Event-sourced authorization** — grant/revoke as Z-set deltas (revoke = retraction);
   `docs/research/2026-06-21-config-and-secrets-as-event-sourced-zset-dbsp-…`.

## The mashup: one coherent flow

**Onboarding (one seed, one fingerprint):**
seed (human custody) → `deriveKeyring` → **all** keys (SSH, PGP, Nostr, ETH, Solana) → custody
each via the **KeyCustody port** into its class vault → register public material on GitHub →
the **event log** records what was provisioned. Crypto wallets fall out for free (same seed,
more paths). The seed stays the human's; the agent derives/uses leaves, never holds the master.

**Dual rotation from day one:** every key (and the CA) is issued with an overlap window; rotation
appends a Z-set event (new key +1, old key −1 after the window). Identity AND crypto rotate the
same way — no special case.

**Vault separation by class (now → 4 vaults, Aaron 2026-06-21):**
| Vault | Holds | Reader |
|---|---|---|
| **CA** | CA private key (trust root) | human-only (end-state); agent-readable only under full-trust bootstrap |
| **Lucent** | shared/work + infra secrets | agent + CI |
| **Zeta** | substrate/service identities | agent (service scope) |
| **User** (aaron) | the human's seed + derived personal keys (SSH/PGP/**wallets**) | human-only |

(Today: lucent + aaron exist; CA + Zeta are the next split — extends backlog 081KVNTNTDQ0.)

**Schema-evolvable, 0 downtime, over Z-sets:** the path table, the vault map, the rotation policy,
the key set are all **versioned events**, evolved by the SchemaEvolution math — so when (not if)
this layout is wrong, it changes with zero downtime, like every other Z-set view. Identity +
crypto get the same evolvability as the rest of the substrate.

**Hexagonal throughout:** all of it behind the ports → external adapters now (1Password/Vault),
**our own DB as first-class PKI** eventually, no call-site change.

## Why "secure" (the investor story)

One auditable seed→keychain derivation (deterministic, byte-locked by DST); **dual rotation**
(no long-lived keys, no flag-day); **least-privilege vault separation** (CA/User human-only,
agent scoped); **biometric consent** on every sensitive op (fail-closed); **event-sourced +
revocable** (grant/revoke fold, retraction); **schema-evolvable** (fixable with 0 downtime —
mistakes aren't permanent); **hexagonal** (no vendor lock-in; migrates to self-hosted DB-PKI).
The seed + wallets are **human custody**; the agent never holds the master or a wallet seed.

## Build to pull it together (backlogged separately)

Unify into one onboarding flow: derive ALL keys (incl. crypto) → KeyCustody per class vault →
dual-rotation issuance → event-log the provisioning → all over the ports. Formalize the ports as
explicit interfaces. The 4-vault split (CA/Lucent/Zeta/User). Make the path/vault/rotation tables
SchemaEvolution-versioned. See the new workitem + composes-with: 081KVNTNTDQ0 (vault sep),
081KVNMFYS8 (OSS vault via ArgoCD), 081KVNRSGVR0 (secret-clip cross-OS), the hexagonal +
event-sourced decisions, and the 2026-06-15 dual-key rotation decision.

## Anchors

BIP-39/32/44 (mnemonic + HD derivation; coin types SLIP-44); `@scure/bip32`,`@scure/bip39`.
Overlap-window dual-key rotation (the 2026-06-15 decision). SchemaEvolution / schemas-as-rows.
DBSP/Z-sets (Budiu et al.). Hexagonal (Cockburn). In-repo: `derive.ts`, the hexagonal +
event-sourced decision docs, the cluster-encryption-credential-substrate trajectory.
