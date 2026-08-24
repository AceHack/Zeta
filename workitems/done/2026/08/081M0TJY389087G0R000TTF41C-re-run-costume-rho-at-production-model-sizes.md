---
id: 081M0TJY389087G0R000TTF41C
type: task
state: done
priority: P1
slug: re-run-costume-rho-at-production-model-sizes
title: "Re-run costume-rho at production model sizes — give N_eff a reading"
created: 2026-08-24T00:00:00.000Z
completed: 2026-08-24T20:01:31.582Z
depends_on: []
composes_with: []
---

# Re-run costume-rho at production model sizes — give N_eff a reading

## This ID was cited in a brief but never filed

The scoping analysis in
`docs/research/2026-08-24-the-accurate-meter-is-four-measurements-*.md` (PR #14911)
ranks this work #1 of four, and the brief commissioning it states the work-item
"already exists" under this ZetaId. **It did not.** Measured 2026-08-24:
`find`/`rg` over the tree return nothing, and `gh search code --repo
Lucent-Financial-Group/Zeta 081M0TJY389087G0R000TTF41C` exits 0 with zero bytes
of output — a genuine no-result, not a usage error.

Filing it under the cited ID so the reference resolves, rather than minting a new
one and leaving the brief and the AgencySignature `Task:` key pointing at nothing.
Same disposition as `081KSNY2Z0008QG0R002JKH50A`, which was cited in `Crypto.fs`
before it was filed.

## Why

`src/Bayesian/CondorcetBoundary.fs` gives `N_eff = N / (1 + (N−1)·ρ) → 1/ρ`:
correlation does not *discount* effective identity, it **caps** it. The formula is
proven; its input was unmeasured at the sizes the fleet actually runs. Without a
production-roster ρ̂, `N_eff` is an instrument with no reading, and every claim
that the agent fleet is worth more than one agent is unpriced.

`src/Core.TypeScript/costume-rho/` had been run only at 7b/8b/9b.

## Scope

Re-run the existing, unmodified harness at the production model sizes on the same
200-item set, pinned to the commit that produced the prior responses so only the
model size varies. Report ρ̂ with its CI, the boundary ρ\*, and the resulting
`N_eff`. Zero model spend — local ollama.

## Outcome

See `docs/research/2026-08-24-costume-rho-at-production-sizes-preregistration.md`
(predictions, committed before any data existed) and
`docs/research/2026-08-24-costume-rho-at-production-sizes-results.md` (the reading).
