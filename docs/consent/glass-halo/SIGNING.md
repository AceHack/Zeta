# Signing glass-halo commitments with Touch ID (Secure Enclave)

The strongest form of "identity = signature": a commit signed by a key that lives in
your Mac's **Secure Enclave** and is gated by your **fingerprint (Touch ID)**. The
fingerprint never leaves the chip; the **commit signature is the proof** that the
Touch-ID-gated key authorized that exact commit at that time.

## Why not "hash the fingerprint"?

We deliberately do **not** capture, export, or hash the fingerprint — that would be a
security/privacy anti-pattern (biometrics must stay on-device). Instead:

- The fingerprint **unlocks** a private key inside the Secure Enclave (the key never
  leaves the chip).
- That key **signs the commit**.
- The commit's signature is computed over the commit object (tree hash + author +
  timestamp), so it is **bound to that specific commit** and could only have been
  produced by the Touch-ID-gated key.

Net: the verified signature *is* the proof that the fingerprint was checked at commit
time — and it's stronger than a fingerprint-hash because the biometric never leaves the
device and the proof is bound to the exact commit.

## Setup (operator actions — your machine + your GitHub account)

These steps require your hardware (Secure Enclave + Touch ID) and your GitHub account,
so they are done by you, not by an agent.

### 1. Create a Touch-ID-gated Secure-Enclave SSH key

**Option A -- Secretive (GUI; recommended):** install
[maxgoedjen/secretive](https://github.com/maxgoedjen/secretive), create a key with
"require Touch ID" enabled, and copy its public key + the `SSH_AUTH_SOCK` it exports.

**Option B -- native macOS:**

```bash
sc_auth create-ctk-identity -l ssh -k p-256-ne -t bio
```

(`-t bio` = biometric/Touch-ID-gated; backed by `/usr/lib/ssh-keychain.dylib`'s
SecurityKeyProvider.)

### 2. Point git at it for signing

```bash
git config --global gpg.format ssh
git config --global user.signingkey "<path-to-public-key OR key string>"
git config --global commit.gpgsign true
# If using Secretive, ensure SSH_AUTH_SOCK is exported in your shell profile.
```

### 3. Add the public key to GitHub as a SIGNING key

GitHub → Settings → SSH and GPG keys → New SSH key → **Key type: Signing Key** → paste
the public key. (A signing key is separate from an auth key; this is what powers the
"Verified" badge.)

## The proof

- Every `git commit` now prompts **Touch ID** — the Secure-Enclave key will not sign
  without your fingerprint.
- Verify locally: `git log --show-signature`
- GitHub shows **Verified** on the commit.
- The signature is bound to the commit (tree + author + timestamp), proving the
  Touch-ID-gated key signed *that* commit at *that* time.

## For glass-halo

A glass-halo commitment (`docs/consent/glass-halo/<name>.md`) committed this way is a
**Touch-ID-gated, cryptographically verifiable signature** — the binding form. The plain
commit-author identity (per the README) is the "for now" baseline; the Touch-ID-signed
commit is the escalation. A DocuSign-executed record (e.g. for participants who prefer a
real-estate-style flow) is an equivalent escalation; attach its reference in the commit.

## What we never do

- We never capture, store, transmit, or hash your fingerprint or any biometric data.
- The biometric stays in the Secure Enclave; we rely on the **commit signature**, not on
  any biometric record.

## References (verified 2026-05-30)

- [maxgoedjen/secretive — Secure-Enclave SSH keys](https://github.com/maxgoedjen/secretive)
- [Native Secure-Enclave-backed SSH keys on macOS (sc_auth create-ctk-identity)](https://gist.github.com/arianvp/5f59f1783e3eaf1a2d4cd8e952bb4acf)
- [How to sign Git commits with SSH keys on macOS](https://www.flsilva.com/blog/how-to-sign-git-commits-ssh-keys-macos)
- [Hardening SSH access to GitHub with Touch ID](https://gist.github.com/emmakat/2226e3e5bc94678da77ba7a62c93a9e2)
