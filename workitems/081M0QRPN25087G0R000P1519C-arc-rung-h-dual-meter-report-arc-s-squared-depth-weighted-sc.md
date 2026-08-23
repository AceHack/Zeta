---
id: 081M0QRPN25087G0R000P1519C
type: task
state: backlog
priority: P2
slug: arc-rung-h-dual-meter-report-arc-s-squared-depth-weighted-sc
title: "ARC rung H - dual-meter report: ARC's squared depth-weighted score beside our additive DeltaU, never blended into one number"
created: 2026-08-23T16:54:15.365Z
depends_on: ["081M0QRP9JY087G0R00146V04J"]
composes_with: []
---

# ARC rung H - dual-meter report: ARC's squared depth-weighted score beside our additive DeltaU, never blended into one number

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRPN25087G0R000P1519C-*.md` glob. -->

**Register: `proposed`.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §6.

ARC-AGI-3 scores `S = min(1, h/a)^2` per level (h = second-best human action count, a = agent action
count), then weights levels linearly by index. Our `SocietyUsefulWork` aggregation theorem is stated
over **additive** ΔU under pairwise correlation rho.

**Squaring is not additive.** `(x+y)^2 != x^2 + y^2`, so a squared score cannot be fed to our
aggregation theorem without breaking its hypothesis. Keep the raw efficiency `h/a` as the
ΔU-carrying quantity; treat `S = (h/a)^2` as THEIR presentation of it. Report both meters side by
side; never blend them into one number — they price different goods (ARC prices depth at
human-comparable efficiency; we price uncertainty removed).

**Blocked on something larger, and worth stating:** `measure.ts` records a ΔU **sign plus a witness,
never a number** — the register is ordinal by deliberate design. So `ΔU / anything` does not
currently typecheck as a quantity. ARC's level score is a real number in [0,1] from a decorrelated
external oracle over an environment nobody here designed, which makes it the strongest available
candidate for the **first cardinal ΔU the repo has ever had.** That promotion, if taken, is the
actual content of this rung.
