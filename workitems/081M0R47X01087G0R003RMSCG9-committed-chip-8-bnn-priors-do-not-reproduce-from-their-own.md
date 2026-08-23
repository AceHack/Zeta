---
id: 081M0R47X01087G0R003RMSCG9
type: bug
state: backlog
priority: P2
slug: committed-chip-8-bnn-priors-do-not-reproduce-from-their-own
title: "Committed CHIP-8 BNN priors do not reproduce from their own recipe — measured 3.3e-14 relative drift, header claims byte-identical"
created: 2026-08-23T20:15:54.881Z
depends_on: []
composes_with: []
---

# Committed CHIP-8 BNN priors do not reproduce from their own recipe — measured 3.3e-14 relative drift, header claims byte-identical

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R47X01087G0R003RMSCG9-*.md` glob. -->

## What was measured

Fresh clone at `origin/main` (closure verified unchanged since `07b92bee`), macOS 15 / arm64,
bun 1.3.14. Ran the recipe printed in each priors file's own header.

- Structural fields reproduce **exactly**: `fingerprint`, `cart`, `trainedTicks`, `seed`,
  `exploreTicksDone`, `nu`, `obsCount`, key ordering (51/51 beliefs).
- `mu` / `sigma2` reproduce **on none of 51 beliefs**. Max relative divergence
  `3.296e-14` (`mu`) / `5.004e-14` (`sigma2`); max ULP distance `148.5`.
- Run-to-run in one environment is byte-identical; bun 1.3.13 and 1.3.14 agree with each
  other and both differ from the committed bytes. So the drift is **environment-to-environment**.
- Cause: `Math.hypot/cbrt/cos/exp/log1p` are implementation-approximated in ECMAScript and
  measured to differ at 1 ULP between JavaScriptCore and V8; the manifest declares
  `cart`/`ticks`/`seed` but **not the runtime**.

## Why it is a bug rather than a curiosity

Each generated file asserts *"Reproduce (byte-identical, COMMON_SEED end to end)"* unconditionally.
That claim is false across machines — an unenforced claim that looks like a guarantee and carries
none. Separately, `--verify` trains twice **in one process**, so it cannot fail in the dimension
that matters (the vacuity class).

Not a correctness bug in the arena: decision margins measured `~2e-4` against `~3e-14` drift,
so the trajectory did not diverge.

## Fix options (no enforcement in this pass)

State the measured `tolerance` bound honestly, or make the computation platform-independent.

Design: `docs/design/2026-08-23-verified-prior-provenance-prove-your-work-let-others-reproduce-exactly.md`
