# The console password when none is typed is an install-time policy; the repo default is the public password

**Date:** 2026-10-01 · **Status:** accepted — **the repo owner's decision** (maximdolphin, who owns this repo and the
hardware it was found failing on). Supersedes the "mint, else lock" behaviour of PR #17796 *as the default*; that
behaviour stays, as the explicit `mint` policy.

## Context

PR #17796 (docs/ops/INSTALL-TIME-CONFIG.md row 19) retired the well-known console password `zeta-change-me`: with no
password typed at the installer prompt, each install minted a random one-time password, showed it once on
`/dev/console` + `/dev/tty1`, and LOCKED the account when nobody could be shown it. That is the safer behaviour for a
fleet.

On the owner's real node it failed in the way a show-once secret fails: the minted password scrolled off the console,
SSH worked (key login), but `sudo` needs the account password, so nobody could run a privileged fix. The owner was
locked out of their own machine's root.

## Decision

The behaviour is an **explicit install-time policy**, not a silent revert:

`ZETA_CONSOLE_PASSWORD_POLICY = default | mint` — carried like `--lb-pool` / `--public-domain`: zflash
`--console-password default|mint` → ESP `/zeta-firstboot.conf` → exported by `zeta-first-boot.sh` → resolved in
`zeta-install.sh` **before the wipe** (an unknown value refuses the install, nothing wiped).

| step | outcome |
|---|---|
| a password **typed** at the installer prompt | always wins; both policies |
| none typed, policy **`default`** (**repo default**) | the PUBLIC `zeta-change-me`: its sha512crypt hash (stdin, never argv) in the hash file + marker `/etc/zeta/initial-password-default`; **no lock, no mint**; a loud banner on stdout + `/dev/console` + `/dev/tty1`, repeated in the install-complete summary; a login-shell reminder from first boot until the hash changes |
| none typed, policy **`mint`** (explicit opt-in) | today's #17796 behaviour: minted one-time password, locked if unseen |

Unchanged on purpose: applied **once** (state file — a later `passwd zeta` is never reverted by activation); SSH
`PasswordAuthentication = false` (`common.nix`); the install-complete banner still discloses no password literal.

The default is **`default`** because the owner chose it for their installs and it is their repo. It is not a claim
that the public password is safe.

## The risk, stated plainly

Under `default`, **anyone with console access to the node is root via `sudo`** (the account is in `wheel`;
`wheelNeedsPassword` is true, and the password is public). The threat model is **physical access**. SSH password login
stays off, so this adds no network password surface — but a node on exposed or shared hardware, a colo, or anywhere a
stranger can reach a keyboard or a KVM should be flashed with `--console-password mint` (or have a password typed at the
installer). The loud banner and the reminder exist so that choosing `default` is never a quiet state.

To switch an existing node: `sudo passwd zeta` (the reminder clears within one 5-minute timer tick). To switch the
behaviour for new installs: `zflash --console-password mint`.

## What is proven and what is not

Proven by tests that fail without this change: the policy parser/renderer; the zflash flag on the file-backed, device
and Windows paths and the shared planner (conf line, refusal of junk, `--no-inject` contradiction); the shell policy
resolver and Step 6.55 branches (typed wins / `mint` / `default` / invalid refuses loudly) executed under bash; the
`default` hash is a real sha512crypt of the public password fed on stdin; the ISO's own conf never carries the policy
and `zeta-first-boot.sh` passes through `${VAR:-}` with no policy of its own; SSH `PasswordAuthentication` is `false` and
the module never touches it.

**Not proven:** nothing was evaluated by Nix and nothing was booted (no nix on the authoring machine). The activation
branch, the `zeta-default-password-reminder` service/timer and the `interactiveShellInit` snippet are checked by
reading their text; the first real exercise is a NixOS build and an install.

## Pointers

- `docs/ops/INSTALL-TIME-CONFIG.md` row 19 · `full-ai-cluster/INJECTION-POINTS.md` §3
- `src/Core.TypeScript/installer/console-password-policy.ts` — the validated spelling, with its shell twin in `zeta-install.sh`
- `full-ai-cluster/nixos/modules/initial-password.nix` — activation (once) and the reminder
