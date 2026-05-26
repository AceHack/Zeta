---
id: B-0835
priority: P1
status: open
title: installer config-bugs cluster — hostname not unique (shows control-plane); gh login not respected; login banner shows password text (default OR custom) (empirical from 2026-05-26 physical hardware-support test) (Aaron 2026-05-26)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - B-0754
composes_with:
  - B-0831
  - B-0832
  - B-0833
  - B-0834
tags: [installer, first-boot, hostname, gh-auth, login-banner, password-disclosure, operator-ux, physical-hardware-support-test, empirical-anchor, bug-cluster]
---

## Problem

Three install-config bugs surfaced in the same 2026-05-26 physical
hardware-support test session (4th, 5th, 6th empirical anchors after
B-0832 nmtui WiFi + B-0833 auth-tension + B-0834 log preservation).

Operator framing across two messages:

> "it does not appear to be using my login and it says control-plan
> login like it's not respecting the unique host name either."

> "the password i set it still says password: zeta-change-me"

> "also we don't want to show the password i set either"

### Bug 1 — hostname is `control-plane`, not unique `node-<6hex>`

Login prompt shows `control-plane login:`. Expected (per
`zeta-install.sh` line 487-498 iter-5.2.2 substrate): auto-generated
unique `node-<6hex>` hostname when no `zeta-hostname.txt` on USB ESP.

Hypotheses:

- The iter-5.2.2 generate-on-node code path didn't fire (install
  failed before Step 6.6 OR the hostname-gen block was skipped)
- The generated hostname was written to `/mnt/etc/zeta/cluster-node-id`
  but `injected-hostname.nix` module didn't read it (path mismatch OR
  module not active in the flake's host attribute)
- The flake's `control-plane` attribute hardcodes
  `networking.hostName = "control-plane"` and overrides the
  `injected-hostname.nix` module's `mkDefault` setting

Diagnosis: check whether `/etc/zeta/cluster-node-id` exists on the
installed system AND check `cat /etc/hostname`. If the file exists
but `/etc/hostname` shows `control-plane`, the module-vs-flake
priority is wrong.

### Bug 2 — gh login not respected

Operator: *"it does not appear to be using my login"*. Either:

- `gh auth login` step didn't run (install failed before reaching it
  — composes with B-0834 install-log preservation)
- `gh auth login` ran but auth flow didn't complete (no PAT obtained)
- `gh auth login` completed but the PAT wasn't used downstream (git
  clone of cluster repo OR SSH key injection step)
- `gh ssh-key list` didn't return operator's pubkeys (account auth
  succeeded but key-list call failed)

Diagnosis: check `/root/.config/gh/hosts.yml` on installed system for
operator's GH user; check `/etc/zeta/operator-ssh-keys.nix` for
populated pubkey array; check `git -C /etc/zeta remote -v` for the
clone URL + verify it pulls without credentials prompt.

### CORE REQUIREMENT (operator 2026-05-26 reframing)

> "also i should not have to log in for any of this to start that
> defeats the purpose the machine should be fully operational after
> usb install and reboot no need for me to login it self registers
> and creates/joins cluster without intervention."

The bugs below are SUB-FAILURES of this core requirement. The
substrate-engineering target is **post-boot fully-operational
chain WITHOUT operator login**:

1. USB installed → reboot
2. Installed system boots with correct hostname (`node-<6hex>` OR
   operator-injected)
3. Network comes up
4. Auto-restore gh auth from install-time secret
5. **Auto-self-register** to
   `maintainers/<operator>/cluster-nodes/<hostname>/...` per B-0812
   iter-5.4.1
6. ArgoCD pulls in + reconciles per B-0813 iter-5.4.2
7. Node is fully operational as a cluster member

Operator NEVER logs in. Console login is for diagnostics only. Bugs
1-3 are mostly noise relative to this core requirement; Bug 4
(self-reg didn't happen) is the CRITICAL FAILURE.

### Bug 3a — login banner shows password text (display bug; small fix)

`full-ai-cluster/nixos/modules/login-banner.nix` line 24:

```
│    password: zeta-change-me (rotate after first)   │
```

This is hardcoded text. It shows REGARDLESS of whether the iter-5.3
prompt-for-initial-password substrate (zeta-install.sh Step 6.55)
successfully changed the password to operator's chosen value.

Operator's clarification: *"also we don't want to show the password
i set either"* — even when iter-5.3 successfully changed the password
to the operator's choice, the banner should NOT display it. Showing
any password (default OR custom) on the login banner is a security
leak (anyone with physical access to the screen can see it).

The cleanest fix: REMOVE the password line from the login banner
entirely. The password is documented separately (zflash output +
zeta-install.sh stdout) at install-time only; it should never appear
on the running system's display.

### Bug 3b — custom password is operationally ignored (NOT just display) — root-caused

Operator clarification 2026-05-26: *"the password error is not just
display issue it's operational bug the password i set earlier in
install is ignored"*.

**Root cause** (substrate diagnosis): timing mismatch between when
`zeta-install.sh` writes the hash file and when `initial-password.nix`
reads it.

| Step | Where | Path | Status |
|---|---|---|---|
| zeta-install.sh Step 6.55 writes hash | Live ISO chroot to install target | `/mnt/etc/zeta/initial-hashedpassword` | File written correctly |
| `nixos-install` evaluates flake | Live ISO build-time evaluation | Reads `builtins.readFile "/etc/zeta/initial-hashedpassword"` per `initial-password.nix` line 41+46 | **Fails** — path doesn't exist in eval context |
| Module falls back to default hash | `initial-password.nix` line 59 | `fallbackHash` (sha512crypt of `zeta-change-me`) | **Default applied** |
| Installed system boots | Real hardware | Has the file at `/etc/zeta/initial-hashedpassword` (from /mnt copy) BUT user config was built with `fallbackHash` | Custom password file present + ignored |

**Why it fails**: flake pure-mode evaluation can't read non-store
absolute paths like `/etc/zeta/initial-hashedpassword`. Even if Nix
allowed it, the path during `nixos-install` evaluation is the LIVE
ISO's path (no file there) not the install target's `/mnt/etc/zeta/`
(file there).

### Bug 4 — self-registration to cluster did NOT happen (CRITICAL)

Verified via `gh api`: `maintainers/aaron/cluster-nodes/` does NOT
exist on the repo (only `maintainers/aaron/legal-entities/`). The
B-0812 iter-5.4.1 self-registration step did not commit + push the
new node's registration. Either:

- Install failed before reaching the cluster-register step
- gh auth wasn't restored on installed system, so the push had no creds
- Cluster-register service didn't fire on first boot of installed
  system
- All of the above (cascade-failure)

This is the CRITICAL FAILURE per the operator's reframing.
Without self-registration, the node is not operational as a cluster
member; the entire auto-cluster-join chain is broken.

## Proposed mitigations

### Bug 3 — banner password-line removal (smallest; fix-now candidate)

Edit `full-ai-cluster/nixos/modules/login-banner.nix`:

- Remove the `password: zeta-change-me` line from `services.getty.helpLine`
- Replace with: `│  password: see install output / zflash banner          │`
  OR remove entirely + replace with: `│  (password documented at install-time only)            │`

Single-line change. Ships in one PR. P1 in this row because it's a
visible security/UX issue every login.

### Bug 1 — hostname diagnosis (requires installed-system inspection)

Operator should run on the installed system:

```bash
cat /etc/hostname                  # actual hostname
ls -la /etc/zeta/cluster-node-id   # iter-5.2 substrate file
cat /etc/zeta/cluster-node-id      # what was written by zeta-install
hostnamectl                        # full hostname state
```

Output determines fix:

- If `/etc/zeta/cluster-node-id` missing → iter-5.2.2 code path didn't
  fire (likely install failed before Step 6.6; composes with B-0834)
- If `/etc/zeta/cluster-node-id` has `node-XXXXXX` but `/etc/hostname`
  shows `control-plane` → flake-priority override; fix `injected-
  hostname.nix` module priority OR change `control-plane.nix` flake
  host attribute to not hardcode `networking.hostName`

### Bug 2 — gh login diagnosis (requires installed-system inspection)

Operator should run on the installed system:

```bash
ls -la /root/.config/gh/                  # gh state directory
cat /etc/zeta/operator-ssh-keys.nix       # injected pubkeys
git -C /etc/zeta status                   # cluster repo clone state
journalctl -u zeta-first-boot --boot=-1   # service log
```

Output determines whether the auth step ran + completed; fix depends
on the failure mode.

## Acceptance

Phased acceptance:

- **Bug 3 acceptance** (immediate; PR-ready): login-banner.nix no
  longer displays any password text; banner shows hostname + SSH-from-
  Mac instruction + console-login user only
- **Bug 1 acceptance** (diagnosis-dependent): once operator runs
  diagnostic commands + reports state, fix the specific failure mode
  (iter-5.2.2 code-path fix OR flake-hostname-priority fix)
- **Bug 2 acceptance** (diagnosis-dependent): same diagnostic pattern;
  fix specific failure mode (gh-auth-login fix OR ssh-key-injection
  fix OR cluster-repo-clone fix)

## Composes with

- B-0754 (zero-typing first-boot scope; this row is the bug-cluster
  surfacing-from-real-hardware-test)
- B-0831 (CI cascade #6 — would catch all 3 bugs in QEMU before
  physical test; this row IS empirical validation that B-0831's
  reframing produces real targets)
- B-0832 (sibling empirical anchor: nmtui WiFi rescan)
- B-0833 (sibling empirical anchor: interactive-login vs baked-keys;
  Bug 2 here is concrete instance of the auth tension)
- B-0834 (sibling empirical anchor: install log preservation; would
  immediately diagnose Bugs 1 + 2)
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (Step 6.55
  iter-5.3 password substrate + Step 6.6 iter-5.2.2 hostname substrate)
- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`
- `full-ai-cluster/nixos/modules/login-banner.nix` (Bug 3 fix surface)
- `full-ai-cluster/nixos/modules/injected-hostname.nix` (Bug 1 fix
  surface candidate)
- B-0792 (iter-5.2 hostname injection substrate this row's Bug 1
  composes with)
- The 2026-05-26 physical hardware-support test (4 empirical anchors
  in one session: B-0832 + B-0833 + B-0834 + this row's 3 bugs =
  6 substrate-engineering targets surfaced)

## Substrate-honest framing

SIX empirical anchors in ONE physical hardware-support test session
(B-0832 + B-0833 + B-0834 + B-0835 with 3 sub-bugs = 6 substrate-
engineering targets) is OVERWHELMING validation of B-0831's reframing
that physical-test-becomes-the-hardware-support-test produces real
substrate-engineering value.

The bugs are consolidated into one row because they cluster (all
install-time-configuration that isn't being applied OR displayed
correctly) AND operator is in active diagnosis-loop on real hardware.
The diagnostic commands documented above let operator surface the
specific failure modes without further round-trips.

Bug 3 (banner password-disclosure) is the immediate fix-now candidate
— single-line change to login-banner.nix; ships in one PR; visible
security/UX gain at every login.

Bugs 1 + 2 require installed-system diagnostic output to identify the
specific failure mode within their respective hypothesis spaces. Once
operator runs the diagnostic commands + reports back, the specific
fixes are bounded.
