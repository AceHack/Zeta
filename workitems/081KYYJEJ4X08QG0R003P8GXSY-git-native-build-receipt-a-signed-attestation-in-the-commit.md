---
id: 081KYYJEJ4X08QG0R003P8GXSY
type: task
state: in-progress
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

## Slice 1 SHIPPED 2026-08-17 — format + verifier (Otto)

The format, its cryptography, and a verifier that refuses bad values. Deliberately NOT wired
into any CI job: `--require-receipt` is opt-in, because a receipt that blocks a merge has
become the gate this work-item exists to remove.

- `src/Core.TypeScript/crypto/sshsig.ts` — pure-TS **SSHSIG** (OpenSSH `PROTOCOL.sshsig`,
  ed25519) verification. No `ssh-keygen` needed to VERIFY, so a browser tab or a peer with a
  clone can check a claim; `ssh-keygen -Y sign` (or ssh-agent / 1Password) still produces one,
  so signing keys never have to be exported. Checked against real `ssh-keygen` output, not
  against itself.
- `src/Core.TypeScript/hygiene/build-receipt.ts` — the five-key trailer block, canonical
  length-prefixed signing bytes, parse/verify, and `detectReceiptConflicts` (the −1).
- `src/Core.TypeScript/hygiene/verify-build-receipt.ts` — `verify` and `sign` over plain `git`.
  Only external programs: `git`, and `ssh-keygen` for signing.
- `src/Core.TypeScript/hygiene/build-receipt-checks.json` — the CLOSED check vocabulary.

Bound to the **tree oid**, not the commit oid: a message is an input to its own commit hash,
so a receipt inside the message cannot name its commit, while `git write-tree` fixes the tree
before the commit exists. Consequence stated plainly — a receipt attests to a SNAPSHOT, never
to a history, and must not be read as approving a merge.

Signers are read from the already-committed `maintainers/<who>/ssh-pubkeys.txt`; no second key
registry was minted. `maintainers/zeta/ssh-ca.pub` is excluded by default (a CA key signs
certificates, not build claims).

**What a valid receipt proves:** the holder of that key signed *these results over this tree*;
results and tree cannot be edited without breaking the signature. **What it does not prove:**
that the checks were ever run. Nothing observes the signer's machine. The value is that a false
claim is now attributable and retractable, not that it is impossible.

### Remaining gap (slice 2+)

1. **No receipt has ever been signed by a real identity.** Provisioning a signing key is a
   custody decision (which key, held where, biometric-gated?) and is Aaron's, not the shadow's.
   Until one exists, every real commit verifies as `untrusted-signer` — which is the honest
   report, not a bug.
2. **Corroboration across commits.** `detectReceiptConflicts` works within one message; two
   peers attesting the same tree from different commits needs the SchemaLog ±1 fold
   (`081KYWE8Q4008QG0R000H558SH`) to carry the receipts as events.
3. **Nothing produces receipts automatically.** `sign` is a hand-run verb; a writer-local
   post-verify hook that emits one is the obvious next rung.

## Composes with

`081KYXQ3SZN08QG0R002X3DTQM` (identity plane — shares the signing anchor);
`081KYWE8Q4008QG0R000H558SH` (SchemaLog — the ±1 fold a retraction rides);
`src/Core.TypeScript/hygiene/audit-codeanalysis-sdk-match.ts` (the model of a host-independent guard).
