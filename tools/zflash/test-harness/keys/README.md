# `zeta-test-infra` SSH key — QEMU test-only, `--test`-scoped, NEVER production

The **zeta test infra SSH key** lets the QEMU harness SSH into **ephemeral test VMs** to assert the headless /
remember-creds / trust / self-heal flow **without real hardware or a human** (Aaron tests `gh auth` by hand; this
key tests everything else). Aaron, 2026-06-09: *"create a zeta test infra ssh key for testing everything else in
QEMU … the ssh key does NOT get regular USB trust on regular zflash usb/iso noun-verbs — that needs a `--test` flag
to trust those."*

## The two hard rules

1. **`--test`-scoped trust ONLY.** A regular `zflash` / regular ISO build / regular noun-verb **must never** trust
   this key. It is injected into the `zeta` user's `authorized_keys` **only** when an explicit **`--test`** flag is
   passed (a test-build path). It is **not** in `operator-ssh-keys.txt` / `maintainers/*/ssh-pubkeys.txt`
   (the production trust set).
2. **Private key is NEVER committed — it lives in the GH Actions secret `ZETA_TEST_INFRA_SSH_KEY`** (repo scope on
   `Lucent-Financial-Group/Zeta`; a dedicated `test` environment is the cleaner long-term home). The matching
   **public key `zeta-test-infra.pub` IS committed** here (safe — public; `--test`-scoped trust only). The QEMU
   workflow reads the secret into the runner, bakes `zeta-test-infra.pub` into the `--test` image, and SSHes into
   the ephemeral VM with the private key. The private key is `.gitignore`d; no secret in git.

## Generate it

```sh
ssh-keygen -t ed25519 -f tools/zflash/test-harness/keys/zeta-test-infra -N "" \
  -C "zeta-test-infra-EPHEMERAL-QEMU-ONLY-do-not-trust-on-real-nodes"
```

The harness then: bakes `zeta-test-infra.pub` into the **`--test`** ISO/flash → boots the VM in QEMU → SSHes in
with the private key → asserts (trust resolves, creds restore, cancel-window default-proceed, self-heal reconcile).

## Why this is safe

The key only ever authenticates to **ephemeral QEMU VMs that opted in via `--test`**. Even if the generated private
key leaked, it grants access to nothing real (no production node trusts it; production trust is the `--test`-excluded
`operator-ssh-keys` set). This is the standard "insecure test key" pattern, made stricter: ephemeral + gitignored +
flag-gated, not a committed fixture.

## To build (the `--test` flag)

- `zflash --test` / the test ISO build → inject `zeta-test-infra.pub` into `zeta` `authorized_keys` (test path only).
- Regular `zflash` / iso → **omit it** (production trust unchanged).
- See the keystone plan: `docs/research/2026-06-09-the-zeta-first-run-choose-your-own-adventure-…-three-lens-plan.md`
  and the remember-creds root-cause doc (KDF rebind, cancel-window, repair-loop).
