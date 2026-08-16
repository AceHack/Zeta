---
id: 081M00PYT0K087G0R002F9YSEG
type: task
state: in-progress
priority: P2
slug: per-share-token-addressing-and-a-checkable-frost-device-rost
title: "per-share token addressing and a checkable FROST device roster: slot 0 is not an address and a duplicate is not a position"
created: 2026-08-14T18:01:13.491Z
depends_on: []
composes_with: []
---

# per-share token addressing and a checkable FROST device roster: slot 0 is not an address and a duplicate is not a position

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00PYT0K087G0R002F9YSEG-*.md` glob. -->

The second half of the finding whose dangerous half landed in PR #10644.

#10644 fixed the part cryptography cannot catch: a sealed artifact recorded no token
identity, and the default `keyLabel` is `zeta-frost-wrap` on every token, so provisioning
one wrapping key across a token pack — the natural move for one PIN plus a spare — gave a
roster where any one token opened every share. Binding `sealedByToken` into the AAD and
the in-plaintext bind string closed it.

This item is the ADDRESSING half, and it is worth having only ON TOP of that binding.
Slot binding is addressing; addressing is not a security property. Shipping it first
would have produced a roster that looks distributed and is not, which is worse than an
obviously-undistributed one because it reads as done.

## What landed

- `Pkcs11TokenAddress` — `by: "token-identity"` (roster-grade, survives replug) or
  `by: "slot-index"` (discovery-grade, positional, optional `expectTokenIdentity`).
  **No default.** `opts.slotId ?? 0` is gone: an undeclared address is refused, because
  that default made N adapters built for N tokens all address the same device.
- `enumeratePkcs11Tokens` — the first and only caller of `C_GetSlotList`, which had been
  declared in the FFI table since the file was written and never invoked. Enumeration is
  a SEARCH for a device the caller already named, never an ASSIGNMENT of roster positions.
- `frost-token-roster.ts` — the declaration a human writes and the machine checks:
  participant = one `x`, one position, MANY devices. Duplication for availability is
  expressible; counting a duplicate as a second position is not.
- `checkRoster` / `seizureWitness` / `verifyRosterAgainstArtifacts` / `attestRosterOnDevices`
  — structural arithmetic, an exhaustive under-threshold seizure search, header-only
  comparison against the artifacts on disk, and the N×N matrix on real chips.
- CLI: `frost-token-roster.ts tokens <lib>` (discovery) and `verify <roster.json> <dirs…>`.

## Mutation results (8 planted, 8 dead)

| mutant | killed by |
| --- | --- |
| slot binding removed (address ignored) | FSA-32…39, FSA-41, FSA-42 |
| absent token silently falls back to slot 0 | FSA-36, FSA-37, FSA-40 |
| slot-index expected-identity comparison dropped | FSA-39 |
| device holding two positions no longer flagged | FTR-9, FTR-11 |
| seizure witness always reports clean | FTR-10, FTR-11, FTR-12, FTR-31 |
| duplicate participant index accepted | FTR-7 |
| artifacts the roster never declared ignored | FSA-43, FTR-15 |
| declared position with no artifact ignored | FTR-16, FTR-17, FTR-19 |

## Open

- The multi-token hardware lane (`pkcs11-multi`, HW-6…HW-12) cannot run until the YubiKey
  bundle arrives. It is written and it fails loudly rather than skipping when opted into
  without hardware.
- `attestRosterOnDevices` needs every device present at once, so it is a ceremony step,
  not a load-path check.
