---
id: 081KSGS9H0008QG0R00120EEHM
priority: P1
status: open
title: installer config-bugs cluster — hostname not unique (shows control-plane); gh login not respected; login banner shows password text (default OR custom) (empirical from 2026-05-26 physical hardware-support test) (Aaron 2026-05-26)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R002T3BJ2R
composes_with:
  - 081KSGS9H0008QG0R0011BC7T2
  - 081KSGS9H0008QG0R001Q2DH2H
  - 081KSGS9H0008QG0R003JNSVR5
  - 081KSGS9H0008QG0R001RR3ZXQ
tags: [installer, first-boot, hostname, gh-auth, login-banner, password-disclosure, operator-ux, physical-hardware-support-test, empirical-anchor, bug-cluster]
---

## Problem

Three install-config bugs surfaced in the same 2026-05-26 physical
hardware-support test session (4th, 5th, 6th empirical anchors after
081KSGS9H0008QG0R001Q2DH2H nmtui WiFi + 081KSGS9H0008QG0R003JNSVR5 auth-tension + 081KSGS9H0008QG0R001RR3ZXQ log preservation).

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
  — composes with 081KSGS9H0008QG0R001RR3ZXQ install-log preservation)
- `gh auth login` ran but auth flow didn't complete (no PAT obtained)
- `gh auth login` completed but the PAT wasn't used downstream (git
  clone of cluster repo OR SSH key injection step)
- `gh ssh-key list` didn't return operator's pubkeys (account auth
  succeeded but key-list call failed)

Diagnosis: check `/root/.config/gh/hosts.yml` on installed system for
operator's GH user; check `/etc/zeta/operator-ssh-keys.nix` for
populated pubkey array; check `git -C /etc/zeta remote -v` for the
clone URL + verify it pulls without credentials prompt.

### Bug 2a — git push prompts HTTPS basic-auth despite gh auth login (CRITICAL — blocks self-registration; empirical 2026-05-26)

Empirical anchor 2026-05-26 (2nd physical hardware-support test on
same hardware, post-Bug-1-fix re-flash):

```
[iter-5.4.0] Run gh auth login now? [Y/n]: Y
[iter-5.4.0]   running 'gh auth login' (interactive)...
! First copy your one-time code: D30B-468F
Open this URL to continue in your web browser: https://github.com/login/device
■ Authentication complete.
! Authentication credentials saved in plain text
■ Logged in as AceHack
[iter-5.4.0]   gh auth login: SUCCESS
...
[iter-5.4.1] ── self-registration commit+push (081KSGS9H0008QG0R0037H3W4T) ──
[iter-5.4.1]   maintainer:  AceHack
[iter-5.4.1]   node-name:   node-efe404
Switched to a new branch 'register-node-efe404-20260527T0005332'
Username for 'https://github.com': acehack
Password for 'https://acehack@github.com':
```

`gh auth login` SUCCEEDED as AceHack via device flow, but the
subsequent `git push -u origin <branch>` at iter-5.4.1 prompted for
HTTPS basic-auth. Root cause: `gh auth login` stores the token in
its own config but does NOT configure git's credential helper. Git
push goes through the default credential-store chain which doesn't
know about gh's token.

**Standard fix**: `gh auth setup-git` writes a `credential.helper`
config that delegates to `gh auth git-credential`. Once configured,
all git operations against github.com automatically use the gh token.

**Implementation**: insert `gh auth setup-git` immediately after a
successful `gh auth login` in `zeta-install.sh` Step 6.8. Failure of
setup-git is non-fatal (warning only); the prompt-for-password
behavior is the symptom indicating it didn't run.

**Acceptance**: 3rd physical test (Bug 2a fix re-flash) shows
iter-5.4.1 `git push` completes silently without basic-auth prompt;
self-registration PR URL is printed; PR is browseable on github.com.

### Bug 2b — gh ssh-key list returns empty / fails (degraded; substrate-honest WARN insufficient; empirical 2026-05-26)

Same empirical anchor 2026-05-26:

```
[iter-5.4.0]   fetching operator's SSH pubkeys via 'gh ssh-key list'...
[iter-5.4.0]   WARN: 'gh ssh-key list' failed; no keys written
[iter-5.4.0]   (gh auth succeeded but the user has no SSH keys
[iter-5.4.0]   registered with GitHub, OR the jq/tee pipe broke)
```

The WARN already covers both candidate causes but doesn't help the
operator recover. Two candidate root causes need discrimination:

1. **Auth scope missing** (most likely): `gh auth login` default
   scopes are `repo, read:org, workflow, gist`. `gh ssh-key list`
   requires `admin:public_key` OR `read:public_key`. Device-flow
   without explicit `--scopes` will NOT request these.
2. **Operator has no SSH keys at GitHub**: returns empty list (no
   error). Operator uses gh CLI auth + signed commits via gh, never
   added SSH keys to their account.

**Fix path**: capture stderr from `gh ssh-key list`; discriminate
between scope-error and empty-list cases; for scope errors,
substrate-honest guidance:

```
  WARN: 'gh ssh-key list' returned no keys — gh token lacks SSH-key scope
  To enable SSH-from-Mac path, run on the installed system:
    gh auth refresh -s admin:public_key
    gh ssh-key list --json key | jq -r '.[].key' | sudo tee -a /etc/zeta/operator-authorized-keys
    sudo nixos-rebuild switch  # picks up operator-authorized-keys.nix
```

For empty-list (no keys at GH): substrate-honest WARN names
https://github.com/settings/keys as fix surface.

**Acceptance**: 3rd physical test shows substrate-honest WARN with
specific recovery commands; OR (if scope-mode pursued separately)
default install captures pubkeys without operator intervention.

**Scope-prompt deferred**: rather than ask for elevated
`admin:public_key` scope by default (security tradeoff), the install
shows substrate-honest fallback. Future B-NNNN candidate:
opt-in flag `--with-ssh-key-scope` for operators who want one-shot
auto-population.

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
   `maintainers/<operator>/cluster-nodes/<hostname>/...` per 081KSGS9H0008QG0R0037H3W4T
   iter-5.4.1
6. ArgoCD pulls in + reconciles per 081KSGS9H0008QG0R002K93MWX iter-5.4.2
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
081KSGS9H0008QG0R0037H3W4T iter-5.4.1 self-registration step did not commit + push the
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
  fire (likely install failed before Step 6.6; composes with 081KSGS9H0008QG0R001RR3ZXQ)
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

- 081KSGS9H0008QG0R002T3BJ2R (zero-typing first-boot scope; this row is the bug-cluster
  surfacing-from-real-hardware-test)
- 081KSGS9H0008QG0R0011BC7T2 (CI cascade #6 — would catch all 3 bugs in QEMU before
  physical test; this row IS empirical validation that 081KSGS9H0008QG0R0011BC7T2's
  reframing produces real targets)
- 081KSGS9H0008QG0R001Q2DH2H (sibling empirical anchor: nmtui WiFi rescan)
- 081KSGS9H0008QG0R003JNSVR5 (sibling empirical anchor: interactive-login vs baked-keys;
  Bug 2 here is concrete instance of the auth tension)
- 081KSGS9H0008QG0R001RR3ZXQ (sibling empirical anchor: install log preservation; would
  immediately diagnose Bugs 1 + 2)
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (Step 6.55
  iter-5.3 password substrate + Step 6.6 iter-5.2.2 hostname substrate)
- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`
- `full-ai-cluster/nixos/modules/login-banner.nix` (Bug 3 fix surface)
- `full-ai-cluster/nixos/modules/injected-hostname.nix` (Bug 1 fix
  surface candidate)
- 081KSGS9H0008QG0R003V23XNZ (iter-5.2 hostname injection substrate this row's Bug 1
  composes with)
- The 2026-05-26 physical hardware-support test (4 empirical anchors
  in one session: 081KSGS9H0008QG0R001Q2DH2H + 081KSGS9H0008QG0R003JNSVR5 + 081KSGS9H0008QG0R001RR3ZXQ + this row's 3 bugs =
  6 substrate-engineering targets surfaced)

## Substrate-honest framing

SIX empirical anchors in ONE physical hardware-support test session
(081KSGS9H0008QG0R001Q2DH2H + 081KSGS9H0008QG0R003JNSVR5 + 081KSGS9H0008QG0R001RR3ZXQ + 081KSGS9H0008QG0R00120EEHM with 3 sub-bugs = 6 substrate-
engineering targets) is OVERWHELMING validation of 081KSGS9H0008QG0R0011BC7T2's reframing
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
