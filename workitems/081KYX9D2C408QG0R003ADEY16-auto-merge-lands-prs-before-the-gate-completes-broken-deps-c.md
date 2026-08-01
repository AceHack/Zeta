---
id: 081KYX9D2C408QG0R003ADEY16
type: bug
state: backlog
priority: P2
slug: auto-merge-lands-prs-before-the-gate-completes-broken-deps-c
title: "auto-merge lands PRs before the gate completes — broken deps (CS9057) reached main"
created: 2026-07-31T23:50:55.620Z
depends_on: []
composes_with: []
---

# auto-merge lands PRs before the gate completes — broken deps (CS9057) reached main

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYX9D2C408QG0R003ADEY16-*.md` glob. -->

## Symptom

PR #9774 (Dependabot dotnet-runtime group) merged to `main` with `gate (required)` and all three
`build-and-test` legs (macos-26, ubuntu-24.04, ubuntu-24.04-arm) showing **fail** — a genuine
`Build FAILED` (CS9057). Main sat red until the follow-up fix (#9804). #9804 itself then merged while
its own gate was still **pending** (4 pass / 30 pending) — confirming the merge path does not wait for
the gate to reach terminal success.

## Two compounding causes

1. **Auto-merge merges on the non-gate checks.** `gh pr merge --auto --squash` landed both #9774 (gate
   failed) and #9804 (gate pending). Branch protection is not enforcing `gate (required)` as a hard
   terminal-success requirement — a PR merges once the *cheap* checks pass, before/independent of the
   gate's build+test verdict.
2. **Every-minute metrics-tick churn cancels in-flight gate runs on `main`.** `metrics: append tick
   frame [skip ci]` commits push to main every ~minute; even with `[skip ci]`, the concurrency group
   cancels the main-branch gate run that was validating the prior tip. So a required check that never
   reaches a terminal state can never *block*.

Net: a broken change can ride in past a "required" gate that is either bypassed (cause 1) or never
completes (cause 2).

## Evidence

- CS9057 on all 3 legs: run 29636027742 (job 88058441932) — `Zeta.Generators.dll ... references version
  '5.6.0.0' ... newer than the currently running version '5.3.0.0'`.
- Root dep regression: #9774 bumped `Microsoft.CodeAnalysis.CSharp/.Analyzers` 5.3.0 → 5.6.0, undoing
  the deliberate "matches SDK" pin from #9684. SDK (global.json 10.0.203) runs Roslyn 5.3.
- Fix: #9804 restored 5.3.0; `dotnet build Zeta.sln -c Release` → 0 warn / 0 err locally + on main tip.

## REFRAMED 2026-08-01 (Aaron) — a CI gate is the WRONG fix; it borrows a forge authority

Aaron: *"we are moving away from forge hosts towards fully git-native then zetadb-native over time. CI
gates are for corporate jobs not sovereign ones, and sovereign digital artificial life does not need CIs."*

This corrects shadow's own earlier recommendation below, which was inconsistent: the same session wrote
"do NOT harden anything against GitHub specifically" into `tools/setup/persona-keys/ca.ts`, then asked a
human to configure **GitHub branch protection** — the same borrowed authority, one layer up.

**A CI gate is PREVENTION BY A CENTRAL AUTHORITY** (a host says "no"). The Zeta-native answer is the
pattern this repo is already built on: **RETRACTION OVER PREVENTION**. A red `main` is not a catastrophe
when the correction is a first-class event — which is exactly what happened twice on 2026-08-01
(CS9057 → #9808/#9807; 42 TS errors → #9835), both found and retracted by a peer within minutes, with no
authority involved.

Note WHERE the two reds came from: a forge-host bot (Dependabot) and a commit that did not verify
locally. **Neither would have been stopped by a better gate** — both would have been stopped by the
WRITER verifying before pushing, which needs no host. Same shape as "every node is its own CA":
verification is local and sovereign; attestation is what travels.

### The ladder (mirrors the identity-plane ladder, 081KYXQ3SZN08QG0R002X3DTQM)

| rung | mechanism | authority borrowed |
|---|---|---|
| now | forge CI gate | the host says no |
| **near** | `bun run preflight` before push, per writer | none — local |
| **git-native** | a signed **BUILD RECEIPT** in the commit (tree hash + gate result + signer) | none — peers verify the attestation |
| **zetadb-native** | red state is **RETRACTED** (−1) in the fold; convergence, not permission | none |

The receipt rung is SPIFFE-shaped — **attestation, not permission** — and composes directly with the
identity plane: the same committed-anchor key that attests a CA can sign a build receipt.

### What to actually do (no forge configuration)

1. **Nothing on GitHub.** Do NOT add branch protection; it hardens against a host we are leaving.
2. **Writer-local verification is the real fix** — `bun run preflight` (and `bun
   src/Core.TypeScript/lint/lint-typescript.ts`) before push. Sovereign, needs no host.
3. **Keep the substrate guards that are host-independent** — e.g. the CS9057 guard
   (`src/Core.TypeScript/hygiene/audit-codeanalysis-sdk-match.ts`) reads the SDK's own Roslyn version and
   works in any runner, cron process, or browser tab. THAT is the right class of guard: it travels with
   the repo, not the forge.
4. **Dependabot is itself a forge-host coupling** — the deeper fix is that dependency bumps should be
   proposed as ordinary events a writer verifies, not pushed by a host bot with commit rights.
5. **Next increment:** design the build receipt (what it attests, how a peer verifies it, where it lives
   in the commit) as the git-native rung. That is buildable now and removes the gate's job entirely.

### Superseded (kept for the record — shadow's original forge-shaped options)

- ~~(a) Enforce the gate as a terminal-success required check in branch protection~~ — REJECTED: borrows
  the host's authority; the exact thing being retired.
- ~~(b) Exempt metrics-tick commits from cancelling gate runs~~ — moot once the gate is not load-bearing.
- (c) Guard rail on SDK-coupled packages — **KEPT and already shipped** (#9807), because it is
  host-independent: it reads the local SDK, not a forge API.

## Disposition

**No human forge-configuration is requested.** The original filing asked for branch-protection sign-off;
that ask is WITHDRAWN per the reframe above — it would harden against a host being retired. Nothing here
is blocked on a gated action.

What remains is ordinary buildable work, not policy: writer-local verification as the norm, and the
git-native BUILD RECEIPT (work-item 081KYYJEJ4X08QG0R003P8GXSY, minted alongside). Filed by shadow* from the
2026-07-31 autonomous tick that caught + fixed the first red (#9804); reframed 2026-08-01 after Aaron
named the category error.
