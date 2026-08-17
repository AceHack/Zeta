---
id: 081M00VN9P1087G0R000FYTTVS
type: task
state: backlog
priority: P2
slug: run-the-linux-tpm-2-0-probe-on-an-x86-node-frost-hardware-pr
title: "Run the Linux TPM 2.0 probe on an x86 node: frost-hardware-probe.ts checks /dev/tpmrm0, /dev/tpm0, /sys/class/tpm and has never been run there — fTPM commonly ships disabled in BIOS, so the L3 rung's hardware premise is documented but unverified"
created: 2026-08-14T19:23:24.737Z
depends_on: []
composes_with: []
---

# Run the Linux TPM 2.0 probe on an x86 node: frost-hardware-probe.ts checks /dev/tpmrm0, /dev/tpm0, /sys/class/tpm and has never been run there — fTPM commonly ships disabled in BIOS, so the L3 rung's hardware premise is documented but unverified

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00VN9P1087G0R000FYTTVS-*.md` glob. -->

## STILL OPEN. The hardware dependency has a name and one command. (Otto, 2026-08-17)

**No TPM has been contacted.** This item's literal ask — run the probe on an x86 node —
was NOT done and cannot be done from here: the only machine available is a Mac Studio
(Darwin 25.5.0 arm64, T6020). `ls /dev/tpm*` matches nothing, `/sys` does not exist as a
path on this OS, and `tpm2_getcap` is not installed. Everything below is about making the
Linux path *ready to run and impossible to fake*; none of it is evidence about silicon.

**The named dependency:** one x86-64 Linux node with an fTPM (Intel PTT / AMD fTPM) or a
discrete TPM. Nobody in the fleet has one wired up; `docs/inventory/hardware-to-buy.md` is
where the acquisition lives.

**How the dependency gets discharged — one command, then a paste:**

```bash
bun tools/setup/persona-keys/tpm2-linux-probe.ts             # human-readable
bun tools/setup/persona-keys/tpm2-linux-probe.ts --capture-json   # the committable fixture
```

The second emits the whole reading of the host as JSON. Append it to
`tools/setup/persona-keys/tpm2-linux-captures.json` with `provenanceKind: "observed"` and
an `expectedState` **written from what the operator sees** (BIOS setting, `tpm2_getcap`
output) rather than copied from the classifier — the fixture must be able to disagree with
the code. The suite replays every committed capture, so one paste from real silicon turns
this item's premise from documented into checked, permanently and without the hardware
staying attached.

`tpm2-linux-probe.test.ts` carries a guard test asserting that **no** `observed` capture
reports `present`. It goes red the moment a real x86 capture lands — which is the signal
to close this item, and the reason the gap cannot close silently.

## What was found while making it ready (this part IS checked)

Two defects in the probe as it stood, both of the same family as PR #10644's
"a PKCS#11 driver on disk is not attached hardware":

1. **`existsSync` returns `false` for every error.** `probeTpm2` was
   `exists("/dev/tpmrm0") || exists("/dev/tpm0") || readdir("/sys/class/tpm")`, and its
   `catch` around the sysfs read said, in a comment, *"report absent rather than guess"*.
   So a permission denial, an unreadable `/sys`, and a genuine no-TPM all produced the
   same `{ available: false }` — **a check that could not run, reporting as a check that
   ran and said no.** That is the same shape #11509 measured, where an empty
   `grep RANDOM_TRUST` would have read as "off" while the truth was "on".

2. **A device node is not a family.** `/dev/tpm0` is also the node of a **TPM 1.2** device.
   The probe reported `{ available: true, path: "/dev/tpm0" }` for a 1.2-only machine and
   offered the `hardware-tpm2` seal tier on it — a tier that cannot work there, because
   TPM 1.2 has no `TPM2_Create`, no `tpm2_unseal`, and no SHA-256 PCR bank. Same inference
   as *library on disk ⇒ token attached*, one layer down.

Also, more quietly: `probeTpm2` claimed `/dev/${entries[0]}` from a `/sys/class/tpm`
listing whose order is unspecified, so on a normal host (which registers both `tpm0` and
`tpmrm0`) it could name a device path it had never checked existed.

## What shipped

`tools/setup/persona-keys/tpm2-linux-probe.ts` — a capture/classify split with an
error-preserving IO seam. **Five states, none collapsible into another:**

| state | means | what it is NOT |
|---|---|---|
| `present` | a usable node AND a confirmed family 2.0 | — |
| `absent` | `/sys/class/tpm` **enumerated** and registers no chip (the fTPM-off-in-BIOS case) | not "we could not look" |
| `unreadable` | a source exists and denied us (EACCES/EPERM) | not "no TPM" — a privileged caller gets a different answer |
| `unavailable` | no tpm class, no tools, or not Linux at all | not "no TPM" — the driver may simply not be loaded |
| `indeterminate` | a node is there and nothing confirmed the family | not `present` — never round an unconfirmed device up to a capability |

`absent` has exactly one producer: a listing that succeeded and came back empty. A missing
tool, a denied read, and an errored read are each *recorded as evidence and never counted
as a negative*. `tpm2Available` (what the adapter asks) is true for `present` alone, so
`hardware-tpm2` is now fail-closed on every uncertain machine.

`assertHardwareSealTierAvailable` used to answer all four not-present states with the one
sentence "no TPM 2.0 device node" — a false statement in three of them. It now names the
state and says out loud when the check did not run.

## What is UNVERIFIED

- That a real TPM 2.0 produces the reading the `present` fixture describes. The fixture is
  hand-constructed from `drivers/char/tpm/tpm-sysfs.c` (which exports `tpm_version_major`
  from kernel 4.19) and the tpm2-tools 5.x `properties-fixed` YAML shape. **Nobody here has
  seen either from a device.**
- That `tpm2_getcap properties-fixed` emits exactly the YAML this parser expects on the
  tpm2-tools version a node ships. The parser fails *closed* (`undefined` → not a negative,
  so at worst the state is `indeterminate`), but it has never met the real tool.
- The exact stderr of a TCTI permission failure. It is recorded as evidence only and is
  never counted toward a state, so a wrong guess there changes no verdict.
- Whether fTPM is in fact commonly disabled in BIOS on the nodes we would buy. That is the
  item's premise and it is still hearsay.

## Composes with

- `081M00HVPGS087G0R0001T4BF8` — the PKCS#11-driver-as-device regression; same family.
- `081M00QP7G7087G0R002PZB5T2` — the post-UKI attestation gap; source of the empty-grep lesson.
- `081KWPHRNFW08QG0R0031ZNXTD` — DoD item 5, the real TPM2 seal adapter this probe gates.
