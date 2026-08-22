# Decision: PKI + secret/key/vault custody is HEXAGONAL — stable ports, swappable adapters

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** accepted (direction) · **Class:** security · **Trajectory:** cluster-encryption-credential-substrate

## Carved sentence (Aaron 2026-06-21)

> *"We will hexagonal it like everything else, all our other interfaces — PKI and
> password/key/vaults become swappable as long as we follow best practices."*

Ports & adapters (Cockburn's hexagonal architecture) for the credential substrate: the
**ports** are stable interfaces; the **backends** (1Password, Bitwarden/Vaultwarden, Vault,
macOS Keychain, cert-manager, local files) are **swappable adapters**. The **port contract IS
the "best practices"** — any adapter that satisfies it is safe to swap in. This is
`interfaces-free-classes-earned` applied to custody: the port is the free interface; each
adapter is an earned, contract-bound implementation.

## The ports (interfaces) + their adapters

| Port (stable interface) | Contract (the "best practices") | Adapters (swappable) |
|---|---|---|
| **SecretStore** — `set/get/del <name>` | encrypted at rest; never echo; least-privilege scope; revocable | macOS Keychain (`secret-clip.sh`) · 1Password (`op`) · Bitwarden/Vaultwarden · Vault · Win Cred Mgr · Linux secret-service |
| **KeyCustody / SshAgent** — hold a private key; **sign without exposing** | private bytes never leave the custody boundary; consent/biometric gate; revocable | local file (default, no dep) · **1Password SSH agent** · Secure Enclave / `-sk` · Vault SSH |

> **Conformance note 2026-08-14 (Nazar).** The FROST share port contradicted this row: `FrostShareAdapter.loadShare` returned the share scalar, so "private bytes never leave the custody boundary" was false for every adapter behind it. The port was split — `tools/setup/persona-keys/frost-partial-signer.ts` is the signing port and has **no scalar-returning method** (`commit` then `signPartial`, RFC 9591 two rounds); `loadShare` was demoted to the explicitly-named `ExtractingFrostShareAdapter` for the operations that genuinely need the scalar (keygen write-out, re-seal, backup, migration), and the bulk extractor was deleted. **The signing port now honours this row structurally. The only shipped implementation is software** and declares `exposureBoundary: "signer-function"` — the scalar is in one function frame rather than the caller's process, which is a narrower window and *not* the guarantee. A conforming adapter (`"hardware-boundary"`) needs FROST-aware firmware; see the PKCS#11 finding in that file.
| **CertAuthority (PKI)** — sign a cert; hold the CA | CA private never echoed/committed; principal=user; N+M (Key ID=machine); validity window | local `ssh-keygen` CA (`ca.ts`, today) · Vault SSH secrets engine · cert-manager |
| **Consent gate** — physical-presence approval | fail-closed; one-approval-per-run | Touch ID (pam_tid) · Windows Hello · fprintd |

Generators / callers depend on the **port**, never a concrete adapter — so the substrate is
adapter-agnostic and DST-testable (inject a fake adapter).

## What this resolves (incl. the 1Password SSH questions, Aaron 2026-06-21)

- **"don't require 1Password, but take full value of it"** = the **port is mandatory**, the
  **adapter is swappable**: the **local-file adapter is the no-dependency default**; the
  **1Password adapter is the full-value opt-in** (SSH agent, git commit signing, bookmarks —
  https://www.1password.dev/ssh/agent · /git-commit-signing). Same port, richer adapter.
- **"did we import the SSH key like [the 1Password SSH-key flow]?"** — No. We used the
  **SecretStore** port's *document* capability (backup only: `op document create`). The
  1Password **SshAgent** adapter (native SSH-key item → agent-served) is a *different port*
  (sign-without-exposing). Backup ≠ agent custody; both are valid, behind different ports.
- **"value in a flow that never saves the ssh/gpg locally?"** — **Yes**, real value: it's the
  **KeyCustody port with a non-extractable adapter** (1Password agent / Secure Enclave / Vault)
  — strongest custody, zero local-disk attack surface, biometric-gated, git-signing. But it's a
  hard dependency on that adapter, so it is an **opt-in mode**, not the default. The default
  stays local-generate (no dependency) + optional upload (backup).

## Migration is an adapter swap, not a redesign

Because callers bind to ports, the planned moves are adapter swaps with NO call-site change:
local-file → 1Password agent → Vault/Secure-Enclave (KeyCustody); local `ssh-keygen` CA →
Vault SSH / cert-manager (PKI); Keychain → 1Password/Vaultwarden (SecretStore). The
event-sourced authorization layer (grant/revoke fold) sits ABOVE these ports unchanged.

## The endgame adapter: Zeta's own DB as first-class PKI (Aaron 2026-06-21)

> *"our db is going to be a first class PKI infrastructure too, so all this will be swappable
> with our own eventually."*

The reason the hexagon exists: the **final adapter behind every port is Zeta's own DB/substrate**
— a first-class, self-hosted PKI + secret/key store. Every external adapter (1Password, Vault,
cert-manager, Keychain) is a *bridge* we swap out once the DB-native adapter lands, with **zero
call-site change** (that is the whole point of binding to ports). The DBSP/Z-set substrate is
already the natural home: the **event-sourced authorization fold** (grant/revoke as Z-set deltas)
IS the DB acting as the authorization store; extending it to **issue/hold certs + secrets + keys**
makes the DB the `CertAuthority` + `SecretStore` + `KeyCustody` adapter natively. So the path is:
external custody (now, bootstrap) → our DB as first-class PKI (eventually) — same ports, same
best-practices contract, our own implementation. Anchors the credential substrate to the
self-modeling-database end-goal (`docs/research/2026-06-10-the-end-goal-dual-use-hard-soft-self-modeling-database-…`).

**Crypto is BAKED INTO the DB code, not layered on (Aaron 2026-06-21):** *"we are tying this all
deeply into our DB too, so our database code has crypto baked in."* The DB doesn't just *become*
the PKI/SecretStore adapter — crypto is **integral to the substrate**: `DynamicValue`
encrypt/decrypt is a **transform** (a memory-fence over canonical CBOR — "privacy is a transform,
not a 5th codec", PRIMITIVE-REGISTRY), events are **signed**, values can be **encrypted at the
cell**, and the PQ `.zc` envelope (`better-git-crypt`: ML-KEM-768/ML-DSA-65/X-Wing) is the
storage codec. So the crypto-agile keychain, the PKI, and the secret store aren't bolted onto the
DB — they ARE the DB: a **crypto-native** Z-set/DBSP substrate where encryption, signing, and key
custody are first-class storage operations. That is what makes the DB-as-PKI endgame adapter real
rather than aspirational — the ports terminate in a substrate that already speaks crypto.

## Build status (today)

Shipped adapters: SecretStore→macOS Keychain (`secret-clip.sh`) + 1Password (`op`);
CertAuthority→local `ssh-keygen` (`ca.ts`, N+M); Consent→Touch ID. The ports are currently
*implicit* (the shapes exist across `secret-clip.sh`/`op-token-setup.sh`/`ca.ts`); formalizing
them as explicit interfaces (so adapters are truly drop-in) is the build-out — see backlog
081KVNTNTDQ08QG0R0017NBBWB (vault separation) + 081KVNRSGVR08QG0R003R3RNJX (secret-clip cross-OS)

+ 081KVNMFYS808QG0R002D0VM64 (Vaultwarden via ArgoCD). KeyCustody (SSH-agent) port = new follow-up.

## The second axis the ports abstract: TRUST TOPOLOGY (Aaron 2026-06-21)

The ports abstract not just the vendor but the **trust topology** — where trust originates and
who holds the authority. Each adapter sits somewhere on top-down ↔ bottom-up ↔ traveler-framed:

| Topology | Trust origin / authority | Adapters |
|---|---|---|
| **Top-down PKI** | a root authority issues trust downward (X.509 hierarchy) | our **SSH-CA** (`ca.ts`) — the cluster bootstrap |
| **Bottom-up, centralized** | individual is the root; infra is a 3rd party | **1Password**, Bitwarden cloud |
| **Bottom-up, decentralized** | individual is root AND self-hosts the infra | **Vaultwarden** / self-hosted Bitwarden (the OSS lane) |
| **Traveler-framed** | frame-relative + relational — NO single mandatory root; parties establish trust in a shared frame | **Zeta DB-as-PKI** (the endgame) |

1Password's shape: **bottom-up at the edge** (you are the root of your own vault) but
**centralized at the infrastructure** (1Password Inc. operates the substrate). The OSS
self-hosted version (Vaultwarden) moves it down to **bottom-up + decentralized** — trust both
originates and *resides* with you.

**Why this matters (manifesto §1):** top-down PKI is a **central point of control** — it violates
scale-free. So Zeta's *endgame* PKI is **bottom-up + traveler-framed** (frame-relative trust, no
mandatory root — the same shape as the beach/traveler meeting protocol and the multi-oracle "no
single mandatory morality"). The SSH-CA is the top-down **bootstrap**; the hexagonal ports are
exactly what let us **slide top-down-bootstrap → bottom-up-decentralized → traveler-framed-DB-PKI
with NO call-site change.** The ports abstract the trust topology itself, not just the vendor —
which is the whole value ("the interfaces are the valuable thing").

## Anchors

Cockburn, *Hexagonal Architecture* (ports & adapters). In-repo:
[`interfaces-free-classes-earned-under-rules.md`](../../.claude/rules/interfaces-free-classes-earned-under-rules.md)
(port = free interface, adapter = earned class), noninterference §13 (adapters are the declared
metered channels). 1Password SSH: https://www.1password.dev/ssh/manage-keys ,
/ssh/agent , /ssh/git-commit-signing , /ssh/bookmarks. Migration targets: Vault SSH secrets
engine, cert-manager.
