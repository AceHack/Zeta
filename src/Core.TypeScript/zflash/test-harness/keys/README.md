# `zeta-test-infra` SSH key — QEMU test-only, `--test`-scoped, NEVER production

The **zeta test infra SSH key** lets the QEMU harness SSH into **ephemeral test VMs** to assert the headless /
remember-creds / trust / self-heal flow **without real hardware or a human** (Aaron tests `gh auth` by hand; this
key tests everything else). Aaron, 2026-06-09: _"create a zeta test infra ssh key for testing everything else in
QEMU … the ssh key does NOT get regular USB trust on regular zflash usb/iso noun-verbs — that needs a `--test` flag
to trust those."_

## The two hard rules

1. **`--test`-scoped trust ONLY — trust is asymmetric, one-directional.** A regular `zflash` / regular ISO build /
   regular noun-verb **must never** trust this key. The test key is injected into the `zeta` user's
   `authorized_keys` **only** when an explicit **`--test`** flag is passed.
   - **`--test` build trusts `{prod operator keys} ∪ {zeta-test-infra}`** — so test/QEMU machines are reachable by
     the **real production credentials** and the QEMU suite exercises the _actual prod-credential path_, not an
     isolated test-only path. (Aaron: _"--test can also test the prod credentials."_)
   - **Production build trusts `{prod operator keys}` ONLY** — the test key is **never** in
     `operator-ssh-keys.txt` / `maintainers/*/ssh-pubkeys.txt`.
   - **The asymmetry:** _test machines may trust prod; prod never trusts test._ Adding prod keys to a test machine
     changes nothing (they're already trusted everywhere); adding the test key to prod would be the breach — so it
     never happens. "No one grants the test key access to real machines; test machines can trust real machines."
2. **Private key is NEVER committed — it lives in the GH Actions secret `ZETA_TEST_INFRA_SSH_KEY`** (repo scope on
   `Lucent-Financial-Group/Zeta`; a dedicated `test` environment is the cleaner long-term home). The matching
   **public key `zeta-test-infra.pub` IS committed** here (safe — public; `--test`-scoped trust only). The QEMU
   workflow reads the secret into the runner, bakes `zeta-test-infra.pub` into the `--test` image, and SSHes into
   the ephemeral VM with the private key. The private key is `.gitignore`d; no secret in git.

## Generate it

```sh
ssh-keygen -t ed25519 -f src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra -N "" \
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
