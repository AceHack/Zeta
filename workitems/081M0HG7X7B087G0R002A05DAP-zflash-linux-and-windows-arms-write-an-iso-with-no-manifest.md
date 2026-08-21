---
id: 081M0HG7X7B087G0R002A05DAP
type: bug
state: backlog
priority: P2
slug: zflash-linux-and-windows-arms-write-an-iso-with-no-manifest
title: "zflash Linux and Windows arms write an ISO with no manifest integrity check -- the gate exists only on macOS"
created: 2026-08-21T06:30:57.003Z
depends_on: []
composes_with: []
---

# zflash Linux and Windows arms write an ISO with no manifest integrity check -- the gate exists only on macOS

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0HG7X7B087G0R002A05DAP-*.md` glob. -->

## The gap

`flash-usb.ts` (macOS) verifies the ISO against a `SHA256SUMS` or `<iso>.sha256`
manifest before writing (`checkIsoAgainstManifest`, `sha256FileHex`). Neither
`flash-usb-linux.ts` nor `flash-usb-windows.ts` contains any manifest, sha256 or
digest reference at all. On those two hosts zflash writes an image to a block
device with **no integrity verification whatsoever**.

Measured 2026-08-21 on `origin/main`:

    grep -nE 'checkIsoAgainstManifest|manifest|sha256|SHA256' flash-usb.ts          -> 5 hits
    grep -nE 'checkIsoAgainstManifest|manifest|sha256|SHA256' flash-usb-linux.ts    -> 0 hits (one unrelated comment)
    grep -nE 'checkIsoAgainstManifest|manifest|sha256|SHA256' flash-usb-windows.ts  -> 0 hits

This is a live gap, not a drift hazard: the two arms differ today, in the
direction that matters.

It is also why the ISO lane's `audit-flash-entrypoint-parity` step cannot simply
be restored. An honest parity audit FAILS on main right now, because parity is
genuinely violated. The audit is worth having only once this is fixed --
restoring it before then would force the choice between a red lane and a
baseline that records the gap as acceptable.

## Order of work

1. Add manifest verification to the Linux and Windows arms, reusing the macOS
   arm's `checkIsoAgainstManifest` rather than reimplementing it per host.
2. THEN restore the `audit-flash-entrypoint-parity` step removed from
   `.github/workflows/build-ai-cluster-iso.yml`, with the audit script that was
   held back, so the class cannot regress.
3. Per the note already in that workflow: the audit belongs in `gate.yml`'s
   cross-verify floor beside `audit-proof-lineage-binaries.ts`, so it blocks
   every PR rather than only the ISO lane.

## Related

- #13093 landed the CI half (aarch64 digest sidecar) whose digests these gates
  would consume; two of three arms currently ignore them.
- #13099 closed the sibling instance of the same class (the size bounds defined
  twelve times under comments claiming one definition).

