# Trajectory - Cluster Encryption / Credential Substrate

Status: active — first surfaced 2026-05-29 from substrate inventory (was tracked only as scattered backlog rows; never had a trajectory surface, which is why it was easy to lose at cold-boot)
Last refreshed: 2026-05-29
Type: workstream (current-focus) — a trajectory the operator is *actively powering*. Many trajectories can be tracked; only a few are workstreams at once (finite-focus / WIP-bounded — a workstream is a trajectory under sustained thrust, and thrust budget is finite, so most trajectories coast). ("Trajectory" is the genus; "workstream" is the species: a trajectory under sustained thrust toward a deliverable, vs. emergent-posture trajectories like `anti-infection`, which self-describes as "not a workstream with a cadence." See [`factory-trajectory-surface`](../factory-trajectory-surface/RESUME.md) for the genus/species taxonomy.) One of the operator's three current cluster workstreams (encryption / usb-zflash / ts-workflow-engine).
Eventual encoding (design-stage — the human maintainer 2026-05-23 genetic-ID substrate + Clifford/HKT): this trajectory's state is trackable as a 128-bit genetic-ID seed (discrete, reversible via parser-combinator ↔ generator-function) → Clifford-space path (continuous, eventual). Mirrors the three-lane I8-lattice / I9-manifold split.
Current blocker: none operationally; the live design tension is interactive-login-vs-baked-in-keys-vs-CI-test (B-0833)
Next concrete action: confirm B-0852 auth-method-picker + encrypted-blob impl status against the on-disk installer; resolve the B-0833 tension (how CI tests a full install without shipping credentials)

## Why This Exists

The "encryption" workstream is the credential/secret **security layer** for
cluster bringup: how SSH keys, hashed passwords, WiFi credentials, and host
tokens get securely onto cluster nodes without shipping secrets in the image.
It is the sibling of the `usb-zflash-installer` trajectory (the flashing
*mechanism*); this trajectory owns *what is encrypted, how it is bound, and
who is allowed to unlock it*.

It is distinct in altitude from `ai-sovereignty-path` Piece 1
(`docs/trajectories/ai-sovereignty-path/RESUME.md`), which covers abstract
cryptographic sovereignty (N-of-M HSM, master-key, KSK military-override).
This trajectory is the concrete cluster-bootstrap credential plumbing, not the
constitutional sovereignty substrate.

## Grounding backlog (on `origin/main`)

- [`B-0789`](../../backlog/P1/B-0789-iter4-ssh-key-and-hashedpassword-substrate-for-cluster-bringup-2026-05-26.md) — iter-4 SSH-key + hashedPassword substrate for cluster bringup (shared seam with usb/zflash)
- [`B-0852`](../../backlog/P1/B-0852-credential-persistence-on-usb-esp-plus-boot-sequence-auth-method-picker-encrypted-blob-bound-to-usb-uuid-plus-operator-passphrase-aaron-2026-05-27.md) — credential persistence on USB ESP + boot-sequence auth-method picker + encrypted blob bound to USB UUID + operator passphrase (live focal point)
- [`B-0852.3`](../../backlog/P1/B-0852.3-zeta-install-sh-step-6-77-cred-picker-integration-interactive-bake-vs-zflash-token-override-aaron-2026-05-27.md) — credential-picker integration (interactive-bake vs zflash-token override)
- [`B-0833`](../../backlog/P1/B-0833-installer-interactive-login-vs-baked-in-keys-ci-test-tension-resolve-without-shipping-credentials-aaron-2026-05-26.md) — interactive-login vs baked-in-keys CI-test tension (the live design question)
- [`B-0835`](../../backlog/P1/B-0835-installer-config-bugs-cluster-hostname-not-unique-gh-auth-not-respected-banner-password-disclosure-empirical-aaron-2026-05-26.md) — installer config bugs (gh-auth not respected, banner password disclosure)
- [`B-0853`](../../backlog/P1/B-0853-sigstore-cosign-artifact-signing-free-stuff-iso-containers-tarballs-backed-by-fulcio-rekor-aaron-2026-05-27.md) — sigstore/cosign artifact signing (ISO/containers/tarballs via Fulcio/Rekor)

## Composes with

- `usb-zflash-installer` trajectory — shares the B-0789 / B-0852 seam (creds-on-USB)
- `ai-sovereignty-path` trajectory Piece 1 — higher-altitude crypto-sovereignty (KSK/HSM); this trajectory is the concrete bringup layer below it
- B-0883 (noble-xwing / ML-DSA-65 CBOR envelope) — post-quantum credential-envelope design memo; **NOT yet on `origin/main`** (worktree-stage v1 design memo as of 2026-05-28); fold its anchors in once it lands

## Current Rule

No shipped keys. Credentials are operator-unlocked at bringup (encrypted blob
bound to USB UUID + operator passphrase, OR interactive login, OR zflash-token
override) — never baked into a distributable image. The CI-test path must
exercise a full install without that discipline leaking a real credential
(B-0833).

## Current Next Action

Audit B-0852 / B-0852.3 against the on-disk `full-ai-cluster/usb-nixos-installer/`
to report real impl status, then drive the B-0833 interactive-vs-baked-vs-CI
resolution. Operator's call on priority vs the sibling workstreams.
