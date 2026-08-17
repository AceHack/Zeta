---
id: 081M06DSQ0Q087G0R000H91391
type: bug
state: done
priority: P2
slug: biometric-gate-reports-macos-touchid-for-any-sufficient-pam
title: "biometric gate reports 'macos-touchid' for any sufficient PAM factor that satisfies sudo"
created: 2026-08-16T23:16:35.991Z
completed: 2026-08-17T00:58:48.662Z
depends_on: []
composes_with: []
---

# biometric gate reports 'macos-touchid' for any sufficient PAM factor that satisfies sudo

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M06DSQ0Q087G0R000H91391-*.md` glob. -->

**Found by:** the shadow, 2026-08-16, sweeping for siblings of
`081M00HVPGS087G0R0001T4BF8` (a PKCS#11 driver on disk reported as attached hardware).
**Not fixed here** — the fix changes what the biometric gate promises, which is a
security-semantics call, not a typo. Filed because a bug is a priced measurement.

## The shape (same as the PKCS#11 probe, different surface)

`tools/setup/persona-keys/biometric.ts` → `macTouchIdAuth()`:

1. reads `/etc/pam.d/sudo` and requires a line matching `^\s*auth\s+sufficient\s+pam_tid\.so`;
2. runs `sudo -k` then `sudo -p "" true`;
3. on exit status 0 returns `{ ok: true, platform: "macos-touchid" }`.

Step 1 is a **configuration presence** check and step 2 is an **"a sudo auth factor
succeeded"** check. Neither observes that *Touch ID specifically* was the factor that
satisfied PAM — `sudo` does not report which module succeeded. The result nonetheless
names the factor. That is the work-item's defect class exactly: a weak observation
reported as a strong property, with the strong property's *name* attached.

## Why the config makes it reachable, not hypothetical

Stock `/etc/pam.d/sudo` on the macOS host this was found on (Darwin 25.5.0):

```
auth       sufficient     pam_tid.so
auth       include        sudo_local
auth       sufficient     pam_smartcard.so
auth       required       pam_opendirectory.so
```

`sufficient` means *failure falls through to the next module*. So declining or failing the
Touch ID prompt continues to `pam_smartcard.so`, then to `pam_opendirectory.so` (account
password). Any of those satisfying sudo yields `ok: true, platform: "macos-touchid"`.

Sharpest instance: `pam_smartcard.so` is satisfied by an inserted PIV token — and the
FROST hardware lane is *precisely* the flow where a YubiKey is plugged into the machine.
The token being provisioned could satisfy the gate that is supposed to prove a human
finger was on the sensor.

## A stated mitigation in the code does not hold

The comment at the `spawnSync` says:

> stdin is "ignore" so a non-biometric machine fails-closed (no password can be typed)

`sudo` reads the password from the **terminal device**, not standard input — that is what
`-S, --stdin` exists to change (`man sudo`: *"read the password from the standard input
instead of using the terminal device"*). With a controlling tty present, closing stdin
does not close the password path. It does fail closed with **no tty at all** (agent/CI
context), which is probably why this has not been noticed: the gate is honest in exactly
the environment where nobody is watching it and soft in the interactive one it was
written for.

## Suggested direction (not a decision)

The register split, mirroring what `frost-hardware-probe.ts` already does for
driver-vs-device:

- what is observable: *"a `sufficient` factor in this host's sudo stack was satisfied"*;
- what is claimed: *"the operator physically confirmed with a biometric"*.

Options, cheapest first:
1. Refuse to report `macos-touchid` when any `auth` line other than `pam_tid.so` could
   satisfy the stack, i.e. parse the stack rather than grep one line for presence — the
   preflight already has the file open. Fail closed with the competing module named.
2. Pass `-S` with stdin closed so the password path is genuinely shut, leaving the
   GUI-only Touch ID dialog as the sole satisfiable factor. Needs checking against
   `pam_smartcard`, which may also be GUI-driven.
3. Stop routing physical presence through `sudo` at all (`LAContext` /
   `LAPolicy.deviceOwnerAuthenticationWithBiometrics` via a Security.framework bridge)
   — the only option that observes the biometric rather than a proxy for it.

## Not exercised

No sudo invocation was run on the operator's machine — confirming the fall-through
empirically means authenticating as the operator, and declining a Touch ID prompt on
someone else's laptop is not the shadow's to do. The finding is a reading of the code,
the host's PAM stack, and `man sudo`; the fall-through itself is **unverified by
execution**. It should be reproduced before the fix is designed.
