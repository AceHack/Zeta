# Decision: multi-owner machines via identity↔authorization split (SSH-CA bootstrap → Vault)

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** accepted (bootstrap slice) · **Class:** security

## Question

How do we express per-machine, multi-owner permissions — *Machine A owned by aaron;
D by aaron+addison; G by all three* — and **add a new person to some machines later**
without re-keying the fleet? And: **are we just rebuilding Vault / cert-manager?**

## Decision — separate IDENTITY from AUTHORIZATION

The N×M trap (a cert / key per user×machine pair) is avoided by putting the two
concerns in two different layers:

### 1. Identity = user certs (N, one per person)

The CA signs each **user's** key into a cert with `principal=<username>`
(`aaron`, `addison`, `max`). Machine-independent — it asserts *"I am aaron."*
One cert per person. This is the layer that means "who you are."

> Note vs today: the current `ssh-ca.nix` signs device/machine keys with a generic
> `principal=zeta`. The multi-owner model needs **per-user** principals — user certs
> carry the human's name; that name is what authorization matches on.

### 2. Authorization = per-machine authorized-principals list (M, one per machine)

Each machine trusts the CA (`TrustedUserCAKeys`, already in `ssh-ca.nix`) **and**
declares which principals may use it, via OpenSSH `AuthorizedPrincipalsFile`
(`sshd_config`). Ownership is a **list of usernames per machine** — plain data:

| Machine | AuthorizedPrincipals |
|---|---|
| A | `aaron` |
| B | `addison` |
| C | `max` |
| D | `aaron addison` |
| E | `aaron max` |
| F | `addison max` |
| G | `aaron addison max` |

**3 user certs + 7 machine lists = 10 artifacts**, not 21. Ownership is *data*
(a per-machine principals list), never a cryptographic re-binding.

### 3. Host identity = host cert (separate, optional)

A machine's *host* key may also be signed (host cert) so clients can verify the host.
This is orthogonal to user access control — don't conflate it with §1/§2.

## Adding a person later (the payoff)

Add "Dana", give her D + G:

1. Issue Dana **one** user cert (`principal=dana`) — one signing, one fingerprint.
2. Add `dana` to the AuthorizedPrincipals list of **only D and G**.

Nobody else's keys or certs are touched. New person = **1 cert + edits to the specific
machines** — O(1 + |machines she joins|), never a fleet re-key. Removing access =
delete the principal from a machine's list (and, for key compromise, a KRL revoke).

## Are we rebuilding Vault / cert-manager? — Yes, the bootstrap only

The trust model is **deliberately identical** to what we migrate to, so migration is a
custody swap, not a redesign (`ca.ts` header: *"Migration (no model change): git-distributed
CA pubkey → Vault custody + cert-manager issuance/rotation later (same shape)."*):

| Concern | Bootstrap (now) | Vault / cert-manager (later) |
|---|---|---|
| CA private key | local file, mode 600 | Vault / HSM — never on disk |
| Signing | `setup-machine` + Touch ID | Vault SSH secrets engine, on-demand |
| Rotation | re-run, +52w validity | cert-manager auto-renew, short-lived |
| Principals source | nix config lists (this doc) | identity provider |
| CA pubkey distribution | git | git / Vault |

**The line we hold:** build the *thin bootstrap* of this model and stop. The moment we
reach for a revocation-list manager, a rotation daemon, or a principals-management UI —
that is Vault/cert-manager's job, and hand-rolling it is the trap. Aaron's *"all will
transition to certmanager/keyvault based certs later"* made concrete. **Private-key
custody is exactly what Vault takes over** — until then the CA private key is a local
mode-600 file + (recommended) an offline encrypted backup in the human's custody; the
machine key wants a hardware-backed home (Secure Enclave / `-sk`) so it is non-extractable.

## What to build now (the slice)

1. **Multi-principal cert signing** — `signMachineCert` / the signer takes `users: string[]`
   → `-n aaron,addison` (today it takes one). Foundation for §1/§2.
2. **Per-machine principals data** — a declarative ownership table (`machines/<host>` →
   principals), the single source of the matrix above.
3. **Render `AuthorizedPrincipalsFile`** in `ssh-ca.nix` from that data (pathExists-guarded,
   inert until populated — same discipline as the existing CA-pubkey guard).
4. Keep `--dry-run` inert, one-fingerprint, fail-closed, no secrets in git — unchanged invariants.

Deferred (YAGNI until needed; artifacts are temporary/regenerable per Aaron): KRL/revocation
tooling, rotation automation, host certs — all Vault/cert-manager territory.

## Anchors

OpenSSH `AuthorizedPrincipalsFile` / `TrustedUserCAKeys` (`sshd_config(5)`); BLESS-style
short-lived SSH certs (Netflix/Facebook); HashiCorp Vault SSH secrets engine; Jetstack
cert-manager. Pure-key model: keys O(N+M), the (user×machine) pairing lives in the
principal list, never a composite identifier (the #8926 / Key-ID-N×M lesson, 2026-06-21).
