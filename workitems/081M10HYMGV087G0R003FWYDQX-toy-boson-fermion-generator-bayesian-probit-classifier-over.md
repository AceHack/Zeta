---
id: 081M10HYMGV087G0R003FWYDQX
type: task
state: backlog
priority: P2
slug: toy-boson-fermion-generator-bayesian-probit-classifier-over
title: "toy boson/fermion generator + Bayesian probit classifier over Cl(4) grading and the [8,4,4] adinkra code"
created: 2026-08-27T02:49:26.811Z
depends_on: []
composes_with: []
---

# toy boson/fermion generator + Bayesian probit classifier over Cl(4) grading and the [8,4,4] adinkra code

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M10HYMGV087G0R003FWYDQX-*.md` glob. -->

**Register: `toy`.** Nothing here is metered against physics; "boson"/"fermion" names a Z₂ grading.

Landed 2026-08-27. Result, verdict, and every number:
[`docs/research/2026-08-27-toy-boson-fermion-generator-cl4-and-the-adinkra-code-the-bnn-adds-nothing-and-degrades-exactly-at-the-code-bound.md`](../docs/research/2026-08-27-toy-boson-fermion-generator-cl4-and-the-adinkra-code-the-bnn-adds-nothing-and-degrades-exactly-at-the-code-bound.md).

- `src/Bayesian/ToyBosonFermionGenerator.fs` — seeded generator (nothing stored), Cl(4) 8+8 blade
  grading, the N=8 adinkra's 16 cosets as an independent second path, and the metered entropy
  channel (discipline #13).
- `src/Bayesian/ToyBosonFermionBnn.fs` — three closed-form baselines, the toy Bayesian probit
  classifier over `Ep.probitProject`, both mandatory controls, and calibration.
- `tests/Tests.FSharp/ToyBosonFermionParity.Tests.fs` — 24 falsifiers, mutation-checked.
- `src/Bayesian/toy-boson-fermion-golden-vectors.json` — hex-in-JSON byte-lock of the generator.

**Verdict: the BNN adds nothing.** It matches the closed-form Bayes ceiling to within 0.006 at
every damage level and never exceeds it, so the `toy` prefix stays. What the study does produce:
the posterior degrades *exactly* at the code's unique-decoding radius (perfect and confident at
realized damage ≤ 1, collapsing at 2), and at damage 3 it is confidently wrong — as is the exact
closed-form posterior, identically.
