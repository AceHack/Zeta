---
id: 081M0QC66N5087G0R003R3ARYH
type: bug
state: backlog
priority: P1
slug: main-is-red-lint-ts-fails-on-src-apps-twitch-ai-src-swarm-wo
title: "main gate (required) red: the lint (TS) half self-resolved in 7a2339db3; test (TS hermetic) is still failing on the mutation-findings measurement suite"
created: 2026-08-23T13:15:33.413Z
depends_on: []
composes_with: []
---

# main gate (required) red: the lint (TS) half self-resolved in 7a2339db3; test (TS hermetic) is still failing on the mutation-findings measurement suite

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QC66N5087G0R003R3ARYH-*.md` glob. -->

## Measured (2026-08-23, found incidentally while auditing toolchain currency)

`bun src/Core.TypeScript/lint/lint-typescript.ts` — the exact command the `lint (TS)` gate
job runs — exits **1** on `origin/main`:

```text
=== TypeScript type check: tsc ===
src/apps/twitch-ai/src/swarm.worker.ts(40,24): error TS2345:
  Argument of type '{ apiKey: any; baseUrl: any; model: string; }'
  is not assignable to parameter of type 'number'.
✗ TypeScript type check: tsc: exited with code 2
```

Confirmed in CI, not only locally — `gate.yml` run **32639819848** on `main`
(`ba965f8636`) failed three jobs:

| job                   | conclusion  |
| --------------------- | ----------- |
| `test (TS hermetic)`  | failure     |
| `lint (TS)`           | failure     |
| **`gate (required)`** | **failure** |

`git log -1 -- src/apps/twitch-ai/src/swarm.worker.ts` → `3d40e4589`,
_"feat: restore twitch-ai and mutual-sim after revert (#14159)"_.

## Why this is P0

`gate (required)` is the branch-protection gate. While it is red on `main`, **every open PR
inherits the failure**, including PRs that touch nothing near this file. It is the fleet-wide
blocker, not a local nuisance.

## Deliberately not fixed by the finder

`SwarmController.init` takes a `number` and the call site passes an options object. Which side
is wrong is an intent question — a seed parameter that grew an options overload upstream, or a
call site copied from a different API. **Guessing would be a silent behaviour change inside
someone else's in-flight feature**, and the whole point of the audit that found this is that
unwitnessed claims are the defect. Routed to the owner of #14159 with the evidence attached.

## Done when

`bun src/Core.TypeScript/lint/lint-typescript.ts` exits 0 on `main` and `gate (required)`
is green.

---

## CORRECTION 2026-08-23T13:40Z — half of this closed itself, thirty minutes after it was filed

**The `lint (TS)` half is RESOLVED on `main` by `7a2339db3` (#14169).** The source now reads:

```ts
// SwarmController.init takes a UDP drop-rate number, not LLM settings.
// Persona/host config lives in persona-registry; this worker cannot
// retarget it by passing an options object.
await swarm.init();
```

Verified: `gate.yml` run **32641157957** at `7a2339db36` has `lint (TS)` **green**. Note the
resolving commit answered the intent question the _other_ way from the call site — the options
object was the wrong side — which is why declining to guess was right.

**The `test (TS hermetic)` half is still red** at that same commit, so `gate (required)` on
`main` is still failing. The failures are in the measurement/bootstrap suite over
`db/mutation-findings/`, e.g.:

```text
(fail) pointAt(WORKTREE) === measure(), field for field, by strict equality
(fail) the live frame contains every draw — so `strayDraws` at the tip is 0
(fail) the effective count is strictly below the head count
```

Unrelated to #14159 and to the radar/currency work that found it. **This item is retargeted to
that half** and dropped P0 → P1: the fleet-wide blocker framing was accurate for the twitch-ai
error and is not accurate for a suite whose failures predate it.

## Method note kept on purpose

The original filing said "every open PR inherits it, including this one". That turned out to be
**false for the `lint (TS)` half**, and the reason is worth carrying: `actions/checkout` on a
`pull_request` event resolves `refs/pull/N/merge` — head merged into base — so a PR's CI tests a
tree that already contains whatever `main` has since fixed, while a local branch-only run does
not. Same command, two trees, two truthful answers. The claim was true when measured and stopped
being true without anything in this branch changing, which is the exact failure mode the tech
radar had.

## Done when

`test (TS hermetic)` and `gate (required)` are green on `main`.
