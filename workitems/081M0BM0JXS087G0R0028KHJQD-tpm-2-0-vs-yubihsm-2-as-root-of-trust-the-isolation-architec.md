---
id: 081M0BM0JXS087G0R0028KHJQD
type: task
state: backlog
priority: P2
slug: tpm-2-0-vs-yubihsm-2-as-root-of-trust-the-isolation-architec
title: "TPM 2.0 vs YubiHSM 2 as root of trust: the isolation architectures are inverted"
created: 2026-08-18T23:41:24.793Z
depends_on: []
composes_with: []
---

# TPM 2.0 vs YubiHSM 2 as root of trust: the isolation architectures are inverted

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0BM0JXS087G0R0028KHJQD-*.md` glob. -->

## Why

Aaron 2026-08-18, relayed: Max is joining the k8s and hardware-USB work; his machine is a centralized
unit with a GPU and a mini computer, and *probably* has a TPM but no HSM yet. "We should map the
difference, and with docker limitations between AIs."

Follow-on to 081M0BGM5BV087G0R0038SBCE2 / PR #12178, written as an explicit delta against that
document's findings rather than as a second survey.

## Outcome

`docs/research/2026-08-18-tpm-2-0-versus-yubihsm-2-as-root-of-trust-the-isolation-architectures-are-inverted.md`

Analysis and documentation only -- no TPM session opened, no key created or used, no ownership taken,
no device probed. **Max's machine was not accessed and no access was sought.** The TPM presence on his
machine is "probably", unverified, and is treated throughout as a relayed capability fact.

Headline: the two devices have opposite isolation architectures. The YubiHSM has a shared
unauthenticated path to a device that partitions per caller; the TPM has a kernel-enforced per-caller
path to a device that partitions not at all. The missing property is nameable -- **the TPM has no
tenants** -- and it is exactly the one thing #12178 found the HSM does have.

Two sub-findings worth carrying separately:

- The `YH_MAX_SESSIONS = 16` starvation finding **does not transfer** -- the in-kernel resource manager
  virtualises transient objects and HMAC/policy sessions per file descriptor ("TPM spaces"). Genuine
  advantage. It is replaced by a **worse** vector: the global dictionary-attack lockout needs no
  credential, cannot be cleared by the victim, and has an accidental trigger (unclean shutdown).
- **PCR sealing cannot distinguish one container from another.** Non-resettable PCRs measure the host
  identically for all tenants; resettable ones are resettable by anyone. So the L3 rung of the
  code-bound-key-access ladder is not merely expensive per-container on a shared TPM, it is
  unreachable.

## Follow-on work this doc names but does not do

- **Y1/Y2/Y3/Y4 configuration checks** -- device-node grant matrix, `noDA` coverage over the object
  roster, DA-lockout blast radius, PCR-policy tenancy audit. All four are pure computation over
  declared config; no hardware. Y4 is designed to fail by construction until the architecture moves to
  per-tenant vTPMs.
- **Y5** -- classify each node's TPM as discrete or firmware and record it. Materially changes the
  physical-attack profile (bus sniffing vs faulTPM) and is not inferable remotely.
- **Verify whether Max's machine has a TPM at all**, using the existing five-way `Tpm2State` probe
  rather than a new one. Needs someone at the keyboard on that machine.

## Not this work-item's lane

`tools/setup/` and `frost-hardware-probe.ts` / `tpm2-linux-probe.ts` are owned by the hardware-inventory
pass -- referenced and built upon, not modified. k8s cluster surfaces belong to another agent.
