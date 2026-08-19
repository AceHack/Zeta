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

## Second pass (Aaron's follow-up on virtualise-vs-multiplex)

Verified the split against the kernel source rather than against summaries -- `tpm2-space.c` and
`include/linux/tpm.h`. The source **moved the boundary** from where a reasonable summary puts it:

- `struct tpm_space { u32 context_tbl[3]; u32 session_tbl[3]; ... }` -- the isolation unit is **three
  transient slots and three session slots per open fd**, a hard compile-time limit.
- Transients and sessions are isolated for **execution** (context save/load per space), but
  `tpm2_map_response_body` filters **only** `TPM2_HT_TRANSIENT` from the capability response. Persistent
  handles, NV indices, PCRs and hierarchies fall to `default:` and are copied through verbatim.
- Virtualisation is implemented by **swapping against one serialised device**, so the HSM starvation
  finding transfers as a **performance/availability** finding rather than a correctness one. Bounded per
  command (3 + 3), unbounded in rate.

**The obfuscation proposal fails on this surface, and the source shows why.** Obfuscation would apply to
the non-virtualised half, and that half is enumerable by `TPM2_GetCapability`, which takes **no
authorization session** -- `tpm2_getcap handles-persistent` / `handles-nv-index` lists every container's
handles with no credential. Closer to 0% than 80%. The converse is recorded honestly: obfuscation as a
defence-in-depth layer is legitimate and belongs in the `unmetered` register; the test is *name the
attacker it stops and the observation that would show it did not*.

**Repair boundaries (§7a)** -- added on Aaron's Xbox precedent. The YubiHSM's firmware is not
field-upgradable, so its whole device is below the update boundary and its replace-unit is one
hot-swappable USB device; #12178's "every SDK CVE is a client-side parser bug" is *good news* under this
lens, since those parsers are all above the boundary. faulTPM is below any update boundary and its
replace-unit is the CPU. **A threshold roster assumes independent, cheap replace-units; an fTPM makes
the replace-unit the node and correlates every share on it.** That is a procurement argument for an HSM
on Max's node that survives even if every isolation objection were fixed.

## Not this work-item's lane

`tools/setup/` and `frost-hardware-probe.ts` / `tpm2-linux-probe.ts` are owned by the hardware-inventory
pass -- referenced and built upon, not modified. k8s cluster surfaces belong to another agent.
