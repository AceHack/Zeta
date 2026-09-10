---
id: 081M1W9ZADZ087G0R000D9ZJ6M
type: bug
state: done
priority: P2
slug: correct-antisybil-component-counts-interpreted-as-physical-s
title: "Correct AntiSybil component counts interpreted as physical source floors"
created: 2026-09-06T21:28:44.735Z
completed: 2026-09-06T21:49:49.859Z
depends_on: []
composes_with: []
---

# Correct AntiSybil component counts interpreted as physical source floors

The shipped threshold graph was described as a lower bound on independent
physical sources. Three balanced XOR masks of one shared stream produce
three disconnected components, so that interpretation is false.

Acceptance:

- Rename the source-floor helper to a correlation-component count.
- State the exact observable contract in the readout and direct quorum callers.
- Pin shared-stream recoding, bit-complement versus reversal, and component
  bridging counterexamples at the shipped native test boundary.
- Retain a dated indexed correction, independent review, and full gates.
- Keep the numerical detector/reducer behavior unchanged.

The CHSH coverage repair is separately claimed as
081M1W8PRK0087G0R000T7C4X8. Shared `AntiSybil.fs` ranges are coordinated:
this task owns its initial correlation/readout section; the other task owns
CHSH calibration and coverage below that section.

Implementation and local validation completed: public helper renamed, current
API/caller interpretations corrected, all nine new native counterexample facts
pass. Full Release build has zero warnings/errors; native suite 7,487 passed,
zero failed, six existing skips; final focused check 104 passed; historical
Python replay 17 passed; all 16 quick-preflight checks passed. Independent
agent API/code/report review accepted the correction.

Evidence is indexed at
`docs/research/relational-identity/2026-09-06-component-interpretation-correction.md`.
