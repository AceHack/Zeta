# Known Potential Flakes

Tracking file for test flakes observed but not yet root-caused. If a flake recurs, check here first.

---

## 1. SoftMode property flake (2026-07-03)

**Reporter:** Otto (via math team run)
**Test:** Unknown SoftMode property in `SoftMode.Tests.fs` (not the new SM-6/SM-6b)
**Behavior:** Failed once on a specific FsCheck seed, passed on rerun.
**Hypothesis:** Likely a degenerate Gaussian (near-zero precision or extreme precision-mean) that triggers a float boundary in the EP fixed-point iteration. The properness invariant (SM-1 through SM-4) may need an ε-guard on the input generator to exclude pathological cases.
**Status:** Noted, not touched. Will investigate if it recurs.
**Action if recurs:** Capture the failing seed, reproduce, check if the generated Gaussian violates the implicit precondition of `runToFixpoint`.

---

## 2. Equal-lengthscale g(r) convergence ε-slack (2026-07-03)

**Reporter:** Otto (via math team run)
**Test:** A convergence test where equal-lengthscale pairs sit at g(r) exactly at every Δ.
**Behavior:** The ratio is Δ-free (exact), so the convergence leg needed ε-slack against float noise.
**Resolution:** Documented in the test with explicit tolerance. Not a flake per se — a float-precision boundary that was correctly handled with ε-slack.
**Status:** Fixed (ε-slack added to test assertion).
