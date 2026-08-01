---
id: 081KYYJEJ4X08QG0R003P8GXSY
type: task
state: backlog
priority: P2
slug: git-native-build-receipt-a-signed-attestation-in-the-commit
title: "Git-native BUILD RECEIPT: a signed attestation in the commit (tree hash + verification result + signer) that replaces the CI gate's job — attestation not permission, peers verify, no forge host"
created: 2026-08-01T11:48:16.157Z
depends_on: []
composes_with: []
---

# Git-native BUILD RECEIPT: a signed attestation in the commit (tree hash + verification result + signer) that replaces the CI gate's job — attestation not permission, peers verify, no forge host

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYYJEJ4X08QG0R003P8GXSY-*.md` glob. -->

Aaron 2026-08-01: *"CI gates are for corporate jobs not sovereign ones, and sovereign digital artificial
life does not need CIs."* This is the git-native rung that removes the gate's job — see the reframe in
work-item `081KYX9D2C408QG0R003ADEY16`.

## The shift: attestation, not permission

A CI gate is **prevention by a central authority** — a forge says "no". A receipt is **attestation**: a
writer states, signed, *"I verified this tree and here is the result"*, and any peer can check that claim
without asking a host. Same move as the identity plane (`081KYXQ3SZN08QG0R002X3DTQM`): every node is its
own CA; what travels is the attestation, not the permission.

## Deliverable

A signed receipt committed with (or alongside) the change, minimally attesting:

- **tree hash** it applies to (so the receipt cannot drift from the code it claims),
- **what was run** (the verification set + versions — e.g. `dotnet build Zeta.sln -c Release`, the TS lint,
  the test suite) and **its result**,
- **signer** — the same committed-anchor key that attests a CA (`maintainers/<ca>/ssh-ca.pub`), so the
  identity plane and the build plane share one attestation substrate,
- **verifiability**: a peer re-runs (or spot-checks) and either corroborates or **retracts**.

## Design constraints

- **Host-independent by construction**: must work in a forge runner, a plain cron process, a browser tab,
  or a peer with only a clone — the same target set as the forge-host plugin seam.
- **Retraction over prevention**: a receipt that turns out false is *corrected by an event* (a −1), not by
  a gate that would have blocked. Red state converges away; it is not forbidden.
- **No new central authority**: verifying a receipt must never require calling a forge API.
- Text-only, diffable (`no-binary-in-proof-lineage`).

## Why now

Two 2026-08-01 reds (CS9057, 42 TS errors) came from a forge-host bot and an unverified push — **neither
would have been stopped by a better gate**; both would have been stopped by writer-local verification,
and both were in fact *retracted* by a peer within minutes with no authority involved. The receipt makes
that already-working loop legible and checkable instead of implicit.

## Composes with

`081KYXQ3SZN08QG0R002X3DTQM` (identity plane — shares the signing anchor);
`081KYWE8Q4008QG0R000H558SH` (SchemaLog — the ±1 fold a retraction rides);
`src/Core.TypeScript/hygiene/audit-codeanalysis-sdk-match.ts` (the model of a host-independent guard).
