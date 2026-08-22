---
id: 081KZMCBDK208QG0R000YE008C
type: bug
state: backlog
priority: P2
slug: derivation-b-key-custody-gaps-ac-3-vacuous-retraction-ignore
title: "Derivation B key-custody gaps — AC#3 vacuous, retraction ignored by fold, grant span unbounded"
created: 2026-08-09T23:04:59.234Z
depends_on: []
composes_with: []
---

# Derivation B key-custody gaps — AC#3 vacuous, retraction ignored by fold, grant span unbounded

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZMCBDK208QG0R000YE008C-*.md` glob. -->


## What this is

**Combine inputs for the N-version key-custody derivation.** Four gaps in derivation B
(PR #10245, merged, `src/Core.TypeScript/key-custody/`), each **confirmed by execution**
rather than by reading. Filed rather than fixed: patching B would make the reviewer a third
derivation touching the second, destroying the independence the N-version protocol buys.

The execution probe was a session scratchpad and is not preserved in this repository; the
reproducible findings are retained below without claiming a durable source path.

| Gap | Requirement | Confirmed behaviour |
|---|---|---|
| **AC#3 vacuous** | Acceptance #3 — a custody fork leaves the prior custodian able to read pre-fork and **unable** to read post-fork content | No exported function answers the question. The property is a literal field `priorCustodianRetainsPreFork: true`, true by construction. `validateTransfer` returns `allowed=true` with `keysInvalidatedPostFork: []`. |
| **Retraction ignored by fold** | R6 — retraction rather than deletion **changes the fold's result** | `rotateKey` emits a `key-retracted` event; `foldEvents` has no case for it (falls to `default: break`). Deleting the retraction events leaves the folded state **byte-identical** — so the retraction is decorative. |
| **Grant span unbounded** | R8 — the **default MUST be bounded** rather than indefinite | `expiresAtPhase: Number.MAX_SAFE_INTEGER` is constructible and still live at phase 1e15. The type forces the *field* to exist but never bounds the *span*, so indefinite authority is reachable — the capture R8 exists to prevent. |
| **Deny cites wrong grant** | R12 — an authorization result carries the reason | With grants expiring at 5 and 100, `authorize` at phase 200 reports *"expired at phase 5"* — `matching[0]`, not the longest-lived. Outcome correct, explanation misleading. |

## The AC#3 one is the serious one

It is the **vacuity class** PR #10229 ("make nothing vacuous") was cleaning up, and it is on
`main`. A criterion satisfied by a boolean literal that cannot be false is not tested by any
test that asserts it — the assertion passes because the field's type is `true`.

## Divergence signal (why the double derivation paid)

Derivation A appears to close three of the four independently: an enforced `MaxSpan = 65536L`
with `tryWindow -> Result<PhaseWindow, WindowError>` (R8), `Result<_, RotationError>` instead
of `throw` (repo Result-over-exception convention), and `explainAuthz` (R12). A is still
running; that comparison is provisional until it lands.

**Where A and B diverge, the spec was ambiguous.** The largest divergence found so far is the
**phase model**: B takes `currentPhase: number` (opaque scalar); A derives phase from a
`TravelerFrame.Frame` observation via `Versionstamp`/`PhaseWindow`. The spec said "agreed
phase" and never pinned which. That is a spec defect, not an implementation defect, and
fixing the spec is the higher-value output.

## Done when

The combine pass has ruled on each of the four, and the spec has been amended where the
divergence showed it was ambiguous (phase model first).
