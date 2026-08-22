---
id: 081M06KM523087G0R002ANKAZJ
type: task
state: backlog
priority: P2
slug: verify-the-biometric-factor-itself-via-localauthentication-l
title: "verify the biometric factor itself via LocalAuthentication (LAContext), not sudo's exit status"
created: 2026-08-17T00:58:25.219Z
depends_on: ["081M06DSQ0Q087G0R000H91391"]
composes_with: []
---

# verify the biometric factor itself via LocalAuthentication (LAContext), not sudo's exit status

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M06KM523087G0R002ANKAZJ-*.md` glob. -->

**Filed by:** the shadow, 2026-08-17, while fixing `081M06DSQ0Q087G0R000H91391`.

## What the fix for the parent did — and deliberately did not do

The parent bug was that `macTouchIdAuth()` labelled *any* sudo success `macos-touchid`.
That is now fixed **in the register**: the gate reports `factor: "unattributed"` unless the
parsed `/etc/pam.d/sudo` chain shows `pam_tid.so` is the only module that could have
satisfied the transaction, and `claimsBiometric()` is the `supportsClaim`-style predicate a
caller must gate on if its argument needs the biometric specifically.

That makes the claim honest. It does **not** make the biometric observable — and on the
stock macOS chain the honest answer is now permanently `unattributed`, because
`pam_smartcard.so` and `pam_opendirectory.so` sit in the same chain and `sudo` never
reports which module succeeded. So today the fleet's standing rule — Aaron 2026-06-21,
*"nothing is operator run, only operator approved with hello/biometrics"* — is satisfied
only at the strength of "an operator authenticated", not "a finger was on the sensor".

## The two candidate mechanisms, and what is unknown about each

**A. `LocalAuthentication` / `LAContext` (`LAPolicy.deviceOwnerAuthenticationWithBiometrics`).**
The only option that *observes* the biometric rather than a proxy for it: the policy names
biometrics, and it is not satisfiable by a password or a smart card. Cost: a native bridge
(Swift/Objective-C via Security.framework) that this TS CLI does not have today, plus a
signed-binary / entitlement question that has not been investigated.

**B. `sudo -S` with stdin closed.** `man sudo` documents `-S` as reading the password from
standard input *instead of* the terminal device, so with `stdio[0] = "ignore"` the password
path is genuinely shut — unlike today, where the tty stays open. **Not taken in the parent
PR, on purpose:** whether `pam_smartcard`'s PIN prompt also routes through sudo's
conversation function (and is therefore also closed) is an *inference* from how PAM
conversations usually work, and inference-in-place-of-observation is the exact defect the
parent work-item was about. It also changes operator-visible behaviour on a machine no
agent should be running `sudo` on to test.

## What would close this

Either (A) landed with a test that fails when the biometric is not the factor, or (B)
confirmed **by observation on a host with a PIV token inserted** — a human at the keyboard,
not an agent. Until one of those exists, `factor: "unattributed"` on the stock chain is the
true reading and should stay.
