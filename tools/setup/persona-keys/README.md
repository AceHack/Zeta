# Zeta keyrings — one seed phrase, every key type, type-separated

> **Building a privileged operation that needs a human?** Do not hand-roll the prompt,
> the credential read, or the refusal. Call `runGatedCeremony` from
> [`ceremony-handoff.ts`](ceremony-handoff.ts); the protocol and a worked walkthrough are in
> [`docs/protocols/ai-human-secure-handoff.md`](../../../docs/protocols/ai-human-secure-handoff.md).
> The ceremony surfaces in this directory are `ceremony-gate.ts` (is a human needed?),
> `ceremony-brief.ts` (what they are told), `ceremony-handoff.ts` (the protocol around the
> gate) and `biometric.ts` (the fail-closed door).

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

## Critical infra: byte-lock (4 langs × 4 serializers) + key status + human anchor

Key derivation is **critical infrastructure** and **a point of certainty in the
4×4 grid** (4 language oracles × 4 serializers) — a deterministic SolidGround in
the markov/homeostat chains. So:

- **Byte-lock golden vector** — `golden-vectors-keyring.json` pins a known test
  seed → exact public outputs (text/hex-in-JSON, per `no-binary-in-proof-lineage`:
  diffable, DST-replayable, human-auditable). **Every oracle (TS now; F#/C#/Rust
  next) × serializer (JSON now; CBOR/Arrow/protobuf next) must reproduce it
  bit-perfect.** `gen.test.ts` is the TS oracle's conformance test (passing).
- **Key status** — `keyring-public.json` carries `status`: `bootstrap-test`
  (Otto generated it; the human does NOT hold the seed — provisional) →
  `self-custody` after the human `rotate`s to a seed they hold. Treat
  `bootstrap-test` keys as test until rotated.
- **Human anchor** — `anchors`: the human is anchored to **GitHub (the first trust
  root)** + a **FIDO/WebAuthn/Windows Hello** biometric credential, recorded at
  rotate/anchor time.

## Security invariants

1. **The seed phrase is never a CLI argument** (ps / shell history would capture
   it). It is either generated in-process (`generate`) or read with `read -s`
   (no echo, not added to history) and piped via **stdin** (`import`).
2. **Private key material never goes to stdout/history.** It goes to a sink:
   Vault or a GitHub secret. The temp file is `umask 077` + `shred`-on-exit.
3. **Public artifacts are safe to publish** — pubkeys / addresses / npub go to
   `maintainers/<name>/` and are committed to `main`.

## Per-MACHINE device key + (user × machine) status — `machine.ts` / `machine-cli.ts`

The keyring above is the **per-PERSONA** identity (one seed → all key types, same on
every machine). A **per-MACHINE** key is different: a per-host ed25519 device keypair
(NOT seed-derived) that identifies *this dev machine*, traceable to its persona. This
is the first SAFE slice of the unified onboarding item
(`081KVM1TK3Z08QG0R0002959G6`) — read-mostly, secret-conservative.

> **PURE-KEY MODEL (Aaron 2026-06-21).** A **user key** is a person's identity
> (the persona keyring, machine-independent). A **machine key** is a host's identity,
> **user-independent** — ONE per machine, **shared across users**, with **NO `user@`**
> in its label. The **(user × machine) binding is a CA cert** (`ca.ts signMachineCert`,
> `principal=<user>` signed over the machine key) — the **only** place the pair is named.
> Certs are cheap/ephemeral/revocable, **not counted as keys**. This scales
> **O(users + machines)**, not the hybrid `user@machine`'s O(users × machines). A
> machine key is therefore **never** uploaded to a user's GitHub.

- **`status` / `whoami` (READ-ONLY, generates nothing):** the workitem's two-part
  presence check — is the **user keyring** present and is **this dev machine's**
  machine key present, checked **independently** (you flash from many dev machines, so
  the user key is often set up while a new flasher box's key is not):

  ```bash
  bun machine-cli.ts status --user aaron
  # user=aaron present=y, machine=<host> key present=n, machine key published=n
  ```

- **`machine` (generate the PURE per-MACHINE key ONLY):** generates a standard
  `ssh-keygen -t ed25519` keypair if absent (idempotent — a second run is a no-op),
  with the **label = the machine only** (`<host> (zeta-machine)`, no `user@`). The
  **private** key stays local under `~/.config/zeta/machine/` (`umask 077`);
  `--publish` writes **only the PUBLIC** key to the **user-independent** machine
  registry `machines/<host>.pub` (repo root — NOT under `maintainers/<user>/`).
  An optional `--owner <name>` is attribution **metadata only** (never in the key
  label). `--dry-run` generates nothing.

  ```bash
  bun machine-cli.ts machine --dry-run                 # prints plan, generates NOTHING
  bun machine-cli.ts machine --publish                 # local machine key + public to machines/ (NOT committed)
  ```

- **`ca-cli.ts cert` (the (user × machine) binding):** signs the PURE machine key from
  `machines/<host>.pub` into a cert with `principal=<user>` — the ONLY place the user
  and machine are paired. `bun ca-cli.ts cert --user aaron --machine <host>`.

- **`publish-cli.ts` (publish a USER's GitHub auth key):** `--key` is **required** (a
  machine key is not a GitHub auth key, so there is no machine-key default). Biometric-
  gated, PUBLIC-only: `bun publish-cli.ts --user aaron --key <user-pub>`.

**Security invariants (same as the seed keyring):** no seed / CA / persona key is
generated by `machine` — only a per-host machine keypair; the private key never
touches argv / stdout / git; only public keys/fingerprints are published; **no `user@`
in the machine key label**; the machine registry is user-independent.

- **`setup-machine-cli.ts` (ONE command, ONE fingerprint):** the top-level payoff —
  `status → user-keyring(instruction) → machine-key → trust-resolve → cert-sign`, all
  under ONE biometric approval. **Realize-CA-when-missing:** if **no local CA** exists
  (`~/.config/zeta/ca/`), it **realizes one** (`ensureCa`, under the *same* approval —
  no second prompt) then signs, so a fresh host ends with CA + machine key + cert in one
  step. Idempotent (an existing CA is a no-op); fail-closed (decline → nothing, incl. no
  CA). **Deferred:** if this host is *joining* a cluster whose CA lives elsewhere, sign
  via the CA holder instead (the readout names this so you can re-home a local CA).

  ```bash
  bun setup-machine-cli.ts --user aaron --dry-run   # plan only — shows "would realize CA"
  bun setup-machine-cli.ts --user aaron             # one command, one fingerprint
  ```

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

## New-maintainer onboarding blueprint — GENERATE-THEN-ROTATE

The easy, stupid-proof path (Aaron 2026-06-09: *"act like I'm stupid, should not
be hard"*). Two steps, and it **exercises both code paths from the jump**:

1. **Otto bootstraps (the awkward bits).** Otto runs `generate <name>` — derives the
   whole keyring, stores the private bits in the sink, publishes your pubkeys to
   `maintainers/<name>/`. You're running immediately; you never had to touch a seed.
2. **You take self-custody — `rotate`.** You run `keyring.sh rotate <name>` and pick:
   - **[g]enerate** — a fresh seed phrase is **shown to you once**. **Write it on
     METAL** (fireproof/waterproof) or paper, in 2 safe places. Never photograph it,
     never paste it anywhere digital. Type `SAVED` to continue. *(No CLI password
     manager for the root seed — physical/metal is the primary.)*
   - **[i]mport** — paste a seed you already hold (typed hidden, never logged).
   Then the keyring is re-derived from *your* seed, re-stored, and your pubkeys
   re-published — superseding Otto's bootstrap. Now **you** hold the root.

Generate-then-rotate means: Otto does the hard setup, you own the seed, and both
the `generate` and `rotate` paths are proven working on day one.

## Usage

```bash
# Persona (fresh seed in-process, seed not shown) -> Vault, pubkeys to repo:
keyring.sh generate otto --vault zeta/personas/otto
# Persona, github-free mode:
keyring.sh generate otto --gh-secret ZETA_PERSONA_OTTO_KEYRING
# Maintainer bootstrap (Otto does the awkward bits):
keyring.sh generate aaron --gh-secret ZETA_MAINTAINER_AARON_KEYRING --out maintainers/aaron
# Maintainer self-custody (you pick + write down the seed; supersedes bootstrap):
keyring.sh rotate aaron --gh-secret ZETA_MAINTAINER_AARON_KEYRING --out maintainers/aaron
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
`ace` (Zeta DLC package manager, 081KR2E4K0008QG0R002YE3MMD).
