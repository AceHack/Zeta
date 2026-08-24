---
id: 081M0Q9Y63V087G0R0007RX4E8
type: task
state: backlog
priority: P2
slug: lean-toolchain-pinned-to-v4-30-0-rc1-a-release-candidate-mov
title: "Lean toolchain pinned to v4.30.0-rc1 (a release candidate): move to a stable tag with lake build + axiom audit as evidence"
created: 2026-08-23T12:36:13.563Z
depends_on: []
composes_with: []
---

# Lean toolchain pinned to v4.30.0-rc1 (a release candidate): move to a stable tag with lake build + axiom audit as evidence

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q9Y63V087G0R0007RX4E8-*.md` glob. -->

## Measured (2026-08-23)

|                     | value                                      | source                                                            |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| our toolchain pin   | `leanprover/lean4:v4.30.0-rc1`             | `src/Core.Lean4/lean-toolchain`                                   |
| our Mathlib rev     | `0c154d67103f74be3a0f2c509f72ccbf5be9f2a7` | `src/Core.Lean4/lake-manifest.json`                               |
| that rev's identity | **exactly** the Mathlib tag `v4.30.0-rc1`  | checked against `leanprover-community/mathlib4` tags, not assumed |
| v4.30.0 **final**   | 2026-05-26                                 | `leanprover/lean4` releases                                       |
| current stable      | **v4.33.1** (2026-08-21)                   | `gh api repos/leanprover/lean4/releases/latest`                   |
| Mathlib tag for it  | `0df444a360eaa60ab8c11dca51a86af692955474` | mathlib4 tag `v4.33.1`                                            |

We are pinned to a **release candidate** of a line whose final shipped ~3 months ago, and
that line is three minors behind stable. Nothing about the pin is broken — this is drift,
not breakage.

## Evidence that the move is probably cheap

The `Zeta23/LinAlg` port landed 2026-08-22 from upstream `v4.33.0-rc2` / Mathlib
`51e6992efd06` (verified: that hash _is_ the mathlib `v4.33.0-rc2` tag) and **built at our
v4.30.0-rc1 pin with zero proof edits**. Three minors of Mathlib churn did not touch what we
use. That is one datapoint, not a proof — it is why this is P2 and not P1.

## Two candidate moves, and they are not the same size

1. **`v4.30.0-rc1` → `v4.30.0`** — RC to final, same minor. Smallest possible step; removes
   "we ship on an RC" without importing three minors of Mathlib. Do this one first if the
   full move stalls.
2. **`v4.30.0-rc1` → `v4.33.1`** — current stable. The real currency fix.

## Done when

- The pin moves in **its own change**, carrying as evidence: a full `lake build` under the
  new toolchain, `AxiomAudit.lean` output before/after, and `.github/workflows/lean-proof.yml`
  green.
- `docs/TECH-RADAR.md`'s Lean row is updated to name the new pin.

**Deliberately NOT done in the radar/currency PR** (`docs/radar-ring-drift-and-currency`): a
toolchain move without a build + axiom audit beside it is exactly the unwitnessed claim the
radar drift was made of.

---

## Re-confirmed 2026-08-23 (currency sweep, `deps/security-roll-and-ecosystem-coverage`)

Deliberately **not taken** in that PR, and the sizing above stands unchanged. One thing to
add to the evidence list in "Done when": the `Zeta23/LinAlg` port landed on 2026-08-22, so a
toolchain move now has to **re-verify that port specifically**, not just `lake build` in
aggregate — it is the newest and least-settled thing riding on the pin, and "the build was
green" would not distinguish "the port still holds" from "the port still compiles".

Order preference is unchanged and worth restating because it is the cheap win: `v4.30.0-rc1`
-> `v4.30.0` removes "we ship a release candidate of a superseded version" for one minor's
worth of risk, and can land even if the full `v4.33.1` move stalls on Mathlib churn.
