---
id: 081M037KPF6087G0R003WBV46R
type: task
state: backlog
priority: P2
slug: git-native-per-machine-declared-state-ace-pm-as-reconciler-b
title: "Git-native per-machine declared state + ACE PM as reconciler + biometric gate for system-level diffs (recovered lost row B0747; 18 live rows cite the never-landed id)"
created: 2026-08-15T17:30:44.070Z
depends_on: []
composes_with: []
---

# Git-native per-machine declared state + ACE PM as reconciler + biometric gate for system-level diffs (recovered lost row B0747; 18 live rows cite the never-landed id)

> **Legacy-id rendering:** old ids appear here **without the hyphen** (`B0747`, not the
> hyphenated form). `lint-no-b-refs` forbids hyphenated legacy refs on live authored surfaces,
> and `docs/research/` + `workitems/` are live surfaces — exempting them would make that lint
> unfalsifiable. The hyphenless form is already the repo's convention in directory names.

## Provenance — recovered, not new

Resurrected from **B0747**, which never landed on `main` in any form. Its only surviving copy is
under `docs/recovered-orphan-branches-2026-05/misc/backlog/b0747-git-native-per-machine-state-gitops-reconciliation-aaron-2026-05-25/docs/backlog/P2/` (348 lines).
The frozen alias map assigned it `081KSE6WT0008QG0R003D199HE`; **no file with that id was ever
added on any ref** (verified with `git log --all --no-renames --diff-filter=A`, method validated
against 49 known-landed ids).

**Why this ranked first in the sweep: 18 live rows on `main` cite the phantom id** — among them
`081KSE6WT0008QG0R0008483B2` (cluster-as-digital-twin), `081KSE6WT0008QG0R001H3DA90` (F# type
system as universe boundary), `081KSE6WT0008QG0R00049EFBD`, `081KSE6WT0008QG0R000RH1526`,
`081KSE6WT0008QG0R0016CEE2Z`. A load-bearing dangling dependency, not a stale idea.

## The carved blade (Aaron 2026-05-25, preserved from the recovered row)

> The hard-managed-vs-soft-managed dichotomy is FALSE. With a **git-native representation of
> installed-or-not per machine** + **current cached state of any given machine**, ACE PM becomes a
> RECONCILER that compares declared-vs-observed + dispatches each diff appropriately: user-space
> diffs auto-install (hard-managed); system-level diffs gate on Touch ID consent (soft-managed at
> the biometric gate, but otherwise automated). Result: **BOTH at the same time,
> per-package-as-needed.**

Aaron's originating words: *"it would be both if they had some gitnative representation of
installled or not per machine and the current cached state of any given machine."*

## Assessment against three months of change (2026-08-15) — the reframe

A copy-paste resurrection would be wrong. Two things moved since 2026-05:

1. **Zero-dev-machines direction** (`081KSGS9H0008QG0R00153CQ8B`, P1, open) — dev machines become
   *conversational interfaces*; the cluster becomes the primary work substrate. So the original
   framing (declare state for Aaron's/Max's/Addison's laptops) is now the **weak** half. The
   **cluster-node** half is correspondingly *stronger*: GitOps for machine state is exactly what
   20 bare-metal nodes want.
2. **Both its dependencies have since landed** — the biometric gate as
   `.claude/rules.bak/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md`,
   and the passkey/WebAuthn substrate as real code (`src/Core.TypeScript/planning/` —
   `verifyAuthorizedWebAuthnAssertion`, `ProposalPasskeyEnrollment`). The consent half is no
   longer speculative; only the reconciler is missing.

**Still wanted, re-aimed at cluster nodes first, laptops second.**

## Register

`unmetered` (toy-is-free-metered-must-be-earned). No falsifier attached — the recovered row is a
design sketch (declared-state shape + observed-state cache), not a measurement.

## Scope sketch (from the recovered row, not re-derived)

- Per-machine declarative state: `machines/<hostname>.yml` — packages with
  `{name, source, version, lifecycle: build-time|runtime, system-level: bool}`, hat-bindings,
  ontology-version. (`machines/` exists today but holds only cert pubkeys.)
- Per-machine **observed** state cache — queryable; threat-model decision on where it lives.
- ACE PM as reconciler: declared vs observed to diff to dispatch. User-space diff auto-applies;
  `system-level: true` diff gates on the biometric challenge.

## Pointers

- Census + method: `docs/research/2026-08-15-lost-bnnnn-work-on-recovered-orphan-branches-census-and-triage.md`
- ACE PM live substrate: `081KSGS9H0008QG0R0031PBNGA` (PM-of-PMs, P1) ·
  `workitems/081KTFKQGZP08QG0R001ND3VK2-*` (ACE package manager)
