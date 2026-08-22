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

## Second pass (shadow, 2026-08-17): the roster's OWN freshness

The addressing half above landed in #10676 and is verified present: `Pkcs11TokenAddress`,
`enumeratePkcs11Tokens`, `frost-token-roster.ts` with `checkRoster` / `seizureWitness` /
`verifyRosterAgainstArtifacts` / `attestRosterOnDevices`, 32 passing tests. Nothing in the
"What landed" section was found to be overstated.

What it could NOT do was notice that it was out of date. `checkRoster` and
`verifyRosterAgainstArtifacts` compare a declaration against artifacts; both can agree
perfectly while the shares have been re-issued underneath them. `verify` printed `OK` for a
custody set whose secret had moved — the same shape as the `foldChain` defect in
081M00NSP0Q087G0R003R89Y5K, where "current" was reachable by not having heard anything.

- `checkRosterAgainstEpochChain(roster, fold)` — the roster's pinned group key against the
  THRESHOLD-SIGNED epoch chain (`key-epoch-ledger.ts`). `roster-key-not-current` /
  `roster-chain-forked` / `roster-key-unreadable` are refusals; `assertRosterSound` takes
  the fold as a third argument. Imported `type`-only, so this module still holds no key
  material and verifies no signature itself — the caller folds from a pin it trusts.
- **`retiredIndices` is explicitly NOT a blocklist.** A declared index in the chain's
  grow-only retired union is reported at `info`. Retire slot 3 at epoch 1 and re-issue it
  at epoch 2 and the union still names 3 while slot 3 holds a live share; a blocklist would
  refuse a correct roster forever, and the set never forgets, so nothing could clear it.
  FTR-37 is that exact two-rotation scenario, and mutating the severity to `error` kills it.
- 8 new tests (FTR-33…FTR-40) built on real `frostKeygen` + `runDeltaRotationInProcess` +
  `signTransition` — the refusal in FTR-34 is produced by a signature a party below the old
  threshold could not have made, not by a hand-written fold.

## Mutation results, second pass (12 planted, 12 dead, 0 survivors)

| mutant | killed by |
| --- | --- |
| stale group key accepted (check removed) | FTR-34, FTR-35 |
| `retiredIndices` used as an identity blocklist | FTR-37 |
| a forked chain silently treated as current | FTR-38 |
| unreadable pin skipped instead of refused | FTR-39 |
| `assertRosterSound` ignores the chain fold | FTR-35 |
| pin format check made permissive | FTR-39 |
| forged transition admitted into the ledger | FTR-40 |
| NUL detector never fires | NUL-1,2,3,4,8 |
| line numbers not tracked | NUL-2, NUL-4 |
| per-line NUL count collapsed to one | NUL-3 |
| scope check accepts every path | NUL-9 |
| repo scan enumerates nothing (vacuous clean) | NUL-10 |

## Enforced vs bookkeeping (stated, not implied)

ENFORCED by cryptography: which token may open a share (`sealedByToken` is in the AAD and
the sealed bind string); which group key is current (transitions are threshold-signed by
the old quorum, and `foldChain` follows only signatures it verified from a held pin).

BOOKKEEPING: the roster FILE. It is unsigned JSON a human writes. This apparatus can now
prove a roster is STALE; nothing proves a roster is AUTHORISED. `location` is decoration.

## Open — and the custody decision NOT taken here

- **Who may change a roster, and what signs the change.** A signed roster would be the
  natural next object (threshold-signed by the same group, so a roster is an artifact of
  the custody set rather than a note about it) — but that is a custody decision about
  authority, not an engineering choice, and it is deliberately left open rather than
  decided in code.
- **A group-key-preserving refresh leaves no discriminator.** `zeroDelta` proactive refresh
  preserves the group key and revokes nothing, so a pre-refresh artifact is field-identical
  to its replacement in ca, x, threshold, groupPublicKeyHex and sealedByToken. Nothing in
  any artifact distinguishes them, so the roster cannot, and says so instead of implying a
  freshness it does not check. Closing it needs a refresh-generation field in the
  sealed-share AAD — a schema change, and a separate item. Destroying the superseded
  artifacts stays the operative control, and that control is a CEREMONY, not a check.
- The multi-token hardware lane (`pkcs11-multi`, HW-6…HW-12) still cannot run: no YubiKey
  bundle. UNVERIFIED on hardware, as before.
