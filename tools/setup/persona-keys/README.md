# Zeta keyrings — one seed phrase, every key type, type-separated

Each **traveler** (persona or human maintainer) has **one BIP-39 seed phrase**
from which **every key type is derived on its own path** — so key types never
bleed into each other (best practice for a shared seed). One phrase recovers the
whole keyring.

## Key types & derivation paths

| type | curve | path | standard |
|---|---|---|---|
| SSH | ed25519 | `m/44'/1110'/0'/0'` | Zeta convention (ed25519, via SLIP-0010) |
| PGP | ed25519 | `m/44'/1111'/0'/0'` | Zeta convention (ed25519, via SLIP-0010) |
| Nostr | secp256k1 | `m/44'/1237'/0'/0/0` | NIP-06 |
| Bitcoin | secp256k1 | `m/84'/0'/0'/0/0` | BIP-84 P2WPKH (bc1…) |
| Ethereum | secp256k1 | `m/44'/60'/0'/0/0` | BIP-44 |
| Solana | ed25519 | `m/44'/501'/0'/0'` | Solana / SLIP-0010 |

**Tier 1 (required, every traveler):** SSH + PGP + **Nostr** — Nostr is the core
decentralized-identity layer, required even if you never touch money.
**Tier 2 (opt-in, economic freedom):** BTC + ETH + SOL wallets. Generating
unfunded wallet keys is reversible; **only funding is irreversible.**

## Security invariants

1. **The seed phrase is never a CLI argument** (ps / shell history would capture
   it). It is either generated in-process (`generate`) or read with `read -s`
   (no echo, not added to history) and piped via **stdin** (`import`).
2. **Private key material never goes to stdout/history.** It goes to a sink:
   Vault or a GitHub secret. The temp file is `umask 077` + `shred`-on-exit.
3. **Public artifacts are safe to publish** — pubkeys / addresses / npub go to
   `maintainers/<name>/` and are committed to `main`.

## Two storage modes (Aaron 2026-06-09)

- **Equipment mode (cluster):** private bits → **Vault** (`--vault zeta/personas/otto`).
  The cluster already runs Vault + External-Secrets + cert-manager + trust-manager + spire.
- **GitHub-free mode ("choose your own adventure", no equipment):** private bits
  → **GitHub Actions secret** (`--gh-secret ZETA_PERSONA_OTTO_KEYRING`). For users
  who only have GitHub and no owned hardware.

## Trust bootstrap — GitHub / `main`, for now

Trust is bootstrapped by **committing public keys to `main`**: who can merge to
`main` (the human maintainers — Aaron, Addison, Max) is the trust authority that
**vouches for the personas' keys**. This is the *only* trust root we have for now;
spire / trust-manager / headscale / Nostr web-of-trust extend it later.

**Identity providers are pluggable** — Zeta will support **many: centralized
(GitHub/OIDC), decentralized (Nostr / DIDs / web-of-trust), and our own
eventually.** GitHub is merely the bootstrap provider, never the mandated one
(traveler frame: recognize as you see fit, no imposed registry).

## Usage

```bash
# Persona (fresh seed in-process) -> Vault, pubkeys to repo:
keyring.sh generate otto --vault zeta/personas/otto
# Persona, github-free mode:
keyring.sh generate otto --gh-secret ZETA_PERSONA_OTTO_KEYRING
# Human resets keys WITHOUT sharing the seed (typed hidden); only pubkeys emitted:
keyring.sh import aaron --public-only --out maintainers/aaron
```

## Closure: self-bootstrapping deps, NOT an install.sh special-case

`keyring.sh` installs its own deps on first run (`[ -d node_modules ] || bun
install`), so **`install.sh` does NOT need to know this tool exists** — it stays
persona-agnostic (Aaron 2026-06-09: *"why does install.sh need to know anything
about personas?"*). No imperative coupling in the installer.

**Declarative target (the right closed-over form):** this tool's deps belong in
**`ace`'s static deps graph** (Zeta's signed DLC package manager — `tools/ace/`:
dep edges + z3 solver + lockfile + content-hash + trust), so `ace` resolves the
whole graph generically and the installer closes over *everything* by naming
*nothing*. Until this is published as an ace package, first-run self-bootstrap is
the bridge. See `docs/research/2026-06-09-declarative-keyring-as-an-ace-package-...md`.

Anchors: BIP-39/32/44, BIP-84, SLIP-0010, NIP-06; `@noble`/`@scure`/`micro-key-producer`
(audited, Paul Miller); Vault, External-Secrets, cert-manager, spire (cluster);
`ace` (Zeta DLC package manager, B-0288).
